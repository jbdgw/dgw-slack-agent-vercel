# Slack Agent Setup Guide - Complete Implementation

## Overview
This Slack agent has been enhanced with three major capabilities:
1. **Web Search** - Real-time information retrieval using Exa API
2. **RAG Pipeline** - Document knowledge base using Google Drive + Pinecone
3. **Sage Connect** - Promotional product research and inventory management

## Environment Variables Required

All environment variables must be configured in your `.env` file:

### Core Slack Configuration
```env
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
```

### AI Configuration
```env
# OpenAI API (Required)
OPENAI_API_KEY=sk-your-openai-key

# Optional: Vercel AI Gateway
AI_GATEWAY_API_KEY=vck_your_gateway_key
```

### Web Search (Exa)
```env
EXA_API_KEY=your-exa-api-key
```

### Google Drive RAG Pipeline
```env
# Google Drive Configuration
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=your_private_key_here

# Pinecone Vector Database
PINECONE_API_KEY=pcsk_your_pinecone_key
PINECONE_INDEX=your-index-name
PINECONE_ENVIRONMENT=us-east-1
```

### Sage Connect (Promotional Products)
```env
SAGE_ACCOUNT_ID=your_account_id
SAGE_LOGIN_ID=your_login_id
SAGE_API_KEY=your_api_key
SAGE_API_URL=https://www.promoplace.com/ws/ws.dll/ConnectAPI
SAGE_API_VERSION=130
```

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Project
```bash
npm run build
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Start ngrok Tunnel
In a separate terminal:
```bash
ngrok http 3000
```

### 5. Update Slack Manifest
Update your `manifest.json` with the ngrok URL:
- Replace the `url` and `request_url` fields with your ngrok URL + `/api/events`
- Example: `https://abc123.ngrok-free.app/api/events`

## Available Tools

The Slack agent now has **10 tools** organized into 4 categories:

### 1. Slack Context Tools (Original)
- `updateChatTitleTool` - Updates conversation titles
- `getThreadMessagesTool` - Fetches thread history
- `getChannelMessagesTool` - Fetches channel messages
- `updateAgentStatusTool` - Updates agent status indicator

### 2. Web Search Tool
- `webSearchTool` - Searches the web for real-time information using Exa API

### 3. Knowledge Base Tools (RAG)
- `knowledgeSearchTool` - Searches internal documents from Google Drive
- `refreshKnowledgeTool` - Re-indexes all documents from Google Drive
- `knowledgeStatsTool` - Shows knowledge base statistics and health

### 4. Sage Connect Tools (Promotional Products)
- `searchProductsTool` - Searches for promotional products
- `getProductDetailTool` - Gets detailed product information
- `checkInventoryTool` - Checks product stock levels
- `getCategoriesAndThemesTool` - Lists available product categories

## Important Notes

### Google Drive RAG Pipeline
**Documents are NOT automatically indexed on server startup!**

To populate your knowledge base:
1. Ensure your Google Drive folder contains documents
2. Ask the Slack agent to "refresh the knowledge base"
3. The agent will use the `refreshKnowledgeTool` to index all documents
4. This process may take several minutes depending on document count

Supported document types:
- PDF files
- Google Docs
- Plain text files
- Limited DOCX support (text extraction only)

### Sage Connect Configuration
If the agent reports it cannot access Sage tools, verify:
1. All SAGE_* environment variables are set correctly
2. The API credentials are valid
3. The API URL is accessible

#### Product Search Display (Service 103)
Currently displays for each product:
- Product name
- Product ID (prodEId) and SPC code
- Category (currently shows "General use" - field needs mapping)
- Price range (e.g., "$1.73 - 2.13")
- Supplier name (if available)
- Colors (if available)
- Themes (if available)
- Verification badges (✓ Verified, 🌱 Eco-Friendly)

#### Product Detail Display (Service 105)
Currently retrieves and displays:
- **Basic Info:** Product name, ID, SPC, Category
- **Pricing:** Base price and quantity pricing tiers
- **Supplier:** Company name and ID
- **Features:** Verified status, eco-friendly status
- **Description:** Full product description
- **Customization:** Available colors, themes
- **Specifications:** All product specifications as key-value pairs
- **Production:** Decoration methods, lead time
- **Physical:** Weight, dimensions

#### Available Fields from Sage Connect API
Based on the API response, you can add:
- `thumbPic` - Thumbnail image URL (already retrieved, not displayed)
- `prodEId` - Numeric product ID from Sage
- Additional images (when includeImages=true in Service 105)
- Inventory/stock information (via Service 107)
- Categories and themes list (via Service 101)

#### Customizing the Display
To modify what's shown, edit `/server/lib/ai/tools/sage-connect.ts`:

1. **For Search Results** (lines 94-130): Modify the `formattedResults` mapping
2. **For Product Details** (lines 198-260): Modify the `productDetail` string template

Example: To add thumbnail images to search results:
```typescript
const imageDisplay = product.thumbPic ? `\n- **Preview:** ${product.thumbPic}` : '';
```

Example: To simplify product details to just essentials:
```typescript
const productDetail = `**${product.prName}**
Price: ${priceDisplay}
${colors}
${description}`;
```

### PDF Parse Module Fix
A custom wrapper (`pdf-parser-safe.ts`) was created to avoid pdf-parse module debug mode issues. This prevents the "test file not found" error during server startup.

## Testing the Implementation

### Test Web Search
```
@agent What's the latest news about AI?
```

### Test Knowledge Base (after refreshing)
```
@agent Search our knowledge base for [topic]
```

### Test Sage Connect
```
@agent Find promotional t-shirts under $20
```

## Troubleshooting

### Server won't start - PDF error
If you see: `ENOENT: no such file or directory, open './test/data/05-versions-space.pdf'`
- The fix has been implemented in `server/lib/integrations/pdf-parser-safe.ts`
- Ensure you've rebuilt the project: `npm run build`

### ngrok Authentication Error
```bash
ngrok authtoken YOUR_AUTH_TOKEN
```

### Multiple ngrok Sessions Error
```bash
pkill -f ngrok
```

### Knowledge Base Returns No Results
1. Check if documents exist in your Google Drive folder
2. Ask the agent to "refresh the knowledge base"
3. Wait for the indexing to complete
4. Try searching again

### Sage Connect Not Working
1. Verify all SAGE_* environment variables are set
2. Check API credentials are valid
3. Test API connectivity directly

## System Architecture

```
Slack Event → Bolt Receiver → AI Response Handler
                                    ↓
                            Tool Selection Logic
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
            Slack Tools      Web Search      Knowledge/Sage
                    ↓               ↓               ↓
                    └───────────────┼───────────────┘
                                    ↓
                            Response to User
```

## File Structure

```
/server
  /lib
    /ai
      /tools
        - web-search.ts          # Exa API integration
        - knowledge-search.ts     # RAG pipeline tools
        - sage-connect.ts         # Promotional product tools
      - respond-to-message.ts    # Main AI orchestration
    /integrations
      - google-drive.ts          # Google Drive client
      - pinecone.ts              # Pinecone vector DB
      - document-processor.ts    # RAG pipeline processor
      - sage-connect.ts          # Sage Connect API client
      - pdf-parser-safe.ts       # PDF parse wrapper (fix)
```

## Next Steps

1. **Deploy to Production**: Follow the Vercel deployment guide in README.md
2. **Monitor Performance**: Check logs for tool usage and response times
3. **Customize System Prompt**: Adjust tool selection logic in `respond-to-message.ts`
4. **Add More Tools**: Follow the existing patterns to add new capabilities

## Support

For issues or questions:
- Check the logs: Server logs will show detailed error messages
- Review environment variables: Most issues stem from missing or incorrect env vars
- Test tools individually: Use specific prompts to test each tool category