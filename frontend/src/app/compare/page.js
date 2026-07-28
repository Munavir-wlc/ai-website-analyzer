'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Link from 'next/link';
import { 
  BarChart3, CheckCircle, ShieldAlert, AlertTriangle, ArrowRight, 
  ArrowUpRight, Loader2, Sparkles, Check, X, Shield, RefreshCw
} from 'lucide-react';

function ComparePageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [scans, setScans] = useState([]);
  const [baseScanId, setBaseScanId] = useState(searchParams.get('baseScanId') || '');
  const [targetScanId, setTargetScanId] = useState(searchParams.get('targetScanId') || '');
  const [diffData, setDiffData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingScans, setFetchingScans] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchUserScans();
    }
  }, [user, authLoading]);

  const fetchUserScans = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('vapt_auth_token');

      const res = await fetch(`${API_URL}/api/auth/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load user scan history.');
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data.scans || []);

      const list = rawList.map(s => {
        let dom = s.domain;
        if (!dom && s.report && s.report.domain) dom = s.report.domain;
        if (!dom && s.url) {
          try {
            dom = new URL(s.url.startsWith('http') ? s.url : `https://${s.url}`).hostname.replace(/^www\./, '');
          } catch(e) {}
        }
        return {
          ...s,
          domain: dom || 'Website'
        };
      });

      setScans(list);

      // Pre-select scans if not selected
      if (list.length >= 2) {
        if (!baseScanId) setBaseScanId(list[1].scanId);
        if (!targetScanId) setTargetScanId(list[0].scanId);
      } else if (list.length === 1) {
        if (!baseScanId) setBaseScanId(list[0].scanId);
      }
    } catch (err) {
      console.error('Fetch scans error:', err);
    } finally {
      setFetchingScans(false);
    }
  };

  useEffect(() => {
    if (baseScanId && targetScanId && baseScanId !== targetScanId) {
      compareScans();
    }
  }, [baseScanId, targetScanId]);

  const compareScans = async () => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('vapt_auth_token');

      const res = await fetch(`${API_URL}/api/scan/compare?baseScanId=${baseScanId}&targetScanId=${targetScanId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to calculate scan comparison diff.');
      const data = await res.json();
      setDiffData(data);
    } catch (err) {
      console.error('Compare error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || fetchingScans) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-300">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading Scan Comparison Studio...</p>
        </div>
      </div>
    );
  }

  const { baseScan, targetScan, scoreDelta, diff } = diffData || {};

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-300 selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl relative overflow-hidden shadow-xl dark:shadow-2xl">
          <div className="absolute -inset-px bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent rounded-3xl pointer-events-none" />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-mono tracking-wider">
                Vulnerability Regression Diff
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <BarChart3 className="h-7 w-7 text-purple-600 dark:text-purple-400" /> Side-by-Side Target Scan Comparison
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Compare any two audit scans to pinpoint fixed vulnerabilities, new security regressions, and persistent findings.
            </p>
          </div>
        </div>

        {/* Scan Selector Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-lg dark:shadow-xl">
          
          {/* Base Scan Select */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> 1. Earlier Baseline Audit
            </label>
            <select
              value={baseScanId}
              onChange={(e) => setBaseScanId(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="" disabled>Select baseline scan...</option>
              {scans.map(s => (
                <option key={s.scanId} value={s.scanId}>
                  {s.domain} — {new Date(s.createdAt).toLocaleDateString()} ({s.score}/100 Grade {s.grade})
                </option>
              ))}
            </select>
          </div>

          {/* Target Scan Select */}
          <div className="space-y-2">
            <label className="text-xs font-extrabold uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-indigo-500" /> 2. Recent Target Audit
            </label>
            <select
              value={targetScanId}
              onChange={(e) => setTargetScanId(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="" disabled>Select recent target scan...</option>
              {scans.map(s => (
                <option key={s.scanId} value={s.scanId}>
                  {s.domain} — {new Date(s.createdAt).toLocaleDateString()} ({s.score}/100 Grade {s.grade})
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="p-12 text-center bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col items-center space-y-3">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Computing Vulnerability Diff & Score Deltas...</p>
          </div>
        )}

        {/* Diff Results Container */}
        {!loading && diffData && (
          <div className="space-y-8">

            {/* Score Comparison Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl dark:shadow-2xl items-center">
              
              {/* Base Scan Summary */}
              <div className="text-center md:text-left space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400">Baseline Audit</span>
                <div className="font-mono font-bold text-base text-slate-900 dark:text-white">{baseScan.domain}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(baseScan.createdAt).toLocaleString()}</div>
                <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-2">{baseScan.score} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ 100</span></div>
              </div>

              {/* Score Delta Indicator */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-100 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Score Delta</span>
                <div className={`text-3xl font-black ${
                  scoreDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : scoreDelta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
                }`}>
                  {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-semibold">
                  {scoreDelta > 0 ? '🎉 Security Improved' : scoreDelta < 0 ? '⚠️ Security Declined' : 'Unchanged'}
                </span>
              </div>

              {/* Target Scan Summary */}
              <div className="text-center md:text-right space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-indigo-600 dark:text-indigo-400">Recent Audit</span>
                <div className="font-mono font-bold text-base text-slate-900 dark:text-white">{targetScan.domain}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(targetScan.createdAt).toLocaleString()}</div>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">{targetScan.score} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ 100</span></div>
              </div>

            </div>

            {/* Diff Counters Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Resolved Issues</div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-300">{diff.resolved.length}</div>
                </div>
                <div className="p-3 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <CheckCircle className="h-6 w-6" />
                </div>
              </div>

              <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">New Regressions</div>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-300">{diff.new.length}</div>
                </div>
                <div className="p-3 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>

              <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Persistent Findings</div>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-300">{diff.persistent.length}</div>
                </div>
                <div className="p-3 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <RefreshCw className="h-6 w-6" />
                </div>
              </div>

            </div>

            {/* Findings Diff Breakdown */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-6 shadow-xl dark:shadow-2xl">
              
              {/* Resolved List */}
              {diff.resolved.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" /> 🟩 Resolved Vulnerabilities ({diff.resolved.length})
                  </h3>
                  <div className="space-y-2">
                    {diff.resolved.map((item, idx) => (
                      <div key={idx} className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{item.title}</span>
                          <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded">FIXED</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Regressions List */}
              {diff.new.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> 🟥 New Security Regressions ({diff.new.length})
                  </h3>
                  <div className="space-y-2">
                    {diff.new.map((item, idx) => (
                      <div key={idx} className="p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{item.title}</span>
                          <span className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded uppercase">{item.severity}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Persistent Issues List */}
              {diff.persistent.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> 🟦 Persistent Vulnerabilities ({diff.persistent.length})
                  </h3>
                  <div className="space-y-2">
                    {diff.persistent.map((item, idx) => (
                      <div key={idx} className="p-4 bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{item.title}</span>
                          <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">{item.severity}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{item.baseDescription}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diff.resolved.length === 0 && diff.new.length === 0 && diff.persistent.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500">
                  No vulnerability differences detected between the two selected scans.
                </div>
              )}

            </div>

          </div>
        )}

      </main>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-300">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading Scan Comparison Studio...</p>
        </div>
      </div>
    }>
      <ComparePageContent />
    </Suspense>
  );
}
