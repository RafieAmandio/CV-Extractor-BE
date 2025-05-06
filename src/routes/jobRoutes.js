const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const logger = require('../utils/logger');

/**
 * @route POST /api/jobs/seed
 * @desc Seed the database with sample job data
 * @access Public
 * @query {boolean} clear - Whether to clear existing jobs before seeding (optional)
 */
router.post('/seed', jobController.seedJobs);

/**
 * @route POST /api/jobs
 * @desc Create a new job
 * @access Public
 */
router.post('/', jobController.createJob);

/**
 * @route GET /api/jobs
 * @desc Get all jobs with pagination
 * @access Public
 * @query {number} page - Page number (default: 1)
 * @query {number} limit - Number of items per page (default: 10)
 * @query {string} search - Optional search term
 */
router.get('/', jobController.getAllJobs);

/**
 * @route GET /api/jobs/:id
 * @desc Get a specific job by ID
 * @access Public
 * @param {string} id - The job ID
 */
router.get('/:id', jobController.getJobById);

/**
 * @route PUT /api/jobs/:id
 * @desc Update a job
 * @access Public
 * @param {string} id - The job ID
 */
router.put('/:id', jobController.updateJob);

/**
 * @route DELETE /api/jobs/:id
 * @desc Delete a job (soft delete)
 * @access Public
 * @param {string} id - The job ID
 */
router.delete('/:id', jobController.deleteJob);

/**
 * @route GET /api/jobs/:id/matches
 * @desc Find top matching CVs for a job
 * @access Public
 * @param {string} id - The job ID
 * @query {number} limit - Maximum number of matches to return (default: 10)
 * @query {boolean} refresh - Whether to force recalculation of all scores (default: false)
 */
router.get('/:id/matches', jobController.findTopCVsForJob);

module.exports = router; 