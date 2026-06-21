/**
 * Server Entry Point
 * Starts the Express server and connects to MongoDB
 * 
 * Architectural Decision:
 * - Separate from app.js for testing flexibility
 * - Graceful shutdown handling
 * - Database connection error handling
 * - Environment-specific configurations
 */
const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config');
const initStorage = require('./bootstrap/initStorage');



// Connect to MongoDB
async function connectDatabase() {
    try {
        await mongoose.connect(config.mongodb.uri);
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        process.exit(1);
    }
}

// Start server
async function startServer() {
    initStorage();
    await connectDatabase();

    const server = app.listen(config.port, () => {
        console.log(`🚀 Server running on http://localhost:${config.port}`);
        console.log(`📊 Environment: ${config.nodeEnv}`);
        console.log(`📡 API Health: http://localhost:${config.port}/health`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully');
        server.close(() => {
            console.log('Server closed');
            mongoose.connection.close(() => {
                console.log('Database connection closed');
                process.exit(0);
            });
        });
    });

    process.on('SIGINT', () => {
        console.log('SIGINT received, shutting down gracefully');
        server.close(() => {
            console.log('Server closed');
            mongoose.connection.close(() => {
                console.log('Database connection closed');
                process.exit(0);
            });
        });
    });
}

startServer();