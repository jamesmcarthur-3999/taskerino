/**
 * Disk Space Service (Fix #4C)
 *
 * Provides disk space checking before storage operations.
 * Prevents silent failures when disk is full.
 *
 * **Usage**:
 * ```typescript
 * import { checkDiskSpace } from './services/diskSpaceService';
 *
 * // Before writing data
 * const data = { large: 'object' };
 * const estimatedSize = JSON.stringify(data).length * 1.2; // 20% overhead
 * await checkDiskSpace(estimatedSize);
 *
 * // Proceed with write
 * await storage.save('key', data);
 * ```
 */

import { invoke } from '@tauri-apps/api/core';
import type { DiskSpaceInfo } from '../types/storage';
import { parseStorageError, StorageFullError } from '../types/storage';
import { safeStringify } from '../utils/serializationUtils';

/**
 * Check if sufficient disk space is available
 *
 * @param requiredBytes Number of bytes required for the operation
 * @throws {StorageFullError} If insufficient disk space
 * @throws {Error} For other filesystem errors
 */
export async function checkDiskSpace(requiredBytes: number): Promise<void> {
  try {
    await invoke('check_storage_space', { requiredBytes });
  } catch (error) {
    const errorStr = error instanceof Error ? error.message : String(error);
    throw parseStorageError(errorStr);
  }
}

/**
 * Get comprehensive disk space information
 *
 * @returns Disk space info (total, available, used)
 */
export async function getDiskSpaceInfo(): Promise<DiskSpaceInfo> {
  return await invoke<DiskSpaceInfo>('get_storage_info');
}

/**
 * Open storage location in system file manager
 *
 * Opens Finder (macOS), Explorer (Windows), or file manager (Linux)
 */
export async function openStorageLocation(): Promise<void> {
  await invoke('open_storage_location');
}

/**
 * Estimate size of data to be written
 *
 * Serializes to JSON and adds 20% overhead for formatting, compression, metadata.
 *
 * @param data Data to estimate
 * @returns Estimated size in bytes
 */
export function estimateDataSize(data: unknown): number {
  try {
    // Use safeStringify to handle cyclic structures
    const json = safeStringify(data, {
      maxDepth: 50,
      removeUndefined: false,
      removeFunctions: true,
      removeSymbols: true,
      detectCircular: true,
      logWarnings: false,
    });
    // Add 20% overhead for formatting, metadata, compression artifacts
    return Math.ceil(json.length * 1.2);
  } catch (error) {
    console.error('Failed to estimate data size:', error);
    // Return a conservative estimate (1 MB)
    return 1024 * 1024;
  }
}

/**
 * Check disk space before write with automatic size estimation
 *
 * Convenience function that estimates data size and checks disk space.
 *
 * @param data Data to write
 * @throws {StorageFullError} If insufficient disk space
 */
export async function checkDiskSpaceForData(data: unknown): Promise<void> {
  const estimatedSize = estimateDataSize(data);
  await checkDiskSpace(estimatedSize);
}

/**
 * Format bytes to human-readable string
 *
 * @param bytes Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
