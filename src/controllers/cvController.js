const cvExtractionService = require('../services/cvExtractionService');
const logger = require('../utils/logger');
const CVData = require('../models/cvData.model');

/**
 * Controller for CV extraction endpoints
 */
class CVController {
  /**
   * Extract data from a CV file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async extractCV(req, res, next) {
    try {
      // Debug: Log detailed request information
      logger.info('Raw request details', {
        headers: req.headers,
        body: req.body,
        file: req.file,
        files: req.files,
        contentType: req.headers['content-type'],
        method: req.method,
        url: req.url
      });

      // Check if file was uploaded
      if (!req.file) {
        logger.warn('CV extraction request missing file');
        return res.status(400).json({ 
          success: false, 
          message: 'Please upload a PDF file' 
        });
      }

      const filePath = req.file.path;
      const originalFilename = req.file.originalname;

      logger.info('CV extraction request received', { 
        filename: originalFilename,
        fileSize: req.file.size
      });

      // Process the CV file
      const result = await cvExtractionService.processCVFile(
        filePath, 
        originalFilename
      );

      // Return the extracted data
      res.status(200).json({
        success: true,
        message: 'CV data extracted successfully',
        data: result
      });
    } catch (error) {
      logger.error('Error in CV extraction controller', { 
        error: error.message 
      });
      next(error);
    }
  }

  /**
   * Get all CVs with pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAllCVs(req, res, next) {
    try {
      // Get pagination parameters from query string
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Get search query if provided
      const searchQuery = req.query.search || '';
      
      // Build query object
      let query = {};
      
      // Add search functionality if search term is provided
      if (searchQuery) {
        query = {
          $or: [
            { 'personalInfo.name': { $regex: searchQuery, $options: 'i' } },
            { 'personalInfo.email': { $regex: searchQuery, $options: 'i' } },
            { fileName: { $regex: searchQuery, $options: 'i' } }
          ]
        };
      }

      // Get total count for pagination
      const total = await CVData.countDocuments(query);
      
      // Fetch CVs with pagination
      const cvs = await CVData.find(query)
        .select('-rawText') // Exclude the raw text to reduce response size
        .sort({ extractedAt: -1 }) // Sort by extraction date, newest first
        .skip(skip)
        .limit(limit);
      
      // Calculate pagination details
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      logger.info('CVs retrieved successfully', { 
        page, 
        limit, 
        total,
        query: searchQuery ? searchQuery : 'none'
      });

      // Return the paginated results
      res.status(200).json({
        success: true,
        message: 'CVs retrieved successfully',
        data: {
          cvs,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNext,
            hasPrev
          }
        }
      });
    } catch (error) {
      logger.error('Error retrieving CVs', { 
        error: error.message 
      });
      next(error);
    }
  }

  /**
   * Get a specific CV by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getCVById(req, res, next) {
    try {
      const { id } = req.params;
      
      // Find CV by ID, excluding the rawText field
      const cv = await CVData.findById(id).select('-rawText');
      
      // Check if CV exists
      if (!cv) {
        logger.warn('CV not found', { id });
        return res.status(404).json({ 
          success: false, 
          message: 'CV not found' 
        });
      }
      
      logger.info('CV retrieved successfully', { id });
      
      // Return the CV data
      res.status(200).json({
        success: true,
        message: 'CV retrieved successfully',
        data: cv
      });
    } catch (error) {
      logger.error('Error retrieving CV', { 
        id: req.params.id,
        error: error.message 
      });
      next(error);
    }
  }
}

module.exports = new CVController();
