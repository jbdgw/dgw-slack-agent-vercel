import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

export interface ProcessedDocument {
  fileId: string;
  fileName: string;
  content: string;
  chunks: DocumentChunk[];
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    fileId: string;
    fileName: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
    webViewLink?: string;
  };
}

export class GoogleDriveClient {
  private auth: OAuth2Client | undefined;
  private drive: any;
  
  constructor() {
    // Initialize with service account authentication
    // In production, you'd use a service account JSON key file
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
    }
    
    if (this.auth) {
      this.drive = google.drive({ version: 'v3', auth: this.auth });
    } else {
      console.warn('Google Drive authentication not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY environment variables.');
    }
  }

  async listFilesInFolder(folderId: string): Promise<GoogleDriveFile[]> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated. Please configure service account credentials.');
    }

    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, modifiedTime, size, webViewLink)',
        orderBy: 'modifiedTime desc',
      });

      const files = response.data.files || [];
      
      // Filter for supported file types
      const supportedTypes = [
        'application/pdf',
        'application/vnd.google-apps.document',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      return files.filter((file: any) => 
        supportedTypes.includes(file.mimeType)
      ).map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        size: file.size,
        webViewLink: file.webViewLink,
      }));

    } catch (error) {
      console.error('Failed to list Google Drive files:', error);
      throw new Error(`Failed to list Google Drive files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async downloadFile(fileId: string, mimeType: string): Promise<Buffer> {
    if (!this.drive) {
      throw new Error('Google Drive not authenticated');
    }

    try {
      let response;
      
      if (mimeType === 'application/vnd.google-apps.document') {
        // Export Google Docs as plain text
        response = await this.drive.files.export({
          fileId: fileId,
          mimeType: 'text/plain',
        });
      } else {
        // Download other file types directly
        response = await this.drive.files.get({
          fileId: fileId,
          alt: 'media',
        });
      }

      return Buffer.from(response.data);
    } catch (error) {
      console.error(`Failed to download file ${fileId}:`, error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractTextContent(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
    try {
      switch (mimeType) {
        case 'application/pdf':
          // PDF parsing temporarily disabled in serverless environment
          throw new Error('PDF processing is temporarily unavailable in production. Please use Google Docs or text files instead.');
          
        case 'text/plain':
        case 'application/vnd.google-apps.document':
          return buffer.toString('utf-8');
          
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          // For DOCX files, you'd need additional libraries like mammoth
          // For now, we'll just return a placeholder
          console.warn(`DOCX processing not implemented for ${fileName}. Install mammoth package for full support.`);
          return `[DOCX Document: ${fileName} - Content extraction not yet implemented]`;
          
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      console.error(`Failed to extract text from ${fileName}:`, error);
      throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  createDocumentChunks(content: string, fileId: string, fileName: string, webViewLink?: string, chunkSize: number = 1000, overlap: number = 200): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const contentLength = content.length;
    
    if (contentLength <= chunkSize) {
      // If content is small enough, create single chunk
      chunks.push({
        id: `${fileId}_0`,
        content: content.trim(),
        metadata: {
          fileId,
          fileName,
          chunkIndex: 0,
          startChar: 0,
          endChar: contentLength,
          webViewLink,
        },
      });
    } else {
      // Split into overlapping chunks
      let startChar = 0;
      let chunkIndex = 0;
      
      while (startChar < contentLength) {
        const endChar = Math.min(startChar + chunkSize, contentLength);
        const chunkContent = content.substring(startChar, endChar).trim();
        
        if (chunkContent.length > 0) {
          chunks.push({
            id: `${fileId}_${chunkIndex}`,
            content: chunkContent,
            metadata: {
              fileId,
              fileName,
              chunkIndex,
              startChar,
              endChar,
              webViewLink,
            },
          });
          
          chunkIndex++;
        }
        
        // Move start position, accounting for overlap
        startChar += chunkSize - overlap;
      }
    }
    
    return chunks;
  }

  async processDocument(file: GoogleDriveFile): Promise<ProcessedDocument> {
    console.debug(`Processing document: ${file.name} (${file.id})`);
    
    try {
      // Download file content
      const buffer = await this.downloadFile(file.id, file.mimeType);
      
      // Extract text content
      const content = await this.extractTextContent(buffer, file.mimeType, file.name);
      
      // Create chunks
      const chunks = this.createDocumentChunks(
        content,
        file.id,
        file.name,
        file.webViewLink
      );
      
      return {
        fileId: file.id,
        fileName: file.name,
        content,
        chunks,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
      };
      
    } catch (error) {
      console.error(`Failed to process document ${file.name}:`, error);
      throw error;
    }
  }

  async processFolder(folderId: string): Promise<ProcessedDocument[]> {
    console.info(`Processing Google Drive folder: ${folderId}`);
    
    const files = await this.listFilesInFolder(folderId);
    console.info(`Found ${files.length} files to process`);
    
    const processedDocuments: ProcessedDocument[] = [];
    
    for (const file of files) {
      try {
        const processed = await this.processDocument(file);
        processedDocuments.push(processed);
        console.debug(`Successfully processed: ${file.name}`);
      } catch (error) {
        console.error(`Failed to process ${file.name}, skipping:`, error);
        // Continue with other files even if one fails
      }
    }
    
    console.info(`Successfully processed ${processedDocuments.length} of ${files.length} files`);
    return processedDocuments;
  }
}