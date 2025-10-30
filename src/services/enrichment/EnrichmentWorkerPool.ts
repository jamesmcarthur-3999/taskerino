/**
 * EnrichmentWorkerPool - Efficient Resource Management for Parallel Enrichment
 *
 * Production-grade worker pool that manages concurrent enrichment workers with
 * health monitoring, auto-recovery, and graceful shutdown.
 *
 * Key Features:
 * - Worker lifecycle management (create, assign, release)
 * - Health checks (track error rates, uptime)
 * - Auto-restart on persistent failures
 * - Resource cleanup on shutdown
 * - Performance metrics (avg job duration, throughput)
 * - 99.9% worker uptime target
 * - <100ms worker acquisition
 *
 * Architecture:
 * 1. Worker Pool: Fixed-size pool of workers (default: 5)
 * 2. Idle Workers: Set of available workers
 * 3. Active Workers: Map of workers currently processing jobs
 * 4. Health Monitoring: Track error counts, durations, restarts
 * 5. Auto-Recovery: Restart workers exceeding error thresholds
 * 6. Cleanup: Graceful shutdown with resource release
 *
 * Usage:
 * ```typescript
 * import { getEnrichmentWorkerPool } from './EnrichmentWorkerPool';
 *
 * const pool = getEnrichmentWorkerPool();
 *
 * // Acquire worker for processing
 * const worker = await pool.acquireWorker();
 * try {
 *   // Process job with worker
 *   await processJob(worker);
 * } finally {
 *   // Always release worker
 *   await pool.releaseWorker(worker);
 * }
 *
 * // Monitor pool health
 * const status = pool.getPoolStatus();
 * console.log(`Active: ${status.active}, Error rate: ${status.errorRate}%`);
 *
 * // Graceful shutdown
 * await pool.shutdown();
 * ```
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.6 specification
 */

import { generateId } from '../../utils/helpers';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Worker status
 * - idle: Available for work
 * - active: Currently processing a job
 * - error: In error state (needs restart)
 * - shutdown: Shutting down (not accepting new jobs)
 */
export type WorkerStatus = 'idle' | 'active' | 'error' | 'shutdown';

/**
 * Enrichment worker
 */
export interface EnrichmentWorker {
  /** Unique worker ID */
  id: string;

  /** Current worker status */
  status: WorkerStatus;

  /** Current job being processed (if active) */
  currentJob?: string;

  /** Job start timestamp (when became active) */
  startTime?: number;

  /** Number of errors encountered */
  errorCount: number;

  /** Number of jobs completed successfully */
  totalJobsCompleted: number;

  /** Total processing time across all jobs (ms) */
  totalProcessingTime: number;

  /** Number of times worker has been restarted */
  restartCount: number;

  /** Worker creation timestamp */
  createdAt: number;

  /** Last activity timestamp */
  lastActivityAt: number;

  /** Last error message (if any) */
  lastError?: string;
}

/**
 * Pool status summary
 */
export interface PoolStatus {
  /** Number of idle workers */
  idle: number;

  /** Number of active workers */
  active: number;

  /** Number of workers in error state */
  error: number;

  /** Total number of workers */
  total: number;

  /** Error rate as percentage (0-100) */
  errorRate: number;

  /** Average job duration in milliseconds */
  avgJobDuration: number;

  /** Total jobs completed across all workers */
  totalJobsCompleted: number;

  /** Pool uptime in milliseconds */
  uptime: number;

  /** Pool uptime percentage (target: 99.9%) */
  uptimePercentage: number;
}

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Maximum number of workers (default: 5) */
  maxWorkers?: number;

  /** Error threshold before auto-restart (default: 3) */
  errorThreshold?: number;

  /** Worker acquisition timeout (ms, default: 10000) */
  acquisitionTimeout?: number;

  /** Health check interval (ms, default: 30000) */
  healthCheckInterval?: number;

  /** Enable auto-restart on errors (default: true) */
  enableAutoRestart?: boolean;
}

/**
 * Worker acquisition timeout error
 */
export class WorkerAcquisitionTimeoutError extends Error {
  constructor(timeout: number) {
    super(`Worker acquisition timed out after ${timeout}ms`);
    this.name = 'WorkerAcquisitionTimeoutError';
  }
}

// ============================================================================
// EnrichmentWorkerPool Class
// ============================================================================

export class EnrichmentWorkerPool {
  private config: Required<WorkerPoolConfig>;

  // Worker storage
  private workers: Map<string, EnrichmentWorker> = new Map();
  private idleWorkers: Set<string> = new Set();
  private activeWorkers: Map<string, string> = new Map(); // workerId -> jobId

  // Health monitoring
  private poolStartTime: number = Date.now();
  private totalDowntime: number = 0; // ms
  private lastHealthCheck: number = Date.now();
  private healthCheckTimer: NodeJS.Timeout | null = null;

  // Shutdown control
  private isShuttingDown: boolean = false;

  // Acquisition queue (for when all workers are busy)
  private acquisitionQueue: Array<{
    resolve: (worker: EnrichmentWorker) => void;
    reject: (error: Error) => void;
    enqueuedAt: number;
  }> = [];

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<WorkerPoolConfig> = {
    maxWorkers: 5,
    errorThreshold: 3,
    acquisitionTimeout: 10000, // 10 seconds
    healthCheckInterval: 30000, // 30 seconds
    enableAutoRestart: true,
  };

  constructor(config?: WorkerPoolConfig) {
    this.config = {
      ...EnrichmentWorkerPool.DEFAULT_CONFIG,
      ...config,
    };

    // Initialize worker pool
    this.initializeWorkers();

    // Start health monitoring
    this.startHealthMonitoring();

    console.log('[EnrichmentWorkerPool] Initialized', {
      maxWorkers: this.config.maxWorkers,
      errorThreshold: this.config.errorThreshold,
      autoRestart: this.config.enableAutoRestart,
    });
  }

  // ========================================
  // Core Worker Operations
  // ========================================

  /**
   * Acquire a worker for processing
   *
   * Waits for available worker if all are busy (up to acquisitionTimeout).
   * Returns immediately if idle worker available (<100ms target).
   *
   * @returns Idle worker ready for processing
   * @throws WorkerAcquisitionTimeoutError if timeout exceeded
   */
  async acquireWorker(): Promise<EnrichmentWorker> {
    const startTime = Date.now();

    // Check if shutting down
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down');
    }

    // Fast path: idle worker available
    if (this.idleWorkers.size > 0) {
      const workerId = Array.from(this.idleWorkers)[0];
      const worker = this.workers.get(workerId);

      if (worker && worker.status === 'idle') {
        // Mark as active
        worker.status = 'active';
        worker.startTime = Date.now();
        worker.lastActivityAt = Date.now();
        this.idleWorkers.delete(workerId);

        const acquisitionTime = Date.now() - startTime;
        console.log(`[EnrichmentWorkerPool] ✓ Acquired worker ${workerId} (${acquisitionTime}ms)`);

        return worker;
      }
    }

    // Slow path: all workers busy, wait for availability
    console.log('[EnrichmentWorkerPool] All workers busy, waiting for availability...');

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from queue
        const index = this.acquisitionQueue.findIndex((req) => req.resolve === resolve);
        if (index !== -1) {
          this.acquisitionQueue.splice(index, 1);
        }

        reject(new WorkerAcquisitionTimeoutError(this.config.acquisitionTimeout));
      }, this.config.acquisitionTimeout);

      this.acquisitionQueue.push({
        resolve: (worker) => {
          clearTimeout(timeoutId);
          resolve(worker);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        enqueuedAt: Date.now(),
      });
    });
  }

  /**
   * Release a worker after job completion
   *
   * Updates worker metrics and makes available for next job.
   * Handles error state and triggers auto-restart if threshold exceeded.
   *
   * @param worker - Worker to release
   * @param error - Optional error if job failed
   */
  async releaseWorker(worker: EnrichmentWorker, error?: Error): Promise<void> {
    const workerId = worker.id;
    const storedWorker = this.workers.get(workerId);

    if (!storedWorker) {
      console.warn(`[EnrichmentWorkerPool] Worker ${workerId} not found in pool`);
      return;
    }

    // Calculate job duration
    const jobDuration = worker.startTime ? Date.now() - worker.startTime : 0;

    if (error) {
      // Job failed
      storedWorker.errorCount++;
      storedWorker.lastError = error.message;
      storedWorker.lastActivityAt = Date.now();
      this.activeWorkers.delete(workerId);

      console.error(`[EnrichmentWorkerPool] ✗ Worker ${workerId} job failed (error ${storedWorker.errorCount}/${this.config.errorThreshold})`, {
        error: error.message,
        duration: jobDuration,
      });

      // Check if error threshold exceeded
      if (storedWorker.errorCount >= this.config.errorThreshold) {
        storedWorker.status = 'error';
        console.error(`[EnrichmentWorkerPool] ⚠️ Worker ${workerId} exceeded error threshold, marking as error`);

        // Auto-restart if enabled
        if (this.config.enableAutoRestart) {
          await this.restartWorker(workerId);
        }
      } else {
        // Return to idle pool
        storedWorker.status = 'idle';
        storedWorker.currentJob = undefined;
        storedWorker.startTime = undefined;
        this.idleWorkers.add(workerId);

        // Process acquisition queue
        this.processAcquisitionQueue();
      }
    } else {
      // Job succeeded
      storedWorker.totalJobsCompleted++;
      storedWorker.totalProcessingTime += jobDuration;
      storedWorker.lastActivityAt = Date.now();
      storedWorker.status = 'idle';
      storedWorker.currentJob = undefined;
      storedWorker.startTime = undefined;
      this.activeWorkers.delete(workerId);
      this.idleWorkers.add(workerId);

      console.log(`[EnrichmentWorkerPool] ✓ Released worker ${workerId} (completed ${storedWorker.totalJobsCompleted} jobs, ${jobDuration}ms)`);

      // Process acquisition queue
      this.processAcquisitionQueue();
    }
  }

  /**
   * Assign a job to a worker
   *
   * Updates worker state with current job information.
   * Used for tracking and monitoring purposes.
   *
   * @param worker - Worker to assign job to
   * @param jobId - Job identifier
   */
  assignJob(worker: EnrichmentWorker, jobId: string): void {
    const storedWorker = this.workers.get(worker.id);
    if (storedWorker) {
      storedWorker.currentJob = jobId;
      this.activeWorkers.set(worker.id, jobId);
      console.log(`[EnrichmentWorkerPool] Worker ${worker.id} assigned job ${jobId}`);
    }
  }

  // ========================================
  // Health Monitoring
  // ========================================

  /**
   * Get pool status summary
   */
  getPoolStatus(): PoolStatus {
    const workers = Array.from(this.workers.values());

    const idle = workers.filter((w) => w.status === 'idle').length;
    const active = workers.filter((w) => w.status === 'active').length;
    const errorWorkers = workers.filter((w) => w.status === 'error').length;

    const totalJobs = workers.reduce((sum, w) => sum + w.totalJobsCompleted, 0);
    const totalProcessingTime = workers.reduce((sum, w) => sum + w.totalProcessingTime, 0);
    const avgJobDuration = totalJobs > 0 ? totalProcessingTime / totalJobs : 0;

    const errorCount = workers.reduce((sum, w) => sum + w.errorCount, 0);
    const errorRate = totalJobs > 0 ? (errorCount / (totalJobs + errorCount)) * 100 : 0;

    const uptime = Date.now() - this.poolStartTime;
    const uptimePercentage = uptime > 0 ? ((uptime - this.totalDowntime) / uptime) * 100 : 100;

    return {
      idle,
      active,
      error: errorWorkers,
      total: this.workers.size,
      errorRate,
      avgJobDuration,
      totalJobsCompleted: totalJobs,
      uptime,
      uptimePercentage,
    };
  }

  /**
   * Restart errored workers
   *
   * Recreates workers in error state, resetting error counts.
   *
   * @returns Number of workers restarted
   */
  async restartErroredWorkers(): Promise<number> {
    const erroredWorkers = Array.from(this.workers.values()).filter((w) => w.status === 'error');

    let restartedCount = 0;
    for (const worker of erroredWorkers) {
      await this.restartWorker(worker.id);
      restartedCount++;
    }

    if (restartedCount > 0) {
      console.log(`[EnrichmentWorkerPool] ✓ Restarted ${restartedCount} errored workers`);
    }

    return restartedCount;
  }

  // ========================================
  // Lifecycle Management
  // ========================================

  /**
   * Shutdown worker pool gracefully
   *
   * Waits for active workers to complete, then releases all resources.
   */
  async shutdown(): Promise<void> {
    console.log('[EnrichmentWorkerPool] Shutting down...');
    this.isShuttingDown = true;

    // Stop health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Reject all pending acquisition requests
    for (const request of this.acquisitionQueue) {
      request.reject(new Error('Worker pool is shutting down'));
    }
    this.acquisitionQueue = [];

    // Wait for active workers to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const shutdownStart = Date.now();

    while (this.activeWorkers.size > 0) {
      if (Date.now() - shutdownStart > shutdownTimeout) {
        console.warn('[EnrichmentWorkerPool] Shutdown timeout exceeded, forcing shutdown');
        break;
      }

      console.log(`[EnrichmentWorkerPool] Waiting for ${this.activeWorkers.size} active workers to complete...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Mark all workers as shutdown
    for (const worker of this.workers.values()) {
      worker.status = 'shutdown';
    }

    // Clear all data structures
    this.workers.clear();
    this.idleWorkers.clear();
    this.activeWorkers.clear();

    console.log('[EnrichmentWorkerPool] Shutdown complete');
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Initialize worker pool with configured number of workers
   * @private
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.config.maxWorkers; i++) {
      const worker = this.createWorker();
      this.workers.set(worker.id, worker);
      this.idleWorkers.add(worker.id);
    }

    console.log(`[EnrichmentWorkerPool] Created ${this.config.maxWorkers} workers`);
  }

  /**
   * Create a new worker
   * @private
   */
  private createWorker(): EnrichmentWorker {
    return {
      id: generateId(),
      status: 'idle',
      errorCount: 0,
      totalJobsCompleted: 0,
      totalProcessingTime: 0,
      restartCount: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
  }

  /**
   * Restart a worker
   * @private
   */
  private async restartWorker(workerId: string): Promise<void> {
    const oldWorker = this.workers.get(workerId);
    if (!oldWorker) {
      return;
    }

    const restartStart = Date.now();

    // Remove old worker
    this.workers.delete(workerId);
    this.idleWorkers.delete(workerId);
    this.activeWorkers.delete(workerId);

    // Track downtime
    const downtime = Date.now() - restartStart;
    this.totalDowntime += downtime;

    // Create new worker
    const newWorker = this.createWorker();
    newWorker.restartCount = oldWorker.restartCount + 1;
    this.workers.set(newWorker.id, newWorker);
    this.idleWorkers.add(newWorker.id);

    console.log(`[EnrichmentWorkerPool] ♻️ Restarted worker ${workerId} → ${newWorker.id} (restart ${newWorker.restartCount}, downtime ${downtime}ms)`);

    // Process acquisition queue
    this.processAcquisitionQueue();
  }

  /**
   * Process acquisition queue (fulfill waiting requests)
   * @private
   */
  private processAcquisitionQueue(): void {
    while (this.acquisitionQueue.length > 0 && this.idleWorkers.size > 0) {
      const request = this.acquisitionQueue.shift();
      if (!request) break;

      const workerId = Array.from(this.idleWorkers)[0];
      const worker = this.workers.get(workerId);

      if (worker && worker.status === 'idle') {
        // Mark as active
        worker.status = 'active';
        worker.startTime = Date.now();
        worker.lastActivityAt = Date.now();
        this.idleWorkers.delete(workerId);

        const waitTime = Date.now() - request.enqueuedAt;
        console.log(`[EnrichmentWorkerPool] ✓ Fulfilled queued request (waited ${waitTime}ms)`);

        request.resolve(worker);
      }
    }
  }

  /**
   * Start health monitoring
   * @private
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  /**
   * Perform health check
   * @private
   */
  private performHealthCheck(): void {
    const status = this.getPoolStatus();

    console.log('[EnrichmentWorkerPool] Health check', {
      idle: status.idle,
      active: status.active,
      error: status.error,
      errorRate: `${status.errorRate.toFixed(2)}%`,
      avgJobDuration: `${status.avgJobDuration.toFixed(0)}ms`,
      uptimePercentage: `${status.uptimePercentage.toFixed(3)}%`,
    });

    // Auto-restart errored workers
    if (status.error > 0 && this.config.enableAutoRestart) {
      console.log(`[EnrichmentWorkerPool] ⚠️ ${status.error} workers in error state, restarting...`);
      this.restartErroredWorkers();
    }

    this.lastHealthCheck = Date.now();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _instance: EnrichmentWorkerPool | null = null;

/**
 * Get singleton EnrichmentWorkerPool instance
 */
export function getEnrichmentWorkerPool(config?: WorkerPoolConfig): EnrichmentWorkerPool {
  if (!_instance) {
    _instance = new EnrichmentWorkerPool(config);
  }
  return _instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetEnrichmentWorkerPool(): void {
  if (_instance) {
    _instance.shutdown();
  }
  _instance = null;
}
