const CVData = require('../models/cvData.model');
const Job = require('../models/job.model');
const Match = require('../models/match.model');
const logger = require('../utils/logger');
const openaiService = require('./openaiService');

class MatchingService {
  /**
   * Check if a cached match is valid
   * @param {Object} match - Match document
   * @param {Object} cv - CV document
   * @param {Object} job - Job document
   * @returns {boolean} - Whether cache is valid
   */
  isCacheValid(match, cv, job) {
    // Check if match record exists
    if (!match) return false;
    
    // Check if CV or Job has been updated after the match was calculated
    const cvUpdateTime = cv.updatedAt || cv.extractedAt;
    const jobUpdateTime = job.updatedAt || job.createdAt;
    
    if (match.cvVersion < cvUpdateTime || match.jobVersion < jobUpdateTime) {
      logger.info('Match cache invalidated due to CV or Job update', {
        cvId: cv._id,
        jobId: job._id
      });
      return false;
    }
    
    // Check if cache has expired based on cacheTime
    const cacheExpiryTime = new Date(match.updatedAt.getTime() + (match.cacheTime * 1000));
    if (new Date() > cacheExpiryTime) {
      logger.info('Match cache expired', {
        cvId: cv._id,
        jobId: job._id,
        updatedAt: match.updatedAt,
        expiryTime: cacheExpiryTime
      });
      return false;
    }
    
    return true;
  }

  /**
   * Calculate matching score between a CV and a job
   * @param {Object} cv - CV data object
   * @param {Object} job - Job data object
   * @returns {Promise<Object>} - Matching score and details
   */
  async calculateMatchingScore(cv, job) {
    try {
      // Check for cached match
      let cachedMatch = await Match.findOne({ cvId: cv._id, jobId: job._id });
      
      // If we have a valid cached match, return it
      if (this.isCacheValid(cachedMatch, cv, job)) {
        logger.info('Using cached match score', { 
          cvId: cv._id,
          jobId: job._id,
          score: cachedMatch.score
        });
        
        return {
          score: cachedMatch.score,
          details: cachedMatch.details,
          recommendations: cachedMatch.recommendations,
          fromCache: true
        };
      }
      
      logger.info('Calculating new match score', { 
        cvId: cv._id,
        jobId: job._id
      });

      // Extract relevant information from CV
      const cvSkills = cv.skills ? cv.skills.flatMap(skill => skill.skills).filter(Boolean) : [];
      const cvExperience = cv.experience || [];
      const cvEducation = cv.education || [];
      
      // Extract job requirements
      const jobSkills = job.skills || [];
      const jobRequirements = job.requirements || [];
      
      // Use OpenAI to calculate matching score
      const matchResult = await openaiService.calculateJobMatch({
        cv: {
          skills: cvSkills,
          experience: cvExperience,
          education: cvEducation,
          personalInfo: cv.personalInfo,
          summary: cv.personalInfo?.summary
        },
        job: {
          title: job.title,
          description: job.description,
          skills: jobSkills,
          requirements: jobRequirements,
          responsibilities: job.responsibilities,
          experienceLevel: job.experienceLevel,
          educationLevel: job.educationLevel
        }
      });

      // Store match in database
      if (cachedMatch) {
        // Update existing record
        cachedMatch.score = matchResult.score;
        cachedMatch.details = matchResult.details;
        cachedMatch.recommendations = matchResult.recommendations;
        cachedMatch.cvVersion = cv.updatedAt || cv.extractedAt;
        cachedMatch.jobVersion = job.updatedAt || job.createdAt;
        cachedMatch.updatedAt = new Date();
        await cachedMatch.save();
      } else {
        // Create new match record
        await Match.create({
          cvId: cv._id,
          jobId: job._id,
          score: matchResult.score,
          details: matchResult.details,
          recommendations: matchResult.recommendations,
          cvVersion: cv.updatedAt || cv.extractedAt,
          jobVersion: job.updatedAt || job.createdAt,
        });
      }

      logger.info('Match score calculated and cached', { 
        cvId: cv._id,
        jobId: job._id,
        score: matchResult.score
      });
      
      return matchResult;
    } catch (error) {
      logger.error('Error calculating match score', {
        cvId: cv._id,
        jobId: job._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find the top matching CVs for a job
   * @param {string} jobId - Job ID to match against
   * @param {number} limit - Maximum number of matches to return
   * @param {boolean} forceRefresh - Whether to force recalculation of all scores
   * @returns {Promise<Array>} - Array of CV matches with scores
   */
  async findTopCVsForJob(jobId, limit = 10, forceRefresh = false) {
    try {
      // Find the job
      const job = await Job.findById(jobId);
      if (!job) {
        throw new Error('Job not found');
      }
      
      // Get all CVs (could be optimized with pre-filtering)
      const cvs = await CVData.find().select('-rawText');
      
      // Check if we have cached matches and are not forcing refresh
      if (!forceRefresh) {
        // Try to get from cache first
        const cachedMatches = await Match.find({ jobId })
          .sort({ score: -1 })
          .limit(cvs.length); // Get all matches for this job
        
        // If we have enough cached matches that are valid, use them
        if (cachedMatches.length > 0) {
          const validMatches = [];
          
          // Verify each cached match and collect valid ones
          for (const match of cachedMatches) {
            const cv = cvs.find(c => c._id.toString() === match.cvId.toString());
            if (cv && this.isCacheValid(match, cv, job)) {
              validMatches.push({
                cv: {
                  id: cv._id,
                  name: cv.personalInfo?.name,
                  email: cv.personalInfo?.email
                },
                score: match.score,
                matchDetails: match.details,
                fromCache: true
              });
            }
          }
          
          // If we have enough valid matches, return them
          if (validMatches.length >= limit) {
            const sortedMatches = validMatches.sort((a, b) => b.score - a.score).slice(0, limit);
            logger.info('Found top CV matches for job from cache', { 
              jobId,
              count: sortedMatches.length
            });
            return sortedMatches;
          }
          
          logger.info('Some cached matches found but not enough valid ones', {
            jobId,
            validCount: validMatches.length,
            requiredCount: limit
          });
        }
      }
      
      // If forceRefresh is true or we don't have enough valid cached matches,
      // calculate scores for each CV
      const matchPromises = cvs.map(async (cv) => {
        const matchResult = await this.calculateMatchingScore(cv, job);
        return {
          cv: {
            id: cv._id,
            name: cv.personalInfo?.name,
            email: cv.personalInfo?.email
          },
          score: matchResult.score,
          matchDetails: matchResult.details,
          fromCache: matchResult.fromCache || false
        };
      });
      
      // Wait for all calculations to complete
      const matches = await Promise.all(matchPromises);
      
      // Sort by score (descending) and take top N
      const topMatches = matches
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      logger.info('Found top CV matches for job', { 
        jobId,
        count: topMatches.length,
        forceRefresh
      });
      
      return topMatches;
    } catch (error) {
      logger.error('Error finding top CVs for job', {
        jobId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find the best matching jobs for a CV
   * @param {string} cvId - CV ID to match
   * @param {number} limit - Maximum number of matches to return
   * @param {boolean} forceRefresh - Whether to force recalculation of all scores
   * @returns {Promise<Array>} - Array of job matches with scores
   */
  async findBestJobsForCV(cvId, limit = 10, forceRefresh = false) {
    try {
      // Find the CV
      const cv = await CVData.findById(cvId).select('-rawText');
      if (!cv) {
        throw new Error('CV not found');
      }
      
      // Get all active jobs
      const jobs = await Job.find({ active: true });
      
      // Check if we have cached matches and are not forcing refresh
      if (!forceRefresh) {
        // Try to get from cache first
        const cachedMatches = await Match.find({ cvId })
          .sort({ score: -1 })
          .limit(jobs.length); // Get all matches for this CV
        
        // If we have enough cached matches that are valid, use them
        if (cachedMatches.length > 0) {
          const validMatches = [];
          
          // Verify each cached match and collect valid ones
          for (const match of cachedMatches) {
            const job = jobs.find(j => j._id.toString() === match.jobId.toString());
            if (job && this.isCacheValid(match, cv, job)) {
              validMatches.push({
                job: {
                  id: job._id,
                  title: job.title,
                  company: job.company
                },
                score: match.score,
                matchDetails: match.details,
                fromCache: true
              });
            }
          }
          
          // If we have enough valid matches, return them
          if (validMatches.length >= limit) {
            const sortedMatches = validMatches.sort((a, b) => b.score - a.score).slice(0, limit);
            logger.info('Found best job matches for CV from cache', { 
              cvId,
              count: sortedMatches.length
            });
            return sortedMatches;
          }
          
          logger.info('Some cached matches found but not enough valid ones', {
            cvId,
            validCount: validMatches.length,
            requiredCount: limit
          });
        }
      }
      
      // If forceRefresh is true or we don't have enough valid cached matches,
      // calculate scores for each job
      const matchPromises = jobs.map(async (job) => {
        const matchResult = await this.calculateMatchingScore(cv, job);
        return {
          job: {
            id: job._id,
            title: job.title,
            company: job.company
          },
          score: matchResult.score,
          matchDetails: matchResult.details,
          fromCache: matchResult.fromCache || false
        };
      });
      
      // Wait for all calculations to complete
      const matches = await Promise.all(matchPromises);
      
      // Sort by score (descending) and take top N
      const topMatches = matches
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      
      logger.info('Found best job matches for CV', { 
        cvId,
        count: topMatches.length,
        forceRefresh
      });
      
      return topMatches;
    } catch (error) {
      logger.error('Error finding best jobs for CV', {
        cvId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new MatchingService(); 