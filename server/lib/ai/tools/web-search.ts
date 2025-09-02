import { tool } from "ai";
import { z } from "zod";
import Exa from "exa-js";
import { app } from "~/app";
import { updateAgentStatus } from "~/lib/slack/utils";
import type { ExperimentalContext } from "../respond-to-message";

const exa = new Exa(process.env.EXA_API_KEY || process.env.EXASEARCH_API_KEY);

export const webSearchTool = tool({
  name: "search_web",
  description: "Search the web for trending products, viral merchandise, and real-time trend intelligence using enhanced Exa API. Perfect for discovering what's hot on social media, retail trends, and competitive analysis.",
  inputSchema: z.object({
    query: z.string().min(1, "Search query cannot be empty").describe("The search query to find trending information about"),
    includeDomains: z
      .array(z.string())
      .optional()
      .describe("Optional domains to specifically search (e.g., ['tiktok.com', 'instagram.com', 'reddit.com']). Great for trend discovery across social platforms."),
    excludeDomains: z
      .array(z.string())
      .optional()
      .describe("Optional domains to exclude from search results (e.g., ['pinterest.com', 'spam-site.com']). Helps filter irrelevant sources."),
    dateFilter: z
      .enum(["past_day", "past_week", "past_month", "past_3_months", "past_year", "any"])
      .optional()
      .default("past_3_months")
      .describe("Filter results by recency. Default 'past_3_months' is perfect for trending products. Use 'past_week' for very recent trends."),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe("Number of search results to return (1-10, default: 5)"),
    searchType: z
      .enum(["neural", "keyword"])
      .optional()
      .default("neural")
      .describe("Search mode: 'neural' for semantic/trend understanding (default), 'keyword' for exact matches"),
  }),
  execute: async ({ query, includeDomains, excludeDomains, dateFilter, numResults, searchType }, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      // Enhanced status message with search details
      const statusDetails = [];
      if (includeDomains?.length) statusDetails.push(`on ${includeDomains.join(", ")}`);
      if (dateFilter && dateFilter !== "any") statusDetails.push(`from ${dateFilter.replace("_", " ")}`);
      
      await updateAgentStatus({
        channel,
        thread_ts,
        status: `is searching for trending "${query}"${statusDetails.length ? ` ${statusDetails.join(", ")}` : ""}...`,
      });

      app.logger.debug("Enhanced web search request:", { 
        query, includeDomains, excludeDomains, dateFilter, numResults, searchType 
      });

      const searchOptions: any = {
        livecrawl: "always",
        numResults: numResults || 5,
        useAutoprompt: searchType === "neural",
      };

      // Handle domain filtering
      if (includeDomains?.length) {
        searchOptions.includeDomains = includeDomains;
      }
      if (excludeDomains?.length) {
        searchOptions.excludeDomains = excludeDomains;
      }

      // Handle date filtering
      if (dateFilter && dateFilter !== "any") {
        const dateMap = {
          "past_day": new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          "past_week": new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          "past_month": new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          "past_3_months": new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          "past_year": new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
        searchOptions.startPublishedDate = dateMap[dateFilter];
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

      // Enhanced result processing for trend intelligence
      const formattedResults = results.map((result, index) => {
        // Extract longer, more relevant snippets for trend analysis
        let snippet = "No content preview available";
        if (result.text) {
          // Look for trend-related keywords to extract more relevant content
          const trendKeywords = ['trending', 'viral', 'popular', 'hot', 'new', 'latest', 'growing', 'emerging', 'rise', 'boom'];
          const text = result.text;
          
          // Try to find a section with trend keywords
          let bestSnippet = text.slice(0, 600);
          for (const keyword of trendKeywords) {
            const keywordIndex = text.toLowerCase().indexOf(keyword);
            if (keywordIndex !== -1) {
              const start = Math.max(0, keywordIndex - 150);
              const end = Math.min(text.length, keywordIndex + 450);
              bestSnippet = text.slice(start, end);
              break;
            }
          }
          
          snippet = bestSnippet + (bestSnippet.length < text.length ? "..." : "");
        }
        
        // Add published date if available
        const dateInfo = result.publishedDate ? 
          ` (Published: ${new Date(result.publishedDate).toLocaleDateString()})` : '';
        
        return `**${index + 1}. ${result.title}**${dateInfo}
Source: ${result.url}
${snippet}`;
      }).join('\n\n');

      // Enhanced search summary with filtering details
      const filterDetails = [];
      if (includeDomains?.length) filterDetails.push(`sources: ${includeDomains.join(", ")}`);
      if (excludeDomains?.length) filterDetails.push(`excluded: ${excludeDomains.join(", ")}`);
      if (dateFilter && dateFilter !== "any") filterDetails.push(`timeframe: ${dateFilter.replace("_", " ")}`);
      if (searchType === "neural") filterDetails.push("mode: neural/semantic search");

      const searchSummary = `🔍 Found ${results.length} trend intelligence results for "${query}"${filterDetails.length ? ` (${filterDetails.join(", ")})` : ''}:

${formattedResults}

---
*Enhanced web search completed using Exa API with trend intelligence optimization*`;

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