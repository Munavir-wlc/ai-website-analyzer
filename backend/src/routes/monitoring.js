const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Monitor = require('../models/Monitor');
const Domain = require('../models/Domain');
const Scan = require('../models/Scan');
const { protect } = require('../middleware/auth');
const { addScanJob } = require('../services/scanQueue');
const { computeScanDiff } = require('../services/findingTracker');
const { generateStructuredRemediation } = require('../services/aiEngine');
const ssrfGuard = require('../utils/ssrfGuard');

// Helper to normalize hostname
function normalizeHostname(raw) {
  if (!raw) return '';
  try {
    const withProto = raw.startsWith('http') ? raw : `https://${raw}`;
    return new URL(withProto).hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return raw.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

// GET /api/monitoring - List all monitors for user/workspace
router.get('/', protect, async (req, res) => {
  try {
    const { teamId } = req.query;
    const query = { userId: req.user._id };
    if (teamId && teamId !== 'personal') {
      query.teamId = teamId;
    }

    const monitors = await Monitor.find(query).sort({ createdAt: -1 }).lean();

    // Attach latest scan details and verification status
    const enhanced = await Promise.all(monitors.map(async (m) => {
      let latestScan = null;
      if (m.lastScanId) {
        latestScan = await Scan.findOne({ scanId: m.lastScanId }).select('score grade report.scores createdAt scanId').lean();
      } else {
        // Fallback: search latest scan for this URL/hostname
        latestScan = await Scan.findOne({ 
          userId: req.user._id,
          url: m.targetUrl 
        }).sort({ createdAt: -1 }).select('score grade report.scores createdAt scanId').lean();
      }

      const verifiedDomain = await Domain.findOne({
        userId: req.user._id,
        hostname: m.hostname,
        verified: true
      }).lean();

      return {
        ...m,
        isVerified: !!verifiedDomain,
        latestScore: latestScan?.score ?? null,
        latestGrade: latestScan?.grade ?? null,
        latestScanDate: latestScan?.createdAt ?? m.lastScanAt ?? null,
        scores: latestScan?.report?.scores || null
      };
    }));

    res.json(enhanced);
  } catch (err) {
    console.error('[monitoringRoutes] GET / error:', err);
    res.status(500).json({ error: 'Failed to retrieve monitors.' });
  }
});

// POST /api/monitoring - Create a new continuous monitor
router.post('/', protect, async (req, res) => {
  try {
    const { targetUrl, scanMode = 'quick', frequency = 'weekly', timezone = 'UTC', notificationPreferences = {}, teamId = null } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'targetUrl is required.' });
    }

    const normalizedUrl = targetUrl.startsWith('http://') || targetUrl.startsWith('https://')
      ? targetUrl.trim()
      : `https://${targetUrl.trim()}`;

    // SSRF validation
    const isSafe = await ssrfGuard.isSafeUrl(normalizedUrl);
    if (!isSafe) {
      return res.status(400).json({ error: 'Target URL fails security policy or resolves to an internal/private network.' });
    }

    const hostname = normalizeHostname(normalizedUrl);
    if (!hostname) {
      return res.status(400).json({ error: 'Invalid hostname extracted from URL.' });
    }

    // Strict Domain Ownership Verification Gating
    // Active scheduled scan modes strictly require domain ownership verification
    if (scanMode === 'active' || scanMode === 'full') {
      const verifiedDomain = await Domain.findOne({
        userId: req.user._id,
        hostname,
        verified: true
      });

      if (!verifiedDomain && scanMode === 'active') {
        return res.status(403).json({
          error: `Domain ownership verification required. Active invasive monitoring on ${hostname} is locked until ownership is verified.`
        });
      }
    }

    // Check if monitor for same URL/hostname already exists
    const existing = await Monitor.findOne({
      userId: req.user._id,
      targetUrl: normalizedUrl
    });

    if (existing) {
      return res.status(409).json({ error: `A monitor for ${normalizedUrl} already exists.` });
    }

    // Calculate initial nextScanAt (defaults to run in next minute for quick feedback)
    const monitor = new Monitor({
      userId: req.user._id,
      teamId: teamId === 'personal' ? null : teamId,
      hostname,
      targetUrl: normalizedUrl,
      scanMode,
      frequency,
      timezone,
      enabled: true,
      nextScanAt: new Date(Date.now() + 5000), // Next run in 5s
      notificationPreferences: {
        email: notificationPreferences.email !== false,
        onCritical: notificationPreferences.onCritical !== false,
        onHigh: notificationPreferences.onHigh !== false,
        onScoreDrop: notificationPreferences.onScoreDrop !== false,
        scoreDropThreshold: notificationPreferences.scoreDropThreshold || 5,
        onResolved: notificationPreferences.onResolved !== false,
        onFailure: notificationPreferences.onFailure !== false,
        recipients: notificationPreferences.recipients || []
      }
    });

    await monitor.save();

    res.status(201).json(monitor);
  } catch (err) {
    console.error('[monitoringRoutes] POST / error:', err);
    res.status(500).json({ error: 'Failed to create monitor.' });
  }
});

// GET /api/monitoring/:id - Get specific monitor details
router.get('/:id', protect, async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).lean();

    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found.' });
    }

    const verifiedDomain = await Domain.findOne({
      userId: req.user._id,
      hostname: monitor.hostname,
      verified: true
    }).lean();

    res.json({
      ...monitor,
      isVerified: !!verifiedDomain
    });
  } catch (err) {
    console.error('[monitoringRoutes] GET /:id error:', err);
    res.status(500).json({ error: 'Failed to retrieve monitor.' });
  }
});

// PATCH /api/monitoring/:id - Update monitor configuration
router.patch('/:id', protect, async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found.' });
    }

    const { scanMode, frequency, enabled, notificationPreferences } = req.body;

    if (scanMode) {
      if (scanMode === 'active') {
        const verifiedDomain = await Domain.findOne({
          userId: req.user._id,
          hostname: monitor.hostname,
          verified: true
        });
        if (!verifiedDomain) {
          return res.status(403).json({
            error: `Domain ownership verification required. Active invasive monitoring on ${monitor.hostname} requires verified ownership.`
          });
        }
      }
      monitor.scanMode = scanMode;
    }

    if (frequency) {
      monitor.frequency = frequency;
      monitor.nextScanAt = monitor.calculateNextRun(monitor.lastScanAt || new Date());
    }

    if (typeof enabled === 'boolean') {
      monitor.enabled = enabled;
    }

    if (notificationPreferences) {
      monitor.notificationPreferences = {
        ...monitor.notificationPreferences.toObject(),
        ...notificationPreferences
      };
    }

    await monitor.save();
    res.json(monitor);
  } catch (err) {
    console.error('[monitoringRoutes] PATCH /:id error:', err);
    res.status(500).json({ error: 'Failed to update monitor.' });
  }
});

// DELETE /api/monitoring/:id - Delete a monitor
router.delete('/:id', protect, async (req, res) => {
  try {
    const monitor = await Monitor.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found.' });
    }

    res.json({ message: 'Monitor successfully deleted.', id: req.params.id });
  } catch (err) {
    console.error('[monitoringRoutes] DELETE /:id error:', err);
    res.status(500).json({ error: 'Failed to delete monitor.' });
  }
});

// POST /api/monitoring/:id/run - Trigger on-demand immediate scan for this monitor
router.post('/:id/run', protect, async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found.' });
    }

    let effectiveScanMode = monitor.scanMode || 'quick';
    if (effectiveScanMode === 'active' || effectiveScanMode === 'full') {
      const verifiedDomain = await Domain.findOne({
        userId: req.user._id,
        hostname: monitor.hostname,
        verified: true
      });
      if (!verifiedDomain) {
        effectiveScanMode = 'quick';
      }
    }

    const scanId = crypto.randomUUID();

    const enqueued = await addScanJob({
      scanId,
      url: monitor.targetUrl,
      scanMode: effectiveScanMode,
      userId: req.user._id.toString(),
      teamId: monitor.teamId ? monitor.teamId.toString() : null,
      monitorId: monitor._id.toString(),
      isScheduled: false,
      startTime: Date.now()
    });

    if (!enqueued) {
      return res.status(503).json({ error: 'Scan worker queue is currently full. Please try again in a moment.' });
    }

    monitor.lastScanAt = new Date();
    monitor.lastScanId = scanId;
    monitor.nextScanAt = monitor.calculateNextRun(new Date());
    await monitor.save();

    res.json({
      message: 'On-demand monitoring scan started successfully.',
      scanId,
      targetUrl: monitor.targetUrl,
      scanMode: effectiveScanMode
    });
  } catch (err) {
    console.error('[monitoringRoutes] POST /:id/run error:', err);
    res.status(500).json({ error: 'Failed to trigger on-demand scan.' });
  }
});

// GET /api/monitoring/:id/history - Multi-dimensional score and finding trends over time
router.get('/:id/history', protect, async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found.' });
    }

    const { timeRange = '30d' } = req.query;
    const now = new Date();
    let startDate = new Date();

    if (timeRange === '7d') startDate.setDate(now.getDate() - 7);
    else if (timeRange === '30d') startDate.setDate(now.getDate() - 30);
    else if (timeRange === '90d') startDate.setDate(now.getDate() - 90);
    else if (timeRange === '1y') startDate.setFullYear(now.getFullYear() - 1);
    else startDate = new Date(0); // 'all'

    const scans = await Scan.find({
      userId: req.user._id,
      url: monitor.targetUrl,
      createdAt: { $gte: startDate }
    }).sort({ createdAt: 1 }).select('scanId score grade report.scores report.findings createdAt scanMode').lean();

    const history = scans.map(s => {
      const scores = s.report?.scores || {};
      const findings = s.report?.findings || [];
      const criticalCount = findings.filter(f => (f.severity || '').toLowerCase() === 'critical').length;
      const highCount = findings.filter(f => (f.severity || '').toLowerCase() === 'high').length;
      const mediumCount = findings.filter(f => (f.severity || '').toLowerCase() === 'medium').length;
      const lowCount = findings.filter(f => (f.severity || '').toLowerCase() === 'low').length;

      return {
        scanId: s.scanId,
        date: s.createdAt,
        overallScore: s.score ?? 0,
        grade: s.grade || 'C',
        securityScore: scores.security ?? s.score ?? 0,
        performanceScore: scores.performance ?? 0,
        accessibilityScore: scores.accessibility ?? 0,
        seoScore: scores.seo ?? 0,
        aiSearchScore: scores.aiSearch ?? 0,
        totalFindings: findings.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount
      };
    });

    res.json({
      monitor: {
        id: monitor._id,
        hostname: monitor.hostname,
        targetUrl: monitor.targetUrl,
        frequency: monitor.frequency,
        nextScanAt: monitor.nextScanAt
      },
      timeRange,
      dataPointsCount: history.length,
      history
    });
  } catch (err) {
    console.error('[monitoringRoutes] GET /:id/history error:', err);
    res.status(500).json({ error: 'Failed to retrieve monitoring history.' });
  }
});

// GET /api/monitoring/:id/changes - "What Changed?" comparison between latest 2 scans
router.get('/:id/changes', protect, async (req, res) => {
  try {
    const monitor = await Monitor.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!monitor) {
      return res.status(404).json({ error: 'Monitor not found.' });
    }

    // Find the latest 2 scans for this monitor/targetUrl
    const latestScans = await Scan.find({
      userId: req.user._id,
      url: monitor.targetUrl
    }).sort({ createdAt: -1 }).limit(2);

    if (latestScans.length === 0) {
      return res.json({
        hasPreviousScan: false,
        message: 'No scans available yet for this monitored target.'
      });
    }

    const currentScan = latestScans[0];
    const previousScan = latestScans.length > 1 ? latestScans[1] : null;

    const diff = computeScanDiff(previousScan, currentScan);

    res.json({
      hasPreviousScan: !!previousScan,
      currentScan: {
        scanId: currentScan.scanId,
        date: currentScan.createdAt,
        score: currentScan.score ?? 0,
        grade: currentScan.grade || 'C',
        scores: currentScan.report?.scores || {}
      },
      previousScan: previousScan ? {
        scanId: previousScan.scanId,
        date: previousScan.createdAt,
        score: previousScan.score ?? 0,
        grade: previousScan.grade || 'C',
        scores: previousScan.report?.scores || {}
      } : null,
      diff
    });
  } catch (err) {
    console.error('[monitoringRoutes] GET /:id/changes error:', err);
    res.status(500).json({ error: 'Failed to generate change intelligence diff.' });
  }
});

// POST /api/monitoring/findings/remediation - Generate structured tech-tailored AI remediation
router.post('/findings/remediation', protect, async (req, res) => {
  try {
    const { finding, techStack } = req.body;
    if (!finding) {
      return res.status(400).json({ error: 'Finding payload is required.' });
    }

    const remediation = await generateStructuredRemediation(finding, techStack);
    res.json(remediation);
  } catch (err) {
    console.error('[monitoringRoutes] POST /findings/remediation error:', err);
    res.status(500).json({ error: 'Failed to generate AI remediation guide.' });
  }
});

module.exports = router;
