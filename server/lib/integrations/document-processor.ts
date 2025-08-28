import { GoogleDriveClient, type ProcessedDocument } from './google-drive';
import { PineconeClient } from './pinecone';
import { app } from '~/app';

export interface DocumentProcessingResult {
  success: boolean;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalChunks: number;
  errors: Array<{
    fileName: string;
    error: string;
  }>;
}

export class DocumentProcessor {
  private googleDrive: GoogleDriveClient;
  private pinecone: PineconeClient;

  constructor() {
    this.googleDrive = new GoogleDriveClient();
    this.pinecone = new PineconeClient();
  }

  async initializePinecone(): Promise<void> {
    try {
      await this.pinecone.initialize();
    } catch (error) {
      // If index doesn't exist, try to create it
      if (error instanceof Error && error.message.includes('not found')) {
        app.logger.info('Pinecone index not found, creating new index...');
        await this.pinecone.createIndex();
      } else {
        throw error;
      }
    }
  }

  async processGoogleDriveFolder(folderId?: string): Promise<DocumentProcessingResult> {
    const folderIdToProcess = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (!folderIdToProcess) {
      throw new Error('No Google Drive folder ID provided. Set GOOGLE_DRIVE_FOLDER_ID environment variable or pass folderId parameter.');
    }

    app.logger.info(`Starting document processing for folder: ${folderIdToProcess}`);

    const result: DocumentProcessingResult = {
      success: false,
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      totalChunks: 0,
      errors: [],
    };

    try {
      // Initialize Pinecone
      await this.initializePinecone();

      // Process documents from Google Drive
      const processedDocuments = await this.googleDrive.processFolder(folderIdToProcess);
      result.totalFiles = processedDocuments.length;

      if (processedDocuments.length === 0) {
        app.logger.warn('No documents found to process');
        result.success = true;
        return result;
      }

      // Index documents in Pinecone
      for (const doc of processedDocuments) {
        try {
          // Delete existing chunks for this file (in case it was updated)
          await this.pinecone.deleteDocumentChunks(doc.fileId);
          
          // Add new chunks
          await this.pinecone.upsertDocumentChunks(doc.chunks);
          
          result.processedFiles++;
          result.totalChunks += doc.chunks.length;
          
          app.logger.info(`Successfully indexed ${doc.fileName} (${doc.chunks.length} chunks)`);
        } catch (error) {
          result.failedFiles++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            fileName: doc.fileName,
            error: errorMessage,
          });
          
          app.logger.error(`Failed to index ${doc.fileName}:`, error);
        }
      }

      result.success = result.processedFiles > 0;
      
      // Log summary
      app.logger.info(`Document processing complete:`, {
        totalFiles: result.totalFiles,
        processedFiles: result.processedFiles,
        failedFiles: result.failedFiles,
        totalChunks: result.totalChunks,
      });

      return result;

    } catch (error) {
      app.logger.error('Document processing failed:', error);
      throw error;
    }
  }

  async searchKnowledge(
    query: string,
    maxResults: number = 5,
    minScore: number = 0.7
  ): Promise<{
    results: Array<{
      content: string;
      fileName: string;
      fileId: string;
      score: number;
      webViewLink?: string;
    }>;
    summary: string;
  }> {
    try {
      await this.initializePinecone();
      
      const searchResults = await this.pinecone.searchSimilarChunks(query, maxResults, minScore);
      
      if (searchResults.length === 0) {
        return {
          results: [],
          summary: `No relevant information found in the knowledge base for "${query}".`,
        };
      }

      // Group results by file and deduplicate
      const fileMap = new Map<string, {
        content: string;
        fileName: string;
        fileId: string;
        score: number;
        webViewLink?: string;
        chunks: number;
      }>();

      for (const result of searchResults) {
        const existingFile = fileMap.get(result.metadata.fileId);
        
        if (!existingFile || result.score > existingFile.score) {
          fileMap.set(result.metadata.fileId, {
            content: result.content,
            fileName: result.metadata.fileName,
            fileId: result.metadata.fileId,
            score: result.score,
            webViewLink: result.metadata.webViewLink,
            chunks: (existingFile?.chunks || 0) + 1,
          });
        }
      }

      const results = Array.from(fileMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      // Create summary
      const fileNames = results.map(r => r.fileName).join(', ');
      const summary = `Found ${results.length} relevant document${results.length > 1 ? 's' : ''} in knowledge base: ${fileNames}`;

      return { results, summary };

    } catch (error) {
      app.logger.error('Knowledge search failed:', error);
      throw error;
    }
  }

  async getIndexStats(): Promise<{
    vectorCount: number;
    dimension: number;
    indexFullness: number;
  }> {
    try {
      await this.initializePinecone();
      
      const stats = await this.pinecone.getIndexStats();
      
      return {
        vectorCount: stats.totalVectorCount || 0,
        dimension: stats.dimension || 0,
        indexFullness: stats.indexFullness || 0,
      };
    } catch (error) {
      app.logger.error('Failed to get index stats:', error);
      throw error;
    }
  }

  async refreshKnowledge(folderId?: string): Promise<DocumentProcessingResult> {
    app.logger.info('Refreshing knowledge base...');
    
    try {
      // Clear existing index
      await this.initializePinecone();
      await this.pinecone.clearIndex();
      
      // Re-process documents
      return await this.processGoogleDriveFolder(folderId);
    } catch (error) {
      app.logger.error('Failed to refresh knowledge base:', error);
      throw error;
    }
  }
}