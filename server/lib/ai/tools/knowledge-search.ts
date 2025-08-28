import { tool } from "ai";
import { z } from "zod";
import { app } from "~/app";
import { updateAgentStatus } from "~/lib/slack/utils";
import { DocumentProcessor } from "~/lib/integrations/document-processor";
import type { ExperimentalContext } from "../respond-to-message";

const documentProcessor = new DocumentProcessor();

export const knowledgeSearchTool = tool({
  name: "search_knowledge",
  description: "Search through company/internal documents stored in Google Drive. Use this for questions about internal policies, procedures, documentation, or any company-specific information that might be stored in your knowledge base.",
  inputSchema: z.object({
    query: z.string().min(1, "Search query cannot be empty").describe("The search query to find relevant information in the knowledge base"),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe("Maximum number of documents to return (1-10, default: 5)"),
  }),
  execute: async ({ query, maxResults }, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      // Update status to inform user what we're doing
      await updateAgentStatus({
        channel,
        thread_ts,
        status: `is searching company knowledge base for "${query}"...`,
      });

      app.logger.debug("Knowledge search request:", { query, maxResults });

      const searchResult = await documentProcessor.searchKnowledge(query, maxResults, 0.7);

      if (searchResult.results.length === 0) {
        return [
          {
            role: "user" as const,
            content: `No relevant information found in the company knowledge base for "${query}". This could mean:
- The information isn't available in the indexed documents
- Try rephrasing your search with different keywords
- The documents may need to be re-indexed if recently updated

Consider using web search if you need current/external information.`,
          },
        ];
      }

      // Format results for the model
      const formattedResults = searchResult.results.map((result, index) => {
        const preview = result.content.length > 300 
          ? result.content.substring(0, 300) + "..."
          : result.content;
        
        const relevanceScore = Math.round(result.score * 100);
        const viewLink = result.webViewLink ? `\nView: ${result.webViewLink}` : '';
        
        return `**${index + 1}. ${result.fileName}** (${relevanceScore}% relevant)
${preview}${viewLink}`;
      }).join('\n\n');

      const knowledgeSummary = `${searchResult.summary}

${formattedResults}

---
*Knowledge base search completed. Found ${searchResult.results.length} relevant document${searchResult.results.length > 1 ? 's' : ''}.*`;

      return [
        {
          role: "user" as const,
          content: knowledgeSummary,
        },
      ];

    } catch (error) {
      app.logger.error("Knowledge search failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `Knowledge base search failed: ${errorMessage}. Please try again or contact your administrator to check if the knowledge base is properly configured.`,
        },
      ];
    }
  },
});

export const refreshKnowledgeTool = tool({
  name: "refresh_knowledge",
  description: "Refresh the knowledge base by re-indexing all documents from Google Drive. Use this when documents have been updated and you need to ensure the latest versions are searchable. This is an admin function that may take several minutes.",
  inputSchema: z.object({
    confirm: z.boolean().describe("Must be true to confirm you want to refresh the entire knowledge base"),
  }),
  execute: async ({ confirm }, { experimental_context }) => {
    if (!confirm) {
      return [
        {
          role: "user" as const,
          content: "Knowledge base refresh cancelled. Set confirm to true if you want to proceed with refreshing the knowledge base.",
        },
      ];
    }

    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      await updateAgentStatus({
        channel,
        thread_ts,
        status: "is refreshing the knowledge base (this may take a few minutes)...",
      });

      app.logger.info("Starting knowledge base refresh");

      const result = await documentProcessor.refreshKnowledge();
      
      const successMessage = `**Knowledge Base Refresh Complete**

📊 **Summary:**
- Total files found: ${result.totalFiles}
- Successfully processed: ${result.processedFiles}
- Failed: ${result.failedFiles}
- Total chunks indexed: ${result.totalChunks}

${result.errors.length > 0 ? `\n❌ **Errors:**\n${result.errors.map(e => `- ${e.fileName}: ${e.error}`).join('\n')}` : ''}

✅ Knowledge base is now up to date and ready for searches.`;

      return [
        {
          role: "user" as const,
          content: successMessage,
        },
      ];

    } catch (error) {
      app.logger.error("Knowledge refresh failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `Knowledge base refresh failed: ${errorMessage}. Please check the Google Drive configuration and Pinecone setup.`,
        },
      ];
    }
  },
});

export const knowledgeStatsTool = tool({
  name: "knowledge_stats",
  description: "Get statistics about the current knowledge base including number of indexed documents and storage usage.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      await updateAgentStatus({
        channel,
        thread_ts,
        status: "is retrieving knowledge base statistics...",
      });

      const stats = await documentProcessor.getIndexStats();
      
      const statsMessage = `**Knowledge Base Statistics**

📈 **Index Stats:**
- Total vectors: ${stats.vectorCount.toLocaleString()}
- Vector dimension: ${stats.dimension}
- Index fullness: ${(stats.indexFullness * 100).toFixed(1)}%

💡 Each vector represents a chunk of a document. Multiple chunks can come from the same document.`;

      return [
        {
          role: "user" as const,
          content: statsMessage,
        },
      ];

    } catch (error) {
      app.logger.error("Failed to get knowledge stats:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `Failed to get knowledge base statistics: ${errorMessage}`,
        },
      ];
    }
  },
});