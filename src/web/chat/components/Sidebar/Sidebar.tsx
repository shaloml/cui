import React, { useState, useCallback } from 'react';
import { FolderPlus, PanelLeftClose, PanelLeft, Settings, Search, X } from 'lucide-react';
import { ProjectList } from './ProjectList';
import { useConversations } from '../../contexts/ConversationsContext';
import { usePreferencesContext } from '../../contexts/PreferencesContext';
import { PreferencesModal } from '../PreferencesModal/PreferencesModal';
import { WorkspaceBrowserModal } from '../Composer/WorkspaceBrowserModal';
import { ProjectSettingsDialog } from '../ProjectSettingsDialog/ProjectSettingsDialog';
import { Button } from '@/web/chat/components/ui/button';
import { Input } from '@/web/chat/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/web/chat/components/ui/tooltip';
import { cn } from '@/web/chat/lib/utils';
import type { ProjectInfo } from '../../types';

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 52;

interface SidebarProps {
  onNewProject?: (path: string) => void;
}

export function Sidebar({ onNewProject }: SidebarProps) {
  const {
    projects,
    selectedProject,
    setSelectedProject,
    toggleProjectPin,
    sidebarCollapsed,
    setSidebarCollapsed,
    projectSearch,
    setProjectSearch,
    recentDirectories,
    updateProjectSettings,
  } = useConversations();

  const { preferences } = usePreferencesContext();
  const vscodeWebUrl = preferences?.vscodeWebUrl;

  const [showPrefs, setShowPrefs] = useState(false);
  const [showWorkspaceBrowser, setShowWorkspaceBrowser] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ProjectInfo | null>(null);

  // Handler to open Review tab
  const handleOpenReview = useCallback((project: ProjectInfo) => {
    if (!project.devServerUrl) return;
    // Open review page with the dev server URL
    const reviewUrl = `/review?url=${encodeURIComponent(project.devServerUrl)}&project=${encodeURIComponent(project.path)}`;
    window.open(reviewUrl, `review-${project.shortname}`);
  }, []);

  // Handler to open VS Code Web
  const handleOpenVSCode = useCallback((project: ProjectInfo) => {
    if (!vscodeWebUrl) return;
    // Construct VS Code Web URL with project folder
    const vsCodeUrl = `${vscodeWebUrl}/?folder=${encodeURIComponent(project.path)}`;
    window.open(vsCodeUrl, `vscode-${project.shortname}`);
  }, [vscodeWebUrl]);

  // Handler to open project settings dialog
  const handleConfigureProject = useCallback((project: ProjectInfo) => {
    setProjectToEdit(project);
  }, []);

  // Handler to save project settings
  const handleSaveProjectSettings = useCallback((devServerUrl: string) => {
    if (projectToEdit) {
      updateProjectSettings(projectToEdit.path, { devServerUrl: devServerUrl || undefined });
    }
    setProjectToEdit(null);
  }, [projectToEdit, updateProjectSettings]);

  const handleNewProject = () => {
    setShowWorkspaceBrowser(true);
  };

  const handleWorkspaceSelect = (path: string) => {
    setShowWorkspaceBrowser(false);
    setSelectedProject(path);
    onNewProject?.(path);
  };

  const handleToggleCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <>
      <aside
        className={cn(
          'flex flex-col h-full border-r border-border bg-background transition-all duration-200',
          sidebarCollapsed ? 'w-[52px]' : 'w-[240px]'
        )}
        style={{
          width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        }}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center gap-2 p-2 border-b border-border',
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        )}>
          {!sidebarCollapsed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start gap-2"
                    onClick={handleNewProject}
                  >
                    <FolderPlus size={16} />
                    <span>New Project</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select a folder to start a new project</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {sidebarCollapsed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleNewProject}
                  >
                    <FolderPlus size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>New Project</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={handleToggleCollapse}
                >
                  {sidebarCollapsed ? (
                    <PanelLeft size={18} />
                  ) : (
                    <PanelLeftClose size={18} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Search (only when expanded) */}
        {!sidebarCollapsed && (
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                placeholder="Search projects..."
                className="pl-8 pr-8 h-8 text-sm"
              />
              {projectSearch && (
                <button
                  onClick={() => setProjectSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Project list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-border scrollbar-track-transparent p-2">
          <ProjectList
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            onTogglePin={toggleProjectPin}
            onOpenReview={handleOpenReview}
            onOpenVSCode={handleOpenVSCode}
            onConfigureProject={handleConfigureProject}
            vscodeWebUrl={vscodeWebUrl}
            searchFilter={projectSearch}
            collapsed={sidebarCollapsed}
          />
        </div>

        {/* Footer with settings */}
        <div className={cn(
          'border-t border-border p-2',
          sidebarCollapsed ? 'flex justify-center' : ''
        )}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size={sidebarCollapsed ? 'icon' : 'sm'}
                  className={cn(
                    sidebarCollapsed ? 'h-8 w-8' : 'w-full justify-start gap-2'
                  )}
                  onClick={() => setShowPrefs(true)}
                >
                  <Settings size={16} />
                  {!sidebarCollapsed && <span>Settings</span>}
                </Button>
              </TooltipTrigger>
              <TooltipContent side={sidebarCollapsed ? 'right' : 'top'}>
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </aside>

      {/* Modals */}
      {showPrefs && <PreferencesModal onClose={() => setShowPrefs(false)} />}
      {showWorkspaceBrowser && (
        <WorkspaceBrowserModal
          open={showWorkspaceBrowser}
          onClose={() => setShowWorkspaceBrowser(false)}
          onSelect={handleWorkspaceSelect}
          recentDirectories={recentDirectories}
        />
      )}
      {projectToEdit && (
        <ProjectSettingsDialog
          project={projectToEdit}
          onClose={() => setProjectToEdit(null)}
          onSave={handleSaveProjectSettings}
        />
      )}
    </>
  );
}
