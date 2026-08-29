/**
 * Upload/delete for the session's source photo. Mode-independent (every
 * generation mode requires status === 'UPLOADED' first), so this component
 * has no awareness of which mode will run afterward — it only cares about
 * getting the session from CREATED to UPLOADED.
 */
import { useRef, useState } from 'react';
import { useSession } from '../hooks/useSession';
import { useUploadImage } from '../hooks/useUploadImage';
import { useDeleteImage } from '../hooks/useDeleteImage';
import { isAllowedImageType, isWithinSizeLimit } from '../utils/validation';

function ImageUploader() {
    const { data: session } = useSession();
    const uploadImage = useUploadImage();
    const deleteImage = useDeleteImage();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    if (!session) {
        return null;
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setValidationError(null);

        // Fast client-side fail before hitting the network — the backend
        // (storageController.js multer config) is still the source of truth.
        if (!isAllowedImageType(file)) {
            setValidationError('Only JPEG, PNG, or WEBP images are allowed.');
            return;
        }
        if (!isWithinSizeLimit(file)) {
            setValidationError('Image must be 10MB or smaller.');
            return;
        }

        setLocalPreviewUrl(URL.createObjectURL(file));
        uploadImage.mutate(file, {
            onError: () => setLocalPreviewUrl(null),
        });
    };

    const handleDelete = () => {
        deleteImage.mutate();
        setLocalPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const displayImageUrl = session.originalImageUrl || localPreviewUrl;
    // Deleting mid-PROCESSING would orphan a running job's expectations —
    // only allow it before generation has actually started.
    const canDelete = Boolean(session.originalImageUrl) && session.status === 'UPLOADED';

    return (
        <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Photo</h3>

            {validationError && (
                <div className="alert alert-error text-sm">{validationError}</div>
            )}
            {uploadImage.isError && (
                <div className="alert alert-error text-sm">{uploadImage.error.message}</div>
            )}

            {displayImageUrl ? (
                <div className="flex items-center gap-4">
                    <img
                        src={displayImageUrl}
                        alt="Uploaded"
                        className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                    />
                    {canDelete && (
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleDelete}
                            disabled={deleteImage.isPending}
                        >
                            {deleteImage.isPending ? 'Removing...' : 'Remove photo'}
                        </button>
                    )}
                </div>
            ) : (
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        disabled={uploadImage.isPending}
                        className="block w-full text-sm text-gray-600"
                    />
                    {uploadImage.isPending && (
                        <p className="mt-2 text-sm text-gray-500">Uploading...</p>
                    )}
                </div>
            )}
        </div>
    );
}

export default ImageUploader;
