/**
 * Deleting resets the session to CREATED server-side (storageService.js).
 * Since the delete response carries no data payload, this invalidates the
 * session query instead of patching it — a real refetch is the only way to
 * get the post-delete session shape.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { imageApi } from '../api/imageApi';
import { sessionQueryKey } from './useSession';
import { getAuthToken } from './useAuthToken';

export function useDeleteImage() {
    const queryClient = useQueryClient();
    const token = getAuthToken();
    const queryKey = sessionQueryKey(token);

    return useMutation({
        mutationFn: () => imageApi.deleteImage(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });
}
