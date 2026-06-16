'use client';

import { cn } from '@/lib/utils';

const variantStyles = {
  default: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  outline: 'border border-input',
  high: 'bg-red-100 text-red-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-100 text-slate-700',
};

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    />
  );
}
