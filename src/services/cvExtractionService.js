const pdfService = require('./pdfService');
const openaiService = require('./openaiService');
const CVData = require('../models/cvData.model');
const logger = require('../utils/logger');

class CVExtractionService {
  /**
   * Process a CV file through the entire pipeline:
   * 1. Extract text from PDF
   * 2. Extract structured data using OpenAI
   * 3. Save to database
   * 
   * @param {string} filePath - Path to the CV file
   * @param {string} originalFilename - Original filename
   * @returns {Promise<Object>} - Extracted CV data
   */
  async processCVFile(filePath, originalFilename) {
    try {
      logger.info('Starting CV processing pipeline', { 
        filePath,
        filename: originalFilename
      });
      
      // Step 1: Extract text from PDF
      const extractedText = await pdfService.extractText(filePath);
      
      // Step 2: Extract structured data using OpenAI
      const structuredData = await openaiService.extractCVData(extractedText);
      
      // Step 3: Save to database
      const cvData = new CVData({
        fileName: originalFilename,
        ...structuredData,
        rawText: extractedText
      });
      
      await cvData.save();
      
      logger.info('CV processing completed successfully', { 
        id: cvData._id,
        filename: originalFilename
      });
      
      return cvData;
    } catch (error) {
      logger.error('CV processing failed', { 
        filePath,
        filename: originalFilename,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new CVExtractionService();
