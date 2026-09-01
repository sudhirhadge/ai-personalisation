/**
 * The single place that touches localStorage for the session JWT.
 *
 * Named `useAuthToken` (hooks/ convention) but deliberately NOT a React hook
 * — it's called both from React components (on session create / token-from-URL
 * persist) and from api/httpClient.ts's axios interceptor, which runs outside
 * any component tree. A real hook can't be called from the interceptor, so
 * this stays a set of plain functions; keeping it under hooks/ (rather than
 * utils/) signals it's the intended access point for anything that used to
 * reach into localStorage directly across the old codebase (services/api.js,
 * CreateSession.jsx, PersonalizeNow.jsx all did this ad hoc before).
 */
const JWT_STORAGE_KEY = 'jwtToken';

export function getAuthToken(): string | null {
    return localStorage.getItem(JWT_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
    localStorage.setItem(JWT_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
    localStorage.removeItem(JWT_STORAGE_KEY);
}
