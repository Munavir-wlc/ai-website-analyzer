'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { Button } from '../../components/ui/Button';
import { Shield, Eye, Calendar, ExternalLink, RefreshCw, AlertCircle, Search } from 'lucide-react';

export default function HistoryPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
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

  const filteredScans = scans.filter(scan => 
    scan.url.toLowerCase().includes(search.toLowerCase())
  );

  const getGradeBadgeColor = (grade) => {
    const g = String(grade).toUpperCase();
    if (g === 'A') return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    if (g === 'B') return 'bg-teal-500/10 border-teal-500/30 text-teal-400';
    if (g === 'C') return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    if (g === 'D') return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
    return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
  };

  if (authLoading || (loading && scans.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-center gap-3 text-indigo-400 font-semibold">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading scan history...
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white animate-fade-in">Audit History</h1>
            <p className="text-slate-400 text-sm mt-1">
              Browse and review your previous security vulnerability and passive recon scans
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white py-2.5 px-5 shadow-lg shadow-indigo-500/25 transition-all text-sm"
          >
            Start New Scan
          </Link>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm mb-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Filters / Search */}
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 mb-6 flex items-center relative">
          <Search className="absolute left-7 h-5 w-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by target URL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-slate-850 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
          />
        </div>

        {/* Scan List */}
        {filteredScans.length === 0 ? (
          <div className="bg-slate-900/30 border border-slate-850 rounded-3xl p-16 text-center shadow-inner">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 mb-6">
              <Shield className="h-7 w-7 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No scans found</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mb-6">
              {search ? "No results matching your search terms." : "You haven't run any website scans yet. Let's perform your first security assessment!"}
            </p>
            {!search && (
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-6 shadow-lg shadow-indigo-500/20 text-sm"
              >
                Run First Scan
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md relative">
            <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/5 to-purple-500/0 rounded-3xl -z-10" />
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-4 px-6">Scanned URL</th>
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6 text-center">Mode</th>
                    <th className="py-4 px-6 text-center">Score</th>
                    <th className="py-4 px-6 text-center">Grade</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm text-slate-300">
                  {filteredScans.map((scan) => (
                    <tr key={scan.scanId} className="hover:bg-slate-900/30 transition-colors">
                      <td className="py-4.5 px-6 font-semibold text-white truncate max-w-xs sm:max-w-md" title={scan.url}>
                        {scan.url}
                      </td>
                      <td className="py-4.5 px-6 whitespace-nowrap text-slate-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-500" />
                          {new Date(scan.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-4.5 px-6 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          scan.scanMode === 'full' 
                            ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' 
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        }`}>
                          {scan.scanMode}
                        </span>
                      </td>
                      <td className="py-4.5 px-6 text-center font-bold text-white whitespace-nowrap">
                        {scan.score}/100
                      </td>
                      <td className="py-4.5 px-6 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center font-bold h-7 w-7 rounded-full border text-xs ${getGradeBadgeColor(scan.grade)}`}>
                          {scan.grade}
                        </span>
                      </td>
                      <td className="py-4.5 px-6 text-right whitespace-nowrap">
                        <Link 
                          href={`/results?scanId=${scan.scanId}`} 
                          className="inline-flex items-center gap-1.5 font-semibold text-slate-400 hover:text-white hover:bg-slate-800 h-9 px-3 rounded-xl text-sm transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          View
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
