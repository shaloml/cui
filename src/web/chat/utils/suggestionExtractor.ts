import type { ChatMessage } from '../types';
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages/messages';

export interface Suggestion {
  id: string;
  text: string;
  type: 'action' | 'question' | 'next-step';
  sourceMessageId: string;
}

/**
 * Patterns to extract follow-up suggestions from Claude's responses
 */
const FOLLOW_UP_PATTERNS = [
  // "Would you like me to..." / "Shall I..." / "Should I..."
  {
    pattern: /(?:Would you like me to|Shall I|Should I)\s+(.+?)(?:\?|$)/gi,
    type: 'action' as const,
  },
  // "You could also..." / "You might want to..." / "You can also..."
  {
    pattern: /(?:You (?:could|might|can)(?: also)?)\s+(.+?)(?:\.|$)/gi,
    type: 'next-step' as const,
  },
  // "Next steps:" / "Next step:" followed by content
  {
    pattern: /(?:Next steps?)[:\s]+(.+?)(?:\n|$)/gi,
    type: 'next-step' as const,
  },
  // "Consider..." suggestions
  {
    pattern: /(?:Consider)\s+(.+?)(?:\.|$)/gi,
    type: 'next-step' as const,
  },
  // "Let me know if..." patterns
  {
    pattern: /(?:Let me know if you(?:'d like| want) (?:me to)?)\s+(.+?)(?:\.|$)/gi,
    type: 'question' as const,
  },
];

/**
 * Minimum length for a suggestion to be considered valid
 */
const MIN_SUGGESTION_LENGTH = 10;

/**
 * Maximum length for a suggestion (truncate if longer)
 */
const MAX_SUGGESTION_LENGTH = 100;

/**
 * Maximum number of suggestions to return
 */
const MAX_SUGGESTIONS = 4;

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
 * Clean up extracted suggestion text
 */
function cleanSuggestionText(text: string): string {
  return text
    .trim()
    // Remove leading punctuation
    .replace(/^[:\-,.\s]+/, '')
    // Remove trailing punctuation except question marks
    .replace(/[,.\s]+$/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert suggestion to imperative/actionable form
 */
function toActionableForm(text: string, type: Suggestion['type']): string {
  let actionable = text;

  // Remove common prefixes that make it read less like a command
  actionable = actionable
    .replace(/^to\s+/i, '')
    .replace(/^that\s+/i, '');

  // Capitalize first letter
  actionable = actionable.charAt(0).toUpperCase() + actionable.slice(1);

  // Add question mark for questions if not present
  if (type === 'question' && !actionable.endsWith('?')) {
    actionable += '?';
  }

  return actionable;
}

/**
 * Extract follow-up suggestions from the last assistant message
 */
export function extractSuggestions(messages: ChatMessage[]): Suggestion[] {
  // Find the last assistant message
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((msg) => msg.type === 'assistant');

  if (!lastAssistantMessage) {
    return [];
  }

  const textContent = extractTextContent(lastAssistantMessage.content);
  const suggestions: Suggestion[] = [];
  const seenTexts = new Set<string>();

  for (const { pattern, type } of FOLLOW_UP_PATTERNS) {
    // Reset pattern lastIndex for each iteration
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(textContent)) !== null) {
      const rawText = match[1];
      if (!rawText) continue;

      const cleanedText = cleanSuggestionText(rawText);

      // Skip if too short or already seen
      if (cleanedText.length < MIN_SUGGESTION_LENGTH) continue;
      if (seenTexts.has(cleanedText.toLowerCase())) continue;

      seenTexts.add(cleanedText.toLowerCase());

      // Truncate if too long
      let finalText = cleanedText;
      if (finalText.length > MAX_SUGGESTION_LENGTH) {
        finalText = finalText.slice(0, MAX_SUGGESTION_LENGTH).trim() + '...';
      }

      // Convert to actionable form
      finalText = toActionableForm(finalText, type);

      suggestions.push({
        id: `suggestion-${lastAssistantMessage.messageId}-${suggestions.length}`,
        text: finalText,
        type,
        sourceMessageId: lastAssistantMessage.messageId,
      });

      if (suggestions.length >= MAX_SUGGESTIONS) {
        return suggestions;
      }
    }
  }

  return suggestions;
}

/**
 * Check if there are any extractable suggestions in a message
 */
export function hasSuggestions(message: ChatMessage): boolean {
  if (message.type !== 'assistant') {
    return false;
  }

  const textContent = extractTextContent(message.content);

  for (const { pattern } of FOLLOW_UP_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(textContent)) {
      return true;
    }
  }

  return false;
}
