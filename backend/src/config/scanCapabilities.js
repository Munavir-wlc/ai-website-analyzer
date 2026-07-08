function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

const capabilities = {
  activeScans: envFlag('ENABLE_ACTIVE_SCANS', false),
  loadTesting: envFlag('ENABLE_LOAD_TESTING', false),
  zapScans: envFlag('ENABLE_ZAP_SCANS', false),
  authenticatedScans: envFlag('ENABLE_AUTHENTICATED_SCANS', false),
  aiFindings: envFlag('ENABLE_AI_FINDINGS', false),
  maxQueueSize: Math.max(1, parseInt(process.env.SCAN_QUEUE_MAX || '25', 10) || 25)
};

module.exports = { capabilities, envFlag };
