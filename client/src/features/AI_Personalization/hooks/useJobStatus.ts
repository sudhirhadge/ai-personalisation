/**
 * Direct replacement for the old PersonalizeNow.jsx raw `setInterval` poll
 * (3000ms, manually cleared on unmount/status change, with no cancellation
 * guard against overlapping requests). TanStack Query's refetchInterval
 * handles the interval lifecycle, in-flight de-duping, and cleanup on
 * unmount for free.
 *
 * refetchInterval is a function of the query's own latest data (TanStack
 * Query v5 signature: (query) => number | false) — polling stops as soon as
 * status is DONE or FAILED, rather than the old code's approach of clearing
 * the interval from a separate useEffect watching session.status.
 *
 * Known limitation (documented, not fixed by this hook): this only carries
 * processedImageUrl/aiError into the session cache for the lifetime of this
 * poll. Phase 0's backend fix means a fresh GET /sessions/me now also
 * returns these fields directly, so reopening a link or refreshing mid-flow
 * recovers correctly without this hook needing to have been running.
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { generationApi } from '../api/generationApi';
import { sessionQueryKey } from './useSession';
import { getAuthToken } from './useAuthToken';
import type { JobStatus } from '../types/jobStatus';
import type { Session } from '../types/session';

const POLL_INTERVAL_MS = 3000;

export function useJobStatus(aiJobId: string | null | undefined) {
    const queryClient = useQueryClient();
    const token = getAuthToken();

    const query = useQuery({
        queryKey: ['jobStatus', aiJobId],
        queryFn: () => generationApi.getJobStatus(aiJobId as string),
        enabled: Boolean(aiJobId),
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status === 'DONE' || status === 'FAILED' ? false : POLL_INTERVAL_MS;
        },
    });

    // Bridges the poll result into the session cache so components that read
    // useSession() (not useJobStatus()) for processedImageUrl/aiError/status
    // stay in sync once a job finishes — mirrors what useGenerateAI's
    // optimistic update does at the start of the job.
    useEffect(() => {
        const data: JobStatus | undefined = query.data;
        if (!data || (data.status !== 'DONE' && data.status !== 'FAILED')) {
            return;
        }
        queryClient.setQueryData<Session>(sessionQueryKey(token), (previous) =>
            previous
                ? {
                      ...previous,
                      status: data.status,
                      processedImageUrl: data.processedImageUrl,
                      aiError: data.aiError,
                  }
                : previous
        );
    }, [query.data, queryClient, token]);

    return query;
}
