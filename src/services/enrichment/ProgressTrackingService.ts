/**
 * ProgressTrackingService - Real-time Enrichment Progress Tracking (NO COST UI)
 *
 * Production-grade progress tracking service that provides real-time visibility
 * into enrichment progress WITHOUT showing cost information to users.
 *
 * Key Features:
 * - Real-time progress updates (<1s latency)
 * - Per-session and batch progress tracking
 * - Simple ETA calculation (time-based, NO cost)
 * - Event system for UI updates
 * - NO COST INFORMATION in user-facing data
 * - Clear, friendly progress messages
 *
 * Architecture:
 * 1. Progress Map: sessionId → EnrichmentProgress
 * 2. Event System: Real-time updates to listeners
 * 3. ETA Calculation: Time-based estimation (NO cost)
 * 4. Batch Tracking: Overall progress across multiple sessions
 * 5. Stage Tracking: Audio → Video → Summary → Canvas
 *
 * CRITICAL: NO Cost UI
 * - Progress messages: "Analyzing audio...", "Processing video..."
 * - NO messages like "Cost so far: $0.50"
 * - NO ETA based on cost: "5 more sessions = $2.00"
 * - Simple time-based ETA: "~5 minutes remaining"
 *
 * Usage:
 * ```typescript
 * import { getProgressTrackingService } from './ProgressTrackingService';
 *
 * const progressService = getProgressTrackingService();
 *
 * // Update progress (NO cost info)
 * progressService.updateProgress(sessionId, {
 *   stage: 'audio',
 *   progress: 50,
 *   message: 'Analyzing audio...',  // NO cost
 * });
 *
 * // Listen for updates
 * progressService.on('progress', (sessionId, progress) => {
 *   console.log(`${sessionId}: ${progress.message} (${progress.progress}%)`);
 * });
 *
 * // Get ETA (time-based, NO cost)
 * const eta = progressService.calculateETA(sessionId);
 * console.log(`~${Math.ceil(eta / 60000)} minutes remaining`);
 * ```
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.7 specification
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Enrichment stage
 */
export type EnrichmentStage = 'audio' | 'video' | 'summary' | 'canvas' | 'complete' | 'error';

/**
 * Stage status
 */
export type StageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

/**
 * Stage progress details
 */
export interface StageProgress {
  /** Current status */
  status: StageStatus;

  /** Progress percentage (0-100) */
  progress: number;

  /** Stage start time */
  startTime?: number;

  /** Stage completion time */
  completedAt?: number;

  /** Error message if failed */
  error?: string;
}

/**
 * Enrichment progress (NO COST INFO)
 */
export interface EnrichmentProgress {
  /** Session ID */
  sessionId: string;

  /** Current stage */
  stage: EnrichmentStage;

  /** Overall progress percentage (0-100) */
  progress: number;

  /** User-friendly message (NO COST) */
  message: string;

  /** Enrichment start time */
  startTime: number;

  /** Estimated completion time (milliseconds from now, NO COST) */
  estimatedCompletion?: number;

  /** Detailed stage progress */
  stages: {
    audio: StageProgress;
    video: StageProgress;
    summary: StageProgress;
    canvas: StageProgress;
  };

  /** Last update timestamp */
  lastUpdateAt: number;
}

/**
 * Batch progress summary (NO COST INFO)
 */
export interface BatchProgress {
  /** Total sessions in batch */
  total: number;

  /** Sessions pending */
  pending: number;

  /** Sessions currently processing */
  processing: number;

  /** Sessions completed */
  completed: number;

  /** Sessions failed */
  failed: number;

  /** Overall progress percentage (0-100) */
  progress: number;

  /** User-friendly message (NO COST) */
  message: string;

  /** Estimated time remaining (milliseconds, NO COST) */
  estimatedTimeRemaining?: number;

  /** Batch start time */
  startTime: number;
}

/**
 * Progress event types
 */
export type ProgressEvent = 'started' | 'progress' | 'stage' | 'completed' | 'failed' | 'batch-update';

/**
 * Event listener callback
 */
export type ProgressListener = (sessionId: string, progress: EnrichmentProgress) => void;
export type BatchProgressListener = (batch: BatchProgress) => void;

// ============================================================================
// Simple Event Emitter
// ============================================================================

class SimpleEventEmitter {
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((listener) => listener(...args));
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

// ============================================================================
// ProgressTrackingService Class
// ============================================================================

export class ProgressTrackingService extends SimpleEventEmitter {
  // Progress storage
  private progressMap = new Map<string, EnrichmentProgress>();

  // Batch tracking
  private batchSessions: Set<string> = new Set();
  private batchStartTime: number = 0;

  // Historical data for ETA calculation
  private historicalDurations: number[] = [];
  private maxHistoricalSamples = 50;

  constructor() {
    super();
    console.log('[ProgressTrackingService] Initialized');
  }

  // ========================================
  // Progress Management
  // ========================================

  /**
   * Start tracking progress for a session
   *
   * Creates initial progress entry with all stages pending.
   *
   * @param sessionId - Session ID
   * @param options - Initial options (which stages to include)
   */
  startProgress(
    sessionId: string,
    options: {
      includeAudio?: boolean;
      includeVideo?: boolean;
      includeSummary?: boolean;
      includeCanvas?: boolean;
    } = {}
  ): void {
    const progress: EnrichmentProgress = {
      sessionId,
      stage: 'audio',
      progress: 0,
      message: 'Starting enrichment...',
      startTime: Date.now(),
      stages: {
        audio: {
          status: options.includeAudio !== false ? 'pending' : 'skipped',
          progress: 0,
        },
        video: {
          status: options.includeVideo !== false ? 'pending' : 'skipped',
          progress: 0,
        },
        summary: {
          status: options.includeSummary !== false ? 'pending' : 'skipped',
          progress: 0,
        },
        canvas: {
          status: options.includeCanvas !== false ? 'pending' : 'skipped',
          progress: 0,
        },
      },
      lastUpdateAt: Date.now(),
    };

    this.progressMap.set(sessionId, progress);
    this.emit('started', sessionId, progress);

    console.log(`[ProgressTrackingService] Started tracking ${sessionId}`);
  }

  /**
   * Update progress for a session (NO COST INFO)
   *
   * @param sessionId - Session ID
   * @param update - Progress update (NO COST)
   */
  updateProgress(
    sessionId: string,
    update: Partial<EnrichmentProgress> & { stage?: EnrichmentStage; progress?: number; message?: string }
  ): void {
    const progress = this.progressMap.get(sessionId);
    if (!progress) {
      console.warn(`[ProgressTrackingService] No progress found for ${sessionId}`);
      return;
    }

    // Update progress
    const previousStage = progress.stage;
    Object.assign(progress, update, { lastUpdateAt: Date.now() });

    // Update stage if changed
    if (update.stage && update.stage !== previousStage) {
      // Mark previous stage as completed
      if (previousStage !== 'complete' && previousStage !== 'error') {
        this.updateStage(sessionId, previousStage, {
          status: 'completed',
          progress: 100,
          completedAt: Date.now(),
        });
      }

      // Mark new stage as processing
      if (update.stage !== 'complete' && update.stage !== 'error') {
        this.updateStage(sessionId, update.stage, {
          status: 'processing',
          progress: 0,
          startTime: Date.now(),
        });
      }

      this.emit('stage', sessionId, update.stage, progress);
    }

    // Calculate ETA
    const eta = this.calculateETA(sessionId);
    progress.estimatedCompletion = eta !== null ? eta : undefined;

    this.emit('progress', sessionId, progress);
  }

  /**
   * Update stage progress
   *
   * @param sessionId - Session ID
   * @param stage - Stage to update
   * @param update - Stage progress update
   */
  updateStage(sessionId: string, stage: EnrichmentStage, update: Partial<StageProgress>): void {
    const progress = this.progressMap.get(sessionId);
    if (!progress) {
      return;
    }

    if (stage === 'complete' || stage === 'error') {
      return; // Not a real stage
    }

    Object.assign(progress.stages[stage], update);
    progress.lastUpdateAt = Date.now();

    this.emit('progress', sessionId, progress);
  }

  /**
   * Complete progress tracking for a session
   *
   * Marks as complete and records duration for ETA calculation.
   *
   * @param sessionId - Session ID
   * @param success - Whether enrichment succeeded
   * @param message - Completion message (NO COST)
   */
  completeProgress(sessionId: string, success: boolean, message?: string): void {
    const progress = this.progressMap.get(sessionId);
    if (!progress) {
      return;
    }

    const duration = Date.now() - progress.startTime;

    // Record duration for ETA calculation
    if (success) {
      this.historicalDurations.push(duration);
      if (this.historicalDurations.length > this.maxHistoricalSamples) {
        this.historicalDurations.shift();
      }
    }

    // Update progress
    progress.stage = success ? 'complete' : 'error';
    progress.progress = success ? 100 : 0;
    progress.message = message || (success ? 'Enrichment complete!' : 'Enrichment failed');
    progress.lastUpdateAt = Date.now();

    if (success) {
      this.emit('completed', sessionId, progress);
    } else {
      this.emit('error', sessionId, progress);
    }

    console.log(`[ProgressTrackingService] ${success ? 'Completed' : 'Failed'} ${sessionId} (${duration}ms)`);

    // Update batch progress
    if (this.batchSessions.has(sessionId)) {
      this.updateBatchProgress();
    }
  }

  /**
   * Get progress for a session
   *
   * @param sessionId - Session ID
   * @returns Progress or null if not tracking
   */
  getProgress(sessionId: string): EnrichmentProgress | null {
    const progress = this.progressMap.get(sessionId);
    return progress ? { ...progress } : null;
  }

  /**
   * Get all progress entries
   *
   * @returns All progress entries
   */
  getAllProgress(): EnrichmentProgress[] {
    return Array.from(this.progressMap.values()).map((p) => ({ ...p }));
  }

  /**
   * Clear progress for a session
   *
   * @param sessionId - Session ID
   */
  clearProgress(sessionId: string): void {
    this.progressMap.delete(sessionId);
    this.batchSessions.delete(sessionId);
  }

  /**
   * Clear all progress
   */
  clearAllProgress(): void {
    this.progressMap.clear();
    this.batchSessions.clear();
    this.batchStartTime = 0;
  }

  // ========================================
  // Batch Progress Tracking
  // ========================================

  /**
   * Start batch progress tracking
   *
   * @param sessionIds - Session IDs in batch
   */
  startBatch(sessionIds: string[]): void {
    this.batchSessions = new Set(sessionIds);
    this.batchStartTime = Date.now();

    console.log(`[ProgressTrackingService] Started batch (${sessionIds.length} sessions)`);
  }

  /**
   * Get batch progress summary (NO COST INFO)
   *
   * @returns Batch progress summary
   */
  getBatchProgress(): BatchProgress | null {
    if (this.batchSessions.size === 0) {
      return null;
    }

    const sessions = Array.from(this.batchSessions)
      .map((id) => this.progressMap.get(id))
      .filter((p): p is EnrichmentProgress => p !== undefined);

    const total = this.batchSessions.size;
    const completed = sessions.filter((p) => p.stage === 'complete').length;
    const failed = sessions.filter((p) => p.stage === 'error').length;
    const processing = sessions.filter(
      (p) => p.stage !== 'complete' && p.stage !== 'error' && this.progressMap.has(p.sessionId)
    ).length;
    const pending = total - completed - failed - processing;

    const progress = total > 0 ? (completed / total) * 100 : 0;

    // Calculate ETA
    const batchETA = this.calculateBatchETA(sessions);
    const estimatedTimeRemaining = batchETA !== null ? batchETA : undefined;

    // Generate user-friendly message (NO COST)
    let message: string;
    if (completed === total) {
      message = `All ${total} sessions enriched successfully!`;
    } else if (processing > 0) {
      message = `Enriching ${processing} sessions...`;
    } else {
      message = `${completed}/${total} sessions complete`;
    }

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      progress,
      message,
      estimatedTimeRemaining,
      startTime: this.batchStartTime,
    };
  }

  // ========================================
  // ETA Calculation (Time-Based, NO COST)
  // ========================================

  /**
   * Calculate estimated time to completion (NO COST)
   *
   * Uses historical durations and current progress to estimate.
   *
   * @param sessionId - Session ID
   * @returns Estimated milliseconds remaining, or null if cannot estimate
   */
  calculateETA(sessionId: string): number | null {
    const progress = this.progressMap.get(sessionId);
    if (!progress) {
      return null;
    }

    // If complete or failed, no ETA
    if (progress.stage === 'complete' || progress.stage === 'error') {
      return 0;
    }

    // If no historical data, cannot estimate
    if (this.historicalDurations.length === 0) {
      return null;
    }

    // Calculate average duration
    const avgDuration = this.historicalDurations.reduce((sum, d) => sum + d, 0) / this.historicalDurations.length;

    // Calculate elapsed time
    const elapsed = Date.now() - progress.startTime;

    // Calculate progress ratio (0-1)
    const progressRatio = progress.progress / 100;

    // Estimate total time based on current progress
    if (progressRatio > 0) {
      const estimatedTotal = elapsed / progressRatio;
      const remaining = estimatedTotal - elapsed;
      return Math.max(0, remaining);
    }

    // Fallback to average duration
    return Math.max(0, avgDuration - elapsed);
  }

  /**
   * Calculate batch ETA (NO COST)
   *
   * @param sessions - Sessions in batch
   * @returns Estimated milliseconds remaining
   */
  private calculateBatchETA(sessions: EnrichmentProgress[]): number | null {
    if (sessions.length === 0 || this.historicalDurations.length === 0) {
      return null;
    }

    const avgDuration = this.historicalDurations.reduce((sum, d) => sum + d, 0) / this.historicalDurations.length;

    const activeOrPending = sessions.filter((s) => s.stage !== 'complete' && s.stage !== 'error');

    if (activeOrPending.length === 0) {
      return 0;
    }

    // Estimate based on average duration per session
    const estimatedRemaining = activeOrPending.reduce((sum, session) => {
      const sessionETA = this.calculateETA(session.sessionId);
      return sum + (sessionETA || avgDuration);
    }, 0);

    return estimatedRemaining;
  }

  // ========================================
  // Batch Progress Updates
  // ========================================

  /**
   * Update batch progress and emit event
   * @private
   */
  private updateBatchProgress(): void {
    const batchProgress = this.getBatchProgress();
    if (batchProgress) {
      this.emit('batch-update', batchProgress);
    }
  }

  // ========================================
  // Cleanup
  // ========================================

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.clearAllProgress();
    this.removeAllListeners();
    this.historicalDurations = [];
    console.log('[ProgressTrackingService] Shutdown complete');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _instance: ProgressTrackingService | null = null;

/**
 * Get singleton ProgressTrackingService instance
 */
export function getProgressTrackingService(): ProgressTrackingService {
  if (!_instance) {
    _instance = new ProgressTrackingService();
  }
  return _instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetProgressTrackingService(): void {
  if (_instance) {
    _instance.shutdown();
  }
  _instance = null;
}
