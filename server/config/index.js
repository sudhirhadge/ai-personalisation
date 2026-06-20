/**
 * Configuration Module
 * Centralizes all environment variables with validation
 * Uses dotenv for loading .env files in development
 */
require('dotenv').config();

const config = {
    // Server config
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',

    // Database config
    mongodb: {
        uri: process.env.MONGODB_URL || 'mongodb://localhost:27017/ai-personalization',
    },

    // JWT config
    jwt: {
        secret: process.env.JWT_SECRET || 'default-dev-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },

    // Email config
    email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT, 10) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        from: process.env.EMAIL_FROM || 'noreply@ai-personalization.com',
    },

    // Frontend URL for email links
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    apiURL: process.env.API_URL || 'http://localhost:5000',
};

// Validate required environment variables in production
if (config.nodeEnv === 'production') {
    const required = ['MONGODB_URI', 'JWT_SECRET', 'EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

module.exports = config;