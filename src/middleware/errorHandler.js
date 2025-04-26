const logger = require('../utils/logger');
const multer = require('multer');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Handle Multer errors specifically
  if (err instanceof multer.MulterError) {
    logger.error('Multer upload error', {
      code: err.code,
      field: err.field,
      message: err.message,
      stack: err.stack
    });

    let message = 'File upload error';
    
    // Provide more specific messages based on error code
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File is too large. Maximum size is 5MB';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = `Unexpected field name: ${err.field}. Expected 'cv'`;
        break;
      default:
        message = err.message;
    }

    return res.status(400).json({
      success: false,
      error: message
    });
  }

  // Log the error
  logger.error('API Error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Set status code
  const statusCode = err.statusCode || 500;

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error' : err.message
  });
};

module.exports = errorHandler;
