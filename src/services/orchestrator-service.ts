import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { OrchestratorSession, ConversationMessage, CUIError } from '@/types/index.js';
import { ClaudeProcessManager } from './claude-process-manager.js';
import { ClaudeHistoryReader } from './claude-history-reader.js';
import { StreamManager } from './stream-manager.js';
import { createLogger, type Logger } from './logger.js';

/**
 * System prompt for orchestrator sessions
 */
function buildOrchestratorSystemPrompt(
  mainConversationHistory: string,
  workingDirectory: string
): string {
  return `You are an orchestrator assistant monitoring a main conversation between a user and another Claude instance.

Your role is to:
- Analyze the conversation history and provide insights
- Execute file operations and bash commands independently when asked
- Suggest next steps or improvements
- Help verify work done in the main conversation
- Provide meta-commentary and strategic guidance

You have full access to the file system and can run commands in the working directory.

Main conversation context:
${mainConversationHistory}

Current working directory: ${workingDirectory}

When the user asks you to "inject" something, they want you to suggest text that they can paste into the main conversation's composer. Format injection suggestions clearly.

Focus on being helpful as a "second pair of eyes" on the main conversation.`;
}

/**
 * Format conversation history for orchestrator context
 */
function formatConversationHistory(messages: ConversationMessage[]): string {
  if (messages.length === 0) {
    return '(No messages yet)';
  }

  return messages
    .slice(-50) // Only include last 50 messages to avoid token limits
    .map((msg, index) => {
      const role = msg.type === 'user' ? 'User' : msg.type === 'assistant' ? 'Assistant' : 'System';
      let content = '';

      if (typeof msg.message === 'object' && 'content' in msg.message) {
        const msgContent = msg.message.content;
        if (typeof msgContent === 'string') {
          content = msgContent;
        } else if (Array.isArray(msgContent)) {
          // Extract text from content blocks
          content = msgContent
            .filter((block): block is { type: 'text'; text: string } =>
              typeof block === 'object' && block !== null && 'type' in block && block.type === 'text'
            )
            .map(block => block.text)
            .join('\n');
        }
      }

      // Truncate long messages
      if (content.length > 500) {
        content = content.substring(0, 500) + '... [truncated]';
      }

      return `[${index + 1}] ${role}: ${content}`;
    })
    .join('\n\n');
}

/**
 * Manages orchestrator sessions - independent Claude sessions
 * that monitor and assist with main conversations
 */
export class OrchestratorService extends EventEmitter {
  private sessions: Map<string, OrchestratorSession> = new Map();
  private processManager: ClaudeProcessManager;
  private historyReader: ClaudeHistoryReader;
  private streamManager: StreamManager;
  private logger: Logger;
  private injectionCallbacks: Map<string, (text: string) => void> = new Map();

  constructor(
    processManager: ClaudeProcessManager,
    historyReader: ClaudeHistoryReader,
    streamManager: StreamManager
  ) {
    super();
    this.processManager = processManager;
    this.historyReader = historyReader;
    this.streamManager = streamManager;
    this.logger = createLogger('OrchestratorService');
  }

  /**
   * Start a new orchestrator session
   */
  async startOrchestrator(
    mainSessionId: string,
    workingDirectory: string
  ): Promise<OrchestratorSession> {
    const orchestratorId = uuidv4();

    this.logger.info('Starting orchestrator session', {
      orchestratorId,
      mainSessionId,
      workingDirectory
    });

    try {
      // Fetch main conversation history for context
      let conversationHistory = '';
      try {
        const messages = await this.historyReader.fetchConversation(mainSessionId);
        conversationHistory = formatConversationHistory(messages);
        this.logger.debug('Loaded main conversation history for orchestrator', {
          orchestratorId,
          mainSessionId,
          messageCount: messages.length
        });
      } catch (error) {
        this.logger.warn('Could not load main conversation history', {
          orchestratorId,
          mainSessionId,
          error: error instanceof Error ? error.message : String(error)
        });
        conversationHistory = '(Unable to load conversation history)';
      }

      // Build system prompt with conversation context
      const systemPrompt = buildOrchestratorSystemPrompt(
        conversationHistory,
        workingDirectory
      );

      // Start the Claude process for the orchestrator
      const { streamingId, systemInit } = await this.processManager.startConversation({
        workingDirectory,
        initialPrompt: 'Hello! I am ready to help monitor and assist with the main conversation. What would you like me to do?',
        systemPrompt,
        model: 'sonnet', // Use faster model for orchestrator
        permissionMode: 'default'
      });

      const session: OrchestratorSession = {
        orchestratorId,
        streamingId,
        claudeSessionId: systemInit.session_id,
        mainSessionId,
        workingDirectory,
        createdAt: new Date().toISOString(),
        status: 'ready'
      };

      this.sessions.set(orchestratorId, session);

      // Set up event forwarding from process manager to stream manager
      this.setupEventForwarding(orchestratorId, streamingId);

      this.logger.info('Orchestrator session started successfully', {
        orchestratorId,
        streamingId,
        sessionId: systemInit.session_id
      });

      return session;
    } catch (error) {
      this.logger.error('Failed to start orchestrator session', error, {
        orchestratorId,
        mainSessionId
      });
      throw new CUIError(
        'ORCHESTRATOR_START_FAILED',
        `Failed to start orchestrator: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Set up event forwarding from Claude process to stream clients.
   * Forwards events from a specific process (identified by processStreamingId)
   * to the orchestrator's client-facing stream (clientStreamingId).
   */
  private setupEventForwarding(orchestratorId: string, processStreamingId: string, clientStreamingId?: string): void {
    const targetStreamingId = clientStreamingId || processStreamingId;

    const messageHandler = ({ streamingId: eventStreamingId, message }: { streamingId: string; message: import('@/types/index.js').StreamEvent }) => {
      if (eventStreamingId === processStreamingId) {
        this.streamManager.broadcast(targetStreamingId, message);
      }
    };

    const closeHandler = ({ streamingId: eventStreamingId }: { streamingId: string }) => {
      if (eventStreamingId === processStreamingId) {
        const session = this.sessions.get(orchestratorId);
        if (session && session.status === 'busy') {
          // Process finished responding, mark as ready for next message
          session.status = 'ready';
          this.sessions.set(orchestratorId, session);
        }
        // Don't close the stream session - keep SSE alive for follow-up messages
        this.processManager.removeListener('claude-message', messageHandler);
        this.processManager.removeListener('process-closed', closeHandler);
      }
    };

    this.processManager.on('claude-message', messageHandler);
    this.processManager.on('process-closed', closeHandler);
  }

  /**
   * Send a message to an orchestrator session
   */
  async sendMessage(orchestratorId: string, prompt: string): Promise<void> {
    const session = this.sessions.get(orchestratorId);
    if (!session) {
      throw new CUIError('ORCHESTRATOR_NOT_FOUND', 'Orchestrator session not found', 404);
    }

    if (session.status === 'stopped') {
      throw new CUIError('ORCHESTRATOR_STOPPED', 'Orchestrator session has stopped', 400);
    }

    if (session.status === 'busy') {
      throw new CUIError('ORCHESTRATOR_BUSY', 'Orchestrator is still processing a message', 400);
    }

    this.logger.debug('Sending message to orchestrator', {
      orchestratorId,
      claudeSessionId: session.claudeSessionId,
      promptLength: prompt.length
    });

    // Update status to busy
    session.status = 'busy';
    this.sessions.set(orchestratorId, session);

    try {
      // Resume the conversation with the new message using the Claude session ID
      const { streamingId: newStreamingId, systemInit } = await this.processManager.startConversation({
        workingDirectory: session.workingDirectory,
        initialPrompt: prompt,
        resumedSessionId: session.claudeSessionId
      });

      // Update the Claude session ID (may change on resume)
      session.claudeSessionId = systemInit.session_id;
      this.sessions.set(orchestratorId, session);

      // Set up event forwarding from new process to original client stream
      this.setupEventForwarding(orchestratorId, newStreamingId, session.streamingId);

      this.logger.debug('Orchestrator message sent, new process started', {
        orchestratorId,
        newStreamingId,
        clientStreamingId: session.streamingId
      });
    } catch (error) {
      // Restore status on error
      session.status = 'ready';
      this.sessions.set(orchestratorId, session);
      throw error;
    }
  }

  /**
   * Register a callback to receive injection requests for a main session
   */
  registerInjectionCallback(mainSessionId: string, callback: (text: string) => void): void {
    this.injectionCallbacks.set(mainSessionId, callback);
    this.logger.debug('Registered injection callback', { mainSessionId });
  }

  /**
   * Unregister an injection callback
   */
  unregisterInjectionCallback(mainSessionId: string): void {
    this.injectionCallbacks.delete(mainSessionId);
    this.logger.debug('Unregistered injection callback', { mainSessionId });
  }

  /**
   * Inject text into the main conversation's composer
   * This emits an event that the frontend can listen for
   */
  injectToMain(orchestratorId: string, text: string): void {
    const session = this.sessions.get(orchestratorId);
    if (!session) {
      throw new CUIError('ORCHESTRATOR_NOT_FOUND', 'Orchestrator session not found', 404);
    }

    this.logger.debug('Injecting text to main conversation', {
      orchestratorId,
      mainSessionId: session.mainSessionId,
      textLength: text.length
    });

    // Emit injection event for the main session
    this.emit('inject', {
      mainSessionId: session.mainSessionId,
      orchestratorId,
      text
    });

    // Call the injection callback if registered
    const callback = this.injectionCallbacks.get(session.mainSessionId);
    if (callback) {
      callback(text);
    }
  }

  /**
   * Stop an orchestrator session
   */
  async stopOrchestrator(orchestratorId: string): Promise<boolean> {
    const session = this.sessions.get(orchestratorId);
    if (!session) {
      this.logger.warn('Attempted to stop non-existent orchestrator', { orchestratorId });
      return false;
    }

    this.logger.info('Stopping orchestrator session', { orchestratorId });

    try {
      // Stop the Claude process
      await this.processManager.stopConversation(session.streamingId);

      // Update session status
      session.status = 'stopped';
      this.sessions.set(orchestratorId, session);

      // Close stream connections
      this.streamManager.closeSession(session.streamingId);

      // Clean up injection callback
      this.injectionCallbacks.delete(session.mainSessionId);

      this.logger.info('Orchestrator session stopped', { orchestratorId });
      return true;
    } catch (error) {
      this.logger.error('Error stopping orchestrator session', error, { orchestratorId });
      return false;
    }
  }

  /**
   * Get an orchestrator session by ID
   */
  getSession(orchestratorId: string): OrchestratorSession | undefined {
    return this.sessions.get(orchestratorId);
  }

  /**
   * Get all orchestrator sessions for a main session
   */
  getSessionsForMain(mainSessionId: string): OrchestratorSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.mainSessionId === mainSessionId
    );
  }

  /**
   * Check if an orchestrator session is active
   */
  isActive(orchestratorId: string): boolean {
    const session = this.sessions.get(orchestratorId);
    return session !== undefined && session.status !== 'stopped';
  }

  /**
   * Get all active orchestrator sessions
   */
  getActiveSessions(): OrchestratorSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.status !== 'stopped'
    );
  }

  /**
   * Check if a streamingId belongs to an active orchestrator session.
   * Used by the global process-closed handler to avoid closing orchestrator SSE streams.
   */
  isOrchestratorStreamingId(streamingId: string): boolean {
    for (const session of this.sessions.values()) {
      if (session.status !== 'stopped' && session.streamingId === streamingId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Refresh the main conversation context for an orchestrator
   */
  async refreshContext(orchestratorId: string): Promise<void> {
    const session = this.sessions.get(orchestratorId);
    if (!session) {
      throw new CUIError('ORCHESTRATOR_NOT_FOUND', 'Orchestrator session not found', 404);
    }

    this.logger.debug('Refreshing orchestrator context', {
      orchestratorId,
      mainSessionId: session.mainSessionId
    });

    try {
      // Fetch updated conversation history
      const messages = await this.historyReader.fetchConversation(session.mainSessionId);
      const conversationHistory = formatConversationHistory(messages);

      // Send the updated context as a message to the orchestrator
      const contextUpdate = `[CONTEXT UPDATE] Here's the latest state of the main conversation:\n\n${conversationHistory}`;
      await this.sendMessage(orchestratorId, contextUpdate);
    } catch (error) {
      this.logger.error('Failed to refresh orchestrator context', error, { orchestratorId });
      throw error;
    }
  }
}
