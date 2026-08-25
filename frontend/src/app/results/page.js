'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import AuditReport from '../../components/AuditReport';
import Footer from '../../components/Footer';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, RefreshCw, FolderOutput, Globe, User } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useWorkspace } from '../../lib/WorkspaceContext';

export default function ResultsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const { workspaces } = useWorkspace();
  const [openMoveMenu, setOpenMoveMenu] = useState(false);
  const [moving, setMoving] = useState(false);
  const [result, setResult] = useState(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [screenshots, setScreenshots] = useState({ loading: false, desktop: null, mobile: null, error: null });
  const [errorMsg, setErrorMsg] = useState(null);
  const [showClaimedSuccess, setShowClaimedSuccess] = useState(false);

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
          setResult(data);
          setHasChecked(true);
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
      
      const queryParams = new URLSearchParams({
        url: targetUrl,
        authCookie,
        authHeader
      }).toString();

      fetch(`${API_URL}/api/screenshot?${queryParams}`)
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

  if (authLoading || (!hasChecked && !result)) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 text-indigo-500 dark:text-indigo-400 font-semibold animate-pulse">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading report results...
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

          <AuditReport result={result} screenshots={screenshots} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
