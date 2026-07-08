'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { CheckCircle2, Loader2, Circle, AlertCircle, ShieldCheck, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ENABLE_ACTIVE_SCANS = process.env.NEXT_PUBLIC_ENABLE_ACTIVE_SCANS === 'true';
const ENABLE_ZAP_SCANS = process.env.NEXT_PUBLIC_ENABLE_ZAP_SCANS === 'true';
const ENABLE_LOAD_TESTING = process.env.NEXT_PUBLIC_ENABLE_LOAD_TESTING === 'true';
const ENABLE_AUTHENTICATED_SCANS = process.env.NEXT_PUBLIC_ENABLE_AUTHENTICATED_SCANS === 'true';
const ENABLE_AI_FINDINGS = process.env.NEXT_PUBLIC_ENABLE_AI_FINDINGS === 'true';

export default function ScanForm() {
  const [url, setUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState('full'); // 'quick' or 'full'
  const [useZap, setUseZap] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [currentStepId, setCurrentStepId] = useState(null);
  const [authCookie, setAuthCookie] = useState('');
  const [authHeader, setAuthHeader] = useState('');
  const [delay, setDelay] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
  const { token } = useAuth();

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

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
            useZap: ENABLE_ZAP_SCANS && useZap
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
      { id: 'zap_init', label: 'Initializing ZAP Interface' },
      { id: 'zap_spider', label: 'ZAP Crawler Spidering' },
      { id: 'zap_pscan', label: 'ZAP Passive Analysis' },
      { id: 'zap_ascan', label: 'ZAP Active Scan Payloads' },
      { id: 'zap_alerts', label: 'Compiling ZAP Findings' }
    ] : []),
    ...(ENABLE_AI_FINDINGS ? [{ id: 'ai_analysis', label: 'AI Risk Threat Model' }] : [])
  ];

  function renderStepIcon(status) {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-indigo-400 animate-spin shrink-0" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />;
      case 'skipped':
        return <Circle className="h-5 w-5 text-slate-500 line-through opacity-50 shrink-0" />;
      default:
        return <Circle className="h-5 w-5 text-slate-700 shrink-0" />;
    }
  }

  function getStepStyle(status) {
    switch (status) {
      case 'completed':
        return 'text-emerald-400 font-medium';
      case 'in_progress':
        return 'text-indigo-400 font-bold';
      case 'failed':
        return 'text-rose-400';
      case 'skipped':
        return 'text-slate-500 line-through';
      default:
        return 'text-slate-400';
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 py-4">
        <div className="flex flex-col items-center justify-center space-y-4 mb-6">
          <div className="relative flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
            <ShieldCheck className="h-5 w-5 text-indigo-400 absolute" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-white">Security Audit Running</h3>
            <p className="text-xs text-slate-400 mt-1">Collecting observed SSL, DNS, header, crawl, and configuration data...</p>
          </div>
        </div>

        <div className="space-y-3 bg-slate-950/80 p-5 rounded-2xl border border-slate-800">
          {stepsList.map((step) => {
            const status = stepStates[step.id];
            return (
              <div key={step.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-900 last:border-0">
                <span className={getStepStyle(status)}>{step.label}</span>
                {renderStepIcon(status)}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      {/* Scan Mode Toggle */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Select Audit Depth
        </label>
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('quick')}
            className={`py-2 px-3 text-sm font-medium rounded-lg transition-all ${
              mode === 'quick'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Quick Headers
          </button>
          <button
            type="button"
            onClick={() => setMode('full')}
            className={`py-2 px-3 text-sm font-medium rounded-lg transition-all ${
              mode === 'full'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Full Deterministic
          </button>
        </div>
      </div>

      {/* Target URL */}
      <div>
        <label htmlFor="url" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Target Domain / URL
        </label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          className="w-full px-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-slate-500 transition-all"
        />
      </div>

      {/* Advanced Settings Toggle */}
      {ENABLE_AUTHENTICATED_SCANS && (
      <div className="border border-slate-800/80 rounded-xl bg-slate-950/40 overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider hover:bg-slate-900/40 active:bg-slate-900/60 transition-all"
        >
          <span className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-indigo-400" />
            Advanced Authentication (Optional)
          </span>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </button>
        {showAdvanced && (
          <div className="p-4 border-t border-slate-800/80 space-y-4 bg-slate-950/20">
            <div>
              <label htmlFor="authCookie" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Session Cookie
              </label>
              <input
                id="authCookie"
                type="text"
                value={authCookie}
                onChange={(e) => setAuthCookie(e.target.value)}
                placeholder="PHPSESSID=abcdef123456...; security=low"
                className="w-full px-3 py-2 bg-slate-950/90 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-white placeholder-slate-600 transition-all"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Used to bypass authentication paywalls. Format as `Name=Value; Name2=Value2`.
              </p>
            </div>
            <div>
              <label htmlFor="authHeader" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Authorization Header
              </label>
              <input
                id="authHeader"
                type="text"
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value)}
                placeholder="Bearer eyJhbGciOiJIUzI1Ni..."
                className="w-full px-3 py-2 bg-slate-950/90 border border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm text-white placeholder-slate-600 transition-all"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Custom Authorization or token header injected into every outbound request.
              </p>
            </div>
            {ENABLE_ACTIVE_SCANS && (
            <div>
              <label htmlFor="delay" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
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
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Introduces a request delay between active form inputs probes. Higher values reduce target server load and bypass active rate-limit blocklists.
              </p>
            </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Consent Checkbox (only show for full scan) */}
      {mode === 'full' && (ENABLE_ACTIVE_SCANS || ENABLE_ZAP_SCANS || ENABLE_LOAD_TESTING) && (
        <div className="flex items-start gap-3 p-3 bg-slate-950/30 border border-slate-800/40 rounded-xl">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
            className="w-4 h-4 text-indigo-600 border-slate-700 rounded bg-slate-900 focus:ring-indigo-500 mt-1 cursor-pointer"
          />
          <label htmlFor="consent" className="text-xs text-slate-400 leading-normal cursor-pointer select-none">
            I certify that I am authorized to scan this target domain. Unauthorized scanning may violate computer trespass regulations.
          </label>
        </div>
      )}

      {/* Deep Security Scan (OWASP ZAP) Checkbox */}
      {mode === 'full' && ENABLE_ZAP_SCANS && (
        <div className="flex items-start gap-3 p-3 bg-slate-950/30 border border-slate-800/40 rounded-xl mt-3">
          <input
            id="useZap"
            type="checkbox"
            checked={useZap}
            onChange={(e) => setUseZap(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-slate-700 rounded bg-slate-900 focus:ring-indigo-500 mt-1 cursor-pointer"
          />
          <label htmlFor="useZap" className="text-xs text-slate-400 leading-normal cursor-pointer select-none">
            <span className="font-semibold text-slate-200 block mb-0.5">Deep Security Scan (OWASP ZAP)</span>
            Enables active vulnerability injection probes, target endpoint spidering, and passive analysis using OWASP ZAP container.
          </label>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
      >
        <span>Initialize Security Audit</span>
      </button>
    </form>
  );
}
