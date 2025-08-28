import { Pinecone } from '@pinecone-database/pinecone';
import { app } from '~/app';
import type { DocumentChunk } from './google-drive';

export interface PineconeMetadata {
  fileId: string;
  fileName: string;
  chunkIndex: number;
  startChar: number;
  endChar: number;
  webViewLink?: string;
  content: string;
  indexedAt: string;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: PineconeMetadata;
  content: string;
}

export class PineconeClient {
  private pinecone: Pinecone;
  private indexName: string;
  private index: any;

  constructor() {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY environment variable is required');
    }

    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    this.indexName = process.env.PINECONE_INDEX || 'slack-agent-knowledge';
  }

  async initialize(): Promise<void> {
    try {
      // Get the index (will throw error if doesn't exist)
      this.index = this.pinecone.Index(this.indexName);
      
      // Test the connection by getting index stats
      await this.index.describeIndexStats();
      
      app.logger.info(`Connected to Pinecone index: ${this.indexName}`);
    } catch (error) {
      app.logger.error(`Failed to connect to Pinecone index ${this.indexName}:`, error);
      throw new Error(`Pinecone initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createIndex(dimension: number = 1536): Promise<void> {
    try {
      app.logger.info(`Creating Pinecone index: ${this.indexName}`);
      
      await this.pinecone.createIndex({
        name: this.indexName,
        dimension: dimension,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: process.env.PINECONE_ENVIRONMENT || 'us-east-1',
          }
        },
      });

      // Wait for index to be ready
      app.logger.info('Waiting for index to be ready...');
      let ready = false;
      while (!ready) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
          const indexDescription = await this.pinecone.describeIndex(this.indexName);
          ready = indexDescription.status?.ready === true;
          if (!ready) {
            app.logger.info('Index still initializing...');
          }
        } catch (error) {
          app.logger.debug('Waiting for index to be available...');
        }
      }

      this.index = this.pinecone.Index(this.indexName);
      app.logger.info(`Successfully created index: ${this.indexName}`);
    } catch (error) {
      app.logger.error(`Failed to create index ${this.indexName}:`, error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use OpenAI's text-embedding-ada-002 model
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text.replace(/\n/g, ' ').trim(),
          model: 'text-embedding-ada-002',
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      app.logger.error('Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async upsertDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
    if (!this.index) {
      await this.initialize();
    }

    app.logger.info(`Upserting ${chunks.length} document chunks to Pinecone`);

    try {
      // Process chunks in batches to avoid API limits
      const batchSize = 100;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        // Generate embeddings for batch
        const vectors = await Promise.all(
          batch.map(async (chunk) => {
            const embedding = await this.generateEmbedding(chunk.content);
            
            return {
              id: chunk.id,
              values: embedding,
              metadata: {
                ...chunk.metadata,
                content: chunk.content,
                indexedAt: new Date().toISOString(),
              } as PineconeMetadata,
            };
          })
        );

        // Upsert batch to Pinecone
        await this.index.upsert(vectors);
        
        app.logger.debug(`Upserted batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunks.length / batchSize)}`);
      }

      app.logger.info(`Successfully upserted ${chunks.length} chunks to Pinecone`);
    } catch (error) {
      app.logger.error('Failed to upsert chunks to Pinecone:', error);
      throw error;
    }
  }

  async deleteDocumentChunks(fileId: string): Promise<void> {
    if (!this.index) {
      await this.initialize();
    }

    try {
      app.logger.info(`Deleting chunks for file ${fileId} from Pinecone`);
      
      await this.index.deleteMany({
        filter: { fileId: { $eq: fileId } },
      });
      
      app.logger.info(`Successfully deleted chunks for file ${fileId}`);
    } catch (error) {
      app.logger.error(`Failed to delete chunks for file ${fileId}:`, error);
      throw error;
    }
  }

  async searchSimilarChunks(
    query: string,
    topK: number = 5,
    minScore: number = 0.7
  ): Promise<SearchResult[]> {
    if (!this.index) {
      await this.initialize();
    }

    try {
      app.logger.debug(`Searching for similar chunks: "${query}"`);
      
      // Generate embedding for query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search in Pinecone
      const searchResponse = await this.index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      });

      const results = searchResponse.matches
        ?.filter((match: any) => match.score && match.score >= minScore)
        ?.map((match: any) => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata as PineconeMetadata,
          content: match.metadata.content,
        })) || [];

      app.logger.debug(`Found ${results.length} relevant chunks (score >= ${minScore})`);
      
      return results;
    } catch (error) {
      app.logger.error('Failed to search Pinecone:', error);
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    if (!this.index) {
      await this.initialize();
    }

    try {
      return await this.index.describeIndexStats();
    } catch (error) {
      app.logger.error('Failed to get index stats:', error);
      throw error;
    }
  }

  async clearIndex(): Promise<void> {
    if (!this.index) {
      await this.initialize();
    }

    try {
      app.logger.warn(`Clearing all vectors from index: ${this.indexName}`);
      
      await this.index.deleteMany({});
      
      app.logger.info('Successfully cleared index');
    } catch (error) {
      app.logger.error('Failed to clear index:', error);
      throw error;
    }
  }
}