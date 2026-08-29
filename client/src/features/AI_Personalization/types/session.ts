/**
 * Mirrors the wire shape of GET /api/v1/sessions/me and POST /api/v1/sessions
 * (server/controllers/sessionController.js). All the optional-looking fields
 * are always present on the response (null until set) as of the Phase 0
 * session-resume fix — they're typed as `| null` here, not made optional,
 * because the backend guarantees the key exists.
 */
export type SessionStatus = 'CREATED' | 'UPLOADED' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface Session {
    sessionId: string;
    email: string;
    productSku: string;
    status: SessionStatus;
    /**
     * Server-computed link. Only trustworthy on the POST /sessions response —
     * the Session model's virtual builds it from a legacy DB-only UUID field,
     * not the real signed JWT, so GET /sessions/me's copy of this field
     * resolves to an invalid deep link. Always reconstruct the link
     * client-side from the held JWT via utils/personalizationLink.ts instead
     * of reading this field after the initial creation response.
     */
    personalizationLink: string;
    createdAt: string;
    updatedAt: string;
    originalImageUrl: string | null;
    originalImageName: string | null;
    aiJobId: string | null;
    aiJobType: string | null;
    processedImageUrl: string | null;
    aiError: string | null;
}

/**
 * POST /api/v1/sessions returns a smaller, separate shape from GET /sessions/me
 * — notably it's the only response that ever returns the real signed JWT
 * (needed for all subsequent Bearer-authenticated calls), but it does NOT
 * include createdAt/originalImageUrl/aiJobId/etc. Modeled as its own
 * interface rather than `extends Session` to avoid claiming fields the
 * backend doesn't actually send at this point in the flow.
 */
export interface CreateSessionResponse {
    sessionId: string;
    email: string;
    productSku: string;
    status: SessionStatus;
    /** Correct at creation time — safe to use directly, unlike the
     * GET /sessions/me copy of this field (see the Session.personalizationLink
     * doc comment above). */
    personalizationLink: string;
    jwtToken: string;
}
