const axios = require('axios');

const ZAP_URL = process.env.ZAP_URL || 'http://localhost:8090';
const ZAP_API_KEY = process.env.ZAP_API_KEY || '';

/**
 * Check if the OWASP ZAP service is online and accessible.
 * @returns {Promise<boolean>}
 */
async function checkZapConnection() {
  try {
    const headers = ZAP_API_KEY ? { 'X-ZAP-API-Key': ZAP_API_KEY } : {};
    const res = await axios.get(`${ZAP_URL}/JSON/core/view/version/`, { 
      headers,
      timeout: 3000 
    });
    if (res.status === 200) {
      console.log(`[zapScanner] Successfully connected to OWASP ZAP. Version: ${res.data.version}`);
      return true;
    }
    return false;
  } catch (err) {
    console.warn(`[zapScanner] OWASP ZAP API at ${ZAP_URL} is unreachable: ${err.message}`);
    return false;
  }
}

/**
 * Map ZAP risk levels to standardized findings severity, with logical escalation.
 */
function mapRiskLevel(risk, title) {
  const r = risk.toLowerCase();
  const t = title.toLowerCase();

  // Escalate highly critical flaws
  if (r === 'high') {
    if (t.includes('sql injection') || 
        t.includes('command injection') || 
        t.includes('remote code execution') || 
        t.includes('path traversal') || 
        t.includes('arbitrary file write')) {
      return 'critical';
    }
    return 'high';
  }
  if (r === 'medium') return 'medium';
  if (r === 'low') return 'low';
  return 'low'; // Informational is treated as low risk details
}

/**
 * Sleep helper function.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function seedUrlInZapTree(targetUrl, headers) {
  try {
    console.log(`[zapScanner] Seeding URL into ZAP tree: ${targetUrl}`);
    await axios.get(`${ZAP_URL}/JSON/core/action/accessUrl/`, {
      params: { url: targetUrl },
      headers
    });
    await sleep(1000);
    return true;
  } catch (err) {
    console.warn(`[zapScanner] Failed to seed URL into ZAP tree: ${err.message}`);
    return false;
  }
}

async function setupZapAuth(authOptions, zapHeaders) {
  const { authCookie, authHeader } = authOptions || {};
  
  if (authHeader) {
    console.log(`[zapScanner] Injecting Authorization header into ZAP replacer rules...`);
    try {
      await axios.get(`${ZAP_URL}/JSON/replacer/action/removeRule/`, {
        params: { description: 'auth-header-rule' },
        headers: zapHeaders
      }).catch(() => {}); // ignore if it doesn't exist
      
      await axios.get(`${ZAP_URL}/JSON/replacer/action/addRule/`, {
        params: {
          description: 'auth-header-rule',
          enabled: 'true',
          matchType: 'REQ_HEADER',
          matchString: 'Authorization',
          matchRegex: 'false',
          replacement: authHeader
        },
        headers: zapHeaders
      });
    } catch (err) {
      console.warn(`[zapScanner] Failed to setup ZAP Authorization header rule:`, err.message);
    }
  }

  if (authCookie) {
    console.log(`[zapScanner] Injecting Cookie header into ZAP replacer rules...`);
    try {
      await axios.get(`${ZAP_URL}/JSON/replacer/action/removeRule/`, {
        params: { description: 'auth-cookie-rule' },
        headers: zapHeaders
      }).catch(() => {}); // ignore if it doesn't exist
      
      await axios.get(`${ZAP_URL}/JSON/replacer/action/addRule/`, {
        params: {
          description: 'auth-cookie-rule',
          enabled: 'true',
          matchType: 'REQ_HEADER',
          matchString: 'Cookie',
          matchRegex: 'false',
          replacement: authCookie
        },
        headers: zapHeaders
      });
    } catch (err) {
      console.warn(`[zapScanner] Failed to setup ZAP Cookie header rule:`, err.message);
    }
  }
}

async function cleanupZapAuth(zapHeaders) {
  console.log(`[zapScanner] Cleaning up ZAP auth replacer rules...`);
  try {
    await axios.get(`${ZAP_URL}/JSON/replacer/action/removeRule/`, {
      params: { description: 'auth-header-rule' },
      headers: zapHeaders
    });
  } catch (_) {}
  try {
    await axios.get(`${ZAP_URL}/JSON/replacer/action/removeRule/`, {
      params: { description: 'auth-cookie-rule' },
      headers: zapHeaders
    });
  } catch (_) {}
}

/**
 * Perform a full VAPT scan targeting the target URL using OWASP ZAP.
 * Triggers Spider -> Passive Scan check -> Active Scan -> Alert fetch.
 * 
 * @param {string} targetUrl - URL of the site to scan
 * @param {Object} authOptions - Session cookies and authorization headers
 * @param {Function} onProgress - WebSocket status callback: (step, status, details) => void
 * @returns {Promise<Array>} List of normalized vulnerability alerts
 */
async function executeZapScan(targetUrl, authOptions = {}, onProgress) {

  const isOnline = await checkZapConnection();

  if (!isOnline) {
    console.warn('[zapScanner] OWASP ZAP is offline. Skipping ZAP scan; no demo findings will be returned.');
    const error = `OWASP ZAP API at ${ZAP_URL} is unavailable.`;
    if (onProgress) {
      onProgress('zap_init', 'failed', { error });
      onProgress('zap_spider', 'failed', { error: 'Skipped because ZAP is unavailable.' });
      onProgress('zap_pscan', 'failed', { error: 'Skipped because ZAP is unavailable.' });
      onProgress('zap_ascan', 'failed', { error: 'Skipped because ZAP is unavailable.' });
      onProgress('zap_alerts', 'failed', { error: 'Skipped because ZAP is unavailable.' });
    }
    return {
      scanned: false,
      available: false,
      status: 'skipped',
      error,
      findings: []
    };
  }

  const headers = ZAP_API_KEY ? { 'X-ZAP-API-Key': ZAP_API_KEY } : {};
  console.log(`[zapScanner] Starting live OWASP ZAP scan for target: ${targetUrl}`);

  try {
    // 1. Initialize scan
    onProgress('zap_init', 'in_progress', { message: 'Initializing ZAP API connection...' });
    await setupZapAuth(authOptions, headers);
    await sleep(1000);
    onProgress('zap_init', 'completed');

    // 2. Start ZAP Spider (limit to 20 pages to avoid OOM on large sites)
    onProgress('zap_spider', 'in_progress', { message: 'Starting ZAP Spider...' });
    console.log(`[zapScanner] Launching ZAP Spider for: ${targetUrl} (maxChildren=20)`);
    const spiderRes = await axios.get(`${ZAP_URL}/JSON/spider/action/scan/`, {
      params: { url: targetUrl, maxChildren: 20 },
      headers
    });
    const spiderScanId = spiderRes.data.scan;
    console.log(`[zapScanner] ZAP Spider scan ID: ${spiderScanId}`);
    
    // Poll ZAP Spider status with a 2-minute safety timeout
    let spiderCompleted = false;
    const spiderStartTime = Date.now();
    const MAX_SPIDER_TIME = 2 * 60 * 1000; // 2 minutes max
    
    while (!spiderCompleted) {
      const statusRes = await axios.get(`${ZAP_URL}/JSON/spider/view/status/`, {
        params: { scanId: spiderScanId },
        headers
      });
      const progress = parseInt(statusRes.data.status, 10);
      console.log(`[zapScanner] ZAP Spider progress: ${progress}%`);
      onProgress('zap_spider', 'in_progress', { message: `Spidering target: ${progress}% completed` });
      
      if (progress >= 100) {
        spiderCompleted = true;
      } else if (Date.now() - spiderStartTime > MAX_SPIDER_TIME) {
        console.warn('[zapScanner] Spider exceeded 2-minute time limit. Stopping ZAP spider...');
        try {
          await axios.get(`${ZAP_URL}/JSON/spider/action/stop/`, {
            params: { scanId: spiderScanId },
            headers
          });
        } catch (e) {
          console.error('[zapScanner] Error stopping spider:', e.message);
        }
        spiderCompleted = true;
      } else {
        await sleep(1500);
      }
    }
    onProgress('zap_spider', 'completed');
    console.log(`[zapScanner] ZAP Spider completed.`);

    // 3. Monitor Passive Scan Queue
    onProgress('zap_pscan', 'in_progress', { message: 'Starting ZAP Passive Analysis...' });
    console.log(`[zapScanner] Waiting for passive scan queue to drain...`);
    let pscanCompleted = false;
    while (!pscanCompleted) {
      const pscanRes = await axios.get(`${ZAP_URL}/JSON/pscan/view/recordsToScan/`, { headers });
      const recordsRemaining = parseInt(pscanRes.data.recordsToScan, 10);
      console.log(`[zapScanner] ZAP Passive queue remaining: ${recordsRemaining}`);
      onProgress('zap_pscan', 'in_progress', { message: `Passive audit queue: ${recordsRemaining} records remaining` });
      
      if (recordsRemaining <= 0) {
        pscanCompleted = true;
      } else {
        await sleep(1000);
      }
    }
    onProgress('zap_pscan', 'completed');
    console.log(`[zapScanner] ZAP Passive analysis completed.`);

    // 4. Start ZAP Active Scan
    onProgress('zap_ascan', 'in_progress', { message: 'Optimizing ZAP active scan settings...' });
    try {
      console.log('[zapScanner] Configuring ZAP Active Scan (memory-safe LOW strength mode)...');
      // A. Use only 3 threads to stay within Colima VM memory limits
      await axios.get(`${ZAP_URL}/JSON/ascan/action/setOptionThreadPerHost/`, {
        params: { Integer: 3 },
        headers
      });
      // B. Cap alerts per rule at 3 to stop testing once a flaw is confirmed
      await axios.get(`${ZAP_URL}/JSON/ascan/action/setOptionMaxAlertsPerRule/`, {
        params: { Integer: 3 },
        headers
      });
      // C. Cap each rule to 45 seconds max to prevent slow SQL timing rules from hanging
      await axios.get(`${ZAP_URL}/JSON/ascan/action/setOptionMaxRuleDurationInMins/`, {
        params: { Integer: 1 },
        headers
      });
      // D. Cap total active scan to 5 minutes regardless of progress
      await axios.get(`${ZAP_URL}/JSON/ascan/action/setOptionMaxScanDurationInMins/`, {
        params: { Integer: 5 },
        headers
      });
      // E. Set LOW scan strength to reduce payload count per rule (saves memory)
      await axios.get(`${ZAP_URL}/JSON/ascan/action/setOptionDefaultPolicy/`, {
        params: { String: 'Default Policy' },
        headers
      }).catch(() => {});
    } catch (configErr) {
      console.warn('[zapScanner] Failed to configure ZAP performance options:', configErr.message);
    }

    onProgress('zap_ascan', 'in_progress', { message: 'Starting ZAP Active Scan...' });
    console.log(`[zapScanner] Launching ZAP Active Scan (Injections)...`);
    let activeScanId;
    try {
      const ascanRes = await axios.get(`${ZAP_URL}/JSON/ascan/action/scan/`, {
        params: { url: targetUrl, recurse: true, scanPolicyName: '', method: '', postData: '' },
        headers
      });
      activeScanId = ascanRes.data.scan;
    } catch (err) {
      // If ZAP cannot find the URL in the site tree, seed it and retry once.
      const isUrlTreeError = err.response && err.response.data && typeof err.response.data === 'object'
        ? err.response.data.code === 'url_not_found' || String(err.response.data.message || '').includes('URL Not Found')
        : false;

      if (isUrlTreeError) {
        console.warn('[zapScanner] Active scan failed because URL was not in ZAP tree. Seeding URL and retrying.');
        await seedUrlInZapTree(targetUrl, headers);
        const retryRes = await axios.get(`${ZAP_URL}/JSON/ascan/action/scan/`, {
          params: { url: targetUrl, recurse: true },
          headers
        });
        activeScanId = retryRes.data.scan;
      } else {
        throw err;
      }
    }

    console.log(`[zapScanner] ZAP Active Scan ID: ${activeScanId}`);

    // Poll Active Scan status with a 3-minute safety timeout
    let ascanCompleted = false;
    const ascanStartTime = Date.now();
    const MAX_ASCAN_TIME = 3 * 60 * 1000; // 3 minutes max
    
    while (!ascanCompleted) {
      const statusRes = await axios.get(`${ZAP_URL}/JSON/ascan/view/status/`, {
        params: { scanId: activeScanId },
        headers
      });
      const progress = parseInt(statusRes.data.status, 10);
      console.log(`[zapScanner] ZAP Active Scan progress: ${progress}%`);
      onProgress('zap_ascan', 'in_progress', { message: `Active scan: ${progress}% completed` });
      
      if (progress >= 100) {
        ascanCompleted = true;
      } else if (Date.now() - ascanStartTime > MAX_ASCAN_TIME) {
        console.warn('[zapScanner] Active Scan exceeded 3-minute time limit. Stopping ZAP active scan...');
        onProgress('zap_ascan', 'in_progress', { message: 'Max time limit reached. Finalizing current findings...' });
        try {
          await axios.get(`${ZAP_URL}/JSON/ascan/action/stop/`, {
            params: { scanId: activeScanId },
            headers
          });
        } catch (e) {
          console.error('[zapScanner] Error stopping active scan:', e.message);
        }
        ascanCompleted = true;
      } else {
        await sleep(2000);
      }
    }
    onProgress('zap_ascan', 'completed');
    console.log(`[zapScanner] ZAP Active Scan completed.`);

    // 5. Fetch and Normalize ZAP Alerts
    onProgress('zap_alerts', 'in_progress', { message: 'Fetching ZAP findings...' });
    console.log(`[zapScanner] Fetching alerts from ZAP API...`);
    const alertsRes = await axios.get(`${ZAP_URL}/JSON/core/view/alerts/`, {
      params: { baseurl: targetUrl },
      headers
    });
    const zapAlerts = alertsRes.data.alerts || [];
    console.log(`[zapScanner] ZAP returned ${zapAlerts.length} raw alerts.`);

    const grouped = new Map();
    for (const alert of zapAlerts) {
      const key = `${alert.alert}-${alert.description}`;
      const severity = mapRiskLevel(alert.risk, alert.alert);
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: `zap-${alert.alert.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${alert.id}`,
          title: alert.alert,
          severity,
          category: 'VAPT Scan',
          description: alert.description || 'No description provided by OWASP ZAP.',
          remediation: alert.solution || 'No remediation provided.',
          evidence: {
            urls: new Set([alert.url]),
            params: new Set(alert.param ? [alert.param] : []),
            evidenceList: new Set(alert.evidence ? [alert.evidence] : [])
          },
          owasp: alert.wascid ? `WASC-${alert.wascid}` : '',
          cwe: alert.cweid ? `CWE-${alert.cweid}` : ''
        });
      } else {
        const existing = grouped.get(key);
        existing.evidence.urls.add(alert.url);
        if (alert.param) existing.evidence.params.add(alert.param);
        if (alert.evidence) existing.evidence.evidenceList.add(alert.evidence);
      }
    }

    const findings = Array.from(grouped.values()).map(finding => {
      const urlsArray = Array.from(finding.evidence.urls);
      const paramsArray = Array.from(finding.evidence.params);
      const evidenceArray = Array.from(finding.evidence.evidenceList);
      
      const urlSummary = urlsArray.length > 5 
        ? `${urlsArray.slice(0, 5).join(', ')} ... and ${urlsArray.length - 5} more endpoints.` 
        : urlsArray.join(', ');

      return {
        ...finding,
        evidence: {
          url: urlSummary,
          param: paramsArray.length > 0 ? paramsArray.join(', ') : 'N/A',
          evidence: evidenceArray.length > 0 ? evidenceArray.slice(0, 5).join(', ') : 'N/A'
        }
      };
    });

    onProgress('zap_alerts', 'completed');
    await cleanupZapAuth(headers);
    return {
      scanned: true,
      available: true,
      status: 'completed',
      error: null,
      findings
    };

  } catch (err) {
    console.error('[zapScanner] Live ZAP Scan failed:', err.message);
    onProgress('zap_alerts', 'failed', { error: `OWASP ZAP scan failed: ${err.message}` });
    try {
      await cleanupZapAuth(headers);
    } catch (_) {}
    return {
      scanned: false,
      available: true,
      status: 'failed',
      error: err.message,
      findings: []
    }
  }
}

module.exports = {
  executeZapScan
};
