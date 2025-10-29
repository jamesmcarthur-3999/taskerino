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

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

export type QueuePriority = 'critical' | 'normal' | 'low';
export type QueueItemType = 'simple' | 'chunk' | 'index' | 'ca-storage' | 'cleanup';

export interface QueueItem {
  id: string;
  priority: QueuePriority;
  key: string;
  value: unknown;
  retries: number;
  timestamp: number;
  error?: string;
  // Enhanced fields for Phase 4
  type: QueueItemType;
  batchable?: boolean;
  sessionId?: string;
  metadata?: Record<string, unknown>;
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
  // Enhanced stats for Phase 4
  byType?: {
    simple: number;
    chunk: number;
    index: number;
    caStorage: number;
    cleanup: number;
  };
  batching?: {
    chunksCollapsed: number;
    indexesCollapsed: number;
    caStorageCollapsed: number;
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

  // Enhanced stats for Phase 4
  private enhancedStats = {
    byType: {
      simple: 0,
      chunk: 0,
      index: 0,
      caStorage: 0,
      cleanup: 0,
    },
    batching: {
      chunksCollapsed: 0,
      indexesCollapsed: 0,
      caStorageCollapsed: 0,
    },
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
      type: 'simple',
      batchable: false,
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
   * Enqueue chunk write (batchable)
   */
  enqueueChunk(sessionId: string, chunkName: string, data: unknown, priority: QueuePriority = 'normal'): string {
    const id = crypto.randomUUID();
    const item: QueueItem = {
      id,
      priority,
      key: `sessions/${sessionId}/${chunkName}`,
      value: data,
      retries: 0,
      timestamp: Date.now(),
      type: 'chunk',
      batchable: true,
      sessionId,
      metadata: { chunkName },
    };

    this.addToQueue(item);
    this.enhancedStats.byType.chunk++;
    return id;
  }

  /**
   * Enqueue index update (batchable)
   */
  enqueueIndex(indexName: string, updates: unknown, priority: QueuePriority = 'low'): string {
    const id = crypto.randomUUID();
    const item: QueueItem = {
      id,
      priority,
      key: `indexes/${indexName}`,
      value: updates,
      retries: 0,
      timestamp: Date.now(),
      type: 'index',
      batchable: true,
      metadata: { indexName },
    };

    this.addToQueue(item);
    this.enhancedStats.byType.index++;
    return id;
  }

  /**
   * Enqueue CA storage operation (batchable)
   */
  enqueueCAStorage(hash: string, attachment: unknown, priority: QueuePriority = 'normal'): string {
    const id = crypto.randomUUID();
    const item: QueueItem = {
      id,
      priority,
      key: `attachments-ca/${hash}`,
      value: attachment,
      retries: 0,
      timestamp: Date.now(),
      type: 'ca-storage',
      batchable: true,
      metadata: { hash },
    };

    this.addToQueue(item);
    this.enhancedStats.byType.caStorage++;
    return id;
  }

  /**
   * Enqueue cleanup operation (GC, index optimization)
   */
  enqueueCleanup(operation: 'gc' | 'index-optimize', priority: QueuePriority = 'low'): string {
    const id = crypto.randomUUID();
    const item: QueueItem = {
      id,
      priority,
      key: `cleanup/${operation}`,
      value: { operation, timestamp: Date.now() },
      retries: 0,
      timestamp: Date.now(),
      type: 'cleanup',
      batchable: false,
      metadata: { operation },
    };

    this.addToQueue(item);
    this.enhancedStats.byType.cleanup++;
    return id;
  }

  /**
   * Helper to add item to appropriate queue (DRY extraction)
   */
  private addToQueue(item: QueueItem): void {
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

    this.stats.pending++;
    this.enforceQueueSizeLimit();
    this.emit('enqueued', item);
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

    // Group batchable items by type
    const chunkItems = items.filter(i => i.type === 'chunk' && i.batchable);
    const indexItems = items.filter(i => i.type === 'index' && i.batchable);
    const caStorageItems = items.filter(i => i.type === 'ca-storage' && i.batchable);
    const nonBatchable = items.filter(i => !i.batchable);

    // Process batched items
    if (chunkItems.length > 0) {
      await this.processBatchedChunks(chunkItems);
    }

    if (indexItems.length > 0) {
      await this.processBatchedIndexes(indexItems);
    }

    if (caStorageItems.length > 0) {
      await this.processBatchedCAStorage(caStorageItems);
    }

    // Process non-batchable items individually
    for (const item of nonBatchable) {
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
   * Process batched chunk writes using a single transaction
   */
  private async processBatchedChunks(items: QueueItem[]): Promise<void> {
    if (items.length === 0) return;

    // Group chunks by sessionId for batching
    const bySession = new Map<string, QueueItem[]>();
    for (const item of items) {
      if (!item.sessionId) continue;
      if (!bySession.has(item.sessionId)) {
        bySession.set(item.sessionId, []);
      }
      bySession.get(item.sessionId)!.push(item);
    }

    // Process each session's chunks as a transaction
    for (const [sessionId, chunks] of bySession.entries()) {
      try {
        const storage = await getStorage();
        const tx = await storage.beginTransaction();

        try {
          // Save all chunks in transaction
          for (const chunk of chunks) {
            tx.save(chunk.key, chunk.value);
          }

          // Commit transaction
          await tx.commit();

          // Mark all chunks as completed
          for (const chunk of chunks) {
            this.stats.processing--;
            this.stats.pending--;
            this.stats.completed++;
            this.emit('completed', chunk);
          }

          // Track batching efficiency
          if (chunks.length > 1) {
            this.enhancedStats.batching.chunksCollapsed += (chunks.length - 1);
          }

          console.log(`[PersistenceQueue] Batched ${chunks.length} chunks for session ${sessionId}`);
        } catch (error) {
          await tx.rollback();
          // Handle errors individually
          for (const chunk of chunks) {
            this.stats.processing--;
            this.handleError(chunk, error);
          }
        }
      } catch (error) {
        // Transaction creation failed, process individually
        for (const chunk of chunks) {
          await this.processItem(chunk);
        }
      }
    }
  }

  /**
   * Process batched index updates by rebuilding all indexes once
   */
  private async processBatchedIndexes(items: QueueItem[]): Promise<void> {
    if (items.length === 0) return;

    try {
      // For now, just save each index individually
      // In the future, this could be optimized to rebuild all indexes once
      // using InvertedIndexManager.updateIndexes()

      const storage = await getStorage();

      for (const item of items) {
        this.stats.processing++;
        this.emit('processing', item);

        try {
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

      // Track batching efficiency
      if (items.length > 1) {
        this.enhancedStats.batching.indexesCollapsed += (items.length - 1);
      }

      console.log(`[PersistenceQueue] Batched ${items.length} index updates`);
    } catch (error) {
      // Fallback to individual processing
      for (const item of items) {
        await this.processItem(item);
      }
    }
  }

  /**
   * Process batched CA storage operations (reference counting)
   */
  private async processBatchedCAStorage(items: QueueItem[]): Promise<void> {
    if (items.length === 0) return;

    try {
      const storage = await getStorage();
      const tx = await storage.beginTransaction();

      try {
        // Save all CA metadata in a single transaction
        for (const item of items) {
          this.stats.processing++;
          this.emit('processing', item);
          tx.save(item.key, item.value);
        }

        await tx.commit();

        // Mark all as completed
        for (const item of items) {
          this.stats.processing--;
          this.stats.pending--;
          this.stats.completed++;
          this.emit('completed', item);
        }

        // Track batching efficiency
        if (items.length > 1) {
          this.enhancedStats.batching.caStorageCollapsed += (items.length - 1);
        }

        console.log(`[PersistenceQueue] Batched ${items.length} CA storage operations`);
      } catch (error) {
        await tx.rollback();
        // Handle errors individually
        for (const item of items) {
          this.stats.processing--;
          this.handleError(item, error);
        }
      }
    } catch (error) {
      // Transaction creation failed, process individually
      for (const item of items) {
        await this.processItem(item);
      }
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
      byType: { ...this.enhancedStats.byType },
      batching: { ...this.enhancedStats.batching },
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
