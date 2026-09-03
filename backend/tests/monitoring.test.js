const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const User = require('../src/models/User');
const Domain = require('../src/models/Domain');
const Monitor = require('../src/models/Monitor');
const Scan = require('../src/models/Scan');
const { generateFindingFingerprint, computeScanDiff, applyFindingLifecycle } = require('../src/services/findingTracker');
const { checkDueMonitors, stopMonitorScheduler } = require('../src/services/monitorScheduler');

const JWT_SECRET = process.env.JWT_SECRET || 'vapt_scanner_jwt_secret_token_key_2026_xyz';

describe('Continuous Website Monitoring & Change Intelligence Tests', () => {
  let user;
  let userToken;
  let otherUser;
  let otherToken;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vapt_scanner_test');
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Domain.deleteMany({});
    await Monitor.deleteMany({});
    await Scan.deleteMany({});

    user = await User.create({
      name: 'Monitor Admin',
      email: 'admin@monitor-test.com',
      password: 'password123'
    });
    userToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1h' });

    otherUser = await User.create({
      name: 'Other User',
      email: 'other@monitor-test.com',
      password: 'password123'
    });
    otherToken = jwt.sign({ id: otherUser._id }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    stopMonitorScheduler();
    await User.deleteMany({});
    await Domain.deleteMany({});
    await Monitor.deleteMany({});
    await Scan.deleteMany({});
    await mongoose.connection.close();
  });

  describe('1. Deterministic Finding Fingerprinting', () => {
    it('produces identical fingerprints for the same finding across scans', () => {
      const findingA = {
        id: 'missing-hsts',
        title: 'Missing Strict-Transport-Security Header',
        category: 'Headers',
        owasp: 'A05:2021 Security Misconfiguration'
      };

      const findingB = {
        id: 'missing-hsts',
        title: 'Missing Strict-Transport-Security Header',
        category: 'Headers',
        owasp: 'A05:2021 Security Misconfiguration'
      };

      const fpA = generateFindingFingerprint(findingA);
      const fpB = generateFindingFingerprint(findingB);

      expect(fpA).toBeDefined();
      expect(fpA.length).toBe(16);
      expect(fpA).toBe(fpB);
    });

    it('produces different fingerprints for distinct findings', () => {
      const findingA = {
        id: 'missing-hsts',
        title: 'Missing Strict-Transport-Security Header',
        category: 'Headers'
      };
      const findingB = {
        id: 'missing-csp',
        title: 'Missing Content-Security-Policy Header',
        category: 'Headers'
      };

      const fpA = generateFindingFingerprint(findingA);
      const fpB = generateFindingFingerprint(findingB);

      expect(fpA).not.toBe(fpB);
    });
  });

  describe('2. Scan Comparison & Change Intelligence Diffing', () => {
    it('accurately identifies new, resolved, persistent, and changed findings and score deltas', () => {
      const baseScan = {
        scanId: 'base-1',
        score: 75,
        scanMode: 'full',
        report: {
          scores: { security: 70, performance: 80, accessibility: 90, seo: 85, aiSearch: 75 },
          findings: [
            { id: 'f1', title: 'Issue 1', severity: 'high', category: 'Security' },
            { id: 'f2', title: 'Issue 2 (Resolved)', severity: 'medium', category: 'Security' },
            { id: 'f3', title: 'Issue 3 (Changed)', severity: 'low', category: 'Security', description: 'Old description' }
          ]
        }
      };

      const targetScan = {
        scanId: 'target-2',
        score: 85,
        scanMode: 'full',
        report: {
          scores: { security: 80, performance: 85, accessibility: 90, seo: 85, aiSearch: 80 },
          findings: [
            { id: 'f1', title: 'Issue 1', severity: 'high', category: 'Security' }, // Persistent
            { id: 'f3', title: 'Issue 3 (Changed)', severity: 'high', category: 'Security', description: 'Updated description' }, // Severity Changed
            { id: 'f4', title: 'Issue 4 (Brand New)', severity: 'critical', category: 'Security' } // New
          ]
        }
      };

      const diff = computeScanDiff(baseScan, targetScan);

      expect(diff.scoreDelta).toBe(10);
      expect(diff.categoryDeltas.security).toBe(10);
      expect(diff.new.length).toBe(1);
      expect(diff.new[0].title).toBe('Issue 4 (Brand New)');
      expect(diff.resolved.length).toBe(1);
      expect(diff.resolved[0].title).toBe('Issue 2 (Resolved)');
      expect(diff.persistent.length).toBe(1);
      expect(diff.persistent[0].title).toBe('Issue 1');
      expect(diff.changed.length).toBe(1);
      expect(diff.changed[0].title).toBe('Issue 3 (Changed)');
      expect(diff.changed[0].changedFields.severity).toBe(true);
    });
  });

  describe('3. Authoritative Finding Lifecycle & Auto-Reopening', () => {
    it('automatically reopens a finding if user marked it resolved but scanner detects it again', () => {
      const finding = { id: 'vuln-xss', title: 'Reflected XSS Parameter', severity: 'high', category: 'Security' };
      const fp = generateFindingFingerprint(finding);

      const previousScan = {
        scanId: 'scan-prev',
        findingStatuses: new Map([
          [fp, { status: 'resolved', detectionCount: 2, firstDetectedAt: new Date('2026-01-01') }]
        ])
      };

      const currentScan = {
        scanId: 'scan-curr',
        report: {
          findings: [finding]
        },
        findingStatuses: new Map()
      };

      applyFindingLifecycle(currentScan, previousScan);

      const statusObj = currentScan.findingStatuses.get(fp);
      expect(statusObj).toBeDefined();
      expect(statusObj.status).toBe('open'); // Reopened!
      expect(statusObj.reopened).toBe(true);
      expect(statusObj.detectionCount).toBe(3);
      expect(statusObj.previousUserStatus).toBe('resolved');
      expect(statusObj.note).toContain('Auto-reopened');
    });
  });

  describe('4. Scheduled Monitoring API Endpoints', () => {
    it('creates a passive monitor successfully', async () => {
      const res = await request(app)
        .post('/api/monitoring')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          targetUrl: 'https://example.com',
          scanMode: 'quick',
          frequency: 'daily',
          notificationPreferences: {
            email: true,
            onCritical: true
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.hostname).toBe('example.com');
      expect(res.body.frequency).toBe('daily');
      expect(res.body.enabled).toBe(true);
      expect(res.body.nextScanAt).toBeDefined();
    });

    it('rejects active monitoring mode on unverified domain (403)', async () => {
      const res = await request(app)
        .post('/api/monitoring')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          targetUrl: 'https://unverified-domain.com',
          scanMode: 'active',
          frequency: 'weekly'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Domain ownership verification required');
    });

    it('allows active monitoring mode when domain is verified', async () => {
      await Domain.create({
        userId: user._id,
        hostname: 'verified-corp.com',
        verified: true,
        verificationToken: 'token123'
      });

      const res = await request(app)
        .post('/api/monitoring')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          targetUrl: 'https://verified-corp.com',
          scanMode: 'active',
          frequency: 'weekly'
        });

      expect(res.status).toBe(201);
      expect(res.body.scanMode).toBe('active');
    });

    it('lists user monitors with verification status', async () => {
      await Monitor.create({
        userId: user._id,
        hostname: 'my-site.com',
        targetUrl: 'https://my-site.com',
        frequency: 'weekly',
        nextScanAt: new Date()
      });

      const res = await request(app)
        .get('/api/monitoring')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('prevents unauthorized access to another user monitor', async () => {
      const monitor = await Monitor.create({
        userId: user._id,
        hostname: 'secret.com',
        targetUrl: 'https://secret.com',
        frequency: 'weekly',
        nextScanAt: new Date()
      });

      const res = await request(app)
        .get(`/api/monitoring/${monitor._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });

    it('updates monitor frequency and calculates nextScanAt accordingly', async () => {
      const monitor = await Monitor.create({
        userId: user._id,
        hostname: 'update-test.com',
        targetUrl: 'https://update-test.com',
        frequency: 'daily',
        nextScanAt: new Date()
      });

      const res = await request(app)
        .patch(`/api/monitoring/${monitor._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          frequency: 'monthly',
          enabled: false
        });

      expect(res.status).toBe(200);
      expect(res.body.frequency).toBe('monthly');
      expect(res.body.enabled).toBe(false);
    });

    it('triggers an on-demand monitoring scan', async () => {
      const monitor = await Monitor.create({
        userId: user._id,
        hostname: 'ondemand.com',
        targetUrl: 'https://ondemand.com',
        scanMode: 'quick',
        frequency: 'weekly',
        nextScanAt: new Date()
      });

      const res = await request(app)
        .post(`/api/monitoring/${monitor._id}/run`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.scanId).toBeDefined();
    });

    it('retrieves multi-axis history and "what changed" diff', async () => {
      const monitor = await Monitor.create({
        userId: user._id,
        hostname: 'history-site.com',
        targetUrl: 'https://history-site.com',
        frequency: 'weekly',
        nextScanAt: new Date()
      });

      await Scan.create({
        scanId: 'scan-h1',
        userId: user._id,
        url: 'https://history-site.com',
        score: 80,
        grade: 'B',
        report: { scores: { security: 80, performance: 85, accessibility: 90, seo: 80, aiSearch: 75 }, findings: [] }
      });

      await Scan.create({
        scanId: 'scan-h2',
        userId: user._id,
        url: 'https://history-site.com',
        score: 90,
        grade: 'A',
        report: { scores: { security: 90, performance: 90, accessibility: 95, seo: 85, aiSearch: 80 }, findings: [] }
      });

      const histRes = await request(app)
        .get(`/api/monitoring/${monitor._id}/history?timeRange=30d`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(histRes.status).toBe(200);
      expect(histRes.body.history.length).toBe(2);

      const changeRes = await request(app)
        .get(`/api/monitoring/${monitor._id}/changes`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.hasPreviousScan).toBe(true);
      expect(changeRes.body.diff.scoreDelta).toBe(10);
    });
  });

  describe('5. Scheduled Monitoring Dispatcher & Gating', () => {
    it('dispatches due monitors and advances nextScanAt', async () => {
      const pastDate = new Date(Date.now() - 10000);
      const monitor = await Monitor.create({
        userId: user._id,
        hostname: 'due-site.com',
        targetUrl: 'https://due-site.com',
        frequency: 'daily',
        enabled: true,
        nextScanAt: pastDate
      });

      const processedCount = await checkDueMonitors();
      expect(processedCount).toBeGreaterThanOrEqual(1);

      const updated = await Monitor.findById(monitor._id);
      expect(updated.lastScanAt).toBeDefined();
      expect(new Date(updated.nextScanAt).getTime()).toBeGreaterThan(Date.now());
    });
  });
});
