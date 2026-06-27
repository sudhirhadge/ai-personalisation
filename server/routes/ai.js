/**
 * AI Routes
 * Routes for AI image generation endpoints
 */
const express = require('express');
const router = express.Router();
const { generateAIImage, getAIStatus, generateAIImageToImage } = require('../controllers/aiController');
const { authenticate } = require('../middleware/authPersonlization');

// All routes require JWT authentication
router.use(authenticate);

/**
 * POST /api/v1/sessions/me/generate
 * Trigger AI image generation
 */
// router.post('/generate', generateAIImage);
router.post('/generate', generateAIImageToImage);


/**
 * GET /api/v1/sessions/me/status/:aiJobId
 * Get AI job status
 */
router.get('/status/:aiJobId', getAIStatus);

module.exports = router;