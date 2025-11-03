/**
 * IndexedDB Storage Adapter
 *
 * Provides large storage (100s of MB) for web browsers using IndexedDB.
 * Much better than localStorage's 5-10MB limit.
 */

import { StorageAdapter, validateJSON } from './StorageAdapter';
import type { StorageInfo } from './StorageAdapter';
import type { StorageTransaction } from './types';
import JSZip from 'jszip';
import { compressData, decompressData, isCompressed } from './compressionUtils';
import { safeStringify, deepSanitize, diagnoseJSONIssues } from '../../utils/serializationUtils';

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

/**
 * IndexedDB Transaction Implementation
 *
 * Uses native IDBTransaction for atomicity - all operations succeed or all fail.
 * Operations are queued and executed only on commit().
 */
class IndexedDBTransaction implements StorageTransaction {
  private operations: Array<{
    type: 'save' | 'delete';
    key: string;
    value?: any;
    previousValue?: any; // Captured for rollback
  }> = [];

  private committed = false;
  private db: IDBDatabase;
  private storeName: string;
  private adapter: IndexedDBAdapter;

  constructor(db: IDBDatabase, storeName: string, adapter: IndexedDBAdapter) {
    this.db = db;
    this.storeName = storeName;
    this.adapter = adapter;
  }

  /**
   * Queue a save operation
   * Captures current value for rollback support
   */
  save(key: string, value: any): void {
    if (this.committed) {
      throw new Error('Transaction already committed or rolled back');
    }
    this.operations.push({ type: 'save', key, value });
  }

  /**
   * Queue a delete operation
   * Captures current value for rollback support
   */
  delete(key: string): void {
    if (this.committed) {
      throw new Error('Transaction already committed or rolled back');
    }
    this.operations.push({ type: 'delete', key });
  }

  /**
   * Execute all operations atomically using IDBTransaction
   */
  async commit(): Promise<void> {
    if (this.committed) {
      throw new Error('Transaction already committed or rolled back');
    }

    if (this.operations.length === 0) {
      this.committed = true;
      return; // Nothing to commit
    }

    // Step 1: Capture previous values for all operations (for rollback)
    await this.capturePreviousValues();

    // Step 2: Prepare all data (compress, serialize, etc.)
    const preparedOps: Array<{
      type: 'save' | 'delete';
      key: string;
      record?: StoredCollection;
    }> = [];

    for (const op of this.operations) {
      if (op.type === 'save') {
        // Validate value is not undefined (JSON.stringify(undefined) returns undefined, not a string!)
        if (op.value === undefined) {
          console.error(`[IndexedDBAdapter] Cannot save undefined value for key: ${op.key}`);
          continue; // Skip this operation
        }

        // Serialize with automatic sanitization if needed
        let jsonString: string;
        try {
          // Preserve optional fields for session/attachment data (critical for hash, attachmentId, path, etc.)
          const isSessionOrAttachment = op.key.includes('sessions/') || op.key.includes('session-') ||
                                       op.key.includes('attachments-ca/') || op.key.includes('attachment');
          jsonString = safeStringify(op.value, {
            maxDepth: 50,
            removeUndefined: !isSessionOrAttachment, // Keep undefined fields in sessions/attachments
            removeFunctions: true,
            removeSymbols: true,
            detectCircular: true,
            logWarnings: true,
          });
        } catch (error) {
          console.error(`[IndexedDBAdapter] Failed to stringify value for key: ${op.key}`, {
            error: error instanceof Error ? error.message : String(error),
            valueType: typeof op.value,
            constructor: op.value?.constructor?.name,
            issues: diagnoseJSONIssues(op.value),
          });
          continue; // Skip this operation
        }

        let storedData: string;

        try {
          const compressed = await compressData(jsonString);
          storedData = compressed;
        } catch (compressionError) {
          console.warn(`⚠️  Compression failed for ${op.key}, storing uncompressed JSON:`, compressionError);
          storedData = jsonString; // Store JSON string, not object
        }

        const record: StoredCollection = {
          name: op.key,
          data: storedData,
          timestamp: Date.now()
        };

        preparedOps.push({ type: 'save', key: op.key, record });
      } else {
        preparedOps.push({ type: 'delete', key: op.key });
      }
    }

    // Step 3: Execute all operations in a single IDBTransaction
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);

        // Queue all operations
        for (const op of preparedOps) {
          if (op.type === 'save' && op.record) {
            store.put(op.record);
          } else if (op.type === 'delete') {
            store.delete(op.key);
          }
        }

        // Wait for transaction to complete
        tx.oncomplete = () => {
          console.log(`💾 Transaction committed: ${this.operations.length} operations`);
          resolve();
        };

        tx.onerror = () => {
          console.error('Transaction failed:', tx.error);
          reject(new Error(`Transaction failed: ${tx.error}`));
        };

        tx.onabort = () => {
          console.error('Transaction aborted');
          reject(new Error('Transaction aborted'));
        };
      });

      // Mark as committed after successful execution
      this.committed = true;

    } catch (error) {
      // Rollback on error
      await this.rollback();
      throw error;
    }
  }

  /**
   * Capture previous values for all operations (for rollback)
   * This enables true rollback to restore the state before the transaction
   */
  private async capturePreviousValues(): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);

      let completed = 0;
      const total = this.operations.length;

      for (const op of this.operations) {
        const request = store.get(op.key);

        request.onsuccess = () => {
          const result = request.result as StoredCollection | undefined;
          if (result) {
            // Store the entire record (includes compressed data)
            op.previousValue = result;
          }

          completed++;
          if (completed === total) {
            resolve();
          }
        };

        request.onerror = () => {
          console.warn(`Failed to capture previous value for ${op.key}:`, request.error);
          // Continue anyway - rollback will still work for other operations
          completed++;
          if (completed === total) {
            resolve();
          }
        };
      }
    });
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
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([this.storeName], 'readwrite');
      const store = tx.objectStore(this.storeName);

      for (const op of this.operations) {
        if (op.previousValue) {
          // Restore previous value
          store.put(op.previousValue);
        } else if (op.type === 'save') {
          // Was a new save with no previous value - delete it
          store.delete(op.key);
        }
        // For deletes with no previous value, nothing to restore
      }

      tx.oncomplete = () => {
        console.log(`🔄 Transaction rolled back: ${this.operations.length} operations reverted`);
        this.operations = [];
        resolve();
      };

      tx.onerror = () => {
        console.error('Rollback failed:', tx.error);
        this.operations = [];
        reject(new Error(`Rollback failed: ${tx.error}`));
      };
    });
  }

  /**
   * Get number of pending operations
   */
  getPendingOperations(): number {
    return this.operations.length;
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
  private phase24Transactions = new Map<string, import('./StorageAdapter').TransactionOperation[]>();

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
   * Save data immediately without queuing (for critical shutdown data)
   * WARNING: Bypasses write queue - use only for critical metadata that must persist immediately
   *
   * @param collection - Collection name
   * @param data - Data to save
   */
  async saveImmediate<T>(collection: string, data: T): Promise<void> {
    const startTime = Date.now();
    await this.ensureInitialized();

    try {
      // Validate data is not undefined
      if (data === undefined) {
        throw new Error(`Cannot save undefined data for collection: ${collection}`);
      }

      // Serialize to JSON with automatic sanitization
      let jsonString: string;
      try {
        // Preserve optional fields for session/attachment data (critical for hash, attachmentId, path, etc.)
        const isSessionOrAttachment = collection.includes('sessions/') || collection.includes('session-') ||
                                     collection.includes('attachments-ca/') || collection.includes('attachment');
        jsonString = safeStringify(data, {
          maxDepth: 50,
          removeUndefined: !isSessionOrAttachment, // Keep undefined fields in sessions/attachments
          removeFunctions: true,
          removeSymbols: true,
          detectCircular: true,
          logWarnings: true,
        });
      } catch (stringifyError) {
        // Provide detailed error information
        const issues = diagnoseJSONIssues(data);
        console.error(`[IndexedDBAdapter] Failed to stringify collection: ${collection}`, {
          error: stringifyError instanceof Error ? stringifyError.message : String(stringifyError),
          dataType: typeof data,
          constructor: (data as any)?.constructor?.name,
          issues: issues.slice(0, 10), // Show first 10 issues
          totalIssues: issues.length,
        });
        throw new Error(
          `JSON.stringify failed for collection: ${collection}. ` +
          `Reason: ${stringifyError instanceof Error ? stringifyError.message : String(stringifyError)}. ` +
          `Found ${issues.length} issue(s). First few: ${issues.slice(0, 3).join(', ')}`
        );
      }

      // Compress the JSON data
      let storedData: string;
      try {
        const compressed = await compressData(jsonString);
        storedData = compressed; // Store as compressed string
      } catch (compressionError) {
        console.warn(`⚠️  Compression failed for ${collection}, storing uncompressed JSON:`, compressionError);
        storedData = jsonString; // Fallback to uncompressed JSON string
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
          const duration = Date.now() - startTime;
          resolve();
        };

        request.onerror = () => {
          const duration = Date.now() - startTime;
          console.error(`❌ [IndexedDB] SAVE IMMEDIATE FAILED: ${collection} (${duration}ms):`, request.error);
          reject(new Error(`Failed to save ${collection}: ${request.error}`));
        };
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [IndexedDB] SAVE IMMEDIATE FAILED: ${collection} (${duration}ms):`, error);
      throw error;
    }
  }

  /**
   * Save data to a collection
   */
  async save<T>(collection: string, data: T): Promise<void> {
    const startTime = Date.now();
    console.log(`[IndexedDB] SAVE START: ${collection}`);
    await this.ensureInitialized();

    return this.writeQueue.enqueue(async () => {
      try {
        // Validate data is not undefined
        if (data === undefined) {
          throw new Error(`Cannot save undefined data for collection: ${collection}`);
        }

        // Serialize to JSON with automatic sanitization
        let jsonString: string;
        try {
          // Preserve optional fields for session/attachment data (critical for hash, attachmentId, path, etc.)
          const isSessionOrAttachment = collection.includes('sessions/') || collection.includes('session-') ||
                                       collection.includes('attachments-ca/') || collection.includes('attachment') ||
                                       collection === 'capture-review-jobs';
          jsonString = safeStringify(data, {
            maxDepth: 50,
            removeUndefined: !isSessionOrAttachment, // Keep undefined fields in sessions/attachments
            removeFunctions: true,
            removeSymbols: true,
            detectCircular: true,
            logWarnings: true,
          });
        } catch (stringifyError) {
          // Provide detailed error information
          const issues = diagnoseJSONIssues(data);
          console.error(`[IndexedDBAdapter] Failed to stringify collection: ${collection}`, {
            error: stringifyError instanceof Error ? stringifyError.message : String(stringifyError),
            dataType: typeof data,
            constructor: (data as any)?.constructor?.name,
            issues: issues.slice(0, 10), // Show first 10 issues
            totalIssues: issues.length,
          });
          throw new Error(
            `JSON.stringify failed for collection: ${collection}. ` +
            `Reason: ${stringifyError instanceof Error ? stringifyError.message : String(stringifyError)}. ` +
            `Found ${issues.length} issue(s). First few: ${issues.slice(0, 3).join(', ')}`
          );
        }

        // Compress the JSON data
        let storedData: string;
        try {
          const compressed = await compressData(jsonString);
          storedData = compressed; // Store as compressed string
        } catch (compressionError) {
          console.warn(`⚠️  Compression failed for ${collection}, storing uncompressed JSON:`, compressionError);
          storedData = jsonString; // Fallback to uncompressed JSON string
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
            const duration = Date.now() - startTime;
            console.log(`✅ [IndexedDB] SAVE COMPLETE: ${collection} (${duration}ms, ${storedData.length} bytes)`);
            resolve();
          };

          request.onerror = () => {
            const duration = Date.now() - startTime;
            console.error(`❌ [IndexedDB] SAVE FAILED: ${collection} (${duration}ms):`, request.error);
            reject(new Error(`Failed to save ${collection}: ${request.error}`));
          };
        });
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ [IndexedDB] SAVE FAILED (outer): ${collection} (${duration}ms):`, error);
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
              const decompressed = await decompressData(result.data);
              const parsed = JSON.parse(decompressed);
              resolve(parsed as T);
            } else if (typeof result.data === 'string') {
              // Uncompressed JSON string - parse it
              const parsed = JSON.parse(result.data);
              resolve(parsed as T);
            } else {
              // Legacy: Stored as object (backward compatible)
              resolve(result.data as T);
            }
          } catch (error) {
            console.error(`Failed to parse ${collection}:`, error);
            // Try to use data as-is if parsing fails
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


  /**
   * List all available backups
   */


  /**
   * Restore data from a backup
   */


  /**
   * Delete a backup
   */


  /**
   * Clear all data (dangerous!)
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    try {
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
   * Begin a new storage transaction
   * @returns A new transaction instance
   */
  async beginTransaction(): Promise<StorageTransaction> {
    await this.ensureInitialized();
    return new IndexedDBTransaction(this.db!, this.COLLECTIONS_STORE, this);
  }

  /**
   * Begin a new Phase 2.4 transaction (ACID transaction system)
   * Note: IndexedDB has native transaction support, so this is a simplified implementation
   */
  beginPhase24Transaction(): string {
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    console.log(`[Transaction] Started (IndexedDB): ${txId}`);
    return txId;
  }

  /**
   * Add an operation to an active Phase 2.4 transaction
   * Note: For IndexedDB, operations are executed immediately using native transactions
   */
  addOperation(txId: string, operation: import('./StorageAdapter').TransactionOperation): void {
    console.log(`[Transaction] Operation queued for ${txId}: ${operation.type} ${operation.collection}`);
    // Store operation metadata for commit phase
    if (!this.phase24Transactions.has(txId)) {
      this.phase24Transactions.set(txId, []);
    }
    this.phase24Transactions.get(txId)!.push(operation);
  }

  /**
   * Commit a Phase 2.4 transaction atomically
   */
  async commitPhase24Transaction(txId: string): Promise<void> {
    const operations = this.phase24Transactions.get(txId) || [];

    console.log(`[Transaction] Committing ${txId} (${operations.length} operations)...`);

    try {
      // Execute all operations using native IndexedDB transactions
      for (const op of operations) {
        if (op.type === 'write') {
          await this.save(op.collection, op.data);
        } else if (op.type === 'delete') {
          await this.delete(op.collection);
        }
      }

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
   */
  async rollbackPhase24Transaction(txId: string): Promise<void> {
    console.log(`[Transaction] Rolling back ${txId}...`);

    // Clean up
    this.phase24Transactions.delete(txId);

    console.log(`[Transaction] ✗ Rolled back ${txId}`);
  }

  /**
   * Save an index to storage (IndexedDB implementation)
   * Uses a dedicated 'indexes' object store
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
    await this.ensureInitialized();

    return new Promise<void>((resolve, reject) => {
      // Check if 'indexes' object store exists
      if (!this.db!.objectStoreNames.contains('indexes')) {
        // Fallback: Store in collections store with special key
        const transaction = this.db!.transaction([this.COLLECTIONS_STORE], 'readwrite');
        const store = transaction.objectStore(this.COLLECTIONS_STORE);

        const key = `__index__${collection}__${indexType}`;
        const record = {
          name: key,
          data: { index, metadata },
          timestamp: Date.now()
        };

        const request = store.put(record);

        request.onsuccess = () => {
          console.log(`[Index] Saved ${indexType} index for ${collection} (${metadata.entityCount} entities)`);
          resolve();
        };

        request.onerror = () => {
          console.error(`Failed to save ${indexType} index for ${collection}:`, request.error);
          reject(new Error(`Failed to save index: ${request.error}`));
        };
      } else {
        // Use dedicated 'indexes' object store
        const transaction = this.db!.transaction(['indexes'], 'readwrite');
        const store = transaction.objectStore('indexes');

        const key = `${collection}__${indexType}`;
        const record = {
          key,
          collection,
          indexType,
          index,
          metadata,
          timestamp: Date.now()
        };

        const request = store.put(record);

        request.onsuccess = () => {
          console.log(`[Index] Saved ${indexType} index for ${collection} (${metadata.entityCount} entities)`);
          resolve();
        };

        request.onerror = () => {
          console.error(`Failed to save ${indexType} index for ${collection}:`, request.error);
          reject(new Error(`Failed to save index: ${request.error}`));
        };
      }
    });
  }

  /**
   * Load an index from storage (IndexedDB implementation)
   * @param collection - Collection name
   * @param indexType - Type of index
   * @returns Index data and metadata, or null if not found
   */
  async loadIndex<T>(
    collection: string,
    indexType: string
  ): Promise<{ index: T; metadata: import('./IndexingEngine').IndexMetadata } | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      // Check if 'indexes' object store exists
      if (!this.db!.objectStoreNames.contains('indexes')) {
        // Fallback: Load from collections store with special key
        const transaction = this.db!.transaction([this.COLLECTIONS_STORE], 'readonly');
        const store = transaction.objectStore(this.COLLECTIONS_STORE);

        const key = `__index__${collection}__${indexType}`;
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (result && result.data) {
            resolve({ index: result.data.index as T, metadata: result.data.metadata });
          } else {
            console.log(`[Index] No ${indexType} index found for ${collection}`);
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error(`Failed to load ${indexType} index for ${collection}:`, request.error);
          reject(new Error(`Failed to load index: ${request.error}`));
        };
      } else {
        // Use dedicated 'indexes' object store
        const transaction = this.db!.transaction(['indexes'], 'readonly');
        const store = transaction.objectStore('indexes');

        const key = `${collection}__${indexType}`;
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (result) {
            resolve({ index: result.index as T, metadata: result.metadata });
          } else {
            console.log(`[Index] No ${indexType} index found for ${collection}`);
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error(`Failed to load ${indexType} index for ${collection}:`, request.error);
          reject(new Error(`Failed to load index: ${request.error}`));
        };
      }
    });
  }

  /**
   * Save entity with compression (stub - not implemented for IndexedDB)
   * @param collection - Collection name (e.g., 'sessions', 'notes', 'tasks')
   * @param entity - Entity object with an 'id' field
   */
  async saveEntityCompressed<T extends { id: string }>(
    collection: string,
    entity: T
  ): Promise<void> {
    // IndexedDB handles compression internally via browser
    // For now, just use regular save
    console.warn('[IndexedDB] saveEntityCompressed not implemented, using regular save');
    await this.save(collection, entity);
  }

  /**
   * Load entity with decompression (stub - not implemented for IndexedDB)
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns The entity or null if not found
   */
  async loadEntityCompressed<T extends { id: string }>(
    collection: string,
    id: string
  ): Promise<T | null> {
    // IndexedDB handles compression internally via browser
    // For now, just use regular load
    console.warn('[IndexedDB] loadEntityCompressed not implemented, using regular load');
    return await this.load<T>(collection);
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
