/**
 * Configuration types for CUI
 */
import { RouterConfiguration } from './router-config.js';

export interface ServerConfig {
  host: string;
  port: number;
}

export interface GeminiConfig {
  /**
   * Google API key for Gemini
   * Can also be set via GOOGLE_API_KEY environment variable
   */
  apiKey?: string;
  
  /**
   * Gemini model to use
   * Default: 'gemini-2.5-flash'
   */
  model?: string;
}

/**
 * Permission mode for Claude CLI
 */
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

export interface InterfaceConfig {
  colorScheme: 'light' | 'dark' | 'system';
  language: string;
  direction?: 'ltr' | 'rtl' | 'auto';
  /**
   * Simple access code for authentication (e.g., "8284")
   * If set, users enter this code instead of the full auth token
   */
  accessCode?: string;
  /**
   * VS Code Web URL base (e.g., http://10.10.10.103:9999)
   * Will be used as: {vscodeWebUrl}/?folder={projectPath}
   */
  vscodeWebUrl?: string;
  /**
   * Default permission mode for new conversations
   * - 'default': Ask for permissions as needed
   * - 'acceptEdits': Auto-accept file edits
   * - 'bypassPermissions': Skip all permission prompts (Yolo mode)
   * - 'plan': Planning mode only
   */
  defaultPermissionMode?: PermissionMode;
  notifications?: {
    enabled: boolean;
    ntfyUrl?: string;
    webPush?: {
      subject?: string; // e.g. mailto:you@example.com
      vapidPublicKey?: string;
      vapidPrivateKey?: string;
    };
  };
}

export interface CUIConfig {
  /**
   * Unique machine identifier
   * Format: {hostname}-{16char_hash}
   * Example: "wenbomacbook-a1b2c3d4e5f6g7h8"
   */
  machine_id: string;

  /**
   * Server configuration
   */
  server: ServerConfig;

  /**
   * Authentication token for API access
   * 32-character random string generated on first run
   */
  authToken: string;

  /**
   * Gemini API configuration (optional)
   */
  gemini?: GeminiConfig;

  /**
   * Optional router configuration for Claude Code Router
   */
  router?: RouterConfiguration;

  /**
   * Interface preferences and settings
   */
  interface: InterfaceConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<CUIConfig, 'machine_id' | 'authToken'> = {
  server: {
    host: '0.0.0.0',
    port: 3001
  },
  interface: {
    colorScheme: 'system',
    language: 'en',
    direction: 'auto'
  }
};