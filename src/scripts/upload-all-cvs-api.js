#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
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

class CVAPIUploader {
  constructor() {
    this.cvFolder = path.join(__dirname, '../../cv_sample');
    this.baseURL = process.env.API_BASE_URL || 'http://localhost:3000';
    this.apiEndpoint = `${this.baseURL}/api/cv/extract`;
    this.processedCount = 0;
    this.successCount = 0;
    this.failedCount = 0;
    this.skippedCount = 0;
    this.totalCVs = 0;
    this.concurrency = 20; // High concurrency for faster processing
    this.failedFiles = [];
    this.duplicateFiles = [];
    
    // Request timeout
    this.timeout = 120000; // 2 minutes per request (increased for higher concurrency)
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

  async testConnection() {
    try {
      this.log('info', 'Testing API connection...');
      const response = await axios.get(`${this.baseURL}/api/cv`, { timeout: 5000 });
      this.log('success', 'API connection successful', { 
        status: response.status,
        endpoint: `${this.baseURL}/api/cv`
      });
      return true;
    } catch (error) {
      this.log('error', 'API connection failed', { 
        error: error.message,
        endpoint: this.baseURL 
      });
      return false;
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

  async uploadCV(cvFile) {
    const startTime = Date.now();
    
    try {
      this.log('progress', `Uploading ${cvFile.filename}...`);
      
      // Create form data
      const formData = new FormData();
      const fileStream = await fs.readFile(cvFile.filepath);
      formData.append('cv', fileStream, {
        filename: cvFile.filename,
        contentType: 'application/pdf'
      });

      // Make API request
      const response = await axios.post(this.apiEndpoint, formData, {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        },
        timeout: this.timeout,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      this.processedCount++;
      this.successCount++;
      
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const responseData = response.data.data;
      
      this.log('success', `✅ ${cvFile.filename}`, {
        id: responseData._id,
        name: responseData.personalInfo?.name || 'Unknown',
        email: responseData.personalInfo?.email || 'No email',
        method: responseData.extractionMethod,
        time: `${processingTime}s`,
        status: response.status
      });

      this.showProgress();

    } catch (error) {
      this.processedCount++;
      
      // Handle specific error cases
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.message || error.message;
        
        // Check if it's a duplicate/already exists error
        if (status === 400 && message.includes('already exists')) {
          this.skippedCount++;
          this.duplicateFiles.push(cvFile.filename);
          this.log('skip', `${cvFile.filename} (already exists)`);
        } else {
          this.failedCount++;
          this.failedFiles.push({
            filename: cvFile.filename,
            error: `HTTP ${status}: ${message}`
          });
          this.log('error', `❌ ${cvFile.filename}`, { 
            status,
            error: message 
          });
        }
      } else if (error.code === 'ECONNABORTED') {
        this.failedCount++;
        this.failedFiles.push({
          filename: cvFile.filename,
          error: 'Request timeout'
        });
        this.log('error', `❌ ${cvFile.filename}`, { error: 'Request timeout' });
      } else {
        this.failedCount++;
        this.failedFiles.push({
          filename: cvFile.filename,
          error: error.message
        });
        this.log('error', `❌ ${cvFile.filename}`, { error: error.message });
      }
      
      this.showProgress();
    }
  }

  async processCVsInParallel(cvFiles) {
    this.log('info', `🚀 Starting parallel upload with ${this.concurrency} concurrent requests`);
    
    // Create semaphore for concurrency control
    const semaphore = new Array(this.concurrency).fill(null);
    let index = 0;
    
    const processNext = async () => {
      while (index < cvFiles.length) {
        const currentIndex = index++;
        await this.uploadCV(cvFiles[currentIndex]);
        
        // Reduced delay for higher concurrency
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    };

    // Start all workers
    const workers = semaphore.map(() => processNext());
    await Promise.allSettled(workers);
    
    this.log('success', 'All CVs processed!');
  }

  async generateSummaryReport() {
    console.log(`\n${colors.bright}${colors.blue}📊 API UPLOAD SUMMARY REPORT${colors.reset}`);
    console.log('═'.repeat(50));
    
    // Basic statistics
    console.log(`${colors.cyan}📈 Statistics:${colors.reset}`);
    console.log(`${colors.green}   ✅ Successfully uploaded: ${this.successCount}${colors.reset}`);
    console.log(`${colors.magenta}   ⏭️  Skipped (duplicates): ${this.skippedCount}${colors.reset}`);
    console.log(`${colors.red}   ❌ Failed: ${this.failedCount}${colors.reset}`);
    console.log(`${colors.cyan}   📁 Total processed: ${this.processedCount}${colors.reset}`);
    
    // API info
    console.log(`\n${colors.cyan}🌐 API Details:${colors.reset}`);
    console.log(`${colors.cyan}   🔗 Endpoint: ${this.apiEndpoint}${colors.reset}`);
    console.log(`${colors.cyan}   ⏱️  Timeout: ${this.timeout / 1000}s per request${colors.reset}`);
    console.log(`${colors.cyan}   🔄 Concurrency: ${this.concurrency}${colors.reset}`);
    
    // Show failed files if any
    if (this.failedFiles.length > 0) {
      console.log(`\n${colors.red}❌ Failed Files:${colors.reset}`);
      this.failedFiles.forEach((failure, index) => {
        console.log(`${colors.red}   ${index + 1}. ${failure.filename}${colors.reset}`);
        console.log(`${colors.red}      Error: ${failure.error}${colors.reset}`);
      });
    }
    
    // Show duplicate files if any
    if (this.duplicateFiles.length > 0) {
      console.log(`\n${colors.magenta}⏭️  Duplicate Files (already in database):${colors.reset}`);
      this.duplicateFiles.slice(0, 10).forEach((filename, index) => {
        console.log(`${colors.magenta}   ${index + 1}. ${filename}${colors.reset}`);
      });
      
      if (this.duplicateFiles.length > 10) {
        console.log(`${colors.magenta}   ... and ${this.duplicateFiles.length - 10} more${colors.reset}`);
      }
    }
  }

  async run() {
    try {
      // Header
      console.log(`${colors.bright}${colors.blue}`);
      console.log('╔═══════════════════════════════════════════════╗');
      console.log('║         🌐 CV API UPLOADER 🌐                ║');
      console.log('║    PDF → HTTP API → Backend → Database       ║');
      console.log('╚═══════════════════════════════════════════════╝');
      console.log(colors.reset);
      
      // Test API connection
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        throw new Error('Cannot connect to API. Please ensure the backend is running.');
      }
      
      // Get CV files
      const cvFiles = await this.getCVFiles();
      
      if (cvFiles.length === 0) {
        this.log('warning', 'No PDF files found in cv_sample folder');
        return;
      }

      console.log(`\n${colors.yellow}📋 Upload Details:${colors.reset}`);
      console.log(`${colors.yellow}   • CVs to upload: ${cvFiles.length}${colors.reset}`);
      console.log(`${colors.yellow}   • API Endpoint: ${this.apiEndpoint}${colors.reset}`);
      console.log(`${colors.yellow}   • Concurrency: ${this.concurrency} requests${colors.reset}`);
      console.log(`${colors.yellow}   • Timeout: ${this.timeout / 1000}s per request${colors.reset}`);
      console.log(`${colors.yellow}   • Method: HTTP multipart/form-data${colors.reset}\n`);

      const startTime = Date.now();
      await this.processCVsInParallel(cvFiles);
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Final results
      console.log(`\n${colors.bright}${colors.green}`);
      console.log('🎉 API UPLOAD COMPLETE!');
      console.log('═'.repeat(40));
      console.log(colors.reset);
      
      console.log(`${colors.cyan}⏱️  Total Time: ${totalTime}s${colors.reset}`);
      console.log(`${colors.cyan}🚀 Rate: ${(this.processedCount / totalTime * 60).toFixed(1)} CV/min${colors.reset}`);
      
      // Generate detailed summary
      await this.generateSummaryReport();

    } catch (error) {
      this.log('error', 'API upload failed', { error: error.message });
      console.error(`${colors.red}❌ Fatal Error: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  }
}

// Run the script
if (require.main === module) {
  const uploader = new CVAPIUploader();
  uploader.run().catch(console.error);
}

module.exports = CVAPIUploader; 