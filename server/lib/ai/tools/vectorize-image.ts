import { tool } from "ai";
import { z } from "zod";
import { app } from "~/app";
import { updateAgentStatus } from "~/lib/slack/utils";
import { vectorizerAI } from "~/lib/integrations/vectorizer-ai";
import type { ExperimentalContext } from "../respond-to-message";

export const vectorizeImageTool = tool({
  name: "vectorize_image", 
  description: "Convert bitmap images to vector graphics. Use this tool when users ask about vectorizing, converting images to SVG, making images scalable, or when they upload images and ask to process them. Handles typos like 'fectorize', 'vectorise', etc. The tool automatically detects uploaded files. ALWAYS call this tool when users mention vectorization or upload images with processing requests.",
  inputSchema: z.object({
    imageUrl: z.string().optional().describe("Optional: Specific image URL to vectorize. If not provided, tool will look for recently uploaded files in the conversation."),
    options: z.object({
      mode: z.enum(["production", "preview", "test", "test_preview"]).optional().default("preview").describe("Processing mode - use 'preview' for testing, 'production' for final results"),
      outputFormat: z.enum(["svg", "png", "pdf", "eps", "dxf"]).optional().default("svg").describe("Output format for the vectorized image"),
      maxColors: z.number().int().min(0).max(256).optional().describe("Maximum number of colors to use (0 = unlimited)"),
      retentionDays: z.number().int().min(0).max(30).optional().default(1).describe("Days to retain the result for downloading other formats"),
    }).optional().default({}),
  }),
  execute: async ({ imageUrl, options = {} }, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      // Update status to inform user what we're doing
      await updateAgentStatus({
        channel,
        thread_ts,
        status: "is looking for images to vectorize...",
      });

      app.logger.debug("Image vectorization request:", { imageUrl, options });

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
      let targetImageUrl = imageUrl;

      // If no specific URL provided, try to find uploaded files in the conversation
      if (!targetImageUrl) {
        await updateAgentStatus({
          channel,
          thread_ts,
          status: "is searching for uploaded images in the conversation...",
        });

        // Get recent messages to look for file uploads
        let messagesToCheck;
        if (thread_ts) {
          // If we're in a thread, check thread messages
          const threadMessages = await app.client.conversations.replies({
            channel,
            ts: thread_ts,
            limit: 10,
          });
          messagesToCheck = threadMessages.messages || [];
        } else {
          // If not in thread, check recent channel messages  
          const channelMessages = await app.client.conversations.history({
            channel,
            limit: 10,
          });
          messagesToCheck = channelMessages.messages || [];
        }

        // Look for files in recent messages (starting with most recent)
        for (const message of messagesToCheck) {
          if (message.files && message.files.length > 0) {
            // Find the first image file
            const imageFile = message.files.find(file => 
              file.mimetype?.startsWith('image/') || 
              /\.(jpg|jpeg|png|gif|bmp|tiff)$/i.test(file.name || '')
            );
            
            if (imageFile && imageFile.url_private) {
              console.log('📁 Found image file:', {
                name: imageFile.name,
                mimetype: imageFile.mimetype,
                size: imageFile.size,
                url_private: imageFile.url_private?.substring(0, 50) + '...',
                url_private_download: imageFile.url_private_download?.substring(0, 50) + '...',
              });
              
              targetImageUrl = imageFile.url_private;
              sourceDescription = `uploaded image (${imageFile.name})`;
              break;
            }
          }
        }

        if (!targetImageUrl) {
          return [
            {
              role: "user" as const,
              content: `❌ **No image found!** 

I couldn't find any uploaded images in the recent conversation. Please either:
1. Upload an image file (JPG, PNG, GIF, BMP, TIFF) and ask me to vectorize it
2. Provide a direct image URL by saying something like: "Vectorize this image: https://example.com/image.jpg"

💡 *Make sure the image is uploaded as a file attachment, not just pasted inline.*

🧪 **For testing:** You can also try "vectorize in test mode" for free debugging.`,
            },
          ];
        }
      } else {
        sourceDescription = `image from ${targetImageUrl}`;
      }

      await updateAgentStatus({
        channel,
        thread_ts,
        status: "is vectorizing your image...",
      });

      // Get the file content using Slack Web API instead of direct URL
      if (!process.env.SLACK_BOT_TOKEN) {
        throw new Error("Slack bot token not configured");
      }

      // Extract file ID from the URL to use Slack Web API
      // URL format: https://files.slack.com/files-pri/T0E5Y74JD-F09CQ6XXX/filename.jpg
      const fileIdMatch = targetImageUrl.match(/files-pri\/[^\/]+-([^\/]+)/);
      if (!fileIdMatch) {
        console.error('Could not extract file ID from URL:', targetImageUrl.substring(0, 100));
        throw new Error("Could not extract file ID from Slack URL");
      }
      
      const fileId = fileIdMatch[1];
      console.log('📄 Extracted file ID:', fileId);
      
      // Use Slack Web API to get file info
      const fileInfo = await app.client.files.info({
        file: fileId,
      });
      
      if (!fileInfo.file?.url_private_download) {
        throw new Error("Could not get file download URL from Slack API");
      }
      
      console.log('🔗 Using Slack API download URL:', {
        url: fileInfo.file.url_private_download.substring(0, 50) + '...',
      });

      result = await vectorizerAI.vectorizeFromSlackFile(
        fileInfo.file.url_private_download, 
        process.env.SLACK_BOT_TOKEN, 
        vectorizeOptions
      );

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
      let troubleshootingSteps = "";
      
      if (errorMessage.includes("credentials not configured") || errorMessage.includes("not configured")) {
        helpText = "\n\n🔧 **Configuration Issue**: The vectorizer.ai API credentials are not set up properly.";
        troubleshootingSteps = `
**Admin Action Required:**
1. Go to Vercel dashboard → Environment Variables
2. Add: \`VECTORIZER_AI_API_ID\` with your API ID
3. Add: \`VECTORIZER_AI_API_SECRET\` with your API Secret
4. Redeploy the application

💡 *Get your API credentials from: https://vectorizer.ai/account*`;
      } else if (errorMessage.includes("Failed to fetch Slack file")) {
        helpText = "\n\n📁 **File Access Issue**: Could not download the uploaded file.";
        troubleshootingSteps = `
**Please try:**
1. Make sure the file is a valid image (JPG, PNG, GIF, BMP, TIFF)
2. Re-upload the image as a file attachment
3. Check that I have permission to access files in this channel`;
      } else if (errorMessage.includes("API error") || errorMessage.includes("401") || errorMessage.includes("403")) {
        helpText = "\n\n🔐 **Authentication Issue**: Invalid or expired API credentials.";
        troubleshootingSteps = `
**Please check:**
1. API credentials are correct in Vercel environment
2. Vectorizer.ai account is active
3. Sufficient credits available

Try: "What's my vectorizer.ai account status?" to verify account health.`;
      } else if (errorMessage.includes("429")) {
        helpText = "\n\n⏱️ **Rate Limit**: Too many requests to vectorizer.ai API.";
        troubleshootingSteps = "\n**Please wait a moment and try again.**";
      } else {
        helpText = "\n\n❓ **Unexpected Error**: Something went wrong with the vectorization service.";
        troubleshootingSteps = `
**Troubleshooting:**
1. Try again in a moment (temporary service issue)
2. Check account status: "What's my vectorizer.ai account status?"
3. Try test mode: Use options with mode set to "test"`;
      }
      
      return [
        {
          role: "user" as const,
          content: `❌ **Image Vectorization Failed**${helpText}

**Error:** ${errorMessage}${troubleshootingSteps}`,
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