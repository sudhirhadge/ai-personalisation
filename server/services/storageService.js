/**
 * Storage Service
 * Business logic for file uploads
 * 
 * Architectural Decision:
 * - Service layer handles business logic
 * - Uses StorageProvider for actual storage
 * - Validates file before upload
 * - Updates session status after upload
 */
const { getStorageProvider } = require('../providers');
const sessionRepository = require('../repositories/sessionRepository');
const tokenService = require('../services/tokenService');

class StorageService {
    /**
     * Upload image for personalization session
     * @param {Object} file - Multer file object
     * @param {string} sessionId - Session MongoDB ID
     * @returns {Promise<Object>} Upload result
     */
    async uploadImage(file, sessionId) {
        try {
            // Get storage provider
            const storageProvider = getStorageProvider();

            if (!storageProvider) {
                throw new Error('Storage provider not configured');
            }

            // Upload file
            const uploadResult = await storageProvider.upload(file, sessionId);
            console.log('File uploaded to storage:', uploadResult, sessionId);
            // Update session in MongoDB
            const session = await sessionRepository.updateStatusById(
                sessionId, // Using sessionId (MongoDB _id)
                'UPLOADED',
                {
                    originalImageUrl: uploadResult.url,
                    originalImageName: uploadResult.fileName,
                    originalImageMimeType: uploadResult.mimeType,
                    originalImageSize: uploadResult.size,
                    originalImageUploadedAt: uploadResult.uploadedAt
                }
            );
            console.log('Session updated with image info:', session);

            // Generate JWT for frontend (in case token changed)
            const jwtToken = tokenService.generateDeepLinkToken(session._id.toString());

            return {
                success: true,
                data: {
                    sessionId: session._id.toString(),
                    status: session.status,
                    originalImageUrl: uploadResult.url,
                    originalImageName: uploadResult.fileName,
                    jwtToken
                }
            };
        } catch (error) {
            console.error('Upload image error:', error);
            throw error;
        }
    }

    /**
     * Delete uploaded image
     * @param {string} sessionId - Session MongoDB ID
     * @returns {Promise<boolean>}
     */
    async deleteImage(sessionId) {
        try {
            // Get session
            const session = await sessionRepository.findById(sessionId);

            if (!session || !session.originalImageUrl) {
                return { success: false, error: 'No image to delete' };
            }

            // Get storage provider
            const storageProvider = getStorageProvider();

            // Delete from storage
            await storageProvider.delete(session.originalImageUrl);

            // Update session
            await sessionRepository.updateStatusById(
                sessionId,
                'CREATED',
                {
                    originalImageUrl: null,
                    originalImageName: null,
                    originalImageMimeType: null,
                    originalImageSize: null,
                    originalImageUploadedAt: null
                }
            );

            return { success: true };
        } catch (error) {
            console.error('Delete image error:', error);
            throw error;
        }
    }
}

module.exports = new StorageService();