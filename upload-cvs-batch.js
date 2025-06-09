#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const readline = require('readline');

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const UPLOAD_ENDPOINT = '/api/cv/extract';
const CV_FOLDER = './cv_sample';
const CONCURRENT_UPLOADS = 4; // Number of concurrent uploads
const REQUEST_TIMEOUT = 120000; // 2 minutes timeout per request

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Statistics tracking
const stats = {
  total: 0,
  uploaded: 0,
  failed: 0,
  skipped: 0,
  startTime: null,
  errors: []
};

/**
 * Print colored console output
 */
function printColor(text, color = 'reset') {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration for display
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Test API connection
 */
async function testAPIConnection() {
  try {
    printColor('🔍 Testing API connection...', 'blue');
    const response = await axios.get(API_BASE_URL, {
      timeout: 10000
    });
    printColor('✅ API connection successful', 'green');
    return true;
  } catch (error) {
    printColor('❌ API connection failed:', 'red');
    printColor(`   ${error.message}`, 'red');
    printColor(`   Make sure the server is running on ${API_BASE_URL}`, 'yellow');
    return false;
  }
}

/**
 * Get list of PDF files from the CV folder
 */
function getPDFFiles() {
  try {
    if (!fs.existsSync(CV_FOLDER)) {
      throw new Error(`CV folder not found: ${CV_FOLDER}`);
    }

    const files = fs.readdirSync(CV_FOLDER)
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => {
        const filePath = path.join(CV_FOLDER, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return files;
  } catch (error) {
    printColor(`❌ Error reading CV folder: ${error.message}`, 'red');
    return [];
  }
}

/**
 * Upload a single CV file
 */
async function uploadCV(file, index, total) {
  const formData = new FormData();
  
  try {
    // Read file and add to form data
    const fileStream = fs.createReadStream(file.path);
    formData.append('cv', fileStream, {
      filename: file.name,
      contentType: 'application/pdf'
    });

    printColor(`📤 [${index + 1}/${total}] Uploading: ${file.name} (${formatFileSize(file.size)})`, 'cyan');

    // Upload file
    const response = await axios.post(`${API_BASE_URL}${UPLOAD_ENDPOINT}`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: REQUEST_TIMEOUT,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    if (response.data.success) {
      stats.uploaded++;
      printColor(`✅ [${index + 1}/${total}] Success: ${file.name}`, 'green');
      
      // Log extracted data summary if available
      if (response.data.data && response.data.data.personalInfo) {
        const name = response.data.data.personalInfo.name || 'Name not found';
        const email = response.data.data.personalInfo.email || 'Email not found';
        printColor(`   👤 Name: ${name}`, 'white');
        printColor(`   📧 Email: ${email}`, 'white');
      }
      
      return { success: true, file: file.name, data: response.data };
    } else {
      stats.failed++;
      const error = `Upload failed: ${response.data.message || 'Unknown error'}`;
      printColor(`❌ [${index + 1}/${total}] Failed: ${file.name} - ${error}`, 'red');
      stats.errors.push({ file: file.name, error });
      return { success: false, file: file.name, error };
    }
  } catch (error) {
    stats.failed++;
    let errorMessage = error.message;
    
    if (error.response) {
      errorMessage = `HTTP ${error.response.status}: ${error.response.data?.message || error.response.statusText}`;
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused - API server not running?';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Request timeout - file too large or server overloaded?';
    }
    
    printColor(`❌ [${index + 1}/${total}] Failed: ${file.name} - ${errorMessage}`, 'red');
    stats.errors.push({ file: file.name, error: errorMessage });
    return { success: false, file: file.name, error: errorMessage };
  }
}

/**
 * Upload files with concurrency control
 */
async function uploadFilesWithConcurrency(files, concurrency = CONCURRENT_UPLOADS) {
  const results = [];
  
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchPromises = batch.map((file, batchIndex) => 
      uploadCV(file, i + batchIndex, files.length)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to avoid overwhelming the server
    if (i + concurrency < files.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Upload files sequentially (one by one)
 */
async function uploadFilesSequentially(files) {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const result = await uploadCV(files[i], i, files.length);
    results.push(result);
    
    // Small delay between uploads
    if (i < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

/**
 * Ask user for confirmation
 */
async function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith('y'));
    });
  });
}

/**
 * Print final statistics
 */
function printStatistics() {
  const duration = Date.now() - stats.startTime;
  const successRate = stats.total > 0 ? Math.round((stats.uploaded / stats.total) * 100) : 0;

  printColor('\n📊 UPLOAD STATISTICS', 'magenta');
  printColor('='.repeat(50), 'magenta');
  printColor(`📁 Total files: ${stats.total}`, 'white');
  printColor(`✅ Successfully uploaded: ${stats.uploaded}`, 'green');
  printColor(`❌ Failed uploads: ${stats.failed}`, 'red');
  printColor(`⏭️ Skipped files: ${stats.skipped}`, 'yellow');
  printColor(`📈 Success rate: ${successRate}%`, 'cyan');
  printColor(`⏱️ Total time: ${formatDuration(duration)}`, 'blue');

  if (stats.uploaded > 0) {
    const avgTimePerFile = duration / stats.uploaded;
    printColor(`⚡ Average time per upload: ${formatDuration(avgTimePerFile)}`, 'blue');
  }

  // Print errors if any
  if (stats.errors.length > 0) {
    printColor('\n❌ ERRORS SUMMARY', 'red');
    printColor('='.repeat(30), 'red');
    stats.errors.forEach((err, index) => {
      printColor(`${index + 1}. ${err.file}: ${err.error}`, 'red');
    });
  }

  printColor('\n🎉 Batch upload completed!', 'green');
}

/**
 * Main function
 */
async function main() {
  printColor('🚀 CV Batch Upload Tool', 'magenta');
  printColor('='.repeat(30), 'magenta');

  // Test API connection
  const apiAvailable = await testAPIConnection();
  if (!apiAvailable) {
    process.exit(1);
  }

  // Get PDF files
  const files = getPDFFiles();
  if (files.length === 0) {
    printColor('❌ No PDF files found in the CV folder', 'red');
    process.exit(1);
  }

  // Display found files
  printColor(`\n📂 Found ${files.length} PDF files:`, 'blue');
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  printColor(`📊 Total size: ${formatFileSize(totalSize)}`, 'blue');

  // Show first few files as preview
  const previewCount = Math.min(5, files.length);
  files.slice(0, previewCount).forEach((file, index) => {
    printColor(`   ${index + 1}. ${file.name} (${formatFileSize(file.size)})`, 'white');
  });

  if (files.length > previewCount) {
    printColor(`   ... and ${files.length - previewCount} more files`, 'yellow');
  }

  // Ask for confirmation
  const confirmed = await askConfirmation(`\n❓ Do you want to upload all ${files.length} files? (y/N): `);
  if (!confirmed) {
    printColor('⏹️ Upload cancelled by user', 'yellow');
    process.exit(0);
  }

  // Ask for upload mode
  const concurrent = await askConfirmation(`\n⚡ Use concurrent uploads (faster but may overwhelm server)? (y/N): `);
  
  // Initialize statistics
  stats.total = files.length;
  stats.startTime = Date.now();

  printColor(`\n🔄 Starting ${concurrent ? 'concurrent' : 'sequential'} upload...`, 'blue');
  printColor(`📡 Endpoint: ${API_BASE_URL}${UPLOAD_ENDPOINT}`, 'blue');
  printColor(`⚙️ Mode: ${concurrent ? `Concurrent (${CONCURRENT_UPLOADS} at a time)` : 'Sequential'}`, 'blue');
  printColor(`⏰ Timeout: ${REQUEST_TIMEOUT / 1000}s per file`, 'blue');

  // Upload files
  try {
    const results = concurrent 
      ? await uploadFilesWithConcurrency(files, CONCURRENT_UPLOADS)
      : await uploadFilesSequentially(files);

    // Print final statistics
    printStatistics();

  } catch (error) {
    printColor(`\n💥 Unexpected error during batch upload: ${error.message}`, 'red');
    printStatistics();
    process.exit(1);
  }
}

// Handle process interruption
process.on('SIGINT', () => {
  printColor('\n\n⏹️ Upload interrupted by user', 'yellow');
  if (stats.startTime) {
    printStatistics();
  }
  process.exit(0);
});

// Check if required dependencies are available
const requiredPackages = ['form-data', 'axios'];
requiredPackages.forEach(pkg => {
  try {
    require.resolve(pkg);
  } catch (error) {
    printColor(`❌ Missing required package: ${pkg}`, 'red');
    printColor(`📦 Please install it with: npm install ${pkg}`, 'yellow');
    process.exit(1);
  }
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    printColor(`💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { uploadCV, getPDFFiles, testAPIConnection }; 