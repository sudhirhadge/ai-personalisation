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
import { imageApi, sessionApi } from '../services/api';

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

    // Handle image selection
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
            setUploadError(`File too large. Maximum size is 10MB.`);
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
                });

                // Clear preview
                setImagePreview(null);
                setSelectedImage(null);
            }
        } catch (err) {
            setUploadError('Delete failed. Please try again.');
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen gradient-bg py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-xl mx-auto">
                    <div className="card text-center">
                        <div className="flex justify-center mb-6">
                            <svg className="animate-spin h-10 w-10 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                        <p className="text-gray-600 text-lg">Loading session...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen gradient-bg py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-xl mx-auto">
                    <div className="card">
                        <div className="alert alert-error mb-6">
                            <div className="flex items-center gap-3">
                                <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        </div>
                        <button
                            className="btn-primary w-full"
                            onClick={() => navigate('/')}
                        >
                            Create New Session
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen gradient-bg py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-xl mx-auto">
                <div className="card">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <h1 className="text-3xl font-extrabold gradient-text">
                            🎨 Personalize Your Product
                        </h1>
                        <p className="mt-3 text-gray-600">
                            Session for: <span className="font-semibold text-gray-900">{session.productSku}</span>
                        </p>
                    </div>

                    {/* Status */}
                    <div className="mb-6">
                        <p className="text-gray-700">
                            Current status:{' '}
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-primary-100 text-primary-800">
                                {session.status}
                            </span>
                        </p>
                    </div>

                    {/* Upload Section */}
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Upload Your Image
                        </h2>

                        {/* Image Preview */}
                        {imagePreview && (
                            <div className="mb-4">
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    className="w-full h-auto rounded-lg shadow-md max-h-64"
                                />
                            </div>
                        )}

                        {/* Upload Error */}
                        {uploadError && (
                            <div className="alert alert-error mb-4">
                                <span>{uploadError}</span>
                            </div>
                        )}

                        {/* File Input */}
                        <div className="mb-4">
                            <label className="block w-full">
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleImageSelect}
                                    className="block w-full text-sm text-gray-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-primary-600 file:text-white
                                        hover:file:bg-primary-700
                                    "
                                />
                            </label>
                            <p className="mt-2 text-sm text-gray-500">
                                Accepted: JPG, PNG, WEBK (max 10MB)
                            </p>
                        </div>

                        {/* Upload/Delete Buttons */}
                        {session.originalImageUrl ? (
                            <button
                                className="btn-secondary w-full mb-2"
                                onClick={handleDelete}
                                disabled={isUploading}
                            >
                                Delete Uploaded Image
                            </button>
                        ) : (
                            <button
                                className="btn-primary w-full"
                                onClick={handleUpload}
                                disabled={!selectedImage || isUploading}
                            >
                                {isUploading ? 'Uploading...' : 'Upload Image'}
                            </button>
                        )}
                    </div>

                    {/* Back Button */}
                    <button
                        className="btn-secondary w-full"
                        onClick={() => navigate('/')}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Home
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PersonalizeNow;