'use client';

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

const TLD_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'];
const COUNTRY_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'];

function StatCard({ label, value }) {
  return (
    <div className="border border-gray-200 rounded-xl px-4 py-4 bg-white">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value?.toLocaleString?.() ?? value ?? '—'}</p>
    </div>
  );
}

function truncateUrl(url, maxLen = 40) {
  if (!url || typeof url !== 'string') return '—';
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + '...';
}

function isEmpty(links) {
  if (!links) return true;
  const s = links.summary ?? {};
  const total = s.totalBacklinks ?? 0;
  const domains = s.referringDomains ?? 0;
  const hasBacklinks = (links.topBacklinks ?? []).length > 0;
  return total === 0 && domains === 0 && !hasBacklinks;
}

export default function LinksSection({ links }) {
  const { summary = {}, topBacklinks = [], anchors = [], tlds = {}, countries = {}, apiError = null } = links ?? {};

  // Prepare TLD data for pie chart
  const tldData = Object.entries(tlds)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name: `.${name}`, value }));
  const hasTldData = tldData.length > 0;

  // Prepare country data for pie chart
  const countryData = Object.entries(countries)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
  const hasCountryData = countryData.length > 0;

  // Top Anchors for horizontal bar chart
  const anchorsChartData = (anchors || []).slice(0, 10).map((a) => ({
    name: (a.anchor || '(empty)').slice(0, 30),
    count: a.count ?? 0,
  }));

  // Top Pages by Backlinks - use topBacklinks with domainStrength
  const pagesChartData = (topBacklinks || []).slice(0, 10).map((b, i) => ({
    name: truncateUrl(b.url, 25),
    strength: b.domainStrength ?? 0,
  }));

  const hasNoData = isEmpty(links);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Links</h2>
        <p className="text-sm text-gray-500 mt-1">Backlink analysis and referring domains</p>
      </div>

      {hasNoData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">No backlink data available</p>
          <p className="mt-2 text-amber-700">
            {apiError ? (
              <>
                <strong>DataForSEO API:</strong>{' '}
                {apiError.includes('subscription') || apiError.includes('activate') ? (
                  <>
                    Your account needs an active Backlinks API subscription.{' '}
                    <a
                      href="https://app.dataforseo.com/backlinks-subscription"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium hover:text-amber-900"
                    >
                      Activate at DataForSEO
                    </a>
                  </>
                ) : apiError.includes('DATA_FOR_SEO') ? (
                  <>Set <code className="rounded bg-amber-100 px-1">DATA_FOR_SEO_LOGIN</code> and <code className="rounded bg-amber-100 px-1">DATA_FOR_SEO_PASSWORD</code> in <code className="rounded bg-amber-100 px-1">backend/.env</code></>
                ) : (
                  apiError
                )}
              </>
            ) : (
              <>
                Ensure <code className="rounded bg-amber-100 px-1">DATA_FOR_SEO_LOGIN</code> and{' '}
                <code className="rounded bg-amber-100 px-1">DATA_FOR_SEO_PASSWORD</code> are set in <code className="rounded bg-amber-100 px-1">backend/.env</code>.
                The domain may also have no backlinks in DataForSEO&apos;s index.
              </>
            )}
          </p>
        </div>
      )}

      {/* 1. Backlink Summary */}
      <div>
        <h3 className="text-base font-medium text-gray-900 mb-4">Backlink Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Backlinks" value={summary.totalBacklinks} />
          <StatCard label="Referring Domains" value={summary.referringDomains} />
          <StatCard label="Dofollow" value={summary.dofollow} />
          <StatCard label="Nofollow" value={summary.nofollow} />
          <StatCard label="IPs" value={summary.ips} />
          <StatCard label="Subnets" value={summary.subnets} />
        </div>
      </div>

      {/* 2. Top Backlinks Table */}
      <div>
        <h3 className="text-base font-medium text-gray-900 mb-4">Top Backlinks</h3>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Domain Strength</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Referring Page</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Page Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">Anchor Text</th>
                </tr>
              </thead>
              <tbody>
                {(topBacklinks || []).slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.domainStrength ?? '—'}</td>
                    <td className="px-4 py-3">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate block max-w-[200px]"
                      >
                        {truncateUrl(row.url, 50)}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-700 truncate max-w-[200px]" title={row.title}>
                      {row.title || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 truncate max-w-[150px]" title={row.anchor}>
                      {row.anchor || '(empty)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(!topBacklinks || topBacklinks.length === 0) && (
            <p className="px-4 py-8 text-center text-gray-500">No backlink data available</p>
          )}
        </div>
      </div>

      {/* 3. Top Anchors - Horizontal Bar Chart */}
      <div>
        <h3 className="text-base font-medium text-gray-900 mb-4">Top Anchors</h3>
        <div className="border border-gray-200 rounded-xl p-4 bg-white h-[300px]">
          {anchorsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={anchorsChartData} margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No anchor data</div>
          )}
        </div>
      </div>

      {/* 4. Top Pages by Backlinks - Bar Chart */}
      <div>
        <h3 className="text-base font-medium text-gray-900 mb-4">Top Pages by Backlinks</h3>
        <div className="border border-gray-200 rounded-xl p-4 bg-white h-[300px]">
          {pagesChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pagesChartData} margin={{ bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="strength" fill="#22c55e" name="Domain Strength" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">No backlink page data</div>
          )}
        </div>
      </div>

      {/* 5. Geography - TLD and Country Pie Charts */}
      <div>
        <h3 className="text-base font-medium text-gray-900 mb-4">Geography</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TLD Distribution */}
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <h4 className="text-sm font-medium text-gray-700 mb-4">TLD Distribution</h4>
            {hasTldData ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={tldData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {tldData.map((_, i) => (
                      <Cell key={i} fill={TLD_COLORS[i % TLD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-500">No TLD data</div>
            )}
          </div>

          {/* Country Distribution */}
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <h4 className="text-sm font-medium text-gray-700 mb-4">Country Distribution</h4>
            {hasCountryData ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={countryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {countryData.map((_, i) => (
                      <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => v.toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-500">No country data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
