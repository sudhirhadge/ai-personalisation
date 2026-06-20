/**
 * Local Storage Provider
 * Multer + File System implementation for development
 * 
 * Architectural Decision:
 * - Uses Multer for file parsing
 * - Stores files in local/uploads/originals
 * - Returns file URL for frontend display
 * - Phase 5 will replace with S3StorageProvider
 */
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { StorageProvider } = require('./storageProvider');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

class LocalStorageProvider extends StorageProvider {
    constructor() {
        super();

        // Multer configuration
        this.uploadMiddleware = multer({
            storage: multer.diskStorage({
                destination: (req, res, cb) => {
                    const uploadDir = path.join(process.cwd(), 'uploads', 'originals');
                    cb(null, uploadDir);
                },
                filename: (req, file, cb) => {
                    // Generate unique filename: uuid-originalname
                    const uniqueName = `${uuidv4()}-${file.originalname}`;
                    cb(null, uniqueName);
                }
            }),
            limits: {
                fileSize: 10 * 1024 * 1024 // 10MB max
            },
            fileFilter: (req, file, cb) => {
                // Validate file type: JPG, PNG, WEBP only
                const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('Invalid file type. Only JPG, PNG, and WEBP are allowed.'));
                }
            }
        });

        // Upload directory
        this.uploadDir = path.join(process.cwd(), 'uploads', 'originals');
        // ✅ Auto-create upload directory
        fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    /**
     * Upload file to local storage
     * @param {Object} file - Multer file object
     * @param {string} sessionId - Session identifier
     * @returns {Promise<Object>} File metadata
     */
    async upload(file, sessionId) {
        try {
            // Ensure upload directory exists
            await fs.mkdirSync(this.uploadDir, { recursive: true });

            const filePath = file.path;
            const fileName = file.filename;
            const fileSize = file.size;
            const mimeType = file.mimetype;

            // Generate public URL
            const url = `${config.apiURL}/uploads/originals/${fileName}`;

            return {
                url,
                fileName,
                mimeType,
                size: fileSize,
                uploadedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Local storage upload error:', error);
            throw error;
        }
    }

    /**
     * Delete file from local storage
     * @param {string} url - File URL
     * @returns {Promise<boolean>}
     */
    async delete(url) {
        try {
            const fileName = url.split('/').pop();
            const filePath = path.join(this.uploadDir, fileName);

            await fs.unlinkSync(filePath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn('File not found:', url);
                return false;
            }
            console.error('Local storage delete error:', error);
            throw error;
        }
    }

    /**
     * Get file metadata
     * @param {string} url - File URL
     * @returns {Promise<Object>}
     */
    async getMetadata(url) {
        try {
            const fileName = url.split('/').pop();
            const filePath = path.join(this.uploadDir, fileName);

            const stats = await fs.stat(filePath);

            return {
                size: stats.size,
                mimeType: stats.mtime,
                uploadedAt: stats.birthtime.toISOString()
            };
        } catch (error) {
            console.error('Get metadata error:', error);
            throw error;
        }
    }
}

module.exports = { LocalStorageProvider };