// Simplified endpoint that handles both verification and actual Slack events
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  
  // Log for debugging
  console.log('Slack endpoint - received:', JSON.stringify(body));
  
  // Handle Slack URL verification challenge
  if (body?.type === 'url_verification' && body?.challenge) {
    console.log('Returning challenge:', body.challenge);
    // Return plain text response with the challenge value
    setResponseHeader(event, 'Content-Type', 'text/plain');
    return body.challenge;
  }
  
  // For actual Slack events, dynamically import and use the handler
  try {
    // Lazy load the handler to avoid circular dependencies
    const { createHandler } = await import('@vercel/slack-bolt');
    const { app, receiver } = await import('../app');
    
    const handler = createHandler(app, receiver);
    
    // Initialize app if needed
    try {
      await app.init();
    } catch (error) {
      // App might already be initialized
      console.debug('App init called (may already be initialized):', error.message);
    }
    
    // Convert to web request and handle with Slack Bolt
    const request = toWebRequest(event);
    return await handler(request);
  } catch (error) {
    console.error('Slack handler error:', error);
    // Return OK to acknowledge receipt even if there's an error
    // This prevents Slack from retrying
    return { ok: true };
  }
});