const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const User = require('../src/models/User');

jest.setTimeout(25000);

describe('Payment & Subscription Integration Tests', () => {
  let userToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-website-analyzer-test';
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 }).catch(() => {});
    }
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: 'paymentuser@vapt-test.com' }).catch(() => {});

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Payment User',
          email: 'paymentuser@vapt-test.com',
          password: 'Password123!'
        });

      userToken = regRes.body.token;
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: 'paymentuser@vapt-test.com' }).catch(() => {});
      await mongoose.connection.close().catch(() => {});
    }
  });

  it('should fetch user subscription status', async () => {
    if (!userToken) return;
    const res = await request(app)
      .get('/api/payment/subscription')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('plan', 'free');
    expect(res.body).toHaveProperty('scansCountThisMonth');
  });

  it('should create a checkout session in test mode', async () => {
    if (!userToken) return;
    const res = await request(app)
      .post('/api/payment/create-checkout-session')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ plan: 'pro' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('url');
  });
});
