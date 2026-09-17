'use client';

import { cn } from '@/lib/utils';

const buttonVariants = {
  default:
    'bg-signal text-white hover:bg-signal-hover shadow-sm transition-colors duration-150',
  gradient:
    'bg-signal text-white hover:bg-signal-hover shadow-sm transition-colors duration-150',
  secondary:
    'bg-muted text-foreground hover:bg-muted/80 transition-colors',
  outline:
    'border border-border bg-card text-foreground hover:bg-muted transition-colors',
  ghost:
    'hover:bg-muted hover:text-foreground transition-colors',
};

const sizeVariants = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-9 px-3 text-xs',
  lg: 'h-11 px-6 text-base',
  icon: 'h-10 w-10',
};

export function Button({ className, variant = 'default', size = 'default', ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant] || buttonVariants.default,
        sizeVariants[size] || sizeVariants.default,
        className
      )}
      {...props}
    />
  );
}
