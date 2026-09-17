'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useWorkspace } from '../../lib/WorkspaceContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '../../components/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import StatusBadge from '../../components/ui/StatusBadge';
import SeverityBadge from '../../components/ui/SeverityBadge';
import EmptyState from '../../components/ui/EmptyState';
import {
  Activity, Plus, Globe, Shield, CheckCircle2,
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
    <AppShell activePath="/monitoring">
      <div className="space-y-6">
        <PageHeader
          title="Continuous Website Monitoring"
          description="Automated periodic scans, 6-axis trend history, and state-aware delta intelligence."
          breadcrumbs={[
            { label: 'Console', href: '/dashboard' },
            { label: 'Continuous Monitoring' }
          ]}
          actions={
            <Button
              onClick={() => setShowAddModal(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Add Monitored Target
            </Button>
          }
        />

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-7 w-7 text-primary animate-spin" />
            <p className="text-sm font-medium text-muted-foreground">Loading monitoring hub...</p>
          </div>
        ) : monitors.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No Monitored Websites Yet"
            description="Add your first website to run continuous automated health checks, catch security regressions, and track performance changes over time."
            actionLabel="Add Your First Monitor"
            onAction={() => setShowAddModal(true)}
          />
        ) : (
          <div className="space-y-6">
            {/* Monitored Sites Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitors.map((m) => {
                const isSelected = selectedMonitor?._id === m._id;
                const isRunning = runningMonitorId === m._id;

                return (
                  <Card
                    key={m._id}
                    onClick={() => setSelectedMonitor(m)}
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-primary ring-1 ring-primary shadow-sm'
                        : 'hover:border-border/80'
                    }`}
                  >
                    <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded-lg bg-muted text-muted-foreground border border-border">
                            {m.frequency}
                          </span>
                          {m.isVerified ? (
                            <StatusBadge status="verified" label="Verified" />
                          ) : (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-muted text-muted-foreground border border-border">
                              Passive Only
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-foreground text-base truncate" title={m.targetUrl}>
                          {m.hostname}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{m.targetUrl}</p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <div>
                          <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">Latest Score</span>
                          <span className="text-lg font-bold text-foreground font-mono">
                            {m.latestScore !== null ? `${m.latestScore}/100` : 'Pending'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleRunNow(m._id, e)}
                            disabled={isRunning}
                            className="h-8 w-8 p-0"
                            title="Run Immediate Audit Scan"
                          >
                            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleDelete(m._id, e)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            title="Delete Monitor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Selected Monitor Deep Dive: History & "What Changed?" */}
            {selectedMonitor && (
              <div className="space-y-6">
                {/* 6-Axis Multi-Dimensional Trend Analytics Card */}
                <Card>
                  <CardHeader className="pb-4 border-b border-border">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-primary" />
                          {selectedMonitor.hostname} Score & Health History
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Historical trend tracking across Security, Performance, Accessibility, SEO, and GEO.
                        </CardDescription>
                      </div>

                      {/* Time Range Selector */}
                      <div className="flex rounded-lg bg-muted p-1 border border-border self-stretch sm:self-auto justify-between">
                        {['7d', '30d', '90d', '1y', 'all'].map((range) => (
                          <button
                            key={range}
                            type="button"
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                              timeRange === range
                                ? 'bg-card text-foreground shadow-sm font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {range === 'all' ? 'All Time' : range.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6">
                    {historyData.length < 2 ? (
                      <div className="py-12 text-center text-muted-foreground space-y-2">
                        <Clock className="w-8 h-8 mx-auto text-muted-foreground/60" />
                        <p className="text-sm font-semibold text-foreground">Not Enough Data Points Yet</p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          Historical multi-axis graphs will populate automatically as continuous scans are completed.
                        </p>
                      </div>
                    ) : (
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={historyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                            <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 100]} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="Overall" stroke="#2E5FE8" strokeWidth={3} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="Security" stroke="#EF4444" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="Performance" stroke="#06B6D4" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="Accessibility" stroke="#10B981" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="SEO" stroke="#F59E0B" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="GEO" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* "What Changed?" Intelligence Panel */}
                <Card>
                  <CardHeader className="pb-4 border-b border-border">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          &quot;What Changed?&quot; Scan Intelligence
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Automated delta comparison between the latest two scans.
                        </CardDescription>
                      </div>

                      {changesData?.currentScan?.scanId && (
                        <Link
                          href={`/results?scanId=${changesData.currentScan.scanId}`}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          View Full Latest Audit <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-6">
                    {loadingChanges ? (
                      <div className="py-12 text-center text-muted-foreground animate-pulse text-xs">
                        Computing scan difference intelligence...
                      </div>
                    ) : !changesData?.hasPreviousScan ? (
                      <div className="py-8 text-center text-muted-foreground space-y-2">
                        <p className="text-sm font-semibold text-foreground">Initial Baseline Scan Completed</p>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                          Run a subsequent scan or wait for the scheduled cycle to generate automated change intelligence.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Summary Stat Pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-muted/50 p-4 rounded-lg border border-border text-center">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Score Delta</span>
                            <span className={`text-xl font-bold font-mono ${changesData.diff.scoreDelta >= 0 ? 'text-ok' : 'text-critical'}`}>
                              {changesData.diff.scoreDelta > 0 ? `+${changesData.diff.scoreDelta}` : changesData.diff.scoreDelta} pts
                            </span>
                          </div>

                          <div className="bg-muted/50 p-4 rounded-lg border border-border text-center">
                            <span className="text-[10px] text-critical uppercase font-bold tracking-wider block">New Findings</span>
                            <span className="text-xl font-bold font-mono text-foreground">
                              {changesData.diff.new?.length || 0}
                            </span>
                          </div>

                          <div className="bg-muted/50 p-4 rounded-lg border border-border text-center">
                            <span className="text-[10px] text-ok uppercase font-bold tracking-wider block">Resolved Fixes</span>
                            <span className="text-xl font-bold font-mono text-foreground">
                              {changesData.diff.resolved?.length || 0}
                            </span>
                          </div>

                          <div className="bg-muted/50 p-4 rounded-lg border border-border text-center">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Persistent Issues</span>
                            <span className="text-xl font-bold font-mono text-foreground">
                              {changesData.diff.persistent?.length || 0}
                            </span>
                          </div>
                        </div>

                        {/* New Findings List */}
                        {changesData.diff.new && changesData.diff.new.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-critical flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" /> Newly Introduced Findings ({changesData.diff.new.length})
                            </h4>
                            <div className="space-y-2">
                              {changesData.diff.new.map((f, i) => (
                                <div key={i} className="p-3.5 rounded-lg bg-card border border-border border-l-4 border-l-critical flex items-center justify-between gap-3 text-xs">
                                  <div>
                                    <strong className="text-foreground block">{f.title}</strong>
                                    <span className="text-muted-foreground text-[11px]">{f.category}</span>
                                  </div>
                                  <SeverityBadge severity={f.severity || 'Medium'} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Resolved Findings List */}
                        {changesData.diff.resolved && changesData.diff.resolved.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-ok flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Resolved & Verified Fixes ({changesData.diff.resolved.length})
                            </h4>
                            <div className="space-y-2">
                              {changesData.diff.resolved.map((f, i) => (
                                <div key={i} className="p-3.5 rounded-lg bg-card border border-border border-l-4 border-l-ok flex items-center justify-between gap-3 text-xs">
                                  <div>
                                    <span className="text-muted-foreground line-through block font-medium">{f.title}</span>
                                    <span className="text-muted-foreground text-[11px]">{f.category}</span>
                                  </div>
                                  <SeverityBadge severity="resolved" label="Resolved" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Add Monitored Target Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card border border-border rounded-lg p-6 sm:p-8 max-w-lg w-full shadow-lg relative space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Add Monitored Website
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateMonitor} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                    {formError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Target Website URL</label>
                  <input
                    type="text"
                    placeholder="https://example.com"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    required
                    className="w-full bg-background border border-input rounded-lg px-3.5 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                  />
                  {isVerifiedSelected && (
                    <p className="text-[11px] text-ok font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Verified Domain Ownership detected! Full/Active scan mode available.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Frequency</label>
                    <select
                      value={formFrequency}
                      onChange={(e) => setFormFrequency(e.target.value)}
                      className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Scan Mode</label>
                    <select
                      value={formMode}
                      onChange={(e) => setFormMode(e.target.value)}
                      className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                    >
                      <option value="quick">Quick (Passive Audits)</option>
                      <option value="full">Full (Comprehensive)</option>
                      <option value="active">Active (Requires Verification)</option>
                    </select>
                  </div>
                </div>

                {/* Notification Toggles */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block mb-1">Alert Preferences</label>

                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={formEmailAlerts}
                      onChange={(e) => setFormEmailAlerts(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-0"
                    />
                    <span>Send Email Alerts on regressions and critical findings</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={formOnCritical}
                      onChange={(e) => setFormOnCritical(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-0"
                    />
                    <span>Alert immediately on Critical/High severity issues</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={formOnScoreDrop}
                      onChange={(e) => setFormOnScoreDrop(e.target.checked)}
                      className="rounded border-input text-primary focus:ring-0"
                    />
                    <span>Alert if overall score drops by &ge; 5 points</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={formSubmitting}
                  >
                    {formSubmitting ? 'Adding...' : 'Start Monitoring'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
