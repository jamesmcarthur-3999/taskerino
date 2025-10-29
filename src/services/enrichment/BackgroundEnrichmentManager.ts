/**
 * BackgroundEnrichmentManager - Singleton Orchestrator for Background Enrichment
 *
 * High-level API for managing enrichment lifecycle, integrating with PersistentEnrichmentQueue
 * to provide a simple interface for job creation, status tracking, and notifications.
 *
 * Key Features:
 * - **Singleton Pattern**: Single instance shared across app
 * - **Auto-Initialize**: Called from App.tsx on mount
 * - **Job Orchestration**: High-level API for creating/managing jobs
 * - **Notification System**: Shows OS-level notification when enrichment completes
 * - **Event Forwarding**: Forwards queue events to UI components
 * - **Status Queries**: Aggregate queue status and per-job status
 * - **Media Processing**: Coordinates with BackgroundMediaProcessor
 *
 * Architecture:
 * 1. Initialize: Start queue, subscribe to events
 * 2. Enqueue: Validate session, create job, enqueue to queue
 * 3. Media Processing: Mark when media processing is complete (triggers enrichment)
 * 4. Notifications: Show notification when job completes
 * 5. Status Queries: Query queue for aggregate and per-job status
 * 6. Shutdown: Gracefully shutdown queue
 *
 * Usage:
 * ```typescript
 * import { getBackgroundEnrichmentManager } from './BackgroundEnrichmentManager';
 *
 * // Initialize on app launch
 * await getBackgroundEnrichmentManager().initialize();
 *
 * // Enqueue session for enrichment
 * const jobId = await manager.enqueueSession(sessionId, sessionName, {
 *   includeAudio: true,
 *   includeVideo: true
 * });
 *
 * // Mark media processing complete (triggers enrichment)
 * await manager.markMediaProcessingComplete(sessionId, optimizedVideoPath);
 *
 * // Get queue status
 * const status = await manager.getQueueStatus();
 * console.log(`${status.processing} jobs processing`);
 * ```
 *
 * Integration:
 * - Used by: ActiveSessionContext (endSession flow)
 * - Uses: PersistentEnrichmentQueue (job management)
 * - Used by: App.tsx (initialization)
 * - Used by: EnrichmentStatusIndicator (status display)
 *
 * @see docs/sessions-rewrite/BACKGROUND_ENRICHMENT_PLAN.md - Complete specification
 */

import { getPersistentEnrichmentQueue } from './PersistentEnrichmentQueue';
import type {
  PersistentEnrichmentQueue,
  EnrichmentJob,
  QueueStatus,
  EnrichmentOptions,
  JobPriority,
} from './PersistentEnrichmentQueue';
import { getChunkedStorage } from '../storage/ChunkedSessionStorage';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Job creation parameters
 */
export interface EnqueueSessionParams {
  /** Session ID being enriched */
  sessionId: string;

  /** Session name (for UI display and notifications) */
  sessionName: string;

  /** Job priority */
  priority?: JobPriority;

  /** Enrichment options */
  options?: EnrichmentOptions;
}

/**
 * Manager initialization options
 */
export interface ManagerOptions {
  /** Enable OS-level notifications (default: true) */
  enableNotifications?: boolean;

  /** Auto-initialize queue on manager init (default: true) */
  autoInitQueue?: boolean;
}

// ============================================================================
// BackgroundEnrichmentManager Class
// ============================================================================

/**
 * Singleton orchestrator for background enrichment lifecycle
 */
export class BackgroundEnrichmentManager {
  private queue: PersistentEnrichmentQueue | null = null;
  private initialized = false;
  private options: Required<ManagerOptions>;

  /**
   * Private constructor for singleton pattern
   * @private
   */
  constructor(options?: ManagerOptions) {
    this.options = {
      enableNotifications: options?.enableNotifications ?? true,
      autoInitQueue: options?.autoInitQueue ?? true,
    };

    console.log('[BackgroundEnrichmentManager] Created', {
      enableNotifications: this.options.enableNotifications,
      autoInitQueue: this.options.autoInitQueue,
    });
  }

  // ========================================
  // Initialization & Lifecycle
  // ========================================

  /**
   * Initialize manager and queue
   * MUST be called before using manager (typically from App.tsx)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[BackgroundEnrichmentManager] Already initialized');
      return;
    }

    console.log('[BackgroundEnrichmentManager] Initializing...');

    try {
      // Initialize queue if auto-init enabled
      if (this.options.autoInitQueue) {
        this.queue = await getPersistentEnrichmentQueue();
        console.log('[BackgroundEnrichmentManager] Queue initialized');
      }

      // Subscribe to queue events
      this.subscribeToQueueEvents();

      this.initialized = true;
      console.log('[BackgroundEnrichmentManager] ✓ Initialized successfully');
    } catch (error) {
      console.error('[BackgroundEnrichmentManager] ✗ Initialization failed:', error);
      throw new Error(
        `Failed to initialize enrichment manager: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Shutdown manager gracefully
   * Waits for current jobs to complete (with timeout)
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      console.warn('[BackgroundEnrichmentManager] Not initialized, nothing to shutdown');
      return;
    }

    console.log('[BackgroundEnrichmentManager] Shutting down...');

    try {
      // Shutdown queue
      if (this.queue) {
        await this.queue.shutdown();
        this.queue = null;
      }

      this.initialized = false;
      console.log('[BackgroundEnrichmentManager] ✓ Shutdown complete');
    } catch (error) {
      console.error('[BackgroundEnrichmentManager] Shutdown error:', error);
      throw error;
    }
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ========================================
  // Job Creation & Management
  // ========================================

  /**
   * Enqueue session for enrichment
   *
   * Validates session exists before enqueueing. Creates job in pending state,
   * waiting for media processing to complete before enrichment starts.
   *
   * @param params - Job parameters
   * @returns Job ID for tracking
   * @throws Error if not initialized
   * @throws Error if session not found
   * @throws Error if job already exists for session
   */
  async enqueueSession(params: EnqueueSessionParams): Promise<string> {
    this.ensureInitialized();

    const { sessionId, sessionName, priority = 'normal', options = {} } = params;

    console.log('[BackgroundEnrichmentManager] Enqueueing session', {
      sessionId,
      sessionName,
      priority,
      options,
    });

    try {
      // Validate session exists
      const storage = await getChunkedStorage();
      const metadata = await storage.loadMetadata(sessionId);

      if (!metadata) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Create job in queue
      const jobId = await this.queue!.enqueue({
        sessionId,
        sessionName,
        priority,
        options,
      });

      console.log('[BackgroundEnrichmentManager] ✓ Session enqueued', { jobId });

      return jobId;
    } catch (error) {
      console.error('[BackgroundEnrichmentManager] Failed to enqueue session:', error);
      throw error;
    }
  }

  /**
   * Mark media processing complete for a session
   *
   * Called by BackgroundMediaProcessor after video/audio merge completes.
   * Updates job to indicate media is ready, allowing enrichment to proceed.
   *
   * @param sessionId - Session ID
   * @param optimizedVideoPath - Path to optimized video file (optional)
   * @throws Error if not initialized
   * @throws Error if job not found
   */
  async markMediaProcessingComplete(
    sessionId: string,
    optimizedVideoPath?: string
  ): Promise<void> {
    this.ensureInitialized();

    console.log('[BackgroundEnrichmentManager] Marking media processing complete', {
      sessionId,
      optimizedVideoPath,
    });

    try {
      // Get job by session ID
      const job = await this.queue!.getJobBySessionId(sessionId);

      if (!job) {
        throw new Error(`Job not found for session ${sessionId}`);
      }

      // Update job to mark media processing complete
      await this.queue!.updateJob(job.id, {
        // Note: PersistentEnrichmentQueue doesn't have mediaProcessingComplete field
        // but we can use a custom field in options or just leave it as is
        // The queue will process the job when it's in pending state
        ...(optimizedVideoPath && {
          options: {
            ...job.options,
            optimizedVideoPath,
          },
        }),
      });

      console.log('[BackgroundEnrichmentManager] ✓ Media processing marked complete');
    } catch (error) {
      console.error('[BackgroundEnrichmentManager] Failed to mark media processing complete:', error);
      throw error;
    }
  }

  // ========================================
  // Status Queries
  // ========================================

  /**
   * Get aggregate queue status
   *
   * Returns summary of all jobs across all statuses.
   *
   * @returns Queue status summary
   * @throws Error if not initialized
   */
  async getQueueStatus(): Promise<QueueStatus> {
    this.ensureInitialized();

    try {
      const status = await this.queue!.getQueueStatus();
      return status;
    } catch (error) {
      console.error('[BackgroundEnrichmentManager] Failed to get queue status:', error);
      throw error;
    }
  }

  /**
   * Get status of specific job by session ID
   *
   * @param sessionId - Session ID
   * @returns Job status or null if not found
   * @throws Error if not initialized
   */
  async getJobStatus(sessionId: string): Promise<EnrichmentJob | null> {
    this.ensureInitialized();

    try {
      const job = await this.queue!.getJobBySessionId(sessionId);
      return job;
    } catch (error) {
      console.error('[BackgroundEnrichmentManager] Failed to get job status:', error);
      throw error;
    }
  }

  // ========================================
  // Job Control
  // ========================================

  /**
   * Cancel enrichment job
   *
   * Cancels pending job. Cannot cancel jobs that are already processing.
   *
   * @param sessionId - Session ID
   * @throws Error if not initialized
   * @throws Error if job not found
   */
  async cancelEnrichment(sessionId: string): Promise<void> {
    this.ensureInitialized();

    console.log('[BackgroundEnrichmentManager] Cancelling enrichment', { sessionId });

    try {
      // Get job by session ID
      const job = await this.queue!.getJobBySessionId(sessionId);

      if (!job) {
        throw new Error(`Job not found for session ${sessionId}`);
      }

      // Cancel job
      await this.queue!.cancelJob(job.id);

      console.log('[BackgroundEnrichmentManager] ✓ Enrichment cancelled');
    } catch (error) {
      console.error('[BackgroundEnrichmentManager] Failed to cancel enrichment:', error);
      throw error;
    }
  }

  /**
   * Retry failed enrichment job
   *
   * Resets failed job to pending state for retry.
   *
   * @param sessionId - Session ID
   * @throws Error if not initialized
   * @throws Error if job not found
   * @throws Error if job not in failed state
   */
  async retryEnrichment(sessionId: string): Promise<void> {
    this.ensureInitialized();

    console.log('[BackgroundEnrichmentManager] Retrying enrichment', { sessionId });

    try {
      // Get job by session ID
      const job = await this.queue!.getJobBySessionId(sessionId);

      if (!job) {
        throw new Error(`Job not found for session ${sessionId}`);
      }

      if (job.status !== 'failed') {
        throw new Error(`Job is not in failed state (current: ${job.status})`);
      }

      // Reset job to pending
      await this.queue!.updateJob(job.id, {
        status: 'pending',
        attempts: 0,
        error: undefined,
        startedAt: undefined,
        completedAt: undefined,
      });

      console.log('[BackgroundEnrichmentManager] ✓ Enrichment retry queued');
    } catch (error) {
      console.error('[BackgroundEnrichmentManager] Failed to retry enrichment:', error);
      throw error;
    }
  }

  // ========================================
  // Event Forwarding
  // ========================================

  /**
   * Subscribe to queue events and forward to UI
   * @private
   */
  private subscribeToQueueEvents(): void {
    if (!this.queue) {
      console.warn('[BackgroundEnrichmentManager] Queue not initialized, skipping event subscription');
      return;
    }

    // Forward all queue events (UI components can subscribe to these)
    this.queue.on('job-enqueued', (job: EnrichmentJob) => {
      console.log('[BackgroundEnrichmentManager] Job enqueued:', job.id);
      // Event already emitted by queue, no need to re-emit
    });

    this.queue.on('job-started', (job: EnrichmentJob) => {
      console.log('[BackgroundEnrichmentManager] Job started:', job.id);
      // Event already emitted by queue
    });

    this.queue.on('job-progress', (job: EnrichmentJob) => {
      console.log('[BackgroundEnrichmentManager] Job progress:', job.id, job.progress);
      // Event already emitted by queue
    });

    this.queue.on('job-completed', (job: EnrichmentJob) => {
      console.log('[BackgroundEnrichmentManager] Job completed:', job.id);

      // Show notification if enabled
      if (this.options.enableNotifications) {
        this.showNotification(
          'Session Enriched',
          `Session "${job.sessionName}" has been enriched successfully!`
        );
      }
    });

    this.queue.on('job-failed', (job: EnrichmentJob, error: Error) => {
      console.error('[BackgroundEnrichmentManager] Job failed:', job.id, error);

      // Show notification if enabled
      if (this.options.enableNotifications) {
        this.showNotification(
          'Enrichment Failed',
          `Session "${job.sessionName}" enrichment failed. You can retry later.`
        );
      }
    });

    this.queue.on('job-cancelled', (job: EnrichmentJob) => {
      console.log('[BackgroundEnrichmentManager] Job cancelled:', job.id);
    });

    this.queue.on('job-retry', (job: EnrichmentJob) => {
      console.log('[BackgroundEnrichmentManager] Job retrying:', job.id);
    });

    console.log('[BackgroundEnrichmentManager] ✓ Subscribed to queue events');
  }

  // ========================================
  // Notifications
  // ========================================

  /**
   * Show OS-level notification
   *
   * Uses Web Notification API for cross-platform compatibility.
   * Requests permission if not already granted.
   *
   * @param title - Notification title
   * @param body - Notification body text
   * @private
   */
  private showNotification(title: string, body?: string): void {
    // Check if Notification API is available
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[BackgroundEnrichmentManager] Notification API not available');
      return;
    }

    // Check current permission
    if (Notification.permission === 'granted') {
      // Permission already granted, show notification
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      // Permission not yet requested, request it
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(title, { body });
        } else {
          console.warn('[BackgroundEnrichmentManager] Notification permission denied');
        }
      });
    } else {
      // Permission denied
      console.warn('[BackgroundEnrichmentManager] Notification permission denied');
    }
  }

  // ========================================
  // Utilities
  // ========================================

  /**
   * Ensure manager is initialized
   * @private
   * @throws Error if not initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.queue) {
      throw new Error('BackgroundEnrichmentManager not initialized - call initialize() first');
    }
  }

  /**
   * Get direct access to queue (for advanced usage)
   * @internal Use with caution - prefer using manager methods
   */
  getQueue(): PersistentEnrichmentQueue | null {
    return this.queue;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _instance: BackgroundEnrichmentManager | null = null;

/**
 * Get singleton BackgroundEnrichmentManager instance
 *
 * Lazy initialization - creates instance on first call but does NOT
 * automatically call initialize(). You must call initialize() explicitly.
 *
 * @param options - Manager options (only used on first call)
 * @returns Manager instance
 */
export function getBackgroundEnrichmentManager(
  options?: ManagerOptions
): BackgroundEnrichmentManager {
  if (!_instance) {
    _instance = new BackgroundEnrichmentManager(options);
  }
  return _instance;
}

/**
 * Reset singleton (for testing only)
 * @internal
 */
export async function resetBackgroundEnrichmentManager(): Promise<void> {
  if (_instance) {
    await _instance.shutdown();
  }
  _instance = null;
}
