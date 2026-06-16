'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import AuditReport from '../../components/AuditReport';
import LinksSection from '@/components/LinksSection';
import Footer from '../../components/Footer';
import { Button } from '../../components/ui/Button';

export default function ResultsPage() {
  const [result, setResult] = useState(null);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('scanResult');
    setResult(stored ? JSON.parse(stored) : null);
    setHasChecked(true);
  }, []);

  if (!hasChecked) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="animate-pulse text-slate-500">Loading results...</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-8">
          <p className="text-slate-600 mb-6">No scan results found.</p>
          <Button asChild>
            <Link href="/">Start a new scan</Link>
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900 mb-6 inline-block">
            New scan
          </Link>
          <AuditReport result={result} />
          <div className="border rounded-xl border-gray-200 bg-white p-6 shadow-sm mt-10">
            <LinksSection links={result.links ?? {}} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
