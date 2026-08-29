/**
 * Vite Configuration
 * Sets up React plugin and development server
 *
 * Architectural Decision:
 * - Uses Vite for fast HMR and optimized builds
 * - Development proxy forwards API requests to backend
 * - Environment variables prefixed with VITE_ are exposed to client
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Proxy API requests to backend
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
