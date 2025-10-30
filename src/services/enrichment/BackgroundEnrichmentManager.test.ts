/**
 * BackgroundEnrichmentManager Unit Tests
 *
 * Comprehensive test suite covering:
 * - Singleton pattern
 * - Initialization and shutdown
 * - Job enqueueing with validation
 * - Media processing callbacks
 * - Status queries
 * - Job control (cancel, retry)
 * - Event forwarding
 * - Notification system
 * - Error handling
 *
 * Target: >80% coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  getBackgroundEnrichmentManager,
  resetBackgroundEnrichmentManager,
  BackgroundEnrichmentManager,
} from './BackgroundEnrichmentManager';
import type { EnrichmentJob, QueueStatus } from './PersistentEnrichmentQueue';

// ============================================================================
// Mocks
// ============================================================================

// Mock PersistentEnrichmentQueue - use factory function for proper hoisting
vi.mock('./PersistentEnrichmentQueue', () => {
  const mockQueue = {
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    enqueue: vi.fn(),
    updateJob: vi.fn().mockResolvedValue(undefined),
    deleteJob: vi.fn().mockResolvedValue(undefined),
    cancelJob: vi.fn().mockResolvedValue(undefined),
    getJob: vi.fn(),
    getJobBySessionId: vi.fn(),
    getJobsByStatus: vi.fn(),
    getQueueStatus: vi.fn(),
    countByStatus: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    getIsInitialized: vi.fn().mockReturnValue(true),
  };

  return {
    getPersistentEnrichmentQueue: vi.fn().mockResolvedValue(mockQueue),
    // Export mock for test access
    __mockQueue: mockQueue,
  };
});

// Mock ChunkedSessionStorage - use factory function
vi.mock('../storage/ChunkedSessionStorage', () => {
  const mockStorage = {
    loadMetadata: vi.fn(),
    loadFullSession: vi.fn(),
  };

  return {
    getChunkedStorage: vi.fn().mockResolvedValue(mockStorage),
    // Export mock for test access
    __mockStorage: mockStorage,
  };
});

// Mock Web Notification API
const mockNotification = vi.fn();
global.Notification = mockNotification as any;
global.Notification.permission = 'granted';
global.Notification.requestPermission = vi.fn().mockResolvedValue('granted');

// Get access to mocks
import * as PersistentEnrichmentQueueModule from './PersistentEnrichmentQueue';
import * as ChunkedSessionStorageModule from '../storage/ChunkedSessionStorage';

const mockQueue = (PersistentEnrichmentQueueModule as any).__mockQueue;
const mockStorage = (ChunkedSessionStorageModule as any).__mockStorage;

// ============================================================================
// Test Data
// ============================================================================

const mockSessionMetadata = {
  id: 'session-123',
  name: 'Test Session',
  startTime: Date.now(),
  endTime: Date.now() + 1000,
};

const mockJob: EnrichmentJob = {
  id: 'job-123',
  sessionId: 'session-123',
  sessionName: 'Test Session',
  status: 'pending',
  priority: 'normal',
  progress: 0,
  options: { includeAudio: true },
  createdAt: Date.now(),
  lastUpdated: Date.now(),
  attempts: 0,
  maxAttempts: 3,
};

const mockQueueStatus: QueueStatus = {
  pending: 1,
  processing: 0,
  completed: 0,
  failed: 0,
  cancelled: 0,
  total: 1,
  byPriority: { high: 0, normal: 1, low: 0 },
};

// ============================================================================
// Tests
// ============================================================================

describe('BackgroundEnrichmentManager', () => {
  let manager: BackgroundEnrichmentManager;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset singleton
    await resetBackgroundEnrichmentManager();

    // Setup default mock behaviors
    mockQueue.enqueue.mockResolvedValue('job-123');
    mockQueue.getJobBySessionId.mockResolvedValue(mockJob);
    mockQueue.getQueueStatus.mockResolvedValue(mockQueueStatus);
    mockStorage.loadMetadata.mockResolvedValue(mockSessionMetadata);

    // Get manager instance
    manager = getBackgroundEnrichmentManager();
  });

  afterEach(async () => {
    // Cleanup
    if (manager.isInitialized()) {
      await manager.shutdown();
    }
    await resetBackgroundEnrichmentManager();
  });

  // ========================================
  // Singleton Pattern
  // ========================================

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const manager1 = getBackgroundEnrichmentManager();
      const manager2 = getBackgroundEnrichmentManager();

      expect(manager1).toBe(manager2);
    });

    it('should create new instance after reset', async () => {
      const manager1 = getBackgroundEnrichmentManager();
      await resetBackgroundEnrichmentManager();
      const manager2 = getBackgroundEnrichmentManager();

      expect(manager1).not.toBe(manager2);
    });
  });

  // ========================================
  // Initialization & Lifecycle
  // ========================================

  describe('initialize()', () => {
    it('should initialize successfully', async () => {
      await manager.initialize();

      expect(manager.isInitialized()).toBe(true);
      expect(mockQueue.on).toHaveBeenCalled(); // Event subscriptions
    });

    it('should not initialize twice', async () => {
      await manager.initialize();
      await manager.initialize(); // Second call should be no-op

      expect(manager.isInitialized()).toBe(true);
    });

    it('should throw error if queue initialization fails', async () => {
      const mockError = new Error('Queue init failed');

      // Mock getPersistentEnrichmentQueue to reject
      const PersistentEnrichmentQueueMod = await import('./PersistentEnrichmentQueue');
      vi.mocked(PersistentEnrichmentQueueMod.getPersistentEnrichmentQueue).mockRejectedValueOnce(mockError);

      // Need to get a fresh instance since queue is initialized in manager.initialize()
      await resetBackgroundEnrichmentManager();
      const freshManager = getBackgroundEnrichmentManager();

      await expect(freshManager.initialize()).rejects.toThrow('Failed to initialize enrichment manager');
    });

    it('should subscribe to all queue events', async () => {
      await manager.initialize();

      expect(mockQueue.on).toHaveBeenCalledWith('job-enqueued', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-started', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-progress', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-completed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-failed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-cancelled', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('job-retry', expect.any(Function));
    });
  });

  describe('shutdown()', () => {
    it('should shutdown successfully', async () => {
      await manager.initialize();
      await manager.shutdown();

      expect(manager.isInitialized()).toBe(false);
      expect(mockQueue.shutdown).toHaveBeenCalled();
    });

    it('should handle shutdown when not initialized', async () => {
      // Should not throw
      await expect(manager.shutdown()).resolves.not.toThrow();
    });

    it('should handle queue shutdown errors', async () => {
      await manager.initialize();

      const mockError = new Error('Shutdown failed');
      vi.mocked(mockQueue.shutdown).mockRejectedValueOnce(mockError);

      await expect(manager.shutdown()).rejects.toThrow(mockError);
    });
  });

  // ========================================
  // Job Creation & Management
  // ========================================

  describe('enqueueSession()', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should enqueue session successfully', async () => {
      const jobId = await manager.enqueueSession({
        sessionId: 'session-123',
        sessionName: 'Test Session',
        priority: 'high',
        options: { includeAudio: true },
      });

      expect(jobId).toBe('job-123');
      expect(mockStorage.loadMetadata).toHaveBeenCalledWith('session-123');
      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        sessionId: 'session-123',
        sessionName: 'Test Session',
        priority: 'high',
        options: { includeAudio: true },
      });
    });

    it('should use default priority if not specified', async () => {
      await manager.enqueueSession({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      expect(mockQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'normal',
        })
      );
    });

    it('should use empty options if not specified', async () => {
      await manager.enqueueSession({
        sessionId: 'session-123',
        sessionName: 'Test Session',
      });

      expect(mockQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          options: {},
        })
      );
    });

    it('should throw error if not initialized', async () => {
      await manager.shutdown();

      await expect(
        manager.enqueueSession({
          sessionId: 'session-123',
          sessionName: 'Test Session',
        })
      ).rejects.toThrow('BackgroundEnrichmentManager not initialized');
    });

    it('should throw error if session not found', async () => {
      mockStorage.loadMetadata.mockResolvedValueOnce(null);

      await expect(
        manager.enqueueSession({
          sessionId: 'session-123',
          sessionName: 'Test Session',
        })
      ).rejects.toThrow('Session session-123 not found');
    });

    it('should propagate queue enqueue errors', async () => {
      const mockError = new Error('Job already exists');
      mockQueue.enqueue.mockRejectedValueOnce(mockError);

      await expect(
        manager.enqueueSession({
          sessionId: 'session-123',
          sessionName: 'Test Session',
        })
      ).rejects.toThrow(mockError);
    });
  });

  describe('markMediaProcessingComplete()', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should mark media processing complete', async () => {
      await manager.markMediaProcessingComplete('session-123', '/path/to/video.mp4');

      expect(mockQueue.getJobBySessionId).toHaveBeenCalledWith('session-123');
      expect(mockQueue.updateJob).toHaveBeenCalledWith(
        'job-123',
        expect.objectContaining({
          options: expect.objectContaining({
            optimizedVideoPath: '/path/to/video.mp4',
          }),
        })
      );
    });

    it('should work without optimized video path', async () => {
      await manager.markMediaProcessingComplete('session-123');

      expect(mockQueue.getJobBySessionId).toHaveBeenCalledWith('session-123');
      expect(mockQueue.updateJob).toHaveBeenCalled();
    });

    it('should throw error if not initialized', async () => {
      await manager.shutdown();

      await expect(
        manager.markMediaProcessingComplete('session-123')
      ).rejects.toThrow('BackgroundEnrichmentManager not initialized');
    });

    it('should throw error if job not found', async () => {
      mockQueue.getJobBySessionId.mockResolvedValueOnce(null);

      await expect(
        manager.markMediaProcessingComplete('session-123')
      ).rejects.toThrow('Job not found for session session-123');
    });
  });

  // ========================================
  // Status Queries
  // ========================================

  describe('getQueueStatus()', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return queue status', async () => {
      const status = await manager.getQueueStatus();

      expect(status).toEqual(mockQueueStatus);
      expect(mockQueue.getQueueStatus).toHaveBeenCalled();
    });

    it('should throw error if not initialized', async () => {
      await manager.shutdown();

      await expect(manager.getQueueStatus()).rejects.toThrow(
        'BackgroundEnrichmentManager not initialized'
      );
    });

    it('should propagate queue errors', async () => {
      const mockError = new Error('Queue status failed');
      mockQueue.getQueueStatus.mockRejectedValueOnce(mockError);

      await expect(manager.getQueueStatus()).rejects.toThrow(mockError);
    });
  });

  describe('getJobStatus()', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should return job status', async () => {
      const job = await manager.getJobStatus('session-123');

      expect(job).toEqual(mockJob);
      expect(mockQueue.getJobBySessionId).toHaveBeenCalledWith('session-123');
    });

    it('should return null if job not found', async () => {
      mockQueue.getJobBySessionId.mockResolvedValueOnce(null);

      const job = await manager.getJobStatus('session-123');

      expect(job).toBeNull();
    });

    it('should throw error if not initialized', async () => {
      await manager.shutdown();

      await expect(manager.getJobStatus('session-123')).rejects.toThrow(
        'BackgroundEnrichmentManager not initialized'
      );
    });
  });

  // ========================================
  // Job Control
  // ========================================

  describe('cancelEnrichment()', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should cancel enrichment successfully', async () => {
      await manager.cancelEnrichment('session-123');

      expect(mockQueue.getJobBySessionId).toHaveBeenCalledWith('session-123');
      expect(mockQueue.cancelJob).toHaveBeenCalledWith('job-123');
    });

    it('should throw error if not initialized', async () => {
      await manager.shutdown();

      await expect(manager.cancelEnrichment('session-123')).rejects.toThrow(
        'BackgroundEnrichmentManager not initialized'
      );
    });

    it('should throw error if job not found', async () => {
      mockQueue.getJobBySessionId.mockResolvedValueOnce(null);

      await expect(manager.cancelEnrichment('session-123')).rejects.toThrow(
        'Job not found for session session-123'
      );
    });
  });

  describe('retryEnrichment()', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should retry failed enrichment', async () => {
      const failedJob = { ...mockJob, status: 'failed' as const };
      mockQueue.getJobBySessionId.mockResolvedValueOnce(failedJob);

      await manager.retryEnrichment('session-123');

      expect(mockQueue.getJobBySessionId).toHaveBeenCalledWith('session-123');
      expect(mockQueue.updateJob).toHaveBeenCalledWith(
        'job-123',
        expect.objectContaining({
          status: 'pending',
          attempts: 0,
          error: undefined,
        })
      );
    });

    it('should throw error if job not in failed state', async () => {
      const pendingJob = { ...mockJob, status: 'pending' as const };
      mockQueue.getJobBySessionId.mockResolvedValueOnce(pendingJob);

      await expect(manager.retryEnrichment('session-123')).rejects.toThrow(
        'Job is not in failed state'
      );
    });

    it('should throw error if not initialized', async () => {
      await manager.shutdown();

      await expect(manager.retryEnrichment('session-123')).rejects.toThrow(
        'BackgroundEnrichmentManager not initialized'
      );
    });

    it('should throw error if job not found', async () => {
      mockQueue.getJobBySessionId.mockResolvedValueOnce(null);

      await expect(manager.retryEnrichment('session-123')).rejects.toThrow(
        'Job not found for session session-123'
      );
    });
  });

  // ========================================
  // Notifications
  // ========================================

  describe('Notifications', () => {
    let completedHandler: ((job: EnrichmentJob) => void) | undefined;
    let failedHandler: ((job: EnrichmentJob, error: Error) => void) | undefined;

    beforeEach(async () => {
      await manager.initialize();

      // Capture handlers from queue.on calls
      const completedCall = mockQueue.on.mock.calls.find((call) => call[0] === 'job-completed');
      const failedCall = mockQueue.on.mock.calls.find((call) => call[0] === 'job-failed');

      completedHandler = completedCall?.[1];
      failedHandler = failedCall?.[1];

      vi.clearAllMocks(); // Clear initialization calls
    });

    it('should show notification on job completion', async () => {
      expect(completedHandler).toBeDefined();

      // Trigger completion
      completedHandler!(mockJob);

      expect(mockNotification).toHaveBeenCalledWith(
        'Session Enriched',
        expect.objectContaining({
          body: expect.stringContaining('Test Session'),
        })
      );
    });

    it('should show notification on job failure', async () => {
      expect(failedHandler).toBeDefined();

      // Trigger failure
      const mockError = new Error('Enrichment failed');
      failedHandler!(mockJob, mockError);

      expect(mockNotification).toHaveBeenCalledWith(
        'Enrichment Failed',
        expect.objectContaining({
          body: expect.stringContaining('Test Session'),
        })
      );
    });

    it('should not show notifications if disabled', async () => {
      await manager.shutdown();
      await resetBackgroundEnrichmentManager();

      // Create manager with notifications disabled
      const managerNoNotifs = getBackgroundEnrichmentManager({
        enableNotifications: false,
      });
      await managerNoNotifs.initialize();

      // Capture handler from new manager
      const completedCall = mockQueue.on.mock.calls.find((call) => call[0] === 'job-completed');
      const noNotifHandler = completedCall?.[1];

      vi.clearAllMocks();

      // Trigger completion
      noNotifHandler!(mockJob);

      expect(mockNotification).not.toHaveBeenCalled();

      await managerNoNotifs.shutdown();
    });

    it('should request permission if not granted', async () => {
      const originalPermission = global.Notification.permission;
      global.Notification.permission = 'default';

      expect(completedHandler).toBeDefined();

      // Trigger completion
      completedHandler!(mockJob);

      expect(global.Notification.requestPermission).toHaveBeenCalled();

      // Restore
      global.Notification.permission = originalPermission;
    });
  });

  // ========================================
  // Utilities
  // ========================================

  describe('getQueue()', () => {
    it('should return null if not initialized', () => {
      const queue = manager.getQueue();
      expect(queue).toBeNull();
    });

    it('should return queue if initialized', async () => {
      await manager.initialize();
      const queue = manager.getQueue();
      expect(queue).toBe(mockQueue);
    });
  });

  describe('isInitialized()', () => {
    it('should return false initially', () => {
      expect(manager.isInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await manager.initialize();
      expect(manager.isInitialized()).toBe(true);
    });

    it('should return false after shutdown', async () => {
      await manager.initialize();
      await manager.shutdown();
      expect(manager.isInitialized()).toBe(false);
    });
  });
});
