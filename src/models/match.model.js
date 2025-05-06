const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  cvId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CVData',
    required: true
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  details: {
    skills: {
      score: Number,
      analysis: String
    },
    experience: {
      score: Number,
      analysis: String
    },
    education: {
      score: Number,
      analysis: String
    },
    overall: {
      score: Number,
      analysis: String
    }
  },
  recommendations: [String],
  // Invalidate cache when CV or job is updated
  cvVersion: {
    type: Date, // Using the CV updatedAt timestamp
    required: true
  },
  jobVersion: {
    type: Date, // Using the Job updatedAt timestamp
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // How long the match is valid in seconds (default: 7 days)
  cacheTime: {
    type: Number,
    default: 604800 // 7 days in seconds
  }
});

// Compound index for faster lookups
MatchSchema.index({ cvId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('Match', MatchSchema); 