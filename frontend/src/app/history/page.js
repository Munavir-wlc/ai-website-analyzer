'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import { useWorkspace } from '../../lib/WorkspaceContext';
import AppShell from '../../components/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import StatusBadge from '../../components/ui/StatusBadge';
import SeverityBadge from '../../components/ui/SeverityBadge';
import EmptyState from '../../components/ui/EmptyState';
import { 
  Shield, Eye, Calendar, ExternalLink, RefreshCw, AlertCircle, Search, 
  Globe, ChevronDown, ChevronUp, ArrowUpRight, CheckCircle2, TrendingUp, 
  TrendingDown, Minus, History, ShieldAlert, Award, FolderOutput, Check, Plus
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

export default function HistoryPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { workspaces } = useWorkspace();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedProjects, setExpandedProjects] = useState({});
  const [openMoveMenuId, setOpenMoveMenuId] = useState(null);
  const [movingScanId, setMovingScanId] = useState(null);
  const [trendDomain, setTrendDomain] = useState('all');
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (token) {
      fetchScanHistory();
    }
  }, [token]);

  const handleMoveScan = async (scanId, targetWorkspaceId) => {
    try {
      setMovingScanId(scanId);
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_BASE}/api/team/move-scan/${scanId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ targetWorkspaceId })
      });
      if (res.ok) {
        setOpenMoveMenuId(null);
        fetchScanHistory();
      }
    } catch (err) {
      console.error('Failed to move scan:', err);
    } finally {
      setMovingScanId(null);
    }
  };

  const fetchScanHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_BASE}/api/auth/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to retrieve scan history');
      }
      const data = await res.json();
      setScans(data);
    } catch (err) {
      console.error('[History Fetch Error]:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRescan = (url) => {
    sessionStorage.setItem('rescanUrl', url);
    router.push('/');
  };

  const toggleProjectExpand = (url) => {
    setExpandedProjects(prev => ({
      ...prev,
      [url]: !prev[url]
    }));
  };

  // Group scans by URL to define "Projects"
  const projectsMap = {};
  scans.forEach(scan => {
    if (!projectsMap[scan.url]) {
      projectsMap[scan.url] = [];
    }
    projectsMap[scan.url].push(scan);
  });

  const projects = Object.entries(projectsMap).map(([url, urlScans]) => {
    const sortedScans = [...urlScans].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latestScan = sortedScans[0];
    const previousScan = sortedScans[1] || null;

    const findings = latestScan.report?.findings || latestScan.report?.vulnerabilities || [];
    const critical = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const medium = findings.filter(f => f.severity === 'medium').length;
    const low = findings.filter(f => f.severity === 'low').length;

    const fixedCount = latestScan.report?.fixedFindings?.length || 0;

    return {
      url,
      latestScan,
      previousScan,
      scans: sortedScans,
      vulnerabilityBreakdown: { critical, high, medium, low },
      fixedCount
    };
  });

  const filteredProjects = projects.filter(project => 
    project.url.toLowerCase().includes(search.toLowerCase())
  );

  const getGradeBadgeColor = (grade) => {
    const g = String(grade).toUpperCase();
    if (g.startsWith('A')) return 'bg-ok/10 border-ok/30 text-ok';
    if (g.startsWith('B')) return 'bg-primary/10 border-primary/30 text-primary';
    if (g.startsWith('C')) return 'bg-caution/10 border-caution/30 text-caution';
    if (g.startsWith('D')) return 'bg-caution/10 border-caution/30 text-caution';
    return 'bg-critical/10 border-critical/30 text-critical';
  };

  const getScoreColorClass = (score) => {
    if (score >= 90) return 'text-ok';
    if (score >= 70) return 'text-emerald-500';
    if (score >= 50) return 'text-caution';
    return 'text-critical';
  };

  // Score Trend Data
  const TREND_COLORS = ['#2E5FE8', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#EF4444'];
  const allDomains = Array.from(new Set(scans.map(s => {
    try { return new URL(s.url).hostname; } catch { return s.url; }
  })));
  const domainColor = new Map(allDomains.map((d, i) => [d, TREND_COLORS[i % TREND_COLORS.length]]));

  const trendData = [...scans]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(s => {
      let hostname;
      try { hostname = new URL(s.url).hostname; } catch { hostname = s.url; }
      return {
        domain: hostname,
        date: new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        score: s.score ?? 0,
        grade: s.grade || '—',
        scanMode: s.scanMode || 'quick',
        color: domainColor.get(hostname) || '#2E5FE8'
      };
    })
    .filter(p => trendDomain === 'all' || p.domain === trendDomain);

  if (authLoading || (loading && scans.length === 0)) {
    return (
      <AppShell activePath="/history">
        <div className="flex-1 flex items-center justify-center p-16">
          <div className="flex items-center gap-3 text-primary font-medium">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading scan history & projects...
          </div>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell activePath="/history">
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Project Security Status & History"
          description="Analyze project vulnerabilities, track scan comparison trends, and manage security posture over time."
          breadcrumbs={[
            { label: 'Console', href: '/dashboard' },
            { label: 'Audit History' }
          ]}
          actions={
            <Button
              asChild
              className="gap-2"
            >
              <Link href="/">
                <Plus className="h-4 w-4" /> Start New Scan
              </Link>
            </Button>
          }
        />

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Score Trend Chart */}
        {scans.length > 0 && (
          <Card>
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Score Trend Over Time
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {trendDomain === 'all' ? `All ${scans.length} scans across ${allDomains.length} domain(s)` : `Score history for ${trendDomain}`}
                  </CardDescription>
                </div>
                {/* Domain filter pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTrendDomain('all')}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      trendDomain === 'all'
                        ? 'bg-primary/10 text-primary border-primary/40 font-semibold'
                        : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                    }`}
                  >
                    All Domains
                  </button>
                  {allDomains.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTrendDomain(d)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                        trendDomain === d
                          ? 'bg-primary/10 text-primary border-primary/40 font-semibold'
                          : 'bg-muted text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: domainColor.get(d) }} />
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="h-56 w-full">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                      <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            const delta = trendData.indexOf(d) > 0
                              ? d.score - trendData[trendData.indexOf(d) - 1]?.score
                              : null;
                            return (
                              <div className="bg-card border border-border p-3 rounded-lg shadow-lg text-xs space-y-1 min-w-[160px]">
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                                  {d.domain}
                                </div>
                                <div className="text-muted-foreground font-mono text-[11px]">{d.date}</div>
                                <div className="text-primary font-bold font-mono">Score: {d.score}/100</div>
                                <div className="text-muted-foreground">Grade: <span className="text-foreground font-bold">{d.grade}</span></div>
                                <div className="text-muted-foreground uppercase text-[10px]">Mode: {d.scanMode}</div>
                                {delta !== null && (
                                  <div className={`flex items-center gap-1 font-bold ${
                                    delta > 0 ? 'text-ok' : delta < 0 ? 'text-critical' : 'text-muted-foreground'
                                  }`}>
                                    {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                    {delta > 0 ? '+' : ''}{delta} vs prev
                                  </div>
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
                        strokeWidth={3}
                        dot={({ cx, cy, payload }) => (
                          <circle
                            key={`dot-${payload.date}-${payload.domain}`}
                            cx={cx} cy={cy} r={4}
                            fill={payload.color}
                            stroke="var(--card)" strokeWidth={2}
                          />
                        )}
                        activeDot={{ r: 6, fill: '#2E5FE8', stroke: 'var(--card)', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    No scans for selected domain yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects by target URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm font-mono"
          />
        </div>

        {/* Project List */}
        {filteredProjects.length === 0 ? (
          <EmptyState
            icon={Globe}
            title={search ? "No Scanned Projects Found" : "No Projects Audited Yet"}
            description={search ? "No scanned projects match your search query." : "You haven't run any website security audits yet. Perform your first scan to populate this posture dashboard."}
            action={!search && (
              <Button asChild>
                <Link href="/">Perform First Audit</Link>
              </Button>
            )}
          />
        ) : (
          <div className="space-y-4">
            {filteredProjects.map((project) => {
              const { url, latestScan, previousScan, scans: urlScans, vulnerabilityBreakdown: vb, fixedCount } = project;
              const domain = (() => {
                try {
                  return new URL(url).hostname;
                } catch {
                  return url;
                }
              })();
              const isExpanded = !!expandedProjects[url];
              const scoreDiff = previousScan ? (latestScan.score - previousScan.score) : 0;
              const hasUnresolved = vb.critical > 0 || vb.high > 0 || vb.medium > 0;

              return (
                <Card key={url} className="overflow-hidden">
                  {/* Card Header Section */}
                  <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="p-2.5 bg-muted rounded-lg shrink-0 flex items-center justify-center text-primary border border-border">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-foreground truncate max-w-sm sm:max-w-md md:max-w-lg" title={url}>
                          {domain}
                        </h2>
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-0.5 truncate max-w-[280px] sm:max-w-xs font-mono"
                        >
                          {url} <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        onClick={() => handleRescan(url)}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Rescan
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        className="gap-1.5"
                      >
                        <Link href={`/results?scanId=${latestScan.scanId}`}>
                          View Latest Report <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Security Posture Details Grid */}
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-muted/20">
                    {/* Score / Grade */}
                    <div className="bg-card p-3.5 border border-border rounded-lg flex items-center gap-3.5">
                      <div className={`h-11 w-11 rounded-lg border flex items-center justify-center text-base font-bold font-mono ${getGradeBadgeColor(latestScan.grade)}`}>
                        {latestScan.grade}
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Security Score</span>
                        <span className={`text-xl font-bold font-mono ${getScoreColorClass(latestScan.score)}`}>{latestScan.score}/100</span>
                      </div>
                    </div>

                    {/* Score Trend Comparison */}
                    <div className="bg-card p-3.5 border border-border rounded-lg flex flex-col justify-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">Audit Trend</span>
                      {previousScan ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {scoreDiff > 0 ? (
                              <span className="text-ok inline-flex items-center gap-1 text-xs font-bold font-mono bg-ok/10 border border-ok/20 px-2 py-0.5 rounded">
                                <TrendingUp className="h-3.5 w-3.5" /> +{scoreDiff} Score
                              </span>
                            ) : scoreDiff < 0 ? (
                              <span className="text-critical inline-flex items-center gap-1 text-xs font-bold font-mono bg-critical/10 border border-critical/20 px-2 py-0.5 rounded">
                                <TrendingDown className="h-3.5 w-3.5" /> {scoreDiff} Score
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs font-medium">Score Stable</span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            vs {new Date(previousScan.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs font-medium italic">Baseline (First Scan)</span>
                      )}
                    </div>

                    {/* Active Vulnerability Breakdown */}
                    <div className="bg-card p-3.5 border border-border rounded-lg flex flex-col justify-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1.5">Active Findings</span>
                      {latestScan.report?.findings?.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap font-mono text-xs">
                          {vb.critical > 0 && <span className="bg-critical/10 text-critical border border-critical/20 text-[10px] font-bold px-1.5 py-0.5 rounded" title="Critical">{vb.critical} Critical</span>}
                          {vb.high > 0 && <span className="bg-orange-500/10 text-orange-500 border border-orange-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded" title="High">{vb.high} High</span>}
                          {vb.medium > 0 && <span className="bg-caution/10 text-caution border border-caution/20 text-[10px] font-bold px-1.5 py-0.5 rounded" title="Medium">{vb.medium} Medium</span>}
                          {vb.low > 0 && <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded" title="Low">{vb.low} Low</span>}
                        </div>
                      ) : (
                        <span className="text-ok text-xs font-medium flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Secure / Clean</span>
                      )}
                    </div>

                    {/* Resolved Fixes */}
                    <div className="bg-card p-3.5 border border-border rounded-lg flex flex-col justify-center">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">Fixed Findings</span>
                      {fixedCount > 0 ? (
                        <div>
                          <span className="inline-flex items-center gap-1 bg-ok/10 text-ok border border-ok/20 text-xs font-semibold px-2 py-0.5 rounded">
                            <CheckCircle2 className="h-3.5 w-3.5 text-ok shrink-0" />
                            {fixedCount} Resolved
                          </span>
                        </div>
                      ) : previousScan && !hasUnresolved ? (
                        <span className="text-ok text-xs font-medium">Fully clean website</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">No new fixes detected</span>
                      )}
                    </div>
                  </div>

                  {/* History Timeline Toggle */}
                  <div className="px-5 py-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => toggleProjectExpand(url)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <History className="h-4 w-4 text-primary" />
                        Audit History Logs ({urlScans.length} runs)
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {/* Expandable run history */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-border space-y-3">
                        <div className="relative border-l border-border ml-3 pl-5 space-y-4">
                          {urlScans.map((scan, idx) => {
                             const scanDateStr = new Date(scan.createdAt).toLocaleString();
                             const findingsCount = scan.report?.findings?.length || 0;
                             return (
                               <div key={scan.scanId} className="relative group">
                                 {/* Bullet indicator */}
                                 <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 bg-card ${
                                   idx === 0 
                                     ? 'border-primary ring-2 ring-primary/20' 
                                     : 'border-muted-foreground/50'
                                 }`} />
                                 
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/30 hover:bg-muted/60 border border-border p-3 rounded-lg transition-all">
                                   <div className="flex items-center gap-3">
                                     <span className="text-xs font-medium text-foreground font-mono">{scanDateStr}</span>
                                     <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground border border-border">
                                       {scan.scanMode}
                                     </span>
                                     {idx === 0 && (
                                       <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[9px] uppercase tracking-wide font-bold">
                                         Latest
                                       </span>
                                     )}
                                   </div>

                                   <div className="flex items-center gap-3 flex-wrap">
                                     <div className="flex items-center gap-2">
                                       <span className="text-xs text-muted-foreground font-mono">{findingsCount} issues</span>
                                       <span className={`text-xs font-bold font-mono ${getScoreColorClass(scan.score)}`}>{scan.score}/100</span>
                                       <span className={`inline-flex items-center justify-center font-bold font-mono h-5 w-5 rounded border text-[9px] ${getGradeBadgeColor(scan.grade)}`}>
                                         {scan.grade}
                                       </span>
                                     </div>

                                     <Button
                                       asChild
                                       variant="outline"
                                       size="sm"
                                       className="h-7 text-xs px-2.5 gap-1"
                                     >
                                       <Link href={`/results?scanId=${scan.scanId}`}>
                                         View <Eye className="h-3 w-3" />
                                       </Link>
                                     </Button>

                                     {/* Move to Workspace Dropdown */}
                                     {workspaces.length > 0 && (
                                       <div className="relative">
                                         <Button
                                           variant="ghost"
                                           size="sm"
                                           onClick={() => setOpenMoveMenuId(openMoveMenuId === scan.scanId ? null : scan.scanId)}
                                           disabled={movingScanId === scan.scanId}
                                           className="h-7 text-xs text-primary hover:text-primary gap-1"
                                         >
                                           <FolderOutput className="h-3 w-3" />
                                           {movingScanId === scan.scanId ? 'Moving...' : 'Move'}
                                         </Button>

                                         {openMoveMenuId === scan.scanId && (
                                           <>
                                             <div className="fixed inset-0 z-10" onClick={() => setOpenMoveMenuId(null)} />
                                             <div className="absolute right-0 mt-1 w-52 bg-card border border-border rounded-lg shadow-lg p-1 z-20 space-y-1">
                                               <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-muted-foreground border-b border-border">
                                                 Transfer to Workspace
                                               </div>
                                               {workspaces.map((w) => (
                                                 <button
                                                   key={w._id}
                                                   onClick={() => handleMoveScan(scan.scanId, w._id)}
                                                   className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-foreground hover:bg-muted flex items-center gap-2 truncate cursor-pointer"
                                                 >
                                                   <Globe className="h-3 w-3 text-primary shrink-0" />
                                                   <span className="truncate">{w.name}</span>
                                                 </button>
                                               ))}
                                             </div>
                                           </>
                                         )}
                                       </div>
                                     )}
                                   </div>
                                 </div>
                               </div>
                             );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
