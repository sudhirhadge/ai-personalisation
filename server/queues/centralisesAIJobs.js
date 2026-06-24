Good call — those string literals are exactly the kind of thing that drifts silently(typo one in the controller, queue never receives the job, no error, just a silent hang).Let's centralize them and wire all four layers together consistently.## 1. New shared constants file — single source of truth

    ```javascript
// constants/aiJobs.js

/**
 * Central registry of AI job types.
 * Controller, queue, and worker all reference these instead of hardcoding
 * queue names / job names as string literals in multiple files. If these
 * drift (e.g. a typo in one file), jobs silently fail to enqueue or process
 * with no obvious error — keeping them here prevents that class of bug.
 */
const AI_JOB_TYPES = {
    TEXT_TO_IMAGE: {
        queueName: 'ai-generation',
        jobName: 'generate-image',
        requiresOriginalImage: false,
    },
    IMAGE_TO_IMAGE: {
        queueName: 'ai-image-to-image-generation',
        jobName: 'ai-image-to-image-generation',
        requiresOriginalImage: true,
    },
};

module.exports = { AI_JOB_TYPES };
```

## 2. Queue file — references the constants instead of inline strings

    ```javascript
/**
 * AI Queue Factory (BullMQ + Upstash Redis)
 * Shared queue/worker setup for AI image generation jobs.
 *
 * Why a queue:
 * - Image generation is slow; the queue keeps the HTTP request fast by
 *   handing the actual generation off to a background worker.
 * - Jobs persist in Redis if the worker restarts or crashes mid-job.
 * - Concurrent requests from multiple users are queued and processed in
 *   a controlled, rate-limited way instead of all firing at once.
 */
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const sessionRepository = require('../repositories/sessionRepository');
const aiService = require('../services/aiService');
const config = require('../config');
const { AI_JOB_TYPES } = require('../constants/aiJobs');

// Initialize Upstash Redis Connection (free tier)
// Shared across both queues — one connection, not one per queue file.
const redisConnection = new IORedis({
    ...config.redisConfig,
    tls: {},
    maxRetriesPerRequest: null, // Required by BullMQ
});

const defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
};

const defaultLimiter = {
    max: 2,         // Max concurrent jobs
    duration: 1000, // Per second
};

/**
 * Builds a BullMQ queue + worker pair for an AI generation job type.
 * Both the text-to-image and image-to-image queues follow the identical
 * lifecycle (update PROCESSING -> run generation -> update DONE/FAILED);
 * they only differ in which aiService method they call and what job data
 * they need.
 *
 * @param {Object} options
 * @param {string} options.queueName - BullMQ queue name
 * @param {Function} options.processFn - async (jobData) => result; calls the
 *   right aiService.process* method with the right arguments
 * @returns {{ queue: Queue, worker: Worker, shutdown: Function }}
 */
function createAIQueue({ queueName, processFn }) {
    const queue = new Queue(queueName, {
        connection: redisConnection,
        defaultJobOptions,
    });

    const worker = new Worker(queueName, async (job) => {
        const { sessionId } = job.data;

        console.log(`🔄 Processing AI job: ${ job.id } for session ${ sessionId }`);

        try {
            await sessionRepository.updateStatusById(sessionId, 'PROCESSING', {
                aiJobId: job.id,
            });

            const result = await processFn(job.data);

            if (result.success) {
                await sessionRepository.updateStatusById(sessionId, 'DONE', {
                    processedImageUrl: result.processedImageUrl,
                    aiPrompt: result.aiPrompt,
                    aiResult: result.aiResult,
                    aiProcessedAt: new Date().toISOString(),
                });

                console.log(`✅ AI job completed: ${ job.id } `);
                return result;
            } else {
                await sessionRepository.updateStatusById(sessionId, 'FAILED', {
                    aiError: result.error,
                });
                throw new Error(result.error);
            }
        } catch (error) {
            console.error(`❌ AI job failed: ${ job.id } `, error);

            const session = await sessionRepository.findById(sessionId);
            if (session.status !== 'FAILED') {
                await sessionRepository.updateStatusById(sessionId, 'FAILED', {
                    aiError: error.message,
                });
            }

            throw error;
        }
    }, {
        connection: redisConnection,
        limiter: defaultLimiter,
    });

    worker.on('completed', (job) => {
        console.log(`✅ Job completed: ${ job.id } `);
    });

    worker.on('failed', (job) => {
        console.log(`❌ Job failed: ${ job.id } `, job?.failedReason);
    });

    worker.on('error', (error) => {
        console.error(`🚨 Worker error(${ queueName }): `, error);
    });

    async function shutdown() {
        console.log(`🛑 Shutting down ${ queueName } worker...`);
        await worker.close();
    }

    return { queue, worker, shutdown };
}

// --- Text-to-image queue ---
const {
    queue: aiQueue,
    worker: aiWorker,
    shutdown: shutdownAiWorker,
} = createAIQueue({
    queueName: AI_JOB_TYPES.TEXT_TO_IMAGE.queueName,
    processFn: ({ sessionId, productSku, userPrompt }) =>
        aiService.processGeneration(sessionId, productSku, userPrompt),
});

// --- Image-to-image queue ---
const {
    queue: aiImageToImageQueue,
    worker: aiImageToImageWorker,
    shutdown: shutdownImageToImageWorker,
} = createAIQueue({
    queueName: AI_JOB_TYPES.IMAGE_TO_IMAGE.queueName,
    processFn: ({ sessionId, productSku, userPrompt, originalImageUrl }) =>
        aiService.processImageToImageGeneration(sessionId, productSku, userPrompt, originalImageUrl),
});

// Graceful shutdown — closes both workers, then the shared Redis connection once
async function shutdownAllWorkers() {
    await Promise.all([shutdownAiWorker(), shutdownImageToImageWorker()]);
    await redisConnection.close();
}

process.on('SIGTERM', shutdownAllWorkers);
process.on('SIGINT', shutdownAllWorkers);

module.exports = {
    aiQueue,
    aiWorker,
    aiImageToImageQueue,
    aiImageToImageWorker,
    shutdownAllWorkers,
};
```

## 3. Controller — uses the same constants, no hardcoded names

    ```javascript
const { AI_JOB_TYPES } = require('../constants/aiJobs');
const { aiQueue, aiImageToImageQueue } = require('../queues/aiQueue'); // adjust path to your actual queue file

/**
 * Shared handler for triggering an AI generation job (text-to-image or image-to-image).
 * @param {Object} options
 * @param {import('express').Request} options.req
 * @param {import('express').Response} options.res
 * @param {import('bullmq').Queue} options.queue - which queue to push the job onto
 * @param {Object} options.jobType - an entry from AI_JOB_TYPES (provides jobName + requiresOriginalImage)
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

        // Build job payload — common fields + conditional originalImageUrl
        const jobPayload = {
            sessionId: sessionId,
            productSku: session.productSku,
            userPrompt: prompt,
        };
        if (jobType.requiresOriginalImage) {
            jobPayload.originalImageUrl = session.originalImageUrl;
        }

        // Add job to queue — jobName comes from the same constant the queue file uses
        const job = await queue.add(jobType.jobName, jobPayload);

        // Update session status to PROCESSING immediately
        await sessionRepository.updateStatusById(sessionId, 'PROCESSING', {
            aiJobId: job.id,
        });

        console.log(`🎨 AI job added: ${ job.id } for session ${ sessionId }`);

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

// Thin wrappers — each just declares its queue + job type, both sourced from AI_JOB_TYPES
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
```

## How the four layers now line up

    | Layer | Before | Now |
| ---| ---| ---|
| Controller | `'generate-image'` hardcoded | `AI_JOB_TYPES.TEXT_TO_IMAGE.jobName` |
| Queue creation | `new Queue('ai-generation', ...)` hardcoded | `AI_JOB_TYPES.TEXT_TO_IMAGE.queueName` |
| Worker | implicitly matches queue name | same — BullMQ requires queue / worker names to match exactly, and now there's no way for them to drift since both pull from one constant |
    | Service | `processGeneration(...)` called directly, no string literals involved | unchanged — this layer never had the string - literal problem, it's the queue/controller boundary that did |

The risk this actually removes: previously, if you renamed a job name in the controller but forgot to update the queue file(or vice versa), BullMQ wouldn't throw — the job would just queue under a name nothing is listening for, and you'd see a job stuck in "waiting" with `aiQueue`'s dashboard showing it but no worker ever picking it up. Now there's exactly one place that string exists.

A couple of follow - ups worth doing while this is fresh:

1. ** Delete the old separate `aiImagetoImageQueue.js` file ** (lowercase "to" — note the inconsistent casing from your original filename in the stack traces) once you've moved its logic into this consolidated queue file, so there isn't a dead duplicate floating around that someone might accidentally import from.
2. ** Update any other import sites** — search your codebase for `require('../queues/aiImagetoImageQueue')` or similar and repoint them to wherever this consolidated file lives.

Want me to write these out as actual files in the container and hand you a small diff / checklist of exactly which old files to delete and which imports to update, so you have something concrete to work from when you go make these changes in your real repo ?