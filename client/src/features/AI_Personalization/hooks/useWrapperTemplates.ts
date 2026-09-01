/**
 * Static catalog data — fetch once, no polling, no auth dependency (the
 * endpoint is public, so this stays enabled even before a session/token
 * exists, unlike useSession()). staleTime: Infinity because the template
 * list only changes when a developer adds a new SKU to
 * WRAPPER_OVERLAY_REGIONS on the backend, which requires a deploy anyway.
 */
import { useQuery } from '@tanstack/react-query';
import { wrapperTemplateApi } from '../api/wrapperTemplateApi';

export function useWrapperTemplates() {
    return useQuery({
        queryKey: ['wrapperTemplates'],
        queryFn: wrapperTemplateApi.getWrapperTemplates,
        staleTime: Infinity,
    });
}
