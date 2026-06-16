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
const sessionsRouter = require('./routes/sessions');
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger/swagger");

const app = express();

// Security middleware
app.use(helmet());

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

// API Routes
app.use('/api/v1/sessions', sessionsRouter);

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