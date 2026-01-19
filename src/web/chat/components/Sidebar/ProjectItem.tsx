import React from 'react';
import { Folder, Star, Globe, Code, Settings } from 'lucide-react';
import type { ProjectInfo } from '../../types';
import { cn } from '@/web/chat/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/web/chat/components/ui/tooltip';

interface ProjectItemProps {
  project: ProjectInfo;
  isSelected: boolean;
  onClick: () => void;
  onTogglePin: () => void;
  onOpenReview?: () => void;
  onOpenVSCode?: () => void;
  onConfigureProject?: () => void;
  vscodeWebUrl?: string;
  collapsed?: boolean;
}

export function ProjectItem({
  project,
  isSelected,
  onClick,
  onTogglePin,
  onOpenReview,
  onOpenVSCode,
  onConfigureProject,
  vscodeWebUrl,
  collapsed = false,
}: ProjectItemProps) {
  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin();
  };

  const handleReviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenReview?.();
  };

  const handleVSCodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenVSCode?.();
  };

  const handleConfigureClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConfigureProject?.();
  };

  // Check if VS Code button should be shown (needs vscodeWebUrl preference)
  const canOpenVSCode = !!vscodeWebUrl;
  // Check if Review button should be shown (needs devServerUrl configured)
  const canOpenReview = !!project.devServerUrl;

  if (collapsed) {
    return (
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center justify-center p-2 rounded-md transition-colors',
          isSelected
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
        )}
        title={project.path}
      >
        <Folder size={18} />
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors group cursor-pointer',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
      )}
    >
      <Folder size={16} className="flex-shrink-0" />
      <span className="flex-1 text-left text-sm truncate">{project.shortname}</span>

      {/* Hover action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipProvider delayDuration={300}>
          {/* Review button - only show if devServerUrl is configured */}
          {canOpenReview && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleReviewClick}
                  className="p-1 rounded hover:bg-background/50 transition-colors"
                >
                  <Globe size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Open Review</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* VS Code button - only show if vscodeWebUrl preference is set */}
          {canOpenVSCode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleVSCodeClick}
                  className="p-1 rounded hover:bg-background/50 transition-colors"
                >
                  <Code size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Open VS Code</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Settings button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleConfigureClick}
                className="p-1 rounded hover:bg-background/50 transition-colors"
              >
                <Settings size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Project settings</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Conversation count (show when not hovering) */}
      <span className="text-xs opacity-60 flex-shrink-0 group-hover:hidden">{project.conversationCount}</span>

      {/* Pin button */}
      <button
        onClick={handlePinClick}
        className={cn(
          'p-1 rounded transition-opacity',
          project.isPinned
            ? 'opacity-100 text-yellow-500'
            : 'opacity-0 group-hover:opacity-60 hover:opacity-100'
        )}
        title={project.isPinned ? 'Unpin project' : 'Pin project'}
      >
        <Star size={14} fill={project.isPinned ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
