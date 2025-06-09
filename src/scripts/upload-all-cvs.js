#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');

// Import services and models
const CVExtractionService = require('../services/cvExtractionService');
const CVData = require('../models/cvData.model');
const config = require('../config/default');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Terminal colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class CVUploader {
  constructor() {
    this.cvFolder = path.join(__dirname, '../../cv_sample');
    this.processedCount = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.skippedCount = 0;
    this.totalCVs = 0;
    this.concurrency = 5; // Process 5 CVs in parallel (conservative for database writes)
    this.failedFiles = [];
    this.existingFiles = [];
  }

  log(type, message, data = {}) {
    const timestamp = new Date().toLocaleTimeString();
    let prefix, color;
    
    switch (type) {
      case 'success': prefix = '✅'; color = colors.green; break;
      case 'error': prefix = '❌'; color = colors.red; break;
      case 'warning': prefix = '⚠️'; color = colors.yellow; break;
      case 'info': prefix = 'ℹ️'; color = colors.blue; break;
      case 'progress': prefix = '🔄'; color = colors.cyan; break;
      case 'skip': prefix = '⏭️'; color = colors.magenta; break;
      default: prefix = '•'; color = colors.white;
    }
    
    console.log(`${color}${prefix} [${timestamp}] ${message}${colors.reset}`);
    if (Object.keys(data).length > 0) {
      console.log(`${colors.bright}   └─ ${JSON.stringify(data)}${colors.reset}`);
    }
  }

  showProgress() {
    const percentage = Math.round((this.processedCount / this.totalCVs) * 100);
    const barLength = 30;
    const filledLength = Math.round((barLength * this.processedCount) / this.totalCVs);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    process.stdout.write(`\r${colors.cyan}[${bar}] ${percentage}% (${this.processedCount}/${this.totalCVs}) | ✅ ${this.successCount} | ❌ ${this.failedCount} | ⏭️ ${this.skippedCount}${colors.reset}`);
    
    if (this.processedCount >= this.totalCVs) {
      console.log(); // New line when complete
    }
  }

  async connectToDatabase() {
    try {
      this.log('info', 'Connecting to MongoDB...');
      await mongoose.connect(config.mongodb.uri);
      this.log('success', 'Connected to MongoDB', { 
        host: config.mongodb.uri.split('@')[1]?.split('/')[0] || 'localhost'
      });
    } catch (error) {
      this.log('error', 'MongoDB connection failed', { error: error.message });
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

  async checkIfCVExists(filename) {
    try {
      const existingCV = await CVData.findOne({ fileName: filename });
      return !!existingCV;
    } catch (error) {
      this.log('warning', 'Error checking CV existence', { filename, error: error.message });
      return false;
    }
  }

  async processCV(cvFile) {
    const startTime = Date.now();
    
    try {
      // Check if CV already exists in database
      const exists = await this.checkIfCVExists(cvFile.filename);
      
      if (exists) {
        this.processedCount++;
        this.skippedCount++;
        this.existingFiles.push(cvFile.filename);
        this.log('skip', `${cvFile.filename} (already exists)`);
        this.showProgress();
        return;
      }

      this.log('progress', `Processing ${cvFile.filename}...`);
      
      // Use the existing CV extraction service
      const extractedData = await CVExtractionService.processCVFile(
        cvFile.filepath, 
        cvFile.filename
      );
      
      this.processedCount++;
      this.successCount++;
      
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      this.log('success', `✅ ${cvFile.filename}`, {
        id: extractedData._id.toString(),
        name: extractedData.personalInfo?.name || 'Unknown',
        email: extractedData.personalInfo?.email || 'No email',
        method: extractedData.extractionMethod,
        time: `${processingTime}s`
      });

      this.showProgress();

    } catch (error) {
      this.processedCount++;
      this.failedCount++;
      this.failedFiles.push({
        filename: cvFile.filename,
        error: error.message
      });
      
      this.log('error', `❌ ${cvFile.filename}`, { error: error.message });
      this.showProgress();
    }
  }

  async processCVsInParallel(cvFiles) {
    this.log('info', `🚀 Starting parallel processing with ${this.concurrency} concurrent CVs`);
    
    // Create semaphore for concurrency control
    const semaphore = new Array(this.concurrency).fill(null);
    let index = 0;
    
    const processNext = async () => {
      while (index < cvFiles.length) {
        const currentIndex = index++;
        await this.processCV(cvFiles[currentIndex]);
      }
    };

    // Start all workers
    const workers = semaphore.map(() => processNext());
    await Promise.allSettled(workers);
    
    this.log('success', 'All CVs processed!');
  }

  async generateSummaryReport() {
    console.log(`\n${colors.bright}${colors.blue}📊 UPLOAD SUMMARY REPORT${colors.reset}`);
    console.log('═'.repeat(50));
    
    // Basic statistics
    console.log(`${colors.cyan}📈 Statistics:${colors.reset}`);
    console.log(`${colors.green}   ✅ Successfully uploaded: ${this.successCount}${colors.reset}`);
    console.log(`${colors.magenta}   ⏭️  Skipped (already exists): ${this.skippedCount}${colors.reset}`);
    console.log(`${colors.red}   ❌ Failed: ${this.failedCount}${colors.reset}`);
    console.log(`${colors.cyan}   📁 Total processed: ${this.processedCount}${colors.reset}`);
    
    // Database statistics
    try {
      const totalCVsInDB = await CVData.countDocuments();
      const cvsWithEmbeddings = await CVData.countDocuments({ embedding: { $exists: true } });
      
      console.log(`\n${colors.cyan}🗄️  Database Status:${colors.reset}`);
      console.log(`${colors.cyan}   📊 Total CVs in database: ${totalCVsInDB}${colors.reset}`);
      console.log(`${colors.cyan}   🎯 CVs with embeddings: ${cvsWithEmbeddings}${colors.reset}`);
      console.log(`${colors.cyan}   🔍 Ready for search: ${cvsWithEmbeddings}${colors.reset}`);
      
    } catch (error) {
      this.log('warning', 'Could not get database statistics', { error: error.message });
    }
    
    // Show failed files if any
    if (this.failedFiles.length > 0) {
      console.log(`\n${colors.red}❌ Failed Files:${colors.reset}`);
      this.failedFiles.forEach((failure, index) => {
        console.log(`${colors.red}   ${index + 1}. ${failure.filename}${colors.reset}`);
        console.log(`${colors.red}      Error: ${failure.error}${colors.reset}`);
      });
    }
    
    // Show existing files if any
    if (this.existingFiles.length > 0) {
      console.log(`\n${colors.magenta}⏭️  Files Already in Database:${colors.reset}`);
      this.existingFiles.slice(0, 10).forEach((filename, index) => {
        console.log(`${colors.magenta}   ${index + 1}. ${filename}${colors.reset}`);
      });
      
      if (this.existingFiles.length > 10) {
        console.log(`${colors.magenta}   ... and ${this.existingFiles.length - 10} more${colors.reset}`);
      }
    }
  }

  async run() {
    try {
      // Header
      console.log(`${colors.bright}${colors.green}`);
      console.log('╔═══════════════════════════════════════════════╗');
      console.log('║         🗄️  CV DATABASE UPLOADER 🗄️           ║');
      console.log('║      PDF → Extract → Embed → Database        ║');
      console.log('╚═══════════════════════════════════════════════╝');
      console.log(colors.reset);
      
      // Connect to database
      await this.connectToDatabase();
      
      // Get CV files
      const cvFiles = await this.getCVFiles();
      
      if (cvFiles.length === 0) {
        this.log('warning', 'No PDF files found in cv_sample folder');
        return;
      }

      // Check current database state
      const existingCount = await CVData.countDocuments();
      this.log('info', `Current database has ${existingCount} CVs`);

      console.log(`\n${colors.yellow}📋 Processing Details:${colors.reset}`);
      console.log(`${colors.yellow}   • CVs to process: ${cvFiles.length}${colors.reset}`);
      console.log(`${colors.yellow}   • Concurrency: ${this.concurrency}${colors.reset}`);
      console.log(`${colors.yellow}   • Method: Text/Vision extraction + Embeddings${colors.reset}`);
      console.log(`${colors.yellow}   • Database: MongoDB${colors.reset}`);
      console.log(`${colors.yellow}   • Skip existing: Yes${colors.reset}\n`);

      const startTime = Date.now();
      await this.processCVsInParallel(cvFiles);
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Final results
      console.log(`\n${colors.bright}${colors.green}`);
      console.log('🎉 CV UPLOAD COMPLETE!');
      console.log('═'.repeat(40));
      console.log(colors.reset);
      
      console.log(`${colors.cyan}⏱️  Total Time: ${totalTime}s${colors.reset}`);
      console.log(`${colors.cyan}🚀 Rate: ${(this.processedCount / totalTime * 60).toFixed(1)} CV/min${colors.reset}`);
      
      // Generate detailed summary
      await this.generateSummaryReport();

    } catch (error) {
      this.log('error', 'CV upload failed', { error: error.message });
      console.error(`${colors.red}❌ Fatal Error: ${error.message}${colors.reset}`);
      process.exit(1);
    } finally {
      // Close database connection
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
        this.log('info', 'Disconnected from MongoDB');
      }
    }
  }
}

// Run the script
if (require.main === module) {
  const uploader = new CVUploader();
  uploader.run().catch(console.error);
}

module.exports = CVUploader; 