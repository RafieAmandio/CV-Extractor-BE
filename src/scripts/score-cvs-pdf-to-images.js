#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');
const pdf2pic = require('pdf2pic');
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

class PDFToImageScoring {
  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.cvFolder = path.join(__dirname, '../../cv_sample');
    this.outputDir = path.join(__dirname, 'output');
    this.jobDefinitions = null;
    this.csvPath = null;
    this.processedCount = 0;
    this.totalCVs = 0;
    this.concurrency = 10; // Process 10 CVs in parallel
    
    // Token tracking
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalTokens = 0;
    this.estimatedCost = 0;
    
    // GPT-4o pricing (as of 2024)
    this.inputTokenPrice = 0.005 / 1000; // $0.005 per 1K input tokens
    this.outputTokenPrice = 0.015 / 1000; // $0.015 per 1K output tokens
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
      case 'tokens': prefix = '🎯'; color = colors.magenta; break;
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
    
    // Add token info to progress bar
    const avgInputTokens = this.processedCount > 0 ? Math.round(this.totalInputTokens / this.processedCount) : 0;
    const avgOutputTokens = this.processedCount > 0 ? Math.round(this.totalOutputTokens / this.processedCount) : 0;
    const currentCost = (this.totalInputTokens * this.inputTokenPrice + this.totalOutputTokens * this.outputTokenPrice).toFixed(4);
    
    process.stdout.write(`\r${colors.cyan}[${bar}] ${percentage}% (${this.processedCount}/${this.totalCVs}) | 📊 Avg: ${avgInputTokens}→${avgOutputTokens} tokens | 💰 $${currentCost}${colors.reset}`);
    
    if (this.processedCount >= this.totalCVs) {
      console.log(); // New line when complete
    }
  }

  async initialize() {
    try {
      this.log('info', 'Initializing PDF to Image Scoring...');
      
      // Create output directory
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // Load job definitions
      const jobDefinitionsPath = path.join(__dirname, 'job-definitions.json');
      const jobData = await fs.readFile(jobDefinitionsPath, 'utf8');
      this.jobDefinitions = JSON.parse(jobData);
      
      // Setup CSV file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      this.csvPath = path.join(this.outputDir, `cv-scores-pdf-images-${timestamp}.csv`);
      
      // Write CSV headers
      const headers = [
        'Candidate Name',
        'Email',
        'Job Role',
        'Score',
        'Skills Match',
        'Experience Match', 
        'Education Match',
        'Key Strengths',
        'Recommendations',
        'Filename'
      ].join(',') + '\n';
      
      await fs.writeFile(this.csvPath, headers, 'utf8');
      
      this.log('success', 'Initialization complete', {
        jobs: this.jobDefinitions.jobs.length,
        csvFile: path.basename(this.csvPath)
      });

    } catch (error) {
      this.log('error', 'Initialization failed', { error: error.message });
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
   * Convert PDF to images using pdf2pic
   */
  async convertPDFToImages(filepath) {
    try {
      const convert = pdf2pic.fromPath(filepath, {
        density: 200, // DPI
        saveFilename: "temp",
        savePath: "/tmp/",
        format: "png",
        width: 2048,
        height: 2965
      });

      // Convert all pages
      const results = await convert.bulk(-1, { responseType: "buffer" });
      
      return results.map(result => result.buffer);
    } catch (error) {
      throw new Error(`PDF to image conversion failed: ${error.message}`);
    }
  }

  /**
   * Convert PDF to images and score against all jobs using OpenAI
   */
  async scoreCV(cvFile) {
    const startTime = Date.now();
    
    try {
      this.log('progress', `Processing ${cvFile.filename}...`);
      
      // Step 1: Convert PDF to images
      const imageBuffers = await this.convertPDFToImages(cvFile.filepath);
      
      if (imageBuffers.length === 0) {
        throw new Error('No images generated from PDF');
      }

      // Step 2: Convert images to base64 data URLs
      const imageDataUrls = imageBuffers.map(buffer => 
        `data:image/png;base64,${buffer.toString('base64')}`
      );

      // Step 3: Create the prompt with job descriptions
      const prompt = `You are an expert CV analyzer and job matching specialist. 

TASK: Analyze the CV images provided and score the candidate against ALL of the following job roles. Return precise scores and detailed analysis.

JOB ROLES TO EVALUATE:
${JSON.stringify(this.jobDefinitions.jobs, null, 2)}

INSTRUCTIONS:
1. Carefully read ALL pages of the CV from the images
2. Extract candidate information (name, email, skills, experience, education)
3. Score the candidate against EACH job role (0-100 with 2-3 decimal places)
4. Provide detailed analysis for each match

RETURN FORMAT (JSON):
{
  "candidate": {
    "name": "Full Name",
    "email": "email@example.com"
  },
  "jobMatches": [
    {
      "jobId": "job-id",
      "jobTitle": "Job Title",
      "overallScore": 75.47,
      "skillsMatch": 72.30,
      "experienceMatch": 78.90,
      "educationMatch": 85.00,
      "keyStrengths": "Strong technical skills, relevant experience...",
      "recommendations": "Develop cloud expertise, gain leadership experience..."
    }
  ]
}

SCORING GUIDELINES:
- Use precise decimal scores (e.g., 73.47, 81.92, 65.13)
- Consider ALL requirements: skills, experience, education, job level
- Be discriminating - scores should reflect actual fit quality
- Factor in years of experience, education level, skill overlap
- Consider career progression and leadership potential

Read the CV images carefully and provide comprehensive analysis:`;

      // Step 4: Create content array with text and images
      const content = [
        {
          type: "text",
          text: prompt
        }
      ];

      // Add all CV images
      imageDataUrls.forEach(dataUrl => {
        content.push({
          type: "image_url",
          image_url: {
            url: dataUrl,
            detail: "high"
          }
        });
      });

      // Step 5: Call OpenAI with images
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: content }],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      // Step 6: Track token usage
      const usage = response.usage;
      this.updateTokenStats(usage);
      
      const result = JSON.parse(response.choices[0].message.content);
      
      // Step 7: Write results to CSV immediately
      await this.writeResultsToCSV(result, cvFile.filename);
      
      this.processedCount++;
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Log with token information
      this.log('success', `✅ ${cvFile.filename}`, {
        candidate: result.candidate?.name || 'Unknown',
        matches: result.jobMatches?.length || 0,
        pages: imageBuffers.length,
        time: `${processingTime}s`,
        tokens: {
          input: usage?.prompt_tokens || 0,
          output: usage?.completion_tokens || 0,
          total: usage?.total_tokens || 0,
          cost: `$${this.calculateCost(usage?.prompt_tokens || 0, usage?.completion_tokens || 0).toFixed(4)}`
        }
      });

      this.showProgress();

    } catch (error) {
      this.processedCount++;
      this.log('error', `❌ ${cvFile.filename}`, { error: error.message });
      this.showProgress();
    }
  }

  /**
   * Write scoring results to CSV immediately
   */
  async writeResultsToCSV(result, filename) {
    try {
      const candidate = result.candidate || {};
      const jobMatches = result.jobMatches || [];

      for (const match of jobMatches) {
        const row = [
          `"${(candidate.name || 'Unknown').replace(/"/g, '""')}"`,
          `"${(candidate.email || '').replace(/"/g, '""')}"`,
          `"${(match.jobTitle || match.jobId || 'Unknown').replace(/"/g, '""')}"`,
          (match.overallScore || 0).toFixed(2),
          (match.skillsMatch || 0).toFixed(2),
          (match.experienceMatch || 0).toFixed(2),
          (match.educationMatch || 0).toFixed(2),
          `"${(match.keyStrengths || '').replace(/"/g, '""')}"`,
          `"${(match.recommendations || '').replace(/"/g, '""')}"`,
          `"${filename.replace(/"/g, '""')}"`
        ].join(',') + '\n';

        await fs.appendFile(this.csvPath, row, 'utf8');
      }
    } catch (error) {
      this.log('error', 'Failed to write to CSV', { error: error.message });
    }
  }

  /**
   * Process CVs in parallel
   */
  async processCVsInParallel(cvFiles) {
    this.log('info', `🚀 Starting parallel processing with ${this.concurrency} concurrent CVs`);
    
    // Create semaphore for concurrency control
    const semaphore = new Array(this.concurrency).fill(null);
    let index = 0;
    
    const processNext = async () => {
      while (index < cvFiles.length) {
        const currentIndex = index++;
        await this.scoreCV(cvFiles[currentIndex]);
      }
    };

    // Start all workers
    const workers = semaphore.map(() => processNext());
    await Promise.allSettled(workers);
    
    this.log('success', 'All CVs processed!');
  }

  /**
   * Main execution
   */
  async run() {
    try {
      // Header
      console.log(`${colors.bright}${colors.magenta}`);
      console.log('╔═══════════════════════════════════════════════╗');
      console.log('║       🖼️  PDF TO IMAGES SCORING 🖼️           ║');
      console.log('║    PDF → Images → OpenAI → CSV (Working!)    ║');
      console.log('╚═══════════════════════════════════════════════╝');
      console.log(colors.reset);
      
      await this.initialize();
      
      const cvFiles = await this.getCVFiles();
      
      if (cvFiles.length === 0) {
        this.log('warning', 'No PDF files found in cv_sample folder');
        return;
      }

      console.log(`\n${colors.yellow}📋 Processing Details:${colors.reset}`);
      console.log(`${colors.yellow}   • CVs to process: ${cvFiles.length}${colors.reset}`);
      console.log(`${colors.yellow}   • Job roles: ${this.jobDefinitions.jobs.length}${colors.reset}`);
      console.log(`${colors.yellow}   • Concurrency: ${this.concurrency}${colors.reset}`);
      console.log(`${colors.yellow}   • Method: PDF → Images → OpenAI${colors.reset}`);
      console.log(`${colors.yellow}   • Output: Real-time CSV writing${colors.reset}\n`);

      const startTime = Date.now();
      await this.processCVsInParallel(cvFiles);
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Final results
      console.log(`\n${colors.bright}${colors.green}`);
      console.log('🎉 PDF TO IMAGES SCORING COMPLETE!');
      console.log('═'.repeat(40));
      console.log(colors.reset);
      
      console.log(`${colors.cyan}✅ Total CVs: ${this.processedCount}/${this.totalCVs}${colors.reset}`);
      console.log(`${colors.cyan}⏱️  Total Time: ${totalTime}s${colors.reset}`);
      console.log(`${colors.cyan}🚀 Rate: ${(this.processedCount / totalTime * 60).toFixed(1)} CV/min${colors.reset}`);
      console.log(`${colors.green}📊 Results: ${this.csvPath}${colors.reset}`);

      // Token usage statistics
      if (this.processedCount > 0) {
        console.log(`\n${colors.bright}${colors.magenta}📊 TOKEN USAGE STATISTICS${colors.reset}`);
        console.log('═'.repeat(40));
        
        const avgInputTokens = Math.round(this.totalInputTokens / this.processedCount);
        const avgOutputTokens = Math.round(this.totalOutputTokens / this.processedCount);
        const avgTotalTokens = Math.round(this.totalTokens / this.processedCount);
        const avgCostPerCV = (this.estimatedCost / this.processedCount).toFixed(4);
        
        console.log(`${colors.magenta}🔢 Total Tokens:${colors.reset}`);
        console.log(`${colors.magenta}   • Input Tokens: ${this.totalInputTokens.toLocaleString()} (avg: ${avgInputTokens}/CV)${colors.reset}`);
        console.log(`${colors.magenta}   • Output Tokens: ${this.totalOutputTokens.toLocaleString()} (avg: ${avgOutputTokens}/CV)${colors.reset}`);
        console.log(`${colors.magenta}   • Total Tokens: ${this.totalTokens.toLocaleString()} (avg: ${avgTotalTokens}/CV)${colors.reset}`);
        
        console.log(`\n${colors.magenta}💰 Cost Analysis:${colors.reset}`);
        console.log(`${colors.magenta}   • Input Cost: $${(this.totalInputTokens * this.inputTokenPrice).toFixed(4)} (@$${this.inputTokenPrice * 1000}/1K tokens)${colors.reset}`);
        console.log(`${colors.magenta}   • Output Cost: $${(this.totalOutputTokens * this.outputTokenPrice).toFixed(4)} (@$${this.outputTokenPrice * 1000}/1K tokens)${colors.reset}`);
        console.log(`${colors.magenta}   • Total Cost: $${this.estimatedCost.toFixed(4)}${colors.reset}`);
        console.log(`${colors.magenta}   • Cost per CV: $${avgCostPerCV}${colors.reset}`);
        
        // Token efficiency metrics
        const inputOutputRatio = (this.totalOutputTokens / this.totalInputTokens).toFixed(2);
        const tokensPerSecond = (this.totalTokens / totalTime).toFixed(1);
        
        console.log(`\n${colors.magenta}⚡ Efficiency Metrics:${colors.reset}`);
        console.log(`${colors.magenta}   • Input/Output Ratio: 1:${inputOutputRatio}${colors.reset}`);
        console.log(`${colors.magenta}   • Tokens per Second: ${tokensPerSecond}${colors.reset}`);
        console.log(`${colors.magenta}   • Estimated Cost per 100 CVs: $${(this.estimatedCost / this.processedCount * 100).toFixed(2)}${colors.reset}`);
        console.log(`${colors.magenta}   • Estimated Cost per 1000 CVs: $${(this.estimatedCost / this.processedCount * 1000).toFixed(2)}${colors.reset}`);
      }

    } catch (error) {
      this.log('error', 'PDF to Images scoring failed', { error: error.message });
      console.error(`${colors.red}❌ Fatal Error: ${error.message}${colors.reset}`);
      process.exit(1);
    }
  }

  /**
   * Calculate estimated cost based on token usage
   */
  calculateCost(inputTokens, outputTokens) {
    const inputCost = inputTokens * this.inputTokenPrice;
    const outputCost = outputTokens * this.outputTokenPrice;
    return inputCost + outputCost;
  }

  /**
   * Update token statistics
   */
  updateTokenStats(usage) {
    if (usage) {
      this.totalInputTokens += usage.prompt_tokens || 0;
      this.totalOutputTokens += usage.completion_tokens || 0;
      this.totalTokens += usage.total_tokens || 0;
      this.estimatedCost += this.calculateCost(usage.prompt_tokens || 0, usage.completion_tokens || 0);
    }
  }
}

// Run the script
if (require.main === module) {
  const scorer = new PDFToImageScoring();
  scorer.run().catch(console.error);
}

module.exports = PDFToImageScoring; 