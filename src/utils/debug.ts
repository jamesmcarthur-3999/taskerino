/**
 * Debug logging utility
 *
 * Enable debug logs by setting localStorage.DEBUG = 'true' in the browser console
 * or by setting VITE_DEBUG=true in your .env file
 */

const isDebugEnabled = (): boolean => {
  // Check environment variable first
  if (import.meta.env.VITE_DEBUG === 'true') return true;

  // Check localStorage (can be toggled at runtime)
  try {
    return localStorage.getItem('DEBUG') === 'true';
  } catch {
    return false;
  }
};

/**
 * Debug logger - only logs when DEBUG mode is enabled
 * Use for verbose/diagnostic logs that aren't needed in production
 */
export const debug = {
  log: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  },

  info: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.info(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDebugEnabled()) {
      console.warn(...args);
    }
  },
};

/**
 * Always log errors - these should never be silenced
 */
export const error = console.error.bind(console);

/**
 * Log important user-facing or critical events
 * These are always shown (not gated by DEBUG flag)
 */
export const info = console.log.bind(console);

/**
 * Helper to enable/disable debug mode at runtime
 */
export const setDebugMode = (enabled: boolean) => {
  localStorage.setItem('DEBUG', enabled.toString());
  console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}. Reload to apply changes.`);
};
