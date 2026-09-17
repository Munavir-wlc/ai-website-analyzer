'use client';

import { cn } from '@/lib/utils';

const variantStyles = {
  default: 'bg-signal/10 text-signal border-signal/20',
  secondary: 'bg-muted text-foreground border-border',
  outline: 'border border-border text-foreground bg-transparent',
  muted: 'bg-muted text-muted-foreground border-transparent',
  // Severity tokens strictly for findings:
  critical: 'bg-critical/10 text-critical border-critical/30',
  caution: 'bg-caution/10 text-caution border-caution/30',
  ok: 'bg-ok/10 text-ok border-ok/30',
  destructive: 'bg-critical/10 text-critical border-critical/30',
  warning: 'bg-caution/10 text-caution border-caution/30',
  high: 'bg-critical/10 text-critical border-critical/30',
  medium: 'bg-caution/10 text-caution border-caution/30',
  low: 'bg-muted text-muted-foreground border-border',
};

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-medium border border-transparent',
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    />
  );
}
