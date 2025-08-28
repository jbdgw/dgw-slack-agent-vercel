import { createHandler } from "@vercel/slack-bolt";
import { app, receiver } from "../app";

const handler = createHandler(app, receiver);

export default defineEventHandler(async (event) => {
  try {
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
