/**
 * Single place that constructs the /personalize-now deep link. Always build
 * it from a held JWT via this function — never read `session.personalizationLink`
 * from GET /sessions/me (see the doc comment on Session.personalizationLink
 * in types/session.ts for why that field is unreliable after session
 * creation). The old SuccessScreen.jsx re-derived the token by string-
 * splitting personalizationLink instead of using the jwtToken it already
 * had; this function replaces that pattern with the direct, correct one.
 */
export function buildPersonalizeNowUrl(jwtToken: string): string {
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
    return `${frontendUrl}/personalize-now?token=${jwtToken}`;
}
