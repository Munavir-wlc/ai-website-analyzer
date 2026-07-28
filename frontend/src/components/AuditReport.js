'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import Link from 'next/link';
import { 
  Shield, CheckCircle, AlertTriangle, FileText, Download, Clock, 
  Settings, Globe, Lock, ShieldAlert, Cpu, Database, Eye, Info,
  Loader2, Monitor, Smartphone, TrendingUp, TrendingDown, ArrowUpRight, ExternalLink, Search, Copy, Sparkles, BarChart3
} from 'lucide-react';
import FindingChatModal from './FindingChatModal';

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

const REMEDIATION_SNIPPETS = {
  'strict-transport-security': {
    nginx: 'add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;',
    apache: 'Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"',
    express: 'app.use(helmet.hsts({ maxAge: 63072000, includeSubDomains: true, preload: true }));',
    nextjs: '// next.config.js\nmodule.exports = {\n  async headers() {\n    return [\n      {\n        source: "/(.*)",\n        headers: [\n          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }\n        ]\n      }\n    ];\n  }\n};'
  },
  'x-frame-options': {
    nginx: 'add_header X-Frame-Options "DENY" always;',
    apache: 'Header always set X-Frame-Options "DENY"',
    express: 'app.use(helmet.frameguard({ action: "deny" }));',
    nextjs: '// next.config.js\nmodule.exports = {\n  async headers() {\n    return [\n      {\n        source: "/(.*)",\n        headers: [\n          { key: "X-Frame-Options", value: "DENY" }\n        ]\n      }\n    ];\n  }\n};'
  },
  'x-content-type-options': {
    nginx: 'add_header X-Content-Type-Options "nosniff" always;',
    apache: 'Header always set X-Content-Type-Options "nosniff"',
    express: 'app.use(helmet.noSniff());',
    nextjs: '// next.config.js\nmodule.exports = {\n  async headers() {\n    return [\n      {\n        source: "/(.*)",\n        headers: [\n          { key: "X-Content-Type-Options", value: "nosniff" }\n        ]\n      }\n    ];\n  }\n};'
  },
  'content-security-policy': {
    nginx: 'add_header Content-Security-Policy "default-src \'self\';" always;',
    apache: 'Header always set Content-Security-Policy "default-src \'self\';"',
    express: 'app.use(helmet.contentSecurityPolicy({ directives: { defaultSrc: ["\'self\'"] } }));',
    nextjs: '// next.config.js\nmodule.exports = {\n  async headers() {\n    return [\n      {\n        source: "/(.*)",\n        headers: [\n          { key: "Content-Security-Policy", value: "default-src \'self\'" }\n        ]\n      }\n    ];\n  }\n};'
  },
  'referrer-policy': {
    nginx: 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    apache: 'Header always set Referrer-Policy "strict-origin-when-cross-origin"',
    express: 'app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));',
    nextjs: '// next.config.js\nmodule.exports = {\n  async headers() {\n    return [\n      {\n        source: "/(.*)",\n        headers: [\n          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }\n        ]\n      }\n    ];\n  }\n};'
  }
};

function RemediationTabs({ title }) {
  const [activeTab, setActiveTab] = useState('nginx');
  const [copied, setCopied] = useState(false);
  
  const normalizedTitle = (title || '').toLowerCase();
  let snippetKey = null;
  if (normalizedTitle.includes('transport-security') || normalizedTitle.includes('hsts')) snippetKey = 'strict-transport-security';
  else if (normalizedTitle.includes('frame-options') || normalizedTitle.includes('clickjacking')) snippetKey = 'x-frame-options';
  else if (normalizedTitle.includes('content-type-options')) snippetKey = 'x-content-type-options';
  else if (normalizedTitle.includes('content-security-policy') || normalizedTitle.includes('csp')) snippetKey = 'content-security-policy';
  else if (normalizedTitle.includes('referrer-policy')) snippetKey = 'referrer-policy';

  if (!snippetKey || !REMEDIATION_SNIPPETS[snippetKey]) return null;

  const snippets = REMEDIATION_SNIPPETS[snippetKey];

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/60 text-xs print:hidden">
      <div className="flex items-center justify-between bg-slate-950 border-b border-slate-800 text-[10px] uppercase font-bold text-slate-400 pr-2">
        <div className="flex">
          {Object.keys(snippets).map(platform => (
            <button
              key={platform}
              type="button"
              onClick={() => {
                setActiveTab(platform);
                setCopied(false);
              }}
              className={`px-3 py-2 border-r border-slate-800 hover:text-white transition-colors ${
                activeTab === platform ? 'bg-slate-900 text-white font-bold' : ''
              }`}
            >
              {platform}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-white transition-colors py-0.5 px-2 rounded border border-slate-800 bg-slate-900 hover:bg-slate-850"
        >
          <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy Code'}
        </button>
      </div>
      <div className="p-3 font-mono text-[10px] text-slate-350 overflow-x-auto whitespace-pre">
        {snippets[activeTab]}
      </div>
    </div>
  );
}

export default function AuditReport({ result, screenshots }) {
  const [activeSeverityFilter, setActiveSeverityFilter] = useState('all');
  const [activeReportTab, setActiveReportTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isShared, setIsShared] = useState(result.isPublic || false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [activeChatFinding, setActiveChatFinding] = useState(null);
  const searchInputRef = useRef(null);

  // Keyboard shortcut: press '/' to focus vulnerability search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setActiveReportTab('vulnerabilities');
        setTimeout(() => {
          if (searchInputRef.current) searchInputRef.current.focus();
        }, 50);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleShare = async () => {
    try {
      const token = localStorage.getItem('vapt_auth_token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/scan/results/${result.scanId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setIsShared(data.isPublic);
      }
    } catch (err) {
      console.error('Failed to toggle share status:', err);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      const shareUrl = `${window.location.origin}/results?scanId=${result.scanId}&shared=true`;
      navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `security_report_${domain}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

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
  const subdomainData = result.subdomainData || { scanned: false, discovered: [], sensitiveFound: [], totalDiscovered: 0 };
  const waf = result.wafData || { detected: false, name: null, confidence: 'low', source: null };
  const apiDocs = result.apiDiscoveryData || { scanned: false, swaggerDocs: [], apiRoutes: [], totalDiscovered: 0 };
  const loadTest = result.loadTestData || { scanned: false, totalRequests: 0, successfulRequests: 0, failedRequests: 0, avgResponseTimeMs: 0, minResponseTimeMs: 0, maxResponseTimeMs: 0, requestsPerSecond: 0, statusCodes: {}, rateLimitDetected: false, rateLimitHeadersFound: [], verdict: '' };
  const zapScan = result.zapScanData || { scanned: false, available: false, status: 'not_requested', error: null, findingsCount: 0 };
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

  const fixedIssues = result.fixedFindings || [];

  // Filter issues based on active severity tab and search query
  const filteredIssues = (activeSeverityFilter === 'all'
    ? issues
    : activeSeverityFilter === 'fixed'
      ? fixedIssues
      : issues.filter(issue => issue.severity?.toLowerCase() === activeSeverityFilter)
  ).filter(issue => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (issue.title && issue.title.toLowerCase().includes(q)) ||
      (issue.description && issue.description.toLowerCase().includes(q)) ||
      (issue.recommendation && issue.recommendation.toLowerCase().includes(q))
    );
  });

  const filterTabs = [
    { id: 'all', label: 'All Findings', count: totalIssues },
    { id: 'critical', label: 'Critical', count: breakdown.critical || issues.filter(i => i.severity === 'critical').length },
    { id: 'high', label: 'High', count: breakdown.high || issues.filter(i => i.severity === 'high').length },
    { id: 'medium', label: 'Medium', count: breakdown.medium || issues.filter(i => i.severity === 'medium').length },
    { id: 'low', label: 'Low', count: breakdown.low || issues.filter(i => i.severity === 'low').length }
  ];

  if (fixedIssues.length > 0) {
    filterTabs.push({
      id: 'fixed',
      label: 'Resolved / Fixed',
      count: fixedIssues.length
    });
  }

  const reportTabs = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'vulnerabilities', label: 'Vulnerabilities', icon: ShieldAlert, badge: totalIssues },
    { id: 'owasp', label: 'OWASP Top 10', icon: Shield },
    { id: 'headers', label: 'Headers & Cookies', icon: Lock },
    { id: 'network', label: 'Network & SSL', icon: Shield },
    { id: 'vapt', label: 'VAPT & Load Test', icon: Cpu },
    { id: 'preview', label: 'Visual Preview', icon: Eye }
  ];

  // OWASP Top 10:2021 categories and their keyword matchers
  const OWASP_CATEGORIES = [
    {
      id: 'A01',
      name: 'Broken Access Control',
      description: 'Restrictions on what authenticated users can do are not properly enforced.',
      keywords: ['access control', 'authorization', 'privilege', 'admin', 'idor', 'path traversal']
    },
    {
      id: 'A02',
      name: 'Cryptographic Failures',
      description: 'Failures related to cryptography that expose sensitive data.',
      keywords: ['ssl', 'tls', 'https', 'hsts', 'transport', 'encryption', 'certificate', 'mixed content']
    },
    {
      id: 'A03',
      name: 'Injection',
      description: 'User-supplied data is not validated, filtered, or sanitized.',
      keywords: ['xss', 'sql', 'injection', 'cross-site scripting', 'sqli', 'html injection']
    },
    {
      id: 'A04',
      name: 'Insecure Design',
      description: 'Risks related to design and architectural flaws.',
      keywords: ['design', 'architecture', 'logic', 'workflow', 'business']
    },
    {
      id: 'A05',
      name: 'Security Misconfiguration',
      description: 'Missing security hardening, improper configurations, unnecessary features enabled.',
      keywords: ['misconfiguration', 'header', 'csp', 'x-frame', 'content-security', 'referrer', 'cors', 'cookie', 'robots', 'exposed', 'directory']
    },
    {
      id: 'A06',
      name: 'Vulnerable & Outdated Components',
      description: 'Components with known vulnerabilities used without testing or upgrade.',
      keywords: ['cve', 'vulnerable', 'outdated', 'library', 'component', 'version', 'dependency']
    },
    {
      id: 'A07',
      name: 'Identification & Auth Failures',
      description: 'Weaknesses in authentication or session management.',
      keywords: ['authentication', 'session', 'login', 'credential', 'password', 'token', 'jwt', 'brute force']
    },
    {
      id: 'A08',
      name: 'Software & Data Integrity Failures',
      description: 'Code and infrastructure that does not protect against integrity violations.',
      keywords: ['integrity', 'subresource', 'sri', 'supply chain', 'ci/cd', 'deserialization']
    },
    {
      id: 'A09',
      name: 'Security Logging & Monitoring Failures',
      description: 'Insufficient logging and monitoring to detect, escalate, and respond to breaches.',
      keywords: ['logging', 'monitoring', 'audit', 'detection', 'alert', 'breach']
    },
    {
      id: 'A10',
      name: 'Server-Side Request Forgery',
      description: 'SSRF flaws occur when a web app fetches a remote resource without validating the user-supplied URL.',
      keywords: ['ssrf', 'server-side request', 'request forgery', 'internal network', 'metadata']
    }
  ];

  // Map findings to OWASP categories
  const owaspMap = OWASP_CATEGORIES.map(category => {
    const matched = issues.filter(finding => {
      // Direct owasp field match
      if (finding.owasp && finding.owasp.toLowerCase().includes(category.id.toLowerCase())) return true;
      // Keyword match in title/description
      const text = ((finding.title || '') + ' ' + (finding.description || '')).toLowerCase();
      return category.keywords.some(kw => text.includes(kw));
    });
    return { ...category, findings: matched, hasFailed: matched.length > 0 };
  });
  const owaspPassCount = owaspMap.filter(c => !c.hasFailed).length;
  const owaspFailCount = owaspMap.filter(c => c.hasFailed).length;


  return (
    <div className="audit-report-root">
      <div className="space-y-8 text-slate-100 font-sans audit-report-wrap">
        {/* Top Header */}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Shield className="h-8 w-8 text-indigo-500" /> Website Security Audit Report
          </h1>
          <p className="text-slate-400 mt-1">
            Target Domain: <strong className="text-white font-semibold">{domain}</strong> 
            <span className="mx-2 print:hidden">•</span>
            <a href={result.scannedUrl || result.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline print:hidden">
              {result.scannedUrl || result.url}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {result.belongsToCurrentUser && (
            <div className="flex gap-2 items-center">
              <Button 
                variant="outline" 
                onClick={handleToggleShare} 
                className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold ${
                  isShared 
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/30' 
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-350 border-slate-800'
                }`}
              >
                <Globe className="h-4 w-4" /> {isShared ? 'Shared (Public)' : 'Private (Share)'}
              </Button>
              {isShared && (
                <Button 
                  variant="outline" 
                  onClick={handleCopyLink} 
                  className="bg-slate-900 hover:bg-slate-850 text-white border-slate-800 hover:border-slate-750 flex items-center gap-2 py-2 px-4 rounded-xl text-xs"
                >
                  <ArrowUpRight className="h-4 w-4" /> {copySuccess ? 'Copied!' : 'Copy Link'}
                </Button>
              )}
            </div>
          )}
          <Link
            href={`/compare?targetScanId=${result.scanId}`}
            className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all"
          >
            <BarChart3 className="h-4 w-4 text-indigo-400" /> Compare Scan
          </Link>
          <Button 
            variant="outline" 
            onClick={() => window.print()} 
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold border-transparent shadow-lg shadow-indigo-500/20 flex items-center gap-2 py-2 px-4 rounded-xl text-xs transition-all hover:scale-[1.02]"
          >
            <Download className="h-4 w-4" /> Export Executive PDF
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportJSON} 
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 flex items-center gap-2 py-2 px-4 rounded-xl text-xs"
          >
            <Database className="h-4 w-4" /> Export JSON
          </Button>
        </div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">
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
                <span className="text-white text-[11px] normal-case">
                  {result.scanMode === 'quick' ? 'Quick Passive' : zapScan.scanned ? 'Full + ZAP' : 'Full Deterministic'}
                </span>
              </div>
              <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
                <span className="block text-[10px] text-slate-500 mb-0.5">Authentication</span>
                <span className={`${result.scanStatus?.authenticatedScan ? 'text-indigo-400 font-bold' : 'text-slate-400 text-[11px]'}`}>
                  {result.scanStatus?.authenticatedScan ? 'Authenticated' : 'Guest Scan'}
                </span>
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

      {/* Comparison Banner */}
      {result.previousScanDetails && (
        <div className="border border-slate-800 rounded-3xl bg-slate-900/60 p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute -inset-px bg-gradient-to-r from-emerald-500/10 via-indigo-500/5 to-transparent rounded-3xl -z-10" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                Vulnerability Status Comparison
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                We compared this audit against your previous scan from{' '}
                <span className="text-white font-semibold">
                  {new Date(result.previousScanDetails.scanDate).toLocaleString()}
                </span>
                .
                {fixedIssues.length > 0 ? (
                  <span>
                    {' '}
                    Awesome! You have successfully resolved{' '}
                    <strong className="text-emerald-400 font-bold">{fixedIssues.length}</strong>{' '}
                    security vulnerability{fixedIssues.length > 1 ? 's' : ''}!
                  </span>
                ) : (
                  <span> No resolved vulnerability fixes were detected since the last scan. Keep addressing the active findings below.</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0 bg-slate-950/60 border border-slate-800/80 p-3 rounded-2xl">
              <div className="text-center px-3 border-r border-slate-800">
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Previous Score</span>
                <span className="text-slate-300 font-bold text-base">{result.previousScanDetails.score}/100</span>
              </div>
              <div className="text-center px-3 border-r border-slate-800">
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Current Score</span>
                <span className="text-white font-bold text-base">{score}/100</span>
              </div>
              <div className="text-center px-1">
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Improvement</span>
                {score - result.previousScanDetails.score > 0 ? (
                  <span className="text-emerald-400 font-extrabold text-sm flex items-center gap-0.5">
                    <TrendingUp className="h-4 w-4" /> +{score - result.previousScanDetails.score}
                  </span>
                ) : score - result.previousScanDetails.score < 0 ? (
                  <span className="text-rose-400 font-extrabold text-sm flex items-center gap-0.5">
                    <TrendingDown className="h-4 w-4" /> {score - result.previousScanDetails.score}
                  </span>
                ) : (
                  <span className="text-slate-400 font-bold text-sm font-sans">Stable</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        {result.isLocked && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md rounded-3xl z-40 flex flex-col items-center justify-center p-8 text-center border border-slate-800/80 min-h-[500px]">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none rounded-3xl" />
            <div className="relative max-w-md bg-slate-900 border border-slate-850 p-8 rounded-3xl shadow-2xl flex flex-col items-center space-y-6">
              <div className="h-16 w-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center animate-pulse">
                <Lock className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-extrabold text-white">Unlock Vulnerability Findings</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  We identified <strong className="text-white">{result.riskBreakdown?.critical || 0} Critical</strong>, <strong className="text-white">{result.riskBreakdown?.high || 0} High</strong>, and <strong className="text-white">{result.riskBreakdown?.medium || 0} Medium</strong> risk issues. Register or Log In to view full remediation guides, technical ports scan, and DNS/SSL security records.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Link
                  href={`/register?scanId=${result.scanId}`}
                  className="flex-1 text-center bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-500/20 text-sm transition-all hover:scale-[1.02]"
                >
                  Create Free Account
                </Link>
                <Link
                  href={`/login?scanId=${result.scanId}`}
                  className="flex-1 text-center bg-slate-950 hover:bg-slate-900 text-slate-300 font-bold py-2.5 px-4 rounded-xl border border-slate-800 text-sm transition-all hover:scale-[1.02]"
                >
                  Log In
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className={`space-y-8 ${result.isLocked ? 'blur-[5px] select-none pointer-events-none opacity-40 max-h-[600px] overflow-hidden' : ''}`}>
          {/* Sleek Premium Tab Navigation */}
          <div className="flex items-center overflow-x-auto pb-2 border-b border-slate-800 gap-1.5 scrollbar-thin print:hidden">
            {reportTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeReportTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveReportTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/80 to-violet-600/80 text-white border-indigo-500/30 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-900/40 text-slate-400 border-slate-800/60 hover:bg-slate-850 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className={`ml-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white text-indigo-700' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ─── OWASP Top 10 Coverage Map Tab ─── */}
          <div className={activeReportTab === 'owasp' ? 'block' : 'hidden print:block'}>
            <div className="border border-slate-800 rounded-3xl bg-slate-900/60 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute -inset-px bg-gradient-to-br from-indigo-500/10 to-purple-500/0 rounded-3xl -z-10" />

              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="h-5 w-5 text-indigo-400" /> OWASP Top 10:2021 Coverage Map
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Industry-standard classification of your detected vulnerabilities. Used by enterprise auditors and compliance teams worldwide.
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <span className="block text-2xl font-extrabold text-emerald-400">{owaspPassCount}</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Categories Passed</span>
                  </div>
                  <div className="text-center px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                    <span className="block text-2xl font-extrabold text-rose-400">{owaspFailCount}</span>
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Categories Failed</span>
                  </div>
                </div>
              </div>

              {/* OWASP Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {owaspMap.map((category) => (
                  <div
                    key={category.id}
                    className={`p-4 rounded-2xl border flex gap-4 items-start transition-all ${
                      category.hasFailed
                        ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
                        : 'border-emerald-500/25 bg-emerald-500/5'
                    }`}
                  >
                    {/* Status Icon */}
                    <div className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-lg font-black ${
                      category.hasFailed
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                        : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    }`}>
                      {category.hasFailed ? '✕' : '✓'}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded font-mono ${
                            category.hasFailed ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                          }`}>{category.id}</span>
                          <h4 className="text-sm font-bold text-white truncate">{category.name}</h4>
                        </div>
                        {category.hasFailed && (
                          <span className="shrink-0 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                            {category.findings.length} {category.findings.length === 1 ? 'issue' : 'issues'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{category.description}</p>

                      {/* Matched finding titles */}
                      {category.hasFailed && category.findings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {category.findings.slice(0, 3).map((f, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-350">
                              <span className="text-rose-400">•</span>
                              <span className="truncate">{f.title}</span>
                            </div>
                          ))}
                          {category.findings.length > 3 && (
                            <div className="text-[10px] text-slate-500 italic">
                              +{category.findings.length - 3} more findings
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom note */}
              <div className="mt-6 p-4 bg-slate-950/60 border border-slate-800/60 rounded-2xl text-xs text-slate-400">
                <strong className="text-slate-300">Note:</strong> OWASP Top 10 is a standard awareness document for developers and web application security. It represents a broad consensus about the most critical security risks to web applications. Categories are mapped automatically based on detected findings.
              </div>
            </div>
          </div>

          {/* Top Priority Highlights Shelf */}
          {result.topPriority && result.topPriority.length > 0 && (
            <div className={activeReportTab === 'overview' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}

      {/* Compliance Risk Cards Grid */}
      <div className={activeReportTab === 'overview' ? 'block' : 'hidden print:block'}>
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
      </div></div>

      {/* HTTP Security Headers Grader Card */}
      {result.headersGrade && result.headersGrade.breakdown && Object.keys(result.headersGrade.breakdown).length > 0 && (
        <div className={activeReportTab === 'headers' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}

      {/* Technology Stack Detection */}
      {techStack && Object.values(techStack).some(arr => arr && arr.length > 0) && (
        <div className={activeReportTab === 'overview' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}

      {/* Visual Page Preview */}
      {screenshots && (screenshots.desktop || screenshots.mobile || screenshots.loading || screenshots.error) && (
        <div className={activeReportTab === 'preview' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}

      {/* API Documentation & Route Discovery */}
      {apiDocs && apiDocs.scanned && (
        <div className={activeReportTab === 'vapt' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}

      {/* Vulnerabilities Details with Filter Tabs */}
      <div className={activeReportTab === 'vulnerabilities' ? 'block' : 'hidden print:block'}>
        <div className="border border-slate-800 rounded-3xl bg-slate-900/60 p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
            <h3 className="text-xl font-bold text-white">
              Vulnerability Audits ({filteredIssues.length})
            </h3>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 print:hidden">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-550" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search findings... ( / )"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-full sm:w-56 transition-all"
                />
              </div>

              {/* Severity Filters */}
              <div className="flex flex-wrap gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
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
          </div>

          {filteredIssues.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-lg font-bold text-emerald-400">All checks pass!</p>
              <p className="text-sm text-slate-400 mt-1">No matches found for the active filter. Your configuration passes audit checks.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredIssues.map((issue, i) => {
                const isFixed = activeSeverityFilter === 'fixed';
                const findingStatuses = result.findingStatuses || {};
                const currentStatus = findingStatuses[issue.id]?.status || 'open';

                const handleStatusChange = async (newStatus) => {
                  if (!result.belongsToCurrentUser) return;
                  try {
                    const token = localStorage.getItem('vapt_auth_token');
                    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
                    await fetch(`${API_URL}/api/scan/results/${result.scanId}/findings/${issue.id}/status`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ status: newStatus })
                    });
                    // Optimistic update via a local reload isn't needed - page state is controlled by parent
                  } catch (err) {
                    console.error('Failed to update finding status:', err);
                  }
                };

                const STATUS_CONFIG = {
                  open: { label: 'Open', color: 'text-slate-400 bg-slate-900 border-slate-800' },
                  in_progress: { label: 'In Progress', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
                  accepted: { label: 'Accepted Risk', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' }
                };

                return (
                  <div
                    key={i}
                    className={`border rounded-2xl p-5 hover:bg-slate-950/20 transition flex flex-col md:flex-row gap-4 justify-between ${
                      isFixed 
                        ? 'border-emerald-500/30 bg-emerald-950/5 hover:bg-emerald-950/10' 
                        : 'border-slate-800'
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isFixed && <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />}
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
                        {isFixed && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/35">
                            Fixed / Resolved
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed mt-1">
                        {issue.description}
                      </p>
                      {issue.remediation && (
                        <div className={`rounded-xl p-4 border-l-4 text-sm mt-2 font-medium ${
                          isFixed 
                            ? 'bg-emerald-950/20 border-emerald-500 text-slate-300' 
                            : 'bg-slate-950/80 border-indigo-500 text-slate-300'
                        }`}>
                          <strong className={`font-semibold block mb-1 text-xs uppercase tracking-wider ${
                            isFixed ? 'text-emerald-400' : 'text-indigo-400'
                          }`}>
                            {isFixed ? 'Verification Detail:' : 'Remediation Guide:'}
                          </strong>
                          <div>
                            {isFixed ? 'Security audit verified that this issue is no longer present on your server.' : issue.remediation}
                          </div>
                          {!isFixed && <RemediationTabs title={issue.title} />}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span
                        className={`inline-flex px-3 py-1.5 text-[10px] sm:text-xs rounded-lg font-extrabold uppercase tracking-wider border ${
                          isFixed
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : issue.severity === 'critical' || issue.severity === 'high'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : issue.severity === 'medium'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {isFixed ? 'RESOLVED' : issue.severity}
                      </span>
                      {!isFixed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveChatFinding(issue);
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 border border-indigo-500/20 px-2.5 py-1 rounded-lg transition-all shadow-sm cursor-pointer"
                        >
                          <Sparkles className="h-3 w-3 text-indigo-400 animate-pulse" /> Ask AI Assistant
                        </button>
                      )}
                      {!isFixed && result.belongsToCurrentUser && (
                        <select
                          value={currentStatus}
                          onChange={(e) => handleStatusChange(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-[10px] font-bold border rounded-lg px-2 py-1 focus:outline-none cursor-pointer transition-colors ${STATUS_CONFIG[currentStatus]?.color || STATUS_CONFIG.open.color}`}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="accepted">Accepted Risk</option>
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* SSL Details Card */}
      <div className={activeReportTab === 'network' ? 'block' : 'hidden print:block'}>
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
      </div>

      {/* DNS Records Card */}
      <div className={activeReportTab === 'network' ? 'block' : 'hidden print:block'}>
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
      {result.headersGrade && result.headersGrade.breakdown && Object.keys(result.headersGrade.breakdown).length > 0 && (
        <div className={activeReportTab === 'headers' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}

      {/* Exposed Files Card */}
      {exposedFiles.length > 0 && (
        <div className={activeReportTab === 'vulnerabilities' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}

      {/* CORS Issues Card */}
      {corsIssues.length > 0 && (
        <div className={activeReportTab === 'headers' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}

      {/* Mixed Content Card */}
      {mixedContent.length > 0 && (
        <div className={activeReportTab === 'headers' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}

      {/* Crawled Pages Discovery */}
      {result.crawledPages && result.crawledPages.length > 0 && (
        <div className={activeReportTab === 'overview' ? 'block' : 'hidden print:block'}>
          <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
            <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-emerald-400" />
                Pages Discovered &amp; Crawled
                <span className="ml-auto text-sm font-semibold text-slate-400 bg-slate-800/60 px-3 py-1 rounded-full">
                  {result.crawledPages.length} page{result.crawledPages.length !== 1 ? 's' : ''}
                </span>
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                {result.scanStatus?.authenticatedScan
                  ? '🔐 Crawled as authenticated user — protected routes may be included below'
                  : '👤 Crawled as guest — protected routes were not accessible'}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {result.crawledPages.map((page, i) => {
                  const statusCode = page.statusCode || 200;
                  const isOk = statusCode >= 200 && statusCode < 300;
                  const isRedirect = statusCode >= 300 && statusCode < 400;
                  const isError = statusCode >= 400;
                  return (
                    <div key={i} className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/40 rounded-lg px-3 py-2 hover:border-slate-700/60 transition-colors">
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded min-w-[36px] text-center ${
                        isOk ? 'bg-emerald-900/50 text-emerald-400' :
                        isRedirect ? 'bg-amber-900/50 text-amber-400' :
                        'bg-rose-900/50 text-rose-400'
                      }`}>
                        {statusCode}
                      </span>
                      <span className="text-xs text-slate-300 font-mono truncate flex-1" title={page.url}>
                        {page.url}
                      </span>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-600 hover:text-indigo-400 transition-colors shrink-0"
                        title="Open in new tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      {/* OWASP ZAP Security Report */}
      {zapScan.scanned && result.vulnerabilities && result.vulnerabilities.length > 0 && (
        <div className={activeReportTab === 'vapt' ? 'block' : 'hidden print:block'}>
          <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
            <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-indigo-400" /> OWASP ZAP Security Scan Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              {/* Score & Risk Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60 flex flex-col items-center justify-center text-center">
                  <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider mb-2">ZAP Weighted Security Score</span>
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
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Security Recommendations</span>
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
                      <RemediationTabs title={rec.title} />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* HTTP Redirect Chain Card */}
      <div className={activeReportTab === 'network' ? 'block' : 'hidden print:block'}>
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
                  <span className={`w-2.5 h-2.5 rounded-full ${redirects.enforcesHttps ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                  {redirects.enforcesHttps ? 'Secure Enforcement' : 'No Redirection'}
                </span>
              </div>
              <div className="bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/60">
                <span className="text-slate-500 block font-bold text-[10px] uppercase tracking-wider">Cross-Domain Redirect</span>
                <span className={`inline-flex items-center gap-1.5 font-bold mt-1.5 ${redirects.isCrossDomain ? 'text-amber-400' : 'text-emerald-400'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${redirects.isCrossDomain ? 'bg-amber-400' : 'bg-emerald-400'}`} />
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
      </div>

      {/* Domain Registry WHOIS Details Card */}
      <div className={activeReportTab === 'network' ? 'block' : 'hidden print:block'}>
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
      </div>

      {/* Load Resilience & Rate Limiting Card */}
      <div className={activeReportTab === 'vapt' ? 'block' : 'hidden print:block'}>
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
      </div>

      {/* Open Port Detection Card */}
      <div className={activeReportTab === 'network' ? 'block' : 'hidden print:block'}>
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
      </div>

      {/* Robots.txt Analysis Card */}
      <div className={activeReportTab === 'network' ? 'block' : 'hidden print:block'}>
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
      </div>

      {/* Subdomain Discovery Card */}
      {subdomainData.scanned && (
        <div className={activeReportTab === 'vapt' ? 'block' : 'hidden print:block'}>
          <Card className="border border-slate-800 bg-slate-900/60 shadow-2xl p-6 sm:p-8 rounded-3xl">
            <CardHeader className="p-0 pb-4 border-b border-slate-800 mb-6">
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Globe className="h-5 w-5 text-indigo-400" /> Subdomain Discovery
                <span className="ml-auto text-xs font-normal text-slate-400">
                  {subdomainData.totalDiscovered} subdomain(s) found
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {subdomainData.discovered.length === 0 ? (
                <p className="text-slate-400 text-sm">No subdomains discovered from the wordlist.</p>
              ) : (
                <div className="space-y-4">
                  {subdomainData.sensitiveFound.length > 0 && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-400 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span><strong>{subdomainData.sensitiveFound.length} sensitive subdomain(s)</strong> discovered: {subdomainData.sensitiveFound.map(s => s.subdomain).join(', ')}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {subdomainData.discovered.map((sub, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border text-sm ${sub.isSensitive ? 'border-rose-500/30 bg-rose-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
                        <div>
                          <div className="font-mono text-xs text-white font-bold">{sub.subdomain}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{sub.ip}</div>
                        </div>
                        {sub.isSensitive && (
                          <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">SENSITIVE</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Positives Card */}
      {positives.length > 0 && (
        <div className={activeReportTab === 'overview' ? 'block' : 'hidden print:block'}>
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
        </div>
      )}
        </div>
      </div>
    </div>

      {/* AI Vulnerability Assistant Modal */}
      {activeChatFinding && (
        <FindingChatModal
          finding={activeChatFinding}
          onClose={() => setActiveChatFinding(null)}
        />
      )}
    </div>
  );
}
