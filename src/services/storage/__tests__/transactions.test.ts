/**
 * Unit Tests for Storage Transactions
 *
 * Tests the StorageTransaction interface implementation for both
 * IndexedDB and Tauri File System adapters.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBAdapter } from '../IndexedDBAdapter';
import { TauriFileSystemAdapter } from '../TauriFileSystemAdapter';
import type { StorageTransaction } from '../types';

// Mock compression utils
vi.mock('../compressionUtils', () => ({
  compressData: vi.fn((data) => Promise.resolve(data)),
  decompressData: vi.fn((data) => Promise.resolve(data)),
  isCompressed: vi.fn(() => false)
}));

describe('StorageTransaction - IndexedDB', () => {
  let adapter: IndexedDBAdapter;
  let mockDB: any;
  let mockTransactions: any[] = [];

  beforeEach(async () => {
    // Mock IndexedDB
    mockDB = {
      transaction: vi.fn((stores, mode) => {
        const mockStore = {
          put: vi.fn(),
          delete: vi.fn()
        };

        const mockTransaction = {
          objectStore: vi.fn(() => mockStore),
          oncomplete: null as any,
          onerror: null as any,
          onabort: null as any,
          error: null
        };

        mockTransactions.push(mockTransaction);

        // Simulate successful transaction
        setTimeout(() => {
          if (mockTransaction.oncomplete) {
            mockTransaction.oncomplete();
          }
        }, 0);

        return mockTransaction;
      })
    };

    const mockOpenRequest = {
      result: mockDB,
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any
    };

    global.indexedDB = {
      open: vi.fn(() => {
        setTimeout(() => {
          if (mockOpenRequest.onsuccess) {
            mockOpenRequest.onsuccess({ target: mockOpenRequest } as any);
          }
        }, 0);
        return mockOpenRequest as any;
      })
    } as any;

    adapter = new IndexedDBAdapter();
    await adapter.init();
    mockTransactions = [];
  });

  afterEach(() => {
    delete (global as any).indexedDB;
  });

  describe('Basic Transaction Operations', () => {
    it('should create a transaction', async () => {
      const tx = await adapter.beginTransaction();
      expect(tx).toBeDefined();
      expect(typeof tx.save).toBe('function');
      expect(typeof tx.delete).toBe('function');
      expect(typeof tx.commit).toBe('function');
      expect(typeof tx.rollback).toBe('function');
    });

    it('should queue save operations', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [{ id: '1' }] });
      tx.save('settings', { theme: 'dark' });

      expect(tx.getPendingOperations()).toBe(2);
    });

    it('should queue delete operations', async () => {
      const tx = await adapter.beginTransaction();

      tx.delete('old-collection');
      tx.delete('temp-data');

      expect(tx.getPendingOperations()).toBe(2);
    });

    it('should queue mixed operations', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [] });
      tx.delete('old-sessions');
      tx.save('settings', { theme: 'dark' });

      expect(tx.getPendingOperations()).toBe(3);
    });
  });

  describe('Transaction Commit', () => {
    it('should commit successfully', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [{ id: '1' }] });
      tx.save('settings', { theme: 'dark' });

      await expect(tx.commit()).resolves.not.toThrow();

      // Verify IDBTransaction was created
      expect(mockDB.transaction).toHaveBeenCalledWith(['collections'], 'readwrite');
    });

    it('should execute all operations in a single IDBTransaction', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('collection1', { data: 'one' });
      tx.save('collection2', { data: 'two' });
      tx.delete('collection3');

      await tx.commit();

      // Should only create one IDBTransaction
      expect(mockDB.transaction).toHaveBeenCalledTimes(1);

      // Verify store operations
      const mockTransaction = mockTransactions[0];
      const mockStore = mockTransaction.objectStore();

      expect(mockStore.put).toHaveBeenCalledTimes(2);
      expect(mockStore.delete).toHaveBeenCalledTimes(1);
    });

    it('should handle empty transaction (no operations)', async () => {
      const tx = await adapter.beginTransaction();

      // Don't add any operations
      await expect(tx.commit()).resolves.not.toThrow();

      // Should not create IDBTransaction for empty commit
      expect(mockDB.transaction).not.toHaveBeenCalled();
    });

    it('should throw on double commit', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [] });
      await tx.commit();

      // Second commit should throw
      await expect(tx.commit()).rejects.toThrow('already committed');
    });
  });

  describe('Transaction Rollback', () => {
    it('should rollback successfully', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [{ id: '1' }] });
      tx.save('settings', { theme: 'dark' });

      await tx.rollback();

      // Operations should be cleared
      expect(tx.getPendingOperations()).toBe(0);

      // No IDBTransaction should be created
      expect(mockDB.transaction).not.toHaveBeenCalled();
    });

    it('should prevent operations after rollback', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [] });
      await tx.rollback();

      // Try to add operation after rollback
      expect(() => tx.save('settings', {})).toThrow('already committed or rolled back');
    });
  });

  describe('Error Handling', () => {
    it('should throw on operations after commit', async () => {
      const tx = await adapter.beginTransaction();

      await tx.commit();

      expect(() => tx.save('sessions', {})).toThrow('already committed or rolled back');
      expect(() => tx.delete('sessions')).toThrow('already committed or rolled back');
    });

    it('should handle IDBTransaction errors', async () => {
      // Mock transaction error
      mockDB.transaction = vi.fn(() => {
        const mockTransaction = {
          objectStore: vi.fn(() => ({
            put: vi.fn(),
            delete: vi.fn()
          })),
          oncomplete: null as any,
          onerror: null as any,
          onabort: null as any,
          error: new Error('Transaction failed')
        };

        setTimeout(() => {
          if (mockTransaction.onerror) {
            mockTransaction.onerror();
          }
        }, 0);

        return mockTransaction;
      });

      const tx = await adapter.beginTransaction();
      tx.save('sessions', { sessions: [] });

      await expect(tx.commit()).rejects.toThrow('Transaction failed');
    });

    it('should handle IDBTransaction abort', async () => {
      // Mock transaction abort
      mockDB.transaction = vi.fn(() => {
        const mockTransaction = {
          objectStore: vi.fn(() => ({
            put: vi.fn(),
            delete: vi.fn()
          })),
          oncomplete: null as any,
          onerror: null as any,
          onabort: null as any,
          error: null
        };

        setTimeout(() => {
          if (mockTransaction.onabort) {
            mockTransaction.onabort();
          }
        }, 0);

        return mockTransaction;
      });

      const tx = await adapter.beginTransaction();
      tx.save('sessions', { sessions: [] });

      await expect(tx.commit()).rejects.toThrow('Transaction aborted');
    });
  });

  describe('getPendingOperations', () => {
    it('should return 0 for new transaction', async () => {
      const tx = await adapter.beginTransaction();
      expect(tx.getPendingOperations()).toBe(0);
    });

    it('should return correct count after operations', async () => {
      const tx = await adapter.beginTransaction();

      expect(tx.getPendingOperations()).toBe(0);

      tx.save('key1', {});
      expect(tx.getPendingOperations()).toBe(1);

      tx.save('key2', {});
      expect(tx.getPendingOperations()).toBe(2);

      tx.delete('key3');
      expect(tx.getPendingOperations()).toBe(3);
    });

    it('should return 0 after rollback', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('key1', {});
      tx.save('key2', {});
      expect(tx.getPendingOperations()).toBe(2);

      await tx.rollback();
      expect(tx.getPendingOperations()).toBe(0);
    });
  });
});

describe('StorageTransaction - Tauri FileSystem', () => {
  let adapter: TauriFileSystemAdapter;
  let mockFileSystem: Map<string, string>;

  // Mock Tauri plugin
  const mockExists = vi.fn();
  const mockReadTextFile = vi.fn();
  const mockWriteTextFile = vi.fn();
  const mockMkdir = vi.fn();
  const mockRemove = vi.fn();
  const mockReadDir = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    mockFileSystem = new Map();

    // Setup mocks
    mockExists.mockImplementation((path: string) => {
      return Promise.resolve(mockFileSystem.has(path));
    });

    mockReadTextFile.mockImplementation((path: string) => {
      const content = mockFileSystem.get(path);
      if (!content) throw new Error(`File not found: ${path}`);
      return Promise.resolve(content);
    });

    mockWriteTextFile.mockImplementation((path: string, content: string) => {
      mockFileSystem.set(path, content);
      return Promise.resolve();
    });

    mockMkdir.mockImplementation(() => Promise.resolve());

    mockRemove.mockImplementation((path: string) => {
      // Remove directory and all files in it
      const keysToDelete = Array.from(mockFileSystem.keys())
        .filter(key => key.startsWith(path));
      keysToDelete.forEach(key => mockFileSystem.delete(key));
      return Promise.resolve();
    });

    mockReadDir.mockImplementation((path: string) => {
      const entries = Array.from(mockFileSystem.keys())
        .filter(key => key.startsWith(path))
        .map(key => ({
          name: key.replace(`${path}/`, '')
        }));
      return Promise.resolve(entries);
    });

    vi.doMock('@tauri-apps/plugin-fs', () => ({
      BaseDirectory: { AppData: 15 },
      exists: mockExists,
      readTextFile: mockReadTextFile,
      writeTextFile: mockWriteTextFile,
      mkdir: mockMkdir,
      remove: mockRemove,
      readDir: mockReadDir
    }));

    // Mock window.__TAURI__
    (global as any).window = { __TAURI__: true };

    const { TauriFileSystemAdapter } = await import('../TauriFileSystemAdapter');
    adapter = new TauriFileSystemAdapter();
    await adapter.init();

    vi.clearAllMocks();
    mockFileSystem.clear();
  });

  afterEach(() => {
    delete (global as any).window;
    vi.clearAllMocks();
  });

  describe('Basic Transaction Operations', () => {
    it('should create a transaction', async () => {
      const tx = await adapter.beginTransaction();
      expect(tx).toBeDefined();
      expect(tx.getPendingOperations()).toBe(0);
    });

    it('should queue operations', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [] });
      tx.save('settings', { theme: 'dark' });
      tx.delete('old-data');

      expect(tx.getPendingOperations()).toBe(3);
    });
  });

  describe('Transaction Commit', () => {
    it('should commit successfully using temp directory', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [{ id: '1' }] });
      tx.save('settings', { theme: 'dark' });

      await tx.commit();

      // Verify temp directory was created
      expect(mockMkdir).toHaveBeenCalled();
      const mkdirCalls = mockMkdir.mock.calls;
      const tempDirCall = mkdirCalls.find(call => call[0].includes('.tx-'));
      expect(tempDirCall).toBeDefined();

      // Verify final files were written
      expect(mockFileSystem.has('db/sessions.json')).toBe(true);
      expect(mockFileSystem.has('db/settings.json')).toBe(true);

      // Verify temp directory was cleaned up
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should handle delete operations', async () => {
      // Create existing file
      mockFileSystem.set('db/old-data.json', JSON.stringify({ data: 'old' }));

      const tx = await adapter.beginTransaction();
      tx.delete('old-data');

      await tx.commit();

      // File should be removed
      expect(mockFileSystem.has('db/old-data.json')).toBe(false);
    });

    it('should create backups when overwriting existing files', async () => {
      // Create existing file
      const existingData = JSON.stringify({
        version: 1,
        checksum: 'old',
        timestamp: Date.now(),
        compressed: false,
        data: { sessions: [{ id: 'old' }] }
      }, null, 2);
      mockFileSystem.set('db/sessions.json', existingData);

      const tx = await adapter.beginTransaction();
      tx.save('sessions', { sessions: [{ id: 'new' }] });

      await tx.commit();

      // Verify backup was created
      const backupFiles = Array.from(mockFileSystem.keys()).filter(k =>
        k.includes('sessions.') && k.includes('.backup.json')
      );
      expect(backupFiles.length).toBeGreaterThan(0);

      // Verify backup contains old data
      const backupContent = mockFileSystem.get(backupFiles[0]);
      expect(backupContent).toBe(existingData);
    });

    it('should rollback on error', async () => {
      // Make writeTextFile fail for final writes (not temp or backup)
      mockWriteTextFile.mockImplementation((path: string, content: string) => {
        // Allow temp writes and backup writes
        if (path.includes('.tx-') || path.includes('.backup.json')) {
          mockFileSystem.set(path, content);
          return Promise.resolve();
        }
        // Fail on final writes to db/sessions.json
        if (path === 'db/sessions.json') {
          return Promise.reject(new Error('Disk full'));
        }
        mockFileSystem.set(path, content);
        return Promise.resolve();
      });

      const tx = await adapter.beginTransaction();
      tx.save('sessions', { sessions: [] });

      await expect(tx.commit()).rejects.toThrow('Disk full');

      // Temp directory should be cleaned up
      expect(mockRemove).toHaveBeenCalled();
      const removeCalls = mockRemove.mock.calls;
      const tempDirRemoval = removeCalls.find(call => call[0] && call[0].includes('.tx-'));
      expect(tempDirRemoval).toBeDefined();
    });
  });

  describe('Transaction Rollback', () => {
    it('should clear operations on rollback', async () => {
      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [] });
      tx.save('settings', { theme: 'dark' });

      await tx.rollback();

      expect(tx.getPendingOperations()).toBe(0);

      // No files should be written
      expect(mockWriteTextFile).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw on operations after commit', async () => {
      const tx = await adapter.beginTransaction();
      await tx.commit();

      expect(() => tx.save('key', {})).toThrow('already committed or rolled back');
    });

    it('should handle temp directory creation failure', async () => {
      mockMkdir.mockRejectedValueOnce(new Error('Permission denied'));

      const tx = await adapter.beginTransaction();
      tx.save('sessions', { sessions: [] });

      await expect(tx.commit()).rejects.toThrow();
    });
  });
});
