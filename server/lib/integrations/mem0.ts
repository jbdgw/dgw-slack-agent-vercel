import { MemoryClient } from 'mem0ai';

export interface Mem0Config {
  apiKey: string;
  host?: string;
  organizationId?: string;
  projectId?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Memory {
  id: string;
  memory?: string;
  user_id?: string;
  agent_id?: string;
  categories?: string[];
  created_at?: Date;
  updated_at?: Date;
  metadata?: any;
  score?: number;
}

export interface MemoryOptions {
  user_id?: string;
  agent_id?: string;
  app_id?: string;
  run_id?: string;
  metadata?: Record<string, any>;
  filters?: Record<string, any>;
  api_version?: 'v1' | 'v2';
  infer?: boolean;
  enable_graph?: boolean;
}

export interface SearchResult {
  results: Memory[];
  relations?: any[];
}

export interface AddResult {
  results: Array<{
    memory: string;
    event: 'ADD' | 'UPDATE' | 'DELETE';
    id?: string;
  }>;
}

export class Mem0Integration {
  private client: MemoryClient;
  private isConfigured: boolean = false;

  constructor(config?: Mem0Config) {
    try {
      const apiKey = config?.apiKey || process.env.MEM0_API_KEY;
      
      if (!apiKey) {
        // Note: Mem0 API key not configured. Memory features will be disabled.
        this.isConfigured = false;
        // Create a dummy client to avoid null checks everywhere
        this.client = {} as MemoryClient;
        return;
      }

      this.client = new MemoryClient({
        apiKey,
        host: config?.host || 'https://api.mem0.ai',
        organizationId: config?.organizationId,
        projectId: config?.projectId,
      });

      this.isConfigured = true;
      // Note: Using console since app.logger not available in integrations
    } catch (error) {
      console.error('❌ Failed to initialize Mem0 integration:', error);
      this.isConfigured = false;
      this.client = {} as MemoryClient;
    }
  }

  isEnabled(): boolean {
    return this.isConfigured;
  }

  async addMemories(
    messages: Message[],
    options: MemoryOptions = {}
  ): Promise<AddResult | null> {
    if (!this.isConfigured) {
      console.warn('Mem0 not configured, skipping memory addition');
      return null;
    }

    try {
      console.log('🧠 Adding memories to Mem0:', {
        messageCount: messages.length,
        userId: options.user_id,
        agentId: options.agent_id,
      });

      const result = await this.client.add(messages, options);
      
      console.log('✅ Successfully added memories:', {
        resultCount: result.results?.length || 0,
        memories: result.results?.map(r => r.memory).slice(0, 3) // Log first 3 for debugging
      });

      return result as AddResult;
    } catch (error) {
      console.error('❌ Failed to add memories:', error);
      throw new Error(`Failed to add memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async searchMemories(
    query: string,
    options: MemoryOptions & { limit?: number; threshold?: number } = {}
  ): Promise<SearchResult | null> {
    if (!this.isConfigured) {
      console.warn('Mem0 not configured, skipping memory search');
      return null;
    }

    try {
      console.log('🔍 Searching memories in Mem0:', {
        query: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
        userId: options.user_id,
        agentId: options.agent_id,
        limit: options.limit || 5,
      });

      const searchOptions = {
        ...options,
        top_k: options.limit || 5,
      };

      const results = await this.client.search(query, searchOptions);
      
      console.log('✅ Memory search completed:', {
        resultCount: results.length,
        hasResults: results.length > 0,
      });

      return {
        results: results as Memory[],
        relations: [],
      };
    } catch (error) {
      console.error('❌ Failed to search memories:', error);
      throw new Error(`Failed to search memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getMemory(memoryId: string): Promise<Memory | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const memory = await this.client.get(memoryId);
      return memory as Memory;
    } catch (error) {
      console.error('❌ Failed to get memory:', error);
      throw new Error(`Failed to get memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getAllMemories(options: MemoryOptions & { limit?: number } = {}): Promise<Memory[]> {
    if (!this.isConfigured) {
      return [];
    }

    try {
      const searchOptions = {
        ...options,
        page_size: options.limit || 50,
      };

      const memories = await this.client.getAll(searchOptions);
      return memories as Memory[];
    } catch (error) {
      console.error('❌ Failed to get all memories:', error);
      throw new Error(`Failed to get all memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateMemory(
    memoryId: string, 
    text?: string, 
    metadata?: Record<string, any>
  ): Promise<Memory | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const updatedMemory = await this.client.update(memoryId, text, metadata);
      return updatedMemory as Memory;
    } catch (error) {
      console.error('❌ Failed to update memory:', error);
      throw new Error(`Failed to update memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteMemory(memoryId: string): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.client.delete(memoryId);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete memory:', error);
      throw new Error(`Failed to delete memory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deleteAllMemories(options: MemoryOptions = {}): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.client.deleteAll(options);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete all memories:', error);
      throw new Error(`Failed to delete all memories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getMemoryHistory(memoryId: string): Promise<any[]> {
    if (!this.isConfigured) {
      return [];
    }

    try {
      const history = await this.client.history(memoryId);
      return history;
    } catch (error) {
      console.error('❌ Failed to get memory history:', error);
      throw new Error(`Failed to get memory history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Create singleton instance
const createMem0Integration = () => {
  try {
    return new Mem0Integration();
  } catch (error) {
    console.error('Failed to create Mem0 integration:', error);
    return new Mem0Integration(); // Will create disabled instance
  }
};

export const mem0 = createMem0Integration();