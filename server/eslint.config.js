const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    { ignores: ['node_modules', 'uploads', 'coverage'] },
    {
        files: ['**/*.js'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: globals.node,
        },
        rules: {
            ...js.configs.recommended.rules,
            // Prefixing with _ is the common escape hatch for an intentionally
            // unused function argument (e.g. Express-style (err, req, res, next)).
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
    {
        // Test files and Jest manual mocks (__mocks__/) — adds Jest's global
        // functions (describe/it/expect/jest/beforeAll/etc.) on top of the
        // base Node ruleset above.
        files: ['tests/**/*.js', '**/__mocks__/**/*.js'],
        languageOptions: {
            globals: globals.jest,
        },
    },
];
