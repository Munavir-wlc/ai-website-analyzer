'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred while loading this data. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
  className
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 p-8 text-center space-y-4 max-w-md mx-auto my-8', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-foreground tracking-tight">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="gap-2 border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
