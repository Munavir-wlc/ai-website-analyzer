'use client';

import { cn } from '@/lib/utils';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    icon: ShieldAlert,
    classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    dot: 'bg-rose-500'
  },
  high: {
    label: 'High',
    icon: AlertTriangle,
    classes: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
    dot: 'bg-orange-500'
  },
  medium: {
    label: 'Medium',
    icon: AlertCircle,
    classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dot: 'bg-amber-500'
  },
  caution: {
    label: 'Medium',
    icon: AlertCircle,
    classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    dot: 'bg-amber-500'
  },
  low: {
    label: 'Low',
    icon: Info,
    classes: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    dot: 'bg-blue-500'
  },
  info: {
    label: 'Info',
    icon: Info,
    classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
    dot: 'bg-slate-500'
  },
  informational: {
    label: 'Info',
    icon: Info,
    classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
    dot: 'bg-slate-500'
  },
  resolved: {
    label: 'Resolved',
    icon: CheckCircle2,
    classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-500'
  },
  fixed: {
    label: 'Resolved',
    icon: CheckCircle2,
    classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-500'
  },
  ok: {
    label: 'Passed',
    icon: CheckCircle2,
    classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-500'
  }
};

export function SeverityBadge({
  severity = 'info',
  showIcon = true,
  showDot = false,
  className,
  children
}) {
  const key = (severity || 'info').toLowerCase();
  const config = SEVERITY_CONFIG[key] || SEVERITY_CONFIG.info;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider border transition-colors',
        config.classes,
        className
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} />}
      {showIcon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span>{children || config.label}</span>
    </span>
  );
}

export default SeverityBadge;
