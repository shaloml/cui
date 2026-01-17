import React from 'react';
import { X, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import type { PendingFile } from '../../types';

interface FileAttachmentPreviewProps {
  files: PendingFile[];
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileAttachmentPreview({ files, onRemove, disabled = false }: FileAttachmentPreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="relative group flex items-center gap-2 bg-muted/50 border border-border rounded-lg p-2 pr-8 max-w-[200px]"
        >
          {/* Preview thumbnail or icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded overflow-hidden bg-muted flex items-center justify-center">
            {file.type === 'image' && file.preview ? (
              <img
                src={file.preview}
                alt={file.name}
                className="w-full h-full object-cover"
              />
            ) : file.type === 'image' ? (
              <ImageIcon size={20} className="text-muted-foreground" />
            ) : (
              <FileText size={20} className="text-muted-foreground" />
            )}
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm font-medium truncate text-foreground">
                    {file.name}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{file.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>

          {/* Remove button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => onRemove(file.id)}
            disabled={disabled}
            aria-label={`Remove ${file.name}`}
          >
            <X size={14} />
          </Button>
        </div>
      ))}
    </div>
  );
}
