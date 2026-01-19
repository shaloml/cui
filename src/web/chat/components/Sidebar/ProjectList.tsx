import React from 'react';
import { Layers } from 'lucide-react';
import { ProjectItem } from './ProjectItem';
import type { ProjectInfo } from '../../types';
import { cn } from '@/web/chat/lib/utils';

interface ProjectListProps {
  projects: ProjectInfo[];
  selectedProject: string | null;
  onSelectProject: (path: string | null) => void;
  onTogglePin: (path: string) => void;
  searchFilter: string;
  collapsed?: boolean;
}

export function ProjectList({
  projects,
  selectedProject,
  onSelectProject,
  onTogglePin,
  searchFilter,
  collapsed = false,
}: ProjectListProps) {
  // Filter projects based on search
  const filteredProjects = searchFilter
    ? projects.filter(
        p =>
          p.shortname.toLowerCase().includes(searchFilter.toLowerCase()) ||
          p.path.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : projects;

  // Separate pinned and unpinned projects
  const pinnedProjects = filteredProjects.filter(p => p.isPinned);
  const unpinnedProjects = filteredProjects.filter(p => !p.isPinned);

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1 px-1">
        {/* All Projects button */}
        <button
          onClick={() => onSelectProject(null)}
          className={cn(
            'w-full flex items-center justify-center p-2 rounded-md transition-colors',
            selectedProject === null
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
          )}
          title="All Projects"
        >
          <Layers size={18} />
        </button>

        {/* Project items */}
        {filteredProjects.map(project => (
          <ProjectItem
            key={project.path}
            project={project}
            isSelected={selectedProject === project.path}
            onClick={() => onSelectProject(project.path)}
            onTogglePin={() => onTogglePin(project.path)}
            collapsed
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {/* All Projects option */}
      <button
        onClick={() => onSelectProject(null)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors',
          selectedProject === null
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
        )}
      >
        <Layers size={16} className="flex-shrink-0" />
        <span className="flex-1 text-left text-sm">All Projects</span>
        <span className="text-xs opacity-60">{projects.reduce((sum, p) => sum + p.conversationCount, 0)}</span>
      </button>

      {/* Pinned projects section */}
      {pinnedProjects.length > 0 && (
        <>
          <div className="px-3 py-1 mt-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pinned</span>
          </div>
          {pinnedProjects.map(project => (
            <ProjectItem
              key={project.path}
              project={project}
              isSelected={selectedProject === project.path}
              onClick={() => onSelectProject(project.path)}
              onTogglePin={() => onTogglePin(project.path)}
            />
          ))}
        </>
      )}

      {/* All projects section */}
      {unpinnedProjects.length > 0 && (
        <>
          <div className="px-3 py-1 mt-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Projects</span>
          </div>
          {unpinnedProjects.map(project => (
            <ProjectItem
              key={project.path}
              project={project}
              isSelected={selectedProject === project.path}
              onClick={() => onSelectProject(project.path)}
              onTogglePin={() => onTogglePin(project.path)}
            />
          ))}
        </>
      )}

      {/* Empty state */}
      {filteredProjects.length === 0 && (
        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
          {searchFilter ? 'No projects match your search' : 'No projects yet'}
        </div>
      )}
    </div>
  );
}
