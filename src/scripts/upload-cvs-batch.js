#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

class CVBatchUploader {
  constructor() {
    this.baseURL = 'http://localhost:3000';
    this.uploadEndpoint = '/api/cv/extract';
    this.cvFolder = path.join(__dirname, '../../cv_sample');
    this.concurrency = 3; // Number of concurrent uploads
    this.uploadedFiles = new Set();
    this.failedFiles = [];
    this.successfulUploads = 0;
  }

  /**
   * Get all PDF files from the cv_sample directory
   */
  async getCVFiles() {
    try {
      const files = await fs.readdir(this.cvFolder);
      const pdfFiles = files
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .map(file => path.join(this.cvFolder, file));

      console.log(`📁 Found ${pdfFiles.length} PDF files in cv_sample folder`);
      return pdfFiles;
    } catch (error) {
      console.error('❌ Error reading cv_sample folder:', error.message);
      throw error;
    }
  }

  /**
   * Check if server is running
   */
  async checkServer() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, { timeout: 5000 });
      console.log('✅ Server is running');
      return true;
    } catch (error) {
      console.log('❌ Server not responding. Make sure your app is running on port 3000');
      console.log('   Run: npm start or node src/index.js');
      return false;
    }
  }

  /**
   * Upload a single CV file
   */
  async uploadCV(filePath) {
    const fileName = path.basename(filePath);
    
    try {
      // Check if file exists and get stats
      const stats = await fs.stat(filePath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log(`📤 Uploading: ${fileName} (${fileSizeMB}MB)`);

      // Create form data
      const formData = new FormData();
      const fileStream = await fs.readFile(filePath);
      formData.append('cv', fileStream, {
        filename: fileName,
        contentType: 'application/pdf'
      });

      // Upload with timeout
      const response = await axios.post(
        `${this.baseURL}${this.uploadEndpoint}`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 120000, // 2 minute timeout
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      if (response.status === 200 || response.status === 201) {
        this.successfulUploads++;
        console.log(`✅ ${fileName} uploaded successfully`);
        
        // Log extracted name if available
        if (response.data?.data?.personalInfo?.name) {
          console.log(`   👤 Extracted: ${response.data.data.personalInfo.name}`);
        }
        
        return { success: true, fileName, response: response.data };
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }

    } catch (error) {
      this.failedFiles.push({ fileName, error: error.message });
      console.log(`❌ ${fileName} failed: ${error.message}`);
      return { success: false, fileName, error: error.message };
    }
  }

  /**
   * Upload CVs in batches with concurrency control
   */
  async uploadCVsInBatches(filePaths) {
    const totalFiles = filePaths.length;
    console.log(`\n🚀 Starting batch upload of ${totalFiles} CVs...`);
    console.log(`⚡ Concurrency: ${this.concurrency} files at a time\n`);

    const results = [];
    
    for (let i = 0; i < filePaths.length; i += this.concurrency) {
      const batch = filePaths.slice(i, i + this.concurrency);
      const batchNumber = Math.floor(i / this.concurrency) + 1;
      const totalBatches = Math.ceil(filePaths.length / this.concurrency);

      console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${batch.length} files)`);
      console.log('=' .repeat(50));

      // Process batch concurrently
      const batchPromises = batch.map(filePath => this.uploadCV(filePath));
      const batchResults = await Promise.allSettled(batchPromises);
      
      results.push(...batchResults);

      // Progress update
      const processedCount = Math.min(i + this.concurrency, totalFiles);
      const progress = Math.round((processedCount / totalFiles) * 100);
      console.log(`\n📊 Progress: ${processedCount}/${totalFiles} (${progress}%)`);

      // Small delay between batches to avoid overwhelming the server
      if (i + this.concurrency < filePaths.length) {
        console.log('⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  /**
   * Generate summary report
   */
  generateSummary() {
    const totalFiles = this.successfulUploads + this.failedFiles.length;
    const successRate = ((this.successfulUploads / totalFiles) * 100).toFixed(1);

    console.log('\n' + '=' .repeat(60));
    console.log('📋 UPLOAD SUMMARY');
    console.log('=' .repeat(60));
    console.log(`📁 Total Files: ${totalFiles}`);
    console.log(`✅ Successful: ${this.successfulUploads}`);
    console.log(`❌ Failed: ${this.failedFiles.length}`);
    console.log(`📊 Success Rate: ${successRate}%`);

    if (this.failedFiles.length > 0) {
      console.log('\n❌ Failed Files:');
      this.failedFiles.forEach(({ fileName, error }) => {
        console.log(`   • ${fileName}: ${error}`);
      });
    }

    console.log('\n🎉 Batch upload completed!');
    
    if (this.successfulUploads > 0) {
      console.log('\n📝 Next Steps:');
      console.log('   1. Run the CV scoring script:');
      console.log('      cd src/scripts && node score-all-cvs.js');
      console.log('   2. Check the generated CSV for results');
    }
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      console.log('🚀 CV Batch Uploader');
      console.log('=' .repeat(30));

      // Check if server is running
      const serverRunning = await this.checkServer();
      if (!serverRunning) {
        return;
      }

      // Get CV files
      const cvFiles = await this.getCVFiles();
      if (cvFiles.length === 0) {
        console.log('❌ No PDF files found in cv_sample folder');
        return;
      }

      // Confirm upload
      console.log(`\n⚠️  About to upload ${cvFiles.length} CV files`);
      console.log(`📍 Target: ${this.baseURL}${this.uploadEndpoint}`);
      console.log('⏱️  This may take several minutes...\n');

      // Start upload
      const startTime = Date.now();
      await this.uploadCVsInBatches(cvFiles);
      const endTime = Date.now();
      const durationSeconds = Math.round((endTime - startTime) / 1000);

      // Generate summary
      this.generateSummary();
      console.log(`⏱️  Total time: ${durationSeconds} seconds`);

    } catch (error) {
      console.error('❌ Batch upload failed:', error.message);
      process.exit(1);
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  const uploader = new CVBatchUploader();
  uploader.run().catch(console.error);
}

module.exports = CVBatchUploader; 