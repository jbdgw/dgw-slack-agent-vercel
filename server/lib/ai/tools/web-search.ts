import { tool } from "ai";
import { z } from "zod";
import Exa from "exa-js";
import { app } from "~/app";
import { updateAgentStatus } from "~/lib/slack/utils";
import type { ExperimentalContext } from "../respond-to-message";

const exa = new Exa(process.env.EXA_API_KEY);

export const webSearchTool = tool({
  name: "search_web",
  description: "Search the web for real-time information using Exa API. Use this for current events, latest news, recent developments, or when you need up-to-date information not available in internal documents.",
  inputSchema: z.object({
    query: z.string().min(1, "Search query cannot be empty").describe("The search query to find information about"),
    specificDomain: z
      .string()
      .optional()
      .describe("Optional specific domain to search (e.g., 'bbc.com', 'github.com'). Include only the domain name without protocol."),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe("Number of search results to return (1-10, default: 5)"),
  }),
  execute: async ({ query, specificDomain, numResults }, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      // Update status to inform user what we're doing
      await updateAgentStatus({
        channel,
        thread_ts,
        status: `is searching the web for "${query}"...`,
      });

      app.logger.debug("Web search request:", { query, specificDomain, numResults });

      const searchOptions: any = {
        livecrawl: "always",
        numResults: numResults || 5,
      };

      if (specificDomain) {
        searchOptions.includeDomains = [specificDomain];
      }

      const { results } = await exa.searchAndContents(query, searchOptions);

      if (!results || results.length === 0) {
        return [
          {
            role: "user" as const,
            content: `No web search results found for "${query}". Try rephrasing your search query or searching for more general terms.`,
          },
        ];
      }

      // Format results for the model
      const formattedResults = results.map((result, index) => {
        const snippet = result.text ? result.text.slice(0, 500) + (result.text.length > 500 ? "..." : "") : "No content preview available";
        
        return `**${index + 1}. ${result.title}**
Source: ${result.url}
${snippet}`;
      }).join('\n\n');

      const searchSummary = `Found ${results.length} web search results for "${query}"${specificDomain ? ` from ${specificDomain}` : ''}:

${formattedResults}

---
*Web search completed using Exa API*`;

      return [
        {
          role: "user" as const,
          content: searchSummary,
        },
      ];

    } catch (error) {
      app.logger.error("Web search failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `Web search failed: ${errorMessage}. Please try again with a different search query.`,
        },
      ];
    }
  },
});