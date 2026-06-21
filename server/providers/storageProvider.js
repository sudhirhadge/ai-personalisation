
/**
 * Storage Provider (Abstract)
 * Base interface for storage implementations
 * 
 * Architectural Decision:
 * - Abstract base class defines interface contract
 * - Concrete implementations (LocalStorage, S3) extend this
 * - Business logic uses interface, not implementation
 * - Enables swapping storage without changing code
 */

// Defining the contract for storage providers. This abstract class outlines the methods that any concrete storage provider must implement, ensuring consistency across different storage backends (e.g., local filesystem, S3, etc.). By using this interface, the business logic can interact with storage providers without being tightly coupled to a specific implementation, allowing for easier swapping of storage solutions in the future.
/*
Without StorageProvider
class LocalStorageProvider {
upload(){}
}

class S3StorageProvider {
uploadFile(){}
}

class AzureStorageProvider {
save(){}
}

Chaos.

Every implementation has different method names.

With StorageProvider

Every provider must support:

upload()
delete()
getMetadata()

So business logic can do:

storageProvider.upload(file)

without caring whether it's:

Local
S3
Azure
Cloudinary
*/
class StorageProvider {
    /**
     * Upload file to storage
     * @param {Object} file - Multer file object
     * @param {string} userId - User/session identifier
     * @returns {Promise<Object>} { url, fileName, mimeType, size }
     */
    async upload(file, userId) {
        throw new Error('Method upload() must be implemented');
    }

    /**
     * Delete file from storage
     * @param {string} url - File URL
     * @returns {Promise<boolean>}
     */
    async delete(url) {
        throw new Error('Method delete() must be implemented');
    }

    /**
     * Get file metadata
     * @param {string} url - File URL
     * @returns {Promise<Object>} { size, mimeType, uploadedAt }
     */
    async getMetadata(url) {
        throw new Error('Method getMetadata() must be implemented');
    }
}

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
// const { StorageProvider } = require('./storageProvider');
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

module.exports = {
    LocalStorageProvider,
    StorageProvider
};