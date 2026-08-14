'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Link from 'next/link';
import { 
  BarChart3, Shield, ShieldAlert, CheckCircle, AlertTriangle, 
  TrendingUp, Globe, Clock, ArrowUpRight, Loader2, Sparkles, Plus, ExternalLink, Filter
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend } from 'recharts';

const DOMAIN_COLORS = ['#6366f1', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e'];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedScanMode, setSelectedScanMode] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchAnalytics();
    }
  }, [user, authLoading]);

  const fetchAnalytics = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('vapt_auth_token');

      const res = await fetch(`${API_URL}/api/scan/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to fetch analytics metrics.');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-300">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading Security Portfolio Analytics...</p>
        </div>
      </div>
    );
  }

  const { totalScans, avgScore, scoreHistory, riskBreakdown, statusBreakdown, assets } = analytics || {};

  // Unique domains for filter dropdown and color map
  const availableDomains = assets ? Array.from(new Set(assets.map(a => a.domain))) : [];
  
  const domainColorMap = new Map();
  availableDomains.forEach((d, idx) => {
    domainColorMap.set(d, DOMAIN_COLORS[idx % DOMAIN_COLORS.length]);
  });

  // Filtered score history based on selected domain and scan mode
  const filteredScoreHistory = (selectedDomain === 'all'
    ? (scoreHistory || [])
    : (scoreHistory || []).filter(s => s.domain === selectedDomain))
    .filter(s => {
      if (selectedScanMode === 'all') return true;
      if (selectedScanMode === 'quick') return s.scanMode === 'quick';
      if (selectedScanMode === 'full') return s.scanMode === 'full' && !s.zapScanned;
      if (selectedScanMode === 'zap') return !!s.zapScanned;
      return true;
    })
    .map(item => ({
      ...item,
      color: domainColorMap.get(item.domain) || '#6366f1'
    }));

  // Filtered stats for selected domain if single site selected
  const displayScore = selectedDomain === 'all'
    ? avgScore
    : (assets?.find(a => a.domain === selectedDomain)?.latestScore || avgScore);

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 60) return 'text-indigo-600 dark:text-indigo-400';
    if (score >= 40) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const getScoreGrade = (score) => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  };

  const riskBarData = [
    { name: 'Critical', count: riskBreakdown?.critical || 0, color: '#f43f5e' },
    { name: 'High', count: riskBreakdown?.high || 0, color: '#fb923c' },
    { name: 'Medium', count: riskBreakdown?.medium || 0, color: '#facc15' },
    { name: 'Low', count: riskBreakdown?.low || 0, color: '#38bdf8' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-300 selection:bg-indigo-500 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl relative overflow-hidden shadow-xl dark:shadow-2xl">
          <div className="absolute -inset-px bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent rounded-3xl pointer-events-none" />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-mono tracking-wider">
                Portfolio Command Center
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Welcome back, {user?.name || 'Security Admin'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Overview of target website health, domain score trends, and vulnerability resolution metrics.
            </p>
          </div>
          <div className="relative z-10 flex items-center gap-3 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" /> New Audit Scan
            </Link>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Health Score Card */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {selectedDomain === 'all' ? 'Average Health Score' : 'Domain Health Score'}
              </span>
              <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className={`text-3xl font-black ${getScoreColor(displayScore)}`}>
                {displayScore} <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/ 100</span>
              </span>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-slate-150 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                Grade {getScoreGrade(displayScore)}
              </span>
            </div>
          </div>

          {/* Total Audits Card */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Scans Run</span>
              <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20">
                <Shield className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-black text-slate-900 dark:text-white">{totalScans}</span>
              <span className="text-xs text-slate-500 ml-2">completed audits</span>
            </div>
          </div>

          {/* Monitored Assets Card */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target Domains</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-black text-slate-900 dark:text-white">{assets?.length || 0}</span>
              <span className="text-xs text-slate-500 ml-2">scanned website domains</span>
            </div>
          </div>

          {/* Critical Risk Card */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Critical/High</span>
              <div className="p-2 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <div>
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                {(riskBreakdown?.critical || 0) + (riskBreakdown?.high || 0)}
              </span>
              <span className="text-xs text-slate-500 ml-2">findings requiring fix</span>
            </div>
          </div>

        </div>

        {/* Charts Section: Score History (with Per-Website Lines) & Risk Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Score Trend Line Chart with Per-Website Dots & Legend */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl dark:shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Website Audit Timeline ({filteredScoreHistory.length} Scans)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedDomain === 'all' ? 'Every scan point plotted chronologically across your target websites.' : `Score evolution for ${selectedDomain}`}
                </p>
              </div>

              {/* Filter Dropdowns Container */}
              <div className="flex items-center gap-3 shrink-0 flex-wrap">
                {/* Per-Website Filter Dropdown */}
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="all">🌐 All Websites ({availableDomains.length})</option>
                    {availableDomains.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Scan Depth Filter Dropdown */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedScanMode}
                    onChange={(e) => setSelectedScanMode(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  >
                    <option value="all">📊 All Scan Depths</option>
                    <option value="quick">Quick Passive Only</option>
                    <option value="full">Full Deterministic Only</option>
                    <option value="zap">Deep ZAP Scan Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Color Legend Pills for Websites */}
            {availableDomains.length > 0 && selectedDomain === 'all' && (
              <div className="flex flex-wrap gap-2 pt-1">
                {availableDomains.map(d => (
                  <button
                    key={d}
                    onClick={() => setSelectedDomain(d)}
                    className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-500 transition-all"
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: domainColorMap.get(d) }} />
                    <span>{d}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="h-64 w-full pt-2">
              {filteredScoreHistory && filteredScoreHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredScoreHistory} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-2xl text-xs space-y-1">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: data.color }} />
                                {data.domain}
                              </div>
                              <div className="text-slate-400 font-mono text-[11px]">{data.date}</div>
                              <div className="text-indigo-400 font-bold font-mono">Score: {data.score} / 100 (Grade {getScoreGrade(data.score)})</div>
                              {data.scanDepth && (
                                <div className="text-slate-400 font-mono text-[10px] uppercase mt-0.5">Depth: {data.scanDepth}</div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 8, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                  No scan history available for selected website.
                </div>
              )}
            </div>
          </div>

          {/* Risk Breakdown Bar Chart */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl dark:shadow-2xl flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" /> Risk Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Categorization of findings by severity.</p>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px', color: '#ffffff' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {riskBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">Open Bugs</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{statusBreakdown?.open || 0}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">Resolved</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{statusBreakdown?.resolved || 0}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Target Asset Inventory Grid */}
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl space-y-4 shadow-xl dark:shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> Monitored Target Websites ({assets?.length || 0})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Overview of registered domains and their latest audit status.</p>
            </div>
          </div>

          {assets && assets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {assets.map((asset, idx) => (
                <div
                  key={idx}
                  className={`bg-slate-50 dark:bg-slate-950/60 border p-5 rounded-2xl space-y-4 transition-all hover:bg-white dark:hover:bg-slate-900/80 flex flex-col justify-between group shadow-sm ${
                    selectedDomain === asset.domain
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-white truncate" title={asset.domain}>
                        {asset.domain}
                      </span>
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                        asset.latestScore >= 80
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : asset.latestScore >= 60
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      }`}>
                        Grade {getScoreGrade(asset.latestScore)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        {new Date(asset.lastScanDate).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>{asset.totalFindings} findings</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedDomain(asset.domain)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: domainColorMap.get(asset.domain) }} /> Filter Chart →
                    </button>
                    <Link
                      href={`/results/${asset.lastScanId}`}
                      className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white flex items-center gap-1 transition-colors group-hover:translate-x-0.5 duration-200"
                    >
                      View Audit <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-100 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              No target assets scanned yet. Start your first security audit from the home page!
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
