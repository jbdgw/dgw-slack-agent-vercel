export default defineEventHandler(async (event) => {
  try {
    // Handle Slack URL verification challenge BEFORE any authentication
    const body = await readBody(event);
    console.log('Received request body:', JSON.stringify(body));
    
    if (body && body.type === 'url_verification' && body.challenge) {
      console.log('Handling URL verification challenge:', body.challenge);
      // Set proper headers and return plain text challenge
      setResponseHeader(event, 'Content-Type', 'text/plain');
      setResponseStatus(event, 200);
      return body.challenge;
    }
    
    // Lazy load dependencies to avoid circular dependencies
    const { createHandler } = await import('@vercel/slack-bolt');
    const { app, receiver } = await import('../app');
    
    // Only create handler after challenge check
    const handler = createHandler(app, receiver);
    
    // Initialize app if needed
    try {
      await app.init();
    } catch (error) {
      // App might already be initialized
      console.debug('App init called (may already be initialized):', error.message);
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