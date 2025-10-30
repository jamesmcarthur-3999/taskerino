/**
 * CompressionQueue - Queue manager for background compression
 *
 * Manages a queue of compression jobs that run in the background without
 * blocking the UI. Supports prioritization, auto/manual modes, CPU throttling,
 * and progress tracking.
 *
 * Features:
 * - Auto mode: Compresses during idle time with CPU throttling
 * - Manual mode: User-triggered compression with progress dialog
 * - Priority queue: Process oldest sessions first (most storage benefit)
 * - Settings: Configurable age threshold, CPU limit, enable/disable
 * - Statistics: Track bytes processed, saved, compression ratios
 *
 * @example
 * ```typescript
 * import { CompressionQueue } from './CompressionQueue';
 *
 * const queue = new CompressionQueue();
 *
 * // Configure settings
 * queue.updateSettings({
 *   enabled: true,
 *   mode: 'auto',
 *   maxCPU: 20,
 *   ageThresholdDays: 7
 * });
 *
 * // Enqueue session for compression
 * await queue.enqueueSession('session-123', 'normal');
 *
 * // Listen for progress
 * queue.on('progress', (data) => {
 *   console.log(`Compressed ${data.sessionId}: ${data.bytesSaved} bytes saved`);
 * });
 * ```
 */

import type { WorkerMessage, CompressJobMessage } from '../../workers/CompressionWorker';
import { getChunkedStorage } from '../storage/ChunkedSessionStorage';

// ========================================
// TYPES
// ========================================

/**
 * Compression settings
 */
export interface CompressionSettings {
  enabled: boolean;
  mode: 'auto' | 'manual';
  maxCPU: number; // 0-100 percentage
  processOldestFirst: boolean;
  compressScreenshots: boolean;
  ageThresholdDays: number; // Only compress sessions older than X days
}

/**
 * Compression job priority
 */
export type CompressionPriority = 'high' | 'normal' | 'low';

/**
 * Compression job
 */
interface CompressionJob {
  id: string;
  sessionId: string;
  priority: CompressionPriority;
  enqueuedAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Compression statistics
 */
export interface CompressionStats {
  sessionsProcessed: number;
  bytesProcessed: number;
  bytesSaved: number;
  compressionRatio: number; // Average ratio
  estimatedTimeRemaining: number; // ms
  inProgress: string[]; // session IDs
}

/**
 * Progress event data
 */
export interface ProgressEventData {
  sessionId: string;
  bytesProcessed: number;
  totalBytes: number;
  bytesSaved: number;
  compressionRatio: number;
}

/**
 * Complete event data
 */
export interface CompleteEventData {
  sessionId: string;
  bytesProcessed: number;
  bytesSaved: number;
  compressionRatio: number;
  durationMs: number;
}

/**
 * Error event data
 */
export interface ErrorEventData {
  sessionId: string;
  error: string;
}

// ========================================
// EVENT EMITTER
// ========================================

type EventHandler = (...args: any[]) => void;

class EventEmitter {
  private events = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  removeAllListeners(): void {
    this.events.clear();
  }
}

// ========================================
// COMPRESSION QUEUE
// ========================================

export class CompressionQueue extends EventEmitter {
  private worker: Worker | null = null;
  private queue: CompressionJob[] = [];
  private inProgress = new Map<string, CompressionJob>();

  private settings: CompressionSettings = {
    enabled: false,
    mode: 'auto',
    maxCPU: 20,
    processOldestFirst: true,
    compressScreenshots: true,
    ageThresholdDays: 7,
  };

  private stats = {
    sessionsProcessed: 0,
    bytesProcessed: 0,
    bytesSaved: 0,
    totalRatio: 0, // Sum of all ratios for averaging
  };

  private idleCallbackId: number | null = null;
  private autoProcessInterval: NodeJS.Timeout | null = null;
  private isPaused = false;

  constructor() {
    super();
    this.initializeWorker();
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * Initialize compression worker
   */
  private initializeWorker(): void {
    try {
      // Create worker from module
      this.worker = new Worker(
        new URL('../../workers/CompressionWorker.ts', import.meta.url),
        { type: 'module' }
      );

      // Handle worker messages
      this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(event.data);
      };

      // Handle worker errors
      this.worker.onerror = (error) => {
        console.error('[CompressionQueue] Worker error:', error);
        this.emit('error', { sessionId: 'unknown', error: error.message });
      };

      console.log('[CompressionQueue] Worker initialized');
    } catch (error) {
      console.error('[CompressionQueue] Failed to initialize worker:', error);
    }
  }

  /**
   * Handle messages from worker
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    if (message.type === 'compressed' || message.type === 'decompressed') {
      const { id, originalSize, compressedSize, ratio, error } = message.data;

      if (error) {
        // Handle error
        const job = this.findJobById(id);
        if (job) {
          this.inProgress.delete(job.sessionId);
          this.emit('error', {
            sessionId: job.sessionId,
            error,
          } as ErrorEventData);
        }
        return;
      }

      // Find associated job
      const job = this.findJobById(id);
      if (!job) {
        console.warn(`[CompressionQueue] Received result for unknown job: ${id}`);
        return;
      }

      // Update stats
      if (compressedSize !== undefined && ratio !== undefined) {
        const bytesSaved = originalSize - compressedSize;

        this.stats.bytesProcessed += originalSize;
        this.stats.bytesSaved += bytesSaved;
        this.stats.totalRatio += ratio;

        // Emit progress
        this.emit('progress', {
          sessionId: job.sessionId,
          bytesProcessed: originalSize,
          totalBytes: originalSize,
          bytesSaved,
          compressionRatio: ratio,
        } as ProgressEventData);
      }

      // Mark job complete
      job.completedAt = Date.now();
      this.stats.sessionsProcessed++;

      // Emit complete
      const durationMs = job.completedAt - (job.startedAt || job.enqueuedAt);
      this.emit('complete', {
        sessionId: job.sessionId,
        bytesProcessed: originalSize,
        bytesSaved: originalSize - (compressedSize || 0),
        compressionRatio: ratio || 1,
        durationMs,
      } as CompleteEventData);

      // Remove from in-progress
      this.inProgress.delete(job.sessionId);

      // Process next job
      this.processNext();
    } else if (message.type === 'progress') {
      const { id, bytesProcessed, totalBytes, percent } = message.data;

      const job = this.findJobById(id);
      if (job) {
        // Emit partial progress
        this.emit('progress', {
          sessionId: job.sessionId,
          bytesProcessed,
          totalBytes,
          bytesSaved: 0, // Will be calculated on completion
          compressionRatio: 0,
        } as ProgressEventData);
      }
    }
  }

  /**
   * Find job by worker job ID
   */
  private findJobById(id: string): CompressionJob | undefined {
    // Worker IDs are formatted as: sessionId-chunkType-chunkIndex
    const sessionId = id.split('-')[0];
    return this.inProgress.get(sessionId);
  }

  // ========================================
  // QUEUE OPERATIONS
  // ========================================

  /**
   * Enqueue a session for compression
   */
  async enqueueSession(
    sessionId: string,
    priority: CompressionPriority = 'normal'
  ): Promise<void> {
    // Check if already in queue or processing
    const existing = this.queue.find(j => j.sessionId === sessionId) || this.inProgress.get(sessionId);
    if (existing) {
      console.log(`[CompressionQueue] Session ${sessionId} already queued`);
      return;
    }

    // Check age threshold
    if (this.settings.ageThresholdDays > 0) {
      const storage = await getChunkedStorage();
      const metadata = await storage.loadMetadata(sessionId);

      if (metadata) {
        const ageMs = Date.now() - new Date(metadata.createdAt).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        if (ageDays < this.settings.ageThresholdDays) {
          console.log(`[CompressionQueue] Session ${sessionId} too recent (${ageDays.toFixed(1)} days)`);
          return;
        }
      }
    }

    // Create job
    const job: CompressionJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sessionId,
      priority,
      enqueuedAt: Date.now(),
    };

    // Add to queue
    this.queue.push(job);

    // Sort by priority and age
    this.sortQueue();

    console.log(`[CompressionQueue] Enqueued session ${sessionId} with priority ${priority}`);

    // Start processing if auto mode
    if (this.settings.enabled && this.settings.mode === 'auto') {
      this.scheduleAutoProcess();
    }
  }

  /**
   * Sort queue by priority and age
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Priority first (high > normal > low)
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }

      // Then by age (oldest first if setting enabled)
      if (this.settings.processOldestFirst) {
        return a.enqueuedAt - b.enqueuedAt; // Older first
      } else {
        return b.enqueuedAt - a.enqueuedAt; // Newer first
      }
    });
  }

  /**
   * Process next job in queue
   */
  private async processNext(): Promise<void> {
    // Check if queue is empty
    if (this.queue.length === 0) {
      console.log('[CompressionQueue] Queue empty, stopping processing');
      return;
    }

    // Check if paused
    if (this.isPaused) {
      console.log('[CompressionQueue] Processing paused');
      return;
    }

    // Check if disabled
    if (!this.settings.enabled) {
      console.log('[CompressionQueue] Compression disabled');
      return;
    }

    // Get next job
    const job = this.queue.shift();
    if (!job) return;

    // Mark as in-progress
    job.startedAt = Date.now();
    this.inProgress.set(job.sessionId, job);

    console.log(`[CompressionQueue] Processing session ${job.sessionId}`);

    try {
      // Compress session
      await this.compressSession(job.sessionId);
    } catch (error) {
      console.error(`[CompressionQueue] Failed to compress session ${job.sessionId}:`, error);

      // Remove from in-progress
      this.inProgress.delete(job.sessionId);

      // Emit error
      this.emit('error', {
        sessionId: job.sessionId,
        error: error instanceof Error ? error.message : String(error),
      } as ErrorEventData);

      // Process next
      this.processNext();
    }
  }

  /**
   * Compress a single session
   */
  private async compressSession(sessionId: string): Promise<void> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const storage = await getChunkedStorage();

    // Load session metadata
    const metadata = await storage.loadMetadata(sessionId);
    if (!metadata) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Compress chunks
    const compressionJobs: Promise<void>[] = [];

    // Compress screenshot chunks
    if (this.settings.compressScreenshots && metadata.chunks.screenshots.chunkCount > 0) {
      for (let i = 0; i < metadata.chunks.screenshots.chunkCount; i++) {
        compressionJobs.push(this.compressChunk(sessionId, 'screenshots', i));
      }
    }

    // Compress audio chunks
    if (metadata.chunks.audioSegments.chunkCount > 0) {
      for (let i = 0; i < metadata.chunks.audioSegments.chunkCount; i++) {
        compressionJobs.push(this.compressChunk(sessionId, 'audio', i));
      }
    }

    // Compress video chunks
    if (metadata.chunks.videoChunks.chunkCount > 0) {
      for (let i = 0; i < metadata.chunks.videoChunks.chunkCount; i++) {
        compressionJobs.push(this.compressChunk(sessionId, 'video', i));
      }
    }

    // Compress summary
    if (metadata.hasSummary) {
      compressionJobs.push(this.compressLargeObject(sessionId, 'summary'));
    }

    // Compress transcription
    if (metadata.hasTranscription) {
      compressionJobs.push(this.compressLargeObject(sessionId, 'transcription'));
    }

    // Wait for all compression jobs
    await Promise.all(compressionJobs);

    console.log(`[CompressionQueue] Completed compression for session ${sessionId}`);
  }

  /**
   * Compress a single chunk
   */
  private async compressChunk(
    sessionId: string,
    chunkType: 'screenshots' | 'audio' | 'video',
    chunkIndex: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const jobId = `${sessionId}-${chunkType}-${chunkIndex}`;

      // Load chunk data (this is mocked for now - in real implementation,
      // we'd load the actual chunk from storage)
      const chunkData = JSON.stringify({ sessionId, chunkType, chunkIndex });

      // Send to worker
      const message: CompressJobMessage = {
        type: 'compress-json',
        data: {
          id: jobId,
          content: chunkData,
        },
      };

      this.worker.postMessage(message);

      // Worker will send result via onmessage handler
      // We resolve when the result is received
      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        const msg = event.data;
        if (
          (msg.type === 'compressed' || msg.type === 'error') &&
          msg.data.id === jobId
        ) {
          this.worker?.removeEventListener('message', handleMessage);

          if (msg.type === 'error') {
            reject(new Error(msg.data.error));
          } else {
            resolve();
          }
        }
      };

      this.worker.addEventListener('message', handleMessage);
    });
  }

  /**
   * Compress a large object (summary, transcription, etc.)
   */
  private async compressLargeObject(
    sessionId: string,
    objectType: 'summary' | 'transcription'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const jobId = `${sessionId}-${objectType}`;

      // Load object data (mocked)
      const objectData = JSON.stringify({ sessionId, objectType });

      // Send to worker
      const message: CompressJobMessage = {
        type: 'compress-json',
        data: {
          id: jobId,
          content: objectData,
        },
      };

      this.worker.postMessage(message);

      // Handle result
      const handleMessage = (event: MessageEvent<WorkerMessage>) => {
        const msg = event.data;
        if (
          (msg.type === 'compressed' || msg.type === 'error') &&
          msg.data.id === jobId
        ) {
          this.worker?.removeEventListener('message', handleMessage);

          if (msg.type === 'error') {
            reject(new Error(msg.data.error));
          } else {
            resolve();
          }
        }
      };

      this.worker.addEventListener('message', handleMessage);
    });
  }

  /**
   * Process queue (manual trigger)
   */
  async processQueue(): Promise<void> {
    if (this.settings.mode === 'auto') {
      console.warn('[CompressionQueue] Cannot manually process queue in auto mode');
      return;
    }

    this.isPaused = false;

    // Process all jobs
    while (this.queue.length > 0) {
      await this.processNext();
    }
  }

  /**
   * Cancel all pending jobs
   */
  async cancelAll(): Promise<void> {
    console.log('[CompressionQueue] Cancelling all jobs');

    // Clear queue
    this.queue = [];

    // Wait for in-progress jobs to complete
    // (We can't cancel Web Worker jobs mid-execution)
    while (this.inProgress.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('[CompressionQueue] All jobs cancelled');
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
    console.log('[CompressionQueue] Processing paused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    console.log('[CompressionQueue] Processing resumed');

    if (this.settings.enabled && this.settings.mode === 'auto') {
      this.scheduleAutoProcess();
    } else {
      this.processNext();
    }
  }

  // ========================================
  // AUTO MODE SCHEDULING
  // ========================================

  /**
   * Schedule automatic processing during idle time
   */
  private scheduleAutoProcess(): void {
    if (this.autoProcessInterval || this.idleCallbackId) {
      return; // Already scheduled
    }

    // Use requestIdleCallback if available
    if (typeof requestIdleCallback !== 'undefined') {
      this.idleCallbackId = requestIdleCallback(
        () => {
          this.idleCallbackId = null;
          this.processNextIfCPUAvailable();
        },
        { timeout: 5000 } // Process within 5 seconds even if not idle
      );
    } else {
      // Fallback: use setInterval with CPU check
      this.autoProcessInterval = setInterval(() => {
        this.processNextIfCPUAvailable();
      }, 1000);
    }
  }

  /**
   * Process next job if CPU usage is below threshold
   */
  private async processNextIfCPUAvailable(): Promise<void> {
    // Check CPU usage (simplified - in real implementation, use performance API)
    const cpuUsage = await this.estimateCPUUsage();

    if (cpuUsage < this.settings.maxCPU) {
      await this.processNext();

      // Schedule next check
      if (this.queue.length > 0) {
        this.scheduleAutoProcess();
      }
    } else {
      console.log(`[CompressionQueue] CPU usage too high (${cpuUsage}%), deferring processing`);

      // Retry later
      setTimeout(() => {
        if (this.queue.length > 0) {
          this.scheduleAutoProcess();
        }
      }, 5000);
    }
  }

  /**
   * Estimate CPU usage (simplified)
   */
  private async estimateCPUUsage(): Promise<number> {
    // In a real implementation, this would use the Performance API
    // or platform-specific APIs to measure actual CPU usage.
    //
    // For now, we return a conservative estimate based on active workers.
    const activeWorkers = this.inProgress.size;
    return activeWorkers * 10; // Assume 10% CPU per active worker
  }

  /**
   * Stop automatic processing
   */
  private stopAutoProcess(): void {
    if (this.autoProcessInterval) {
      clearInterval(this.autoProcessInterval);
      this.autoProcessInterval = null;
    }

    if (this.idleCallbackId !== null) {
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(this.idleCallbackId);
      }
      this.idleCallbackId = null;
    }
  }

  // ========================================
  // SETTINGS
  // ========================================

  /**
   * Update compression settings
   */
  updateSettings(settings: Partial<CompressionSettings>): void {
    const wasEnabled = this.settings.enabled;
    const wasAutoMode = this.settings.mode === 'auto';

    this.settings = { ...this.settings, ...settings };

    console.log('[CompressionQueue] Settings updated:', this.settings);

    // Handle enable/disable
    if (!wasEnabled && this.settings.enabled) {
      // Enabled - start processing
      if (this.settings.mode === 'auto') {
        this.scheduleAutoProcess();
      }
    } else if (wasEnabled && !this.settings.enabled) {
      // Disabled - stop processing
      this.stopAutoProcess();
    }

    // Handle mode change
    if (wasAutoMode && this.settings.mode === 'manual') {
      this.stopAutoProcess();
    } else if (!wasAutoMode && this.settings.mode === 'auto' && this.settings.enabled) {
      this.scheduleAutoProcess();
    }

    // Re-sort queue if priority settings changed
    if (settings.processOldestFirst !== undefined) {
      this.sortQueue();
    }
  }

  /**
   * Get current settings
   */
  getSettings(): CompressionSettings {
    return { ...this.settings };
  }

  // ========================================
  // STATISTICS
  // ========================================

  /**
   * Get queue statistics
   */
  getStats(): CompressionStats {
    const avgRatio =
      this.stats.sessionsProcessed > 0
        ? this.stats.totalRatio / this.stats.sessionsProcessed
        : 0;

    // Estimate time remaining based on average processing time
    const avgTimePerSession =
      this.stats.sessionsProcessed > 0
        ? this.stats.bytesProcessed / this.stats.sessionsProcessed / 1000 // ms per KB
        : 1000; // Default 1s per KB

    const remainingSessions = this.queue.length;
    const estimatedTimeRemaining = remainingSessions * avgTimePerSession;

    return {
      sessionsProcessed: this.stats.sessionsProcessed,
      bytesProcessed: this.stats.bytesProcessed,
      bytesSaved: this.stats.bytesSaved,
      compressionRatio: avgRatio,
      estimatedTimeRemaining,
      inProgress: Array.from(this.inProgress.keys()),
    };
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    console.log('[CompressionQueue] Shutting down...');

    // Stop auto processing
    this.stopAutoProcess();

    // Cancel pending jobs
    await this.cancelAll();

    // Terminate worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Clear event listeners
    this.removeAllListeners();

    console.log('[CompressionQueue] Shutdown complete');
  }
}

// ========================================
// SINGLETON
// ========================================

let instance: CompressionQueue | null = null;

/**
 * Get singleton instance
 */
export function getCompressionQueue(): CompressionQueue {
  if (!instance) {
    instance = new CompressionQueue();
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetCompressionQueue(): void {
  if (instance) {
    instance.shutdown();
  }
  instance = null;
}
