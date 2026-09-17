'use client';

import { cn } from '@/lib/utils';

export function getScoreGrade(score) {
  const s = Number(score) || 0;
  if (s >= 90) return { grade: 'A+', label: 'Excellent', color: 'text-emerald-600 dark:text-emerald-400', stroke: '#10B981' };
  if (s >= 80) return { grade: 'A', label: 'Good', color: 'text-emerald-600 dark:text-emerald-400', stroke: '#10B981' };
  if (s >= 70) return { grade: 'B', label: 'Fair', color: 'text-primary', stroke: '#2E5FE8' };
  if (s >= 60) return { grade: 'C', label: 'Moderate Risk', color: 'text-amber-600 dark:text-amber-400', stroke: '#F59E0B' };
  if (s >= 50) return { grade: 'D', label: 'High Risk', color: 'text-orange-600 dark:text-orange-400', stroke: '#F97316' };
  return { grade: 'F', label: 'Critical Risk', color: 'text-rose-600 dark:text-rose-400', stroke: '#EF4444' };
}

export function ScoreIndicator({
  score = 0,
  size = 'md',
  showGrade = true,
  showLabel = false,
  className
}) {
  const s = Math.min(100, Math.max(0, Number(score) || 0));
  const { grade, label, color, stroke } = getScoreGrade(s);

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (s / 100) * circumference;

  const sizeClasses = {
    sm: { container: 'h-14 w-14', text: 'text-base font-bold', gradeText: 'text-[10px]' },
    md: { container: 'h-20 w-20', text: 'text-xl font-bold', gradeText: 'text-xs' },
    lg: { container: 'h-28 w-28', text: 'text-3xl font-extrabold', gradeText: 'text-sm' },
  }[size] || { container: 'h-20 w-20', text: 'text-xl font-bold', gradeText: 'text-xs' };

  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <div className={cn('relative flex items-center justify-center', sizeClasses.container)}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88">
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted/60"
            strokeWidth="7"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={cn('font-mono leading-none text-foreground', sizeClasses.text)}>
            {s}
          </span>
          {showGrade && (
            <span className={cn('font-bold font-mono uppercase mt-0.5', color, sizeClasses.gradeText)}>
              {grade}
            </span>
          )}
        </div>
      </div>

      {showLabel && (
        <span className={cn('text-xs font-semibold uppercase tracking-wider', color)}>
          {label}
        </span>
      )}
    </div>
  );
}

export default ScoreIndicator;
