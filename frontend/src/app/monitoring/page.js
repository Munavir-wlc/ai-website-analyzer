'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useWorkspace } from '../../lib/WorkspaceContext';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Link from 'next/link';
import {
  Activity, Plus, Globe, Shield, ShieldAlert, CheckCircle2,
  Clock, ArrowUpRight, Play, RefreshCw, Trash2, AlertTriangle,
  TrendingUp, TrendingDown, Layers, Zap, X, ChevronRight, BarChart3,
  Calendar, Bell, Sparkles, Filter
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

export default function MonitoringPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();

  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [timeRange, setTimeRange] = useState('30d');
  const [changesData, setChangesData] = useState(null);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [runningMonitorId, setRunningMonitorId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [verifiedDomains, setVerifiedDomains] = useState([]);

  // Add Monitor Form state
  const [formUrl, setFormUrl] = useState('');
  const [formMode, setFormMode] = useState('quick');
  const [formFrequency, setFormFrequency] = useState('weekly');
  const [formEmailAlerts, setFormEmailAlerts] = useState(true);
  const [formOnCritical, setFormOnCritical] = useState(true);
  const [formOnScoreDrop, setFormOnScoreDrop] = useState(true);
  const [formThreshold, setFormThreshold] = useState(5);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchMonitors();
      fetchVerifiedDomains();
    }
  }, [user, authLoading, activeWorkspace]);

  const fetchMonitors = async () => {
    try {
      setLoading(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const wsId = activeWorkspace?.id || 'personal';

      const res = await fetch(`${API_URL}/api/monitoring?teamId=${wsId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setMonitors(data);
        if (data.length > 0 && !selectedMonitor) {
          setSelectedMonitor(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch monitors:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVerifiedDomains = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/domains`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVerifiedDomains(data.filter(d => d.verified));
      }
    } catch (err) {
      console.error('Failed to fetch verified domains:', err);
    }
  };

  useEffect(() => {
    if (selectedMonitor?._id) {
      fetchHistory(selectedMonitor._id, timeRange);
      fetchChanges(selectedMonitor._id);
    }
  }, [selectedMonitor, timeRange]);

  const fetchHistory = async (monitorId, range) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/monitoring/${monitorId}/history?timeRange=${range}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const formatted = (data.history || []).map(h => ({
          date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          Overall: h.overallScore,
          Security: h.securityScore,
          Performance: h.performanceScore,
          Accessibility: h.accessibilityScore,
          SEO: h.seoScore,
          GEO: h.aiSearchScore,
          Findings: h.totalFindings
        }));
        setHistoryData(formatted);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const fetchChanges = async (monitorId) => {
    try {
      setLoadingChanges(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/monitoring/${monitorId}/changes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChangesData(data);
      }
    } catch (err) {
      console.error('Failed to fetch changes:', err);
    } finally {
      setLoadingChanges(false);
    }
  };

  const handleRunNow = async (monitorId, e) => {
    if (e) e.stopPropagation();
    try {
      setRunningMonitorId(monitorId);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/monitoring/${monitorId}/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        // Redirect to results live progress view
        router.push(`/results?scanId=${data.scanId}`);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to trigger scan.');
      }
    } catch (err) {
      console.error('Run now error:', err);
    } finally {
      setRunningMonitorId(null);
    }
  };

  const handleDelete = async (monitorId, e) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this continuous monitor?')) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/monitoring/${monitorId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setMonitors(prev => prev.filter(m => m._id !== monitorId));
        if (selectedMonitor?._id === monitorId) {
          setSelectedMonitor(monitors.find(m => m._id !== monitorId) || null);
        }
      }
    } catch (err) {
      console.error('Delete monitor error:', err);
    }
  };

  const handleCreateMonitor = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const wsId = activeWorkspace?.id || 'personal';

      const res = await fetch(`${API_URL}/api/monitoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUrl: formUrl,
          scanMode: formMode,
          frequency: formFrequency,
          teamId: wsId,
          notificationPreferences: {
            email: formEmailAlerts,
            onCritical: formOnCritical,
            onScoreDrop: formOnScoreDrop,
            scoreDropThreshold: formThreshold
          }
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        setFormUrl('');
        fetchMonitors();
      } else {
        const err = await res.json();
        setFormError(err.error || 'Failed to create monitor.');
      }
    } catch (err) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const isVerifiedSelected = verifiedDomains.some(d => {
    try {
      const host = new URL(formUrl.startsWith('http') ? formUrl : `https://${formUrl}`).hostname.replace(/^www\./, '');
      return d.hostname === host;
    } catch (_) {
      return false;
    }
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      <Navbar />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 border border-slate-800/80 p-6 rounded-3xl backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Activity className="h-6 w-6 animate-pulse" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Continuous Website Monitoring
              </h1>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm">
              Automated periodic scans, 6-axis trend history, and state-aware &quot;What Changed?&quot; intelligence.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs sm:text-sm py-2.5 px-5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Monitored Target
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Loading monitoring hub...</p>
          </div>
        ) : monitors.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Globe className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white">No Monitored Websites Yet</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add your first website to run continuous automated health checks, catch security regressions, and track performance changes over time.
            </p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-4 rounded-xl transition"
            >
              Add Your First Monitor
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Monitored Sites Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitors.map((m) => {
                const isSelected = selectedMonitor?._id === m._id;
                const isRunning = runningMonitorId === m._id;

                return (
                  <div
                    key={m._id}
                    onClick={() => setSelectedMonitor(m)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? 'bg-slate-900 border-indigo-500/60 shadow-xl shadow-indigo-500/10'
                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {m.frequency}
                        </span>
                        {m.isVerified ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            Passive Only
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-white text-base truncate" title={m.targetUrl}>
                        {m.hostname}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{m.targetUrl}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase font-bold">Latest Score</span>
                        <span className="text-lg font-black text-white font-mono">
                          {m.latestScore !== null ? `${m.latestScore}/100` : 'Pending'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleRunNow(m._id, e)}
                          disabled={isRunning}
                          className="p-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer"
                          title="Run Immediate Audit Scan"
                        >
                          <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(m._id, e)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition-all cursor-pointer"
                          title="Delete Monitor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Monitor Deep Dive: History & "What Changed?" */}
            {selectedMonitor && (
              <div className="space-y-6">
                {/* 6-Axis Multi-Dimensional Trend Analytics Card */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4 mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-400" />
                        {selectedMonitor.hostname} Score & Health History
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Historical trend tracking across Security, Performance, Accessibility, SEO, and GEO.
                      </p>
                    </div>

                    {/* Time Range Selector */}
                    <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 self-stretch sm:self-auto justify-between">
                      {['7d', '30d', '90d', '1y', 'all'].map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setTimeRange(range)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            timeRange === range
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {range === 'all' ? 'All Time' : range.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {historyData.length < 2 ? (
                    <div className="py-12 text-center text-slate-500 space-y-2">
                      <Clock className="w-8 h-8 mx-auto text-slate-600" />
                      <p className="text-sm font-semibold text-slate-400">Not Enough Data Points Yet</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Historical multi-axis graphs will populate automatically as continuous scans are completed.
                      </p>
                    </div>
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          <Line type="monotone" dataKey="Overall" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="Security" stroke="#ef4444" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="Performance" stroke="#38bdf8" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="Accessibility" stroke="#10b981" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="SEO" stroke="#f59e0b" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="GEO" stroke="#a855f7" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* "What Changed?" Intelligence Panel */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        &quot;What Changed?&quot; Scan Intelligence
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Automated delta comparison between the latest two scans.
                      </p>
                    </div>

                    {changesData?.currentScan?.scanId && (
                      <Link
                        href={`/results?scanId=${changesData.currentScan.scanId}`}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        View Full Latest Audit <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>

                  {loadingChanges ? (
                    <div className="py-12 text-center text-slate-400 animate-pulse text-xs">
                      Computing scan difference intelligence...
                    </div>
                  ) : !changesData?.hasPreviousScan ? (
                    <div className="py-8 text-center text-slate-400 space-y-2">
                      <p className="text-sm font-semibold text-slate-300">Initial Baseline Scan Completed</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Run a subsequent scan or wait for the scheduled cycle to generate automated change intelligence.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Summary Stat Pills */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">Score Delta</span>
                          <span className={`text-xl font-black font-mono ${changesData.diff.scoreDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {changesData.diff.scoreDelta > 0 ? `+${changesData.diff.scoreDelta}` : changesData.diff.scoreDelta} pts
                          </span>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
                          <span className="text-[10px] text-rose-400 uppercase font-bold block">New Findings</span>
                          <span className="text-xl font-black font-mono text-white">
                            {changesData.diff.new?.length || 0}
                          </span>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
                          <span className="text-[10px] text-emerald-400 uppercase font-bold block">Resolved Fixes</span>
                          <span className="text-xl font-black font-mono text-white">
                            {changesData.diff.resolved?.length || 0}
                          </span>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Persistent Issues</span>
                          <span className="text-xl font-black font-mono text-white">
                            {changesData.diff.persistent?.length || 0}
                          </span>
                        </div>
                      </div>

                      {/* New Findings List */}
                      {changesData.diff.new && changesData.diff.new.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Newly Introduced Findings ({changesData.diff.new.length})
                          </h4>
                          <div className="space-y-2">
                            {changesData.diff.new.map((f, i) => (
                              <div key={i} className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-3 text-xs">
                                <div>
                                  <strong className="text-white block">{f.title}</strong>
                                  <span className="text-slate-400 text-[11px]">{f.category}</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                                  {f.severity || 'Medium'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resolved Findings List */}
                      {changesData.diff.resolved && changesData.diff.resolved.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved & Verified Fixes ({changesData.diff.resolved.length})
                          </h4>
                          <div className="space-y-2">
                            {changesData.diff.resolved.map((f, i) => (
                              <div key={i} className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
                                <div>
                                  <span className="text-slate-300 line-through block font-medium">{f.title}</span>
                                  <span className="text-slate-500 text-[11px]">{f.category}</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                                  RESOLVED
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add Monitored Target Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                Add Monitored Website
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMonitor} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase">Target Website URL</label>
                <input
                  type="text"
                  placeholder="https://example.com"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                {isVerifiedSelected && (
                  <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified Domain Ownership detected! Full/Active scan mode available.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase">Frequency</label>
                  <select
                    value={formFrequency}
                    onChange={(e) => setFormFrequency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 uppercase">Scan Mode</label>
                  <select
                    value={formMode}
                    onChange={(e) => setFormMode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="quick">Quick (Passive Audits)</option>
                    <option value="full">Full (Comprehensive)</option>
                    <option value="active">Active (Requires Verification)</option>
                  </select>
                </div>
              </div>

              {/* Notification Toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Alert Preferences</label>
                
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEmailAlerts}
                    onChange={(e) => setFormEmailAlerts(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <span>Send Email Alerts on regressions and critical findings</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formOnCritical}
                    onChange={(e) => setFormOnCritical(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <span>Alert immediately on Critical/High severity issues</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formOnScoreDrop}
                    onChange={(e) => setFormOnScoreDrop(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <span>Alert if overall score drops by &ge; 5 points</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition"
                >
                  {formSubmitting ? 'Adding...' : 'Start Monitoring'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
