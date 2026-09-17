'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard, SkeletonTable } from '@/components/ui/Skeleton';
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
  ChevronRight,
  ExternalLink,
  Shield
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
  const [activeTab, setActiveTab] = useState('dns');
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
      setSelectedDomain(data.domain);
      await fetchDomains();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (domainId, method) => {
    setVerifyingId(domainId);
    setError(null);
    setVerifyMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/domains/${domainId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify({ method })
      });

      const data = await res.json();
      if (res.ok && data.verified) {
        setVerifyMessage({ type: 'success', text: 'Domain ownership verified successfully! Full VAPT probes are now unlocked.' });
        await fetchDomains();
        if (selectedDomain?._id === domainId) {
          setSelectedDomain(prev => ({ ...prev, verified: true, verificationMethod: method }));
        }
      } else {
        setVerifyMessage({ type: 'error', text: data.message || 'Verification failed. Please ensure records are deployed.' });
      }
    } catch (err) {
      setVerifyMessage({ type: 'error', text: 'Network error during verification. Try again later.' });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDelete = async (domainId, e) => {
    e.stopPropagation();
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

  return (
    <AppShell>
      <div className="space-y-8">
        
        {/* Header */}
        <PageHeader
          title="Protected Domains"
          description="Manage verified web assets to unlock active vulnerability fuzzing, authorized attack surface probes, and automated continuous monitoring."
          badge={
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
              Asset Management
            </span>
          }
        />

        {/* Add Domain Bar */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={hostnameInput}
                onChange={(e) => setHostnameInput(e.target.value)}
                placeholder="Enter domain or hostname (e.g. app.example.com)"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono transition-colors"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting || !hostnameInput.trim()}
              className="gap-2 shrink-0"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Domain
            </Button>
          </form>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Main Grid: Domain List & Verification Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Domain List Column (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Your Domains ({domains.length})
              </h2>
            </div>

            {loading ? (
              <div className="space-y-3">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : domains.length === 0 ? (
              <EmptyState
                icon={Globe}
                title="No domains added yet"
                description="Add your first hostname above to generate ownership verification tokens and unlock active security scans."
              />
            ) : (
              <div className="space-y-2.5">
                {domains.map((d) => {
                  const isSelected = selectedDomain?._id === d._id;
                  return (
                    <div
                      key={d._id}
                      onClick={() => setSelectedDomain(d)}
                      className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary'
                          : 'bg-card border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground font-mono truncate">
                            {d.hostname}
                          </span>
                          {d.verified ? (
                            <StatusBadge status="healthy">Verified</StatusBadge>
                          ) : (
                            <StatusBadge status="warning">Pending</StatusBadge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {d.verified
                            ? `Verified via ${d.verificationMethod || 'DNS'}`
                            : 'Requires verification'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleDelete(d._id, e)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Remove domain"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-6">
                
                {/* Domain Card Header */}
                <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground font-mono">
                        {selectedDomain.hostname}
                      </h3>
                      {selectedDomain.verified ? (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Active Asset
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Action Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added on {new Date(selectedDomain.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <Link href={`/?url=${encodeURIComponent(selectedDomain.hostname)}`}>
                    <Button size="sm" variant="outline" className="gap-1 text-xs">
                      <Shield className="h-3.5 w-3.5" /> Scan Now
                    </Button>
                  </Link>
                </div>

                {/* Verification Feedback Banner */}
                {verifyMessage && (
                  <div className={`p-3.5 rounded-lg text-xs font-medium border flex items-center gap-2 ${
                    verifyMessage.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                  }`}>
                    {verifyMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{verifyMessage.text}</span>
                  </div>
                )}

                {/* Method Selector Tabs */}
                {!selectedDomain.verified ? (
                  <div className="space-y-4">
                    <div className="flex border-b border-border text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setActiveTab('dns')}
                        className={`pb-2.5 px-4 transition-colors relative font-semibold ${
                          activeTab === 'dns'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <KeyRound className="w-3.5 h-3.5" /> Method 1: DNS TXT Record (Recommended)
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('file')}
                        className={`pb-2.5 px-4 transition-colors relative font-semibold ${
                          activeTab === 'file'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <FileCode className="w-3.5 h-3.5" /> Method 2: HTML Verification File
                        </span>
                      </button>
                    </div>

                    {activeTab === 'dns' ? (
                      <div className="space-y-4 text-xs">
                        <p className="text-muted-foreground leading-relaxed">
                          Add the following TXT record to your domain&apos;s DNS management console (Cloudflare, Route53, GoDaddy, etc.).
                        </p>

                        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3.5 font-mono text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Record Type:</span>
                            <span className="font-bold text-foreground">TXT</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Host / Name:</span>
                            <span className="font-bold text-foreground">@ or {selectedDomain.hostname}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-border">
                            <span className="text-muted-foreground">Value / Content:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary truncate max-w-xs">{selectedDomain.dnsTxtToken}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(selectedDomain.dnsTxtToken, 'txt')}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                {copiedField === 'txt' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleVerify(selectedDomain._id, 'dns')}
                          disabled={verifyingId === selectedDomain._id}
                          className="w-full gap-2 text-xs"
                        >
                          {verifyingId === selectedDomain._id && <RefreshCw className="w-4 h-4 animate-spin" />}
                          Check DNS TXT Record Now
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 text-xs">
                        <p className="text-muted-foreground leading-relaxed">
                          Upload a verification file to your root web server so it responds at the following URL:
                        </p>

                        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3.5 font-mono text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">File Name:</span>
                            <span className="font-bold text-foreground">{selectedDomain.fileVerificationName}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-border">
                            <span className="text-muted-foreground">File Content:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary truncate max-w-xs">{selectedDomain.fileVerificationContent}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(selectedDomain.fileVerificationContent, 'file')}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                {copiedField === 'file' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleVerify(selectedDomain._id, 'file')}
                          disabled={verifyingId === selectedDomain._id}
                          className="w-full gap-2 text-xs"
                        >
                          {verifyingId === selectedDomain._id && <RefreshCw className="w-4 h-4 animate-spin" />}
                          Check Verification File Now
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-6 text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <h4 className="text-base font-bold text-foreground">Ownership Verified</h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      This domain is verified under your account. Full active vulnerability tests, SQL injection payloads, and continuous monitoring are active.
                    </p>
                  </div>
                )}

              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card/50 p-12 text-center text-muted-foreground text-xs">
                Select a domain from the list to view ownership verification details.
              </div>
            )}
          </div>

        </div>

      </div>
    </AppShell>
  );
}
