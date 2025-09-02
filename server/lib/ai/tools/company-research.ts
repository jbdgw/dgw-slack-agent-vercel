import { tool } from "ai";
import { z } from "zod";
import Exa from "exa-js";
import { app } from "~/app";
import { updateAgentStatus } from "~/lib/slack/utils";
import type { ExperimentalContext } from "../respond-to-message";

const exa = new Exa(process.env.EXA_API_KEY || process.env.EXASEARCH_API_KEY);

export const companyResearchTool = tool({
  name: "research_company",
  description: "Deep research tool that crawls company websites to gather comprehensive information about their mission, values, culture, products, and brand identity. Perfect for understanding client brands before trend matching.",
  inputSchema: z.object({
    companyName: z.string().min(1, "Company name cannot be empty").describe("The company name to research (e.g., 'Sephora', 'Nike', 'Patagonia')"),
    companyWebsite: z
      .string()
      .optional()
      .describe("Optional company website URL (e.g., 'sephora.com'). If not provided, will auto-discover."),
    focusAreas: z
      .array(z.enum(["mission", "values", "culture", "products", "sustainability", "diversity", "leadership", "recent_news", "employee_benefits"]))
      .optional()
      .default(["mission", "values", "culture", "sustainability"])
      .describe("Specific areas to focus research on. Default focuses on brand alignment essentials."),
    includeRecentNews: z
      .boolean()
      .optional()
      .default(true)
      .describe("Whether to include recent news and initiatives (default: true)"),
  }),
  execute: async ({ companyName, companyWebsite, focusAreas, includeRecentNews }, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      await updateAgentStatus({
        channel,
        thread_ts,
        status: `is researching ${companyName} company background and values...`,
      });

      app.logger.debug("Company research request:", { 
        companyName, companyWebsite, focusAreas, includeRecentNews 
      });

      // Build comprehensive search queries based on focus areas
      const searchQueries = [];
      
      // Always search company website first
      if (companyWebsite) {
        searchQueries.push({
          query: `${companyName} mission values culture`,
          includeDomains: [companyWebsite],
          description: "Company website"
        });
      } else {
        searchQueries.push({
          query: `${companyName} official website mission values`,
          description: "Company discovery"
        });
      }

      // Add focus area searches
      if (focusAreas?.includes("sustainability")) {
        searchQueries.push({
          query: `${companyName} sustainability environmental social responsibility ESG initiatives`,
          description: "Sustainability focus"
        });
      }

      if (focusAreas?.includes("diversity")) {
        searchQueries.push({
          query: `${companyName} diversity equity inclusion DEI initiatives programs`,
          description: "Diversity initiatives"
        });
      }

      if (focusAreas?.includes("culture")) {
        searchQueries.push({
          query: `${companyName} company culture employee experience workplace values`,
          description: "Company culture"
        });
      }

      if (focusAreas?.includes("recent_news")) {
        searchQueries.push({
          query: `${companyName} recent news initiatives announcements 2024 2025`,
          dateFilter: "past_3_months",
          description: "Recent developments"
        });
      }

      const allResults = [];
      
      // Execute searches
      for (const searchQuery of searchQueries) {
        try {
          await updateAgentStatus({
            channel,
            thread_ts,
            status: `is analyzing ${companyName} ${searchQuery.description.toLowerCase()}...`,
          });

          const searchOptions: any = {
            livecrawl: "always",
            numResults: 3,
            useAutoprompt: true,
          };

          if (searchQuery.includeDomains) {
            searchOptions.includeDomains = searchQuery.includeDomains;
          }

          if (searchQuery.dateFilter) {
            const dateMap = {
              "past_3_months": new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            };
            searchOptions.startPublishedDate = dateMap[searchQuery.dateFilter];
          }

          const { results } = await exa.searchAndContents(searchQuery.query, searchOptions);
          
          if (results && results.length > 0) {
            allResults.push({
              category: searchQuery.description,
              results: results
            });
          }
        } catch (searchError) {
          app.logger.warn(`Company research search failed for ${searchQuery.description}:`, searchError);
        }
      }

      if (allResults.length === 0) {
        return [
          {
            role: "user" as const,
            content: `Unable to find comprehensive information about ${companyName}. Try providing their website URL or checking the company name spelling.`,
          },
        ];
      }

      // Process and format results for trend intelligence
      const processedSections = allResults.map(section => {
        const sectionResults = section.results.map((result, index) => {
          // Extract key information for brand analysis
          let snippet = "No content available";
          if (result.text) {
            // Look for brand-relevant keywords
            const brandKeywords = [
              'mission', 'vision', 'values', 'culture', 'purpose', 'believe', 'committed', 
              'sustainability', 'environment', 'social', 'diversity', 'inclusion', 'equity',
              'employees', 'team', 'workplace', 'innovation', 'quality', 'customer', 'community'
            ];
            
            const text = result.text;
            let bestSnippet = text.slice(0, 800);
            
            // Find the most brand-relevant section
            for (const keyword of brandKeywords) {
              const keywordIndex = text.toLowerCase().indexOf(keyword);
              if (keywordIndex !== -1) {
                const start = Math.max(0, keywordIndex - 200);
                const end = Math.min(text.length, keywordIndex + 600);
                bestSnippet = text.slice(start, end);
                break;
              }
            }
            
            snippet = bestSnippet + (bestSnippet.length < text.length ? "..." : "");
          }

          return `**${result.title}**
Source: ${result.url}
${snippet}`;
        }).join('\n\n');

        return `### ${section.category}
${sectionResults}`;
      }).join('\n\n');

      const researchSummary = `🏢 **Company Research: ${companyName}**

${processedSections}

---
### 🎯 **Brand Intelligence Summary for Trend Matching:**

**Key Areas Analyzed:** ${focusAreas?.join(", ") || "mission, values, culture, sustainability"}
**Total Sources:** ${allResults.reduce((total, section) => total + section.results.length, 0)}
${includeRecentNews ? "**Includes Recent Developments:** Yes" : ""}

*Use this research to align trending products with ${companyName}'s brand values and mission.*
*Company research completed using enhanced Exa API*`;

      return [
        {
          role: "user" as const,
          content: researchSummary,
        },
      ];

    } catch (error) {
      app.logger.error("Company research failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `Company research failed for ${companyName}: ${errorMessage}. Please try again with a different company name or check the spelling.`,
        },
      ];
    }
  },
});