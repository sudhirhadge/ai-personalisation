/**
 * Storage Routes
 * Defines file upload endpoints
 * 
 * Architectural Decision:
 * - Separate route file for storage endpoints
 * - Authentication middleware applied at route level
 */
const express = require('express');
const { uploadImage, deleteImage } = require('../controllers/storageController');
const { authenticate } = require('../middleware/authPersonlization');

const router = express.Router();

/**
 * POST /api/v1/sessions/me/upload
 * Upload image for personalization session
 * Protected endpoint (requires JWT)
 */
router.post('/upload', authenticate, uploadImage);

/**
 * DELETE /api/v1/sessions/me/image
 * Delete uploaded image
 * Protected endpoint (requires JWT)
 */
router.delete('/image', authenticate, deleteImage);

module.exports = router;