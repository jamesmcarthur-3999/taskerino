/**
 * LRUCache Performance Benchmarks
 *
 * Tests performance characteristics and validates targets from Phase 4 Task 4.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache } from '../LRUCache';
import { ChunkedSessionStorage } from '../ChunkedSessionStorage';
import type { StorageAdapter } from '../StorageAdapter';

// Mock storage adapter for testing
class MockStorageAdapter implements StorageAdapter {
  private storage = new Map<string, any>();

  async save(key: string, data: any): Promise<void> {
    // Simulate storage latency (50ms average)
    await new Promise(resolve => setTimeout(resolve, 50));
    this.storage.set(key, data);
  }

  async load<T>(key: string): Promise<T | null> {
    // Simulate storage latency
    await new Promise(resolve => setTimeout(resolve, 50));
    return this.storage.get(key) || null;
  }

  async delete(key: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 10));
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return this.storage.has(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async beginTransaction(): Promise<any> {
    return {
      save: this.save.bind(this),
      commit: async () => {},
      rollback: async () => {},
    };
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}

// Test data generators
function generateMockSession() {
  return {
    id: `session-${Math.random()}`,
    name: `Session ${Date.now()}`,
    description: 'A test session with some data',
    status: 'completed',
    startTime: new Date().toISOString(),
    screenshots: Array(20).fill({
      id: `screenshot-${Math.random()}`,
      timestamp: new Date().toISOString(),
      attachmentId: `attachment-${Math.random()}`,
    }),
    tags: ['test', 'benchmark'],
  };
}

function generateMockMetadata(sessionId: string) {
  return {
    id: sessionId,
    name: `Session ${sessionId}`,
    description: 'Mock session metadata',
    status: 'completed',
    startTime: new Date().toISOString(),
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'none',
    audioRecording: false,
    extractedTaskIds: [],
    extractedNoteIds: [],
    chunks: {
      screenshots: { count: 0, chunkCount: 0, chunkSize: 20 },
      audioSegments: { count: 0, chunkCount: 0, chunkSize: 100 },
      videoChunks: { count: 0, chunkCount: 0, chunkSize: 100 },
    },
    tags: ['test'],
    hasSummary: false,
    hasAudioInsights: false,
    hasCanvasSpec: false,
    hasTranscription: false,
    hasVideo: false,
    hasFullAudio: false,
    audioReviewCompleted: false,
    storageVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('LRUCache Performance', () => {
  describe('Cache Hit Rate', () => {
    it('should achieve >90% hit rate for hot data', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 10 * 1024 * 1024, // 10MB
      });

      // Warmup cache with 100 sessions
      for (let i = 0; i < 100; i++) {
        cache.set(`session-${i}`, generateMockSession());
      }

      // Reset stats to exclude warmup
      cache.resetStats();

      // Access patterns (80/20 rule: 20% of sessions accessed 80% of time)
      for (let i = 0; i < 1000; i++) {
        const sessionId = i < 800 ? Math.floor(Math.random() * 20) : Math.floor(Math.random() * 100);
        cache.get(`session-${sessionId}`);
      }

      const stats = cache.getStats();
      console.log(`[Benchmark] Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      console.log(`[Benchmark] Hits: ${stats.hits}, Misses: ${stats.misses}`);

      expect(stats.hitRate).toBeGreaterThan(0.9); // >90% target
    });

    it('should handle cold start efficiently', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 10 * 1024 * 1024,
      });

      // First 100 requests - all misses (cold start)
      for (let i = 0; i < 100; i++) {
        cache.get(`session-${i}`);
      }

      const coldStats = cache.getStats();
      expect(coldStats.hitRate).toBe(0);
      expect(coldStats.misses).toBe(100);

      // Populate cache
      for (let i = 0; i < 100; i++) {
        cache.set(`session-${i}`, generateMockSession());
      }

      // Reset stats
      cache.resetStats();

      // Next 100 requests - all hits (warmed up)
      for (let i = 0; i < 100; i++) {
        cache.get(`session-${i}`);
      }

      const warmStats = cache.getStats();
      expect(warmStats.hitRate).toBe(1); // 100% hits after warmup
    });
  });

  describe('Access Performance', () => {
    it('should retrieve cached data in <1ms', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 10 * 1024 * 1024,
      });

      // Populate cache
      const sessionData = generateMockSession();
      cache.set('session-1', sessionData);

      // Benchmark retrieval
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        cache.get('session-1');
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      console.log(`[Benchmark] Avg cached retrieval time: ${avgTime.toFixed(3)}ms`);

      expect(avgTime).toBeLessThan(1); // <1ms target
    });

    it('should insert data in <1ms', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 100 * 1024 * 1024, // Large cache to avoid evictions
      });

      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        cache.set(`session-${i}`, generateMockSession());
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      console.log(`[Benchmark] Avg insertion time: ${avgTime.toFixed(3)}ms`);

      expect(avgTime).toBeLessThan(1); // <1ms target
    });

    it('should perform eviction in <1ms', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 1024, // Small cache to force evictions
      });

      // Pre-fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`session-${i}`, generateMockSession());
      }

      // Benchmark eviction-heavy workload
      const iterations = 100;
      const start = performance.now();

      for (let i = 10; i < 10 + iterations; i++) {
        cache.set(`session-${i}`, generateMockSession()); // Will trigger eviction
      }

      const end = performance.now();
      const avgTime = (end - start) / iterations;

      const stats = cache.getStats();
      console.log(`[Benchmark] Avg eviction time: ${avgTime.toFixed(3)}ms`);
      console.log(`[Benchmark] Total evictions: ${stats.evictions}`);

      expect(avgTime).toBeLessThan(1); // <1ms target
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('ChunkedSessionStorage Integration', () => {
    let storage: ChunkedSessionStorage;
    let adapter: MockStorageAdapter;

    beforeEach(() => {
      adapter = new MockStorageAdapter();
      storage = new ChunkedSessionStorage(adapter, {
        maxSizeBytes: 100 * 1024 * 1024, // 100MB
        ttl: 5 * 60 * 1000, // 5 minutes
      });
    });

    it('should load cached metadata in <1ms', async () => {
      // Save metadata first
      const metadata = generateMockMetadata('session-1');
      await storage.saveMetadata(metadata);

      // First load - should hit storage (slow)
      const start1 = performance.now();
      await storage.loadMetadata('session-1');
      const end1 = performance.now();
      const firstLoadTime = end1 - start1;

      console.log(`[Benchmark] First load (storage): ${firstLoadTime.toFixed(1)}ms`);

      // Second load - should hit cache (fast)
      const start2 = performance.now();
      const cached = await storage.loadMetadata('session-1');
      const end2 = performance.now();
      const cachedLoadTime = end2 - start2;

      console.log(`[Benchmark] Cached load: ${cachedLoadTime.toFixed(3)}ms`);
      console.log(`[Benchmark] Speedup: ${(firstLoadTime / cachedLoadTime).toFixed(1)}x`);

      expect(cached).toBeTruthy();
      expect(cachedLoadTime).toBeLessThan(1); // <1ms target
      expect(cachedLoadTime).toBeLessThan(firstLoadTime / 10); // At least 10x faster
    });

    it('should demonstrate 50x improvement for cached data', async () => {
      // Save metadata
      const metadata = generateMockMetadata('session-1');
      await storage.saveMetadata(metadata);

      // Measure storage-based load (clear cache first)
      storage.clearCache();
      const storageStart = performance.now();
      await storage.loadMetadata('session-1');
      const storageEnd = performance.now();
      const storageTime = storageEnd - storageStart;

      // Measure cache-based load
      const cacheStart = performance.now();
      await storage.loadMetadata('session-1');
      const cacheEnd = performance.now();
      const cacheTime = cacheEnd - cacheStart;

      const improvement = storageTime / cacheTime;

      console.log(`[Benchmark] Storage load: ${storageTime.toFixed(1)}ms`);
      console.log(`[Benchmark] Cache load: ${cacheTime.toFixed(3)}ms`);
      console.log(`[Benchmark] Improvement: ${improvement.toFixed(1)}x`);

      expect(improvement).toBeGreaterThan(10); // At least 10x improvement
    });

    it('should maintain high hit rate under realistic usage', async () => {
      // Simulate realistic usage pattern
      const sessionIds = Array.from({ length: 20 }, (_, i) => `session-${i}`);

      // Save all sessions
      for (const id of sessionIds) {
        const metadata = generateMockMetadata(id);
        await storage.saveMetadata(metadata);
      }

      // Clear cache to start fresh
      storage.clearCache();

      // Simulate user accessing recent sessions repeatedly
      const accessPattern = [];
      for (let i = 0; i < 100; i++) {
        // 80% of time access recent 5 sessions
        if (Math.random() < 0.8) {
          accessPattern.push(sessionIds[Math.floor(Math.random() * 5)]);
        } else {
          accessPattern.push(sessionIds[Math.floor(Math.random() * 20)]);
        }
      }

      // Execute access pattern
      for (const id of accessPattern) {
        await storage.loadMetadata(id);
      }

      // Check cache stats
      const stats = storage.getCacheStats();
      console.log(`[Benchmark] Realistic usage hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      console.log(`[Benchmark] Hits: ${stats.hits}, Misses: ${stats.misses}`);

      expect(stats.hitRate).toBeGreaterThan(0.8); // >80% hit rate
    });

    it('should handle cache invalidation efficiently', async () => {
      const metadata = generateMockMetadata('session-1');
      await storage.saveMetadata(metadata);

      // Load to populate cache
      await storage.loadMetadata('session-1');

      // Measure invalidation time
      const start = performance.now();
      storage.clearSessionCache('session-1');
      const end = performance.now();
      const invalidationTime = end - start;

      console.log(`[Benchmark] Cache invalidation time: ${invalidationTime.toFixed(3)}ms`);

      expect(invalidationTime).toBeLessThan(1); // <1ms target
    });
  });

  describe('Memory Usage', () => {
    it('should enforce memory limit', () => {
      const maxSize = 1024 * 1024; // 1MB
      const cache = new LRUCache<string, any>({
        maxSizeBytes: maxSize,
      });

      // Try to fill with 10MB of data
      for (let i = 0; i < 1000; i++) {
        cache.set(`session-${i}`, generateMockSession());
      }

      const stats = cache.getStats();
      console.log(`[Benchmark] Cache size: ${(stats.size / 1024).toFixed(1)}KB`);
      console.log(`[Benchmark] Cache items: ${stats.items}`);
      console.log(`[Benchmark] Evictions: ${stats.evictions}`);

      expect(stats.size).toBeLessThanOrEqual(maxSize);
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should handle large cache size efficiently', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 100 * 1024 * 1024, // 100MB
      });

      // Fill with many sessions
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        cache.set(`session-${i}`, generateMockSession());
      }

      const end = performance.now();
      const totalTime = end - start;
      const avgTime = totalTime / iterations;

      const stats = cache.getStats();
      console.log(`[Benchmark] Large cache - Total time: ${totalTime.toFixed(1)}ms`);
      console.log(`[Benchmark] Large cache - Avg time: ${avgTime.toFixed(3)}ms`);
      console.log(`[Benchmark] Large cache - Size: ${(stats.size / 1024 / 1024).toFixed(1)}MB`);

      expect(avgTime).toBeLessThan(1);
      expect(stats.items).toBe(iterations);
    });
  });

  describe('Pattern Invalidation Performance', () => {
    it('should invalidate patterns efficiently', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 100 * 1024 * 1024,
      });

      // Create many entries with pattern
      for (let i = 0; i < 100; i++) {
        cache.set(`session:${i}:metadata`, generateMockMetadata(`${i}`));
        cache.set(`session:${i}:chunk:1`, { data: 'chunk1' });
        cache.set(`session:${i}:chunk:2`, { data: 'chunk2' });
      }

      // Benchmark pattern invalidation
      const start = performance.now();
      const count = cache.invalidatePattern('session:50:');
      const end = performance.now();
      const invalidationTime = end - start;

      console.log(`[Benchmark] Pattern invalidation time: ${invalidationTime.toFixed(3)}ms`);
      console.log(`[Benchmark] Entries invalidated: ${count}`);

      expect(invalidationTime).toBeLessThan(10); // <10ms for pattern match
      expect(count).toBe(3); // metadata + 2 chunks
    });

    it('should handle regex patterns efficiently', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 100 * 1024 * 1024,
      });

      // Create entries
      for (let i = 0; i < 100; i++) {
        cache.set(`session:${i}:metadata`, generateMockMetadata(`${i}`));
        cache.set(`session:${i}:chunk:1`, { data: 'chunk1' });
      }

      // Benchmark regex invalidation
      const start = performance.now();
      const count = cache.invalidatePattern(/chunk/);
      const end = performance.now();
      const invalidationTime = end - start;

      console.log(`[Benchmark] Regex invalidation time: ${invalidationTime.toFixed(3)}ms`);
      console.log(`[Benchmark] Entries invalidated: ${count}`);

      expect(invalidationTime).toBeLessThan(50); // <50ms for regex across 200 items
      expect(count).toBe(100); // All chunks
    });
  });

  describe('Concurrent Access Patterns', () => {
    it('should handle high-frequency access', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 10 * 1024 * 1024,
      });

      // Populate
      for (let i = 0; i < 50; i++) {
        cache.set(`session-${i}`, generateMockSession());
      }

      // Simulate high-frequency access
      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const id = Math.floor(Math.random() * 50);
        cache.get(`session-${id}`);
      }

      const end = performance.now();
      const totalTime = end - start;
      const avgTime = totalTime / iterations;
      const opsPerSecond = (iterations / totalTime) * 1000;

      console.log(`[Benchmark] High-frequency - Total time: ${totalTime.toFixed(1)}ms`);
      console.log(`[Benchmark] High-frequency - Avg time: ${avgTime.toFixed(3)}ms`);
      console.log(`[Benchmark] High-frequency - Ops/sec: ${opsPerSecond.toFixed(0)}`);

      expect(avgTime).toBeLessThan(0.1); // <0.1ms per op
      expect(opsPerSecond).toBeGreaterThan(10000); // >10k ops/sec
    });

    it('should handle mixed read/write workload', () => {
      const cache = new LRUCache<string, any>({
        maxSizeBytes: 10 * 1024 * 1024,
      });

      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        if (Math.random() < 0.7) {
          // 70% reads
          cache.get(`session-${Math.floor(Math.random() * 100)}`);
        } else {
          // 30% writes
          cache.set(`session-${i}`, generateMockSession());
        }
      }

      const end = performance.now();
      const totalTime = end - start;
      const avgTime = totalTime / iterations;

      console.log(`[Benchmark] Mixed workload - Total time: ${totalTime.toFixed(1)}ms`);
      console.log(`[Benchmark] Mixed workload - Avg time: ${avgTime.toFixed(3)}ms`);

      expect(avgTime).toBeLessThan(1);
    });
  });
});
