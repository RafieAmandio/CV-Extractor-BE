const express = require('express');
const router = express.Router();
const cvController = require('../controllers/cvController');
const upload = require('../middleware/upload');
const logger = require('../utils/logger');
const fs = require('fs');

/**
 * @route POST /api/cv/extract
 * @desc Extract data from a CV
 * @access Public
 */
router.post('/extract', upload.single('cv'), cvController.extractCV);

/**
 * @route GET /api/cv
 * @desc Get all CVs with pagination
 * @access Public
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Number of items per page (default: 10)
 * @query {string} search - Optional search term
 */
router.get('/', cvController.getAllCVs);

/**
 * @route GET /api/cv/:id
 * @desc Get a specific CV by ID
 * @access Public
 * @param {string} id - The CV document ID
 */
router.get('/:id', cvController.getCVById);

/**
 * @route POST /api/cv/test-upload
 * @desc Test route to debug file uploads
 * @access Public
 */
router.post('/test-upload', (req, res) => {
  // Log pre-upload details to see if request comes through correctly
  logger.info('Test upload received (before multer)', {
    contentType: req.headers['content-type'],
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    headers: req.headers
  });

  // Apply upload middleware
  upload.single('cv')(req, res, (err) => {
    if (err) {
      logger.error('Test upload error', { 
        error: err.message,
        code: err.code,
        field: err.field
      });
      return res.status(400).json({ 
        success: false, 
        message: err.message 
      });
    }

    // Log complete request details after multer processing
    logger.info('Test upload processed (after multer)', {
      file: req.file,
      body: req.body
    });

    // Return response for each possible case
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file received',
        requestData: {
          contentType: req.headers['content-type'],
          bodyFields: Object.keys(req.body || {})
        }
      });
    }

    // Prepare response with file info
    const responseData = {
      success: true,
      message: 'File uploaded successfully',
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    };

    // Send response
    res.status(200).json(responseData);

    // Delete the file after sending the response
    try {
      fs.unlinkSync(req.file.path);
      logger.info('Test upload file deleted successfully', { 
        path: req.file.path 
      });
    } catch (deleteError) {
      logger.warn('Failed to delete test upload file', { 
        path: req.file.path, 
        error: deleteError.message 
      });
    }
  });
});

module.exports = router;
