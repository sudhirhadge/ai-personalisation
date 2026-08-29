/**
 * Wrapper Templates Routes
 * Public catalog of available wrapper-composite templates (SKU + preview image
 * + compositing region), used by the frontend's session-creation template
 * picker and by the wizard to decide which SKUs support wrapper modes.
 *
 * Deliberately a standalone router (not added to the legacy, currently-unmounted
 * routes/products.js) to avoid pulling the unrelated auth2-gated Product CRUD
 * catalog into scope alongside it.
 */
const express = require('express');
const router = express.Router();
const { getWrapperTemplates } = require('../controllers/wrapperTemplateController');

/**
 * GET /api/v1/products/wrapper-templates
 * Public endpoint (no auth) — static catalog data.
 */
router.get('/wrapper-templates', getWrapperTemplates);

module.exports = router;
