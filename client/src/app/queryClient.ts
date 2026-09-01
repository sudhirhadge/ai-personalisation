/**
 * Shared TanStack Query client for the AI Personalization feature.
 *
 * Why these defaults:
 * - retry: 1 — session/job endpoints fail fast and meaningfully (404 session
 *   not found, 400 validation, 500 worker error); the default 3-retry backoff
 *   just delays surfacing a real error to the user during a short-lived flow.
 * - refetchOnWindowFocus: false — this is a single-session personalization
 *   wizard, not a long-lived dashboard; refetching on tab focus adds noise
 *   (and an unwanted extra request) without a corresponding benefit here.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});
