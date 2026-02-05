import type { ChatMessage } from '../types';
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages/messages';

export interface ReviewItem {
  id: string;
  type: 'todo' | 'verify' | 'check' | 'warning';
  text: string;
  completed: boolean;
  sourceMessageId: string;
}

/**
 * Patterns to extract review/verification items from Claude's responses
 */
const REVIEW_PATTERNS = [
  // TODO / FIXME comments
  {
    pattern: /(?:TODO|FIXME)[:\s]+(.+?)(?:\n|$)/gi,
    type: 'todo' as const,
  },
  // "Please verify/check/review/test..." patterns
  {
    pattern: /(?:Please\s+(?:verify|check|review|test|ensure))[:\s]+(.+?)(?:\.|!|\n|$)/gi,
    type: 'verify' as const,
  },
  // "Make sure..." / "Don't forget..." / "Remember to..."
  {
    pattern: /(?:Make sure|Don't forget|Remember to)[:\s]+(.+?)(?:\.|!|\n|$)/gi,
    type: 'check' as const,
  },
  // "Important:" / "Note:" / "Warning:" items
  {
    pattern: /(?:Important|Note|Warning)[:\s]+(.+?)(?:\.|!|\n|$)/gi,
    type: 'warning' as const,
  },
  // "You should verify/check/test..."
  {
    pattern: /(?:You should\s+(?:verify|check|test|ensure|confirm))[:\s]+(.+?)(?:\.|!|\n|$)/gi,
    type: 'verify' as const,
  },
  // "Run the tests" / "Run tests" / "Test that..."
  {
    pattern: /(?:Run (?:the )?tests?|Test that)[:\s]*(.+?)(?:\.|!|\n|$)/gi,
    type: 'check' as const,
  },
  // Checkbox items in markdown: "- [ ]"
  {
    pattern: /-\s*\[\s*\]\s*(.+?)(?:\n|$)/gi,
    type: 'todo' as const,
  },
];

/**
 * Minimum length for a review item to be considered valid
 */
const MIN_ITEM_LENGTH = 5;

/**
 * Maximum length for a review item (truncate if longer)
 */
const MAX_ITEM_LENGTH = 150;

/**
 * Extract text content from a message
 */
function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

/**
 * Clean up extracted review item text
 */
function cleanReviewText(text: string): string {
  return text
    .trim()
    // Remove leading punctuation
    .replace(/^[:\-,.\s]+/, '')
    // Remove trailing punctuation
    .replace(/[,.\s]+$/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a unique ID for a review item
 */
function generateItemId(messageId: string, text: string, index: number): string {
  // Create a simple hash from the text for stability
  const textHash = text
    .toLowerCase()
    .split('')
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    .toString(36);

  return `review-${messageId}-${textHash}-${index}`;
}

/**
 * Extract review items from all assistant messages in a conversation
 */
export function extractReviewItems(messages: ChatMessage[]): ReviewItem[] {
  const items: ReviewItem[] = [];
  const seenTexts = new Set<string>();

  // Process all assistant messages
  const assistantMessages = messages.filter((msg) => msg.type === 'assistant');

  for (const message of assistantMessages) {
    const textContent = extractTextContent(message.content);
    let itemIndex = 0;

    for (const { pattern, type } of REVIEW_PATTERNS) {
      // Reset pattern lastIndex for each iteration
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(textContent)) !== null) {
        const rawText = match[1];
        if (!rawText) continue;

        const cleanedText = cleanReviewText(rawText);

        // Skip if too short or already seen
        if (cleanedText.length < MIN_ITEM_LENGTH) continue;

        const normalizedText = cleanedText.toLowerCase();
        if (seenTexts.has(normalizedText)) continue;

        seenTexts.add(normalizedText);

        // Truncate if too long
        let finalText = cleanedText;
        if (finalText.length > MAX_ITEM_LENGTH) {
          finalText = finalText.slice(0, MAX_ITEM_LENGTH).trim() + '...';
        }

        // Capitalize first letter
        finalText = finalText.charAt(0).toUpperCase() + finalText.slice(1);

        items.push({
          id: generateItemId(message.messageId, cleanedText, itemIndex++),
          type,
          text: finalText,
          completed: false,
          sourceMessageId: message.messageId,
        });
      }
    }
  }

  return items;
}

/**
 * Extract review items from a single message
 */
export function extractReviewItemsFromMessage(message: ChatMessage): ReviewItem[] {
  if (message.type !== 'assistant') {
    return [];
  }

  return extractReviewItems([message]);
}

/**
 * Check if a message contains any review items
 */
export function hasReviewItems(message: ChatMessage): boolean {
  if (message.type !== 'assistant') {
    return false;
  }

  const textContent = extractTextContent(message.content);

  for (const { pattern } of REVIEW_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(textContent)) {
      return true;
    }
  }

  return false;
}

/**
 * Storage key prefix for review item completion state
 */
const STORAGE_KEY_PREFIX = 'cui-review-items-';

/**
 * Get the storage key for a session
 */
export function getStorageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
}

/**
 * Load completed item IDs from localStorage
 */
export function loadCompletedItems(sessionId: string): Set<string> {
  try {
    const stored = localStorage.getItem(getStorageKey(sessionId));
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch (e) {
    console.error('Failed to load review item state:', e);
  }
  return new Set();
}

/**
 * Save completed item IDs to localStorage
 */
export function saveCompletedItems(sessionId: string, completedIds: Set<string>): void {
  try {
    localStorage.setItem(getStorageKey(sessionId), JSON.stringify([...completedIds]));
  } catch (e) {
    console.error('Failed to save review item state:', e);
  }
}
