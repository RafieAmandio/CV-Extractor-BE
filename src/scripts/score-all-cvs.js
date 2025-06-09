#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import models and services
const CVData = require('../models/cvData.model');
const openaiService = require('../services/openaiService');
const logger = require('../utils/logger');
const config = require('../config/default');

class CVScoringService {
  constructor() {
    this.outputDir = path.join(__dirname, 'output');
    this.jobDefinitions = null;
    this.processedCVs = new Set(); // Track processed CVs to prevent duplicates
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
      // Connect to database
      await mongoose.connect(config.mongodb.uri);
      logger.info('Connected to MongoDB for CV scoring');

      // Create output directory
      await fs.mkdir(this.outputDir, { recursive: true });
      logger.info('Output directory created/verified');

      // Load job definitions
      const jobDefinitionsPath = path.join(__dirname, 'job-definitions.json');
      const jobData = await fs.readFile(jobDefinitionsPath, 'utf8');
      this.jobDefinitions = JSON.parse(jobData);
      logger.info('Job definitions loaded', { 
        jobCount: this.jobDefinitions.jobs.length 
      });

    } catch (error) {
      logger.error('Failed to initialize CV scoring service', { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get all unique CVs from database
   */
  async getAllCVs() {
    try {
      const cvs = await CVData.find({})
        .select('-rawText -embedding') // Exclude heavy fields for performance
        .lean();

      logger.info('CVs retrieved from database', { count: cvs.length });
      return cvs;
    } catch (error) {
      logger.error('Failed to retrieve CVs', { error: error.message });
      throw error;
    }
  }

  /**
   * Process CVs in batches to manage memory and API limits
   */
  async processCVsInBatches(cvs, batchSize = 5) {
    const results = [];
    const totalBatches = Math.ceil(cvs.length / batchSize);

    logger.info('Starting batch processing', {
      totalCVs: cvs.length,
      batchSize,
      totalBatches
    });

    for (let i = 0; i < cvs.length; i += batchSize) {
      const batch = cvs.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      logger.info(`Processing batch ${batchNumber}/${totalBatches}`, {
        batchSize: batch.length,
        cvIds: batch.map(cv => cv._id.toString())
      });

      try {
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);

        // Log progress
        const processedCount = Math.min(i + batchSize, cvs.length);
        logger.info(`Batch ${batchNumber} completed`, {
          processedCount,
          totalCVs: cvs.length,
          progress: `${Math.round((processedCount / cvs.length) * 100)}%`
        });

        // Small delay to avoid rate limiting
        if (batchNumber < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        logger.error(`Batch ${batchNumber} failed`, {
          error: error.message,
          cvIds: batch.map(cv => cv._id.toString())
        });

        // Continue with next batch on error
        continue;
      }
    }

    logger.info('All batches processed', {
      totalResults: results.length,
      expectedResults: cvs.length * this.jobDefinitions.jobs.length
    });

    return results;
  }

  /**
   * Process a single batch of CVs
   */
  async processBatch(cvs) {
    const batchResults = [];

    for (const cv of cvs) {
      try {
        // Skip if already processed (duplicate prevention)
        const cvId = cv._id.toString();
        if (this.processedCVs.has(cvId)) {
          logger.warn('Skipping duplicate CV', { cvId, name: cv.personalInfo?.name });
          continue;
        }

        // Mark as processed
        this.processedCVs.add(cvId);

        // Get match scores for all jobs in parallel
        const matchResults = await openaiService.calculateMultipleJobMatches({
          cv: cv,
          jobs: this.jobDefinitions.jobs
        });

        // Process results for this CV
        for (const matchResult of matchResults) {
          const result = {
            candidateName: cv.personalInfo?.name || 'Unknown',
            candidateEmail: cv.personalInfo?.email || '',
            jobRole: matchResult.jobTitle || matchResult.jobId || 'Unknown',
            jobId: matchResult.jobId || '',
            score: matchResult.score || 0,
            skillsScore: matchResult.details?.skills?.score || 0,
            experienceScore: matchResult.details?.experience?.score || 0,
            educationScore: matchResult.details?.education?.score || 0,
            cvId: cvId,
            gpa: this.extractGPA(cv),
            yearsExperience: this.calculateExperience(cv),
            topSkills: this.extractTopSkills(cv)
          };

          batchResults.push(result);
        }

        logger.info('CV processed successfully', {
          cvId,
          name: cv.personalInfo?.name,
          matchCount: matchResults.length
        });

      } catch (error) {
        logger.error('Failed to process CV', {
          cvId: cv._id?.toString(),
          name: cv.personalInfo?.name,
          error: error.message
        });
        // Continue with next CV
        continue;
      }
    }

    return batchResults;
  }

  /**
   * Extract GPA from CV
   */
  extractGPA(cv) {
    if (!cv.education || !Array.isArray(cv.education)) return '';
    
    for (const edu of cv.education) {
      if (edu.gpa && edu.gpa !== '') {
        const gpaNum = parseFloat(edu.gpa);
        if (!isNaN(gpaNum)) return gpaNum.toString();
      }
    }
    return '';
  }

  /**
   * Calculate years of experience
   */
  calculateExperience(cv) {
    if (!cv.experience || !Array.isArray(cv.experience)) return 0;

    let totalMonths = 0;
    const currentDate = new Date();

    for (const exp of cv.experience) {
      try {
        const startDate = exp.startDate ? new Date(exp.startDate) : null;
        const endDate = exp.endDate && exp.endDate !== 'Present' ? 
                       new Date(exp.endDate) : currentDate;

        if (startDate && !isNaN(startDate.getTime()) && 
            endDate && !isNaN(endDate.getTime())) {
          const months = (endDate - startDate) / (1000 * 60 * 60 * 24 * 30);
          totalMonths += Math.max(0, months);
        }
      } catch (error) {
        // Skip invalid dates
        continue;
      }
    }

    return Math.round((totalMonths / 12) * 10) / 10; // Round to 1 decimal
  }

  /**
   * Extract top skills from CV
   */
  extractTopSkills(cv) {
    if (!cv.skills || !Array.isArray(cv.skills)) return '';

    const allSkills = cv.skills.flatMap(skillGroup => 
      Array.isArray(skillGroup.skills) ? skillGroup.skills : []
    );

    return allSkills.slice(0, 5).join(', ');
  }

  /**
   * Generate CSV content
   */
  generateCSV(results) {
    const headers = [
      'Candidate Name',
      'Job Role', 
      'Score',
      'Skills Score',
      'Experience Score',
      'Education Score',
      'Email',
      'GPA',
      'Years Experience',
      'Top Skills',
      'CV ID'
    ];

    const csvRows = [headers.join(',')];

    // Sort by score descending, then by name
    const sortedResults = results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.candidateName.localeCompare(b.candidateName);
    });

    for (const result of sortedResults) {
      const row = [
        `"${result.candidateName.replace(/"/g, '""')}"`,
        `"${result.jobRole.replace(/"/g, '""')}"`,
        result.score.toFixed(2),
        result.skillsScore.toFixed(2),
        result.experienceScore.toFixed(2),
        result.educationScore.toFixed(2),
        `"${result.candidateEmail.replace(/"/g, '""')}"`,
        result.gpa,
        result.yearsExperience,
        `"${result.topSkills.replace(/"/g, '""')}"`,
        result.cvId
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Generate summary statistics
   */
  generateSummary(results) {
    const summary = {
      totalCandidates: new Set(results.map(r => r.cvId)).size,
      totalJobRoles: new Set(results.map(r => r.jobId)).size,
      totalMatches: results.length,
      averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      scoreDistribution: {},
      topScores: results
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(r => ({
          candidate: r.candidateName,
          job: r.jobRole,
          score: r.score
        }))
    };

    // Score distribution
    const scoreRanges = ['0-20', '20-40', '40-60', '60-80', '80-100'];
    scoreRanges.forEach(range => {
      const [min, max] = range.split('-').map(Number);
      summary.scoreDistribution[range] = results.filter(r => 
        r.score >= min && r.score < (max === 100 ? 101 : max)
      ).length;
    });

    return summary;
  }

  /**
   * Save results to files
   */
  async saveResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    
    try {
      // Generate CSV
      const csvContent = this.generateCSV(results);
      const csvFilename = `cv-scores-${timestamp}.csv`;
      const csvPath = path.join(this.outputDir, csvFilename);
      await fs.writeFile(csvPath, csvContent, 'utf8');

      // Generate summary
      const summary = this.generateSummary(results);
      const summaryFilename = `cv-scores-summary-${timestamp}.json`;
      const summaryPath = path.join(this.outputDir, summaryFilename);
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

      logger.info('Results saved successfully', {
        csvPath,
        summaryPath,
        totalResults: results.length
      });

      return { csvPath, summaryPath, summary };

    } catch (error) {
      logger.error('Failed to save results', { error: error.message });
      throw error;
    }
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      console.log('🚀 Starting CV Scoring Process...\n');
      
      await this.initialize();
      console.log('✅ Initialization complete\n');

      console.log('📊 Retrieving CVs from database...');
      const cvs = await this.getAllCVs();
      console.log(`✅ Found ${cvs.length} CVs to process\n`);

      if (cvs.length === 0) {
        console.log('❌ No CVs found in database. Please upload some CVs first.');
        return;
      }

      console.log('🔄 Processing CVs in batches...');
      const results = await this.processCVsInBatches(cvs);
      console.log(`✅ Processing complete. Generated ${results.length} match results\n`);

      console.log('💾 Saving results...');
      const { csvPath, summaryPath, summary } = await this.saveResults(results);
      
      console.log('\n🎉 CV Scoring Complete!');
      console.log('=' .repeat(50));
      console.log(`📁 CSV File: ${csvPath}`);
      console.log(`📊 Summary: ${summaryPath}`);
      console.log(`\n📈 Quick Stats:`);
      console.log(`   • Total Candidates: ${summary.totalCandidates}`);
      console.log(`   • Job Roles: ${summary.totalJobRoles}`);
      console.log(`   • Total Matches: ${summary.totalMatches}`);
      console.log(`   • Average Score: ${summary.averageScore.toFixed(2)}`);
      console.log(`\n🏆 Top Score: ${summary.topScores[0]?.candidate} - ${summary.topScores[0]?.job} (${summary.topScores[0]?.score})`);

    } catch (error) {
      logger.error('CV scoring process failed', { error: error.message });
      console.error('❌ Error:', error.message);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
      console.log('\n🔌 Database disconnected');
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const scoringService = new CVScoringService();
  scoringService.run().catch(console.error);
}

module.exports = CVScoringService; 