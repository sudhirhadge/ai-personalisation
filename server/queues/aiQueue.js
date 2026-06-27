
/**
 * AI Queue (BullMQ + Upstash Redis)
 * Background job processing for AI image generation
 * Other queses can be added later (e.g. for email, notifications, etc.).
 * Alternative queues: Bee-Queue, Kue, Bull (BullMQ is the newer version of Bull). , 
 * and RabbitMQ (more complex, requires a separate server).
 * 
 * in amazon aws we can use SQS (Simple Queue Service) for queue management, but it is not free.
 * in gcp we can use Pub/Sub for queue management, but it is not free.
 * in azure we can use Service Bus for queue management, but it is not free.
 * 
 * 
 * Architectural Decision:
 * - Uses BullMQ for production-grade queue
 * - Upstash Redis (free 50MB) for queue storage
 * - Retry logic: 3 attempts with exponential backoff
 * - Job status tracking in MongoDB
 */

/**
 *  * Why a queue:
 * - Image generation is slow; the queue keeps the HTTP request fast by
 *   handing the actual generation off to a background worker.
 * - Jobs persist in Redis if the worker restarts or crashes mid-job.
 * - Concurrent requests from multiple users are queued and processed in
 *   a controlled, rate-limited way instead of all firing at once.
 * 
 * Details 
 * Yes — **the queue is mainly for asynchronous work and scaling**, 
 * not because the app can’t work without it. In your case, 
 * it helps keep the API fast while image generation runs in the background, 
 * and it also lets Redis store jobs safely until a worker processes them. 
 * [digitalocean](https://www.digitalocean.com/community/tutorials/how-to-handle-asynchronous-tasks-with-node-js-and-bullmq)

## Why queue is needed
- Image generation can take time, so you don’t want to block the HTTP request.
- If the worker crashes or restarts, queued jobs stay in Redis.
- Multiple users can submit jobs at the same time, and the queue orders and processes them cleanly. 


## So is it only for multiple users?
No. Even for **one user**, a queue is useful if the task is slow or unreliable. 
Multiple users just make the benefit more obvious because jobs can pile up and need controlled processing. 


## In our app
Flow is:
1. User uploads image and prompt.
2. API adds a job to BullMQ.
3. Worker picks the job from Redis.
4. AI service generates image.
5. MongoDB session status updates to `PROCESSING` / `DONE`.
6. Frontend polls and shows result. 
 */

const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const sessionRepository = require('../repositories/sessionRepository');
const aiService = require('../services/aiService');
const config = require('../config')
const { AI_JOB_TYPES } = require('../constants/aiJobTypes');

// Initialize Upstash Redis Connection (free tier)
// TODO: move this to src/lib/redis.js so both queues share one connection
// instance instead of each queue file opening its own.
const redisConnection = new IORedis({
    // host: config.redisHost,
    // port: config.redisPort,
    // password: config.redisPassword, // host + port + password these key names can not be chnaged , 
    ...config.redisConfig,
    tls: {},
    maxRetriesPerRequest: null, // Required by BullMQ
    // Upstash/BullMQ connection examples use TLS and maxRetriesPerRequest: null.
});

// default job options for BullMQ queues
const defaultJobOptions = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 1000,
};

// BullMQ rate limiter: max 2 jobs per second
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
            // Update session status to PROCESSING
            await sessionRepository.updateStatusById(sessionId, 'PROCESSING', {
                aiJobId: job.id,
            });

            // Call the provided processFn to handle the AI generation logic
            const result = await processFn(job.data);

            if (result.success) {
                // Update session status to DONE with result data
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
    queueName: AI_JOB_TYPES.TEXT_TO_IMAGE.queueName,
    processFn: ({ sessionId, productSku, userPrompt }) =>
        aiService.processGeneration(sessionId, productSku, userPrompt),
});

// --- Image-to-image queue ---
const { queue: aiImageToImageQueue, worker: aiImageToImageWorker, shutdown: shutdownImageToImageWorker } = createAIQueue({
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