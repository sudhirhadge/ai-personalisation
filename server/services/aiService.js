/**
 * AI Service
 * Handles AI image generation using Hugging Face Inference API
 * 
 * Architectural Decision:
 * - Service layer handles AI business logic
 * - Uses Hugging Face free tier (30k tokens/month)
 * - Prompt generation: product SKU + user input
 * - Returns generated image URL for storage
 */
const { HfInference, InferenceClient } = require('@huggingface/inference');
const storageService = require('./storageService');
const config = require('../config');
const fs = require('fs');
const path = require('path');

const imageCompositeService = require('./imageCompositeService');


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
        // Handle specific Hugging Face errors
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

            const BYPASS_AI = true //  for development purpose
            if (BYPASS_AI) {
                return {
                    success: true,
                    imageData: await this._toBase64(imageBlob),
                    mimeType: imageBlob.type,
                    prompt,
                };
            }

            const imageBuffer = await inference.imageToImage({
                // data: imageBlob,
                // model: "timbrooks/instruct-pix2pix",
                inputs: imageBlob,
                model: "black-forest-labs/FLUX.1-Kontext-dev",
                parameters: {
                    prompt: prompt || "Enhance the image with high quality, professional, vibrant colors, detailed rendering. Cartoon style, realistic lighting, cinematic composition, ultra-detailed textures, 8k resolution.",
                },
            });

            const base64Image = await this._toBase64(imageBuffer); // Convert buffer to base64 for storage

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
            // 2. Generate image
            const aiResult = await generateFn();

            // 3. Upload generated image to storage
            // Create a mock file object for storage service

            const mockFile = {
                path: null,
                filename: `generated-${sessionId}-${Date.now()}.png`,
                size: Math.floor(aiResult.imageData.length * 0.75),
                mimetype: aiResult.mimeType,
            };
            // Upload to storage (you may need to modify storageService for base64)
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

    // This is the main entry point for text-to-image generation - called by the queue worker
    async processGeneration(sessionId, productSku, userPrompt) {
        // 1. Generate enhanced prompt
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

    // This is the main entry point for image-to-image generation - called by the queue worker
    async processImageToImageGeneration(sessionId, productSku, userPrompt, originalImageUrl) {
        // 1. Generate enhanced prompt
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

            // Create directory
            fs.mkdirSync(uploadDir, { recursive: true });

            // Write file
            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, base64Image, 'base64');

            // Get file size
            const stats = fs.statSync(filePath);

            // Generate URL
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


    /**
     * Full workflow: cartoonify the user's photo, then deterministically
     * composite it onto the unmodified product wrapper.
     * @param {string} sessionId
     * @param {string} productSku
     * @param {string} userPrompt
     * @param {string} originalImageUrl
     * @returns {Promise<Object>} Job result
     */

    // Main entry point for compositing 2 images. 
    /*
        Important notes before you wire this into a queue/controller

        WRAPPER_OVERLAY_REGIONS coordinates need real measurement — 
        open your actual Cadbury wrapper template in any editor, note where the label/photo area sits in pixels, 
        and update top/left/width/height. I used placeholder numbers.
        You need an actual wrapper template image file stored in assets/wrappers/ — 
        a transparent-background-aware PNG of the wrapper with the label area empty 
        (or with a placeholder you're overlaying onto).
        fit: 'cover' crops the cartoon face to fill the box without stretching — 
        if your label area isn't square, faces near the edges may get cropped. 
        fit: 'contain' is the alternative if you'd rather show the whole face with padding instead.
        This doesn't yet hook into your queue/controller — following your existing pattern, 
        you'd add a new AI_JOB_TYPES.WRAPPER_COMPOSITE entry to constants/aiJobs.js, a new queue via createAIQueue(), and a controller wrapper, 
        exactly like the text-to-image/image-to-image pattern you already have. Want me to write those three pieces out the same way?
    */
    async processWrapperComposite(sessionId, productSku, userPrompt, originalImageUrl) {
        try {
            // 1. Cartoonify the user's face (existing AI pipeline, unchanged)
            const prompt = this.generateImageToImagePrompt(productSku, userPrompt);
            const aiResult = await this.generateImageToImage(prompt, originalImageUrl);

            // 2. Composite the cartoon face onto the real wrapper (deterministic, no AI)
            const cartoonBuffer = Buffer.from(aiResult.imageData, 'base64');
            const uploadResult = await imageCompositeService.compositeAndUpload(
                sessionId,
                productSku,
                cartoonBuffer
            );

            return {
                success: true,
                processedImageUrl: uploadResult.url,
                aiPrompt: prompt,
                aiResult: {
                    mimeType: 'image/png',
                    size: uploadResult.size,
                },
            };
        } catch (error) {
            console.error('AI process wrapper composite error:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
}

module.exports = new AIService();