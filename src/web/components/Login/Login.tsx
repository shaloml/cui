import React, { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/web/chat/components/ui/button';
import { Input } from '@/web/chat/components/ui/input';
import { verifyAccessCode, setupAccessCode } from '@/web/hooks/useAuth';

interface LoginProps {
  onLogin: (token: string) => void;
  mode: 'setup' | 'accessCode';
}

export default function Login({ onLogin, mode }: LoginProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isSetup = mode === 'setup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (isSetup) {
      // Setup new access code
      if (input.length < 4) {
        setError('Code must be at least 4 characters');
        setIsLoading(false);
        return;
      }

      const result = await setupAccessCode(input);
      if (result.success && result.token) {
        onLogin(result.token);
        window.location.reload();
      } else {
        setError(result.error || 'Setup failed');
        setIsLoading(false);
      }
    } else {
      // Verify existing access code
      const result = await verifyAccessCode(input);
      if (result.success && result.token) {
        onLogin(result.token);
        window.location.reload();
      } else {
        setError(result.error || 'Invalid code');
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-neutral-900 p-6">
      <div className="w-full max-w-[400px] px-8 py-12 bg-white dark:bg-neutral-800 dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
        <h2 className="text-lg font-normal mb-4 text-neutral-900 dark:text-neutral-100 text-center tracking-tight">
          {isSetup ? 'Create access code:' : 'Access code:'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-2 items-center">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 h-11 px-4 rounded-3xl bg-neutral-50 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100 font-mono text-center text-2xl tracking-[0.3em] transition-all focus:bg-white dark:focus:bg-neutral-900 focus:border-neutral-400 dark:focus:border-neutral-500"
              autoFocus
              spellCheck={false}
              autoComplete="off"
              placeholder="••••"
              aria-label={isSetup ? 'Create access code' : 'Enter access code'}
              disabled={isLoading}
            />

            {input && (
              <Button
                type="submit"
                size="icon"
                className="w-11 h-11 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.15)] active:translate-y-0 transition-all"
                aria-label="Submit"
                disabled={isLoading}
              >
                <ArrowUp size={16} />
              </Button>
            )}
          </div>

          {error && (
            <div className="text-[13px] text-red-500 text-center -mt-2">
              {error}
            </div>
          )}

          {isSetup && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 text-center">
              Choose a code you'll use to access CUI
            </p>
          )}
        </form>
      </div>
    </div>
  );
}