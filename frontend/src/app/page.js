'use client';

import Navbar from '../components/Navbar';
import ScanForm from '../components/ScanForm';
import Footer from '../components/Footer';
import { Shield, Lock, Eye, AlertTriangle, FileCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-indigo-500 selection:text-white transition-colors duration-300">
      <Navbar />
      
      <main className="flex-1 flex flex-col">
        {/* Hero & Scanner Section */}
        <section className="relative overflow-hidden pt-20 pb-28 px-4 sm:px-6 lg:px-8 border-b border-slate-200 dark:border-slate-800">
          {/* Subtle gradient highlights */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 -z-10" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-3xl -z-10 pointer-events-none" />
          <div className="absolute top-10 right-10 w-72 h-72 rounded-full bg-violet-600/5 blur-3xl -z-10 pointer-events-none" />

          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12">
            {/* Value Proposition */}
            <div className="flex-1 text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                <Shield className="h-4 w-4" /> Next-Gen AI Security Scanner
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                Deep VAPT Audits, <br />
                <span className="bg-gradient-to-r from-indigo-550 via-purple-500 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                  Powered by AI.
                </span>
              </h1>
              <p className="max-w-xl mx-auto lg:mx-0 text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                Scan your web applications for vulnerabilities, misconfigured CORS, insecure cookies, mixed content, and SSL/DNS health risks in seconds.
              </p>
              
              {/* Core features indicators */}
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto lg:mx-0 pt-4">
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-300">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-105 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-semibold">SSL & DNS Health</span>
                </div>
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-300">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-105 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <Eye className="h-4 w-4 text-amber-600 dark:text-amber-405" />
                  </div>
                  <span className="text-sm font-semibold">Passive Recon</span>
                </div>
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-300">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-105 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <span className="text-sm font-semibold">Vulnerability Scans</span>
                </div>
                <div className="flex items-center gap-3 text-slate-800 dark:text-slate-300">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-105 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <FileCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-sm font-semibold">Compliance Flags</span>
                </div>
              </div>
            </div>

            {/* Live Scan Form Container */}
            <div className="w-full max-w-lg bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative">
              <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/20 to-purple-500/0 rounded-3xl -z-10" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">Configure & Start Scan</h2>
              <ScanForm />
            </div>
          </div>
        </section>

        {/* Workflow & Guide Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-105 dark:bg-slate-950">
          <div className="max-w-7xl mx-auto space-y-12">
            <div className="text-center max-w-3xl mx-auto space-y-4">
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">How It Works</h2>
              <p className="text-slate-600 dark:text-slate-400">
                A simple three-step defensive audit to identify and remediate security risks on your domain.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl relative shadow-sm">
                <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-extrabold text-sm border border-indigo-550 shadow-md">
                  1
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 mb-3">Input Target</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Enter the URL you wish to check. Choose between a quick header audit or a comprehensive full security scan.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl relative shadow-sm">
                <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-extrabold text-sm border border-indigo-550 shadow-md">
                  2
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 mb-3">Monitor Real-Time Scan</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Observe crawling, SSL validation, DNS mapping, exposed file scanner, and AI assessment stream through WebSockets.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl relative shadow-sm">
                <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-extrabold text-sm border border-indigo-550 shadow-md">
                  3
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 mb-3">Actionable Remediation</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Review the security grade, browse detailed findings categorized by severity, verify compliance status, and print the PDF report.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
