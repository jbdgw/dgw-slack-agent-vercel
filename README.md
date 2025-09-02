# Slack Agent - AI-Powered Bot

A comprehensive Slack bot built with Nitro, featuring AI-powered responses with persistent memory, knowledge base search, promotional product lookup, image vectorization, and real-time web search capabilities.

## 🚀 Features

- **🤖 AI-Powered Responses** - Intelligent conversation using OpenAI GPT-4o with persistent memory
- **🧠 Persistent Memory** - Remembers user preferences, conversations, and context across sessions using Mem0 AI
- **🔍 Web Search** - Real-time information retrieval via Exa API
- **📚 Knowledge Base** - Document search from Google Drive using vector similarity (Pinecone)
- **🛍️ Product Search** - Promotional product lookup via Sage Connect API
- **🎨 Image Vectorization** - Convert bitmap images to vector graphics (SVG, PDF, PNG) using Vectorizer.ai
- **💬 Slack Integration** - Full context awareness with thread/channel message history
- **🔧 Tool Orchestration** - Intelligent tool selection based on user queries

## 🛠️ Tech Stack

- **Framework**: Nitro (Universal JavaScript Server)
- **Language**: TypeScript 5+
- **AI**: Vercel AI SDK + OpenAI GPT-4o
- **Memory**: Mem0 AI for persistent conversation memory
- **Slack**: @slack/bolt + @vercel/slack-bolt
- **Vector DB**: Pinecone
- **Storage**: Google Drive
- **Search**: Exa API
- **Product API**: Sage Connect
- **Image Processing**: Vectorizer.ai API
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 22+
- Slack workspace with app installation permissions
- OpenAI API key
- (Optional) Google Drive access for knowledge base
- (Optional) Pinecone account for vector search
- (Optional) Exa API key for web search
- (Optional) Sage Connect API credentials for product search
- (Optional) Vectorizer.ai API credentials for image vectorization
- (Optional) Mem0 API key for persistent memory features

## ⚡ Quick Start

### 1. Installation

```bash
# Clone and install
npm install

# Configure (optional guided setup)
npm run configure
```

### 2. Environment Setup

Create a `.env` file:

```env
# Required - Slack Configuration
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token

# Required - AI Configuration  
OPENAI_API_KEY=sk-your-openai-key

# Optional - Knowledge Base
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=your_private_key

# Optional - Vector Search
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=slack-agent
PINECONE_ENVIRONMENT=us-east-1

# Optional - Web Search
EXA_API_KEY=your_exa_api_key

# Optional - Product Search
SAGE_ACCOUNT_ID=your_account_id
SAGE_LOGIN_ID=your_login_id
SAGE_API_KEY=your_sage_api_key
SAGE_API_URL=https://www.promoplace.com/ws/ws.dll/ConnectAPI
SAGE_API_VERSION=130

# Optional - Memory System
MEM0_API_KEY=your_mem0_api_key
```

### 3. Slack App Setup

1. Create app at [api.slack.com/apps](https://api.slack.com/apps)
2. Use the provided [manifest.json](./manifest.json) or configure manually:
   - **OAuth Scopes**: `app_mentions:read`, `chat:write`, `channels:history`, `groups:history`, `im:history`, `mpim:history`
   - **Event Subscriptions**: `app_mention`, `message.channels`, `message.groups`, `message.im`, `message.mpim`
3. Install to workspace and get bot token

### 4. Development

```bash
# Local development
npm run dev

# With tunneling for Slack testing
npm run dev:tunnel
```

### 5. Deployment

```bash
# Deploy to Vercel
vercel --prod

# Update Slack webhook URL to: https://your-app.vercel.app/api/slack-verify
```

## 🎯 Usage Examples

### Basic Queries
- `@bot What's the weather like today?` (web search)
- `@bot Tell me about our vacation policy` (knowledge base)
- `@bot Find promotional water bottles` (product search)
- `@bot Remember that I prefer brief responses` (memory storage)
- `@bot What do you remember about me?` (memory retrieval)

### Advanced Features
- **Context Awareness**: Bot reads thread/channel history for context
- **Persistent Memory**: Learns and remembers user preferences across conversations
- **Smart Tool Selection**: Automatically chooses the right tool for each query
- **Status Updates**: Shows what the bot is doing in real-time
- **Error Handling**: Graceful fallbacks for all operations

## 📁 Project Structure

```
├── server/                     # Nitro server
│   ├── api/                   # API endpoints
│   │   ├── events.post.ts     # Alternative Slack handler
│   │   └── slack-verify.post.ts # Main Slack webhook (recommended)
│   ├── app.ts                 # Slack Bolt app configuration
│   ├── lib/                   # Core business logic
│   │   ├── ai/                # AI functionality
│   │   │   ├── respond-to-message.ts # Main response handler
│   │   │   └── tools/         # AI tools (web search, knowledge, etc.)
│   │   ├── integrations/      # External service integrations
│   │   └── slack/             # Slack utilities
│   └── listeners/             # Slack event listeners
├── scripts/                   # Development utilities
├── .env                      # Environment variables
├── manifest.json             # Slack app manifest
├── package.json              # Dependencies
└── README.md                 # This file
```

## 🔧 Development Commands

```bash
# Development
npm run dev                    # Start dev server
npm run dev:tunnel            # Start with ngrok tunneling
npm run build                 # Build for production
npm run preview               # Preview production build

# Maintenance
npm run lint                  # Run linter
npm run lint:fix              # Fix lint issues
npm run configure             # Interactive setup wizard

# Deployment
vercel                        # Deploy to Vercel
vercel --prod                 # Deploy to production
vercel logs                   # View deployment logs
```

## 🚨 Troubleshooting

### Slack Verification Issues
- Ensure webhook URL ends with `/api/slack-verify`
- Check environment variables are set in deployment
- Verify no circular dependency errors in logs

### Bot Not Responding
- Check OpenAI API key validity and credits
- Review Vercel deployment logs
- Verify bot permissions in Slack workspace

### Knowledge Search Not Working
- Confirm Google Service Account has Drive access
- Check Pinecone index exists and is accessible
- Try refreshing knowledge base

### Product Search Issues
- Verify Sage Connect API credentials
- Check API endpoint URL and version
- Review rate limits and quotas

### Memory System Issues
- Check Mem0 API key in environment variables
- Verify API key permissions at [app.mem0.ai](https://app.mem0.ai)
- Test memory with: `@bot Remember that I like coffee`
- Memory gracefully degrades when API unavailable

## 📚 Documentation

- [CLAUDE.md](./claude.md) - Detailed technical documentation
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Comprehensive setup instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details

---

**Current Status**: ✅ Production Ready with Persistent Memory  
**Deployment**: Vercel  
**Last Updated**: September 2, 2025  
**Version**: 1.2.0 - Added Mem0 memory integration