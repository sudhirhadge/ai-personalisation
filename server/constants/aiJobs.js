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
    WRAPPER_COMPOSITE: {
        queueName: 'ai-wrapper-composite-generation',
        jobName: 'ai-wrapper-composite-generation',
        requiresOriginalImage: true, // still needs the user's source photo to cartoonify
    },

    WRAPPER_COMPOSITE_MULTI_REF: {
        queueName: 'ai-wrapper-composite-multiref-generation', // composite generation with multiple reference images (e.g. 2-3) , orignal image may slightly differ from the reference images, but the reference images are used to guide the style of the final output
        jobName: 'ai-wrapper-composite-multiref-generation',
        requiresOriginalImage: true,
        /*
        requiresWrapperImageUrl: true, // new flag — this job also needs the wrapper template's public URL

        I added requiresWrapperImageUrl rather than overloading requiresOriginalImage — 
        this job type genuinely needs two different inputs (user photo + wrapper URL), 
        and your existing flag only tracked one boolean dimension. 
        Squeezing a second requirement into the same flag would force the 
        controller to guess; better to be explicit.
        */
        // requiresWrapperImageUrl removed — URL now resolved server-side from productSku
        fixedPrompt: true, // this job type has a fixed prompt template, so the user doesn't provide free-text prompt. The prompt is generated in the worker based on the session and wrapper image.
    },
};

module.exports = { AI_JOB_TYPES };
