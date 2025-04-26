module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o'
  },
  mongodb: {
    uri: process.env.MONGODB_URI
  },
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    directory: 'logs'
  }
};
