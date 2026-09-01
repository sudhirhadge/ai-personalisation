/**
 * Integration tests for the session endpoints (server/routes/sessions.js),
 * using supertest against the real app.js + an in-memory Mongo (see
 * tests/helpers/testDb.js). The aiQueue mock below is required simply
 * because app.js unconditionally requires routes/ai.js at module load —
 * these tests don't touch AI generation at all.
 *
 * emailService is mocked too: createSession fires a real (caught,
 * fire-and-forget) email send via Ethereal in the background, which is
 * harmless to test correctness but noisy (logs a loud auth-failure block)
 * since Ethereal's test credentials expire.
 */
jest.mock('../queues/aiQueue');
jest.mock('../services/emailService', () => ({
    sendPersonalizationEmail: jest.fn().mockResolvedValue({ success: true }),
}));

const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./helpers/testDb');

beforeAll(async () => {
    await connect();
});

afterEach(async () => {
    await clearDatabase();
});

afterAll(async () => {
    await closeDatabase();
});

describe('POST /api/v1/sessions', () => {
    it('creates a session and returns a usable JWT', async () => {
        const res = await request(app)
            .post('/api/v1/sessions')
            .send({ email: 'test@example.com', productSku: 'generic-chocolate-placeholder' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            email: 'test@example.com',
            productSku: 'generic-chocolate-placeholder',
            status: 'CREATED',
        });
        expect(typeof res.body.data.jwtToken).toBe('string');
        expect(res.body.data.personalizationLink).toContain(res.body.data.jwtToken);
    });

    it('rejects a missing email', async () => {
        const res = await request(app)
            .post('/api/v1/sessions')
            .send({ productSku: 'generic-chocolate-placeholder' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('rejects an invalid email format', async () => {
        const res = await request(app)
            .post('/api/v1/sessions')
            .send({ email: 'not-an-email', productSku: 'generic-chocolate-placeholder' });

        expect(res.status).toBe(400);
    });
});

describe('GET /api/v1/sessions/me', () => {
    async function createSession() {
        const res = await request(app)
            .post('/api/v1/sessions')
            .send({ email: 'test@example.com', productSku: 'generic-chocolate-placeholder' });
        return res.body.data.jwtToken;
    }

    it('returns the current session for a valid token', async () => {
        const token = await createSession();

        const res = await request(app)
            .get('/api/v1/sessions/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe('CREATED');
        // Phase 0 session-resume fix: these fields must always be present
        // (null until set), not just when status === 'UPLOADED'.
        expect(res.body.data).toHaveProperty('originalImageUrl', null);
        expect(res.body.data).toHaveProperty('aiJobId', null);
        expect(res.body.data).toHaveProperty('processedImageUrl', null);
    });

    it('rejects a request with no token', async () => {
        const res = await request(app).get('/api/v1/sessions/me');
        expect(res.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
        const res = await request(app)
            .get('/api/v1/sessions/me')
            .set('Authorization', 'Bearer not-a-real-token');

        expect(res.status).toBe(401);
    });
});
