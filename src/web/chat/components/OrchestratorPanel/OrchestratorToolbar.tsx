import React from 'react';
import { MessageSquareText, FileSearch, Terminal, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'analyze',
    label: 'Analyze',
    icon: <FileSearch size={14} />,
    prompt: 'Analyze the main conversation and provide insights on what has been accomplished and what might be missing.'
  },
  {
    id: 'suggest',
    label: 'Suggest',
    icon: <Sparkles size={14} />,
    prompt: 'Based on the main conversation, what would you suggest as the next steps or improvements?'
  },
  {
    id: 'summarize',
    label: 'Summarize',
    icon: <MessageSquareText size={14} />,
    prompt: 'Provide a concise summary of the main conversation so far, including key decisions and actions taken.'
  },
  {
    id: 'verify',
    label: 'Verify',
    icon: <Terminal size={14} />,
    prompt: 'Check the current state of the project. Run any necessary commands to verify the work done in the main conversation is working correctly.'
  }
];

interface OrchestratorToolbarProps {
  onQuickAction: (prompt: string) => void;
  disabled?: boolean;
}

export function OrchestratorToolbar({ onQuickAction, disabled }: OrchestratorToolbarProps) {
  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/20">
      {QUICK_ACTIONS.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          className={cn(
            'h-7 text-xs gap-1',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          onClick={() => !disabled && onQuickAction(action.prompt)}
          disabled={disabled}
          title={action.prompt}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
