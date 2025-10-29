# Concurrency Systems Integration Guide

**For**: Tasks 5.6-5.8 (Worker Pool, Progress Tracking, Error Handling)
**Date**: 2025-10-26
**Status**: Production-Ready

---

## Quick Start

### 1. Basic Setup

```typescript
import { getEnrichmentWorkerPool } from '@/services/enrichment/EnrichmentWorkerPool';
import { getProgressTrackingService } from '@/services/enrichment/ProgressTrackingService';
import { getEnrichmentErrorHandler } from '@/services/enrichment/EnrichmentErrorHandler';

// Initialize services (singleton pattern)
const workerPool = getEnrichmentWorkerPool();
const progressService = getProgressTrackingService();
const errorHandler = getEnrichmentErrorHandler();
```

### 2. Single Session Enrichment

```typescript
async function enrichSession(session: Session, options: EnrichmentOptions) {
  // Start progress tracking
  progressService.startProgress(session.id, {
    includeAudio: options.audioReview,
    includeVideo: options.videoChaptering,
    includeSummary: options.generateSummary,
    includeCanvas: options.generateCanvas,
  });

  // Acquire worker
  const worker = await workerPool.acquireWorker();

  try {
    // Assign job
    workerPool.assignJob(worker, session.id);

    // Stage 1: Audio Review
    if (options.audioReview) {
      progressService.updateProgress(session.id, {
        stage: 'audio',
        progress: 0,
        message: 'Analyzing audio...',
      });

      try {
        const audioResult = await analyzeAudio(session);

        progressService.updateStage(session.id, 'audio', {
          status: 'completed',
          progress: 100,
        });
      } catch (error) {
        const resolution = await errorHandler.handleError(error, {
          sessionId: session.id,
          operation: 'audio-review',
          attemptNumber: 1,
        });

        if (resolution.canContinue) {
          // Continue with other stages
          progressService.updateStage(session.id, 'audio', {
            status: 'failed',
            error: resolution.userMessage,
          });
        } else if (resolution.shouldRetry) {
          // Retry after delay
          await new Promise(resolve => setTimeout(resolve, resolution.retryDelay));
          // ... retry logic
        } else {
          throw new Error(resolution.userMessage);
        }
      }
    }

    // Stage 2: Video Chaptering
    if (options.videoChaptering) {
      progressService.updateProgress(session.id, {
        stage: 'video',
        progress: 0,
        message: 'Processing video...',
      });

      // Similar error handling as audio
      // ...
    }

    // Stage 3: Summary Generation
    if (options.generateSummary) {
      progressService.updateProgress(session.id, {
        stage: 'summary',
        progress: 0,
        message: 'Generating summary...',
      });

      // ...
    }

    // Complete
    progressService.completeProgress(session.id, true, 'Enrichment complete!');
    errorHandler.recordSuccess('full-enrichment');

  } catch (error) {
    progressService.completeProgress(session.id, false, 'Enrichment failed');
    throw error;
  } finally {
    // Always release worker
    await workerPool.releaseWorker(worker);
  }
}
```

### 3. Batch Enrichment

```typescript
async function enrichBatch(sessions: Session[], options: EnrichmentOptions) {
  const sessionIds = sessions.map(s => s.id);

  // Start batch tracking
  progressService.startBatch(sessionIds);

  // Start all sessions
  for (const session of sessions) {
    progressService.startProgress(session.id, options);
  }

  // Enrich in parallel (worker pool handles concurrency)
  const results = await Promise.allSettled(
    sessions.map(session => enrichSession(session, options))
  );

  // Get batch summary
  const batchProgress = progressService.getBatchProgress();
  console.log(`Batch complete: ${batchProgress?.completed}/${batchProgress?.total} succeeded`);

  return results;
}
```

### 4. UI Integration

```tsx
import { EnrichmentProgress } from '@/components/enrichment/EnrichmentProgress';
import { getProgressTrackingService } from '@/services/enrichment/ProgressTrackingService';

function SessionDetailView({ session }: { session: Session }) {
  const [isEnriching, setIsEnriching] = useState(false);
  const progressService = getProgressTrackingService();

  const handleEnrich = async () => {
    setIsEnriching(true);

    try {
      await enrichSession(session, {
        audioReview: true,
        videoChaptering: true,
        generateSummary: true,
        generateCanvas: true,
      });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <div>
      <button onClick={handleEnrich} disabled={isEnriching}>
        Enrich Session
      </button>

      {isEnriching && (
        <EnrichmentProgress
          sessionId={session.id}
          progressService={progressService}
          onComplete={() => {
            toast.success('Session enriched!');
            setIsEnriching(false);
          }}
        />
      )}
    </div>
  );
}
```

---

## Advanced Usage

### Custom Worker Pool Configuration

```typescript
import { EnrichmentWorkerPool } from '@/services/enrichment/EnrichmentWorkerPool';

const workerPool = new EnrichmentWorkerPool({
  maxWorkers: 10,              // More workers for larger batches
  errorThreshold: 5,           // Higher tolerance for transient errors
  acquisitionTimeout: 30000,   // 30 second timeout
  healthCheckInterval: 60000,  // Health check every minute
  enableAutoRestart: true,     // Auto-restart errored workers
});
```

### Custom Error Handling

```typescript
const resolution = await errorHandler.handleError(error, context);

switch (resolution.recommendedAction) {
  case 'retry':
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, resolution.retryDelay));
    return await enrichSession(session, options);

  case 'continue-partial':
    // Continue with partial results
    console.log('Continuing with partial enrichment...');
    break;

  case 'abort':
    // Stop enrichment
    throw new Error(resolution.userMessage);

  case 'skip':
    // Skip this session, continue with others
    console.log('Skipping session due to permanent error');
    break;
}
```

### Progress Event Listeners

```typescript
// Listen for progress updates
progressService.on('started', (sessionId, progress) => {
  console.log(`Started enriching ${sessionId}`);
});

progressService.on('progress', (sessionId, progress) => {
  console.log(`${sessionId}: ${progress.progress}% - ${progress.message}`);
});

progressService.on('stage', (sessionId, stage, progress) => {
  console.log(`${sessionId}: Moved to stage ${stage}`);
});

progressService.on('completed', (sessionId, progress) => {
  console.log(`${sessionId}: Enrichment complete!`);
});

progressService.on('failed', (sessionId, progress) => {
  console.error(`${sessionId}: Enrichment failed - ${progress.message}`);
});

// Batch events
progressService.on('batch-update', (batch) => {
  console.log(`Batch: ${batch.completed}/${batch.total} complete`);
});
```

### Worker Pool Monitoring

```typescript
// Get pool status
const status = workerPool.getPoolStatus();

console.log(`Pool Status:
  Total Workers: ${status.total}
  Idle: ${status.idle}
  Active: ${status.active}
  Error: ${status.error}
  Error Rate: ${status.errorRate.toFixed(2)}%
  Avg Job Duration: ${status.avgJobDuration.toFixed(0)}ms
  Uptime: ${status.uptimePercentage.toFixed(3)}%
`);

// Auto-restart errored workers
if (status.error > 0) {
  const restarted = await workerPool.restartErroredWorkers();
  console.log(`Restarted ${restarted} errored workers`);
}
```

---

## Error Handling Best Practices

### 1. Classify Errors Correctly

```typescript
// Transient errors (retry)
if (error.message.includes('rate limit')) {
  // Automatically handled by errorHandler
}

// Permanent errors (fail fast)
if (error.message.includes('invalid API key')) {
  // Show configuration prompt to user
  showSettingsPrompt();
}

// Partial failures (graceful degradation)
if (error.message.includes('audio failed')) {
  // Continue with video only
  options.audioReview = false;
  continue;
}
```

### 2. Use Circuit Breaker

```typescript
// Record successes to help circuit breaker
errorHandler.recordSuccess('audio-review');
errorHandler.recordSuccess('video-chaptering');

// Circuit breaker prevents overwhelming failed services
const resolution = await errorHandler.handleError(error, context);
if (resolution.backendDetails.metadata?.circuitState === 'open') {
  // Circuit open - service having issues
  showServiceUnavailableMessage();
}
```

### 3. Graceful Degradation

```typescript
try {
  await enrichWithAudioAndVideo(session);
} catch (error) {
  const resolution = await errorHandler.handleError(error, context);

  if (resolution.canContinue) {
    // Degrade gracefully
    if (resolution.type === 'audio-failed') {
      console.log('Audio failed, continuing with video only');
      await enrichWithVideoOnly(session);
    } else if (resolution.type === 'video-failed') {
      console.log('Video failed, continuing with audio only');
      await enrichWithAudioOnly(session);
    }
  }
}
```

---

## Progress Tracking Best Practices

### 1. Update Progress Frequently

```typescript
// Good: Update after each major step
progressService.updateStage(sessionId, 'audio', { progress: 0 });
await transcribeAudio(audio);
progressService.updateStage(sessionId, 'audio', { progress: 50 });
await analyzeTranscript(transcript);
progressService.updateStage(sessionId, 'audio', { progress: 100 });

// Bad: No progress updates
await enrichAudio(session); // User sees nothing for minutes
```

### 2. Use Meaningful Messages (NO COST)

```typescript
// ✅ CORRECT (clear, friendly, NO COST)
progressService.updateProgress(sessionId, {
  message: 'Analyzing audio transcription...',
});

progressService.updateProgress(sessionId, {
  message: 'Processing video frames...',
});

progressService.updateProgress(sessionId, {
  message: 'Generating session summary...',
});

// ❌ WRONG (showing cost)
progressService.updateProgress(sessionId, {
  message: 'Processing... Cost so far: $0.50',  // NO!
});
```

### 3. Clean Up Progress

```typescript
// Clean up after enrichment complete
progressService.on('completed', (sessionId) => {
  // Clear progress after 5 seconds
  setTimeout(() => {
    progressService.clearProgress(sessionId);
  }, 5000);
});
```

---

## Worker Pool Best Practices

### 1. Always Release Workers

```typescript
// Good: Use try/finally
const worker = await workerPool.acquireWorker();
try {
  await enrichSession(session);
} finally {
  await workerPool.releaseWorker(worker); // Always runs
}

// Bad: Worker may leak
const worker = await workerPool.acquireWorker();
await enrichSession(session);
await workerPool.releaseWorker(worker); // May not run if error
```

### 2. Report Errors to Pool

```typescript
const worker = await workerPool.acquireWorker();
try {
  await enrichSession(session);
  await workerPool.releaseWorker(worker); // Success
} catch (error) {
  await workerPool.releaseWorker(worker, error); // Report error
  throw error;
}
```

### 3. Monitor Pool Health

```typescript
// Check pool health periodically
setInterval(() => {
  const status = workerPool.getPoolStatus();

  if (status.errorRate > 50) {
    console.warn('High error rate in worker pool!');
  }

  if (status.uptimePercentage < 99) {
    console.warn('Worker pool uptime below target!');
  }
}, 60000); // Every minute
```

---

## Performance Optimization

### 1. Batch Operations

```typescript
// Good: Enrich multiple sessions in parallel
await enrichBatch(sessions, options);

// Bad: Enrich one at a time
for (const session of sessions) {
  await enrichSession(session, options);
}
```

### 2. Adjust Worker Pool Size

```typescript
// For large batches
const workerPool = new EnrichmentWorkerPool({
  maxWorkers: 10, // More workers
});

// For small batches or limited resources
const workerPool = new EnrichmentWorkerPool({
  maxWorkers: 3, // Fewer workers
});
```

### 3. Skip Unnecessary Stages

```typescript
// Only enrich what you need
await enrichSession(session, {
  audioReview: session.hasAudio,      // Only if audio exists
  videoChaptering: session.hasVideo,  // Only if video exists
  generateSummary: true,              // Always generate
  generateCanvas: false,              // Skip for performance
});
```

---

## Troubleshooting

### Worker Pool Issues

**Problem**: Workers stuck in active state
```typescript
// Solution: Check for leaked workers
const status = workerPool.getPoolStatus();
if (status.active > 0 && status.pending === 0) {
  console.warn('Potential worker leak detected');
  // Force shutdown and restart
  await workerPool.shutdown();
  workerPool = new EnrichmentWorkerPool();
}
```

**Problem**: High error rate
```typescript
// Solution: Restart errored workers
const restarted = await workerPool.restartErroredWorkers();
console.log(`Restarted ${restarted} workers`);
```

### Progress Tracking Issues

**Problem**: ETA not calculating
```typescript
// Solution: Ensure historical data exists
if (!progressService.calculateETA(sessionId)) {
  console.log('No historical data for ETA calculation');
  // Complete at least one enrichment first
}
```

**Problem**: Progress not updating
```typescript
// Solution: Check event listeners
progressService.on('progress', (sessionId, progress) => {
  console.log('Progress update received:', progress);
});
```

### Error Handling Issues

**Problem**: Circuit breaker stuck open
```typescript
// Solution: Record successes to close circuit
errorHandler.recordSuccess('audio-review');
errorHandler.recordSuccess('video-chaptering');
```

**Problem**: Too many retries
```typescript
// Solution: Check error history
const errorHistory = [error1, error2, error3];
if (errorHandler.shouldStopRetrying(errorHistory)) {
  console.log('Stopping retries - all errors permanent');
}
```

---

## Shutdown & Cleanup

```typescript
// Graceful shutdown on app close
async function shutdown() {
  // Wait for active enrichments to complete
  await workerPool.shutdown();

  // Clean up progress tracking
  progressService.shutdown();

  console.log('Concurrency systems shut down gracefully');
}

// Register shutdown handler
window.addEventListener('beforeunload', () => {
  shutdown();
});
```

---

## Testing

### Unit Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnrichmentWorkerPool, resetEnrichmentWorkerPool } from './EnrichmentWorkerPool';

describe('My Enrichment Feature', () => {
  let pool: EnrichmentWorkerPool;

  beforeEach(() => {
    resetEnrichmentWorkerPool();
    pool = new EnrichmentWorkerPool({ maxWorkers: 3 });
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  it('should enrich session successfully', async () => {
    const worker = await pool.acquireWorker();
    // ... test logic
    await pool.releaseWorker(worker);
  });
});
```

### Integration Testing

```typescript
describe('Enrichment Integration', () => {
  it('should enrich session with all systems', async () => {
    const progressService = getProgressTrackingService();
    const errorHandler = getEnrichmentErrorHandler();
    const workerPool = getEnrichmentWorkerPool();

    const session = createTestSession();

    await enrichSession(session, {
      audioReview: true,
      videoChaptering: true,
      generateSummary: true,
    });

    const progress = progressService.getProgress(session.id);
    expect(progress?.stage).toBe('complete');
  });
});
```

---

## API Reference

See individual service documentation:
- [EnrichmentWorkerPool.ts](../../src/services/enrichment/EnrichmentWorkerPool.ts)
- [ProgressTrackingService.ts](../../src/services/enrichment/ProgressTrackingService.ts)
- [EnrichmentErrorHandler.ts](../../src/services/enrichment/EnrichmentErrorHandler.ts)
- [EnrichmentProgress.tsx](../../src/components/enrichment/EnrichmentProgress.tsx)

---

**Last Updated**: 2025-10-26
**Version**: 1.0.0
**Status**: Production-Ready ✅
