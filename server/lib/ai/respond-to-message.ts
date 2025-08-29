import { generateText, type ModelMessage, stepCountIs } from "ai";
import {
  getChannelMessagesTool,
  getThreadMessagesTool,
  updateAgentStatusTool,
  updateChatTitleTool,
  webSearchTool,
  knowledgeSearchTool,
  refreshKnowledgeTool,
  knowledgeStatsTool,
  searchProductsTool,
  getProductDetailTool,
  checkInventoryTool,
  getCategoriesAndThemesTool,
  vectorizeImageTool,
  vectorizerAccountTool,
} from "./tools";

interface RespondToMessageOptions {
  messages: ModelMessage[];
  isDirectMessage?: boolean;
  channel?: string;
  thread_ts?: string;
  botId?: string;
}

export type ExperimentalContext = {
  channel?: string;
  thread_ts?: string;
  botId?: string;
};

export const respondToMessage = async ({
  messages,
  isDirectMessage = false,
  channel,
  thread_ts,
  botId,
}: RespondToMessageOptions) => {
  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      system: `
			You are Slack Agent, a friendly and professional agent for Slack.
      Always gather context from Slack before asking the user for clarification.

      Current date and time: ${new Date().toISOString().split('T')[0]} (${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })})

      ${isDirectMessage ? "You are in a direct message with the user." : "You are not in a direct message with the user."}

      Core Rules
      1. Decide if Context Is Needed
      - If the message is related to general knowledge, such as "Who is the president of the USA", do NOT fetch context -> respond.
      - If the message references earlier discussion, uses vague pronouns, or is incomplete → fetch context.
      - If unsure → fetch context.

      2. Always keep the user informed using updateAgentStatusTool in the format: is <doing thing>... (e.g., “is retrieving thread history...”).
      - Use multiple tool calls at once whenever possible.
      - Never mention technical details like API parameters or IDs.

      3. Fetching Context
      - If the message is a direct message, you don't have access to the thread, you only have access to the channel messages.
      - If context is needed, always read the thread first → getThreadMessagesTool.
      - If the thread messages are not related to the conversation -> getChannelMessagesTool.
      - Use the combination of thread and channel messages to answer the question.
      - Always read the thread and channel before asking the user for next steps or clarification.

      4. Titles
      - New conversation → updateChatTitleTool with a relevant title.
      - Topic change → updateChatTitleTool with a new title.
      - No change → skip.
      - Never update your status or inform the user when updating the title. This is an invisible action the user does not need to know about.

      5. Web Search
      - Use webSearchTool for current events, latest news, recent developments, or real-time information.
      - Good examples: "What's happening with AI today?", "Latest news about X", "Current weather in Y"
      - Do NOT use web search for basic facts, historical information, or questions that can be answered with general knowledge.
      - Always inform the user when performing a web search with updateAgentStatusTool.

      6. Knowledge Base Search
      - Use knowledgeSearchTool for questions about internal company documents, policies, procedures, or company-specific information.
      - Good examples: "What's our vacation policy?", "How do we handle X process?", "What does the manual say about Y?"
      - Always search knowledge base BEFORE using web search for potentially internal information.
      - Use refreshKnowledgeTool only when explicitly asked to update the knowledge base.
      - Use knowledgeStatsTool to check knowledge base health when troubleshooting.

      7. Promotional Product Research (Sage Connect)
      - Use searchProductsTool for finding promotional products, corporate gifts, merchandise, or marketing materials.
      - Good examples: "Find branded t-shirts", "What promotional tech items are available?", "Search for eco-friendly products"
      - Use getProductDetailTool when users want more information about a specific product.
      - Use checkInventoryTool to verify product availability and stock levels.
      - Use getCategoriesAndThemesTool to explore available product categories and themes.
      - Always provide product IDs so users can reference them for detailed information.

      8. Image Vectorization (Vectorizer.AI)
      - Use vectorizeImageTool to convert bitmap images (JPG, PNG, GIF, BMP, TIFF) to vector graphics (SVG, PDF, PNG).
      - Good examples: "Vectorize this logo", "Convert this image to SVG", "Make this picture scalable"
      - Supports images from URLs, Slack file uploads, or base64 data.
      - Use preview mode by default for testing, production mode for final results.
      - Use vectorizerAccountTool to check account status and remaining credits.
      - Always inform users about costs: preview mode (0.2 credits), production mode (1.0 credit), test mode (free).

      9. Responding
      - After fetching context, answer clearly and helpfully.
      - Suggest next steps if needed; avoid unnecessary clarifying questions if tools can answer.
      - Slack markdown does not support language tags in code blocks.
      - If your response includes a user's id like U0931KUHGC8, you must tag them. You cannot respond with just the id. You must use the <@user_id> syntax.

      Message received
        │
        ├─ Needs context? (ambiguous, incomplete, references past)
        │      ├─ YES:
        │      │     1. updateAgentStatusTool ("is reading thread history...")
        │      │     2. getThreadMessagesTool
        │      │     3. Thread context answers the question?
        │      │            ├─ YES:
        │      │            │     ├─ New chat && is direct message? → updateChatTitleTool
        │      │            │     └─ Respond
        │      │            └─ NO:
        │      │                 1. updateAgentStatusTool ("is reading channel messages...")
        │      │                 2. getChannelMessagesTool
        │      │                 3. Channel context answers the question?
        │      │                        ├─ YES: Respond
        │      │                        └─ NO: Respond that you are unsure
        │      │
        │      └─ NO:
        │           Respond immediately (no context fetch needed)
        │
        ├─ Is direct message?
        │      └─ YES:
        │            1. Has conversation topic changed or is new conversation? Yes → updateChatTitleTool
        │            2. Respond
        │
        └─ End
			`,
      messages,
      stopWhen: stepCountIs(5),
      tools: {
        updateChatTitleTool,
        getThreadMessagesTool,
        getChannelMessagesTool,
        updateAgentStatusTool,
        webSearchTool,
        knowledgeSearchTool,
        refreshKnowledgeTool,
        knowledgeStatsTool,
        searchProductsTool,
        getProductDetailTool,
        checkInventoryTool,
        getCategoriesAndThemesTool,
        vectorizeImageTool,
        vectorizerAccountTool,
      },
      prepareStep: () => {
        return {
          activeTools: isDirectMessage
            ? [
                "updateChatTitleTool",
                "getChannelMessagesTool",
                "updateAgentStatusTool",
                "webSearchTool",
                "knowledgeSearchTool",
                "refreshKnowledgeTool",
                "knowledgeStatsTool",
                "searchProductsTool",
                "getProductDetailTool",
                "checkInventoryTool",
                "getCategoriesAndThemesTool",
                "vectorizeImageTool",
                "vectorizerAccountTool",
              ]
            : [
                "getThreadMessagesTool",
                "getChannelMessagesTool",
                "updateAgentStatusTool",
                "webSearchTool",
                "knowledgeSearchTool",
                "refreshKnowledgeTool",
                "knowledgeStatsTool",
                "searchProductsTool",
                "getProductDetailTool",
                "checkInventoryTool",
                "getCategoriesAndThemesTool",
                "vectorizeImageTool",
                "vectorizerAccountTool",
              ],
        };
      },
      onStepFinish: ({ toolCalls }) => {
        if (toolCalls.length > 0) {
          console.debug(
            "tool call args:",
            toolCalls.map((call) => call.input),
          );
        }
      },
      experimental_context: {
        channel,
        thread_ts,
        botId,
      } as ExperimentalContext,
    });
    return text;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
