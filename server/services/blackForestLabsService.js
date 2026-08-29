/**
 * Black Forest Labs Service
 * Handles multi-reference image generation via BFL's direct API (not via
 * Hugging Face). Used specifically for wrapper-composite jobs that need
 * two distinct reference images (product wrapper + user's cartoon face) —
 * a capability not exposed through @huggingface/inference's imageToImage().
 *
 * Architectural Decision:
 * - Separate vendor, separate API key, separate billing from the existing
 *   HF-based aiService.js. Kept in its own file so the two integrations
 *   don't get tangled — different auth scheme (x-key vs Bearer), different
 *   request lifecycle (async polling vs single blocking call).
 * - BFL is async: submit -> poll polling_url -> download from delivery URL.
 *   Delivery URLs expire in 10 minutes, so we download immediately on
 *   success rather than storing the URL itself.
 */
const config = require('../config');

const BFL_BASE_URL = 'https://api.bfl.ai/v1';
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60000; // 60s ceiling before giving up

class BlackForestLabsService {
    /**
     * Submit a multi-reference generation request.
     * @param {string} prompt - Must reference images by number, e.g.
     *   "Apply the cartoon-style face from image 2 onto the printed label
     *    area of the product in image 1, preserving the product's shape,
     *    color, and branding."
     * @param {string[]} imageUrls - Ordered array of publicly-reachable
     *   image URLs. imageUrls[0] -> input_image, imageUrls[1] -> input_image_2, etc.
     * @param {Object} [options]
     * @param {string} [options.model='flux-2-pro'] - BFL model name
     * @returns {Promise<{ requestId: string, pollingUrl: string }>}
     */
    async submitMultiReferenceGeneration(prompt, imageUrls, options = {}) {
        const model = options.model || 'flux-2-pro';

        if (!imageUrls || imageUrls.length < 2) {
            throw new Error('Multi-reference generation requires at least 2 image URLs');
        }

        const body = { prompt };
        imageUrls.forEach((url, index) => {
            const key = index === 0 ? 'input_image' : `input_image_${index + 1}`;
            body[key] = url;
        });

        const response = await fetch(`${BFL_BASE_URL}/${model}`, {
            method: 'POST',
            headers: {
                'x-key': config.blackForestLabsApiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`BFL submission failed (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        return {
            requestId: data.id,
            pollingUrl: data.polling_url,
        };
    }

    /**
     * Poll a BFL request until it completes, fails, or times out.
     * @param {string} pollingUrl - Returned from submitMultiReferenceGeneration
     * @returns {Promise<string>} delivery URL of the generated image
     */
    async pollUntilReady(pollingUrl) {
        const startTime = Date.now();

        while (Date.now() - startTime < POLL_TIMEOUT_MS) {
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

            const response = await fetch(pollingUrl, {
                headers: { 'x-key': config.blackForestLabsApiKey },
            });

            if (!response.ok) {
                throw new Error(`BFL polling failed (${response.status})`);
            }

            const result = await response.json();

            if (result.status === 'Ready') {
                return result.result.sample; // delivery URL, expires in 10 minutes
            }

            if (result.status === 'Error' || result.status === 'Failed') {
                throw new Error(`BFL generation failed: ${JSON.stringify(result)}`);
            }

            // status is likely 'Pending' or 'Processing' — keep polling
        }

        throw new Error('BFL generation timed out after polling');
    }

    /**
     * Download the generated image immediately — delivery URLs expire in
     * 10 minutes, so this must run right after pollUntilReady() resolves.
     * @param {string} deliveryUrl
     * @returns {Promise<Buffer>}
     */
    async downloadResult(deliveryUrl) {
        const response = await fetch(deliveryUrl);
        if (!response.ok) {
            throw new Error(`Failed to download BFL result (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    /**
     * Full workflow: submit -> poll -> download.
     * @param {string} prompt
     * @param {string[]} imageUrls
     * @returns {Promise<Buffer>} final image as a Buffer
     */
    async generateMultiReference(prompt, imageUrls) {
        const { pollingUrl } = await this.submitMultiReferenceGeneration(prompt, imageUrls);
        const deliveryUrl = await this.pollUntilReady(pollingUrl);
        return this.downloadResult(deliveryUrl);
    }
}

module.exports = new BlackForestLabsService();