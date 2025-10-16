/**
 * Production Logger Utility
 *
 * Provides environment-aware logging that can be disabled in production builds.
 * Use this instead of console.log directly for cleaner production output.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * Debug-level logging (only in development)
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Info-level logging (only in development)
   */
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },

  /**
   * Warning-level logging (always shown)
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Error-level logging (always shown)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Group logging (only in development)
   */
  group: (label: string) => {
    if (isDev) {
      console.group(label);
    }
  },

  /**
   * Group end (only in development)
   */
  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  },

  /**
   * Table logging (only in development)
   */
  table: (data: any) => {
    if (isDev) {
      console.table(data);
    }
  },
};

// For backwards compatibility, you can also use these aliases
export const log = logger.debug;
export const logError = logger.error;
export const logWarn = logger.warn;
export const logInfo = logger.info;
