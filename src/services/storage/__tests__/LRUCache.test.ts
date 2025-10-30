/**
 * LRUCache Tests
 *
 * Comprehensive test suite for LRU cache implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache } from '../LRUCache';

describe('LRUCache', () => {
  describe('Core Operations', () => {
    let cache: LRUCache<string, any>;

    beforeEach(() => {
      cache = new LRUCache({
        maxSizeBytes: 1000,
      });
    });

    it('should cache values', () => {
      cache.set('key1', 'value1');
      const value = cache.get('key1');
      expect(value).toBe('value1');
    });

    it('should retrieve cached values', () => {
      cache.set('key1', { data: 'test' });
      cache.set('key2', 42);
      cache.set('key3', true);

      expect(cache.get('key1')).toEqual({ data: 'test' });
      expect(cache.get('key2')).toBe(42);
      expect(cache.get('key3')).toBe(true);
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should return false when deleting nonexistent key', () => {
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();

      const stats = cache.getStats();
      expect(stats.items).toBe(0);
      expect(stats.size).toBe(0);
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should update existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used when full', () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 100, // Small size to trigger eviction
      });

      // Fill cache
      cache.set('key1', 'a'.repeat(20)); // ~40 bytes
      cache.set('key2', 'b'.repeat(20)); // ~40 bytes
      cache.set('key3', 'c'.repeat(20)); // ~40 bytes - should evict key1

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      expect(cache.has('key1')).toBe(false); // key1 evicted
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
    });

    it('should update access order on get', () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 100,
      });

      cache.set('key1', 'a'.repeat(20));
      cache.set('key2', 'b'.repeat(20));

      // Access key1 to make it most recently used
      cache.get('key1');

      // Add key3 - should evict key2 (least recently used)
      cache.set('key3', 'c'.repeat(20));

      expect(cache.has('key1')).toBe(true); // Still in cache
      expect(cache.has('key2')).toBe(false); // Evicted
      expect(cache.has('key3')).toBe(true);
    });

    it('should update access order on set', () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 100,
      });

      cache.set('key1', 'a'.repeat(20));
      cache.set('key2', 'b'.repeat(20));

      // Update key1 to make it most recently used
      cache.set('key1', 'a'.repeat(20));

      // Add key3 - should evict key2
      cache.set('key3', 'c'.repeat(20));

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false); // Evicted
      expect(cache.has('key3')).toBe(true);
    });

    it('should evict oldest first', () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 80,
      });

      cache.set('key1', 'a'.repeat(15));
      cache.set('key2', 'b'.repeat(15));
      cache.set('key3', 'c'.repeat(15));
      cache.set('key4', 'd'.repeat(15));

      // key1 and key2 should be evicted
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('Size Management', () => {
    it('should track cache size in bytes', () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 1000,
      });

      cache.set('key1', 'test');
      const stats = cache.getStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should enforce max size limit', () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 100,
      });

      cache.set('key1', 'x'.repeat(50));
      cache.set('key2', 'y'.repeat(50));
      cache.set('key3', 'z'.repeat(50)); // Should trigger eviction

      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(100);
    });

    it('should estimate value size correctly', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 10000,
      });

      // Test different value types
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('boolean', true);
      cache.set('object', { data: 'test', count: 5 });
      cache.set('array', [1, 2, 3, 4, 5]);

      const stats = cache.getStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.items).toBe(5);
    });

    it('should handle large values', () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 1000,
      });

      const largeValue = 'x'.repeat(500);
      cache.set('large', largeValue);

      expect(cache.get('large')).toBe(largeValue);

      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(1000);
    });

    it('should handle item count limit', () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 10000,
        maxItems: 3,
      });

      cache.set('key1', 'a');
      cache.set('key2', 'b');
      cache.set('key3', 'c');
      cache.set('key4', 'd'); // Should evict key1

      const stats = cache.getStats();
      expect(stats.items).toBeLessThanOrEqual(3);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key4')).toBe(true);
    });
  });

  describe('TTL Support', () => {
    it('should expire values after TTL', async () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 1000,
        ttl: 100, // 100ms
      });

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not return expired values', async () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 1000,
        ttl: 50,
      });

      cache.set('key1', 'value1');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.has('key1')).toBe(false);
    });

    it('should evict expired values on prune', async () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 1000,
        ttl: 50,
      });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      await new Promise(resolve => setTimeout(resolve, 100));

      cache.prune();

      const stats = cache.getStats();
      expect(stats.items).toBe(0);
    });
  });

  describe('Pattern Invalidation', () => {
    let cache: LRUCache<string, string>;

    beforeEach(() => {
      cache = new LRUCache({
        maxSizeBytes: 10000,
      });

      cache.set('session:123:metadata', 'meta1');
      cache.set('session:123:chunk:1', 'chunk1');
      cache.set('session:123:chunk:2', 'chunk2');
      cache.set('session:456:metadata', 'meta2');
      cache.set('session:456:chunk:1', 'chunk3');
    });

    it('should invalidate by string pattern', () => {
      const count = cache.invalidatePattern('session:123:');
      expect(count).toBe(3);
      expect(cache.has('session:123:metadata')).toBe(false);
      expect(cache.has('session:123:chunk:1')).toBe(false);
      expect(cache.has('session:123:chunk:2')).toBe(false);
      expect(cache.has('session:456:metadata')).toBe(true);
      expect(cache.has('session:456:chunk:1')).toBe(true);
    });

    it('should invalidate by regex pattern', () => {
      const count = cache.invalidatePattern(/chunk/);
      expect(count).toBe(3); // 3 chunks (session:123:chunk:1, session:123:chunk:2, session:456:chunk:1)
      expect(cache.has('session:123:metadata')).toBe(true);
      expect(cache.has('session:456:metadata')).toBe(true);
      expect(cache.has('session:123:chunk:1')).toBe(false);
      expect(cache.has('session:123:chunk:2')).toBe(false);
      expect(cache.has('session:456:chunk:1')).toBe(false);
    });

    it('should return count of invalidated items', () => {
      const count1 = cache.invalidatePattern('nonexistent');
      expect(count1).toBe(0);

      const count2 = cache.invalidatePattern('session:123:');
      expect(count2).toBe(3);
    });
  });

  describe('Statistics', () => {
    let cache: LRUCache<string, string>;

    beforeEach(() => {
      cache = new LRUCache({
        maxSizeBytes: 1000,
      });
    });

    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // Hit
      cache.get('key1'); // Hit
      cache.get('nonexistent'); // Miss
      cache.get('nonexistent'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.get('key1'); // Hit
      cache.get('key2'); // Hit
      cache.get('nonexistent'); // Miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2/3, 2);
    });

    it('should track evictions', () => {
      const smallCache = new LRUCache<string, string>({
        maxSizeBytes: 50,
      });

      smallCache.set('key1', 'x'.repeat(20));
      smallCache.set('key2', 'y'.repeat(20));
      smallCache.set('key3', 'z'.repeat(20)); // Should trigger eviction

      const stats = smallCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should reset stats', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // Hit
      cache.get('nonexistent'); // Miss

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);

      // Size and items should not be reset
      expect(stats.items).toBe(1);
    });

    it('should track oldest and newest entries', async () => {
      cache.set('key1', 'value1');

      const stats1 = cache.getStats();
      expect(stats1.oldestEntry).toBeGreaterThan(0);
      expect(stats1.newestEntry).toBeGreaterThan(0);
      expect(stats1.oldestEntry).toBe(stats1.newestEntry);

      // Wait a tiny bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 2));

      // Add another entry
      cache.set('key2', 'value2');

      const stats2 = cache.getStats();
      expect(stats2.newestEntry).toBeGreaterThanOrEqual(stats2.oldestEntry!);
    });

    it('should handle empty cache stats', () => {
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.items).toBe(0);
      expect(stats.size).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });

  describe('Batch Operations', () => {
    let cache: LRUCache<string, string>;

    beforeEach(() => {
      cache = new LRUCache({
        maxSizeBytes: 10000,
      });
    });

    it('should get many values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const values = cache.getMany(['key1', 'key2', 'nonexistent']);

      expect(values.size).toBe(2);
      expect(values.get('key1')).toBe('value1');
      expect(values.get('key2')).toBe('value2');
      expect(values.has('nonexistent')).toBe(false);
    });

    it('should set many values', () => {
      const entries = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3'],
      ]);

      cache.setMany(entries);

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should delete many values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const count = cache.deleteMany(['key1', 'key3', 'nonexistent']);

      expect(count).toBe(2);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 1000,
      });

      cache.set('key1', null);
      cache.set('key2', undefined);

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(true);
    });

    it('should handle very large keys', () => {
      const cache = new LRUCache<string, string>({
        maxSizeBytes: 10000,
      });

      const largeKey = 'x'.repeat(1000);
      cache.set(largeKey, 'value');

      expect(cache.get(largeKey)).toBe('value');
    });

    it('should handle rapid updates', () => {
      const cache = new LRUCache<string, number>({
        maxSizeBytes: 1000,
      });

      for (let i = 0; i < 100; i++) {
        cache.set('counter', i);
      }

      expect(cache.get('counter')).toBe(99);

      const stats = cache.getStats();
      expect(stats.items).toBe(1);
    });

    it('should handle concurrent access patterns', () => {
      const cache = new LRUCache<string, number>({
        maxSizeBytes: 1000,
      });

      // Simulate concurrent access
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, i);
      }

      for (let i = 0; i < 10; i++) {
        expect(cache.get(`key${i}`)).toBe(i);
      }
    });

    it('should handle size estimation failure gracefully', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 10000,
      });

      // Create circular reference
      const circular: any = { prop: null };
      circular.prop = circular;

      // Should use default size estimate
      cache.set('circular', circular);

      const stats = cache.getStats();
      expect(stats.items).toBe(1);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Integration', () => {
    it('should maintain consistency with complex operations', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 500,
        ttl: 1000,
      });

      // Complex scenario
      cache.set('metadata:1', { id: 1, name: 'Session 1' });
      cache.set('chunk:1:1', [1, 2, 3, 4, 5]);
      cache.set('chunk:1:2', [6, 7, 8, 9, 10]);

      const stats1 = cache.getStats();
      const initialSize = stats1.size;
      const initialItems = stats1.items;

      // Access some items
      cache.get('metadata:1');
      cache.get('chunk:1:1');

      // Update and add more
      cache.set('metadata:1', { id: 1, name: 'Updated Session 1' });
      cache.set('chunk:1:3', [11, 12, 13]);

      // Delete some
      cache.delete('chunk:1:2');

      // Invalidate pattern
      cache.invalidatePattern(/chunk:1:3/);

      const stats2 = cache.getStats();
      expect(stats2.items).toBeLessThan(initialItems);
      expect(cache.has('metadata:1')).toBe(true);
      expect(cache.has('chunk:1:1')).toBe(true);
      expect(cache.has('chunk:1:2')).toBe(false);
      expect(cache.has('chunk:1:3')).toBe(false);
    });

    it('should handle realistic session caching scenario', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 100 * 1024, // 100KB
      });

      // Simulate caching session metadata
      for (let i = 0; i < 10; i++) {
        cache.set(`metadata:session-${i}`, {
          id: `session-${i}`,
          name: `Session ${i}`,
          startTime: new Date().toISOString(),
          status: 'completed',
        });
      }

      // Simulate caching chunks
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 3; j++) {
          cache.set(`screenshots:session-${i}:${j}`, {
            sessionId: `session-${i}`,
            chunkIndex: j,
            screenshots: Array(20).fill({ id: `ss-${j}` }),
          });
        }
      }

      const stats = cache.getStats();
      expect(stats.items).toBeGreaterThan(0);
      expect(stats.size).toBeLessThanOrEqual(100 * 1024);
      expect(stats.hitRate).toBe(0); // No gets yet

      // Access some sessions
      cache.get('metadata:session-0');
      cache.get('screenshots:session-0:0');
      cache.get('screenshots:session-0:1');

      const stats2 = cache.getStats();
      expect(stats2.hits).toBe(3);
      expect(stats2.hitRate).toBe(1);

      // Invalidate a session
      const invalidated = cache.invalidatePattern('session-0');
      expect(invalidated).toBeGreaterThan(0);
    });
  });
});
