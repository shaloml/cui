import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ChatMessage } from '../types';
import {
  extractReviewItems,
  loadCompletedItems,
  saveCompletedItems,
  type ReviewItem
} from '../utils/reviewExtractor';

interface UseReviewItemsOptions {
  sessionId: string | undefined;
  messages: ChatMessage[];
}

interface UseReviewItemsResult {
  items: ReviewItem[];
  completedCount: number;
  totalCount: number;
  toggleItem: (itemId: string) => void;
  clearCompleted: () => void;
}

/**
 * Hook for managing review items extracted from conversation messages
 * Persists completion state in localStorage per session
 */
export function useReviewItems({ sessionId, messages }: UseReviewItemsOptions): UseReviewItemsResult {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  // Load completed state from localStorage when session changes
  useEffect(() => {
    if (sessionId) {
      const saved = loadCompletedItems(sessionId);
      setCompletedIds(saved);
    } else {
      setCompletedIds(new Set());
    }
  }, [sessionId]);

  // Extract review items from messages
  const extractedItems = useMemo(() => {
    return extractReviewItems(messages);
  }, [messages]);

  // Merge extracted items with completion state
  const items = useMemo(() => {
    return extractedItems.map((item) => ({
      ...item,
      completed: completedIds.has(item.id)
    }));
  }, [extractedItems, completedIds]);

  // Count completed and total items
  const completedCount = useMemo(() => {
    return items.filter((item) => item.completed).length;
  }, [items]);

  const totalCount = items.length;

  // Toggle item completion
  const toggleItem = useCallback(
    (itemId: string) => {
      if (!sessionId) return;

      setCompletedIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        // Persist to localStorage
        saveCompletedItems(sessionId, next);
        return next;
      });
    },
    [sessionId]
  );

  // Clear all completed items
  const clearCompleted = useCallback(() => {
    if (!sessionId) return;

    setCompletedIds(new Set());
    saveCompletedItems(sessionId, new Set());
  }, [sessionId]);

  return {
    items,
    completedCount,
    totalCount,
    toggleItem,
    clearCompleted
  };
}
