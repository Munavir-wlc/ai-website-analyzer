'use client';

import { cn } from '@/lib/utils';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export function StatCard({
  title,
  value,
  change,
  subtitle,
  icon: Icon,
  badge,
  className,
  loading = false,
  ...props
}) {
  if (loading) {
    return (
      <div className={cn('rounded-lg border border-border bg-card p-5 shadow-sm animate-pulse space-y-3', className)}>
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-24 bg-muted rounded" />
          <div className="h-8 w-8 bg-muted rounded-lg" />
        </div>
        <div className="h-7 w-20 bg-muted rounded" />
        <div className="h-3 w-32 bg-muted rounded" />
      </div>
    );
  }

  const isPositive = typeof change === 'object' ? change.positive : (typeof change === 'string' && (change.startsWith('+') || change.includes('↑')));
  const isNegative = typeof change === 'object' ? !change.positive : (typeof change === 'string' && (change.startsWith('-') || change.includes('↓')));
  const changeText = typeof change === 'object' ? change.value : change;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-700',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground font-mono">{value ?? '—'}</span>
        {badge && <div>{badge}</div>}
      </div>

      {(changeText || subtitle) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {changeText && (
            <span
              className={cn(
                'inline-flex items-center font-medium font-mono text-[11px] px-1.5 py-0.5 rounded',
                isPositive && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                isNegative && 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                !isPositive && !isNegative && 'bg-muted text-muted-foreground'
              )}
            >
              {isPositive && <ArrowUpRight className="h-3 w-3 mr-0.5" />}
              {isNegative && <ArrowDownRight className="h-3 w-3 mr-0.5" />}
              {!isPositive && !isNegative && <Minus className="h-3 w-3 mr-0.5" />}
              {changeText}
            </span>
          )}
          {subtitle && <span className="truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}

export default StatCard;
