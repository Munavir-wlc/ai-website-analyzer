'use client';

import { cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';

export function EmptyState({
  icon: Icon = ShieldAlert,
  title,
  description,
  action,
  className
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 p-8 sm:p-12 text-center transition-colors', className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export default EmptyState;
