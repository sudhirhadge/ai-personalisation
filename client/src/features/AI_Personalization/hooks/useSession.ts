/**
 * The single hook every page/component uses to read the current session.
 * Replaces the old per-page pattern (CreateSession.jsx and PersonalizeNow.jsx
 * each kept their own `useState<Session>` and manually re-synced it after
 * every mutation). Session data now lives only in this query's cache;
 * mutation hooks (useUploadImage, useGenerateAI, etc.) update that cache
 * directly instead of components holding their own copies.
 *
 * Keyed on [session, token] rather than just ['session'] so that switching
 * to a different session's link (a different token) never serves back
 * another session's cached data.
 */
import { useQuery } from '@tanstack/react-query';
import { sessionApi } from '../api/sessionApi';
import { getAuthToken } from './useAuthToken';

export const sessionQueryKey = (token: string | null) => ['session', token] as const;

export function useSession() {
    const token = getAuthToken();

    return useQuery({
        queryKey: sessionQueryKey(token),
        queryFn: sessionApi.getCurrentSession,
        enabled: Boolean(token),
    });
}
