import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
import { subscribeToFileChanges } from '../../utils/reviewChannel';
import { Button } from '../ui/button';

export function ReviewPage() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get('url');
  const projectPath = searchParams.get('project');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    if (iframeRef.current && url) {
      setIsLoading(true);
      // Force reload by resetting src
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc;
        }
      }, 50);
      setLastRefresh(new Date());
      setRefreshCount(prev => prev + 1);
    }
  }, [url]);

  // Subscribe to file changes for this project
  useEffect(() => {
    if (!projectPath) return;

    const unsubscribe = subscribeToFileChanges(projectPath, () => {
      handleRefresh();
    });

    return unsubscribe;
  }, [projectPath, handleRefresh]);

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Get project name from path
  const projectName = projectPath ? projectPath.split('/').pop() : 'Unknown Project';

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <AlertCircle size={48} className="text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold mb-2">Missing URL Parameter</h1>
        <p className="text-muted-foreground text-center max-w-md">
          The review page requires a URL parameter. Please open this page from a project
          with a configured dev server URL.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{projectName}</span>
          <span className="text-xs text-muted-foreground truncate max-w-[300px]" title={url}>
            {url}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Refreshes: {refreshCount}
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-7 gap-1.5"
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(url, '_blank')}
            className="h-7 gap-1.5"
          >
            <ExternalLink size={14} />
            Open
          </Button>
        </div>
      </div>

      {/* Status bar - shows when auto-refresh happens */}
      {refreshCount > 0 && (
        <div className="px-4 py-1 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
          Auto-refreshed {refreshCount} time{refreshCount > 1 ? 's' : ''} due to file changes
          {lastRefresh && (
            <span className="ml-2 text-muted-foreground">
              (last: {lastRefresh.toLocaleTimeString()})
            </span>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 top-[48px] flex items-center justify-center bg-background/80 z-10">
          <div className="flex items-center gap-2">
            <RefreshCw size={20} className="animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      )}

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={url}
        className="flex-1 w-full border-none"
        title={`Review: ${projectName}`}
        onLoad={handleIframeLoad}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}
