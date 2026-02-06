import React, { useState } from 'react';
import { Plus, Trash2, GitBranch, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/web/chat/components/ui/dialog';
import { Button } from '@/web/chat/components/ui/button';
import { Input } from '@/web/chat/components/ui/input';
import { Checkbox } from '@/web/chat/components/ui/checkbox';
import { api } from '../../services/api';

let idCounter = 0;
function generateId(): string {
  return `subtask-${Date.now()}-${++idCounter}`;
}

interface SubtaskRow {
  id: string;
  description: string;
  useSeparateBranch: boolean;
}

interface SubtaskDialogProps {
  open: boolean;
  onClose: () => void;
  parentSessionId: string;
  workingDirectory: string;
  model?: string;
  permissionMode?: string;
  onSubtasksLaunched: () => void;
}

export function SubtaskDialog({
  open,
  onClose,
  parentSessionId,
  workingDirectory,
  model,
  permissionMode,
  onSubtasksLaunched
}: SubtaskDialogProps) {
  const [subtasks, setSubtasks] = useState<SubtaskRow[]>([
    { id: generateId(), description: '', useSeparateBranch: false }
  ]);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchProgress, setLaunchProgress] = useState({ current: 0, total: 0 });

  const addRow = () => {
    setSubtasks(prev => [
      ...prev,
      { id: generateId(), description: '', useSeparateBranch: false }
    ]);
  };

  const removeRow = (id: string) => {
    if (subtasks.length <= 1) return;
    setSubtasks(prev => prev.filter(s => s.id !== id));
  };

  const updateRow = (id: string, updates: Partial<SubtaskRow>) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleLaunchAll = async () => {
    const validSubtasks = subtasks.filter(s => s.description.trim());
    if (validSubtasks.length === 0) return;

    setIsLaunching(true);
    setLaunchProgress({ current: 0, total: validSubtasks.length });

    const results = await Promise.allSettled(
      validSubtasks.map(async (subtask, index) => {
        const result = await api.startConversation({
          workingDirectory,
          initialPrompt: subtask.description,
          model,
          permissionMode,
          parentSessionId,
          useSeparateBranch: subtask.useSeparateBranch
        });
        setLaunchProgress(prev => ({ ...prev, current: index + 1 }));
        return result;
      })
    );

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      console.error(`${failures.length} subtask(s) failed to launch`);
    }

    setIsLaunching(false);
    onSubtasksLaunched();
    onClose();

    // Reset form
    setSubtasks([{ id: generateId(), description: '', useSeparateBranch: false }]);
  };

  const validCount = subtasks.filter(s => s.description.trim()).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Subtasks</DialogTitle>
          <DialogDescription>
            Define parallel subtasks to run concurrently. Each gets its own conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto py-2">
          {subtasks.map((subtask, index) => (
            <div key={subtask.id} className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground mt-2.5 w-5 text-right shrink-0">
                {index + 1}.
              </span>
              <div className="flex-1 flex flex-col gap-1.5">
                <Input
                  placeholder="Describe the subtask..."
                  value={subtask.description}
                  onChange={(e) => updateRow(subtask.id, { description: e.target.value })}
                  disabled={isLaunching}
                  autoFocus={index === 0}
                />
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={subtask.useSeparateBranch}
                    onCheckedChange={(checked) => updateRow(subtask.id, { useSeparateBranch: !!checked })}
                    disabled={isLaunching}
                    className="h-3.5 w-3.5"
                  />
                  <GitBranch size={12} />
                  Separate branch
                </label>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 mt-0.5"
                onClick={() => removeRow(subtask.id)}
                disabled={subtasks.length <= 1 || isLaunching}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={isLaunching}
          className="w-fit"
        >
          <Plus size={14} className="mr-1" />
          Add subtask
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLaunching}>
            Cancel
          </Button>
          <Button onClick={handleLaunchAll} disabled={validCount === 0 || isLaunching}>
            {isLaunching ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" />
                Launching {launchProgress.current}/{launchProgress.total}...
              </>
            ) : (
              `Launch ${validCount > 0 ? validCount : ''} Subtask${validCount !== 1 ? 's' : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
