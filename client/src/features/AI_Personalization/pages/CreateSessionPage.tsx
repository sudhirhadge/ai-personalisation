/**
 * Rewrite of CreateSession.jsx. Session creation now goes through
 * useCreateSession (TanStack Query mutation) instead of a hand-rolled
 * isLoading/error/sessionData useState trio calling sessionApi directly.
 */
import CreateSessionForm from '../components/CreateSessionForm';
import SuccessScreenPage from './SuccessScreenPage';
import { useCreateSession } from '../hooks/useCreateSession';

function CreateSessionPage() {
    const createSession = useCreateSession();

    if (createSession.isSuccess) {
        return <SuccessScreenPage sessionData={createSession.data} />;
    }

    return (
        <div className="min-h-screen gradient-bg py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold gradient-text">
                        🎨 AI Personalization
                    </h1>
                    <p className="mt-4 text-xl text-white/90">
                        Create your personalized product experience
                    </p>
                </div>

                <div className="card">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-gray-900">Start Your Journey</h2>
                        <p className="mt-2 text-gray-600">Enter your details to create a personalized session</p>
                    </div>

                    <CreateSessionForm
                        onSubmit={(email, productSku) => createSession.mutate({ email, productSku })}
                        isLoading={createSession.isPending}
                        error={createSession.error?.message ?? null}
                    />
                </div>

                <p className="text-center text-white/80 text-sm mt-8">Powered by AI Personalization Service</p>
            </div>
        </div>
    );
}

export default CreateSessionPage;
