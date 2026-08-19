const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');

jest.setTimeout(25000);

describe('Scan API Integration Tests', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-website-analyzer-test';
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should reject scan requests without user consent', async () => {
    const res = await request(app)
      .post('/api/scan')
      .send({
        url: 'https://example.com',
        consent: false
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/consent/i);
  });

  it('should accept valid scan payload with consent and return a scanId', async () => {
    const res = await request(app)
      .post('/api/scan')
      .send({
        url: 'https://example.com',
        consent: true,
        mode: 'quick'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('scanId');
    expect(res.body).toHaveProperty('score');
  });

  it('should return 404 for non-existent scan ID lookup', async () => {
    const res = await request(app)
      .get('/api/scan/results/invalid-non-existent-scan-id');

    expect(res.statusCode).toBe(404);
  });
});
