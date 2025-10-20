/**
 * IndexedDB Storage Adapter
 *
 * Provides large storage (100s of MB) for web browsers using IndexedDB.
 * Much better than localStorage's 5-10MB limit.
 */

import { StorageAdapter, validateJSON } from './StorageAdapter';
import type { StorageInfo, BackupInfo } from './StorageAdapter';
import JSZip from 'jszip';
import { compressData, decompressData, isCompressed } from './compressionUtils';

interface StoredCollection {
  name: string;
  data: any;
  timestamp: number;
  checksum?: string;
}

interface StoredBackup {
  id: string;
  timestamp: number;
  data: string; // JSON string of all collections
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

export class IndexedDBAdapter extends StorageAdapter {
  private readonly DB_NAME = 'taskerino-db';
  private readonly DB_VERSION = 1;
  private readonly COLLECTIONS_STORE = 'collections';
  private readonly BACKUPS_STORE = 'backups';

  private db: IDBDatabase | null = null;
  private initialized = false;
  private writeQueue = new WriteQueue();

  /**
   * Initialize the storage system
   * Opens IndexedDB and creates object stores if needed
   */
  async init(): Promise<void> {
    if (this.initialized && this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(new Error(`IndexedDB open failed: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        console.log('✅ IndexedDBAdapter initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(this.COLLECTIONS_STORE)) {
          const collectionsStore = db.createObjectStore(this.COLLECTIONS_STORE, { keyPath: 'name' });
          collectionsStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('📁 Created collections store');
        }

        if (!db.objectStoreNames.contains(this.BACKUPS_STORE)) {
          const backupsStore = db.createObjectStore(this.BACKUPS_STORE, { keyPath: 'id' });
          backupsStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('📁 Created backups store');
        }
      };
    });
  }

  /**
   * Save data to a collection
   */
  async save<T>(collection: string, data: T): Promise<void> {
    await this.ensureInitialized();

    return this.writeQueue.enqueue(async () => {
      try {
        // Serialize to JSON
        const jsonString = JSON.stringify(data);

        // Compress the JSON data
        let storedData: any;
        try {
          const compressed = await compressData(jsonString);
          storedData = compressed; // Store as compressed string
        } catch (compressionError) {
          console.warn(`⚠️  Compression failed for ${collection}, storing uncompressed:`, compressionError);
          storedData = data; // Fallback to uncompressed
        }

        return new Promise<void>((resolve, reject) => {
          const transaction = this.db!.transaction([this.COLLECTIONS_STORE], 'readwrite');
          const store = transaction.objectStore(this.COLLECTIONS_STORE);

          const record: StoredCollection = {
            name: collection,
            data: storedData,
            timestamp: Date.now()
          };

          const request = store.put(record);

          request.onsuccess = () => {
            console.log(`💾 Saved ${collection} to IndexedDB`);
            resolve();
          };

          request.onerror = () => {
            console.error(`Failed to save ${collection}:`, request.error);
            reject(new Error(`Failed to save ${collection}: ${request.error}`));
          };
        });
      } catch (error) {
        console.error(`Failed to save ${collection}:`, error);
        throw error;
      }
    });
  }

  async shutdown(): Promise<void> {
    console.log('[Storage] Flushing pending writes before shutdown...');
    await this.writeQueue.flush();
    console.log('[Storage] Shutdown complete');
  }

  /**
   * Load data from a collection
   */
  async load<T>(collection: string): Promise<T | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.COLLECTIONS_STORE], 'readonly');
      const store = transaction.objectStore(this.COLLECTIONS_STORE);
      const request = store.get(collection);

      request.onsuccess = async () => {
        const result = request.result as StoredCollection | undefined;
        if (result) {
          try {
            // Check if data is compressed
            if (typeof result.data === 'string' && isCompressed(result.data)) {
              console.log(`📦 Decompressing ${collection}...`);
              const decompressed = await decompressData(result.data);
              const parsed = JSON.parse(decompressed);
              resolve(parsed as T);
            } else {
              // Uncompressed data (backward compatible)
              resolve(result.data as T);
            }
          } catch (decompressionError) {
            console.error(`Failed to decompress ${collection}:`, decompressionError);
            // Try to use data as-is if decompression fails
            resolve(result.data as T);
          }
        } else {
          console.log(`ℹ️  Collection ${collection} does not exist in IndexedDB`);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error(`Failed to load ${collection}:`, request.error);
        reject(new Error(`Failed to load ${collection}: ${request.error}`));
      };
    });
  }

  /**
   * Delete a collection
   */
  async delete(collection: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.COLLECTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(this.COLLECTIONS_STORE);
      const request = store.delete(collection);

      request.onsuccess = () => {
        console.log(`🗑️  Deleted ${collection} from IndexedDB`);
        resolve();
      };

      request.onerror = () => {
        console.error(`Failed to delete ${collection}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Check if a collection exists
   */
  async exists(collection: string): Promise<boolean> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.COLLECTIONS_STORE], 'readonly');
      const store = transaction.objectStore(this.COLLECTIONS_STORE);
      const request = store.get(collection);

      request.onsuccess = () => {
        resolve(request.result !== undefined);
      };

      request.onerror = () => {
        console.error(`Failed to check existence of ${collection}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    await this.ensureInitialized();

    try {
      // Use Storage API if available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();

        // Get breakdown by collection
        const breakdown: { [key: string]: number } = {};
        const collections = await this.getAllCollectionNames();

        for (const collection of collections) {
          const size = await this.getCollectionSize(collection);
          breakdown[collection] = size;
        }

        return {
          used: estimate.usage || 0,
          available: estimate.quota || 50 * 1024 * 1024, // Fallback to 50MB
          type: 'indexeddb',
          breakdown
        };
      }

      // Fallback if Storage API not available
      return {
        used: 0,
        available: 50 * 1024 * 1024, // Assume 50MB
        type: 'indexeddb'
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return {
        used: 0,
        available: 50 * 1024 * 1024,
        type: 'indexeddb'
      };
    }
  }

  /**
   * Create a backup of all data
   */
  async createBackup(): Promise<string> {
    await this.ensureInitialized();

    const backupId = `backup-${Date.now()}`;

    try {
      // Get all collections
      const collections = await this.getAllCollections();

      const backup = {
        version: 1,
        timestamp: Date.now(),
        collections
      };

      // Store in backups object store
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.BACKUPS_STORE], 'readwrite');
        const store = transaction.objectStore(this.BACKUPS_STORE);

        const record: StoredBackup = {
          id: backupId,
          timestamp: Date.now(),
          data: JSON.stringify(backup)
        };

        const request = store.put(record);

        request.onsuccess = () => {
          console.log(`📦 Created backup: ${backupId}`);

          // Cleanup old backups (keep last 7)
          this.cleanupOldBackups(7).catch(err => {
            console.warn('Failed to cleanup old backups:', err);
          });

          resolve(backupId);
        };

        request.onerror = () => {
          console.error('Failed to create backup:', request.error);
          reject(new Error(`Failed to create backup: ${request.error}`));
        };
      });
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

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.BACKUPS_STORE], 'readonly');
      const store = transaction.objectStore(this.BACKUPS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const backups: BackupInfo[] = (request.result as StoredBackup[]).map(b => {
          const data = JSON.parse(b.data);
          return {
            id: b.id,
            timestamp: b.timestamp,
            size: b.data.length,
            collections: Object.keys(data.collections || {})
          };
        });

        // Sort by timestamp (newest first)
        backups.sort((a, b) => b.timestamp - a.timestamp);

        resolve(backups);
      };

      request.onerror = () => {
        console.error('Failed to list backups:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Restore data from a backup
   */
  async restoreBackup(backupId: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.BACKUPS_STORE], 'readonly');
      const store = transaction.objectStore(this.BACKUPS_STORE);
      const request = store.get(backupId);

      request.onsuccess = async () => {
        const backup = request.result as StoredBackup | undefined;

        if (!backup) {
          reject(new Error(`Backup ${backupId} not found`));
          return;
        }

        try {
          const data = JSON.parse(backup.data);

          if (!data.collections) {
            reject(new Error('Invalid backup format'));
            return;
          }

          // Restore each collection
          for (const [collection, collectionData] of Object.entries(data.collections)) {
            await this.save(collection, collectionData);
          }

          console.log(`✅ Restored from backup: ${backupId}`);
          resolve();
        } catch (error) {
          console.error('Failed to restore backup:', error);
          reject(error);
        }
      };

      request.onerror = () => {
        console.error('Failed to restore backup:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.BACKUPS_STORE], 'readwrite');
      const store = transaction.objectStore(this.BACKUPS_STORE);
      const request = store.delete(backupId);

      request.onsuccess = () => {
        console.log(`🗑️  Deleted backup: ${backupId}`);
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to delete backup:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all data (dangerous!)
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    try {
      // Create a final backup before clearing
      await this.createBackup();

      // Clear collections store
      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([this.COLLECTIONS_STORE], 'readwrite');
        const store = transaction.objectStore(this.COLLECTIONS_STORE);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log('🗑️  Cleared all data from IndexedDB');
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

      // Get all collections
      const collections = await this.getAllCollections();

      for (const [name, data] of Object.entries(collections)) {
        zip.file(`${name}.json`, JSON.stringify(data, null, 2));
      }

      // Add metadata
      zip.file('export-metadata.json', JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        source: 'indexeddb'
      }, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      console.log('📤 Exported data as ZIP from IndexedDB');

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

            await this.save(collection, parsedData);
          }
        }
      }

      console.log('📥 Imported data from ZIP to IndexedDB');
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
      // Check if IndexedDB is available
      if (typeof indexedDB === 'undefined') {
        return false;
      }

      // Try to open a test database
      await this.init();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all collection names
   */
  private async getAllCollectionNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.COLLECTIONS_STORE], 'readonly');
      const store = transaction.objectStore(this.COLLECTIONS_STORE);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };

      request.onerror = () => {
        console.error('Failed to get collection names:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all collections with their data
   */
  private async getAllCollections(): Promise<{ [name: string]: any }> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.COLLECTIONS_STORE], 'readonly');
      const store = transaction.objectStore(this.COLLECTIONS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const collections: { [name: string]: any } = {};

        for (const record of request.result as StoredCollection[]) {
          collections[record.name] = record.data;
        }

        resolve(collections);
      };

      request.onerror = () => {
        console.error('Failed to get all collections:', request.error);
        reject(request.error);
      };
    });
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

      console.log(`🧹 Cleaned up ${toDelete.length} old backups from IndexedDB`);
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
      // Non-critical, continue
    }
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized || !this.db) {
      await this.init();
    }
  }
}
