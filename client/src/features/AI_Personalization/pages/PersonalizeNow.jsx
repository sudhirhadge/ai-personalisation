/**
 * Personalize Now Page
 * Phase 2: Image upload UI
 * 
 * Architectural Decision:
 * - Extracts token from URL query parameters
 * - Validates session before showing upload UI
 * - Image preview before upload
 * - Success state shows uploaded image
 * - Tailwind classes for styling
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { aiApi, imageApi, sessionApi } from '../services/api';

function PersonalizeNow() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [session, setSession] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Upload state
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    // AI generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [isPolling, setIsPolling] = useState(false);
    useEffect(() => {
        if (!token) {
            setError('Invalid or missing token');
            setIsLoading(false);
            return;
        }

        localStorage.setItem('jwtToken', token);

        const loadSession = async () => {
            try {
                const response = await sessionApi.getSessionByToken();
                if (response.success) {
                    setSession(response.data);
                }
            } catch (err) {
                setError('Failed to load session. Please use a valid link.');
            } finally {
                setIsLoading(false);
            }
        };

        loadSession();
    }, [token]);

    // Polling for AI job status
    useEffect(() => {
        if (session?.status === 'PROCESSING' && session?.aiJobId) {
            setIsPolling(true);
            const pollInterval = setInterval(() => {
                pollAIStatus(session.aiJobId);
            }, 3000); // Poll every 3 seconds

            return () => {
                clearInterval(pollInterval);
                setIsPolling(false);
            };
        }
    }, [session?.status, session?.aiJobId]);

    const pollAIStatus = async (aiJobId) => {
        try {
            const response = await aiApi.getStatus(aiJobId);

            if (response.success) {
                setSession({
                    ...session,
                    status: response.data.status,
                    processedImageUrl: response.data.processedImageUrl,
                    aiError: response.data.aiError,
                });

                if (response.data.status === 'DONE') {
                    setIsPolling(false);
                    setGenerateError(null);
                } else if (response.data.status === 'FAILED') {
                    setIsPolling(false);
                    setGenerateError(response.data.aiError || 'AI generation failed');
                }
            }
        } catch (err) {
            console.error('Poll AI status error:', err);
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files[0];

        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setUploadError('Invalid file type. Only JPG, PNG, and WEBP are allowed.');
            return;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            setUploadError('File too large. Maximum size is 10MB.');
            return;
        }

        setSelectedImage(file);
        setUploadError(null);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    };

    // Handle upload
    const handleUpload = async () => {
        if (!selectedImage) {
            setUploadError('Please select an image first.');
            return;
        }

        setIsUploading(true);
        setUploadError(null);

        try {
            const response = await imageApi.uploadImage(selectedImage);

            if (response.success) {
                // Update session with new data
                setSession({
                    ...session,
                    status: response.data.status,
                    originalImageUrl: response.data.originalImageUrl,
                    originalImageName: response.data.originalImageName,
                });

                // Clear selection
                setSelectedImage(null);
                setImagePreview(null);
            }
        } catch (err) {
            setUploadError(err.message || 'Upload failed. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!session.originalImageUrl) return;

        try {
            const response = await imageApi.deleteImage();

            if (response.success) {
                // Update session
                setSession({
                    ...session,
                    status: 'CREATED',
                    originalImageUrl: null,
                    originalImageName: null,
                    originalImageMimeType: null,
                    originalImageSize: null,
                    originalImageUploadedAt: null,
                    processedImageUrl: null,
                    aiError: null,
                });

                // Clear preview
                setSelectedImage(null);
                setImagePreview(null);
            }
        } catch (err) {
            setUploadError(err.message || 'Delete failed. Please try again.');
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setGenerateError('Please describe your vision for the AI.');
            return;
        }

        setIsGenerating(true);
        setGenerateError(null);

        try {
            const response = await aiApi.generateImage(prompt.trim());

            if (response.success) {
                setSession({
                    ...session,
                    status: 'PROCESSING',
                    aiJobId: response.data.aiJobId,
                });

                // Polling will start automatically via useEffect
            }
        } catch (err) {
            setGenerateError(err.message || 'AI generation failed. Please try again.');
            setIsGenerating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading session...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="text-center">
                    <div className="text-red-600 text-lg mb-4">❌ {error}</div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                        Create New Session
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-purple-900 mb-2">
                        Personalize Your Product
                    </h1>
                    <p className="text-gray-600">
                        Product: <span className="font-semibold">{session.productSku}</span>
                        <br />
                        Status: <span className="font-semibold">{session.status}</span>
                    </p>
                </div>

                {/* Upload Section */}
                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <h2 className="text-2xl font-semibold text-purple-900 mb-4">
                        Step 1: Upload Your Image
                    </h2>

                    {!session.originalImageUrl && (
                        <div className="space-y-4">
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleImageSelect}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                            />

                            {uploadError && (
                                <div className="text-red-600 text-sm">{uploadError}</div>
                            )}


                        </div>
                    )}
                    {/* Uploaded Image Preview */}
                    {(imagePreview || session.originalImageUrl) && (
                        <div className="space-y-4">
                            <img
                                src={imagePreview || session.originalImageUrl}
                                alt="Uploaded"
                                className="w-full max-w-md rounded-lg shadow-md"
                            />
                            <div className="flex space-x-16">
                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading || !selectedImage}
                                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isUploading ? 'Uploading...' : 'Upload Image'}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!session.originalImageUrl}
                                >
                                    Delete Uploaded Image
                                </button>
                            </div>
                        </div>
                    )}

                </div>

                {/* AI Generation Section (Only if image uploaded) */}
                {session.status === 'UPLOADED' && (
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-2xl font-semibold text-purple-900 mb-4">
                            Step 2: AI Personalization
                        </h2>

                        <div className="space-y-4">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe your vision for the AI... (e.g., 'Make it magical with glowing effects and vibrant colors')"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none h-32 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                disabled={isGenerating || isPolling}
                            />

                            {generateError && (
                                <div className="text-red-600 text-sm">{generateError}</div>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || isPolling || !prompt.trim()}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating ? 'Generating...' : 'Generate AI Image'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Processing State */}
                {session.status === 'PROCESSING' && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto mb-4"></div>
                            <h3 className="text-2xl font-semibold text-purple-900 mb-2">
                                AI is Generating Your Image...
                            </h3>
                            <p className="text-gray-600">
                                This takes about 30-60 seconds. Please wait...
                            </p>
                            {isPolling && (
                                <p className="text-sm text-purple-600 mt-2">
                                    Polling for status...
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Success State (DONE) */}
                {session.status === 'DONE' && session.processedImageUrl && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
                        <div className="text-center">
                            <div className="text-green-600 text-5xl mb-4">✅</div>
                            <h3 className="text-2xl font-semibold text-purple-900 mb-4">
                                Your AI Image is Ready!
                            </h3>

                            <img
                                src={session.processedImageUrl}
                                alt="AI Generated"
                                className="w-full max-w-md rounded-lg shadow-xl mx-auto mb-4"
                            />

                            <p className="text-gray-600">
                                AI Prompt: <span className="font-semibold">{session.aiPrompt}</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Failed State */}
                {session.status === 'FAILED' && (
                    <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
                        <div className="text-center">
                            <div className="text-red-600 text-5xl mb-4">❌</div>
                            <h3 className="text-2xl font-semibold text-red-900 mb-2">
                                AI Generation Failed
                            </h3>
                            <p className="text-gray-600 mb-4">
                                {session.aiError || 'Something went wrong. Please try again.'}
                            </p>
                            <button
                                onClick={() => {
                                    setGenerateError(null);
                                    setPrompt('');
                                    setSession({ ...session, status: 'UPLOADED', aiJobId: null });
                                }}
                                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                            >
                                Try Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PersonalizeNow;