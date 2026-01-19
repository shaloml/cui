/**
 * BroadcastChannel utility for Review tab auto-refresh functionality.
 * When Claude makes file changes (Edit/Write tools), the main app notifies
 * any open Review tabs to refresh their content.
 */

const REVIEW_CHANNEL_NAME = 'cui-review-refresh';

export interface FileChangeMessage {
  type: 'file-change';
  projectPath: string;
  timestamp: number;
}

/**
 * Notify all open Review tabs that files have changed in a project.
 * Call this when Claude uses Edit, Write, MultiEdit, or NotebookEdit tools.
 */
export function notifyFileChange(projectPath: string): void {
  const channel = new BroadcastChannel(REVIEW_CHANNEL_NAME);
  const message: FileChangeMessage = {
    type: 'file-change',
    projectPath,
    timestamp: Date.now(),
  };
  channel.postMessage(message);
  channel.close();
}

/**
 * Subscribe to file change notifications for a specific project.
 * Used by Review tabs to know when to refresh.
 *
 * @param projectPath - The project path to listen for changes
 * @param onRefresh - Callback to trigger refresh
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToFileChanges(
  projectPath: string,
  onRefresh: () => void
): () => void {
  const channel = new BroadcastChannel(REVIEW_CHANNEL_NAME);

  channel.onmessage = (event: MessageEvent<FileChangeMessage>) => {
    if (event.data.type === 'file-change' && event.data.projectPath === projectPath) {
      onRefresh();
    }
  };

  return () => {
    channel.close();
  };
}

/**
 * Get the channel name (useful for debugging)
 */
export function getReviewChannelName(): string {
  return REVIEW_CHANNEL_NAME;
}
