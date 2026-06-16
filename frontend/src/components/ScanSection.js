'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Shield, Zap, Loader2, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { cn } from '@/lib/utils';

import { runScan } from '@/lib/api';

const SCAN_OPTIONS = [
  {
    id: 'seo',
    label: 'SEO Scan',
    description: 'Analyze SEO structure, metadata, headings, and performance.',
    icon: Search,
    color: 'emerald',
  },
  {
    id: 'site',
    label: 'Site Audit',
    description: 'Crawl 50–75 pages, find broken links, duplicates, mixed content.',
    icon: Globe,
    color: 'blue',
  },
  {
    id: 'vapt',
    label: 'VAPT Scan',
    description: 'Detect security vulnerabilities and missing security headers.',
    icon: Shield,
    color: 'amber',
  },
  {
    id: 'full',
    label: 'Full Scan',
    description: 'Run complete SEO and security audit.',
    icon: Zap,
    color: 'violet',
  },
];

export default function ScanSection() {
  const [url, setUrl] = useState('');
  const [scanType, setScanType] = useState('seo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await runScan(url.trim(), scanType);
      sessionStorage.setItem('scanResult', JSON.stringify(data));
      router.push('/results');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="px-4 pb-16 md:pb-24">
      <div className="mx-auto max-w-2xl">
        <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/50">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white pb-6">
            <CardTitle className="text-2xl">Analyze Your Website</CardTitle>
            <CardDescription>
              Enter your website URL and select the type of scan you want to run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="url" className="mb-2 block text-sm font-medium text-slate-700">
                  Website URL
                </label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                  className="h-12 text-base"
                />
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  Scan Type
                </label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {SCAN_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setScanType(option.id)}
                      className={cn(
                        'flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-all duration-200',
                        scanType === option.id
                          ? 'border-violet-500 bg-violet-50/50 ring-2 ring-violet-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div
                        className={cn(
                          'rounded-xl p-2',
                          scanType === option.id
                            ? option.color === 'emerald'
                              ? 'bg-emerald-100'
                              : option.color === 'amber'
                              ? 'bg-amber-100'
                              : option.color === 'blue'
                              ? 'bg-blue-100'
                              : 'bg-violet-100'
                            : 'bg-slate-100'
                        )}
                      >
                        <option.icon
                          className={cn(
                            'h-5 w-5',
                            scanType === option.id
                              ? option.color === 'emerald'
                                ? 'text-emerald-600'
                                : option.color === 'amber'
                                ? 'text-amber-600'
                                : option.color === 'blue'
                                ? 'text-blue-600'
                                : 'text-violet-600'
                              : 'text-slate-500'
                          )}
                        />
                      </div>
                      <span className="font-semibold text-slate-900">{option.label}</span>
                      <span className="text-xs text-slate-500">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full bg-gradient-to-r from-violet-600 to-indigo-600 text-base font-semibold shadow-lg shadow-violet-500/25 transition-all hover:from-violet-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-violet-500/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  'Start Analysis'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
