import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { Preferences, Theme, Direction } from '../types';
import { detectBrowserRTL, resolveDirection, applyDirection } from '../hooks/useDirection';

interface PreferencesContextType {
  preferences: Preferences | null;
  theme: Theme;
  direction: Direction;
  updatePreferences: (updates: Partial<Preferences>) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

const THEME_KEY = 'cui-theme';
const DIRECTION_KEY = 'cui-direction';

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getSystemTheme = (): 'light' | 'dark' => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const colorScheme = (stored === 'light' || stored === 'dark' || stored === 'system') ? stored : 'system';
    const mode = colorScheme === 'system' ? getSystemTheme() : colorScheme;
    return { mode, colorScheme, toggle: () => {} };
  });

  const [direction, setDirection] = useState<Direction>(() => {
    const stored = localStorage.getItem(DIRECTION_KEY);
    const setting = (stored === 'ltr' || stored === 'rtl' || stored === 'auto') ? stored : 'auto';
    const dir = resolveDirection(setting);
    return { dir, setting };
  });

  // Load preferences once on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        const config = await api.getConfig();
        setPreferences(config.interface);

        const mode = config.interface.colorScheme === 'system' ? getSystemTheme() : config.interface.colorScheme;
        setTheme(prev => ({ ...prev, colorScheme: config.interface.colorScheme, mode }));

        // Set direction from config
        const directionSetting = config.interface.direction || 'auto';
        const dir = resolveDirection(directionSetting);
        setDirection({ dir, setting: directionSetting });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load preferences'));
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme.mode);
    // Keep Tailwind dark variant in sync
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme.colorScheme);
  }, [theme.mode, theme.colorScheme]);

  // Apply direction to document
  useEffect(() => {
    applyDirection(direction.dir);
    localStorage.setItem(DIRECTION_KEY, direction.setting);
  }, [direction.dir, direction.setting]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme.colorScheme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(prev => ({ ...prev, mode: e.matches ? 'dark' : 'light' }));
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme.colorScheme]);

  const updatePreferences = useCallback(async (updates: Partial<Preferences>) => {
    try {
      const updatedConfig = await api.updateConfig({ interface: updates });
      setPreferences(updatedConfig.interface);

      if (updates.colorScheme) {
        const mode = updates.colorScheme === 'system' ? getSystemTheme() : updates.colorScheme;
        setTheme(prev => ({ ...prev, colorScheme: updates.colorScheme!, mode }));
      }

      if (updates.direction) {
        const dir = resolveDirection(updates.direction);
        setDirection({ dir, setting: updates.direction });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update preferences'));
      throw err;
    }
  }, []);

  const toggle = useCallback(async () => {
    // Cycle through: light -> dark -> system -> light
    let newColorScheme: 'light' | 'dark' | 'system';
    if (theme.colorScheme === 'light') {
      newColorScheme = 'dark';
    } else if (theme.colorScheme === 'dark') {
      newColorScheme = 'system';
    } else {
      newColorScheme = 'light';
    }
    
    await updatePreferences({ colorScheme: newColorScheme });
  }, [theme.colorScheme, updatePreferences]);

  const themeWithToggle: Theme = {
    ...theme,
    toggle
  };

  return (
    <PreferencesContext.Provider value={{
      preferences,
      theme: themeWithToggle,
      direction,
      updatePreferences,
      isLoading,
      error
    }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferencesContext() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferencesContext must be used within a PreferencesProvider');
  }
  return context;
}