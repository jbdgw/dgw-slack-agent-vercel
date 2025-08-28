import { createHandler } from "@vercel/slack-bolt";
import { app, receiver } from "../app";

const handler = createHandler(app, receiver);

export default defineEventHandler(async (event) => {
  try {
    // Handle Slack URL verification challenge directly
    const body = await readBody(event);
    if (body && body.type === 'url_verification' && body.challenge) {
      console.log('Handling URL verification challenge:', body.challenge);
      return { challenge: body.challenge };
    }
    
    // Ensure the app is initialized before handling requests
    if (!app.initialized) {
      await app.init();
    }
    
    // In v3 of Nitro, we will be able to use the request object directly
    const request = toWebRequest(event);
    return await handler(request);
  } catch (error) {
    console.error('Slack handler error:', error);
    throw error;
  }
});
