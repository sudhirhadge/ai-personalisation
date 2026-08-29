/**
 * Single source of truth for the 4 AI generation modes.
 *
 * Why one config table instead of 4 near-duplicate code paths: the old
 * frontend had (at most) one hand-written function + one UI branch per mode,
 * which is how it ended up with a mode named "generateImage" silently
 * posting to the wrong endpoint (services/api.js) — nothing forced the
 * function name, the endpoint path, and the UI to agree with each other.
 * With everything keyed off GENERATION_MODES, api/generationApi.ts,
 * components/ModeSelector.tsx, and components/PromptInput.tsx all read from
 * the same object — there is no second place for a mode's behavior to drift
 * out of sync. Adding a 5th mode later means adding one entry here, not a
 * new function plus a new UI branch plus a new prompt-field conditional.
 *
 * `endpointPath` values match server/routes/ai.js exactly. `hasPromptInput`/
 * `requiresWrapperTemplate` mirror server/constants/aiJobs.js AI_JOB_TYPES.
 */
import type { GenerationMode, GenerationModeConfig } from '../types/aiJobType';

export const GENERATION_MODES: Record<GenerationMode, GenerationModeConfig> = {
    TEXT_TO_IMAGE: {
        mode: 'TEXT_TO_IMAGE',
        endpointPath: 'generate-image-from-prompt',
        label: 'Text to Image',
        description: 'Describe what you want and let AI generate it from scratch.',
        hasPromptInput: true,
        requiresWrapperTemplate: false,
    },
    IMAGE_TO_IMAGE: {
        mode: 'IMAGE_TO_IMAGE',
        endpointPath: 'generate-image-from-image',
        label: 'Image to Image',
        description: 'Transform your uploaded photo based on a text prompt.',
        hasPromptInput: true,
        requiresWrapperTemplate: false,
    },
    WRAPPER_COMPOSITE: {
        mode: 'WRAPPER_COMPOSITE',
        endpointPath: 'generate-wrapper-composite',
        label: 'Wrapper Composite',
        description: 'Cartoonify your photo and place it onto a product wrapper template.',
        hasPromptInput: true,
        requiresWrapperTemplate: true,
    },
    WRAPPER_COMPOSITE_MULTI_REF: {
        mode: 'WRAPPER_COMPOSITE_MULTI_REF',
        endpointPath: 'generate-wrapper-composite-multiref',
        label: 'Wrapper Composite (Multi-Reference)',
        description: 'Higher-fidelity wrapper compositing using multiple reference images — no prompt needed.',
        hasPromptInput: false,
        requiresWrapperTemplate: true,
    },
};

export const GENERATION_MODE_LIST: GenerationModeConfig[] = Object.values(GENERATION_MODES);
