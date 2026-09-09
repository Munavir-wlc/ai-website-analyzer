const request = require('supertest');
const mongoose = require('mongoose');
const dns = require('dns').promises;
const axios = require('axios');
const app = require('../src/index');
const User = require('../src/models/User');
const Domain = require('../src/models/Domain');

describe('Domain Ownership Verification Flow', () => {
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-website-analyzer-test';
      await mongoose.connect(mongoUri);
    }

    await User.deleteMany({ email: { $in: ['domain-owner@vapt-test.com', 'other-user@vapt-test.com'] } });
    await Domain.deleteMany({});

    // Register User 1
    const reg1 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Domain Owner',
        email: 'domain-owner@vapt-test.com',
        password: 'Password123!'
      });
    user1Token = reg1.body.token;
    user1Id = reg1.body.user.id;

    // Register User 2
    const reg2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Other User',
        email: 'other-user@vapt-test.com',
        password: 'Password123!'
      });
    user2Token = reg2.body.token;
    user2Id = reg2.body.user.id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: ['domain-owner@vapt-test.com', 'other-user@vapt-test.com'] } });
    await Domain.deleteMany({});
    await mongoose.connection.close();
  });

  let createdDomainId;
  let createdToken;

  it('POST /api/domains - should register a new domain and generate verification token and instructions', async () => {
    const res = await request(app)
      .post('/api/domains')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ hostname: 'https://security-test.example.com/path' });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('domain');
    expect(res.body.domain.hostname).toBe('security-test.example.com');
    expect(res.body.domain.verified).toBe(false);
    expect(res.body.domain.verificationToken).toBeDefined();
    expect(res.body.dnsTxtRecord).toContain('_scanverify.security-test.example.com');
    expect(res.body.fileUpload.path).toContain('/.well-known/scanverify-');
    expect(res.body.fileUpload.content).toBe(res.body.domain.verificationToken);

    createdDomainId = res.body.domain._id;
    createdToken = res.body.domain.verificationToken;
  });

  it('GET /api/domains - should list domains for authenticated user', async () => {
    const res = await request(app)
      .get('/api/domains')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.domains)).toBe(true);
    expect(res.body.domains.length).toBe(1);
    expect(res.body.domains[0].hostname).toBe('security-test.example.com');
  });

  it('POST /api/domains/:id/verify - should fail verification if token is not published yet', async () => {
    // Mock DNS TXT to throw ENOTFOUND
    jest.spyOn(dns, 'resolveTxt').mockRejectedValueOnce(new Error('ENOTFOUND'));
    jest.spyOn(axios, 'get').mockRejectedValueOnce(new Error('404 Not Found'));

    const res = await request(app)
      .post(`/api/domains/${createdDomainId}/verify`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.message).toMatch(/Verification not found yet/i);
  });

  it('POST /api/domains/:id/verify - should verify domain via DNS TXT record', async () => {
    // Mock DNS TXT resolution returning the valid token
    jest.spyOn(dns, 'resolveTxt').mockResolvedValueOnce([[`scanverify=${createdToken}`]]);

    const res = await request(app)
      .post(`/api/domains/${createdDomainId}/verify`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.domain.verified).toBe(true);
    expect(res.body.domain.verificationMethod).toBe('dns-txt');
    expect(res.body.domain.verifiedAt).toBeDefined();
  });

  it('POST /api/domains/:id/verify - should verify domain via HTTP /.well-known file upload', async () => {
    // Create another domain for file verification test
    const addRes = await request(app)
      .post('/api/domains')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ hostname: 'file-verify.example.com' });

    const fileDomainId = addRes.body.domain._id;
    const fileToken = addRes.body.domain.verificationToken;

    // Mock DNS to fail, axios to succeed with token string
    jest.spyOn(dns, 'resolveTxt').mockRejectedValueOnce(new Error('ENOTFOUND'));
    jest.spyOn(axios, 'get').mockResolvedValueOnce({ status: 200, data: fileToken });

    const verifyRes = await request(app)
      .post(`/api/domains/${fileDomainId}/verify`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.verified).toBe(true);
    expect(verifyRes.body.domain.verificationMethod).toBe('file-upload');
  });

  it('DELETE /api/domains/:id - should not allow unauthorized user to delete another user domain', async () => {
    const res = await request(app)
      .delete(`/api/domains/${createdDomainId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.statusCode).toBe(404);
  });

  it('POST /api/scan - should reject mode: active on unverified domain with 403', async () => {
    const res = await request(app)
      .post('/api/scan')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        url: 'https://unverified-host.com',
        consent: true,
        mode: 'active'
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Domain ownership verification required/i);
    expect(res.body.unverifiedDomain).toBe('unverified-host.com');
  });

  it('POST /api/scan - should allow passive/quick scan on unverified domain without error', async () => {
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

  it('POST /api/scan - should allow active scan when domain is verified by requesting user', async () => {
    const res = await request(app)
      .post('/api/scan')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        url: 'https://security-test.example.com',
        consent: true,
        mode: 'active'
      });

    expect([200, 202]).toContain(res.statusCode);
    expect(res.body).toHaveProperty('scanId');
  });
});
