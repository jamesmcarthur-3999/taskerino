/**
 * LRUCache - Least Recently Used Cache with Size-Based Eviction
 *
 * A high-performance LRU cache implementation for hot session data caching.
 * Uses a doubly-linked list for O(1) LRU tracking and a HashMap for O(1) lookups.
 *
 * Features:
 * - Size-based eviction (configurable max bytes)
 * - Optional item count limit
 * - Optional TTL (time-to-live) for entries
 * - Pattern-based invalidation (string/regex)
 * - Hit/miss statistics tracking
 * - Batch operations (getMany, setMany, deleteMany)
 *
 * Performance:
 * - get(): O(1)
 * - set(): O(1) amortized (may evict)
 * - delete(): O(1)
 * - Pattern invalidation: O(n) where n = cache size
 *
 * @see docs/sessions-rewrite/PHASE_4_KICKOFF.md - Task 4.6 details
 */

// ============================================================================
// Types
// ============================================================================

export interface CacheConfig {
  /**
   * Maximum cache size in bytes
   * Default: 100MB
   */
  maxSizeBytes: number;

  /**
   * Optional maximum number of items (hard limit)
   * If specified, cache will evict even if size limit not reached
   */
  maxItems?: number;

  /**
   * Optional time-to-live in milliseconds
   * Entries older than this will be considered expired
   */
  ttl?: number;
}

export interface CacheStats {
  /** Number of cache hits */
  hits: number;

  /** Number of cache misses */
  misses: number;

  /** Hit rate (hits / (hits + misses)) */
  hitRate: number;

  /** Current cache size in bytes */
  size: number;

  /** Maximum cache size in bytes */
  maxSize: number;

  /** Current number of items in cache */
  items: number;

  /** Maximum number of items (if configured) */
  maxItems?: number;

  /** Number of evictions performed */
  evictions: number;

  /** Timestamp of oldest entry (ms since epoch) */
  oldestEntry: number | null;

  /** Timestamp of newest entry (ms since epoch) */
  newestEntry: number | null;
}

/**
 * Cache entry node for doubly-linked list
 * @internal
 */
interface CacheNode<K, V> {
  key: K;
  value: V;
  size: number;
  timestamp: number;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
}

// ============================================================================
// LRUCache Class
// ============================================================================

export class LRUCache<K = string, V = any> {
  private config: CacheConfig;
  private cache: Map<K, CacheNode<K, V>>;
  private head: CacheNode<K, V> | null; // Most recently used
  private tail: CacheNode<K, V> | null; // Least recently used
  private currentSize: number;
  private hits: number;
  private misses: number;
  private evictions: number;

  constructor(config: CacheConfig) {
    this.config = config;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.currentSize = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  // ========================================
  // Core Operations
  // ========================================

  /**
   * Get value from cache
   * Returns undefined if key not found or expired
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);

    if (!node) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (this.config.ttl && Date.now() - node.timestamp > this.config.ttl) {
      // Expired - remove and return undefined
      this.removeNode(node);
      this.cache.delete(key);
      this.currentSize -= node.size;
      this.misses++;
      return undefined;
    }

    // Cache hit - move to front (most recently used)
    this.moveToFront(node);
    this.hits++;
    return node.value;
  }

  /**
   * Set value in cache
   * May trigger eviction if cache is full
   */
  set(key: K, value: V): void {
    const existingNode = this.cache.get(key);

    // Calculate size of new value
    const valueSize = this.estimateSize(value);

    if (existingNode) {
      // Update existing entry
      const sizeDiff = valueSize - existingNode.size;
      existingNode.value = value;
      existingNode.size = valueSize;
      existingNode.timestamp = Date.now();
      this.currentSize += sizeDiff;
      this.moveToFront(existingNode);
    } else {
      // Create new entry
      const node: CacheNode<K, V> = {
        key,
        value,
        size: valueSize,
        timestamp: Date.now(),
        prev: null,
        next: null,
      };

      this.cache.set(key, node);
      this.currentSize += valueSize;
      this.addToFront(node);
    }

    // Evict if necessary
    this.evictIfNeeded();
  }

  /**
   * Check if key exists in cache (without updating access time)
   */
  has(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    // Check TTL
    if (this.config.ttl && Date.now() - node.timestamp > this.config.ttl) {
      // Expired
      this.removeNode(node);
      this.cache.delete(key);
      this.currentSize -= node.size;
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache
   * Returns true if key existed
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    this.currentSize -= node.size;
    return true;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.currentSize = 0;
  }

  // ========================================
  // Batch Operations
  // ========================================

  /**
   * Get multiple values from cache
   * Returns Map with only found keys
   */
  getMany(keys: K[]): Map<K, V> {
    const result = new Map<K, V>();

    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Set multiple values in cache
   */
  setMany(entries: Map<K, V>): void {
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  /**
   * Delete multiple keys from cache
   * Returns number of keys actually deleted
   */
  deleteMany(keys: K[]): number {
    let count = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        count++;
      }
    }
    return count;
  }

  // ========================================
  // Cache Management
  // ========================================

  /**
   * Invalidate (delete) a cache entry
   * Alias for delete() for semantic clarity
   */
  invalidate(key: K): boolean {
    return this.delete(key);
  }

  /**
   * Invalidate all entries matching a pattern
   * Returns number of entries invalidated
   *
   * @param pattern - String (contains match) or RegExp
   */
  invalidatePattern(pattern: string | RegExp): number {
    let count = 0;
    const keysToDelete: K[] = [];

    for (const key of this.cache.keys()) {
      const keyStr = String(key);
      const matches = pattern instanceof RegExp
        ? pattern.test(keyStr)
        : keyStr.includes(pattern);

      if (matches) {
        keysToDelete.push(key);
      }
    }

    // Delete in batch to avoid iterator invalidation
    for (const key of keysToDelete) {
      if (this.delete(key)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Force eviction of expired or oversized entries
   */
  prune(): void {
    // Remove expired entries
    if (this.config.ttl) {
      const now = Date.now();
      const keysToDelete: K[] = [];

      for (const [key, node] of this.cache.entries()) {
        if (now - node.timestamp > this.config.ttl) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.delete(key);
      }
    }

    // Evict if over size limit
    this.evictIfNeeded();
  }

  // ========================================
  // Statistics
  // ========================================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    // Find oldest and newest entries
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    for (const node of this.cache.values()) {
      if (oldestEntry === null || node.timestamp < oldestEntry) {
        oldestEntry = node.timestamp;
      }
      if (newestEntry === null || node.timestamp > newestEntry) {
        newestEntry = node.timestamp;
      }
    }

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      size: this.currentSize,
      maxSize: this.config.maxSizeBytes,
      items: this.cache.size,
      maxItems: this.config.maxItems,
      evictions: this.evictions,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  // ========================================
  // Internal Helpers
  // ========================================

  /**
   * Evict entries if cache is over limits
   * @private
   */
  private evictIfNeeded(): void {
    // Evict based on item count
    if (this.config.maxItems) {
      while (this.cache.size > this.config.maxItems) {
        this.evict();
      }
    }

    // Evict based on size
    while (this.currentSize > this.config.maxSizeBytes) {
      this.evict();
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  private evict(): void {
    if (!this.tail) return;

    const evictedNode = this.tail;
    this.removeNode(evictedNode);
    this.cache.delete(evictedNode.key);
    this.currentSize -= evictedNode.size;
    this.evictions++;
  }

  /**
   * Estimate size of value in bytes
   * Uses JSON.stringify().length as approximation
   * @private
   */
  private estimateSize(value: V): number {
    try {
      // For primitives
      if (value === null || value === undefined) return 0;
      if (typeof value === 'string') return value.length * 2; // UTF-16
      if (typeof value === 'number') return 8;
      if (typeof value === 'boolean') return 4;

      // For objects/arrays - use JSON size as approximation
      const json = JSON.stringify(value);
      return json.length * 2; // UTF-16
    } catch (error) {
      // If serialization fails, use conservative estimate
      console.warn('[LRUCache] Failed to estimate size, using default:', error);
      return 1024; // 1KB default
    }
  }

  /**
   * Move node to front of list (most recently used)
   * @private
   */
  private moveToFront(node: CacheNode<K, V>): void {
    if (node === this.head) return; // Already at front

    // Remove from current position
    this.removeNode(node);

    // Add to front
    this.addToFront(node);
  }

  /**
   * Add node to front of list
   * @private
   */
  private addToFront(node: CacheNode<K, V>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from list (doesn't delete from cache Map)
   * @private
   */
  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // Node is head
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      // Node is tail
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
  }
}

/**
 * Get singleton LRU cache instance for chunked storage
 * @internal
 */
let _storageCache: LRUCache<string, any> | null = null;

export function getStorageCache(): LRUCache<string, any> {
  if (!_storageCache) {
    _storageCache = new LRUCache({
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
      ttl: 5 * 60 * 1000, // 5 minutes
    });
  }
  return _storageCache;
}

/**
 * Reset singleton (for testing)
 * @internal
 */
export function resetStorageCache(): void {
  _storageCache = null;
}
