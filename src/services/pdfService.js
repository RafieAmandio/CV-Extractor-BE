const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const logger = require('../utils/logger');

class PDFService {
  /**
   * Extract text from a PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<string>} - Extracted text
   */
  async extractText(filePath) {
    try {
      logger.info('Starting PDF text extraction', { filePath });
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('PDF file not found');
      }
      
      // Read the PDF file
      const dataBuffer = fs.readFileSync(filePath);
      
      // Parse the PDF content
      const data = await pdfParse(dataBuffer);
      
      logger.info('PDF text extraction completed', { 
        filePath, 
        pageCount: data.numpages 
      });
      
      return data.text;
    } catch (error) {
      logger.error('PDF text extraction failed', { 
        filePath, 
        error: error.message 
      });
      throw error;
    }
  }
}

module.exports = new PDFService();
