/**
 * Backlink Analyzer - Fetches backlink data using DataForSEO Backlinks API
 * Returns normalized data for the Links UI
 */
const axios = require('axios');

const BASE_URL = 'https://api.dataforseo.com/v3';
const TIMEOUT = 15000;

/**
 * Normalize domain for API (strip protocol, www)
 */
function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return '';
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .trim() || '';
}

/**
 * Create axios instance with Basic Auth
 */
function createClient() {
  const login =  process.env.DATA_FOR_SEO_LOGIN;
  const password = process.env.DATA_FOR_SEO_PASSWORD;
  if (!login || !password) return null;

  const auth = Buffer.from(`${login}:${password}`).toString('base64');
  return axios.create({
    baseURL: BASE_URL,
    timeout: TIMEOUT,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Fetch backlink summary (aggregate metrics)
 */
async function fetchSummary(client, target) {
  try {
    const res = await client.post('/backlinks/summary/live', [
      { target, rank_scale: 'one_hundred' },
    ]);
    const task = res.data?.tasks?.[0];
    const status = task?.status_code;
    const msg = task?.status_message || res.data?.status_message;
    if (status !== 20000) {
      console.warn('[backlinkAnalyzer] Summary API status:', status, msg);
      return { _error: msg, _status: status };
    }
    if (!task?.result?.[0]) {
      console.warn('[backlinkAnalyzer] Summary API: no result data');
      return null;
    }
    return task.result[0];
  } catch (err) {
    console.warn('[backlinkAnalyzer] Summary API failed:', err.message);
    if (err.response?.data) {
      console.warn('[backlinkAnalyzer] Response:', JSON.stringify(err.response.data).slice(0, 300));
    }
    return null;
  }
}

/**
 * Fetch backlinks list (top backlinks, anchors)
 */
async function fetchBacklinks(client, target, limit = 100) {
  try {
    const res = await client.post('/backlinks/backlinks/live', [
      { target, limit, rank_scale: 'one_hundred', order_by: ['rank,desc'] },
    ]);
    const task = res.data?.tasks?.[0];
    const status = task?.status_code;
    const msg = task?.status_message || res.data?.status_message;
    if (status !== 20000) {
      console.warn('[backlinkAnalyzer] Backlinks API status:', status, msg);
      return { _error: msg, _status: status };
    }
    if (!task?.result?.[0]) {
      console.warn('[backlinkAnalyzer] Backlinks API: no result data');
      return null;
    }
    return task.result[0];
  } catch (err) {
    console.warn('[backlinkAnalyzer] Backlinks API failed:', err.message);
    if (err.response?.data) {
      console.warn('[backlinkAnalyzer] Response:', JSON.stringify(err.response.data).slice(0, 300));
    }
    return null;
  }
}

/**
 * Normalize DataForSEO response to our structure
 */
function normalizeResponse(summaryData, backlinksData) {
  const empty = {
    summary: {
      totalBacklinks: 0,
      referringDomains: 0,
      dofollow: 0,
      nofollow: 0,
      ips: 0,
      subnets: 0,
    },
    topBacklinks: [],
    anchors: [],
    tlds: { com: 0, org: 0, net: 0, other: 0 },
    countries: { US: 0, FI: 0, SG: 0, other: 0 },
  };

  if (!summaryData && !backlinksData) return empty;

  const s = summaryData || {};
  const attr = s.referring_links_attributes || {};
  const nofollowCount = typeof attr.nofollow === 'number' ? attr.nofollow : 0;
  const totalBacklinks = typeof s.backlinks === 'number' ? s.backlinks : 0;
  const dofollowCount = Math.max(0, totalBacklinks - nofollowCount);

  const summary = {
    totalBacklinks: totalBacklinks || 0,
    referringDomains: typeof s.referring_domains === 'number' ? s.referring_domains : 0,
    dofollow: dofollowCount,
    nofollow: nofollowCount,
    ips: typeof s.referring_ips === 'number' ? s.referring_ips : 0,
    subnets: typeof s.referring_subnets === 'number' ? s.referring_subnets : 0,
  };

  const topBacklinks = [];
  const anchorCounts = new Map();

  if (backlinksData?.items?.length) {
    for (const item of backlinksData.items.slice(0, 50)) {
      topBacklinks.push({
        domainStrength: typeof item.domain_from_rank === 'number' ? item.domain_from_rank : 0,
        url: item.url_from || '',
        title: item.page_from_title || '',
        anchor: item.anchor || '',
      });

      const anchor = (item.anchor || '(empty)').trim();
      anchorCounts.set(anchor, (anchorCounts.get(anchor) || 0) + 1);
    }
  }

  const anchors = [...anchorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([anchor, count]) => ({ anchor, count }));

  const tldData = s.referring_links_tld || {};
  const tlds = {
    com: typeof tldData.com === 'number' ? tldData.com : 0,
    org: typeof tldData.org === 'number' ? tldData.org : 0,
    net: typeof tldData.net === 'number' ? tldData.net : 0,
    other: Object.entries(tldData).reduce((sum, [k, v]) => {
      if (['com', 'org', 'net'].includes(k)) return sum;
      return sum + (typeof v === 'number' ? v : 0);
    }, 0),
  };

  const countryData = s.referring_links_countries || {};
  const countries = {
    US: typeof countryData.US === 'number' ? countryData.US : 0,
    FI: typeof countryData.FI === 'number' ? countryData.FI : 0,
    SG: typeof countryData.SG === 'number' ? countryData.SG : 0,
    other: Object.entries(countryData).reduce((sum, [k, v]) => {
      if (['US', 'FI', 'SG'].includes(k)) return sum;
      return sum + (typeof v === 'number' ? v : 0);
    }, 0),
  };

  return {
    summary,
    topBacklinks,
    anchors,
    tlds,
    countries,
  };
}

/**
 * Analyze backlinks for a domain
 * @param {string} domain - Domain to analyze (e.g. "example.com" or "https://www.example.com")
 * @returns {Promise<Object>} Normalized backlink data
 */
async function analyzeBacklinks(domain) {
  const target = normalizeDomain(domain);
  if (!target) {
    console.warn('[backlinkAnalyzer] Empty target domain');
    return normalizeResponse(null, null);
  }

  const client = createClient();
  if (!client) {
    console.warn('[backlinkAnalyzer] DATA_FOR_SEO_LOGIN or DATA_FOR_SEO_PASSWORD not set in .env');
    const result = normalizeResponse(null, null);
    result.apiError = 'DATA_FOR_SEO_LOGIN and DATA_FOR_SEO_PASSWORD must be set in backend/.env';
    return result;
  }

  console.log('[backlinkAnalyzer] Fetching backlinks for:', target);

  try {
    const [summaryData, backlinksData] = await Promise.all([
      fetchSummary(client, target),
      fetchBacklinks(client, target),
    ]);

    const summaryErr = summaryData?._error;
    const backlinksErr = backlinksData?._error;
    const apiError = summaryErr || backlinksErr;

    const cleanSummary = summaryData && !summaryData._error ? summaryData : null;
    const cleanBacklinks = backlinksData && !backlinksData._error ? backlinksData : null;

    const hasData = (cleanSummary?.backlinks ?? 0) > 0 || (cleanBacklinks?.items?.length ?? 0) > 0;
    console.log('[backlinkAnalyzer] Done:', hasData ? 'data found' : 'no data', apiError ? `(API: ${apiError?.slice(0, 60)}...)` : '');

    const result = normalizeResponse(cleanSummary, cleanBacklinks);
    if (apiError) result.apiError = apiError;
    return result;
  } catch (err) {
    console.warn('[backlinkAnalyzer] Failed:', err.message);
    const result = normalizeResponse(null, null);
    result.apiError = err.message || 'API request failed';
    return result;
  }
}

module.exports = {
  analyzeBacklinks,
  normalizeDomain,
};
