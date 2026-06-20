/**
 * Token Service
 * Handles JWT token generation and validation for deep-links
 * 
 * Architectural Decision:
 * - Separates token logic from controller for testability
 * - Tokens contain minimal data (session ID) for security
 * - 7-day expiry matches session TTL
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

class TokenService {
    /**
     * Generate JWT token for personalization session
     * @param {string} sessionId - MongoDB session ID
     * @returns {string} JWT token
     */
    generateDeepLinkToken(sessionId) {
        const payload = {
            sessionId,
            type: 'personalization',
        };
        // this payload will be encoded in the JWT token and can be decoded later to verify the session
        const token = jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn,
        });

        return token;
    }

    /**
     * Generate unique session token (for database storage)
     * @returns {string} Unique token
     */
    generateSessionToken() {
        return uuidv4();
    }

    /**
     * Verify and decode JWT token
     * @param {string} token - JWT token
     * @returns {Object|null} Decoded payload or null if invalid
     */
    verifyToken(token) {
        try {
            // the decoded payload will contain the sessionId and type, which can be used to validate the session
            const decoded = jwt.verify(token, config.jwt.secret);
            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            }
            throw new Error('Invalid token');
        }
    }
}

module.exports = new TokenService();