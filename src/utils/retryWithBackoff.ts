/**
 * @file retryWithBackoff.ts - Exponential backoff retry utility
 *
 * @overview
 * Provides robust retry logic with exponential backoff for handling transient failures
 * in network requests, API calls, and other async operations. Supports custom retry logic,
 * rate limit detection, and retry callbacks.
 */

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts before giving up */
  maxRetries: number;
  /** Initial delay in milliseconds (will be doubled each retry) */
  initialDelay: number; // milliseconds
  /** Maximum delay in milliseconds (cap for exponential backoff) */
  maxDelay: number; // milliseconds
  /** Optional function to determine if an error should be retried */
  shouldRetry?: (error: any) => boolean;
  /** Optional callback invoked before each retry attempt */
  onRetry?: (attempt: number, error: any, nextDelay: number) => void;
}

/**
 * Custom error class for explicitly retryable operations
 *
 * @example
 * ```typescript
 * throw new RetryableError('Rate limited', 5000); // Retry after 5 seconds
 * ```
 */
export class RetryableError extends Error {
  /** Optional delay in milliseconds before retrying (for rate limits) */
  public retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'RetryableError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Default retry logic - retries on network errors, timeouts, and 5xx server errors
 *
 * @param error - Error to evaluate
 * @returns true if error should be retried
 *
 * @retry_conditions
 * - RetryableError instances
 * - Network errors (NetworkError or message contains 'network')
 * - Timeout errors (TimeoutError or message contains 'timeout')
 * - HTTP 429 (rate limit)
 * - HTTP 5xx (server errors)
 *
 * @non_retryable
 * - HTTP 4xx (except 429) - client errors like 400, 401, 403, 404
 * - Application logic errors
 * - Validation errors
 */
function defaultShouldRetry(error: any): boolean {
  // Always retry RetryableError
  if (error instanceof RetryableError) {
    return true;
  }

  // Retry on network errors
  if (error.name === 'NetworkError' || error.message?.includes('network')) {
    return true;
  }

  // Retry on timeout errors
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return true;
  }

  // Retry on fetch/HTTP errors with 5xx status codes or 429 (rate limit)
  if (error.status) {
    const status = error.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  // Retry on response errors with 5xx status codes or 429
  if (error.response?.status) {
    const status = error.response.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  // Don't retry by default
  return false;
}

/**
 * Default retry callback - logs retry attempts to console
 *
 * @param attempt - Current attempt number (1-based)
 * @param error - The error that triggered the retry
 * @param nextDelay - Delay in milliseconds before next attempt
 */
function defaultOnRetry(attempt: number, error: any, nextDelay: number): void {
  console.warn(
    `[RetryWithBackoff] Attempt ${attempt} failed. Retrying in ${nextDelay}ms...`,
    {
      error: error.message || String(error),
      errorType: error.name || typeof error,
      nextDelay,
    }
  );
}

/**
 * Calculates the next delay using exponential backoff formula
 *
 * @param attempt - Current attempt number (1-based)
 * @param initialDelay - Base delay in milliseconds
 * @param maxDelay - Maximum allowed delay in milliseconds
 * @returns Calculated delay, capped at maxDelay
 *
 * @formula
 * delay = initialDelay * 2^(attempt - 1)
 *
 * @example
 * ```typescript
 * calculateDelay(1, 1000, 10000);  // 1000ms (1s)
 * calculateDelay(2, 1000, 10000);  // 2000ms (2s)
 * calculateDelay(3, 1000, 10000);  // 4000ms (4s)
 * calculateDelay(4, 1000, 10000);  // 8000ms (8s)
 * calculateDelay(5, 1000, 10000);  // 10000ms (10s - capped)
 * ```
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number
): number {
  // Exponential backoff: delay doubles each attempt
  const exponentialDelay = initialDelay * Math.pow(2, attempt - 1);

  // Cap at maxDelay
  return Math.min(exponentialDelay, maxDelay);
}

/**
 * Extracts retry-after value from error for rate limit handling
 *
 * @param error - Error to check for retry-after information
 * @returns Delay in milliseconds, or null if not specified
 *
 * @supports
 * - RetryableError.retryAfter field
 * - HTTP Retry-After header (seconds → milliseconds)
 *
 * @example
 * ```typescript
 * const error = new RetryableError('Rate limited', 5000);
 * getRetryAfterDelay(error);  // 5000 (5 seconds)
 * ```
 */
function getRetryAfterDelay(error: any): number | null {
  // Check RetryableError.retryAfter
  if (error instanceof RetryableError && error.retryAfter) {
    return error.retryAfter;
  }

  // Check for Retry-After header in response
  const retryAfterHeader = error.response?.headers?.['retry-after'];
  if (retryAfterHeader) {
    const retryAfterSeconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(retryAfterSeconds)) {
      return retryAfterSeconds * 1000; // convert to milliseconds
    }
  }

  return null;
}

/**
 * Executes an async operation with exponential backoff retry logic
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the operation result
 * @throws The original error if max retries are exceeded or error is not retryable
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await retryWithBackoff(
 *   () => fetchData('/api/users'),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,   // Start with 1s
 *     maxDelay: 10000,      // Cap at 10s
 *   }
 * );
 *
 * // Custom retry logic
 * const result = await retryWithBackoff(
 *   () => apiCall(),
 *   {
 *     maxRetries: 5,
 *     initialDelay: 500,
 *     maxDelay: 30000,
 *     shouldRetry: (error) => error.status >= 500,
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`Retry ${attempt} after ${delay}ms`);
 *     }
 *   }
 * );
 * ```
 *
 * @retry_sequence
 * With initialDelay=1000, maxDelay=10000, maxRetries=4:
 * - Attempt 0: Initial try
 * - Attempt 1: Wait 1s (1000ms)
 * - Attempt 2: Wait 2s (2000ms)
 * - Attempt 3: Wait 4s (4000ms)
 * - Attempt 4: Wait 8s (8000ms)
 * - Give up after 4 retries
 *
 * @rate_limiting
 * If error contains Retry-After header or RetryableError.retryAfter:
 * - Uses specified delay instead of exponential backoff
 * - Still respects maxDelay cap
 * - Useful for API rate limits (e.g., Claude API, OpenAI API)
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    shouldRetry = defaultShouldRetry,
    onRetry = defaultOnRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Attempt the operation
      const result = await operation();

      // Log success if this was a retry
      if (attempt > 0) {
        console.info(
          `[RetryWithBackoff] Operation succeeded after ${attempt} ${
            attempt === 1 ? 'retry' : 'retries'
          }`
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        console.error(
          `[RetryWithBackoff] Operation failed after ${maxRetries} ${
            maxRetries === 1 ? 'retry' : 'retries'
          }`,
          {
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.name : typeof error,
          }
        );
        throw error;
      }

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        console.error(
          '[RetryWithBackoff] Non-retryable error encountered. Failing immediately.',
          {
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.name : typeof error,
          }
        );
        throw error;
      }

      // Calculate delay for next retry
      let nextDelay: number;

      // Check for rate limit with retry-after
      const retryAfterDelay = getRetryAfterDelay(error);
      if (retryAfterDelay !== null) {
        // Use retry-after value, but cap at maxDelay
        nextDelay = Math.min(retryAfterDelay, maxDelay);
        console.info(
          `[RetryWithBackoff] Rate limit detected. Using retry-after delay: ${nextDelay}ms`
        );
      } else {
        // Use exponential backoff
        nextDelay = calculateDelay(attempt + 1, initialDelay, maxDelay);
      }

      // Call the retry callback
      onRetry(attempt + 1, error, nextDelay);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, nextDelay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Creates a retryable version of an async function with predefined options
 *
 * @param fn - The async function to make retryable
 * @param options - Retry configuration options
 * @returns A new function that executes with retry logic
 *
 * @example
 * ```typescript
 * const fetchWithRetry = createRetryableFunction(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 3, initialDelay: 1000, maxDelay: 10000 }
 * );
 *
 * const data = await fetchWithRetry('/api/users');
 * ```
 */
export function createRetryableFunction<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => retryWithBackoff(() => fn(...args), options);
}
