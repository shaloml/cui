import React, { useState } from 'react';
import { ChevronDown, ClipboardCheck } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Button } from '../ui/button';
import { ReviewItemBadge } from './ReviewItemBadge';
import { ReviewItemList } from './ReviewItemList';
import { cn } from '../../lib/utils';
import type { ReviewItem } from '../../utils/reviewExtractor';

interface ReviewBarProps {
  items: ReviewItem[];
  completedCount: number;
  onToggle: (itemId: string) => void;
  onClearCompleted?: () => void;
  className?: string;
}

export function ReviewBar({
  items,
  completedCount,
  onToggle,
  onClearCompleted,
  className
}: ReviewBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const totalCount = items.length;

  // Don't render if there are no items
  if (totalCount === 0) {
    return null;
  }

  const hasCompleted = completedCount > 0;
  const allCompleted = completedCount === totalCount;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn(
        'border-b border-border/50 bg-muted/30',
        'animate-in slide-in-from-top-2 fade-in-0 duration-300',
        className
      )}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center justify-between w-full px-4 py-2',
            'text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50',
            'transition-colors duration-200 cursor-pointer'
          )}
        >
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className={allCompleted ? 'text-green-500' : 'text-amber-500'} />
            <span className="font-medium">Review Items</span>
            <ReviewItemBadge count={totalCount} completed={completedCount} />
          </div>
          <ChevronDown
            size={16}
            className={cn(
              'transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent
        className={cn(
          'overflow-hidden',
          'data-[state=open]:animate-collapsible-down',
          'data-[state=closed]:animate-collapsible-up'
        )}
      >
        <div className="px-4 pb-3">
          <div className="bg-background rounded-lg border border-border/50 shadow-sm">
            <div className="max-h-[200px] overflow-y-auto px-3">
              <ReviewItemList items={items} onToggle={onToggle} />
            </div>

            {hasCompleted && onClearCompleted && (
              <div className="flex justify-end px-3 py-2 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearCompleted();
                  }}
                >
                  Clear completed
                </Button>
              </div>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
