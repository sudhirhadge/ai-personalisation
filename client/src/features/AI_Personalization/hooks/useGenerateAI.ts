/**
 * Triggers a generation job for the given mode. On success, optimistically
 * writes aiJobId/aiJobType/status: PROCESSING into the cached session so
 * useJobStatus() (below) can start polling immediately, without waiting for
 * a round-trip refetch of GET /sessions/me.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generationApi, type GenerateAIResult } from '../api/generationApi';
import { sessionQueryKey } from './useSession';
import { getAuthToken } from './useAuthToken';
import type { GenerationMode } from '../types/aiJobType';
import type { Session } from '../types/session';

interface GenerateAIInput {
    mode: GenerationMode;
    prompt?: string;
}

export function useGenerateAI() {
    const queryClient = useQueryClient();
    const token = getAuthToken();
    const queryKey = sessionQueryKey(token);

    return useMutation<GenerateAIResult, Error, GenerateAIInput>({
        mutationFn: ({ mode, prompt }) => generationApi.generate(mode, prompt),
        onSuccess: (result, { mode }) => {
            queryClient.setQueryData<Session>(queryKey, (previous) =>
                previous
                    ? {
                          ...previous,
                          status: 'PROCESSING',
                          aiJobId: result.aiJobId,
                          aiJobType: mode,
                      }
                    : previous
            );
        },
    });
}
