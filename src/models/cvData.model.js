const mongoose = require('mongoose');

const EducationSchema = new mongoose.Schema({
  institution: String,
  degree: String,
  field: String,
  startDate: String,
  endDate: String,
  gpa: String,
  description: String
});

const ExperienceSchema = new mongoose.Schema({
  company: String,
  position: String,
  startDate: String,
  endDate: String,
  location: String,
  description: String,
  achievements: [String]
});

const SkillSchema = new mongoose.Schema({
  category: String,
  skills: [String]
});

const CertificationSchema = new mongoose.Schema({
  name: String,
  issuer: String,
  date: String,
  expires: Boolean,
  expirationDate: String
});

const CVDataSchema = new mongoose.Schema({
  fileName: String,
  extractedAt: {
    type: Date,
    default: Date.now
  },
  personalInfo: {
    name: String,
    email: String,
    phone: String,
    location: String,
    linkedin: String, 
    website: String,
    summary: String
  },
  education: [EducationSchema],
  experience: [ExperienceSchema],
  skills: [SkillSchema],
  certifications: [CertificationSchema],
  languages: [{ 
    language: String, 
    proficiency: String 
  }],
  projects: [{
    name: String,
    description: String,
    startDate: String,
    endDate: String,
    technologies: [String],
    url: String
  }],
  publications: [{
    title: String,
    publisher: String,
    date: String,
    authors: [String],
    url: String
  }],
  awards: [{
    title: String,
    issuer: String,
    date: String,
    description: String
  }],
  references: [{
    name: String,
    position: String,
    company: String,
    contact: String,
    relationship: String
  }],
  rawText: String
});

module.exports = mongoose.model('CVData', CVDataSchema);
