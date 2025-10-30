/**
 * Tauri File System Storage Adapter
 *
 * Provides unlimited storage using the native file system via Tauri.
 * Files are stored in the app's data directory.
 */

import { BaseDirectory, exists, readTextFile, writeTextFile, writeFile, readFile, mkdir, remove, readDir } from '@tauri-apps/plugin-fs';
import { StorageAdapter, formatBytes, validateJSON, calculateChecksum } from './StorageAdapter';
import type { StorageInfo, BackupInfo } from './StorageAdapter';
import type { StorageTransaction } from './types';
import JSZip from 'jszip';
import { compressData, decompressData, isCompressed } from './compressionUtils';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import pako from 'pako';
import { checkDiskSpaceForData, estimateDataSize, openStorageLocation } from '../diskSpaceService';
import { StorageFullError } from '@/types/storage';
import { toast } from 'sonner';
import { safeStringify } from '../../utils/serializationUtils';
import { isTauriApp } from './index';

/**
 * Write-Ahead Log Entry
 * Each entry represents an operation that will be applied to storage
 */
interface WALEntry {
  id: string;              // Unique entry ID
  timestamp: number;       // Entry creation time
  operation: 'write' | 'delete' | 'transaction-start' | 'transaction-commit' | 'transaction-rollback';
  collection: string;      // Collection name
  data?: any;              // Data payload
  checksum?: string;       // SHA-256 of data (for integrity verification)
  transactionId?: string;  // Transaction grouping (for Phase 2.4 transactions)
}

/**
 * Write queue with mutex to prevent concurrent storage writes
 */
class WriteQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (operation) {
        await operation();
      }
    }

    this.isProcessing = false;
  }

  /**
   * Wait for all pending writes to complete (graceful shutdown)
   */
  async flush(): Promise<void> {
    const maxWaitTime = 10000; // 10 seconds max
    const startTime = Date.now();

    while (this.queue.length > 0 || this.isProcessing) {
      if (Date.now() - startTime > maxWaitTime) {
        console.error('[WriteQueue] Flush timeout - some writes may be lost');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

/**
 * Tauri File System Transaction Implementation
 *
 * Uses temporary directory staging for atomic writes.
 * All files are written to a temp directory first, then moved atomically.
 */
class TauriFileSystemTransaction implements StorageTransaction {
  private operations: Array<{
    type: 'save' | 'delete';
    key: string;
    value?: any;
    previousValue?: any; // Captured for rollback
  }> = [];

  private committed = false;
  private basePath: string;
  private adapter: TauriFileSystemAdapter;

  constructor(basePath: string, adapter: TauriFileSystemAdapter) {
    this.basePath = basePath;
    this.adapter = adapter;
  }

  /**
   * Queue a save operation
   * Will capture current value during commit for rollback support
   */
  save(key: string, value: any): void {
    if (this.committed) {
      throw new Error('Transaction already committed or rolled back');
    }
    this.operations.push({ type: 'save', key, value });
  }

  /**
   * Queue a delete operation
   * Will capture current value during commit for rollback support
   */
  delete(key: string): void {
    if (this.committed) {
      throw new Error('Transaction already committed or rolled back');
    }
    this.operations.push({ type: 'delete', key });
  }

  /**
   * Execute all operations atomically using temp directory staging
   */
  async commit(): Promise<void> {
    if (this.committed) {
      throw new Error('Transaction already committed or rolled back');
    }

    if (this.operations.length === 0) {
      this.committed = true;
      return; // Nothing to commit
    }

    // Step 0: Estimate total size and check disk space BEFORE starting transaction
    try {
      const totalSize = this.operations.reduce((sum, op) => {
        if (op.type === 'save' && op.value) {
          return sum + estimateDataSize(op.value);
        }
        return sum;
      }, 0);

      // Check disk space for entire transaction
      await checkDiskSpaceForData({ size: totalSize });

    } catch (error) {
      if (error instanceof StorageFullError) {
        // Transaction failed due to storage full
        toast.error('Storage Full - Transaction Failed', {
          description: `${error.message} No data was saved to prevent corruption.`,
          duration: Infinity, // Don't auto-dismiss
          action: {
            label: 'Free Space',
            onClick: async () => {
              await openStorageLocation();
            },
          },
        });
      }
      // Don't proceed with transaction - throw immediately
      throw error;
    }

    // Step 1: Capture previous values for rollback
    await this.capturePreviousValues();

    // Create temp directory for staging
    // NOTE: Changed from `.tx-` to `tx-temp-` prefix to avoid Tauri FS plugin security restrictions
    // Tauri blocks paths starting with "." for security (hidden file protection)
    const tempDir = `${this.basePath}/tx-temp-${Date.now()}`;

    // Track files written to final locations for rollback
    const writtenFiles: string[] = [];

    try {
      // Create temp directory
      await mkdir(tempDir, { baseDir: BaseDirectory.AppData, recursive: true });

      // Step 2: Prepare and write all changes to temp directory first
      for (const op of this.operations) {
        if (op.type === 'save') {
          const tempPath = `${tempDir}/${op.key}.json`;

          // Prepare data (compress, serialize)
          // Preserve optional fields for session/attachment data (critical for hash, attachmentId, path, etc.)
          const isSessionOrAttachment = op.key.includes('sessions/') || op.key.includes('session-') ||
                                       op.key.includes('attachments-ca/') || op.key.includes('attachment');
          const jsonData = safeStringify(op.value, {
            maxDepth: 50,
            removeUndefined: !isSessionOrAttachment, // Keep undefined fields in sessions/attachments
            removeFunctions: true,
            removeSymbols: true,
            detectCircular: true,
            logWarnings: false,
          });
          const checksum = await calculateChecksum(jsonData);

          let compressedData: string;
          let compressionFailed = false;
          try {
            compressedData = await compressData(jsonData);
          } catch (compressionError) {
            console.warn(`⚠️  Compression failed for ${op.key}, storing uncompressed:`, compressionError);
            compressedData = jsonData;
            compressionFailed = true;
          }

          const dataWithMeta = {
            version: 1,
            checksum,
            timestamp: Date.now(),
            compressed: !compressionFailed,
            data: compressedData
          };

          const finalData = JSON.stringify(dataWithMeta, null, 2);

          // Create parent directory in temp location if needed (for nested paths like sessions/{id}/screenshots/chunk-000)
          const tempParentDir = tempPath.substring(0, tempPath.lastIndexOf('/'));
          if (tempParentDir && tempParentDir !== tempDir) {
            await mkdir(tempParentDir, { baseDir: BaseDirectory.AppData, recursive: true });
          }

          // Write to temp location
          await writeTextFile(tempPath, finalData, {
            baseDir: BaseDirectory.AppData
          });
        }
      }

      // All writes to temp succeeded, now move to final locations atomically
      for (const op of this.operations) {
        const finalPath = `${this.basePath}/${op.key}.json`;

        if (op.type === 'save') {
          const tempPath = `${tempDir}/${op.key}.json`;

          // Read from temp
          const content = await readTextFile(tempPath, {
            baseDir: BaseDirectory.AppData
          });

          // Create backup if file exists (using the same backup logic as save())
          if (await exists(finalPath, { baseDir: BaseDirectory.AppData })) {
            try {
              const existingContent = await readTextFile(finalPath, {
                baseDir: BaseDirectory.AppData
              });

              const timestamp = Date.now();
              const backupPath = `${this.basePath}/${op.key}.${timestamp}.backup.json`;

              await writeTextFile(backupPath, existingContent, {
                baseDir: BaseDirectory.AppData
              });

              // Verify backup
              const verifyContent = await readTextFile(backupPath, {
                baseDir: BaseDirectory.AppData
              });

              if (verifyContent !== existingContent) {
                throw new Error(`Backup verification failed for ${op.key}`);
              }
            } catch (backupError) {
              throw new Error(`CRITICAL: Backup failed for ${op.key}: ${backupError instanceof Error ? backupError.message : String(backupError)}`);
            }
          }

          // Create parent directory if it doesn't exist
          const parentDir = finalPath.substring(0, finalPath.lastIndexOf('/'));
          if (parentDir) {
            await mkdir(parentDir, { baseDir: BaseDirectory.AppData, recursive: true });
          }

          // Write to final location
          await writeTextFile(finalPath, content, {
            baseDir: BaseDirectory.AppData
          });

          // Track written file for potential rollback
          writtenFiles.push(finalPath);

        } else if (op.type === 'delete') {
          // Delete operation
          if (await exists(finalPath, { baseDir: BaseDirectory.AppData })) {
            await remove(finalPath, { baseDir: BaseDirectory.AppData });
            // Track deleted file for potential rollback
            writtenFiles.push(finalPath);
          }
        }
      }

      // Clean up temp directory
      try {
        await remove(tempDir, { baseDir: BaseDirectory.AppData, recursive: true });
      } catch (cleanupError) {
        // Log but don't fail - transaction succeeded
        console.warn('Failed to clean up temp directory:', cleanupError);
      }

      console.log(`💾 Transaction committed: ${this.operations.length} operations`);

      // Mark as committed after successful execution
      this.committed = true;

    } catch (error) {
      // Rollback on error
      try {
        await remove(tempDir, { baseDir: BaseDirectory.AppData, recursive: true });
      } catch (cleanupError) {
        console.warn('Failed to clean up temp directory after error:', cleanupError);
      }

      await this.rollback();
      throw error;
    }
  }

  /**
   * Capture previous values for all operations (for rollback)
   */
  private async capturePreviousValues(): Promise<void> {
    for (const op of this.operations) {
      const filePath = `${this.basePath}/${op.key}.json`;

      try {
        const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
        if (fileExists) {
          const content = await readTextFile(filePath, {
            baseDir: BaseDirectory.AppData
          });

          // Parse to get the actual data
          const parsed = JSON.parse(content);
          op.previousValue = parsed; // Store entire record with metadata
        }
      } catch (error) {
        console.warn(`Failed to capture previous value for ${op.key}:`, error);
        // Continue anyway - rollback will still work for other operations
      }
    }
  }

  /**
   * Rollback the transaction
   * Restores previous state by reverting all operations
   */
  async rollback(): Promise<void> {
    if (this.committed) {
      return; // Already committed, can't rollback
    }

    this.committed = true;

    // If no previous values captured, just clear the queue
    const hasPreviousValues = this.operations.some(op => op.previousValue !== undefined);
    if (!hasPreviousValues) {
      this.operations = [];
      console.log('🔄 Transaction rolled back (no state to restore)');
      return;
    }

    // Restore previous state
    for (const op of this.operations) {
      const filePath = `${this.basePath}/${op.key}.json`;

      try {
        if (op.previousValue) {
          // Restore previous value
          const restoredData = JSON.stringify(op.previousValue, null, 2);
          await writeTextFile(filePath, restoredData, {
            baseDir: BaseDirectory.AppData
          });
        } else if (op.type === 'save') {
          // Was a new save with no previous value - delete it
          const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
          if (fileExists) {
            await remove(filePath, { baseDir: BaseDirectory.AppData });
          }
        }
        // For deletes with no previous value, nothing to restore
      } catch (error) {
        console.error(`Failed to rollback operation for ${op.key}:`, error);
        // Continue with other operations
      }
    }

    console.log(`🔄 Transaction rolled back: ${this.operations.length} operations reverted`);
    this.operations = [];
  }

  /**
   * Get number of pending operations
   */
  getPendingOperations(): number {
    return this.operations.length;
  }
}

export class TauriFileSystemAdapter extends StorageAdapter {
  private readonly DB_DIR = 'db';
  private readonly BACKUP_DIR = 'backups';
  private readonly WAL_PATH = 'db/wal.log';
  private readonly CHECKPOINT_PATH = 'db/wal.checkpoint';
  private initialized = false;
  private writeQueue = new WriteQueue();
  private writesSinceCheckpoint: number = 0;
  private phase24Transactions = new Map<string, import('./StorageAdapter').Transaction>();

  /**
   * Initialize the storage system
   * Creates necessary directories
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Create db directory
      if (!await exists(this.DB_DIR, { baseDir: BaseDirectory.AppData })) {
        await mkdir(this.DB_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
        console.log('📁 Created db directory');
      }

      // Create backups directory
      if (!await exists(this.BACKUP_DIR, { baseDir: BaseDirectory.AppData })) {
        await mkdir(this.BACKUP_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
        console.log('📁 Created backups directory');
      }

      // Clean up orphaned temp directories from previous sessions
      try {
        const entries = await readDir(this.DB_DIR, { baseDir: BaseDirectory.AppData });
        for (const entry of entries) {
          if (entry.name?.startsWith('tx-temp-') && entry.isDirectory) {
            await remove(`${this.DB_DIR}/${entry.name}`, {
              baseDir: BaseDirectory.AppData,
              recursive: true
            });
            console.log(`🧹 Cleaned up orphaned temp directory: ${entry.name}`);
          }
        }
      } catch (cleanupError) {
        // Don't fail initialization if cleanup fails
        console.warn('Failed to cleanup orphaned temp directories:', cleanupError);
      }

      this.initialized = true;
      console.log('✅ TauriFileSystemAdapter initialized');
    } catch (error) {
      console.error('❌ Failed to initialize TauriFileSystemAdapter:', error);
      throw new Error(`Storage initialization failed: ${error}`);
    }
  }

  /**
   * Save data immediately without queuing (for critical shutdown data)
   * WARNING: Bypasses write queue - use only for critical metadata that must persist immediately
   *
   * @param collection - Collection name
   * @param data - Data to save
   * @param skipBackup - Skip backup creation (use for session-index to avoid circular backup)
   */
  async saveImmediate<T>(collection: string, data: T, skipBackup: boolean = false): Promise<void> {
    const startTime = Date.now();
    console.log(`[TauriFS] SAVE IMMEDIATE START: ${collection}`);
    await this.ensureInitialized();

    try {
      // Check disk space BEFORE starting write operation
      try {
        await checkDiskSpaceForData(data);
      } catch (error) {
        if (error instanceof StorageFullError) {
          // Show user-friendly error with action button
          toast.error('Storage Full', {
            description: error.message,
            duration: Infinity, // Don't auto-dismiss storage errors
            action: {
              label: 'Free Space',
              onClick: async () => {
                await openStorageLocation();
              },
            },
          });
        }
        throw error; // Re-throw so caller knows write failed
      }

      // Preserve optional fields for session/attachment data (critical for hash, attachmentId, path, etc.)
      const isSessionOrAttachment = collection.includes('sessions/') || collection.includes('session-') ||
                                   collection.includes('attachments-ca/') || collection.includes('attachment');
      const jsonData = safeStringify(data, {
        maxDepth: 50,
        removeUndefined: !isSessionOrAttachment, // Keep undefined fields in sessions/attachments
        removeFunctions: true,
        removeSymbols: true,
        detectCircular: true,
        logWarnings: false,
      });
      const path = `${this.DB_DIR}/${collection}.json`;
      const tempPath = `${this.DB_DIR}/${collection}.tmp.json`;

      // Calculate checksum for integrity
      const checksum = await calculateChecksum(jsonData);

      // 1. WRITE TO WAL FIRST (Write-Ahead Logging)
      const walEntry: WALEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: Date.now(),
        operation: 'write',
        collection,
        data,
        checksum,
      };
      await this.appendToWAL(walEntry);

      // Compress the JSON data
      let compressedData: string;
      let compressionFailed = false;
      try {
        compressedData = await compressData(jsonData);
      } catch (compressionError) {
        console.warn(`⚠️  Compression failed for ${collection}, storing uncompressed:`, compressionError);
        compressedData = jsonData;
        compressionFailed = true;
      }

      // Add metadata
      const dataWithMeta = {
        version: 1,
        checksum,
        timestamp: Date.now(),
        compressed: !compressionFailed,
        data: compressedData
      };

      const finalData = JSON.stringify(dataWithMeta, null, 2);

      // Ensure parent directory exists before writing
      const parentDir = tempPath.substring(0, tempPath.lastIndexOf('/'));
      if (parentDir && parentDir !== this.DB_DIR) {
        await mkdir(parentDir, { baseDir: BaseDirectory.AppData, recursive: true });
      }

      // Write to temporary file first (atomic operation)
      await writeTextFile(tempPath, finalData, {
        baseDir: BaseDirectory.AppData
      });

      // If existing file exists, create a timestamped backup (skip for session-index to avoid circular backups)
      if (!skipBackup && await exists(path, { baseDir: BaseDirectory.AppData })) {
        try {
          // Read existing file
          const existingContent = await readTextFile(path, {
            baseDir: BaseDirectory.AppData
          });

          // Create timestamped backup filename
          const timestamp = Date.now();
          const timestampedBackupPath = `${this.DB_DIR}/${collection}.${timestamp}.backup.json`;

          // Write to timestamped backup
          await writeTextFile(timestampedBackupPath, existingContent, {
            baseDir: BaseDirectory.AppData
          });

          // Verify backup by reading it back and comparing
          const verifyContent = await readTextFile(timestampedBackupPath, {
            baseDir: BaseDirectory.AppData
          });

          if (verifyContent !== existingContent) {
            throw new Error(`Backup verification failed for ${collection}: content mismatch after write`);
          }

          console.log(`✓ [IMMEDIATE] Backup created: ${collection}.${timestamp}.backup.json`);

          // Rotate old backups (keep last 10) - non-critical, failures are logged but don't halt
          await this.rotateBackups(collection, 10);
        } catch (error) {
          // CRITICAL: Backup failure must halt the save operation
          throw new Error(`CRITICAL: Backup failed for ${collection}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Read back temp file to verify
      const writtenContent = await readTextFile(tempPath, {
        baseDir: BaseDirectory.AppData
      });

      if (!validateJSON(writtenContent)) {
        throw new Error('Written data is not valid JSON');
      }

      // Move temp file to actual file (atomic on most systems)
      await writeTextFile(path, writtenContent, {
        baseDir: BaseDirectory.AppData
      });

      // Clean up temp file
      try {
        await remove(tempPath, { baseDir: BaseDirectory.AppData });
      } catch {
        // Ignore cleanup errors
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [TauriFS] SAVE IMMEDIATE COMPLETE: ${collection} (${duration}ms, ${formatBytes(writtenContent.length)})`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [TauriFS] SAVE IMMEDIATE FAILED: ${collection} (${duration}ms):`, error);
      throw new Error(`Failed to save ${collection} immediately: ${error}`);
    }
  }

  /**
   * Save data to a collection using atomic writes
   */
  async save<T>(collection: string, data: T): Promise<void> {
    const startTime = Date.now();
    console.log(`[TauriFS] SAVE START: ${collection}`);
    await this.ensureInitialized();

    return this.writeQueue.enqueue(async () => {
      try {
        // Check disk space BEFORE starting write operation
        try {
          await checkDiskSpaceForData(data);
        } catch (error) {
          if (error instanceof StorageFullError) {
            // Show user-friendly error with action button
            toast.error('Storage Full', {
              description: error.message,
              duration: Infinity, // Don't auto-dismiss storage errors
              action: {
                label: 'Free Space',
                onClick: async () => {
                  await openStorageLocation();
                },
              },
            });
          }
          throw error; // Re-throw so caller knows write failed
        }

        // Preserve optional fields for session/attachment data (critical for hash, attachmentId, path, etc.)
        const isSessionOrAttachment = collection.includes('sessions/') || collection.includes('session-') ||
                                     collection.includes('attachments-ca/') || collection.includes('attachment');
        const jsonData = safeStringify(data, {
          maxDepth: 50,
          removeUndefined: !isSessionOrAttachment, // Keep undefined fields in sessions/attachments
          removeFunctions: true,
          removeSymbols: true,
          detectCircular: true,
          logWarnings: false,
        });
        const path = `${this.DB_DIR}/${collection}.json`;
        const tempPath = `${this.DB_DIR}/${collection}.tmp.json`;
        const backupPath = `${this.DB_DIR}/${collection}.backup.json`;

        // Calculate checksum for integrity
        const checksum = await calculateChecksum(jsonData);

        // 1. WRITE TO WAL FIRST (Write-Ahead Logging)
        const walEntry: WALEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          timestamp: Date.now(),
          operation: 'write',
          collection,
          data,
          checksum,
        };
        await this.appendToWAL(walEntry);

        // Compress the JSON data
        let compressedData: string;
        let compressionFailed = false;
        try {
          compressedData = await compressData(jsonData);
        } catch (compressionError) {
          console.warn(`⚠️  Compression failed for ${collection}, storing uncompressed:`, compressionError);
          compressedData = jsonData;
          compressionFailed = true;
        }

        // Add metadata
        const dataWithMeta = {
          version: 1,
          checksum,
          timestamp: Date.now(),
          compressed: !compressionFailed,
          data: compressedData
        };

        const finalData = JSON.stringify(dataWithMeta, null, 2);

        // Ensure parent directory exists before writing
        const parentDir = tempPath.substring(0, tempPath.lastIndexOf('/'));
        if (parentDir && parentDir !== this.DB_DIR) {
          await mkdir(parentDir, { baseDir: BaseDirectory.AppData, recursive: true });
        }

        // Write to temporary file first (atomic operation)
        await writeTextFile(tempPath, finalData, {
          baseDir: BaseDirectory.AppData
        });

        // If existing file exists, create a timestamped backup (MANDATORY - DO NOT CONTINUE ON FAILURE)
        if (await exists(path, { baseDir: BaseDirectory.AppData })) {
          try {
            // Read existing file
            const existingContent = await readTextFile(path, {
              baseDir: BaseDirectory.AppData
            });

            // Create timestamped backup filename
            const timestamp = Date.now();
            const timestampedBackupPath = `${this.DB_DIR}/${collection}.${timestamp}.backup.json`;

            // Write to timestamped backup
            await writeTextFile(timestampedBackupPath, existingContent, {
              baseDir: BaseDirectory.AppData
            });

            // Verify backup by reading it back and comparing
            const verifyContent = await readTextFile(timestampedBackupPath, {
              baseDir: BaseDirectory.AppData
            });

            if (verifyContent !== existingContent) {
              throw new Error(`Backup verification failed for ${collection}: content mismatch after write`);
            }

            console.log(`✓ Backup created and verified: ${collection}.${timestamp}.backup.json`);

            // Rotate old backups (keep last 10) - non-critical, failures are logged but don't halt
            await this.rotateBackups(collection, 10);

          } catch (error) {
            // CRITICAL: Backup failure must halt the save operation
            throw new Error(`CRITICAL: Backup failed for ${collection}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        // Read back temp file to verify
        const writtenContent = await readTextFile(tempPath, {
          baseDir: BaseDirectory.AppData
        });

        if (!validateJSON(writtenContent)) {
          throw new Error('Written data is not valid JSON');
        }

        // Move temp file to actual file (atomic on most systems)
        // Since Tauri doesn't have rename, we'll use copy + delete
        await writeTextFile(path, writtenContent, {
          baseDir: BaseDirectory.AppData
        });

        // Clean up temp file
        try {
          await remove(tempPath, { baseDir: BaseDirectory.AppData });
        } catch {
          // Ignore cleanup errors
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [TauriFS] SAVE COMPLETE: ${collection} (${duration}ms, ${formatBytes(writtenContent.length)})`);

        // 4. Checkpoint periodically (every 100 writes)
        this.writesSinceCheckpoint++;
        if (this.writesSinceCheckpoint >= 100) {
          await this.checkpoint();
          this.writesSinceCheckpoint = 0;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ [TauriFS] SAVE FAILED: ${collection} (${duration}ms):`, error);
        throw new Error(`Failed to save ${collection}: ${error}`);
      }
    });
  }

  async shutdown(): Promise<void> {
    console.log('[Storage] Flushing pending writes before shutdown...');
    await this.writeQueue.flush();
    console.log('[Storage] Shutdown complete');
  }

  /**
   * Load data from a collection with automatic recovery
   */
  async load<T>(collection: string): Promise<T | null> {
    await this.ensureInitialized();

    const path = `${this.DB_DIR}/${collection}.json`;

    try {
      if (!await exists(path, { baseDir: BaseDirectory.AppData })) {
        console.log(`ℹ️  Collection ${collection} does not exist`);
        return null;
      }

      const content = await readTextFile(path, {
        baseDir: BaseDirectory.AppData
      });

      // Validate JSON
      if (!validateJSON(content)) {
        console.error(`❌ Invalid JSON in ${collection}, attempting recovery...`);
        return await this.loadFromBackup(collection);
      }

      const parsed = JSON.parse(content);

      // Check if it has metadata wrapper
      if (parsed.version && parsed.data !== undefined) {
        let actualData = parsed.data;

        // Check if data is compressed
        if (typeof actualData === 'string' && isCompressed(actualData)) {
          console.log(`📦 Decompressing ${collection}...`);
          try {
            const decompressed = await decompressData(actualData);
            actualData = JSON.parse(decompressed);
          } catch (decompressionError) {
            console.error(`Failed to decompress ${collection}:`, decompressionError);
            return await this.loadFromBackup(collection);
          }
        } else if (typeof actualData === 'string') {
          // Uncompressed JSON string - parse it
          try {
            actualData = JSON.parse(actualData);
          } catch (parseError) {
            console.error(`Failed to parse ${collection}:`, parseError);
            return await this.loadFromBackup(collection);
          }
        }

        // Verify checksum if present
        if (parsed.checksum && !parsed.compressed) {
          // Only verify checksum for uncompressed data
          const dataStr = JSON.stringify(actualData, null, 2);
          const checksum = await calculateChecksum(dataStr);

          if (checksum !== parsed.checksum) {
            console.warn(`⚠️  Checksum mismatch for ${collection}, attempting recovery...`);
            return await this.loadFromBackup(collection);
          }
        }

        return actualData as T;
      }

      // Old format without metadata wrapper
      return parsed as T;
    } catch (error) {
      console.error(`❌ Failed to load ${collection}:`, error);

      // Try to recover from backup
      return await this.loadFromBackup(collection);
    }
  }

  /**
   * Load from backup file if main file is corrupted
   */
  private async loadFromBackup<T>(collection: string): Promise<T | null> {
    const backupPath = `${this.DB_DIR}/${collection}.backup.json`;

    try {
      if (!await exists(backupPath, { baseDir: BaseDirectory.AppData })) {
        console.error(`❌ No backup found for ${collection}`);
        return null;
      }

      console.log(`🔄 Recovering ${collection} from backup...`);

      const content = await readTextFile(backupPath, {
        baseDir: BaseDirectory.AppData
      });

      if (!validateJSON(content)) {
        console.error(`❌ Backup is also corrupted for ${collection}`);
        return null;
      }

      const parsed = JSON.parse(content);

      // Restore the backup as the main file
      await writeTextFile(`${this.DB_DIR}/${collection}.json`, content, {
        baseDir: BaseDirectory.AppData
      });

      console.log(`✅ Recovered ${collection} from backup`);

      // Return data (handle both old and new format)
      if (parsed.version && parsed.data !== undefined) {
        let actualData = parsed.data;

        // Check if backup data is compressed
        if (typeof actualData === 'string' && isCompressed(actualData)) {
          try {
            const decompressed = await decompressData(actualData);
            actualData = JSON.parse(decompressed);
          } catch (decompressionError) {
            console.error(`Failed to decompress backup for ${collection}:`, decompressionError);
            return null;
          }
        }

        return actualData as T;
      }
      return parsed as T;
    } catch (error) {
      console.error(`❌ Failed to recover ${collection} from backup:`, error);
      return null;
    }
  }

  /**
   * Delete a collection
   */
  async delete(collection: string): Promise<void> {
    await this.ensureInitialized();

    const path = `${this.DB_DIR}/${collection}.json`;
    const backupPath = `${this.DB_DIR}/${collection}.backup.json`;

    try {
      if (await exists(path, { baseDir: BaseDirectory.AppData })) {
        await remove(path, { baseDir: BaseDirectory.AppData });
      }

      if (await exists(backupPath, { baseDir: BaseDirectory.AppData })) {
        await remove(backupPath, { baseDir: BaseDirectory.AppData });
      }

      console.log(`🗑️  Deleted ${collection}`);
    } catch (error) {
      console.error(`❌ Failed to delete ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Check if a collection exists
   */
  async exists(collection: string): Promise<boolean> {
    await this.ensureInitialized();

    const path = `${this.DB_DIR}/${collection}.json`;
    return await exists(path, { baseDir: BaseDirectory.AppData });
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    await this.ensureInitialized();

    try {
      let totalSize = 0;
      const breakdown: { [key: string]: number } = {};

      // Read all files in db directory
      const entries = await readDir(this.DB_DIR, {
        baseDir: BaseDirectory.AppData
      });

      for (const entry of entries) {
        if (entry.name?.endsWith('.json') && !entry.name.includes('.backup') && !entry.name.includes('.tmp')) {
          const path = `${this.DB_DIR}/${entry.name}`;
          try {
            const content = await readTextFile(path, {
              baseDir: BaseDirectory.AppData
            });
            const size = content.length;
            totalSize += size;

            const collection = entry.name.replace('.json', '');
            breakdown[collection] = size;
          } catch (error) {
            console.warn(`Failed to read ${entry.name}:`, error);
          }
        }
      }

      return {
        used: totalSize,
        available: Infinity,
        type: 'filesystem',
        breakdown
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {
        used: 0,
        available: Infinity,
        type: 'filesystem'
      };
    }
  }

  /**
   * Create a backup of all data
   */
  async createBackup(): Promise<string> {
    await this.ensureInitialized();

    const backupId = `backup-${Date.now()}`;
    const backupPath = `${this.BACKUP_DIR}/${backupId}.json`;

    try {
      // Read all collections
      const entries = await readDir(this.DB_DIR, {
        baseDir: BaseDirectory.AppData
      });

      const backup: any = {
        version: 1,
        timestamp: Date.now(),
        collections: {}
      };

      for (const entry of entries) {
        if (entry.name?.endsWith('.json') && !entry.name.includes('.backup') && !entry.name.includes('.tmp')) {
          const collection = entry.name.replace('.json', '');
          const data = await this.load(collection);
          if (data !== null) {
            backup.collections[collection] = data;
          }
        }
      }

      // Save backup
      await writeTextFile(backupPath, JSON.stringify(backup, null, 2), {
        baseDir: BaseDirectory.AppData
      });

      console.log(`📦 Created backup: ${backupId}`);

      // Cleanup old backups (keep last 7)
      await this.cleanupOldBackups(7);

      return backupId;
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupInfo[]> {
    await this.ensureInitialized();

    try {
      const entries = await readDir(this.BACKUP_DIR, {
        baseDir: BaseDirectory.AppData
      });

      const backups: BackupInfo[] = [];

      for (const entry of entries) {
        if (entry.name?.endsWith('.json')) {
          const path = `${this.BACKUP_DIR}/${entry.name}`;
          const content = await readTextFile(path, {
            baseDir: BaseDirectory.AppData
          });

          const parsed = JSON.parse(content);

          backups.push({
            id: entry.name.replace('.json', ''),
            timestamp: parsed.timestamp || 0,
            size: content.length,
            collections: Object.keys(parsed.collections || {})
          });
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp - a.timestamp);

      return backups;
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Restore data from a backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    await this.ensureInitialized();

    const backupPath = `${this.BACKUP_DIR}/${backupId}.json`;

    try {
      if (!await exists(backupPath, { baseDir: BaseDirectory.AppData })) {
        throw new Error(`Backup ${backupId} not found`);
      }

      const content = await readTextFile(backupPath, {
        baseDir: BaseDirectory.AppData
      });

      const backup = JSON.parse(content);

      if (!backup.collections) {
        throw new Error('Invalid backup format');
      }

      // Restore each collection
      for (const [collection, data] of Object.entries(backup.collections)) {
        await this.save(collection, data);
      }

      console.log(`✅ Restored from backup: ${backupId}`);
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw error;
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    await this.ensureInitialized();

    const backupPath = `${this.BACKUP_DIR}/${backupId}.json`;

    try {
      // Try to check if file exists, but don't throw if it doesn't
      let fileExists = false;
      try {
        fileExists = await exists(backupPath, { baseDir: BaseDirectory.AppData });
      } catch (existsError) {
        // File doesn't exist or can't check - that's fine, nothing to delete
        return;
      }

      if (fileExists) {
        await remove(backupPath, { baseDir: BaseDirectory.AppData });
        console.log(`🗑️  Deleted backup: ${backupId}`);
      }
    } catch (error) {
      // Only log as warning if it's a "file not found" error
      if (error && typeof error === 'object' && 'message' in error &&
          (error.message as string).includes('No such file or directory')) {
        console.warn(`⚠️  Backup already deleted: ${backupId}`);
        return; // Don't throw for missing files
      }
      console.error('Failed to delete backup:', error);
      throw error;
    }
  }

  /**
   * Clear all data (dangerous!)
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    try {
      // Create a final backup before clearing
      await this.createBackup();

      // Delete all JSON files in db directory
      const entries = await readDir(this.DB_DIR, {
        baseDir: BaseDirectory.AppData
      });

      for (const entry of entries) {
        if (entry.name?.endsWith('.json')) {
          const path = `${this.DB_DIR}/${entry.name}`;
          await remove(path, { baseDir: BaseDirectory.AppData });
        }
      }

      console.log('🗑️  Cleared all data');
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }

  /**
   * Export all data as a downloadable archive
   */
  async exportData(): Promise<Blob> {
    await this.ensureInitialized();

    try {
      const zip = new JSZip();

      // Read all collections
      const entries = await readDir(this.DB_DIR, {
        baseDir: BaseDirectory.AppData
      });

      for (const entry of entries) {
        if (entry.name?.endsWith('.json') && !entry.name.includes('.backup') && !entry.name.includes('.tmp')) {
          const path = `${this.DB_DIR}/${entry.name}`;
          const content = await readTextFile(path, {
            baseDir: BaseDirectory.AppData
          });

          zip.file(entry.name, content);
        }
      }

      // Add metadata
      zip.file('export-metadata.json', JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        source: 'tauri-filesystem'
      }, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      console.log('📤 Exported data as ZIP');

      return blob;
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  /**
   * Import data from an archive
   */
  async importData(data: Blob | ArrayBuffer): Promise<void> {
    await this.ensureInitialized();

    try {
      // Create backup before import
      await this.createBackup();

      // Load ZIP
      const zip = await JSZip.loadAsync(data);

      // Import each file
      const files = Object.keys(zip.files);
      for (const filename of files) {
        if (filename.endsWith('.json') && filename !== 'export-metadata.json') {
          const content = await zip.file(filename)?.async('string');
          if (content) {
            const collection = filename.replace('.json', '');
            const parsedData = JSON.parse(content);

            // Handle both old and new format
            const actualData = parsedData.data !== undefined ? parsedData.data : parsedData;

            await this.save(collection, actualData);
          }
        }
      }

      console.log('📥 Imported data from ZIP');
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  /**
   * Check if the storage adapter is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if we're in a Tauri environment (using shared detection function)
      if (!isTauriApp()) {
        console.log('[TauriFS] Not in Tauri environment (isTauriApp() returned false)');
        return false;
      }

      // Try to access the file system
      console.log('[TauriFS] In Tauri environment, attempting init()...');
      await this.init();
      console.log('[TauriFS] ✅ Init successful!');
      return true;
    } catch (error) {
      console.error('[TauriFS] ❌ Init failed:', error);
      console.error('[TauriFS] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  /**
   * Cleanup old backups, keeping only the specified number
   */
  private async cleanupOldBackups(keepCount: number): Promise<void> {
    try {
      const backups = await this.listBackups();

      if (backups.length <= keepCount) {
        return;
      }

      // Delete oldest backups
      const toDelete = backups.slice(keepCount);

      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }

      console.log(`🧹 Cleaned up ${toDelete.length} old backups`);
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
      // Non-critical, continue
    }
  }

  /**
   * Rotate old backups, keeping only the most recent ones
   * @param collection - Collection name to rotate backups for
   * @param keepCount - Number of most recent backups to keep (default: 10)
   */
  private async rotateBackups(collection: string, keepCount: number = 10): Promise<void> {
    try {
      // List all files in the db directory
      const entries = await readDir(this.DB_DIR, { baseDir: BaseDirectory.AppData });

      // Filter to find backup files for this specific collection
      // Format: {collection}.{timestamp}.backup.json
      const backupFiles = entries
        .filter(e => {
          const name = e.name || '';
          return name.startsWith(`${collection}.`) && name.endsWith('.backup.json');
        })
        .map(e => {
          const name = e.name || '';
          // Extract timestamp from filename: collection.{timestamp}.backup.json
          const parts = name.split('.');
          const timestamp = parts.length >= 3 ? parseInt(parts[parts.length - 3]) : 0;
          return {
            name,
            timestamp: isNaN(timestamp) ? 0 : timestamp
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp); // Sort newest first

      // Delete backups beyond the keepCount threshold
      if (backupFiles.length > keepCount) {
        const toDelete = backupFiles.slice(keepCount);

        for (const backup of toDelete) {
          const backupPath = `${this.DB_DIR}/${backup.name}`;
          try {
            await remove(backupPath, { baseDir: BaseDirectory.AppData });
            console.log(`🗑️  Deleted old backup: ${backup.name}`);
          } catch (deleteError) {
            console.warn(`Failed to delete old backup ${backup.name}:`, deleteError);
            // Continue with other deletions even if one fails
          }
        }

        console.log(`✓ Backup rotation complete for ${collection}: kept ${keepCount} most recent, deleted ${toDelete.length} old backups`);
      }
    } catch (error) {
      // Rotation is not critical - log warning but don't throw
      // This allows the save operation to complete even if rotation fails
      console.warn(`Failed to rotate backups for ${collection}:`, error);
    }
  }

  /**
   * Append entry to WAL (Write-Ahead Log)
   * WAL entries are written before actual file operations for crash recovery
   */
  private async appendToWAL(entry: WALEntry): Promise<void> {
    // Use safeStringify to handle cyclic structures in WAL data
    const line = safeStringify(entry, {
      maxDepth: 50,
      removeUndefined: false,
      removeFunctions: true,
      removeSymbols: true,
      detectCircular: true,
      logWarnings: false,
    }) + '\n';

    try {
      // Check if WAL file exists
      const walExists = await exists(this.WAL_PATH, { baseDir: BaseDirectory.AppData });

      if (walExists) {
        // Append to existing WAL
        const existingWAL = await readTextFile(this.WAL_PATH, { baseDir: BaseDirectory.AppData });
        await writeTextFile(this.WAL_PATH, existingWAL + line, { baseDir: BaseDirectory.AppData });
      } else {
        // Create new WAL file
        await writeTextFile(this.WAL_PATH, line, { baseDir: BaseDirectory.AppData });
      }

      console.log(`[WAL] Appended: ${entry.operation} ${entry.collection}`);
    } catch (error) {
      throw new Error(`WAL append failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Recover from WAL on startup
   * Replays uncommitted operations after a crash
   */
  async recoverFromWAL(): Promise<void> {
    try {
      const walExists = await exists(this.WAL_PATH, { baseDir: BaseDirectory.AppData });
      if (!walExists) {
        console.log('[WAL] No WAL file found, skipping recovery');
        return;
      }

      const walContent = await readTextFile(this.WAL_PATH, { baseDir: BaseDirectory.AppData });
      const lines = walContent.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        console.log('[WAL] WAL file is empty, skipping recovery');
        return;
      }

      const entries = lines.map(line => JSON.parse(line) as WALEntry);

      console.log(`[WAL] Recovering ${entries.length} entries...`);

      // Get last checkpoint timestamp
      const checkpointExists = await exists(this.CHECKPOINT_PATH, { baseDir: BaseDirectory.AppData });
      let lastCheckpoint = 0;
      if (checkpointExists) {
        const checkpoint = await readTextFile(this.CHECKPOINT_PATH, { baseDir: BaseDirectory.AppData });
        lastCheckpoint = parseInt(checkpoint);
      }

      // Replay entries after last checkpoint
      const toReplay = entries.filter(e => e.timestamp > lastCheckpoint);
      console.log(`[WAL] Replaying ${toReplay.length} entries since checkpoint ${lastCheckpoint}`);

      // Group by transaction
      const transactions = new Map<string, WALEntry[]>();
      const standaloneEntries: WALEntry[] = [];

      for (const entry of toReplay) {
        if (entry.transactionId) {
          if (!transactions.has(entry.transactionId)) {
            transactions.set(entry.transactionId, []);
          }
          transactions.get(entry.transactionId)!.push(entry);
        } else {
          standaloneEntries.push(entry);
        }
      }

      // Replay committed transactions
      for (const [txId, txEntries] of transactions) {
        const committed = txEntries.some(e => e.operation === 'transaction-commit');
        const rolledBack = txEntries.some(e => e.operation === 'transaction-rollback');

        if (committed && !rolledBack) {
          console.log(`[WAL] Replaying transaction ${txId}`);
          for (const entry of txEntries) {
            if (entry.operation === 'write') {
              await this.replayWrite(entry);
            } else if (entry.operation === 'delete') {
              await this.replayDelete(entry);
            }
          }
        } else {
          console.log(`[WAL] Skipping uncommitted/rolled-back transaction ${txId}`);
        }
      }

      // Replay standalone writes
      for (const entry of standaloneEntries) {
        if (entry.operation === 'write') {
          await this.replayWrite(entry);
        } else if (entry.operation === 'delete') {
          await this.replayDelete(entry);
        }
      }

      console.log('[WAL] Recovery complete');

      // Checkpoint and clear WAL
      await this.checkpoint();

    } catch (error) {
      console.error('[WAL] Recovery failed:', error);
      throw new Error(`WAL recovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Replay a write operation from WAL
   */
  private async replayWrite(entry: WALEntry): Promise<void> {
    const path = `${this.DB_DIR}/${entry.collection}.json`;
    // Use safeStringify to handle cyclic structures during WAL replay
    await writeTextFile(path, safeStringify(entry.data, {
      maxDepth: 50,
      removeUndefined: false,
      removeFunctions: true,
      removeSymbols: true,
      detectCircular: true,
      logWarnings: false,
    }), {
      baseDir: BaseDirectory.AppData
    });
    console.log(`[WAL] Replayed write: ${entry.collection}`);
  }

  /**
   * Replay a delete operation from WAL
   */
  private async replayDelete(entry: WALEntry): Promise<void> {
    const path = `${this.DB_DIR}/${entry.collection}.json`;
    const fileExists = await exists(path, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      await remove(path, { baseDir: BaseDirectory.AppData });
      console.log(`[WAL] Replayed delete: ${entry.collection}`);
    }
  }

  /**
   * Checkpoint: Mark all WAL entries as applied
   * Clears the WAL and updates the checkpoint timestamp
   */
  async checkpoint(): Promise<void> {
    const now = Date.now();
    await writeTextFile(this.CHECKPOINT_PATH, now.toString(), {
      baseDir: BaseDirectory.AppData
    });

    // Clear WAL
    await writeTextFile(this.WAL_PATH, '', { baseDir: BaseDirectory.AppData });

    console.log(`[WAL] Checkpoint created at ${now}`);
  }

  /**
   * Calculate SHA-256 checksum for data integrity
   * @param data - The string data to hash
   * @returns Hex-encoded SHA-256 hash
   */
  private async calculateSHA256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const hashBytes = sha256(dataBytes);
    return bytesToHex(hashBytes);
  }

  /**
   * Save single entity to per-entity file
   * @param collection - Collection name (e.g., 'sessions', 'notes', 'tasks')
   * @param entity - Entity object with an 'id' field
   */
  async saveEntity<T extends { id: string }>(
    collection: string,
    entity: T
  ): Promise<void> {
    await this.ensureInitialized();

    const dir = `${this.DB_DIR}/${collection}`;
    const filePath = `${dir}/${collection.slice(0, -1)}-${entity.id}.json`;

    // Ensure directory exists
    try {
      await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
    } catch (error) {
      // Directory might already exist, ignore
    }

    // Use safeStringify to handle cyclic structures in entities
    const jsonData = safeStringify(entity, {
      maxDepth: 50,
      removeUndefined: false,
      removeFunctions: true,
      removeSymbols: true,
      detectCircular: true,
      logWarnings: false,
    });
    const checksum = await this.calculateSHA256(jsonData);

    // Write to WAL
    const walEntry: WALEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      operation: 'write',
      collection: filePath,
      data: entity,
      checksum,
    };
    await this.appendToWAL(walEntry);

    // Write entity file
    await writeTextFile(filePath, jsonData, {
      baseDir: BaseDirectory.AppData,
    });

    // Write checksum file
    await writeTextFile(`${filePath}.checksum`, checksum, {
      baseDir: BaseDirectory.AppData,
    });

    // Update index
    await this.updateIndex(collection, entity);

    console.log(`[Storage] Saved entity ${collection}/${entity.id} (SHA-256: ${checksum.substring(0, 8)}...)`);
  }

  /**
   * Load single entity from per-entity file
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns The entity or null if not found
   */
  async loadEntity<T>(collection: string, id: string): Promise<T | null> {
    await this.ensureInitialized();

    const filePath = `${this.DB_DIR}/${collection}/${collection.slice(0, -1)}-${id}.json`;
    const checksumPath = `${filePath}.checksum`;

    try {
      const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
      if (!fileExists) return null;

      // Read data
      const content = await readTextFile(filePath, { baseDir: BaseDirectory.AppData });

      // Verify checksum if exists
      const checksumExists = await exists(checksumPath, { baseDir: BaseDirectory.AppData });
      if (checksumExists) {
        const storedChecksum = await readTextFile(checksumPath, { baseDir: BaseDirectory.AppData });
        const actualChecksum = await this.calculateSHA256(content);

        if (storedChecksum !== actualChecksum) {
          throw new Error(`Checksum mismatch for ${collection}/${id}! Data may be corrupted.`);
        }

        console.log(`[Storage] Checksum verified for ${collection}/${id}`);
      }

      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load entity ${collection}/${id}:`, error);
      return null;
    }
  }

  /**
   * Update index with entity metadata
   * @param collection - Collection name
   * @param entity - Entity object with metadata to extract
   */
  private async updateIndex<T extends { id: string }>(
    collection: string,
    entity: T
  ): Promise<void> {
    const indexPath = `${this.DB_DIR}/${collection}/index.json`;

    // Load existing index
    let index: any[] = [];
    try {
      const indexExists = await exists(indexPath, { baseDir: BaseDirectory.AppData });
      if (indexExists) {
        const content = await readTextFile(indexPath, { baseDir: BaseDirectory.AppData });
        index = JSON.parse(content);
      }
    } catch (error) {
      console.warn('Failed to load index, creating new:', error);
    }

    // Extract metadata
    const metadata: any = { id: entity.id };

    if (collection === 'sessions' && 'startTime' in entity) {
      metadata.startTime = (entity as any).startTime;
      metadata.endTime = (entity as any).endTime;
      metadata.status = (entity as any).status;
      metadata.name = (entity as any).name;
    } else if (collection === 'notes' && 'content' in entity) {
      metadata.createdAt = (entity as any).createdAt;
      metadata.title = (entity as any).content.substring(0, 50);
    } else if (collection === 'tasks' && 'title' in entity) {
      metadata.title = (entity as any).title;
      metadata.status = (entity as any).status;
      metadata.priority = (entity as any).priority;
    }

    // Update or add
    const existingIndex = index.findIndex(i => i.id === entity.id);
    if (existingIndex >= 0) {
      index[existingIndex] = metadata;
    } else {
      index.push(metadata);
    }

    // Write index
    await writeTextFile(indexPath, JSON.stringify(index), {
      baseDir: BaseDirectory.AppData,
    });
  }

  /**
   * Load all entities using index for fast lookup
   * @param collection - Collection name
   * @returns Array of all entities in the collection
   */
  async loadAll<T>(collection: string): Promise<T[]> {
    await this.ensureInitialized();

    const indexPath = `${this.DB_DIR}/${collection}/index.json`;

    try {
      const indexExists = await exists(indexPath, { baseDir: BaseDirectory.AppData });
      if (!indexExists) return [];

      const content = await readTextFile(indexPath, { baseDir: BaseDirectory.AppData });
      const index = JSON.parse(content);

      // Load all entities in parallel
      const entities = await Promise.all(
        index.map((meta: any) => this.loadEntity<T>(collection, meta.id))
      );

      return entities.filter(e => e !== null) as T[];
    } catch (error) {
      console.error(`Failed to load all ${collection}:`, error);
      return [];
    }
  }

  /**
   * Begin a new storage transaction
   * @returns A new transaction instance
   */
  async beginTransaction(): Promise<StorageTransaction> {
    await this.ensureInitialized();
    return new TauriFileSystemTransaction(this.DB_DIR, this);
  }

  /**
   * Begin a new Phase 2.4 transaction (ACID transaction system)
   * Returns transaction ID for use with addOperation/commitTransaction/rollbackTransaction
   */
  beginPhase24Transaction(): string {
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.phase24Transactions.set(txId, {
      id: txId,
      operations: [],
    });

    // Write transaction-start to WAL
    const walEntry: WALEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      operation: 'transaction-start',
      collection: '',
      transactionId: txId,
    };
    this.appendToWAL(walEntry).catch(console.error);

    console.log(`[Transaction] Started: ${txId}`);
    return txId;
  }

  /**
   * Add an operation to an active Phase 2.4 transaction
   * @param txId - Transaction ID from beginPhase24Transaction
   * @param operation - Operation to add to transaction
   */
  addOperation(txId: string, operation: import('./StorageAdapter').TransactionOperation): void {
    const tx = this.phase24Transactions.get(txId);
    if (!tx) {
      throw new Error(`Transaction ${txId} not found`);
    }

    tx.operations.push(operation);
    console.log(`[Transaction] Added operation to ${txId}: ${operation.type} ${operation.collection}`);
  }

  /**
   * Commit a Phase 2.4 transaction atomically
   * All operations succeed or all fail
   * @param txId - Transaction ID to commit
   */
  async commitPhase24Transaction(txId: string): Promise<void> {
    const tx = this.phase24Transactions.get(txId);
    if (!tx) {
      throw new Error(`Transaction ${txId} not found`);
    }

    console.log(`[Transaction] Committing ${txId} (${tx.operations.length} operations)...`);

    try {
      // Execute all operations
      for (const op of tx.operations) {
        // Write to WAL first
        const walEntry: WALEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          timestamp: Date.now(),
          operation: op.type === 'write' ? 'write' : 'delete',
          collection: op.collection,
          data: op.data,
          checksum: op.data ? await calculateChecksum(safeStringify(op.data, {
            maxDepth: 50,
            removeUndefined: false,
            removeFunctions: true,
            removeSymbols: true,
            detectCircular: true,
            logWarnings: false,
          })) : undefined,
          transactionId: txId,
        };
        await this.appendToWAL(walEntry);

        // Execute operation
        if (op.type === 'write') {
          // Check if this is an entity operation with optimistic locking
          if (op.entityId) {
            const entity = op.data;
            const hasVersion = entity && 'version' in entity;

            if (hasVersion) {
              // Save with optimistic lock check
              const expectedVersion = entity.version || 0;
              await this.saveEntityWithVersion(op.collection, entity, expectedVersion);
            } else {
              // Regular entity save (no version check)
              await this.saveEntity(op.collection, { ...op.data, id: op.entityId });
            }
          } else {
            // Collection-level save
            await this.save(op.collection, op.data);
          }
        } else if (op.type === 'delete') {
          // Delete collection
          await this.delete(op.collection);
        }
      }

      // Write commit to WAL
      const commitEntry: WALEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        timestamp: Date.now(),
        operation: 'transaction-commit',
        collection: '',
        transactionId: txId,
      };
      await this.appendToWAL(commitEntry);

      console.log(`[Transaction] ✓ Committed ${txId}`);

      // Clean up
      this.phase24Transactions.delete(txId);

    } catch (error) {
      console.error(`[Transaction] Commit failed for ${txId}:`, error);
      await this.rollbackPhase24Transaction(txId);
      throw error;
    }
  }

  /**
   * Rollback a Phase 2.4 transaction
   * Cancels all queued operations
   * @param txId - Transaction ID to rollback
   */
  async rollbackPhase24Transaction(txId: string): Promise<void> {
    console.log(`[Transaction] Rolling back ${txId}...`);

    // Write rollback to WAL
    const rollbackEntry: WALEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      operation: 'transaction-rollback',
      collection: '',
      transactionId: txId,
    };
    await this.appendToWAL(rollbackEntry);

    // Clean up
    this.phase24Transactions.delete(txId);

    console.log(`[Transaction] ✗ Rolled back ${txId}`);
  }

  /**
   * Save entity with optimistic locking
   * Throws error if version mismatch detected
   *
   * @param collection - Collection name (e.g., 'sessions')
   * @param entity - Entity object with id and version fields
   * @param expectedVersion - Expected current version (undefined = skip check)
   */
  async saveEntityWithVersion<T extends { id: string; version?: number }>(
    collection: string,
    entity: T,
    expectedVersion?: number
  ): Promise<void> {
    await this.ensureInitialized();

    // Load current entity to check version
    const current = await this.loadEntity<T>(collection, entity.id);

    if (current && expectedVersion !== undefined) {
      const currentVersion = current.version || 0;

      if (currentVersion !== expectedVersion) {
        throw new Error(
          `Optimistic lock failed: expected version ${expectedVersion}, found ${currentVersion}`
        );
      }
    }

    // Increment version
    const newEntity = {
      ...entity,
      version: (entity.version || 0) + 1
    };

    // Save with new version
    await this.saveEntity(collection, newEntity);

    console.log(`[Storage] Saved ${collection}/${entity.id} with version ${newEntity.version}`);
  }

  /**
   * Add version field to all entities in collection (migration helper)
   *
   * @param collection - Collection name to migrate (e.g., 'sessions')
   */
  async addVersionField(collection: string): Promise<void> {
    console.log(`[Migration] Adding version field to ${collection}...`);

    const entities = await this.loadAll<any>(collection);

    for (const entity of entities) {
      if (!('version' in entity) || entity.version === undefined) {
        entity.version = 1; // Initialize to 1
        await this.saveEntity(collection, entity);
      }
    }

    console.log(`[Migration] ✓ Added version field to ${entities.length} ${collection}`);
  }

  /**
   * Compress data using gzip
   */
  private async compress(data: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(data);
    const compressed = pako.gzip(uint8Array);
    return compressed;
  }

  /**
   * Decompress gzip data
   */
  private async decompress(compressed: Uint8Array): Promise<string> {
    const decompressed = pako.ungzip(compressed);
    const decoder = new TextDecoder();
    return decoder.decode(decompressed);
  }

  /**
   * Save entity with compression
   */
  async saveEntityCompressed<T extends { id: string }>(
    collection: string,
    entity: T
  ): Promise<void> {
    await this.ensureInitialized();

    const dir = `${this.DB_DIR}/${collection}`;
    await this.ensureDir(dir);

    // Use .json.gz extension for compressed files
    const filePath = `${dir}/${collection.slice(0, -1)}-${entity.id}.json.gz`;

    // Serialize to JSON using safeStringify to handle cyclic structures
    const jsonData = safeStringify(entity, {
      maxDepth: 50,
      removeUndefined: false,
      removeFunctions: true,
      removeSymbols: true,
      detectCircular: true,
      logWarnings: false,
    });

    // Calculate checksum BEFORE compression (for data integrity)
    const checksum = await this.calculateSHA256(jsonData);

    // Compress
    const compressed = await this.compress(jsonData);

    // Write to WAL
    await this.appendToWAL({
      id: `wal-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      operation: 'write',
      collection: filePath,
      data: entity,
      checksum,
    });

    // Write compressed binary file
    await writeFile(filePath, compressed, { baseDir: BaseDirectory.AppData });

    // Write checksum file (same as before)
    await writeTextFile(`${filePath}.checksum`, checksum, { baseDir: BaseDirectory.AppData });

    // Update index
    await this.updateIndex(collection, entity);

    // Log with compression ratio
    const originalSize = jsonData.length;
    const compressedSize = compressed.length;
    const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`[Storage] Saved compressed entity ${collection}/${entity.id} (${ratio}% reduction, ${(compressedSize / 1024).toFixed(2)} KB)`);
  }

  /**
   * Load entity with decompression
   */
  async loadEntityCompressed<T extends { id: string }>(
    collection: string,
    id: string
  ): Promise<T | null> {
    const filePath = `${this.DB_DIR}/${collection}/${collection.slice(0, -1)}-${id}.json.gz`;

    try {
      // Read compressed binary file
      const compressed = await readFile(filePath, { baseDir: BaseDirectory.AppData });

      // Decompress
      const jsonData = await this.decompress(compressed);

      // Verify checksum (checksum file is plain text)
      const checksumPath = `${filePath}.checksum`;
      try {
        const storedChecksum = await readTextFile(checksumPath, { baseDir: BaseDirectory.AppData });
        const actualChecksum = await this.calculateSHA256(jsonData);

        if (storedChecksum !== actualChecksum) {
          console.error(`[Storage] ❌ Checksum mismatch for ${collection}/${id}! Data may be corrupted.`);
          return null;
        }

        console.log(`[Storage] Checksum verified for ${collection}/${id}`);
      } catch (error) {
        // Checksum file missing (legacy data) - continue without verification
        console.warn(`[Storage] No checksum found for ${collection}/${id}`);
      }

      // Parse JSON
      const entity = JSON.parse(jsonData) as T;
      return entity;

    } catch (error) {
      console.log(`[Storage] Entity ${collection}/${id} not found (compressed)`);
      return null;
    }
  }

  /**
   * Save an index to storage
   * @param collection - Collection name (e.g., 'sessions', 'notes', 'tasks')
   * @param indexType - Type of index ('date', 'tag', 'status', 'fulltext')
   * @param index - Index data structure
   * @param metadata - Index metadata (lastBuilt, entityCount, etc.)
   */
  async saveIndex(
    collection: string,
    indexType: string,
    index: any,
    metadata: import('./IndexingEngine').IndexMetadata
  ): Promise<void> {
    const indexPath = `db/${collection}/indexes/${indexType}.json`;
    const indexData = { index, metadata };

    await this.ensureDir(`db/${collection}/indexes`);
    await writeTextFile(indexPath, JSON.stringify(indexData), { baseDir: BaseDirectory.AppData });

    console.log(`[Index] Saved ${indexType} index for ${collection} (${metadata.entityCount} entities)`);
  }

  /**
   * Load an index from storage
   * @param collection - Collection name
   * @param indexType - Type of index
   * @returns Index data and metadata, or null if not found
   */
  async loadIndex<T>(
    collection: string,
    indexType: string
  ): Promise<{ index: T; metadata: import('./IndexingEngine').IndexMetadata } | null> {
    const indexPath = `db/${collection}/indexes/${indexType}.json`;

    try {
      const content = await readTextFile(indexPath, { baseDir: BaseDirectory.AppData });
      const data = JSON.parse(content);
      return { index: data.index as T, metadata: data.metadata };
    } catch (error) {
      console.log(`[Index] No ${indexType} index found for ${collection}`);
      return null;
    }
  }

  /**
   * Ensure directory exists (helper method)
   */
  private async ensureDir(dir: string): Promise<void> {
    try {
      await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
    } catch (error) {
      // Directory might already exist, ignore
    }
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
}
