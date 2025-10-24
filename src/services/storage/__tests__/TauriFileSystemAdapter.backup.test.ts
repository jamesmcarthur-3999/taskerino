/**
 * Tests for Phase 1.1: Mandatory Backup System
 *
 * This test suite validates the new backup system implementation:
 * 1. Backups throw errors on failure (no silent failures)
 * 2. Backups are verified by reading them back
 * 3. Old backups are rotated (keep last 10)
 * 4. Timestamped backup filenames are used
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir, remove, readDir } from '@tauri-apps/plugin-fs';

// Mock the Tauri plugin
vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    AppData: 15
  },
  exists: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn(),
  readDir: vi.fn()
}));

// Mock compression utils
vi.mock('../compressionUtils', () => ({
  compressData: vi.fn((data) => Promise.resolve(data)),
  decompressData: vi.fn((data) => Promise.resolve(data)),
  isCompressed: vi.fn(() => false)
}));

import { TauriFileSystemAdapter } from '../TauriFileSystemAdapter';

describe('Phase 1.1: Mandatory Backup System', () => {
  let adapter: TauriFileSystemAdapter;
  let mockFileSystem: Map<string, string>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    mockFileSystem = new Map();

    // Setup file system simulation
    (exists as any).mockImplementation((path: string) => {
      return Promise.resolve(mockFileSystem.has(path));
    });

    (readTextFile as any).mockImplementation((path: string) => {
      const content = mockFileSystem.get(path);
      if (!content) {
        throw new Error(`File not found: ${path}`);
      }
      return Promise.resolve(content);
    });

    (writeTextFile as any).mockImplementation((path: string, content: string) => {
      mockFileSystem.set(path, content);
      return Promise.resolve();
    });

    (mkdir as any).mockImplementation(() => Promise.resolve());

    (remove as any).mockImplementation((path: string) => {
      mockFileSystem.delete(path);
      return Promise.resolve();
    });

    (readDir as any).mockImplementation((path: string) => {
      const entries = Array.from(mockFileSystem.keys())
        .filter(key => key.startsWith(path))
        .map(key => ({
          name: key.replace(`${path}/`, '')
        }));
      return Promise.resolve(entries);
    });

    // Mock window.__TAURI__ for isAvailable check
    (global as any).window = {
      __TAURI__: true
    };

    adapter = new TauriFileSystemAdapter();
    await adapter.init();
  });

  afterEach(() => {
    delete (global as any).window;
  });

  describe('Backup Creation and Verification', () => {
    it('should create timestamped backup when saving over existing file', async () => {
      // Arrange: Create an existing file
      const collection = 'sessions';
      const oldData = { sessions: [{ id: '1', name: 'Old Session' }] };
      const newData = { sessions: [{ id: '1', name: 'New Session' }] };

      // Simulate existing file
      const existingPath = 'db/sessions.json';
      const existingContent = JSON.stringify({
        version: 1,
        checksum: 'old-checksum',
        timestamp: Date.now(),
        compressed: false,
        data: oldData
      }, null, 2);
      mockFileSystem.set(existingPath, existingContent);

      // Act: Save new data (should create backup)
      await adapter.save(collection, newData);

      // Assert: Verify timestamped backup was created
      const backupFiles = Array.from(mockFileSystem.keys()).filter(key =>
        key.includes('sessions.') && key.includes('.backup.json')
      );

      expect(backupFiles.length).toBeGreaterThan(0);
      expect(backupFiles[0]).toMatch(/db\/sessions\.\d+\.backup\.json/);
    });

    it('should verify backup by reading it back', async () => {
      // Arrange: Mock writeTextFile to simulate a corrupted backup write
      let writeCallCount = 0;
      (writeTextFile as any).mockImplementation((path: string, content: string) => {
        writeCallCount++;

        // Corrupt the backup write (simulate disk error)
        if (path.includes('.backup.json')) {
          mockFileSystem.set(path, 'CORRUPTED_DATA');
        } else {
          mockFileSystem.set(path, content);
        }
        return Promise.resolve();
      });

      const collection = 'sessions';
      const oldData = { sessions: [{ id: '1' }] };
      const newData = { sessions: [{ id: '2' }] };

      // Simulate existing file
      const existingPath = 'db/sessions.json';
      mockFileSystem.set(existingPath, JSON.stringify({
        version: 1,
        checksum: 'old',
        timestamp: Date.now(),
        compressed: false,
        data: oldData
      }, null, 2));

      // Act & Assert: Save should throw because backup verification fails
      await expect(adapter.save(collection, newData)).rejects.toThrow(/CRITICAL.*Backup failed/);
    });

    it('should throw error if backup creation fails', async () => {
      // Arrange: Mock writeTextFile to fail for backup files
      (writeTextFile as any).mockImplementation((path: string, content: string) => {
        if (path.includes('.backup.json')) {
          return Promise.reject(new Error('Disk full'));
        }
        mockFileSystem.set(path, content);
        return Promise.resolve();
      });

      const collection = 'sessions';
      const oldData = { sessions: [{ id: '1' }] };
      const newData = { sessions: [{ id: '2' }] };

      // Simulate existing file
      mockFileSystem.set('db/sessions.json', JSON.stringify({
        version: 1,
        data: oldData
      }, null, 2));

      // Act & Assert: Should throw CRITICAL error
      await expect(adapter.save(collection, newData)).rejects.toThrow(/CRITICAL.*Backup failed.*Disk full/);
    });

    it('should NOT create backup if file does not exist (new file)', async () => {
      // Arrange: No existing file
      const collection = 'new_collection';
      const data = { items: [{ id: '1' }] };

      // Act: Save new file
      await adapter.save(collection, data);

      // Assert: No backup should be created
      const backupFiles = Array.from(mockFileSystem.keys()).filter(key =>
        key.includes('.backup.json')
      );

      expect(backupFiles.length).toBe(0);
    });
  });

  describe('Backup Rotation', () => {
    it('should keep last 10 backups and delete older ones', async () => {
      // Arrange: Create 15 existing backups
      const collection = 'sessions';
      const now = Date.now();

      for (let i = 0; i < 15; i++) {
        const timestamp = now - (15 - i) * 1000; // Oldest first
        const backupPath = `db/${collection}.${timestamp}.backup.json`;
        mockFileSystem.set(backupPath, JSON.stringify({ backup: i }));
      }

      // Setup readDir to return all backups
      (readDir as any).mockImplementation(() => {
        const entries = Array.from(mockFileSystem.keys())
          .filter(key => key.startsWith('db/') && key.includes('.backup.json'))
          .map(key => ({ name: key.replace('db/', '') }));
        return Promise.resolve(entries);
      });

      // Create existing file to trigger backup
      const existingPath = 'db/sessions.json';
      mockFileSystem.set(existingPath, JSON.stringify({
        version: 1,
        data: { sessions: [] }
      }, null, 2));

      // Act: Save new data (will trigger rotation)
      await adapter.save(collection, { sessions: [{ id: 'new' }] });

      // Assert: Should have exactly 10 backups remaining (plus the new one just created)
      const remainingBackups = Array.from(mockFileSystem.keys()).filter(key =>
        key.includes('sessions.') && key.includes('.backup.json')
      );

      expect(remainingBackups.length).toBeLessThanOrEqual(11); // 10 old + 1 new
    });

    it('should keep most recent backups when rotating', async () => {
      // Arrange: Create backups with known timestamps
      const collection = 'sessions';
      const timestamps = [
        1000, // Oldest
        2000,
        3000,
        4000,
        5000, // This and newer should be kept
        6000,
        7000,
        8000,
        9000,
        10000,
        11000,
        12000,
        13000,
        14000,
        15000  // Newest
      ];

      timestamps.forEach(ts => {
        const backupPath = `db/${collection}.${ts}.backup.json`;
        mockFileSystem.set(backupPath, JSON.stringify({ timestamp: ts }));
      });

      // Setup readDir
      (readDir as any).mockImplementation(() => {
        const entries = Array.from(mockFileSystem.keys())
          .filter(key => key.startsWith('db/') && key.includes('.backup.json'))
          .map(key => ({ name: key.replace('db/', '') }));
        return Promise.resolve(entries);
      });

      // Create existing file
      mockFileSystem.set('db/sessions.json', JSON.stringify({
        version: 1,
        data: { sessions: [] }
      }, null, 2));

      // Act: Save to trigger rotation
      await adapter.save(collection, { sessions: [] });

      // Assert: Oldest backups (1000-5000) should be deleted
      const remainingBackups = Array.from(mockFileSystem.keys())
        .filter(key => key.includes('sessions.') && key.includes('.backup.json'));

      // Should NOT contain old timestamps
      expect(remainingBackups.some(b => b.includes('.1000.'))).toBe(false);
      expect(remainingBackups.some(b => b.includes('.2000.'))).toBe(false);
      expect(remainingBackups.some(b => b.includes('.3000.'))).toBe(false);
      expect(remainingBackups.some(b => b.includes('.4000.'))).toBe(false);
    });

    it('should handle rotation failure gracefully (non-critical)', async () => {
      // Arrange: Mock readDir to fail
      (readDir as any).mockImplementation(() => {
        return Promise.reject(new Error('Permission denied'));
      });

      const collection = 'sessions';
      mockFileSystem.set('db/sessions.json', JSON.stringify({
        version: 1,
        data: { sessions: [] }
      }, null, 2));

      // Act & Assert: Save should succeed even if rotation fails
      await expect(adapter.save(collection, { sessions: [] })).resolves.not.toThrow();
    });
  });

  describe('Integration: Full Backup Workflow', () => {
    it('should complete full backup workflow: create, verify, rotate', async () => {
      // Arrange: Start with 5 existing backups
      const collection = 'sessions';
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        const ts = now - (5 - i) * 1000;
        mockFileSystem.set(`db/${collection}.${ts}.backup.json`, JSON.stringify({ i }));
      }

      // Setup readDir
      (readDir as any).mockImplementation(() => {
        const entries = Array.from(mockFileSystem.keys())
          .filter(key => key.startsWith('db/') && key.includes('.backup.json'))
          .map(key => ({ name: key.replace('db/', '') }));
        return Promise.resolve(entries);
      });

      // Create existing file
      const oldData = { sessions: [{ id: 'old' }] };
      mockFileSystem.set('db/sessions.json', JSON.stringify({
        version: 1,
        checksum: 'old',
        timestamp: now - 10000,
        compressed: false,
        data: oldData
      }, null, 2));

      // Act: Save new data
      const newData = { sessions: [{ id: 'new' }] };
      await adapter.save(collection, newData);

      // Assert:
      // 1. New backup created
      const backups = Array.from(mockFileSystem.keys())
        .filter(key => key.includes('sessions.') && key.includes('.backup.json'));
      expect(backups.length).toBe(6); // 5 old + 1 new

      // 2. Main file updated
      const mainFile = mockFileSystem.get('db/sessions.json');
      expect(mainFile).toBeDefined();
      const parsed = JSON.parse(mainFile!);
      // The data is double-stringified due to compression mock, so parse it again
      const actualData = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
      expect(actualData).toEqual(newData);

      // 3. Backup contains old data
      const latestBackup = backups
        .map(path => {
          const parts = path.split('.');
          const ts = parseInt(parts[parts.length - 3]);
          return { path, ts };
        })
        .sort((a, b) => b.ts - a.ts)[0];

      const backupContent = mockFileSystem.get(latestBackup.path);
      expect(backupContent).toBeDefined();
      const backupParsed = JSON.parse(backupContent!);
      expect(backupParsed.data).toEqual(oldData);
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error message on backup failure', async () => {
      // Arrange: Mock backup write to fail
      (writeTextFile as any).mockImplementation((path: string) => {
        if (path.includes('.backup.json')) {
          return Promise.reject(new Error('Insufficient disk space'));
        }
        return Promise.resolve();
      });

      const collection = 'sessions';
      mockFileSystem.set('db/sessions.json', JSON.stringify({
        version: 1,
        data: { sessions: [] }
      }, null, 2));

      // Act & Assert: Error message should be clear
      try {
        await adapter.save(collection, { sessions: [] });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('CRITICAL');
        expect(error.message).toContain('Backup failed');
        expect(error.message).toContain('sessions');
        expect(error.message).toContain('Insufficient disk space');
      }
    });

    it('should provide clear error message on verification failure', async () => {
      // Arrange: Mock writeTextFile to write backup, but readTextFile to return wrong content on verification
      const originalWrite = writeTextFile as any;
      const writtenBackupPath: string[] = [];

      (writeTextFile as any).mockImplementation((path: string, content: string) => {
        if (path.includes('.backup.json')) {
          writtenBackupPath.push(path);
        }
        mockFileSystem.set(path, content);
        return Promise.resolve();
      });

      (readTextFile as any).mockImplementation((path: string) => {
        const content = mockFileSystem.get(path);
        if (!content) {
          throw new Error(`File not found: ${path}`);
        }

        // Return corrupted content on backup verification read (second read of backup)
        if (path.includes('.backup.json') && writtenBackupPath.includes(path)) {
          return Promise.resolve('CORRUPTED_BACKUP_CONTENT');
        }

        return Promise.resolve(content);
      });

      const collection = 'sessions';
      mockFileSystem.set('db/sessions.json', JSON.stringify({
        version: 1,
        data: { sessions: [] }
      }, null, 2));

      // Act & Assert
      try {
        await adapter.save(collection, { sessions: [] });
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('CRITICAL');
        expect(error.message).toContain('Backup failed');
        expect(error.message).toContain('verification failed');
      }
    });
  });
});
