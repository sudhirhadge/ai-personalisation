/**
 * Upload/delete endpoints (server/routes/storage.js).
 */
import { apiDelete, apiPost } from './httpClient';
import type { SessionStatus } from '../types/session';

export interface UploadImageResponse {
    sessionId: string;
    status: SessionStatus;
    originalImageUrl: string;
    originalImageName: string;
}

export const imageApi = {
    uploadImage(file: File): Promise<UploadImageResponse> {
        const formData = new FormData();
        // Field name must be exactly 'image' — multer on the backend is
        // configured with .single('image') (server/controllers/storageController.js).
        formData.append('image', file);

        return apiPost<UploadImageResponse>('/sessions/me/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },

    // Returns void: DELETE /sessions/me/image's success response has no data
    // payload (just { success: true }) — see httpClient.ts's interceptor for
    // how a { success: false } failure on this same endpoint still surfaces
    // as a thrown error despite the 200 status.
    deleteImage(): Promise<void> {
        return apiDelete<void>('/sessions/me/image');
    },
};
