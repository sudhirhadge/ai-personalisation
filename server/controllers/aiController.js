/**
 * AI Controller
 * Handles HTTP requests for AI image generation
 * 
 * Architectural Decision:
 * - Controller handles only HTTP concerns
 * - Uses aiQueue for background processing
 * - Returns job ID for status tracking
 */
const { aiQueue, aiImageToImageQueue, aiWrapperCompositeQueue, aiWrapperCompositeMultiRefQueue } = require('../queues/aiQueue');
const sessionRepository = require('../repositories/sessionRepository');
const { AI_JOB_TYPES } = require('../constants/aiJobs');
const imageCompositeService = require('../services/imageCompositeService');

/**
 * POST /api/v1/sessions/me/generate-image-from-image
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
        // const { prompt, wrapperImageUrl } = req.body; // wrapperImageUrl removed from here


        /*
        Why trusting wrapperImageUrl from req.body is dangerous
Two distinct attack surfaces:
1. Cost abuse (SSRF-adjacent)
Your BFL call does fetch(wrapperImageUrl) server-side. If a malicious user sends wrapperImageUrl: "https://enormous-4k-raw-file.com/100mb.png", BFL downloads it, processes it at full megapixel cost, and charges your account. At BFL's megapixel-based pricing that's a single request that could cost dollars instead of cents. At scale with no rate limiting, this is a real billing attack vector.
2. SSRF (Server-Side Request Forgery)
If your code ever switches from passing the URL directly to BFL → to fetching it yourself first (e.g. to resize before sending), wrapperImageUrl: "http://169.254.169.254/latest/meta-data/" would make your server fetch AWS instance metadata. Classic SSRF. Not your current code path, but worth knowing why "never trust a URL from the client" is a hard rule.
The fix — look up the wrapper URL server-side from productSku, exactly like WRAPPER_OVERLAY_REGIONS works — eliminates both attack surfaces because the URL never comes from user input at all.
        */
        const { prompt } = req.body;
        const { sessionId } = req.user; // MongoDB _id from JWT

        /* // Validation
        if (!prompt || prompt.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Prompt is required',
            });
        } */

        // Prompt validation — skip for job types that don't take a free-text

        if (!jobType.fixedPrompt && (!prompt || prompt.trim().length === 0)) {
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

        // Multi-ref jobs additionally need a public wrapper image URL —
        // catch this before queuing rather than failing mid-job after the
        // (costly) cartoonify step has already run.
        /*
        if (jobType.requiresWrapperImageUrl && !wrapperImageUrl) {
            return res.status(400).json({
                success: false,
                error: 'wrapperImageUrl is required for this generation type',
            });
        } */

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
        /*
               if (jobType.requiresWrapperImageUrl) {
                   jobPayload.wrapperImageUrl = wrapperImageUrl;
               }
                   */

        // Add job to queue
        const job = await queue.add(jobType.jobName, jobPayload);

        // Update session status to PROCESSING immediately
        await sessionRepository.updateStatusById(sessionId, 'PROCESSING', {
            aiJobId: job.id,
            aiJobType: jobType.queueName // // NEW — remembers which queue this job lives in so getAIStatus can look it up correctly later instead of assuming a single hardcoded queue.
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

async function generateAIWrapperComposite(req, res, next) {
    /*
triggerAIGeneration currently validates session.status !== 'UPLOADED'. 
That's fine here since wrapper-composite also needs an uploaded source photo first. 
But it has no awareness of productSku needing a valid entry in WRAPPER_OVERLAY_REGIONS 
(from imageCompositeService.js). Right now, if a user picks a SKU you haven't configured a wrapper region for, 
the job will queue successfully, the worker will pick it up, run the (costly) AI cartoonify step, 
and then fail inside compositeOntoWrapper() when it throws No wrapper overlay region configured for SKU. 
That's wasted inference spend on a failure you could have caught instantly.
Worth adding a cheap pre-check in the controller before queuing:
    */
    const { sessionId } = req.user;
    const session = await sessionRepository.findById(sessionId);

    if (session && !imageCompositeService.hasRegionConfig(session.productSku)) {
        return res.status(400).json({
            success: false,
            error: `No wrapper template configured for product: ${session.productSku}`,
        });
    }

    return triggerAIGeneration({
        req,
        res,
        queue: aiWrapperCompositeQueue,
        jobType: AI_JOB_TYPES.WRAPPER_COMPOSITE,
    });
}

// generateAIWrapperCompositeMultiRef — still has the pre-check, but now
// for a different reason: catches unknown SKUs before the job is queued,
// so we don't burn a cartoonify call on a SKU that has no wrapper configured.
async function generateAIWrapperCompositeMultiRef(req, res, next) {
    const { sessionId } = req.user;
    const session = await sessionRepository.findById(sessionId);

    if (session && !imageCompositeService.hasRegionConfig(session.productSku)) {
        return res.status(400).json({
            success: false,
            error: `No wrapper template configured for product: ${session.productSku}`,
        });
    }
    return triggerAIGeneration({
        req,
        res,
        queue: aiWrapperCompositeMultiRefQueue,
        jobType: AI_JOB_TYPES.WRAPPER_COMPOSITE_MULTI_REF,
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

const QUEUE_BY_NAME = {
    [AI_JOB_TYPES.TEXT_TO_IMAGE.queueName]: aiQueue,
    [AI_JOB_TYPES.IMAGE_TO_IMAGE.queueName]: aiImageToImageQueue,
    [AI_JOB_TYPES.WRAPPER_COMPOSITE.queueName]: aiWrapperCompositeQueue,
    [AI_JOB_TYPES.WRAPPER_COMPOSITE_MULTI_REF.queueName]: aiWrapperCompositeMultiRefQueue,
};

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
 *     aiError: string (if FAILED),
 *     jobState: string
 *   }
 * }
 */
async function getAIStatus(req, res, next) {
    try {
        const { aiJobId } = req.params;
        const { sessionId } = req.user;

        // Get session first — it tells us which queue this job belongs to
        const session = await sessionRepository.findById(sessionId);

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Session not found',
            });
        }

        // Resolve the correct queue using the job type saved at trigger-time.
        // Falls back to aiQueue only for backward compatibility with sessions
        // created before aiJobType was introduced — remove this fallback once
        // no pre-existing sessions rely on it.
        const queue = QUEUE_BY_NAME[session.aiJobType] || aiQueue;

        const job = await queue.getJob(aiJobId);

        if (!job) {
            return res.status(404).json({
                success: false,
                error: 'Job not found',
            });
        }

        const jobState = await job.getState();

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
    generateAIWrapperComposite,
    generateAIWrapperCompositeMultiRef,
    getAIStatus,
};