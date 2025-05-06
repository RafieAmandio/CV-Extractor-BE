const Job = require('../models/job.model');
const matchingService = require('../services/matchingService');
const seedService = require('../services/seedService');
const logger = require('../utils/logger');

/**
 * Controller for job-related endpoints
 */
class JobController {
  /**
   * Create a new job
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async createJob(req, res, next) {
    try {
      const jobData = req.body;
      
      // Create new job
      const job = new Job(jobData);
      await job.save();
      
      logger.info('Job created successfully', { id: job._id });
      
      // Return the job data
      res.status(201).json({
        success: true,
        message: 'Job created successfully',
        data: job
      });
    } catch (error) {
      logger.error('Error creating job', { error: error.message });
      next(error);
    }
  }

  /**
   * Get all jobs with pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAllJobs(req, res, next) {
    try {
      // Get pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Get search query if provided
      const searchQuery = req.query.search || '';
      
      // Build query object
      let query = { active: true };
      
      // Add search functionality if search term is provided
      if (searchQuery) {
        query.$text = { $search: searchQuery };
      }
      
      // Get total count for pagination
      const total = await Job.countDocuments(query);
      
      // Fetch jobs with pagination
      const jobs = await Job.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      // Calculate pagination details
      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      
      logger.info('Jobs retrieved successfully', { 
        count: jobs.length, 
        total 
      });
      
      // Return the paginated results
      res.status(200).json({
        success: true,
        message: 'Jobs retrieved successfully',
        data: {
          jobs,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNext,
            hasPrev
          }
        }
      });
    } catch (error) {
      logger.error('Error retrieving jobs', { error: error.message });
      next(error);
    }
  }

  /**
   * Get a specific job by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getJobById(req, res, next) {
    try {
      const { id } = req.params;
      
      // Find job by ID
      const job = await Job.findById(id);
      
      // Check if job exists
      if (!job) {
        logger.warn('Job not found', { id });
        return res.status(404).json({ 
          success: false, 
          message: 'Job not found' 
        });
      }
      
      logger.info('Job retrieved successfully', { id });
      
      // Return the job data
      res.status(200).json({
        success: true,
        message: 'Job retrieved successfully',
        data: job
      });
    } catch (error) {
      logger.error('Error retrieving job', { 
        id: req.params.id,
        error: error.message 
      });
      next(error);
    }
  }

  /**
   * Update a job
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async updateJob(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Add updated timestamp
      updateData.updatedAt = new Date();
      
      // Find and update job
      const job = await Job.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );
      
      // Check if job exists
      if (!job) {
        logger.warn('Job not found for update', { id });
        return res.status(404).json({ 
          success: false, 
          message: 'Job not found' 
        });
      }
      
      logger.info('Job updated successfully', { id });
      
      // Return the updated job data
      res.status(200).json({
        success: true,
        message: 'Job updated successfully',
        data: job
      });
    } catch (error) {
      logger.error('Error updating job', { 
        id: req.params.id,
        error: error.message 
      });
      next(error);
    }
  }

  /**
   * Delete a job (soft delete by marking as inactive)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteJob(req, res, next) {
    try {
      const { id } = req.params;
      
      // Soft delete by marking as inactive
      const job = await Job.findByIdAndUpdate(
        id,
        { active: false, updatedAt: new Date() },
        { new: true }
      );
      
      // Check if job exists
      if (!job) {
        logger.warn('Job not found for deletion', { id });
        return res.status(404).json({ 
          success: false, 
          message: 'Job not found' 
        });
      }
      
      logger.info('Job deleted successfully', { id });
      
      // Return success response
      res.status(200).json({
        success: true,
        message: 'Job deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting job', { 
        id: req.params.id,
        error: error.message 
      });
      next(error);
    }
  }

  /**
   * Find top matching CVs for a job
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async findTopCVsForJob(req, res, next) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const forceRefresh = req.query.refresh === 'true';
      
      // Find top matching CVs
      const matches = await matchingService.findTopCVsForJob(id, limit, forceRefresh);
      
      logger.info('Found top CV matches for job', { 
        jobId: id, 
        count: matches.length,
        forceRefresh
      });
      
      // Return matches
      res.status(200).json({
        success: true,
        message: 'Top CV matches found successfully',
        data: {
          jobId: id,
          matches
        }
      });
    } catch (error) {
      logger.error('Error finding top CVs for job', { 
        id: req.params.id,
        error: error.message 
      });
      next(error);
    }
  }

  /**
   * Find best matching jobs for a CV
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async findBestJobsForCV(req, res, next) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const forceRefresh = req.query.refresh === 'true';
      
      // Find best matching jobs
      const matches = await matchingService.findBestJobsForCV(id, limit, forceRefresh);
      
      logger.info('Found best job matches for CV', { 
        cvId: id, 
        count: matches.length,
        forceRefresh
      });
      
      // Return matches
      res.status(200).json({
        success: true,
        message: 'Best job matches found successfully',
        data: {
          cvId: id,
          matches
        }
      });
    } catch (error) {
      logger.error('Error finding best jobs for CV', { 
        id: req.params.id,
        error: error.message 
      });
      next(error);
    }
  }

  /**
   * Seed the database with sample jobs
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async seedJobs(req, res, next) {
    try {
      // Get option to clear existing jobs
      const clearExisting = req.query.clear === 'true';
      
      // Seed the database
      const result = await seedService.seedJobs(clearExisting);
      
      logger.info('Database seeded with sample jobs', { 
        inserted: result.insertedCount,
        cleared: clearExisting
      });
      
      // Return the seeding result
      res.status(200).json({
        success: true,
        message: 'Database seeded with sample jobs',
        data: {
          existingCount: result.existingCount,
          deletedCount: result.deletedCount,
          insertedCount: result.insertedCount
        }
      });
    } catch (error) {
      logger.error('Error seeding database', { error: error.message });
      next(error);
    }
  }
}

module.exports = new JobController(); 