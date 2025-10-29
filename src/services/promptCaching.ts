/**
 * Prompt Caching Helpers
 *
 * Utilities for using Claude's prompt caching feature (90% cost savings on cached content).
 *
 * How Prompt Caching Works:
 * - Cache long, reusable content (system prompts, context, examples)
 * - Cached content marked with cache_control: { type: "ephemeral" }
 * - 5-minute cache TTL (refreshed on each use)
 * - Minimum 1024 tokens to cache (too small = no benefit)
 * - 90% cost reduction on cache hits vs cache misses
 *
 * Best Practices:
 * - Cache system prompts (same across requests)
 * - Cache session context (same for multiple screenshots)
 * - Cache examples and guidelines (static content)
 * - DON'T cache per-request data (changes every call)
 *
 * Architecture:
 * 1. Frontend creates cache structure
 * 2. Rust claude_api.rs sends with anthropic-beta header
 * 3. Claude caches marked content
 * 4. Subsequent calls hit cache (90% savings)
 *
 * References:
 * - https://docs.anthropic.com/claude/docs/prompt-caching
 * - Minimum cacheable content: 1024 tokens (~4096 characters)
 */

export interface CacheControlBlock {
  type: 'ephemeral'; // Currently only ephemeral supported
}

export interface CachedSystemMessage {
  type: 'text';
  text: string;
  cache_control?: CacheControlBlock;
}

export interface CacheStats {
  cacheableTokens: number;    // Tokens eligible for caching
  cachedTokens: number;       // Tokens actually cached
  cacheHitRate: number;       // 0-1 (percentage of tokens served from cache)
  estimatedSavings: number;   // USD saved via caching
}

export class PromptCachingService {
  private readonly CACHE_MIN_TOKENS = 1024;      // Minimum tokens to cache
  private readonly CACHE_MIN_CHARS = 4096;       // Approximate chars (4 chars per token)
  private readonly CACHE_SAVINGS_RATE = 0.9;     // 90% savings on cached content
  private readonly CACHE_TTL_MINUTES = 5;        // Cache expires after 5 minutes

  /**
   * Create a cached system message
   *
   * Marks content for caching if it meets minimum length requirement.
   * Content shorter than 1024 tokens won't be cached.
   *
   * @param content - System prompt content
   * @param forceCache - Force caching even if below threshold (not recommended)
   * @returns Cached system message structure
   */
  createCachedSystemMessage(
    content: string,
    forceCache: boolean = false
  ): CachedSystemMessage {
    const shouldCache = forceCache || content.length >= this.CACHE_MIN_CHARS;

    if (!shouldCache) {
      console.log(`[PromptCache] Content too short for caching (${content.length} chars < ${this.CACHE_MIN_CHARS} min)`);
      return {
        type: 'text',
        text: content,
      };
    }

    console.log(`[PromptCache] Marking content for caching (${content.length} chars)`);
    return {
      type: 'text',
      text: content,
      cache_control: { type: 'ephemeral' },
    };
  }

  /**
   * Create multiple cached system messages
   *
   * Useful for separating static context (guidelines, examples) from
   * dynamic context (session data).
   *
   * Only the last block in the array can have cache_control.
   *
   * @param messages - Array of system messages
   * @param cacheLastBlock - Whether to cache the last block (default: true)
   * @returns Array of system messages with caching
   */
  createCachedSystemMessages(
    messages: string[],
    cacheLastBlock: boolean = true
  ): CachedSystemMessage[] {
    if (messages.length === 0) return [];

    // All messages except last
    const nonCachedMessages: CachedSystemMessage[] = messages
      .slice(0, -1)
      .map((text) => ({
        type: 'text' as const,
        text,
      }));

    // Last message (potentially cached)
    const lastMessage = messages[messages.length - 1];
    const cachedLastMessage = cacheLastBlock
      ? this.createCachedSystemMessage(lastMessage)
      : { type: 'text' as const, text: lastMessage };

    return [...nonCachedMessages, cachedLastMessage];
  }

  /**
   * Calculate cache statistics from API response
   *
   * @param usage - Usage stats from Claude API response
   * @param inputCostPerMTok - Input cost per million tokens
   * @returns Cache statistics
   */
  calculateCacheStats(
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;      // Tokens served from cache
      cache_creation_input_tokens?: number;  // Tokens written to cache (first call)
    },
    inputCostPerMTok: number
  ): CacheStats {
    const cachedTokens = usage.cache_read_input_tokens ?? 0;
    const cacheableTokens = cachedTokens + (usage.cache_creation_input_tokens ?? 0);

    const cacheHitRate = cacheableTokens > 0 ? cachedTokens / cacheableTokens : 0;

    // Calculate savings: cached tokens would cost full price without caching
    const fullCost = (cachedTokens / 1_000_000) * inputCostPerMTok;
    const estimatedSavings = fullCost * this.CACHE_SAVINGS_RATE;

    return {
      cacheableTokens,
      cachedTokens,
      cacheHitRate,
      estimatedSavings,
    };
  }

  /**
   * Estimate cache benefit for a given prompt
   *
   * Helps decide whether caching is worthwhile.
   *
   * @param promptLength - Length of prompt in characters
   * @param expectedReuses - How many times prompt will be reused
   * @param inputCostPerMTok - Input cost per million tokens
   * @returns Estimated savings in USD
   */
  estimateCacheBenefit(
    promptLength: number,
    expectedReuses: number,
    inputCostPerMTok: number
  ): {
    worthCaching: boolean;
    estimatedSavings: number;
    breakEvenReuses: number;
  } {
    // Convert chars to tokens (rough estimate: 4 chars = 1 token)
    const estimatedTokens = promptLength / 4;

    // Not worth caching if below minimum
    if (estimatedTokens < this.CACHE_MIN_TOKENS) {
      return {
        worthCaching: false,
        estimatedSavings: 0,
        breakEvenReuses: 0,
      };
    }

    // Cost per request without caching
    const costPerRequest = (estimatedTokens / 1_000_000) * inputCostPerMTok;

    // Cost with caching:
    // - First request: full cost (cache creation)
    // - Subsequent requests: 10% cost (90% savings)
    const cachedCostPerRequest = costPerRequest * 0.1;

    // Total cost without caching
    const totalCostWithoutCache = costPerRequest * expectedReuses;

    // Total cost with caching
    const totalCostWithCache = costPerRequest + (cachedCostPerRequest * (expectedReuses - 1));

    // Savings
    const estimatedSavings = totalCostWithoutCache - totalCostWithCache;

    // Break-even point (when caching starts saving money)
    // Cache write cost is ~25% more than normal read, so need ~2-3 reuses to break even
    const breakEvenReuses = 2;

    return {
      worthCaching: expectedReuses >= breakEvenReuses,
      estimatedSavings: Math.max(0, estimatedSavings),
      breakEvenReuses,
    };
  }

  /**
   * Get caching best practices and recommendations
   */
  getBestPractices(): {
    doCache: string[];
    dontCache: string[];
    tips: string[];
  } {
    return {
      doCache: [
        'System prompts (same across all requests)',
        'Session context (shared by multiple screenshots)',
        'Guidelines and instructions (static content)',
        'Few-shot examples (reusable demonstrations)',
        'Large reference data (documentation, schemas)',
      ],
      dontCache: [
        'Per-request data (changes every call)',
        'Short prompts (<1024 tokens)',
        'Content used only once',
        'Rapidly changing context',
        'User-specific data that varies',
      ],
      tips: [
        'Place cacheable content at the end of system messages',
        'Separate static (guidelines) from dynamic (data) content',
        'Cache content is shared across users - avoid PII',
        'Cache TTL is 5 minutes - plan request batching accordingly',
        'Monitor cache_read_input_tokens in API responses to verify hits',
      ],
    };
  }

  /**
   * Validate cache configuration
   */
  validateCacheConfig(content: string): {
    valid: boolean;
    warnings: string[];
    estimatedTokens: number;
  } {
    const estimatedTokens = content.length / 4;
    const warnings: string[] = [];

    // Check minimum length
    if (estimatedTokens < this.CACHE_MIN_TOKENS) {
      warnings.push(
        `Content too short for caching (${estimatedTokens.toFixed(0)} tokens < ${this.CACHE_MIN_TOKENS} min). Caching will have no effect.`
      );
    }

    // Check for PII risks
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/,            // Credit card
      /password|secret|key/i,  // Sensitive terms
    ];

    piiPatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        warnings.push(
          'Content may contain sensitive data. Cache is shared across users - remove PII before caching.'
        );
      }
    });

    return {
      valid: warnings.length === 0,
      warnings,
      estimatedTokens,
    };
  }
}

/**
 * Export singleton instance
 */
export const promptCachingService = new PromptCachingService();
