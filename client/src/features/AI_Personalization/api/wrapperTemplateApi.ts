/**
 * Public wrapper-template catalog (server/routes/wrapperTemplates.js, added
 * in Phase 0 of this rewrite). No auth header is required — httpClient's
 * interceptor attaching one anyway (if a token happens to be in
 * localStorage) is harmless since the endpoint ignores it.
 */
import { apiGet } from './httpClient';
import type { WrapperTemplate } from '../types/wrapperTemplate';

export const wrapperTemplateApi = {
    getWrapperTemplates(): Promise<WrapperTemplate[]> {
        return apiGet<WrapperTemplate[]>('/products/wrapper-templates');
    },
};
