'use client';

import { cn } from '@/lib/utils';

const buttonVariants = {
  default:
    'bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 hover:shadow-soft-lg transition-all duration-200',
  gradient:
    'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-soft hover:from-blue-700 hover:to-indigo-700 hover:shadow-soft-lg transition-all duration-200',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors',
  ghost: 'hover:bg-accent hover:text-accent-foreground transition-colors',
};

const sizeVariants = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 px-3 text-sm',
  lg: 'h-12 px-8 text-base',
  icon: 'h-10 w-10',
};

export function Button({ className, variant = 'default', size = 'default', ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium disabled:pointer-events-none disabled:opacity-50',
        buttonVariants[variant] || buttonVariants.default,
        sizeVariants[size] || sizeVariants.default,
        className
      )}
      {...props}
    />
  );
}
