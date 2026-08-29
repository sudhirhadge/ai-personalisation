/**
 * Manual Jest mock for queues/aiQueue.js.
 *
 * Why this exists: app.js unconditionally requires routes/ai.js, which
 * requires the real aiQueue.js — and constructing BullMQ's Queue/Worker
 * pairs forces an eager Redis connection + health check regardless of
 * ioredis options like lazyConnect (confirmed empirically: requiring app.js
 * without this mock took ~15-20s and genuinely connected to production
 * Upstash Redis). Any test that does supertest(require('../app')) — even
 * one only testing sessions/storage routes that never touch the queue —
 * would otherwise pay that cost and depend on real infrastructure.
 *
 * Activate with `jest.mock('../queues/aiQueue')` (or the correct relative
 * path) at the top of a test file; Jest automatically substitutes this file
 * for the real module. Shape mirrors the real module's exports exactly so
 * aiController.js's destructured imports keep working.
 */
const fakeQueue = { add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }) };
const fakeWorker = { on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };

module.exports = {
    aiQueue: fakeQueue,
    aiWorker: fakeWorker,
    aiImageToImageQueue: fakeQueue,
    aiImageToImageWorker: fakeWorker,
    aiWrapperCompositeQueue: fakeQueue,
    aiWrapperCompositeWorker: fakeWorker,
    aiWrapperCompositeMultiRefQueue: fakeQueue,
    aiWrapperCompositeMultiRefWorker: fakeWorker,
    shutdownAllWorkers: jest.fn().mockResolvedValue(undefined),
};
