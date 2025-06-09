#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Import services
const pdfService = require('../services/pdfService');
const openaiService = require('../services/openaiService');
const logger = require('../utils/logger');

// Terminal colors for better UI
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

class TextOnlyCVScoringService {
  constructor() {
    this.outputDir = path.join(__dirname, 'output');
    this.cvFolder = path.join(__dirname, '../../cv_sample');
    this.jobDefinitions = null;
    this.processedCVs = new Set();
    this.concurrency = 8; // Higher concurrency for text-only
    this.csvPath = null;
    this.totalCVs = 0;
    this.processedCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.startTime = null;
  }

  log(type, message, data = {}) {
    const timestamp = new Date().toLocaleTimeString();
    let prefix, color;
    
    switch (type) {
      case 'success':
        prefix = '✅';
        color = colors.green;
        break;
      case 'error':
        prefix = '❌';
        color = colors.red;
        break;
      case 'warning':
        prefix = '⚠️ ';
        color = colors.yellow;
        break;
      case 'info':
        prefix = 'ℹ️ ';
        color = colors.blue;
        break;
      case 'progress':
        prefix = '🔄';
        color = colors.cyan;
        break;
      default:
        prefix = '•';
        color = colors.white;
    }
    
    console.log(`${color}${prefix} [${timestamp}] ${message}${colors.reset}`);
    
    if (Object.keys(data).length > 0) {
      console.log(`${colors.bright}   └─ ${JSON.stringify(data)}${colors.reset}`);
    }
  }

  showProgress() {
    if (this.totalCVs === 0) return;
    
    const percentage = Math.round((this.processedCount / this.totalCVs) * 100);
    const barLength = 30;
    const filledLength = Math.round((barLength * this.processedCount) / this.totalCVs);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    const elapsed = this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(1) : 0;
    const rate = this.processedCount > 0 ? (this.processedCount / elapsed * 60).toFixed(1) : 0;
    const eta = this.processedCount > 0 ? 
      ((this.totalCVs - this.processedCount) / (this.processedCount / elapsed / 60)).toFixed(1) : '?';
    
    process.stdout.write(`\r${colors.cyan}[${bar}] ${percentage}% (${this.processedCount}/${this.totalCVs}) | ✅ ${this.successCount} ❌ ${this.errorCount} | ${rate} CV/min | ETA: ${eta}min${colors.reset}`);
    
    if (this.processedCount >= this.totalCVs) {
      console.log(); // New line when complete
    }
  }

  async initialize() {
    try {
      this.log('info', 'Initializing TEXT-ONLY CV scoring service...');
      
      // Create output directory
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // Load job definitions
      const jobDefinitionsPath = path.join(__dirname, 'job-definitions.json');
      const jobData = await fs.readFile(jobDefinitionsPath, 'utf8');
      this.jobDefinitions = JSON.parse(jobData);
      
      // Setup CSV file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      this.csvPath = path.join(this.outputDir, `cv-scores-text-only-${timestamp}.csv`);
      
      // Write CSV headers
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
        'Text Length',
        'Processing Time (s)'
      ].join(',') + '\n';
      
      await fs.writeFile(this.csvPath, headers, 'utf8');
      
      this.log('success', 'Initialization complete', {
        jobRoles: this.jobDefinitions.jobs.length,
        csvFile: path.basename(this.csvPath),
        concurrency: this.concurrency
      });

    } catch (error) {
      this.log('error', 'Failed to initialize CV scoring service', { error: error.message });
      throw error;
    }
  }

  async getCVFiles() {
    try {
      const files = await fs.readdir(this.cvFolder);
      const pdfFiles = files
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => ({
          filename: file,
          filepath: path.join(this.cvFolder, file)
        }));

      this.totalCVs = pdfFiles.length;
      this.log('info', `Found ${pdfFiles.length} PDF files to process`);
      return pdfFiles;
    } catch (error) {
      this.log('error', 'Failed to get CV files', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract CV data using TEXT-ONLY approach
   */
  async extractCVDataTextOnly(filepath, filename) {
    const startTime = Date.now();
    
    try {
      // Extract text from PDF only
      const extractedText = await pdfService.extractText(filepath);
      
      if (!extractedText || extractedText.trim().length < 50) {
        throw new Error('Insufficient text extracted from PDF');
      }
      
      // Use text-based extraction
      const structuredData = await openaiService.extractCVData(extractedText);
      
      // Add metadata
      structuredData.fileName = filename;
      structuredData.extractionMethod = 'text_only';
      structuredData.textLength = extractedText.length;
      structuredData.processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      return structuredData;
    } catch (error) {
      this.log('error', `Text extraction failed: ${filename}`, { error: error.message });
      throw error;
    }
  }

  async processSingleCV(cvFile) {
    const startTime = Date.now();
    let cvData = null;
    
    try {
      // Skip if already processed
      if (this.processedCVs.has(cvFile.filename)) {
        this.processedCount++;
        return;
      }
      
      this.processedCVs.add(cvFile.filename);
      
      // Extract CV data using text-only
      cvData = await this.extractCVDataTextOnly(cvFile.filepath, cvFile.filename);
      
      // Get match scores for all jobs in parallel
      const matchResults = await openaiService.calculateMultipleJobMatches({
        cv: cvData,
        jobs: this.jobDefinitions.jobs
      });

      // Process and write results immediately
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
          textLength: cvData.textLength || 0,
          processingTime: ((Date.now() - startTime) / 1000).toFixed(2)
        };

        // Write to CSV immediately
        await this.appendToCSV(result);
      }

      this.successCount++;
      this.processedCount++;
      
      this.log('success', `✅ ${cvFile.filename}`, {
        candidate: cvData.personalInfo?.name,
        matches: matchResults.length,
        textLen: cvData.textLength,
        time: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      });

    } catch (error) {
      this.errorCount++;
      this.processedCount++;
      
      this.log('error', `❌ ${cvFile.filename}`, { 
        error: error.message,
        candidate: cvData?.personalInfo?.name || 'Unknown'
      });
    }
    
    // Update progress
    this.showProgress();
  }

  async appendToCSV(result) {
    try {
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
        result.textLength || 0,
        result.processingTime
      ].join(',') + '\n';

      await fs.appendFile(this.csvPath, row, 'utf8');
    } catch (error) {
      this.log('error', 'Failed to write to CSV', { error: error.message });
    }
  }

  async processCVsInParallel(cvFiles) {
    this.log('info', `🚀 Starting TEXT-ONLY parallel processing with ${this.concurrency} concurrent CVs`);
    this.startTime = Date.now();
    
    // Create semaphore for concurrency control
    const semaphore = new Array(this.concurrency).fill(null);
    let index = 0;
    
    const processNext = async () => {
      while (index < cvFiles.length) {
        const currentIndex = index++;
        await this.processSingleCV(cvFiles[currentIndex]);
      }
    };

    // Start all workers
    const workers = semaphore.map(() => processNext());
    await Promise.allSettled(workers);
    
    const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const avgTime = (totalTime / this.successCount).toFixed(2);
    
    this.log('success', 'Parallel processing complete', {
      totalTime: `${totalTime}s`,
      avgPerCV: `${avgTime}s`,
      rate: `${(this.successCount / totalTime * 60).toFixed(1)} CV/min`
    });
  }

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
        continue;
      }
    }

    return Math.round((totalMonths / 12) * 10) / 10;
  }

  extractTopSkills(cvData) {
    if (!cvData.skills || !Array.isArray(cvData.skills)) return '';

    const allSkills = cvData.skills.flatMap(skillGroup => 
      Array.isArray(skillGroup.skills) ? skillGroup.skills : []
    );

    return allSkills.slice(0, 5).join(', ');
  }

  async generateSummary() {
    try {
      // Read the CSV file to analyze results
      const csvContent = await fs.readFile(this.csvPath, 'utf8');
      const lines = csvContent.split('\n').filter(line => line.trim());
      const dataLines = lines.slice(1); // Skip header
      
      const results = dataLines.map(line => {
        const columns = line.split(',');
        return {
          candidateName: columns[0]?.replace(/"/g, ''),
          jobRole: columns[1]?.replace(/"/g, ''),
          score: parseFloat(columns[2]) || 0,
          filename: columns[10]?.replace(/"/g, ''),
          textLength: parseInt(columns[11]) || 0,
          processingTime: parseFloat(columns[12]) || 0
        };
      });

      const summary = {
        totalCVs: this.successCount,
        totalJobRoles: this.jobDefinitions.jobs.length,
        totalMatches: results.length,
        averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
        averageTextLength: results.reduce((sum, r) => sum + r.textLength, 0) / results.length,
        processingStats: {
          totalTime: ((Date.now() - this.startTime) / 1000).toFixed(2),
          avgTimePerCV: (results.reduce((sum, r) => sum + r.processingTime, 0) / this.successCount).toFixed(2),
          successRate: ((this.successCount / this.totalCVs) * 100).toFixed(1),
          errors: this.errorCount,
          extractionMethod: 'text_only'
        },
        topScores: results
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(r => ({
            candidate: r.candidateName,
            job: r.jobRole,
            score: r.score.toFixed(2),
            filename: r.filename
          }))
      };

      // Save summary
      const summaryPath = this.csvPath.replace('.csv', '-summary.json');
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

      return { summary, summaryPath };
    } catch (error) {
      this.log('error', 'Failed to generate summary', { error: error.message });
      throw error;
    }
  }

  async run() {
    try {
      // Header
      console.log(`${colors.bright}${colors.blue}`);
      console.log('╔═══════════════════════════════════════════════╗');
      console.log('║         📄 TEXT-ONLY CV SCORING 📄            ║');
      console.log('║      Fast • Parallel • No Dependencies       ║');
      console.log('╚═══════════════════════════════════════════════╝');
      console.log(colors.reset);
      
      await this.initialize();
      
      this.log('info', 'Reading CVs from cv_sample folder...');
      const cvFiles = await this.getCVFiles();
      
      if (cvFiles.length === 0) {
        this.log('warning', 'No PDF files found in cv_sample folder');
        return;
      }

      console.log(`\n${colors.yellow}⚡ About to process ${cvFiles.length} CVs against ${this.jobDefinitions.jobs.length} job roles${colors.reset}`);
      console.log(`${colors.yellow}   • Concurrency: ${this.concurrency} parallel CVs${colors.reset}`);
      console.log(`${colors.yellow}   • Method: TEXT-ONLY extraction (no images)${colors.reset}`);
      console.log(`${colors.yellow}   • Output: Real-time CSV updates${colors.reset}\n`);

      this.log('progress', 'Starting parallel processing...');
      await this.processCVsInParallel(cvFiles);
      
      this.log('info', 'Generating final summary...');
      const { summary, summaryPath } = await this.generateSummary();
      
      // Final results
      console.log(`\n${colors.bright}${colors.green}`);
      console.log('🎉 TEXT-ONLY CV SCORING COMPLETE!');
      console.log('═'.repeat(45));
      console.log(colors.reset);
      
      this.log('success', `CSV Results: ${path.basename(this.csvPath)}`);
      this.log('success', `Summary: ${path.basename(summaryPath)}`);
      
      console.log(`\n${colors.bright}📊 FINAL STATISTICS:${colors.reset}`);
      console.log(`${colors.cyan}   • CVs Processed: ${summary.totalCVs}/${this.totalCVs}${colors.reset}`);
      console.log(`${colors.cyan}   • Success Rate: ${summary.processingStats.successRate}%${colors.reset}`);
      console.log(`${colors.cyan}   • Total Matches: ${summary.totalMatches}${colors.reset}`);
      console.log(`${colors.cyan}   • Average Score: ${summary.averageScore.toFixed(2)}${colors.reset}`);
      console.log(`${colors.cyan}   • Avg Text Length: ${Math.round(summary.averageTextLength)} chars${colors.reset}`);
      console.log(`${colors.cyan}   • Processing Time: ${summary.processingStats.totalTime}s${colors.reset}`);
      console.log(`${colors.cyan}   • Rate: ${(summary.totalCVs / summary.processingStats.totalTime * 60).toFixed(1)} CV/min${colors.reset}`);
      
      if (summary.topScores.length > 0) {
        console.log(`\n${colors.bright}🏆 TOP MATCHES:${colors.reset}`);
        summary.topScores.forEach((match, i) => {
          console.log(`${colors.yellow}   ${i+1}. ${match.candidate} → ${match.job} (${match.score})${colors.reset}`);
        });
      }

      console.log(`\n${colors.green}✅ Results saved to: ${this.csvPath}${colors.reset}`);

    } catch (error) {
      this.log('error', 'Text-only CV scoring failed', { error: error.message });
      console.error(`${colors.red}❌ Fatal Error: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const scoringService = new TextOnlyCVScoringService();
  scoringService.run().catch(console.error);
}

module.exports = TextOnlyCVScoringService; 