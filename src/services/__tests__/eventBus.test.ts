/**
 * Comprehensive Test Suite for EventBus Service
 *
 * Tests the production-quality publish-subscribe event system.
 * Coverage target: >95%
 *
 * Test categories:
 * 1. Subscription/Unsubscription
 * 2. Event Emission
 * 3. Multiple Subscribers
 * 4. Error Handling
 * 5. Async Handlers
 * 6. Edge Cases
 * 7. Performance & Memory
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus, eventBus, type EventData, type RelationshipEvent } from '../eventBus';

describe('EventBus - Production Quality Tests', () => {
  // Use fresh instance for each test to ensure isolation
  let testBus: EventBus;

  beforeEach(() => {
    testBus = new EventBus();
  });

  afterEach(() => {
    testBus.clear();
  });

  // ============================================================================
  // 1. SUBSCRIPTION/UNSUBSCRIPTION TESTS
  // ============================================================================

  describe('Subscription Management', () => {
    it('should subscribe to events and return unique subscription ID', () => {
      const handler = vi.fn();
      const id = testBus.on('RELATIONSHIP_ADDED', handler);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique subscription IDs for each subscription', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const id1 = testBus.on('RELATIONSHIP_ADDED', handler1);
      const id2 = testBus.on('RELATIONSHIP_ADDED', handler2);

      expect(id1).not.toBe(id2);
    });

    it('should track subscriber count correctly', () => {
      expect(testBus.getSubscriberCount('RELATIONSHIP_ADDED')).toBe(0);

      const id1 = testBus.on('RELATIONSHIP_ADDED', vi.fn());
      expect(testBus.getSubscriberCount('RELATIONSHIP_ADDED')).toBe(1);

      const id2 = testBus.on('RELATIONSHIP_ADDED', vi.fn());
      expect(testBus.getSubscriberCount('RELATIONSHIP_ADDED')).toBe(2);

      testBus.off(id1);
      expect(testBus.getSubscriberCount('RELATIONSHIP_ADDED')).toBe(1);

      testBus.off(id2);
      expect(testBus.getSubscriberCount('RELATIONSHIP_ADDED')).toBe(0);
    });

    it('should unsubscribe correctly and stop receiving events', async () => {
      const handler = vi.fn();
      const id = testBus.on('RELATIONSHIP_ADDED', handler);

      testBus.emit('RELATIONSHIP_ADDED', { test: 'data1' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1);

      testBus.off(id);
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data2' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should handle unsubscribing non-existent ID gracefully (idempotent)', () => {
      expect(() => {
        testBus.off('non-existent-id');
      }).not.toThrow();
    });

    it('should handle unsubscribing same ID multiple times (idempotent)', () => {
      const handler = vi.fn();
      const id = testBus.on('RELATIONSHIP_ADDED', handler);

      testBus.off(id);
      testBus.off(id); // Second call should be no-op
      testBus.off(id); // Third call should be no-op

      expect(() => testBus.off(id)).not.toThrow();
    });

    it('should track total subscriptions across all event types', () => {
      expect(testBus.getTotalSubscriptions()).toBe(0);

      const id1 = testBus.on('RELATIONSHIP_ADDED', vi.fn());
      expect(testBus.getTotalSubscriptions()).toBe(1);

      const id2 = testBus.on('RELATIONSHIP_REMOVED', vi.fn());
      expect(testBus.getTotalSubscriptions()).toBe(2);

      const id3 = testBus.on('RELATIONSHIP_ADDED', vi.fn());
      expect(testBus.getTotalSubscriptions()).toBe(3);

      testBus.off(id1);
      expect(testBus.getTotalSubscriptions()).toBe(2);

      testBus.off(id2);
      testBus.off(id3);
      expect(testBus.getTotalSubscriptions()).toBe(0);
    });

    it('should check if event has subscribers', () => {
      expect(testBus.hasSubscribers('RELATIONSHIP_ADDED')).toBe(false);

      const id = testBus.on('RELATIONSHIP_ADDED', vi.fn());
      expect(testBus.hasSubscribers('RELATIONSHIP_ADDED')).toBe(true);

      testBus.off(id);
      expect(testBus.hasSubscribers('RELATIONSHIP_ADDED')).toBe(false);
    });
  });

  // ============================================================================
  // 2. EVENT EMISSION TESTS
  // ============================================================================

  describe('Event Emission', () => {
    it('should emit events to subscribers', async () => {
      const handler = vi.fn();
      testBus.on('RELATIONSHIP_ADDED', handler);

      testBus.emit('RELATIONSHIP_ADDED', { relationshipId: '123' });

      // Wait for async handler execution
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should pass correct data to handlers', async () => {
      const handler = vi.fn();
      testBus.on('RELATIONSHIP_ADDED', handler);

      const testData = { relationshipId: '123', type: 'RELATES_TO' };
      testBus.emit('RELATIONSHIP_ADDED', testData, 'TestSource');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'TestSource',
          data: testData,
          timestamp: expect.any(String),
        })
      );
    });

    it('should use default source when not provided', async () => {
      const handler = vi.fn();
      testBus.on('RELATIONSHIP_ADDED', handler);

      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'unknown',
        })
      );
    });

    it('should include ISO timestamp in event data', async () => {
      const handler = vi.fn();
      testBus.on('RELATIONSHIP_ADDED', handler);

      const beforeEmit = new Date().toISOString();
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });
      const afterEmit = new Date().toISOString();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const callArg = handler.mock.calls[0][0] as EventData;
      expect(callArg.timestamp).toBeDefined();
      expect(callArg.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
      expect(callArg.timestamp >= beforeEmit).toBe(true);
      expect(callArg.timestamp <= afterEmit).toBe(true);
    });

    it('should not throw when emitting event with no subscribers', () => {
      expect(() => {
        testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });
      }).not.toThrow();
    });

    it('should support all event types', async () => {
      const events: RelationshipEvent[] = [
        'RELATIONSHIP_ADDED',
        'RELATIONSHIP_REMOVED',
        'RELATIONSHIP_UPDATED',
        'ENTITY_DELETED',
      ];

      for (const event of events) {
        const handler = vi.fn();
        testBus.on(event, handler);
        testBus.emit(event, { test: 'data' });

        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(handler).toHaveBeenCalledTimes(1);
      }
    });
  });

  // ============================================================================
  // 3. MULTIPLE SUBSCRIBERS TESTS
  // ============================================================================

  describe('Multiple Subscribers', () => {
    it('should support multiple subscribers for same event', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      testBus.on('RELATIONSHIP_ADDED', handler1);
      testBus.on('RELATIONSHIP_ADDED', handler2);
      testBus.on('RELATIONSHIP_ADDED', handler3);

      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should execute handlers in subscription order', async () => {
      const executionOrder: number[] = [];

      const handler1 = vi.fn(() => executionOrder.push(1));
      const handler2 = vi.fn(() => executionOrder.push(2));
      const handler3 = vi.fn(() => executionOrder.push(3));

      testBus.on('RELATIONSHIP_ADDED', handler1);
      testBus.on('RELATIONSHIP_ADDED', handler2);
      testBus.on('RELATIONSHIP_ADDED', handler3);

      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it('should not emit to unsubscribed handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      testBus.on('RELATIONSHIP_ADDED', handler1);
      const id2 = testBus.on('RELATIONSHIP_ADDED', handler2);
      testBus.on('RELATIONSHIP_ADDED', handler3);

      // Unsubscribe handler2
      testBus.off(id2);

      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should support handler resubscription after unsubscribe', async () => {
      const handler = vi.fn();

      const id1 = testBus.on('RELATIONSHIP_ADDED', handler);
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data1' });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1);

      testBus.off(id1);
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data2' });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(1); // Not called

      // Resubscribe
      testBus.on('RELATIONSHIP_ADDED', handler);
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data3' });

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledTimes(2); // Called again
    });
  });

  // ============================================================================
  // 4. ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should catch and log handler errors without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      testBus.on('RELATIONSHIP_ADDED', errorHandler);

      expect(() => {
        testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });
      }).not.toThrow();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should continue executing other handlers when one throws', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error');
      });
      const handler2 = vi.fn();
      const handler3 = vi.fn(() => {
        throw new Error('Handler 3 error');
      });

      testBus.on('RELATIONSHIP_ADDED', handler1);
      testBus.on('RELATIONSHIP_ADDED', handler2);
      testBus.on('RELATIONSHIP_ADDED', handler3);

      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled(); // Still executes
      expect(handler3).toHaveBeenCalled(); // Still executes

      consoleErrorSpy.mockRestore();
    });

    it('should log error details including subscription ID and event data', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorHandler = vi.fn(() => {
        throw new Error('Test error');
      });

      const subscriptionId = testBus.on('RELATIONSHIP_ADDED', errorHandler);
      const testData = { relationshipId: '123' };

      testBus.emit('RELATIONSHIP_ADDED', testData, 'TestSource');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('RELATIONSHIP_ADDED'),
        expect.any(Error)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Subscription ID:',
        subscriptionId
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Event data:',
        expect.objectContaining({ data: testData })
      );

      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================================================
  // 5. ASYNC HANDLERS TESTS
  // ============================================================================

  describe('Async Handlers', () => {
    it('should handle async handlers', async () => {
      const asyncHandler = vi.fn(async (data: EventData) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return data;
      });

      testBus.on('RELATIONSHIP_ADDED', asyncHandler);
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(asyncHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle async handler errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const asyncErrorHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error('Async error');
      });

      testBus.on('RELATIONSHIP_ADDED', asyncErrorHandler);
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(asyncErrorHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should not block on async handlers', async () => {
      let asyncCompleted = false;

      const asyncHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        asyncCompleted = true;
      });

      testBus.on('RELATIONSHIP_ADDED', asyncHandler);

      // Emit should return immediately
      const startTime = Date.now();
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50); // Should be nearly instant
      expect(asyncCompleted).toBe(false); // Hasn't completed yet

      // Wait for async to complete
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(asyncCompleted).toBe(true);
    });
  });

  // ============================================================================
  // 6. EDGE CASES TESTS
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle unsubscribe during emit', async () => {
      const handler1 = vi.fn();
      const idHolder: { id?: string } = {};

      const handler2 = vi.fn(() => {
        // Unsubscribe self during execution
        if (idHolder.id) {
          testBus.off(idHolder.id);
        }
      });

      const handler3 = vi.fn();

      testBus.on('RELATIONSHIP_ADDED', handler1);
      idHolder.id = testBus.on('RELATIONSHIP_ADDED', handler2);
      testBus.on('RELATIONSHIP_ADDED', handler3);

      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();

      // Verify handler2 is unsubscribed for next emit
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data2' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(1); // Not called again
      expect(handler3).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid emit/subscribe cycles', async () => {
      const handler = vi.fn();

      for (let i = 0; i < 100; i++) {
        const id = testBus.on('RELATIONSHIP_ADDED', handler);
        testBus.emit('RELATIONSHIP_ADDED', { count: i });
        testBus.off(id);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Each handler should be called once (100 times total)
      expect(handler).toHaveBeenCalledTimes(100);
    });

    it('should handle empty data payload', async () => {
      const handler = vi.fn();
      testBus.on('RELATIONSHIP_ADDED', handler);

      testBus.emit('RELATIONSHIP_ADDED', null);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ data: null })
      );

      handler.mockClear();

      testBus.emit('RELATIONSHIP_ADDED', undefined);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ data: undefined })
      );
    });

    it('should clear all listeners', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      testBus.on('RELATIONSHIP_ADDED', handler1);
      testBus.on('RELATIONSHIP_REMOVED', handler2);
      testBus.on('ENTITY_DELETED', handler3);

      expect(testBus.getTotalSubscriptions()).toBe(3);

      testBus.clear();

      expect(testBus.getTotalSubscriptions()).toBe(0);
      expect(testBus.getSubscriberCount('RELATIONSHIP_ADDED')).toBe(0);
      expect(testBus.getSubscriberCount('RELATIONSHIP_REMOVED')).toBe(0);
      expect(testBus.getSubscriberCount('ENTITY_DELETED')).toBe(0);

      // Verify handlers don't receive events after clear
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });
      testBus.emit('RELATIONSHIP_REMOVED', { test: 'data' });
      testBus.emit('ENTITY_DELETED', { test: 'data' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should be ready for new subscriptions after clear', () => {
      testBus.on('RELATIONSHIP_ADDED', vi.fn());
      testBus.clear();

      const handler = vi.fn();
      const id = testBus.on('RELATIONSHIP_ADDED', handler);

      expect(id).toBeDefined();
      expect(testBus.getSubscriberCount('RELATIONSHIP_ADDED')).toBe(1);
    });
  });

  // ============================================================================
  // 7. PERFORMANCE & MEMORY TESTS
  // ============================================================================

  describe('Performance & Memory', () => {
    it('should handle 100 subscribers efficiently', async () => {
      const handlers = Array.from({ length: 100 }, () => vi.fn());

      handlers.forEach((handler) => {
        testBus.on('RELATIONSHIP_ADDED', handler);
      });

      const startTime = Date.now();
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });
      const endTime = Date.now();

      // Emit should be nearly instant (< 10ms for 100 subscribers)
      expect(endTime - startTime).toBeLessThan(10);

      await new Promise((resolve) => setTimeout(resolve, 50));

      handlers.forEach((handler) => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });

    it('should clean up memory after unsubscribe', () => {
      const ids: string[] = [];

      // Subscribe 100 handlers
      for (let i = 0; i < 100; i++) {
        ids.push(testBus.on('RELATIONSHIP_ADDED', vi.fn()));
      }

      expect(testBus.getTotalSubscriptions()).toBe(100);

      // Unsubscribe all
      ids.forEach((id) => testBus.off(id));

      expect(testBus.getTotalSubscriptions()).toBe(0);
      expect(testBus.getSubscriberCount('RELATIONSHIP_ADDED')).toBe(0);

      // Internal cleanup verification (event type map should be removed)
      expect(testBus.hasSubscribers('RELATIONSHIP_ADDED')).toBe(false);
    });

    it('should emit in under 1ms with 10 subscribers', async () => {
      const handlers = Array.from({ length: 10 }, () => vi.fn());

      handlers.forEach((handler) => {
        testBus.on('RELATIONSHIP_ADDED', handler);
      });

      const startTime = performance.now();
      testBus.emit('RELATIONSHIP_ADDED', { test: 'data' });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1);

      await new Promise((resolve) => setTimeout(resolve, 20));

      handlers.forEach((handler) => {
        expect(handler).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ============================================================================
  // 8. SINGLETON INSTANCE TESTS
  // ============================================================================

  describe('Singleton Instance', () => {
    it('should provide singleton instance', () => {
      expect(eventBus).toBeDefined();
      expect(eventBus).toBeInstanceOf(EventBus);
    });

    it('should allow multiple EventBus instances for isolation', async () => {
      const bus1 = new EventBus();
      const bus2 = new EventBus();

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus1.on('RELATIONSHIP_ADDED', handler1);
      bus2.on('RELATIONSHIP_ADDED', handler2);

      bus1.emit('RELATIONSHIP_ADDED', { test: 'bus1' });

      // Wait for async handler execution
      await new Promise((resolve) => setTimeout(resolve, 10));

      // handler1 should be called, handler2 should not
      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });
});
