export interface RetryOptions {
  maxRetries: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, nextDelay: number) => void;
}

export class RetryableError extends Error {
  public retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'RetryableError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Default retry logic - retries on network errors, timeouts, and 5xx server errors
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
 * Calculates the next delay using exponential backoff
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
 * Extracts retry-after value from error (if available)
 * Supports both RetryableError.retryAfter and HTTP Retry-After header
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
 * const result = await retryWithBackoff(
 *   () => fetchData('/api/users'),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     maxDelay: 10000,
 *   }
 * );
 * ```
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
