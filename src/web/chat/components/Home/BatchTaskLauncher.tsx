import React, { useState, useRef, useCallback } from 'react';
import { Plus, Rocket, ChevronDown, Bot, Zap, Drone, Code2, Gauge, FileText, X as XIcon } from 'lucide-react';
import { BatchTaskRow, BatchTask } from './BatchTaskRow';
import { DropdownSelector, DropdownOption } from '../DropdownSelector';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { api } from '../../services/api';
import { cn } from '../../lib/utils';
import type { PermissionMode } from '../../types';

interface BatchTaskLauncherProps {
  recentDirectories: Record<string, { lastDate: string; shortname: string }>;
  defaultDirectory?: string;
  defaultPermissionMode?: PermissionMode;
  onLaunchComplete: () => void;
  onExitBatch: () => void;
}

let taskCounter = 0;
function createEmptyTask(directory: string): BatchTask {
  return {
    id: `batch-${Date.now()}-${++taskCounter}`,
    prompt: '',
    directory,
  };
}

export function BatchTaskLauncher({
  recentDirectories,
  defaultDirectory = '',
  defaultPermissionMode,
  onLaunchComplete,
  onExitBatch,
}: BatchTaskLauncherProps) {
  const [tasks, setTasks] = useState<BatchTask[]>([createEmptyTask(defaultDirectory)]);
  const [sharedModel, setSharedModel] = useState('default');
  const [sharedPermissionMode, setSharedPermissionMode] = useState(defaultPermissionMode || 'default');
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResults, setLaunchResults] = useState<Map<string, 'launching' | 'success' | 'error'>>(new Map());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isModelOpen, setIsModelOpen] = useState(false);
  const [isModeOpen, setIsModeOpen] = useState(false);

  const handleUpdateTask = useCallback((id: string, updates: Partial<BatchTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const handleRemoveTask = useCallback((id: string) => {
    setTasks(prev => prev.length > 1 ? prev.filter(t => t.id !== id) : prev);
  }, []);

  const handleAddTask = useCallback(() => {
    const lastTask = tasks[tasks.length - 1];
    const dir = lastTask?.directory || defaultDirectory;
    setTasks(prev => [...prev, createEmptyTask(dir)]);
    // Focus the new task's textarea after render
    setTimeout(() => {
      const textareas = containerRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea[data-batch-row-index]');
      if (textareas && textareas.length > 0) {
        textareas[textareas.length - 1]?.focus();
      }
    }, 50);
  }, [tasks, defaultDirectory]);

  const handleFocusNext = useCallback((currentIndex: number) => {
    const textareas = containerRef.current?.querySelectorAll<HTMLTextAreaElement>('textarea[data-batch-row-index]');
    if (textareas && currentIndex + 1 < textareas.length) {
      textareas[currentIndex + 1]?.focus();
    }
  }, []);

  // Validate all tasks before launch
  const canLaunch = tasks.every(t => t.prompt.trim() && t.directory);

  const handleLaunchAll = async () => {
    if (!canLaunch || isLaunching) return;

    setIsLaunching(true);
    setSuccessMessage(null);

    // Initialize all tasks as 'launching'
    const initialResults = new Map<string, 'launching' | 'success' | 'error'>();
    tasks.forEach(t => initialResults.set(t.id, 'launching'));
    setLaunchResults(new Map(initialResults));

    // Fire all requests
    const promises = tasks.map(async (task) => {
      try {
        await api.startConversation({
          workingDirectory: task.directory,
          initialPrompt: task.prompt,
          model: sharedModel === 'default' ? undefined : sharedModel,
          permissionMode: sharedPermissionMode === 'default' ? undefined : sharedPermissionMode,
        });
        setLaunchResults(prev => {
          const next = new Map(prev);
          next.set(task.id, 'success');
          return next;
        });
        return { id: task.id, status: 'success' as const };
      } catch {
        setLaunchResults(prev => {
          const next = new Map(prev);
          next.set(task.id, 'error');
          return next;
        });
        return { id: task.id, status: 'error' as const };
      }
    });

    const results = await Promise.allSettled(promises);
    const settled = results.map(r => r.status === 'fulfilled' ? r.value : { id: '', status: 'error' as const });
    const successCount = settled.filter(r => r.status === 'success').length;
    const totalCount = tasks.length;

    // Refresh task list
    onLaunchComplete();

    const successIds = new Set(settled.filter(r => r.status === 'success').map(r => r.id));

    if (successCount === totalCount) {
      setSuccessMessage(`${successCount}/${totalCount} tasks launched`);
      // Auto-exit batch mode after a brief delay
      setTimeout(() => {
        onExitBatch();
      }, 1500);
    } else {
      setSuccessMessage(`${successCount}/${totalCount} tasks launched`);
      // Keep batch mode open so user can retry failed ones
      // Remove successful tasks, keep failed ones
      setTasks(prev => prev.filter(t => !successIds.has(t.id)));
    }

    setIsLaunching(false);
  };

  const getModelIcon = (model: string) => {
    switch (model) {
      case 'sonnet': return <Zap size={14} />;
      case 'opus': return <Drone size={14} />;
      default: return <Bot size={14} />;
    }
  };

  const getPermissionModeLabel = (mode: string): string => {
    switch (mode) {
      case 'default': return 'Ask';
      case 'acceptEdits': return 'Auto';
      case 'bypassPermissions': return 'Yolo';
      case 'plan': return 'Plan';
      default: return 'Ask';
    }
  };

  const getPermissionModeIcon = (mode: string) => {
    switch (mode) {
      case 'default': return <Code2 size={14} />;
      case 'acceptEdits': return <Gauge size={14} />;
      case 'bypassPermissions': return <XIcon size={14} />;
      case 'plan': return <FileText size={14} />;
      default: return <Code2 size={14} />;
    }
  };

  const modelOptions: DropdownOption<string>[] = [
    { value: 'default', label: 'Default' },
    { value: 'opus', label: 'Opus' },
    { value: 'sonnet', label: 'Sonnet' },
  ];

  const permissionModeOptions: DropdownOption<string>[] = [
    { value: 'default', label: 'Ask', description: 'Ask before making changes' },
    { value: 'acceptEdits', label: 'Auto', description: 'Apply edits automatically' },
    { value: 'bypassPermissions', label: 'Yolo', description: 'No permission prompts' },
    { value: 'plan', label: 'Plan', description: 'Planning mode only' },
  ];

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-3">
      {/* Shared settings bar */}
      <div className="flex items-center gap-2 px-1">
        {/* Model selector */}
        <DropdownSelector
          options={modelOptions}
          value={sharedModel}
          onChange={setSharedModel}
          isOpen={isModelOpen}
          onOpenChange={setIsModelOpen}
          showFilterInput={false}
          renderOption={(option) => (
            <div className="flex items-center gap-2 w-full">
              {getModelIcon(option.value)}
              <span className="text-sm font-medium">{option.label}</span>
            </div>
          )}
          renderTrigger={({ onClick }) => (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:bg-muted/50 rounded-full text-xs"
              onClick={onClick}
              disabled={isLaunching}
            >
              <span className="flex items-center gap-1.5">
                {getModelIcon(sharedModel)}
                <span>{sharedModel === 'default' ? 'Default' : sharedModel.charAt(0).toUpperCase() + sharedModel.slice(1)}</span>
                <ChevronDown size={12} />
              </span>
            </Button>
          )}
        />

        {/* Permission mode selector */}
        <DropdownSelector
          options={permissionModeOptions}
          value={sharedPermissionMode}
          onChange={(v) => setSharedPermissionMode(v as any)}
          isOpen={isModeOpen}
          onOpenChange={setIsModeOpen}
          showFilterInput={false}
          renderOption={(option) => (
            <div className="flex flex-col items-start gap-0.5 w-full">
              <div className="flex items-center gap-2">
                {getPermissionModeIcon(option.value)}
                <span className="text-sm font-medium">{option.label}</span>
              </div>
              {option.description && (
                <span className="text-xs text-muted-foreground/80 ps-[22px]">{option.description}</span>
              )}
            </div>
          )}
          renderTrigger={({ onClick }) => (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:bg-muted/50 rounded-full text-xs"
              onClick={onClick}
              disabled={isLaunching}
            >
              <span className="flex items-center gap-1.5">
                {getPermissionModeIcon(sharedPermissionMode)}
                <span>{getPermissionModeLabel(sharedPermissionMode)}</span>
                <ChevronDown size={12} />
              </span>
            </Button>
          )}
        />
      </div>

      {/* Task rows */}
      <div className="flex flex-col gap-2">
        {tasks.map((task, i) => (
          <BatchTaskRow
            key={task.id}
            task={task}
            index={i}
            recentDirectories={recentDirectories}
            launchStatus={launchResults.get(task.id)}
            onUpdate={handleUpdateTask}
            onRemove={handleRemoveTask}
            disabled={isLaunching}
            canRemove={tasks.length > 1}
            isLastRow={i === tasks.length - 1}
            onAddRow={handleAddTask}
            onFocusNext={handleFocusNext}
          />
        ))}
      </div>

      {/* Bottom bar: Add + Launch */}
      <div className="flex items-center justify-between px-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground hover:text-foreground text-xs gap-1.5"
          onClick={handleAddTask}
          disabled={isLaunching}
        >
          <Plus size={14} />
          Add Task
        </Button>

        <div className="flex items-center gap-2">
          {successMessage && (
            <span className="text-xs text-muted-foreground">{successMessage}</span>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className={cn(
                    "h-8 px-4 gap-1.5 rounded-full text-xs font-medium",
                    canLaunch && !isLaunching
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-foreground/10 text-foreground/50 cursor-not-allowed"
                  )}
                  disabled={!canLaunch || isLaunching}
                  onClick={handleLaunchAll}
                >
                  <Rocket size={14} />
                  Launch All ({tasks.length})
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{!canLaunch ? 'Fill in all task prompts and directories' : `Launch ${tasks.length} task${tasks.length > 1 ? 's' : ''}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
