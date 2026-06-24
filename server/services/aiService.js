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
     * Generate image using Hugging Face Stable Diffusion XL
     * @param {string} prompt - AI prompt
     * @returns {Promise<Object>} Generated image data
     */
    async generateImage(prompt) {
        try {
            console.log('🎨 Generating image with prompt:', prompt);

            // Use Stable Diffusion XL (free, high-quality)
            const imageBuffer = await hf.textToImage({
                model: 'stabilityai/stable-diffusion-xl-base-1.0',
                inputs: prompt,
            });

            // Convert buffer to base64 for storage
            // const base64Image = imageBuffer.toString('base64');
            const arrayBuffer = await imageBuffer.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const base64Image = buffer.toString("base64");

            return {
                success: true,
                imageData: base64Image,
                mimeType: 'image/png',
                prompt: prompt,
            };
        } catch (error) {
            console.error('AI image generation error:', error);

            // Handle specific Hugging Face errors
            if (error.message.includes('Queue') || error.message.includes('timeout')) {
                throw new Error('AI service is busy. Please try again later.');
            }

            throw new Error(error.message || 'AI image generation failed');
        }
    }
    async generateImageToImage(prompt, originalImageUrl) {
        console.log('Generating image-to-image with prompt:', prompt, 'and original image URL:', originalImageUrl);
        try {
            console.log('Generating image with prompt:', prompt);

            // Use Stable Diffusion XL (free, high-quality)
            const imageResponse = await fetch(originalImageUrl);
            const imageBlob = await imageResponse.blob();
            const imageBuffer = await inference.imageToImage({
                // data: imageBlob,
                inputs: imageBlob,
                // model: "timbrooks/instruct-pix2pix",
                model: "black-forest-labs/FLUX.1-Kontext-dev",
                parameters: {
                    prompt: prompt || "Enhance the image with high quality, professional, vibrant colors, detailed rendering. Cartoon style, realistic lighting, cinematic composition, ultra-detailed textures, 8k resolution.",
                },
            });

            // Convert buffer to base64 for storage
            // const base64Image = imageBuffer.toString('base64');
            const arrayBuffer = await imageBuffer.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString("base64");
            console.log('Generated image-to-image successfully', base64Image.length);

            return {
                success: true,
                imageData: base64Image,
                mimeType: 'image/png',
                prompt: prompt,
            };
        } catch (error) {
            console.error('AI image generation error:', error);

            // Handle specific Hugging Face errors
            if (error.message.includes('Queue') || error.message.includes('timeout')) {
                throw new Error('AI service is busy. Please try again later.');
            }

            throw new Error(error.message || 'AI image generation failed');
        }
    }

    /**
     * Process AI generation job (full workflow)
     * @param {string} sessionId - MongoDB session ID
     * @param {string} productSku - Product identifier
     * @param {string} userPrompt - User's vision description
     * @returns {Promise<Object>} Job result
     */
    async processGeneration(sessionId, productSku, userPrompt) {
        try {
            // 1. Generate enhanced prompt
            const prompt = this.generatePrompt(productSku, userPrompt);

            // 2. Generate image
            const aiResult = await this.generateImage(prompt);

            // 3. Upload generated image to storage
            // Create a mock file object for storage service
            const mockFile = {
                path: null, // We'll use base64 directly
                filename: `generated-${sessionId}-${Date.now()}.png`,
                size: Math.floor(aiResult.imageData.length * 0.75), // Approximate size
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

    async processImageToImageGeneration(sessionId, productSku, userPrompt, originalImageUrl) {
        try {
            // 1. Generate enhanced prompt
            const prompt = this.generateImageToImagePrompt(productSku, userPrompt);

            // 2. Generate image
            const aiResult = await this.generateImageToImage(prompt, originalImageUrl);

            // 3. Upload generated image to storage
            // Create a mock file object for storage service
            const mockFile = {
                path: null, // We'll use base64 directly
                filename: `generated-${sessionId}-${Date.now()}.png`,
                size: Math.floor(aiResult.imageData.length * 0.75), // Approximate size
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
}

module.exports = new AIService();