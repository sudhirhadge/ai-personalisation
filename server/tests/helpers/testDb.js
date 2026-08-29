/**
 * Shared in-memory MongoDB helper for server tests.
 *
 * Uses mongodb-memory-server instead of the real Atlas cluster (see
 * server/.env's MONGODB_URL) so tests never touch production data, never
 * need real DB credentials in CI, and can run fully offline after the
 * mongod binary is cached. app.js itself never calls mongoose.connect()
 * (that's server.js's job, deliberately kept separate for exactly this
 * reason) — so tests own the full connection lifecycle via the functions
 * below.
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

async function connect() {
    // Default launchTimeout (10s) isn't enough on a cold start (binary
    // extraction + antivirus scan on first run can easily take longer) —
    // confirmed empirically that a bare create() intermittently times out
    // while 60s consistently succeeds.
    mongoServer = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
    await mongoose.connect(mongoServer.getUri());
}

async function closeDatabase() {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongoServer) {
        await mongoServer.stop();
    }
}

async function clearDatabase() {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
}

module.exports = { connect, closeDatabase, clearDatabase };
