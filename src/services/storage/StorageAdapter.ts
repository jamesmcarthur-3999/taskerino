/**
 * Storage Adapter Interface
 *
 * Provides a unified interface for storage operations across different platforms:
 * - Tauri (Desktop): File system storage with unlimited space
 * - Web Browser: IndexedDB storage with 100s of MB
 */

import type { StorageTransaction } from './types';

export interface StorageInfo {
  used: number;           // Bytes used
  available: number;      // Bytes available (Infinity for file system)
  type: 'filesystem' | 'indexeddb' | 'localStorage';
  breakdown?: {
    [collection: string]: number;
  };
}

export interface BackupInfo {
  id: string;
  timestamp: number;
  size: number;
  collections: string[];
}

export interface MigrationStatus {
  completed: boolean;
  timestamp?: number;
  from?: string;
  to?: string;
  error?: string;
}

/**
 * Transaction for atomic multi-collection operations
 * Ensures all operations succeed or all fail (ACID properties)
 */
export interface Transaction {
  id: string;
  operations: TransactionOperation[];
}

/**
 * Single operation within a transaction
 */
export interface TransactionOperation {
  type: 'write' | 'delete';
  collection: string;
  data?: any;
  entityId?: string;
}

/**
 * Abstract storage adapter interface
 * All storage implementations must implement these methods
 */
export abstract class StorageAdapter {
  /**
   * Initialize the storage system
   * Called once on app startup
   */
  abstract init(): Promise<void>;

  /**
   * Save data to a collection
   * @param collection - Collection name (e.g., 'notes', 'tasks')
   * @param data - Data to save
   */
  abstract save<T>(collection: string, data: T): Promise<void>;

  /**
   * Load data from a collection
   * @param collection - Collection name
   * @returns Data or null if not found
   */
  abstract load<T>(collection: string): Promise<T | null>;

  /**
   * Delete a collection
   * @param collection - Collection name
   */
  abstract delete(collection: string): Promise<void>;

  /**
   * Check if a collection exists
   * @param collection - Collection name
   */
  abstract exists(collection: string): Promise<boolean>;

  /**
   * Get storage usage information
   */
  abstract getStorageInfo(): Promise<StorageInfo>;

  /**
   * Create a backup of all data
   * @returns Backup ID
   */
  abstract createBackup(): Promise<string>;

  /**
   * List all available backups
   */
  abstract listBackups(): Promise<BackupInfo[]>;

  /**
   * Restore data from a backup
   * @param backupId - Backup ID to restore
   */
  abstract restoreBackup(backupId: string): Promise<void>;

  /**
   * Delete a backup
   * @param backupId - Backup ID to delete
   */
  abstract deleteBackup(backupId: string): Promise<void>;

  /**
   * Clear all data (dangerous!)
   */
  abstract clear(): Promise<void>;

  /**
   * Export all data as a downloadable archive
   * @returns Blob containing all data
   */
  abstract exportData(): Promise<Blob>;

  /**
   * Import data from an archive
   * @param data - Archive data (from exportData)
   */
  abstract importData(data: Blob | ArrayBuffer): Promise<void>;

  /**
   * Get the size of a specific collection
   * @param collection - Collection name
   */
  async getCollectionSize(collection: string): Promise<number> {
    try {
      const data = await this.load(collection);
      if (!data) return 0;
      return JSON.stringify(data).length;
    } catch (error) {
      console.error(`Failed to get size of ${collection}:`, error);
      return 0;
    }
  }

  /**
   * Check if the storage adapter is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Gracefully shutdown storage adapter
   * Flushes all pending writes before app closes
   */
  abstract shutdown(): Promise<void>;

  /**
   * Begin a new storage transaction for atomic multi-key operations
   * @returns A new transaction instance
   */
  abstract beginTransaction(): Promise<StorageTransaction>;

  /**
   * Begin a new Phase 2.4 transaction (ACID transaction system)
   * Returns transaction ID for use with addOperation/commitTransaction/rollbackTransaction
   */
  abstract beginPhase24Transaction(): string;

  /**
   * Add an operation to an active Phase 2.4 transaction
   * @param txId - Transaction ID from beginPhase24Transaction
   * @param operation - Operation to add to transaction
   */
  abstract addOperation(txId: string, operation: TransactionOperation): void;

  /**
   * Commit a Phase 2.4 transaction atomically
   * All operations succeed or all fail
   * @param txId - Transaction ID to commit
   */
  abstract commitPhase24Transaction(txId: string): Promise<void>;

  /**
   * Rollback a Phase 2.4 transaction
   * Cancels all queued operations
   * @param txId - Transaction ID to rollback
   */
  abstract rollbackPhase24Transaction(txId: string): Promise<void>;
}

/**
 * Helper function to format bytes into human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  if (bytes === Infinity) return 'Unlimited';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Validate JSON structure
 */
export function validateJSON(json: string): boolean {
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate checksum for data integrity
 */
export async function calculateChecksum(data: string): Promise<string> {
  // Simple hash for data integrity verification
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}
