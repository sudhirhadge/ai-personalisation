/**
 * @swagger
 * /api/v1/sessions/me:
 *   get:
 *     summary: Get current session
 *     tags:
 *       - Sessions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Unauthorized
 */