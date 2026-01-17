import { usePreferencesContext } from '../contexts/PreferencesContext';
import type { Direction } from '../types';

export function useDirection(): Direction {
  const { direction } = usePreferencesContext();
  return direction;
}

// RTL language codes
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'sd', 'ug'];

/**
 * Detects if the browser language is RTL
 */
export function detectBrowserRTL(): boolean {
  const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || 'en';
  const primaryLang = lang.split('-')[0].toLowerCase();
  return RTL_LANGUAGES.includes(primaryLang);
}

/**
 * Resolves the actual direction based on setting
 */
export function resolveDirection(setting: 'ltr' | 'rtl' | 'auto'): 'ltr' | 'rtl' {
  if (setting === 'auto') {
    return detectBrowserRTL() ? 'rtl' : 'ltr';
  }
  return setting;
}

/**
 * Applies direction to the document
 */
export function applyDirection(dir: 'ltr' | 'rtl'): void {
  document.documentElement.dir = dir;
  document.documentElement.setAttribute('data-direction', dir);
}
