'use client';

import { useState } from 'react';
import { Search, Shield, Zap, Download, FileJson, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const SEVERITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
};

function ScoreCard({ label, score, icon: Icon, color, description }) {
  if (score == null) return null;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = color === 'green' ? '#22c55e' : color === 'blue' ? '#3b82f6' : '#f59e0b';

  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <div className="relative h-24 w-24 flex-shrink-0">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={strokeColor}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
            {score}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-3xl font-bold">{score}/100</p>
        </div>
      </CardContent>
    </Card>
  );
}

function IssueCard({ issue, icon }) {
  const severityColors = {
    high: 'destructive',
    medium: 'warning',
    low: 'secondary',
  };
  return (
    <Card className="transition-all duration-300 hover:shadow-md">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">{issue.message}</p>
          {issue.fix && (
            <p className="text-sm text-muted-foreground mt-1">{issue.fix}</p>
          )}
          <Badge variant={severityColors[issue.severity] || 'secondary'} className="mt-2">
            {issue.severity}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function IssueSection({ issues, title, icon: Icon, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!issues || issues.length === 0) return null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-2xl"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="font-semibold">{title}</span>
          <Badge variant="secondary">{issues.length}</Badge>
        </div>
        <span className="text-muted-foreground">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <CardContent className="pt-0 space-y-3">
          {issues.map((issue, i) => (
            <IssueCard key={i} issue={issue} icon={<Icon className="h-4 w-4" />} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default function ResultsDashboard({ result }) {
  const [downloaded, setDownloaded] = useState(false);

  const chartData = [
    { name: 'SEO', issues: result.issues?.seo?.length || 0, fill: '#22c55e' },
    { name: 'Security', issues: result.issues?.security?.length || 0, fill: '#ef4444' },
    { name: 'Performance', issues: result.issues?.performance?.length || 0, fill: '#3b82f6' },
  ].filter((d) => d.issues > 0);

  const pieData = [
    { name: 'High', value: result.issues?.seo?.filter((i) => i.severity === 'high').length || 0, fill: '#ef4444' },
    { name: 'Medium', value: result.issues?.seo?.filter((i) => i.severity === 'medium').length || 0, fill: '#f59e0b' },
    { name: 'Low', value: result.issues?.seo?.filter((i) => i.severity === 'low').length || 0, fill: '#6b7280' },
  ].map((d) => ({
    ...d,
    value: d.value + (result.issues?.security?.filter((i) => i.severity === d.name.toLowerCase()).length || 0),
  })).filter((d) => d.value > 0);

  const allIssues = [
    ...(result.issues?.seo || []),
    ...(result.issues?.security || []),
    ...(result.issues?.performance || []),
  ];
  const severityDistribution = [
    { name: 'High', value: allIssues.filter((i) => i.severity === 'high').length, fill: '#ef4444' },
    { name: 'Medium', value: allIssues.filter((i) => i.severity === 'medium').length, fill: '#f59e0b' },
    { name: 'Low', value: allIssues.filter((i) => i.severity === 'low').length, fill: '#6b7280' },
  ].filter((d) => d.value > 0);

  function handleDownloadJSON() {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    let host = 'report';
    try {
      host = new URL(result.url).hostname || host;
    } catch (_) {}
    a.download = `scan-report-${host}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDownloaded(true);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Website Audit Report</h1>
        <p className="text-muted-foreground mt-1">{result.url}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ScoreCard
          label="SEO Score"
          score={result.seoScore}
          icon={Search}
          color="green"
          description="Search optimization"
        />
        <ScoreCard
          label="Security Score"
          score={result.securityScore}
          icon={Shield}
          color="orange"
          description="Vulnerability assessment"
        />
        <ScoreCard
          label="Performance Score"
          score={result.performanceScore}
          icon={Zap}
          color="blue"
          description="Core Web Vitals"
        />
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Issue Distribution</CardTitle>
              <CardDescription>Issues by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-muted-foreground" />
                    <YAxis dataKey="name" type="category" width={80} className="text-muted-foreground" />
                    <Tooltip />
                    <Bar dataKey="issues" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Severity Breakdown</CardTitle>
              <CardDescription>Issue severity distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {severityDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={severityDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {severityDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No issues to display
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-6">
        <IssueSection issues={result.issues?.seo} title="SEO Issues" icon={Search} />
        <IssueSection issues={result.issues?.security} title="Security Issues" icon={Shield} />
        <IssueSection issues={result.issues?.performance} title="Performance Issues" icon={Zap} />
      </div>

      {result.performance && Object.keys(result.performance).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Core Web Vitals</CardTitle>
            <CardDescription>Performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(result.performance)
                .filter(([, v]) => v != null)
                .map(([k, v]) => (
                  <div key={k} className="p-3 rounded-lg bg-muted/50">
                    <dt className="text-sm text-muted-foreground">{k}</dt>
                    <dd className="text-lg font-semibold">{v}</dd>
                  </div>
                ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {result.recommendations && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle>AI Recommendations</CardTitle>
            <CardDescription>Suggested improvements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap">{result.recommendations}</div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Download Full Report</CardTitle>
          <CardDescription>Export your audit results</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button variant="outline" onClick={handleDownloadJSON} className="gap-2">
            <FileJson className="h-4 w-4" />
            {downloaded ? 'Downloaded' : 'Download JSON'}
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2 print:hidden">
            <FileText className="h-4 w-4" />
            Download PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
