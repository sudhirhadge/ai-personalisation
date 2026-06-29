/**
 * API Service
 * Handles all HTTP requests to the backend
 * 
 * Architectural Decision:
 * - Centralized API client for easy maintenance
 * - Axios with default configuration
 * - JWT token attached automatically for protected routes
 * - Standardized error handling
 * - Separate exported objects for different features
 */
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Create axios instance with defaults
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000, // 10 seconds
});

// Request interceptor - add JWT token if available
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('jwtToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response.data, // Return just the data portion
    (error) => {
        const message = error.response?.data?.error || 'An unexpected error occurred';
        return Promise.reject(new Error(message));
    }
);

/**
 * Session API methods
 */
export const sessionApi = {
    /**
     * Create a new personalization session
     * POST /sessions
     */
    createSession: async (email, productSku) => {
        const response = await api.post('/sessions', { email, productSku });
        return response;
    },

    /**
     * Get current session
     * GET /sessions/me
     */
    getCurrentSession: async () => {
        const response = await api.get('/sessions/me');
        return response;
    },

    /**
     * Get session by token (for personalize-now page)
     * GET /sessions/me
     */
    getSessionByToken: async () => {
        const response = await api.get('/sessions/me');
        return response;
    },


};

/**
 * Upload API methods
 */
export const imageApi = {
    /**
     * Upload image for personalization session
     * POST /sessions/me/upload
     * JWT token automatically attached by interceptor
     * @param {File} image - Image file
     * @returns {Promise<Object>}
     */
    uploadImage: async (image) => {
        const formData = new FormData();
        formData.append('image', image);

        const response = await api.post('/sessions/me/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response;
    },

    /**
     * Delete uploaded image
     * DELETE /sessions/me/image
     * JWT token automatically attached by interceptor
     * @returns {Promise<Object>}
     */
    deleteImage: async () => {
        const response = await api.delete('/sessions/me/image');
        return response;
    },
};

/**
 * AI API methods (Phase 3)
 */
export const aiApi = {
    /**
     * Generate AI image
     * POST /api/v1/sessions/me/generate-image-from-image
     * JWT token automatically attached by interceptor
     * @param {string} prompt - User's vision description
     * @returns {Promise<Object>}
     */
    generateImage: async (prompt) => {
        const response = await api.post('/sessions/me/generate-image-from-image', { prompt });
        return response;
    },

    /**
     * Get AI job status
     * GET /api/v1/sessions/me/status/:aiJobId
     * JWT token automatically attached by interceptor
     * @param {string} aiJobId - AI job ID
     * @returns {Promise<Object>}
     */
    getStatus: async (aiJobId) => {
        const response = await api.get(`/sessions/me/status/${aiJobId}`);
        return response;
    },
};

export default api;