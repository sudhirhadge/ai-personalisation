/**
 * Session Controller
 * Handles HTTP requests for session management
 * 
 * Architectural Decision:
 * - Controllers handle only HTTP concerns (request/response, validation)
 * - Business logic delegated to services
 * - Repository pattern for data access
 * - Error handling centralized in try-catch blocks
 */
const sessionRepository = require('../repositories/sessionRepository');
const tokenService = require('../services/tokenService');
const emailService = require('../services/emailService');
const config = require('../config');

/**
 * POST /api/v1/sessions
 * Create a new personalization session
 * 
 * Request Body:
 * {
 *   email: string,
 *   productSku: string
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     sessionId: string,
 *     email: string,
 *     productSku: string,
 *     status: string,
 *     personalizationLink: string
 *   }
 * }
 */
async function createSession(req, res, next) {
    try {
        const { email, productSku } = req.body;

        // Validation
        if (!email || !productSku) {
            return res.status(400).json({
                success: false,
                error: 'Email and productSku are required',
            });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format',
            });
        }

        // Create session first to get MongoDB _id
        const session = await sessionRepository.create({
            email: email.toLowerCase(),
            productSku,
            jwtToken: tokenService.generateSessionToken(), // UUID for DB
        });

        // Generate JWT using MongoDB _id
        const jwtToken = tokenService.generateDeepLinkToken(session._id.toString());

        // Send email (non-blocking - don't await to avoid slowing down response)
        // In production, this would be queued via BullMQ
        emailService.sendPersonalizationEmail(session).catch(err => {
            console.error('Email sending failed:', err);
        });

        res.status(201).json({
            success: true,
            data: {
                sessionId: session._id.toString(),
                email: session.email,
                productSku: session.productSku,
                status: session.status,
                personalizationLink: `${config.frontendUrl}/personalize-now?token=${jwtToken}`,
                jwtToken, // ✅ Return JWT for API calls
            },
        });
    } catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create session',
        });
    }
}

/**
 * GET /api/v1/sessions/me
 * Get current session by email from JWT token
 * 
 * Headers:
 * Authorization: Bearer <jwt_token>
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     sessionId: string,
 *     email: string,
 *     productSku: string,
 *     status: string,
 *     personalizationLink: string,
 *     createdAt: string,
 *   }
 * }
 */
async function getCurrentSession(req, res, next) {
    try {
        // Token was already verified by auth middleware; and user info is attached to req.user to avoid re-verifying the token here. This keeps the controller focused on session retrieval logic.
        const { sessionId } = req.user;

        const session = await sessionRepository.findById(sessionId);
        console.log('Retrieved session:', session);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
            });
        }
        let data = {
            sessionId: session._id.toString(),
            email: session.email,
            productSku: session.productSku,
            status: session.status,
            personalizationLink: session.personalizationLink,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
        }
        if (session.status === 'UPLOADED') {
            // Include originalImageUrl only if the session has an uploaded image
            data.originalImageUrl = session.originalImageUrl;
            data.originalImageName = session.originalImageName;
        }

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get current session error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get session',
        });
    }
}

module.exports = {
    createSession,
    getCurrentSession,
};