import type { SessionStatus } from './session';

/**
 * Mirrors GET /api/v1/sessions/me/status/:aiJobId (server/controllers/aiController.js#getAIStatus).
 * `status` is the session's status (not a BullMQ-specific state); `jobState`
 * is BullMQ's own internal state string, kept separate since it's a
 * different vocabulary (e.g. 'completed'/'active'/'waiting') than the
 * session status enum.
 */
export interface JobStatus {
    aiJobId: string;
    status: SessionStatus;
    processedImageUrl: string | null;
    aiError: string | null;
    jobState: string;
}
