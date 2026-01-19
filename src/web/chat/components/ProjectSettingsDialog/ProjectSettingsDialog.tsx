import React, { useState } from 'react';
import { X, Globe } from 'lucide-react';
import { Dialog } from '../Dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { ProjectInfo } from '../../types';

interface ProjectSettingsDialogProps {
  project: ProjectInfo;
  onClose: () => void;
  onSave: (devServerUrl: string) => void;
}

export function ProjectSettingsDialog({
  project,
  onClose,
  onSave,
}: ProjectSettingsDialogProps) {
  const [devServerUrl, setDevServerUrl] = useState(project.devServerUrl || '');

  const handleSave = () => {
    onSave(devServerUrl.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <Dialog open onClose={onClose} title={`Project Settings - ${project.shortname}`}>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Project Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Project info */}
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{project.shortname}</span>
          <p className="mt-1 text-xs truncate" title={project.path}>
            {project.path}
          </p>
        </div>

        {/* Dev Server URL */}
        <div className="space-y-2">
          <Label htmlFor="devServerUrl" className="flex items-center gap-2">
            <Globe size={16} />
            Dev Server URL
          </Label>
          <Input
            id="devServerUrl"
            type="url"
            placeholder="http://localhost:3000"
            value={devServerUrl}
            onChange={e => setDevServerUrl(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <p className="text-xs text-muted-foreground">
            URL of your development server. Used for the Review feature which auto-refreshes when Claude makes file changes.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
