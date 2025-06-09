#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import services
const pdfService = require('../services/pdfService');
const openaiService = require('../services/openaiService');
const logger = require('../utils/logger');

class DirectCVScoringService {
  constructor() {
    this.outputDir = path.join(__dirname, 'output');
    this.cvFolder = path.join(__dirname, '../../cv_sample');
    this.jobDefinitions = null;
    this.processedCVs = new Set(); // Track processed CVs to prevent duplicates
  }

  /**
   * Initialize the service
   */
  async initialize() {
    try {
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
   * Get all PDF files from cv_sample directory
   */
  async getCVFiles() {
    try {
      const files = await fs.readdir(this.cvFolder);
      const pdfFiles = files
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => ({
          filename: file,
          filepath: path.join(this.cvFolder, file)
        }));

      logger.info('CV files found', { count: pdfFiles.length });
      return pdfFiles;
    } catch (error) {
      logger.error('Failed to get CV files', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract structured data from a single CV file
   */
  async extractCVData(filepath, filename) {
    try {
      logger.info('Starting CV data extraction', { filename });
      
      // Step 1: Extract text from PDF
      const extractedText = await pdfService.extractText(filepath);
      
      let structuredData;
      let extractionMethod = 'text';
      
      // Step 2: Check if text extraction was sufficient
      if (pdfService.isTextSufficient(extractedText)) {
        logger.info('Text extraction sufficient, using text-based processing', {
          filename,
          textLength: extractedText.length
        });
        
        // Use text-based extraction
        structuredData = await openaiService.extractCVData(extractedText);
      } else {
        logger.info('Text extraction insufficient, falling back to vision-based processing', {
          filename,
          textLength: extractedText.length
        });
        
        try {
          // Extract images from PDF
          const imageBuffers = await pdfService.extractImages(filepath);
          
          if (imageBuffers.length === 0) {
            throw new Error('No images could be extracted from PDF');
          }
          
          logger.info('Images extracted successfully, processing with vision model', {
            filename,
            imageCount: imageBuffers.length
          });
          
          // Use vision-based extraction
          structuredData = await openaiService.extractCVDataFromImages(imageBuffers);
          extractionMethod = 'vision';
          
        } catch (visionError) {
          logger.error('Vision-based extraction failed, falling back to text', {
            filename,
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
      
      // Add metadata
      structuredData.fileName = filename;
      structuredData.extractionMethod = extractionMethod;
      
      logger.info('CV data extraction completed successfully', { 
        filename,
        extractionMethod,
        textLength: extractedText.length
      });
      
      return structuredData;
    } catch (error) {
      logger.error('CV data extraction failed', { 
        filename,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process CVs in batches to manage memory and API limits
   */
  async processCVsInBatches(cvFiles, batchSize = 3) {
    const results = [];
    const totalBatches = Math.ceil(cvFiles.length / batchSize);

    logger.info('Starting batch processing', {
      totalCVs: cvFiles.length,
      batchSize,
      totalBatches
    });

    for (let i = 0; i < cvFiles.length; i += batchSize) {
      const batch = cvFiles.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      logger.info(`Processing batch ${batchNumber}/${totalBatches}`, {
        batchSize: batch.length,
        filenames: batch.map(cv => cv.filename)
      });

      try {
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);

        // Log progress
        const processedCount = Math.min(i + batchSize, cvFiles.length);
        logger.info(`Batch ${batchNumber} completed`, {
          processedCount,
          totalCVs: cvFiles.length,
          progress: `${Math.round((processedCount / cvFiles.length) * 100)}%`
        });

        // Small delay to avoid rate limiting
        if (batchNumber < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        logger.error(`Batch ${batchNumber} failed`, {
          error: error.message,
          filenames: batch.map(cv => cv.filename)
        });

        // Continue with next batch on error
        continue;
      }
    }

    logger.info('All batches processed', {
      totalResults: results.length,
      expectedResults: cvFiles.length * this.jobDefinitions.jobs.length
    });

    return results;
  }

  /**
   * Process a single batch of CVs
   */
  async processBatch(cvFiles) {
    const batchResults = [];

    for (const cvFile of cvFiles) {
      try {
        // Skip if already processed (duplicate prevention)
        if (this.processedCVs.has(cvFile.filename)) {
          logger.warn('Skipping duplicate CV', { filename: cvFile.filename });
          continue;
        }

        // Mark as processed
        this.processedCVs.add(cvFile.filename);

        // Extract CV data
        const cvData = await this.extractCVData(cvFile.filepath, cvFile.filename);

        // Get match scores for all jobs in parallel
        const matchResults = await openaiService.calculateMultipleJobMatches({
          cv: cvData,
          jobs: this.jobDefinitions.jobs
        });

        // Process results for this CV
        for (const matchResult of matchResults) {
          const result = {
            candidateName: cvData.personalInfo?.name || 'Unknown',
            candidateEmail: cvData.personalInfo?.email || '',
            jobRole: matchResult.jobTitle || matchResult.jobId || 'Unknown',
            jobId: matchResult.jobId || '',
            score: matchResult.score || 0,
            skillsScore: matchResult.details?.skills?.score || 0,
            experienceScore: matchResult.details?.experience?.score || 0,
            educationScore: matchResult.details?.education?.score || 0,
            filename: cvFile.filename,
            gpa: this.extractGPA(cvData),
            yearsExperience: this.calculateExperience(cvData),
            topSkills: this.extractTopSkills(cvData),
            extractionMethod: cvData.extractionMethod
          };

          batchResults.push(result);
        }

        logger.info('CV processed successfully', {
          filename: cvFile.filename,
          name: cvData.personalInfo?.name,
          matchCount: matchResults.length
        });

      } catch (error) {
        logger.error('Failed to process CV', {
          filename: cvFile.filename,
          error: error.message
        });
        // Continue with next CV
        continue;
      }
    }

    return batchResults;
  }

  /**
   * Extract GPA from CV data
   */
  extractGPA(cvData) {
    if (!cvData.education || !Array.isArray(cvData.education)) return '';
    
    for (const edu of cvData.education) {
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
  calculateExperience(cvData) {
    if (!cvData.experience || !Array.isArray(cvData.experience)) return 0;

    let totalMonths = 0;
    const currentDate = new Date();

    for (const exp of cvData.experience) {
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
   * Extract top skills from CV data
   */
  extractTopSkills(cvData) {
    if (!cvData.skills || !Array.isArray(cvData.skills)) return '';

    const allSkills = cvData.skills.flatMap(skillGroup => 
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
      'Filename',
      'Extraction Method'
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
        `"${result.filename.replace(/"/g, '""')}"`,
        result.extractionMethod || 'text'
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
      totalCandidates: new Set(results.map(r => r.filename)).size,
      totalJobRoles: new Set(results.map(r => r.jobId)).size,
      totalMatches: results.length,
      averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      extractionMethods: {},
      scoreDistribution: {},
      topScores: results
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map(r => ({
          candidate: r.candidateName,
          job: r.jobRole,
          score: r.score,
          filename: r.filename
        }))
    };

    // Extraction method distribution
    results.forEach(r => {
      const method = r.extractionMethod || 'text';
      summary.extractionMethods[method] = (summary.extractionMethods[method] || 0) + 1;
    });

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
      const csvFilename = `cv-scores-direct-${timestamp}.csv`;
      const csvPath = path.join(this.outputDir, csvFilename);
      await fs.writeFile(csvPath, csvContent, 'utf8');

      // Generate summary
      const summary = this.generateSummary(results);
      const summaryFilename = `cv-scores-direct-summary-${timestamp}.json`;
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
      console.log('🚀 Starting Direct CV Scoring Process...\n');
      
      await this.initialize();
      console.log('✅ Initialization complete\n');

      console.log('📁 Reading CVs from cv_sample folder...');
      const cvFiles = await this.getCVFiles();
      console.log(`✅ Found ${cvFiles.length} PDF files to process\n`);

      if (cvFiles.length === 0) {
        console.log('❌ No PDF files found in cv_sample folder');
        return;
      }

      console.log('🔄 Processing CVs with extraction and scoring...');
      console.log('⚡ Using multimodal extraction (text + vision when needed)');
      const results = await this.processCVsInBatches(cvFiles);
      console.log(`✅ Processing complete. Generated ${results.length} match results\n`);

      console.log('💾 Saving results...');
      const { csvPath, summaryPath, summary } = await this.saveResults(results);
      
      console.log('\n🎉 Direct CV Scoring Complete!');
      console.log('=' .repeat(50));
      console.log(`📁 CSV File: ${csvPath}`);
      console.log(`📊 Summary: ${summaryPath}`);
      console.log(`\n📈 Quick Stats:`);
      console.log(`   • Total CVs Processed: ${summary.totalCandidates}`);
      console.log(`   • Job Roles Evaluated: ${summary.totalJobRoles}`);
      console.log(`   • Total Match Results: ${summary.totalMatches}`);
      console.log(`   • Average Score: ${summary.averageScore.toFixed(2)}`);
      console.log(`\n🔧 Extraction Methods:`);
      Object.entries(summary.extractionMethods).forEach(([method, count]) => {
        console.log(`   • ${method}: ${count} CVs`);
      });
      console.log(`\n🏆 Top Score: ${summary.topScores[0]?.candidate} - ${summary.topScores[0]?.job} (${summary.topScores[0]?.score})`);

    } catch (error) {
      logger.error('Direct CV scoring process failed', { error: error.message });
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const scoringService = new DirectCVScoringService();
  scoringService.run().catch(console.error);
}

module.exports = DirectCVScoringService; 