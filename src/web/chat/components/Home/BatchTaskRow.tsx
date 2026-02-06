import React, { useRef, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, ChevronDown, Laptop } from 'lucide-react';
import { DropdownSelector, DropdownOption } from '../DropdownSelector';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';

export interface BatchTask {
  id: string;
  prompt: string;
  directory: string;
}

interface BatchTaskRowProps {
  task: BatchTask;
  index: number;
  recentDirectories: Record<string, { lastDate: string; shortname: string }>;
  launchStatus?: 'launching' | 'success' | 'error';
  onUpdate: (id: string, updates: Partial<BatchTask>) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
  canRemove: boolean;
  isLastRow: boolean;
  onAddRow: () => void;
  onFocusNext: (currentIndex: number) => void;
}

export function BatchTaskRow({
  task,
  index,
  recentDirectories,
  launchStatus,
  onUpdate,
  onRemove,
  disabled = false,
  canRemove,
  isLastRow,
  onAddRow,
  onFocusNext,
}: BatchTaskRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDirOpen, setIsDirOpen] = React.useState(false);

  // Convert recentDirectories to sorted options
  const directoryOptions: DropdownOption<string>[] = Object.entries(recentDirectories)
    .map(([path, data]) => ({
      value: path,
      label: data.shortname,
    }))
    .sort((a, b) => {
      const dateA = recentDirectories[a.value].lastDate;
      const dateB = recentDirectories[b.value].lastDate;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  const displayDir = task.directory
    ? recentDirectories[task.directory]?.shortname || task.directory.split('/').pop() || task.directory
    : 'Select directory';

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [task.prompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isLastRow) {
        onAddRow();
      } else {
        onFocusNext(index);
      }
    }
  };

  // Expose focus method via ref attribute on the row
  const focusTextarea = () => {
    textareaRef.current?.focus();
  };

  // Attach focus method to the textarea ref for parent access
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      (el as any).__batchRowFocus = focusTextarea;
    }
  });

  return (
    <div className={cn(
      "flex items-start gap-2 p-3 rounded-xl border transition-colors",
      launchStatus === 'error' && "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20",
      launchStatus === 'success' && "border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20",
      launchStatus === 'launching' && "border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20",
      !launchStatus && "border-border",
    )}>
      {/* Task number */}
      <div className="flex items-center justify-center w-6 h-8 text-xs text-muted-foreground font-medium shrink-0">
        {index + 1}
      </div>

      {/* Directory selector + prompt */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Directory dropdown */}
        <DropdownSelector
          options={directoryOptions}
          value={task.directory || undefined}
          onChange={(value) => onUpdate(task.id, { directory: value })}
          isOpen={isDirOpen}
          onOpenChange={setIsDirOpen}
          placeholder="Filter directories..."
          showFilterInput={true}
          filterPredicate={(option, searchText) => {
            return option.value.toLowerCase().includes(searchText.toLowerCase()) ||
              option.label.toLowerCase().includes(searchText.toLowerCase());
          }}
          renderTrigger={({ onClick }) => (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:bg-muted/50 rounded-lg text-xs w-fit"
              onClick={onClick}
              disabled={disabled}
            >
              <span className="flex items-center gap-1.5">
                <Laptop size={12} />
                <span className="block max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {displayDir}
                </span>
                <ChevronDown size={12} />
              </span>
            </Button>
          )}
        />

        {/* Prompt textarea */}
        <Textarea
          ref={textareaRef}
          className="min-h-[44px] py-2 px-3 border-none bg-muted/30 text-foreground text-sm leading-relaxed resize-none outline-none rounded-lg ring-0 focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Describe the task..."
          value={task.prompt}
          onChange={(e) => {
            onUpdate(task.id, { prompt: e.target.value });
            adjustTextareaHeight();
          }}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={disabled}
          data-batch-row-index={index}
        />
      </div>

      {/* Status / delete button */}
      <div className="flex items-center h-8 shrink-0 mt-0.5">
        {launchStatus === 'launching' && (
          <Loader2 size={16} className="animate-spin text-blue-500" />
        )}
        {launchStatus === 'success' && (
          <Check size={16} className="text-green-500" />
        )}
        {launchStatus === 'error' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle size={16} className="text-red-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Failed to launch</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {!launchStatus && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(task.id)}
            disabled={!canRemove || disabled}
          >
            <X size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
