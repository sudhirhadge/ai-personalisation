/**
 * Wrapper Template Controller
 * Exposes the server-side WRAPPER_OVERLAY_REGIONS registry (imageCompositeService.js)
 * to the frontend so it can render a visual template picker instead of requiring
 * users to know/type a raw productSku.
 *
 * Public endpoint (no auth) — this is static catalog data, not session-specific.
 */
const imageCompositeService = require('../services/imageCompositeService');

/**
 * GET /api/v1/products/wrapper-templates
 * Response:
 * {
 *   success: true,
 *   data: [{ sku, previewUrl, region: { top, left, width, height } }, ...]
 * }
 */
async function getWrapperTemplates(req, res) {
    try {
        const templates = imageCompositeService.listRegions();
        res.json({
            success: true,
            data: templates,
        });
    } catch (error) {
        console.error('Get wrapper templates error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load wrapper templates',
        });
    }
}

module.exports = { getWrapperTemplates };
