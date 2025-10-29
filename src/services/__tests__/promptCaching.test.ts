/**
 * Prompt Caching Service Tests
 *
 * Test coverage:
 * - Cached system message creation (5 tests)
 * - Cache statistics calculation (4 tests)
 * - Cache benefit estimation (5 tests)
 * - Cache validation (4 tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptCachingService } from '../promptCaching';

describe('PromptCachingService', () => {
  let service: PromptCachingService;

  beforeEach(() => {
    service = new PromptCachingService();
  });

  // ============================================================================
  // Cached System Message Creation Tests (5 tests)
  // ============================================================================

  describe('createCachedSystemMessage', () => {
    it('should cache content longer than minimum threshold', () => {
      const longContent = 'A'.repeat(5000); // Well above 4096 char minimum

      const result = service.createCachedSystemMessage(longContent);

      expect(result.type).toBe('text');
      expect(result.text).toBe(longContent);
      expect(result.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('should NOT cache content shorter than minimum threshold', () => {
      const shortContent = 'A'.repeat(100); // Well below 4096 char minimum

      const result = service.createCachedSystemMessage(shortContent);

      expect(result.type).toBe('text');
      expect(result.text).toBe(shortContent);
      expect(result.cache_control).toBeUndefined();
    });

    it('should force cache when requested even for short content', () => {
      const shortContent = 'A'.repeat(100);

      const result = service.createCachedSystemMessage(shortContent, true);

      expect(result.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('should handle content exactly at threshold', () => {
      const content = 'A'.repeat(4096); // Exactly at threshold

      const result = service.createCachedSystemMessage(content);

      expect(result.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('should preserve content text exactly', () => {
      const content = 'Test content with special chars: !@#$%^&*()';

      const result = service.createCachedSystemMessage(content, true);

      expect(result.text).toBe(content);
    });
  });

  // ============================================================================
  // Multiple Cached Messages Tests (2 tests)
  // ============================================================================

  describe('createCachedSystemMessages', () => {
    it('should cache only the last message by default', () => {
      const messages = [
        'First message' + 'A'.repeat(5000),
        'Second message' + 'B'.repeat(5000),
        'Third message' + 'C'.repeat(5000),
      ];

      const result = service.createCachedSystemMessages(messages);

      expect(result).toHaveLength(3);
      expect(result[0].cache_control).toBeUndefined();
      expect(result[1].cache_control).toBeUndefined();
      expect(result[2].cache_control).toEqual({ type: 'ephemeral' });
    });

    it('should not cache last message when requested', () => {
      const messages = ['Message 1', 'Message 2'];

      const result = service.createCachedSystemMessages(messages, false);

      expect(result).toHaveLength(2);
      expect(result[0].cache_control).toBeUndefined();
      expect(result[1].cache_control).toBeUndefined();
    });
  });

  // ============================================================================
  // Cache Statistics Tests (4 tests)
  // ============================================================================

  describe('calculateCacheStats', () => {
    it('should calculate cache hit rate correctly', () => {
      const usage = {
        input_tokens: 2000,
        output_tokens: 1000,
        cache_read_input_tokens: 1800,
        cache_creation_input_tokens: 0,
      };

      const stats = service.calculateCacheStats(usage, 3.0);

      expect(stats.cacheableTokens).toBe(1800);
      expect(stats.cachedTokens).toBe(1800);
      expect(stats.cacheHitRate).toBe(1.0); // 100% hit rate
    });

    it('should calculate savings from cache hits', () => {
      const usage = {
        input_tokens: 2000,
        output_tokens: 1000,
        cache_read_input_tokens: 1800,
      };

      const stats = service.calculateCacheStats(usage, 3.0);

      // 1800 tokens at $3/MTok = $0.0054 full cost
      // 90% savings = $0.00486
      expect(stats.estimatedSavings).toBeCloseTo(0.00486, 6);
    });

    it('should handle no cache hits', () => {
      const usage = {
        input_tokens: 2000,
        output_tokens: 1000,
      };

      const stats = service.calculateCacheStats(usage, 3.0);

      expect(stats.cachedTokens).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
      expect(stats.estimatedSavings).toBe(0);
    });

    it('should handle cache creation (first call)', () => {
      const usage = {
        input_tokens: 2000,
        output_tokens: 1000,
        cache_creation_input_tokens: 1800,
      };

      const stats = service.calculateCacheStats(usage, 3.0);

      expect(stats.cacheableTokens).toBe(1800);
      expect(stats.cachedTokens).toBe(0); // Not served from cache yet
      expect(stats.cacheHitRate).toBe(0);
    });
  });

  // ============================================================================
  // Cache Benefit Estimation Tests (5 tests)
  // ============================================================================

  describe('estimateCacheBenefit', () => {
    it('should recommend caching for long prompts with multiple reuses', () => {
      const result = service.estimateCacheBenefit(
        5000,  // 5000 chars = ~1250 tokens
        10,    // 10 reuses
        3.0    // $3/MTok
      );

      expect(result.worthCaching).toBe(true);
      expect(result.estimatedSavings).toBeGreaterThan(0);
    });

    it('should NOT recommend caching for short prompts', () => {
      const result = service.estimateCacheBenefit(
        1000,  // 1000 chars = ~250 tokens (below 1024 minimum)
        10,
        3.0
      );

      expect(result.worthCaching).toBe(false);
      expect(result.estimatedSavings).toBe(0);
    });

    it('should NOT recommend caching for single use', () => {
      const result = service.estimateCacheBenefit(
        5000,
        1,     // Only 1 use (no reuses)
        3.0
      );

      expect(result.worthCaching).toBe(false);
      expect(result.estimatedSavings).toBe(0);
    });

    it('should calculate break-even point at 2 reuses', () => {
      const result = service.estimateCacheBenefit(
        5000,
        5,
        3.0
      );

      expect(result.breakEvenReuses).toBe(2);
    });

    it('should show increasing savings with more reuses', () => {
      const result5 = service.estimateCacheBenefit(5000, 5, 3.0);
      const result10 = service.estimateCacheBenefit(5000, 10, 3.0);

      expect(result10.estimatedSavings).toBeGreaterThan(result5.estimatedSavings);
    });
  });

  // ============================================================================
  // Cache Validation Tests (4 tests)
  // ============================================================================

  describe('validateCacheConfig', () => {
    it('should validate long content as cacheable', () => {
      const content = 'A'.repeat(5000);

      const result = service.validateCacheConfig(content);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.estimatedTokens).toBeGreaterThanOrEqual(1024);
    });

    it('should warn about short content', () => {
      const content = 'A'.repeat(100);

      const result = service.validateCacheConfig(content);

      expect(result.valid).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('too short');
    });

    it('should warn about potential PII in content', () => {
      const content = 'A'.repeat(5000) + ' password: mysecret123';

      const result = service.validateCacheConfig(content);

      expect(result.warnings.some((w) => w.includes('sensitive data'))).toBe(true);
    });

    it('should estimate token count correctly', () => {
      const content = 'A'.repeat(4000); // ~1000 tokens

      const result = service.validateCacheConfig(content);

      expect(result.estimatedTokens).toBeCloseTo(1000, 0);
    });
  });

  // ============================================================================
  // Best Practices Tests (1 test)
  // ============================================================================

  describe('getBestPractices', () => {
    it('should provide comprehensive best practices', () => {
      const practices = service.getBestPractices();

      expect(practices.doCache).toBeInstanceOf(Array);
      expect(practices.dontCache).toBeInstanceOf(Array);
      expect(practices.tips).toBeInstanceOf(Array);

      expect(practices.doCache.length).toBeGreaterThan(0);
      expect(practices.dontCache.length).toBeGreaterThan(0);
      expect(practices.tips.length).toBeGreaterThan(0);
    });
  });
});
