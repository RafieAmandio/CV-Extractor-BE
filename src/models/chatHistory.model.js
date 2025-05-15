const mongoose = require('mongoose');

const ChatHistorySchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  response: {
    type: String,
    required: true
  },
  cvId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CVData',
    default: null
  },
  functionCalls: [{
    name: String,
    arguments: mongoose.Schema.Types.Mixed,
    result: mongoose.Schema.Types.Mixed
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
ChatHistorySchema.index({ createdAt: -1 });
ChatHistorySchema.index({ cvId: 1 });

module.exports = mongoose.model('ChatHistory', ChatHistorySchema); 