import React, { useEffect, useRef } from 'react';
import { Bot, User, FileText, Edit, Terminal, Search, List, CheckSquare, Globe, ExternalLink, Play, FileEdit, ClipboardList, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ToolUseRenderer } from '../ToolRendering/ToolUseRenderer';
import type { ChatMessage, ToolResult } from '../../types';
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages/messages';

interface OrchestratorMessagesProps {
  messages: ChatMessage[];
  toolResults?: Record<string, ToolResult>;
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

function getToolIcon(toolName: string) {
  switch (toolName) {
    case 'Read':
      return <FileText size={14} />;
    case 'Edit':
    case 'MultiEdit':
      return <Edit size={14} />;
    case 'Bash':
      return <Terminal size={14} />;
    case 'Grep':
    case 'Glob':
      return <Search size={14} />;
    case 'LS':
      return <List size={14} />;
    case 'TodoRead':
    case 'TodoWrite':
      return <CheckSquare size={14} />;
    case 'WebSearch':
      return <Globe size={14} />;
    case 'WebFetch':
      return <ExternalLink size={14} />;
    case 'Task':
      return <Play size={14} />;
    case 'exit_plan_mode':
      return <ClipboardList size={14} />;
    case 'Write':
      return <FileEdit size={14} />;
    default:
      return <Settings size={14} />;
  }
}

export function OrchestratorMessages({ messages, toolResults = {}, isStreaming }: OrchestratorMessagesProps) {
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

        if (isUser) {
          const textContent = extractTextContent(message.content);
          return (
            <div
              key={message.messageId}
              className="flex gap-2 flex-row-reverse"
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                <User size={12} />
              </div>
              <div className="rounded-lg px-3 py-2 text-sm max-w-[85%] bg-primary text-primary-foreground">
                <p className="whitespace-pre-wrap break-words">{textContent}</p>
              </div>
            </div>
          );
        }

        // Assistant messages: render content blocks individually
        const contentBlocks = typeof message.content === 'string'
          ? [{ type: 'text' as const, text: message.content }]
          : Array.isArray(message.content)
            ? message.content
            : [];

        // Filter out thinking blocks and check if there's any renderable content
        const renderableBlocks = contentBlocks.filter((block: any) => block.type !== 'thinking');
        if (renderableBlocks.length === 0) return null;

        return (
          <div
            key={message.messageId}
            className="flex gap-2 flex-row"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
              <Bot size={12} />
            </div>

            <div className="flex flex-col gap-2 max-w-[85%] min-w-0">
              {renderableBlocks.map((block: any, index: number) => {
                const blockKey = `${message.messageId}-${index}`;

                if (block.type === 'text') {
                  return (
                    <div
                      key={blockKey}
                      className="rounded-lg px-3 py-2 text-sm bg-muted text-foreground"
                    >
                      <p className="whitespace-pre-wrap break-words">{block.text}</p>
                    </div>
                  );
                }

                if (block.type === 'tool_use') {
                  const toolResult = toolResults[block.id];
                  const isLoading = !toolResult || toolResult.status === 'pending';
                  const shouldBlink = isLoading && isStreaming;

                  return (
                    <div
                      key={blockKey}
                      className="flex gap-1.5 items-start text-sm"
                    >
                      <div className={cn(
                        'w-4 h-4 flex-shrink-0 flex items-center justify-center text-muted-foreground mt-0.5',
                        shouldBlink && 'animate-pulse'
                      )}>
                        {getToolIcon(block.name)}
                      </div>
                      <div className="flex-1 min-w-0 break-words">
                        <ToolUseRenderer
                          toolUse={block}
                          toolResult={toolResult}
                          toolResults={toolResults}
                          workingDirectory={message.workingDirectory}
                        />
                      </div>
                    </div>
                  );
                }

                return null;
              })}
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
