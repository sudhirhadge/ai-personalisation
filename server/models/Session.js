/**
 * Session Model
 * Stores personalization session data with TTL expiry
 * 
 * Architectural Decision:
 * - Using Mongoose schema with explicit types for data validation
 * - TTL index on createdAt ensures automatic cleanup after 7 days
 * - Status enum prevents invalid state transitions
 * - Index on email for fast lookups in GET /sessions/me
 */
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true, // Fast lookup for GET /sessions/me
    },
    productSku: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['CREATED', 'UPLOADED', 'PROCESSING', 'DONE', 'FAILED'],
        default: 'CREATED',
    },
    jwtToken: {
        type: String,
        required: true,
        unique: true,
        index: true, // Unique index for JWT token lookup
    },
    // Phase 2: Image upload fields
    originalImageUrl: {
        type: String,
        default: null,
    },
    originalImageName: {
        type: String,
        default: null,
    },
    originalImageMimeType: {
        type: String,
        default: null,
    },
    originalImageSize: {
        type: Number,
        default: null,
    },
    originalImageUploadedAt: {
        type: String,
        default: null,
    },
    // Phase 3: AI processing fields
    aiJobId: {
        type: String,
        default: null,
    },
    processedImageUrl: {
        type: String,
        default: null,
    },
    aiPrompt: {
        type: String,
        default: null,
    },
    aiResult: {
        type: Object,
        default: null,
    },
    aiProcessedAt: {
        type: String,
        default: null,
    },
    aiError: {
        type: String,
        default: null,
    },
    aiJobType: {
        type: String,
        default: null
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
});

// TTL index: automatically delete documents 7 days after creation
// 7 days = 7 * 24 * 60 * 60 = 604800 seconds
sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

// Virtual for personalization link
sessionSchema.virtual('personalizationLink').get(function () {
    return `${process.env.FRONTEND_URL || 'http://localhost:5173'}/personalize-now?token=${this.jwtToken}`;
});

// Index for aiJobId lookups
sessionSchema.index({ aiJobId: 1 });

// Ensure virtuals are included in JSON responses
sessionSchema.set('toJSON', { virtuals: true });
sessionSchema.set('toObject', { virtuals: true });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;