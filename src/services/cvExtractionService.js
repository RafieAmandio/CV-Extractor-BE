const pdfService = require('./pdfService');
const openaiService = require('./openaiService');
const CVData = require('../models/cvData.model');
const logger = require('../utils/logger');
const fs = require('fs');

class CVExtractionService {
  /**
   * Process a CV file through the entire pipeline:
   * 1. Extract text from PDF
   * 2. Extract structured data using OpenAI
   * 3. Save to database
   * 4. Delete the file to save storage space
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
      
      // Step 4: Delete the file to save storage space
      try {
        await fs.promises.unlink(filePath);
        logger.info('CV file deleted successfully', { filePath });
      } catch (deleteError) {
        logger.warn('Failed to delete CV file', { 
          filePath, 
          error: deleteError.message 
        });
        // We don't throw here to not fail the whole process if deletion fails
      }
      
      logger.info('CV processing completed successfully', { 
        id: cvData._id,
        filename: originalFilename
      });
      
      return cvData;
    } catch (error) {
      // Try to delete the file even if processing failed
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          logger.info('CV file deleted after processing error', { filePath });
        }
      } catch (deleteError) {
        logger.warn('Failed to delete CV file after error', { 
          filePath, 
          error: deleteError.message 
        });
      }
      
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
