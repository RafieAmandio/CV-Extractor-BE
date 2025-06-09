const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const logger = require('../utils/logger');
const pdf2pic = require('pdf2pic');
const sharp = require('sharp');

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
        pageCount: data.numpages,
        textLength: data.text.length
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

  /**
   * Check if extracted text is sufficient (not empty/minimal)
   * @param {string} text - Extracted text
   * @returns {boolean} - Whether text is sufficient
   */
  isTextSufficient(text) {
    if (!text || text.trim().length === 0) {
      return false;
    }
    
    // Remove whitespace and check if we have meaningful content
    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    // Consider text insufficient if it's too short or contains mostly non-alphanumeric characters
    const alphanumericCount = (cleanText.match(/[a-zA-Z0-9]/g) || []).length;
    const isToShort = cleanText.length < 50;
    const hasLowAlphanumericRatio = alphanumericCount / cleanText.length < 0.3;
    
    logger.info('Text sufficiency check', {
      textLength: cleanText.length,
      alphanumericCount,
      alphanumericRatio: alphanumericCount / cleanText.length,
      isSufficient: !(isToShort || hasLowAlphanumericRatio)
    });
    
    return !(isToShort || hasLowAlphanumericRatio);
  }

  /**
   * Extract images from PDF file
   * @param {string} filePath - Path to the PDF file
   * @returns {Promise<Array<Buffer>>} - Array of image buffers
   */
  async extractImages(filePath) {
    try {
      logger.info('Starting PDF image extraction', { filePath });
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('PDF file not found');
      }

      // Create a temporary directory for images
      const tempDir = path.join(path.dirname(filePath), 'temp_images');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Configure pdf2pic
      const convert = pdf2pic.fromPath(filePath, {
        density: 200,           // Higher density for better quality
        saveFilename: "page",
        savePath: tempDir,
        format: "png",
        width: 2000,           // Max width for good quality
        height: 2000           // Max height for good quality
      });

      // Convert PDF pages to images
      const results = await convert.bulk(-1, { responseType: "buffer" });
      
      logger.info('PDF image extraction completed', { 
        filePath,
        pageCount: results.length
      });

      // Process images with sharp for optimization
      const imageBuffers = [];
      for (const result of results) {
        try {
          // Optimize image: resize if too large, compress
          const optimizedBuffer = await sharp(result.buffer)
            .resize(1500, 1500, { 
              fit: 'inside', 
              withoutEnlargement: true 
            })
            .png({ quality: 90, compressionLevel: 6 })
            .toBuffer();
            
          imageBuffers.push(optimizedBuffer);
          
          logger.info('Image optimized', {
            originalSize: result.buffer.length,
            optimizedSize: optimizedBuffer.length,
            compressionRatio: Math.round((1 - optimizedBuffer.length / result.buffer.length) * 100)
          });
        } catch (optimizationError) {
          logger.warn('Image optimization failed, using original', {
            error: optimizationError.message
          });
          imageBuffers.push(result.buffer);
        }
      }

      // Clean up temporary directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        logger.info('Temporary image directory cleaned up', { tempDir });
      } catch (cleanupError) {
        logger.warn('Failed to clean up temporary directory', {
          tempDir,
          error: cleanupError.message
        });
      }

      return imageBuffers;
    } catch (error) {
      logger.error('PDF image extraction failed', { 
        filePath, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Convert image buffer to base64 string for OpenAI Vision API
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {string} - Base64 encoded image
   */
  imageBufferToBase64(imageBuffer) {
    return imageBuffer.toString('base64');
  }

  /**
   * Get image data URL for OpenAI Vision API
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} mimeType - MIME type (default: image/png)
   * @returns {string} - Data URL
   */
  getImageDataUrl(imageBuffer, mimeType = 'image/png') {
    const base64 = this.imageBufferToBase64(imageBuffer);
    return `data:${mimeType};base64,${base64}`;
  }
}

module.exports = new PDFService();
