/**
 * API client for AI Website Analyzer backend
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function runScan(url, scanType) {
  const res = await fetch(`${API_BASE}/api/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, scanType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Scan failed: ${res.status}`);
  }

  return res.json();
}
