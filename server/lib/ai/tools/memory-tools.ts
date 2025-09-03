import { tool } from "ai";
import { z } from "zod";
import { mem0, type Message, type MemoryOptions } from "../../integrations/mem0";
import type { ExperimentalContext } from "../respond-to-message";

export const searchMemoryTool = tool({
  name: "search_memory",
  description: "Search through past conversations and stored memories to find relevant context and information",
  inputSchema: z.object({
    query: z.string().describe("The search query to find relevant memories"),
    user_id: z.string().optional().describe("User ID to search memories for (if not provided, will use context)"),
    agent_id: z.string().optional().describe("Agent ID to search memories for"),
    limit: z.number().optional().default(5).describe("Maximum number of memories to return (default: 5)"),
  }),
  execute: async ({ query, user_id, agent_id, limit }, { experimental_context }) => {
    try {
      if (!mem0.isEnabled()) {
        return [{
          role: "user" as const,
          content: "Memory search is not available - Mem0 is not configured."
        }];
      }

      const context = experimental_context as ExperimentalContext;
      const effectiveUserId = user_id || `slack_${context?.userId || 'unknown'}`;
      
      console.log('🔍 Executing memory search:', {
        query: query.substring(0, 50) + '...',
        userId: effectiveUserId,
        agentId: agent_id,
        limit,
      });

      const searchOptions: MemoryOptions & { limit?: number } = {
        user_id: effectiveUserId,
        limit,
      };

      if (agent_id) {
        searchOptions.agent_id = agent_id;
      }

      const results = await mem0.searchMemories(query, searchOptions);

      if (!results || results.results.length === 0) {
        return [{
          role: "user" as const,
          content: `No relevant memories found for query: "${query}"`
        }];
      }

      const memories = results.results.map((memory, index) => 
        `${index + 1}. ${memory.memory} ${memory.score ? `(relevance: ${memory.score.toFixed(2)})` : ''}`
      ).join('\n');

      return [{
        role: "user" as const,
        content: `Found ${results.results.length} relevant memories:\n\n${memories}`
      }];
    } catch (error) {
      console.error('❌ Memory search failed:', error);
      return [{
        role: "user" as const,
        content: `Memory search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }];
    }
  },
});

export const saveMemoryTool = tool({
  name: "save_memory",
  description: "Save important information, user preferences, or context to long-term memory",
  inputSchema: z.object({
    content: z.string().describe("The content or information to save to memory"),
    user_id: z.string().optional().describe("User ID to associate the memory with"),
    agent_id: z.string().optional().describe("Agent ID to associate the memory with"),
    metadata: z.string().optional().describe("Additional metadata as JSON string"),
  }),
  execute: async ({ content, user_id, agent_id, metadata }, { experimental_context }) => {
    try {
      if (!mem0.isEnabled()) {
        return [{
          role: "user" as const,
          content: "Memory saving is not available - Mem0 is not configured."
        }];
      }

      const context = experimental_context as ExperimentalContext;
      const effectiveUserId = user_id || `slack_${context?.userId || 'unknown'}`;

      console.log('💾 Saving memory:', {
        content: content.substring(0, 100) + '...',
        userId: effectiveUserId,
        agentId: agent_id,
        hasMetadata: !!metadata,
      });

      // Create a message to save as memory
      const messages: Message[] = [
        { role: 'user', content }
      ];

      const memoryOptions: MemoryOptions = {
        user_id: effectiveUserId,
        metadata: metadata ? JSON.parse(metadata) : undefined,
      };

      if (agent_id) {
        memoryOptions.agent_id = agent_id;
      }

      const result = await mem0.addMemories(messages, memoryOptions);

      if (!result || result.results.length === 0) {
        return [{
          role: "user" as const,
          content: "Failed to save memory - no memories were created."
        }];
      }

      const savedMemories = result.results
        .filter(r => r.event === 'ADD')
        .map(r => `- ${r.memory}`)
        .join('\n');

      return [{
        role: "user" as const,
        content: `Successfully saved ${result.results.length} memory(ies):\n\n${savedMemories}`
      }];
    } catch (error) {
      console.error('❌ Memory saving failed:', error);
      console.error('❌ Memory saving failed - Full error:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
      return [{
        role: "user" as const,
        content: `Memory saving failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }];
    }
  },
});

export const getMemoryHistoryTool = tool({
  name: "get_memory_history",
  description: "Get the history of changes for a specific memory by its ID",
  inputSchema: z.object({
    memory_id: z.string().describe("The ID of the memory to get history for"),
  }),
  execute: async ({ memory_id }) => {
    try {
      if (!mem0.isEnabled()) {
        return [{
          role: "user" as const,
          content: "Memory history is not available - Mem0 is not configured."
        }];
      }

      console.log('📜 Getting memory history for ID:', memory_id);

      const history = await mem0.getMemoryHistory(memory_id);

      if (!history || history.length === 0) {
        return [{
          role: "user" as const,
          content: `No history found for memory ID: ${memory_id}`
        }];
      }

      const historyString = history.map((entry, index) => 
        `${index + 1}. ${JSON.stringify(entry, null, 2)}`
      ).join('\n\n');

      return [{
        role: "user" as const,
        content: `Memory history for ID ${memory_id}:\n\n${historyString}`
      }];
    } catch (error) {
      console.error('❌ Memory history retrieval failed:', error);
      return [{
        role: "user" as const,
        content: `Memory history retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }];
    }
  },
});

export const getAllMemoriesTool = tool({
  name: "get_all_memories",
  description: "Get all memories for a user or agent to understand their complete context and preferences",
  inputSchema: z.object({
    user_id: z.string().optional().describe("User ID to get memories for"),
    agent_id: z.string().optional().describe("Agent ID to get memories for"), 
    limit: z.number().optional().default(20).describe("Maximum number of memories to return (default: 20)"),
  }),
  execute: async ({ user_id, agent_id, limit }, { experimental_context }) => {
    try {
      if (!mem0.isEnabled()) {
        return [{
          role: "user" as const,
          content: "Memory retrieval is not available - Mem0 is not configured."
        }];
      }

      const context = experimental_context as ExperimentalContext;
      const effectiveUserId = user_id || `slack_${context?.userId || 'unknown'}`;

      console.log('📚 Getting all memories:', {
        userId: effectiveUserId,
        agentId: agent_id,
        limit,
      });

      const memoryOptions: MemoryOptions & { limit?: number } = {
        user_id: effectiveUserId,
        limit,
      };

      if (agent_id) {
        memoryOptions.agent_id = agent_id;
      }

      const memories = await mem0.getAllMemories(memoryOptions);

      if (!memories || memories.length === 0) {
        return [{
          role: "user" as const,
          content: `No memories found for user: ${effectiveUserId}${agent_id ? ` and agent: ${agent_id}` : ''}`
        }];
      }

      const memoryList = memories.map((memory, index) => {
        const timestamp = memory.created_at ? new Date(memory.created_at).toLocaleDateString() : 'Unknown date';
        return `${index + 1}. ${memory.memory} (Created: ${timestamp})`;
      }).join('\n');

      return [{
        role: "user" as const,
        content: `Found ${memories.length} memories:\n\n${memoryList}`
      }];
    } catch (error) {
      console.error('❌ Memory retrieval failed:', error);
      return [{
        role: "user" as const,
        content: `Memory retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }];
    }
  },
});

export const deleteMemoryTool = tool({
  name: "delete_memory",
  description: "Delete a specific memory by its ID - use with caution",
  inputSchema: z.object({
    memory_id: z.string().describe("The ID of the memory to delete"),
  }),
  execute: async ({ memory_id }) => {
    try {
      if (!mem0.isEnabled()) {
        return [{
          role: "user" as const,
          content: "Memory deletion is not available - Mem0 is not configured."
        }];
      }

      console.log('🗑️ Deleting memory with ID:', memory_id);

      const success = await mem0.deleteMemory(memory_id);

      if (success) {
        return [{
          role: "user" as const,
          content: `Successfully deleted memory with ID: ${memory_id}`
        }];
      } else {
        return [{
          role: "user" as const,
          content: `Failed to delete memory with ID: ${memory_id}`
        }];
      }
    } catch (error) {
      console.error('❌ Memory deletion failed:', error);
      return [{
        role: "user" as const,
        content: `Memory deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }];
    }
  },
});

export const addConversationToMemoryTool = tool({
  name: "add_conversation_to_memory",
  description: "Add an entire conversation thread to memory for context retention",
  inputSchema: z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']).describe("The role of the message sender"),
      content: z.string().describe("The content of the message"),
    })).describe("Array of messages in the conversation"),
    user_id: z.string().optional().describe("User ID to associate the conversation with"),
    agent_id: z.string().optional().describe("Agent ID to associate the conversation with"),
    metadata: z.string().optional().describe("Additional metadata about the conversation as JSON string"),
  }),
  execute: async ({ messages, user_id, agent_id, metadata }, { experimental_context }) => {
    try {
      if (!mem0.isEnabled()) {
        return [{
          role: "user" as const,
          content: "Conversation memory is not available - Mem0 is not configured."
        }];
      }

      const context = experimental_context as ExperimentalContext;
      const effectiveUserId = user_id || `slack_${context?.userId || 'unknown'}`;

      console.log('💬 Adding conversation to memory:', {
        messageCount: messages.length,
        userId: effectiveUserId,
        agentId: agent_id,
        hasMetadata: !!metadata,
      });

      const conversationMetadata = {
        conversation_type: 'slack_thread',
        channel: context?.channel,
        thread_ts: context?.thread_ts,
        message_count: messages.length,
        ...(metadata ? JSON.parse(metadata) : {}),
      };

      const memoryOptions: MemoryOptions = {
        user_id: effectiveUserId,
        metadata: conversationMetadata,
      };

      if (agent_id) {
        memoryOptions.agent_id = agent_id;
      }

      const result = await mem0.addMemories(messages as Message[], memoryOptions);

      if (!result || result.results.length === 0) {
        return [{
          role: "user" as const,
          content: "Failed to save conversation to memory - no memories were created."
        }];
      }

      const addedMemories = result.results
        .filter(r => r.event === 'ADD')
        .map(r => `- ${r.memory}`)
        .join('\n');

      return [{
        role: "user" as const,
        content: `Successfully saved conversation with ${messages.length} messages. Created ${result.results.length} memories:\n\n${addedMemories}`
      }];
    } catch (error) {
      console.error('❌ Conversation memory saving failed:', error);
      console.error('❌ Conversation memory saving failed - Full error:', error);
      return [{
        role: "user" as const,
        content: `Conversation memory saving failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }];
    }
  },
});