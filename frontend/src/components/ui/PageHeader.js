'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export function PageHeader({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className,
  children
}) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-6 border-b border-border', className)}>
      <div className="space-y-1">
        {breadcrumbs && (
          <nav className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
            {Array.isArray(breadcrumbs) ? (
              breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-1.5">
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-foreground transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-semibold">{crumb.label}</span>
                  )}
                  {idx < breadcrumbs.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                  )}
                </span>
              ))
            ) : (
              breadcrumbs
            )}
          </nav>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {badge && <div>{badge}</div>}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground max-w-3xl">
            {description}
          </p>
        )}
      </div>

      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
