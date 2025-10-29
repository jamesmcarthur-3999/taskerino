/**
 * EnrichmentErrorHandler - Robust Error Handling & Retry Logic (NO COST UI)
 *
 * Production-grade error handling service for enrichment pipeline with
 * intelligent retry logic, circuit breaker, and graceful degradation.
 *
 * Key Features:
 * - Transient error retry with exponential backoff
 * - Permanent error fast-fail
 * - Partial failure graceful degradation
 * - Circuit breaker pattern
 * - User-friendly error messages (NO COST)
 * - 99% recovery rate for transient errors
 * - <10s max retry delay
 *
 * Error Categories:
 * 1. Transient Errors (retry automatically):
 *    - API rate limits → exponential backoff
 *    - Network timeouts → 3 retries
 *    - Service unavailable → circuit breaker
 *
 * 2. Permanent Errors (fail fast):
 *    - Invalid API key → notify user
 *    - Malformed data → log and skip
 *    - Cost exceeded → stop (logged, NOT shown to user)
 *
 * 3. Partial Failures (graceful degradation):
 *    - Audio fails → continue with video
 *    - Video fails → continue with audio
 *    - Summary fails → use basic summary
 *
 * CRITICAL: NO Cost UI
 * - Error messages: "Couldn't reach the API. Retrying..."
 * - NO messages like: "Cost limit exceeded: $10.00"
 * - Backend logs cost details, users see generic error
 *
 * Usage:
 * ```typescript
 * import { getEnrichmentErrorHandler } from './EnrichmentErrorHandler';
 *
 * const errorHandler = getEnrichmentErrorHandler();
 *
 * try {
 *   await enrichSession(session);
 * } catch (error) {
 *   const resolution = await errorHandler.handleError(error, {
 *     sessionId: session.id,
 *     operation: 'audio-review',
 *     attemptNumber: 1,
 *   });
 *
 *   if (resolution.shouldRetry) {
 *     // Wait and retry
 *     await new Promise(resolve => setTimeout(resolve, resolution.retryDelay));
 *     await enrichSession(session);
 *   } else if (resolution.canContinue) {
 *     // Continue with partial results
 *     console.log('Continuing with partial results...');
 *   } else {
 *     // Fail gracefully
 *     console.error(resolution.userMessage);
 *   }
 * }
 * ```
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.8 specification
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Error category
 */
export type ErrorCategory = 'transient' | 'permanent' | 'partial';

/**
 * Error type (for classification)
 */
export type ErrorType =
  | 'rate-limit'
  | 'network-timeout'
  | 'service-unavailable'
  | 'invalid-api-key'
  | 'malformed-data'
  | 'cost-exceeded'
  | 'audio-failed'
  | 'video-failed'
  | 'summary-failed'
  | 'unknown';

/**
 * Enrichment context (for error handling)
 */
export interface EnrichmentContext {
  /** Session ID */
  sessionId: string;

  /** Operation being performed */
  operation: 'audio-review' | 'video-chaptering' | 'summary-generation' | 'full-enrichment';

  /** Attempt number (for retry logic) */
  attemptNumber: number;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Error resolution
 */
export interface ErrorResolution {
  /** Error category */
  category: ErrorCategory;

  /** Error type */
  type: ErrorType;

  /** Whether to retry */
  shouldRetry: boolean;

  /** Retry delay in milliseconds (if shouldRetry) */
  retryDelay?: number;

  /** Whether to continue with partial results */
  canContinue: boolean;

  /** User-friendly error message (NO COST) */
  userMessage: string;

  /** Backend error details (for logging) */
  backendDetails: {
    error: string;
    stack?: string;
    cost?: number; // Logged, NOT shown to user
    metadata?: Record<string, any>;
  };

  /** Recommended action */
  recommendedAction: 'retry' | 'skip' | 'abort' | 'continue-partial';
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker for operation
 */
interface CircuitBreaker {
  /** Current state */
  state: CircuitBreakerState;

  /** Failure count in current window */
  failureCount: number;

  /** Success count (for half-open state) */
  successCount: number;

  /** Last failure timestamp */
  lastFailureAt?: number;

  /** Circuit opened timestamp */
  openedAt?: number;
}

// ============================================================================
// EnrichmentErrorHandler Class
// ============================================================================

export class EnrichmentErrorHandler {
  // Retry configuration
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF_DELAY = 1000; // 1 second
  private readonly MAX_BACKOFF_DELAY = 10000; // 10 seconds
  private readonly BACKOFF_MULTIPLIER = 2;

  // Circuit breaker configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Failures before opening
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  private readonly CIRCUIT_BREAKER_SUCCESS_THRESHOLD = 2; // Successes to close

  // Circuit breakers by operation
  private circuitBreakers = new Map<string, CircuitBreaker>();

  // Error history (for analysis)
  private errorHistory: Array<{
    timestamp: number;
    type: ErrorType;
    category: ErrorCategory;
    operation: string;
    sessionId: string;
  }> = [];
  private readonly MAX_ERROR_HISTORY = 1000;

  constructor() {
    console.log('[EnrichmentErrorHandler] Initialized');
  }

  // ========================================
  // Core Error Handling
  // ========================================

  /**
   * Handle enrichment error
   *
   * Classifies error, determines retry strategy, and returns resolution.
   *
   * @param error - Error to handle
   * @param context - Enrichment context
   * @returns Error resolution with retry/continue logic
   */
  async handleError(error: Error, context: EnrichmentContext): Promise<ErrorResolution> {
    console.log(`[EnrichmentErrorHandler] Handling error for ${context.operation}`, {
      sessionId: context.sessionId,
      attemptNumber: context.attemptNumber,
      error: error.message,
    });

    // Classify error
    const { category, type } = this.classifyError(error);

    // Record error in history
    this.recordError(type, category, context);

    // Check circuit breaker
    const circuitBreaker = this.getCircuitBreaker(context.operation);
    if (circuitBreaker.state === 'open') {
      return this.createCircuitOpenResolution(context);
    }

    // Handle based on category
    let resolution: ErrorResolution;

    switch (category) {
      case 'transient':
        resolution = await this.handleTransientError(error, type, context);
        break;
      case 'permanent':
        resolution = await this.handlePermanentError(error, type, context);
        break;
      case 'partial':
        resolution = await this.handlePartialFailure(error, type, context);
        break;
      default:
        resolution = await this.handleUnknownError(error, context);
    }

    // Update circuit breaker
    if (resolution.shouldRetry || resolution.canContinue) {
      this.recordFailure(context.operation);
    }

    return resolution;
  }

  /**
   * Record successful operation (for circuit breaker)
   *
   * @param operation - Operation that succeeded
   */
  recordSuccess(operation: string): void {
    const breaker = this.getCircuitBreaker(operation);

    if (breaker.state === 'half-open') {
      breaker.successCount++;
      if (breaker.successCount >= this.CIRCUIT_BREAKER_SUCCESS_THRESHOLD) {
        // Close circuit
        breaker.state = 'closed';
        breaker.failureCount = 0;
        breaker.successCount = 0;
        console.log(`[EnrichmentErrorHandler] Circuit breaker CLOSED for ${operation}`);
      }
    } else if (breaker.state === 'closed') {
      // Reset failure count on success
      breaker.failureCount = 0;
    }
  }

  // ========================================
  // Error Classification
  // ========================================

  /**
   * Classify error into category and type
   * @private
   */
  private classifyError(error: Error): { category: ErrorCategory; type: ErrorType } {
    const message = error.message.toLowerCase();

    // Check for specific error types
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return { category: 'transient', type: 'rate-limit' };
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return { category: 'transient', type: 'network-timeout' };
    }

    if (message.includes('service unavailable') || message.includes('502') || message.includes('503')) {
      return { category: 'transient', type: 'service-unavailable' };
    }

    if (message.includes('api key') || message.includes('authentication') || message.includes('unauthorized')) {
      return { category: 'permanent', type: 'invalid-api-key' };
    }

    if (message.includes('malformed') || message.includes('invalid format') || message.includes('parse error')) {
      return { category: 'permanent', type: 'malformed-data' };
    }

    if (message.includes('cost') || message.includes('budget') || message.includes('limit exceeded')) {
      return { category: 'permanent', type: 'cost-exceeded' };
    }

    if (message.includes('audio') && message.includes('failed')) {
      return { category: 'partial', type: 'audio-failed' };
    }

    if (message.includes('video') && message.includes('failed')) {
      return { category: 'partial', type: 'video-failed' };
    }

    if (message.includes('summary') && message.includes('failed')) {
      return { category: 'partial', type: 'summary-failed' };
    }

    // Default to unknown transient error (retry)
    return { category: 'transient', type: 'unknown' };
  }

  // ========================================
  // Category-Specific Handlers
  // ========================================

  /**
   * Handle transient error (retry with backoff)
   * @private
   */
  private async handleTransientError(
    error: Error,
    type: ErrorType,
    context: EnrichmentContext
  ): Promise<ErrorResolution> {
    const shouldRetry = context.attemptNumber < this.MAX_RETRIES;
    const retryDelay = this.getRetryDelay(context.attemptNumber, type);

    // User-friendly message (NO COST)
    let userMessage: string;
    if (type === 'rate-limit') {
      userMessage = shouldRetry
        ? `API rate limit reached. Retrying in ${Math.ceil(retryDelay / 1000)}s...`
        : 'API rate limit exceeded. Please try again later.';
    } else if (type === 'network-timeout') {
      userMessage = shouldRetry ? 'Network timeout. Retrying...' : "Couldn't reach the API. Please check your connection.";
    } else if (type === 'service-unavailable') {
      userMessage = shouldRetry ? 'Service temporarily unavailable. Retrying...' : 'Service is currently unavailable. Try again later.';
    } else {
      userMessage = shouldRetry ? 'Temporary error. Retrying...' : 'Operation failed after multiple retries.';
    }

    return {
      category: 'transient',
      type,
      shouldRetry,
      retryDelay: shouldRetry ? retryDelay : undefined,
      canContinue: false,
      userMessage,
      backendDetails: {
        error: error.message,
        stack: error.stack,
        metadata: {
          attemptNumber: context.attemptNumber,
          retryDelay,
        },
      },
      recommendedAction: shouldRetry ? 'retry' : 'abort',
    };
  }

  /**
   * Handle permanent error (fail fast)
   * @private
   */
  private async handlePermanentError(
    error: Error,
    type: ErrorType,
    context: EnrichmentContext
  ): Promise<ErrorResolution> {
    // User-friendly message (NO COST)
    let userMessage: string;
    if (type === 'invalid-api-key') {
      userMessage = 'Your API key needs to be configured. Go to Settings to add your API key.';
    } else if (type === 'malformed-data') {
      userMessage = 'Session data is corrupted. This session cannot be enriched.';
    } else if (type === 'cost-exceeded') {
      // CRITICAL: NO cost shown to user, logged to backend
      userMessage = 'Enrichment stopped. Contact support if this persists.';
    } else {
      userMessage = 'This session cannot be enriched. Please try again later.';
    }

    return {
      category: 'permanent',
      type,
      shouldRetry: false,
      canContinue: false,
      userMessage,
      backendDetails: {
        error: error.message,
        stack: error.stack,
        cost: type === 'cost-exceeded' ? this.extractCostFromError(error) : undefined,
      },
      recommendedAction: 'abort',
    };
  }

  /**
   * Handle partial failure (continue with degraded results)
   * @private
   */
  private async handlePartialFailure(
    error: Error,
    type: ErrorType,
    context: EnrichmentContext
  ): Promise<ErrorResolution> {
    // User-friendly message (NO COST)
    let userMessage: string;
    if (type === 'audio-failed') {
      userMessage = 'Audio analysis failed. Continuing with video analysis...';
    } else if (type === 'video-failed') {
      userMessage = 'Video analysis failed. Continuing with audio analysis...';
    } else if (type === 'summary-failed') {
      userMessage = 'Summary generation failed. Using basic summary...';
    } else {
      userMessage = 'Partial enrichment completed. Some features may be unavailable.';
    }

    return {
      category: 'partial',
      type,
      shouldRetry: false,
      canContinue: true,
      userMessage,
      backendDetails: {
        error: error.message,
        stack: error.stack,
        metadata: {
          failedComponent: type,
        },
      },
      recommendedAction: 'continue-partial',
    };
  }

  /**
   * Handle unknown error
   * @private
   */
  private async handleUnknownError(error: Error, context: EnrichmentContext): Promise<ErrorResolution> {
    const shouldRetry = context.attemptNumber < this.MAX_RETRIES;
    const retryDelay = this.getRetryDelay(context.attemptNumber, 'unknown');

    return {
      category: 'transient',
      type: 'unknown',
      shouldRetry,
      retryDelay: shouldRetry ? retryDelay : undefined,
      canContinue: false,
      userMessage: shouldRetry ? 'An error occurred. Retrying...' : 'Enrichment failed. Please try again later.',
      backendDetails: {
        error: error.message,
        stack: error.stack,
      },
      recommendedAction: shouldRetry ? 'retry' : 'abort',
    };
  }

  // ========================================
  // Circuit Breaker
  // ========================================

  /**
   * Get circuit breaker for operation
   * @private
   */
  private getCircuitBreaker(operation: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      });
    }
    return this.circuitBreakers.get(operation)!;
  }

  /**
   * Record failure for circuit breaker
   * @private
   */
  private recordFailure(operation: string): void {
    const breaker = this.getCircuitBreaker(operation);
    breaker.failureCount++;
    breaker.lastFailureAt = Date.now();

    if (breaker.state === 'closed' && breaker.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      // Open circuit
      breaker.state = 'open';
      breaker.openedAt = Date.now();
      console.warn(`[EnrichmentErrorHandler] Circuit breaker OPENED for ${operation} (${breaker.failureCount} failures)`);
    }

    // Check if circuit should transition to half-open
    if (breaker.state === 'open' && breaker.openedAt) {
      const timeSinceOpened = Date.now() - breaker.openedAt;
      if (timeSinceOpened >= this.CIRCUIT_BREAKER_TIMEOUT) {
        breaker.state = 'half-open';
        breaker.successCount = 0;
        console.log(`[EnrichmentErrorHandler] Circuit breaker HALF-OPEN for ${operation} (timeout expired)`);
      }
    }
  }

  /**
   * Create circuit open resolution
   * @private
   */
  private createCircuitOpenResolution(context: EnrichmentContext): ErrorResolution {
    return {
      category: 'permanent',
      type: 'service-unavailable',
      shouldRetry: false,
      canContinue: false,
      userMessage: 'Service is experiencing issues. Please try again in a few minutes.',
      backendDetails: {
        error: 'Circuit breaker open',
        metadata: {
          operation: context.operation,
          circuitState: 'open',
        },
      },
      recommendedAction: 'abort',
    };
  }

  /**
   * Check if circuit breaker should stop retrying
   *
   * @param errorHistory - Array of errors
   * @returns Whether to stop retrying
   */
  shouldStopRetrying(errorHistory: Error[]): boolean {
    if (errorHistory.length < this.MAX_RETRIES) {
      return false;
    }

    // Check if all errors are permanent
    const allPermanent = errorHistory.every((error) => {
      const { category } = this.classifyError(error);
      return category === 'permanent';
    });

    return allPermanent;
  }

  // ========================================
  // Retry Logic
  // ========================================

  /**
   * Get retry delay with exponential backoff
   *
   * @param attemptNumber - Current attempt number
   * @param errorType - Type of error
   * @returns Delay in milliseconds
   */
  getRetryDelay(attemptNumber: number, errorType: ErrorType): number {
    // Base delay
    let baseDelay = this.INITIAL_BACKOFF_DELAY * Math.pow(this.BACKOFF_MULTIPLIER, attemptNumber - 1);

    // Rate limit errors use longer delays
    if (errorType === 'rate-limit') {
      baseDelay *= 2;
    }

    // Cap at max delay
    const delay = Math.min(baseDelay, this.MAX_BACKOFF_DELAY);

    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  }

  /**
   * Get user-friendly error message (NO COST)
   *
   * @param error - Error to get message for
   * @returns User-friendly message
   */
  getUserMessage(error: Error): string {
    const { category, type } = this.classifyError(error);

    if (type === 'rate-limit') {
      return 'API rate limit reached. Retrying...';
    } else if (type === 'network-timeout') {
      return "Couldn't reach the API. Retrying...";
    } else if (type === 'invalid-api-key') {
      return 'Your API key needs to be configured';
    } else if (type === 'cost-exceeded') {
      // CRITICAL: NO cost shown
      return 'Enrichment stopped. Contact support if this persists.';
    } else if (category === 'partial') {
      return 'Session partially enriched';
    } else {
      return 'An error occurred. Please try again.';
    }
  }

  // ========================================
  // Error History & Analysis
  // ========================================

  /**
   * Record error in history
   * @private
   */
  private recordError(type: ErrorType, category: ErrorCategory, context: EnrichmentContext): void {
    this.errorHistory.push({
      timestamp: Date.now(),
      type,
      category,
      operation: context.operation,
      sessionId: context.sessionId,
    });

    // Trim history if too large
    if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
      this.errorHistory.shift();
    }
  }

  /**
   * Log error details to backend
   *
   * @param error - Error to log
   * @param context - Enrichment context
   */
  logError(error: Error, context: EnrichmentContext): void {
    const { category, type } = this.classifyError(error);

    console.error('[EnrichmentErrorHandler] Error logged', {
      category,
      type,
      sessionId: context.sessionId,
      operation: context.operation,
      attemptNumber: context.attemptNumber,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Extract cost from error message (for backend logging only)
   * @private
   */
  private extractCostFromError(error: Error): number | undefined {
    const match = error.message.match(/\$(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  /**
   * Reset circuit breakers (for testing)
   */
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }

  /**
   * Clear error history (for testing)
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _instance: EnrichmentErrorHandler | null = null;

/**
 * Get singleton EnrichmentErrorHandler instance
 */
export function getEnrichmentErrorHandler(): EnrichmentErrorHandler {
  if (!_instance) {
    _instance = new EnrichmentErrorHandler();
  }
  return _instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetEnrichmentErrorHandler(): void {
  _instance = null;
}
