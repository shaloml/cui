import React, { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ChatMessage } from '../../types';
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages/messages';

interface OrchestratorMessagesProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
}

function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

export function OrchestratorMessages({ messages, isStreaming }: OrchestratorMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground p-4">
        <Bot size={32} className="mb-2 opacity-50" />
        <p>Start a conversation with the orchestrator.</p>
        <p className="text-xs mt-1">
          Ask for analysis, suggestions, or execute commands.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto">
      {messages.map((message) => {
        const isUser = message.type === 'user';
        const textContent = extractTextContent(message.content);

        return (
          <div
            key={message.messageId}
            className={cn(
              'flex gap-2 max-w-full',
              isUser ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            <div
              className={cn(
                'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
                isUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isUser ? <User size={12} /> : <Bot size={12} />}
            </div>

            <div
              className={cn(
                'rounded-lg px-3 py-2 text-sm max-w-[85%]',
                isUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              <p className="whitespace-pre-wrap break-words">{textContent}</p>
            </div>
          </div>
        );
      })}

      {isStreaming && (
        <div className="flex gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
            <Bot size={12} />
          </div>
          <div className="rounded-lg px-3 py-2 bg-muted">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
