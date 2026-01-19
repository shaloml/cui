import { useEffect, useState } from 'react';

const AUTH_COOKIE_NAME = 'cui-auth-token';

/**
 * Get auth token from cookie
 */
export function getAuthToken(): string | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === AUTH_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Check auth configuration
 */
export async function checkAuthStatus(): Promise<{ useAccessCode: boolean; needsSetup: boolean }> {
  try {
    const response = await fetch('/api/auth/status');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to check auth status:', error);
  }
  return { useAccessCode: false, needsSetup: true };
}

/**
 * Set up initial access code
 */
export async function setupAccessCode(code: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const response = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, token: data.token };
    } else {
      const data = await response.json();
      return { success: false, error: data.error || 'Setup failed' };
    }
  } catch (error) {
    return { success: false, error: 'Connection error' };
  }
}

/**
 * Verify access code and get auth token
 */
export async function verifyAccessCode(code: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, token: data.token };
    } else {
      const data = await response.json();
      return { success: false, error: data.error || 'Invalid code' };
    }
  } catch (error) {
    return { success: false, error: 'Connection error' };
  }
}

/**
 * Set auth token in cookie with security flags
 */
export function setAuthToken(token: string): void {
  const expires = new Date();
  expires.setDate(expires.getDate() + 7); // 7 days expiration
  
  document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
}

/**
 * Extract token from URL fragment and store in cookie
 * Format: #token=xxxxx
 */
function extractTokenFromFragment(): string | null {
  const fragment = window.location.hash;
  if (!fragment.startsWith('#token=')) {
    return null;
  }
  
  const token = fragment.substring(7); // Remove '#token='
  if (token.length !== 32 || !/^[a-f0-9]+$/.test(token)) {
    console.warn('Invalid token format in URL fragment');
    return null;
  }
  
  return token;
}

/**
 * Clear URL fragment
 */
function clearFragment(): void {
  if (window.history && window.history.replaceState) {
    // Remove fragment without affecting browser history
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } else {
    // Fallback for older browsers
    window.location.hash = '';
  }
}

/**
 * Hook for handling authentication token extraction and storage
 */
export function useAuth(): void {
  useEffect(() => {
    // Check if token exists in URL fragment
    const fragmentToken = extractTokenFromFragment();
    
    if (fragmentToken) {
      // Store token in cookie
      setAuthToken(fragmentToken);
      
      // Clear fragment from URL
      clearFragment();
      
      console.log('Authentication token stored successfully');
    }
  }, []);
}