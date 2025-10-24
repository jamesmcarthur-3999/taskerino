/**
 * LazyLoader - 3-Tier Lazy Loading System (Phase 3.2)
 *
 * Implements progressive loading for massive performance gains:
 * - Tier 1: Index (always loaded) → IDs only, 100 entities ~1KB
 * - Tier 2: Metadata (lazy load) → Lightweight preview, 100 entities ~10KB
 * - Tier 3: Full Entity (lazy load) → Complete data, 100 entities ~500KB
 *
 * Performance Targets:
 * - Startup Time: < 1 second with 10,000 sessions (vs 5-10 seconds before)
 * - Memory Usage: < 100MB with 10,000 sessions (vs 1GB before)
 * - List Rendering: < 50ms for 1000 items (metadata only)
 * - Full Load: < 200ms for single session (from cache or storage)
 *
 * Testing checklist:
 * [ ] Metadata loads < 100ms for 1000 entities
 * [ ] Full entity loads < 200ms
 * [ ] Cache hit returns instantly
 * [ ] Prefetch runs in background without blocking
 * [ ] Memory usage < 100MB with 10,000 entities
 * [ ] List view renders with metadata only
 * [ ] Detail view loads full entity on demand
 * [ ] Cache eviction prevents memory leaks
 */

import type { StorageAdapter } from './StorageAdapter';

/**
 * Metadata for quick list rendering
 * Lightweight preview of entity for list views
 */
export interface EntityMetadata {
  id: string;
  title: string; // name for sessions, title for notes/tasks
  preview: string; // First 100 chars of content/description
  date: number; // startTime, createdAt, or updatedAt
  status?: string; // For sessions/tasks
  tags?: string[]; // Topic/company/contact IDs
  size?: number; // Approximate full entity size in bytes
}

/**
 * Lazy loading configuration
 */
export interface LazyLoadConfig {
  prefetchCount?: number; // Number of entities to prefetch (default: 10)
  cacheSize?: number; // Max entities to keep in memory (default: 100)
  prefetchDelay?: number; // Delay before prefetching (ms, default: 1000)
}

/**
 * LazyLoader manages 3-tier loading
 *
 * Architecture:
 * - Tier 1: Index - Always loaded from Phase 3.1 metadata index (~1KB for 100 entities)
 * - Tier 2: Metadata - Lazy loaded on demand, cached (~10KB for 100 entities)
 * - Tier 3: Full Entity - Lazy loaded on demand, cached with LRU eviction (~500KB for 100 entities)
 */
export class LazyLoader<T extends { id: string }> {
  private storage: StorageAdapter;
  private collection: string;
  private config: LazyLoadConfig;

  // Tier 1: Always loaded (from index)
  private entityIds: string[] = [];

  // Tier 2: Metadata cache (lazy loaded)
  private metadataCache = new Map<string, EntityMetadata>();

  // Tier 3: Full entity cache (lazy loaded)
  private entityCache = new Map<string, T>();
  private entityCacheAccessOrder: string[] = []; // LRU tracking

  // Prefetch queue
  private prefetchQueue: string[] = [];
  private prefetchTimer: NodeJS.Timeout | null = null;

  constructor(storage: StorageAdapter, collection: string, config?: LazyLoadConfig) {
    this.storage = storage;
    this.collection = collection;
    this.config = {
      prefetchCount: config?.prefetchCount || 10,
      cacheSize: config?.cacheSize || 100,
      prefetchDelay: config?.prefetchDelay || 1000,
    };
  }

  /**
   * Initialize: Load index (Tier 1)
   * Loads only entity IDs from Phase 3.1 metadata index
   */
  async initialize(): Promise<void> {
    // Load metadata index from Phase 3.1
    const indexResult = await this.storage.loadIndex<EntityMetadata[]>(this.collection, 'metadata' as any);

    if (indexResult) {
      // Extract IDs from metadata index
      this.entityIds = indexResult.index.map((meta) => meta.id);
      console.log(`[LazyLoader] Initialized ${this.collection}: ${this.entityIds.length} entities`);
    } else {
      console.warn(`[LazyLoader] No metadata index found for ${this.collection}`);
      this.entityIds = [];
    }
  }

  /**
   * Get all entity IDs (Tier 1 - instant)
   * Returns array of all entity IDs from index
   */
  getEntityIds(): string[] {
    return this.entityIds;
  }

  /**
   * Load metadata for entities (Tier 2 - fast)
   * Returns lightweight metadata for list rendering
   */
  async loadMetadata(ids: string[]): Promise<EntityMetadata[]> {
    const results: EntityMetadata[] = [];
    const toLoad: string[] = [];

    // Check cache first
    for (const id of ids) {
      const cached = this.metadataCache.get(id);
      if (cached) {
        results.push(cached);
      } else {
        toLoad.push(id);
      }
    }

    // Load missing metadata from index
    if (toLoad.length > 0) {
      const indexResult = await this.storage.loadIndex<EntityMetadata[]>(this.collection, 'metadata' as any);

      if (indexResult) {
        for (const id of toLoad) {
          const meta = indexResult.index.find((m) => m.id === id);
          if (meta) {
            this.metadataCache.set(id, meta);
            results.push(meta);
          }
        }
      }
    }

    // Enforce cache size limit (LRU eviction)
    if (this.metadataCache.size > this.config.cacheSize!) {
      const entriesToRemove = this.metadataCache.size - this.config.cacheSize!;
      const keys = Array.from(this.metadataCache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        this.metadataCache.delete(keys[i]);
      }
    }

    return results;
  }

  /**
   * Load full entity (Tier 3 - slower)
   * Loads complete entity data with all fields
   */
  async loadEntity(id: string): Promise<T | null> {
    // Check cache first
    const cached = this.entityCache.get(id);
    if (cached) {
      console.log(`[LazyLoader] Cache hit for ${this.collection}/${id}`);

      // Update LRU order
      this.updateLRU(id);

      return cached;
    }

    // Load from storage
    console.log(`[LazyLoader] Loading entity from storage: ${this.collection}/${id}`);
    const entity = await this.loadEntityFromStorage(id);

    if (entity) {
      // Add to cache
      this.entityCache.set(id, entity);
      this.entityCacheAccessOrder.push(id);

      // Enforce cache size limit with LRU eviction
      if (this.entityCache.size > this.config.cacheSize!) {
        const entriesToRemove = this.entityCache.size - this.config.cacheSize!;
        for (let i = 0; i < entriesToRemove; i++) {
          const oldestId = this.entityCacheAccessOrder.shift();
          if (oldestId) {
            this.entityCache.delete(oldestId);
            console.log(`[LazyLoader] Evicted ${this.collection}/${oldestId} from cache (LRU)`);
          }
        }
      }
    }

    return entity;
  }

  /**
   * Load entity from storage (internal helper)
   * Uses storage adapter to load single entity
   */
  private async loadEntityFromStorage(id: string): Promise<T | null> {
    try {
      // Load full collection (TEMPORARY - Phase 3.3 will add per-entity storage)
      const collection = await this.storage.load<T[]>(this.collection);

      if (!collection || !Array.isArray(collection)) {
        return null;
      }

      // Find entity by ID
      const entity = collection.find(e => e.id === id);
      return entity || null;
    } catch (error) {
      console.error(`[LazyLoader] Failed to load entity ${this.collection}/${id}:`, error);
      return null;
    }
  }

  /**
   * Update LRU access order
   */
  private updateLRU(id: string): void {
    // Remove from current position
    const index = this.entityCacheAccessOrder.indexOf(id);
    if (index !== -1) {
      this.entityCacheAccessOrder.splice(index, 1);
    }

    // Add to end (most recently used)
    this.entityCacheAccessOrder.push(id);
  }

  /**
   * Prefetch entities in background
   * Non-blocking, runs after delay to avoid blocking UI
   */
  async prefetch(ids: string[]): Promise<void> {
    // Add to prefetch queue (skip already cached)
    const toFetch = ids.filter(id => !this.entityCache.has(id));
    this.prefetchQueue.push(...toFetch);

    // Clear existing timer
    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
    }

    // Schedule prefetch after delay
    this.prefetchTimer = setTimeout(async () => {
      const batch = this.prefetchQueue.splice(0, this.config.prefetchCount!);

      if (batch.length > 0) {
        console.log(`[LazyLoader] Prefetching ${batch.length} ${this.collection}...`);

        // Load in parallel
        await Promise.all(
          batch.map(id => this.loadEntity(id))
        );

        console.log(`[LazyLoader] Prefetch complete: ${batch.length} entities`);
      }
    }, this.config.prefetchDelay);
  }

  /**
   * Clear all caches
   * Useful for forcing refresh
   */
  clearCache(): void {
    this.metadataCache.clear();
    this.entityCache.clear();
    this.entityCacheAccessOrder = [];
    this.prefetchQueue = [];

    if (this.prefetchTimer) {
      clearTimeout(this.prefetchTimer);
      this.prefetchTimer = null;
    }

    console.log(`[LazyLoader] Cleared cache for ${this.collection}`);
  }

  /**
   * Get cache statistics
   * Useful for debugging and monitoring
   */
  getCacheStats(): {
    entityIds: number;
    metadataCached: number;
    entitiesCached: number;
    prefetchQueueSize: number;
  } {
    return {
      entityIds: this.entityIds.length,
      metadataCached: this.metadataCache.size,
      entitiesCached: this.entityCache.size,
      prefetchQueueSize: this.prefetchQueue.length,
    };
  }

  /**
   * Batch load entities
   * Efficiently loads multiple entities at once
   */
  async loadEntities(ids: string[]): Promise<T[]> {
    const entities = await Promise.all(
      ids.map(id => this.loadEntity(id))
    );

    return entities.filter((e): e is T => e !== null);
  }
}
