# CLAUDE.md - Next.js + Vercel AI SDK + Anthropic Claude

## Project Overview

This is a Next.js application using the App Router with Anthropic's Claude models integrated via the Vercel AI SDK. The project leverages TypeScript for type safety and implements AI-powered features with streaming capabilities.

## Tech Stack

- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript 5+
- **AI Integration**: Vercel AI SDK (@ai-sdk/anthropic)
- **Models**: Claude 4 Opus/Sonnet, Claude 3.7 Sonnet, Claude 3.5 Sonnet
- **Styling**: Tailwind CSS
- **Package Manager**: pnpm (preferred) or npm
- **Deployment**: Vercel

## Project Structure

```
.
├── app/                        # Next.js App Router structure
│   ├── api/                   # API routes
│   │   ├── chat/              # Chat endpoint
│   │   │   └── route.ts       # Main chat handler
│   │   ├── completion/        # Text completion endpoint
│   │   │   └── route.ts       
│   │   └── generate/          # Object generation endpoint
│   │       └── route.ts       
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Homepage
│   └── globals.css            # Global styles
├── components/                 # React components
│   ├── ui/                    # UI components
│   │   ├── chat.tsx          # Chat interface
│   │   ├── message.tsx       # Message component
│   │   └── input.tsx         # Input components
│   └── providers/            # Context providers
├── lib/                       # Utility functions
│   ├── ai/                   # AI-related utilities
│   │   ├── models.ts         # Model configurations
│   │   └── prompts.ts        # Prompt templates
│   └── utils.ts              # General utilities
├── hooks/                     # Custom React hooks
│   └── use-chat-enhanced.ts  # Enhanced chat hook
├── types/                     # TypeScript type definitions
│   └── ai.ts                 # AI-related types
├── .env.local                # Environment variables
├── next.config.js            # Next.js configuration
├── tailwind.config.ts        # Tailwind configuration
└── tsconfig.json             # TypeScript configuration
```

## Setup Instructions

### 1. Installation

```bash
# Create new Next.js app (if starting fresh)
pnpm create next-app@latest my-ai-app --typescript --tailwind --app

# Install Vercel AI SDK and Anthropic provider
pnpm add ai @ai-sdk/anthropic @ai-sdk/react

# Install additional dependencies (optional)
pnpm add zod # for structured output validation
pnpm add react-markdown remark-gfm # for markdown rendering
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# Required
ANTHROPIC_API_KEY=your_api_key_here

# Optional - for specific configurations
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
```

### 3. Model Configuration

Available Claude models:
- `claude-4-opus-20250514` - Most powerful, best for complex tasks
- `claude-4-sonnet-20250514` - Balanced performance and cost
- `claude-3-7-sonnet-20250219` - Extended reasoning capabilities
- `claude-3-5-sonnet-20241022` - Good balance, supports PDFs
- `claude-3-5-sonnet-20240620` - Previous generation
- `claude-3-5-haiku-20241022` - Fastest, most cost-effective

## Implementation Examples

### Basic Chat Route Handler

```typescript
// app/api/chat/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages: convertToModelMessages(messages),
    system: 'You are a helpful AI assistant.',
    temperature: 0.7,
    maxTokens: 2000,
  });

  return result.toUIMessageStreamResponse();
}
```

### Advanced Features

#### With Reasoning (Claude 4)

```typescript
// app/api/chat/route.ts
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic('claude-4-opus-20250514'),
    messages: convertToModelMessages(messages),
    headers: {
      'anthropic-beta': 'interleaved-thinking-2025-05-14',
    },
    providerOptions: {
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 15000 },
      } satisfies AnthropicProviderOptions,
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
```

#### With Tools

```typescript
// app/api/chat/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, tool } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages: convertToModelMessages(messages),
    tools: {
      getWeather: tool({
        description: 'Get current weather for a location',
        parameters: z.object({
          location: z.string().describe('City name'),
        }),
        execute: async ({ location }) => {
          // Implement weather API call
          return { temperature: 72, condition: 'sunny' };
        },
      }),
    },
    stopWhen: ({ steps }) => steps.length >= 5, // Multi-step tool calls
  });

  return result.toUIMessageStreamResponse();
}
```

#### Structured Output

```typescript
// app/api/generate/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

const schema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
});

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = await generateObject({
    model: anthropic('claude-3-5-sonnet-20241022'),
    schema,
    prompt,
  });

  return Response.json(result.object);
}
```

### Client-Side Integration

```tsx
// app/page.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
  });

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${
              message.role === 'user' 
                ? 'bg-blue-100 ml-auto max-w-2xl' 
                : 'bg-gray-100 mr-auto max-w-2xl'
            }`}
          >
            <p className="font-semibold">
              {message.role === 'user' ? 'You' : 'Claude'}
            </p>
            <p className="mt-1">{message.content}</p>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask Claude something..."
          className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
```

## Best Practices

### 1. Error Handling

Always implement proper error handling:

```typescript
try {
  const result = await streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
  });
  return result.toUIMessageStreamResponse();
} catch (error) {
  console.error('AI request failed:', error);
  return new Response('Failed to process request', { status: 500 });
}
```

### 2. Rate Limiting

Implement rate limiting for production:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});
```

### 3. Prompt Engineering

- Be explicit and clear in instructions
- Provide context and examples when needed
- Use system messages for consistent behavior
- Test prompts thoroughly before production

### 4. Performance Optimization

- Use streaming for better UX
- Implement caching for repeated queries
- Choose appropriate model based on task complexity
- Set reasonable `maxTokens` limits

### 5. Security

- Never expose API keys in client-side code
- Validate and sanitize all user inputs
- Implement authentication for production apps
- Use environment variables for sensitive data

## Common Patterns

### Conversation Memory

```typescript
// Maintain conversation context across sessions
const conversationHistory = await getConversationFromDB(userId);
const messages = [...conversationHistory, newMessage];
```

### Streaming with Progress

```typescript
const result = streamText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  messages,
  onChunk: ({ chunk }) => {
    // Handle streaming chunks for progress
    console.log('Received chunk:', chunk);
  },
  onFinish: ({ text, usage }) => {
    // Log usage for monitoring
    console.log('Tokens used:', usage);
  },
});
```

### Multi-Modal Input (Images/PDFs)

```typescript
// For models that support it (e.g., claude-3-5-sonnet-20241022)
const result = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this document' },
        {
          type: 'file',
          data: fs.readFileSync('./document.pdf'),
          mimeType: 'application/pdf',
        },
      ],
    },
  ],
});
```

## Deployment Checklist

- [ ] Environment variables configured in Vercel
- [ ] API routes properly secured
- [ ] Rate limiting implemented
- [ ] Error boundaries added
- [ ] Loading states implemented
- [ ] Accessibility features added
- [ ] Mobile responsiveness tested
- [ ] Performance optimized
- [ ] Monitoring/logging setup
- [ ] Cost controls in place

## Troubleshooting

### Common Issues

1. **Timeout errors on Vercel**
   - Increase function timeout in `vercel.json`
   - Use streaming responses
   - Consider edge functions for longer operations

2. **API key not working**
   - Verify key is correct in `.env.local`
   - Check API key permissions
   - Ensure no extra whitespace

3. **Streaming not working**
   - Verify client supports streaming
   - Check response headers
   - Use proper streaming utilities from AI SDK

## Resources

- [Vercel AI SDK Documentation](https://ai-sdk.dev)
- [Anthropic API Documentation](https://docs.anthropic.com)
- [Next.js App Router Guide](https://nextjs.org/docs/app)
- [AI SDK Examples](https://ai-sdk.dev/examples)
- [Claude Model Comparison](https://docs.anthropic.com/en/docs/about-claude/models)

## Quick Commands

```bash
# Development
pnpm dev                 # Start dev server
pnpm build              # Build for production
pnpm lint               # Run linter
pnpm type-check         # Check TypeScript

# Testing
pnpm test               # Run tests
pnpm test:watch         # Watch mode

# Deployment
vercel                  # Deploy to Vercel
vercel --prod          # Deploy to production
```

## Notes for AI Assistants

When working on this project:
1. Always use TypeScript with proper types
2. Follow Next.js App Router conventions
3. Implement streaming for better UX
4. Handle errors gracefully
5. Consider cost implications of model choices
6. Test thoroughly before suggesting changes
7. Prioritize security and performance
8. Document all API endpoints
9. Use environment variables for configuration
10. Follow the established project structure

---

Last Updated: 2025
Version: 1.0.0