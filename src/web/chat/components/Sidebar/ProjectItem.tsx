import React from 'react';
import { Folder, Star } from 'lucide-react';
import type { ProjectInfo } from '../../types';
import { cn } from '@/web/chat/lib/utils';

interface ProjectItemProps {
  project: ProjectInfo;
  isSelected: boolean;
  onClick: () => void;
  onTogglePin: () => void;
  collapsed?: boolean;
}

export function ProjectItem({
  project,
  isSelected,
  onClick,
  onTogglePin,
  collapsed = false,
}: ProjectItemProps) {
  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin();
  };

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
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors group',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
      )}
    >
      <Folder size={16} className="flex-shrink-0" />
      <span className="flex-1 text-left text-sm truncate">{project.shortname}</span>
      <span className="text-xs opacity-60 flex-shrink-0">{project.conversationCount}</span>
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
    </button>
  );
}
