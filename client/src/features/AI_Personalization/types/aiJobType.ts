/**
 * Client-side mirror of server/constants/aiJobs.js AI_JOB_TYPES. There's no
 * shared package between client/server in this repo, so this is kept
 * manually in sync — if a mode is added/changed on the backend, update both
 * this union and config/generationModes.ts.
 */
export type GenerationMode =
    | 'TEXT_TO_IMAGE'
    | 'IMAGE_TO_IMAGE'
    | 'WRAPPER_COMPOSITE'
    | 'WRAPPER_COMPOSITE_MULTI_REF';

export interface GenerationModeConfig {
    mode: GenerationMode;
    /** Path segment appended to /sessions/me/ (see server/routes/ai.js) */
    endpointPath: string;
    label: string;
    description: string;
    /**
     * Whether this mode takes a free-text prompt. False only for
     * WRAPPER_COMPOSITE_MULTI_REF, which has `fixedPrompt: true` server-side
     * (the worker builds the prompt itself from the session + wrapper image).
     */
    hasPromptInput: boolean;
    /**
     * Whether this mode requires the session's productSku to have a
     * configured wrapper region (server/services/imageCompositeService.js).
     * Used to filter which modes the UI even offers for a given session,
     * so the user never hits the backend's "No wrapper template configured"
     * 400 — the mode simply isn't shown as an option.
     */
    requiresWrapperTemplate: boolean;
}
