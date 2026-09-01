/**
 * PROCESSING/DONE/FAILED UI, driven by useSession() (patched by
 * useJobStatus's poll — see that hook's comment for how the two stay in
 * sync) rather than reading useJobStatus() directly, so this component
 * works correctly even on a fresh page load that recovers a DONE/FAILED
 * session straight from GET /sessions/me (Phase 0's session-resume fix)
 * without ever needing to have polled anything itself.
 *
 * Because the backend only tracks one job per session (Session.js has a
 * single aiJobId/processedImageUrl pair, not an array), DONE/FAILED both
 * surface a "start a new session" CTA rather than implying in-place mode
 * switching is possible.
 */
import { Link } from 'react-router-dom';
import { useSession } from '../hooks/useSession';
import { useJobStatus } from '../hooks/useJobStatus';

function GenerationStatusPanel() {
    const { data: session } = useSession();
    // Keeps the poll alive for as long as this panel is mounted; useJobStatus
    // itself stops refetching once status is DONE/FAILED.
    useJobStatus(session?.status === 'PROCESSING' ? session.aiJobId : null);

    if (!session) return null;

    if (session.status === 'PROCESSING') {
        return (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Generating your personalized image — this can take up to a minute...</span>
            </div>
        );
    }

    if (session.status === 'DONE' && session.processedImageUrl) {
        return (
            <div>
                <div className="alert alert-success">Your image is ready!</div>
                <img
                    src={session.processedImageUrl}
                    alt="Generated result"
                    className="w-full rounded-lg border-2 border-gray-200"
                />
                <Link to="/" className="btn-secondary inline-block mt-4">
                    Start a new session to try a different mode
                </Link>
            </div>
        );
    }

    if (session.status === 'FAILED') {
        return (
            <div>
                <div className="alert alert-error">
                    {session.aiError || 'Generation failed. Please try again.'}
                </div>
                <Link to="/" className="btn-secondary inline-block mt-2">
                    Start a new session
                </Link>
            </div>
        );
    }

    return null;
}

export default GenerationStatusPanel;
