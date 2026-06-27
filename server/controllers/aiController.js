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
const { aiImageToImageQueue } = require('../queues/aiQueue');
const sessionRepository = require('../repositories/sessionRepository');
const { AI_JOB_TYPES } = require('../constants/aiJobs');

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

/**
 * Shared handler for triggering an AI generation job (text-to-image or image-to-image).
 * @param {Object} options
 * @param {import('express').Request} options.req
 * @param {import('express').Response} options.res
 * @param {import('bullmq').Queue} options.queue - which queue to push the job onto
 * @param {string} options.jobType - an entry from AI_JOB_TYPES (provides jobName + requiresOriginalImage)
 */
async function triggerAIGeneration({ req, res, queue, jobType }) {
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
        // Build job payload — common fields + conditional originalImageUrl
        const jobPayload = {
            sessionId: sessionId,
            productSku: session.productSku,
            userPrompt: prompt,
        };
        if (jobType.requiresOriginalImage) {
            jobPayload.originalImageUrl = session.originalImageUrl;
        }

        // Add job to queue
        const job = await queue.add(jobType.jobName, jobPayload);

        // Update session status to PROCESSING immediately
        await sessionRepository.updateStatusById(sessionId, 'PROCESSING', {
            aiJobId: job.id,
        });

        console.log(`🎨 AI job added: ${job.id} for session ${sessionId} for user - `);

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

// Thin wrappers — each just declares its own queue/job-name/flag
async function generateAIImage(req, res, next) {
    return triggerAIGeneration({
        req,
        res,
        queue: aiQueue,
        jobType: AI_JOB_TYPES.TEXT_TO_IMAGE,
    });
}

async function generateAIImageToImage(req, res, next) {
    return triggerAIGeneration({
        req,
        res,
        queue: aiImageToImageQueue,
        jobType: AI_JOB_TYPES.IMAGE_TO_IMAGE,
    });
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
    generateAIImageToImage,
    getAIStatus,
};