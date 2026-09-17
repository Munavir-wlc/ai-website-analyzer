'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import AppShell from '@/components/AppShell';
import Navbar from '@/components/Navbar';
import AuditReport from '@/components/AuditReport';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/Button';
import { 
  ArrowLeft, FolderOutput, Globe, User, 
  CheckCircle2, Loader2, Circle, AlertCircle, ShieldCheck, Sparkles 
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useWorkspace } from '@/lib/WorkspaceContext';

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
  const [hasChecked, setHasChecked] = useState(false);
  const [screenshots, setScreenshots] = useState({ loading: false, desktop: null, mobile: null, error: null });
  const [errorMsg, setErrorMsg] = useState(null);
  const [showClaimedSuccess, setShowClaimedSuccess] = useState(false);
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
            const authToken = localStorage.getItem('vapt_auth_token');
            const headers = { 'Content-Type': 'application/json' };
            if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
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
    setMoving(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const authToken = localStorage.getItem('vapt_auth_token');
      const res = await fetch(`${API_URL}/api/scan/results/${result.scanId}/move`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          teamId: targetWorkspaceId === 'personal' ? null : targetWorkspaceId
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setResult(prev => ({
          ...prev,
          teamId: targetWorkspaceId === 'personal' ? null : targetWorkspaceId
        }));
        setOpenMoveMenu(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to move audit report.');
      }
    } catch (err) {
      alert('Error updating report location: ' + err.message);
    } finally {
      setMoving(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const scanId = urlParams.get('scanId');

    if (!scanId) {
      const localData = localStorage.getItem('lastScanResult');
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setResult(parsed);
          setHasChecked(true);
          return;
        } catch (_) {}
      }
      setErrorMsg('No active scan ID provided in URL parameters.');
      setHasChecked(true);
      return;
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    let pollInterval = null;

    const fetchResult = async () => {
      try {
        const authToken = localStorage.getItem('vapt_auth_token');
        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const res = await fetch(`${API_URL}/api/scan/results/${scanId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setResult(data);
          setHasChecked(true);

          if (data.status === 'completed' || data.status === 'failed') {
            if (pollInterval) clearInterval(pollInterval);
          }
        } else {
          setErrorMsg('Audit scan results could not be retrieved.');
          setHasChecked(true);
          if (pollInterval) clearInterval(pollInterval);
        }
      } catch (err) {
        setErrorMsg('Network error communicating with the scan server.');
        setHasChecked(true);
        if (pollInterval) clearInterval(pollInterval);
      }
    };

    fetchResult();
    pollInterval = setInterval(fetchResult, 3000);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  const renderProgressIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-ok shrink-0" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-critical shrink-0" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
    }
  };

  const getStepTextStyle = (status) => {
    switch (status) {
      case 'completed':
        return 'text-ok font-medium';
      case 'in_progress':
        return 'text-foreground font-bold';
      case 'failed':
        return 'text-critical font-medium';
      default:
        return 'text-muted-foreground';
    }
  };

  const completedCount = Object.values(stepStates).filter(s => s === 'completed').length;
  const inProgressCount = Object.values(stepStates).filter(s => s === 'in_progress').length;
  const progressPercent = Math.min(99, Math.round(((completedCount + inProgressCount * 0.5) / SCAN_STEPS.length) * 100));

  if (authLoading || (!hasChecked && !result) || (result && result.status === 'processing')) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-lg bg-card border border-border rounded-lg p-6 sm:p-8 shadow-lg text-center space-y-6">
            <div className="flex flex-col items-center space-y-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">
                  Running Security Audit Pipeline
                </h2>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {activeStepMessage || 'Collecting deterministic headers, certificate validation, and threat modeling...'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Pipeline Progress</span>
                <span className="font-bold text-primary font-mono">{progressPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${Math.max(8, progressPercent)}%` }}
                />
              </div>
            </div>

            {/* Steps Checklist */}
            <div className="space-y-2 bg-muted/30 p-4 rounded-lg border border-border text-left">
              {SCAN_STEPS.map((step) => {
                const status = stepStates[step.id] || 'pending';
                return (
                  <div
                    key={step.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0"
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
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md bg-card border border-border rounded-lg p-8 shadow-sm space-y-4">
            <p className="text-muted-foreground text-sm font-medium">{errorMsg || 'No security audit results were found in your session.'}</p>
            <Link href="/">
              <Button>Start New Security Scan</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const content = (
    <div className="space-y-6">
      {/* Top Breadcrumb / Navigation Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden bg-card border border-border p-4 rounded-lg shadow-sm">
        <Link
          href="/"
          className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Start New Scan
        </Link>

        {/* Move report workspace controls */}
        {user && result && result.belongsToCurrentUser && (
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className="text-xs text-muted-foreground font-medium">
              Location: <span className="font-semibold text-primary">
                {result.teamId 
                  ? (workspaces.find(w => w._id === result.teamId)?.name || 'Team Workspace')
                  : 'Personal Workspace'}
              </span>
            </span>
            
            {workspaces.length > 0 && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenMoveMenu(!openMoveMenu)}
                  disabled={moving}
                  className="text-xs gap-1.5"
                >
                  <FolderOutput className="h-3.5 w-3.5" />
                  {moving ? 'Moving...' : 'Move Workspace'}
                </Button>

                {openMoveMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMoveMenu(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-xl p-1.5 z-20 space-y-1 animate-fade-in text-xs">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-muted-foreground border-b border-border">
                        Move Report to
                      </div>
                      
                      {result.teamId && (
                        <button
                          type="button"
                          onClick={() => handleMoveReport('personal')}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
                        >
                          <User className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>Personal Workspace</span>
                        </button>
                      )}

                      {workspaces
                        .filter(w => w._id !== result.teamId)
                        .map((w) => (
                          <button
                            key={w._id}
                            type="button"
                            onClick={() => handleMoveReport(w._id)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted flex items-center gap-2 transition-colors truncate"
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

      <AuditReport 
        result={result} 
        screenshots={screenshots} 
        executiveSummary={result.executiveSummary} 
      />
    </div>
  );

  if (user) {
    return <AppShell>{content}</AppShell>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {content}
      </main>
      <Footer />
    </div>
  );
}
