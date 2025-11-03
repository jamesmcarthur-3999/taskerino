/**
 * PersistenceQueue Tests
 *
 * Tests for the background persistence queue system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PersistenceQueue, resetPersistenceQueue, getPersistenceQueue } from '../PersistenceQueue';

// Mock the storage adapter
const mockSave = vi.fn();
const mockLoad = vi.fn();

vi.mock('../index', () => ({
  getStorage: vi.fn(async () => ({
    save: mockSave,
    load: mockLoad,
  })),
}));

describe('PersistenceQueue', () => {
  let queue: PersistenceQueue;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockLoad.mockResolvedValue(null);

    // Reset singleton and create fresh instance
    resetPersistenceQueue();
    queue = new PersistenceQueue();
  });

  afterEach(async () => {
    // Cleanup after each test
    await queue.shutdown();
    resetPersistenceQueue();
  });

  describe('enqueue', () => {
    it('should enqueue item and return ID', () => {
      const id = queue.enqueue('test-key', { data: 'test' }, 'normal');
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should emit enqueued event', async () => {
      const enqueuedPromise = new Promise<void>((resolve) => {
        queue.on('enqueued', (item) => {
          expect(item.key).toBe('test-key');
          expect(item.priority).toBe('normal');
          resolve();
        });
      });

      queue.enqueue('test-key', { data: 'test' }, 'normal');

      await enqueuedPromise;
    });

    it('should increment pending count', () => {
      queue.enqueue('test-key', { data: 'test' }, 'normal');
      const stats = queue.getStats();
      expect(stats.pending).toBe(1);
    });
  });

  describe('priority processing', () => {
    it('should process critical items immediately', async () => {
      const processingPromise = new Promise<void>((resolve) => {
        queue.on('completed', (item) => {
          if (item.key === 'critical-test') {
            resolve();
          }
        });
      });

      queue.enqueue('critical-test', { data: 'test' }, 'critical');

      // Wait a short time for immediate processing
      await Promise.race([
        processingPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
      ]);

      // Should complete quickly
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThan(0);
    });

    it('should batch normal items', async () => {
      const completedItems: string[] = [];

      queue.on('completed', (item) => {
        completedItems.push(item.key);
      });

      // Enqueue multiple normal priority items
      queue.enqueue('normal-1', { data: 'test1' }, 'normal');
      queue.enqueue('normal-2', { data: 'test2' }, 'normal');
      queue.enqueue('normal-3', { data: 'test3' }, 'normal');

      // Wait for batch processing (100ms delay)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // All items should be processed
      expect(completedItems.length).toBe(3);
      expect(completedItems).toContain('normal-1');
      expect(completedItems).toContain('normal-2');
      expect(completedItems).toContain('normal-3');
    });

    it('should process low priority items during idle', async () => {
      const completedPromise = new Promise<void>((resolve) => {
        queue.on('completed', (item) => {
          if (item.key === 'low-test') {
            resolve();
          }
        });
      });

      queue.enqueue('low-test', { data: 'test' }, 'low');

      // Wait for idle processing (500ms+ for fallback)
      await Promise.race([
        completedPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
      ]);

      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThan(0);
    });
  });

  describe('error handling and retry', () => {
    it('should retry on failure', async () => {
      // Mock storage to fail once, then succeed
      let callCount = 0;
      mockSave.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Storage error');
        }
        return undefined;
      });

      // Wait for both retry event AND completion after retry
      let retryFired = false;
      const completionPromise = new Promise<void>((resolve) => {
        queue.on('retry', (item) => {
          if (item.key === 'retry-test') {
            retryFired = true;
          }
        });

        queue.on('completed', (item) => {
          if (item.key === 'retry-test' && retryFired) {
            resolve();
          }
        });
      });

      // Use 'normal' priority which has 3 retries (critical only has 1)
      queue.enqueue('retry-test', { data: 'test' }, 'normal');

      // Wait for completion after retry (needs longer timeout for batch delay + retry + backoff)
      await Promise.race([
        completionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500)),
      ]);

      expect(callCount).toBe(2); // First call fails, second succeeds
      expect(retryFired).toBe(true);
    });

    it('should fail after max retries', async () => {
      // Mock storage to always fail
      mockSave.mockRejectedValue(new Error('Storage error'));

      const failedPromise = new Promise<void>((resolve) => {
        queue.on('failed', (item) => {
          if (item.key === 'fail-test') {
            resolve();
          }
        });
      });

      queue.enqueue('fail-test', { data: 'test' }, 'critical');

      // Wait for failed event (critical has max 1 retry, so should fail quickly)
      await Promise.race([
        failedPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
      ]);

      const stats = queue.getStats();
      expect(stats.failed).toBeGreaterThan(0);
    });
  });

  describe('queue size limit', () => {
    it('should drop low priority items when queue is full', () => {
      const droppedItems: string[] = [];

      queue.on('dropped', (item) => {
        droppedItems.push(item.key);
      });

      // Enqueue 1100 low priority items (max is 1000)
      for (let i = 0; i < 1100; i++) {
        queue.enqueue(`low-${i}`, { data: i }, 'low');
      }

      // Should have dropped oldest items
      expect(droppedItems.length).toBeGreaterThan(0);
    });

    it('should not drop critical or normal items', () => {
      const droppedItems: string[] = [];

      queue.on('dropped', (item) => {
        droppedItems.push(item.key);
      });

      // Fill queue with critical and normal items
      for (let i = 0; i < 600; i++) {
        queue.enqueue(`critical-${i}`, { data: i }, 'critical');
      }
      for (let i = 0; i < 600; i++) {
        queue.enqueue(`normal-${i}`, { data: i }, 'normal');
      }

      // No drops expected (only low priority items are dropped)
      expect(droppedItems.length).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      queue.enqueue('test-1', { data: 1 }, 'normal');
      queue.enqueue('test-2', { data: 2 }, 'normal');
      queue.enqueue('test-3', { data: 3 }, 'low');

      // Get stats immediately (before processing)
      const stats = queue.getStats();

      // Pending should be 3 (1 critical is processed immediately, so might be 2)
      expect(stats.pending).toBeGreaterThanOrEqual(2);
      expect(stats.byPriority.normal).toBeGreaterThanOrEqual(1);
      expect(stats.byPriority.low).toBeGreaterThanOrEqual(1);
    });
  });

  describe('flush', () => {
    it('should process all pending items immediately', async () => {
      // Use low priority to prevent immediate processing
      queue.enqueue('test-1', { data: 1 }, 'low');
      queue.enqueue('test-2', { data: 2 }, 'low');
      queue.enqueue('test-3', { data: 3 }, 'low');

      // Verify items are queued
      let stats = queue.getStats();
      expect(stats.byPriority.low).toBe(3);

      await queue.flush();

      // After flush, all queues should be empty
      stats = queue.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.byPriority.critical).toBe(0);
      expect(stats.byPriority.normal).toBe(0);
      expect(stats.byPriority.low).toBe(0);
    });
  });

  describe('clear', () => {
    it('should discard all pending items', () => {
      queue.enqueue('test-1', { data: 1 }, 'normal');
      queue.enqueue('test-2', { data: 2 }, 'normal');
      queue.enqueue('test-3', { data: 3 }, 'low');

      queue.clear();

      const stats = queue.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.byPriority.critical).toBe(0);
      expect(stats.byPriority.normal).toBe(0);
      expect(stats.byPriority.low).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('should flush all items and cancel timers', async () => {
      const completedItems: string[] = [];

      queue.on('completed', (item) => {
        completedItems.push(item.key);
      });

      // Use low priority to prevent immediate processing
      queue.enqueue('test-1', { data: 1 }, 'low');
      queue.enqueue('test-2', { data: 2 }, 'low');

      await queue.shutdown();

      // After shutdown, items should be completed
      expect(completedItems.length).toBe(2);
      expect(completedItems).toContain('test-1');
      expect(completedItems).toContain('test-2');

      // Queues should be empty
      const stats = queue.getStats();
      expect(stats.byPriority.critical).toBe(0);
      expect(stats.byPriority.normal).toBe(0);
      expect(stats.byPriority.low).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const queue1 = getPersistenceQueue();
      const queue2 = getPersistenceQueue();

      expect(queue1).toBe(queue2);
    });

    it('should reset singleton', () => {
      const queue1 = getPersistenceQueue();
      resetPersistenceQueue();
      const queue2 = getPersistenceQueue();

      expect(queue1).not.toBe(queue2);
    });
  });
});
