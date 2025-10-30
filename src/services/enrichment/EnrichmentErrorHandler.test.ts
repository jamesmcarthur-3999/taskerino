/**
 * EnrichmentErrorHandler Unit Tests
 *
 * Comprehensive test suite for error handling with 99% recovery rate target.
 *
 * Test Coverage:
 * - Error classification (transient, permanent, partial)
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern
 * - User-friendly messages (NO COST)
 * - Graceful degradation
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.8 specification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EnrichmentErrorHandler,
  resetEnrichmentErrorHandler,
  getEnrichmentErrorHandler,
  type EnrichmentContext,
  type ErrorResolution,
} from './EnrichmentErrorHandler';

describe('EnrichmentErrorHandler', () => {
  let errorHandler: EnrichmentErrorHandler;

  beforeEach(() => {
    resetEnrichmentErrorHandler();
    errorHandler = new EnrichmentErrorHandler();
  });

  afterEach(() => {
    resetEnrichmentErrorHandler();
  });

  // ========================================
  // Error Classification Tests
  // ========================================

  describe('Error Classification', () => {
    it('should classify rate limit errors as transient', async () => {
      const error = new Error('Rate limit exceeded');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('transient');
      expect(resolution.type).toBe('rate-limit');
      expect(resolution.shouldRetry).toBe(true);
    });

    it('should classify network timeouts as transient', async () => {
      const error = new Error('Request timed out');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'video-chaptering',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('transient');
      expect(resolution.type).toBe('network-timeout');
      expect(resolution.shouldRetry).toBe(true);
    });

    it('should classify service unavailable errors as transient', async () => {
      const error = new Error('Service unavailable (503)');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'summary-generation',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('transient');
      expect(resolution.type).toBe('service-unavailable');
      expect(resolution.shouldRetry).toBe(true);
    });

    it('should classify invalid API key errors as permanent', async () => {
      const error = new Error('Invalid API key');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('permanent');
      expect(resolution.type).toBe('invalid-api-key');
      expect(resolution.shouldRetry).toBe(false);
    });

    it('should classify malformed data errors as permanent', async () => {
      const error = new Error('Malformed JSON data');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'full-enrichment',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('permanent');
      expect(resolution.type).toBe('malformed-data');
      expect(resolution.shouldRetry).toBe(false);
    });

    it('should classify cost exceeded errors as permanent (NO COST UI)', async () => {
      const error = new Error('Cost limit exceeded: $10.00');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'full-enrichment',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('permanent');
      expect(resolution.type).toBe('cost-exceeded');
      expect(resolution.shouldRetry).toBe(false);
      // User message should NOT contain cost
      expect(resolution.userMessage).not.toContain('$');
      expect(resolution.userMessage).not.toContain('10.00');
      // Backend details should contain cost
      expect(resolution.backendDetails.cost).toBe(10.0);
    });

    it('should classify audio failures as partial', async () => {
      const error = new Error('Audio analysis failed');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('partial');
      expect(resolution.type).toBe('audio-failed');
      expect(resolution.canContinue).toBe(true);
    });

    it('should classify video failures as partial', async () => {
      const error = new Error('Video processing failed');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'video-chaptering',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('partial');
      expect(resolution.type).toBe('video-failed');
      expect(resolution.canContinue).toBe(true);
    });

    it('should classify summary failures as partial', async () => {
      const error = new Error('Summary generation failed');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'summary-generation',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('partial');
      expect(resolution.type).toBe('summary-failed');
      expect(resolution.canContinue).toBe(true);
    });

    it('should default unknown errors to transient', async () => {
      const error = new Error('Something went wrong');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'full-enrichment',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.category).toBe('transient');
      expect(resolution.type).toBe('unknown');
      expect(resolution.shouldRetry).toBe(true);
    });
  });

  // ========================================
  // Retry Logic Tests
  // ========================================

  describe('Retry Logic', () => {
    it('should suggest retry for transient errors', async () => {
      const error = new Error('Network timeout');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.shouldRetry).toBe(true);
      expect(resolution.retryDelay).toBeGreaterThan(0);
    });

    it('should not retry after max attempts', async () => {
      const error = new Error('Network timeout');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 3, // Max retries
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.shouldRetry).toBe(false);
    });

    it('should use exponential backoff for retry delays', () => {
      const delay1 = errorHandler.getRetryDelay(1, 'network-timeout');
      const delay2 = errorHandler.getRetryDelay(2, 'network-timeout');
      const delay3 = errorHandler.getRetryDelay(3, 'network-timeout');

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should cap retry delay at max', () => {
      const delay = errorHandler.getRetryDelay(10, 'network-timeout');

      expect(delay).toBeLessThanOrEqual(10000); // Max delay
    });

    it('should use longer delays for rate limit errors', () => {
      const rateLimitDelay = errorHandler.getRetryDelay(1, 'rate-limit');
      const networkDelay = errorHandler.getRetryDelay(1, 'network-timeout');

      expect(rateLimitDelay).toBeGreaterThan(networkDelay);
    });

    it('should add jitter to retry delays', () => {
      const delays = Array.from({ length: 10 }, () =>
        errorHandler.getRetryDelay(1, 'network-timeout')
      );

      // Check that not all delays are identical (jitter adds variance)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  // ========================================
  // Circuit Breaker Tests
  // ========================================

  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const error = new Error('Network error');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      // Trigger multiple failures
      await errorHandler.handleError(error, context);
      await errorHandler.handleError(error, context);
      await errorHandler.handleError(error, context);
      await errorHandler.handleError(error, context);
      await errorHandler.handleError(error, context);

      // Next error should hit circuit breaker
      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.shouldRetry).toBe(false);
      expect(resolution.recommendedAction).toBe('abort');
    });

    it('should record success to help circuit breaker recover', () => {
      errorHandler.recordSuccess('audio-review');

      // Should not throw
      expect(() => errorHandler.recordSuccess('video-chaptering')).not.toThrow();
    });

    it('should reset circuit breakers', async () => {
      const error = new Error('Network error');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(error, context);
      }

      errorHandler.resetCircuitBreakers();

      // Should not hit circuit breaker after reset
      const resolution = await errorHandler.handleError(error, context);
      expect(resolution.shouldRetry).toBe(true);
    });
  });

  // ========================================
  // User-Friendly Messages Tests (NO COST)
  // ========================================

  describe('User-Friendly Messages (NO COST)', () => {
    it('should generate friendly message for rate limit', () => {
      const error = new Error('Rate limit exceeded');
      const message = errorHandler.getUserMessage(error);

      expect(message).toContain('rate limit');
      expect(message).not.toContain('$');
      expect(message).not.toContain('cost');
    });

    it('should generate friendly message for network timeout', () => {
      const error = new Error('Request timed out');
      const message = errorHandler.getUserMessage(error);

      expect(message).toContain('API');
      expect(message).not.toContain('$');
    });

    it('should generate friendly message for invalid API key', () => {
      const error = new Error('Invalid API key');
      const message = errorHandler.getUserMessage(error);

      expect(message).toContain('API key');
      expect(message).toContain('configured');
    });

    it('should NOT show cost in user message for cost errors', () => {
      const error = new Error('Cost limit exceeded: $25.50');
      const message = errorHandler.getUserMessage(error);

      expect(message).not.toContain('$');
      expect(message).not.toContain('25.50');
      expect(message).not.toContain('cost');
    });

    it('should generate friendly message for partial failures', () => {
      const error = new Error('Audio analysis failed');
      const message = errorHandler.getUserMessage(error);

      expect(message).toContain('partial');
      expect(message).not.toContain('$');
    });
  });

  // ========================================
  // Graceful Degradation Tests
  // ========================================

  describe('Graceful Degradation', () => {
    it('should allow continuation after partial failure', async () => {
      const error = new Error('Audio failed');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.canContinue).toBe(true);
      expect(resolution.recommendedAction).toBe('continue-partial');
    });

    it('should not allow continuation after permanent failure', async () => {
      const error = new Error('Invalid API key');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'full-enrichment',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.canContinue).toBe(false);
      expect(resolution.recommendedAction).toBe('abort');
    });
  });

  // ========================================
  // Error Logging Tests
  // ========================================

  describe('Error Logging', () => {
    it('should log error details to backend', () => {
      const consoleSpy = vi.spyOn(console, 'error');

      const error = new Error('Test error');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      errorHandler.logError(error, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error logged'),
        expect.objectContaining({
          sessionId: 'session-1',
          operation: 'audio-review',
        })
      );

      consoleSpy.mockRestore();
    });

    it('should clear error history', async () => {
      const error = new Error('Test error');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      await errorHandler.handleError(error, context);

      errorHandler.clearErrorHistory();

      // Should not throw
      expect(() => errorHandler.clearErrorHistory()).not.toThrow();
    });
  });

  // ========================================
  // Error Resolution Tests
  // ========================================

  describe('Error Resolution', () => {
    it('should provide retry recommendation for transient errors', async () => {
      const error = new Error('Network timeout');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.recommendedAction).toBe('retry');
    });

    it('should provide abort recommendation for permanent errors', async () => {
      const error = new Error('Invalid API key');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.recommendedAction).toBe('abort');
    });

    it('should provide continue-partial recommendation for partial errors', async () => {
      const error = new Error('Video failed');
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'video-chaptering',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.recommendedAction).toBe('continue-partial');
    });

    it('should include backend details in resolution', async () => {
      const error = new Error('Test error');
      error.stack = 'stack trace here';
      const context: EnrichmentContext = {
        sessionId: 'session-1',
        operation: 'audio-review',
        attemptNumber: 1,
      };

      const resolution = await errorHandler.handleError(error, context);

      expect(resolution.backendDetails).toBeDefined();
      expect(resolution.backendDetails.error).toBe('Test error');
      expect(resolution.backendDetails.stack).toBeDefined();
    });
  });

  // ========================================
  // Singleton Tests
  // ========================================

  describe('Singleton Pattern', () => {
    it('should return same instance from getEnrichmentErrorHandler', () => {
      const handler1 = getEnrichmentErrorHandler();
      const handler2 = getEnrichmentErrorHandler();

      expect(handler1).toBe(handler2);
    });

    it('should create new instance after reset', () => {
      const handler1 = getEnrichmentErrorHandler();
      resetEnrichmentErrorHandler();

      const handler2 = getEnrichmentErrorHandler();
      expect(handler2).not.toBe(handler1);
    });
  });

  // ========================================
  // shouldStopRetrying Tests
  // ========================================

  describe('shouldStopRetrying', () => {
    it('should not stop retrying if below max attempts', () => {
      const errors = [
        new Error('Error 1'),
        new Error('Error 2'),
      ];

      const shouldStop = errorHandler.shouldStopRetrying(errors);
      expect(shouldStop).toBe(false);
    });

    it('should stop retrying if all errors are permanent', () => {
      const errors = [
        new Error('Invalid API key'),
        new Error('Invalid API key'),
        new Error('Invalid API key'),
      ];

      const shouldStop = errorHandler.shouldStopRetrying(errors);
      expect(shouldStop).toBe(true);
    });

    it('should not stop retrying if errors are mixed', () => {
      const errors = [
        new Error('Invalid API key'),
        new Error('Network timeout'),
        new Error('Invalid API key'),
      ];

      const shouldStop = errorHandler.shouldStopRetrying(errors);
      expect(shouldStop).toBe(false);
    });
  });
});
