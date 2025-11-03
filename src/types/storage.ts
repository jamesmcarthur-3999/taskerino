/**
 * Storage-related TypeScript types (Fix #4C)
 *
 * Types for disk space checking and storage management.
 */

/**
 * Disk space information returned by get_storage_info Tauri command
 */
export interface DiskSpaceInfo {
  /** Total disk space in bytes */
  total: number;
  /** Available disk space in bytes */
  available: number;
  /** Used disk space in bytes */
  used: number;
  /** Available space in MB (for display) */
  available_mb: number;
  /** Path checked */
  path: string;
}

/**
 * Storage error types
 */
export class StorageFullError extends Error {
  availableMB: number;
  requiredMB: number;
  path: string;

  constructor(availableMB: number, requiredMB: number, path: string) {
    super(
      `Not enough disk space. ${availableMB} MB available, ${requiredMB} MB needed. Please free up space and try again.`
    );
    this.name = 'StorageFullError';
    this.availableMB = availableMB;
    this.requiredMB = requiredMB;
    this.path = path;
  }
}

/**
 * Parse storage error from Rust error string
 */
export function parseStorageError(error: string): Error {
  // Match pattern: "Not enough disk space. X MB available, Y MB needed..."
  const match = error.match(/(\d+)\s*MB available,\s*(\d+)\s*MB needed/);

  if (match) {
    const availableMB = parseInt(match[1], 10);
    const requiredMB = parseInt(match[2], 10);
    return new StorageFullError(availableMB, requiredMB, '');
  }

  return new Error(error);
}
