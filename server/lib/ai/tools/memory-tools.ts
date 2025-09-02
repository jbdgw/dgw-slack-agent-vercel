import { tool } from "ai";
import { z } from "zod";
import { mem0, type Message, type MemoryOptions } from "../../integrations/mem0";
import type { ExperimentalContext } from "../respond-to-message";

export const searchMemoryTool = tool({
  description: "Search through past conversations and stored memories to find relevant context and information",
  parameters: z.object({
    query: z.string().describe("The search query to find relevant memories"),
    user_id: z.string().optional().describe("User ID to search memories for (if not provided, will use context)"),
    agent_id: z.string().optional().describe("Agent ID to search memories for"),
    limit: z.number().optional().default(5).describe("Maximum number of memories to return (default: 5)"),
  }),
  execute: async ({ query, user_id, agent_id, limit }, { experimental_context }) => {
    try {
      if (!mem0.isEnabled()) {
        return "Memory search is not available - Mem0 is not configured.";
      }

      const context = experimental_context as ExperimentalContext;
      const effectiveUserId = user_id || `slack_${context?.botId || 'unknown'}`;
      
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
        return `No relevant memories found for query: "${query}"`;
      }

      const memories = results.results.map((memory, index) => 
        `${index + 1}. ${memory.memory} ${memory.score ? `(relevance: ${memory.score.toFixed(2)})` : ''}`
      ).join('\n');

      return `Found ${results.results.length} relevant memories:\n\n${memories}`;
    } catch (error) {
      console.error('❌ Memory search failed:', error);
      return `Memory search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

export const saveMemoryTool = tool({
  description: "Save important information, user preferences, or context to long-term memory",
  parameters: z.object({
    content: z.string().describe("The content or information to save to memory"),
    user_id: z.string().optional().describe("User ID to associate the memory with"),
    agent_id: z.string().optional().describe("Agent ID to associate the memory with"),
    metadata: z.record(z.any()).optional().describe("Additional metadata to store with the memory"),
  }),
  execute: async ({ content, user_id, agent_id, metadata }, { experimental_context }) => {
    try {
      if (!mem0.isEnabled()) {
        return "Memory saving is not available - Mem0 is not configured.";
      }

      const context = experimental_context as ExperimentalContext;
      const effectiveUserId = user_id || `slack_${context?.botId || 'unknown'}`;

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
        metadata,
      };

      if (agent_id) {
        memoryOptions.agent_id = agent_id;
      }

      const result = await mem0.addMemories(messages, memoryOptions);

      if (!result || result.results.length === 0) {
        return "Failed to save memory - no memories were created.";
      }

      const savedMemories = result.results
        .filter(r => r.event === 'ADD')
        .map(r => `- ${r.memory}`)
        .join('\n');

      return `Successfully saved ${result.results.length} memory(ies):\n\n${savedMemories}`;
    } catch (error) {
      console.error('❌ Memory saving failed:', error);
      return `Memory saving failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

export const getMemoryHistoryTool = tool({
  description: "Get the history of changes for a specific memory by its ID",
  parameters: z.object({
    memory_id: z.string().describe("The ID of the memory to get history for"),
  }),
  execute: async ({ memory_id }) => {
    try {
      if (!mem0.isEnabled()) {
        return "Memory history is not available - Mem0 is not configured.";
      }

      console.log('📜 Getting memory history for ID:', memory_id);

      const history = await mem0.getMemoryHistory(memory_id);

      if (!history || history.length === 0) {
        return `No history found for memory ID: ${memory_id}`;
      }

      const historyString = history.map((entry, index) => 
        `${index + 1}. ${JSON.stringify(entry, null, 2)}`
      ).join('\n\n');

      return `Memory history for ID ${memory_id}:\n\n${historyString}`;
    } catch (error) {
      console.error('❌ Memory history retrieval failed:', error);
      return `Memory history retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

export const getAllMemoriesTool = tool({
  description: "Get all memories for a user or agent to understand their complete context and preferences",
  parameters: z.object({
    user_id: z.string().optional().describe("User ID to get memories for"),
    agent_id: z.string().optional().describe("Agent ID to get memories for"), 
    limit: z.number().optional().default(20).describe("Maximum number of memories to return (default: 20)"),
  }),
  execute: async ({ user_id, agent_id, limit }, { experimental_context }) => {
    try {
      if (!mem0.isEnabled()) {
        return "Memory retrieval is not available - Mem0 is not configured.";
      }

      const context = experimental_context as ExperimentalContext;
      const effectiveUserId = user_id || `slack_${context?.botId || 'unknown'}`;

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
        return `No memories found for user: ${effectiveUserId}${agent_id ? ` and agent: ${agent_id}` : ''}`;
      }

      const memoryList = memories.map((memory, index) => {
        const timestamp = memory.created_at ? new Date(memory.created_at).toLocaleDateString() : 'Unknown date';
        return `${index + 1}. ${memory.memory} (Created: ${timestamp})`;
      }).join('\n');

      return `Found ${memories.length} memories:\n\n${memoryList}`;
    } catch (error) {
      console.error('❌ Memory retrieval failed:', error);
      return `Memory retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

export const deleteMemoryTool = tool({
  description: "Delete a specific memory by its ID - use with caution",
  parameters: z.object({
    memory_id: z.string().describe("The ID of the memory to delete"),
  }),
  execute: async ({ memory_id }) => {
    try {
      if (!mem0.isEnabled()) {
        return "Memory deletion is not available - Mem0 is not configured.";
      }

      console.log('🗑️ Deleting memory with ID:', memory_id);

      const success = await mem0.deleteMemory(memory_id);

      if (success) {
        return `Successfully deleted memory with ID: ${memory_id}`;
      } else {
        return `Failed to delete memory with ID: ${memory_id}`;
      }
    } catch (error) {
      console.error('❌ Memory deletion failed:', error);
      return `Memory deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});

export const addConversationToMemoryTool = tool({
  description: "Add an entire conversation thread to memory for context retention",
  parameters: z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']).describe("The role of the message sender"),
      content: z.string().describe("The content of the message"),
    })).describe("Array of messages in the conversation"),
    user_id: z.string().optional().describe("User ID to associate the conversation with"),
    agent_id: z.string().optional().describe("Agent ID to associate the conversation with"),
    metadata: z.record(z.any()).optional().describe("Additional metadata about the conversation"),
  }),
  execute: async ({ messages, user_id, agent_id, metadata }, { experimental_context }) => {
    try {
      if (!mem0.isEnabled()) {
        return "Conversation memory is not available - Mem0 is not configured.";
      }

      const context = experimental_context as ExperimentalContext;
      const effectiveUserId = user_id || `slack_${context?.botId || 'unknown'}`;

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
        ...metadata,
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
        return "Failed to save conversation to memory - no memories were created.";
      }

      const addedMemories = result.results
        .filter(r => r.event === 'ADD')
        .map(r => `- ${r.memory}`)
        .join('\n');

      return `Successfully saved conversation with ${messages.length} messages. Created ${result.results.length} memories:\n\n${addedMemories}`;
    } catch (error) {
      console.error('❌ Conversation memory saving failed:', error);
      return `Conversation memory saving failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  },
});