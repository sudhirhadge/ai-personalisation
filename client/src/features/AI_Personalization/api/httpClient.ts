/**
 * Shared axios instance for the AI Personalization feature.
 *
 * Replaces services/api.js. Keeps the same three responsibilities (JWT
 * attach, response unwrap, error normalization) but reads the token via
 * getAuthToken() (hooks/useAuthToken.ts) instead of calling
 * localStorage.getItem directly — that's the one place this feature touches
 * localStorage now, matching the "single source of truth" the old code
 * lacked (CreateSession.jsx, PersonalizeNow.jsx, and this file all wrote
 * their own localStorage.getItem('jwtToken') before).
 */
import axios, { type AxiosInstance } from 'axios';
import { getAuthToken } from '../hooks/useAuthToken';
import type { ApiSuccess } from '../types/apiEnvelope';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const httpClient: AxiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

httpClient.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Unwraps { success: true, data } to just `data`, and normalizes
// { success: false, error } (or a network/timeout failure) into a plain
// Error so callers only ever deal with `try { await x() } catch (e: Error)`.
httpClient.interceptors.response.use(
    // Return type is deliberately `any`: axios's own typings require this
    // handler to return an AxiosResponse, but we're intentionally changing
    // the runtime shape to the unwrapped payload — apiGet/apiPost/apiDelete
    // below re-cast that payload to the correct type T at each call site.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response): any => {
        // A few endpoints (e.g. DELETE /sessions/me/image) can return HTTP 200
        // with { success: false, error } in the body rather than a non-2xx
        // status — checking `success` explicitly here, not just relying on
        // axios's status-based reject, so those failures still surface as
        // thrown errors to callers instead of silently resolving as success.
        const body = response.data as ApiSuccess<unknown> | { success: false; error: string };
        if (body.success === false) {
            throw new Error(body.error || 'Request failed');
        }
        return body.data;
    },
    (error) => {
        const message =
            error.response?.data?.error || error.message || 'An unexpected error occurred';
        return Promise.reject(new Error(message));
    }
);

/**
 * Typed request helpers. Axios's own generics (e.g. httpClient.get<T>) would
 * type the result as AxiosResponse<T>, but the response interceptor above
 * already unwraps to the bare payload at runtime — these helpers cast to the
 * actual runtime shape (T) once, here, so every api/*.ts call site gets a
 * correctly-typed result without repeating an `as unknown as T` cast.
 */
export async function apiGet<T>(url: string): Promise<T> {
    return httpClient.get(url) as unknown as Promise<T>;
}

export async function apiPost<T>(
    url: string,
    body?: unknown,
    config?: Parameters<AxiosInstance['post']>[2]
): Promise<T> {
    return httpClient.post(url, body, config) as unknown as Promise<T>;
}

export async function apiDelete<T>(url: string): Promise<T> {
    return httpClient.delete(url) as unknown as Promise<T>;
}
