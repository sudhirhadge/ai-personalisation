/**
 * Shared handler for triggering an AI generation job (text-to-image or image-to-image).
 * @param {Object} options
 * @param {import('express').Request} options.req
 * @param {import('express').Response} options.res
 * @param {import('bullmq').Queue} options.queue - which queue to push the job onto
 * @param {string} options.jobName - BullMQ job name
 * @param {boolean} options.requiresOriginalImage - whether to attach session.originalImageUrl to the job payload
 */
async function triggerAIGeneration({ req, res, queue, jobName, requiresOriginalImage }) {
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

        // Build job payload — common fields + conditional originalImageUrl
        const jobPayload = {
            sessionId: sessionId,
            productSku: session.productSku,
            userPrompt: prompt,
        };
        if (requiresOriginalImage) {
            jobPayload.originalImageUrl = session.originalImageUrl;
        }

        // Add job to queue
        const job = await queue.add(jobName, jobPayload);

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

// Thin wrappers — each just declares its own queue/job-name/flag
async function generateAIImage(req, res, next) {
    return triggerAIGeneration({
        req,
        res,
        queue: aiQueue,
        jobName: 'generate-image',
        requiresOriginalImage: false,
    });
}

async function generateAIImageToImage(req, res, next) {
    return triggerAIGeneration({
        req,
        res,
        queue: aiImageToImageQueue,
        jobName: 'ai-image-to-image-generation',
        requiresOriginalImage: true,
    });
}