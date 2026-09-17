'use client';

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function LoadingState({
  message = 'Loading data...',
  description,
  className
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center space-y-3', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{message}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
