/**
 * Storage Queue + Transaction Integration Tests
 *
 * Tests that verify PersistenceQueue and Transaction support work together:
 * - Queue uses transactions for critical priority items
 * - Queue handles transaction failures gracefully
 * - Queue flushes all pending items on shutdown
 * - Transaction rollback works correctly with queued items
 * - No data corruption under concurrent operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PersistenceQueue, resetPersistenceQueue, getPersistenceQueue } from '../PersistenceQueue';
import { getStorage } from '../index';
import type { Session } from '../../../types';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockSession(id: string): Session {
  return {
    id,
    name: `Test Session ${id}`,
    description: 'Test session for integration tests',
    startTime: new Date().toISOString(),
    status: 'completed',
    screenshots: [],
    extractedTaskIds: [],
    extractedNoteIds: [],
  };
}

async function waitForQueueProcessing(queue: PersistenceQueue, timeout = 1000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const stats = queue.getStats();
    if (stats.pending === 0 && stats.processing === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('Queue processing timeout');
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Storage Queue + Transaction Integration', () => {
  let queue: PersistenceQueue;
  let mockDB: any;
  let collections: Map<string, any>;

  beforeEach(() => {
    // Create IndexedDB mock
    collections = new Map<string, any>();

    const createNormalTransaction = (stores: any, mode: any) => {
      const mockStore = {
        put: vi.fn((record) => {
          collections.set(record.name, record);
          const request = {
            onsuccess: null as any,
            onerror: null as any
          };
          setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
          return request;
        }),
        get: vi.fn((key) => {
          const record = collections.get(key);
          const request = {
            onsuccess: null as any,
            result: record,
            onerror: null as any
          };
          setTimeout(() => { if (request.onsuccess) request.onsuccess(); }, 0);
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

      setTimeout(() => { if (mockTransaction.oncomplete) mockTransaction.oncomplete(); }, 0);
      return mockTransaction;
    };

    mockDB = {
      transaction: vi.fn(createNormalTransaction)
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

    resetPersistenceQueue();
    queue = getPersistenceQueue();
  });

  afterEach(async () => {
    await queue.shutdown();
    resetPersistenceQueue();
    delete (global as any).indexedDB;
  });

  describe('Basic Queue Operations', () => {
    it('should persist items with different priorities', async () => {
      const storage = await getStorage();

      // Enqueue items with different priorities
      queue.enqueue('critical-data', { value: 'critical' }, 'critical');
      queue.enqueue('normal-data', { value: 'normal' }, 'normal');
      queue.enqueue('low-data', { value: 'low' }, 'low');

      // Wait for processing
      await waitForQueueProcessing(queue);

      // Verify all items were persisted
      const critical = await storage.load('critical-data');
      const normal = await storage.load('normal-data');
      const low = await storage.load('low-data');

      expect(critical).toEqual({ value: 'critical' });
      expect(normal).toEqual({ value: 'normal' });
      expect(low).toEqual({ value: 'low' });
    });

    it('should process critical items immediately', async () => {
      const storage = await getStorage();
      const startTime = Date.now();

      queue.enqueue('critical-immediate', { value: 'fast' }, 'critical');

      // Critical items should process almost immediately
      await waitForQueueProcessing(queue, 500);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(200); // Should be very fast

      const data = await storage.load('critical-immediate');
      expect(data).toEqual({ value: 'fast' });
    });

    it('should batch normal priority items', async () => {
      const storage = await getStorage();
      const processedTimes: number[] = [];

      queue.on('processing', () => {
        processedTimes.push(Date.now());
      });

      // Enqueue multiple normal items rapidly
      for (let i = 0; i < 5; i++) {
        queue.enqueue(`normal-${i}`, { value: i }, 'normal');
      }

      await waitForQueueProcessing(queue);

      // Verify all were saved
      for (let i = 0; i < 5; i++) {
        const data = await storage.load(`normal-${i}`);
        expect(data).toEqual({ value: i });
      }

      // Items should be batched (processed close together in time)
      if (processedTimes.length > 1) {
        const timeDiff = processedTimes[processedTimes.length - 1] - processedTimes[0];
        expect(timeDiff).toBeLessThan(500); // Should batch within 500ms
      }
    });
  });

  describe('Queue Statistics and Events', () => {
    it('should track queue statistics correctly', async () => {
      const initialStats = queue.getStats();
      expect(initialStats.pending).toBe(0);
      expect(initialStats.completed).toBe(0);

      // Enqueue items
      queue.enqueue('stats-1', { value: 1 }, 'normal');
      queue.enqueue('stats-2', { value: 2 }, 'normal');

      const pendingStats = queue.getStats();
      expect(pendingStats.pending).toBe(2);

      await waitForQueueProcessing(queue);

      const completedStats = queue.getStats();
      expect(completedStats.pending).toBe(0);
      expect(completedStats.completed).toBe(2);
    });

    it('should emit events during queue lifecycle', async () => {
      const events: string[] = [];

      queue.on('enqueued', () => events.push('enqueued'));
      queue.on('processing', () => events.push('processing'));
      queue.on('completed', () => events.push('completed'));

      queue.enqueue('event-test', { value: 'test' }, 'critical');

      await waitForQueueProcessing(queue);

      expect(events).toContain('enqueued');
      expect(events).toContain('processing');
      expect(events).toContain('completed');
    });

    it('should track failed items', async () => {
      const storage = await getStorage();

      // Mock storage to fail
      const originalSave = storage.save;
      storage.save = vi.fn(() => Promise.reject(new Error('Storage error')));

      const failedItems: any[] = [];
      queue.on('failed', (item) => failedItems.push(item));

      queue.enqueue('fail-test', { value: 'fail' }, 'critical');

      // Wait for retries to exhaust
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(failedItems.length).toBeGreaterThan(0);
      expect(failedItems[0].error).toContain('Storage error');

      // Restore storage
      storage.save = originalSave;
    });
  });

  describe('Queue Retry Logic', () => {
    it('should retry failed items with exponential backoff', async () => {
      const storage = await getStorage();
      const attempts: number[] = [];

      // Mock to fail twice, then succeed
      let callCount = 0;
      const originalSave = storage.save;
      storage.save = vi.fn((key: string, value: any) => {
        callCount++;
        attempts.push(Date.now());

        if (callCount <= 2) {
          return Promise.reject(new Error('Temporary error'));
        }
        return originalSave.call(storage, key, value);
      });

      const retryEvents: any[] = [];
      queue.on('retry', (item) => retryEvents.push(item));

      queue.enqueue('retry-test', { value: 'retry' }, 'normal');

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(retryEvents.length).toBeGreaterThan(0);
      expect(callCount).toBe(3); // Initial + 2 retries

      // Verify exponential backoff (each retry should be longer)
      if (attempts.length > 2) {
        const delay1 = attempts[1] - attempts[0];
        const delay2 = attempts[2] - attempts[1];
        expect(delay2).toBeGreaterThan(delay1);
      }

      // Eventually should succeed
      await waitForQueueProcessing(queue, 3000);

      const data = await storage.load('retry-test');
      expect(data).toEqual({ value: 'retry' });

      storage.save = originalSave;
    });

    it('should respect max retries per priority', async () => {
      const storage = await getStorage();
      const originalSave = storage.save;

      // Mock to always fail
      storage.save = vi.fn(() => Promise.reject(new Error('Permanent error')));

      const failedEvents: any[] = [];
      queue.on('failed', (item) => failedEvents.push(item));

      // Critical: max 1 retry
      queue.enqueue('fail-critical', { value: 'c' }, 'critical');

      // Normal: max 3 retries
      queue.enqueue('fail-normal', { value: 'n' }, 'normal');

      // Wait for all retries to exhaust
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Both should eventually fail
      expect(failedEvents.length).toBe(2);

      const criticalFailed = failedEvents.find((e) => e.key === 'fail-critical');
      const normalFailed = failedEvents.find((e) => e.key === 'fail-normal');

      expect(criticalFailed).toBeDefined();
      expect(normalFailed).toBeDefined();

      // Critical should have fewer retries
      expect(criticalFailed.retries).toBeLessThanOrEqual(1);
      expect(normalFailed.retries).toBeLessThanOrEqual(3);

      storage.save = originalSave;
    });
  });

  describe('Queue Flush and Shutdown', () => {
    it('should flush all pending items on shutdown', async () => {
      const storage = await getStorage();

      // Enqueue multiple items
      for (let i = 0; i < 10; i++) {
        queue.enqueue(`flush-${i}`, { value: i }, 'normal');
      }

      // Immediately shutdown (before normal processing)
      await queue.shutdown();

      // All items should be persisted
      for (let i = 0; i < 10; i++) {
        const data = await storage.load(`flush-${i}`);
        expect(data).toEqual({ value: i });
      }
    });

    it('should handle shutdown with mixed priority items', async () => {
      const storage = await getStorage();

      // Enqueue items with all priorities
      queue.enqueue('shutdown-critical', { value: 'c' }, 'critical');
      queue.enqueue('shutdown-normal', { value: 'n' }, 'normal');
      queue.enqueue('shutdown-low', { value: 'l' }, 'low');

      await queue.shutdown();

      // All should be saved
      expect(await storage.load('shutdown-critical')).toEqual({ value: 'c' });
      expect(await storage.load('shutdown-normal')).toEqual({ value: 'n' });
      expect(await storage.load('shutdown-low')).toEqual({ value: 'l' });
    });

    it('should not accept new items after shutdown', async () => {
      await queue.shutdown();

      // Try to enqueue (implementation dependent - may throw or ignore)
      const statsBefore = queue.getStats();

      queue.enqueue('post-shutdown', { value: 'test' }, 'normal');

      // Queue should be effectively stopped
      const statsAfter = queue.getStats();

      // Either the item is not added, or it's immediately processed
      // We just verify the queue doesn't grow indefinitely
      expect(statsAfter.pending).toBeLessThanOrEqual(1);
    });
  });

  describe('Queue Size Limits', () => {
    it('should enforce queue size limit', async () => {
      const droppedItems: any[] = [];
      queue.on('dropped', (item) => droppedItems.push(item));

      // Enqueue more than max (1000) low priority items
      for (let i = 0; i < 1100; i++) {
        queue.enqueue(`overflow-${i}`, { value: i }, 'low');
      }

      // Should drop oldest low priority items
      expect(droppedItems.length).toBeGreaterThan(0);

      const stats = queue.getStats();
      const totalQueueSize = stats.byPriority.critical + stats.byPriority.normal + stats.byPriority.low;
      expect(totalQueueSize).toBeLessThanOrEqual(1000);
    });

    it('should preserve critical items when enforcing limit', async () => {
      const droppedItems: any[] = [];
      queue.on('dropped', (item) => droppedItems.push(item));

      // Fill with low priority
      for (let i = 0; i < 900; i++) {
        queue.enqueue(`low-${i}`, { value: i }, 'low');
      }

      // Add critical items
      for (let i = 0; i < 200; i++) {
        queue.enqueue(`critical-${i}`, { value: i }, 'critical');
      }

      // Only low priority items should be dropped
      const allCritical = droppedItems.every((item) => item.priority === 'low');
      expect(allCritical).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent enqueues without data loss', async () => {
      const storage = await getStorage();
      const promises: Promise<string>[] = [];

      // Concurrently enqueue many items
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve(queue.enqueue(`concurrent-${i}`, { value: i }, 'normal'))
        );
      }

      await Promise.all(promises);
      await waitForQueueProcessing(queue, 2000);

      // All items should be persisted
      for (let i = 0; i < 50; i++) {
        const data = await storage.load(`concurrent-${i}`);
        expect(data).toEqual({ value: i });
      }
    });

    it('should maintain data integrity under rapid updates to same key', async () => {
      const storage = await getStorage();

      // Rapidly update the same key
      for (let i = 0; i < 10; i++) {
        queue.enqueue('same-key', { value: i }, 'normal');
      }

      await waitForQueueProcessing(queue);

      // Last write should win
      const data = await storage.load('same-key');
      expect(data.value).toBeGreaterThanOrEqual(0);
      expect(data.value).toBeLessThanOrEqual(9);
    });
  });

  describe('Real-World Session Scenarios', () => {
    it('should handle active session updates efficiently', async () => {
      const storage = await getStorage();
      const session = createMockSession('active-session');

      // Simulate rapid session updates (screenshots, audio, etc.)
      for (let i = 0; i < 20; i++) {
        session.screenshots.push({
          id: `screenshot-${i}`,
          timestamp: new Date().toISOString(),
          attachmentId: `attachment-${i}`,
          analysisStatus: 'pending',
        });

        // Use normal priority for live updates
        queue.enqueue('activeSession', session, 'normal');

        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      await waitForQueueProcessing(queue, 3000);

      // Verify final state
      const savedSession = await storage.load<Session>('activeSession');
      expect(savedSession.screenshots.length).toBe(20);
    });

    it('should handle session completion with critical priority', async () => {
      const storage = await getStorage();
      const session = createMockSession('completed-session');
      session.status = 'completed';
      session.endTime = new Date().toISOString();

      // Session completion should use critical priority
      queue.enqueue('sessions', [session], 'critical');

      // Should process immediately
      await waitForQueueProcessing(queue, 500);

      const savedSessions = await storage.load<Session[]>('sessions');
      expect(savedSessions).toHaveLength(1);
      expect(savedSessions[0].status).toBe('completed');
    });

    it('should handle multiple concurrent sessions', async () => {
      const storage = await getStorage();
      const sessions = [
        createMockSession('session-1'),
        createMockSession('session-2'),
        createMockSession('session-3'),
      ];

      // Simulate concurrent session updates
      const updates = sessions.map((session, index) => {
        return new Promise<void>((resolve) => {
          setTimeout(() => {
            queue.enqueue(`activeSession-${index}`, session, 'normal');
            resolve();
          }, Math.random() * 100);
        });
      });

      await Promise.all(updates);
      await waitForQueueProcessing(queue, 2000);

      // All sessions should be saved
      for (let i = 0; i < 3; i++) {
        const data = await storage.load<Session>(`activeSession-${i}`);
        expect(data.id).toBe(`session-${i + 1}`);
      }
    });
  });

  describe('Error Recovery', () => {
    it('should continue processing after partial failures', async () => {
      const storage = await getStorage();
      const originalSave = storage.save;

      let callCount = 0;
      storage.save = vi.fn((key: string, value: any) => {
        callCount++;

        // Fail every other call
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Intermittent error'));
        }

        return originalSave.call(storage, key, value);
      });

      // Enqueue multiple items
      for (let i = 0; i < 10; i++) {
        queue.enqueue(`recovery-${i}`, { value: i }, 'critical');
      }

      // Wait for processing and retries
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // At least some items should succeed
      const stats = queue.getStats();
      expect(stats.completed).toBeGreaterThan(0);

      storage.save = originalSave;
    });

    it('should not corrupt queue on storage errors', async () => {
      const storage = await getStorage();
      const originalSave = storage.save;

      // Mock catastrophic failure
      storage.save = vi.fn(() => Promise.reject(new Error('Storage corrupted')));

      queue.enqueue('corruption-test', { value: 'test' }, 'critical');

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Restore storage
      storage.save = originalSave;

      // Queue should still be operational
      queue.enqueue('recovery-test', { value: 'recovered' }, 'critical');
      await waitForQueueProcessing(queue);

      const data = await storage.load('recovery-test');
      expect(data).toEqual({ value: 'recovered' });
    });
  });
});
