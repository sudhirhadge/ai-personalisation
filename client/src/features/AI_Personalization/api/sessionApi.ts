/**
 * Session endpoints (server/routes/sessions.js).
 * Replaces services/api.js's sessionApi, which had getCurrentSession and
 * getSessionByToken as literal duplicates — both just called GET /sessions/me.
 * There is exactly one read function here now; hooks/useSession.ts is the
 * only call-site pattern going forward, whether the token came from a fresh
 * create or from a ?token= URL param.
 */
import { apiGet, apiPost } from './httpClient';
import type { CreateSessionResponse, Session } from '../types/session';

export const sessionApi = {
    createSession(email: string, productSku: string): Promise<CreateSessionResponse> {
        return apiPost<CreateSessionResponse>('/sessions', { email, productSku });
    },

    getCurrentSession(): Promise<Session> {
        return apiGet<Session>('/sessions/me');
    },
};
