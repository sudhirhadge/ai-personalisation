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

// Initialize Upstash Redis Connection (free tier)
// TODO: move this to src/lib/redis.js so both queues share one connection
// instance instead of each queue file opening its own.
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
    max: 2,        // Max concurrent jobs
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
 * @param {string} options.queueName - BullMQ queue name (e.g. 'ai-generation')
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

        console.log(`🔄 Processing AI job: ${job.id} for session ${sessionId}`);

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

                console.log(`✅ AI job completed: ${job.id}`);
                return result;
            } else {
                await sessionRepository.updateStatusById(sessionId, 'FAILED', {
                    aiError: result.error,
                });
                throw new Error(result.error);
            }
        } catch (error) {
            console.error(`❌ AI job failed: ${job.id}`, error);

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
        console.log(`✅ Job completed: ${job.id}`);
    });

    worker.on('failed', (job) => {
        console.log(`❌ Job failed: ${job.id}`, job?.failedReason);
    });

    worker.on('error', (error) => {
        console.error(`🚨 Worker error (${queueName}):`, error);
    });

    async function shutdown() {
        console.log(`🛑 Shutting down ${queueName} worker...`);
        await worker.close();
    }

    return { queue, worker, shutdown };
}

// --- Text-to-image queue ---
const { queue: aiQueue, worker: aiWorker, shutdown: shutdownAiWorker } = createAIQueue({
    queueName: 'ai-generation',
    processFn: ({ sessionId, productSku, userPrompt }) =>
        aiService.processGeneration(sessionId, productSku, userPrompt),
});

// --- Image-to-image queue ---
const { queue: aiImageToImageQueue, worker: aiImageToImageWorker, shutdown: shutdownImageToImageWorker } = createAIQueue({
    queueName: 'ai-image-to-image-generation',
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