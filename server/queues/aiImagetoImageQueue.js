/**
 * AI Queue (BullMQ + Upstash Redis)
 * Background job processing for AI image generation
 * 
 * Architectural Decision:
 * - Uses BullMQ for production-grade queue
 * - Upstash Redis (free 50MB) for queue storage
 * - Retry logic: 3 attempts with exponential backoff
 * - Job status tracking in MongoDB
 */

/**
 * Yes — **the queue is mainly for asynchronous work and scaling**, not because the app can’t work without it. In your case, it helps keep the API fast while image generation runs in the background, and it also lets Redis store jobs safely until a worker processes them. [digitalocean](https://www.digitalocean.com/community/tutorials/how-to-handle-asynchronous-tasks-with-node-js-and-bullmq)

## Why queue is needed
- Image generation can take time, so you don’t want to block the HTTP request.
- If the worker crashes or restarts, queued jobs stay محفوظ in Redis.
- Multiple users can submit jobs at the same time, and the queue orders and processes them cleanly. [docs.bullmq](https://docs.bullmq.io/guide/queues)

## So is it only for multiple users?
No. Even for **one user**, a queue is useful if the task is slow or unreliable. Multiple users just make the benefit more obvious because jobs can pile up and need controlled processing. [dev](https://dev.to/agust1n/how-we-use-redis-with-bullmq-on-hetzner-for-queue-management-at-fotify-2k8h)

## In your app
Flow is:
1. User uploads image and prompt.
2. API adds a job to BullMQ.
3. Worker picks the job from Redis.
4. AI service generates image.
5. MongoDB session status updates to `PROCESSING` / `DONE`.
6. Frontend polls and shows result. [dev](https://dev.to/agust1n/how-we-use-redis-with-bullmq-on-hetzner-for-queue-management-at-fotify-2k8h)

## Simple answer
So yes, you’re right that the user only sees upload → prompt → generated image.  
But **queue/Redis sits behind that flow** to handle the generation reliably and asynchronously. [digitalocean](https://www.digitalocean.com/community/tutorials/how-to-handle-asynchronous-tasks-with-node-js-and-bullmq)
 */
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const sessionRepository = require('../repositories/sessionRepository');
const aiService = require('../services/aiService');
const config = require('../config');

// Initialize Upstash Redis Connection (free tier)
// move this to src/lib/redis.ts for better reuse across the app 
const redisConnection = new IORedis({
    // host: config.redisHost,
    // port: config.redisPort,
    // password: config.redisPassword,
    ...config.redisConfig,
    tls: {},
    maxRetriesPerRequest: null, // Important for BullMQ
    // Upstash/BullMQ connection examples use TLS and maxRetriesPerRequest: null.
});

// Create AI generation queue
const aiImageToImageQueue = new Queue('ai-image-to-image-generation', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3, // Retry 3 times
        backoff: {
            type: 'exponential',
            delay: 5000, // 5 seconds between attempts
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 1000, // Keep last 1000 failed jobs
    },
});

// Create queue worker
const aiImageToImageWorker = new Worker('ai-image-to-image-generation', async (job) => {
    const { sessionId, productSku, userPrompt, originalImageUrl } = job.data;

    console.log(`🔄 Processing AI job: ${job.id} for session ${sessionId}`);

    try {
        // Update status to PROCESSING
        await sessionRepository.updateStatusById(sessionId, 'PROCESSING', {
            aiJobId: job.id,
        });

        // Process AI generation
        const result = await aiService.processImageToImageGeneration(sessionId, productSku, userPrompt, originalImageUrl);

        if (result.success) {
            // Update session with success
            await sessionRepository.updateStatusById(sessionId, 'DONE', {
                processedImageUrl: result.processedImageUrl,
                aiPrompt: result.aiPrompt,
                aiResult: result.aiResult,
                aiProcessedAt: new Date().toISOString(),
            });

            console.log(`✅ AI job completed: ${job.id}`);
            return result;
        } else {
            // Update session with failure
            await sessionRepository.updateStatusById(sessionId, 'FAILED', {
                aiError: result.error,
            });

            throw new Error(result.error);
        }
    } catch (error) {
        console.error(`❌ AI job failed: ${job.id}`, error);

        // Update session with error (if not already FAILED)
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
    // Limit concurrent jobs
    limiter: {
        max: 2, // Max 2 concurrent jobs
        duration: 1000, // Per second
    },
});

// Handle worker events
aiImageToImageWorker.on('completed', (job) => {
    console.log(`✅ Job completed: ${job.id}`);
});

aiImageToImageWorker.on('failed', (job) => {
    console.log(`❌ Job failed: ${job.id}`, job?.failedReason);
});

aiImageToImageWorker.on('error', (error) => {
    console.error(`🚨 Worker error:`, error);
});

// Graceful shutdown
async function shutdownWorker() {
    console.log('🛑 Shutting down AI worker...');
    await aiImageToImageWorker.close();
    await redisConnection.close();
}

process.on('SIGTERM', shutdownWorker);
process.on('SIGINT', shutdownWorker);

module.exports = {
    aiImageToImageQueue,
    aiImageToImageWorker,
    shutdownWorker,
};