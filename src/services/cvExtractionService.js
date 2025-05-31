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
   * 3. Generate embeddings
   * 4. Save to database
   * 5. Delete the file to save storage space
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
      
      // Step 3: Create CV document
      const cvData = new CVData({
        fileName: originalFilename,
        ...structuredData,
        rawText: extractedText
      });
      
      // Step 4: Generate embedding
      const searchableText = cvData.generateSearchableText();
      const embedding = await openaiService.getEmbeddings(searchableText);
      cvData.embedding = embedding;
      
      // Step 5: Save to database
      await cvData.save();
      
      // Step 6: Delete the file to save storage space
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

  /**
   * Update embeddings for all CVs that don't have them
   * @returns {Promise<void>}
   */
  async updateAllEmbeddings() {
    try {
      logger.info('Starting embedding update for all CVs');
      
      const cvs = await CVData.find({ embedding: { $exists: false } });
      logger.info(`Found ${cvs.length} CVs without embeddings`);

      for (const cv of cvs) {
        try {
          const searchableText = cv.generateSearchableText();
          const embedding = await openaiService.getEmbeddings(searchableText);
          
          cv.embedding = embedding;
          await cv.save();
          
          logger.info('Updated embedding for CV', { 
            id: cv._id,
            filename: cv.fileName
          });
        } catch (error) {
          logger.error('Failed to update embedding for CV', {
            id: cv._id,
            error: error.message
          });
        }
      }
      
      logger.info('Completed embedding update');
    } catch (error) {
      logger.error('Failed to update embeddings', { error: error.message });
      throw error;
    }
  }
}

module.exports = new CVExtractionService();
