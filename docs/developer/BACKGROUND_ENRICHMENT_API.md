# Background Enrichment System - API Reference

**Version**: 1.0
**Date**: 2025-10-28
**Audience**: Developers

---

## Table of Contents

1. [BackgroundEnrichmentManager](#backgroundenrichmentmanager)
2. [PersistentEnrichmentQueue](#persistentenrichmentqueue)
3. [BackgroundMediaProcessor](#backgroundmediaprocessor)
4. [Event Bus Events](#event-bus-events)
5. [Type Definitions](#type-definitions)
6. [Usage Examples](#usage-examples)
7. [Error Handling](#error-handling)
8. [Testing](#testing)

---

## BackgroundEnrichmentManager

High-level API for managing enrichment lifecycle.

### Location

`src/services/enrichment/BackgroundEnrichmentManager.ts`

### Getting Instance

```typescript
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';

const manager = await getBackgroundEnrichmentManager();
```

### Methods

#### `initialize()`

Initialize manager and queue. MUST be called before using manager.

```typescript
async initialize(): Promise<void>
```

**Usage**:
```typescript
const manager = await getBackgroundEnrichmentManager();
await manager.initialize();
```

**Called by**: `App.tsx` on mount

**Throws**: `Error` if initialization fails

---

#### `enqueueSession()`

Enqueue a session for background enrichment.

```typescript
async enqueueSession(params: EnqueueSessionParams): Promise<string>
```

**Parameters**:
```typescript
interface EnqueueSessionParams {
  sessionId: string;         // Session ID
  sessionName: string;       // Session name (for UI/notifications)
  priority?: JobPriority;    // 'high' | 'normal' | 'low' (default: 'normal')
  options?: EnrichmentOptions; // Enrichment configuration
}
```

**Returns**: `string` - Job ID (UUID)

**Usage**:
```typescript
const jobId = await manager.enqueueSession({
  sessionId: 'session-123',
  sessionName: 'My Work Session',
  priority: 'normal',
  options: {
    includeAudio: true,
    includeVideo: true,
    maxCostThreshold: 1.0
  }
});

console.log(`Job created: ${jobId}`);
```

**Throws**:
- `Error('Session ID is required')` if sessionId empty
- `Error('Session name is required')` if sessionName empty

**Events Emitted**:
- `job-enqueued` - Job successfully created

---

#### `markMediaProcessingComplete()`

Mark media processing complete, triggering enrichment.

```typescript
async markMediaProcessingComplete(
  sessionId: string,
  optimizedVideoPath?: string
): Promise<void>
```

**Parameters**:
- `sessionId: string` - Session ID
- `optimizedVideoPath?: string` - Path to optimized video (if created)

**Usage**:
```typescript
// Called by BackgroundMediaProcessor after video/audio merge completes
await manager.markMediaProcessingComplete(
  'session-123',
  '/app-data/sessions/session-123/video-optimized.mp4'
);
```

**Side Effects**:
- Updates session with `video.optimizedPath` in storage
- Changes job status from `'waiting_for_media'` to `'pending'`
- Queue begins processing job

**Throws**: `Error` if session not found or update fails

---

#### `getQueueStatus()`

Get aggregate queue status.

```typescript
async getQueueStatus(): Promise<QueueStatus>
```

**Returns**:
```typescript
interface QueueStatus {
  pending: number;    // Jobs waiting to be processed
  processing: number; // Jobs currently processing
  completed: number;  // Jobs successfully completed
  failed: number;     // Jobs that failed after retries
  cancelled: number;  // Jobs cancelled by user
  total: number;      // Total jobs in queue (all statuses)
}
```

**Usage**:
```typescript
const status = await manager.getQueueStatus();
console.log(`Processing: ${status.processing} jobs`);
console.log(`Pending: ${status.pending} jobs`);
```

**Used by**: `EnrichmentStatusIndicator` component

---

#### `getJobStatus()`

Get status of a specific job.

```typescript
async getJobStatus(jobId: string): Promise<EnrichmentJob | null>
```

**Parameters**:
- `jobId: string` - Job ID from `enqueueSession()`

**Returns**: `EnrichmentJob | null` - Job object or null if not found

**Usage**:
```typescript
const job = await manager.getJobStatus('job-abc-123');
if (job) {
  console.log(`Status: ${job.status}`);
  console.log(`Progress: ${job.progress}%`);
  console.log(`Stage: ${job.stage}`);
}
```

---

#### `cancelJob()`

Cancel an enrichment job.

```typescript
async cancelJob(jobId: string): Promise<void>
```

**Parameters**:
- `jobId: string` - Job ID to cancel

**Usage**:
```typescript
await manager.cancelJob('job-abc-123');
```

**Side Effects**:
- Updates job status to `'cancelled'`
- Stops processing if currently running
- Emits `job-cancelled` event

**Throws**: `Error` if job not found

---

#### `shutdown()`

Gracefully shutdown manager and queue.

```typescript
async shutdown(): Promise<void>
```

**Usage**:
```typescript
// Called by App.tsx on unmount
await manager.shutdown();
```

**Side Effects**:
- Stops processing new jobs
- Waits for current jobs to complete (or timeout after 10s)
- Closes IndexedDB connections

---

### Events

Manager forwards all queue events via `eventBus`:

| Event | Payload | Description |
|-------|---------|-------------|
| `job-enqueued` | `{ job: EnrichmentJob }` | Job created |
| `job-started` | `{ job: EnrichmentJob }` | Processing began |
| `job-progress` | `{ job: EnrichmentJob, progress: number, stage: string }` | Progress update |
| `job-completed` | `{ job: EnrichmentJob, result: EnrichmentResult }` | Enrichment finished |
| `job-failed` | `{ job: EnrichmentJob, error: string }` | Job failed |
| `job-cancelled` | `{ job: EnrichmentJob }` | Job cancelled |

**Subscribe**:
```typescript
import { eventBus } from '@/utils/eventBus';

eventBus.on('job-progress', (event) => {
  console.log(`${event.job.sessionName}: ${event.progress}%`);
});
```

---

## PersistentEnrichmentQueue

IndexedDB-backed persistent job queue.

### Location

`src/services/enrichment/PersistentEnrichmentQueue.ts`

### Getting Instance

```typescript
import { getPersistentEnrichmentQueue } from '@/services/enrichment/PersistentEnrichmentQueue';

const queue = await getPersistentEnrichmentQueue();
```

**Note**: Most apps should use `BackgroundEnrichmentManager` instead. Only use queue directly for advanced use cases.

### Methods

#### `initialize()`

Initialize queue, open IndexedDB, resume pending jobs.

```typescript
async initialize(): Promise<void>
```

**Usage**:
```typescript
const queue = await getPersistentEnrichmentQueue();
await queue.initialize();
```

**Side Effects**:
- Opens IndexedDB connection
- Loads all jobs from storage
- Resets crashed jobs (stuck in `'processing'`) to `'pending'`
- Starts background processing loop

---

#### `enqueue()`

Add a job to the queue.

```typescript
async enqueue(params: EnqueueParams): Promise<string>
```

**Parameters**:
```typescript
interface EnqueueParams {
  sessionId: string;
  sessionName: string;
  priority?: JobPriority;
  options?: EnrichmentOptions;
  waitForMedia?: boolean; // If true, job waits for media processing
}
```

**Returns**: `string` - Job ID

**Usage**:
```typescript
const jobId = await queue.enqueue({
  sessionId: 'session-123',
  sessionName: 'My Session',
  priority: 'high',
  waitForMedia: true, // Job will wait until markMediaProcessingComplete() is called
  options: { includeAudio: true }
});
```

**Throws**:
- `Error('Session already has a pending job')` if duplicate sessionId

---

#### `getJob()`

Get job by ID.

```typescript
async getJob(jobId: string): Promise<EnrichmentJob | null>
```

**Returns**: `EnrichmentJob | null`

---

#### `updateJob()`

Update job fields.

```typescript
async updateJob(jobId: string, updates: Partial<EnrichmentJob>): Promise<void>
```

**Parameters**:
- `jobId: string` - Job ID
- `updates: Partial<EnrichmentJob>` - Fields to update

**Usage**:
```typescript
await queue.updateJob('job-123', {
  progress: 75,
  stage: 'video-chaptering'
});
```

---

#### `cancelJob()`

Cancel a job.

```typescript
async cancelJob(jobId: string): Promise<void>
```

**Usage**:
```typescript
await queue.cancelJob('job-123');
```

**Side Effects**:
- Sets status to `'cancelled'`
- Stops processing if running
- Emits `job-cancelled` event

---

#### `retryJob()`

Retry a failed job.

```typescript
async retryJob(jobId: string): Promise<void>
```

**Usage**:
```typescript
await queue.retryJob('job-123');
```

**Side Effects**:
- Resets status to `'pending'`
- Increments `attempts` counter
- Re-queues for processing

---

#### `getQueueStatus()`

Get aggregate queue statistics.

```typescript
async getQueueStatus(): Promise<QueueStatus>
```

**Returns**: See BackgroundEnrichmentManager `getQueueStatus()` for interface.

---

#### `shutdown()`

Shutdown queue.

```typescript
async shutdown(): Promise<void>
```

---

### Job Lifecycle

```
Created (enqueue)
   ↓
[pending] ← (reset on app restart if crashed)
   ↓
[processing] → (execute sessionEnrichmentService.enrichSession)
   ↓                ↓ (error)
   ↓             [failed] → (retry 3x) → [failed] (permanent)
   ↓                ↓
[completed]     (cancelled by user)
                   ↓
               [cancelled]
```

---

## BackgroundMediaProcessor

Two-stage media optimization (audio concatenation + video/audio merge).

### Location

`src/services/enrichment/BackgroundMediaProcessor.ts`

### Getting Instance

```typescript
import { BackgroundMediaProcessor } from '@/services/enrichment/BackgroundMediaProcessor';

const processor = BackgroundMediaProcessor.getInstance();
```

### Methods

#### `process()`

Process session media (concatenate audio + merge with video).

```typescript
async process(job: MediaProcessingJob): Promise<void>
```

**Parameters**:
```typescript
interface MediaProcessingJob {
  sessionId: string;
  sessionName: string;
  videoPath: string | null;            // null if no video
  audioSegments: SessionAudioSegment[];
  onProgress: (stage: ProcessingStage, progress: number) => void;
  onComplete: (optimizedVideoPath: string | undefined) => void;
  onError: (error: Error) => void;
}

type ProcessingStage = 'concatenating' | 'merging' | 'complete';
```

**Usage**:
```typescript
await processor.process({
  sessionId: 'session-123',
  sessionName: 'My Session',
  videoPath: '/app-data/sessions/session-123/video.mp4',
  audioSegments: session.audioSegments,
  onProgress: (stage, progress) => {
    console.log(`${stage}: ${progress}%`);
    eventBus.emit('media-processing-progress', { sessionId, stage, progress });
  },
  onComplete: (optimizedPath) => {
    console.log(`Optimized video: ${optimizedPath}`);
    eventBus.emit('media-processing-complete', { sessionId, optimizedPath });
  },
  onError: (error) => {
    console.error('Processing failed:', error);
    eventBus.emit('media-processing-error', { sessionId, error: error.message });
  }
});
```

**Side Effects**:
- Creates `{sessionId}/audio-concatenated.mp3`
- Creates `{sessionId}/video-optimized.mp4`
- Emits progress events throughout processing

**Duration**: ~35-40 seconds for 30-minute session

---

#### `cancelJob()`

Cancel an active processing job.

```typescript
async cancelJob(sessionId: string): Promise<void>
```

**Usage**:
```typescript
await processor.cancelJob('session-123');
```

**Side Effects**:
- Stops processing
- Cleans up intermediate files
- Calls `onError` callback with cancellation error

---

#### `isJobActive()`

Check if a job is currently processing.

```typescript
isJobActive(sessionId: string): boolean
```

**Usage**:
```typescript
if (processor.isJobActive('session-123')) {
  console.log('Session is being processed');
}
```

---

### Processing Stages

**Stage 1: Audio Concatenation (0-50% progress)**

**Input**: Array of WAV audio segments
**Output**: Single MP3 file
**Duration**: ~5 seconds
**Service**: `audioConcatenationService.concatenateAndSave()`

```typescript
// Progress: 0% → 50%
onProgress('concatenating', 0);
const mp3Path = await concatenateAudio(sessionId, audioSegments);
onProgress('concatenating', 50);
```

**Stage 2: Video/Audio Merge (50-100% progress)**

**Input**: Original video (MP4) + concatenated audio (MP3)
**Output**: Optimized MP4 with H.264 + AAC
**Duration**: ~30 seconds
**Service**: Tauri command `merge_video_audio`

```typescript
// Progress: 50% → 100%
onProgress('merging', 50);
const optimizedPath = await invoke('merge_video_audio', { ... });
onProgress('merging', 100);
onComplete(optimizedPath);
```

---

## Event Bus Events

All enrichment events are emitted via `eventBus` for UI components to subscribe.

### Location

`src/utils/eventBus.ts`

### Media Processing Events

#### `media-processing-progress`

Emitted during media optimization (audio concat + video merge).

```typescript
interface MediaProcessingProgressEvent {
  sessionId: string;
  stage: 'concatenating' | 'merging';
  progress: number; // 0-100
  message?: string;
}

eventBus.on('media-processing-progress', (event) => {
  console.log(`${event.sessionId}: ${event.stage} ${event.progress}%`);
});
```

#### `media-processing-complete`

Emitted when media optimization finishes.

```typescript
interface MediaProcessingCompleteEvent {
  sessionId: string;
  optimizedVideoPath?: string;
}

eventBus.on('media-processing-complete', (event) => {
  console.log(`Session ${event.sessionId} optimized: ${event.optimizedVideoPath}`);
});
```

#### `media-processing-error`

Emitted when media processing fails.

```typescript
interface MediaProcessingErrorEvent {
  sessionId: string;
  error: string;
}

eventBus.on('media-processing-error', (event) => {
  console.error(`Processing failed for ${event.sessionId}: ${event.error}`);
});
```

### Enrichment Events

See [BackgroundEnrichmentManager Events](#events) section above.

---

## Type Definitions

### EnrichmentJob

```typescript
interface EnrichmentJob {
  id: string;               // Job ID (UUID)
  sessionId: string;        // Session being enriched
  sessionName: string;      // Session name (for UI)
  status: JobStatus;        // Current status
  priority: JobPriority;    // Job priority
  progress: number;         // 0-100
  stage?: string;           // Current stage ('audio', 'video', 'summary')
  options: EnrichmentOptions; // Enrichment config
  createdAt: number;        // Timestamp (ms)
  startedAt?: number;       // When processing began
  completedAt?: number;     // When finished
  lastUpdated: number;      // Last update timestamp
  error?: string;           // Error message if failed
  attempts: number;         // Retry count
  maxAttempts: number;      // Max retries (default: 3)
  result?: EnrichmentResult; // Result if completed
}
```

### JobStatus

```typescript
type JobStatus =
  | 'pending'       // Waiting in queue
  | 'processing'    // Currently enriching
  | 'completed'     // Successfully finished
  | 'failed'        // Failed after all retries
  | 'cancelled';    // Cancelled by user
```

### JobPriority

```typescript
type JobPriority =
  | 'high'    // Process within 5 seconds
  | 'normal'  // Batched processing (default)
  | 'low';    // Idle time only
```

### EnrichmentOptions

```typescript
interface EnrichmentOptions {
  includeAudio?: boolean;        // Enable audio review (default: true)
  includeVideo?: boolean;        // Enable video chaptering (default: true)
  maxCostThreshold?: number;     // Stop if cost exceeds (default: 1.0 USD)
  skipIfEnriched?: boolean;      // Skip if already enriched (default: true)
  forceReenrich?: boolean;       // Force re-enrichment (default: false)
}
```

### EnrichmentResult

```typescript
interface EnrichmentResult {
  summary: SessionSummary;       // AI-generated summary
  audioInsights?: AudioInsights; // Audio review results
  chapters?: VideoChapter[];     // Video chapters
  canvasSpec?: CanvasSpec;       // Visual canvas layout
  cost: {
    audio: number;               // Audio review cost (USD)
    video: number;               // Video chaptering cost (USD)
    summary: number;             // Summary cost (USD)
    total: number;               // Total cost (USD)
  };
  duration: {
    audio: number;               // Audio processing time (ms)
    video: number;               // Video processing time (ms)
    summary: number;             // Summary generation time (ms)
    total: number;               // Total time (ms)
  };
}
```

### QueueStatus

```typescript
interface QueueStatus {
  pending: number;    // Jobs waiting
  processing: number; // Jobs active
  completed: number;  // Jobs done
  failed: number;     // Jobs failed
  cancelled: number;  // Jobs cancelled
  total: number;      // All jobs
}
```

---

## Usage Examples

### Example 1: Basic Session Enrichment

```typescript
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';

async function enrichSession(session: Session) {
  const manager = await getBackgroundEnrichmentManager();

  // Enqueue session
  const jobId = await manager.enqueueSession({
    sessionId: session.id,
    sessionName: session.name,
    options: {
      includeAudio: true,
      includeVideo: true
    }
  });

  console.log(`Enrichment started: ${jobId}`);

  // Monitor progress
  eventBus.on('job-progress', (event) => {
    if (event.job.id === jobId) {
      console.log(`Progress: ${event.progress}% (${event.stage})`);
    }
  });

  // Wait for completion
  await new Promise((resolve, reject) => {
    eventBus.on('job-completed', (event) => {
      if (event.job.id === jobId) resolve(event.result);
    });
    eventBus.on('job-failed', (event) => {
      if (event.job.id === jobId) reject(new Error(event.error));
    });
  });
}
```

### Example 2: Media Processing with Progress UI

```typescript
import { BackgroundMediaProcessor } from '@/services/enrichment/BackgroundMediaProcessor';
import { eventBus } from '@/utils/eventBus';

async function processSessionMedia(session: Session) {
  const processor = BackgroundMediaProcessor.getInstance();

  await processor.process({
    sessionId: session.id,
    sessionName: session.name,
    videoPath: session.video?.path ?? null,
    audioSegments: session.audioSegments,

    onProgress: (stage, progress) => {
      // Update UI progress bar
      eventBus.emit('media-processing-progress', {
        sessionId: session.id,
        stage,
        progress,
        message: stage === 'concatenating'
          ? 'Combining audio...'
          : 'Optimizing video...'
      });
    },

    onComplete: async (optimizedPath) => {
      // Update session with optimized path
      await chunkedStorage.updateSession(session.id, {
        'video.optimizedPath': optimizedPath
      });

      // Notify user
      eventBus.emit('media-processing-complete', {
        sessionId: session.id,
        optimizedVideoPath: optimizedPath
      });
    },

    onError: (error) => {
      // Show error UI
      eventBus.emit('media-processing-error', {
        sessionId: session.id,
        error: error.message
      });
    }
  });
}
```

### Example 3: Queue Status Monitoring

```typescript
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';

async function showEnrichmentStatus() {
  const manager = await getBackgroundEnrichmentManager();
  const status = await manager.getQueueStatus();

  console.log(`Queue Status:`);
  console.log(`  Pending: ${status.pending}`);
  console.log(`  Processing: ${status.processing}`);
  console.log(`  Completed: ${status.completed}`);
  console.log(`  Failed: ${status.failed}`);
  console.log(`  Total: ${status.total}`);

  // Show in UI
  if (status.processing > 0) {
    showEnrichmentBadge(`Enriching ${status.processing} sessions...`);
  } else if (status.pending > 0) {
    showEnrichmentBadge(`${status.pending} sessions queued`);
  } else {
    hideEnrichmentBadge();
  }
}
```

### Example 4: Handling Errors with Retry

```typescript
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';
import { eventBus } from '@/utils/eventBus';

eventBus.on('job-failed', async (event) => {
  const job = event.job;

  // Check if retries exhausted
  if (job.attempts >= job.maxAttempts) {
    // Show error notification
    showNotification({
      title: 'Enrichment Failed',
      body: `${job.sessionName} could not be enriched: ${job.error}`,
      actions: [
        {
          title: 'Retry',
          handler: async () => {
            const queue = await getPersistentEnrichmentQueue();
            await queue.retryJob(job.id);
          }
        }
      ]
    });
  } else {
    // Auto-retry in progress
    console.log(`Retrying ${job.sessionName} (attempt ${job.attempts}/${job.maxAttempts})`);
  }
});
```

### Example 5: Cancelling Jobs

```typescript
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';

async function cancelEnrichment(jobId: string) {
  const manager = await getBackgroundEnrichmentManager();

  // Cancel job
  await manager.cancelJob(jobId);

  // Show confirmation
  showNotification({
    title: 'Enrichment Cancelled',
    body: 'Job has been cancelled successfully'
  });
}
```

---

## Error Handling

### Common Errors

#### `Error: Session ID is required`

**Cause**: Called `enqueueSession()` with empty sessionId
**Solution**: Ensure sessionId is valid before calling

#### `Error: Session already has a pending job`

**Cause**: Tried to enqueue same session twice
**Solution**: Check existing job status before enqueuing:

```typescript
const job = await manager.getJobStatus(existingJobId);
if (job && job.status !== 'completed' && job.status !== 'failed') {
  console.log('Job already exists');
  return existingJobId;
}
```

#### `Error: Queue not initialized`

**Cause**: Called queue methods before `initialize()`
**Solution**: Always call `initialize()` first:

```typescript
const manager = await getBackgroundEnrichmentManager();
await manager.initialize(); // MUST call first
```

#### `Error: Processing cancelled by user`

**Cause**: User called `cancelJob()` during processing
**Solution**: This is expected, handle gracefully:

```typescript
onError: (error) => {
  if (error.message.includes('cancelled')) {
    console.log('User cancelled processing');
  } else {
    console.error('Processing error:', error);
  }
}
```

### Retry Strategy

Jobs automatically retry on failure with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 0s (immediate) |
| 2 | 1s |
| 3 | 2s |
| 4 | 4s (final) |

After 4 attempts, job status changes to `'failed'` (permanent).

---

## Testing

### Unit Tests

**BackgroundEnrichmentManager**:
```bash
npm test -- src/services/enrichment/BackgroundEnrichmentManager.test.ts
```

**PersistentEnrichmentQueue**:
```bash
npm test -- src/services/enrichment/PersistentEnrichmentQueue.test.ts
```

**BackgroundMediaProcessor**:
```bash
npm test -- src/services/enrichment/BackgroundMediaProcessor.test.ts
```

### Integration Tests

**End-to-End**:
```bash
npm test -- src/services/enrichment/__tests__/background-enrichment-e2e.test.ts
```

**UnifiedMediaPlayer**:
```bash
npm test -- src/components/__tests__/UnifiedMediaPlayer.integration.test.tsx
```

**Complete Lifecycle**:
```bash
npm test -- src/__tests__/e2e/background-enrichment-lifecycle.test.tsx
```

### Mocking in Tests

```typescript
import { vi } from 'vitest';
import { BackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';

// Mock manager
vi.mock('@/services/enrichment/BackgroundEnrichmentManager', () => ({
  getBackgroundEnrichmentManager: vi.fn(() => ({
    initialize: vi.fn(),
    enqueueSession: vi.fn(() => 'job-123'),
    markMediaProcessingComplete: vi.fn(),
    getQueueStatus: vi.fn(() => ({
      pending: 0,
      processing: 1,
      completed: 5,
      failed: 0,
      cancelled: 0,
      total: 6
    }))
  }))
}));
```

---

## Best Practices

### 1. Always Initialize

```typescript
// ✅ Good
const manager = await getBackgroundEnrichmentManager();
await manager.initialize();
await manager.enqueueSession(...);

// ❌ Bad
const manager = await getBackgroundEnrichmentManager();
await manager.enqueueSession(...); // ERROR: Not initialized
```

### 2. Handle Errors Gracefully

```typescript
// ✅ Good
try {
  await manager.enqueueSession(...);
} catch (error) {
  console.error('Enrichment failed:', error);
  showErrorNotification(error.message);
}

// ❌ Bad
await manager.enqueueSession(...); // Unhandled rejection
```

### 3. Clean Up Event Listeners

```typescript
// ✅ Good
useEffect(() => {
  const unsubscribe = eventBus.on('job-progress', handler);
  return () => unsubscribe(); // Clean up on unmount
}, []);

// ❌ Bad
eventBus.on('job-progress', handler); // Memory leak
```

### 4. Use TypeScript Types

```typescript
// ✅ Good
import type { EnrichmentJob, QueueStatus } from '@/services/enrichment/PersistentEnrichmentQueue';

const job: EnrichmentJob = await manager.getJobStatus(jobId);

// ❌ Bad
const job = await manager.getJobStatus(jobId); // No type safety
```

### 5. Check Job Status Before Actions

```typescript
// ✅ Good
const job = await manager.getJobStatus(jobId);
if (job && job.status === 'processing') {
  await manager.cancelJob(jobId);
}

// ❌ Bad
await manager.cancelJob(jobId); // May fail if job completed
```

---

## Performance Tips

### 1. Batch Status Queries

```typescript
// ✅ Good - Single query
const status = await manager.getQueueStatus();
console.log(`${status.processing} jobs active`);

// ❌ Bad - Multiple queries
const pending = await manager.getQueueStatus().pending;
const processing = await manager.getQueueStatus().processing;
```

### 2. Debounce Progress Updates

```typescript
// ✅ Good - Update UI every 500ms
const debouncedUpdate = debounce((progress) => {
  updateProgressBar(progress);
}, 500);

eventBus.on('job-progress', (event) => {
  debouncedUpdate(event.progress);
});

// ❌ Bad - Update on every event (60fps can overwhelm UI)
eventBus.on('job-progress', (event) => {
  updateProgressBar(event.progress);
});
```

### 3. Use Priority Wisely

```typescript
// ✅ Good - Reserve high priority for user actions
await manager.enqueueSession({
  ...,
  priority: userTriggered ? 'high' : 'normal'
});

// ❌ Bad - All jobs high priority (defeats purpose)
await manager.enqueueSession({ ..., priority: 'high' });
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-28
**Questions**: See implementation source code for additional details
