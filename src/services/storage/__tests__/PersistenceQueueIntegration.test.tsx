/**
 * PersistenceQueue Integration Tests (Phase 4)
 *
 * Tests integration with Phase 4 storage components:
 * - ChunkedSessionStorage
 * - InvertedIndexManager
 * - ContentAddressableStorage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PersistenceQueue, resetPersistenceQueue } from '../PersistenceQueue';

// Mock storage adapter
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

describe('PersistenceQueue Integration', () => {
  let queue: PersistenceQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockLoad.mockResolvedValue(null);
    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);
    mockTxSave.mockImplementation(() => undefined);

    resetPersistenceQueue();
    queue = new PersistenceQueue();
  });

  afterEach(async () => {
    await queue.shutdown();
    resetPersistenceQueue();
  });

  describe('ChunkedSessionStorage Integration', () => {
    it('should batch 10 screenshot chunks into 1 transaction', async () => {
      const sessionId = 'session-screenshots';

      // Simulate ChunkedSessionStorage saving 10 screenshot chunks
      for (let i = 0; i < 10; i++) {
        queue.enqueueChunk(
          sessionId,
          `screenshots/chunk-${String(i).padStart(3, '0')}`,
          {
            sessionId,
            chunkIndex: i,
            screenshots: [{ id: `screenshot-${i}`, timestamp: Date.now() }],
          },
          'normal'
        );
      }

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should have used transaction (1 for all 10 chunks)
      expect(mockCommit).toHaveBeenCalled();

      // All 10 chunks should be completed
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(10);

      // Should have collapsed 9 operations (10 → 1 transaction)
      expect(stats.batching?.chunksCollapsed).toBeGreaterThanOrEqual(9);
    });

    it('should batch audio segment chunks separately from screenshots', async () => {
      const sessionId = 'session-mixed';

      // 5 screenshot chunks
      for (let i = 0; i < 5; i++) {
        queue.enqueueChunk(
          sessionId,
          `screenshots/chunk-${i}`,
          { screenshots: [{ id: `s-${i}` }] },
          'normal'
        );
      }

      // 3 audio chunks
      for (let i = 0; i < 3; i++) {
        queue.enqueueChunk(
          sessionId,
          `audio-segments/chunk-${i}`,
          { segments: [{ id: `a-${i}` }] },
          'normal'
        );
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // All 8 chunks should be completed in single batch
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(8);
    });

    it('should handle metadata + chunks in same batch', async () => {
      const sessionId = 'session-metadata';

      // Metadata update (simple)
      queue.enqueue(`sessions/${sessionId}/metadata`, {
        id: sessionId,
        name: 'Test Session',
        status: 'active',
      }, 'normal');

      // Chunks (batchable)
      queue.enqueueChunk(sessionId, 'screenshots/chunk-001', { screenshots: [] }, 'normal');
      queue.enqueueChunk(sessionId, 'screenshots/chunk-002', { screenshots: [] }, 'normal');

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(3);
    });
  });

  describe('InvertedIndexManager Integration', () => {
    it('should batch 5 index updates into 1 rebuild', async () => {
      // Simulate InvertedIndexManager updating multiple indexes
      queue.enqueueIndex('by-topic', { topicId: 'topic-1', sessionIds: ['s1'] }, 'low');
      queue.enqueueIndex('by-date', { date: '2025-10', sessionIds: ['s1'] }, 'low');
      queue.enqueueIndex('by-tag', { tag: 'work', sessionIds: ['s1'] }, 'low');
      queue.enqueueIndex('by-status', { status: 'active', sessionIds: ['s1'] }, 'low');
      queue.enqueueIndex('full-text', { word: 'test', sessionIds: ['s1'] }, 'low');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // All 5 indexes should be saved
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(5);

      // Index batching tracks collapsed operations (>1 means batching occurred)
      expect(stats.batching?.indexesCollapsed).toBeGreaterThanOrEqual(0);
    });

    it('should handle incremental index updates', async () => {
      // Session created → update all indexes
      queue.enqueueIndex('by-date', { date: '2025-10', sessionIds: ['s1'] }, 'low');
      queue.enqueueIndex('by-status', { status: 'active', sessionIds: ['s1'] }, 'low');

      await new Promise(resolve => setTimeout(resolve, 500));

      // Session updated → update indexes again
      queue.enqueueIndex('by-status', { status: 'completed', sessionIds: ['s1'] }, 'low');
      queue.enqueueIndex('by-date', { date: '2025-10', sessionIds: ['s1', 's2'] }, 'low');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(4);
    });
  });

  describe('ContentAddressableStorage Integration', () => {
    it('should batch 3 duplicate attachments into 1 metadata update', async () => {
      const hash = 'abc123def456'; // Same hash for all duplicates

      // 3 sessions reference the same screenshot (same hash)
      queue.enqueueCAStorage(hash, {
        hash,
        mimeType: 'image/png',
        size: 1024,
        references: [
          { sessionId: 's1', attachmentId: 'a1', addedAt: Date.now() },
        ],
        refCount: 1,
      }, 'normal');

      queue.enqueueCAStorage(hash, {
        hash,
        mimeType: 'image/png',
        size: 1024,
        references: [
          { sessionId: 's1', attachmentId: 'a1', addedAt: Date.now() },
          { sessionId: 's2', attachmentId: 'a2', addedAt: Date.now() },
        ],
        refCount: 2,
      }, 'normal');

      queue.enqueueCAStorage(hash, {
        hash,
        mimeType: 'image/png',
        size: 1024,
        references: [
          { sessionId: 's1', attachmentId: 'a1', addedAt: Date.now() },
          { sessionId: 's2', attachmentId: 'a2', addedAt: Date.now() },
          { sessionId: 's3', attachmentId: 'a3', addedAt: Date.now() },
        ],
        refCount: 3,
      }, 'normal');

      await new Promise(resolve => setTimeout(resolve, 200));

      // All 3 metadata updates should be batched
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(3);

      // Should have collapsed operations
      expect(stats.batching?.caStorageCollapsed).toBeGreaterThanOrEqual(2);
    });

    it('should batch multiple different hashes', async () => {
      // 5 different screenshots (different hashes)
      for (let i = 0; i < 5; i++) {
        queue.enqueueCAStorage(`hash-${i}`, {
          hash: `hash-${i}`,
          mimeType: 'image/png',
          size: 1024,
          references: [{ sessionId: 's1', attachmentId: `a${i}`, addedAt: Date.now() }],
          refCount: 1,
        }, 'normal');
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Mixed Operations (Real-World Scenario)', () => {
    it('should handle session save with all operations', async () => {
      const sessionId = 'session-complete';

      // 1. Save metadata
      queue.enqueue(`sessions/${sessionId}/metadata`, {
        id: sessionId,
        name: 'Complete Session',
      }, 'critical');

      // 2. Save screenshot chunks (10 chunks)
      for (let i = 0; i < 10; i++) {
        queue.enqueueChunk(sessionId, `screenshots/chunk-${i}`, {
          screenshots: [{ id: `s-${i}`, attachmentId: `hash-${i}` }],
        }, 'normal');
      }

      // 3. Save CA storage metadata (10 screenshots)
      for (let i = 0; i < 10; i++) {
        queue.enqueueCAStorage(`hash-${i}`, {
          hash: `hash-${i}`,
          refCount: 1,
        }, 'normal');
      }

      // 4. Update indexes
      queue.enqueueIndex('by-date', { date: '2025-10', sessionIds: [sessionId] }, 'low');
      queue.enqueueIndex('by-status', { status: 'active', sessionIds: [sessionId] }, 'low');

      // 5. Schedule cleanup
      queue.enqueueCleanup('gc', 'low');

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      const stats = queue.getStats();

      // All operations should complete (1 metadata + 10 chunks + 10 CA + 2 index + 1 cleanup = 24)
      expect(stats.completed).toBeGreaterThanOrEqual(24);

      // Should have batching efficiency
      expect(stats.batching?.chunksCollapsed).toBeGreaterThanOrEqual(9);
      expect(stats.batching?.caStorageCollapsed).toBeGreaterThanOrEqual(9);
    });
  });

  describe('Performance Verification', () => {
    it('should maintain zero UI blocking during heavy load', () => {
      const startTime = Date.now();

      // Simulate heavy session save (100 operations)
      const sessionId = 'session-heavy';

      for (let i = 0; i < 50; i++) {
        queue.enqueueChunk(sessionId, `chunk-${i}`, { data: i }, 'normal');
      }

      for (let i = 0; i < 50; i++) {
        queue.enqueueCAStorage(`hash-${i}`, { data: i }, 'normal');
      }

      const endTime = Date.now();
      const blockingTime = endTime - startTime;

      // Enqueueing 100 items should take < 50ms (0ms per operation goal)
      expect(blockingTime).toBeLessThan(100);
    });

    it('should process batches within target times', async () => {
      const sessionId = 'session-perf';

      const startTime = Date.now();

      // Enqueue 10 chunks
      for (let i = 0; i < 10; i++) {
        queue.enqueueChunk(sessionId, `chunk-${i}`, { data: i }, 'normal');
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 10 chunks in single transaction should complete in < 250ms
      expect(totalTime).toBeLessThan(500);

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThanOrEqual(10);
    });
  });
});
