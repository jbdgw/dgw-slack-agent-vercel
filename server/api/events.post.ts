import { createHandler } from "@vercel/slack-bolt";
import { app, receiver } from "../app";

export default defineEventHandler(async (event) => {
  try {
    // Handle Slack URL verification challenge BEFORE any authentication
    const body = await readBody(event);
    console.log('Received request body:', JSON.stringify(body));
    
    if (body && body.type === 'url_verification' && body.challenge) {
      console.log('Handling URL verification challenge:', body.challenge);
      // Return the challenge directly without going through Slack Bolt
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Only create handler after challenge check
    const handler = createHandler(app, receiver);
    
    // Ensure the app is initialized before handling requests
    if (!app.initialized) {
      await app.init();
    }
    
    // In v3 of Nitro, we will be able to use the request object directly
    const request = toWebRequest(event);
    return await handler(request);
  } catch (error) {
    console.error('Slack handler error:', error);
    console.error('Error details:', error);
    throw error;
  }
});
