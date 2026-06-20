/**
 * Session Repository
 * Data access layer for Session model
 * 
 * Architectural Decision:
 * - Repository pattern separates data access logic from business logic
 * - Makes it easy to swap database implementations later
 * - Centralizes query logic for maintainability
 */
const Session = require('../models/Session');

class SessionRepository {
    /**
     * Create a new personalization session
     * @param {Object} sessionData - { email, productSku, jwtToken }
     * @returns {Promise<Session>}
     */
    async create(sessionData) {
        const session = new Session({
            ...sessionData,
            status: 'CREATED',
        });
        return await session.save();
    }

    /**
     * Find session by JWT token
     * @param {string} token - JWT token
     * @returns {Promise<Session|null>}
     */
    async findByToken(token) {
        return await Session.findOne({ jwtToken: token });
    }

    async findById(id) {
        return await Session.findById(id); // ✅ Add this
    }

    /**
     * Find session by email (for GET /sessions/me)
     * @param {string} email - User email
     * @returns {Promise<Session|null>}
     */
    async findByEmail(email) {
        return await Session.findOne({ email: email.toLowerCase() }).sort({ createdAt: -1 });
    }

    /**
     * Update session status
     * @param {string} token - JWT token
     * @param {string} status - New status
     * @param {Object} updates - Additional fields to update
     * @returns {Promise<Session|null>}
     */
    async updateStatus(token, status, updates = {}) {
        return await Session.findOneAndUpdate(
            { jwtToken: token },
            {
                status,
                ...updates,
                $currentDate: { updatedAt: true }
            },
            { new: true }
        );
    }

    async updateStatusById(sessionId, status, updates = {}) {
        return await Session.findByIdAndUpdate(
            sessionId,
            {
                status,
                ...updates,
                updatedAt: new Date()
            },
            { new: true }
        );
    }

    /**
     * Update session with AI job data
     * @param {string} token - JWT token
     * @param {Object} aiData - { aiJobId, originalImageUrl, processedImageUrl }
     * @returns {Promise<Session|null>}
     */
    async updateAiData(token, aiData) {
        return await Session.findOneAndUpdate(
            { jwtToken: token },
            { $set: aiData },
            { new: true }
        );
    }

    /**
     * Find session by AI job ID
     * @param {string} jobId - AI job ID
     * @returns {Promise<Session|null>}
     */
    async findByAiJobId(jobId) {
        return await Session.findOne({ aiJobId: jobId });
    }
}

module.exports = new SessionRepository();