'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import AuditReport from '../../components/AuditReport';
import Footer from '../../components/Footer';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function ResultsPage() {
  const [result, setResult] = useState(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('scanResult');
      setResult(stored ? JSON.parse(stored) : null);
    } catch (e) {
      console.error('Failed to parse scanResult', e);
      setResult(null);
    }
    setHasChecked(true);
  }, []);

  if (!hasChecked) {
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
            <p className="text-slate-400 font-medium mb-6">No security scan results were found in your session.</p>
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
          <AuditReport result={result} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
