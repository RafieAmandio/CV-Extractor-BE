const openaiService = require('../services/openaiService');
const logger = require('../utils/logger');
const CVData = require('../models/cvData.model');
const Job = require('../models/job.model');
const Match = require('../models/match.model');
const ChatHistory = require('../models/chatHistory.model');

class ChatController {
  /**
   * Handle chat messages and process them using OpenAI
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async chat(req, res, next) {
    try {
      const { message, cvId } = req.body;

      if (!message) {
        return res.status(400).json({
          success: false,
          message: 'Message is required'
        });
      }

      // Get CV data if cvId is provided
      let cvData = null;
      if (cvId) {
        cvData = await CVData.findById(cvId).select('-rawText');
        if (!cvData) {
          return res.status(404).json({
            success: false,
            message: 'CV not found'
          });
        }
      }

      // Get recent chat history
      const chatHistory = await ChatHistory.find({
        ...(cvId ? { cvId } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      // Process the chat message with history
      const response = await openaiService.processChatMessage(message, cvData, chatHistory);

      // Store chat history
      const chatHistoryEntry = new ChatHistory({
        message,
        response: response.response,
        cvId: cvId || null,
        functionCalls: response.functionResult ? [{
          name: response.functionResult.name,
          arguments: response.functionResult.arguments,
          result: response.functionResult.result
        }] : []
      });

      await chatHistoryEntry.save();

      logger.info('Chat message processed and stored successfully', {
        messageLength: message.length,
        hasCvData: !!cvData,
        historyId: chatHistoryEntry._id,
        historyLength: chatHistory.length
      });

      res.status(200).json({
        success: true,
        message: 'Chat processed successfully',
        data: response
      });
    } catch (error) {
      logger.error('Error processing chat message', {
        error: error.message
      });
      next(error);
    }
  }

  /**
   * Get chat history with pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getChatHistory(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Optional filters
      const cvId = req.query.cvId;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;

      // Build query
      const query = {};
      if (cvId) query.cvId = cvId;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Get total count for pagination
      const total = await ChatHistory.countDocuments(query);

      // Fetch chat history with pagination
      const history = await ChatHistory.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('cvId', 'fileName personalInfo.name');

      // Calculate pagination details
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      logger.info('Chat history retrieved successfully', {
        page,
        limit,
        total,
        filters: { cvId, startDate, endDate }
      });

      res.status(200).json({
        success: true,
        message: 'Chat history retrieved successfully',
        data: {
          history,
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
      logger.error('Error retrieving chat history', {
        error: error.message
      });
      next(error);
    }
  }
}

module.exports = new ChatController(); 