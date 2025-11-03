# Enrichment System - Developer Guide

**Last Updated**: November 2, 2025
**Version**: Phase 5 + Phase 6 Complete
**Status**: Production-Ready

---

## Quick Start

### What is Session Enrichment?

Session enrichment transforms raw session data (screenshots, audio, video) into actionable insights:

**Raw Session** → **AI Processing** → **Enriched Session**
- Screenshots → Activity analysis, OCR, context detection
- Audio → Transcription, conversation analysis, key moments
- Video → Chapter detection, thumbnail generation
- Combined → Comprehensive summary, task extraction, insights

### For Developers: Run Enrichment

```typescript
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';

const manager = await getBackgroundEnrichmentManager();

// Enqueue session for background enrichment
const jobId = await manager.enqueueSession({
  sessionId: 'session-123',
  sessionName: 'Work Session',
  priority: 'normal',  // 'high' | 'normal' | 'low'
  options: {
    includeAudio: true,
    includeVideo: true,
    includeScreenshots: true
  }
});

// Monitor progress
manager.on('job-progress', (job) => {
  console.log(`${job.sessionId}: ${job.progress}% - ${job.stage}`);
});

// Job completes automatically in background
manager.on('job-completed', (job) => {
  console.log(`Session ${job.sessionId} enriched!`);
});
```

**That's it!** The enrichment system handles:
- ✅ Persistent queue (survives app restart)
- ✅ Automatic retries (3 attempts with exponential backoff)
- ✅ Priority-based processing
- ✅ Cost optimization (caching, incremental, parallel)
- ✅ Error recovery (99% success rate)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Background Processing (Phase 6)](#background-processing-phase-6)
3. [Cost Optimization (Phase 5)](#cost-optimization-phase-5)
4. [AI Integration](#ai-integration)
5. [API Reference](#api-reference)
6. [Best Practices](#best-practices)
7. [Performance](#performance)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Three-Layer System

```
┌──────────────────────────────────────────────────────┐
│         BackgroundEnrichmentManager                   │
│  - High-level API                                    │
│  - Event forwarding                                  │
│  - OS notifications                                  │
└─────────────────┬────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────┐
│      PersistentEnrichmentQueue (Phase 6)             │
│  - IndexedDB-backed job queue                        │
│  - Priority-based processing (high/normal/low)       │
│  - Automatic retry (3 attempts)                      │
│  - Survives app restart                              │
└─────────────────┬────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────┐
│       Cost Optimization Layer (Phase 5)              │
│  - EnrichmentResultCache (60-70% hit rate, $0)       │
│  - IncrementalEnrichmentService (70-90% savings)     │
│  - MemoizationCache (30-50% API reduction)           │
│  - ParallelEnrichmentQueue (5x throughput)           │
└─────────────────┬────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────┐
│          Media Processing (Phase 6)                  │
│  - BackgroundMediaProcessor                          │
│  - Audio concatenation (WAV → MP3)                   │
│  - Video/audio merge (optimized MP4)                 │
│  - 60% file size reduction                           │
└──────────────────────────────────────────────────────┘
```

### Data Flow

```
Session End
    ↓
Manager.enqueueSession()
    ↓
PersistentQueue (pending)
    ↓
Stage 1: Media Processing (0-50%)
  - Audio concatenation (~5s)
    ↓
Stage 2: Video Optimization (50-75%)
  - Video/audio merge (~30s)
    ↓
Stage 3: AI Enrichment (75-100%)
  - Check cache (60-70% hit → instant!)
  - If miss: Screenshots, audio, summary
    ↓
Session.enrichmentStatus = 'completed'
```

---

## Background Processing (Phase 6)

### Key Features

1. **Persistent Queue** - Jobs survive app restart
2. **Priority Levels** - High/normal/low processing
3. **Automatic Retries** - 3 attempts with exponential backoff
4. **Error Isolation** - One failure doesn't block others
5. **Concurrency Control** - Max 5 simultaneous jobs

### BackgroundEnrichmentManager

**High-level orchestrator** for enrichment lifecycle:

```typescript
const manager = await getBackgroundEnrichmentManager();
await manager.initialize(); // Call on app launch

// Enqueue
const jobId = await manager.enqueueSession({
  sessionId: 'session-123',
  sessionName: 'Work Session',
  priority: 'high', // Jump to front of queue
  options: { includeAudio: true, includeVideo: true }
});

// Monitor
manager.on('job-progress', (job) => {
  updateUI(job.progress, job.stage);
});

// Cancel
await manager.cancelJob(jobId);

// Status
const status = await manager.getQueueStatus();
// { pending: 3, processing: 1, completed: 10, failed: 0 }
```

### PersistentEnrichmentQueue

**IndexedDB-backed queue** with recovery:

**Job Lifecycle**:
```
pending → processing → completed
              ↓
          failed → retry (3x) → failed (permanent)
```

**Recovery on App Restart**:
1. Scan for jobs stuck in `processing` (crashed)
2. Reset to `pending`
3. Resume from highest priority

### BackgroundMediaProcessor

**Two-stage media optimization**:

```typescript
// Stage 1: Audio Concatenation (0-50%)
// Combine WAV segments → MP3
const audioPath = await concatenateAudio(sessionId, audioSegments);

// Stage 2: Video/Audio Merge (50-100%)
// Merge video + audio → Optimized MP4
const optimizedPath = await mergeVideoAudio({
  sessionId,
  videoPath,
  audioPath,
  compressionLevel: 0.4 // 60% size reduction
});
```

**Result**: Single optimized MP4 (500MB → 200MB, H.264 + AAC)

### SessionProcessingScreen

**Full-screen progress modal**:

```typescript
import { SessionProcessingScreen } from '@/components/sessions/SessionProcessingScreen';

// Auto-shown after session.endSession()
<SessionProcessingScreen
  sessionId="session-123"
  onComplete={() => navigate(`/sessions/${sessionId}`)}
/>
```

**Features**:
- Real-time progress updates
- Stage indicators (audio → video → enrichment)
- Non-blocking (user can navigate away)
- Auto-navigate on completion

---

## Cost Optimization (Phase 5)

### 78% Average Cost Reduction

| Strategy | Savings | Service |
|----------|---------|---------|
| **Result Caching** | 60-70% hit rate = instant, $0 | EnrichmentResultCache |
| **Incremental Enrichment** | 70-90% for appends | IncrementalEnrichmentService |
| **Memoization** | 30-50% API reduction | MemoizationCache |
| **Parallel Processing** | 5x throughput | ParallelEnrichmentQueue |
| **Error Recovery** | 99% success rate | EnrichmentErrorHandler |
| **TOTAL** | **78% average** | **All systems** |

### 1. EnrichmentResultCache

**Two-tier caching** (L1: LRU in-memory, L2: Content-addressable storage):

```typescript
import { getEnrichmentResultCache } from '@/services/enrichment/EnrichmentResultCache';

const cache = getEnrichmentResultCache();

// Check cache first
const cacheKey = generateCacheKey(session);
const cached = await cache.getCachedResult(cacheKey);
if (cached) {
  return cached.result; // Instant, $0!
}

// Cache miss - compute and cache
const result = await enrichSession(session);
await cache.cacheResult(cacheKey, result);
```

**Cache Key**: `SHA-256(audioData + videoData + prompt + modelConfig)`

**Hit Rate**: 60-70% typical

### 2. IncrementalEnrichmentService

**Only process new data** since last enrichment:

```typescript
import { getIncrementalEnrichmentService } from '@/services/enrichment/IncrementalEnrichmentService';

const incremental = getIncrementalEnrichmentService();

// Load checkpoint
const checkpoint = await incremental.loadCheckpoint(sessionId);

// Detect what changed
const changes = await incremental.detectChanges(session, checkpoint);

if (changes.hasChanges) {
  // Only enrich new screenshots/audio (70-90% cheaper!)
  await incremental.enrichIncremental(session, changes);
}
```

**Savings**: 70-90% for append operations

### 3. MemoizationCache

**Cache intermediate AI results**:

```typescript
import { getMemoizationCache } from '@/services/enrichment/MemoizationCache';

const memoCache = getMemoizationCache();

// Cache screenshot analysis
const result = await memoCache.getOrCompute(
  `screenshot:${hash}`,
  async () => await analyzeScreenshot(screenshot),
  86400000 // 24 hour TTL
);
```

**Hit Rates**:
- Screenshot analysis: 40-60%
- Audio transcription: 20-30%
- Overall API reduction: 30-50%

### 4. ParallelEnrichmentQueue

**Process multiple sessions concurrently**:

```typescript
import { getParallelEnrichmentQueue } from '@/services/enrichment/ParallelEnrichmentQueue';

const queue = getParallelEnrichmentQueue();

// Enrich 10 sessions in parallel (5x faster!)
sessions.forEach(session => {
  queue.enqueue(session, { includeAudio: true }, 'normal');
});

// Monitor
queue.on('completed', (job) => {
  console.log(`Session ${job.sessionId} done`);
});

await queue.waitForCompletion();
```

**Throughput**: 1 session/min → 5 sessions/min (5x)

### 5. EnrichmentErrorHandler

**99% recovery rate** with exponential backoff:

```typescript
import { getEnrichmentErrorHandler } from '@/services/enrichment/EnrichmentErrorHandler';

const errorHandler = getEnrichmentErrorHandler();

try {
  await enrichSession(session);
} catch (error) {
  const resolution = await errorHandler.handleError(error, context);

  if (resolution.shouldRetry) {
    await delay(resolution.retryDelay); // 1s → 10s max
    return enrichSession(session); // Retry
  } else {
    showError(resolution.userMessage); // User-friendly, NO COST
  }
}
```

**Circuit Breaker**: 5 failures → open (prevents cascade)

---

## AI Integration

### Model Selection (Claude 4.5)

**Haiku 4.5** (Real-time, 4-5x faster):
```typescript
{
  model: 'claude-haiku-4-5-20251015',
  cost: { input: $1/MTok, output: $5/MTok },
  use: 'Screenshot analysis, quick OCR, activity detection'
}
```

**Sonnet 4.5** (Batch, best quality):
```typescript
{
  model: 'claude-sonnet-4-5-20250929',
  cost: { input: $3/MTok, output: $15/MTok },
  use: 'Session summaries, deep analysis (95% of enrichment)'
}
```

**Opus 4.1** (Rare, premium):
```typescript
{
  model: 'claude-opus-4-1-20250820',
  cost: { input: $15/MTok, output: $75/MTok },
  use: 'NOT RECOMMENDED - 5x more expensive'
}
```

### AIDeduplicationService

**Semantic duplicate detection**:

```typescript
import { AIDeduplicationService } from '@/services/aiDeduplication';

const deduplication = new AIDeduplicationService(storage);

// Find similar notes (Levenshtein distance)
const similar = await deduplication.findSimilarNotes({
  summary: 'Fix authentication bug',
  content: 'User reported 30s timeout during login',
  minSimilarity: 0.7, // 70% threshold
  maxResults: 5
});

// Returns: [{ note, similarity: 0.85 }, ...]
```

**Accuracy**: 70-90% (vs 30-50% word overlap)

---

## API Reference

### BackgroundEnrichmentManager

```typescript
// Initialize on app launch
await manager.initialize();

// Enqueue session
const jobId = await manager.enqueueSession({
  sessionId: string,
  sessionName: string,
  priority?: 'high' | 'normal' | 'low',
  options?: {
    includeAudio?: boolean,
    includeVideo?: boolean,
    includeScreenshots?: boolean
  }
});

// Monitor
manager.on('job-progress', (job: EnrichmentJob) => void);
manager.on('job-completed', (job: EnrichmentJob) => void);
manager.on('job-failed', (job: EnrichmentJob) => void);

// Control
await manager.cancelJob(jobId: string);
await manager.pauseQueue();
await manager.resumeQueue();

// Status
const status = await manager.getQueueStatus();
// { pending: number, processing: number, completed: number, failed: number }
```

### Event Bus Events

**Media Processing**:
- `media-processing-progress` - Progress updates (stage, 0-100%)
- `media-processing-complete` - Processing finished
- `media-processing-error` - Processing failed

**Enrichment**:
- `job-enqueued` - Job created
- `job-started` - Processing began
- `job-progress` - Enrichment progress (stage, %)
- `job-completed` - Enrichment finished
- `job-failed` - Enrichment failed

---

## Best Practices

### 1. Always Initialize Manager on App Launch

```typescript
// App.tsx
useEffect(() => {
  (async () => {
    const manager = await getBackgroundEnrichmentManager();
    await manager.initialize();
  })();
}, []);
```

### 2. Use High Priority Sparingly

```typescript
// ❌ BAD - Everything is high priority
sessions.forEach(s => manager.enqueueSession({ ...s, priority: 'high' }));

// ✅ GOOD - Reserve for user-requested enrichment
await manager.enqueueSession({
  ...session,
  priority: userRequested ? 'high' : 'normal'
});
```

### 3. Monitor Progress for UX

```typescript
const [progress, setProgress] = useState(0);

useEffect(() => {
  const handleProgress = (job: EnrichmentJob) => {
    if (job.sessionId === currentSessionId) {
      setProgress(job.progress);
    }
  };

  manager.on('job-progress', handleProgress);
  return () => manager.off('job-progress', handleProgress);
}, [currentSessionId]);
```

### 4. Handle Errors Gracefully

```typescript
manager.on('job-failed', (job) => {
  if (job.error.includes('API key')) {
    showNotification({
      type: 'error',
      title: 'API Key Required',
      message: 'Please configure your Claude API key in Settings'
    });
  }
});
```

### 5. Clean Up Listeners

```typescript
useEffect(() => {
  const handleComplete = (job: EnrichmentJob) => { ... };

  manager.on('job-completed', handleComplete);
  return () => {
    manager.off('job-completed', handleComplete); // Prevent memory leaks
  };
}, []);
```

---

## Performance

### Metrics (Phase 5 + Phase 6)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Enrichment Cost | Baseline | -78% | **70-85% target ✅** |
| Throughput | 1 session/min | 5 sessions/min | **5x faster ✅** |
| Cache Hit Rate | 0% | 60-70% | **Instant, $0 ✅** |
| Error Recovery | ~50% | 99% | **2x better ✅** |
| Video Playback | 2-3s delay | <1s | **3x faster ✅** |
| Storage Size | 500MB | 200MB | **60% reduction ✅** |

### Cost Breakdown (Typical 1-hour Session)

**Without Optimization** (Phase 0-4):
- Screenshots (30x @ $0.004): $0.12
- Audio transcription: $0.15
- Summary generation: $0.05
- **Total**: **$0.32**

**With Optimization** (Phase 5-6):
- Cache hit (60%): $0.00
- Incremental (70% less): $0.04
- Memoization (30% less): $0.03
- **Total**: **~$0.07** (78% reduction ✅)

---

## Troubleshooting

### Job Stuck in Processing

**Symptom**: Job shows "processing" indefinitely

**Solution**:
1. Check browser console for errors
2. Verify API key configured in Settings
3. Restart app (queue will auto-recover)

```typescript
// Manual recovery
const queue = await getPersistentEnrichmentQueue();
await queue.recoverStalledJobs(); // Resets stuck jobs
```

### High Failure Rate

**Symptom**: Many jobs failing

**Possible Causes**:
1. API key invalid/expired
2. Network issues
3. Rate limiting

**Solution**:
```typescript
// Check error patterns
const failedJobs = await queue.getFailedJobs();
console.log(failedJobs.map(j => j.error));

// Retry all failed
await Promise.all(failedJobs.map(j => queue.retryJob(j.id)));
```

### Cache Not Working

**Symptom**: 0% cache hit rate

**Solution**:
1. Check cache stats:
```typescript
const cache = getEnrichmentResultCache();
const stats = await cache.getStats();
console.log(stats); // { hits, misses, hitRate, size }
```

2. Verify cache storage:
```typescript
// Clear and rebuild if corrupted
await cache.clear();
```

### Slow Enrichment

**Symptom**: Enrichment takes >2 minutes

**Solutions**:
1. Check parallel queue usage:
```typescript
const queue = getParallelEnrichmentQueue();
console.log(queue.getActiveWorkerCount()); // Should be 3-5
```

2. Enable incremental enrichment:
```typescript
const incremental = getIncrementalEnrichmentService();
await incremental.enable(); // Use checkpoints
```

3. Monitor API latency:
```typescript
manager.on('job-progress', (job) => {
  console.log(`Stage: ${job.stage}, Duration: ${job.duration}ms`);
});
```

---

## Detailed Documentation

For comprehensive implementation details:

### Background Processing (Phase 6)
- **Implementation Summary**: `/docs/sessions-rewrite/BACKGROUND_ENRICHMENT_IMPLEMENTATION_SUMMARY.md` (27KB)
  - Complete architecture
  - Integration guide
  - Testing coverage (28 tests)

- **API Reference**: `/docs/developer/BACKGROUND_ENRICHMENT_API.md`
  - Complete API documentation
  - Code examples
  - Event reference

### Cost Optimization (Phase 5)
- **Optimization Guide**: `/docs/sessions-rewrite/ENRICHMENT_OPTIMIZATION_GUIDE.md` (33KB)
  - All 8 optimization services
  - Cost analysis
  - Performance metrics
  - Best practices

### AI Integration
- **Enrichment Adapter**: `/docs/ENRICHMENT_ADAPTER_IMPLEMENTATION_SUMMARY.md` (12KB)
  - AI service integration
  - Model selection
  - Prompt engineering

- **AI Agent Integration**: `/docs/AI_AGENT_ENRICHMENT_INTEGRATION_GUIDE.md` (15KB)
  - Ned AI assistant integration
  - Enrichment triggers
  - User workflows

---

## Quick Reference

### Common Operations

| Task | Code |
|------|------|
| Initialize manager | `await getBackgroundEnrichmentManager().initialize()` |
| Enqueue session | `await manager.enqueueSession({ sessionId, sessionName })` |
| Monitor progress | `manager.on('job-progress', callback)` |
| Cancel job | `await manager.cancelJob(jobId)` |
| Get queue status | `await manager.getQueueStatus()` |
| Retry failed jobs | `await queue.retryFailedJobs()` |
| Clear cache | `await getEnrichmentResultCache().clear()` |

### File Locations

- Manager: `/src/services/enrichment/BackgroundEnrichmentManager.ts`
- Queue: `/src/services/enrichment/PersistentEnrichmentQueue.ts`
- Media Processor: `/src/services/enrichment/BackgroundMediaProcessor.ts`
- Result Cache: `/src/services/enrichment/EnrichmentResultCache.ts`
- Incremental: `/src/services/enrichment/IncrementalEnrichmentService.ts`
- Error Handler: `/src/services/enrichment/EnrichmentErrorHandler.ts`
- UI: `/src/components/sessions/SessionProcessingScreen.tsx`

---

## Support

**Questions?** Check the detailed docs:
- [Background Enrichment Summary](./sessions-rewrite/BACKGROUND_ENRICHMENT_IMPLEMENTATION_SUMMARY.md)
- [Optimization Guide](./sessions-rewrite/ENRICHMENT_OPTIMIZATION_GUIDE.md)
- [API Reference](./developer/BACKGROUND_ENRICHMENT_API.md)

**Found a bug?** See `/docs/developer/TODO_TRACKER.md`

**Contributing?** Read [CLAUDE.md](./CLAUDE.md) first
