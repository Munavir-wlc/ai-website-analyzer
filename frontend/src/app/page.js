'use client';

import Navbar from '../components/Navbar';
import ScanForm from '../components/ScanForm';
import Footer from '../components/Footer';
import Link from 'next/link';
import { Shield, Lock, Eye, AlertTriangle, FileCheck, CheckCircle, ArrowRight, Zap, Terminal, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function HomePage() {
  const scrollToScanner = () => {
    const el = document.getElementById('security-scanner-console');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-white transition-colors duration-200">
      <Navbar />
      
      <main className="flex-1 flex flex-col">
        {/* Security Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-24 px-4 sm:px-6 lg:px-8 border-b border-border">
          {/* Subtle technical background grid / glow */}
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none -z-10" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl -z-10 pointer-events-none" />

          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
            
            {/* Value Proposition */}
            <div className="flex-1 text-center lg:text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider font-mono">
                <Shield className="h-3.5 w-3.5" /> AI-POWERED WEBSITE SECURITY
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                Find vulnerabilities <br />
                <span className="text-primary">before attackers do.</span>
              </h1>
              
              <p className="max-w-xl mx-auto lg:mx-0 text-base sm:text-lg text-muted-foreground leading-relaxed">
                Continuously assess your websites for security vulnerabilities, configuration weaknesses, exposed assets, and compliance risks.
              </p>
              
              {/* CTAs */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 pt-2">
                <Button onClick={scrollToScanner} size="lg" className="gap-2 shadow-sm">
                  Start Security Scan <ArrowRight className="h-4 w-4" />
                </Button>
                <Link href="/pricing">
                  <Button variant="outline" size="lg">
                    View Pricing & Quotas
                  </Button>
                </Link>
              </div>

              {/* Security Trust Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-border/80">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>OWASP Top 10</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>SSL/TLS Audit</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Passive Recon</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>AI Remediation</span>
                </div>
              </div>
            </div>

            {/* Interactive Security Scanner Console */}
            <div id="security-scanner-console" className="w-full max-w-xl shrink-0">
              <div className="rounded-lg border border-border bg-card p-6 sm:p-8 shadow-lg transition-all">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Terminal className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Security Audit Console</h2>
                      <p className="text-[11px] text-muted-foreground">Deterministic & Dynamic Analysis</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Ready
                  </span>
                </div>

                <ScanForm />
              </div>
            </div>

          </div>
        </section>

        {/* Technical Capability Grid */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-primary font-mono">
              Enterprise Defense Coverage
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Built for Modern Security Operations
            </h2>
            <p className="text-sm text-muted-foreground">
              Comprehensive automated testing covering web security posture, passive attack surface, and configuration drift.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">SSL/TLS & Cryptography</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Certificate validity, revocation status, cipher suites, protocol vulnerabilities, and strict transport security (HSTS) enforcement.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileCheck className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Security Header Defense</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Verify CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy implementations.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Eye className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Passive Reconnaissance</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Subdomain discovery, DNS record misconfigurations, open port reconnaissance, and exposed administrative paths.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">AI Remediation Guidance</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Contextual code snippets for Nginx, Apache, Express, and Next.js to fix verified security findings in minutes.
              </p>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
