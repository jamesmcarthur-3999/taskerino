/**
 * PersistenceQueue - Background persistence queue with priority and retry
 *
 * Replaces debounced saves with a proper background persistence mechanism.
 * Provides priority-based queuing (critical/normal/low) with automatic retry
 * and exponential backoff.
 *
 * @example
 * ```typescript
 * import { getPersistenceQueue } from './PersistenceQueue';
 *
 * const queue = getPersistenceQueue();
 *
 * // Enqueue critical update (immediate)
 * queue.enqueue('sessions', sessionData, 'critical');
 *
 * // Enqueue normal update (batched 100ms)
 * queue.enqueue('sessions', sessionData, 'normal');
 *
 * // Get statistics
 * const stats = queue.getStats();
 * ```
 */

import { getStorage } from './index';

/**
 * Simple browser-compatible EventEmitter implementation
 */
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
      eventListeners.forEach(listener => listener(...args));
    }
  }
}

export type QueuePriority = 'critical' | 'normal' | 'low';

export interface QueueItem {
  id: string;
  priority: QueuePriority;
  key: string;
  value: unknown;
  retries: number;
  timestamp: number;
  error?: string;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  byPriority: {
    critical: number;
    normal: number;
    low: number;
  };
}

const MAX_RETRIES: Record<QueuePriority, number> = {
  critical: 1,
  normal: 3,
  low: 5,
};

const BATCH_DELAY_MS = 100;
const MAX_QUEUE_SIZE = 1000;

export class PersistenceQueue extends SimpleEventEmitter {
  private criticalQueue: QueueItem[] = [];
  private normalQueue: QueueItem[] = [];
  private lowQueue: QueueItem[] = [];

  private processing = false;
  private normalBatchTimer: NodeJS.Timeout | null = null;
  private idleCallbackId: number | null = null;

  private stats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  constructor() {
    super();
    this.startProcessing();
  }

  /**
   * Enqueue an item for persistence
   */
  enqueue(key: string, value: unknown, priority: QueuePriority = 'normal'): string {
    const id = crypto.randomUUID();
    const item: QueueItem = {
      id,
      priority,
      key,
      value,
      retries: 0,
      timestamp: Date.now(),
    };

    // Add to appropriate queue
    switch (priority) {
      case 'critical':
        this.criticalQueue.push(item);
        this.processCriticalImmediate();
        break;
      case 'normal':
        this.normalQueue.push(item);
        this.scheduleNormalBatch();
        break;
      case 'low':
        this.lowQueue.push(item);
        this.scheduleLowIdle();
        break;
    }

    this.stats.pending++;
    this.enforceQueueSizeLimit();
    this.emit('enqueued', item);

    return id;
  }

  /**
   * Process critical items immediately (don't wait)
   */
  private async processCriticalImmediate() {
    if (this.criticalQueue.length === 0) return;

    const item = this.criticalQueue.shift()!;
    await this.processItem(item);
  }

  /**
   * Batch process normal items every 100ms
   */
  private scheduleNormalBatch() {
    if (this.normalBatchTimer) return;

    this.normalBatchTimer = setTimeout(() => {
      this.normalBatchTimer = null;
      this.processNormalBatch();
    }, BATCH_DELAY_MS);
  }

  private async processNormalBatch() {
    if (this.normalQueue.length === 0) return;

    // Process all pending normal items
    const items = [...this.normalQueue];
    this.normalQueue = [];

    for (const item of items) {
      await this.processItem(item);
    }
  }

  /**
   * Process low priority items during idle time
   */
  private scheduleLowIdle() {
    if (this.idleCallbackId) return;

    // Use requestIdleCallback if available (browser)
    if (typeof requestIdleCallback !== 'undefined') {
      this.idleCallbackId = requestIdleCallback(() => {
        this.idleCallbackId = null;
        this.processLowBatch();
      });
    } else {
      // Fallback for Node/Tauri: use setTimeout
      this.idleCallbackId = setTimeout(() => {
        this.idleCallbackId = null;
        this.processLowBatch();
      }, 500) as unknown as number;
    }
  }

  private async processLowBatch() {
    if (this.lowQueue.length === 0) return;

    // Process up to 10 low priority items
    const items = this.lowQueue.splice(0, 10);

    for (const item of items) {
      await this.processItem(item);
    }

    // Schedule next batch if more items remain
    if (this.lowQueue.length > 0) {
      this.scheduleLowIdle();
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem) {
    this.stats.processing++;
    this.emit('processing', item);

    try {
      const storage = await getStorage();
      await storage.save(item.key, item.value);

      this.stats.processing--;
      this.stats.pending--;
      this.stats.completed++;
      this.emit('completed', item);
    } catch (error) {
      this.stats.processing--;
      this.handleError(item, error);
    }
  }

  /**
   * Handle processing error with retry
   */
  private handleError(item: QueueItem, error: unknown) {
    item.retries++;
    item.error = String(error);

    const maxRetries = MAX_RETRIES[item.priority];

    if (item.retries < maxRetries) {
      // Exponential backoff
      const delay = Math.pow(2, item.retries) * 100;

      setTimeout(() => {
        // Re-enqueue at same priority
        switch (item.priority) {
          case 'critical':
            this.criticalQueue.push(item);
            this.processCriticalImmediate();
            break;
          case 'normal':
            this.normalQueue.push(item);
            this.scheduleNormalBatch();
            break;
          case 'low':
            this.lowQueue.push(item);
            this.scheduleLowIdle();
            break;
        }
      }, delay);

      this.emit('retry', item);
    } else {
      // Max retries exceeded
      this.stats.pending--;
      this.stats.failed++;
      this.emit('failed', item);
      console.error(`[PersistenceQueue] Failed to persist ${item.key} after ${item.retries} retries:`, error);
    }
  }

  /**
   * Enforce queue size limit (drop oldest LOW priority items)
   */
  private enforceQueueSizeLimit() {
    const totalSize = this.criticalQueue.length + this.normalQueue.length + this.lowQueue.length;

    if (totalSize > MAX_QUEUE_SIZE) {
      const excess = totalSize - MAX_QUEUE_SIZE;
      const dropped = this.lowQueue.splice(0, excess);

      for (const item of dropped) {
        this.stats.pending--;
        this.stats.failed++;
        this.emit('dropped', item);
      }

      console.warn(`[PersistenceQueue] Dropped ${excess} low-priority items due to queue size limit`);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return {
      ...this.stats,
      byPriority: {
        critical: this.criticalQueue.length,
        normal: this.normalQueue.length,
        low: this.lowQueue.length,
      },
    };
  }

  /**
   * Flush all pending items (wait for completion)
   */
  async flush(): Promise<void> {
    // Collect all items
    const allItems = [
      ...this.criticalQueue,
      ...this.normalQueue,
      ...this.lowQueue,
    ];

    // Clear queues before processing
    this.criticalQueue = [];
    this.normalQueue = [];
    this.lowQueue = [];

    // Process all items
    await Promise.all(allItems.map(item => this.processItem(item)));
  }

  /**
   * Clear all queues (discard pending items)
   */
  clear() {
    this.criticalQueue = [];
    this.normalQueue = [];
    this.lowQueue = [];
    this.stats.pending = 0;
  }

  /**
   * Start background processing
   */
  private startProcessing() {
    // Processing happens on-demand via schedule methods
    // No continuous polling needed
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    // Cancel pending timers
    if (this.normalBatchTimer) {
      clearTimeout(this.normalBatchTimer);
    }
    if (this.idleCallbackId) {
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(this.idleCallbackId);
      } else {
        clearTimeout(this.idleCallbackId as unknown as NodeJS.Timeout);
      }
    }

    // Flush remaining items
    await this.flush();
  }
}

// Singleton instance
let queueInstance: PersistenceQueue | null = null;

/**
 * Get the singleton PersistenceQueue instance
 */
export function getPersistenceQueue(): PersistenceQueue {
  if (!queueInstance) {
    queueInstance = new PersistenceQueue();
  }
  return queueInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetPersistenceQueue(): void {
  if (queueInstance) {
    queueInstance.removeAllListeners();
  }
  queueInstance = null;
}
