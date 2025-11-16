export const config = {
  port: process.env.PORT || 3001,
  mcpMode: process.env.MCP_MODE === 'true',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID || '',
    clientSecret: process.env.REDDIT_CLIENT_SECRET || ''
  }
};
