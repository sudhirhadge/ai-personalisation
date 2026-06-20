/**
 * Providers Index
 * Factory for creating provider instances
 * 
 * Architectural Decision:
 * - Centralized provider creation makes it easy to swap implementations
 * - Production environment uses different providers than development
 */
const config = require('../config');
const { NodemailerEmailProvider } = require('./emailProvider');
const { LocalStorageProvider } = require('./localStorageProvider');

// Future providers (to be implemented in later phases)
// class S3StorageProvider { }
// class ResendEmailProvider { }
// class OpenAIProvider { }

// Future providers (to be implemented in later phases)
// class S3StorageProvider { }
// class ResendEmailProvider { }
// class OpenAIProvider { }

/**
 * Email Provider Factory
 * Returns appropriate email provider based on environment
 */
function getEmailProvider() {
    // In Phase 1, always use Nodemailer for development
    // Later phases will use Resend/SendGrid in production
    return new NodemailerEmailProvider();
}

/**
 * Storage Provider Factory (placeholder for Phase 2)
 */
function getStorageProvider() {
    // ✅ Phase 2: Use LocalStorageProvider for development
    // Later phases will use S3StorageProvider in production
    return new LocalStorageProvider();
}

/**
 * AI Provider Factory (placeholder for Phase 3)
 */
function getAIProvider() {
    // Will be implemented in Phase 3
    return null;
}

module.exports = {
    getEmailProvider,
    getStorageProvider,
    getAIProvider,
};