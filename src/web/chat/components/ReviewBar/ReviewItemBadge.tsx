import React from 'react';
import { cn } from '../../lib/utils';

interface ReviewItemBadgeProps {
  count: number;
  completed: number;
  className?: string;
}

export function ReviewItemBadge({ count, completed, className }: ReviewItemBadgeProps) {
  const remaining = count - completed;

  if (count === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full',
        remaining > 0
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        className
      )}
    >
      {remaining > 0 ? remaining : <span className="text-[10px]">&#x2713;</span>}
    </span>
  );
}
