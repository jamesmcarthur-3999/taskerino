/**
 * MemoizationCache - Generic LRU Cache for Intermediate AI API Results
 *
 * Production-grade memoization cache that caches intermediate AI API results
 * to reduce redundant API calls by 30-50%. This cache is separate from
 * EnrichmentResultCache and focuses on memoizing individual API calls
 * (screenshot analysis, audio transcription, summary generation).
 *
 * Features:
 * - Generic type support: Works for any result type
 * - LRU eviction: Automatic eviction when cache reaches maxSize
 * - TTL support: Auto-expire entries after TTL milliseconds
 * - Hit/Miss tracking: Backend statistics (NO user UI)
 * - Pattern invalidation: Clear entries matching regex
 * - <1ms cache lookup time
 * - 10,000 entry capacity
 *
 * Memoization Targets:
 * 1. Screenshot Analysis (40-60% hit rate)
 *    - Key: SHA-256(imageData + analysisPrompt)
 *    - Value: { summary, detectedActivity, extractedText }
 *    - Savings: Duplicate screenshots are common
 *
 * 2. Audio Transcription (20-30% hit rate)
 *    - Key: SHA-256(audioData + whisperModel)
 *    - Value: { transcription, confidence }
 *    - Savings: Silence segments often identical
 *
 * 3. Summary Generation (10-20% hit rate)
 *    - Key: SHA-256(allData + summaryPrompt)
 *    - Value: { summary, extractedTasks, extractedNotes }
 *    - Savings: Similar session patterns
 *
 * Performance Targets:
 * - 30-50% API call reduction
 * - $2-5 savings per 100 sessions
 * - <1ms cache lookup time
 * - 10,000 entry capacity
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.3 specification
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Cached item with metadata
 */
interface CachedItem<T> {
  /** Cache key */
  key: string;

  /** Cached value */
  value: T;

  /** When this item was created (timestamp ms) */
  createdAt: number;

  /** When this item expires (timestamp ms) */
  expiresAt: number;

  /** Last access time (for LRU eviction) */
  lastAccessedAt: number;

  /** Number of times this item was accessed */
  accessCount: number;

  /** Size in bytes (estimated) */
  sizeBytes: number;
}

/**
 * Cache statistics (backend only, not shown to users)
 */
export interface MemoizationStats {
  /** Total cache hits */
  hits: number;

  /** Total cache misses */
  misses: number;

  /** Cache hit rate (0-100%) */
  hitRate: number;

  /** Number of cache entries */
  size: number;

  /** Total cache size in bytes */
  sizeBytes: number;

  /** Maximum cache size in bytes */
  maxSizeBytes: number;

  /** Number of entries evicted due to LRU */
  evictions: number;

  /** Number of entries expired due to TTL */
  expirations: number;

  /** Average access count per entry */
  avgAccessCount: number;

  /** Most accessed keys (top 10) */
  topKeys: Array<{ key: string; accessCount: number }>;
}

/**
 * Cache configuration
 */
export interface MemoizationCacheConfig {
  /** Maximum cache size in entries (default: 10,000) */
  maxSize?: number;

  /** Maximum cache size in bytes (default: 100MB) */
  maxSizeBytes?: number;

  /** Default TTL for cache entries in milliseconds (default: 24 hours) */
  defaultTTL?: number;

  /** Enable automatic TTL cleanup (default: true) */
  autoCleanup?: boolean;

  /** TTL cleanup interval in milliseconds (default: 5 minutes) */
  cleanupInterval?: number;
}

// ============================================================================
// MemoizationCache Class
// ============================================================================

/**
 * Generic LRU cache with TTL support for memoizing AI API results
 */
export class MemoizationCache<T> {
  private cache = new Map<string, CachedItem<T>>();
  private config: Required<MemoizationCacheConfig>;

  // Statistics (backend only)
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  // Cleanup timer
  private cleanupTimer: NodeJS.Timeout | null = null;

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<MemoizationCacheConfig> = {
    maxSize: 10000,
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
    autoCleanup: true,
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
  };

  constructor(config?: MemoizationCacheConfig) {
    this.config = {
      ...MemoizationCache.DEFAULT_CONFIG,
      ...config,
    };

    console.log('[MemoizationCache] Initialized', {
      maxSize: this.config.maxSize,
      maxSizeBytes: `${this.config.maxSizeBytes / (1024 * 1024)}MB`,
      defaultTTL: `${this.config.defaultTTL / (60 * 60 * 1000)} hours`,
      autoCleanup: this.config.autoCleanup,
    });

    // Start automatic cleanup if enabled
    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  // ========================================
  // Core Cache Operations
  // ========================================

  /**
   * Get or compute a value with automatic caching
   *
   * This is the primary API for memoization. If the key exists in cache
   * and is not expired, returns cached value. Otherwise, computes the value
   * using computeFn, caches it, and returns the result.
   *
   * @param key - Cache key (should be a hash or unique identifier)
   * @param computeFn - Function to compute value if cache miss
   * @param ttl - Optional TTL override (ms)
   * @returns Cached or computed value
   */
  async getOrCompute(
    key: string,
    computeFn: () => Promise<T>,
    ttl: number = this.config.defaultTTL
  ): Promise<T> {
    // Check cache first
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - compute value
    const value = await computeFn();

    // Store in cache
    this.set(key, value, ttl);

    return value;
  }

  /**
   * Get a value from cache
   *
   * Returns null if key doesn't exist or entry is expired.
   *
   * @param key - Cache key
   * @returns Cached value or null
   */
  get(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now > item.expiresAt) {
      // Expired - remove from cache
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.expirations++;
      console.log(`[MemoizationCache] ⏰ EXPIRED: ${key.slice(0, 8)}...`);
      return null;
    }

    // Cache hit - update access metadata
    item.lastAccessedAt = now;
    item.accessCount++;
    this.stats.hits++;

    console.log(`[MemoizationCache] ✓ HIT: ${key.slice(0, 8)}... (access #${item.accessCount})`);
    return item.value;
  }

  /**
   * Set a value in cache
   *
   * If cache is full, evicts least recently used entry.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - TTL in milliseconds
   */
  set(key: string, value: T, ttl: number = this.config.defaultTTL): void {
    const now = Date.now();
    const sizeBytes = this.estimateSize(value);

    // Check if cache is full - evict LRU if needed
    while (this.shouldEvict(sizeBytes)) {
      this.evictLRU();
    }

    const item: CachedItem<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + ttl,
      lastAccessedAt: now,
      accessCount: 0,
      sizeBytes,
    };

    this.cache.set(key, item);
    console.log(`[MemoizationCache] ✓ SET: ${key.slice(0, 8)}... (${(sizeBytes / 1024).toFixed(2)}KB, TTL: ${ttl}ms)`);
  }

  /**
   * Check if a key exists in cache (without updating access time)
   *
   * @param key - Cache key
   * @returns True if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) {
      return false;
    }

    // Check if expired
    const now = Date.now();
    if (now > item.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key from cache
   *
   * @param key - Cache key
   * @returns True if key was deleted
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    console.log('[MemoizationCache] ✓ Cleared all cache entries');
  }

  // ========================================
  // Pattern-Based Operations
  // ========================================

  /**
   * Invalidate cache entries matching a pattern
   *
   * @param pattern - String (contains match) or RegExp
   * @returns Number of entries invalidated
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0;

    for (const [key] of this.cache) {
      const matches = pattern instanceof RegExp
        ? pattern.test(key)
        : key.includes(pattern);

      if (matches) {
        this.cache.delete(key);
        count++;
      }
    }

    console.log(`[MemoizationCache] ✓ Invalidated ${count} entries (pattern: ${pattern})`);
    return count;
  }

  // ========================================
  // Maintenance Operations
  // ========================================

  /**
   * Remove expired entries from cache
   *
   * @returns Number of entries removed
   */
  prune(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, item] of this.cache) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        this.stats.expirations++;
        count++;
      }
    }

    if (count > 0) {
      console.log(`[MemoizationCache] ✓ Pruned ${count} expired entries`);
    }

    return count;
  }

  /**
   * Evict least recently used entry
   *
   * @returns True if an entry was evicted
   */
  private evictLRU(): boolean {
    if (this.cache.size === 0) {
      return false;
    }

    // Find LRU entry (oldest lastAccessedAt)
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, item] of this.cache) {
      if (item.lastAccessedAt < lruTime) {
        lruTime = item.lastAccessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
      console.log(`[MemoizationCache] ✓ EVICTED (LRU): ${lruKey.slice(0, 8)}...`);
      return true;
    }

    return false;
  }

  /**
   * Check if cache should evict an entry
   *
   * @param newItemSize - Size of new item to be added
   * @returns True if eviction is needed
   */
  private shouldEvict(newItemSize: number): boolean {
    // Check entry count limit
    if (this.cache.size >= this.config.maxSize) {
      return true;
    }

    // Check byte size limit
    const currentSize = this.getCurrentSize();
    if (currentSize + newItemSize > this.config.maxSizeBytes) {
      return true;
    }

    return false;
  }

  /**
   * Get current cache size in bytes
   */
  private getCurrentSize(): number {
    let total = 0;
    for (const item of this.cache.values()) {
      total += item.sizeBytes;
    }
    return total;
  }

  /**
   * Estimate size of a value in bytes
   *
   * This is a rough estimate based on JSON serialization.
   */
  private estimateSize(value: T): number {
    try {
      const json = JSON.stringify(value);
      return json.length * 2; // UTF-16 characters = 2 bytes each
    } catch (error) {
      // Fallback to a reasonable default if serialization fails
      return 1024; // 1KB default
    }
  }

  // ========================================
  // Automatic Cleanup
  // ========================================

  /**
   * Start automatic cleanup timer
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) {
      return; // Already started
    }

    this.cleanupTimer = setInterval(() => {
      const pruned = this.prune();
      if (pruned > 0) {
        console.log(`[MemoizationCache] ⏰ Auto-cleanup: ${pruned} entries pruned`);
      }
    }, this.config.cleanupInterval);

    console.log(`[MemoizationCache] ✓ Auto-cleanup started (interval: ${this.config.cleanupInterval}ms)`);
  }

  /**
   * Stop automatic cleanup timer
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('[MemoizationCache] ✓ Auto-cleanup stopped');
    }
  }

  /**
   * Shutdown cache (stop timers, clear memory)
   */
  shutdown(): void {
    this.stopAutoCleanup();
    this.clear();
    console.log('[MemoizationCache] ✓ Shutdown complete');
  }

  // ========================================
  // Statistics (Backend Only)
  // ========================================

  /**
   * Get cache statistics
   *
   * IMPORTANT: These metrics are BACKEND ONLY.
   * Do NOT display to users in main UI to avoid cost anxiety.
   * Can be shown in Settings → Advanced → System Health (hidden by default).
   *
   * @returns Cache statistics
   */
  getStats(): MemoizationStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    // Calculate average access count
    let totalAccessCount = 0;
    for (const item of this.cache.values()) {
      totalAccessCount += item.accessCount;
    }
    const avgAccessCount = this.cache.size > 0 ? totalAccessCount / this.cache.size : 0;

    // Get top 10 most accessed keys
    const topKeys = Array.from(this.cache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10)
      .map(item => ({ key: item.key.slice(0, 16) + '...', accessCount: item.accessCount }));

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      size: this.cache.size,
      sizeBytes: this.getCurrentSize(),
      maxSizeBytes: this.config.maxSizeBytes,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
      avgAccessCount,
      topKeys,
    };
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };
    console.log('[MemoizationCache] ✓ Reset statistics');
  }
}

// ============================================================================
// Singleton Instances for Common Use Cases
// ============================================================================

let _screenshotCache: MemoizationCache<any> | null = null;
let _audioTranscriptionCache: MemoizationCache<any> | null = null;
let _summaryCache: MemoizationCache<any> | null = null;

/**
 * Get singleton screenshot analysis memoization cache
 *
 * Target: 40-60% hit rate
 * Key: SHA-256(imageData + analysisPrompt)
 * Value: { summary, detectedActivity, extractedText }
 */
export function getScreenshotMemoizationCache(): MemoizationCache<any> {
  if (!_screenshotCache) {
    _screenshotCache = new MemoizationCache({
      maxSize: 5000, // 5,000 screenshots
      maxSizeBytes: 50 * 1024 * 1024, // 50MB
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      autoCleanup: true,
    });
  }
  return _screenshotCache;
}

/**
 * Get singleton audio transcription memoization cache
 *
 * Target: 20-30% hit rate
 * Key: SHA-256(audioData + whisperModel)
 * Value: { transcription, confidence }
 */
export function getAudioTranscriptionMemoizationCache(): MemoizationCache<any> {
  if (!_audioTranscriptionCache) {
    _audioTranscriptionCache = new MemoizationCache({
      maxSize: 3000, // 3,000 audio segments
      maxSizeBytes: 30 * 1024 * 1024, // 30MB
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      autoCleanup: true,
    });
  }
  return _audioTranscriptionCache;
}

/**
 * Get singleton summary generation memoization cache
 *
 * Target: 10-20% hit rate
 * Key: SHA-256(allData + summaryPrompt)
 * Value: { summary, extractedTasks, extractedNotes }
 */
export function getSummaryMemoizationCache(): MemoizationCache<any> {
  if (!_summaryCache) {
    _summaryCache = new MemoizationCache({
      maxSize: 2000, // 2,000 summaries
      maxSizeBytes: 20 * 1024 * 1024, // 20MB
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
      autoCleanup: true,
    });
  }
  return _summaryCache;
}

/**
 * Reset all singleton caches (for testing)
 */
export function resetAllMemoizationCaches(): void {
  if (_screenshotCache) {
    _screenshotCache.shutdown();
    _screenshotCache = null;
  }
  if (_audioTranscriptionCache) {
    _audioTranscriptionCache.shutdown();
    _audioTranscriptionCache = null;
  }
  if (_summaryCache) {
    _summaryCache.shutdown();
    _summaryCache = null;
  }
}
