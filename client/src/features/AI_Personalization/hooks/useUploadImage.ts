/**
 * Uploading is mode-independent — every generation mode requires an
 * UPLOADED session first (server/controllers/aiController.js gates on
 * session.status === 'UPLOADED' regardless of mode), so this hook has no
 * knowledge of which mode will be used afterward.
 *
 * On success, the upload response (a partial shape — sessionId/status/
 * originalImageUrl/originalImageName only) is merged directly into the
 * cached Session via setQueryData, then the query is invalidated to
 * reconcile with server truth on the next read. This replaces the old
 * PersonalizeNow.jsx pattern of `setSession({ ...session, ...partialData })`
 * living in component state — the merge now happens once, in the cache,
 * so every component reading useSession() sees it immediately.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { imageApi } from '../api/imageApi';
import { sessionQueryKey } from './useSession';
import { getAuthToken } from './useAuthToken';
import type { Session } from '../types/session';

export function useUploadImage() {
    const queryClient = useQueryClient();
    const token = getAuthToken();
    const queryKey = sessionQueryKey(token);

    return useMutation({
        mutationFn: (file: File) => imageApi.uploadImage(file),
        onSuccess: (result) => {
            queryClient.setQueryData<Session>(queryKey, (previous) =>
                previous ? { ...previous, ...result } : previous
            );
            queryClient.invalidateQueries({ queryKey });
        },
    });
}
