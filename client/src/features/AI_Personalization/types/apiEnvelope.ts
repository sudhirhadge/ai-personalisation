/**
 * Every backend response follows the same envelope: { success, data } on the
 * happy path, { success: false, error } on failure. httpClient's response
 * interceptor unwraps `.data` for callers, so these envelope types are only
 * needed by the interceptor itself (to type the raw axios response) — hook
 * and api-function return types are just the unwrapped payload type T.
 */
export interface ApiSuccess<T> {
    success: true;
    data: T;
}

export interface ApiError {
    success: false;
    error: string;
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiError;
