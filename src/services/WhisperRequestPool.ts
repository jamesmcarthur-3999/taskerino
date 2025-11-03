/**
 * WhisperRequestPool
 *
 * Manages concurrent Whisper API transcription requests to prevent
 * rate limiting and ensure optimal throughput.
 *
 * Features:
 * - Configurable concurrency limit (default: 5, matching OpenAI rate limits)
 * - Automatic request queuing when limit reached
 * - Exponential backoff for retries
 * - Request prioritization (future enhancement)
 *
 * Performance Impact:
 * - Prevents API rate limiting errors
 * - Ensures consistent throughput during high-volume sessions
 * - No latency reduction (network bound), but improves reliability
 */

import { invoke } from '@tauri-apps/api/core';

export interface WhisperRequest {
  audioBase64: string;
  resolve: (transcription: string) => void;
  reject: (error: Error) => void;
  retryCount?: number;
}

export class WhisperRequestPool {
  private queue: WhisperRequest[] = [];
  private activeRequests = 0;
  private maxConcurrent: number;
  private maxRetries: number;

  constructor(maxConcurrent = 5, maxRetries = 3) {
    this.maxConcurrent = maxConcurrent;
    this.maxRetries = maxRetries;
  }

  /**
   * Transcribe audio with automatic queuing and retry
   */
  async transcribe(audioBase64: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request: WhisperRequest = {
        audioBase64,
        resolve,
        reject,
        retryCount: 0,
      };

      console.log(`[WhisperPool] Enqueueing transcription request (queue: ${this.queue.length}, active: ${this.activeRequests}/${this.maxConcurrent})`);
      this.queue.push(request);
      this.processNext();
    });
  }

  /**
   * Process next request in queue if under concurrency limit
   */
  private processNext(): void {
    // Check if we can process more requests
    if (this.activeRequests >= this.maxConcurrent) {
      console.log(`[WhisperPool] At max concurrency (${this.maxConcurrent}), waiting...`);
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    // Start processing next request
    const request = this.queue.shift()!;
    this.activeRequests++;

    console.log(`[WhisperPool] Starting transcription (active: ${this.activeRequests}/${this.maxConcurrent}, queue: ${this.queue.length})`);

    // Process request asynchronously
    this.processRequest(request)
      .finally(() => {
        this.activeRequests--;
        console.log(`[WhisperPool] Request completed (active: ${this.activeRequests}/${this.maxConcurrent}, queue: ${this.queue.length})`);
        // Try to process next request
        this.processNext();
      });
  }

  /**
   * Process single Whisper API request with retry logic
   */
  private async processRequest(request: WhisperRequest): Promise<void> {
    const { audioBase64, resolve, reject, retryCount = 0 } = request;

    try {
      const startTime = Date.now();
      console.log(`[WhisperPool] Calling Whisper API...`);

      const transcription = await invoke<string>('openai_transcribe_audio', {
        audioBase64,
      });

      const elapsed = Date.now() - startTime;
      console.log(`[WhisperPool] ✓ Transcription completed in ${elapsed}ms`);

      resolve(transcription);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[WhisperPool] ❌ Transcription failed:`, errorMessage);

      // Check if error is retryable (rate limit, timeout, network)
      const isRetryable = this.isRetryableError(errorMessage);

      if (isRetryable && retryCount < this.maxRetries) {
        // Retry with exponential backoff
        const retryDelay = this.calculateRetryDelay(retryCount);
        console.log(`[WhisperPool] Retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${this.maxRetries})...`);

        setTimeout(() => {
          // Re-enqueue with incremented retry count
          const retryRequest: WhisperRequest = {
            ...request,
            retryCount: retryCount + 1,
          };

          this.queue.unshift(retryRequest); // Priority for retries
          this.processNext(); // Process the retry after delay
        }, retryDelay);

        // Return early to complete the promise and trigger .finally()
        // This frees up the slot for other requests immediately
        // The retry will create a new request cycle when setTimeout fires
        return;

      } else {
        // Max retries reached or non-retryable error
        if (retryCount >= this.maxRetries) {
          console.error(`[WhisperPool] Max retries (${this.maxRetries}) reached, failing request`);
        }

        reject(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }

  /**
   * Check if error is retryable (rate limit, network, timeout)
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      'rate limit',
      'too many requests',
      'timeout',
      'network',
      'connection',
      'ECONNRESET',
      'ETIMEDOUT',
      '429', // HTTP rate limit
      '503', // Service unavailable
      '504', // Gateway timeout
    ];

    const lowerMessage = errorMessage.toLowerCase();
    return retryablePatterns.some(pattern => lowerMessage.includes(pattern.toLowerCase()));
  }

  /**
   * Calculate retry delay with exponential backoff
   * Attempt 0: 1s
   * Attempt 1: 2s
   * Attempt 2: 4s
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds max
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

    // Add jitter (±20%) to prevent thundering herd
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }

  /**
   * Get pool statistics for monitoring
   */
  getStats(): { queueSize: number; activeRequests: number; maxConcurrent: number } {
    return {
      queueSize: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent,
    };
  }

  /**
   * Update concurrency limit (useful for performance tuning)
   */
  setMaxConcurrency(newLimit: number): void {
    const oldLimit = this.maxConcurrent;
    console.log(`[WhisperPool] Updating max concurrency: ${oldLimit} → ${newLimit}`);
    this.maxConcurrent = newLimit;

    // Try to process more requests if limit increased
    if (newLimit > oldLimit) {
      for (let i = 0; i < newLimit - oldLimit; i++) {
        this.processNext();
      }
    }
  }

  /**
   * Clear queue (useful for cleanup)
   */
  clear(): void {
    console.log(`[WhisperPool] Clearing queue (${this.queue.length} items, ${this.activeRequests} still active)`);

    // Reject all pending requests
    this.queue.forEach(request => {
      request.reject(new Error('Request cancelled - pool cleared'));
    });

    this.queue = [];
  }
}

// Singleton instance
let whisperPoolInstance: WhisperRequestPool | null = null;

/**
 * Get singleton WhisperRequestPool instance
 */
export function getWhisperPool(): WhisperRequestPool {
  if (!whisperPoolInstance) {
    whisperPoolInstance = new WhisperRequestPool();
  }
  return whisperPoolInstance;
}
