const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: {
    type: [String],
    default: []
  },
  skills: {
    type: [String],
    default: []
  },
  responsibilities: {
    type: [String],
    default: []
  },
  location: {
    type: String,
    trim: true
  },
  salary: {
    type: String,
    trim: true
  },
  jobType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'],
    default: 'Full-time'
  },
  industry: {
    type: String,
    trim: true
  },
  experienceLevel: {
    type: String,
    enum: ['Entry-level', 'Mid-level', 'Senior', 'Executive'],
    default: 'Mid-level'
  },
  educationLevel: {
    type: String,
    enum: ['High School', 'Associate', 'Bachelor', 'Master', 'PhD', 'Not Specified'],
    default: 'Not Specified'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  active: {
    type: Boolean,
    default: true
  },
  rawDescription: {
    type: String
  }
});

// Index for text search
JobSchema.index({
  title: 'text',
  company: 'text',
  description: 'text',
  requirements: 'text',
  skills: 'text',
  responsibilities: 'text'
});

module.exports = mongoose.model('Job', JobSchema); 