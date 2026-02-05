import React, { useCallback } from 'react';
import { Play, StopCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { OrchestratorHeader } from './OrchestratorHeader';
import { OrchestratorMessages } from './OrchestratorMessages';
import { OrchestratorComposer } from './OrchestratorComposer';
import { OrchestratorToolbar } from './OrchestratorToolbar';
import { cn } from '../../lib/utils';
import type { UseOrchestratorResult } from '../../hooks/useOrchestrator';

interface OrchestratorPanelProps {
  orchestrator: UseOrchestratorResult;
  mainSessionId: string | undefined;
  workingDirectory: string | undefined;
  className?: string;
}

export function OrchestratorPanel({
  orchestrator,
  mainSessionId,
  workingDirectory,
  className
}: OrchestratorPanelProps) {
  const { state, togglePanel, closePanel, startOrchestrator, stopOrchestrator, sendMessage, refreshContext } = orchestrator;

  const handleStart = useCallback(async () => {
    if (!mainSessionId || !workingDirectory) return;
    await startOrchestrator(mainSessionId, workingDirectory);
  }, [mainSessionId, workingDirectory, startOrchestrator]);

  const handleQuickAction = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  // Don't render if panel is closed
  if (!state.isOpen) {
    return null;
  }

  const isActive = state.status === 'ready' || state.status === 'busy';
  const canStart = mainSessionId && workingDirectory && !isActive && !state.isLoading;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background border-l border-border',
        'w-[350px] lg:w-[400px]',
        'animate-in slide-in-from-right-2 duration-200',
        className
      )}
    >
      <OrchestratorHeader
        isOpen={true}
        status={state.status}
        onToggle={togglePanel}
        onClose={closePanel}
        onRefresh={refreshContext}
        isLoading={state.isLoading}
      />

      {/* Not started state */}
      {!isActive && !state.isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 p-4 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Start an orchestrator to get AI assistance with analyzing and managing your conversation.
          </p>
          <Button
            onClick={handleStart}
            disabled={!canStart}
            className="gap-2"
          >
            <Play size={16} />
            Start Orchestrator
          </Button>
          {!mainSessionId && (
            <p className="text-xs text-muted-foreground mt-2">
              No active session to orchestrate
            </p>
          )}
        </div>
      )}

      {/* Loading state */}
      {state.isLoading && (
        <div className="flex flex-col items-center justify-center flex-1 p-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground mt-2">
            {state.orchestratorId ? 'Processing...' : 'Starting orchestrator...'}
          </p>
        </div>
      )}

      {/* Active state */}
      {isActive && !state.isLoading && (
        <>
          <OrchestratorToolbar
            onQuickAction={handleQuickAction}
            disabled={state.status === 'busy'}
          />

          <div className="flex-1 overflow-hidden">
            <OrchestratorMessages
              messages={state.messages}
              toolResults={state.toolResults}
              isStreaming={state.isStreaming && state.status === 'busy'}
            />
          </div>

          <OrchestratorComposer
            onSend={sendMessage}
            disabled={state.status === 'busy'}
          />

          {/* Stop button */}
          <div className="p-2 border-t border-border bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-destructive hover:text-destructive"
              onClick={stopOrchestrator}
            >
              <StopCircle size={14} />
              Stop Orchestrator
            </Button>
          </div>
        </>
      )}

      {/* Error display */}
      {state.error && (
        <div className="p-2 bg-destructive/10 text-destructive text-sm">
          {state.error}
        </div>
      )}
    </div>
  );
}
