import React, { useState, useEffect, useMemo } from 'react';
import { Folder, FolderPlus, ChevronRight, Home, Loader2, Clock, ArrowUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { api } from '../../services/api';
import { cn } from '../../lib/utils';
import type { FileSystemEntry } from '../../types';

export interface WorkspaceBrowserModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
  recentDirectories: Record<string, { lastDate: string; shortname: string }>;
}

export function WorkspaceBrowserModal({
  open,
  onClose,
  onSelect,
  initialPath,
  recentDirectories,
}: WorkspaceBrowserModalProps) {
  // Derive home directory from recent directories or use a fallback
  const homeDir = useMemo(() => {
    // Try to derive home from recent directories
    const paths = Object.keys(recentDirectories);
    if (paths.length > 0) {
      // Look for common home patterns: /home/user, /Users/user, C:\Users\user
      const homePath = paths.find(p =>
        p.match(/^\/home\/[^/]+$/) ||
        p.match(/^\/Users\/[^/]+$/) ||
        p.match(/^[A-Z]:\\Users\\[^\\]+$/i)
      );
      if (homePath) return homePath;

      // Try to extract home from any path
      for (const path of paths) {
        const homeMatch = path.match(/^(\/home\/[^/]+)/);
        if (homeMatch) return homeMatch[1];
        const usersMatch = path.match(/^(\/Users\/[^/]+)/);
        if (usersMatch) return usersMatch[1];
      }

      // Fallback: use the first path's parent or the path itself
      const firstPath = paths[0];
      const segments = firstPath.split('/').filter(Boolean);
      if (segments.length >= 2) {
        return '/' + segments.slice(0, 2).join('/');
      }
    }
    // Default fallback
    return '/';
  }, [recentDirectories]);

  const [currentPath, setCurrentPath] = useState(initialPath || homeDir);
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(true);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Sort recent directories by date
  const sortedRecentDirectories = useMemo(() => {
    return Object.entries(recentDirectories)
      .map(([path, data]) => ({ path, ...data }))
      .sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime())
      .slice(0, 10);
  }, [recentDirectories]);

  // Fetch directory contents
  const fetchDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listDirectory({ path, recursive: false });
      // Filter to only show directories
      const directories = response.entries.filter(entry => entry.type === 'directory');
      setEntries(directories);
      setCurrentPath(response.path);
      setShowRecent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Parse path into segments for breadcrumb
  const pathSegments = useMemo(() => {
    const segments: { name: string; path: string }[] = [];
    let accumulatedPath = '';

    currentPath.split('/').forEach((segment, index) => {
      if (index === 0) {
        // Root
        accumulatedPath = '/';
        segments.push({ name: '/', path: '/' });
      } else if (segment) {
        accumulatedPath = `${accumulatedPath}${accumulatedPath === '/' ? '' : '/'}${segment}`;
        segments.push({ name: segment, path: accumulatedPath });
      }
    });

    return segments;
  }, [currentPath]);

  // Navigate to parent directory
  const goToParent = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    fetchDirectory(parentPath);
  };

  // Handle creating a new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const newPath = `${currentPath}/${newFolderName.trim()}`;
      await api.createDirectory(newPath);
      // Refresh the directory listing
      await fetchDirectory(currentPath);
      setIsCreatingFolder(false);
      setNewFolderName('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle selecting the current directory
  const handleSelectCurrent = () => {
    onSelect(currentPath);
    onClose();
  };

  // Handle selecting a recent directory
  const handleSelectRecent = (path: string) => {
    onSelect(path);
    onClose();
  };

  // Navigate into a directory
  const handleNavigateToDirectory = (entry: FileSystemEntry) => {
    const newPath = `${currentPath}/${entry.name}`;
    fetchDirectory(newPath);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setShowRecent(true);
      setIsCreatingFolder(false);
      setNewFolderName('');
      setCreateError(null);
      setError(null);
      // Don't auto-fetch, wait for user to navigate
    }
  }, [open]);

  // Handle keyboard events for new folder input
  const handleNewFolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newFolderName.trim()) {
      e.preventDefault();
      handleCreateFolder();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsCreatingFolder(false);
      setNewFolderName('');
      setCreateError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Workspace Directory</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Recent Directories Section */}
          {showRecent && sortedRecentDirectories.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Clock size={14} />
                <span>Recent Directories</span>
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {sortedRecentDirectories.map(({ path, shortname }) => (
                  <button
                    key={path}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-start rounded-md hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectRecent(path)}
                  >
                    <Folder size={16} className="text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{shortname}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{path}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDirectory(homeDir)}
                  className="w-full"
                >
                  <Home size={14} className="me-2" />
                  Browse File System
                </Button>
              </div>
            </div>
          )}

          {/* Show browse button if no recent directories */}
          {showRecent && sortedRecentDirectories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-muted-foreground mb-4">No recent directories</p>
              <Button
                variant="outline"
                onClick={() => fetchDirectory(homeDir)}
              >
                <Home size={14} className="me-2" />
                Browse File System
              </Button>
            </div>
          )}

          {/* Directory Browser */}
          {!showRecent && (
            <>
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 px-2 py-2 bg-muted/30 rounded-md mb-3 overflow-x-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 shrink-0"
                  onClick={() => setShowRecent(true)}
                >
                  <Clock size={14} />
                </Button>
                {pathSegments.map((segment, index) => (
                  <React.Fragment key={segment.path}>
                    {index > 0 && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                    <button
                      className={cn(
                        "text-sm px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors shrink-0",
                        index === pathSegments.length - 1
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      )}
                      onClick={() => fetchDirectory(segment.path)}
                    >
                      {segment.name === '/' ? <Home size={14} /> : segment.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Directory Contents */}
              <div className="flex-1 overflow-y-auto border rounded-md min-h-[200px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={24} className="animate-spin text-muted-foreground" />
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <p className="text-destructive mb-2">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => fetchDirectory(currentPath)}>
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div className="p-1">
                    {/* Parent directory link */}
                    {currentPath !== '/' && (
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-start rounded-md hover:bg-muted/50 transition-colors"
                        onClick={goToParent}
                      >
                        <ArrowUp size={16} className="text-muted-foreground" />
                        <span>..</span>
                      </button>
                    )}

                    {/* Directory list */}
                    {entries.length === 0 && currentPath !== '/' ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No subdirectories
                      </p>
                    ) : (
                      entries.map((entry) => (
                        <button
                          key={entry.name}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-start rounded-md hover:bg-muted/50 transition-colors"
                          onClick={() => handleNavigateToDirectory(entry)}
                        >
                          <Folder size={16} className="text-muted-foreground shrink-0" />
                          <span className="truncate">{entry.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* New Folder Input */}
              {isCreatingFolder && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Folder name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={handleNewFolderKeyDown}
                      autoFocus
                      disabled={isCreating}
                    />
                    <Button
                      size="sm"
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || isCreating}
                    >
                      {isCreating ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsCreatingFolder(false);
                        setNewFolderName('');
                        setCreateError(null);
                      }}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                  </div>
                  {createError && (
                    <p className="text-xs text-destructive">{createError}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          {!showRecent && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingFolder(true)}
                disabled={isCreatingFolder || loading}
                className="me-auto"
              >
                <FolderPlus size={14} className="me-2" />
                New Folder
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSelectCurrent} disabled={loading}>
                Select "{pathSegments[pathSegments.length - 1]?.name || '/'}"
              </Button>
            </>
          )}
          {showRecent && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
