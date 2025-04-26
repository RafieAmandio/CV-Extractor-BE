const mongoose = require('mongoose');
const config = require('../config/default');
const logger = require('./logger');

const connectDB = async () => {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { error });
    process.exit(1);
  }
};

module.exports = connectDB;
