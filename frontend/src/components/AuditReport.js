'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import SeoDetailCards from './SeoDetailCards';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

const CATEGORY_CONFIG = [
  { key: 'seoScore', label: 'On-Page SEO', color: '#ef4444' },
  { key: 'securityScore', label: 'Security', color: '#f59e0b' },
  { key: 'linksScore', label: 'Links', color: '#22c55e' },
  { key: 'usabilityScore', label: 'Usability', color: '#3b82f6' },
  { key: 'performanceScore', label: 'Performance', color: '#8b5cf6' },
  { key: 'socialScore', label: 'Social', color: '#ec4899' },
];

function GradeGauge({ grade, score, size = 'md', color }) {
  const s = score ?? 0;
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (s / 100) * circumference;
  const dim = size === 'large' ? 28 : 20;

  return (
    <div className="relative" style={{ width: dim * 4, height: dim * 4 }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={color || "#3b82f6"}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold ${size === 'large' ? 'text-4xl' : 'text-2xl'}`}>
          {grade ?? '—'}
        </span>
      </div>
    </div>
  );
}

/**
 * Modal Component - Shows full screenshot
 */
function ScreenshotModal({ isOpen, onClose, src, type, url }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{type === 'mobile' ? 'Mobile' : 'Desktop'} Preview</h2>
            <p className="text-sm text-gray-500 mt-1">{url}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Image Container */}
        <div className="flex-1 flex items-center justify-center bg-gray-50 overflow-auto">
          {src ? (
            <img
              src={src}
              alt={`${type} preview`}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <p className="text-gray-500">Loading...</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DevicePreview({ type, url, src, loading, error, onPreviewClick }) {
  const [imgError, setImgError] = useState(false);
  const isMobile = type === 'mobile';
  const showImage = src && !imgError && !error;

  useEffect(() => {
    setImgError(false);
  }, [src]);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl bg-white cursor-pointer ${isMobile ? 'w-full h-[320px]' : 'w-full'
        }`}
      onClick={() => showImage && onPreviewClick()}
    >
      <div className="flex items-center justify-center bg-white overflow-hidden w-full h-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-4 w-full h-full bg-gray-50">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-xs text-gray-600">Capturing preview...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-4 text-center w-full h-full bg-gray-50">
            <p className="text-xs text-red-500">Failed to load preview</p>
          </div>
        ) : showImage ? (
          <img
            src={src}
            alt={`${type} preview`}
            className="w-full h-full object-contain bg-white"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full bg-gray-50">
            <p className="text-xs text-gray-500">Preview unavailable</p>
          </div>
        )}
      </div>

      {isMobile && (
        <div className="h-5 bg-gray-200 flex items-center justify-center">
          <div className="w-10 h-1 bg-gray-400 rounded-full"></div>
        </div>
      )}
    </div>
  );
}

export default function AuditReport({ result }) {
  const [expanded, setExpanded] = useState(false);
  const [desktopScreenshot, setDesktopScreenshot] = useState(null);
  const [mobileScreenshot, setMobileScreenshot] = useState(null);
  const [screenshotLoading, setScreenshotLoading] = useState(true);
  const [screenshotError, setScreenshotError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('desktop');

  const MAX_RETRIES = 2;

  useEffect(() => {
    let cancelled = false;

    async function fetchScreenshots() {
      setScreenshotLoading(true);
      setScreenshotError(null);

      try {
        const apiUrl = '/api/screenshot';
        const params = new URLSearchParams({ url: result.url });
        const response = await fetch(`${apiUrl}?${params.toString()}`);

        if (cancelled) return;

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to capture screenshots');
        }

        const processImage = (img) => {
          if (!img) return null;
          if (img.startsWith('data:')) return img;
          return `data:image/jpeg;base64,${img}`;
        };

        setDesktopScreenshot(processImage(data.desktop));
        setMobileScreenshot(processImage(data.mobile));
        setScreenshotError(null);
        setRetryCount(0);
      } catch (error) {
        console.error('Screenshot fetch error:', error);

        if (!cancelled) {
          const errorMsg = error.message || 'Unknown error';
          setScreenshotError(errorMsg);
          setDesktopScreenshot(null);
          setMobileScreenshot(null);

          if (retryCount < MAX_RETRIES) {
            console.log(`Retrying screenshot... (${retryCount + 1}/${MAX_RETRIES})`);
            setTimeout(() => {
              setRetryCount(retryCount + 1);
            }, 3000);
            return;
          }
        }
      } finally {
        if (!cancelled) setScreenshotLoading(false);
      }
    }

    fetchScreenshots();

    return () => {
      cancelled = true;
    };
  }, [result.url, retryCount]);

  const domain = (() => {
    try {
      return new URL(result.url).hostname;
    } catch {
      return result.url;
    }
  })();

  const allIssues = [
    ...(result.issues?.seo || []),
    ...(result.issues?.siteAudit || []),
    ...(result.issues?.security || []),
    ...(result.issues?.performance || []),
  ];

  const totalIssues = allIssues.length;

  const statusText =
    (result.overallGrade === 'A+' || result.overallGrade === 'A' || result.overallGrade === 'A-')
      ? 'Your page looks great'
      : 'Your page could be better';

  const activeCategories = CATEGORY_CONFIG.filter(({ key }) => result[key] != null);

  const radarData = activeCategories.map(({ key, label }) => ({
    subject: label,
    value: result[key] ?? 0,
    fullMark: 100,
  }));

  const formattedDate = result.generatedAt
    ? new Date(result.generatedAt).toLocaleString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
    : '—';

  const ISSUE_CATEGORIES = [
    { key: 'seo', label: 'On-Page SEO & Accessibility', color: '#ef4444' },
    { key: 'siteAudit', label: 'Site Audit', color: '#22c55e' },
    { key: 'security', label: 'Security', color: '#f59e0b' },
    { key: 'performance', label: 'Performance', color: '#3b82f6' },
  ];

  const handleRetry = () => {
    setRetryCount(retryCount + 1);
  };

  const openModal = (type) => {
    setModalType(type);
    setModalOpen(true);
  };

  const currentScreenshot = modalType === 'desktop' ? desktopScreenshot : mobileScreenshot;

  return (
    <>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Results for {domain}</h1>
        </div>

        {/* First Section: Grade, Screenshots, Category Scores, Radar, Recommendations */}
        <div className="border rounded-xl border-gray-200 bg-white p-6 sm:p-8 shadow-sm space-y-8">
        {/* Grade + Screenshots grid - always side by side */}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-4 mt-14">
            <div className="flex flex-col items-center gap-4 text-center">
              <GradeGauge
                grade={result.overallGrade}
                score={result.overallScore}
                size="large"
              />

              <p className="text-lg text-slate-600">
                {statusText}
              </p>
              {result.seoDetails && (
                <p className="text-sm text-slate-500 max-w-md">
                  Page is analyzed for On-Page SEO. Use the checklist below to improve HTML tags and keyword alignment.
                </p>
              )}
            </div>
          </div>
          <div className="relative w-full max-w-xl mb-10">
            {/* Desktop Screenshot */}
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white">
              <DevicePreview
                type="desktop"
                url={result.url}
                src={desktopScreenshot}
                loading={screenshotLoading}
                error={screenshotError}
                onPreviewClick={() => openModal('desktop')}
              />
            </div>

            {/* Floating Mobile Screenshot */}
            <div className="absolute -right-10 bottom-[-100px] w-36 shadow-2xl rounded-xl border border-gray-200 bg-white overflow-hidden">
              <DevicePreview
                type="mobile"
                url={result.url}
                src={mobileScreenshot}
                loading={screenshotLoading}
                error={screenshotError}
                onPreviewClick={() => openModal('mobile')}
              />
            </div>
          </div>
        </div>

        {screenshotError && retryCount < MAX_RETRIES && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={handleRetry} size="sm">
              Retry Screenshot ({retryCount + 1}/{MAX_RETRIES})
            </Button>
          </div>
        )}

        <div className={`flex flex-col ${activeCategories.length >= 3 ? 'lg:flex-row justify-between' : 'items-center justify-center'} gap-10`}>

          {/* Category Scores */}
          <div className="flex flex-wrap gap-12 items-center justify-center">

            {activeCategories.map(({ key, label, color }) => (
              <div key={key} className="flex flex-col items-center">

                <GradeGauge
                  grade={result[key] != null ? scoreToGrade(result[key]) : '—'}
                  score={result[key]}
                  color={color}
                />

                <p className="mt-4 text-blue-600 font-medium text-sm text-center">
                  {label}
                </p>

              </div>
            ))}

          </div>

          {/* Radar Chart */}
          {activeCategories.length >= 3 && (
            <div className="w-[260px] h-[260px] mt-10">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#cbd5f5" strokeDasharray="4 4" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} />
                  <Radar
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.35}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>

        <p className="text-sm text-slate-500">Report Generated: {formattedDate}</p>

        {totalIssues > 0 && (
          <div className="mt-10">
            <Button variant="outline" onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Hide' : 'Show'} Recommendations ({totalIssues})
            </Button>
            <div className={`mt-6 space-y-6 print-force-show ${expanded ? 'block' : 'hidden'}`}>
              {ISSUE_CATEGORIES.map(({ key, label, color }) => {
                const issues = result.issues?.[key] || [];
                if (issues.length === 0) return null;

                return (
                  <div key={key} className="border rounded-xl overflow-hidden bg-white break-inside-avoid">
                    <div
                      className="px-5 py-3 font-semibold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {label} ({issues.length})
                    </div>
                    <div className="divide-y">
                      {issues.map((issue, i) => (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 hover:bg-gray-50 transition"
                        >
                          <div className="flex-1">
                            <p className="text-gray-800 font-medium">{issue.message}</p>
                            {issue.fix && (
                              <p className="text-sm text-slate-500 mt-1">{issue.fix}</p>
                            )}
                          </div>
                          <span
                            className={`inline-flex shrink-0 w-fit px-3 py-1 text-xs rounded-md font-medium ${
                              issue.severity === 'high'
                                ? 'bg-red-100 text-red-700'
                                : issue.severity === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {issue.severity === 'high'
                              ? 'High Priority'
                              : issue.severity === 'medium'
                                ? 'Medium Priority'
                                : 'Low Priority'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>

        {/* Second Section: On-Page SEO Details - separate card at bottom */}
        {result.seoDetails && (
          <div className="border rounded-xl border-gray-200 bg-white p-6 shadow-sm mt-10">
            <h2 className="text-xl font-semibold mb-6">On-Page SEO Details</h2>
            {result.usedRenderedHtml === false && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                Results based on initial HTML; JS-rendered content may not be included. If your site uses React, Material UI, or similar frameworks, headings and meta tags may not appear here even if Google can see them.
              </div>
            )}
            <SeoDetailCards seoDetails={result.seoDetails} url={result.url} />
          </div>
        )}

        {/* Rankings Section */}
        {result.rankings && (
          <div className="border rounded-xl border-gray-200 bg-white p-6 shadow-sm mt-10">
            <h2 className="text-xl font-semibold mb-1">Rankings</h2>
            <p className="text-sm text-gray-500 mb-6">Top Organic Keyword Insights</p>
            <div className="divide-y divide-gray-200">
              <div className="flex justify-between items-center py-4">
                <span className="text-sm text-gray-500">Primary Keyword</span>
                <span className="font-bold text-gray-900">{result.rankings.primaryKeyword || '—'}</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-sm text-gray-500">Word Count</span>
                <span className="font-bold text-gray-900">{result.rankings.wordCount ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-sm text-gray-500">Keyword Density</span>
                <span className="font-bold text-gray-900">{result.rankings.keywordDensity ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-sm text-gray-500">Keyword in Title</span>
                <span className="font-bold text-gray-900">{result.rankings.keywordInTitle ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between items-center py-4">
                <span className="text-sm text-gray-500">Keyword in H1</span>
                <span className="font-bold text-gray-900">{result.rankings.keywordInH1 ? 'Yes' : 'No'}</span>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Top Related Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {(result.rankings.topRelatedKeywords || []).map((kw, i) => (
                  <Badge key={i} variant="secondary">{kw}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Modal */}
      <ScreenshotModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        src={currentScreenshot}
        type={modalType}
        url={result.url}
      />
    </>
  );
}

function scoreToGrade(score) {
  if (score == null || score < 0) return '—';
  const s = Math.min(100, Math.round(score));
  if (s >= 97) return 'A+';
  if (s >= 93) return 'A';
  if (s >= 90) return 'A-';
  if (s >= 87) return 'B+';
  if (s >= 83) return 'B';
  if (s >= 80) return 'B-';
  if (s >= 77) return 'C+';
  if (s >= 73) return 'C';
  if (s >= 70) return 'C-';
  if (s >= 67) return 'D+';
  if (s >= 63) return 'D';
  if (s >= 60) return 'D-';
  return 'F';
}