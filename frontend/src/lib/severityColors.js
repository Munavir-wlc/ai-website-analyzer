/**
 * Standardized Severity & Effort Color Design System
 */

export const SEVERITY_COLORS = {
  critical: {
    label: 'Critical',
    bg: 'bg-rose-500/10',
    bgSolid: 'bg-rose-600',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/30'
  },
  high: {
    label: 'High',
    bg: 'bg-orange-500/10',
    bgSolid: 'bg-orange-600',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    dot: 'bg-orange-500',
    ring: 'ring-orange-500/30'
  },
  medium: {
    label: 'Medium',
    bg: 'bg-amber-500/10',
    bgSolid: 'bg-amber-600',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/30'
  },
  low: {
    label: 'Low',
    bg: 'bg-blue-500/10',
    bgSolid: 'bg-blue-600',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-500',
    ring: 'ring-blue-500/30'
  },
  info: {
    label: 'Info',
    bg: 'bg-slate-500/10',
    bgSolid: 'bg-slate-600',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    dot: 'bg-slate-500',
    ring: 'ring-slate-500/30'
  },
  fixed: {
    label: 'Resolved',
    bg: 'bg-emerald-500/10',
    bgSolid: 'bg-emerald-600',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/30'
  }
};

/**
 * Returns color tokens for a given severity string.
 */
export function getSeverityStyle(severity) {
  const key = (severity || 'low').toLowerCase().trim();
  return SEVERITY_COLORS[key] || SEVERITY_COLORS.info;
}

/**
 * Effort level metadata and badges
 */
export const EFFORT_CONFIG = {
  low: {
    label: 'Quick Win',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    rank: 1
  },
  medium: {
    label: 'Medium Effort',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    rank: 2
  },
  high: {
    label: 'High Effort',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
    rank: 3
  }
};

/**
 * Infers an effort level ('low' | 'medium' | 'high') for a finding if not explicitly provided.
 */
export function getEffortLevel(finding) {
  if (finding.effort && EFFORT_CONFIG[finding.effort.toLowerCase()]) {
    return finding.effort.toLowerCase();
  }

  const category = (finding.category || '').toLowerCase();
  const title = (finding.title || '').toLowerCase();
  const id = (finding.id || '').toLowerCase();

  // Quick wins / low effort: header tweaks, cookie flags, meta tags, alt tags, robots.txt
  if (
    category.includes('cookie') ||
    category.includes('headers') ||
    category.includes('seo') ||
    category.includes('meta') ||
    title.includes('missing') ||
    title.includes('header') ||
    title.includes('cookie') ||
    id.includes('header') ||
    id.includes('cookie')
  ) {
    return 'low';
  }

  // Medium effort: SSL/TLS reconfig, CORS updates, redirect rules, cache policies
  if (
    category.includes('ssl') ||
    category.includes('dns') ||
    category.includes('cors') ||
    category.includes('performance') ||
    title.includes('cors') ||
    title.includes('ssl') ||
    title.includes('mixed content')
  ) {
    return 'medium';
  }

  // High effort: complex code refactoring, SQLi / XSS remediation, architecture, load resilience
  return 'high';
}
