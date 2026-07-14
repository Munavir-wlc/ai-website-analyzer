'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import AuditReport from '../../components/AuditReport';
import Footer from '../../components/Footer';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';

export default function ResultsPage() {
  const { token, loading: authLoading } = useAuth();
  const [result, setResult] = useState(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [screenshots, setScreenshots] = useState({ loading: false, desktop: null, mobile: null, error: null });
  const [errorMsg, setErrorMsg] = useState(null);

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
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 text-indigo-400 font-semibold">
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
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative">
            <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/20 to-purple-500/0 rounded-3xl -z-10" />
            <p className="text-slate-400 font-medium mb-6">{errorMsg || 'No security scan results were found in your session.'}</p>
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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex justify-between items-center print:hidden">
            <Link
               href="/"
               className="text-sm font-semibold text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Start New Scan
            </Link>
          </div>
          <AuditReport result={result} screenshots={screenshots} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
