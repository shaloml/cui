import React from 'react';
import { ProjectItem } from './ProjectItem';
import type { ProjectInfo } from '../../types';

interface ProjectListProps {
  projects: ProjectInfo[];
  selectedProject: string | null;
  onSelectProject: (path: string | null) => void;
  onTogglePin: (path: string) => void;
  onOpenReview?: (project: ProjectInfo) => void;
  onOpenVSCode?: (project: ProjectInfo) => void;
  onConfigureProject?: (project: ProjectInfo) => void;
  vscodeWebUrl?: string;
  searchFilter: string;
  collapsed?: boolean;
}

export function ProjectList({
  projects,
  selectedProject,
  onSelectProject,
  onTogglePin,
  onOpenReview,
  onOpenVSCode,
  onConfigureProject,
  vscodeWebUrl,
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
        {/* Project items */}
        {filteredProjects.map(project => (
          <ProjectItem
            key={project.path}
            project={project}
            isSelected={selectedProject === project.path}
            onClick={() => onSelectProject(project.path)}
            onTogglePin={() => onTogglePin(project.path)}
            onOpenReview={() => onOpenReview?.(project)}
            onOpenVSCode={() => onOpenVSCode?.(project)}
            onConfigureProject={() => onConfigureProject?.(project)}
            vscodeWebUrl={vscodeWebUrl}
            collapsed
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
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
              onOpenReview={() => onOpenReview?.(project)}
              onOpenVSCode={() => onOpenVSCode?.(project)}
              onConfigureProject={() => onConfigureProject?.(project)}
              vscodeWebUrl={vscodeWebUrl}
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
              onOpenReview={() => onOpenReview?.(project)}
              onOpenVSCode={() => onOpenVSCode?.(project)}
              onConfigureProject={() => onConfigureProject?.(project)}
              vscodeWebUrl={vscodeWebUrl}
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
