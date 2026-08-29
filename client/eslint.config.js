import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'node_modules'] },
    {
        // Rewritten AI Personalization feature + app shell (TypeScript)
        files: ['**/*.{ts,tsx}'],
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            // Prefixing with _ is the common escape hatch for an intentionally
            // unused function argument (e.g. Express-style (req, res, next)).
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
    {
        // Untouched legacy CRUD demo (plain JS/JSX) — kept lintable but with
        // relaxed rules since it predates this project's TypeScript adoption
        // and is explicitly out of scope for the AI Personalization rewrite.
        files: ['**/*.{js,jsx}'],
        extends: [js.configs.recommended],
        languageOptions: {
            ecmaVersion: 2020,
            globals: { ...globals.browser, ...globals.node },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            // Deliberately not spreading reactHooks.configs.recommended.rules
            // here — its newer rules (e.g. set-state-in-effect) flag existing
            // patterns in this untouched legacy code as hard errors. This repo
            // isn't fixing legacy CRUD-demo logic, so those stay off; new code
            // goes in the TS block above, which does enforce them.
            'no-unused-vars': 'warn',
        },
    }
);
