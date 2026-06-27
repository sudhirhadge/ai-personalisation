// string literals are exactly the kind of thing that drifts silently
// (typo one in the controller, queue never receives the job, no error, just a silent hang).
// Let's centralize them and wire all four layers together consistently.
// New shared constants file — single source of truth


/**
 * Central registry of AI job types.
 * Controller, queue, and worker all reference these instead of hardcoding
 * queue names / job names as string literals in multiple files. If these
 * drift (e.g. a typo in one file), jobs silently fail to enqueue or process
 * with no obvious error — keeping them here prevents that class of bug.
 */
const AI_JOB_TYPES = {
    TEXT_TO_IMAGE: {
        queueName: 'ai-text-to-image-generation',
        jobName: 'ai-text-to-image-generation',
        requiresOriginalImage: false,
    },
    IMAGE_TO_IMAGE: {
        queueName: 'ai-image-to-image-generation',
        jobName: 'ai-image-to-image-generation',
        requiresOriginalImage: true,
    },
};

module.exports = { AI_JOB_TYPES };
