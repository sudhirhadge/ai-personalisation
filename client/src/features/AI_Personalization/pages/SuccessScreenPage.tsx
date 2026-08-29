/**
 * Rewrite of SuccessScreen.jsx. Builds the personalization link from
 * sessionData.jwtToken via buildPersonalizeNowUrl (utils/personalizationLink.ts)
 * rather than reading/re-parsing sessionData.personalizationLink — the old
 * code split the token out of that string with
 * `personalizationLink.split('token=')[1]`, which was fragile and pointless
 * given jwtToken is already sitting right next to it in the same response.
 */
import { useNavigate } from 'react-router-dom';
import CopyLinkButton from '../components/CopyLinkButton';
import { buildPersonalizeNowUrl } from '../utils/personalizationLink';
import type { CreateSessionResponse } from '../types/session';

interface SuccessScreenPageProps {
    sessionData: CreateSessionResponse;
}

function SuccessScreenPage({ sessionData }: SuccessScreenPageProps) {
    const navigate = useNavigate();
    const link = buildPersonalizeNowUrl(sessionData.jwtToken);

    return (
        <div className="min-h-screen gradient-bg py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
                <div className="card">
                    <div className="flex justify-center mb-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-extrabold gradient-text">Session Created!</h1>
                        <p className="mt-3 text-gray-600">
                            Your personalization session for{' '}
                            <span className="font-semibold text-gray-900">{sessionData.productSku}</span> is ready
                        </p>
                    </div>

                    <div className="alert alert-success mb-6">
                        <strong className="block">Success!</strong>
                        <span>A confirmation email has been sent to {sessionData.email}</span>
                    </div>

                    <div className="mb-6">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Your Personalization Link:</p>

                        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4">
                            <code className="text-sm text-primary-600 break-all">{link}</code>
                        </div>

                        <div className="mb-4">
                            <CopyLinkButton link={link} />
                        </div>

                        <button
                            onClick={() => navigate(`/personalize-now?token=${sessionData.jwtToken}`)}
                            className="btn-primary w-full"
                        >
                            Personalize Now
                        </button>
                    </div>

                    <div className="text-center">
                        <button
                            onClick={() => navigate('/')}
                            className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors"
                        >
                            ← Create another session
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SuccessScreenPage;
