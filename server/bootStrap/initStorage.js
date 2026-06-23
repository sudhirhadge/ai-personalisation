// bootstrap/initStorage.js
const fs = require('fs');
const path = require('path');

/**
 * Storage Bootstrap
 * Initializes upload directories at application startup
 * 
 * Architectural Decision:
 * - Directory creation is application concern, not storage operation
 * - Runs before server starts
 * - Creates both originals and generated folders
 */

function initStorage() {
    const uploadDir = path.join(process.cwd(), 'uploads', 'originals');
    fs.mkdirSync(uploadDir, { recursive: true });
    const generatedDir = path.join(process.cwd(), 'uploads', 'generated');
    fs.mkdirSync(generatedDir, { recursive: true });
    console.log(`📁 Upload directories initialized:`);
    console.log(`   Originals: ${uploadDir}`);
    console.log(`   Generated: ${generatedDir}`);
}

module.exports = initStorage;