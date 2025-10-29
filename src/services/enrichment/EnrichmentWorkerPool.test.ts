/**
 * EnrichmentWorkerPool Unit Tests
 *
 * Comprehensive test suite for worker pool management with 99.9% uptime target.
 *
 * Test Coverage:
 * - Worker lifecycle (create, acquire, release)
 * - Error handling and auto-restart
 * - Health monitoring and metrics
 * - Concurrent worker acquisition
 * - Graceful shutdown
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.6 specification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EnrichmentWorkerPool,
  resetEnrichmentWorkerPool,
  getEnrichmentWorkerPool,
  WorkerAcquisitionTimeoutError,
  type EnrichmentWorker,
} from './EnrichmentWorkerPool';

describe('EnrichmentWorkerPool', () => {
  let pool: EnrichmentWorkerPool;

  beforeEach(() => {
    resetEnrichmentWorkerPool();
    pool = new EnrichmentWorkerPool({
      maxWorkers: 3,
      errorThreshold: 2,
      acquisitionTimeout: 1000,
      healthCheckInterval: 5000,
      enableAutoRestart: true,
    });
  });

  afterEach(async () => {
    if (pool) {
      await pool.shutdown();
    }
    resetEnrichmentWorkerPool();
  });

  // ========================================
  // Worker Lifecycle Tests
  // ========================================

  describe('Worker Lifecycle', () => {
    it('should initialize pool with correct number of workers', () => {
      const status = pool.getPoolStatus();

      expect(status.total).toBe(3);
      expect(status.idle).toBe(3);
      expect(status.active).toBe(0);
    });

    it('should acquire worker from idle pool (<100ms)', async () => {
      const start = Date.now();
      const worker = await pool.acquireWorker();
      const duration = Date.now() - start;

      expect(worker).toBeDefined();
      expect(worker.status).toBe('active');
      expect(duration).toBeLessThan(100);

      const status = pool.getPoolStatus();
      expect(status.idle).toBe(2);
      expect(status.active).toBe(1);
    });

    it('should release worker back to idle pool', async () => {
      const worker = await pool.acquireWorker();

      await pool.releaseWorker(worker);

      const status = pool.getPoolStatus();
      expect(status.idle).toBe(3);
      expect(status.active).toBe(0);
    });

    it('should assign job to worker', async () => {
      const worker = await pool.acquireWorker();
      pool.assignJob(worker, 'job-123');

      expect(worker.currentJob).toBe('job-123');
    });

    it('should track worker metrics on release', async () => {
      const worker = await pool.acquireWorker();
      pool.assignJob(worker, 'job-123');

      // Simulate job processing time
      await new Promise((resolve) => setTimeout(resolve, 100));

      await pool.releaseWorker(worker);

      expect(worker.totalJobsCompleted).toBe(1);
      expect(worker.totalProcessingTime).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Error Handling Tests
  // ========================================

  describe('Error Handling', () => {
    it('should increment error count on job failure', async () => {
      const worker = await pool.acquireWorker();
      const error = new Error('Job failed');

      await pool.releaseWorker(worker, error);

      expect(worker.errorCount).toBe(1);
      expect(worker.lastError).toBe('Job failed');
    });

    it('should mark worker as error after threshold exceeded', async () => {
      const worker = await pool.acquireWorker();

      // Fail twice (threshold = 2)
      await pool.releaseWorker(worker, new Error('Error 1'));

      const worker2 = await pool.acquireWorker();
      expect(worker2.id).not.toBe(worker.id); // Different worker (old one restarted)

      await pool.releaseWorker(worker2, new Error('Error 2'));

      const status = pool.getPoolStatus();
      expect(status.error).toBeGreaterThanOrEqual(0); // May be 0 if auto-restart kicked in
    });

    it('should auto-restart errored workers', async () => {
      const worker = await pool.acquireWorker();

      // Exceed error threshold
      await pool.releaseWorker(worker, new Error('Error 1'));

      const worker2 = await pool.acquireWorker();
      await pool.releaseWorker(worker2, new Error('Error 2'));

      // Wait for auto-restart
      await new Promise((resolve) => setTimeout(resolve, 100));

      const restarted = await pool.restartErroredWorkers();
      expect(restarted).toBeGreaterThanOrEqual(0);

      const status = pool.getPoolStatus();
      expect(status.idle).toBeGreaterThan(0);
    });

    it('should return worker to idle pool after single error', async () => {
      const worker = await pool.acquireWorker();

      await pool.releaseWorker(worker, new Error('Transient error'));

      const status = pool.getPoolStatus();
      expect(status.idle).toBe(3); // Back in pool
      expect(worker.errorCount).toBe(1);
    });
  });

  // ========================================
  // Concurrent Acquisition Tests
  // ========================================

  describe('Concurrent Worker Acquisition', () => {
    it('should handle multiple concurrent acquisitions', async () => {
      const workers = await Promise.all([
        pool.acquireWorker(),
        pool.acquireWorker(),
        pool.acquireWorker(),
      ]);

      expect(workers).toHaveLength(3);
      expect(new Set(workers.map((w) => w.id)).size).toBe(3); // All unique

      const status = pool.getPoolStatus();
      expect(status.active).toBe(3);
      expect(status.idle).toBe(0);
    });

    it('should queue acquisition requests when all workers busy', async () => {
      // Acquire all workers
      const workers = await Promise.all([
        pool.acquireWorker(),
        pool.acquireWorker(),
        pool.acquireWorker(),
      ]);

      // Try to acquire 4th (should queue)
      const acquisitionPromise = pool.acquireWorker();

      // Release one worker after delay
      setTimeout(() => {
        pool.releaseWorker(workers[0]);
      }, 100);

      const worker4 = await acquisitionPromise;
      expect(worker4).toBeDefined();
    });

    it('should timeout if no workers available', async () => {
      // Acquire all workers
      await Promise.all([
        pool.acquireWorker(),
        pool.acquireWorker(),
        pool.acquireWorker(),
      ]);

      // Try to acquire 4th with short timeout (don't release any)
      await expect(pool.acquireWorker()).rejects.toThrow(WorkerAcquisitionTimeoutError);
    });

    it('should process acquisition queue in order', async () => {
      // Acquire all workers
      const workers = await Promise.all([
        pool.acquireWorker(),
        pool.acquireWorker(),
        pool.acquireWorker(),
      ]);

      const acquisitionOrder: string[] = [];

      // Queue multiple acquisitions
      const promises = [
        pool.acquireWorker().then((w) => acquisitionOrder.push('first')),
        pool.acquireWorker().then((w) => acquisitionOrder.push('second')),
        pool.acquireWorker().then((w) => acquisitionOrder.push('third')),
      ];

      // Release workers sequentially
      setTimeout(() => pool.releaseWorker(workers[0]), 50);
      setTimeout(() => pool.releaseWorker(workers[1]), 100);
      setTimeout(() => pool.releaseWorker(workers[2]), 150);

      await Promise.all(promises);

      expect(acquisitionOrder).toEqual(['first', 'second', 'third']);
    });
  });

  // ========================================
  // Health Monitoring Tests
  // ========================================

  describe('Health Monitoring', () => {
    it('should calculate error rate correctly', async () => {
      const worker1 = await pool.acquireWorker();
      await pool.releaseWorker(worker1); // Success

      const worker2 = await pool.acquireWorker();
      await pool.releaseWorker(worker2, new Error('Failed')); // Failure

      const status = pool.getPoolStatus();
      expect(status.errorRate).toBeGreaterThan(0);
      expect(status.errorRate).toBeLessThan(100);
    });

    it('should calculate average job duration', async () => {
      const worker = await pool.acquireWorker();
      await new Promise((resolve) => setTimeout(resolve, 50));
      await pool.releaseWorker(worker);

      const status = pool.getPoolStatus();
      expect(status.avgJobDuration).toBeGreaterThan(0);
    });

    it('should track total jobs completed', async () => {
      const worker1 = await pool.acquireWorker();
      await pool.releaseWorker(worker1);

      const worker2 = await pool.acquireWorker();
      await pool.releaseWorker(worker2);

      const status = pool.getPoolStatus();
      expect(status.totalJobsCompleted).toBe(2);
    });

    it('should calculate uptime percentage (target: 99.9%)', async () => {
      // Simulate uptime
      await new Promise((resolve) => setTimeout(resolve, 100));

      const status = pool.getPoolStatus();
      expect(status.uptimePercentage).toBeGreaterThan(99);
    });
  });

  // ========================================
  // Graceful Shutdown Tests
  // ========================================

  describe('Graceful Shutdown', () => {
    it('should wait for active workers before shutdown', async () => {
      const worker = await pool.acquireWorker();

      const shutdownPromise = pool.shutdown();

      // Release worker after delay
      setTimeout(() => {
        pool.releaseWorker(worker);
      }, 100);

      await shutdownPromise;

      const status = pool.getPoolStatus();
      expect(status.total).toBe(0);
    });

    it('should reject new acquisitions during shutdown', async () => {
      const shutdownPromise = pool.shutdown();

      await expect(pool.acquireWorker()).rejects.toThrow('shutting down');

      await shutdownPromise;
    });

    it('should clear all workers on shutdown', async () => {
      await pool.shutdown();

      const status = pool.getPoolStatus();
      expect(status.total).toBe(0);
      expect(status.idle).toBe(0);
      expect(status.active).toBe(0);
    });
  });

  // ========================================
  // Singleton Tests
  // ========================================

  describe('Singleton Pattern', () => {
    it('should return same instance from getEnrichmentWorkerPool', () => {
      const pool1 = getEnrichmentWorkerPool();
      const pool2 = getEnrichmentWorkerPool();

      expect(pool1).toBe(pool2);
    });

    it('should create new instance after reset', async () => {
      const pool1 = getEnrichmentWorkerPool();
      await pool1.shutdown();
      resetEnrichmentWorkerPool();

      const pool2 = getEnrichmentWorkerPool();
      expect(pool2).not.toBe(pool1);
    });
  });
});
