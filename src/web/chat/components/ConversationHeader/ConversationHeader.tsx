import React, { useState, useEffect } from 'react';
import { ArrowLeft, Archive, Check, X, Code2, Gauge, Rocket, FileText, ChevronDown, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Button } from '@/web/chat/components/ui/button';
import { Input } from '@/web/chat/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/web/chat/components/ui/tooltip';
import { MoreOptionsMenu } from '../MoreOptionsMenu';
import { DropdownSelector, DropdownOption } from '../DropdownSelector';
import { Dialog } from '../Dialog';
import type { PermissionMode } from '../../types';

interface ConversationHeaderProps {
  title: string;
  sessionId?: string;
  isArchived?: boolean;
  isPinned?: boolean;
  subtitle?: {
    date?: string;
    repo?: string;
    commitSHA?: string;
    changes?: {
      additions: number;
      deletions: number;
    };
  };
  onTitleUpdate?: (newTitle: string) => void;
  onPinToggle?: (isPinned: boolean) => void;
  // Permission mode props
  permissionMode?: PermissionMode;
  isStreaming?: boolean;
  onPermissionModeChange?: (mode: PermissionMode) => Promise<void>;
}

// Helper functions for permission mode display
const getPermissionModeLabel = (mode: PermissionMode): string => {
  switch (mode) {
    case 'default': return 'Ask';
    case 'acceptEdits': return 'Auto';
    case 'bypassPermissions': return 'Yolo';
    case 'plan': return 'Plan';
    default: return 'Ask';
  }
};

const getPermissionModeDescription = (mode: PermissionMode): string => {
  switch (mode) {
    case 'default': return 'Ask for permissions as needed';
    case 'acceptEdits': return 'Allow Claude to make changes directly';
    case 'bypassPermissions': return 'Skip all permission prompts';
    case 'plan': return 'Create a plan without executing';
    default: return 'Ask for permissions as needed';
  }
};

const getPermissionModeIcon = (mode: PermissionMode) => {
  switch (mode) {
    case 'default':
      return <Code2 size={14} />;
    case 'acceptEdits':
      return <Gauge size={14} />;
    case 'bypassPermissions':
      return <Rocket size={14} />;
    case 'plan':
      return <FileText size={14} />;
    default:
      return <Code2 size={14} />;
  }
};

export function ConversationHeader({
  title,
  sessionId,
  isArchived = false,
  isPinned = false,
  subtitle,
  onTitleUpdate,
  onPinToggle,
  permissionMode = 'default',
  isStreaming = false,
  onPermissionModeChange
}: ConversationHeaderProps) {
  const navigate = useNavigate();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [localTitle, setLocalTitle] = useState(title);
  const [isPermissionDropdownOpen, setIsPermissionDropdownOpen] = useState(false);
  const [showRestartConfirmation, setShowRestartConfirmation] = useState(false);
  const [pendingPermissionMode, setPendingPermissionMode] = useState<PermissionMode | null>(null);
  const [isChangingMode, setIsChangingMode] = useState(false);

  // Update localTitle when title prop changes
  useEffect(() => {
    setLocalTitle(title);
    if (!isRenaming) {
      setNewTitle(title);
    }
  }, [title, isRenaming]);

  const handleBack = () => {
    navigate('/');
  };

  const handleArchive = async () => {
    if (!sessionId) return;
    
    try {
      await api.updateSession(sessionId, { archived: !isArchived });
      navigate('/');
    } catch (err) {
      console.error(`Failed to ${isArchived ? 'unarchive' : 'archive'} session:`, err);
    }
  };

  const handleRenameSubmit = async () => {
    if (newTitle.trim() && newTitle !== localTitle && sessionId) {
      try {
        await api.updateSession(sessionId, { customName: newTitle.trim() });
        setLocalTitle(newTitle.trim());
        onTitleUpdate?.(newTitle.trim());
      } catch (error) {
        console.error('Failed to rename session:', error);
      }
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setNewTitle(localTitle);
  };

  const handlePinToggle = async (pinned: boolean) => {
    if (!sessionId) return;
    onPinToggle?.(pinned);
  };

  const handlePermissionModeSelect = (mode: PermissionMode) => {
    if (mode === permissionMode) {
      setIsPermissionDropdownOpen(false);
      return;
    }
    setPendingPermissionMode(mode);
    setShowRestartConfirmation(true);
    setIsPermissionDropdownOpen(false);
  };

  const handleConfirmModeChange = async () => {
    if (!pendingPermissionMode || !onPermissionModeChange) {
      setShowRestartConfirmation(false);
      setPendingPermissionMode(null);
      return;
    }

    setIsChangingMode(true);
    try {
      await onPermissionModeChange(pendingPermissionMode);
    } finally {
      setIsChangingMode(false);
      setShowRestartConfirmation(false);
      setPendingPermissionMode(null);
    }
  };

  const handleCancelModeChange = () => {
    setShowRestartConfirmation(false);
    setPendingPermissionMode(null);
  };

  const permissionModeOptions: DropdownOption<PermissionMode>[] = [
    { value: 'default', label: 'Ask', description: 'Ask for permissions as needed' },
    { value: 'acceptEdits', label: 'Auto', description: 'Apply edits automatically' },
    { value: 'bypassPermissions', label: 'Yolo', description: 'No permission prompts' },
    { value: 'plan', label: 'Plan', description: 'Planning mode only' },
  ];

  return (
    <TooltipProvider>
      <div className="flex justify-between items-center gap-3 p-3 border-b border-border/50 bg-background transition-colors">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                aria-label="Go back to tasks"
                className="flex items-center justify-center px-3 py-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ArrowLeft size={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Go back to tasks</p>
            </TooltipContent>
          </Tooltip>
          
          <div className="w-px h-4 bg-border mx-1" />
          
          <div className="flex flex-col min-w-0 gap-0.5">
            <div className="flex items-center gap-3">
              {isRenaming ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameSubmit();
                      } else if (e.key === 'Escape') {
                        handleRenameCancel();
                      }
                    }}
                    className="h-8 px-3 text-sm flex-1 font-medium max-w-md focus:outline-none focus:ring-0 focus:border-border"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleRenameSubmit}
                    className="h-7 w-7 rounded-full hover:bg-muted/50"
                  >
                    <Check size={16} strokeWidth={2.5} className="text-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleRenameCancel}
                    className="h-7 w-7 rounded-full hover:bg-muted/50"
                  >
                    <X size={16} strokeWidth={2.5} className="text-foreground" />
                  </Button>
                </div>
              ) : (
                <span className="font-medium text-sm text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                  {localTitle}
                </span>
              )}
            </div>
            {subtitle && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {subtitle.date && (
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{subtitle.date}</span>
                )}
                {subtitle.repo && (
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{subtitle.repo}</span>
                )}
                {subtitle.commitSHA && (
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">{subtitle.commitSHA.slice(0, 7)}</span>
                )}
                {subtitle.changes && (
                  <span className="flex gap-2 font-medium">
                    <span className="text-green-600">+{subtitle.changes.additions}</span>
                    <span className="text-red-600">-{subtitle.changes.deletions}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Permission Mode Toggle */}
          {onPermissionModeChange && (
            <DropdownSelector
              options={permissionModeOptions}
              value={permissionMode}
              onChange={(value) => handlePermissionModeSelect(value as PermissionMode)}
              isOpen={isPermissionDropdownOpen}
              onOpenChange={setIsPermissionDropdownOpen}
              showFilterInput={false}
              renderOption={(option) => (
                <div className="flex flex-col items-start gap-0.5 w-full">
                  <div className="flex items-center gap-2">
                    {getPermissionModeIcon(option.value as PermissionMode)}
                    <span className="text-sm font-medium">{option.label}</span>
                  </div>
                  {option.description && (
                    <span className="text-xs text-muted-foreground/80 ps-[22px]">{option.description}</span>
                  )}
                </div>
              )}
              renderTrigger={({ onClick }) => (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClick}
                      disabled={isStreaming || isChangingMode}
                      aria-label="Change permission mode"
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-normal text-foreground hover:bg-secondary transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isChangingMode ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        getPermissionModeIcon(permissionMode)
                      )}
                      <span className="hidden sm:inline">{getPermissionModeLabel(permissionMode)}</span>
                      <ChevronDown size={14} className="opacity-50" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isStreaming ? 'Stop conversation to change mode' : getPermissionModeDescription(permissionMode)}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            />
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleArchive}
                disabled={!sessionId}
                aria-label={isArchived ? "Unarchive Task" : "Archive Task"}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-normal text-foreground hover:bg-secondary transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Archive size={20} className="flex-shrink-0" />
                <span className="hidden sm:inline">{isArchived ? 'Unarchive' : 'Archive'}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isArchived ? 'Unarchive Task' : 'Archive Task'}</p>
            </TooltipContent>
          </Tooltip>

          {sessionId && (
            <MoreOptionsMenu
              sessionId={sessionId}
              currentName={localTitle}
              isPinned={isPinned}
              onRename={() => {
                setIsRenaming(true);
                setNewTitle(localTitle);
              }}
              onPinToggle={handlePinToggle}
            />
          )}
        </div>
      </div>

      {/* Restart Confirmation Dialog */}
      {showRestartConfirmation && pendingPermissionMode && (
        <Dialog open={showRestartConfirmation} onClose={handleCancelModeChange} title="Change Permission Mode">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Changing the permission mode will restart the conversation with the new mode. This will resume your conversation with the "{getPermissionModeLabel(pendingPermissionMode)}" mode.
            </p>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {getPermissionModeIcon(permissionMode)}
                <span className="text-sm">{getPermissionModeLabel(permissionMode)}</span>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex items-center gap-2 font-medium">
                {getPermissionModeIcon(pendingPermissionMode)}
                <span className="text-sm">{getPermissionModeLabel(pendingPermissionMode)}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleCancelModeChange}
                disabled={isChangingMode}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmModeChange}
                disabled={isChangingMode}
              >
                {isChangingMode ? (
                  <>
                    <RefreshCw size={14} className="animate-spin mr-2" />
                    Restarting...
                  </>
                ) : (
                  'Restart with new mode'
                )}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </TooltipProvider>
  );
}