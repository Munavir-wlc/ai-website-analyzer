'use client';

import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  active: { label: 'Active', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
  healthy: { label: 'Healthy', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
  completed: { label: 'Completed', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },
  success: { label: 'Success', classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' },

  monitoring: { label: 'Monitoring', classes: 'bg-primary/10 text-primary border-primary/30', dot: 'bg-primary animate-pulse' },
  running: { label: 'Running', classes: 'bg-primary/10 text-primary border-primary/30', dot: 'bg-primary animate-pulse' },
  queued: { label: 'Queued', classes: 'bg-primary/10 text-primary border-primary/30', dot: 'bg-primary' },

  warning: { label: 'Warning', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
  in_progress: { label: 'In Progress', classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },

  critical: { label: 'Critical', classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30', dot: 'bg-rose-500' },
  failed: { label: 'Failed', classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30', dot: 'bg-rose-500' },
  error: { label: 'Error', classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30', dot: 'bg-rose-500' },

  paused: { label: 'Paused', classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30', dot: 'bg-slate-500' },
  offline: { label: 'Offline', classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30', dot: 'bg-slate-500' },
};

export function StatusBadge({
  status = 'active',
  showDot = true,
  className,
  children
}) {
  const key = (status || 'active').toLowerCase().replace(/\s+/g, '_');
  const config = STATUS_CONFIG[key] || STATUS_CONFIG.active;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-xs font-medium border transition-colors',
        config.classes,
        className
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} />}
      <span>{children || config.label}</span>
    </span>
  );
}

export default StatusBadge;
