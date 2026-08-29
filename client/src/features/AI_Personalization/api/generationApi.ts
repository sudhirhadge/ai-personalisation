/**
 * AI generation endpoints (server/routes/ai.js).
 *
 * `generate` is the single call path for all 4 modes — it looks up the
 * endpoint from GENERATION_MODES rather than having one function per mode
 * (see config/generationModes.ts for why). This is also where the old
 * `aiApi.generateImage` bug lived: it was hardcoded to POST
 * '/sessions/me/generate-image-from-image' regardless of which mode it
 * claimed to implement. Resolving the path from the config table makes that
 * class of bug structurally impossible — there's exactly one mapping from
 * mode to path, defined once.
 */
import { apiGet, apiPost } from './httpClient';
import { GENERATION_MODES } from '../config/generationModes';
import type { GenerationMode } from '../types/aiJobType';
import type { JobStatus } from '../types/jobStatus';

export interface GenerateAIResult {
    aiJobId: string;
    status: string;
}

export const generationApi = {
    generate(mode: GenerationMode, prompt?: string): Promise<GenerateAIResult> {
        const { endpointPath, hasPromptInput } = GENERATION_MODES[mode];
        // Omit the prompt field entirely for fixed-prompt modes (currently
        // only WRAPPER_COMPOSITE_MULTI_REF) rather than sending an empty
        // string — the backend's validation only requires it when
        // jobType.fixedPrompt is false, so sending nothing here matches that.
        const body = hasPromptInput ? { prompt } : {};
        return apiPost<GenerateAIResult>(`/sessions/me/${endpointPath}`, body);
    },

    getJobStatus(aiJobId: string): Promise<JobStatus> {
        return apiGet<JobStatus>(`/sessions/me/status/${aiJobId}`);
    },
};
