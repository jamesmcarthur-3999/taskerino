/**
 * Tauri File System Storage Adapter
 *
 * Provides unlimited storage using the native file system via Tauri.
 * Files are stored in the app's data directory.
 */

import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir, remove, readDir } from '@tauri-apps/plugin-fs';
import { StorageAdapter, formatBytes, validateJSON, calculateChecksum } from './StorageAdapter';
import type { StorageInfo, BackupInfo } from './StorageAdapter';
import type { StorageTransaction } from './types';
import JSZip from 'jszip';
import { compressData, decompressData, isCompressed } from './compressionUtils';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

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
   */
  save(key: string, value: any): void {
    if (this.committed) {
      throw new Error('Transaction already committed or rolled back');
    }
    this.operations.push({ type: 'save', key, value });
  }

  /**
   * Queue a delete operation
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

    // Mark as committed early to prevent new operations
    this.committed = true;

    if (this.operations.length === 0) {
      return; // Nothing to commit
    }

    // Create temp directory for staging
    const tempDir = `${this.basePath}/.tx-${Date.now()}`;

    try {
      // Create temp directory
      await mkdir(tempDir, { baseDir: BaseDirectory.AppData, recursive: true });

      // Prepare and write all changes to temp directory first
      for (const op of this.operations) {
        if (op.type === 'save') {
          const tempPath = `${tempDir}/${op.key}.json`;

          // Prepare data (compress, serialize)
          const jsonData = JSON.stringify(op.value, null, 2);
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

          // Write to final location
          await writeTextFile(finalPath, content, {
            baseDir: BaseDirectory.AppData
          });

        } else if (op.type === 'delete') {
          // Delete operation
          if (await exists(finalPath, { baseDir: BaseDirectory.AppData })) {
            await remove(finalPath, { baseDir: BaseDirectory.AppData });
          }
        }
      }

      // Clean up temp directory
      try {
        await remove(tempDir, { baseDir: BaseDirectory.AppData });
      } catch (cleanupError) {
        // Log but don't fail - transaction succeeded
        console.warn('Failed to clean up temp directory:', cleanupError);
      }

      console.log(`💾 Transaction committed: ${this.operations.length} operations`);

    } catch (error) {
      // Rollback: remove temp directory
      try {
        await remove(tempDir, { baseDir: BaseDirectory.AppData });
      } catch (rollbackError) {
        console.warn('Failed to clean up temp directory after error:', rollbackError);
      }
      throw error;
    }
  }

  /**
   * Cancel all queued operations
   */
  async rollback(): Promise<void> {
    this.operations = [];
    this.committed = true;
    console.log('🔄 Transaction rolled back');
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

      this.initialized = true;
      console.log('✅ TauriFileSystemAdapter initialized');
    } catch (error) {
      console.error('❌ Failed to initialize TauriFileSystemAdapter:', error);
      throw new Error(`Storage initialization failed: ${error}`);
    }
  }

  /**
   * Save data to a collection using atomic writes
   */
  async save<T>(collection: string, data: T): Promise<void> {
    await this.ensureInitialized();

    return this.writeQueue.enqueue(async () => {
      try {
        const jsonData = JSON.stringify(data, null, 2);
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

        console.log(`💾 Saved ${collection} (${formatBytes(writtenContent.length)})`);

        // 4. Checkpoint periodically (every 100 writes)
        this.writesSinceCheckpoint++;
        if (this.writesSinceCheckpoint >= 100) {
          await this.checkpoint();
          this.writesSinceCheckpoint = 0;
        }
      } catch (error) {
        console.error(`❌ Failed to save ${collection}:`, error);
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
      if (await exists(backupPath, { baseDir: BaseDirectory.AppData })) {
        await remove(backupPath, { baseDir: BaseDirectory.AppData });
        console.log(`🗑️  Deleted backup: ${backupId}`);
      }
    } catch (error) {
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
      // Check if we're in a Tauri environment
      if (typeof window === 'undefined' || !('__TAURI__' in window)) {
        return false;
      }

      // Try to access the file system
      await this.init();
      return true;
    } catch {
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
    const line = JSON.stringify(entry) + '\n';

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
    await writeTextFile(path, JSON.stringify(entry.data), {
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

    const jsonData = JSON.stringify(entity);
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
          checksum: op.data ? await calculateChecksum(JSON.stringify(op.data)) : undefined,
          transactionId: txId,
        };
        await this.appendToWAL(walEntry);

        // Execute operation
        if (op.type === 'write') {
          // Use regular save() which already handles backups and WAL
          await this.save(op.collection, op.data);
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
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
}
