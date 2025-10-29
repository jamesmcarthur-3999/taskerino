/**
 * EnrichmentResultCache - Content-Addressable Cache for Enrichment Results
 *
 * Production-grade caching system that ensures we never re-process identical content.
 * Delivers 60%+ cache hit rates with dramatic cost savings while being completely
 * transparent to users (no cost anxiety).
 *
 * Architecture:
 * - L1 Cache: In-memory LRUCache for hot data (<10ms lookups)
 * - L2 Cache: ContentAddressableStorage for warm data (<1s lookups)
 * - Content-Addressable: SHA-256 hash of (audioData + videoData + prompt + modelConfig)
 * - Automatic Deduplication: Identical content = same hash = single cache entry
 * - TTL-Based Invalidation: 30 days default, auto-expires stale data
 * - Model Version Tracking: Invalidate cache when models upgrade
 * - Backend Metrics Only: NO user-facing cost indicators
 *
 * Performance Targets:
 * - Cache Hit Rate: >60% after 1 week
 * - L1 Lookup: <10ms
 * - L2 Lookup: <1s
 * - Cost Savings: $5-10 per 100 cached sessions
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.1 specification
 */

import type { Session } from '../../types';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { LRUCache } from '../storage/LRUCache';
import { getCAStorage } from '../storage/ContentAddressableStorage';
import type { ContentAddressableStorage } from '../storage/ContentAddressableStorage';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Input data for cache key generation
 */
export interface EnrichmentInput {
  /** Session ID being enriched */
  sessionId: string;

  /** Audio data to process (base64 audio segments concatenated) */
  audioData?: string;

  /** Video data to process (base64 video file or screenshot hashes) */
  videoData?: string;

  /** Enrichment prompt (influences AI output) */
  prompt: string;

  /** Model configuration (model name, version, parameters) */
  modelConfig: {
    audioModel?: string;
    videoModel?: string;
    summaryModel?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Cached enrichment result
 */
export interface CachedEnrichmentResult {
  /** Cache key (SHA-256 hash of input) */
  cacheKey: string;

  /** When this result was cached */
  cachedAt: number;

  /** Model versions used for enrichment */
  modelVersions: {
    audioModel?: string;
    videoModel?: string;
    summaryModel?: string;
  };

  /** Audio enrichment results */
  audio?: {
    fullTranscription?: string;
    fullAudioAttachmentId?: string;
    insights?: any;
    upgradedSegments?: any[];
    cost: number;
    duration: number;
  };

  /** Video enrichment results */
  video?: {
    chapters?: any[];
    cost: number;
    duration: number;
  };

  /** Summary enrichment results */
  summary?: {
    summary?: any;
    duration: number;
  };

  /** Canvas generation results */
  canvas?: {
    canvasSpec?: any;
    duration: number;
  };

  /** Total cost for this enrichment */
  totalCost: number;

  /** Total duration for this enrichment */
  totalDuration: number;
}

/**
 * Cache statistics (backend only, not shown to users)
 */
export interface CacheStats {
  /** Total cache hits */
  hits: number;

  /** Total cache misses */
  misses: number;

  /** Cache hit rate (0-100%) */
  hitRate: number;

  /** Total cost savings from cache hits (USD) */
  savingsUSD: number;

  /** Number of cache entries */
  entryCount: number;

  /** L1 cache statistics */
  l1Stats: {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
    hitRate: number;
  };

  /** L2 cache statistics */
  l2Stats: {
    hits: number;
    misses: number;
    totalSize: number;
  };

  /** Cache effectiveness metrics */
  effectiveness: {
    avgCostSavingsPerHit: number;
    totalSessionsCached: number;
    avgHitsPerEntry: number;
  };
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** TTL for cache entries (default: 30 days) */
  ttlMs?: number;

  /** Max L1 cache size in bytes (default: 50MB) */
  l1MaxSizeBytes?: number;

  /** Enable automatic cache invalidation on model updates */
  autoInvalidateOnModelUpdate?: boolean;

  /** Current model versions for invalidation checks */
  currentModelVersions?: {
    audioModel?: string;
    videoModel?: string;
    summaryModel?: string;
  };
}

// ============================================================================
// EnrichmentResultCache Class
// ============================================================================

export class EnrichmentResultCache {
  private config: Required<CacheConfig>;
  private l1Cache: LRUCache<string, CachedEnrichmentResult>;
  private caStorage: ContentAddressableStorage | null = null;

  // Statistics (backend only)
  private stats = {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    totalCostSavings: 0,
  };

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<CacheConfig> = {
    ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    l1MaxSizeBytes: 50 * 1024 * 1024, // 50MB
    autoInvalidateOnModelUpdate: true,
    currentModelVersions: {
      audioModel: 'gpt-4o-audio-preview-2024-10-01',
      videoModel: 'claude-sonnet-4-5-20250929',
      summaryModel: 'claude-sonnet-4-5-20250929',
    },
  };

  constructor(config?: CacheConfig) {
    this.config = {
      ...EnrichmentResultCache.DEFAULT_CONFIG,
      ...config,
    };

    // Initialize L1 cache (in-memory LRU)
    this.l1Cache = new LRUCache<string, CachedEnrichmentResult>({
      maxSizeBytes: this.config.l1MaxSizeBytes,
      ttl: this.config.ttlMs,
    });

    console.log('[EnrichmentCache] Initialized', {
      ttl: `${this.config.ttlMs / (24 * 60 * 60 * 1000)} days`,
      l1MaxSize: `${this.config.l1MaxSizeBytes / (1024 * 1024)}MB`,
      autoInvalidate: this.config.autoInvalidateOnModelUpdate,
    });
  }

  /**
   * Initialize L2 cache (async - CA storage requires async setup)
   */
  private async initL2Cache(): Promise<void> {
    if (!this.caStorage) {
      this.caStorage = await getCAStorage();
    }
  }

  // ========================================
  // Core Cache Operations
  // ========================================

  /**
   * Get cached enrichment result by cache key
   *
   * Implements two-tier lookup:
   * 1. L1 (in-memory): <10ms
   * 2. L2 (CA storage): <1s
   *
   * @param cacheKey - SHA-256 hash of enrichment input
   * @returns Cached result or null if not found/expired
   */
  async getCachedResult(cacheKey: string): Promise<CachedEnrichmentResult | null> {
    // L1 Cache Lookup (fast path)
    const l1Result = this.l1Cache.get(cacheKey);
    if (l1Result) {
      this.stats.hits++;
      this.stats.l1Hits++;
      this.stats.totalCostSavings += l1Result.totalCost;

      console.log(`[EnrichmentCache] ✓ L1 HIT: ${cacheKey.slice(0, 8)}... (saved $${l1Result.totalCost.toFixed(2)})`);
      return l1Result;
    }

    this.stats.l1Misses++;

    // L2 Cache Lookup (slower path - CA storage)
    await this.initL2Cache();
    if (!this.caStorage) {
      this.stats.misses++;
      return null;
    }

    try {
      const attachment = await this.caStorage.loadAttachment(cacheKey);
      if (!attachment || !attachment.base64) {
        this.stats.misses++;
        this.stats.l2Misses++;
        console.log(`[EnrichmentCache] ✗ L2 MISS: ${cacheKey.slice(0, 8)}...`);
        return null;
      }

      // Deserialize cached result from base64 JSON
      const resultJson = atob(attachment.base64);
      const result: CachedEnrichmentResult = JSON.parse(resultJson);

      // Check TTL
      const age = Date.now() - result.cachedAt;
      if (age > this.config.ttlMs) {
        console.log(`[EnrichmentCache] ⏰ EXPIRED: ${cacheKey.slice(0, 8)}... (age: ${Math.round(age / (24 * 60 * 60 * 1000))} days)`);
        this.stats.misses++;
        this.stats.l2Misses++;
        return null;
      }

      // Check model version invalidation
      if (this.config.autoInvalidateOnModelUpdate) {
        const isInvalidated = this.isInvalidatedByModelUpdate(result);
        if (isInvalidated) {
          console.log(`[EnrichmentCache] 🔄 INVALIDATED: ${cacheKey.slice(0, 8)}... (model version changed)`);
          this.stats.misses++;
          this.stats.l2Misses++;
          return null;
        }
      }

      // L2 Cache Hit - promote to L1
      this.l1Cache.set(cacheKey, result);
      this.stats.hits++;
      this.stats.l2Hits++;
      this.stats.totalCostSavings += result.totalCost;

      console.log(`[EnrichmentCache] ✓ L2 HIT: ${cacheKey.slice(0, 8)}... (saved $${result.totalCost.toFixed(2)}, promoted to L1)`);
      return result;
    } catch (error) {
      console.error(`[EnrichmentCache] Error loading from L2:`, error);
      this.stats.misses++;
      this.stats.l2Misses++;
      return null;
    }
  }

  /**
   * Cache an enrichment result
   *
   * Stores in both L1 (fast) and L2 (persistent) caches.
   *
   * @param cacheKey - SHA-256 hash of enrichment input
   * @param result - Enrichment result to cache
   */
  async cacheResult(cacheKey: string, result: Omit<CachedEnrichmentResult, 'cacheKey' | 'cachedAt' | 'modelVersions'>): Promise<void> {
    const cachedResult: CachedEnrichmentResult = {
      cacheKey,
      cachedAt: Date.now(),
      modelVersions: this.config.currentModelVersions,
      ...result,
    };

    // Store in L1 (in-memory)
    this.l1Cache.set(cacheKey, cachedResult);

    // Store in L2 (CA storage)
    await this.initL2Cache();
    if (!this.caStorage) {
      console.warn('[EnrichmentCache] L2 storage not available, skipping persistent cache');
      return;
    }

    try {
      // Serialize to base64 JSON
      const resultJson = JSON.stringify(cachedResult);
      const base64 = btoa(resultJson);

      // Save as attachment in CA storage
      const attachment = {
        id: cacheKey,
        type: 'file' as const, // EnrichmentResultCache uses 'file' type
        name: `enrichment-${cacheKey.slice(0, 8)}.json`,
        mimeType: 'application/json',
        size: base64.length,
        createdAt: new Date().toISOString(),
        base64,
        hash: cacheKey,
      };

      await this.caStorage.saveAttachment(attachment);

      console.log(`[EnrichmentCache] ✓ CACHED: ${cacheKey.slice(0, 8)}... ($${result.totalCost.toFixed(2)}, ${(base64.length / 1024).toFixed(2)}KB)`);
    } catch (error) {
      console.error(`[EnrichmentCache] Error saving to L2:`, error);
    }
  }

  /**
   * Generate cache key from enrichment input
   *
   * Uses SHA-256 hash of:
   * - Audio data (base64 concatenated segments)
   * - Video data (base64 video or screenshot hashes)
   * - Enrichment prompt
   * - Model configuration (model names, temperature, maxTokens)
   *
   * This ensures identical inputs always produce the same cache key.
   *
   * @param input - Enrichment input data
   * @returns SHA-256 hash as cache key
   */
  generateCacheKey(input: EnrichmentInput): string {
    // Normalize inputs to ensure deterministic hashing
    const normalizedInput = {
      audioData: input.audioData || '',
      videoData: input.videoData || '',
      prompt: input.prompt.trim(),
      modelConfig: {
        audioModel: input.modelConfig.audioModel || '',
        videoModel: input.modelConfig.videoModel || '',
        summaryModel: input.modelConfig.summaryModel || '',
        temperature: input.modelConfig.temperature ?? 0.7,
        maxTokens: input.modelConfig.maxTokens ?? 4096,
      },
    };

    // Serialize to deterministic JSON with sorted keys (recursive)
    const inputString = this.deterministicStringify(normalizedInput);

    // Calculate SHA-256 hash
    const inputBytes = new TextEncoder().encode(inputString);
    const hashBytes = sha256(inputBytes);
    const hashHex = bytesToHex(hashBytes);

    return hashHex;
  }

  /**
   * Generate cache key from session data
   *
   * Helper that extracts audio/video data from session.
   *
   * @param session - Session to generate cache key for
   * @param prompt - Enrichment prompt
   * @param modelConfig - Model configuration
   * @returns SHA-256 hash as cache key
   */
  generateCacheKeyFromSession(
    session: Session,
    prompt: string,
    modelConfig: EnrichmentInput['modelConfig']
  ): string {
    // Extract audio data (concatenate all audio segment base64 data)
    let audioData = '';
    if (session.audioSegments && session.audioSegments.length > 0) {
      // Use audio segment metadata as fingerprint (not actual base64 to avoid huge strings)
      audioData = session.audioSegments
        .map(seg => `${seg.attachmentId}:${seg.duration}:${seg.startTime}`)
        .join('|');
    }

    // Extract video data (use screenshot hashes or video attachment ID)
    let videoData = '';
    if (session.video?.fullVideoAttachmentId) {
      videoData = session.video.fullVideoAttachmentId;
    } else if (session.screenshots && session.screenshots.length > 0) {
      // Use screenshot attachment IDs as fingerprint
      videoData = session.screenshots
        .map(ss => ss.attachmentId)
        .join('|');
    }

    return this.generateCacheKey({
      sessionId: session.id,
      audioData,
      videoData,
      prompt,
      modelConfig,
    });
  }

  // ========================================
  // Cache Management
  // ========================================

  /**
   * Invalidate cache entries matching a pattern
   *
   * @param pattern - String (contains match) or RegExp
   * @returns Number of entries invalidated
   */
  async invalidateCache(pattern: string | RegExp): Promise<number> {
    // Invalidate L1
    const l1Count = this.l1Cache.invalidatePattern(pattern);

    // Invalidate L2
    await this.initL2Cache();
    let l2Count = 0;
    if (this.caStorage) {
      try {
        const allHashes = await this.caStorage.getAllHashes();
        for (const hash of allHashes) {
          const matches = pattern instanceof RegExp
            ? pattern.test(hash)
            : hash.includes(pattern);

          if (matches) {
            const deleted = await this.caStorage.deleteAttachment(hash);
            if (deleted) {
              l2Count++;
            }
          }
        }
      } catch (error) {
        console.error('[EnrichmentCache] Error invalidating L2:', error);
      }
    }

    const total = l1Count + l2Count;
    console.log(`[EnrichmentCache] ✓ Invalidated ${total} entries (L1: ${l1Count}, L2: ${l2Count})`);
    return total;
  }

  /**
   * Clear expired cache entries
   *
   * Removes entries older than TTL.
   *
   * @param ttl - Optional TTL override (ms)
   * @returns Number of entries cleared
   */
  async clearExpired(ttl?: number): Promise<number> {
    const effectiveTtl = ttl ?? this.config.ttlMs;
    const now = Date.now();
    let count = 0;

    // L1 Cache - automatically handles TTL via LRUCache
    this.l1Cache.prune();

    // L2 Cache - manually check cached results
    await this.initL2Cache();
    if (this.caStorage) {
      try {
        const allHashes = await this.caStorage.getAllHashes();
        for (const hash of allHashes) {
          const attachment = await this.caStorage.loadAttachment(hash);
          if (!attachment || !attachment.base64) continue;

          try {
            const resultJson = atob(attachment.base64);
            const result: CachedEnrichmentResult = JSON.parse(resultJson);

            const age = now - result.cachedAt;
            if (age > effectiveTtl) {
              const deleted = await this.caStorage.deleteAttachment(hash);
              if (deleted) {
                count++;
              }
            }
          } catch (error) {
            // Invalid format - delete it
            await this.caStorage.deleteAttachment(hash);
            count++;
          }
        }
      } catch (error) {
        console.error('[EnrichmentCache] Error clearing expired L2 entries:', error);
      }
    }

    console.log(`[EnrichmentCache] ✓ Cleared ${count} expired entries`);
    return count;
  }

  /**
   * Clear all cache entries
   */
  async clearAll(): Promise<void> {
    // Clear L1
    this.l1Cache.clear();

    // Clear L2
    await this.initL2Cache();
    if (this.caStorage) {
      try {
        const allHashes = await this.caStorage.getAllHashes();
        for (const hash of allHashes) {
          await this.caStorage.deleteAttachment(hash);
        }
      } catch (error) {
        console.error('[EnrichmentCache] Error clearing L2:', error);
      }
    }

    console.log('[EnrichmentCache] ✓ Cleared all cache entries');
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
  async getCacheStats(): Promise<CacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    const l1Stats = this.l1Cache.getStats();

    // Count L2 entries
    await this.initL2Cache();
    let l2EntryCount = 0;
    let l2TotalSize = 0;
    if (this.caStorage) {
      try {
        const caStats = await this.caStorage.getStats();
        l2EntryCount = caStats.totalAttachments;
        l2TotalSize = caStats.totalSize;
      } catch (error) {
        console.error('[EnrichmentCache] Error getting L2 stats:', error);
      }
    }

    const avgCostSavingsPerHit = this.stats.hits > 0
      ? this.stats.totalCostSavings / this.stats.hits
      : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      savingsUSD: this.stats.totalCostSavings,
      entryCount: l1Stats.items + l2EntryCount,
      l1Stats: {
        hits: this.stats.l1Hits,
        misses: this.stats.l1Misses,
        size: l1Stats.size,
        maxSize: l1Stats.maxSize,
        hitRate: l1Stats.hitRate * 100,
      },
      l2Stats: {
        hits: this.stats.l2Hits,
        misses: this.stats.l2Misses,
        totalSize: l2TotalSize,
      },
      effectiveness: {
        avgCostSavingsPerHit,
        totalSessionsCached: l1Stats.items + l2EntryCount,
        avgHitsPerEntry: (l1Stats.items + l2EntryCount) > 0
          ? this.stats.hits / (l1Stats.items + l2EntryCount)
          : 0,
      },
    };
  }

  /**
   * Reset statistics counters
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      totalCostSavings: 0,
    };
    this.l1Cache.resetStats();
    console.log('[EnrichmentCache] ✓ Reset statistics');
  }

  // ========================================
  // Internal Helpers
  // ========================================

  /**
   * Deterministic JSON stringify with recursively sorted keys
   * @private
   */
  private deterministicStringify(obj: any): string {
    if (obj === null || obj === undefined) {
      return JSON.stringify(obj);
    }

    if (typeof obj !== 'object') {
      return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.deterministicStringify(item)).join(',') + ']';
    }

    // Sort object keys and recursively stringify
    const sortedKeys = Object.keys(obj).sort();
    const pairs = sortedKeys.map(key => {
      const value = this.deterministicStringify(obj[key]);
      return `"${key}":${value}`;
    });

    return '{' + pairs.join(',') + '}';
  }

  /**
   * Check if cached result is invalidated due to model version update
   * @private
   */
  private isInvalidatedByModelUpdate(result: CachedEnrichmentResult): boolean {
    const current = this.config.currentModelVersions;
    const cached = result.modelVersions;

    // Check if any model version changed
    if (current.audioModel && cached.audioModel && current.audioModel !== cached.audioModel) {
      return true;
    }
    if (current.videoModel && cached.videoModel && current.videoModel !== cached.videoModel) {
      return true;
    }
    if (current.summaryModel && cached.summaryModel && current.summaryModel !== cached.summaryModel) {
      return true;
    }

    return false;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _instance: EnrichmentResultCache | null = null;

/**
 * Get singleton EnrichmentResultCache instance
 */
export function getEnrichmentResultCache(config?: CacheConfig): EnrichmentResultCache {
  if (!_instance) {
    _instance = new EnrichmentResultCache(config);
  }
  return _instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetEnrichmentResultCache(): void {
  _instance = null;
}
