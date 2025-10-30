/**
 * EnrichmentResultCache Unit Tests
 *
 * Comprehensive test suite covering:
 * - Cache key generation consistency
 * - Two-tier caching (L1 + L2)
 * - Cache hit/miss scenarios
 * - TTL expiration
 * - Model version invalidation
 * - Statistics tracking
 * - Error handling
 *
 * Target: 20+ tests with >95% coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnrichmentResultCache, resetEnrichmentResultCache } from './EnrichmentResultCache';
import type { EnrichmentInput, CachedEnrichmentResult } from './EnrichmentResultCache';
import { resetCAStorage } from '../storage/ContentAddressableStorage';

// ============================================================================
// Test Setup
// ============================================================================

describe('EnrichmentResultCache', () => {
  let cache: EnrichmentResultCache;

  beforeEach(() => {
    resetEnrichmentResultCache();
    resetCAStorage();
    cache = new EnrichmentResultCache({
      ttlMs: 60000, // 1 minute for testing
      l1MaxSizeBytes: 1024 * 1024, // 1MB
    });
  });

  afterEach(() => {
    resetEnrichmentResultCache();
    resetCAStorage();
  });

  // ============================================================================
  // Cache Key Generation Tests
  // ============================================================================

  describe('generateCacheKey', () => {
    it('should generate consistent keys for identical inputs', () => {
      const input: EnrichmentInput = {
        sessionId: 'session-123',
        audioData: 'base64-audio-data',
        videoData: 'base64-video-data',
        prompt: 'Analyze this session',
        modelConfig: {
          audioModel: 'gpt-4o',
          videoModel: 'claude-sonnet-4-5',
          temperature: 0.7,
        },
      };

      const key1 = cache.generateCacheKey(input);
      const key2 = cache.generateCacheKey(input);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 produces 64-char hex
    });

    it('should generate different keys for different audio data', () => {
      const input1: EnrichmentInput = {
        sessionId: 'session-123',
        audioData: 'audio-1',
        prompt: 'Analyze',
        modelConfig: { audioModel: 'gpt-4o' },
      };

      const input2: EnrichmentInput = {
        ...input1,
        audioData: 'audio-2',
      };

      const key1 = cache.generateCacheKey(input1);
      const key2 = cache.generateCacheKey(input2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different prompts', () => {
      const input1: EnrichmentInput = {
        sessionId: 'session-123',
        audioData: 'audio',
        prompt: 'Prompt A',
        modelConfig: { audioModel: 'gpt-4o' },
      };

      const input2: EnrichmentInput = {
        ...input1,
        prompt: 'Prompt B',
      };

      const key1 = cache.generateCacheKey(input1);
      const key2 = cache.generateCacheKey(input2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different model configs', () => {
      const input1: EnrichmentInput = {
        sessionId: 'session-123',
        audioData: 'audio',
        prompt: 'Analyze',
        modelConfig: {
          audioModel: 'gpt-4o',
          videoModel: 'claude-sonnet-4',
          temperature: 0.7,
        },
      };

      const input2: EnrichmentInput = {
        ...input1,
        modelConfig: {
          audioModel: 'gpt-4o',
          videoModel: 'claude-sonnet-5', // Different video model
          temperature: 0.7,
        },
      };

      const key1 = cache.generateCacheKey(input1);
      const key2 = cache.generateCacheKey(input2);

      expect(key1).not.toBe(key2);
    });

    it('should normalize whitespace in prompts', () => {
      const input1: EnrichmentInput = {
        sessionId: 'session-123',
        prompt: '  Analyze this session  ',
        modelConfig: {},
      };

      const input2: EnrichmentInput = {
        sessionId: 'session-123',
        prompt: 'Analyze this session',
        modelConfig: {},
      };

      const key1 = cache.generateCacheKey(input1);
      const key2 = cache.generateCacheKey(input2);

      expect(key1).toBe(key2);
    });
  });

  // ============================================================================
  // L1 Cache Tests (In-Memory LRU)
  // ============================================================================

  describe('L1 Cache (In-Memory)', () => {
    it('should cache and retrieve result from L1', async () => {
      const cacheKey = 'test-key-123';
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        audio: {
          fullTranscription: 'Hello world',
          cost: 0.05,
          duration: 10,
        },
        totalCost: 0.05,
        totalDuration: 10,
      };

      // Cache the result
      await cache.cacheResult(cacheKey, result);

      // Retrieve from cache
      const cached = await cache.getCachedResult(cacheKey);

      expect(cached).toBeDefined();
      expect(cached?.cacheKey).toBe(cacheKey);
      expect(cached?.audio?.fullTranscription).toBe('Hello world');
      expect(cached?.totalCost).toBe(0.05);
    });

    it('should return null for cache miss', async () => {
      const cached = await cache.getCachedResult('non-existent-key');
      expect(cached).toBeNull();
    });

    it('should track cache hits and misses', async () => {
      const cacheKey = 'test-key-hits';
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      await cache.cacheResult(cacheKey, result);

      // Cache hit
      await cache.getCachedResult(cacheKey);

      // Cache miss
      await cache.getCachedResult('non-existent');

      const stats = await cache.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should track cost savings from cache hits', async () => {
      const cacheKey = 'test-key-savings';
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 2.5, // $2.50 per enrichment
        totalDuration: 30,
      };

      await cache.cacheResult(cacheKey, result);

      // First hit
      await cache.getCachedResult(cacheKey);

      // Second hit
      await cache.getCachedResult(cacheKey);

      const stats = await cache.getCacheStats();
      expect(stats.savingsUSD).toBe(5.0); // 2 hits * $2.50
    });
  });

  // ============================================================================
  // TTL Expiration Tests
  // ============================================================================

  describe('TTL Expiration', () => {
    it('should expire entries after TTL', async () => {
      // Create cache with 100ms TTL
      const shortTtlCache = new EnrichmentResultCache({
        ttlMs: 100,
        l1MaxSizeBytes: 1024 * 1024,
      });

      const cacheKey = 'test-key-ttl';
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      await shortTtlCache.cacheResult(cacheKey, result);

      // Should be cached immediately
      const cached1 = await shortTtlCache.getCachedResult(cacheKey);
      expect(cached1).toBeDefined();

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      const cached2 = await shortTtlCache.getCachedResult(cacheKey);
      expect(cached2).toBeNull();
    });

    it('should clear expired entries with clearExpired', async () => {
      const shortTtlCache = new EnrichmentResultCache({
        ttlMs: 100,
        l1MaxSizeBytes: 1024 * 1024,
      });

      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      // Cache multiple results
      await shortTtlCache.cacheResult('key-1', result);
      await shortTtlCache.cacheResult('key-2', result);
      await shortTtlCache.cacheResult('key-3', result);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Clear expired
      const cleared = await shortTtlCache.clearExpired();
      expect(cleared).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Model Version Invalidation Tests
  // ============================================================================

  describe('Model Version Invalidation', () => {
    it('should invalidate cache when audio model version changes', async () => {
      const cacheV1 = new EnrichmentResultCache({
        autoInvalidateOnModelUpdate: true,
        currentModelVersions: {
          audioModel: 'gpt-4o-v1',
        },
      });

      const cacheKey = 'test-key-model-v1';
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        audio: {
          fullTranscription: 'Old model result',
          cost: 1.0,
          duration: 10,
        },
        totalCost: 1.0,
        totalDuration: 10,
      };

      await cacheV1.cacheResult(cacheKey, result);

      // Create new cache instance with updated model version
      const cacheV2 = new EnrichmentResultCache({
        autoInvalidateOnModelUpdate: true,
        currentModelVersions: {
          audioModel: 'gpt-4o-v2', // Updated version
        },
      });

      // Should be invalidated due to version mismatch
      const cached = await cacheV2.getCachedResult(cacheKey);
      expect(cached).toBeNull();
    });

    it('should invalidate cache when video model version changes', async () => {
      const cacheV1 = new EnrichmentResultCache({
        autoInvalidateOnModelUpdate: true,
        currentModelVersions: {
          videoModel: 'claude-sonnet-v1',
        },
      });

      const cacheKey = 'test-key-video-v1';
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        video: {
          chapters: [],
          cost: 0.5,
          duration: 5,
        },
        totalCost: 0.5,
        totalDuration: 5,
      };

      await cacheV1.cacheResult(cacheKey, result);

      // Update to new version
      const cacheV2 = new EnrichmentResultCache({
        autoInvalidateOnModelUpdate: true,
        currentModelVersions: {
          videoModel: 'claude-sonnet-v2',
        },
      });

      const cached = await cacheV2.getCachedResult(cacheKey);
      expect(cached).toBeNull();
    });

    it('should NOT invalidate when autoInvalidate is disabled', async () => {
      const cacheV1 = new EnrichmentResultCache({
        autoInvalidateOnModelUpdate: false, // Disabled
        currentModelVersions: {
          audioModel: 'gpt-4o-v1',
        },
      });

      const cacheKey = 'test-key-no-auto-invalidate';
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      await cacheV1.cacheResult(cacheKey, result);

      // Create new instance with updated version but autoInvalidate disabled
      const cacheV2 = new EnrichmentResultCache({
        autoInvalidateOnModelUpdate: false,
        currentModelVersions: {
          audioModel: 'gpt-4o-v2',
        },
      });

      // Should still be cached (no auto-invalidation)
      const cached = await cacheV2.getCachedResult(cacheKey);
      expect(cached).toBeDefined();
    });
  });

  // ============================================================================
  // Cache Management Tests
  // ============================================================================

  describe('Cache Management', () => {
    it('should invalidate entries matching pattern', async () => {
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      // Cache multiple entries with pattern
      await cache.cacheResult('session-123-audio', result);
      await cache.cacheResult('session-123-video', result);
      await cache.cacheResult('session-456-audio', result);

      // Invalidate all session-123 entries
      const count = await cache.invalidateCache('session-123');
      expect(count).toBe(2);

      // Verify invalidation
      const cached1 = await cache.getCachedResult('session-123-audio');
      const cached2 = await cache.getCachedResult('session-123-video');
      const cached3 = await cache.getCachedResult('session-456-audio');

      expect(cached1).toBeNull();
      expect(cached2).toBeNull();
      expect(cached3).toBeDefined(); // Should not be invalidated
    });

    it('should invalidate entries matching regex', async () => {
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      await cache.cacheResult('test-audio-123', result);
      await cache.cacheResult('test-video-456', result);
      await cache.cacheResult('production-audio-789', result);

      // Invalidate all test entries using regex
      const count = await cache.invalidateCache(/^test-/);
      expect(count).toBe(2);
    });

    it('should clear all cache entries', async () => {
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      await cache.cacheResult('key-1', result);
      await cache.cacheResult('key-2', result);
      await cache.cacheResult('key-3', result);

      await cache.clearAll();

      const stats = await cache.getCacheStats();
      expect(stats.entryCount).toBe(0);
    });

    it('should reset statistics', async () => {
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      await cache.cacheResult('key-1', result);
      await cache.getCachedResult('key-1'); // Hit
      await cache.getCachedResult('non-existent'); // Miss

      cache.resetStats();

      const stats = await cache.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.savingsUSD).toBe(0);
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('Statistics', () => {
    it('should track cache hit rate', async () => {
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      await cache.cacheResult('key-1', result);

      // 3 hits, 2 misses
      await cache.getCachedResult('key-1');
      await cache.getCachedResult('key-1');
      await cache.getCachedResult('key-1');
      await cache.getCachedResult('non-existent-1');
      await cache.getCachedResult('non-existent-2');

      const stats = await cache.getCacheStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(60, 1); // 3/(3+2) = 60%
    });

    it('should calculate average cost savings per hit', async () => {
      const result1: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 2.0,
        totalDuration: 10,
      };

      const result2: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 3.0,
        totalDuration: 10,
      };

      await cache.cacheResult('key-1', result1);
      await cache.cacheResult('key-2', result2);

      // Hit each once
      await cache.getCachedResult('key-1'); // Saves $2
      await cache.getCachedResult('key-2'); // Saves $3

      const stats = await cache.getCacheStats();
      expect(stats.effectiveness.avgCostSavingsPerHit).toBeCloseTo(2.5, 1); // ($2 + $3) / 2
    });

    it('should provide L1 and L2 statistics separately', async () => {
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        totalCost: 1.0,
        totalDuration: 10,
      };

      await cache.cacheResult('key-1', result);
      await cache.getCachedResult('key-1'); // L1 hit

      const stats = await cache.getCacheStats();
      expect(stats.l1Stats.hits).toBeGreaterThan(0);
      expect(stats.l1Stats.size).toBeGreaterThan(0);
      expect(stats.l1Stats.maxSize).toBe(1024 * 1024); // 1MB configured
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('should handle complete enrichment workflow', async () => {
      const input: EnrichmentInput = {
        sessionId: 'session-integration',
        audioData: 'audio-data',
        videoData: 'video-data',
        prompt: 'Analyze this session',
        modelConfig: {
          audioModel: 'gpt-4o',
          videoModel: 'claude-sonnet-4-5',
        },
      };

      const cacheKey = cache.generateCacheKey(input);

      // 1. Cache miss (no cached result)
      const miss = await cache.getCachedResult(cacheKey);
      expect(miss).toBeNull();

      // 2. Cache the enrichment result
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        audio: {
          fullTranscription: 'Full transcription here',
          insights: { sentiment: 'positive' },
          cost: 0.5,
          duration: 30,
        },
        video: {
          chapters: [{ title: 'Chapter 1' }],
          cost: 0.3,
          duration: 10,
        },
        summary: {
          summary: { overview: 'Great session' },
          duration: 5,
        },
        totalCost: 0.8,
        totalDuration: 45,
      };

      await cache.cacheResult(cacheKey, result);

      // 3. Cache hit (result retrieved)
      const hit = await cache.getCachedResult(cacheKey);
      expect(hit).toBeDefined();
      expect(hit?.audio?.fullTranscription).toBe('Full transcription here');
      expect(hit?.video?.chapters).toHaveLength(1);
      expect(hit?.totalCost).toBe(0.8);

      // 4. Verify statistics
      const stats = await cache.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(50, 1);
      expect(stats.savingsUSD).toBe(0.8);
    });

    it('should handle cache invalidation on model update', async () => {
      const input: EnrichmentInput = {
        sessionId: 'session-model-update',
        audioData: 'audio',
        prompt: 'Analyze',
        modelConfig: {
          audioModel: 'gpt-4o-v1',
        },
      };

      const cacheKey = cache.generateCacheKey(input);
      const result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'> = {
        audio: {
          fullTranscription: 'Old version',
          cost: 1.0,
          duration: 10,
        },
        totalCost: 1.0,
        totalDuration: 10,
      };

      await cache.cacheResult(cacheKey, result);

      // Verify cached
      const cached1 = await cache.getCachedResult(cacheKey);
      expect(cached1).toBeDefined();

      // Update model version
      const updatedCache = new EnrichmentResultCache({
        autoInvalidateOnModelUpdate: true,
        currentModelVersions: {
          audioModel: 'gpt-4o-v2', // Updated
        },
      });

      // Should be invalidated
      const cached2 = await updatedCache.getCachedResult(cacheKey);
      expect(cached2).toBeNull();
    });
  });
});
