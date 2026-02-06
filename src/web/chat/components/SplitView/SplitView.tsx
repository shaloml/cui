import React, { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { X, ArrowLeft } from 'lucide-react';
import { ConversationView } from '../ConversationView/ConversationView';
import { Button } from '../ui/button';

export function SplitView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const sessionIds = useMemo(() => {
    const sessionsParam = searchParams.get('sessions') || '';
    return sessionsParam.split(',').filter(Boolean).slice(0, 4); // Max 4 panels
  }, [searchParams]);

  const removeSession = (sessionId: string) => {
    const remaining = sessionIds.filter(id => id !== sessionId);
    if (remaining.length === 0) {
      navigate('/');
    } else if (remaining.length === 1) {
      navigate(`/c/${remaining[0]}`);
    } else {
      navigate(`/split?sessions=${remaining.join(',')}`);
    }
  };

  if (sessionIds.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No sessions to display. Go back to <a href="/" className="text-accent ml-1">home</a>.
      </div>
    );
  }

  if (sessionIds.length === 1) {
    // Single session, redirect to normal view
    navigate(`/c/${sessionIds[0]}`);
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-background">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back
        </Button>
        <div className="w-px h-4 bg-border" />
        <span className="text-sm text-muted-foreground">
          Split View ({sessionIds.length} panels)
        </span>
      </div>

      {/* Panels */}
      <PanelGroup direction="horizontal" className="flex-1">
        {sessionIds.map((sessionId, index) => (
          <React.Fragment key={sessionId}>
            {index > 0 && (
              <PanelResizeHandle className="w-1 bg-border/50 hover:bg-accent transition-colors cursor-col-resize" />
            )}
            <Panel minSize={20}>
              <div className="h-full flex flex-col relative">
                {/* Panel close button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 z-10 h-6 w-6 rounded-full bg-background/80 hover:bg-muted"
                  onClick={() => removeSession(sessionId)}
                >
                  <X size={12} />
                </Button>
                <ConversationView compact={true} sessionIdOverride={sessionId} />
              </div>
            </Panel>
          </React.Fragment>
        ))}
      </PanelGroup>
    </div>
  );
}
