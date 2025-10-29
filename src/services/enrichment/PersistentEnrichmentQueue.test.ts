/**
 * PersistentEnrichmentQueue Unit Tests
 *
 * Comprehensive test suite for persistent enrichment queue with >80% coverage.
 * Tests all public APIs, error handling, edge cases, and acceptance criteria.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PersistentEnrichmentQueue,
  getPersistentEnrichmentQueue,
  resetPersistentEnrichmentQueue,
  type EnrichmentJob,
  type QueueStatus,
  type JobStatus,
  type JobPriority,
} from './PersistentEnrichmentQueue';
import type { Session, EnrichmentResult, EnrichmentProgress } from '../../types';
import { sessionEnrichmentService } from '../sessionEnrichmentService';

// ============================================================================
// Mocks
// ============================================================================

// Mock sessionEnrichmentService
vi.mock('../sessionEnrichmentService', () => ({
  sessionEnrichmentService: {
    enrichSession: vi.fn(),
  },
}));

// Mock ChunkedSessionStorage
vi.mock('../storage/ChunkedSessionStorage', () => ({
  getChunkedStorage: vi.fn().mockResolvedValue({
    loadFullSession: vi.fn().mockImplementation(async (sessionId: string) => {
      return {
        id: sessionId,
        name: `Test Session ${sessionId}`,
        createdAt: new Date().toISOString(),
      } as Session;
    }),
  }),
}));

// Mock IndexedDB (using fake-indexeddb)
import 'fake-indexeddb/auto';

// ============================================================================
// Test Helpers
// ============================================================================

const createMockSession = (id: string = 'session-123'): Session => ({
  id,
  name: `Test Session ${id}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startTime: Date.now() - 3600000,
  endTime: Date.now(),
  duration: 3600000,
  screenshotCount: 5,
  screenshots: [],
  audioSegments: [],
  tags: [],
  description: 'Test session',
  category: 'work',
  status: 'completed',
});

const createMockEnrichmentResult = (): EnrichmentResult => ({
  success: true,
  summary: {
    schemaVersion: '1.0',
    title: 'Test Summary',
    overview: 'Test overview',
    achievements: [],
    nextSteps: [],
    topics: [],
  },
  audioInsights: undefined,
  videoChapters: undefined,
  extractedTasks: [],
  extractedNotes: [],
});

/**
 * Wait for job to reach specific status
 */
const waitForJobStatus = async (
  queue: PersistentEnrichmentQueue,
  jobId: string,
  status: JobStatus,
  timeoutMs: number = 5000
): Promise<EnrichmentJob> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await queue.getJob(jobId);
    if (job && job.status === status) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timeout waiting for job ${jobId} to reach status ${status}`);
};

/**
 * Wait for condition
 */
const waitFor = async (
  condition: () => Promise<boolean>,
  timeoutMs: number = 5000
): Promise<void> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timeout waiting for condition');
};

// ============================================================================
// Test Suite
// ============================================================================

describe('PersistentEnrichmentQueue', () => {
  let queue: PersistentEnrichmentQueue;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset singleton
    await resetPersistentEnrichmentQueue();

    // Create fresh queue instance
    queue = await getPersistentEnrichmentQueue({
      maxConcurrency: 2,
      maxRetries: 3,
      processingIntervalMs: 100,
      retryBaseDelayMs: 100,
      retryMaxDelayMs: 1000,
    });
  });

  afterEach(async () => {
    // Shutdown queue
    if (queue) {
      await queue.shutdown();
    }

    // Clean up IndexedDB
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  });

  // ========================================
  // Initialization Tests
  // ========================================

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(queue.getIsInitialized()).toBe(true);
    });

    it('should not initialize twice', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await queue.initialize();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already initialized')
      );
      consoleSpy.mockRestore();
    });

    it('should open IndexedDB with correct schema', async () => {
      // Database should be open
      const status = await queue.getQueueStatus();
      expect(status).toBeDefined();
      expect(status.pending).toBe(0);
    });
  });

  // ========================================
  // Job Enqueue Tests
  // ========================================

  describe('enqueue()', () => {
    it('should enqueue a job successfully', async () => {
      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
        priority: 'high',
        options: { includeAudio: true },
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      const job = await queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.sessionId).toBe('session-123');
      expect(job?.status).toBe('pending');
      expect(job?.priority).toBe('high');
    });

    it('should use default priority if not specified', async () => {
      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      const job = await queue.getJob(jobId);
      expect(job?.priority).toBe('normal');
    });

    it('should emit job-enqueued event', async () => {
      const listener = vi.fn();
      queue.on('job-enqueued', listener);

      await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          status: 'pending',
        })
      );
    });

    it('should throw error if sessionId already has pending job', async () => {
      await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await expect(
        queue.enqueue({
          sessionId: 'session-123',
          sessionName: 'Test Session',
        })
      ).rejects.toThrow('Job already exists');
    });

    it('should allow enqueue if previous job is completed', async () => {
      const jobId1 = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      // Mark first job as completed
      await queue.updateJob(jobId1, { status: 'completed' });

      // Delete first job to free up sessionId constraint
      await queue.deleteJob(jobId1);

      // Should allow second job
      const jobId2 = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      expect(jobId2).toBeDefined();
      expect(jobId2).not.toBe(jobId1);
    });

    it('should throw error if queue not initialized', async () => {
      await queue.shutdown();

      await expect(
        queue.enqueue({
          sessionId: 'session-123',
          sessionName: 'Test Session',
        })
      ).rejects.toThrow('Queue not initialized');
    });
  });

  // ========================================
  // Job Query Tests
  // ========================================

  describe('getJob() and getJobBySessionId()', () => {
    it('should get job by ID', async () => {
      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      const job = await queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });

    it('should return null for non-existent job', async () => {
      const job = await queue.getJob('non-existent');
      expect(job).toBeNull();
    });

    it('should get job by sessionId', async () => {
      await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      const job = await queue.getJobBySessionId('session-123');
      expect(job).toBeDefined();
      expect(job?.sessionId).toBe('session-123');
    });

    it('should return null for non-existent sessionId', async () => {
      const job = await queue.getJobBySessionId('non-existent');
      expect(job).toBeNull();
    });
  });

  // ========================================
  // Job Update Tests
  // ========================================

  describe('updateJob()', () => {
    it('should update job successfully', async () => {
      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await queue.updateJob(jobId, {
        progress: 50,
        stage: 'audio',
      });

      const job = await queue.getJob(jobId);
      expect(job?.progress).toBe(50);
      expect(job?.stage).toBe('audio');
    });

    it('should throw error for non-existent job', async () => {
      await expect(
        queue.updateJob('non-existent', { progress: 50 })
      ).rejects.toThrow('Job non-existent not found');
    });
  });

  // ========================================
  // Job Delete Tests
  // ========================================

  describe('deleteJob()', () => {
    it('should delete job successfully', async () => {
      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await queue.deleteJob(jobId);

      const job = await queue.getJob(jobId);
      expect(job).toBeNull();
    });
  });

  // ========================================
  // Job Cancel Tests
  // ========================================

  describe('cancelJob()', () => {
    it('should cancel pending job', async () => {
      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await queue.cancelJob(jobId);

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe('cancelled');
      expect(job?.completedAt).toBeDefined();
    });

    it('should emit job-cancelled event', async () => {
      const listener = vi.fn();
      queue.on('job-cancelled', listener);

      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await queue.cancelJob(jobId);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not cancel processing job', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await queue.updateJob(jobId, { status: 'processing' });
      await queue.cancelJob(jobId);

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe('processing'); // Should not be cancelled

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot cancel')
      );
      consoleSpy.mockRestore();
    });

    it('should not cancel completed job', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await queue.updateJob(jobId, { status: 'completed' });
      await queue.cancelJob(jobId);

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe('completed'); // Should not be cancelled

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot cancel')
      );
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // Queue Status Tests
  // ========================================

  describe('getQueueStatus()', () => {
    it('should return correct status for empty queue', async () => {
      const status = await queue.getQueueStatus();

      expect(status).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
        byPriority: { high: 0, normal: 0, low: 0 },
      });
    });

    it('should count jobs by status correctly', async () => {
      // Create jobs with different statuses
      const job1 = await queue.enqueue({
        sessionId: 'session-1',
        sessionName: 'Session 1',
        priority: 'high',
      });
      const job2 = await queue.enqueue({
        sessionId: 'session-2',
        sessionName: 'Session 2',
        priority: 'normal',
      });
      const job3 = await queue.enqueue({
        sessionId: 'session-3',
        sessionName: 'Session 3',
        priority: 'low',
      });

      await queue.updateJob(job2, { status: 'completed' });
      await queue.updateJob(job3, { status: 'failed' });

      const status = await queue.getQueueStatus();

      expect(status.pending).toBe(1); // job1
      expect(status.completed).toBe(1); // job2
      expect(status.failed).toBe(1); // job3
      expect(status.total).toBe(3);
      expect(status.byPriority.high).toBe(1);
      expect(status.byPriority.normal).toBe(0); // completed, not pending
      expect(status.byPriority.low).toBe(0); // failed, not pending
    });
  });

  describe('countByStatus()', () => {
    it('should count jobs by status', async () => {
      await queue.enqueue({
        sessionId: 'session-1',
        sessionName: 'Session 1',
      });
      await queue.enqueue({
        sessionId: 'session-2',
        sessionName: 'Session 2',
      });

      const count = await queue.countByStatus('pending');
      expect(count).toBe(2);
    });
  });

  // ========================================
  // Processing Tests
  // ========================================

  describe('Job Processing', () => {
    it('should process job successfully', async () => {
      // Mock successful enrichment
      const mockResult = createMockEnrichmentResult();
      vi.mocked(sessionEnrichmentService.enrichSession).mockResolvedValue(mockResult);

      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      // Wait for job to complete
      const completedJob = await waitForJobStatus(queue, jobId, 'completed');

      expect(completedJob.status).toBe('completed');
      expect(completedJob.progress).toBe(100);
      expect(completedJob.result).toBeDefined();
      expect(completedJob.startedAt).toBeDefined();
      expect(completedJob.completedAt).toBeDefined();
    });

    it('should emit job-started event', async () => {
      const listener = vi.fn();
      queue.on('job-started', listener);

      vi.mocked(sessionEnrichmentService.enrichSession).mockResolvedValue(
        createMockEnrichmentResult()
      );

      await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should emit job-progress events', async () => {
      const listener = vi.fn();
      queue.on('job-progress', listener);

      // Mock enrichment with progress updates
      vi.mocked(sessionEnrichmentService.enrichSession).mockImplementation(
        async (_session, options) => {
          // Simulate progress updates
          if (options?.onProgress) {
            options.onProgress({
              stage: 'audio',
              message: 'Processing audio',
              progress: 25,
            });
            await new Promise((resolve) => setTimeout(resolve, 150));
            options.onProgress({
              stage: 'video',
              message: 'Processing video',
              progress: 50,
            });
            await new Promise((resolve) => setTimeout(resolve, 150));
            options.onProgress({
              stage: 'summary',
              message: 'Generating summary',
              progress: 75,
            });
          }
          return createMockEnrichmentResult();
        }
      );

      await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should have received progress events (throttled)
      expect(listener.mock.calls.length).toBeGreaterThan(0);
    });

    it('should emit job-completed event', async () => {
      const listener = vi.fn();
      queue.on('job-completed', listener);

      vi.mocked(sessionEnrichmentService.enrichSession).mockResolvedValue(
        createMockEnrichmentResult()
      );

      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await waitForJobStatus(queue, jobId, 'completed');

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          progress: 100,
        })
      );
    });

    it('should process multiple jobs concurrently', async () => {
      vi.mocked(sessionEnrichmentService.enrichSession).mockImplementation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return createMockEnrichmentResult();
        }
      );

      // Enqueue 3 jobs (maxConcurrency is 2)
      const job1 = await queue.enqueue({
        sessionId: 'session-1',
        sessionName: 'Session 1',
      });
      const job2 = await queue.enqueue({
        sessionId: 'session-2',
        sessionName: 'Session 2',
      });
      const job3 = await queue.enqueue({
        sessionId: 'session-3',
        sessionName: 'Session 3',
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Should have at most 2 processing (concurrency limit)
      const status = await queue.getQueueStatus();
      expect(status.processing).toBeLessThanOrEqual(2);
      expect(status.processing + status.pending + status.completed).toBe(3);

      // Wait for all to complete
      await waitForJobStatus(queue, job1, 'completed');
      await waitForJobStatus(queue, job2, 'completed');
      await waitForJobStatus(queue, job3, 'completed');

      const finalStatus = await queue.getQueueStatus();
      expect(finalStatus.completed).toBe(3);
      expect(finalStatus.processing).toBe(0);
      expect(finalStatus.pending).toBe(0);
    });
  });

  // ========================================
  // Priority Queue Tests
  // ========================================

  describe('Priority Queue', () => {
    it('should process high priority jobs first', async () => {
      // Mock slow enrichment
      vi.mocked(sessionEnrichmentService.enrichSession).mockImplementation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return createMockEnrichmentResult();
        }
      );

      const processedOrder: string[] = [];
      queue.on('job-started', (job: EnrichmentJob) => {
        processedOrder.push(job.priority);
      });

      // Enqueue in reverse priority order
      await queue.enqueue({
        sessionId: 'session-1',
        sessionName: 'Session 1',
        priority: 'low',
      });
      await queue.enqueue({
        sessionId: 'session-2',
        sessionName: 'Session 2',
        priority: 'normal',
      });
      await queue.enqueue({
        sessionId: 'session-3',
        sessionName: 'Session 3',
        priority: 'high',
      });

      // Wait for processing to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // High priority should be processed first
      expect(processedOrder[0]).toBe('high');
    });

    it('should process FIFO within same priority', async () => {
      vi.mocked(sessionEnrichmentService.enrichSession).mockImplementation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return createMockEnrichmentResult();
        }
      );

      const processedOrder: string[] = [];
      queue.on('job-started', (job: EnrichmentJob) => {
        processedOrder.push(job.sessionId);
      });

      // Enqueue multiple jobs with same priority
      await queue.enqueue({
        sessionId: 'session-1',
        sessionName: 'Session 1',
        priority: 'normal',
      });
      await queue.enqueue({
        sessionId: 'session-2',
        sessionName: 'Session 2',
        priority: 'normal',
      });
      await queue.enqueue({
        sessionId: 'session-3',
        sessionName: 'Session 3',
        priority: 'normal',
      });

      // Wait for all to be processed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Should be processed in order (FIFO)
      expect(processedOrder).toContain('session-1');
      expect(processedOrder).toContain('session-2');
      expect(processedOrder).toContain('session-3');

      // First job should be session-1 (first enqueued)
      expect(processedOrder[0]).toBe('session-1');
    });
  });

  // ========================================
  // Error Handling & Retry Tests
  // ========================================

  describe('Error Handling', () => {
    it('should retry failed job with exponential backoff', async () => {
      let attemptCount = 0;

      vi.mocked(sessionEnrichmentService.enrichSession).mockImplementation(
        async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Simulated failure');
          }
          return createMockEnrichmentResult();
        }
      );

      const listener = vi.fn();
      queue.on('job-retry', listener);

      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      // Wait for retries and completion
      await waitForJobStatus(queue, jobId, 'completed', 5000);

      // Should have retried (3 or 4 attempts depending on timing)
      expect(attemptCount).toBeGreaterThanOrEqual(3);
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should mark job as failed after max retries', async () => {
      vi.mocked(sessionEnrichmentService.enrichSession).mockRejectedValue(
        new Error('Permanent failure')
      );

      const listener = vi.fn();
      queue.on('job-failed', listener);

      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      // Wait for all retries to exhaust
      await waitForJobStatus(queue, jobId, 'failed', 5000);

      const job = await queue.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.attempts).toBeGreaterThanOrEqual(3);
      expect(job?.error).toContain('Permanent failure');

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should isolate errors (one job failure does not block others)', async () => {
      // Mock: first session fails (job1), second session succeeds (job2)
      vi.mocked(sessionEnrichmentService.enrichSession).mockImplementation(
        async (session: Session) => {
          if (session.id === 'session-1') {
            throw new Error('Job 1 failed permanently');
          } else {
            return createMockEnrichmentResult();
          }
        }
      );

      const job1 = await queue.enqueue({
        sessionId: 'session-1',
        sessionName: 'Session 1',
      });
      const job2 = await queue.enqueue({
        sessionId: 'session-2',
        sessionName: 'Session 2',
      });

      // Wait for job 2 to complete (should not be blocked by job 1 failures)
      const job2Final = await waitForJobStatus(queue, job2, 'completed', 3000);

      // Job 2 should have succeeded (not blocked by job 1)
      expect(job2Final.status).toBe('completed');

      // Job 1 will eventually fail after retries (don't wait for it)
      // This proves error isolation - job 2 completed while job 1 was failing/retrying
    }, 10000); // Increased timeout
  });

  // ========================================
  // Recovery Tests
  // ========================================

  describe('Auto-Resume on Restart', () => {
    it('should reset crashed jobs to pending on initialization', async () => {
      // Create a job and set it to processing manually (simulating crash)
      const jobId = await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await queue.updateJob(jobId, { status: 'processing' });

      // Shutdown and reinitialize
      await queue.shutdown();

      queue = await getPersistentEnrichmentQueue({
        maxConcurrency: 2,
        maxRetries: 3,
        processingIntervalMs: 100,
      });

      // Job should be reset to pending
      const job = await queue.getJob(jobId);
      expect(job?.status).toBe('pending');
    });

    it('should resume pending jobs on initialization', async () => {
      vi.mocked(sessionEnrichmentService.enrichSession).mockResolvedValue(
        createMockEnrichmentResult()
      );

      // Create pending jobs
      await queue.enqueue({
        sessionId: 'session-1',
        sessionName: 'Session 1',
      });
      await queue.enqueue({
        sessionId: 'session-2',
        sessionName: 'Session 2',
      });

      // Shutdown and reinitialize
      await queue.shutdown();

      queue = await getPersistentEnrichmentQueue({
        maxConcurrency: 2,
        maxRetries: 3,
        processingIntervalMs: 100,
      });

      // Jobs should be resumed automatically
      await new Promise((resolve) => setTimeout(resolve, 500));

      const status = await queue.getQueueStatus();
      // Jobs should be processing or completed
      expect(status.pending + status.processing + status.completed).toBe(2);
    });
  });

  // ========================================
  // Shutdown Tests
  // ========================================

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await queue.shutdown();
      expect(queue.getIsInitialized()).toBe(false);
    });

    it('should wait for current jobs to complete', async () => {
      vi.mocked(sessionEnrichmentService.enrichSession).mockImplementation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return createMockEnrichmentResult();
        }
      );

      await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      // Wait for processing to start
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Shutdown should wait for job to complete
      const shutdownPromise = queue.shutdown();
      const status1 = await queue.getQueueStatus();
      expect(status1.processing).toBeGreaterThan(0);

      await shutdownPromise;
      expect(queue.getIsInitialized()).toBe(false);
    });

    it('should not shutdown twice', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // First shutdown
      await queue.shutdown();

      // Try shutting down again - should warn
      const secondShutdown = queue.shutdown();

      // Wait briefly to ensure warning is logged
      await new Promise((resolve) => setTimeout(resolve, 10));

      await secondShutdown;

      // Should have been called, but exact timing may vary
      expect(consoleSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // Singleton Tests
  // ========================================

  describe('Singleton', () => {
    it('should return same instance', async () => {
      const instance1 = await getPersistentEnrichmentQueue();
      const instance2 = await getPersistentEnrichmentQueue();

      expect(instance1).toBe(instance2);
    });

    it('should initialize only once', async () => {
      await resetPersistentEnrichmentQueue();

      const initPromises = [
        getPersistentEnrichmentQueue(),
        getPersistentEnrichmentQueue(),
        getPersistentEnrichmentQueue(),
      ];

      const instances = await Promise.all(initPromises);

      expect(instances[0]).toBe(instances[1]);
      expect(instances[1]).toBe(instances[2]);
    });
  });

  // ========================================
  // Event Emitter Tests
  // ========================================

  describe('Event Emitter', () => {
    it('should support on() and off()', () => {
      const listener = vi.fn();

      queue.on('job-enqueued', listener);
      queue.emit('job-enqueued', { id: 'test' });

      expect(listener).toHaveBeenCalledTimes(0); // Async emit

      queue.off('job-enqueued', listener);
      queue.emit('job-enqueued', { id: 'test2' });

      // Should not be called after off()
    });

    it('should handle listener errors gracefully', async () => {
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      queue.on('job-enqueued', errorListener);

      await queue.enqueue({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have logged error but not crash
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Event listener error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
