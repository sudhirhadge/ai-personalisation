module.exports = {
    testEnvironment: 'node',
    // mongodb-memory-server downloads a real mongod binary on first run
    // (cached afterward) — generous timeout so a cold cache doesn't flake.
    // Empirically, a cold instance launch alone can take close to 60s.
    testTimeout: 70000,
    collectCoverageFrom: [
        '**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!jest.config.js',
        '!eslint.config.js',
    ],
};
