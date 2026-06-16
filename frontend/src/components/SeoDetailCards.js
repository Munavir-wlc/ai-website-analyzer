'use client';

/**
 * SEO Detail Cards - Renders granular SEO report sections (Title Tag, Meta Description, etc.)
 * Used in the two-column layout next to the grade/summary section.
 */
function StatusIcon({ status }) {
  if (status === 'pass') {
    return <span className="text-green-600 text-lg">✓</span>;
  }
  if (status === 'fail') {
    return <span className="text-red-600 text-lg">✕</span>;
  }
  return <span className="text-gray-500 text-sm">i</span>;
}

function DetailCard({ title, status, children, iconStatus = 'info' }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white flex gap-3">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
        {children}
      </div>
      <div className="shrink-0 flex items-start">
        <StatusIcon status={iconStatus} />
      </div>
    </div>
  );
}

export default function SeoDetailCards({ seoDetails, url }) {
  if (!seoDetails) return null;

  const d = seoDetails;
  const displayUrl = url ? (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })() : '';

  const titleLen = d.title?.length ?? 0;
  const titlePass = titleLen >= 50 && titleLen <= 60;
  const metaLen = d.metaDescription?.length ?? 0;
  const metaPass = metaLen >= 120 && metaLen <= 160;
  const h1Pass = d.h1Count === 1;
  const contentPass = (d.wordCount ?? 0) >= 300;
  const altPass = (d.imagesWithoutAlt ?? 0) === 0;

  const headingData = [
    { tag: 'H2', count: d.h2Count ?? 0 },
    { tag: 'H3', count: d.h3Count ?? 0 },
    { tag: 'H4', count: d.h4Count ?? 0 },
    { tag: 'H5', count: d.h5Count ?? 0 },
    { tag: 'H6', count: d.h6Count ?? 0 },
  ];
  const maxCount = Math.max(...headingData.map((h) => h.count), 1);

  return (
    <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-12rem)] pr-2">
      {/* Title Tag */}
      <DetailCard
        title="Title Tag"
        iconStatus={d.title ? (titlePass ? 'pass' : 'fail') : 'fail'}
      >
        {d.title ? (
          <>
            <p className="text-sm text-gray-600">
              {titlePass
                ? 'Title length is optimal (50-60 characters).'
                : `Ideally 50-60 characters. Current: ${titleLen} characters.`}
            </p>
            <p className="text-sm font-medium text-gray-800 mt-1">{d.title}</p>
            <p className="text-xs text-gray-500 mt-1">Length: {titleLen}</p>
          </>
        ) : (
          <p className="text-sm text-gray-600">Missing title tag.</p>
        )}
      </DetailCard>

      {/* Meta Description */}
      <DetailCard
        title="Meta Description Tag"
        iconStatus={d.metaDescription ? (metaPass ? 'pass' : 'fail') : 'fail'}
      >
        {d.metaDescription ? (
          <>
            <p className="text-sm text-gray-600">
              {metaPass
                ? 'Meta description length is optimal (120-160 characters).'
                : `Ideally 120-160 characters. Current: ${metaLen} characters.`}
            </p>
            <p className="text-sm font-medium text-gray-800 mt-1">{d.metaDescription}</p>
            <p className="text-xs text-gray-500 mt-1">Length: {metaLen}</p>
          </>
        ) : (
          <p className="text-sm text-gray-600">Missing meta description.</p>
        )}
      </DetailCard>

      {/* SERP Preview */}
      <DetailCard title="SERP Snippet Preview" iconStatus="info">
        <p className="text-xs text-gray-500 mb-2">How your page may appear in search results.</p>
        <div className="border border-gray-200 rounded p-3 bg-gray-50 text-sm">
          <p className="text-green-700 font-medium">{d.title || 'Page Title'}</p>
          <p className="text-blue-600 text-xs mt-0.5">{displayUrl}</p>
          <p className="text-gray-600 mt-1">{d.metaDescription || 'No description.'}</p>
        </div>
      </DetailCard>

      {/* Hreflang */}
      <DetailCard
        title="Hreflang Usage"
        iconStatus={d.hasHreflang ? 'pass' : 'info'}
      >
        <p className="text-sm text-gray-600">
          {d.hasHreflang ? 'Your page uses Hreflang attributes.' : 'Your page is not using Hreflang attributes.'}
        </p>
      </DetailCard>

      {/* Language */}
      <DetailCard
        title="Language"
        iconStatus={d.lang ? 'pass' : 'fail'}
      >
        <p className="text-sm text-gray-600">
          {d.lang ? `Declared: ${d.lang}` : 'No lang attribute found.'}
        </p>
      </DetailCard>

      {/* H1 Usage */}
      <DetailCard
        title="H1 Header Tag Usage"
        iconStatus={h1Pass ? 'pass' : 'fail'}
      >
        <p className="text-sm text-gray-600">
          {d.h1Count === 0
            ? 'No H1 tag found.'
            : d.h1Count === 1
              ? 'Your page has one H1 tag.'
              : `Your page has ${d.h1Count} H1 tags (use only one).`}
        </p>
      </DetailCard>

      {/* H2-H6 Usage */}
      <DetailCard
        title="H2-H6 Header Tag Usage"
        iconStatus={headingData.some((h) => h.count > 0) ? 'pass' : 'info'}
      >
        <div className="mt-2 space-y-1.5">
          {headingData.map(({ tag, count }) => (
            <div key={tag} className="flex items-center gap-2">
              <span className="text-xs font-medium w-8">{tag}:</span>
              <span className="text-xs text-gray-600 w-6">{count}</span>
              <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </DetailCard>

      {/* Amount of Content */}
      <DetailCard
        title="Amount of Content"
        iconStatus={contentPass ? 'pass' : 'info'}
      >
        <p className="text-sm text-gray-600">
          {contentPass
            ? `Your page has good textual content (${d.wordCount ?? 0} words).`
            : `Word count: ${d.wordCount ?? 0}. Consider adding more content (300+ words).`}
        </p>
      </DetailCard>

      {/* Image Alt */}
      <DetailCard
        title="Image Alt Attributes"
        iconStatus={altPass ? 'pass' : 'fail'}
      >
        <p className="text-sm text-gray-600">
          {altPass
            ? 'All images have alt attributes.'
            : `${d.imagesWithoutAlt ?? 0} image(s) missing alt attributes.`}
        </p>
      </DetailCard>

      {/* Canonical */}
      <DetailCard
        title="Canonical Tag"
        iconStatus={d.hasCanonical ? 'pass' : 'fail'}
      >
        <p className="text-sm text-gray-600">
          {d.hasCanonical ? `Using: ${d.canonicalUrl || 'Yes'}` : 'Missing canonical tag.'}
        </p>
      </DetailCard>

      {/* Noindex */}
      <DetailCard
        title="Noindex Tag Test"
        iconStatus={!d.hasNoindex ? 'pass' : 'fail'}
      >
        <p className="text-sm text-gray-600">
          {d.hasNoindex ? 'Page uses Noindex (blocks indexing).' : 'Page is not using Noindex.'}
        </p>
      </DetailCard>

      {/* SSL */}
      <DetailCard
        title="SSL Enabled"
        iconStatus={d.isHttps ? 'pass' : 'fail'}
      >
        <p className="text-sm text-gray-600">
          {d.isHttps ? 'Website has SSL enabled.' : 'Website does not use HTTPS.'}
        </p>
      </DetailCard>

      {/* Robots.txt */}
      <DetailCard
        title="Robots.txt"
        iconStatus={d.hasRobotsTxt ? 'pass' : 'fail'}
      >
        <p className="text-sm text-gray-600">
          {d.hasRobotsTxt ? 'Robots.txt file found.' : 'Robots.txt not found.'}
        </p>
      </DetailCard>

      {/* Sitemap */}
      <DetailCard
        title="Sitemap"
        iconStatus={d.hasSitemap ? 'pass' : 'fail'}
      >
        <p className="text-sm text-gray-600">
          {d.hasSitemap ? 'Sitemap found.' : 'Sitemap not found.'}
        </p>
      </DetailCard>
    </div>
  );
}
