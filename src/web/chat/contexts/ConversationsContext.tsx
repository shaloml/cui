import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '../services/api';
import { useStreamStatus } from './StreamStatusContext';
import type { ConversationSummary, WorkingDirectory, ConversationSummaryWithLiveStatus, ProjectInfo, ProjectSettings } from '../types';

interface RecentDirectory {
  lastDate: string;
  shortname: string;
}

interface ConversationsContextType {
  conversations: ConversationSummaryWithLiveStatus[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  recentDirectories: Record<string, RecentDirectory>;
  loadConversations: (limit?: number, filters?: {
    hasContinuation?: boolean;
    archived?: boolean;
    pinned?: boolean;
  }) => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  getMostRecentWorkingDirectory: () => string | null;
  // Project selection state
  projects: ProjectInfo[];
  selectedProject: string | null; // null means "All Projects"
  setSelectedProject: (path: string | null) => void;
  pinnedProjects: string[];
  toggleProjectPin: (path: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  projectSearch: string;
  setProjectSearch: (search: string) => void;
  // Project settings (dev server URLs, etc.)
  projectSettings: ProjectSettings;
  updateProjectSettings: (path: string, settings: Partial<ProjectSettings[string]>) => void;
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

const INITIAL_LIMIT = 20;
const LOAD_MORE_LIMIT = 40;

// LocalStorage keys for persistence
const PINNED_PROJECTS_KEY = 'cui-pinned-projects';
const SIDEBAR_COLLAPSED_KEY = 'cui-sidebar-collapsed';
const SELECTED_PROJECT_KEY = 'cui-selected-project';
const PROJECT_SETTINGS_KEY = 'cui-project-settings';

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ConversationSummaryWithLiveStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentDirectories, setRecentDirectories] = useState<Record<string, RecentDirectory>>({});
  const { subscribeToStreams, getStreamStatus, streamStatuses, registerStreamProject } = useStreamStatus();

  // Project selection state
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProject, setSelectedProjectState] = useState<string | null>(() => {
    const saved = localStorage.getItem(SELECTED_PROJECT_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [pinnedProjects, setPinnedProjects] = useState<string[]>(() => {
    const saved = localStorage.getItem(PINNED_PROJECTS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved ? JSON.parse(saved) : false;
  });
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(() => {
    const saved = localStorage.getItem(PROJECT_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : {};
  });

  const loadWorkingDirectories = async (): Promise<Record<string, RecentDirectory> | null> => {
    try {
      const response = await api.getWorkingDirectories();
      const directories: Record<string, RecentDirectory> = {};
      
      response.directories.forEach(dir => {
        directories[dir.path] = {
          lastDate: dir.lastDate,
          shortname: dir.shortname
        };
      });
      
      return directories;
    } catch (err) {
      console.error('Failed to load working directories from API:', err);
      return null;
    }
  };

  const updateRecentDirectories = (convs: ConversationSummary[], apiDirectories?: Record<string, RecentDirectory> | null) => {
    const newDirectories: Record<string, RecentDirectory> = {};
    
    // First, add API directories if available
    if (apiDirectories) {
      Object.assign(newDirectories, apiDirectories);
    }
    
    // Then, process conversations and merge with API data
    convs.forEach(conv => {
      if (conv.projectPath) {
        const pathParts = conv.projectPath.split('/');
        const shortname = pathParts[pathParts.length - 1] || conv.projectPath;
        
        // If API didn't provide this directory, or if conversation is more recent
        if (!newDirectories[conv.projectPath] || 
            new Date(conv.updatedAt) > new Date(newDirectories[conv.projectPath].lastDate)) {
          newDirectories[conv.projectPath] = {
            lastDate: conv.updatedAt,
            shortname: apiDirectories?.[conv.projectPath]?.shortname || shortname
          };
        }
      }
    });
    
    setRecentDirectories(newDirectories);
  };

  const loadConversations = async (limit?: number, filters?: {
    hasContinuation?: boolean;
    archived?: boolean;
    pinned?: boolean;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const loadLimit = limit || INITIAL_LIMIT;
      // Load working directories from API in parallel with conversations
      const [data, apiDirectories] = await Promise.all([
        api.getConversations({ 
          limit: loadLimit,
          offset: 0,
          sortBy: 'updated',
          order: 'desc',
          ...filters
        }),
        loadWorkingDirectories()
      ]);
      
      setConversations(data.conversations);
      updateRecentDirectories(data.conversations, apiDirectories);
      setHasMore(data.conversations.length === loadLimit);
      
      // Subscribe to streams for ongoing conversations
      const ongoingConversations = data.conversations
        .filter(conv => conv.status === 'ongoing' && conv.streamingId);

      if (ongoingConversations.length > 0) {
        const ongoingStreamIds = ongoingConversations.map(conv => conv.streamingId as string);
        subscribeToStreams(ongoingStreamIds);

        // Register project paths for file change notifications
        ongoingConversations.forEach(conv => {
          if (conv.streamingId && conv.projectPath) {
            registerStreamProject(conv.streamingId, conv.projectPath);
          }
        });
      }
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreConversations = async (filters?: {
    hasContinuation?: boolean;
    archived?: boolean;
    pinned?: boolean;
  }) => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    setError(null);
    try {
      const data = await api.getConversations({ 
        limit: LOAD_MORE_LIMIT,
        offset: conversations.length,
        sortBy: 'updated',
        order: 'desc',
        ...filters
      });
      
      if (data.conversations.length === 0) {
        setHasMore(false);
      } else {
        setConversations(prev => {
          // Create a set of existing session IDs to avoid duplicates
          const existingIds = new Set(prev.map(conv => conv.sessionId));
          const newConversations = data.conversations.filter(conv => !existingIds.has(conv.sessionId));
          return [...prev, ...newConversations];
        });
        // When loading more, we don't need to fetch API directories again
        updateRecentDirectories([...conversations, ...data.conversations]);
        setHasMore(data.conversations.length === LOAD_MORE_LIMIT);
        
        // Subscribe to streams for any new ongoing conversations
        const newOngoingConversations = data.conversations
          .filter(conv => conv.status === 'ongoing' && conv.streamingId);

        if (newOngoingConversations.length > 0) {
          const newOngoingStreamIds = newOngoingConversations.map(conv => conv.streamingId as string);
          subscribeToStreams(newOngoingStreamIds);

          // Register project paths for file change notifications
          newOngoingConversations.forEach(conv => {
            if (conv.streamingId && conv.projectPath) {
              registerStreamProject(conv.streamingId, conv.projectPath);
            }
          });
        }
      }
    } catch (err) {
      setError('Failed to load more conversations');
      console.error('Error loading more conversations:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const getMostRecentWorkingDirectory = (): string | null => {
    if (conversations.length === 0) return null;

    // Sort by updatedAt to get the most recently used
    const sorted = [...conversations].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return sorted[0]?.projectPath || null;
  };

  // Project management functions
  const setSelectedProject = useCallback((path: string | null) => {
    setSelectedProjectState(path);
    localStorage.setItem(SELECTED_PROJECT_KEY, JSON.stringify(path));
  }, []);

  const toggleProjectPin = useCallback((path: string) => {
    setPinnedProjects(prev => {
      const newPinned = prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path];
      localStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify(newPinned));
      return newPinned;
    });
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(collapsed));
  }, []);

  const updateProjectSettings = useCallback((path: string, settings: Partial<ProjectSettings[string]>) => {
    setProjectSettings(prev => {
      const newSettings = {
        ...prev,
        [path]: {
          ...prev[path],
          ...settings,
        },
      };
      localStorage.setItem(PROJECT_SETTINGS_KEY, JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Compute projects from recentDirectories
  useEffect(() => {
    const projectList: ProjectInfo[] = Object.entries(recentDirectories).map(([path, dir]) => ({
      path,
      shortname: dir.shortname,
      conversationCount: conversations.filter(c => c.projectPath === path).length,
      lastActivity: dir.lastDate,
      isPinned: pinnedProjects.includes(path),
      devServerUrl: projectSettings[path]?.devServerUrl,
    }));

    // Sort: pinned first, then by lastActivity
    projectList.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    setProjects(projectList);
  }, [recentDirectories, conversations, pinnedProjects, projectSettings]);

  // Effect to merge live status with conversations
  useEffect(() => {
    setConversations(prevConversations => {
      return prevConversations.map(conv => {
        // If conversation has a streamingId and is ongoing, merge with live status
        if (conv.streamingId && conv.status === 'ongoing') {
          const liveStatus = getStreamStatus(conv.streamingId);
          if (liveStatus) {
            return {
              ...conv,
              liveStatus,
              // Update status to completed if stream indicates completion
              status: liveStatus.connectionState === 'disconnected' && 
                      liveStatus.currentStatus === 'Completed' ? 'completed' : conv.status
            };
          }
        }
        return conv;
      });
    });
  }, [streamStatuses, getStreamStatus]);

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        loading,
        loadingMore,
        hasMore,
        error,
        recentDirectories,
        loadConversations,
        loadMoreConversations,
        getMostRecentWorkingDirectory,
        // Project selection
        projects,
        selectedProject,
        setSelectedProject,
        pinnedProjects,
        toggleProjectPin,
        sidebarCollapsed,
        setSidebarCollapsed,
        projectSearch,
        setProjectSearch,
        // Project settings
        projectSettings,
        updateProjectSettings,
      }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (context === undefined) {
    throw new Error('useConversations must be used within a ConversationsProvider');
  }
  return context;
}