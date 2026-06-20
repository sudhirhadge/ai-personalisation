/**
 * Storage Controller
 * Handles HTTP requests for file uploads
 * 
 * Architectural Decision:
 * - Controller handles only HTTP concerns
 * - Uses StorageService for business logic
 * - Validates file in middleware
 */
const storageService = require('../services/storageService');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Multer middleware for single file upload
const uploadMiddleware = multer({
    storage: multer.diskStorage({
        destination: (req, res, cb) => {
            const uploadDir = path.join(process.cwd(), 'uploads', 'originals');
            cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
            const uniqueName = `${uuidv4()}-${file.originalname}`;
            cb(null, uniqueName);
        }
    }),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'));
        }
    }
}).single('image');

/**
 * POST /api/v1/sessions/me/upload
 * Upload image for personalization session
 * Protected endpoint (requires JWT)
 * 
 * Request:
 * - Headers: Authorization: Bearer <jwt_token>
 * - Body: multipart/form-data with image field
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     sessionId: string,
 *     status: string,
 *     originalImageUrl: string,
 *     originalImageName: string,
 *     jwtToken: string
 *   }
 * }
 */
async function uploadImage(req, res, next) {
    try {
        // Parse Multer file (must be called before accessing req.file)
        uploadMiddleware(req, res, async (error) => {
            if (error) {
                if (error.message === 'Invalid file type. Only JPG, PNG, and WEBP are allowed.') {
                    return res.status(400).json({
                        success: false,
                        error: error.message
                    });
                }
                if (error.message.startsWith('Too large')) {
                    return res.status(400).json({
                        success: false,
                        error: 'File too large. Maximum size is 10MB'
                    });
                }
                return res.status(400).json({
                    success: false,
                    error: error.message || 'File upload failed'
                });
            }

            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No image provided. Please upload an image file.'
                });
            }

            // Get sessionId from JWT (set by auth middleware)
            const { sessionId } = req.user;

            // Upload image
            const result = await storageService.uploadImage(req.file, sessionId);

            res.json({
                success: true,
                data: result.data
            });
        });
    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload image'
        });
    }
}

/**
 * DELETE /api/v1/sessions/me/image
 * Delete uploaded image
 * Protected endpoint (requires JWT)
 * 
 * Response:
 * {
 *   success: true
 * }
 */
async function deleteImage(req, res, next) {
    try {
        const { sessionId } = req.user;

        const result = await storageService.deleteImage(sessionId);

        res.json(result);
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete image'
        });
    }
}

module.exports = {
    uploadImage,
    deleteImage
};