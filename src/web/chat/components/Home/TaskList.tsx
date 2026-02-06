import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskItem } from './TaskItem';
import { SubtaskDialog } from './SubtaskDialog';
import type { ConversationSummary } from '../../types';
import { useConversations } from '../../contexts/ConversationsContext';
import { usePreferencesContext } from '../../contexts/PreferencesContext';
import { api } from '../../services/api';

interface TaskListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  activeTab: 'tasks' | 'history' | 'archive';
  onLoadMore: (filters?: {
    hasContinuation?: boolean;
    archived?: boolean;
    pinned?: boolean;
  }) => void;
}

export function TaskList({
  conversations,
  loading,
  loadingMore,
  hasMore,
  error,
  activeTab,
  onLoadMore
}: TaskListProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const { recentDirectories, loadConversations } = useConversations();
  const { preferences } = usePreferencesContext();
  const [renamingSessionId, setRenamingSessionId] = React.useState<string | null>(null);
  const [subtaskDialogSession, setSubtaskDialogSession] = useState<ConversationSummary | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [subtasksByParent, setSubtasksByParent] = useState<Record<string, ConversationSummary[]>>({});

  // Get filter parameters based on active tab
  const getFiltersForTab = (tab: 'tasks' | 'history' | 'archive') => {
    switch (tab) {
      case 'tasks':
        return { archived: false, hasContinuation: false };
      case 'history':
        return { archived: false, hasContinuation: true };
      case 'archive':
        return { archived: true };
      default:
        return {};
    }
  };

  const handleTaskClick = (sessionId: string) => {
    // Don't navigate if this session is being renamed
    if (renamingSessionId === sessionId) {
      return;
    }
    navigate(`/c/${sessionId}`);
  };

  const handleCancelTask = (sessionId: string) => {
    console.log('Cancel task:', sessionId);
  };

  const handleArchiveTask = async (sessionId: string) => {
    const element = document.querySelector(`[data-session-id="${sessionId}"]`) as HTMLElement;
    if (element) {
      element.style.display = 'none';
    }

    try {
      await api.updateSession(sessionId, { archived: true });
      loadConversations(undefined, getFiltersForTab(activeTab));
    } catch (error) {
      console.error('Failed to archive task:', error);
      if (element) {
        (element as HTMLElement).style.display = '';
      }
    }
  };

  const handleUnarchiveTask = async (sessionId: string) => {
    const element = document.querySelector(`[data-session-id="${sessionId}"]`) as HTMLElement;
    if (element) {
      element.style.display = 'none';
    }

    try {
      await api.updateSession(sessionId, { archived: false });
      loadConversations(undefined, getFiltersForTab(activeTab));
    } catch (error) {
      console.error('Failed to unarchive task:', error);
      if (element) {
        (element as HTMLElement).style.display = '';
      }
    }
  };

  const handleNameUpdate = async () => {
    setRenamingSessionId(null);
    await loadConversations(undefined, getFiltersForTab(activeTab));
  };

  const handleStartRename = (sessionId: string) => {
    setRenamingSessionId(sessionId);
  };

  const handleCancelRename = () => {
    setRenamingSessionId(null);
  };

  const handlePinToggle = async () => {
    loadConversations(undefined, getFiltersForTab(activeTab));
  };

  const handleCreateSubtasks = (conversation: ConversationSummary) => {
    setSubtaskDialogSession(conversation);
  };

  const handleCreatePR = async (conversation: ConversationSummary) => {
    const commitHead = conversation.sessionInfo.initial_commit_head;
    if (!commitHead) return;

    try {
      const response = await api.startConversation({
        workingDirectory: conversation.projectPath,
        initialPrompt: `Create a pull request for the changes made since commit ${commitHead}. Use gh CLI. Include a descriptive title and summary.`,
        permissionMode: conversation.sessionInfo.permission_mode || undefined,
      });
      navigate(`/c/${response.sessionId}`);
    } catch (err) {
      console.error('Failed to create PR conversation:', err);
    }
  };

  const handleToggleExpand = async (sessionId: string) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        // Limit concurrent expansions to 5
        if (next.size >= 5) return prev;
        next.add(sessionId);
      }
      return next;
    });

    // Fetch subtasks if not already loaded
    if (!subtasksByParent[sessionId]) {
      try {
        const { subtasks } = await api.getSubtasks(sessionId);
        setSubtasksByParent(prev => ({ ...prev, [sessionId]: subtasks }));
      } catch (err) {
        console.error('Failed to fetch subtasks:', err);
      }
    }
  };

  const handleSubtasksLaunched = () => {
    setSubtaskDialogSession(null);
    loadConversations(undefined, getFiltersForTab(activeTab));
  };

  // Filter out subtask conversations from main list (they show nested under parent)
  const topLevelConversations = conversations.filter(c => !c.parentSessionId);

  // Sort conversations: pinned items first, then by updatedAt
  const sortedConversations = [...topLevelConversations].sort((a, b) => {
    if (a.sessionInfo.pinned && !b.sessionInfo.pinned) return -1;
    if (!a.sessionInfo.pinned && b.sessionInfo.pinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Intersection Observer for infinite scrolling
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
        onLoadMore(getFiltersForTab(activeTab));
      }
    },
    [hasMore, loadingMore, loading, onLoadMore, activeTab]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      root: scrollRef.current,
      rootMargin: '100px',
      threshold: 0.1,
    });

    const currentLoadingRef = loadingRef.current;
    if (currentLoadingRef) {
      observer.observe(currentLoadingRef);
    }

    return () => {
      if (currentLoadingRef) {
        observer.unobserve(currentLoadingRef);
      }
    };
  }, [handleIntersection]);

  if (loading && conversations.length === 0) {
    return (
      <div className="flex flex-col w-full flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-border scrollbar-track-transparent">
        <div className="flex items-center justify-center w-full py-12 px-4 text-muted-foreground text-sm text-center bg-background">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col w-full flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-border scrollbar-track-transparent">
        <div className="flex items-center justify-center w-full py-12 px-4 text-destructive text-sm text-center bg-background">{error}</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col w-full flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-border scrollbar-track-transparent">
        <div className="flex items-center justify-center w-full py-12 px-4 text-muted-foreground text-sm text-center bg-background">
          {activeTab === 'tasks' ? 'No active tasks.' : activeTab === 'history' ? 'No history tasks.' : 'No archived tasks.'}
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={scrollRef} className="flex flex-col w-full flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-transparent hover:scrollbar-thumb-border scrollbar-track-transparent">
        {sortedConversations.map((conversation) => {
          const isExpanded = expandedTaskIds.has(conversation.sessionId);
          const subtasks = subtasksByParent[conversation.sessionId];

          return (
            <div key={conversation.sessionId} data-session-id={conversation.sessionId}>
              <TaskItem
                id={conversation.sessionId}
                title={conversation.sessionInfo.custom_name || conversation.summary}
                timestamp={conversation.updatedAt}
                projectPath={conversation.projectPath}
                recentDirectories={recentDirectories}
                status={conversation.status}
                messageCount={conversation.messageCount}
                toolMetrics={conversation.toolMetrics}
                liveStatus={conversation.liveStatus}
                isArchived={activeTab === 'archive'}
                isPinned={conversation.sessionInfo.pinned}
                vscodeWebUrl={preferences?.vscodeWebUrl}
                subtaskInfo={conversation.subtaskInfo}
                initialCommitHead={conversation.sessionInfo.initial_commit_head}
                isExpanded={isExpanded}
                onClick={() => handleTaskClick(conversation.sessionId)}
                onCancel={
                  conversation.status === 'ongoing'
                    ? () => handleCancelTask(conversation.sessionId)
                    : undefined
                }
                onArchive={
                  conversation.status === 'completed' && activeTab !== 'archive'
                    ? () => handleArchiveTask(conversation.sessionId)
                    : undefined
                }
                onUnarchive={
                  conversation.status === 'completed' && activeTab === 'archive'
                    ? () => handleUnarchiveTask(conversation.sessionId)
                    : undefined
                }
                isRenaming={renamingSessionId === conversation.sessionId}
                onStartRename={() => handleStartRename(conversation.sessionId)}
                onCancelRename={handleCancelRename}
                onNameUpdate={handleNameUpdate}
                onPinToggle={handlePinToggle}
                onCreateSubtasks={() => handleCreateSubtasks(conversation)}
                onCreatePR={() => handleCreatePR(conversation)}
                onToggleExpand={
                  conversation.subtaskInfo && conversation.subtaskInfo.count > 0
                    ? () => handleToggleExpand(conversation.sessionId)
                    : undefined
                }
              >
                {/* Subtask tree when expanded */}
                {isExpanded && subtasks && (
                  <div className="pl-8 border-l-2 border-border/30 ml-4 bg-muted/10">
                    {subtasks.map((subtask) => (
                      <div
                        key={subtask.sessionId}
                        className="flex items-center gap-2 px-3 py-2 text-sm border-b border-border/20 hover:bg-muted/30 cursor-pointer"
                        onClick={() => navigate(`/c/${subtask.sessionId}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {subtask.sessionInfo.custom_name || subtask.summary || 'Subtask'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {subtask.status === 'ongoing' ? (
                              <span className="text-amber-500 animate-pulse">Running</span>
                            ) : (
                              <span>{subtask.status}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* View All in split view */}
                    {subtasks.length > 1 && (
                      <div
                        className="px-3 py-2 text-xs text-accent cursor-pointer hover:bg-muted/30 text-center"
                        onClick={() => {
                          const ids = subtasks.map(s => s.sessionId).join(',');
                          navigate(`/split?sessions=${ids}`);
                        }}
                      >
                        View all in split view
                      </div>
                    )}
                  </div>
                )}
                {isExpanded && !subtasks && (
                  <div className="pl-8 ml-4 py-3 text-xs text-muted-foreground animate-pulse">
                    Loading subtasks...
                  </div>
                )}
              </TaskItem>
            </div>
          );
        })}

        {/* Loading indicator for infinite scroll */}
        {hasMore && (
          <div ref={loadingRef} className="flex items-center justify-center w-full p-4 min-h-[60px]">
            {loadingMore && (
              <div className="flex items-center justify-center text-muted-foreground text-sm animate-pulse">
                Loading more tasks...
              </div>
            )}
          </div>
        )}

        {/* End of list message */}
        {!hasMore && conversations.length > 0 && (
          <div className="flex items-center justify-center w-full p-4 text-muted-foreground/70 text-xs text-center">
            No more tasks to load
          </div>
        )}
      </div>

      {/* Subtask Dialog */}
      {subtaskDialogSession && (
        <SubtaskDialog
          open={!!subtaskDialogSession}
          onClose={() => setSubtaskDialogSession(null)}
          parentSessionId={subtaskDialogSession.sessionId}
          workingDirectory={subtaskDialogSession.projectPath}
          model={subtaskDialogSession.model}
          permissionMode={subtaskDialogSession.sessionInfo.permission_mode}
          onSubtasksLaunched={handleSubtasksLaunched}
        />
      )}
    </>
  );
}
