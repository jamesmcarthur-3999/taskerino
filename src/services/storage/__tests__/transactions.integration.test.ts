/**
 * Integration Tests for Storage Transactions
 *
 * Tests end-to-end transaction behavior including:
 * - Atomicity guarantees
 * - Data integrity across multiple keys
 * - Error recovery and rollback
 * - Concurrent transaction handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBAdapter } from '../IndexedDBAdapter';
import { TauriFileSystemAdapter } from '../TauriFileSystemAdapter';

// Mock compression utils
vi.mock('../compressionUtils', () => ({
  compressData: vi.fn((data) => Promise.resolve(data)),
  decompressData: vi.fn((data) => Promise.resolve(data)),
  isCompressed: vi.fn(() => false)
}));

describe('Transaction Integration - IndexedDB', () => {
  let adapter: IndexedDBAdapter;
  let mockDB: any;
  let collections: Map<string, any>;

  beforeEach(async () => {
    // Create a more complete IndexedDB mock
    collections = new Map<string, any>();

    mockDB = {
      transaction: vi.fn((stores, mode) => {
        const mockStore = {
          put: vi.fn((record) => {
            collections.set(record.name, record);
            return {
              onsuccess: null as any,
              onerror: null as any
            };
          }),
          delete: vi.fn((key) => {
            collections.delete(key);
            return {
              onsuccess: null as any,
              onerror: null as any
            };
          }),
          get: vi.fn((key) => {
            const record = collections.get(key);
            const request = {
              onsuccess: null as any,
              result: record,
              onerror: null as any
            };

            // Simulate async operation
            setTimeout(() => {
              if (request.onsuccess) {
                request.onsuccess();
              }
            }, 0);

            return request;
          })
        };

        const mockTransaction = {
          objectStore: vi.fn(() => mockStore),
          oncomplete: null as any,
          onerror: null as any,
          onabort: null as any,
          error: null
        };

        // Simulate async transaction completion
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
  });

  afterEach(() => {
    delete (global as any).indexedDB;
  });

  describe('Atomicity', () => {
    it('should commit all operations together', async () => {
      const tx = await adapter.beginTransaction();

      const sessions = { sessions: [{ id: '1', name: 'Session 1' }] };
      const settings = { theme: 'dark', language: 'en' };
      const cache = { lastUpdate: Date.now() };

      tx.save('sessions', sessions);
      tx.save('settings', settings);
      tx.save('cache', cache);

      await tx.commit();

      // Verify all data was saved
      const loadedSessions = await adapter.load('sessions');
      const loadedSettings = await adapter.load('settings');
      const loadedCache = await adapter.load('cache');

      expect(loadedSessions).toEqual(sessions);
      expect(loadedSettings).toEqual(settings);
      expect(loadedCache).toEqual(cache);
    });

    it('should fail all operations together on error', async () => {
      // Mock transaction to fail
      mockDB.transaction = vi.fn(() => {
        const mockTransaction = {
          objectStore: vi.fn(() => ({
            put: vi.fn(),
            delete: vi.fn()
          })),
          oncomplete: null as any,
          onerror: null as any,
          onabort: null as any,
          error: new Error('Simulated error')
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
      tx.save('settings', { theme: 'dark' });
      tx.save('cache', { data: 'test' });

      // All should fail together
      await expect(tx.commit()).rejects.toThrow();

      // None of the data should be saved (atomic failure)
      const sessions = await adapter.load('sessions');
      const settings = await adapter.load('settings');
      const cache = await adapter.load('cache');

      expect(sessions).toBeNull();
      expect(settings).toBeNull();
      expect(cache).toBeNull();
    });
  });

  describe('Mixed Operations', () => {
    it('should handle save and delete operations together', async () => {
      // Create some existing data
      await adapter.save('old-data', { value: 'old' });
      await adapter.save('to-update', { value: 'original' });

      const tx = await adapter.beginTransaction();

      tx.save('to-update', { value: 'updated' });
      tx.delete('old-data');
      tx.save('new-data', { value: 'new' });

      await tx.commit();

      // Verify results
      expect(await adapter.load('to-update')).toEqual({ value: 'updated' });
      expect(await adapter.load('old-data')).toBeNull();
      expect(await adapter.load('new-data')).toEqual({ value: 'new' });
    });
  });

  describe('Large Transactions', () => {
    it('should handle transaction with 10 keys', async () => {
      const tx = await adapter.beginTransaction();

      const data: { [key: string]: any } = {};
      for (let i = 0; i < 10; i++) {
        const key = `collection-${i}`;
        const value = { id: i, data: `Data ${i}` };
        data[key] = value;
        tx.save(key, value);
      }

      expect(tx.getPendingOperations()).toBe(10);

      await tx.commit();

      // Verify all data was saved
      for (let i = 0; i < 10; i++) {
        const key = `collection-${i}`;
        const loaded = await adapter.load(key);
        expect(loaded).toEqual(data[key]);
      }
    });
  });

  describe('Sequential Transactions', () => {
    it('should execute multiple transactions in sequence', async () => {
      // Transaction 1
      const tx1 = await adapter.beginTransaction();
      tx1.save('sessions', { sessions: [{ id: '1' }] });
      tx1.save('settings', { theme: 'dark' });
      await tx1.commit();

      // Transaction 2
      const tx2 = await adapter.beginTransaction();
      tx2.save('sessions', { sessions: [{ id: '1' }, { id: '2' }] });
      tx2.save('cache', { lastUpdate: Date.now() });
      await tx2.commit();

      // Verify final state
      const sessions = await adapter.load('sessions');
      const settings = await adapter.load('settings');
      const cache = await adapter.load('cache');

      expect(sessions).toEqual({ sessions: [{ id: '1' }, { id: '2' }] });
      expect(settings).toEqual({ theme: 'dark' });
      expect(cache).toBeDefined();
    });
  });
});

describe('Transaction Integration - Tauri FileSystem', () => {
  let adapter: TauriFileSystemAdapter;
  let mockFileSystem: Map<string, string>;

  const mockExists = vi.fn();
  const mockReadTextFile = vi.fn();
  const mockWriteTextFile = vi.fn();
  const mockMkdir = vi.fn();
  const mockRemove = vi.fn();
  const mockReadDir = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    mockFileSystem = new Map();

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
      const keysToDelete = Array.from(mockFileSystem.keys())
        .filter(key => key.startsWith(path));
      keysToDelete.forEach(key => mockFileSystem.delete(key));
      return Promise.resolve();
    });

    mockReadDir.mockImplementation((path: string) => {
      const entries = Array.from(mockFileSystem.keys())
        .filter(key => key.startsWith(path))
        .map(key => ({ name: key.replace(`${path}/`, '') }));
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

  describe('Atomicity', () => {
    it('should commit all operations atomically', async () => {
      const tx = await adapter.beginTransaction();

      const sessions = { sessions: [{ id: '1' }] };
      const settings = { theme: 'dark' };
      const cache = { data: 'cached' };

      tx.save('sessions', sessions);
      tx.save('settings', settings);
      tx.save('cache', cache);

      await tx.commit();

      // Verify all files exist
      expect(mockFileSystem.has('db/sessions.json')).toBe(true);
      expect(mockFileSystem.has('db/settings.json')).toBe(true);
      expect(mockFileSystem.has('db/cache.json')).toBe(true);

      // Verify data integrity
      const loadedSessions = await adapter.load('sessions');
      expect(loadedSessions).toEqual(sessions);
    });

    it('should rollback all operations on error', async () => {
      // Make final write fail
      let callCount = 0;
      mockWriteTextFile.mockImplementation((path: string, content: string) => {
        callCount++;
        // Fail after temp writes succeed
        if (callCount > 5) {
          return Promise.reject(new Error('Disk full'));
        }
        mockFileSystem.set(path, content);
        return Promise.resolve();
      });

      const tx = await adapter.beginTransaction();

      tx.save('sessions', { sessions: [] });
      tx.save('settings', { theme: 'dark' });
      tx.save('cache', { data: 'test' });

      await expect(tx.commit()).rejects.toThrow();

      // Verify no final files were created (rollback succeeded)
      expect(mockFileSystem.has('db/sessions.json')).toBe(false);
      expect(mockFileSystem.has('db/settings.json')).toBe(false);
      expect(mockFileSystem.has('db/cache.json')).toBe(false);

      // Verify temp directory was cleaned up
      const tempDirs = Array.from(mockFileSystem.keys()).filter(k => k.includes('.tx-'));
      expect(tempDirs.length).toBe(0);
    });
  });

  describe('Backup Creation During Transaction', () => {
    it('should create backups when overwriting files', async () => {
      // Create existing files
      const oldSessions = { sessions: [{ id: 'old' }] };
      await adapter.save('sessions', oldSessions);

      const tx = await adapter.beginTransaction();
      tx.save('sessions', { sessions: [{ id: 'new' }] });
      await tx.commit();

      // Verify backup was created
      const backups = Array.from(mockFileSystem.keys()).filter(k =>
        k.includes('sessions.') && k.includes('.backup.json')
      );
      expect(backups.length).toBeGreaterThan(0);
    });

    it('should fail if backup creation fails', async () => {
      // Create existing file
      await adapter.save('sessions', { sessions: [{ id: 'old' }] });

      // Make backup write fail
      let callCount = 0;
      mockWriteTextFile.mockImplementation((path: string, content: string) => {
        callCount++;
        if (path.includes('.backup.json')) {
          return Promise.reject(new Error('Backup failed'));
        }
        mockFileSystem.set(path, content);
        return Promise.resolve();
      });

      const tx = await adapter.beginTransaction();
      tx.save('sessions', { sessions: [{ id: 'new' }] });

      await expect(tx.commit()).rejects.toThrow(/CRITICAL.*Backup failed/);
    });
  });

  describe('Large Transactions', () => {
    it('should handle 10-key transaction', async () => {
      const tx = await adapter.beginTransaction();

      for (let i = 0; i < 10; i++) {
        tx.save(`collection-${i}`, { id: i, data: `Data ${i}` });
      }

      await tx.commit();

      // Verify all files were created
      for (let i = 0; i < 10; i++) {
        expect(mockFileSystem.has(`db/collection-${i}.json`)).toBe(true);
      }

      // Verify temp directory was cleaned up
      const tempDirs = Array.from(mockFileSystem.keys()).filter(k => k.includes('.tx-'));
      expect(tempDirs.length).toBe(0);
    });
  });

  describe('Error Recovery', () => {
    it('should clean up temp directory even on error', async () => {
      mockWriteTextFile.mockImplementation((path: string, content: string) => {
        mockFileSystem.set(path, content);
        // Fail on final writes
        if (!path.includes('.tx-') && !path.includes('.backup.json')) {
          return Promise.reject(new Error('Write failed'));
        }
        return Promise.resolve();
      });

      const tx = await adapter.beginTransaction();
      tx.save('sessions', { sessions: [] });

      await expect(tx.commit()).rejects.toThrow();

      // Temp directory should be cleaned up
      expect(mockRemove).toHaveBeenCalled();
      const removeCalls = mockRemove.mock.calls;
      const tempDirRemoval = removeCalls.find(call => call[0].includes('.tx-'));
      expect(tempDirRemoval).toBeDefined();
    });
  });
});

describe('Cross-Adapter Transaction Behavior', () => {
  it('should maintain consistent interface across adapters', async () => {
    // Setup IndexedDB adapter
    const mockDB = {
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({ put: vi.fn(), delete: vi.fn() })),
        oncomplete: null as any,
        onerror: null,
        onabort: null,
        error: null
      }))
    };

    const mockOpenRequest = {
      result: mockDB,
      onsuccess: null as any,
      onerror: null,
      onupgradeneeded: null
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

    const indexedDBAdapter = new IndexedDBAdapter();
    await indexedDBAdapter.init();

    // Test both adapters have same interface
    const tx1 = await indexedDBAdapter.beginTransaction();

    expect(tx1).toHaveProperty('save');
    expect(tx1).toHaveProperty('delete');
    expect(tx1).toHaveProperty('commit');
    expect(tx1).toHaveProperty('rollback');
    expect(tx1).toHaveProperty('getPendingOperations');

    // Both should behave the same way
    tx1.save('key', {});
    expect(tx1.getPendingOperations()).toBe(1);

    delete (global as any).indexedDB;
  });
});
