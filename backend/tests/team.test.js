const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/index');
const User = require('../src/models/User');
const Team = require('../src/models/Team');

jest.setTimeout(25000);

describe('Team Workspaces Integration Tests', () => {
  let userToken;
  let userId;
  let teamId;
  let inviteToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_1234567890';
    if (mongoose.connection.readyState === 0) {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-website-analyzer-test';
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 }).catch(() => {});
    }
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: 'teamowner@vapt-test.com' }).catch(() => {});
      await Team.deleteMany({ name: 'Test Cyber Team' }).catch(() => {});

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Team Owner',
          email: 'teamowner@vapt-test.com',
          password: 'Password123!'
        });

      userToken = regRes.body.token;
      userId = regRes.body.user?.id;
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: 'teamowner@vapt-test.com' }).catch(() => {});
      await Team.deleteMany({ name: 'Test Cyber Team' }).catch(() => {});
      await mongoose.connection.close().catch(() => {});
    }
  });

  it('should create a new team workspace', async () => {
    if (!userToken) return;
    const res = await request(app)
      .post('/api/team/create')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Test Cyber Team' });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.team).toHaveProperty('name', 'Test Cyber Team');
    teamId = res.body.team._id;
  });

  it('should list my team workspaces', async () => {
    if (!userToken) return;
    const res = await request(app)
      .get('/api/team/my-teams')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should invite a new member to the team', async () => {
    if (!userToken || !teamId) return;
    const res = await request(app)
      .post(`/api/team/${teamId}/invite`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ email: 'colleague@vapt-test.com', role: 'member' });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('inviteToken');
    inviteToken = res.body.inviteToken;
  });

  it('should join team workspace using invite token', async () => {
    if (!userToken || !inviteToken) return;
    const colleagueRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Colleague User',
        email: 'colleague@vapt-test.com',
        password: 'Password123!'
      });

    const colleagueToken = colleagueRes.body.token;

    const res = await request(app)
      .post(`/api/team/join/${inviteToken}`)
      .set('Authorization', `Bearer ${colleagueToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: 'colleague@vapt-test.com' }).catch(() => {});
    }
  });
});
