import { tool } from "ai";
import { z } from "zod";
import { app } from "~/app";
import { updateAgentStatus } from "~/lib/slack/utils";
import { vectorizerAI } from "~/lib/integrations/vectorizer-ai";
import type { ExperimentalContext } from "../respond-to-message";

export const vectorizeImageTool = tool({
  name: "vectorize_image",
  description: "Convert bitmap images (JPG, PNG, GIF, BMP, TIFF) to vector graphics (SVG, PDF, PNG). Supports images from URLs, Slack file uploads, or base64 data. Use this when users want to convert raster images to scalable vector format.",
  inputSchema: z.object({
    imageSource: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("url"),
        url: z.string().url().describe("URL of the image to vectorize"),
      }),
      z.object({
        type: z.literal("slack_file"),
        fileUrl: z.string().describe("Slack file URL from file upload"),
      }),
      z.object({
        type: z.literal("base64"),
        data: z.string().describe("Base64 encoded image data"),
      }),
    ]).describe("Source of the image to vectorize"),
    options: z.object({
      mode: z.enum(["production", "preview", "test", "test_preview"]).optional().default("preview").describe("Processing mode - use 'preview' for testing, 'production' for final results"),
      outputFormat: z.enum(["svg", "png", "pdf", "eps", "dxf"]).optional().default("svg").describe("Output format for the vectorized image"),
      maxColors: z.number().int().min(0).max(256).optional().describe("Maximum number of colors to use (0 = unlimited)"),
      retentionDays: z.number().int().min(0).max(30).optional().default(1).describe("Days to retain the result for downloading other formats"),
    }).optional().default({}),
  }),
  execute: async ({ imageSource, options = {} }, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      // Update status to inform user what we're doing
      await updateAgentStatus({
        channel,
        thread_ts,
        status: "is vectorizing your image...",
      });

      app.logger.debug("Image vectorization request:", { imageSource: imageSource.type, options });

      // Prepare vectorization options
      const vectorizeOptions = {
        mode: options.mode || "preview",
        outputFormat: options.outputFormat || "svg",
        retentionDays: options.retentionDays || 1,
        processingOptions: {
          maxColors: options.maxColors,
        },
      };

      let result;
      let sourceDescription;

      // Handle different image source types
      switch (imageSource.type) {
        case "url":
          result = await vectorizerAI.vectorizeFromUrl(imageSource.url, vectorizeOptions);
          sourceDescription = `image from ${imageSource.url}`;
          break;
          
        case "slack_file":
          if (!process.env.SLACK_BOT_TOKEN) {
            throw new Error("Slack bot token not configured");
          }
          result = await vectorizerAI.vectorizeFromSlackFile(
            imageSource.fileUrl, 
            process.env.SLACK_BOT_TOKEN, 
            vectorizeOptions
          );
          sourceDescription = "uploaded image";
          break;
          
        case "base64":
          result = await vectorizerAI.vectorizeFromBase64(imageSource.data, vectorizeOptions);
          sourceDescription = "base64 image data";
          break;
          
        default:
          throw new Error("Invalid image source type");
      }

      // Determine content type description
      const formatDescription = {
        'image/svg+xml': 'SVG vector graphic',
        'application/pdf': 'PDF document',
        'image/png': 'PNG image',
        'application/postscript': 'EPS file',
        'application/dxf': 'DXF file',
      }[result.contentType] || 'vectorized image';

      // Prepare result message
      const modeInfo = options.mode === 'preview' 
        ? " (Preview mode - includes watermark)" 
        : options.mode === 'test' || options.mode === 'test_preview'
          ? " (Test mode - includes watermark, no credits charged)"
          : "";
      
      const costInfo = result.creditsCharged > 0 
        ? `\n💰 **Credits charged:** ${result.creditsCharged}`
        : result.creditsCalculated 
          ? `\n💰 **Credits would be charged:** ${result.creditsCalculated} (test mode)`
          : "";

      const retentionInfo = result.imageToken 
        ? `\n📁 **Image Token:** Available for ${options.retentionDays} days for additional formats`
        : "";

      // For small SVG files, we can include the content inline
      // For other formats or large files, we'll need to indicate the file size
      let resultContent;
      if (result.contentType === 'image/svg+xml' && result.data.length < 10000) {
        // Small SVG - include inline
        const svgContent = result.data.toString('utf8');
        resultContent = `\n\`\`\`svg\n${svgContent}\n\`\`\``;
      } else {
        // Large file or binary format - show file info
        const fileSizeKB = (result.data.length / 1024).toFixed(1);
        resultContent = `\n📄 **File generated:** ${formatDescription} (${fileSizeKB} KB)`;
      }

      const successMessage = `✅ **Image Vectorization Complete**${modeInfo}

🎯 **Input:** Processed ${sourceDescription}
📐 **Output:** ${formatDescription.charAt(0).toUpperCase() + formatDescription.slice(1)}
${options.maxColors ? `🎨 **Max colors:** ${options.maxColors}` : ""}${costInfo}${retentionInfo}

${resultContent}

${options.mode === 'preview' ? '\n💡 *Tip: Use mode "production" for final results without watermark*' : ''}
${result.imageToken ? '\n🔄 *Use the image token to download additional formats at reduced cost*' : ''}`;

      return [
        {
          role: "user" as const,
          content: successMessage,
        },
      ];

    } catch (error) {
      app.logger.error("Image vectorization failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      // Provide helpful error guidance
      let helpText = "";
      if (errorMessage.includes("Failed to fetch Slack file")) {
        helpText = "\n\n💡 *Make sure I have permission to access the file and that it's a valid image format (JPG, PNG, GIF, BMP, TIFF)*";
      } else if (errorMessage.includes("API error")) {
        helpText = "\n\n💡 *This might be an issue with the vectorizer.ai service. Try again in a moment or check if your API credentials are configured correctly.*";
      } else if (errorMessage.includes("not configured")) {
        helpText = "\n\n💡 *The vectorizer.ai API credentials need to be configured by an administrator.*";
      }
      
      return [
        {
          role: "user" as const,
          content: `❌ **Image vectorization failed:** ${errorMessage}${helpText}`,
        },
      ];
    }
  },
});

export const vectorizerAccountTool = tool({
  name: "vectorizer_account_status",
  description: "Check the current vectorizer.ai account status including subscription plan and remaining credits.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      await updateAgentStatus({
        channel,
        thread_ts,
        status: "is checking vectorizer.ai account status...",
      });

      const accountStatus = await vectorizerAI.getAccountStatus();
      
      const statusMessage = `📊 **Vectorizer.AI Account Status**

🔑 **Subscription:** ${accountStatus.subscriptionPlan === 'none' ? 'No active plan' : accountStatus.subscriptionPlan}
🟢 **Status:** ${accountStatus.subscriptionState}
💰 **Credits remaining:** ${accountStatus.credits.toLocaleString()}

${accountStatus.credits === 0 && accountStatus.subscriptionPlan === 'none' 
  ? '\n⚠️ *No active subscription. You can still use test mode for development and integration testing.*'
  : accountStatus.credits < 10
    ? '\n⚠️ *Low credits remaining. Consider topping up your account.*'
    : '\n✅ *Account is active and ready for image vectorization.*'
}`;

      return [
        {
          role: "user" as const,
          content: statusMessage,
        },
      ];

    } catch (error) {
      app.logger.error("Failed to get vectorizer account status:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `❌ **Failed to get account status:** ${errorMessage}\n\n💡 *Make sure the vectorizer.ai API credentials are configured correctly.*`,
        },
      ];
    }
  },
});