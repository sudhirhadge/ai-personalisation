/**
 * Express Application Setup
 * Configures middleware, routes, and error handling
 * 
 * Architectural Decision:
 * - Separate app.js from server.js for testing flexibility
 * - Middleware applied in logical order
 * - Centralized error handling
 * - CORS configured for frontend integration
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const sessionsRouter = require('./routes/sessions'); // phase 1: session routes
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger/swagger");
const storageRouter = require('./routes/storage');  // phase 2: storage routes
const path = require('path'); // For serving static files (uploads)
const aiRouter = require('./routes/ai');
const { aiQueue } = require('./queues/aiQueue'); // Ensure the AI queue is initialized

// Add this route registration:

const app = express();

// Security middleware
// app.use(helmet());
app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin",
        },
    })
);

// CORS configuration
app.use(cors({
    origin: config.nodeEnv === 'production'
        ? false // Will be set via environment in production
        : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Phase 1: Session routes for creating and managing personalization sessions
app.use('/api/v1/sessions', sessionsRouter);
// Phase 2: Storage routes for image upload/delete
app.use('/api/v1/sessions/me', storageRouter);

// for testing the queue, we can add a simple endpoint to enqueue a test job. This is not meant for production use, but can be helpful during development to verify that the queue is working correctly.
app.get('/health/queue', async (req, res) => {
    try {
        await aiQueue.add('test-job', { ping: true });
        return res.json({ success: true, message: 'Queue test job added' });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});
app.use('/api/v1/sessions/me', aiRouter);

// Serve uploaded files statically (for frontend access)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'AI Personalization API is running',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
    });
});

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'AI Personalization Microsite API',
        version: '1.0.0',
        docs: '/api/v1/sessions',
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);

    res.status(err.status || 500).json({
        success: false,
        error: config.nodeEnv === 'production'
            ? 'Internal server error'
            : err.message,
    });
});

module.exports = app;