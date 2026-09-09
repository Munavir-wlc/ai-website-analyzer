const { computeScanDiff } = require('./findingTracker');
const { sendMonitoringAlertEmail } = require('./emailService');
const User = require('../models/User');

// In-memory alert cooldown tracker: monitorId -> { lastAlertAt, alertedFingerprints: Set }
const alertCooldownMap = new Map();
const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours minimum cooldown for identical alert triggers

/**
 * Evaluates scan change diff against monitor notification preferences and sends deduplicated alerts.
 */
async function processScanAlerts(currentScan, previousScan, monitor) {
  if (!currentScan) return { alerted: false, reason: 'No scan data' };

  try {
    const diff = computeScanDiff(previousScan, currentScan);
    const currentScore = currentScan.score ?? 0;
    const previousScore = previousScan?.score ?? currentScore;
    const scoreDelta = diff.scoreDelta;

    const prefs = monitor?.notificationPreferences || {
      email: true,
      onCritical: true,
      onHigh: true,
      onScoreDrop: true,
      scoreDropThreshold: 5,
      onResolved: true,
      onFailure: true
    };

    if (!prefs.email) {
      return { alerted: false, reason: 'Email notifications disabled for this monitor' };
    }

    // Determine alert triggers
    const criticalNew = diff.new.filter(f => (f.severity || '').toLowerCase() === 'critical');
    const highNew = diff.new.filter(f => (f.severity || '').toLowerCase() === 'high');
    const isMajorScoreDrop = prefs.onScoreDrop && (scoreDelta <= -Math.abs(prefs.scoreDropThreshold || 5));
    const hasCritical = prefs.onCritical && criticalNew.length > 0;
    const hasHigh = prefs.onHigh && highNew.length > 0;
    const hasResolved = prefs.onResolved && diff.resolved.length > 0;

    // Check if any trigger fired
    if (!hasCritical && !hasHigh && !isMajorScoreDrop && !hasResolved) {
      return { alerted: false, reason: 'No configured alert conditions met' };
    }

    // Deduplication check
    const monitorKey = monitor?._id ? monitor._id.toString() : currentScan.domain || currentScan.url;
    const now = Date.now();
    const cooldownEntry = alertCooldownMap.get(monitorKey) || { lastAlertAt: 0, alertedFingerprints: new Set() };

    const newFingerprints = diff.new.map(f => f.fingerprint);
    const hasUnalertedFindings = newFingerprints.some(fp => !cooldownEntry.alertedFingerprints.has(fp));

    // If only persistent or identical findings triggered, and cooldown hasn't expired, skip to avoid spam
    if (!hasUnalertedFindings && !isMajorScoreDrop && (now - cooldownEntry.lastAlertAt < COOLDOWN_MS)) {
      return { alerted: false, reason: 'Suppressed by alert deduplication cooldown' };
    }

    // Build trigger reason string
    const reasons = [];
    if (hasCritical) reasons.push(`${criticalNew.length} Critical Vulnerability Detected`);
    if (hasHigh) reasons.push(`${highNew.length} High Severity Issue(s) Detected`);
    if (isMajorScoreDrop) reasons.push(`Score dropped by ${Math.abs(scoreDelta)} points (${previousScore} ➔ ${currentScore})`);
    if (hasResolved) reasons.push(`${diff.resolved.length} Finding(s) Resolved`);
    const alertReason = reasons.join(' • ');

    // Find recipient emails
    let recipients = [];
    if (monitor?.userId) {
      const user = await User.findById(monitor.userId);
      if (user && user.email) recipients.push(user.email);
    } else if (currentScan.userId) {
      const user = await User.findById(currentScan.userId);
      if (user && user.email) recipients.push(user.email);
    }

    if (prefs.recipients && Array.isArray(prefs.recipients)) {
      recipients.push(...prefs.recipients);
    }

    recipients = Array.from(new Set(recipients.filter(Boolean)));
    if (recipients.length === 0) {
      return { alerted: false, reason: 'No recipient email found' };
    }

    const domain = currentScan.domain || monitor?.hostname || new URL(currentScan.url.startsWith('http') ? currentScan.url : `https://${currentScan.url}`).hostname;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const reportUrl = `${frontendUrl}/results?scanId=${currentScan.scanId}`;

    // Send emails
    for (const toEmail of recipients) {
      await sendMonitoringAlertEmail({
        toEmail,
        targetUrl: currentScan.url,
        domain,
        currentScore,
        previousScore,
        scoreDelta,
        newFindings: diff.new,
        resolvedFindings: diff.resolved,
        alertReason,
        reportUrl
      });
    }

    // Update cooldown state
    newFingerprints.forEach(fp => cooldownEntry.alertedFingerprints.add(fp));
    cooldownEntry.lastAlertAt = now;
    alertCooldownMap.set(monitorKey, cooldownEntry);

    return {
      alerted: true,
      recipients,
      alertReason,
      diffSummary: {
        newCount: diff.new.length,
        resolvedCount: diff.resolved.length,
        scoreDelta
      }
    };
  } catch (err) {
    console.error('[alertService] Error processing scan alerts:', err);
    return { alerted: false, error: err.message };
  }
}

module.exports = {
  processScanAlerts
};
