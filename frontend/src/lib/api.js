/**
 * Legacy scan helper for backward compatibility with the legacy ScanSection UI.
 * It now maps legacy scan types to the backend's current scan API contract.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const scanTypeMap = {
  seo: { mode: 'quick', useZap: false },
  site: { mode: 'quick', useZap: false },
  vapt: { mode: 'full', useZap: false },
  full: { mode: 'full', useZap: true }
};

export async function runScan(url, scanType) {
  const scanConfig = scanTypeMap[scanType] || { mode: 'full', useZap: false };
  const res = await fetch(`${API_BASE}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      consent: true,
      mode: scanConfig.mode,
      useZap: scanConfig.useZap
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Scan failed: ${res.status}`);
  }

  return res.json();
}
