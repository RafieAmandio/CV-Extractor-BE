const pdfService = require('./pdfService');
const openaiService = require('./openaiService');
const CVData = require('../models/cvData.model');
const logger = require('../utils/logger');
const fs = require('fs');

class CVExtractionService {
  /**
   * Process a CV file through the entire pipeline:
   * 1. Extract text from PDF
   * 2. If text is insufficient, extract images and use vision
   * 3. Extract structured data using OpenAI
   * 4. Generate embeddings
   * 5. Save to database
   * 6. Delete the file to save storage space
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
      
      let structuredData;
      let extractionMethod = 'text';
      
      // Step 2: Check if text extraction was sufficient
      if (pdfService.isTextSufficient(extractedText)) {
        logger.info('Text extraction sufficient, using text-based processing', {
          textLength: extractedText.length
        });
        
        // Use text-based extraction
        structuredData = await openaiService.extractCVData(extractedText);
      } else {
        logger.info('Text extraction insufficient, falling back to vision-based processing', {
          textLength: extractedText.length
        });
        
        try {
          // Extract images from PDF
          const imageBuffers = await pdfService.extractImages(filePath);
          
          if (imageBuffers.length === 0) {
            throw new Error('No images could be extracted from PDF');
          }
          
          logger.info('Images extracted successfully, processing with vision model', {
            imageCount: imageBuffers.length
          });
          
          // Use vision-based extraction
          structuredData = await openaiService.extractCVDataFromImages(imageBuffers);
          extractionMethod = 'vision';
          
        } catch (visionError) {
          logger.error('Vision-based extraction failed, falling back to text', {
            error: visionError.message
          });
          
          // Fallback to text extraction even if insufficient
          if (extractedText && extractedText.trim().length > 0) {
            structuredData = await openaiService.extractCVData(extractedText);
            extractionMethod = 'text_fallback';
          } else {
            throw new Error('Both text and vision extraction failed');
          }
        }
      }
      
      // Step 3: Create CV document
      const cvData = new CVData({
        fileName: originalFilename,
        ...structuredData,
        rawText: extractedText,
        extractionMethod // Add metadata about extraction method used
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
        filename: originalFilename,
        extractionMethod,
        textLength: extractedText.length
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
