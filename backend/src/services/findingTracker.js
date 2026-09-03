const crypto = require('crypto');
const reportGenerator = require('./reportGenerator');

/**
 * Generates a stable deterministic fingerprint for a finding.
 * Same issue across multiple scans produces the exact same fingerprint.
 */
function generateFindingFingerprint(finding) {
  const normCategory = (finding.category || '').toLowerCase().trim();
  const normId = (finding.id || '').toLowerCase().trim();
  const normTitle = (finding.title || '').toLowerCase().trim();
  const normOwasp = (typeof finding.owasp === 'string' ? finding.owasp : Array.isArray(finding.owasp) ? finding.owasp.join(',') : '').toLowerCase().trim();

  const raw = `${normCategory}:${normId}:${normTitle}:${normOwasp}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/**
 * Computes deep change intelligence diff between a base scan (previous) and target scan (current).
 */
function computeScanDiff(baseScan, targetScan) {
  if (!baseScan && !targetScan) {
    return {
      scoreDelta: 0,
      categoryDeltas: {},
      new: [],
      resolved: [],
      persistent: [],
      changed: [],
      techChanges: { added: [], removed: [] },
      pageChanges: { added: [], removed: [] }
    };
  }

  if (!baseScan) {
    const targetFindings = (targetScan?.report?.findings || targetScan?.findings || []).map(f => ({
      ...f,
      fingerprint: f.fingerprint || generateFindingFingerprint(f)
    }));
    return {
      scoreDelta: targetScan?.score || 0,
      categoryDeltas: {
        overall: targetScan?.score || 0,
        security: targetScan?.report?.scores?.security ?? targetScan?.securityScore ?? 0,
        performance: targetScan?.report?.scores?.performance ?? 0,
        accessibility: targetScan?.report?.scores?.accessibility ?? 0,
        seo: targetScan?.report?.scores?.seo ?? 0,
        aiSearch: targetScan?.report?.scores?.aiSearch ?? 0
      },
      new: targetFindings,
      resolved: [],
      persistent: [],
      changed: [],
      techChanges: { added: targetScan?.report?.techStack ? Object.values(targetScan.report.techStack).flat() : [], removed: [] },
      pageChanges: { added: targetScan?.report?.crawledPages || [], removed: [] }
    };
  }

  const baseFindings = (baseScan.report?.findings || baseScan.findings || []).map(f => ({
    ...f,
    fingerprint: f.fingerprint || generateFindingFingerprint(f)
  }));
  const targetFindings = (targetScan.report?.findings || targetScan.findings || []).map(f => ({
    ...f,
    fingerprint: f.fingerprint || generateFindingFingerprint(f)
  }));

  const baseMap = new Map(baseFindings.map(f => [f.fingerprint, f]));
  const targetMap = new Map(targetFindings.map(f => [f.fingerprint, f]));

  const newFindings = [];
  const resolved = [];
  const persistent = [];
  const changed = [];

  // Determine capabilities of target scan
  const targetHasZap = !!(targetScan.report?.zapScanData?.scanned);
  const targetHasActive = targetScan.scanMode === 'full' || targetScan.scanMode === 'active';

  // Check for persistent and resolved
  baseFindings.forEach(bf => {
    if (targetMap.has(bf.fingerprint)) {
      const tf = targetMap.get(bf.fingerprint);
      const isSeverityChanged = (bf.severity || '').toLowerCase() !== (tf.severity || '').toLowerCase();
      const isDescChanged = bf.description !== tf.description;

      const item = {
        fingerprint: bf.fingerprint,
        title: tf.title || bf.title,
        severity: tf.severity || bf.severity,
        previousSeverity: bf.severity,
        category: tf.category || bf.category,
        description: tf.description,
        remediation: tf.remediation,
        owasp: tf.owasp
      };

      if (isSeverityChanged || isDescChanged) {
        changed.push({ ...item, changedFields: { severity: isSeverityChanged, description: isDescChanged } });
      } else {
        persistent.push(item);
      }
    } else {
      // Finding in base but absent in target -> Check if test capability tested it
      const normalized = reportGenerator.normalizeFinding(bf);
      const isZapFinding = normalized.source === 'owasp-zap';
      const isActiveFinding = normalized.source === 'active-probe';

      let wasTested = true;
      if (isZapFinding && !targetHasZap) wasTested = false;
      if (isActiveFinding && !targetHasActive) wasTested = false;

      if (wasTested) {
        resolved.push({
          fingerprint: bf.fingerprint,
          title: bf.title,
          severity: bf.severity,
          category: bf.category,
          description: bf.description,
          remediation: bf.remediation,
          owasp: bf.owasp
        });
      }
    }
  });

  // Check for new findings in target
  targetFindings.forEach(tf => {
    if (!baseMap.has(tf.fingerprint)) {
      newFindings.push({
        fingerprint: tf.fingerprint,
        title: tf.title,
        severity: tf.severity,
        category: tf.category,
        description: tf.description,
        remediation: tf.remediation,
        owasp: tf.owasp
      });
    }
  });

  // Calculate score deltas across all 6 dimensions
  const baseScores = baseScan.report?.scores || {
    overall: baseScan.score || 0,
    security: baseScan.securityScore ?? baseScan.score ?? 0,
    performance: 0,
    accessibility: 0,
    seo: 0,
    aiSearch: 0
  };

  const targetScores = targetScan.report?.scores || {
    overall: targetScan.score || 0,
    security: targetScan.securityScore ?? targetScan.score ?? 0,
    performance: 0,
    accessibility: 0,
    seo: 0,
    aiSearch: 0
  };

  const categoryDeltas = {
    overall: (targetScan.score || 0) - (baseScan.score || 0),
    security: (targetScores.security ?? 0) - (baseScores.security ?? 0),
    performance: (targetScores.performance ?? 0) - (baseScores.performance ?? 0),
    accessibility: (targetScores.accessibility ?? 0) - (baseScores.accessibility ?? 0),
    seo: (targetScores.seo ?? 0) - (baseScores.seo ?? 0),
    aiSearch: (targetScores.aiSearch ?? 0) - (baseScores.aiSearch ?? 0)
  };

  // Tech stack change detection
  const baseTechList = baseScan.report?.techStack ? Object.values(baseScan.report.techStack).flat() : [];
  const targetTechList = targetScan.report?.techStack ? Object.values(targetScan.report.techStack).flat() : [];

  const addedTech = targetTechList.filter(t => !baseTechList.includes(t));
  const removedTech = baseTechList.filter(t => !targetTechList.includes(t));

  // Crawled pages change detection
  const basePages = baseScan.report?.crawledPages || [];
  const targetPages = targetScan.report?.crawledPages || [];
  const addedPages = targetPages.filter(p => !basePages.includes(p));
  const removedPages = basePages.filter(p => !targetPages.includes(p));

  return {
    scoreDelta: categoryDeltas.overall,
    categoryDeltas,
    new: newFindings,
    resolved,
    persistent,
    changed,
    techChanges: { added: addedTech, removed: removedTech },
    pageChanges: { added: addedPages, removed: removedPages }
  };
}

/**
 * Authoritative Finding Lifecycle Engine:
 * Injects deterministic fingerprints into scan findings and manages finding statuses.
 * If a finding was previously marked 'resolved' or 'ignored' by the user, but the scanner
 * detects it again in this scan, automatically reopen it with updated detection metadata.
 */
function applyFindingLifecycle(currentScan, previousScan) {
  if (!currentScan || !currentScan.report) return;

  const currentFindings = (currentScan.report.findings || []).map(finding => {
    const fp = finding.fingerprint || generateFindingFingerprint(finding);
    return {
      ...finding,
      fingerprint: fp
    };
  });

  currentScan.report.findings = currentFindings;

  // Initialize or load findingStatuses map
  const findingStatuses = currentScan.findingStatuses instanceof Map
    ? currentScan.findingStatuses
    : new Map(Object.entries(currentScan.findingStatuses || {}));

  const previousStatuses = previousScan?.findingStatuses instanceof Map
    ? previousScan.findingStatuses
    : new Map(Object.entries(previousScan?.findingStatuses || {}));

  const now = new Date();

  currentFindings.forEach(finding => {
    const fp = finding.fingerprint;
    const prevStatusObj = previousStatuses.get(fp) || previousStatuses.get(finding.id);

    if (prevStatusObj) {
      const prevStatus = prevStatusObj.status;
      const prevCount = prevStatusObj.detectionCount || 1;
      const firstDetected = prevStatusObj.firstDetectedAt || previousScan.createdAt || now;

      // Authoritative scanner rule: If user marked resolved/ignored, but scanner found it again -> Reopen!
      if (prevStatus === 'resolved' || prevStatus === 'ignored') {
        findingStatuses.set(fp, {
          status: 'open',
          reopened: true,
          reopenedAt: now,
          firstDetectedAt: firstDetected,
          lastDetectedAt: now,
          detectionCount: prevCount + 1,
          previousUserStatus: prevStatus,
          note: `Scanner detected active vulnerability. Auto-reopened from '${prevStatus}'.`,
          updatedAt: now
        });
      } else {
        // Carry forward open/in_progress/accepted status and increment detection
        findingStatuses.set(fp, {
          status: prevStatus || 'open',
          reopened: false,
          firstDetectedAt: firstDetected,
          lastDetectedAt: now,
          detectionCount: prevCount + 1,
          note: prevStatusObj.note || '',
          updatedAt: prevStatusObj.updatedAt || now
        });
      }
    } else {
      // First detection
      findingStatuses.set(fp, {
        status: 'open',
        reopened: false,
        firstDetectedAt: now,
        lastDetectedAt: now,
        detectionCount: 1,
        note: '',
        updatedAt: now
      });
    }
  });

  currentScan.findingStatuses = findingStatuses;
}

module.exports = {
  generateFindingFingerprint,
  computeScanDiff,
  applyFindingLifecycle
};
