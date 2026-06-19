'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { CheckCircle2, Loader2, Circle, AlertCircle, ShieldCheck } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ScanForm() {
  const [url, setUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState('full'); // 'quick' or 'full'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [currentStepId, setCurrentStepId] = useState(null);
  const [stepStates, setStepStates] = useState({
    crawling: 'pending',
    ssl_check: 'pending',
    dns_check: 'pending',
    file_check: 'pending',
    port_scan: 'pending',
    whois_check: 'pending',
    redirect_check: 'pending',
    robots_check: 'pending',
    ai_analysis: 'pending'
  });

  const socketRef = useRef(null);
  const router = useRouter();

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
      ai_analysis: mode === 'quick' ? 'skipped' : 'pending'
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: url.trim(),
            consent: mode === 'quick' ? true : consent, // Quick scan runs passively, full scan needs consent
            mode,
            socketId: socket.id
          }),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Scan failed');
        }
        
        // Save scan result
        sessionStorage.setItem('scanResult', JSON.stringify(data));
        
        // Final transition to complete
        setStepStates(prev => ({
          ...prev,
          crawling: 'completed',
          ssl_check: 'completed',
          dns_check: 'completed',
          file_check: 'completed',
          port_scan: 'completed',
          whois_check: 'completed',
          redirect_check: 'completed',
          robots_check: 'completed',
          ai_analysis: mode === 'quick' ? 'skipped' : 'completed'
        }));
        
        // Redirect to results page
        setTimeout(() => {
          socket.disconnect();
          router.push('/results');
        }, 800);

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
          // Mark any previous steps as completed if they are still pending
          const stepOrder = [
            'crawling',
            'ssl_check',
            'dns_check',
            'file_check',
            'port_scan',
            'whois_check',
            'redirect_check',
            'robots_check',
            'ai_analysis'
          ];
          const currentIndex = stepOrder.indexOf(step);
          for (let i = 0; i < currentIndex; i++) {
            const prevStep = stepOrder[i];
            if (next[prevStep] === 'pending' || next[prevStep] === 'in_progress') {
              next[prevStep] = 'completed';
            }
          }
        } else if (status === 'completed') {
          next[step] = 'completed';
        } else if (status === 'failed') {
          next[step] = 'failed';
        }
        
        if (mode === 'quick') {
          next.ai_analysis = 'skipped';
        }
        
        return next;
      });
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
    { id: 'ai_analysis', label: 'AI Risk Threat Model' }
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
            <h3 className="text-lg font-bold text-white">VAPT Security Scan Running</h3>
            <p className="text-xs text-slate-400 mt-1">Analyzing network vulnerabilities and config maps...</p>
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
            Quick Scan (Header VAPT)
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
            Full Scan (Deep AI Threat)
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

      {/* Consent Checkbox (only show for full scan) */}
      {mode === 'full' && (
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
