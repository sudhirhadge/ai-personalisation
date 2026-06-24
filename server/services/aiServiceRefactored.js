/**
 * AI Service
 * Handles AI image generation using Hugging Face Inference API
 * 
 * Architectural Decision:
 * - Service layer handles AI business logic
 * - Billed per-image via HF Inference Providers (pass-through provider pricing,
 *   not a flat free token tier — see hf.co/settings/inference-providers for usage)
 * - Prompt generation: product SKU + user input
 * - Returns generated image URL for storage
 */
const { HfInference, InferenceClient } = require('@huggingface/inference');
const storageService = require('./storageService');
const config = require('../config');
const fs = require('fs');
const path = require('path');

// Initialize Hugging Face (free API key)
const hf = new HfInference(config.huggingfaceApiKey);
const inference = new InferenceClient(config.huggingfaceApiKey);

class AIService {
    /**
     * Generate AI prompt from product SKU and user input
     * @param {string} productSku - Product identifier
     * @param {string} userPrompt - User's vision description
     * @returns {string} Enhanced prompt for AI
     */
    generatePrompt(productSku, userPrompt) {
        const basePrompt = `Create a personalized AI-generated image featuring ${productSku}. `;
        const userEnhancement = userPrompt ? `User vision: ${userPrompt}. ` : '';
        const styleGuidance = 'High quality, professional, vibrant colors, detailed rendering.';

        return `${basePrompt}${userEnhancement}${styleGuidance}`;
    }

    generateImageToImagePrompt(productSku, userPrompt) {
        const transformation = productSku
            ? `Transform the uploaded image into a ${productSku} style. `
            : '';

        const userEnhancement = userPrompt
            ? `${userPrompt}. `
            : '';

        const styleGuidance =
            'Preserve the original subject identity, facial features, pose, and composition. High quality, detailed rendering, vibrant colors.';

        return `${transformation}${userEnhancement}${styleGuidance}`;
    }

    /**
     * Shared error translation for HF inference calls.
     * Keeps "busy/timeout" detection in one place instead of duplicated per method.
     * @param {Error} error - Raw error from the HF call
     * @param {string} context - Label for logging (e.g. 'text-to-image', 'image-to-image')
     * @throws {Error} Normalized error
     */
    _handleInferenceError(error, context) {
        console.error(`AI ${context} generation error:`, error);

        if (error.message.includes('Queue') || error.message.includes('timeout')) {
            throw new Error('AI service is busy. Please try again later.');
        }

        throw new Error(error.message || 'AI image generation failed');
    }

    /**
     * Convert an HF inference result (Blob-like) into base64.
     * @param {Blob} imageBuffer - Result from hf.textToImage / inference.imageToImage
     * @returns {Promise<string>} base64-encoded image data
     */
    async _toBase64(imageBuffer) {
        const arrayBuffer = await imageBuffer.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer.toString('base64');
    }

    /**
     * Generate image using Hugging Face Stable Diffusion XL
     * @param {string} prompt - AI prompt
     * @returns {Promise<Object>} Generated image data
     */
    async generateImage(prompt) {
        try {
            console.log('🎨 Generating image with prompt:', prompt);

            const imageBuffer = await hf.textToImage({
                model: 'stabilityai/stable-diffusion-xl-base-1.0',
                inputs: prompt,
            });

            const base64Image = await this._toBase64(imageBuffer);

            return {
                success: true,
                imageData: base64Image,
                mimeType: 'image/png',
                prompt: prompt,
            };
        } catch (error) {
            this._handleInferenceError(error, 'text-to-image');
        }
    }

    /**
     * Generate image-to-image transformation using FLUX.1 Kontext
     * @param {string} prompt - AI prompt
     * @param {string} originalImageUrl - URL of the uploaded source image
     * @returns {Promise<Object>} Generated image data
     */
    async generateImageToImage(prompt, originalImageUrl) {
        console.log('Generating image-to-image with prompt:', prompt, 'and original image URL:', originalImageUrl);
        try {
            const imageResponse = await fetch(originalImageUrl);
            const imageBlob = await imageResponse.blob();

            const imageBuffer = await inference.imageToImage({
                inputs: imageBlob,
                model: "black-forest-labs/FLUX.1-Kontext-dev",
                parameters: {
                    prompt: prompt || "Enhance the image with high quality, professional, vibrant colors, detailed rendering. Cartoon style, realistic lighting, cinematic composition, ultra-detailed textures, 8k resolution.",
                },
            });

            const base64Image = await this._toBase64(imageBuffer);
            console.log('Generated image-to-image successfully', base64Image.length);

            return {
                success: true,
                imageData: base64Image,
                mimeType: 'image/png',
                prompt: prompt,
            };
        } catch (error) {
            this._handleInferenceError(error, 'image-to-image');
        }
    }

    /**
     * Shared workflow: generate -> upload -> shape response.
     * Both processGeneration and processImageToImageGeneration follow this
     * identical pattern, differing only in how the prompt and image are produced.
     * @param {string} sessionId - MongoDB session ID
     * @param {string} prompt - Already-built AI prompt
     * @param {Function} generateFn - Async fn returning the AI result (no args; caller binds them)
     * @returns {Promise<Object>} Job result
     */
    async _processAndUpload(sessionId, prompt, generateFn) {
        try {
            const aiResult = await generateFn();

            const mockFile = {
                path: null,
                filename: `generated-${sessionId}-${Date.now()}.png`,
                size: Math.floor(aiResult.imageData.length * 0.75),
                mimetype: aiResult.mimeType,
            };

            const uploadResult = await this.uploadGeneratedImage(mockFile, aiResult.imageData, sessionId);

            return {
                success: true,
                processedImageUrl: uploadResult.url,
                aiPrompt: prompt,
                aiResult: {
                    mimeType: aiResult.mimeType,
                    size: uploadResult.size,
                },
            };
        } catch (error) {
            console.error('AI process generation error:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Process AI generation job (text-to-image full workflow)
     * @param {string} sessionId - MongoDB session ID
     * @param {string} productSku - Product identifier
     * @param {string} userPrompt - User's vision description
     * @returns {Promise<Object>} Job result
     */
    async processGeneration(sessionId, productSku, userPrompt) {
        const prompt = this.generatePrompt(productSku, userPrompt);
        return this._processAndUpload(sessionId, prompt, () => this.generateImage(prompt));
    }

    /**
     * Process AI generation job (image-to-image full workflow)
     * @param {string} sessionId - MongoDB session ID
     * @param {string} productSku - Product identifier
     * @param {string} userPrompt - User's vision description
     * @param {string} originalImageUrl - URL of the uploaded source image
     * @returns {Promise<Object>} Job result
     */
    async processImageToImageGeneration(sessionId, productSku, userPrompt, originalImageUrl) {
        const prompt = this.generateImageToImagePrompt(productSku, userPrompt);
        return this._processAndUpload(sessionId, prompt, () => this.generateImageToImage(prompt, originalImageUrl));
    }

    /**
     * Upload generated image to storage
     * @param {Object} file - Mock file object
     * @param {string} base64Image - Base64 image data
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Upload result
     */
    async uploadGeneratedImage(file, base64Image, sessionId) {
        try {
            const fileName = file.filename;
            const uploadDir = path.join(process.cwd(), 'uploads', 'generated');

            fs.mkdirSync(uploadDir, { recursive: true });

            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, base64Image, 'base64');

            const stats = fs.statSync(filePath);

            const url = `${config.apiURL}/uploads/generated/${fileName}`;

            return {
                url,
                fileName,
                size: stats.size,
            };
        } catch (error) {
            console.error('Upload generated image error:', error);
            throw error;
        }
    }
}

module.exports = new AIService();