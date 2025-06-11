#!/usr/bin/env node

const mongoose = require('mongoose');
const CVData = require('../models/cvData.model');
const Job = require('../models/job.model');
const Match = require('../models/match.model');
const openaiService = require('../services/openaiService');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

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

class MatchCalculator {
  constructor() {
    this.processedCount = 0;
    this.totalMatches = 0;
    this.startTime = Date.now();
  }

  async calculateAllMatches() {
    try {
      console.log(`${colors.blue}🔗 Connecting to MongoDB...${colors.reset}`);
      await mongoose.connect(process.env.MONGODB_URI);
      console.log(`${colors.green}✅ Connected to MongoDB${colors.reset}\n`);

      // Get all CVs and Jobs
      console.log(`${colors.cyan}📊 Fetching data from database...${colors.reset}`);
      const cvs = await CVData.find().select('-rawText -embedding');
      const jobs = await Job.find({ active: true });

      console.log(`${colors.green}📋 Found ${cvs.length} CVs and ${jobs.length} active jobs${colors.reset}`);
      console.log(`${colors.yellow}🎯 Will calculate ${cvs.length * jobs.length} total matches${colors.reset}\n`);

      // Clear existing matches (optional)
      const existingMatches = await Match.countDocuments();
      if (existingMatches > 0) {
        console.log(`${colors.yellow}🗑️  Found ${existingMatches} existing matches. Clearing...${colors.reset}`);
        await Match.deleteMany({});
        console.log(`${colors.green}✅ Cleared existing matches${colors.reset}\n`);
      }

      console.log(`${colors.magenta}🚀 Starting match calculation...${colors.reset}\n`);

      // Process each CV
      for (let i = 0; i < cvs.length; i++) {
        const cv = cvs[i];
        
        try {
          console.log(`${colors.cyan}👤 Processing CV ${i + 1}/${cvs.length}: ${cv.personalInfo.name || 'Unknown'}${colors.reset}`);

          // Calculate matches for all jobs at once (more efficient)
          const matchResults = await openaiService.calculateMultipleJobMatches({
            cv: cv.toObject(),
            jobs: jobs.map(job => ({
              id: job._id.toString(),
              title: job.title,
              company: job.company,
              description: job.description,
              requirements: job.requirements,
              skills: job.skills,
              responsibilities: job.responsibilities
            }))
          });

          // Save matches to database
          const matchDocs = matchResults.map(result => ({
            cvId: cv._id,
            jobId: new mongoose.Types.ObjectId(result.jobId || jobs.find(j => j.title === result.jobTitle)?._id),
            score: result.score,
            details: result.details,
            recommendations: result.recommendations,
            createdAt: new Date()
          }));

          await Match.insertMany(matchDocs);
          
          this.processedCount++;
          this.totalMatches += matchDocs.length;

          // Progress update
          const avgScore = matchResults.reduce((sum, r) => sum + r.score, 0) / matchResults.length;
          console.log(`${colors.green}  ✅ Calculated ${matchDocs.length} matches (avg: ${avgScore.toFixed(1)}%)${colors.reset}`);

          // Show progress every 10 CVs
          if (this.processedCount % 10 === 0) {
            const elapsed = (Date.now() - this.startTime) / 1000;
            const rate = this.processedCount / elapsed;
            const eta = (cvs.length - this.processedCount) / rate;
            
            console.log(`${colors.yellow}📈 Progress: ${this.processedCount}/${cvs.length} CVs | ${rate.toFixed(1)} CV/s | ETA: ${Math.round(eta)}s${colors.reset}\n`);
          }

        } catch (error) {
          console.log(`${colors.red}❌ Failed to process CV ${cv.personalInfo.name || 'Unknown'}: ${error.message}${colors.reset}`);
        }
      }

      // Final summary
      const totalTime = (Date.now() - this.startTime) / 1000;
      console.log(`\n${colors.cyan}📊 FINAL SUMMARY:${colors.reset}`);
      console.log(`${colors.green}✅ CVs Processed: ${this.processedCount}/${cvs.length}${colors.reset}`);
      console.log(`${colors.green}✅ Total Matches Created: ${this.totalMatches}${colors.reset}`);
      console.log(`${colors.blue}⏱️  Total Time: ${Math.round(totalTime)}s${colors.reset}`);
      console.log(`${colors.blue}📈 Average Rate: ${(this.processedCount / totalTime).toFixed(1)} CVs/second${colors.reset}`);

      // Show top matches
      console.log(`\n${colors.magenta}🏆 TOP MATCHES PREVIEW:${colors.reset}`);
      const topMatches = await Match.find()
        .sort({ score: -1 })
        .limit(5)
        .populate('cvId', 'personalInfo.name fileName')
        .populate('jobId', 'title company');

      topMatches.forEach((match, index) => {
        console.log(`${colors.yellow}${index + 1}. ${match.cvId?.personalInfo?.name || 'Unknown'} → ${match.jobId?.title} (${match.score.toFixed(1)}%)${colors.reset}`);
      });

    } catch (error) {
      console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
      process.exit(1);
    } finally {
      await mongoose.disconnect();
      console.log(`\n${colors.blue}🔌 Disconnected from MongoDB${colors.reset}`);
    }
  }
}

// Run the script
if (require.main === module) {
  const calculator = new MatchCalculator();
  calculator.calculateAllMatches();
}

module.exports = MatchCalculator; 