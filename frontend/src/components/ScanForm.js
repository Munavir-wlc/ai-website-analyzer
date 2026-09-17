'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { CheckCircle2, Loader2, Circle, AlertCircle, ShieldCheck, ChevronDown, ChevronUp, Lock, ExternalLink, Globe } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useWorkspace } from '../lib/WorkspaceContext';
import { cn } from '@/lib/utils';
import { Button } from './ui/Button';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ENABLE_ACTIVE_SCANS = process.env.NEXT_PUBLIC_ENABLE_ACTIVE_SCANS === 'true';
const ENABLE_ZAP_SCANS = process.env.NEXT_PUBLIC_ENABLE_ZAP_SCANS === 'true';
const ENABLE_LOAD_TESTING = process.env.NEXT_PUBLIC_ENABLE_LOAD_TESTING === 'true';
const ENABLE_AUTHENTICATED_SCANS = process.env.NEXT_PUBLIC_ENABLE_AUTHENTICATED_SCANS === 'true';
const ENABLE_AI_FINDINGS = process.env.NEXT_PUBLIC_ENABLE_AI_FINDINGS === 'true';

export default function ScanForm() {
  const { token } = useAuth();
  const { activeWorkspace, workspaces } = useWorkspace();
  const [url, setUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState('full'); // 'quick' or 'full'
  const [useZap, setUseZap] = useState(true);
  const [zapScanMode, setZapScanMode] = useState('low');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [selectedWorkspace, setSelectedWorkspace] = useState(activeWorkspace?.id || 'personal');
  const [currentStepId, setCurrentStepId] = useState(null);
  const [authCookie, setAuthCookie] = useState('');
  const [authHeader, setAuthHeader] = useState('');
  const [delay, setDelay] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [domainStatus, setDomainStatus] = useState({ checking: false, verified: false, hostname: '' });
  const [stepStates, setStepStates] = useState({
    crawling: 'pending',
    ssl_check: 'pending',
    dns_check: 'pending',
    file_check: 'pending',
    port_scan: 'pending',
    whois_check: 'pending',
    redirect_check: 'pending',
    robots_check: 'pending',
    load_test: 'pending',
    zap_init: 'pending',
    zap_spider: 'pending',
    zap_pscan: 'pending',
    zap_ascan: 'pending',
    zap_alerts: 'pending',
    ai_analysis: 'pending'
  });

  const socketRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (activeWorkspace?.id) {
      setSelectedWorkspace(activeWorkspace.id);
    }
  }, [activeWorkspace]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Pre-populate URL if redirected from a rescan request
  useEffect(() => {
    const cachedUrl = sessionStorage.getItem('rescanUrl');
    if (cachedUrl) {
      setUrl(cachedUrl);
      sessionStorage.removeItem('rescanUrl');
    }
  }, []);

  // Check domain verification status when URL is entered
  useEffect(() => {
    if (!url || !url.trim()) {
      setDomainStatus({ checking: false, verified: false, hostname: '' });
      return;
    }

    let hostname = '';
    try {
      hostname = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.toLowerCase();
    } catch (_) {
      hostname = url.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
    }

    if (!hostname || !hostname.includes('.')) {
      setDomainStatus({ checking: false, verified: false, hostname: '' });
      return;
    }

    if (!token) {
      setDomainStatus({ checking: false, verified: false, hostname });
      return;
    }

    let isMounted = true;
    setDomainStatus(prev => ({ ...prev, checking: true, hostname }));

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/domains/check/${hostname}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setDomainStatus({ checking: false, verified: !!data.verified, hostname });
          }
        }
      } catch (_) {
        if (isMounted) setDomainStatus({ checking: false, verified: false, hostname });
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [url, token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setCurrentStepId('crawling');
    setStepStates({
      crawling: 'in_progress',
      ssl_check: 'pending',
      dns_check: 'pending',
      file_check: 'pending',
      port_scan: 'pending',
      whois_check: 'pending',
      redirect_check: 'pending',
      robots_check: 'pending',
      load_test: mode === 'full' && ENABLE_LOAD_TESTING ? 'pending' : 'skipped',
      zap_init: useZap && ENABLE_ZAP_SCANS ? 'pending' : 'skipped',
      zap_spider: useZap && ENABLE_ZAP_SCANS ? 'pending' : 'skipped',
      zap_pscan: useZap && ENABLE_ZAP_SCANS ? 'pending' : 'skipped',
      zap_ascan: useZap && ENABLE_ZAP_SCANS ? 'pending' : 'skipped',
      zap_alerts: useZap && ENABLE_ZAP_SCANS ? 'pending' : 'skipped',
      ai_analysis: mode === 'full' && ENABLE_AI_FINDINGS ? 'pending' : 'skipped'
    });

    // 1. Establish socket.io connection
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', async () => {
      console.log('[socket] Connected to server, ID:', socket.id);
      
      // 2. Submit the scan request with socketId
      try {
        const res = await fetch(`${API_URL}/api/scan`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            url: url.trim(),
            consent: mode === 'quick' ? true : consent,
            mode,
            socketId: socket.id,
            authCookie: ENABLE_AUTHENTICATED_SCANS ? authCookie.trim() : '',
            authHeader: ENABLE_AUTHENTICATED_SCANS ? authHeader.trim() : '',
            delay: ENABLE_ACTIVE_SCANS ? delay : 0,
            useZap: ENABLE_ZAP_SCANS && useZap,
            zapScanMode: ENABLE_ZAP_SCANS && useZap ? zapScanMode : 'low',
            teamId: selectedWorkspace === 'personal' ? null : selectedWorkspace
          }),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Scan failed');
        }
        
        if (data.status === 'processing') {
          console.log('[ScanForm] ZAP scan is processing in the background, waiting for socket payload...');
          return;
        }

        // Redirect to results page using scanId
        socket.disconnect();
        router.push(`/results?scanId=${data.scanId}`);

      } catch (err) {
        setError(err.message);
        setLoading(false);
        setStepStates(prev => {
          const updated = { ...prev };
          Object.keys(updated).forEach(k => {
            if (updated[k] === 'in_progress') updated[k] = 'failed';
          });
          return updated;
        });
        socket.disconnect();
      }
    });

    socket.on('connect_error', () => {
      console.error('[socket] Connection error. Standard HTTP scan will continue without live progress.');
    });

    // 3. Listen to live scan progress events
    socket.on('scan_progress', (data) => {
      console.log('[socket] Progress event:', data);
      const { step, status } = data;
      
      setCurrentStepId(step);
      
      setStepStates((prev) => {
        const next = { ...prev };
        
        // Mark the current step status
        if (status === 'in_progress') {
          next[step] = 'in_progress';
          // Ticks are set strictly when step completed events arrive
        } else if (status === 'completed') {
          next[step] = 'completed';
        } else if (status === 'failed') {
          next[step] = 'failed';
        }
        
        if (mode === 'quick' || !ENABLE_LOAD_TESTING) {
          next.load_test = 'skipped';
        }

        if (mode === 'quick' || !ENABLE_AI_FINDINGS) {
          next.ai_analysis = 'skipped';
        }

        if (!useZap || !ENABLE_ZAP_SCANS) {
          next.zap_init = 'skipped';
          next.zap_spider = 'skipped';
          next.zap_pscan = 'skipped';
          next.zap_ascan = 'skipped';
          next.zap_alerts = 'skipped';
        }
        
        return next;
      });
    });

    // 4. Listen to final async ZAP completion event
    socket.on('scan_complete', (data) => {
      console.log('[socket] Scan complete received:', data);
      socket.disconnect();
      router.push(`/results?scanId=${data.scanId || (data.report && data.report.scanId)}`);
    });
  }

  const stepsList = [
    { id: 'crawling', label: 'Crawling & Asset Parsing' },
    { id: 'ssl_check', label: 'SSL/TLS Certificate Scan' },
    { id: 'dns_check', label: 'DNS Record Configuration' },
    { id: 'file_check', label: 'Sensitive File Checker' },
    { id: 'port_scan', label: 'Port Scanning Recon' },
    { id: 'whois_check', label: 'Domain Registry WHOIS' },
    { id: 'redirect_check', label: 'Redirect Chain Inspection' },
    { id: 'robots_check', label: 'Robots.txt Path Auditor' },
    ...(ENABLE_LOAD_TESTING ? [{ id: 'load_test', label: 'Load Resilience & Rate Limiting' }] : []),
    ...(useZap && ENABLE_ZAP_SCANS ? [
      { id: 'zap_init', label: 'Initializing Deep Inspection Engine' },
      { id: 'zap_spider', label: 'Deep Page & Asset Spidering' },
      { id: 'zap_pscan', label: 'Passive Header & Security Audit' },
      { id: 'zap_ascan', label: 'Active Vulnerability Payload Audit' },
      { id: 'zap_alerts', label: 'Compiling Threat Intelligence' }
    ] : []),
    ...(ENABLE_AI_FINDINGS ? [{ id: 'ai_analysis', label: 'AI Risk Threat Model' }] : [])
  ];

  function renderStepIcon(status) {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400 shrink-0" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />;
      case 'skipped':
        return <Circle className="h-5 w-5 text-slate-405 dark:text-slate-500 line-through opacity-50 shrink-0" />;
      default:
        return <Circle className="h-5 w-5 text-slate-300 dark:text-slate-700 shrink-0" />;
    }
  }

  function getStepStyle(status) {
    switch (status) {
      case 'completed':
        return 'text-emerald-600 dark:text-emerald-400 font-medium';
      case 'in_progress':
        return 'text-indigo-600 dark:text-indigo-400 font-bold';
      case 'failed':
        return 'text-rose-500 dark:text-rose-400';
      case 'skipped':
        return 'text-slate-405 dark:text-slate-500 line-through';
      default:
        return 'text-slate-500 dark:text-slate-400';
    }
  }

  // Calculate percentage based on completed steps
  const STEP_WEIGHTS = {
    crawling: 10,
    ssl_check: 15,
    dns_check: 10,
    file_check: 5,
    port_scan: 10,
    whois_check: 5,
    redirect_check: 5,
    robots_check: 5,
    load_test: 10,
    zap_init: 5,
    zap_spider: 5,
    zap_pscan: 5,
    zap_ascan: 5,
    zap_alerts: 5,
    ai_analysis: 5
  };

  const scanProgress = (() => {
    const relevantSteps = stepsList.filter(s => stepStates[s.id] !== 'skipped');
    if (relevantSteps.length === 0) return 0;
    const totalWeight = relevantSteps.reduce((sum, s) => sum + (STEP_WEIGHTS[s.id] || 5), 0);
    const completedWeight = relevantSteps
      .filter(s => stepStates[s.id] === 'completed')
      .reduce((sum, s) => sum + (STEP_WEIGHTS[s.id] || 5), 0);
    const inProgressWeight = relevantSteps
      .filter(s => stepStates[s.id] === 'in_progress')
      .reduce((sum, s) => sum + ((STEP_WEIGHTS[s.id] || 5) * 0.5), 0);
    return Math.min(99, Math.round(((completedWeight + inProgressWeight) / totalWeight) * 100));
  })();

  if (loading) {
    return (
      <div className="space-y-6 py-2">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary relative">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <ShieldCheck className="h-3.5 w-3.5 text-primary absolute" />
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-base font-bold text-foreground">Security Audit in Progress</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Executing deterministic vulnerability probes, SSL validation, and reconnaissance pipeline...
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Pipeline Completion</span>
            <span className="font-bold font-mono text-primary">{scanProgress}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden border border-border">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>

        {/* Real-time Timeline Steps */}
        <div className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-sm max-h-[340px] overflow-y-auto">
          {stepsList.map((step) => {
            const status = stepStates[step.id];
            return (
              <div
                key={step.id}
                className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0"
              >
                <span className={cn(
                  'font-medium transition-colors',
                  status === 'completed' && 'text-emerald-600 dark:text-emerald-400 font-semibold',
                  status === 'in_progress' && 'text-primary font-bold animate-pulse',
                  status === 'failed' && 'text-rose-600 dark:text-rose-400',
                  status === 'skipped' && 'text-muted-foreground/60 line-through',
                  status === 'pending' && 'text-muted-foreground'
                )}>
                  {step.label}
                </span>
                {renderStepIcon(status)}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-medium text-center">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {/* Scan Mode Toggle Cards */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Audit Depth & Analysis Profile
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('quick')}
            className={cn(
              'p-3.5 rounded-lg border text-left transition-all relative flex flex-col justify-between',
              mode === 'quick'
                ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                : 'border-border bg-card hover:border-border/80 hover:bg-muted/40'
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Quick Headers</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">~5s</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Passive analysis of SSL/TLS certificates, DNS records, HTTP security headers, and CORS policy.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('full')}
            className={cn(
              'p-3.5 rounded-lg border text-left transition-all relative flex flex-col justify-between',
              mode === 'full'
                ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                : 'border-border bg-card hover:border-border/80 hover:bg-muted/40'
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Full VAPT Audit</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">Comprehensive</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Full deterministic crawl, passive reconnaissance, endpoint discovery, port audit, and AI analysis.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Target Workspace Selector (If logged in with workspaces) */}
      {workspaces.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="workspaceSelect" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Target Workspace
          </label>
          <select
            id="workspaceSelect"
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs font-medium text-foreground transition-all shadow-sm"
          >
            <option value="personal">Personal Workspace (Private Scan)</option>
            {workspaces.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name} (Shared Team Workspace)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Target URL */}
      <div className="space-y-2">
        <label htmlFor="url" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Target Domain or URL
        </label>
        <div className="relative">
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.com or https://example.com"
            required
            className="w-full px-3.5 py-2.5 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all shadow-sm font-mono text-sm"
          />
        </div>

        {/* Domain Verification Status Indicator */}
        {domainStatus.hostname && (
          <div className="pt-1">
            {domainStatus.verified ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Verified Domain: Full active scanning & vulnerability fuzzing enabled</span>
              </div>
            ) : mode === 'full' ? (
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/50 border border-border px-3 py-2 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Unverified domain: Passive reconnaissance and deterministic checks will run.</span>
                </div>
                <Link
                  href="/domains"
                  className="text-primary hover:underline font-semibold flex items-center gap-0.5 whitespace-nowrap"
                >
                  Verify <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Advanced Settings Toggle */}
      {ENABLE_AUTHENTICATED_SCANS && (
        <div className="border border-border rounded-lg bg-card overflow-hidden transition-all shadow-sm">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-primary" />
              Advanced Authentication (Optional)
            </span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showAdvanced && (
            <div className="p-4 border-t border-border space-y-4 bg-muted/20">
              <div>
                <label htmlFor="authCookie" className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Session Cookie
                </label>
                <input
                  id="authCookie"
                  type="text"
                  value={authCookie}
                  onChange={(e) => setAuthCookie(e.target.value)}
                  placeholder="PHPSESSID=abcdef123456...; security=low"
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono text-foreground placeholder:text-muted-foreground transition-all"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Format as `Name=Value; Name2=Value2` to audit protected pages.
                </p>
              </div>
              <div>
                <label htmlFor="authHeader" className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Authorization Header
                </label>
                <input
                  id="authHeader"
                  type="text"
                  value={authHeader}
                  onChange={(e) => setAuthHeader(e.target.value)}
                  placeholder="Bearer eyJhbGciOiJIUzI1Ni..."
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono text-foreground placeholder:text-muted-foreground transition-all"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Injected into outbound requests for API / token authenticated audits.
                </p>
              </div>
              {ENABLE_ACTIVE_SCANS && (
                <div>
                  <label htmlFor="delay" className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Scan Rate Throttling: {delay} ms
                  </label>
                  <input
                    id="delay"
                    type="range"
                    min="0"
                    max="2000"
                    step="100"
                    value={delay}
                    onChange={(e) => setDelay(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Adds request delay between active probes to avoid server strain.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Consent Checkbox */}
      {mode === 'full' && (ENABLE_ACTIVE_SCANS || ENABLE_ZAP_SCANS || ENABLE_LOAD_TESTING) && (
        <div className="flex items-start gap-3 p-3 bg-muted/40 border border-border rounded-lg">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            className="w-4 h-4 text-primary border-border rounded bg-card focus:ring-primary mt-0.5 cursor-pointer"
          />
          <label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
            I certify that I am authorized to scan this target domain. Unauthorized scanning may violate computer security regulations.
          </label>
        </div>
      )}

      {/* Deep Security Scan (OWASP ZAP) Checkbox */}
      {mode === 'full' && ENABLE_ZAP_SCANS && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-muted/40 border border-border rounded-lg">
            <input
              id="useZap"
              type="checkbox"
              checked={useZap}
              onChange={(e) => setUseZap(e.target.checked)}
              className="w-4 h-4 text-primary border-border rounded bg-card focus:ring-primary mt-0.5 cursor-pointer"
            />
            <label htmlFor="useZap" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
              <span className="font-semibold text-foreground block mb-0.5">Deep Security Scan (OWASP ZAP)</span>
              Enables active vulnerability injection probes, target endpoint spidering, and passive analysis.
            </label>
          </div>

          {useZap && (
            <div className="flex flex-col gap-1.5 p-3 bg-muted/40 border border-border rounded-lg">
              <label htmlFor="zapScanMode" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ZAP Scan Intensity
              </label>
              <select
                id="zapScanMode"
                value={zapScanMode}
                onChange={(e) => setZapScanMode(e.target.value)}
                className="w-full px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-xs font-medium text-foreground transition-all shadow-sm cursor-pointer"
              >
                <option value="low">Quick / Minimal (Low Memory & Fast)</option>
                <option value="medium">Balanced (Standard Auditing)</option>
                <option value="high">Deep / Full (Thorough Injection Payloads)</option>
              </select>
              <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                {zapScanMode === 'low' && 'Minimal payloads and 20-page spider limit. Fast and lightweight.'}
                {zapScanMode === 'medium' && 'Standard audit with moderate payloads and 100-page spider limit.'}
                {zapScanMode === 'high' && 'Thorough scan with high-intensity payloads and 500-page spider limit.'}
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-medium text-center">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        size="lg"
        className="w-full gap-2 font-semibold shadow-sm"
      >
        <ShieldCheck className="h-4 w-4" />
        <span>Start Security Scan</span>
      </Button>
    </form>
  );
}
