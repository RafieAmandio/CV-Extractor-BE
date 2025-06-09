const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const CV_FOLDER_PATH = process.argv[2] || './cv-samples'; // Default folder or from command line
const DELAY_BETWEEN_UPLOADS = 1000; // 1 second delay between uploads
const MAX_CONCURRENT_UPLOADS = 3; // Maximum concurrent uploads

class BatchCVUploader {
  constructor(folderPath, apiUrl = API_BASE_URL) {
    this.folderPath = folderPath;
    this.apiUrl = apiUrl;
    this.results = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Check if the folder exists and contains PDF files
   */
  validateFolder() {
    if (!fs.existsSync(this.folderPath)) {
      throw new Error(`Folder not found: ${this.folderPath}`);
    }

    const files = this.getPDFFiles();
    if (files.length === 0) {
      throw new Error(`No PDF files found in: ${this.folderPath}`);
    }

    console.log(`📁 Found ${files.length} PDF files in: ${this.folderPath}`);
    return files;
  }

  /**
   * Get all PDF files from the folder
   */
  getPDFFiles() {
    const files = fs.readdirSync(this.folderPath);
    return files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.pdf';
    }).map(file => ({
      filename: file,
      fullPath: path.join(this.folderPath, file),
      size: fs.statSync(path.join(this.folderPath, file)).size
    }));
  }

  /**
   * Upload a single CV file
   */
  async uploadSingleCV(fileInfo) {
    try {
      console.log(`📤 Uploading: ${fileInfo.filename} (${this.formatFileSize(fileInfo.size)})`);

      const formData = new FormData();
      formData.append('cv', fs.createReadStream(fileInfo.fullPath), {
        filename: fileInfo.filename,
        contentType: 'application/pdf'
      });

      const response = await axios.post(`${this.apiUrl}/api/cv/extract`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 30000, // 30 second timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      if (response.data.success) {
        console.log(`✅ Success: ${fileInfo.filename}`);
        console.log(`   📝 Extracted: ${response.data.data.personalInfo?.name || 'Unknown Name'}`);
        console.log(`   📧 Email: ${response.data.data.personalInfo?.email || 'No email'}`);
        this.results.successful++;
        return { success: true, filename: fileInfo.filename, data: response.data };
      } else {
        throw new Error(response.data.message || 'Unknown error');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      console.log(`❌ Failed: ${fileInfo.filename} - ${errorMessage}`);
      this.results.failed++;
      this.results.errors.push({
        filename: fileInfo.filename,
        error: errorMessage
      });
      return { success: false, filename: fileInfo.filename, error: errorMessage };
    }
  }

  /**
   * Upload files with rate limiting
   */
  async uploadWithDelay(files) {
    console.log(`\n🚀 Starting sequential upload of ${files.length} files...\n`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`📊 Progress: ${i + 1}/${files.length}`);
      
      await this.uploadSingleCV(file);
      
      // Add delay between uploads (except for the last file)
      if (i < files.length - 1) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_UPLOADS}ms before next upload...\n`);
        await this.sleep(DELAY_BETWEEN_UPLOADS);
      }
    }
  }

  /**
   * Upload files concurrently with limited concurrency
   */
  async uploadConcurrently(files) {
    console.log(`\n🚀 Starting concurrent upload of ${files.length} files (max ${MAX_CONCURRENT_UPLOADS} at once)...\n`);
    
    const results = [];
    for (let i = 0; i < files.length; i += MAX_CONCURRENT_UPLOADS) {
      const batch = files.slice(i, i + MAX_CONCURRENT_UPLOADS);
      console.log(`📊 Processing batch ${Math.floor(i / MAX_CONCURRENT_UPLOADS) + 1}: ${batch.map(f => f.filename).join(', ')}`);
      
      const batchPromises = batch.map(file => this.uploadSingleCV(file));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches (except for the last batch)
      if (i + MAX_CONCURRENT_UPLOADS < files.length) {
        console.log(`⏳ Waiting ${DELAY_BETWEEN_UPLOADS}ms before next batch...\n`);
        await this.sleep(DELAY_BETWEEN_UPLOADS);
      }
    }
    
    return results;
  }

  /**
   * Test connection to the API
   */
  async testConnection() {
    try {
      console.log('🔍 Testing API connection...');
      const response = await axios.get(`${this.apiUrl}/api/cv?limit=1`, { timeout: 5000 });
      if (response.status === 200) {
        console.log('✅ API connection successful');
        return true;
      }
    } catch (error) {
      console.log(`❌ API connection failed: ${error.message}`);
      console.log(`   Make sure your server is running at: ${this.apiUrl}`);
      return false;
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Print final results
   */
  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 UPLOAD RESULTS');
    console.log('='.repeat(60));
    console.log(`📁 Folder: ${this.folderPath}`);
    console.log(`📄 Total files: ${this.results.total}`);
    console.log(`✅ Successful: ${this.results.successful}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`📈 Success rate: ${((this.results.successful / this.results.total) * 100).toFixed(1)}%`);

    if (this.results.errors.length > 0) {
      console.log('\n❌ Failed uploads:');
      this.results.errors.forEach(error => {
        console.log(`   • ${error.filename}: ${error.error}`);
      });
    }

    console.log('\n🎉 Batch upload completed!');
  }

  /**
   * Main upload process
   */
  async upload(useConcurrent = false) {
    try {
      // Test API connection
      const connected = await this.testConnection();
      if (!connected) {
        return;
      }

      // Validate folder and get files
      const files = this.validateFolder();
      this.results.total = files.length;

      // Show file list
      console.log('\n📋 Files to upload:');
      files.forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.filename} (${this.formatFileSize(file.size)})`);
      });

      // Confirm upload
      if (process.env.NODE_ENV !== 'test') {
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        const answer = await new Promise(resolve => {
          rl.question('\n❓ Do you want to proceed with the upload? (y/N): ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
          console.log('❌ Upload cancelled by user');
          return;
        }
      }

      // Upload files
      if (useConcurrent) {
        await this.uploadConcurrently(files);
      } else {
        await this.uploadWithDelay(files);
      }

      // Print results
      this.printResults();

    } catch (error) {
      console.error('💥 Error during batch upload:', error.message);
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  console.log('🚀 CV Batch Uploader');
  console.log('====================');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const folderPath = args[0] || './cv-samples';
  const concurrent = args.includes('--concurrent') || args.includes('-c');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Usage: node upload-cvs-batch.js [folder_path] [options]

Arguments:
  folder_path    Path to folder containing PDF files (default: ./cv-samples)

Options:
  --concurrent, -c    Upload files concurrently (faster but more resource intensive)
  --help, -h          Show this help message

Examples:
  node upload-cvs-batch.js                    # Upload from ./cv-samples folder
  node upload-cvs-batch.js ./my-cvs           # Upload from ./my-cvs folder
  node upload-cvs-batch.js ./my-cvs -c        # Upload concurrently

Environment:
  API_URL: ${API_BASE_URL}
  Max file size: 5MB
  Supported formats: PDF only
    `);
    return;
  }

  console.log(`📁 Target folder: ${folderPath}`);
  console.log(`🔄 Upload mode: ${concurrent ? 'Concurrent' : 'Sequential'}`);
  console.log(`🌐 API URL: ${API_BASE_URL}`);

  const uploader = new BatchCVUploader(folderPath);
  await uploader.upload(concurrent);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = BatchCVUploader; 