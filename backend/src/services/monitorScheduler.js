const crypto = require('crypto');
const Monitor = require('../models/Monitor');
const Domain = require('../models/Domain');
const { addScanJob } = require('./scanQueue');

let schedulerInterval = null;
const runningJobs = new Set();

/**
 * Evaluates all monitors and enqueues scans for any that are due.
 */
async function checkDueMonitors() {
  try {
    const now = new Date();
    // Find active monitors whose nextScanAt has arrived
    const dueMonitors = await Monitor.find({
      enabled: true,
      nextScanAt: { $lte: now }
    });

    if (dueMonitors.length === 0) return 0;

    console.log(`[monitorScheduler] Found ${dueMonitors.length} due scheduled monitor(s) to process.`);

    for (const monitor of dueMonitors) {
      const monitorIdStr = monitor._id.toString();
      if (runningJobs.has(monitorIdStr)) {
        continue; // Prevent duplicate concurrent execution of the same monitor
      }

      runningJobs.add(monitorIdStr);

      try {
        let effectiveScanMode = monitor.scanMode || 'quick';

        // Strict Domain Ownership Verification Gating
        // Active scans strictly require domain ownership verification
        if (effectiveScanMode === 'active' || effectiveScanMode === 'full') {
          const verifiedDomain = await Domain.findOne({
            userId: monitor.userId,
            hostname: monitor.hostname,
            verified: true
          });

          if (!verifiedDomain) {
            console.warn(`[monitorScheduler] Domain ${monitor.hostname} is not verified for user ${monitor.userId}. Downgrading scheduled scan to passive 'quick' mode.`);
            effectiveScanMode = 'quick';
          }
        }

        const scanId = crypto.randomUUID();

        const enqueued = await addScanJob({
          scanId,
          url: monitor.targetUrl,
          scanMode: effectiveScanMode,
          userId: monitor.userId.toString(),
          teamId: monitor.teamId ? monitor.teamId.toString() : null,
          monitorId: monitorIdStr,
          isScheduled: true,
          startTime: Date.now()
        });

        if (enqueued) {
          monitor.lastScanAt = now;
          monitor.lastScanId = scanId;
          monitor.nextScanAt = monitor.calculateNextRun(now);
          await monitor.save();
          console.log(`[monitorScheduler] Scheduled scan ${scanId} successfully enqueued for ${monitor.targetUrl}. Next run: ${monitor.nextScanAt.toISOString()}`);
        } else {
          console.warn(`[monitorScheduler] Failed to enqueue scan for monitor ${monitorIdStr}. Will retry next cycle.`);
        }
      } catch (itemErr) {
        console.error(`[monitorScheduler] Error processing monitor ${monitorIdStr}:`, itemErr);
      } finally {
        runningJobs.delete(monitorIdStr);
      }
    }

    return dueMonitors.length;
  } catch (err) {
    console.error('[monitorScheduler] Error checking due monitors:', err);
    return 0;
  }
}

/**
 * Starts the periodic background scheduler interval (checks every 60s).
 */
function startMonitorScheduler(intervalMs = 60000) {
  if (schedulerInterval) return;
  console.log('[monitorScheduler] Starting scheduled website monitoring dispatcher (interval: 60s)...');
  // Run once immediately on start
  checkDueMonitors();
  schedulerInterval = setInterval(checkDueMonitors, intervalMs);
}

/**
 * Stops the scheduler interval (useful for clean test teardowns).
 */
function stopMonitorScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

module.exports = {
  checkDueMonitors,
  startMonitorScheduler,
  stopMonitorScheduler
};
