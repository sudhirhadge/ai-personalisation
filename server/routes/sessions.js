/**
 * Sessions Routes
 * Defines all session-related API endpoints
 * 
 * Architectural Decision:
 * - Versioned API (/api/v1/) for future backward compatibility
 * - Route file separates endpoint definitions from controllers
 * - Middleware applied at route level for protected endpoints
 */
const express = require('express');
const { createSession, getCurrentSession } = require('../controllers/sessionController');
const { authenticate } = require('../middleware/authPersonlization');

const router = express.Router();

/**
 * POST /api/v1/sessions
 * Create a new personalization session
 * Public endpoint (no auth required)
 */
router.post('/', createSession);

/**
 * GET /api/v1/sessions/me
 * Get current session using JWT token from Authorization header
 * Protected endpoint (auth required)
 * This will get called on page load of PersonalizeNow page to fetch the session details. 
 */
router.get('/me', authenticate, getCurrentSession);

module.exports = router;