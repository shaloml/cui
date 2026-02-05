import React from 'react';
import { SuggestionChip } from './SuggestionChip';
import type { Suggestion } from '../../utils/suggestionExtractor';
import { cn } from '../../lib/utils';

interface SuggestionsAreaProps {
  suggestions: Suggestion[];
  onSuggestionClick: (suggestion: Suggestion) => void;
  disabled?: boolean;
  className?: string;
}

export function SuggestionsArea({
  suggestions,
  onSuggestionClick,
  disabled,
  className
}: SuggestionsAreaProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'w-full px-4 py-2',
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
        className
      )}
      role="region"
      aria-label="Suggested follow-up actions"
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.map((suggestion) => (
            <SuggestionChip
              key={suggestion.id}
              suggestion={suggestion}
              onClick={onSuggestionClick}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
