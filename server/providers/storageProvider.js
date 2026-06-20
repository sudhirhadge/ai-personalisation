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

module.exports = { StorageProvider };