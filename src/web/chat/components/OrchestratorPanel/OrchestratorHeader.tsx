import React from 'react';
import { ChevronRight, X, RefreshCw, Bot } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface OrchestratorHeaderProps {
  isOpen: boolean;
  status: 'initializing' | 'ready' | 'busy' | 'stopped' | null;
  onToggle: () => void;
  onClose: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

function getStatusColor(status: OrchestratorHeaderProps['status']) {
  switch (status) {
    case 'ready':
      return 'bg-green-500';
    case 'busy':
      return 'bg-amber-500';
    case 'initializing':
      return 'bg-blue-500 animate-pulse';
    case 'stopped':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
}

export function OrchestratorHeader({
  isOpen,
  status,
  onToggle,
  onClose,
  onRefresh,
  isLoading
}: OrchestratorHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-2',
        'border-b border-border bg-muted/30',
        'cursor-pointer select-none'
      )}
      onClick={onToggle}
    >
      <div className="flex items-center gap-2">
        <ChevronRight
          size={16}
          className={cn(
            'text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-90'
          )}
        />
        <Bot size={16} className="text-primary" />
        <span className="text-sm font-medium">Orchestrator</span>
        {status && (
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              getStatusColor(status)
            )}
            title={status}
          />
        )}
      </div>

      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {status === 'ready' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh context"
          >
            <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
          title="Close panel"
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}
