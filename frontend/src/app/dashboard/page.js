'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { 
  BarChart3, Shield, ShieldAlert, Globe, ArrowUpRight, Plus, Filter,
  Zap, CreditCard, RefreshCw, AlertTriangle, TrendingUp, Clock
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useWorkspace } from '@/lib/WorkspaceContext';

const DOMAIN_COLORS = ['#2E5FE8', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#EF4444'];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const router = useRouter();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedScanMode, setSelectedScanMode] = useState('all');
  const [subscription, setSubscription] = useState(null);

  const fetchAnalytics = useCallback(async (wsId = 'personal') => {
    try {
      setLoading(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('vapt_auth_token');

      const res = await fetch(`${API_URL}/api/scan/analytics?teamId=${wsId}`, {
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
  }, []);

  const fetchSubscription = useCallback(async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('vapt_auth_token');
      if (!token) return;
      const res = await fetch(`${API_URL}/api/payment/subscription`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data);
      }
    } catch (err) {
      console.warn('Subscription fetch failed:', err.message);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchAnalytics(activeWorkspace?.id || 'personal');
      fetchSubscription();
    }
  }, [user, authLoading, activeWorkspace?.id, router, fetchAnalytics, fetchSubscription]);

  const getScoreGrade = (score) => {
    const s = Number(score) || 0;
    if (s >= 90) return 'A+';
    if (s >= 80) return 'A';
    if (s >= 70) return 'B';
    if (s >= 60) return 'C';
    if (s >= 50) return 'D';
    return 'F';
  };

  if (authLoading || loading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
              <div className="h-4 w-72 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-10 w-32 bg-muted rounded-lg animate-pulse" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>

          <SkeletonTable rows={4} cols={3} />
        </div>
      </AppShell>
    );
  }

  const { totalScans, avgScore, scoreHistory, riskBreakdown, statusBreakdown, assets } = analytics || {};

  const availableDomains = assets ? Array.from(new Set(assets.map(a => a.domain))) : [];
  const domainColorMap = new Map();
  availableDomains.forEach((d, idx) => {
    domainColorMap.set(d, DOMAIN_COLORS[idx % DOMAIN_COLORS.length]);
  });

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
      color: domainColorMap.get(item.domain) || '#2E5FE8'
    }));

  const displayScore = selectedDomain === 'all'
    ? (avgScore || 0)
    : (assets?.find(a => a.domain === selectedDomain)?.latestScore || avgScore || 0);

  const riskBarData = [
    { name: 'Critical', count: riskBreakdown?.critical || 0, color: '#EF4444' },
    { name: 'High', count: riskBreakdown?.high || 0, color: '#F97316' },
    { name: 'Medium', count: riskBreakdown?.medium || 0, color: '#F59E0B' },
    { name: 'Low', count: riskBreakdown?.low || 0, color: '#3B82F6' }
  ];

  const totalOpenFindings = (riskBreakdown?.critical || 0) + (riskBreakdown?.high || 0) + (riskBreakdown?.medium || 0) + (riskBreakdown?.low || 0);

  return (
    <AppShell>
      <div className="space-y-8">
        
        {/* Page Header */}
        <PageHeader
          title="Security Overview"
          description={`Comprehensive health analytics, vulnerability tracking, and compliance metrics for ${activeWorkspace?.name || 'Personal Workspace'}.`}
          badge={
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
              Live SOC Console
            </span>
          }
          actions={
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchAnalytics(activeWorkspace?.id || 'personal')}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Link href="/">
                <Button size="sm" className="gap-1.5 text-xs shadow-sm">
                  <Plus className="h-3.5 w-3.5" />
                  New Scan
                </Button>
              </Link>
            </div>
          }
        />

        {/* Executive KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Security Score */}
          <StatCard
            title="Security Score"
            value={`${displayScore} / 100`}
            subtitle={`Grade ${getScoreGrade(displayScore)}`}
            icon={BarChart3}
            badge={
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Grade {getScoreGrade(displayScore)}
              </span>
            }
          />

          {/* Monitored Domains */}
          <StatCard
            title="Monitored Domains"
            value={assets?.length || 0}
            subtitle="Target Web Assets"
            icon={Globe}
          />

          {/* Open Findings */}
          <StatCard
            title="Open Findings"
            value={totalOpenFindings}
            subtitle={`${statusBreakdown?.resolved || 0} Resolved`}
            icon={Shield}
          />

          {/* Critical Risks */}
          <StatCard
            title="Critical Risks"
            value={riskBreakdown?.critical || 0}
            subtitle={`${riskBreakdown?.high || 0} High Severity`}
            icon={ShieldAlert}
            className={riskBreakdown?.critical > 0 ? 'border-rose-500/30' : undefined}
          />

          {/* Monthly Quota */}
          {(() => {
            const plan = subscription?.plan || 'free';
            const used = subscription?.scansCountThisMonth ?? totalScans ?? 0;
            const limit = subscription?.scansLimit;
            const isUnlimited = limit === 'unlimited';
            const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / (limit || 3)) * 100));

            return (
              <StatCard
                title="Scan Quota"
                value={isUnlimited ? 'Unlimited' : `${used} / ${limit || 3}`}
                subtitle={`Plan: ${plan.toUpperCase()}`}
                icon={Zap}
                badge={
                  pct >= 80 && !isUnlimited ? (
                    <Link href="/pricing" className="text-[10px] text-primary hover:underline font-semibold">
                      Upgrade
                    </Link>
                  ) : null
                }
              />
            );
          })()}

        </div>

        {/* Charts Section: Score History & Risk Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Score Trend Line Chart */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Security Score Timeline ({filteredScoreHistory.length} Scans)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedDomain === 'all' ? 'Chronological trend across all target website audits.' : `Score evolution for ${selectedDomain}`}
                </p>
              </div>

              {/* Filter Dropdowns */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="all">All Websites ({availableDomains.length})</option>
                    {availableDomains.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <select
                  value={selectedScanMode}
                  onChange={(e) => setSelectedScanMode(e.target.value)}
                  className="bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value="all">All Depths</option>
                  <option value="quick">Quick Passive</option>
                  <option value="full">Full VAPT</option>
                  <option value="zap">Deep ZAP</option>
                </select>
              </div>
            </div>

            {/* Website Pills Filter */}
            {availableDomains.length > 0 && selectedDomain === 'all' && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {availableDomains.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDomain(d)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-muted border border-border text-foreground hover:border-primary/50 transition-colors"
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: domainColorMap.get(d) }} />
                    <span>{d}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="h-60 w-full pt-2">
              {filteredScoreHistory && filteredScoreHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredScoreHistory} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="#94A3B8" fontSize={10} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-card border border-border p-3 rounded-lg shadow-xl text-xs space-y-1">
                              <div className="font-bold text-foreground flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: data.color }} />
                                {data.domain}
                              </div>
                              <div className="text-muted-foreground font-mono text-[11px]">{data.date}</div>
                              <div className="text-primary font-bold font-mono">Score: {data.score} / 100 ({getScoreGrade(data.score)})</div>
                              {data.scanDepth && (
                                <div className="text-muted-foreground font-mono text-[10px] uppercase">Depth: {data.scanDepth}</div>
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
                      stroke="#2E5FE8"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#2E5FE8', strokeWidth: 2, stroke: '#ffffff' }}
                      activeDot={{ r: 6, fill: '#2E5FE8', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  No scan points recorded for the active filter.
                </div>
              )}
            </div>
          </div>

          {/* Risk Distribution Bar Chart */}
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm flex flex-col justify-between">
            <div className="border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Risk Distribution
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Identified vulnerabilities by severity category.</p>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {riskBarData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-muted/40 rounded-lg border border-border flex items-center justify-between">
                <span className="text-muted-foreground">Open Issues</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{statusBreakdown?.open || 0}</span>
              </div>
              <div className="p-2 bg-muted/40 rounded-lg border border-border flex items-center justify-between">
                <span className="text-muted-foreground">Resolved</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{statusBreakdown?.resolved || 0}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Target Asset Inventory */}
        <div className="rounded-lg border border-border bg-card p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Target Website Inventory ({assets?.length || 0})
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Observed domains and their latest security status.</p>
            </div>
            <Link href="/domains">
              <Button variant="outline" size="sm" className="text-xs gap-1">
                View All Domains <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>

          {assets && assets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {assets.map((asset, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border p-4 space-y-3 transition-colors bg-card hover:border-primary/40 flex flex-col justify-between ${
                    selectedDomain === asset.domain
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-border'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-foreground truncate" title={asset.domain}>
                        {asset.domain}
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        Score {asset.latestScore} ({getScoreGrade(asset.latestScore)})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(asset.lastScanDate).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>{asset.totalFindings} findings</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedDomain(asset.domain)}
                      className="font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: domainColorMap.get(asset.domain) }} /> Filter
                    </button>
                    <Link
                      href={`/results/${asset.lastScanId}`}
                      className="font-medium text-foreground hover:text-primary flex items-center gap-1 transition-colors"
                    >
                      Audit Report <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Globe}
              title="No website domains audited yet"
              description="Launch your first automated security audit to populate health analytics and risk breakdown charts."
              action={
                <Link href="/">
                  <Button size="sm">Start First Security Scan</Button>
                </Link>
              }
            />
          )}
        </div>

      </div>
    </AppShell>
  );
}
