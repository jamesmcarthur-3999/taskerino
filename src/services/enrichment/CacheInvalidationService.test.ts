/**
 * CacheInvalidationService Unit Tests
 *
 * Comprehensive test suite covering all cache invalidation functionality:
 * - Model version tracking
 * - Pattern-based invalidation
 * - Bulk invalidation
 * - Statistics tracking
 * - Cache registration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CacheInvalidationService,
  getCacheInvalidationService,
  resetCacheInvalidationService,
} from './CacheInvalidationService';
import { MemoizationCache } from './MemoizationCache';

// Mock storage
vi.mock('../storage', () => ({
  getStorage: vi.fn(async () => ({
    load: vi.fn(async () => null),
    save: vi.fn(async () => {}),
  })),
}));

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock enrichment cache
 */
function createMockEnrichmentCache() {
  return {
    invalidateCache: vi.fn(async (pattern: string | RegExp) => 5),
    clearAll: vi.fn(async () => {}),
  };
}

// ============================================================================
// Model Version Tracking Tests
// ============================================================================

describe('CacheInvalidationService - Model Version Tracking', () => {
  let service: CacheInvalidationService;

  beforeEach(() => {
    service = new CacheInvalidationService();
  });

  afterEach(() => {
    resetCacheInvalidationService();
  });

  it('should initialize with default model versions', () => {
    const versions = service.getModelVersions();

    expect(versions.audioModel).toBe('gpt-4o-audio-preview-2024-10-01');
    expect(versions.videoModel).toBe('claude-sonnet-4-5-20250929');
    expect(versions.summaryModel).toBe('claude-sonnet-4-5-20250929');
    expect(versions.lastChecked).toBeTruthy();
  });

  it('should initialize with custom model versions', () => {
    const customService = new CacheInvalidationService({
      audioModel: 'custom-audio-model',
      videoModel: 'custom-video-model',
    });

    const versions = customService.getModelVersions();

    expect(versions.audioModel).toBe('custom-audio-model');
    expect(versions.videoModel).toBe('custom-video-model');
    expect(versions.summaryModel).toBe('claude-sonnet-4-5-20250929'); // Default
  });

  it('should update model version and return null if unchanged', async () => {
    const versions = service.getModelVersions();

    const result = await service.updateModelVersion('audio', versions.audioModel);

    expect(result).toBeNull();
  });

  it('should update model version and invalidate if changed', async () => {
    const mockEnrichmentCache = createMockEnrichmentCache();
    const mockMemoizationCache = new MemoizationCache({ autoCleanup: false });

    service.registerEnrichmentCache(mockEnrichmentCache as any);
    service.registerMemoizationCache('audio', mockMemoizationCache);

    const newVersion = 'gpt-4o-audio-preview-2025-01-01';
    const result = await service.updateModelVersion('audio', newVersion);

    expect(result).toBeTruthy();
    expect(result?.trigger).toBe('model');
    expect(result?.count).toBeGreaterThan(0);

    const versions = service.getModelVersions();
    expect(versions.audioModel).toBe(newVersion);

    mockMemoizationCache.shutdown();
  });

  it('should track model upgrade in statistics', async () => {
    const mockEnrichmentCache = createMockEnrichmentCache();
    service.registerEnrichmentCache(mockEnrichmentCache as any);

    const oldVersion = service.getModelVersions().audioModel;
    const newVersion = 'gpt-4o-audio-preview-2025-01-01';

    await service.updateModelVersion('audio', newVersion);

    const stats = service.getStats();
    expect(stats.modelUpgrades.length).toBeGreaterThan(0);
    expect(stats.modelUpgrades[0].modelType).toBe('audio');
    expect(stats.modelUpgrades[0].oldVersion).toBe(oldVersion);
    expect(stats.modelUpgrades[0].newVersion).toBe(newVersion);
  });

  it('should keep only recent 10 model upgrades', async () => {
    const mockEnrichmentCache = createMockEnrichmentCache();
    service.registerEnrichmentCache(mockEnrichmentCache as any);

    // Perform 15 upgrades
    for (let i = 1; i <= 15; i++) {
      await service.updateModelVersion('audio', `version-${i}`);
    }

    const stats = service.getStats();
    expect(stats.modelUpgrades.length).toBe(10);
  });
});

// ============================================================================
// Cache Registration Tests
// ============================================================================

describe('CacheInvalidationService - Cache Registration', () => {
  let service: CacheInvalidationService;

  beforeEach(() => {
    service = new CacheInvalidationService();
  });

  afterEach(() => {
    resetCacheInvalidationService();
  });

  it('should register enrichment cache', () => {
    const mockCache = createMockEnrichmentCache();

    service.registerEnrichmentCache(mockCache as any);

    // Verify by triggering invalidation
    service.invalidateByPattern('test');
    expect(mockCache.invalidateCache).toHaveBeenCalled();
  });

  it('should register memoization caches', () => {
    const mockCache1 = new MemoizationCache({ autoCleanup: false });
    const mockCache2 = new MemoizationCache({ autoCleanup: false });

    service.registerMemoizationCache('screenshot', mockCache1);
    service.registerMemoizationCache('audio', mockCache2);

    // Add data to verify registration
    mockCache1.set('key1', { data: '1' });
    mockCache2.set('key2', { data: '2' });

    // Trigger invalidation
    service.invalidateByPattern('key');

    // Both caches should be affected
    expect(mockCache1.has('key1')).toBe(false);
    expect(mockCache2.has('key2')).toBe(false);

    mockCache1.shutdown();
    mockCache2.shutdown();
  });
});

// ============================================================================
// Pattern Invalidation Tests
// ============================================================================

describe('CacheInvalidationService - Pattern Invalidation', () => {
  let service: CacheInvalidationService;
  let mockEnrichmentCache: ReturnType<typeof createMockEnrichmentCache>;
  let mockMemoizationCache: MemoizationCache<any>;

  beforeEach(() => {
    service = new CacheInvalidationService();
    mockEnrichmentCache = createMockEnrichmentCache();
    mockMemoizationCache = new MemoizationCache({ autoCleanup: false });

    service.registerEnrichmentCache(mockEnrichmentCache as any);
    service.registerMemoizationCache('screenshot', mockMemoizationCache);
  });

  afterEach(() => {
    mockMemoizationCache.shutdown();
    resetCacheInvalidationService();
  });

  it('should invalidate by string pattern', async () => {
    // Add data to memoization cache
    mockMemoizationCache.set('screenshot-001', { data: '1' });
    mockMemoizationCache.set('screenshot-002', { data: '2' });
    mockMemoizationCache.set('audio-001', { data: '3' });

    const result = await service.invalidateByPattern('screenshot');

    expect(result.count).toBeGreaterThan(0);
    expect(result.trigger).toBe('manual');
    expect(result.cachesAffected.length).toBeGreaterThan(0);
  });

  it('should invalidate by regex pattern', async () => {
    mockMemoizationCache.set('screenshot-001', { data: '1' });
    mockMemoizationCache.set('screenshot-002', { data: '2' });
    mockMemoizationCache.set('audio-001', { data: '3' });

    const result = await service.invalidateByPattern(/screenshot-\d+/);

    expect(result.count).toBeGreaterThan(0);
    expect(result.trigger).toBe('manual');
  });

  it('should invalidate with custom trigger and reason', async () => {
    const result = await service.invalidateByPattern('test', 'prompt', 'User re-enriched session');

    expect(result.trigger).toBe('prompt');
    expect(result.reason).toBe('User re-enriched session');
  });

  it('should update statistics after pattern invalidation', async () => {
    mockMemoizationCache.set('key1', { data: '1' });

    await service.invalidateByPattern('key1', 'manual');

    const stats = service.getStats();
    expect(stats.totalInvalidations).toBeGreaterThan(0);
    expect(stats.byTrigger.manual).toBeGreaterThan(0);
    expect(stats.lastInvalidation).toBeTruthy();
  });

  it('should measure invalidation duration', async () => {
    const result = await service.invalidateByPattern('test');

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeLessThan(1000); // Should be fast (<1s)
  });
});

// ============================================================================
// Bulk Invalidation Tests
// ============================================================================

describe('CacheInvalidationService - Bulk Invalidation', () => {
  let service: CacheInvalidationService;
  let mockEnrichmentCache: ReturnType<typeof createMockEnrichmentCache>;
  let mockMemoizationCache1: MemoizationCache<any>;
  let mockMemoizationCache2: MemoizationCache<any>;

  beforeEach(() => {
    service = new CacheInvalidationService();
    mockEnrichmentCache = createMockEnrichmentCache();
    mockMemoizationCache1 = new MemoizationCache({ autoCleanup: false });
    mockMemoizationCache2 = new MemoizationCache({ autoCleanup: false });

    service.registerEnrichmentCache(mockEnrichmentCache as any);
    service.registerMemoizationCache('screenshot', mockMemoizationCache1);
    service.registerMemoizationCache('audio', mockMemoizationCache2);
  });

  afterEach(() => {
    mockMemoizationCache1.shutdown();
    mockMemoizationCache2.shutdown();
    resetCacheInvalidationService();
  });

  it('should invalidate all caches', async () => {
    // Add data to all caches
    mockMemoizationCache1.set('key1', { data: '1' });
    mockMemoizationCache2.set('key2', { data: '2' });

    const result = await service.invalidateAll();

    expect(result.count).toBeGreaterThan(0);
    expect(result.cachesAffected.length).toBeGreaterThan(0);
    expect(result.trigger).toBe('manual');

    // Verify all caches cleared
    expect(mockEnrichmentCache.clearAll).toHaveBeenCalled();
    expect(mockMemoizationCache1.getStats().size).toBe(0);
    expect(mockMemoizationCache2.getStats().size).toBe(0);
  });

  it('should invalidate all with custom trigger and reason', async () => {
    const result = await service.invalidateAll('prompt', 'System reset');

    expect(result.trigger).toBe('prompt');
    expect(result.reason).toBe('System reset');
  });
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe('CacheInvalidationService - Statistics', () => {
  let service: CacheInvalidationService;

  beforeEach(() => {
    service = new CacheInvalidationService();
  });

  afterEach(() => {
    resetCacheInvalidationService();
  });

  it('should return initial statistics', () => {
    const stats = service.getStats();

    expect(stats.totalInvalidations).toBe(0);
    expect(stats.totalEntriesInvalidated).toBe(0);
    expect(stats.lastInvalidation).toBeNull();
    expect(stats.avgInvalidationTimeMs).toBe(0);
  });

  it('should track invalidations by trigger type', async () => {
    const mockCache = new MemoizationCache({ autoCleanup: false });
    service.registerMemoizationCache('test', mockCache);

    mockCache.set('key1', { data: '1' });

    await service.invalidateByPattern('key1', 'manual');
    await service.invalidateByPattern('key2', 'prompt');

    const stats = service.getStats();
    expect(stats.byTrigger.manual).toBe(1);
    expect(stats.byTrigger.prompt).toBe(1);

    mockCache.shutdown();
  });

  it('should calculate average invalidation time', async () => {
    const mockCache = new MemoizationCache({ autoCleanup: false });
    service.registerMemoizationCache('test', mockCache);

    await service.invalidateByPattern('test1');
    await service.invalidateByPattern('test2');
    await service.invalidateByPattern('test3');

    const stats = service.getStats();
    expect(stats.avgInvalidationTimeMs).toBeGreaterThan(0);

    mockCache.shutdown();
  });

  it('should reset statistics', async () => {
    const mockCache = new MemoizationCache({ autoCleanup: false });
    service.registerMemoizationCache('test', mockCache);

    mockCache.set('key1', { data: '1' });
    await service.invalidateByPattern('key1');

    let stats = service.getStats();
    expect(stats.totalInvalidations).toBeGreaterThan(0);

    service.resetStats();

    stats = service.getStats();
    expect(stats.totalInvalidations).toBe(0);
    expect(stats.totalEntriesInvalidated).toBe(0);
    expect(stats.lastInvalidation).toBeNull();

    mockCache.shutdown();
  });
});

// ============================================================================
// shouldInvalidate Tests
// ============================================================================

describe('CacheInvalidationService - shouldInvalidate', () => {
  let service: CacheInvalidationService;

  beforeEach(() => {
    service = new CacheInvalidationService();
  });

  afterEach(() => {
    resetCacheInvalidationService();
  });

  it('should not invalidate for content changes (handled by CA storage)', () => {
    const result = service.shouldInvalidate('test-key', 'content');
    expect(result).toBe(false);
  });

  it('should not invalidate for TTL (handled automatically)', () => {
    const result = service.shouldInvalidate('test-key', 'ttl');
    expect(result).toBe(false);
  });

  it('should invalidate for prompt updates', () => {
    const result = service.shouldInvalidate('test-key', 'prompt');
    expect(result).toBe(true);
  });

  it('should invalidate for manual triggers', () => {
    const result = service.shouldInvalidate('test-key', 'manual');
    expect(result).toBe(true);
  });

  it('should invalidate for model upgrades', () => {
    const result = service.shouldInvalidate('test-key', 'model');
    expect(result).toBe(true);
  });
});

// ============================================================================
// Singleton Tests
// ============================================================================

describe('CacheInvalidationService - Singleton', () => {
  afterEach(() => {
    resetCacheInvalidationService();
  });

  it('should return same instance', () => {
    const service1 = getCacheInvalidationService();
    const service2 = getCacheInvalidationService();

    expect(service1).toBe(service2);
  });

  it('should reset singleton', () => {
    const service1 = getCacheInvalidationService();
    resetCacheInvalidationService();
    const service2 = getCacheInvalidationService();

    expect(service1).not.toBe(service2);
  });
});
