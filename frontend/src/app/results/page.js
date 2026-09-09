'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import Navbar from '../../components/Navbar';
import AuditReport from '../../components/AuditReport';
import Footer from '../../components/Footer';
import { Button } from '../../components/ui/Button';
import { 
  ArrowLeft, RefreshCw, FolderOutput, Globe, User, 
  CheckCircle2, Loader2, Circle, AlertCircle, ShieldCheck, Sparkles 
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useWorkspace } from '../../lib/WorkspaceContext';

const SCAN_STEPS = [
  { id: 'crawling', label: 'Crawling Website & Page Structure' },
  { id: 'ssl_check', label: 'SSL/TLS Certificate & Cipher Inspection' },
  { id: 'dns_check', label: 'DNS & Mail Records (SPF / DMARC / MX)' },
  { id: 'file_check', label: 'Sensitive Files & Path Exposure Audit' },
  { id: 'cve_scan', label: 'Passive CVE & Software Vulnerability Matching' },
  { id: 'performance', label: 'Performance Metrics & Speed Index' },
  { id: 'accessibility', label: 'WCAG Accessibility Standards Audit' },
  { id: 'seo', label: 'Technical SEO & Search Visibility' },
  { id: 'ai_analysis', label: 'AI Threat Intelligence & Executive Summary' }
];

export default function ResultsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { workspaces } = useWorkspace();
  const [openMoveMenu, setOpenMoveMenu] = useState(false);
  const [moving, setMoving] = useState(false);
  const [result, setResult] = useState(null);
  const [stepStates, setStepStates] = useState({
    crawling: 'in_progress',
    ssl_check: 'pending',
    dns_check: 'pending',
    file_check: 'pending',
    cve_scan: 'pending',
    performance: 'pending',
    accessibility: 'pending',
    seo: 'pending',
    ai_analysis: 'pending'
  });
  const [activeStepMessage, setActiveStepMessage] = useState('');

  // Socket.io connection to stream live scan execution progress
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const scanId = urlParams.get('scanId');
    if (!scanId || (hasChecked && result && result.score !== undefined)) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    let socket;
    try {
      socket = io(API_URL);

      socket.on('scan_progress', (data) => {
        if (data && (data.scanId === scanId || !data.scanId)) {
          if (data.step) {
            setStepStates((prev) => ({
              ...prev,
              [data.step]: data.status || 'in_progress'
            }));
          }
          if (data.message) {
            setActiveStepMessage(data.message);
          }
          if (data.status === 'completed' && (data.step === 'complete' || data.step === 'ai_analysis')) {
            // Refetch final result
            const token = localStorage.getItem('vapt_auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            fetch(`${API_URL}/api/scan/results/${scanId}`, { headers })
              .then((res) => res.ok ? res.json() : null)
              .then((fresh) => {
                if (fresh) {
                  setResult(fresh);
                  setHasChecked(true);
                }
              })
              .catch(() => {});
          }
        }
      });
    } catch (_) {}

    return () => {
      if (socket) socket.disconnect();
    };
  }, [hasChecked, result]);

  const handleMoveReport = async (targetWorkspaceId) => {
    if (!result || !result.scanId) return;
    try {
      setMoving(true);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      const res = await fetch(`${API_URL}/api/team/move-scan/${result.scanId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ targetWorkspaceId })
      });
      
      if (res.ok) {
        setResult(prev => ({
          ...prev,
          teamId: targetWorkspaceId === 'personal' ? null : targetWorkspaceId
        }));
        setOpenMoveMenu(false);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to move report.');
      }
    } catch (err) {
      console.error('Failed to move report:', err);
      alert('Error occurred while moving report.');
    } finally {
      setMoving(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('claimed') === 'true') {
        setShowClaimedSuccess(true);
        const cleanUrl = window.location.pathname + '?scanId=' + urlParams.get('scanId');
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    const urlParams = new URLSearchParams(window.location.search);
    const scanId = urlParams.get('scanId');

    if (scanId) {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(`${API_URL}/api/scan/results/${scanId}`, { headers })
        .then((res) => {
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              throw new Error('Access denied. This report belongs to a registered user and you must be logged in as the owner to view it.');
            }
            if (res.status === 404) {
              throw new Error('Scan report not found. Please note that guest scans are temporary and expire after 24 hours. Sign in or register to save scans permanently.');
            }
            throw new Error(`Report service returned status ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data && data.status === 'processing') {
            // Still in progress
            setHasChecked(false);
          } else {
            setResult(data);
            setHasChecked(true);
          }
        })
        .catch((err) => {
          console.error('[Results Fetch Error]:', err);
          setErrorMsg(err.message);
          setResult(null);
          setHasChecked(true);
        });
    } else {
      // Fallback to legacy sessionStorage
      try {
        const stored = sessionStorage.getItem('scanResult');
        setResult(stored ? JSON.parse(stored) : null);
      } catch (e) {
        console.error('Failed to parse scanResult', e);
        setResult(null);
      }
      setHasChecked(true);
    }
  }, [token, authLoading]);

  useEffect(() => {
    if (result && (result.scannedUrl || result.url)) {
      const targetUrl = result.scannedUrl || result.url;
      setScreenshots({ loading: true, desktop: null, mobile: null, error: null });
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const authCookie = result.authCookie || '';
      const authHeader = result.authHeader || '';
      const token = localStorage.getItem('vapt_auth_token');
      
      fetch(`${API_URL}/api/screenshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          url: targetUrl,
          authCookie,
          authHeader
        })
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Screenshot service returned status ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.success) {
            setScreenshots({
              loading: false,
              desktop: data.desktop,
              mobile: data.mobile,
              error: null
            });
          } else {
            setScreenshots({
              loading: false,
              desktop: null,
              mobile: null,
              error: data.error || 'Failed to capture screenshots'
            });
          }
        })
        .catch((err) => {
          console.error('[Screenshot Fetch Error]:', err);
          setScreenshots({
            loading: false,
            desktop: null,
            mobile: null,
            error: err.message || 'Failed to fetch page screenshots'
          });
        });
    }
  }, [result]);

  const renderProgressIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />;
      default:
        return <Circle className="h-4 w-4 text-slate-600 shrink-0" />;
    }
  };

  const getStepTextStyle = (status) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-400 font-medium';
      case 'in_progress':
        return 'text-white font-bold';
      case 'failed':
        return 'text-rose-400';
      default:
        return 'text-slate-500';
    }
  };

  const completedCount = Object.values(stepStates).filter(s => s === 'completed').length;
  const inProgressCount = Object.values(stepStates).filter(s => s === 'in_progress').length;
  const progressPercent = Math.min(99, Math.round(((completedCount + inProgressCount * 0.5) / SCAN_STEPS.length) * 100));

  if (authLoading || (!hasChecked && !result) || (result && result.status === 'processing')) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-lg bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Header with animated icon */}
            <div className="flex flex-col items-center text-center space-y-3 mb-6">
              <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400 shadow-lg shadow-indigo-600/20">
                <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
                <ShieldCheck className="h-4 w-4 text-indigo-300 absolute" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Running Deep Security & Audit Scan
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {activeStepMessage || 'Performing live passive checks, certificate validation, and threat modeling...'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Real-Time Progress</span>
                <span className="font-bold text-indigo-400 font-mono">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                <div
                  className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.max(8, progressPercent)}%` }}
                />
              </div>
            </div>

            {/* Live Steps Checklist */}
            <div className="space-y-2.5 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
              {SCAN_STEPS.map((step) => {
                const status = stepStates[step.id] || 'pending';
                return (
                  <div
                    key={step.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-slate-900/80 last:border-0"
                  >
                    <span className={getStepTextStyle(status)}>{step.label}</span>
                    {renderProgressIcon(status)}
                  </div>
                );
              })}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl p-8 shadow-2xl relative">
            <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/20 to-purple-500/0 rounded-3xl -z-10" />
            <p className="text-slate-600 dark:text-slate-400 font-medium mb-6">{errorMsg || 'No security scan results were found in your session.'}</p>
            <Button asChild className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/20">
              <Link href="/">Go Back to Scan Form</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Navbar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden bg-slate-100/80 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl">
            <Link
               href="/"
               className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Start New Scan
            </Link>

            {/* Move report workspace controls (if user logged in & is owner of report) */}
            {user && result && result.belongsToCurrentUser && (
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Current Location: <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {result.teamId 
                      ? (workspaces.find(w => w._id === result.teamId)?.name || 'Team Workspace')
                      : 'Personal Workspace'}
                  </span>
                </span>
                
                {workspaces.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMoveMenu(!openMoveMenu)}
                      disabled={moving}
                      className="text-xs font-bold text-slate-800 dark:text-white hover:text-indigo-650 dark:hover:text-indigo-400 inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-850 px-3.5 py-2 rounded-xl transition-all shadow-sm"
                    >
                      <FolderOutput className="h-3.5 w-3.5" />
                      {moving ? 'Moving...' : 'Move to Workspace'}
                    </button>

                    {openMoveMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMoveMenu(false)} />
                        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1.5 z-20 space-y-1 animate-fade-in">
                          <div className="px-2.5 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                            Move Report to
                          </div>
                          
                          {/* Personal Workspace option (if not current) */}
                          {result.teamId && (
                            <button
                              onClick={() => handleMoveReport('personal')}
                              className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-350 dark:hover:text-white dark:hover:bg-slate-850/60 flex items-center gap-2 transition-colors"
                            >
                              <User className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                              <span>Personal Workspace</span>
                            </button>
                          )}

                          {/* Team Workspaces options */}
                          {workspaces
                            .filter(w => w._id !== result.teamId)
                            .map((w) => (
                              <button
                                key={w._id}
                                onClick={() => handleMoveReport(w._id)}
                                className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-350 dark:hover:text-white dark:hover:bg-slate-850/60 flex items-center gap-2 transition-colors truncate"
                              >
                                <Globe className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                                <span className="truncate">{w.name}</span>
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {showClaimedSuccess && (
            <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold flex items-center justify-between animate-fade-in print:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 font-bold">
                  🎉
                </div>
                <div>
                  <p className="text-white font-bold">Scan Claimed Successfully!</p>
                  <p className="text-slate-400 text-xs font-normal">This report has been linked to your account and is saved permanently in your Scan History.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowClaimedSuccess(false)}
                className="text-slate-400 hover:text-white transition-colors text-xs uppercase tracking-wider font-bold px-2.5 py-1.5 rounded-lg hover:bg-slate-800"
              >
                Dismiss
              </button>
            </div>
          )}

          <AuditReport 
            result={result} 
            screenshots={screenshots} 
            executiveSummary={result.executiveSummary} 
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
