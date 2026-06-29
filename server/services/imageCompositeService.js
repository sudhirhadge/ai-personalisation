/**
 * Image Composite Service
 * Deterministically overlays a cartoonified user face onto a fixed region
 * of an unmodified product wrapper image (e.g. Cadbury chocolate wrapper).
 *
 * Architectural Decision:
 * - Uses sharp (libvips), not AI, for the final composite step.
 * - Why not AI compositing: diffusion models cannot guarantee pixel-exact
 *   preservation of branded packaging (logos/text can drift or blur), which
 *   is a hard requirement here, not a nice-to-have. Sharp guarantees the
 *   wrapper pixels outside the overlay region are 100% untouched.
 * - The cartoonified face still comes from the existing AI pipeline
 *   (aiService.generateImageToImage); this service only handles the final
 *   deterministic placement step.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Per-product-SKU overlay regions, in pixels, relative to the *wrapper
 * template's own dimensions* (not the final output size — sharp resizes
 * the overlay to fit this box regardless of source photo dimensions).
 *
 * top/left/width/height define a box on the wrapper where the cartoon
 * face will be placed. These need to be measured once per wrapper design
 * (e.g. by opening the wrapper template in any image editor and reading
 * off the label's pixel coordinates).
 *
 * TODO: move this to MongoDB (a WrapperTemplate collection) once you have
 * more than a handful of SKUs — a flat file won't scale past a few products.
 */
const WRAPPER_OVERLAY_REGIONS = {
    'productRectangle': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'placeholder-wrapper-mockup-rectangular.png'),
        top: 150,
        left: 320,
        width: 360,
        height: 200,
        // Optional: corner radius / mask shape could go here later (e.g. rounded label edges)
    },
    // Add additional SKUs here as you onboard more wrapper designs.
};

class ImageCompositeService {
    /**
     * Get the overlay region config for a given product SKU.
     * @param {string} productSku
     * @returns {Object} region config
     * @throws {Error} if SKU has no configured wrapper region
     */
    _getRegionConfig(productSku) {
        const region = WRAPPER_OVERLAY_REGIONS[productSku];
        if (!region) {
            throw new Error(`No wrapper overlay region configured for SKU: ${productSku}`);
        }
        return region;
    }
    hasRegionConfig(productSku) {
        return Boolean(WRAPPER_OVERLAY_REGIONS[productSku]);
    }

    /**
     * Composite a cartoonified face image onto a product wrapper template.
     * @param {string} productSku - Identifies which wrapper template + region to use
     * @param {Buffer} cartoonImageBuffer - The AI-generated cartoon face (PNG/JPEG buffer)
     * @returns {Promise<Buffer>} Final composited image as a PNG buffer
     */
    async compositeOntoWrapper(productSku, cartoonImageBuffer) {
        const region = this._getRegionConfig(productSku);

        if (!fs.existsSync(region.templatePath)) {
            throw new Error(`Wrapper template file not found: ${region.templatePath}`);
        }

        // Resize the cartoon face to exactly fill the target region.
        // 'cover' crops to fill the box without distortion (vs 'fill' which
        // would stretch/squash the face — almost never what you want here).
        const resizedOverlay = await sharp(cartoonImageBuffer)
            .resize(region.width, region.height, { fit: 'cover' })
            .toBuffer();

        // Composite onto the untouched wrapper template.
        // The wrapper image itself is never resized or re-encoded outside
        // this composite step — its pixels stay faithful except inside the
        // overlay box.
        const finalBuffer = await sharp(region.templatePath)
            .composite([
                {
                    input: resizedOverlay,
                    top: region.top,
                    left: region.left,
                    blend: 'over',
                },
            ])
            .png()
            .toBuffer();

        return finalBuffer;
    }

    /**
     * Full workflow: composite + save to disk, mirroring the existing
     * uploadGeneratedImage() pattern in aiService.js for consistency.
     * @param {string} sessionId
     * @param {string} productSku
     * @param {Buffer} cartoonImageBuffer
     * @returns {Promise<Object>} { url, fileName, size }
     */
    async compositeAndUpload(sessionId, productSku, cartoonImageBuffer) {
        try {
            const finalBuffer = await this.compositeOntoWrapper(productSku, cartoonImageBuffer);

            const fileName = `composited-${sessionId}-${Date.now()}.png`;
            const uploadDir = path.join(process.cwd(), 'uploads', 'composited');
            fs.mkdirSync(uploadDir, { recursive: true });

            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, finalBuffer);

            const stats = fs.statSync(filePath);
            const url = `${config.apiURL}/uploads/composited/${fileName}`;

            return { url, fileName, size: stats.size };
        } catch (error) {
            console.error('Composite and upload error:', error);
            throw error;
        }
    }
}

module.exports = new ImageCompositeService();