# Storage Queue Design

## Architecture

```
┌─────────────────┐
│  UI Component   │
│  (React)        │
└────────┬────────┘
         │ enqueue(item)
         ↓
┌─────────────────┐      ┌──────────────┐
│ PersistenceQueue│─────→│ Storage      │
│  (background)   │      │ Adapter      │
└─────────────────┘      └──────────────┘
    │
    ├─→ CRITICAL Queue (immediate)
    ├─→ NORMAL Queue (batched 100ms)
    └─→ LOW Queue (idle callback)
```

## Overview

The Storage Persistence Queue replaces debounced saves with a proper background persistence mechanism that doesn't block the UI. It provides priority-based queuing with automatic retry and exponential backoff.

## Problem Statement

### Current Issues
- **UI Blocking**: Debounced saves cause 200-500ms UI freezes
- **No Priority System**: Critical updates (session end) wait alongside non-critical updates
- **Silent Failures**: Save failures are lost with no retry mechanism
- **Race Conditions**: Rapid updates can cause data inconsistencies
- **Data Loss Windows**: 1-5 second debounce delay creates risk of data loss

### Target Solution
- Background queue processes saves asynchronously
- Priority levels: CRITICAL (immediate), NORMAL (batched), LOW (idle)
- Automatic retry with exponential backoff
- UI never blocks
- Guarantees all changes are persisted

## Queue Item

```typescript
interface QueueItem {
  id: string;              // Unique identifier (UUID)
  priority: 'critical' | 'normal' | 'low';
  key: string;             // Storage key (e.g., 'sessions', 'settings')
  value: any;              // Data to persist
  retries: number;         // Current retry count
  timestamp: number;       // Enqueue timestamp
  error?: string;          // Last error message (if any)
}
```

## Processing Rules

### CRITICAL Priority
- **When to Use**: Session start, session end, session delete, critical state changes
- **Processing**: Immediate (don't wait, process as soon as enqueued)
- **Batching**: No batching, each item processed individually
- **Max Retries**: 1 (fail fast for critical operations)
- **Use Case**: Session lifecycle events that must be persisted immediately

### NORMAL Priority
- **When to Use**: Regular updates, screenshot additions, audio segments
- **Processing**: Batched every 100ms
- **Batching**: Process all pending items in a single batch
- **Max Retries**: 3 (reasonable retry for normal operations)
- **Use Case**: Frequent updates during active sessions

### LOW Priority
- **When to Use**: Non-critical metadata, UI preferences, cache updates
- **Processing**: During idle time (requestIdleCallback)
- **Batching**: Process up to 10 items per idle callback
- **Max Retries**: 5 (aggressive retry for eventual consistency)
- **Use Case**: Background updates that don't need immediate persistence

## Error Handling

### Retry Logic
- **Exponential Backoff**: 100ms, 200ms, 400ms, 800ms, 1600ms...
- **Formula**: `delay = Math.pow(2, retries) * 100`
- **Max Retries**: Varies by priority (critical: 1, normal: 3, low: 5)

### Failure Handling
- **Max Retries Exceeded**: Emit 'failed' event, log error, increment failure counter
- **Console Warning**: Include key, retry count, and error message
- **No Blocking**: Failures don't prevent other items from processing

### Queue Size Limit
- **Max Size**: 1000 items total across all queues
- **Enforcement**: When limit exceeded, drop oldest LOW priority items
- **Warning**: Console warning with count of dropped items
- **Event**: Emit 'dropped' event for each dropped item

## Events

The PersistenceQueue extends EventEmitter and emits the following events:

```typescript
// Item enqueued
queue.on('enqueued', (item: QueueItem) => { ... });

// Item processing started
queue.on('processing', (item: QueueItem) => { ... });

// Item processing completed successfully
queue.on('completed', (item: QueueItem) => { ... });

// Item will be retried after error
queue.on('retry', (item: QueueItem) => { ... });

// Item failed after max retries
queue.on('failed', (item: QueueItem) => { ... });

// Item dropped due to queue size limit
queue.on('dropped', (item: QueueItem) => { ... });
```

## Queue Statistics

```typescript
interface QueueStats {
  pending: number;        // Total items waiting to be processed
  processing: number;     // Items currently being processed
  completed: number;      // Lifetime completed count
  failed: number;         // Lifetime failed count
  byPriority: {
    critical: number;     // Items in critical queue
    normal: number;       // Items in normal queue
    low: number;          // Items in low queue
  };
}
```

## API

### Singleton Instance
```typescript
import { getPersistenceQueue } from '@/services/storage/PersistenceQueue';

const queue = getPersistenceQueue();
```

### Enqueue Item
```typescript
const itemId = queue.enqueue(
  'sessions',           // key
  sessionData,          // value
  'critical'            // priority (optional, defaults to 'normal')
);
```

### Get Statistics
```typescript
const stats = queue.getStats();
console.log(`Pending: ${stats.pending}, Failed: ${stats.failed}`);
```

### Flush Queue (Wait for Completion)
```typescript
await queue.flush();  // Blocks until all items processed
```

### Clear Queue (Discard Pending)
```typescript
queue.clear();  // Discards all pending items (no processing)
```

### Shutdown (Flush and Cleanup)
```typescript
await queue.shutdown();  // Cancel timers, flush remaining items
```

## Implementation Details

### Critical Queue Processing
```typescript
private async processCriticalImmediate() {
  if (this.criticalQueue.length === 0) return;

  const item = this.criticalQueue.shift()!;
  await this.processItem(item);
}
```

### Normal Queue Processing (Batched)
```typescript
private scheduleNormalBatch() {
  if (this.normalBatchTimer) return;

  this.normalBatchTimer = setTimeout(() => {
    this.normalBatchTimer = null;
    this.processNormalBatch();
  }, BATCH_DELAY_MS);  // 100ms
}
```

### Low Queue Processing (Idle)
```typescript
private scheduleLowIdle() {
  if (this.idleCallbackId) return;

  if (typeof requestIdleCallback !== 'undefined') {
    this.idleCallbackId = requestIdleCallback(() => {
      this.idleCallbackId = null;
      this.processLowBatch();
    });
  } else {
    // Fallback for Node/Tauri
    this.idleCallbackId = setTimeout(() => {
      this.idleCallbackId = null;
      this.processLowBatch();
    }, 500) as any;
  }
}
```

## React Integration

### usePersistedState Hook
```typescript
import { usePersistedState } from '@/hooks/usePersistedState';

// In component
const [sessions, setSessions] = usePersistedState<Session[]>(
  'sessions',      // storage key
  [],              // initial value
  'normal'         // priority
);

// Updates automatically enqueue to persistence queue
setSessions(updatedSessions);
```

### Direct Queue Usage
```typescript
import { getPersistenceQueue } from '@/services/storage/PersistenceQueue';

const queue = getPersistenceQueue();

// In effect or callback
useEffect(() => {
  queue.enqueue('sessions', sessions, 'normal');
}, [sessions]);
```

## Performance Characteristics

### Memory Usage
- **Queue Items**: ~200 bytes per item
- **Max Queue Size**: 1000 items × 200 bytes = ~200KB maximum
- **Negligible Overhead**: Minimal memory footprint

### Throughput
- **Critical**: Immediate (no batching)
- **Normal**: Batched every 100ms (up to ~10 items/second sustainable)
- **Low**: Idle processing (variable, depends on system load)

### UI Impact
- **Blocking Time**: 0ms (all processing asynchronous)
- **Frame Drops**: None (uses requestIdleCallback for low priority)
- **Responsive**: UI remains responsive during heavy persistence

## Testing Strategy

### Unit Tests
- Priority-based processing (critical, normal, low)
- Retry logic with exponential backoff
- Queue size limit enforcement
- Event emission (enqueued, completed, failed, etc.)
- Flush and shutdown behavior

### Integration Tests
- Real storage adapter integration
- Concurrent enqueues
- Error recovery scenarios
- Shutdown/flush on app close

### Performance Tests
- Enqueue 1000 items, measure time to completion
- Verify UI doesn't block during queue processing
- Measure memory usage with large queue

## Migration Plan

### Phase 1: Add Queue (No Breaking Changes)
1. Add PersistenceQueue to codebase
2. Add usePersistedState hook
3. Don't change existing contexts yet

### Phase 2: SessionsContext Migration
1. Replace debounced save with queue
2. Keep critical actions immediate (session start/end)
3. Batch normal updates (screenshots, audio)
4. Test thoroughly

### Phase 3: Other Contexts
1. Migrate TasksContext, NotesContext, etc.
2. Follow same pattern as SessionsContext
3. Gradual rollout with testing

### Phase 4: Remove Old Code
1. Remove all debounced saves
2. Remove setTimeout-based persistence
3. Consolidate to queue-based persistence

## Monitoring

### Development UI (QueueMonitor)
```typescript
<QueueMonitor />  // Bottom-right corner in dev mode
```

Shows real-time stats:
- Pending items
- Processing items
- Completed count
- Failed count
- By-priority breakdown

### Production Monitoring
- Log queue statistics periodically
- Track failure rate
- Alert on high queue size (indicates backpressure)
- Monitor retry frequency

## Future Enhancements

### Potential Improvements
1. **Coalescing**: Merge multiple updates to same key
2. **Compression**: Compress large values before storage
3. **Encryption**: Encrypt sensitive data in queue
4. **Persistence**: Persist queue to storage on shutdown (recover on restart)
5. **Multi-Key Transactions**: Group multiple keys into atomic transaction

### Not Included (Out of Scope)
- Distributed queue (single-device app)
- Message queue integration (no backend)
- Complex scheduling (simple priority is sufficient)

## Conclusion

The PersistenceQueue provides a robust, performant solution for background persistence that eliminates UI blocking, provides priority-based processing, and ensures data integrity through automatic retry mechanisms. It's a critical foundation for the sessions rewrite project.
