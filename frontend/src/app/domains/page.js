'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { 
  ShieldCheck, 
  Globe, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  FileCode, 
  KeyRound, 
  ExternalLink,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function DomainsPage() {
  const { user, token: authContextToken } = useAuth();
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [hostnameInput, setHostnameInput] = useState('');
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [activeTab, setActiveTab] = useState('dns'); // 'dns' or 'file'
  const [error, setError] = useState(null);
  const [verifyMessage, setVerifyMessage] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  const getAuthHeader = () => {
    const token = authContextToken || (typeof window !== 'undefined' ? localStorage.getItem('vapt_auth_token') : null);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  useEffect(() => {
    if (user) {
      fetchDomains();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/domains`, {
        headers: getAuthHeader(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setDomains(data.domains || []);
        if (data.domains && data.domains.length > 0 && !selectedDomain) {
          const unverified = data.domains.find(d => !d.verified);
          setSelectedDomain(unverified || data.domains[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch domains:', err);
      setError('Could not load domains. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDomain = async (e) => {
    e.preventDefault();
    if (!hostnameInput.trim()) return;
    setError(null);
    setVerifyMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/domains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify({ hostname: hostnameInput.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add domain');
      }

      setHostnameInput('');
      await fetchDomains();
      if (data.domain) {
        setSelectedDomain(data.domain);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (domainId) => {
    setVerifyingId(domainId);
    setVerifyMessage(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/domains/${domainId}/verify`, {
        method: 'POST',
        headers: getAuthHeader(),
        credentials: 'include'
      });

      const data = await res.json();
      if (data.verified) {
        setVerifyMessage({
          type: 'success',
          text: `Domain verified successfully via ${data.domain?.verificationMethod || 'ownership check'}!`
        });
        await fetchDomains();
        if (data.domain) {
          setSelectedDomain(data.domain);
        }
      } else {
        setVerifyMessage({
          type: 'warning',
          text: data.message || 'Verification record not found yet. DNS changes may take a few minutes to propagate.'
        });
      }
    } catch (err) {
      setVerifyMessage({
        type: 'error',
        text: 'Failed to complete verification. Please verify the record and try again.'
      });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (domainId) => {
    if (!confirm('Are you sure you want to remove this domain?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/domains/${domainId}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
        credentials: 'include'
      });
      if (res.ok) {
        if (selectedDomain?._id === domainId) {
          setSelectedDomain(null);
        }
        await fetchDomains();
      }
    } catch (err) {
      console.error('Failed to delete domain:', err);
    }
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Navbar />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Domain Ownership Verification</h1>
          <p className="text-slate-400 max-w-md mx-auto mb-8">
            Sign in to verify your domains and unlock active VAPT vulnerability fuzzing, load testing, and authenticated scanning.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/25 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition-all"
            >
              Create Account
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Domain Ownership Verification
            </h1>
          </div>
          <p className="text-slate-400 text-sm sm:text-base max-w-3xl">
            Prove control over your domains to safely execute active vulnerability fuzzing, SQLi/XSS probing, and load resilience tests. Passive scans remain unhindered.
          </p>
        </div>

        {/* Add Domain Input Bar */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 sm:p-6 mb-8 backdrop-blur-sm shadow-xl">
          <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={hostnameInput}
                onChange={(e) => setHostnameInput(e.target.value)}
                placeholder="Enter domain or hostname (e.g. app.mycompany.com)"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={submitting || !hostnameInput.trim()}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all whitespace-nowrap"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Domain
            </button>
          </form>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-rose-400 text-xs sm:text-sm bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Main Grid: Domain List & Verification Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Domain List Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Your Domains ({domains.length})
              </h2>
            </div>

            {loading ? (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-sm">Loading domains...</span>
              </div>
            ) : domains.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 text-center text-slate-400">
                <Globe className="w-10 h-10 mx-auto mb-3 text-slate-600" />
                <p className="font-medium text-sm text-slate-300">No domains registered yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Add your domain above to generate ownership verification tokens.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {domains.map((d) => {
                  const isSelected = selectedDomain?._id === d._id;
                  return (
                    <div
                      key={d._id}
                      onClick={() => setSelectedDomain(d)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-indigo-950/30 border-indigo-500/50 shadow-md ring-1 ring-indigo-500/20'
                          : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white font-mono truncate">
                            {d.hostname}
                          </span>
                          {d.verified ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {d.verified
                            ? `Verified via ${d.verificationMethod || 'DNS'} on ${new Date(d.verifiedAt || d.createdAt).toLocaleDateString()}`
                            : 'Requires DNS or File verification'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(d._id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Delete domain"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isSelected ? 'rotate-90 text-indigo-400' : ''}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Verification Details Column (7 cols) */}
          <div className="lg:col-span-7">
            {selectedDomain ? (
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
                {/* Domain Title & Badge */}
                <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Verification Setup
                    </span>
                    <h3 className="text-xl font-bold text-white font-mono mt-0.5">
                      {selectedDomain.hostname}
                    </h3>
                  </div>
                  {selectedDomain.verified ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      <ShieldCheck className="w-4 h-4" /> Active Audits Unlocked
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                      <Clock className="w-4 h-4" /> Verification Required
                    </div>
                  )}
                </div>

                {verifyMessage && (
                  <div
                    className={`mt-4 p-3.5 rounded-xl border flex items-center gap-2.5 text-xs sm:text-sm ${
                      verifyMessage.type === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : verifyMessage.type === 'warning'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                    }`}
                  >
                    {verifyMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{verifyMessage.text}</span>
                  </div>
                )}

                {selectedDomain.verified ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">Domain Ownership Confirmed</h4>
                      <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto mt-1">
                        You can now perform full active scans, input fuzzing, and load resilience audits on <span className="text-indigo-400 font-mono font-semibold">{selectedDomain.hostname}</span>.
                      </p>
                    </div>
                    <div className="pt-2">
                      <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm transition-all shadow-lg shadow-indigo-600/20"
                      >
                        Start Deep Scan Now <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    {/* Method Selector Tabs */}
                    <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setActiveTab('dns')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          activeTab === 'dns'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <KeyRound className="w-3.5 h-3.5" /> Option 1: DNS TXT Record (Recommended)
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('file')}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          activeTab === 'file'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <FileCode className="w-3.5 h-3.5" /> Option 2: File Upload (.well-known)
                      </button>
                    </div>

                    {/* Tab 1: DNS TXT */}
                    {activeTab === 'dns' && (
                      <div className="space-y-4 animate-fadeIn">
                        <p className="text-xs text-slate-400">
                          Add the following TXT record to your domain&apos;s DNS manager (Cloudflare, Route53, Namecheap, etc.):
                        </p>

                        <div className="space-y-3">
                          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span>Record Type</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-indigo-400">TXT</span>
                          </div>

                          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span>Host / Name</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(`_scanverify.${selectedDomain.hostname}`, 'dns_host')}
                                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
                              >
                                {copiedField === 'dns_host' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copiedField === 'dns_host' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <span className="text-xs font-mono text-slate-200 select-all break-all">
                              {`_scanverify.${selectedDomain.hostname}`}
                            </span>
                          </div>

                          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span>TXT Value / Content</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(`scanverify=${selectedDomain.verificationToken}`, 'dns_val')}
                                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
                              >
                                {copiedField === 'dns_val' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copiedField === 'dns_val' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <span className="text-xs font-mono text-emerald-400 select-all break-all font-semibold">
                              {`scanverify=${selectedDomain.verificationToken}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: File Upload */}
                    {activeTab === 'file' && (
                      <div className="space-y-4 animate-fadeIn">
                        <p className="text-xs text-slate-400">
                          Create and host a file on your server at the exact URL below containing only your verification token:
                        </p>

                        <div className="space-y-3">
                          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span>File URL</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(`https://${selectedDomain.hostname}/.well-known/scanverify-${selectedDomain.verificationToken}.txt`, 'file_url')}
                                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
                              >
                                {copiedField === 'file_url' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copiedField === 'file_url' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <span className="text-xs font-mono text-indigo-400 select-all break-all">
                              {`https://${selectedDomain.hostname}/.well-known/scanverify-${selectedDomain.verificationToken}.txt`}
                            </span>
                          </div>

                          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                              <span>File Content</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(selectedDomain.verificationToken, 'file_content')}
                                className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
                              >
                                {copiedField === 'file_content' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {copiedField === 'file_content' ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <span className="text-xs font-mono text-emerald-400 select-all break-all font-semibold">
                              {selectedDomain.verificationToken}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Verify Action Button */}
                    <div className="pt-3">
                      <button
                        type="button"
                        onClick={() => handleVerify(selectedDomain._id)}
                        disabled={verifyingId === selectedDomain._id}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                      >
                        {verifyingId === selectedDomain._id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Checking DNS & HTTPS Records...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            Check Verification Now
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-500 flex flex-col items-center justify-center h-full min-h-[300px]">
                <ShieldAlert className="w-12 h-12 mb-3 text-slate-700" />
                <p className="font-semibold text-slate-400 text-sm">Select or add a domain</p>
                <p className="text-xs text-slate-600 mt-1 max-w-xs">
                  Choose a domain from the list on the left or register a new one to view verification instructions.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
