'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  Shield, CheckCircle, AlertTriangle, FileText, Download, Clock, 
  Settings, Globe, Lock, ShieldAlert, Cpu, Database, Eye, Info,
  Loader2, Monitor, Smartphone
} from 'lucide-react';

function GradeGauge({ grade, score, size = 'md', color }) {
  const s = score ?? 0;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (s / 100) * circumference;
  const dim = size === 'large' ? 28 : 20;

  return (
    <div className="relative" style={{ width: dim * 4, height: dim * 4 }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Dark theme background circle */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color || "#6366f1"}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-extrabold ${size === 'large' ? 'text-5xl' : 'text-2xl'} text-white`}>
          {grade ?? '—'}
        </span>
      </div>
    </div>
  );
}

export default function AuditReport({ result, screenshots }) {
  const [activeSeverityFilter, setActiveSeverityFilter] = useState('all');

  const domain = (() => {
    try {
      return new URL(result.scannedUrl || result.url).hostname;
    } catch {
      return result.scannedUrl || result.url;
    }
  })();

  const issues = result.findings || [];
  const totalIssues = issues.length;

  const score = result.score ?? 0;
  const scoreColor = 
    score >= 90 ? '#10b981' // Green
    : score >= 70 ? '#a3e635' // Light Green (lime-400)
    : score >= 50 ? '#f59e0b' // Yellow
    : score >= 30 ? '#f97316' // Orange
    : '#ef4444'; // Red

  const statusText =
    score >= 90
      ? 'Website security configuration looks highly secure.'
      : score >= 70
        ? 'Minor configuration issues detected. Recommendations recommended.'
        : score >= 50
          ? 'Moderate threat exposure. Critical security updates suggested.'
          : 'High risk exposure! Immediate security remediation is required.';

  const formattedDate = result.scanDate || result.generatedAt
    ? new Date(result.scanDate || result.generatedAt).toLocaleString()
    : '—';

  const ssl = result.sslDetails || {};
  const dns = result.dnsDetails || {};
  const exposedFiles = result.exposedFiles || [];
  const positives = result.positives || [];
  const techStack = result.techStack || { cms: [], framework: [], server: [], analytics: [], libraries: [] };
  const cookieAudit = result.cookieAudit || [];
  const corsIssues = result.corsIssues || [];
  const mixedContent = result.mixedContent || [];
  const compliance = result.complianceFlags || { gdpr: false, pci: false, hipaa: false };
  const breakdown = result.riskBreakdown || { critical: 0, high: 0, medium: 0, low: 0 };

  const portScan = result.portScanData || { scanned: false, openPorts: [], totalScanned: 0 };
  const whois = result.whoisData || { exists: false, registrar: 'Unknown', createdDate: null, expiryDate: null, daysRemaining: null };
  const redirects = result.redirectData || { chain: [], redirectCount: 0, enforcesHttps: false, finalUrl: '', isCrossDomain: false };
  const robots = result.robotsData || { exists: false, paths: [], sensitiveFound: [], raw: '' };
  const waf = result.wafData || { detected: false, name: null, confidence: 'low', source: null };
  const apiDocs = result.apiDiscoveryData || { scanned: false, swaggerDocs: [], apiRoutes: [], totalDiscovered: 0 };
  const loadTest = result.loadTestData || { scanned: false, totalRequests: 0, successfulRequests: 0, failedRequests: 0, avgResponseTimeMs: 0, minResponseTimeMs: 0, maxResponseTimeMs: 0, requestsPerSecond: 0, statusCodes: {}, rateLimitDetected: false, rateLimitHeadersFound: [], verdict: '' };
  const securityScore = result.securityScore ?? result.score ?? 0;
  const criticalCount = result.critical ?? breakdown.critical ?? 0;
  const highCount = result.high ?? breakdown.high ?? 0;
  const mediumCount = result.medium ?? breakdown.medium ?? 0;
  const lowCount = result.low ?? breakdown.low ?? 0;
  const vulnerabilities = result.vulnerabilities || result.findings || [];
  const recommendations = result.recommendations || [];

  const sslDaysColor = ssl.daysRemaining > 60 
    ? 'text-emerald-400' 
    : ssl.daysRemaining > 14 
      ? 'text-amber-400' 
      : 'text-rose-400';

  // Filter issues based on active severity tab
  const filteredIssues = activeSeverityFilter === 'all'
    ? issues
    : issues.filter(issue => issue.severity?.toLowerCase() === activeSeverityFilter);

  const filterTabs = [
    { id: 'all', label: 'All Findings', count: totalIssues },
    { id: 'critical', label: 'Critical', count: breakdown.critical || issues.filter(i => i.severity === 'critical').length },
    { id: 'high', label: 'High', count: breakdown.high || issues.filter(i => i.severity === 'high').length },
    { id: 'medium', label: 'Medium', count: breakdown.medium || issues.filter(i => i.severity === 'medium').length },
    { id: 'low', label: 'Low', count: breakdown.low || issues.filter(i => i.severity === 'low').length }
  ];

  return (
    <div className="space-y-8 text-slate-100 font-sans">
      {/* Print custom stylesheet to invert colors nicely on print */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body {
            background: white !important;
            color: #0f172a !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .bg-slate-900, .bg-slate-950, .bg-slate-950\\/80, .bg-slate-900\\/60, .bg-slate-950\\/30 {
            background: #ffffff !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
          }
          .text-white, .text-slate-100, .text-slate-200, .text-slate-350, .text-slate-400 {
            color: #1e293b !important;
          }
          .border-slate-800, .border-slate-700, .border {
            border-color: #cbd5e1 !important;
          }
          .border {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .shadow-2xl, .shadow-xl, .shadow-lg, .shadow-sm {
            box-shadow: none !important;
          }
          circle[stroke="#1e293b"] {
            stroke: #e2e8f0 !important;
          }
        }
      `}} />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Shield className="h-8 w-8 text-indigo-500" /> VAPT Vulnerability Report
          </h1>
          <p className="text-slate-400 mt-1">
            Target Domain: <strong className="text-white font-semibold">{domain}</strong> 
            <span className="mx-2 print:hidden">•</span>
            <a href={result.scannedUrl || result.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline print:hidden">
              {result.scannedUrl || result.url}
            </a>
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => window.print()} 
          className="print:hidden bg-slate-900 hover:bg-slate-800 text-white border-slate-800 hover:border-slate-700 flex items-center gap-2 py-2 px-4 rounded-xl"
        >
          <Download className="h-4 w-4" /> Print / Save PDF Report
        </Button>
      </div>

      {/* Audit Overview & Summary */}
      <div className="border border-slate-800 rounded-3xl bg-slate-900/60 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/10 to-purple-500/0 rounded-3xl -z-10" />
        <div className="flex flex-col md:flex-row items-center gap-8 justify-around">
          <div className="flex flex-col items-center text-center space-y-4">
            <GradeGauge
              grade={result.grade}
              score={score}
              size="large"
              color={scoreColor}
            />
            <div>
              <div className="text-3xl font-extrabold text-white">{score}/100</div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">Security Score</p>
            </div>
          </div>

          <div className="flex-1 space-y-4 max-w-xl text-center md:text-left">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: scoreColor }}>{statusText}</h2>
            <p className="text-slate-300 leading-relaxed text-sm">
              {result.summary || `The scanning engine successfully audited response headers, cookie settings, CORS parameters, and sensitive paths. A total of ${totalIssues} vulnerability findings were compiled.`}
            </p>
            
            {/* Meta stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
                <span className="block text-[10px] text-slate-500 mb-0.5">Scanned Date</span>
                <span className="text-white text-[11px] normal-case">{new Date(result.scanDate || result.generatedAt).toLocaleDateString()}</span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
                <span className="block text-[10px] text-slate-500 mb-0.5">Scan Duration</span>
                <span className="text-white text-[11px] normal-case">{result.scanDuration || '0.1'}s</span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
                <span className="block text-[10px] text-slate-500 mb-0.5">Scan Depth</span>
                <span className="text-white text-[11px] normal-case">{result.scanMode === 'quick' ? 'Quick (Passive)' : 'Full (Active/AI)'}</span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
                <span className="block text-[10px] text-slate-500 mb-0.5">Compliance</span>
                <span className={`${compliance.gdpr || compliance.pci || compliance.hipaa ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {compliance.gdpr || compliance.pci || compliance.hipaa ? 'Risks Found' : 'Pass'}
                </span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
                <span className="block text-[10px] text-slate-500 mb-0.5">Total Findings</span>
                <span className="text-white text-[11px]">{totalIssues}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Priority Highlights Shelf */}
      {result.topPriority && result.topPriority.length > 0 && (
        <div className="border border-slate-800 rounded-3xl bg-slate-900/60 p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -inset-px bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-transparent rounded-3xl -z-10" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
            Top Priority Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {result.topPriority.map((issue, idx) => (
              <div key={idx} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">
                      {issue.category || 'General'}
                    </span>
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                      issue.severity === 'critical' || issue.severity === 'high' 
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {issue.severity}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-2 line-clamp-1">{issue.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">{issue.description}</p>
                </div>
                {issue.remediation && (
                  <div className="text-[11px] text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 p-2.5 rounded-xl">
                    <strong className="block text-[9px] uppercase tracking-wider text-indigo-300 font-semibold mb-0.5">Quick Fix:</strong>
                    {issue.remediation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Risk Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* GDPR */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 p-5 shadow-md flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-white text-base">GDPR Compliance</h4>
            <p className="text-xs text-slate-400 mt-1">Requires HTTPS connections, SSL cert trust, secure cookie structures, and data leakage controls.</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">Audit Status</span>
            <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
              compliance.gdpr 
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {compliance.gdpr ? 'Risk Identified' : 'Compliant'}
            </span>
          </div>
        </div>

        {/* PCI-DSS */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 p-5 shadow-md flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-white text-base">PCI-DSS Compliance</h4>
            <p className="text-xs text-slate-400 mt-1">Demands high trust rating, zero high/critical vulnerabilities, secure transport layers, and secure CORS scopes.</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">Audit Status</span>
            <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
              compliance.pci 
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {compliance.pci ? 'Risk Identified' : 'Compliant'}
            </span>
          </div>
        </div>

        {/* HIPAA */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 p-5 shadow-md flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-white text-base">HIPAA Compliance</h4>
            <p className="text-xs text-slate-400 mt-1">Requires strict transmission encryption rules, active HSTS response headers, and clean access flags.</p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">Audit Status</span>
            <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
              compliance.hipaa 
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {compliance.hipaa ? 'Risk Identified' : 'Compliant'}
            </span>
          </div>
        </div>

        {/* WAF Shield */}
        <div className="border border-slate-800 rounded-2xl bg-slate-900/60 p-5 shadow-md flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-white text-base">WAF Firewall Shield</h4>
            <p className="text-xs text-slate-400 mt-1">
              Checks if the application is fronted by active firewalls (e.g. Cloudflare, AWS WAF) which filter malicious probes.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">Detection Status</span>
            <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
              waf.detected 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {waf.detected ? `${waf.name || 'Firewall'} Active` : 'No WAF Found'}
            </span>
          </div>
        </div>
      </div>

      {/* HTTP Security Headers Grader Card */}
      {result.headersGrade && result.headersGrade.breakdown && Object.keys(result.headersGrade.breakdown).length > 0 && (
        <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
          <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6 flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-indigo-400" /> HTTP Security Headers Grade
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider font-mono">Score: {result.headersGrade.score}/100</span>
              <span className={`text-base font-extrabold px-3 py-1 rounded-lg ${
                result.headersGrade.grade.startsWith('A')
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : result.headersGrade.grade.startsWith('B')
                    ? 'bg-lime-500/10 text-lime-400 border border-lime-500/20'
                    : result.headersGrade.grade.startsWith('C')
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                Grade {result.headersGrade.grade}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Security headers instruct client web browsers on safety constraints, restricting unauthorized frames, script sources, and cookie transport layers.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5">Header</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 hidden md:table-cell">Value</th>
                    <th className="py-2.5">Diagnostic Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-xs">
                  {Object.entries(result.headersGrade.breakdown).map(([name, data]) => {
                    const statusColors = {
                      secure: 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/10',
                      weak: 'text-amber-400 bg-amber-500/5 border border-amber-500/10',
                      missing: 'text-rose-400 bg-rose-500/5 border border-rose-500/10'
                    };
                    const statusLabels = {
                      secure: 'Secure',
                      weak: 'Weak Config',
                      missing: 'Missing'
                    };
                    return (
                      <tr key={name} className="hover:bg-slate-950/20 transition-all">
                        <td className="py-3 font-semibold text-slate-200">{name}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${statusColors[data.status] || 'text-slate-400 bg-slate-800/10'}`}>
                            {statusLabels[data.status] || data.status}
                          </span>
                        </td>
                        <td className="py-3 hidden md:table-cell max-w-[200px] truncate font-mono text-[10px] text-slate-400" title={data.value || 'N/A'}>
                          {data.value || '—'}
                        </td>
                        <td className="py-3 text-slate-300 leading-normal">{data.desc}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technology Stack Detection */}
      {techStack && Object.values(techStack).some(arr => arr && arr.length > 0) && (
        <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
          <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Cpu className="h-5 w-5 text-indigo-400" /> Technology Stack Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {techStack.cms && techStack.cms.length > 0 && (
              <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">CMS</span>
                <div className="flex flex-wrap gap-1.5">
                  {techStack.cms.map((t, idx) => <Badge key={idx} className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs px-2 py-0.5">{t}</Badge>)}
                </div>
              </div>
            )}
            {techStack.framework && techStack.framework.length > 0 && (
              <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Frameworks</span>
                <div className="flex flex-wrap gap-1.5">
                  {techStack.framework.map((t, idx) => <Badge key={idx} className="bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs px-2 py-0.5">{t}</Badge>)}
                </div>
              </div>
            )}
            {techStack.server && techStack.server.length > 0 && (
              <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Web Servers</span>
                <div className="flex flex-wrap gap-1.5">
                  {techStack.server.map((t, idx) => <Badge key={idx} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5">{t}</Badge>)}
                </div>
              </div>
            )}
            {techStack.libraries && techStack.libraries.length > 0 && (
              <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">JS / CSS Libs</span>
                <div className="flex flex-wrap gap-1.5">
                  {techStack.libraries.map((t, idx) => <Badge key={idx} className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2 py-0.5">{t}</Badge>)}
                </div>
              </div>
            )}
            {techStack.analytics && techStack.analytics.length > 0 && (
              <div className="bg-slate-950/60 p-4 border border-slate-800 rounded-xl">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Analytics</span>
                <div className="flex flex-wrap gap-1.5">
                  {techStack.analytics.map((t, idx) => <Badge key={idx} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2 py-0.5">{t}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Visual Page Preview */}
      {screenshots && (screenshots.desktop || screenshots.mobile || screenshots.loading || screenshots.error) && (
        <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl print:hidden">
          <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-400" /> Visual Page Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {screenshots.loading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3 text-indigo-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm font-semibold">Capturing desktop and mobile viewports...</span>
              </div>
            ) : screenshots.error ? (
              <div className="py-8 text-center text-slate-500">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-semibold">Screenshot Capture Suspended</p>
                <p className="text-xs text-slate-500 mt-1">{screenshots.error}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Desktop Viewport Mockup */}
                {screenshots.desktop && (
                  <div className="lg:col-span-2 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5"><Monitor className="h-4 w-4 text-indigo-400" /> Desktop View (1024x640)</span>
                    </div>
                    <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60 flex flex-col shadow-inner">
                      {/* Browser address bar */}
                      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                        </div>
                        <div className="flex-1 bg-slate-950 text-slate-500 text-[10px] py-0.5 px-3 rounded-md font-mono truncate text-center">
                          {domain}
                        </div>
                      </div>
                      {/* Viewport Frame */}
                      <div className="relative aspect-[16/10] overflow-y-auto max-h-[360px] bg-slate-950">
                        <img 
                          src={screenshots.desktop} 
                          alt="Desktop Viewport" 
                          className="w-full object-cover object-top"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile Viewport Mockup */}
                {screenshots.mobile && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-indigo-400" /> Mobile View (375x667)</span>
                    </div>
                    <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60 flex flex-col shadow-inner max-w-[280px] mx-auto lg:max-w-none">
                      {/* Browser address bar */}
                      <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                        </div>
                        <div className="flex-1 bg-slate-950 text-slate-500 text-[10px] py-0.5 px-3 rounded-md font-mono truncate text-center">
                          {domain}
                        </div>
                      </div>
                      {/* Viewport Frame */}
                      <div className="relative aspect-[375/667] overflow-y-auto max-h-[360px] bg-slate-950">
                        <img 
                          src={screenshots.mobile} 
                          alt="Mobile Viewport" 
                          className="w-full object-cover object-top"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* API Documentation & Route Discovery */}
      {apiDocs && apiDocs.scanned && (
        <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
          <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-400" /> API Specification & Route Discovery
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              {/* Swagger Specs Probed */}
              <div className="space-y-3">
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">
                  API Documentation specifications found ({apiDocs.swaggerDocs?.length || 0})
                </span>
                {apiDocs.swaggerDocs && apiDocs.swaggerDocs.length === 0 ? (
                  <div className="text-slate-400 text-xs italic py-2">
                    No exposed Swagger or OpenAPI files detected at standard endpoints.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {apiDocs.swaggerDocs.map((doc, idx) => (
                      <div key={idx} className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between gap-3">
                        <div>
                          <strong className="block text-slate-200 text-xs font-bold truncate">{doc.name}</strong>
                          <span className="text-[10px] text-indigo-400 block font-mono font-semibold truncate mt-0.5">{doc.url}</span>
                        </div>
                        <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] uppercase tracking-wide shrink-0">
                          {doc.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* API Routes Discovered */}
              <div className="space-y-3">
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">
                  Discovered Backend Routes from Scripts ({apiDocs.apiRoutes?.length || 0})
                </span>
                {apiDocs.apiRoutes && apiDocs.apiRoutes.length === 0 ? (
                  <div className="text-slate-400 text-xs italic py-2">
                    No backend API route patterns extracted from bundle scripts.
                  </div>
                ) : (
                  <div className="max-h-52 overflow-y-auto bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl font-mono text-xs text-slate-350 space-y-2">
                    {apiDocs.apiRoutes.map((route, idx) => (
                      <div key={idx} className="flex items-center gap-2 border-b border-slate-900/60 pb-1.5 last:border-0 last:pb-0">
                        <Badge className="bg-slate-800 text-slate-400 border border-slate-800 text-[9px] uppercase tracking-wide shrink-0 px-1 py-0">GET</Badge>
                        <span className="truncate text-slate-300 font-semibold">{route}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vulnerabilities Details with Filter Tabs */}
      <div className="border border-slate-800 rounded-3xl bg-slate-900/60 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
          <h3 className="text-xl font-bold text-white">
            Vulnerability Audits ({filteredIssues.length})
          </h3>
          
          {/* Severity Filters */}
          <div className="flex flex-wrap gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl print:hidden">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSeverityFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  activeSeverityFilter === tab.id
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className="h-4 min-w-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-lg font-bold text-emerald-400">All checks pass!</p>
            <p className="text-sm text-slate-400 mt-1">No matches found for the active filter. Your configuration passes audit checks.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredIssues.map((issue, i) => (
              <div
                key={i}
                className="border border-slate-800 rounded-2xl p-5 hover:bg-slate-950/20 transition flex flex-col md:flex-row gap-4 justify-between"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white text-base sm:text-lg">
                      {issue.title}
                    </span>
                    {issue.category && (
                      <Badge className="text-[10px] uppercase bg-slate-800 text-slate-400 font-mono tracking-wider border border-slate-800">
                        {issue.category}
                      </Badge>
                    )}
                    {issue.owasp && (
                      <Badge className="text-[10px] uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 font-mono tracking-wider">
                        {issue.owasp}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed mt-1">
                    {issue.description}
                  </p>
                  {issue.remediation && (
                    <div className="bg-slate-950/80 rounded-xl p-4 border-l-4 border-indigo-500 text-sm text-slate-300 mt-2 font-medium">
                      <strong className="text-indigo-400 font-semibold block mb-1 text-xs uppercase tracking-wider">Remediation Guide:</strong>
                      {issue.remediation}
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-start">
                  <span
                    className={`inline-flex px-3 py-1.5 text-[10px] sm:text-xs rounded-lg font-extrabold uppercase tracking-wider border ${
                      issue.severity === 'critical'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : issue.severity === 'high'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : issue.severity === 'medium'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SSL Details Card */}
      <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
        <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-indigo-400" /> SSL Certificate Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Valid Connection</span>
            <span className={`inline-flex items-center gap-1.5 font-bold mt-1.5 ${ssl.valid ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className={`w-2 h-2 rounded-full ${ssl.valid ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              {ssl.valid ? 'Active & Trusted' : 'Invalid / Handshake Failed'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Issuer CA</span>
            <span className="font-semibold text-slate-200 mt-1.5 block">{ssl.issuer || 'Unknown'}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Expiration Date</span>
            <span className="font-semibold text-slate-200 mt-1.5 block">{ssl.expireDate ? new Date(ssl.expireDate).toLocaleDateString() : '—'}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Days Remaining</span>
            <span className={`font-bold mt-1.5 block ${sslDaysColor}`}>{ssl.daysRemaining ?? 0} days</span>
          </div>
          {ssl.error && (
            <div className="col-span-1 sm:col-span-2 md:col-span-4 p-3 bg-red-500/10 border border-red-500/20 text-rose-400 text-xs rounded-xl font-mono">
              <strong>Certificate Check Error:</strong> {ssl.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNS Records Card */}
      <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
        <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-400" /> DNS Configuration Audits
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="flex flex-wrap gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-bold border ${
              dns.spf ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              SPF: {dns.spf ? 'Present' : 'Missing'}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-bold border ${
              dns.dmarc ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              DMARC: {dns.dmarc ? 'Present' : 'Missing'}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-bold border ${
              dns.mx ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              MX Records: {dns.mx ? 'Present' : 'Missing'}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-bold border ${
              dns.ns ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              NS Records: {dns.ns ? 'Present' : 'Missing'}
            </span>
          </div>
          {dns.spf && (
            <div className="bg-slate-950/60 p-3.5 rounded-xl text-xs font-mono border border-slate-800 text-slate-300">
              <strong className="text-slate-500 block mb-1">SPF Record:</strong> {dns.spf}
            </div>
          )}
          {dns.dmarc && (
            <div className="bg-slate-950/60 p-3.5 rounded-xl text-xs font-mono border border-slate-800 text-slate-300">
              <strong className="text-slate-500 block mb-1">DMARC Record:</strong> {dns.dmarc}
            </div>
          )}
          {dns.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-rose-400 text-xs rounded-xl font-mono">
              <strong>DNS Lookup Error:</strong> {dns.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cookie Audits Card */}
      <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
        <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-400" /> Cookie Security Flag Audits
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {cookieAudit.length === 0 ? (
            <div className="py-4 text-center text-slate-500 text-sm">
              No session or persistent cookies were set in the response headers.
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3 px-2">Cookie Name</th>
                  <th className="py-3 px-2">HttpOnly</th>
                  <th className="py-3 px-2">Secure</th>
                  <th className="py-3 px-2">SameSite</th>
                  <th className="py-3 px-2">Security Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-semibold">
                {cookieAudit.map((cookie, idx) => {
                  const isFullySecure = cookie.httpOnly && cookie.secure;
                  return (
                    <tr key={idx} className="hover:bg-slate-950/10">
                      <td className="py-3.5 px-2 text-slate-200 font-mono text-xs">{cookie.name}</td>
                      <td className="py-3.5 px-2">
                        <span className={`text-xs ${cookie.httpOnly ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {cookie.httpOnly ? 'Yes' : 'Missing'}
                        </span>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className={`text-xs ${cookie.secure ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {cookie.secure ? 'Yes' : 'Missing'}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-300 text-xs font-mono">{cookie.sameSite || 'None'}</td>
                      <td className="py-3.5 px-2">
                        <Badge className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          isFullySecure 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {isFullySecure ? 'Secure' : 'Exposure Risk'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Exposed Files Card */}
      {exposedFiles.length > 0 && (
        <Card className="border border-red-500/20 bg-red-500/5 shadow-2xl p-6 sm:p-8 rounded-3xl">
          <CardHeader className="p-0 pb-4 border-b border-red-500/20 mb-4">
            <CardTitle className="text-xl font-bold text-red-400 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" /> Exposed Sensitive Files
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-800">
            {exposedFiles.map((file, idx) => (
              <div key={idx} className="py-3 flex justify-between items-center text-sm font-mono text-red-400">
                <span>{file}</span>
                <span className="bg-red-500/15 border border-red-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-extrabold tracking-wider">Exposed / 200 OK</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* CORS Issues Card */}
      {corsIssues.length > 0 && (
        <Card className="border border-amber-500/20 bg-amber-500/5 shadow-2xl p-6 sm:p-8 rounded-3xl">
          <CardHeader className="p-0 pb-4 border-b border-amber-500/20 mb-4">
            <CardTitle className="text-xl font-bold text-amber-400 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" /> CORS Scope Violations
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {corsIssues.map((issue, idx) => (
              <div key={idx} className="py-3 flex justify-between items-center text-sm font-mono text-amber-400">
                <span>{issue}</span>
                <span className="bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Wildcard Access *</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Mixed Content Card */}
      {mixedContent.length > 0 && (
        <Card className="border border-amber-500/20 bg-amber-500/5 shadow-2xl p-6 sm:p-8 rounded-3xl">
          <CardHeader className="p-0 pb-4 border-b border-amber-500/20 mb-4">
            <CardTitle className="text-xl font-bold text-amber-400 flex items-center gap-2">
              <Eye className="h-5 w-5 text-amber-500" /> Insecure Mixed Content Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-800 max-h-60 overflow-y-auto pr-2">
            {mixedContent.map((asset, idx) => (
              <div key={idx} className="py-2.5 text-xs font-mono text-amber-300 overflow-x-auto">
                <span className="text-red-400 font-bold block">[HTTP Asset]</span>
                {asset}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* OWASP ZAP VAPT Security Report */}
      {result.vulnerabilities && result.vulnerabilities.length > 0 && (
        <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
          <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-indigo-400" /> OWASP ZAP VAPT Security Scan Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-6">
            {/* Score & Risk Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60 flex flex-col items-center justify-center text-center">
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider mb-2">VAPT Security Score</span>
                <span className="text-5xl font-extrabold text-white block mb-1">
                  {securityScore}
                </span>
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Weighted Risk Deductions</span>
              </div>

              <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60 md:col-span-2 space-y-4">
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Severity Risk Distribution</span>
                
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold pt-1">
                  <div className="bg-rose-500/10 text-rose-400 border border-rose-500/20 p-2.5 rounded-xl">
                    <span className="text-lg block font-extrabold">{criticalCount}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Critical</span>
                  </div>
                  <div className="bg-amber-500/10 text-amber-400 border border-amber-500/20 p-2.5 rounded-xl">
                    <span className="text-lg block font-extrabold">{highCount}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">High</span>
                  </div>
                  <div className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 p-2.5 rounded-xl">
                    <span className="text-lg block font-extrabold">{mediumCount}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Medium</span>
                  </div>
                  <div className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 p-2.5 rounded-xl">
                    <span className="text-lg block font-extrabold">{lowCount}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Low</span>
                  </div>
                </div>

                {/* Progress bar scale */}
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex">
                  {Array.from({ length: criticalCount }).map((_, i) => (
                    <div key={`c-${i}`} className="h-full bg-rose-500 flex-1 border-r border-slate-950" />
                  ))}
                  {Array.from({ length: highCount }).map((_, i) => (
                    <div key={`h-${i}`} className="h-full bg-amber-500 flex-1 border-r border-slate-950" />
                  ))}
                  {Array.from({ length: mediumCount }).map((_, i) => (
                    <div key={`m-${i}`} className="h-full bg-yellow-500 flex-1 border-r border-slate-950" />
                  ))}
                  {Array.from({ length: lowCount }).map((_, i) => (
                    <div key={`l-${i}`} className="h-full bg-indigo-500 flex-1 border-r border-slate-950" />
                  ))}
                  {criticalCount === 0 && highCount === 0 && mediumCount === 0 && lowCount === 0 && (
                    <div className="h-full bg-emerald-500 w-full" />
                  )}
                </div>
              </div>
            </div>

            {/* Vulnerability Table */}
            <div className="space-y-3 pt-2">
              <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Discovered Vulnerabilities Table</span>
              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/20">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider bg-slate-950/40">
                      <th className="py-3 px-4">Vulnerability / Alert</th>
                      <th className="py-3 px-4">Severity</th>
                      <th className="py-3 px-4">Target Param</th>
                      <th className="py-3 px-4">CWE / OWASP</th>
                      <th className="py-3 px-4">Target Endpoint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-xs font-semibold">
                    {vulnerabilities.map((vuln, idx) => {
                      const sevColors = {
                        critical: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
                        high: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                        medium: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
                        low: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      };
                      return (
                        <tr key={idx} className="hover:bg-slate-950/40">
                          <td className="py-3.5 px-4 text-slate-200 font-bold">{vuln.title}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                              sevColors[vuln.severity?.toLowerCase()] || 'bg-slate-800 text-slate-400'
                            }`}>
                              {vuln.severity || 'low'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400">{vuln.evidence?.param || 'N/A'}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-350">{vuln.cwe || vuln.owasp || 'N/A'}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-400 break-all">{vuln.evidence?.url || result.scannedUrl || result.url}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recommendations Shelf */}
            <div className="space-y-4 pt-2">
              <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">VAPT Security Recommendations</span>
              <div className="grid grid-cols-1 gap-4">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-sm">{rec.title}</h4>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                        rec.severity === 'critical' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : rec.severity === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : rec.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {rec.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{rec.description}</p>
                    <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/40 mt-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Fix Remediation:</span>
                      <p className="text-xs text-indigo-350 font-medium leading-relaxed">{rec.remediation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HTTP Redirect Chain Card */}
      <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
        <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-400" /> HTTP Redirect Chain Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-2">
            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Redirect Count</span>
              <span className="font-extrabold text-white text-lg mt-1 block">{redirects.redirectCount ?? 0} hops</span>
            </div>
            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Enforces HTTPS</span>
              <span className={`inline-flex items-center gap-1.5 font-bold mt-1.5 ${redirects.enforcesHttps ? 'text-emerald-400' : 'text-rose-400'}`}>
                <span className={`w-2 h-2 rounded-full ${redirects.enforcesHttps ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                {redirects.enforcesHttps ? 'Secure Enforcement' : 'No Redirection'}
              </span>
            </div>
            <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Cross-Domain Redirect</span>
              <span className={`inline-flex items-center gap-1.5 font-bold mt-1.5 ${redirects.isCrossDomain ? 'text-amber-400' : 'text-emerald-400'}`}>
                <span className={`w-2 h-2 rounded-full ${redirects.isCrossDomain ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                {redirects.isCrossDomain ? 'Yes (Risk)' : 'No (Same Domain)'}
              </span>
            </div>
          </div>

          {redirects.chain && redirects.chain.length > 0 && (
            <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-3">
              <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider mb-2">Hop Trace Chain</span>
              {redirects.chain.map((hop, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-2 border-b border-slate-800/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 bg-slate-900 rounded-full border border-slate-700 text-slate-300 font-bold flex items-center justify-center font-mono">
                      {idx + 1}
                    </span>
                    <span className="font-mono text-slate-200 break-all">{hop.url}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded sm:mt-0 mt-1 shrink-0 ${
                    hop.status >= 300 && hop.status < 400 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    Status {hop.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Domain Registry WHOIS Details Card */}
      <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
        <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-400" /> Domain Registry (WHOIS) Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Registrar</span>
            <span className="font-semibold text-slate-200 mt-1.5 block break-words">{whois.registrar || 'Unknown'}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Registration Date</span>
            <span className="font-semibold text-slate-200 mt-1.5 block">
              {whois.createdDate ? new Date(whois.createdDate).toLocaleDateString() : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Expiry Date</span>
            <span className="font-semibold text-slate-200 mt-1.5 block">
              {whois.expiryDate ? new Date(whois.expiryDate).toLocaleDateString() : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Days to Expiration</span>
            {whois.daysRemaining !== null ? (
              <span className={`font-extrabold mt-1.5 block text-lg ${
                whois.daysRemaining < 7 ? 'text-red-400 animate-pulse'
                : whois.daysRemaining < 30 ? 'text-amber-400'
                : 'text-emerald-400'
              }`}>
                {whois.daysRemaining} days remaining
              </span>
            ) : (
              <span className="font-semibold text-slate-200 mt-1.5 block">—</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Load Resilience & Rate Limiting Card */}
      <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
        <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400" /> Load Resilience & Rate Limiting Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-6 text-sm">
          {!loadTest.scanned ? (
            <div className="py-4 text-center text-slate-500 font-semibold">
              {loadTest.verdict || 'Load resilience test details were not captured.'}
            </div>
          ) : (
            <>
              {/* Metrics grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
                  <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Average Latency</span>
                  <span className="font-extrabold text-white text-xl mt-1 block">{loadTest.avgResponseTimeMs} ms</span>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
                  <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Min / Max Latency</span>
                  <span className="font-extrabold text-white text-base mt-1.5 block">
                    {loadTest.minResponseTimeMs} ms / {loadTest.maxResponseTimeMs} ms
                  </span>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
                  <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Request Success Rate</span>
                  <span className={`font-extrabold text-lg mt-1 block ${
                    loadTest.failedRequests === 0 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {loadTest.successfulRequests} / {loadTest.totalRequests} OK
                  </span>
                </div>
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60">
                  <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Throughput Rate</span>
                  <span className="font-extrabold text-white text-xl mt-1 block">
                    {loadTest.requestsPerSecond} req/sec
                  </span>
                </div>
              </div>

              {/* Status codes and rate limiting details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="bg-slate-950/30 rounded-2xl p-4 border border-slate-800/80">
                  <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider mb-3">HTTP Status Code Distribution</span>
                  <div className="space-y-2">
                    {Object.keys(loadTest.statusCodes || {}).map((code) => {
                      const count = loadTest.statusCodes[code];
                      const isSuccess = code.startsWith('2') || code === '301' || code === '302';
                      const isRateLimit = code === '429';
                      return (
                        <div key={code} className="flex justify-between items-center text-xs py-1 border-b border-slate-800/40 last:border-0">
                          <span className="font-mono text-slate-350 text-[11px]">Status {code}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isSuccess ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isRateLimit ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {count} requests
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-950/30 rounded-2xl p-4 border border-slate-800/80 flex flex-col justify-between">
                  <div>
                    <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider mb-2">Rate Limiting Detection</span>
                    <span className={`inline-flex items-center gap-1.5 font-bold mt-1 text-sm ${
                      loadTest.rateLimitDetected ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        loadTest.rateLimitDetected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'
                      }`} />
                      {loadTest.rateLimitDetected ? 'Rate Limiting Active / Headers Detected' : 'No Active Rate Limiter Detected'}
                    </span>
                    {loadTest.rateLimitHeadersFound && loadTest.rateLimitHeadersFound.length > 0 && (
                      <div className="mt-2.5 space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold block uppercase">Detected Headers:</span>
                        <div className="flex flex-wrap gap-1">
                          {loadTest.rateLimitHeadersFound.map((hdr) => (
                            <span key={hdr} className="bg-slate-900 text-slate-300 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono">
                              {hdr}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 border-t border-slate-800/60 pt-3">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase mb-1">DoS / Abuse Resilience:</span>
                    <span className="text-xs text-slate-300 leading-relaxed font-medium block">
                      {loadTest.rateLimitDetected 
                        ? 'Low Risk: Automated crawler floods and brute-force scanners will be safely throttled.' 
                        : 'Medium Risk: Server lacks request rate-limiting. Vulnerable to scanner noise and brute-force.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* VAPT Load Verdict */}
              <div className="bg-slate-950/60 rounded-2xl p-5 border border-slate-850 relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-indigo-500" />
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider mb-1.5">VAPT Resilience Verdict</span>
                <p className="text-slate-200 text-xs leading-relaxed font-semibold">
                  {loadTest.verdict}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Open Port Detection Card */}
      <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
        <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-indigo-400" /> Active Service Port Scan (17 Ports Checked)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-4 text-sm">
          {!portScan.scanned ? (
            <div className="py-4 text-center text-slate-500">
              Port scanning details were not captured.
            </div>
          ) : portScan.openPorts && portScan.openPorts.length === 0 ? (
            <div className="py-4 text-center text-emerald-400 font-semibold flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" /> No publicly exposed database or administrative ports found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-2">Port Number</th>
                    <th className="py-2.5 px-2">Common Service</th>
                    <th className="py-2.5 px-2">Description / Context</th>
                    <th className="py-2.5 px-2">Security Exposure Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-semibold">
                  {portScan.openPorts.map((p, idx) => {
                    const isHighCritical = [21, 22, 23, 3306, 5432, 6379, 27017].includes(p.port);
                    
                    let explanation = '';
                    if (p.port === 8080) {
                      explanation = 'Alternative HTTP - verify if intentionally public';
                    } else if (p.port === 22) {
                      explanation = 'SSH - should not be publicly exposed';
                    } else if (p.port === 3306) {
                      explanation = 'MySQL - critical exposure';
                    } else if (isHighCritical) {
                      explanation = `${p.service} service - critical administrative or database exposure`;
                    } else if (p.dangerous) {
                      explanation = `${p.service} service - administrative or internal protocol exposed`;
                    }

                    let badgeText = 'Open / Public';
                    let badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    
                    if (p.dangerous) {
                      if (isHighCritical) {
                        badgeText = 'Critical Exposure';
                        badgeStyle = 'bg-red-500/10 text-red-400 border-red-500/20';
                      } else {
                        badgeText = 'Medium Exposure';
                        badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                      }
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-950/10">
                        <td className="py-3 px-2 text-slate-200 font-mono text-sm">{p.port}</td>
                        <td className="py-3 px-2 text-slate-350">{p.service}</td>
                        <td className="py-3 px-2 text-slate-400 text-xs italic">{explanation || 'Standard public service'}</td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-extrabold uppercase rounded border ${badgeStyle}`}>
                            {badgeText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Robots.txt Analysis Card */}
      <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
        <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-400" /> Robots.txt Path Auditor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-4 text-sm">
          {!robots.exists ? (
            <div className="py-4 text-center text-slate-500">
              No robots.txt was detected on the target server.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Parsed Paths ({robots.paths?.length || 0})</span>
                {robots.paths && robots.paths.length === 0 ? (
                  <div className="text-slate-400 text-xs italic">No paths defined.</div>
                ) : (
                  <div className="max-h-52 overflow-y-auto bg-slate-950/40 border border-slate-800 p-3 rounded-xl font-mono text-xs text-slate-350 space-y-1.5">
                    {robots.paths.slice(0, 30).map((path, idx) => (
                      <div key={idx} className="truncate">{path}</div>
                    ))}
                    {robots.paths.length > 30 && (
                      <div className="text-slate-500 text-[10px] pt-1">... and {robots.paths.length - 30} more paths</div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Sensitive Targets Exposed</span>
                {robots.sensitiveFound && robots.sensitiveFound.length === 0 ? (
                  <div className="text-emerald-400 text-xs font-semibold flex items-center gap-1.5 py-2">
                    <CheckCircle className="h-4 w-4" /> No sensitive admin or config endpoints exposed.
                  </div>
                ) : (
                  <div className="bg-red-500/5 border border-red-500/10 p-3 rounded-xl space-y-2">
                    <p className="text-xs text-red-400 font-semibold">The following disallowed/allowed paths contain sensitive words:</p>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {robots.sensitiveFound.map((p, idx) => (
                        <div key={idx} className="text-xs font-mono text-rose-300 font-bold bg-rose-500/10 px-2.5 py-1 rounded border border-rose-500/20 truncate">
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Positives Card */}
      {positives.length > 0 && (
        <Card className="border border-emerald-500/20 bg-emerald-500/5 shadow-2xl p-6 sm:p-8 rounded-3xl">
          <CardHeader className="p-0 pb-4 border-b border-emerald-500/20 mb-4">
            <CardTitle className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" /> Security Safeguards Found
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            {positives.map((pos, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                <p>{pos}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}