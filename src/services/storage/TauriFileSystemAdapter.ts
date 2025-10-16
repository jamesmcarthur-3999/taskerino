/**
 * Tauri File System Storage Adapter
 *
 * Provides unlimited storage using the native file system via Tauri.
 * Files are stored in the app's data directory.
 */

import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir, remove, readDir } from '@tauri-apps/plugin-fs';
import { StorageAdapter, formatBytes, validateJSON, calculateChecksum } from './StorageAdapter';
import type { StorageInfo, BackupInfo } from './StorageAdapter';
import JSZip from 'jszip';

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

export class TauriFileSystemAdapter extends StorageAdapter {
  private readonly DB_DIR = 'db';
  private readonly BACKUP_DIR = 'backups';
  private initialized = false;
  private writeQueue = new WriteQueue();

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

        // Add metadata
        const dataWithMeta = {
          version: 1,
          checksum,
          timestamp: Date.now(),
          data
        };

        const finalData = JSON.stringify(dataWithMeta, null, 2);

        // Write to temporary file first (atomic operation)
        await writeTextFile(tempPath, finalData, {
          baseDir: BaseDirectory.AppData
        });

        // If existing file exists, move it to backup
        if (await exists(path, { baseDir: BaseDirectory.AppData })) {
          try {
            // Read existing file
            const existingContent = await readTextFile(path, {
              baseDir: BaseDirectory.AppData
            });

            // Write to backup
            await writeTextFile(backupPath, existingContent, {
              baseDir: BaseDirectory.AppData
            });
          } catch (error) {
            console.warn(`Failed to create backup for ${collection}:`, error);
            // Continue anyway - not critical
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
        // Verify checksum if present
        if (parsed.checksum) {
          const dataStr = JSON.stringify(parsed.data, null, 2);
          const checksum = await calculateChecksum(dataStr);

          if (checksum !== parsed.checksum) {
            console.warn(`⚠️  Checksum mismatch for ${collection}, attempting recovery...`);
            return await this.loadFromBackup(collection);
          }
        }

        return parsed.data as T;
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
        return parsed.data as T;
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
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
}
