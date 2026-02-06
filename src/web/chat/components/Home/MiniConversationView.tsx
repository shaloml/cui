import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { api } from '../../services/api';
import type { ChatMessage, ConversationDetailsResponse, ConversationMessage } from '../../types';

interface MiniConversationViewProps {
  sessionId: string;
}

export function MiniConversationView({ sessionId }: MiniConversationViewProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      try {
        const details: ConversationDetailsResponse = await api.getConversationDetails(sessionId);
        if (cancelled) return;

        const chatMessages = details.messages
          .filter(msg => !msg.isSidechain)
          .slice(-10) // Last 10 messages
          .map((msg: ConversationMessage) => {
            let content = msg.message;
            if (typeof msg.message === 'object' && 'content' in msg.message) {
              content = msg.message.content;
            }
            return {
              id: msg.uuid,
              messageId: msg.uuid,
              type: msg.type as 'user' | 'assistant' | 'system',
              content,
              timestamp: msg.timestamp,
            };
          });

        setMessages(chatMessages);
      } catch (err) {
        console.error('Failed to load mini conversation:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMessages();
    return () => { cancelled = true; };
  }, [sessionId]);

  const extractText = (content: ChatMessage['content']): string => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n')
        .slice(0, 200);
    }
    return '';
  };

  if (loading) {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground animate-pulse">
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="max-h-[400px] overflow-y-auto bg-muted/5 border-t border-border/20">
      {messages.map((msg) => (
        <div
          key={msg.messageId}
          className={`px-4 py-2 text-xs border-b border-border/10 ${
            msg.type === 'user' ? 'bg-muted/20' : ''
          }`}
        >
          <span className="font-medium text-muted-foreground mr-1.5">
            {msg.type === 'user' ? 'You:' : 'Claude:'}
          </span>
          <span className="text-foreground/80 break-words">
            {extractText(msg.content).slice(0, 300)}
            {extractText(msg.content).length > 300 && '...'}
          </span>
        </div>
      ))}
      <div
        className="px-4 py-2 text-xs text-accent cursor-pointer hover:bg-muted/30 flex items-center gap-1"
        onClick={() => navigate(`/c/${sessionId}`)}
      >
        <ExternalLink size={12} />
        Open full view
      </div>
    </div>
  );
}
