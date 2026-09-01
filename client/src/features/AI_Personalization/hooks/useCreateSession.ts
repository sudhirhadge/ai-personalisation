/**
 * Creates a new session and persists the returned JWT. Does NOT touch the
 * [session, token] query cache on success — a brand-new session has a
 * brand-new token, so there's no existing cache entry to update; the
 * subsequent useSession() call (once the new token is persisted and the
 * personalize-now page mounts) will simply fetch fresh under its own key.
 */
import { useMutation } from '@tanstack/react-query';
import { sessionApi } from '../api/sessionApi';
import { setAuthToken } from './useAuthToken';
import type { CreateSessionResponse } from '../types/session';

interface CreateSessionInput {
    email: string;
    productSku: string;
}

export function useCreateSession() {
    return useMutation<CreateSessionResponse, Error, CreateSessionInput>({
        mutationFn: ({ email, productSku }) => sessionApi.createSession(email, productSku),
        onSuccess: (data) => {
            setAuthToken(data.jwtToken);
        },
    });
}
