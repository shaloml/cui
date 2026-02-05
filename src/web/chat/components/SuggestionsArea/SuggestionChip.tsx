import React from 'react';
import { Lightbulb, HelpCircle, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Suggestion } from '../../utils/suggestionExtractor';

interface SuggestionChipProps {
  suggestion: Suggestion;
  onClick: (suggestion: Suggestion) => void;
  disabled?: boolean;
}

function getChipIcon(type: Suggestion['type']) {
  switch (type) {
    case 'action':
      return <ArrowRight size={12} className="shrink-0" />;
    case 'question':
      return <HelpCircle size={12} className="shrink-0" />;
    case 'next-step':
      return <Lightbulb size={12} className="shrink-0" />;
    default:
      return <Lightbulb size={12} className="shrink-0" />;
  }
}

export function SuggestionChip({ suggestion, onClick, disabled }: SuggestionChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm',
        'bg-muted/50 hover:bg-muted border border-border/50 hover:border-border',
        'rounded-full transition-all duration-200',
        'text-muted-foreground hover:text-foreground',
        'max-w-full overflow-hidden',
        disabled && 'opacity-50 cursor-not-allowed hover:bg-muted/50 hover:border-border/50 hover:text-muted-foreground'
      )}
    >
      {getChipIcon(suggestion.type)}
      <span className="truncate">{suggestion.text}</span>
    </button>
  );
}
