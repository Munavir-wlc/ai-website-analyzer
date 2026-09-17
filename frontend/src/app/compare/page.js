'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '../../components/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import SeverityBadge from '../../components/ui/SeverityBadge';
import EmptyState from '../../components/ui/EmptyState';
import { 
  BarChart3, CheckCircle, ShieldAlert, AlertTriangle, ArrowRight, 
  ArrowUpRight, RefreshCw, Check, X, Shield, Plus
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
      <AppShell activePath="/compare">
        <div className="flex-1 flex flex-col items-center justify-center p-16 space-y-3">
          <RefreshCw className="h-7 w-7 text-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Loading Scan Comparison Studio...</p>
        </div>
      </AppShell>
    );
  }

  const { baseScan, targetScan, scoreDelta, diff } = diffData || {};

  return (
    <AppShell activePath="/compare">
      <div className="space-y-6">
        <PageHeader
          title="Side-by-Side Scan Comparison"
          description="Compare any two audit scans to pinpoint resolved fixes, new security regressions, and persistent findings."
          breadcrumbs={[
            { label: 'Console', href: '/dashboard' },
            { label: 'Comparison Studio' }
          ]}
          badge={
            <span className="text-[11px] font-mono font-medium uppercase px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              Delta Intelligence
            </span>
          }
        />

        {/* Scan Selector Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Base Scan Select */}
          <Card>
            <CardContent className="p-5 space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground" /> 1. Earlier Baseline Audit
              </label>
              <select
                value={baseScanId}
                onChange={(e) => setBaseScanId(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
              >
                <option value="" disabled>Select baseline scan...</option>
                {scans.map(s => (
                  <option key={s.scanId} value={s.scanId}>
                    {s.domain} — {new Date(s.createdAt).toLocaleDateString()} ({s.score}/100 Grade {s.grade})
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Target Scan Select */}
          <Card>
            <CardContent className="p-5 space-y-2">
              <label className="text-xs font-semibold uppercase text-primary tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> 2. Recent Target Audit
              </label>
              <select
                value={targetScanId}
                onChange={(e) => setTargetScanId(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3.5 py-2.5 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
              >
                <option value="" disabled>Select recent target scan...</option>
                {scans.map(s => (
                  <option key={s.scanId} value={s.scanId}>
                    {s.domain} — {new Date(s.createdAt).toLocaleDateString()} ({s.score}/100 Grade {s.grade})
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="p-12 text-center bg-card rounded-lg border border-border flex flex-col items-center space-y-3">
            <RefreshCw className="h-7 w-7 text-primary animate-spin" />
            <p className="text-sm font-medium text-muted-foreground">Computing Vulnerability Diff & Score Deltas...</p>
          </div>
        )}

        {/* Diff Results Container */}
        {!loading && diffData && (
          <div className="space-y-6">
            {/* Score Comparison Banner */}
            <Card>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* Base Scan Summary */}
                <div className="text-center md:text-left space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground tracking-wider">Baseline Audit</span>
                  <div className="font-mono font-bold text-base text-foreground">{baseScan.domain}</div>
                  <div className="text-xs text-muted-foreground font-mono">{new Date(baseScan.createdAt).toLocaleString()}</div>
                  <div className="text-2xl font-bold font-mono text-foreground mt-2">{baseScan.score} <span className="text-xs font-normal text-muted-foreground">/ 100</span></div>
                </div>

                {/* Score Delta Indicator */}
                <div className="flex flex-col items-center justify-center p-4 bg-muted/40 rounded-lg border border-border">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Score Delta</span>
                  <div className={`text-3xl font-bold font-mono ${
                    scoreDelta > 0 ? 'text-ok' : scoreDelta < 0 ? 'text-critical' : 'text-muted-foreground'
                  }`}>
                    {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 font-medium">
                    {scoreDelta > 0 ? 'Security Improved' : scoreDelta < 0 ? 'Security Declined' : 'Unchanged'}
                  </span>
                </div>

                {/* Target Scan Summary */}
                <div className="text-center md:text-right space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-primary tracking-wider">Recent Audit</span>
                  <div className="font-mono font-bold text-base text-foreground">{targetScan.domain}</div>
                  <div className="text-xs text-muted-foreground font-mono">{new Date(targetScan.createdAt).toLocaleString()}</div>
                  <div className="text-2xl font-bold font-mono text-primary mt-2">{targetScan.score} <span className="text-xs font-normal text-muted-foreground">/ 100</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Diff Counters Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border border-l-4 border-l-ok p-5 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resolved Issues</div>
                  <div className="text-2xl font-bold font-mono text-ok">{diff.resolved.length}</div>
                </div>
                <div className="p-2.5 bg-ok/10 text-ok rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-card border border-border border-l-4 border-l-critical p-5 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Regressions</div>
                  <div className="text-2xl font-bold font-mono text-critical">{diff.new.length}</div>
                </div>
                <div className="p-2.5 bg-critical/10 text-critical rounded-lg">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-card border border-border border-l-4 border-l-primary p-5 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Persistent Findings</div>
                  <div className="text-2xl font-bold font-mono text-primary">{diff.persistent.length}</div>
                </div>
                <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
                  <RefreshCw className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Findings Diff Breakdown */}
            <Card>
              <CardContent className="p-6 space-y-6">
                {/* Resolved List */}
                {diff.resolved.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-ok flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Resolved Vulnerabilities ({diff.resolved.length})
                    </h3>
                    <div className="space-y-2">
                      {diff.resolved.map((item, idx) => (
                        <div key={idx} className="p-3.5 bg-card border border-border border-l-4 border-l-ok rounded-lg space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground text-xs">{item.title}</span>
                            <SeverityBadge severity="resolved" label="Fixed" />
                          </div>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Regressions List */}
                {diff.new.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-critical flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> New Security Regressions ({diff.new.length})
                    </h3>
                    <div className="space-y-2">
                      {diff.new.map((item, idx) => (
                        <div key={idx} className="p-3.5 bg-card border border-border border-l-4 border-l-critical rounded-lg space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground text-xs">{item.title}</span>
                            <SeverityBadge severity={item.severity || 'high'} />
                          </div>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Persistent Issues List */}
                {diff.persistent.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-primary" /> Persistent Vulnerabilities ({diff.persistent.length})
                    </h3>
                    <div className="space-y-2">
                      {diff.persistent.map((item, idx) => (
                        <div key={idx} className="p-3.5 bg-card border border-border border-l-4 border-l-primary rounded-lg space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground text-xs">{item.title}</span>
                            <SeverityBadge severity={item.severity || 'medium'} />
                          </div>
                          <p className="text-xs text-muted-foreground">{item.baseDescription}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unverified List */}
                {diff.unverified && diff.unverified.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-caution flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" /> Unverified Baseline Findings ({diff.unverified.length})
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      These baseline vulnerabilities were not tested during the recent scan because the scan depth or capabilities did not include active testing.
                    </p>
                    <div className="space-y-2">
                      {diff.unverified.map((item, idx) => (
                        <div key={idx} className="p-3.5 bg-card border border-border border-l-4 border-l-caution rounded-lg space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground text-xs">{item.title}</span>
                            <span className="text-[10px] font-mono font-bold text-caution bg-caution/10 border border-caution/20 px-2 py-0.5 rounded uppercase">
                              {item.reason || 'NOT TESTED'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {diff.resolved.length === 0 && diff.new.length === 0 && diff.persistent.length === 0 && (!diff.unverified || diff.unverified.length === 0) && (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No vulnerability differences detected between the two selected scans.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <RefreshCw className="h-7 w-7 text-primary animate-spin" />
      </div>
    }>
      <ComparePageContent />
    </Suspense>
  );
}
