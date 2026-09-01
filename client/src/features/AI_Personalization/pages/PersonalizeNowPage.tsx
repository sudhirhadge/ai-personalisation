/**
 * Rewrite of PersonalizeNow.jsx (previously 415 lines / 11 useState vars /
 * a raw setInterval poll). Server data (session, job status, wrapper
 * templates) now lives entirely in TanStack Query's cache via useSession()
 * and friends; the only local state left here is the free-text prompt and
 * the wizard's step/selectedMode (PersonalizationWizardContext) — genuine
 * client-only UI state that was never server data to begin with.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ImageUploader from '../components/ImageUploader';
import ModeSelector from '../components/ModeSelector';
import PromptInput from '../components/PromptInput';
import GenerationStatusPanel from '../components/GenerationStatusPanel';
import WrapperTemplatePicker from '../components/WrapperTemplatePicker';
import { useSession } from '../hooks/useSession';
import { useWrapperTemplates } from '../hooks/useWrapperTemplates';
import { useGenerateAI } from '../hooks/useGenerateAI';
import { setAuthToken } from '../hooks/useAuthToken';
import {
    PersonalizationWizardProvider,
    usePersonalizationWizard,
} from '../context/PersonalizationWizardContext';
import { GENERATION_MODES } from '../config/generationModes';

function GenerationConfigurator() {
    const { data: session } = useSession();
    const { data: wrapperTemplates } = useWrapperTemplates();
    const { selectedMode, reset } = usePersonalizationWizard();
    const generateAI = useGenerateAI();
    const [prompt, setPrompt] = useState('');

    if (!session || !selectedMode) return null;

    const modeConfig = GENERATION_MODES[selectedMode];
    const matchingTemplate = wrapperTemplates?.find((t) => t.sku === session.productSku);

    const canGenerate = modeConfig.hasPromptInput ? prompt.trim().length > 0 : true;

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-purple-900">{modeConfig.label}</h2>
                <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-700">
                    ← Change mode
                </button>
            </div>

            {modeConfig.requiresWrapperTemplate && matchingTemplate && (
                <div className="mb-4">
                    <WrapperTemplatePicker
                        templates={[matchingTemplate]}
                        selectedSku={matchingTemplate.sku}
                        readOnly
                    />
                </div>
            )}

            {modeConfig.hasPromptInput && (
                <div className="mb-4">
                    <PromptInput value={prompt} onChange={setPrompt} disabled={generateAI.isPending} />
                </div>
            )}

            {generateAI.isError && (
                <div className="alert alert-error text-sm mb-4">{generateAI.error.message}</div>
            )}

            <button
                onClick={() => generateAI.mutate({ mode: selectedMode, prompt: prompt.trim() })}
                disabled={!canGenerate || generateAI.isPending}
                className="btn-primary"
            >
                {generateAI.isPending ? 'Starting...' : 'Generate'}
            </button>
        </div>
    );
}

function PersonalizeWizard() {
    const { data: session } = useSession();
    if (!session) return null;

    // Once generation has started (or finished), the mode-selection wizard
    // is done — GenerationStatusPanel takes over for PROCESSING/DONE/FAILED.
    if (session.status === 'PROCESSING' || session.status === 'DONE' || session.status === 'FAILED') {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
                <GenerationStatusPanel />
            </div>
        );
    }

    if (session.status !== 'UPLOADED') {
        return null; // CREATED — nothing to configure until an image is uploaded
    }

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
            <ModeSelector />
        </div>
    );
}

function PersonalizeNowPageContent() {
    const navigate = useNavigate();
    const { data: session, isLoading, isError } = useSession();
    const { selectedMode } = usePersonalizationWizard();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" />
                    <p className="mt-4 text-gray-600">Loading session...</p>
                </div>
            </div>
        );
    }

    if (isError || !session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="text-center">
                    <div className="text-red-600 text-lg mb-4">❌ Failed to load session. Please use a valid link.</div>
                    <button onClick={() => navigate('/')} className="btn-primary">
                        Create New Session
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-purple-900 mb-2">Personalize Your Product</h1>
                    <p className="text-gray-600">
                        Product: <span className="font-semibold">{session.productSku}</span>
                        <br />
                        Status: <span className="font-semibold">{session.status}</span>
                    </p>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                    <ImageUploader />
                </div>

                <PersonalizeWizard />
                {selectedMode && session.status === 'UPLOADED' && <GenerationConfigurator />}
            </div>
        </div>
    );
}

function PersonalizeNowPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    useEffect(() => {
        if (token) {
            setAuthToken(token);
        }
    }, [token]);

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="text-center">
                    <div className="text-red-600 text-lg mb-4">❌ Invalid or missing token</div>
                    <button onClick={() => navigate('/')} className="btn-primary">
                        Create New Session
                    </button>
                </div>
            </div>
        );
    }

    return (
        <PersonalizationWizardProvider>
            <PersonalizeNowPageContent />
        </PersonalizationWizardProvider>
    );
}

export default PersonalizeNowPage;
