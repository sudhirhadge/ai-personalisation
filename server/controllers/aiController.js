/**
 * AI Controller
 * Handles HTTP requests for AI image generation
 * 
 * Architectural Decision:
 * - Controller handles only HTTP concerns
 * - Uses aiQueue for background processing
 * - Returns job ID for status tracking
 */
const { aiQueue } = require('../queues/aiQueue');
const sessionRepository = require('../repositories/sessionRepository');

/**
 * POST /api/v1/sessions/me/generate
 * Trigger AI image generation
 * Protected endpoint (requires JWT)
 * 
 * Request:
 * - Headers: Authorization: Bearer <jwt_token>
 * - Body: { prompt: string }
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     aiJobId: string,
 *     status: string
 *   }
 * }
 */
async function generateAIImage(req, res, next) {
    try {
        const { prompt } = req.body;
        const { sessionId } = req.user; // MongoDB _id from JWT

        // Validation
        if (!prompt || prompt.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Prompt is required',
            });
        }

        // Get session to check status
        const session = await sessionRepository.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
            });
        }

        // Check if session has uploaded image
        if (session.status !== 'UPLOADED') {
            return res.status(400).json({
                success: false,
                error: 'Please upload an image first before generating AI',
            });
        }

        // Add job to queue
        const job = await aiQueue.add('generate-image', {
            sessionId: sessionId,
            productSku: session.productSku,
            userPrompt: prompt,
        });

        // Update session status to PROCESSING immediately
        await sessionRepository.updateStatusById(sessionId, 'PROCESSING', {
            aiJobId: job.id,
        });

        console.log(`🎨 AI job added: ${job.id} for session ${sessionId}`);

        res.json({
            success: true,
            data: {
                aiJobId: job.id,
                status: 'PROCESSING',
            },
        });
    } catch (error) {
        console.error('Generate AI image error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger AI generation',
        });
    }
}

/**
 * GET /api/v1/sessions/me/status/:aiJobId
 * Get AI job status
 * Protected endpoint (requires JWT)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     aiJobId: string,
 *     status: string,
 *     processedImageUrl: string (if DONE),
 *     aiError: string (if FAILED)
 *   }
 * }
 */
async function getAIStatus(req, res, next) {
    try {
        const { aiJobId } = req.params;
        const { sessionId } = req.user;

        // Get job from queue
        const job = await aiQueue.getJob(aiJobId);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found',
            });
        }

        // Get job status
        const jobState = await job.getState();

        // Get session for latest data
        const session = await sessionRepository.findById(sessionId);

        res.json({
            success: true,
            data: {
                aiJobId: job.id,
                status: session.status, // DONE/FAILED/PROCESSING
                processedImageUrl: session.processedImageUrl,
                aiError: session.aiError,
                jobState: jobState,
            },
        });
    } catch (error) {
        console.error('Get AI status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get job status',
        });
    }
}

module.exports = {
    generateAIImage,
    getAIStatus,
};