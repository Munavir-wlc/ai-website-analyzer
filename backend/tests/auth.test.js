const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const User = require('../src/models/User');

describe('Auth API Integration Tests', () => {
  beforeAll(async () => {
    // Set test env secrets if not present
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-website-analyzer-test';
      await mongoose.connect(mongoUri);
    }
    await User.deleteMany({ email: 'testuser@vapt-test.com' });
  });

  afterAll(async () => {
    await User.deleteMany({ email: 'testuser@vapt-test.com' });
    await mongoose.connection.close();
  });

  it('should register a new user and return HttpOnly token cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test Security Engineer',
        email: 'testuser@vapt-test.com',
        password: 'Password123!'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.user).toHaveProperty('email', 'testuser@vapt-test.com');
    expect(res.body).toHaveProperty('token');
    
    // Assert HttpOnly token cookie is set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.includes('token='))).toBe(true);
  });

  it('should fail registration with duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate Engineer',
        email: 'testuser@vapt-test.com',
        password: 'Password123!'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('should authenticate user and return token on valid login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@vapt-test.com',
        password: 'Password123!'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.user).toHaveProperty('email', 'testuser@vapt-test.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should clear token cookie on logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers['set-cookie'].some(c => c.includes('token=none'))).toBe(true);
  });
});
