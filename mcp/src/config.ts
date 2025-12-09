export const config = {
  port: process.env.PORT || 3001,
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_KEY || '',
  openaiApiKey: process.env.OPENAI_KEY || '',
  serperApiKey: process.env.SERPER_API_KEY || ''
};
