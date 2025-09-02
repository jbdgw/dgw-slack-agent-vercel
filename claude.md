# CLAUDE.md - Slack Agent with Nitro + AI SDK

## Project Overview

This is a Slack bot application built with Nitro framework and integrated with multiple AI services and APIs. The bot provides intelligent responses, promotional product search, knowledge base queries, web search capabilities, and persistent memory for personalized conversations.

## Tech Stack

- **Framework**: Nitro (Universal JavaScript Server)
- **Language**: TypeScript 5+
- **AI Integration**: Vercel AI SDK with OpenAI GPT-4o
- **Slack Integration**: @slack/bolt with @vercel/slack-bolt
- **Package Manager**: npm
- **Deployment**: Vercel
- **Vector Database**: Pinecone
- **Document Storage**: Google Drive
- **Product Catalog**: Sage Connect API
- **Web Search**: Exa API
- **Image Vectorization**: Vectorizer.ai API
- **Memory Layer**: Mem0 AI for persistent conversation memory

## Project Structure

```
.
├── server/                      # Nitro server structure
│   ├── api/                    # API endpoints
│   │   ├── events.post.ts      # Main Slack events handler
│   │   ├── slack-verify.post.ts # Verified Slack webhook endpoint
│   │   └── slack-events.ts     # Alternative events handler
│   ├── app.ts                  # Slack Bolt app configuration
│   ├── lib/                    # Business logic
│   │   ├── ai/                 # AI-related functionality
│   │   │   ├── respond-to-message.ts # Main AI response handler
│   │   │   └── tools/          # AI tools
│   │   │       ├── web-search.ts
│   │   │       ├── knowledge-search.ts
│   │   │       ├── sage-connect.ts
│   │   │       ├── vectorize-image.ts
│   │   │       ├── memory-tools.ts
│   │   │       └── ...
│   │   ├── integrations/       # External service integrations
│   │   │   ├── google-drive.ts
│   │   │   ├── pinecone.ts
│   │   │   ├── sage-connect.ts
│   │   │   ├── vectorizer-ai.ts
│   │   │   ├── mem0.ts
│   │   │   └── document-processor.ts
│   │   └── slack/              # Slack utilities
│   │       └── utils.ts
│   ├── listeners/              # Slack event listeners
│   │   ├── events/
│   │   ├── messages/
│   │   ├── commands/
│   │   └── ...
│   └── routes/                 # Additional HTTP routes
├── scripts/                    # Development scripts
│   ├── configure.ts            # Setup configuration
│   └── dev.tunnel.ts          # Local tunneling for development
├── .env                       # Environment variables
├── package.json               # Dependencies and scripts
├── nitro.config.ts           # Nitro configuration
├── tsconfig.json             # TypeScript configuration
└── vercel.json               # Vercel deployment config
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Slack Configuration
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token

# AI Configuration
OPENAI_API_KEY=sk-your-openai-key

# Google Drive Integration
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

# Vector Database
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=slack-agent
PINECONE_ENVIRONMENT=us-east-1

# Web Search
EXA_API_KEY=your_exa_api_key

# Sage Connect (Product Catalog)
SAGE_ACCOUNT_ID=your_account_id
SAGE_LOGIN_ID=your_login_id
SAGE_API_KEY=your_sage_api_key
SAGE_API_URL=https://www.promoplace.com/ws/ws.dll/ConnectAPI
SAGE_API_VERSION=130

# Vectorizer.ai (Image Vectorization)
VECTORIZER_AI_API_ID=your_api_id
VECTORIZER_AI_API_SECRET=your_api_secret

# Mem0 Memory Integration
MEM0_API_KEY=your_mem0_api_key

# Optional: AI Gateway
AI_GATEWAY_API_KEY=your_ai_gateway_key
```

## Setup Instructions

### 1. Installation

```bash
# Clone and install dependencies
npm install

# Configure the application
npm run configure
```

### 2. Slack App Setup

1. Create a new Slack app at https://api.slack.com/apps
2. Configure OAuth & Permissions:
   - Add bot token scopes: `app_mentions:read`, `chat:write`, `channels:history`, `groups:history`, `im:history`, `mpim:history`, `files:read`
3. Enable Event Subscriptions:
   - Request URL: `https://your-deployment-url.vercel.app/api/slack-verify`
   - Subscribe to: `app_mention`, `message.channels`, `message.groups`, `message.im`, `message.mpim`
4. Install app to workspace and get bot token

### 3. Development

```bash
# Start development server
npm run dev

# For local Slack testing with tunneling
npm run dev:tunnel
```

### 4. Deployment

```bash
# Deploy to Vercel
vercel --prod

# Update Slack app webhook URL with new deployment URL
```

## Key Features

### 1. Trend Intelligence AI (Core Feature)
- **Enhanced Exa Web Search**: Multi-platform trend discovery with date filtering, domain targeting, and neural search
- **Company Research Tool**: Deep website crawling for brand values, mission, and culture analysis
- **Trend-to-Brand Matching**: Connects viral products to client values using AI-powered analysis
- **Industry Expertise**: Specialized for Healthcare, Education, Purpose-Driven Businesses, and Beverage industries
- **Real-time Status Updates**: Live progress tracking during trend research

### 2. Enhanced Web Search & Trend Discovery
- **Multi-Platform Search**: Simultaneous search across TikTok, Instagram, Reddit, industry sites
- **Date Filtering**: `past_week` for hot trends, `past_3_months` for established trends
- **Neural vs Keyword Search**: Semantic understanding of trend queries
- **Domain Exclusion**: Filter out irrelevant or low-quality sources
- **Trend-Focused Content Extraction**: Prioritizes trend-related information in results

### 3. Company Research Intelligence
- **Deep Website Crawling**: Comprehensive analysis of company websites
- **Focus Areas**: Mission, values, culture, sustainability, diversity initiatives, recent news
- **Brand Intelligence**: Perfect preparation for trend-to-brand alignment
- **Multi-Source Analysis**: Combines official websites, news sources, and social presence

### 4. Knowledge Base Search
- Searches internal documents stored in Google Drive
- Automatic document processing and chunking
- Vector similarity search using Pinecone
- Supports PDFs and Google Docs

### 5. Promotional Product Search
- Integration with Sage Connect API
- Product search, details, and inventory checking
- Category and theme exploration
- Trend-aligned product recommendations

### 5. Image Vectorization
- Convert bitmap images (JPG, PNG, GIF, BMP, TIFF) to vector graphics (SVG, PDF, PNG)
- Automatic detection of uploaded files in conversations
- Support for preview mode (watermarked, 0.2 credits) and production mode (clean, 1.0 credit)
- Test mode available for free development and debugging
- Multiple output formats: SVG, PNG, PDF, EPS, DXF
- Account status monitoring and credit tracking
- Image token system for multi-format downloads at reduced cost

### 6. Persistent Memory System
- Long-term memory across conversations using Mem0 AI
- Personalized responses based on user preferences and history
- Automatic storage of important conversation details
- Memory search and retrieval for context-aware interactions
- Cross-session continuity and relationship building

### 7. Slack Integration
- App mentions and direct messages
- Thread and channel message context
- Chat title updates
- Status indicators
- File upload processing with proper authentication

## API Endpoints

### `/api/slack-verify` (POST)
- **Primary webhook endpoint**
- Handles Slack URL verification challenges
- Processes all Slack events (messages, mentions, etc.)
- Uses dynamic imports to avoid circular dependencies

### `/api/events` (POST)
- **Alternative events endpoint**
- Similar functionality to slack-verify
- Backup endpoint if needed

## AI Tools Available

### Core Trend Intelligence Tools
1. **Enhanced Web Search Tool** - Multi-platform trend discovery with advanced filtering
   - Date filtering: `past_week`, `past_month`, `past_3_months`, etc.
   - Domain targeting: `includeDomains: ['tiktok.com', 'instagram.com', 'reddit.com']`
   - Domain exclusion: `excludeDomains: ['spam-sites.com']`
   - Neural vs keyword search modes
   - Trend-focused content extraction

2. **Company Research Tool** - Deep brand intelligence analysis
   - Website crawling for mission, values, culture
   - Sustainability and diversity focus areas
   - Recent news and initiatives tracking
   - Multi-source brand analysis

### Supporting Tools
3. **Knowledge Search Tool** - Query internal knowledge base
4. **Sage Connect Tools** - Product catalog operations with trend alignment
5. **Memory Tools** - Store, search, and manage conversation memories for trend learning
6. **Image Vectorization Tools** - Convert images to vector graphics
7. **Slack Context Tools** - Retrieve message history
8. **Status Tools** - Update agent status and chat titles

## Development Commands

```bash
# Development
npm run dev                 # Start dev server
npm run dev:tunnel         # Start with tunneling for Slack
npm run build              # Build for production
npm run preview            # Preview production build
npm run configure          # Run setup wizard

# Code Quality
npm run lint               # Run linter
npm run lint:fix           # Fix lint issues

# Deployment
vercel                     # Deploy to Vercel
vercel --prod             # Deploy to production
vercel logs               # View deployment logs
```

## Deployment Checklist

- [ ] Environment variables configured in Vercel
- [ ] Slack app webhook URL updated
- [ ] Google Service Account credentials added
- [ ] Pinecone index created and configured
- [ ] Sage Connect API access verified
- [ ] Exa API key configured
- [ ] OpenAI API key with sufficient credits
- [ ] Knowledge base documents processed
- [ ] **Vectorizer.ai API credentials configured**
- [ ] **Mem0 API key configured for memory functionality**
- [ ] **Slack bot permissions include `files:read` scope**
- [ ] Bot permissions configured in Slack workspace

## Troubleshooting

### Common Issues

1. **Slack URL Verification Failed**
   - Ensure webhook endpoint returns challenge as plain text
   - Check that environment variables are set in Vercel
   - Verify no circular dependencies in imports

2. **Bot Not Responding**
   - Check Vercel deployment logs: `vercel logs`
   - Verify OpenAI API key is valid and has credits
   - Ensure bot has proper permissions in Slack

3. **Knowledge Search Not Working**
   - Verify Google Service Account has access to Drive folder
   - Check Pinecone index exists and is accessible
   - Run knowledge refresh if documents were recently added

4. **Product Search Issues**
   - Verify Sage Connect API credentials
   - Check API endpoint URL and version
   - Review API rate limits

5. **Image Vectorization Issues**
   - Check vectorizer.ai API credentials in Vercel environment variables
   - Ensure Slack app has `files:read` permission (reinstall app after adding scope)
   - Verify account status: "What's my vectorizer.ai account status?"
   - Test with test mode: "vectorize in test mode" (free, watermarked)
   - Check supported formats: JPG, PNG, GIF, BMP, TIFF
   - Ensure images are uploaded as file attachments, not pasted inline

6. **Memory System Issues**
   - Check Mem0 API key in Vercel environment variables
   - Verify API key permissions at [app.mem0.ai](https://app.mem0.ai)
   - Test memory functionality: "Remember that I prefer brief responses"
   - Check memory search: "What do you remember about me?"
   - Memory gracefully degrades when API unavailable

### Development Tips

1. **Local Testing**
   - Use `npm run dev:tunnel` for local Slack testing
   - Test webhook verification before deploying
   - Check console logs for debugging information

2. **Deployment**
   - Each Vercel deployment creates a new URL
   - Update Slack webhook URL after each deployment
   - Use environment variables for all sensitive data

3. **Performance**
   - Vector search responses cached automatically
   - Web search uses live crawling for fresh results
   - Memory searches use relevance scoring for best results
   - AI responses stream for better user experience

## Architecture Notes

### Circular Dependency Prevention
- All integration files use `console` logging instead of `app.logger`
- API endpoints use dynamic imports for Slack app initialization
- Dependencies loaded lazily after verification challenges

### Error Handling
- Graceful fallbacks for all external API calls
- User-friendly error messages in Slack
- Comprehensive logging for debugging

### Security
- All API keys stored as environment variables
- Slack signature verification enabled
- No sensitive data in client-side code

---

## Future Enhancement Plan: Image Display in Slack

### Current Status
✅ **Core vectorization functionality working:**
- Image upload detection and processing
- Vectorizer.ai API integration with proper authentication
- Support for preview/production/test modes
- Account status monitoring and credit tracking
- Image token system for multi-format downloads

❌ **Missing: Display results in Slack**
Currently, vectorized images are processed and stored on vectorizer.ai servers but not displayed in Slack. Users receive confirmation and metadata but must access results externally.

### Enhancement Plan

#### Phase 1: Basic Image Display
1. **Download vectorized results** from vectorizer.ai after processing
2. **Upload to Slack** using `files.upload` API
3. **Display inline** in the conversation thread
4. **Add file metadata** (format, size, credits used)

#### Phase 2: Multi-Format Support  
1. **Offer format selection** via Slack interactive components
2. **Generate multiple formats** using image tokens
3. **Create format comparison** views (preview vs. production)
4. **Batch download options** for different formats

#### Phase 3: Advanced Features
1. **Interactive preview/production toggle** with credit confirmation
2. **Image editing suggestions** based on vectorization quality
3. **Batch processing** for multiple images
4. **Integration with Slack Canvas** for persistent image galleries

#### Technical Requirements
- **Additional Slack permissions:** `files:write:user`
- **File storage strategy:** Temporary local storage or direct stream processing
- **Error handling:** Fallback for large files or network issues
- **Performance optimization:** Async processing with status updates

#### Implementation Priority
- **Priority 1:** Basic SVG result display in Slack (most common use case)
- **Priority 2:** PNG result display for broader compatibility
- **Priority 3:** Multi-format selection and comparison
- **Priority 4:** Advanced interactive features

---

**Current Deployment URL**: `https://dgw-slack-vercel-agent-buku3kokp-jordans-projects-608b7fba.vercel.app`
**Slack Webhook**: `https://dgw-slack-vercel-agent-buku3kokp-jordans-projects-608b7fba.vercel.app/api/slack-verify`

Last Updated: September 2, 2025
Version: 1.3.0 - Enhanced Exa API Integration with Company Research Tool

## Recent Updates (v1.3.0)
- **Enhanced Web Search**: Added date filtering, multi-domain targeting, neural search, domain exclusion
- **Company Research Tool**: Deep website crawling for brand intelligence and values analysis
- **Improved Trend Intelligence**: Trend-focused content extraction and brand alignment
- **Updated System Prompts**: Enhanced decision flows with company research integration
- **Better Result Processing**: Smarter content extraction focusing on trend-relevant information

## 🧠 Memory System Details

### Memory Features Working:
✅ **Persistent User Memory** - Each Slack user gets isolated memory storage  
✅ **Automatic Context Saving** - Important conversation details saved automatically  
✅ **Cross-Session Continuity** - Remembers preferences across different conversations  
✅ **Personalized Responses** - Tailors responses based on learned user patterns  
✅ **6 Memory Tools Available** - Complete memory management toolkit  

### Memory Tools:
1. **`searchMemoryTool`** - Find relevant past conversations and preferences
2. **`saveMemoryTool`** - Store important user information manually  
3. **`getAllMemoriesTool`** - Get complete user context and history
4. **`getMemoryHistoryTool`** - Track changes to specific memories
5. **`deleteMemoryTool`** - Remove specific memories (use with caution)
6. **`addConversationToMemoryTool`** - Save entire conversation threads

### Usage Examples:
- `@bot Remember that I prefer brief responses`
- `@bot What do you remember about me?`
- `@bot My name is Jordan and I work in marketing`
- Natural conversation - bot automatically learns and adapts

### Technical Implementation:
- **Mem0 AI Integration**: Professional memory layer service
- **User Isolation**: Memories tagged with unique Slack user IDs
- **Error Handling**: Gracefully degrades when API unavailable
- **Schema Validation**: Fixed Zod schemas for AI SDK compatibility