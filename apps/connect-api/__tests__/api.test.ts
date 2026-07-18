import request from 'supertest';

// Mock cortex-matching BEFORE importing app
jest.mock('cortex-matching', () => ({
  bulkMatchItems: jest.fn().mockResolvedValue([]),
}));

// Set API key before app loads
process.env.CONNECT_API_KEY = 'test-api-key';

// Import app after mocks are set
// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../src/index').default;

describe('connect-api integration', () => {
  it('should reject requests without API key (401)', async () => {
    const res = await request(app)
      .post('/surrendered-items/bulk-check')
      .send({ items: [] });
    expect(res.status).toBe(401);
  });

  it('should reject requests with wrong API key (401)', async () => {
    const res = await request(app)
      .post('/surrendered-items/bulk-check')
      .set('x-api-key', 'wrong-key')
      .send({ items: [] });
    expect(res.status).toBe(401);
  });

  it('POST /surrendered-items/bulk-check — authorized, empty items → 200 with matches', async () => {
    const res = await request(app)
      .post('/surrendered-items/bulk-check')
      .set('x-api-key', 'test-api-key')
      .send({ items: [] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('matches');
    expect(Array.isArray(res.body.matches)).toBe(true);
  });

  it('POST /surrendered-items/bulk-check — returns 400 if items missing', async () => {
    const res = await request(app)
      .post('/surrendered-items/bulk-check')
      .set('x-api-key', 'test-api-key')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /webhook/recovery — returns 200 on valid event', async () => {
    const res = await request(app)
      .post('/webhook/recovery')
      .set('x-api-key', 'test-api-key')
      .send({ event: { id: 'evt_confirmed_123' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /webhook/recovery — returns 400 on invalid payload', async () => {
    const res = await request(app)
      .post('/webhook/recovery')
      .set('x-api-key', 'test-api-key')
      .send({ event: {} });
    expect(res.status).toBe(400);
  });
});
