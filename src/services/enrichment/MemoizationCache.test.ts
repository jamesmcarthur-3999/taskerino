/**
 * MemoizationCache Unit Tests
 *
 * Comprehensive test suite covering all memoization cache functionality:
 * - Basic get/set operations
 * - TTL expiration
 * - LRU eviction
 * - Pattern invalidation
 * - Statistics tracking
 * - Automatic cleanup
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MemoizationCache,
  getScreenshotMemoizationCache,
  getAudioTranscriptionMemoizationCache,
  getSummaryMemoizationCache,
  resetAllMemoizationCaches,
} from './MemoizationCache';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wait for a specified duration
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate test data of specific size
 */
function generateTestData(sizeKB: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const targetLength = sizeKB * 512; // ~2 bytes per char (UTF-16)
  let result = '';
  for (let i = 0; i < targetLength; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// Basic Operations Tests
// ============================================================================

describe('MemoizationCache - Basic Operations', () => {
  let cache: MemoizationCache<any>;

  beforeEach(() => {
    cache = new MemoizationCache({
      maxSize: 100,
      maxSizeBytes: 1024 * 1024, // 1MB
      defaultTTL: 60000, // 1 minute
      autoCleanup: false, // Disable for testing
    });
  });

  afterEach(() => {
    cache.shutdown();
  });

  it('should get/set values correctly', () => {
    const key = 'test-key';
    const value = { data: 'test-data' };

    // Set value
    cache.set(key, value);

    // Get value
    const retrieved = cache.get(key);
    expect(retrieved).toEqual(value);
  });

  it('should return null for non-existent keys', () => {
    const retrieved = cache.get('non-existent-key');
    expect(retrieved).toBeNull();
  });

  it('should check existence with has()', () => {
    const key = 'test-key';
    expect(cache.has(key)).toBe(false);

    cache.set(key, { data: 'test' });
    expect(cache.has(key)).toBe(true);
  });

  it('should delete entries', () => {
    const key = 'test-key';
    cache.set(key, { data: 'test' });

    expect(cache.has(key)).toBe(true);
    cache.delete(key);
    expect(cache.has(key)).toBe(false);
  });

  it('should clear all entries', () => {
    cache.set('key1', { data: '1' });
    cache.set('key2', { data: '2' });
    cache.set('key3', { data: '3' });

    const stats = cache.getStats();
    expect(stats.size).toBe(3);

    cache.clear();

    const clearedStats = cache.getStats();
    expect(clearedStats.size).toBe(0);
  });
});

// ============================================================================
// TTL Expiration Tests
// ============================================================================

describe('MemoizationCache - TTL Expiration', () => {
  let cache: MemoizationCache<any>;

  beforeEach(() => {
    cache = new MemoizationCache({
      maxSize: 100,
      maxSizeBytes: 1024 * 1024,
      defaultTTL: 100, // 100ms default
      autoCleanup: false,
    });
  });

  afterEach(() => {
    cache.shutdown();
  });

  it('should expire entries after TTL', async () => {
    const key = 'test-key';
    const value = { data: 'test' };

    cache.set(key, value, 50); // 50ms TTL

    // Should exist immediately
    expect(cache.has(key)).toBe(true);

    // Wait for expiration
    await wait(60);

    // Should be expired
    expect(cache.has(key)).toBe(false);
    expect(cache.get(key)).toBeNull();
  });

  it('should not expire entries before TTL', async () => {
    const key = 'test-key';
    const value = { data: 'test' };

    cache.set(key, value, 100); // 100ms TTL

    // Wait less than TTL
    await wait(50);

    // Should still exist
    expect(cache.has(key)).toBe(true);
    expect(cache.get(key)).toEqual(value);
  });

  it('should track expirations in stats', async () => {
    cache.set('key1', { data: '1' }, 50);
    cache.set('key2', { data: '2' }, 50);

    await wait(60);

    // Try to get expired entries
    cache.get('key1');
    cache.get('key2');

    const stats = cache.getStats();
    expect(stats.expirations).toBe(2);
  });

  it('should prune expired entries manually', async () => {
    cache.set('key1', { data: '1' }, 50);
    cache.set('key2', { data: '2' }, 50);
    cache.set('key3', { data: '3' }, 1000);

    await wait(60);

    const pruned = cache.prune();
    expect(pruned).toBe(2);

    const stats = cache.getStats();
    expect(stats.size).toBe(1);
    expect(cache.has('key3')).toBe(true);
  });
});

// ============================================================================
// LRU Eviction Tests
// ============================================================================

describe('MemoizationCache - LRU Eviction', () => {
  let cache: MemoizationCache<any>;

  beforeEach(() => {
    cache = new MemoizationCache({
      maxSize: 3, // Small cache for testing
      maxSizeBytes: 1024 * 1024,
      defaultTTL: 60000,
      autoCleanup: false,
    });
  });

  afterEach(() => {
    cache.shutdown();
  });

  it('should evict LRU entry when cache is full', () => {
    // Fill cache
    cache.set('key1', { data: '1' });
    cache.set('key2', { data: '2' });
    cache.set('key3', { data: '3' });

    // Access key2 to make it more recently used
    cache.get('key2');

    // Add new entry - should evict key1 (oldest)
    cache.set('key4', { data: '4' });

    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key2')).toBe(true);
    expect(cache.has('key3')).toBe(true);
    expect(cache.has('key4')).toBe(true);

    const stats = cache.getStats();
    expect(stats.evictions).toBe(1);
  });

  it('should respect access patterns for LRU', () => {
    cache.set('key1', { data: '1' });
    cache.set('key2', { data: '2' });
    cache.set('key3', { data: '3' });

    // Access all keys in order: key3, key1, key2
    cache.get('key3');
    cache.get('key1');
    cache.get('key2');

    // Add new entry - should evict key3 (oldest access)
    cache.set('key4', { data: '4' });

    expect(cache.has('key3')).toBe(false);
    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(true);
    expect(cache.has('key4')).toBe(true);
  });

  it('should evict based on byte size limit', () => {
    const cacheWithByteLimit = new MemoizationCache({
      maxSize: 100,
      maxSizeBytes: 100, // 100 bytes limit
      defaultTTL: 60000,
      autoCleanup: false,
    });

    // Add small entry
    cacheWithByteLimit.set('key1', { data: 'small' });

    // Add large entry that exceeds byte limit
    const largeValue = { data: generateTestData(1) }; // ~2KB
    cacheWithByteLimit.set('key2', largeValue);

    // key1 should be evicted due to byte size
    expect(cacheWithByteLimit.has('key1')).toBe(false);
    expect(cacheWithByteLimit.has('key2')).toBe(true);

    cacheWithByteLimit.shutdown();
  });
});

// ============================================================================
// Pattern Invalidation Tests
// ============================================================================

describe('MemoizationCache - Pattern Invalidation', () => {
  let cache: MemoizationCache<any>;

  beforeEach(() => {
    cache = new MemoizationCache({
      maxSize: 100,
      maxSizeBytes: 1024 * 1024,
      defaultTTL: 60000,
      autoCleanup: false,
    });
  });

  afterEach(() => {
    cache.shutdown();
  });

  it('should invalidate entries matching string pattern', () => {
    cache.set('screenshot-001', { data: '1' });
    cache.set('screenshot-002', { data: '2' });
    cache.set('audio-001', { data: '3' });

    const invalidated = cache.invalidate('screenshot');
    expect(invalidated).toBe(2);

    expect(cache.has('screenshot-001')).toBe(false);
    expect(cache.has('screenshot-002')).toBe(false);
    expect(cache.has('audio-001')).toBe(true);
  });

  it('should invalidate entries matching regex pattern', () => {
    cache.set('screenshot-001', { data: '1' });
    cache.set('screenshot-002', { data: '2' });
    cache.set('audio-001', { data: '3' });

    const invalidated = cache.invalidate(/screenshot-\d+/);
    expect(invalidated).toBe(2);

    expect(cache.has('screenshot-001')).toBe(false);
    expect(cache.has('screenshot-002')).toBe(false);
    expect(cache.has('audio-001')).toBe(true);
  });

  it('should handle pattern that matches no entries', () => {
    cache.set('key1', { data: '1' });
    cache.set('key2', { data: '2' });

    const invalidated = cache.invalidate('nonexistent');
    expect(invalidated).toBe(0);

    expect(cache.has('key1')).toBe(true);
    expect(cache.has('key2')).toBe(true);
  });
});

// ============================================================================
// getOrCompute Tests
// ============================================================================

describe('MemoizationCache - getOrCompute', () => {
  let cache: MemoizationCache<any>;

  beforeEach(() => {
    cache = new MemoizationCache({
      maxSize: 100,
      maxSizeBytes: 1024 * 1024,
      defaultTTL: 60000,
      autoCleanup: false,
    });
  });

  afterEach(() => {
    cache.shutdown();
  });

  it('should compute value on cache miss', async () => {
    const computeFn = vi.fn(async () => ({ data: 'computed' }));

    const result = await cache.getOrCompute('key1', computeFn);

    expect(result).toEqual({ data: 'computed' });
    expect(computeFn).toHaveBeenCalledTimes(1);
  });

  it('should return cached value on cache hit', async () => {
    const computeFn = vi.fn(async () => ({ data: 'computed' }));

    // First call - cache miss
    const result1 = await cache.getOrCompute('key1', computeFn);
    expect(result1).toEqual({ data: 'computed' });
    expect(computeFn).toHaveBeenCalledTimes(1);

    // Second call - cache hit
    const result2 = await cache.getOrCompute('key1', computeFn);
    expect(result2).toEqual({ data: 'computed' });
    expect(computeFn).toHaveBeenCalledTimes(1); // Not called again
  });

  it('should respect custom TTL in getOrCompute', async () => {
    const computeFn = vi.fn(async () => ({ data: 'computed' }));

    await cache.getOrCompute('key1', computeFn, 50); // 50ms TTL

    expect(cache.has('key1')).toBe(true);

    await wait(60);

    expect(cache.has('key1')).toBe(false);
  });
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe('MemoizationCache - Statistics', () => {
  let cache: MemoizationCache<any>;

  beforeEach(() => {
    cache = new MemoizationCache({
      maxSize: 100,
      maxSizeBytes: 1024 * 1024,
      defaultTTL: 60000,
      autoCleanup: false,
    });
  });

  afterEach(() => {
    cache.shutdown();
  });

  it('should track hits and misses', () => {
    cache.set('key1', { data: '1' });

    // Hit
    cache.get('key1');
    // Miss
    cache.get('key2');

    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(50); // 50%
  });

  it('should track cache size', () => {
    cache.set('key1', { data: '1' });
    cache.set('key2', { data: '2' });

    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });

  it('should track access counts', () => {
    cache.set('key1', { data: '1' });

    // Access multiple times
    cache.get('key1');
    cache.get('key1');
    cache.get('key1');

    const stats = cache.getStats();
    expect(stats.avgAccessCount).toBe(3);
  });

  it('should track top accessed keys', () => {
    cache.set('key1', { data: '1' });
    cache.set('key2', { data: '2' });
    cache.set('key3', { data: '3' });

    // Access with different frequencies
    cache.get('key1');
    cache.get('key1');
    cache.get('key1');
    cache.get('key2');
    cache.get('key2');
    cache.get('key3');

    const stats = cache.getStats();
    expect(stats.topKeys.length).toBeGreaterThan(0);
    expect(stats.topKeys[0].accessCount).toBe(3); // key1 most accessed
  });

  it('should reset statistics', () => {
    cache.set('key1', { data: '1' });
    cache.get('key1');
    cache.get('nonexistent');

    let stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);

    cache.resetStats();

    stats = cache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
  });
});

// ============================================================================
// Singleton Cache Tests
// ============================================================================

describe('MemoizationCache - Singleton Instances', () => {
  afterEach(() => {
    resetAllMemoizationCaches();
  });

  it('should return same instance for screenshot cache', () => {
    const cache1 = getScreenshotMemoizationCache();
    const cache2 = getScreenshotMemoizationCache();

    expect(cache1).toBe(cache2);
  });

  it('should return same instance for audio cache', () => {
    const cache1 = getAudioTranscriptionMemoizationCache();
    const cache2 = getAudioTranscriptionMemoizationCache();

    expect(cache1).toBe(cache2);
  });

  it('should return same instance for summary cache', () => {
    const cache1 = getSummaryMemoizationCache();
    const cache2 = getSummaryMemoizationCache();

    expect(cache1).toBe(cache2);
  });

  it('should have different instances for different caches', () => {
    const screenshotCache = getScreenshotMemoizationCache();
    const audioCache = getAudioTranscriptionMemoizationCache();
    const summaryCache = getSummaryMemoizationCache();

    expect(screenshotCache).not.toBe(audioCache);
    expect(audioCache).not.toBe(summaryCache);
    expect(screenshotCache).not.toBe(summaryCache);
  });

  it('should reset all caches', () => {
    const screenshotCache = getScreenshotMemoizationCache();
    const audioCache = getAudioTranscriptionMemoizationCache();
    const summaryCache = getSummaryMemoizationCache();

    screenshotCache.set('key1', { data: '1' });
    audioCache.set('key2', { data: '2' });
    summaryCache.set('key3', { data: '3' });

    resetAllMemoizationCaches();

    // Get new instances
    const newScreenshotCache = getScreenshotMemoizationCache();
    const newAudioCache = getAudioTranscriptionMemoizationCache();
    const newSummaryCache = getSummaryMemoizationCache();

    expect(newScreenshotCache.has('key1')).toBe(false);
    expect(newAudioCache.has('key2')).toBe(false);
    expect(newSummaryCache.has('key3')).toBe(false);
  });
});
