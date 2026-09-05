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
 * templatePath  — local disk path for sharp-based compositing (Option A)
 * publicUrl     — publicly reachable URL for BFL multi-ref API (Option B)
 *                 Must be a real public URL (not localhost) since BFL's
 *                 servers fetch it server-side. Use your CDN/S3/deployed
 *                 domain here, not a local path.
 * shape         — optional crop-shape hint ('circle' | 'triangle'), read
 *                 only by listRegions() below for the picker's dashed
 *                 guide. Omit for the 'rectangle' default. Not yet
 *                 consumed by compositeOntoWrapper — no actual cropping
 *                 or masking happens against this field today.
 */
const WRAPPER_OVERLAY_REGIONS = {
    'generic-chocolate-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'placeholder-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/placeholder-wrapper-mockup.png`,
        top: 220,
        left: 120,
        width: 360,
        height: 360,
    },
    'generic-chocolate-placeholder-rectangular': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'placeholder-wrapper-mockup-rectangular.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/placeholder-wrapper-mockup-rectangular.png`,
        top: 150,
        left: 320,
        width: 360,
        height: 200,
    },
    'generic-tshirt-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'tshirt-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/tshirt-wrapper-mockup.png`,
        top: 305,
        left: 235,
        width: 130,
        height: 182,
    },
    'generic-mug-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'mug-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/mug-wrapper-mockup.png`,
        top: 230,
        left: 180,
        width: 150,
        height: 170,
    },
    'generic-mobile-cover-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'mobile-cover-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/mobile-cover-wrapper-mockup.png`,
        top: 270,
        left: 90,
        width: 240,
        height: 350,
    },
    'generic-school-bag-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'school-bag-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/school-bag-wrapper-mockup.png`,
        top: 300,
        left: 210,
        width: 200,
        height: 130,
    },
    'generic-bottle-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'bottle-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/bottle-wrapper-mockup.png`,
        top: 380,
        left: 110,
        width: 200,
        height: 250,
    },
    'generic-tote-bag-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'tote-bag-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/tote-bag-wrapper-mockup.png`,
        top: 280,
        left: 190,
        width: 180,
        height: 220,
    },
    'generic-cap-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'cap-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/cap-wrapper-mockup.png`,
        top: 190,
        left: 230,
        width: 140,
        height: 90,
    },
    'generic-mouse-pad-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'mouse-pad-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/mouse-pad-wrapper-mockup.png`,
        top: 150,
        left: 140,
        width: 420,
        height: 200,
    },
    'generic-photo-frame-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'photo-frame-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/photo-frame-wrapper-mockup.png`,
        top: 180,
        left: 140,
        width: 280,
        height: 380,
    },
    'generic-pillow-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'pillow-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/pillow-wrapper-mockup.png`,
        top: 210,
        left: 180,
        width: 200,
        height: 200,
    },
    'generic-coaster-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'coaster-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/coaster-wrapper-mockup.png`,
        top: 180,
        left: 150,
        width: 180,
        height: 180,
        shape: 'circle',
    },
    'generic-keychain-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'keychain-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/keychain-wrapper-mockup.png`,
        top: 230,
        left: 110,
        width: 140,
        height: 160,
    },
    'generic-notebook-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'notebook-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/notebook-wrapper-mockup.png`,
        top: 220,
        left: 190,
        width: 240,
        height: 320,
    },
    'generic-greeting-card-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'greeting-card-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/greeting-card-wrapper-mockup.png`,
        top: 220,
        left: 300,
        width: 130,
        height: 220,
    },
    'generic-wallet-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'wallet-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/wallet-wrapper-mockup.png`,
        top: 190,
        left: 130,
        width: 130,
        height: 130,
    },
    'generic-umbrella-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'umbrella-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/umbrella-wrapper-mockup.png`,
        top: 200,
        left: 220,
        width: 120,
        height: 100,
    },
    'generic-apron-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'apron-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/apron-wrapper-mockup.png`,
        top: 400,
        left: 140,
        width: 220,
        height: 180,
    },
    'generic-hoodie-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'hoodie-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/hoodie-wrapper-mockup.png`,
        top: 345,
        left: 235,
        width: 130,
        height: 120,
    },
    'generic-wall-clock-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'wall-clock-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/wall-clock-wrapper-mockup.png`,
        top: 320,
        left: 190,
        width: 100,
        height: 80,
        shape: 'circle',
    },
    'generic-face-mask-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'face-mask-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/face-mask-wrapper-mockup.png`,
        top: 170,
        left: 170,
        width: 160,
        height: 90,
    },
    'generic-baby-bib-placeholder': {
        templatePath: path.join(process.cwd(), 'assets', 'wrappers', 'baby-bib-wrapper-mockup.png'),
        publicUrl: `${config.apiURL}/assets/wrappers/baby-bib-wrapper-mockup.png`,
        top: 250,
        left: 170,
        width: 140,
        height: 130,
    },
    'generic-pennant-flag-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'pennant-flag-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/pennant-flag-wrapper-mockup.png`,
        top: 175,
        left: 140,
        width: 100,
        height: 90,
        shape: 'triangle',
    },
    'generic-puzzle-piece-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'puzzle-piece-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/puzzle-piece-wrapper-mockup.png`,
        top: 180,
        left: 170,
        width: 110,
        height: 130,
    },
    'generic-guitar-pick-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'guitar-pick-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/guitar-pick-wrapper-mockup.png`,
        top: 220,
        left: 180,
        width: 120,
        height: 100,
        shape: 'triangle',
    },
    'generic-passport-cover-placeholder': {
        templatePath: path.join(
            process.cwd(),
            'assets',
            'wrappers',
            'passport-cover-wrapper-mockup.png'
        ),
        publicUrl: `${config.apiURL}/assets/wrappers/passport-cover-wrapper-mockup.png`,
        top: 290,
        left: 120,
        width: 180,
        height: 160,
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
     * List all configured wrapper templates for frontend consumption
     * (session-creation SKU picker + wizard mode-availability checks).
     * Only exposes fields safe for a public, unauthenticated response —
     * templatePath is a local disk path and stays server-side.
     *
     * `shape` is a crop-shape *hint* only — 'rectangle' (the default for
     * any SKU that doesn't set one) unless the entry says otherwise. Only
     * the picker's visual guide reads it today; no cropping/masking logic
     * exists yet, on either the client or compositeOntoWrapper below.
     * @returns {Array<{sku: string, previewUrl: string, region: {top: number, left: number, width: number, height: number}, shape: string}>}
     */
    listRegions() {
        return Object.entries(WRAPPER_OVERLAY_REGIONS).map(([sku, region]) => ({
            sku,
            previewUrl: region.publicUrl,
            region: {
                top: region.top,
                left: region.left,
                width: region.width,
                height: region.height,
            },
            shape: region.shape || 'rectangle',
        }));
    }

    /**
     * Get the publicly reachable wrapper URL for a given SKU.
     * Used by the BFL multi-reference path — BFL's servers fetch this URL
     * themselves, so it must be externally reachable (not localhost).
     *
     * @param {string} productSku
     * @returns {string} public URL
     * @throws {Error} if SKU has no configured wrapper or no publicUrl set
     */
    getWrapperPublicUrl(productSku) {
        const region = this._getRegionConfig(productSku); // already throws if SKU unknown

        if (!region.publicUrl) {
            throw new Error(
                `No publicUrl configured for SKU: ${productSku}. ` +
                    `Add a publicUrl to WRAPPER_OVERLAY_REGIONS for this SKU before ` +
                    `using the multi-reference BFL path.`
            );
        }

        return region.publicUrl;
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
