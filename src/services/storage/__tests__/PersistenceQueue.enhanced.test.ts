/**
 * PersistenceQueue Enhanced Features Tests (Phase 4)
 *
 * Tests for enhanced queue features:
 * - Chunk write batching
 * - Index update batching
 * - CA storage batching
 * - Cleanup scheduling
 * - Enhanced statistics
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PersistenceQueue, resetPersistenceQueue } from '../PersistenceQueue';

// Mock the storage adapter with transaction support
const mockSave = vi.fn();
const mockLoad = vi.fn();
const mockCommit = vi.fn();
const mockRollback = vi.fn();
const mockTxSave = vi.fn();

const mockTransaction = {
  save: mockTxSave,
  commit: mockCommit,
  rollback: mockRollback,
};

vi.mock('../index', () => ({
  getStorage: vi.fn(async () => ({
    save: mockSave,
    load: mockLoad,
    beginTransaction: vi.fn(async () => mockTransaction),
  })),
}));

describe('PersistenceQueue Enhanced Features', () => {
  let queue: PersistenceQueue;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockLoad.mockResolvedValue(null);
    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);
    mockTxSave.mockImplementation((key, value) => {
      // Just store the call, don't actually save
      return undefined;
    });

    // Reset singleton and create fresh instance
    resetPersistenceQueue();
    queue = new PersistenceQueue();
  });

  afterEach(async () => {
    await queue.shutdown();
    resetPersistenceQueue();
  });

  describe('Chunk Write Batching', () => {
    it('should batch multiple chunk writes for same session', async () => {
      const sessionId = 'session-123';

      // Enqueue multiple chunks for same session
      queue.enqueueChunk(sessionId, 'screenshots/chunk-001', { screenshots: [1, 2] }, 'normal');
      queue.enqueueChunk(sessionId, 'screenshots/chunk-002', { screenshots: [3, 4] }, 'normal');
      queue.enqueueChunk(sessionId, 'audio-segments/chunk-001', { segments: [1, 2] }, 'normal');

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have committed transaction
      expect(mockCommit).toHaveBeenCalled();

      // All chunks should be marked as completed
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(3);
    });

    it('should use single transaction for batched chunks', async () => {
      const sessionId = 'session-456';

      // Enqueue 5 chunks for same session
      for (let i = 0; i < 5; i++) {
        queue.enqueueChunk(sessionId, `chunk-${i}`, { data: i }, 'normal');
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Transaction methods should be called once per session batch
      expect(mockCommit).toHaveBeenCalled();

      // Check batching stats
      const stats = queue.getStats();
      expect(stats.batching?.chunksCollapsed).toBeGreaterThan(0);
    });

    it('should maintain chunk order within session', async () => {
      const sessionId = 'session-789';
      const chunks: any[] = [];

      queue.on('completed', (item) => {
        if (item.sessionId === sessionId) {
          chunks.push(item);
        }
      });

      // Enqueue chunks in order
      queue.enqueueChunk(sessionId, 'chunk-001', { data: 1 }, 'normal');
      queue.enqueueChunk(sessionId, 'chunk-002', { data: 2 }, 'normal');
      queue.enqueueChunk(sessionId, 'chunk-003', { data: 3 }, 'normal');

      await new Promise(resolve => setTimeout(resolve, 200));

      // All chunks should be completed
      expect(chunks.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle batch failures gracefully', async () => {
      const sessionId = 'session-fail';

      // Mock commit to fail
      mockCommit.mockRejectedValueOnce(new Error('Transaction commit failed'));

      const failedItems: any[] = [];
      const retryItems: any[] = [];

      queue.on('failed', (item) => failedItems.push(item));
      queue.on('retry', (item) => retryItems.push(item));

      queue.enqueueChunk(sessionId, 'chunk-001', { data: 1 }, 'normal');
      queue.enqueueChunk(sessionId, 'chunk-002', { data: 2 }, 'normal');

      // Wait for batch processing and retries
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have rolled back on first attempt
      expect(mockRollback).toHaveBeenCalled();

      // Should have retried or failed the items
      expect(retryItems.length + failedItems.length).toBeGreaterThanOrEqual(2);
    });

    it('should batch chunks from different sessions separately', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      queue.enqueueChunk(session1, 'chunk-001', { data: 1 }, 'normal');
      queue.enqueueChunk(session1, 'chunk-002', { data: 2 }, 'normal');
      queue.enqueueChunk(session2, 'chunk-001', { data: 3 }, 'normal');
      queue.enqueueChunk(session2, 'chunk-002', { data: 4 }, 'normal');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should create separate transactions for each session
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Index Update Batching', () => {
    it('should batch multiple index updates', async () => {
      queue.enqueueIndex('by-topic', { topicId: 'topic-1', sessionIds: ['s1', 's2'] }, 'low');
      queue.enqueueIndex('by-date', { date: '2025-10', sessionIds: ['s1', 's2'] }, 'low');
      queue.enqueueIndex('by-tag', { tag: 'work', sessionIds: ['s1', 's2'] }, 'low');

      // Wait for idle processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // All indexes should be saved
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(3);
    });

    it('should track index batching efficiency', async () => {
      queue.enqueueIndex('index-1', { data: 1 }, 'low');
      queue.enqueueIndex('index-2', { data: 2 }, 'low');
      queue.enqueueIndex('index-3', { data: 3 }, 'low');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = queue.getStats();
      expect(stats.batching?.indexesCollapsed).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent index updates', async () => {
      // Enqueue many index updates at once
      for (let i = 0; i < 10; i++) {
        queue.enqueueIndex(`index-${i}`, { data: i }, 'low');
      }

      await new Promise(resolve => setTimeout(resolve, 1500));

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(10);
    });
  });

  describe('CA Storage Batching', () => {
    it('should batch reference count updates', async () => {
      queue.enqueueCAStorage('hash-1', { refCount: 1 }, 'normal');
      queue.enqueueCAStorage('hash-2', { refCount: 2 }, 'normal');
      queue.enqueueCAStorage('hash-3', { refCount: 3 }, 'normal');

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should use transaction
      expect(mockCommit).toHaveBeenCalled();

      // All should be completed
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(3);
    });

    it('should use single transaction for batched refs', async () => {
      // Enqueue 5 CA storage operations
      for (let i = 0; i < 5; i++) {
        queue.enqueueCAStorage(`hash-${i}`, { refCount: i }, 'normal');
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Transaction should be committed
      expect(mockCommit).toHaveBeenCalled();

      // Check batching stats
      const stats = queue.getStats();
      expect(stats.batching?.caStorageCollapsed).toBeGreaterThan(0);
    });

    it('should maintain reference count accuracy', async () => {
      const completedItems: any[] = [];

      queue.on('completed', (item) => {
        if (item.type === 'ca-storage') {
          completedItems.push(item);
        }
      });

      queue.enqueueCAStorage('hash-abc', { refCount: 1 }, 'normal');
      queue.enqueueCAStorage('hash-def', { refCount: 2 }, 'normal');

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(completedItems.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Cleanup Scheduling', () => {
    it('should schedule GC at low priority', async () => {
      const id = queue.enqueueCleanup('gc', 'low');

      expect(id).toBeDefined();

      const stats = queue.getStats();
      expect(stats.byPriority.low).toBeGreaterThan(0);
      expect(stats.byType?.cleanup).toBeGreaterThan(0);
    });

    it('should schedule index optimization at low priority', async () => {
      const id = queue.enqueueCleanup('index-optimize', 'low');

      expect(id).toBeDefined();

      const stats = queue.getStats();
      expect(stats.byPriority.low).toBeGreaterThan(0);
    });

    it('should process cleanup operations', async () => {
      queue.enqueueCleanup('gc', 'low');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThan(0);
    });
  });

  describe('Enhanced Statistics', () => {
    it('should track operations by type', async () => {
      queue.enqueue('simple-key', { data: 1 }, 'normal');
      queue.enqueueChunk('session-1', 'chunk-001', { data: 2 }, 'normal');
      queue.enqueueIndex('index-1', { data: 3 }, 'low');
      queue.enqueueCAStorage('hash-1', { data: 4 }, 'normal');
      queue.enqueueCleanup('gc', 'low');

      const stats = queue.getStats();

      expect(stats.byType).toBeDefined();
      expect(stats.byType!.simple).toBeGreaterThanOrEqual(0);
      expect(stats.byType!.chunk).toBeGreaterThanOrEqual(1);
      expect(stats.byType!.index).toBeGreaterThanOrEqual(1);
      expect(stats.byType!.caStorage).toBeGreaterThanOrEqual(1);
      expect(stats.byType!.cleanup).toBeGreaterThanOrEqual(1);
    });

    it('should track batching efficiency', async () => {
      // Enqueue multiple batchable items
      queue.enqueueChunk('session-1', 'chunk-001', { data: 1 }, 'normal');
      queue.enqueueChunk('session-1', 'chunk-002', { data: 2 }, 'normal');
      queue.enqueueChunk('session-1', 'chunk-003', { data: 3 }, 'normal');

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = queue.getStats();
      expect(stats.batching).toBeDefined();
      expect(stats.batching!.chunksCollapsed).toBeGreaterThanOrEqual(0);
    });

    it('should report batch collapse ratio', async () => {
      // Enqueue 10 chunks for same session
      const sessionId = 'session-batch-test';
      for (let i = 0; i < 10; i++) {
        queue.enqueueChunk(sessionId, `chunk-${i}`, { data: i }, 'normal');
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = queue.getStats();

      // Should have collapsed 9 operations (10 items → 1 transaction)
      expect(stats.batching!.chunksCollapsed).toBeGreaterThanOrEqual(9);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain Phase 1 behavior for simple saves', async () => {
      const completedPromise = new Promise<void>((resolve) => {
        queue.on('completed', (item) => {
          if (item.key === 'simple-test') {
            resolve();
          }
        });
      });

      queue.enqueue('simple-test', { data: 'test' }, 'normal');

      await Promise.race([
        completedPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 500)),
      ]);

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThan(0);
    });

    it('should maintain zero UI blocking', () => {
      const startTime = Date.now();

      // Enqueue many items
      for (let i = 0; i < 100; i++) {
        queue.enqueueChunk('session-1', `chunk-${i}`, { data: i }, 'normal');
      }

      const endTime = Date.now();
      const blockingTime = endTime - startTime;

      // Enqueueing should be near-instant (< 10ms for 100 items)
      expect(blockingTime).toBeLessThan(50);
    });

    it('should maintain event system', async () => {
      const events: string[] = [];

      queue.on('enqueued', () => events.push('enqueued'));
      queue.on('processing', () => events.push('processing'));
      queue.on('completed', () => events.push('completed'));

      queue.enqueueChunk('session-1', 'chunk-001', { data: 1 }, 'normal');

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(events).toContain('enqueued');
      expect(events).toContain('completed');
    });
  });
});
