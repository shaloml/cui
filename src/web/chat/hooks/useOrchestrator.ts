import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useStreaming } from './useStreaming';
import { useConversationMessages } from './useConversationMessages';
import type { ChatMessage } from '../types';

export interface OrchestratorState {
  isOpen: boolean;
  orchestratorId: string | null;
  streamingId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  mainSessionId: string | null;
  status: 'initializing' | 'ready' | 'busy' | 'stopped' | null;
}

export interface UseOrchestratorResult {
  state: OrchestratorState;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  startOrchestrator: (mainSessionId: string, workingDirectory: string) => Promise<void>;
  stopOrchestrator: () => Promise<void>;
  sendMessage: (prompt: string) => Promise<void>;
  injectToMain: (text: string) => Promise<void>;
  refreshContext: () => Promise<void>;
}

const STORAGE_KEY = 'cui-orchestrator-panel-open';

export function useOrchestrator(): UseOrchestratorResult {
  const [state, setState] = useState<OrchestratorState>(() => ({
    isOpen: localStorage.getItem(STORAGE_KEY) === 'true',
    orchestratorId: null,
    streamingId: null,
    messages: [],
    isStreaming: false,
    isLoading: false,
    error: null,
    mainSessionId: null,
    status: null
  }));

  // Use conversation messages hook for managing orchestrator messages
  const {
    messages: orchestratorMessages,
    handleStreamMessage,
    clearMessages,
    addMessage
  } = useConversationMessages({
    onError: (error) => {
      setState(prev => ({ ...prev, error }));
    }
  });

  // Set up streaming for the orchestrator
  const { isConnected, disconnect } = useStreaming(state.streamingId, {
    onMessage: handleStreamMessage,
    onError: (err) => {
      setState(prev => ({
        ...prev,
        error: err.message,
        isStreaming: false
      }));
    }
  });

  // Update messages in state when orchestrator messages change
  useEffect(() => {
    setState(prev => ({ ...prev, messages: orchestratorMessages }));
  }, [orchestratorMessages]);

  // Update streaming status
  useEffect(() => {
    setState(prev => ({ ...prev, isStreaming: isConnected }));
  }, [isConnected]);

  // Persist panel open state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, state.isOpen.toString());
  }, [state.isOpen]);

  const openPanel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true }));
  }, []);

  const closePanel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const togglePanel = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const startOrchestrator = useCallback(async (mainSessionId: string, workingDirectory: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await api.startOrchestrator(mainSessionId, workingDirectory);

      setState(prev => ({
        ...prev,
        orchestratorId: response.orchestratorId,
        streamingId: response.streamingId,
        mainSessionId,
        status: 'ready',
        isLoading: false,
        isOpen: true
      }));

      // Clear any previous messages
      clearMessages();
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to start orchestrator',
        isLoading: false
      }));
    }
  }, [clearMessages]);

  const stopOrchestrator = useCallback(async () => {
    if (!state.orchestratorId) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await api.stopOrchestrator(state.orchestratorId);
      disconnect();
      clearMessages();

      setState(prev => ({
        ...prev,
        orchestratorId: null,
        streamingId: null,
        status: 'stopped',
        isLoading: false,
        isStreaming: false
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to stop orchestrator',
        isLoading: false
      }));
    }
  }, [state.orchestratorId, disconnect, clearMessages]);

  const sendMessage = useCallback(async (prompt: string) => {
    if (!state.orchestratorId) {
      setState(prev => ({ ...prev, error: 'No active orchestrator session' }));
      return;
    }

    // Add user message optimistically
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      messageId: `user-${Date.now()}`,
      type: 'user',
      content: prompt,
      timestamp: new Date().toISOString()
    };
    addMessage(userMessage);

    setState(prev => ({ ...prev, status: 'busy', error: null }));

    try {
      await api.sendOrchestratorMessage(state.orchestratorId, prompt);
      setState(prev => ({ ...prev, status: 'ready' }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to send message',
        status: 'ready'
      }));
    }
  }, [state.orchestratorId, addMessage]);

  const injectToMain = useCallback(async (text: string) => {
    if (!state.orchestratorId) {
      setState(prev => ({ ...prev, error: 'No active orchestrator session' }));
      return;
    }

    try {
      await api.injectToMain(state.orchestratorId, text);
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to inject text'
      }));
    }
  }, [state.orchestratorId]);

  const refreshContext = useCallback(async () => {
    if (!state.orchestratorId) {
      setState(prev => ({ ...prev, error: 'No active orchestrator session' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      await api.refreshOrchestratorContext(state.orchestratorId);
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to refresh context',
        isLoading: false
      }));
    }
  }, [state.orchestratorId]);

  return {
    state,
    openPanel,
    closePanel,
    togglePanel,
    startOrchestrator,
    stopOrchestrator,
    sendMessage,
    injectToMain,
    refreshContext
  };
}
