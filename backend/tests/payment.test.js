const request = require('supertest');
const mongoose = require('mongoose');
const stripe = require('stripe');
const app = require('../src/index');
const User = require('../src/models/User');
const ProcessedWebhookEvent = require('../src/models/ProcessedWebhookEvent');

jest.setTimeout(25000);

describe('Payment & Subscription Integration Tests', () => {
  let user;
  let userToken;
  const mockStripeSecret = 'sk_test_mock_secret_key_12345';
  const mockWebhookSecret = 'whsec_test_webhook_secret_67890';
  const mockProPriceId = 'price_pro_test_123';
  const mockTeamPriceId = 'price_team_test_456';
  const stripeClient = stripe(mockStripeSecret);

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';
    process.env.STRIPE_SECRET_KEY = mockStripeSecret;
    process.env.STRIPE_WEBHOOK_SECRET = mockWebhookSecret;
    process.env.STRIPE_PRICE_PRO = mockProPriceId;
    process.env.STRIPE_PRICE_TEAM = mockTeamPriceId;

    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-website-analyzer-test';
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 }).catch(() => {});
    }
  });

  beforeEach(async () => {
    await User.deleteMany({ email: 'paymentuser@vapt-test.com' }).catch(() => {});
    await ProcessedWebhookEvent.deleteMany({}).catch(() => {});

    user = await User.create({
      name: 'Payment User',
      email: 'paymentuser@vapt-test.com',
      password: 'Password123!',
      plan: 'free'
    });

    const regRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'paymentuser@vapt-test.com',
        password: 'Password123!'
      });

    userToken = regRes.body.token;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: 'paymentuser@vapt-test.com' }).catch(() => {});
      await ProcessedWebhookEvent.deleteMany({}).catch(() => {});
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

  it('should upgrade user plan to Pro using price ID mapping in webhook event', async () => {
    const payload = {
      id: 'evt_test_pro_upgrade_' + Date.now(),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_pro',
          client_reference_id: user._id.toString(),
          customer: 'cus_test_123',
          subscription: 'sub_test_123',
          line_items: {
            data: [
              {
                price: { id: mockProPriceId }
              }
            ]
          }
        }
      }
    };

    const payloadString = JSON.stringify(payload);
    const sig = stripeClient.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: mockWebhookSecret
    });

    const res = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', sig)
      .set('Content-Type', 'application/json')
      .send(payloadString);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.plan).toBe('pro');
    expect(updatedUser.subscriptionStatus).toBe('active');
    expect(updatedUser.stripeCustomerId).toBe('cus_test_123');

    // Verify ProcessedWebhookEvent recorded
    const eventDoc = await ProcessedWebhookEvent.findOne({ eventId: payload.id });
    expect(eventDoc).toBeDefined();
    expect(eventDoc.eventId).toBe(payload.id);
  });

  it('should upgrade user plan to Team using price ID mapping in webhook event', async () => {
    const payload = {
      id: 'evt_test_team_upgrade_' + Date.now(),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_team',
          client_reference_id: user._id.toString(),
          customer: 'cus_test_team_456',
          subscription: 'sub_test_team_456',
          line_items: {
            data: [
              {
                price: { id: mockTeamPriceId }
              }
            ]
          }
        }
      }
    };

    const payloadString = JSON.stringify(payload);
    const sig = stripeClient.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: mockWebhookSecret
    });

    const res = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', sig)
      .set('Content-Type', 'application/json')
      .send(payloadString);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.plan).toBe('team');
  });

  it('should fall back to Pro plan if price ID is unknown in webhook event', async () => {
    const payload = {
      id: 'evt_test_unknown_price_' + Date.now(),
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_unknown',
          client_reference_id: user._id.toString(),
          customer: 'cus_test_789',
          subscription: 'sub_test_789',
          line_items: {
            data: [
              {
                price: { id: 'price_unknown_legacy_999' }
              }
            ]
          }
        }
      }
    };

    const payloadString = JSON.stringify(payload);
    const sig = stripeClient.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: mockWebhookSecret
    });

    const res = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', sig)
      .set('Content-Type', 'application/json')
      .send(payloadString);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true });

    const updatedUser = await User.findById(user._id);
    expect(updatedUser.plan).toBe('pro');
  });

  it('should prevent reprocessing on duplicate webhook event.id (idempotency)', async () => {
    const eventId = 'evt_test_duplicate_check_100';
    const payload = {
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_session_duplicate',
          client_reference_id: user._id.toString(),
          customer: 'cus_dup_100',
          subscription: 'sub_dup_100',
          line_items: {
            data: [
              {
                price: { id: mockTeamPriceId }
              }
            ]
          }
        }
      }
    };

    const payloadString = JSON.stringify(payload);
    const sig = stripeClient.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: mockWebhookSecret
    });

    // First request - should process normally
    const firstRes = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', sig)
      .set('Content-Type', 'application/json')
      .send(payloadString);

    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.body).toEqual({ received: true });

    // Second request with exact same event ID - should be recognized as duplicate
    const secondRes = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', sig)
      .set('Content-Type', 'application/json')
      .send(payloadString);

    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.body).toEqual({ received: true, duplicate: true });
  });
});
