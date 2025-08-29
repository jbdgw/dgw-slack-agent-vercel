# CLAUDE.md - Slack Agent with Nitro + AI SDK

## Project Overview

This is a Slack bot application built with Nitro framework and integrated with multiple AI services and APIs. The bot provides intelligent responses, promotional product search, knowledge base queries, and web search capabilities.

## Tech Stack

- **Framework**: Nitro (Universal JavaScript Server)
- **Language**: TypeScript 5+
- **AI Integration**: Vercel AI SDK with OpenAI GPT-4o-mini
- **Slack Integration**: @slack/bolt with @vercel/slack-bolt
- **Package Manager**: npm
- **Deployment**: Vercel
- **Vector Database**: Pinecone
- **Document Storage**: Google Drive
- **Product Catalog**: Sage Connect API
- **Web Search**: Exa API

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
│   │   │       └── ...
│   │   ├── integrations/       # External service integrations
│   │   │   ├── google-drive.ts
│   │   │   ├── pinecone.ts
│   │   │   ├── sage-connect.ts
│   │   │   ├── vectorizer-ai.ts
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
   - Add bot token scopes: `app_mentions:read`, `chat:write`, `channels:history`, `groups:history`, `im:history`, `mpim:history`
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

### 1. AI-Powered Responses
- Uses OpenAI GPT-4o-mini for intelligent conversation
- Context-aware responses using Slack message history
- Automatic status updates during processing

### 2. Knowledge Base Search
- Searches internal documents stored in Google Drive
- Automatic document processing and chunking
- Vector similarity search using Pinecone
- Supports PDFs and Google Docs

### 3. Promotional Product Search
- Integration with Sage Connect API
- Product search, details, and inventory checking
- Category and theme exploration

### 4. Web Search
- Real-time web search using Exa API
- Current events and news lookup
- Domain-specific search capabilities

### 5. Slack Integration
- App mentions and direct messages
- Thread and channel message context
- Chat title updates
- Status indicators

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

1. **Web Search Tool** - Search current web information
2. **Knowledge Search Tool** - Query internal knowledge base
3. **Sage Connect Tools** - Product catalog operations
4. **Slack Context Tools** - Retrieve message history
5. **Status Tools** - Update agent status and chat titles

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

**Current Deployment URL**: `https://dgw-slack-vercel-agent-q1d9r6w6f-jordans-projects-608b7fba.vercel.app`
**Slack Webhook**: `https://dgw-slack-vercel-agent-q1d9r6w6f-jordans-projects-608b7fba.vercel.app/api/slack-verify`

Last Updated: August 29, 2025
Version: 1.0.0