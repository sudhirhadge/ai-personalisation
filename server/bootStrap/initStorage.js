// bootstrap/initStorage.js
const fs = require('fs');
const path = require('path');

function initStorage() {
    const uploadDir = path.join(process.cwd(), 'uploads', 'originals');
    fs.mkdirSync(uploadDir, { recursive: true });
}

module.exports = initStorage;