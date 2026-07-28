'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Button } from '../../components/ui/Button';
import { 
  Shield, Eye, Calendar, ExternalLink, RefreshCw, AlertCircle, Search, 
  Globe, ChevronDown, ChevronUp, ArrowUpRight, CheckCircle2, TrendingUp, 
  TrendingDown, History, ShieldAlert, Award 
} from 'lucide-react';

export default function HistoryPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedProjects, setExpandedProjects] = useState({});
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
    // Sort URL scans chronologically (newest first)
    const sortedScans = [...urlScans].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const latestScan = sortedScans[0];
    const previousScan = sortedScans[1] || null;

    // Vulnerability metrics from latest scan report
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
    if (g.startsWith('A')) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    if (g.startsWith('B')) return 'bg-teal-500/10 border-teal-500/30 text-teal-400';
    if (g.startsWith('C')) return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    if (g.startsWith('D')) return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
  };

  const getScoreColorClass = (score) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-lime-400';
    if (score >= 50) return 'text-amber-400';
    if (score >= 30) return 'text-orange-400';
    return 'text-rose-400';
  };

  if (authLoading || (loading && scans.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 text-indigo-500 dark:text-indigo-400 font-semibold animate-pulse">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading scan history & projects...
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null; // Redirecting
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans transition-colors duration-300">
      <Navbar />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <Award className="h-8 w-8 text-indigo-550 dark:text-indigo-500" /> Project Security Status
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
              Analyze project vulnerabilities, track scan comparison trends, and manage security posture.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-2.5 px-5 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/45 hover:-translate-y-0.5 transition-all text-sm"
          >
            Start New Scan
          </Link>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm mb-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Search */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-205 dark:border-slate-800/80 rounded-2xl p-4 mb-8 flex items-center relative shadow-sm">
          <Search className="absolute left-7 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects by target URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-955/60 border border-slate-205 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
          />
        </div>

        {/* Project List */}
        {filteredProjects.length === 0 ? (
          <div className="bg-white dark:bg-slate-900/30 border border-slate-205 dark:border-slate-800 rounded-3xl p-16 text-center shadow-sm relative overflow-hidden">
            <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/5 to-purple-500/0 rounded-3xl -z-10" />
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 mb-6">
              <Globe className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No projects audited</h3>
            <p className="text-slate-655 dark:text-slate-400 text-sm max-w-sm mx-auto mb-6">
              {search ? "No scanned projects match your search terms." : "You haven't added any websites to your security posture board yet. Perform a scan to create your first project!"}
            </p>
            {!search && (
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl font-bold bg-indigo-650 hover:bg-indigo-600 text-white py-2.5 px-6 shadow-lg shadow-indigo-500/20 text-sm"
              >
                Perform First Audit
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-6">
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
                <div 
                  key={url} 
                  className="border border-slate-205 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-800 transition-all duration-300 shadow-sm relative overflow-hidden"
                >
                  <div className="absolute -inset-px bg-gradient-to-r from-indigo-500/5 to-transparent rounded-3xl -z-10" />
                  
                  {/* Card Header Section */}
                  <div className="p-6 border-b border-slate-205 dark:border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border border-slate-205 dark:border-slate-800 rounded-2xl shrink-0 flex items-center justify-center text-indigo-550 dark:text-indigo-400">
                        <Globe className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate max-w-sm sm:max-w-md md:max-w-lg" title={url}>
                          {domain}
                        </h2>
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs text-slate-500 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-405 inline-flex items-center gap-1 mt-0.5 truncate max-w-[280px] sm:max-w-xs font-mono"
                        >
                          {url} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        onClick={() => handleRescan(url)}
                        variant="outline"
                        className="bg-white hover:bg-slate-50 dark:bg-slate-950/80 dark:hover:bg-slate-900 text-xs font-bold border-slate-205 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 px-3.5 py-1.5 h-8.5 rounded-xl flex items-center gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Rescan
                      </Button>
                      <Link
                        href={`/results?scanId=${latestScan.scanId}`}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 h-8.5 rounded-xl inline-flex items-center gap-1.5 shadow-lg shadow-indigo-500/10 transition-colors"
                      >
                        View Latest Report <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Security Posture Details Grid */}
                  <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Score / Grade */}
                    <div className="bg-slate-50 dark:bg-slate-950/30 p-4 border border-slate-205 dark:border-slate-800/60 rounded-2xl flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-full border flex items-center justify-center text-sm font-extrabold ${getGradeBadgeColor(latestScan.grade)}`}>
                        {latestScan.grade}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-wider block">Security Score</span>
                        <span className={`text-2xl font-extrabold ${getScoreColorClass(latestScan.score)}`}>{latestScan.score}/100</span>
                      </div>
                    </div>

                    {/* Score Trend Comparison */}
                    <div className="bg-slate-50 dark:bg-slate-955/30 p-4 border border-slate-205 dark:border-slate-800/60 rounded-2xl flex flex-col justify-center">
                      <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-wider block mb-1">Audit Trend</span>
                      {previousScan ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            {scoreDiff > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 text-sm font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                                <TrendingUp className="h-3.5 w-3.5" /> +{scoreDiff} Score
                              </span>
                            ) : scoreDiff < 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 text-sm font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg">
                                <TrendingDown className="h-3.5 w-3.5" /> {scoreDiff} Score
                              </span>
                            ) : (
                              <span className="text-slate-600 dark:text-slate-400 text-sm font-semibold">Score Stable</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium mt-1">
                            Compared to previous run ({new Date(previousScan.createdAt).toLocaleDateString()})
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-450 text-xs font-semibold italic">Baseline (First Scan)</span>
                      )}
                    </div>

                    {/* Active Vulnerability Breakdown */}
                    <div className="bg-slate-50 dark:bg-slate-955/30 p-4 border border-slate-205 dark:border-slate-800/60 rounded-2xl flex flex-col justify-center">
                      <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-wider block mb-2">Active Findings</span>
                      {latestScan.report?.findings?.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {vb.critical > 0 && <span className="bg-red-500/10 text-red-650 dark:text-red-400 border border-red-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded" title="Critical">{vb.critical} C</span>}
                          {vb.high > 0 && <span className="bg-orange-500/10 text-orange-655 dark:text-orange-400 border border-orange-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded" title="High">{vb.high} H</span>}
                          {vb.medium > 0 && <span className="bg-yellow-500/10 text-yellow-655 dark:text-yellow-405 border border-yellow-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded" title="Medium">{vb.medium} M</span>}
                          {vb.low > 0 && <span className="bg-blue-500/10 text-blue-650 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold px-1.5 py-0.5 rounded" title="Low">{vb.low} L</span>}
                        </div>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Secure / Clean</span>
                      )}
                    </div>

                    {/* Resolved Fixes */}
                    <div className="bg-slate-50 dark:bg-slate-955/30 p-4 border border-slate-205 dark:border-slate-800/60 rounded-2xl flex flex-col justify-center">
                      <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-wider block mb-1">Fixed Vulnerabilities</span>
                      {fixedCount > 0 ? (
                        <div>
                          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-650 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2.5 py-1 rounded-xl shadow-lg shadow-emerald-500/5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            {fixedCount} Resolves Verified!
                          </span>
                        </div>
                      ) : previousScan && !hasUnresolved ? (
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">Fully clean website</span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-500 text-xs italic">No new fixes detected</span>
                      )}
                    </div>
                  </div>

                  {/* History Timeline Toggle */}
                  <div className="px-6 pb-6 pt-2">
                    <button
                      onClick={() => toggleProjectExpand(url)}
                      className="w-full flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-t border-slate-205 dark:border-slate-800/50 pt-4 transition-colors font-sans"
                    >
                      <span className="flex items-center gap-1.5">
                        <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        Audit History Logs ({urlScans.length} runs)
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>

                    {/* Expandable run history */}
                    {isExpanded && (
                      <div className="mt-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-205 dark:border-slate-800/60 rounded-2xl p-4 space-y-4">
                        <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3.5 pl-6 space-y-5">
                          {urlScans.map((scan, idx) => {
                             const scanDateStr = new Date(scan.createdAt).toLocaleString();
                             const findingsCount = scan.report?.findings?.length || 0;
                             return (
                               <div key={scan.scanId} className="relative group">
                                 {/* Bullet indicator */}
                                 <span className={`absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 bg-white dark:bg-slate-950 group-hover:scale-110 transition-transform ${
                                   idx === 0 
                                     ? 'border-indigo-650 dark:border-indigo-500 ring-2 ring-indigo-500/20' 
                                     : 'border-slate-300 dark:border-slate-700'
                                 }`} />
                                 
                                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-900/60 border border-slate-105 dark:border-transparent hover:border-slate-205 dark:hover:border-slate-850 p-3 rounded-xl transition-all shadow-sm">
                                   <div className="flex items-center gap-3">
                                     <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{scanDateStr}</span>
                                     <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                       scan.scanMode === 'full' 
                                         ? 'bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-500/20' 
                                         : 'bg-blue-500/10 text-blue-650 dark:text-blue-400 border border-blue-500/20'
                                     }`}>
                                       {scan.scanMode}
                                     </span>
                                     {idx === 0 && (
                                       <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-405 border border-indigo-500/20 text-[9px] uppercase tracking-wide font-bold">
                                         Latest Run
                                       </span>
                                     )}
                                   </div>

                                   <div className="flex items-center gap-4">
                                     <div className="flex items-center gap-2">
                                       <span className="text-xs text-slate-500 dark:text-slate-500 font-medium">{findingsCount} issues</span>
                                       <span className={`text-xs font-bold ${getScoreColorClass(scan.score)}`}>{scan.score}/100</span>
                                       <span className={`inline-flex items-center justify-center font-extrabold h-5.5 w-5.5 rounded-full border text-[9px] ${getGradeBadgeColor(scan.grade)}`}>
                                         {scan.grade}
                                       </span>
                                     </div>
                                     <Link
                                       href={`/results?scanId=${scan.scanId}`}
                                       className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 border border-slate-205 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 px-2.5 py-1 rounded-lg transition-colors"
                                     >
                                       View <Eye className="h-3 w-3" />
                                     </Link>
                                   </div>
                                 </div>
                               </div>
                             );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
