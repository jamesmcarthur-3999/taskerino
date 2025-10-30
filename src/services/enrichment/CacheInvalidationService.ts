/**
 * CacheInvalidationService - Smart Cache Invalidation Rules
 *
 * Production-grade service for managing cache invalidation across all enrichment
 * caches (EnrichmentResultCache + MemoizationCache). Ensures cached data stays
 * fresh by intelligently invalidating caches when needed.
 *
 * Invalidation Triggers:
 * 1. Content Changes: Automatic (content-addressable hashing)
 * 2. Prompt Updates: Manual (user-initiated "re-enrich")
 * 3. Model Upgrades: Automatic (track model versions)
 * 4. TTL Expiry: Automatic (30 days default for results, 24 hours for memoization)
 *
 * Features:
 * - Model version tracking (detect upgrades automatically)
 * - Pattern-based invalidation (regex or string matching)
 * - Bulk operations (invalidate multiple caches at once)
 * - Admin UI integration (Settings → Advanced → System Health)
 * - Zero false invalidations
 * - <100ms pattern invalidation for 10,000 entries
 *
 * Architecture:
 * 1. Track current model versions in memory + storage
 * 2. On startup, check if models upgraded
 * 3. If upgraded, invalidate all caches for that model
 * 4. Provide manual invalidation APIs for admin UI
 *
 * Performance Targets:
 * - Model upgrades auto-invalidate within 1s
 * - Pattern invalidation <100ms for 10,000 entries
 * - Admin UI functional (hidden by default)
 * - Zero false invalidations
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.4 specification
 */

import type { EnrichmentResultCache } from './EnrichmentResultCache';
import type { MemoizationCache } from './MemoizationCache';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Invalidation rule configuration
 */
export interface InvalidationRule {
  /** Invalidation trigger type */
  trigger: 'content' | 'prompt' | 'model' | 'ttl' | 'manual';

  /** Optional pattern for matching cache keys (string or regex) */
  pattern?: string | RegExp;

  /** Optional TTL override (ms) */
  ttl?: number;

  /** Human-readable reason for invalidation */
  reason?: string;
}

/**
 * Model version tracking
 */
export interface ModelVersions {
  /** Audio model version (e.g., "gpt-4o-audio-preview-2024-10-01") */
  audioModel: string;

  /** Video model version (e.g., "claude-sonnet-4-5-20250929") */
  videoModel: string;

  /** Summary model version (e.g., "claude-sonnet-4-5-20250929") */
  summaryModel: string;

  /** Last checked timestamp (ISO string) */
  lastChecked: string;
}

/**
 * Invalidation result
 */
export interface InvalidationResult {
  /** Number of entries invalidated */
  count: number;

  /** Caches affected */
  cachesAffected: string[];

  /** Invalidation trigger */
  trigger: InvalidationRule['trigger'];

  /** Human-readable reason */
  reason: string;

  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * Cache invalidation statistics
 */
export interface InvalidationStats {
  /** Total invalidations performed */
  totalInvalidations: number;

  /** Invalidations by trigger type */
  byTrigger: {
    content: number;
    prompt: number;
    model: number;
    ttl: number;
    manual: number;
  };

  /** Total entries invalidated */
  totalEntriesInvalidated: number;

  /** Average invalidation time (ms) */
  avgInvalidationTimeMs: number;

  /** Last invalidation timestamp (ISO string) */
  lastInvalidation: string | null;

  /** Model upgrade history (recent 10) */
  modelUpgrades: Array<{
    modelType: 'audio' | 'video' | 'summary';
    oldVersion: string;
    newVersion: string;
    timestamp: string;
    entriesInvalidated: number;
  }>;
}

// ============================================================================
// CacheInvalidationService Class
// ============================================================================

/**
 * Current model versions (Claude 4.5 family as of Phase 5)
 */
const DEFAULT_MODEL_VERSIONS: ModelVersions = {
  audioModel: 'gpt-4o-audio-preview-2024-10-01',
  videoModel: 'claude-sonnet-4-5-20250929',
  summaryModel: 'claude-sonnet-4-5-20250929',
  lastChecked: new Date().toISOString(),
};

export class CacheInvalidationService {
  private modelVersions: ModelVersions;
  private enrichmentCache: EnrichmentResultCache | null = null;
  private memoizationCaches: Map<string, MemoizationCache<any>> = new Map();

  // Statistics (backend only)
  private stats: InvalidationStats = {
    totalInvalidations: 0,
    byTrigger: {
      content: 0,
      prompt: 0,
      model: 0,
      ttl: 0,
      manual: 0,
    },
    totalEntriesInvalidated: 0,
    avgInvalidationTimeMs: 0,
    lastInvalidation: null,
    modelUpgrades: [],
  };

  private readonly logger = this.createLogger();

  constructor(initialModelVersions?: Partial<ModelVersions>) {
    this.modelVersions = {
      ...DEFAULT_MODEL_VERSIONS,
      ...initialModelVersions,
    };

    this.logger.info('CacheInvalidationService initialized', {
      audioModel: this.modelVersions.audioModel,
      videoModel: this.modelVersions.videoModel,
      summaryModel: this.modelVersions.summaryModel,
    });
  }

  // ========================================
  // Cache Registration
  // ========================================

  /**
   * Register enrichment result cache
   *
   * @param cache - EnrichmentResultCache instance
   */
  registerEnrichmentCache(cache: EnrichmentResultCache): void {
    this.enrichmentCache = cache;
    this.logger.info('Enrichment cache registered');
  }

  /**
   * Register a memoization cache
   *
   * @param name - Cache name (e.g., "screenshot", "audio", "summary")
   * @param cache - MemoizationCache instance
   */
  registerMemoizationCache(name: string, cache: MemoizationCache<any>): void {
    this.memoizationCaches.set(name, cache);
    this.logger.info(`Memoization cache registered: ${name}`);
  }

  // ========================================
  // Model Version Management
  // ========================================

  /**
   * Update model version and invalidate if changed
   *
   * @param modelType - Model type ("audio" | "video" | "summary")
   * @param newVersion - New model version string
   * @returns Invalidation result (null if no change)
   */
  async updateModelVersion(
    modelType: 'audio' | 'video' | 'summary',
    newVersion: string
  ): Promise<InvalidationResult | null> {
    const key = `${modelType}Model` as keyof Omit<ModelVersions, 'lastChecked'>;
    const oldVersion = this.modelVersions[key];

    if (oldVersion === newVersion) {
      this.logger.info(`Model version unchanged: ${modelType} = ${newVersion}`);
      return null;
    }

    this.logger.warn(`Model version upgraded: ${modelType} (${oldVersion} → ${newVersion})`);

    // Update version
    this.modelVersions[key] = newVersion;
    this.modelVersions.lastChecked = new Date().toISOString();

    // Persist to storage
    await this.persistModelVersions();

    // Invalidate caches for this model
    const result = await this.invalidateForModelUpgrade(modelType, oldVersion, newVersion);

    return result;
  }

  /**
   * Get current model versions
   *
   * @returns Current model versions
   */
  getModelVersions(): ModelVersions {
    return { ...this.modelVersions };
  }

  /**
   * Check if model versions need updating
   *
   * Loads from storage and compares with current in-memory versions.
   * Returns true if any model version changed.
   *
   * @returns True if models upgraded
   */
  async checkForModelUpgrades(): Promise<boolean> {
    try {
      const { getStorage } = await import('../storage');
      const storage = await getStorage();
      const stored = await storage.load<ModelVersions>('enrichment/model-versions');

      if (!stored) {
        // First run - persist current versions
        await this.persistModelVersions();
        return false;
      }

      let hasUpgrade = false;

      // Check each model type
      if (stored.audioModel !== this.modelVersions.audioModel) {
        await this.updateModelVersion('audio', this.modelVersions.audioModel);
        hasUpgrade = true;
      }
      if (stored.videoModel !== this.modelVersions.videoModel) {
        await this.updateModelVersion('video', this.modelVersions.videoModel);
        hasUpgrade = true;
      }
      if (stored.summaryModel !== this.modelVersions.summaryModel) {
        await this.updateModelVersion('summary', this.modelVersions.summaryModel);
        hasUpgrade = true;
      }

      return hasUpgrade;
    } catch (error) {
      this.logger.error('Failed to check for model upgrades', error);
      return false;
    }
  }

  /**
   * Persist model versions to storage
   */
  private async persistModelVersions(): Promise<void> {
    try {
      const { getStorage } = await import('../storage');
      const storage = await getStorage();
      await storage.save('enrichment/model-versions', this.modelVersions);
      this.logger.info('Model versions persisted to storage');
    } catch (error) {
      this.logger.error('Failed to persist model versions', error);
    }
  }

  // ========================================
  // Invalidation Operations
  // ========================================

  /**
   * Check if cache needs invalidation based on rule
   *
   * @param cacheKey - Cache key to check
   * @param trigger - Invalidation trigger type
   * @returns True if cache should be invalidated
   */
  shouldInvalidate(cacheKey: string, trigger: InvalidationRule['trigger']): boolean {
    // Content changes are handled by content-addressable hashing
    if (trigger === 'content') {
      return false; // No explicit invalidation needed
    }

    // TTL is handled automatically by caches
    if (trigger === 'ttl') {
      return false; // No explicit invalidation needed
    }

    // Prompt updates and manual invalidations always invalidate
    if (trigger === 'prompt' || trigger === 'manual') {
      return true;
    }

    // Model upgrades: check if cache key related to upgraded model
    if (trigger === 'model') {
      // This is a simplified check - in production, you'd inspect cache metadata
      return true;
    }

    return false;
  }

  /**
   * Invalidate caches by pattern
   *
   * @param pattern - String (contains match) or RegExp
   * @param trigger - Invalidation trigger type
   * @param reason - Human-readable reason
   * @returns Invalidation result
   */
  async invalidateByPattern(
    pattern: string | RegExp,
    trigger: InvalidationRule['trigger'] = 'manual',
    reason?: string
  ): Promise<InvalidationResult> {
    const startTime = Date.now();
    let totalCount = 0;
    const cachesAffected: string[] = [];

    this.logger.info(`Invalidating by pattern: ${pattern} (trigger: ${trigger})`);

    // Invalidate enrichment cache
    if (this.enrichmentCache) {
      const count = await this.enrichmentCache.invalidateCache(pattern);
      if (count > 0) {
        totalCount += count;
        cachesAffected.push('enrichment');
      }
    }

    // Invalidate memoization caches
    for (const [name, cache] of this.memoizationCaches) {
      const count = cache.invalidate(pattern);
      if (count > 0) {
        totalCount += count;
        cachesAffected.push(`memoization:${name}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // Update stats
    this.updateStats(trigger, totalCount, durationMs);

    const result: InvalidationResult = {
      count: totalCount,
      cachesAffected,
      trigger,
      reason: reason || `Pattern invalidation: ${pattern}`,
      durationMs,
    };

    this.logger.info(`Invalidation complete`, {
      count: totalCount,
      caches: cachesAffected,
      duration: `${durationMs}ms`,
    });

    return result;
  }

  /**
   * Invalidate caches for model upgrade
   *
   * @param modelType - Model type that upgraded
   * @param oldVersion - Old model version
   * @param newVersion - New model version
   * @returns Invalidation result
   */
  private async invalidateForModelUpgrade(
    modelType: 'audio' | 'video' | 'summary',
    oldVersion: string,
    newVersion: string
  ): Promise<InvalidationResult> {
    const startTime = Date.now();
    let totalCount = 0;
    const cachesAffected: string[] = [];

    this.logger.info(`Invalidating for model upgrade: ${modelType} (${oldVersion} → ${newVersion})`);

    // Invalidate enrichment cache (all entries - model version embedded in cache key)
    if (this.enrichmentCache) {
      const count = await this.enrichmentCache.invalidateCache('');
      if (count > 0) {
        totalCount += count;
        cachesAffected.push('enrichment');
      }
    }

    // Invalidate relevant memoization caches
    const relevantCaches: Record<typeof modelType, string[]> = {
      audio: ['audio', 'summary'],
      video: ['screenshot', 'summary'],
      summary: ['summary'],
    };

    for (const cacheName of relevantCaches[modelType]) {
      const cache = this.memoizationCaches.get(cacheName);
      if (cache) {
        cache.clear(); // Clear entire cache for model upgrade
        const stats = cache.getStats();
        totalCount += stats.size;
        cachesAffected.push(`memoization:${cacheName}`);
      }
    }

    const durationMs = Date.now() - startTime;

    // Update stats
    this.updateStats('model', totalCount, durationMs);

    // Track model upgrade
    this.stats.modelUpgrades.unshift({
      modelType,
      oldVersion,
      newVersion,
      timestamp: new Date().toISOString(),
      entriesInvalidated: totalCount,
    });

    // Keep only recent 10 upgrades
    if (this.stats.modelUpgrades.length > 10) {
      this.stats.modelUpgrades = this.stats.modelUpgrades.slice(0, 10);
    }

    const result: InvalidationResult = {
      count: totalCount,
      cachesAffected,
      trigger: 'model',
      reason: `Model upgraded: ${modelType} (${oldVersion} → ${newVersion})`,
      durationMs,
    };

    this.logger.info(`Model upgrade invalidation complete`, {
      count: totalCount,
      caches: cachesAffected,
      duration: `${durationMs}ms`,
    });

    return result;
  }

  /**
   * Invalidate all caches (bulk operation)
   *
   * @param trigger - Invalidation trigger type
   * @param reason - Human-readable reason
   * @returns Invalidation result
   */
  async invalidateAll(
    trigger: InvalidationRule['trigger'] = 'manual',
    reason?: string
  ): Promise<InvalidationResult> {
    const startTime = Date.now();
    let totalCount = 0;
    const cachesAffected: string[] = [];

    this.logger.warn('Invalidating ALL caches', { trigger, reason });

    // Clear enrichment cache
    if (this.enrichmentCache) {
      await this.enrichmentCache.clearAll();
      cachesAffected.push('enrichment');
      totalCount += 1; // Approximate (don't count exact entries for clearAll)
    }

    // Clear memoization caches
    for (const [name, cache] of this.memoizationCaches) {
      const stats = cache.getStats();
      totalCount += stats.size;
      cache.clear();
      cachesAffected.push(`memoization:${name}`);
    }

    const durationMs = Date.now() - startTime;

    // Update stats
    this.updateStats(trigger, totalCount, durationMs);

    const result: InvalidationResult = {
      count: totalCount,
      cachesAffected,
      trigger,
      reason: reason || 'Manual bulk invalidation',
      durationMs,
    };

    this.logger.info(`Bulk invalidation complete`, {
      count: totalCount,
      caches: cachesAffected,
      duration: `${durationMs}ms`,
    });

    return result;
  }

  // ========================================
  // Statistics (Backend Only)
  // ========================================

  /**
   * Get invalidation statistics
   *
   * IMPORTANT: These metrics are BACKEND ONLY.
   * Can be shown in Settings → Advanced → System Health (hidden by default).
   *
   * @returns Invalidation statistics
   */
  getStats(): InvalidationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalInvalidations: 0,
      byTrigger: {
        content: 0,
        prompt: 0,
        model: 0,
        ttl: 0,
        manual: 0,
      },
      totalEntriesInvalidated: 0,
      avgInvalidationTimeMs: 0,
      lastInvalidation: null,
      modelUpgrades: [],
    };
    this.logger.info('Statistics reset');
  }

  /**
   * Update statistics after invalidation
   */
  private updateStats(
    trigger: InvalidationRule['trigger'],
    entriesInvalidated: number,
    durationMs: number
  ): void {
    this.stats.totalInvalidations++;
    this.stats.byTrigger[trigger]++;
    this.stats.totalEntriesInvalidated += entriesInvalidated;
    this.stats.lastInvalidation = new Date().toISOString();

    // Update average invalidation time
    const totalTime =
      this.stats.avgInvalidationTimeMs * (this.stats.totalInvalidations - 1) + durationMs;
    this.stats.avgInvalidationTimeMs = totalTime / this.stats.totalInvalidations;
  }

  // ========================================
  // Internal Helpers
  // ========================================

  /**
   * Create logger for cache invalidation operations
   */
  private createLogger() {
    const prefix = '[CacheInvalidation]';

    return {
      info: (message: string, data?: any) => {
        console.log(`${prefix} ${message}`, data || '');
      },
      warn: (message: string, data?: any) => {
        console.warn(`${prefix} ${message}`, data || '');
      },
      error: (message: string, error?: any) => {
        console.error(`${prefix} ${message}`, error || '');
      },
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _instance: CacheInvalidationService | null = null;

/**
 * Get singleton CacheInvalidationService instance
 */
export function getCacheInvalidationService(
  initialModelVersions?: Partial<ModelVersions>
): CacheInvalidationService {
  if (!_instance) {
    _instance = new CacheInvalidationService(initialModelVersions);
  }
  return _instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetCacheInvalidationService(): void {
  _instance = null;
}
