/**
 * Authentication Middleware
 * Validates JWT tokens for protected routes
 * 
 * Architectural Decision:
 * - Middleware separates auth logic from controllers
 * - Adds user context to request object
 * - Returns standardized error responses
 */
const tokenService = require('../services/tokenService');

/**
 * Verify JWT token from Authorization header
 * Usage: app.use('/api/v1/sessions/me', authenticate, ...)
 */
function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        // validate presence and format of Authorization header
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Access token required',
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const decoded = tokenService.verifyToken(token);
        // for example, decoded = { sessionId: '...', email: '...', iat: 1234567890, exp: 1234567890 }
        // sessionId is nothing but mongoDB _id of the session document. This is used to identify the session in the database and fetch the session data for personalization.
        // Attach decoded user info to request
        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: error.message || 'Invalid token',
        });
    }
}

module.exports = {
    authenticate,
};