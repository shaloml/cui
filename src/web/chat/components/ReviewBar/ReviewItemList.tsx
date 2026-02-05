import React from 'react';
import { AlertTriangle, CheckCircle2, Circle, ListTodo, Search } from 'lucide-react';
import { Checkbox } from '../ui/checkbox';
import { cn } from '../../lib/utils';
import type { ReviewItem } from '../../utils/reviewExtractor';

interface ReviewItemListProps {
  items: ReviewItem[];
  onToggle: (itemId: string) => void;
}

function getItemIcon(type: ReviewItem['type']) {
  switch (type) {
    case 'todo':
      return <ListTodo size={14} className="text-blue-500" />;
    case 'verify':
      return <Search size={14} className="text-purple-500" />;
    case 'check':
      return <CheckCircle2 size={14} className="text-green-500" />;
    case 'warning':
      return <AlertTriangle size={14} className="text-amber-500" />;
    default:
      return <Circle size={14} className="text-muted-foreground" />;
  }
}

function getItemLabel(type: ReviewItem['type']) {
  switch (type) {
    case 'todo':
      return 'TODO';
    case 'verify':
      return 'Verify';
    case 'check':
      return 'Check';
    case 'warning':
      return 'Note';
    default:
      return 'Item';
  }
}

export function ReviewItemList({ items, onToggle }: ReviewItemListProps) {
  if (items.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No items to review
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/50" role="list">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            'flex items-start gap-3 py-2 px-1 transition-colors',
            item.completed && 'opacity-60'
          )}
        >
          <Checkbox
            id={`review-${item.id}`}
            checked={item.completed}
            onCheckedChange={() => onToggle(item.id)}
            className="mt-0.5 shrink-0"
            aria-label={`Mark "${item.text}" as ${item.completed ? 'incomplete' : 'complete'}`}
          />
          <label
            htmlFor={`review-${item.id}`}
            className={cn(
              'flex-1 cursor-pointer select-none',
              item.completed && 'line-through'
            )}
          >
            <div className="flex items-center gap-2 mb-0.5">
              {getItemIcon(item.type)}
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {getItemLabel(item.type)}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{item.text}</p>
          </label>
        </li>
      ))}
    </ul>
  );
}
