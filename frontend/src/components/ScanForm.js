'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ScanForm() {
  const [url, setUrl] = useState('');
  const [scanType, setScanType] = useState('seo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), scanType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Scan failed');
      }
      sessionStorage.setItem('scanResult', JSON.stringify(data));
      router.push('/results');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
          Enter Website URL
        </label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Scan Type</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="scanType"
              value="seo"
              checked={scanType === 'seo'}
              onChange={(e) => setScanType(e.target.value)}
              className="w-4 h-4 text-blue-600"
            />
            <span>SEO Scan</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="scanType"
              value="vapt"
              checked={scanType === 'vapt'}
              onChange={(e) => setScanType(e.target.value)}
              className="w-4 h-4 text-blue-600"
            />
            <span>VAPT Security Scan</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="scanType"
              value="full"
              checked={scanType === 'full'}
              onChange={(e) => setScanType(e.target.value)}
              className="w-4 h-4 text-blue-600"
            />
            <span>Full Scan (SEO + VAPT)</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Analyzing...' : 'Start Analysis'}
      </button>
    </form>
  );
}
