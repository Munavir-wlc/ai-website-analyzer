'use client';

import { Search, Shield, Zap } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-violet-50/30" />
      <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-violet-200/40 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />
      
      {/* Abstract shapes */}
      <div className="absolute right-20 top-20 h-2 w-2 rounded-full bg-violet-400/60" />
      <div className="absolute right-32 top-32 h-3 w-3 rounded-full bg-indigo-400/50" />
      <div className="absolute left-40 top-40 h-2 w-2 rounded-full bg-violet-300/60" />
      <div className="absolute bottom-20 left-1/3 h-4 w-4 rounded-full bg-indigo-300/40" />

      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20 md:py-24">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          AI Powered Website{' '}
          <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Analyzer
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl">
          Analyze SEO, performance, and security vulnerabilities in seconds.
        </p>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-slate-500">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-100 p-2">
              <Search className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium">SEO Analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-amber-100 p-2">
              <Shield className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium">Security Scan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-blue-100 p-2">
              <Zap className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium">Performance Metrics</span>
          </div>
        </div>
      </div>
    </section>
  );
}
