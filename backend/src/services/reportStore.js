const Scan = require('../models/Scan');

// Keep TTL configuration from existing process.env values (default 24h)
const REPORT_TTL_MS = Math.max(5 * 60 * 1000, parseInt(process.env.REPORT_TTL_MS || `${24 * 60 * 60 * 1000}`, 10));

// Unused placeholder to maintain interface signature compatibility with the rest of the backend
const REPORT_DIR = '';

/**
 * Saves a scan report to MongoDB.
 * If userId is provided, the report is saved permanently (expiresAt is null).
 * Otherwise, it will expire after REPORT_TTL_MS.
 * 
 * @param {string} scanId - Unique scan identifier
 * @param {object} report - Full scan report data
 * @param {string|mongoose.Types.ObjectId} [userId=null] - Authenticated user's DB ID
 */
async function saveReport(scanId, report, userId = null) {
  try {
    const expiresAt = userId ? null : new Date(Date.now() + REPORT_TTL_MS);
    const scannedUrl = report.scannedUrl || report.url || '';

    await Scan.findOneAndUpdate(
      { scanId },
      {
        scanId,
        userId,
        url: scannedUrl,
        score: report.score || 0,
        grade: report.grade || 'F',
        scanMode: report.scanMode || 'quick',
        report,
        expiresAt
      },
      { upsert: true, new: true }
    );
    console.log(`[reportStore] Report ${scanId} successfully saved to MongoDB (User: ${userId || 'Guest'}).`);
  } catch (error) {
    console.error(`[reportStore] Error saving report ${scanId}:`, error);
    throw error;
  }
}

/**
 * Retrieves a scan report from MongoDB.
 * 
 * @param {string} scanId - Unique scan identifier
 * @returns {object|null} The stored report object or null if not found
 */
async function getReport(scanId) {
  try {
    const scan = await Scan.findOne({ scanId });
    if (!scan) return null;

    // Optional safety check for manually enforcing expiration if MongoDB background task hasn't cleared it yet
    if (scan.expiresAt && new Date(scan.expiresAt) < new Date()) {
      await Scan.deleteOne({ scanId }).catch(() => {});
      return null;
    }

    return scan.report || null;
  } catch (error) {
    console.error(`[reportStore] Error fetching report ${scanId}:`, error);
    throw error;
  }
}

module.exports = { saveReport, getReport, REPORT_DIR, REPORT_TTL_MS };
