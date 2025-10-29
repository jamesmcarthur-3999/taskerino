# Taskerino Quick Reference: Bulk Operations & Re-processing

## Executive Summary

Taskerino has a **production-ready architecture** for implementing bulk operations and re-processing features:

1. **Bulk Operations Already Exist** - NotesContext and TasksContext have BATCH_* actions
2. **Storage is Optimized** - PersistenceQueue handles batching automatically (Phase 4)
3. **Relationships System Ready** - Can link re-processed items automatically
4. **Progress Tracking Pattern Available** - EnrichmentContext shows the pattern
5. **All AI Services Ready** - Audio, video, text processing services in production

---

## Key Architecture Files

### State Management (What to Read First)

| File | Purpose | Key Exports | Bulk Support |
|------|---------|-------------|--------------|
| `src/context/SessionListContext.tsx` | Session list CRUD, filtering | `useSessionList()` | ✓ loadSessions, refreshSessions |
| `src/context/ActiveSessionContext.tsx` | Active session lifecycle | `useActiveSession()` | — Single session only |
| `src/context/NotesContext.tsx` | Note CRUD + cross-linking | `useNotes()` | ✓ `BATCH_ADD_NOTES` action |
| `src/context/TasksContext.tsx` | Task CRUD + completion | `useTasks()` | ✓ `BATCH_ADD/UPDATE/DELETE_TASKS` |
| `src/context/EnrichmentContext.tsx` | Enrichment progress tracking | `useEnrichmentContext()` | ✓ Multiple concurrent enrichments |
| `src/context/RelationshipContext.tsx` | Relationship management | `useRelationships()` | ✓ Bidirectional sync included |

### Storage & Persistence

| File | Purpose | Line Count | Key Features |
|------|---------|-----------|--------------|
| `src/services/storage/ChunkedSessionStorage.ts` | Session storage | ~800 | Metadata loading (10ms), progressive chunks |
| `src/services/storage/ContentAddressableStorage.ts` | Deduplication | ~600 | SHA-256 dedup, ref counting, GC |
| `src/services/storage/InvertedIndexManager.ts` | Full-text search | ~700 | 7 indexes, <100ms search |
| `src/services/storage/PersistenceQueue.ts` | Background persistence | ~500 | Priority batching, 0ms UI blocking |
| `src/services/storage/LRUCache.ts` | In-memory cache | ~400 | 100MB, >90% hit rate target |
| `src/services/storage/relationshipIndex.ts` | Relationship lookup | ~300 | O(1) lookups |

### AI Processing

| File | Purpose | Entrypoint |
|------|---------|-----------|
| `src/services/sessionEnrichmentService.ts` | Enrichment orchestration | `enrichSession(session, options)` |
| `src/services/claudeService.ts` | Text/topic/task processing | `processInput(text, ...)` |
| `src/services/audioReviewService.ts` | Audio analysis | `analyzeAudio(audioPath)` |
| `src/services/videoChapteringService.ts` | Video analysis | `generateChapters(videoPath)` |
| `src/services/aiCanvasGenerator.ts` | Layout generation | `generateCanvas(session)` |

### Relationship System

| File | Purpose | Pattern |
|------|---------|---------|
| `src/services/relationshipManager.ts` | Core CRUD + transactions | `relationshipManager.addRelationship(params)` |
| `src/context/RelationshipContext.tsx` | React wrapper | `useRelationships()` hook |
| `src/services/eventBus.ts` | Pub/sub for updates | `eventBus.on('RELATIONSHIP_ADDED', handler)` |
| `src/types/relationships.ts` | Type definitions | 8 relationship types defined |

---

## Bulk Operations - What's Already Implemented

### Tasks Bulk Update Pattern

```typescript
import { useTasks } from '@/context/TasksContext';

const { dispatch } = useTasks();

// Bulk update (mark as done)
dispatch({
  type: 'BATCH_UPDATE_TASKS',
  payload: {
    ids: ['task-1', 'task-2', 'task-3'],
    updates: { done: true, status: 'done' }
  }
});

// Bulk add
dispatch({
  type: 'BATCH_ADD_TASKS',
  payload: newTasks // Task[]
});

// Bulk delete
dispatch({
  type: 'BATCH_DELETE_TASKS',
  payload: ['task-1', 'task-2']
});
```

### Notes Bulk Add Pattern

```typescript
import { useNotes } from '@/context/NotesContext';

const { dispatch } = useNotes();

dispatch({
  type: 'BATCH_ADD_NOTES',
  payload: newNotes // Note[]
});
```

---

## Data Flow for New Items

```
User Input
  ↓
claudeService.processInput()
  • Detects topics
  • Merges similar notes
  • Extracts tasks
  ↓
dispatch(BATCH_ADD_NOTES) + dispatch(BATCH_ADD_TASKS)
  ↓
NotesContext reducer + TasksContext reducer
  ↓
State updated (instant UI)
  ↓
useEffect saves to storage (5s debounce)
  ↓
PersistenceQueue batches writes
  ↓
ChunkedSessionStorage + InvertedIndexManager updated
  ↓
Done (0ms UI blocking)
```

---

## Progress Tracking Pattern (EnrichmentContext)

For implementing progress callbacks during long operations:

```typescript
import { useEnrichmentContext } from '@/context/EnrichmentContext';

function MyReprocessingComponent() {
  const enrichmentContext = useEnrichmentContext();

  const handleReprocess = async () => {
    enrichmentContext.startTracking('session-123', 'My Session');
    
    try {
      await reprocessingService.reprocess(options, {
        onProgress: (progress) => {
          enrichmentContext.updateProgress('session-123', progress);
        }
      });
    } finally {
      enrichmentContext.stopTracking('session-123');
    }
  };

  const active = enrichmentContext.getActiveEnrichment('session-123');
  if (active) {
    return <ProgressBar value={active.progress} stage={active.stage} />;
  }
}
```

---

## Relationship Linking Pattern

After re-processing (e.g., re-extracting tasks from a note):

```typescript
import { useRelationships } from '@/context/RelationshipContext';

const { addRelationship } = useRelationships();

// Link newly extracted task to original note
await addRelationship({
  sourceType: 'task',
  sourceId: newTask.id,
  targetType: 'note',
  targetId: note.id,
  type: 'task-note',
  metadata: {
    source: 'ai',
    confidence: 0.95,
    reasoning: 'Task extracted from note content'
  }
});

// Changes propagate via:
// 1. RelationshipContext state update (optimistic)
// 2. relationshipManager persists to storage
// 3. eventBus emits RELATIONSHIP_ADDED
// 4. All subscribers notified
// 5. PersistenceQueue batches storage write
```

---

## Persistence Queue Usage (Key for Bulk)

The PersistenceQueue automatically batches updates:

```typescript
import { getPersistenceQueue } from '@/services/storage/PersistenceQueue';

const queue = getPersistenceQueue();

// Enqueue multiple items (batched automatically)
items.forEach(item => {
  queue.enqueue('notes', item, 'normal'); // Batched 100ms
});

// Get statistics
const stats = queue.getStats();
console.log(`Pending: ${stats.pending}, Completed: ${stats.completed}`);
```

---

## Cost Tracking Pattern

Use sessionEnrichmentService pattern for cost estimation:

```typescript
// From sessionEnrichmentService.ts (lines 200-250)
interface EnrichmentOptions {
  maxCost?: number; // Cost cap in USD
  onProgress?: (progress: EnrichmentProgress) => void;
}

// Apply same pattern to re-processing:
// 1. Estimate costs before processing
// 2. Check against maxCost threshold
// 3. Track cumulative cost during processing
// 4. Emit warnings if approaching limit
// 5. Stop if exceeded
```

---

## Implementation Checklist for Re-processing

- [ ] Create `ReprocessingService` (src/services/reprocessingService.ts)
  - [ ] Type definitions (ReprocessingOptions, ReprocessingProgress)
  - [ ] Batch processing logic
  - [ ] Cost estimation and enforcement
  - [ ] Progress callbacks with throttling

- [ ] Create `ReprocessingContext` (src/context/ReprocessingContext.tsx)
  - [ ] Copy EnrichmentContext pattern
  - [ ] Track active re-processing jobs
  - [ ] Throttle updates (100ms)

- [ ] Create UI Component (src/components/ReprocessingModal.tsx)
  - [ ] Selection interface (which items to reprocess)
  - [ ] Progress display with stages
  - [ ] Cancel/pause/resume controls
  - [ ] Cost display and warnings

- [ ] Integration with existing services
  - [ ] Use claudeService for text re-processing
  - [ ] Use sessionEnrichmentService for session re-enrichment
  - [ ] Use relationshipManager for relationship updates
  - [ ] Use PersistenceQueue for batched persistence

- [ ] Testing
  - [ ] Batch operation tests
  - [ ] Cost calculation tests
  - [ ] Progress callback tests
  - [ ] Storage integration tests
  - [ ] Relationship update tests

---

## Key Performance Metrics (Current)

| Operation | Time | Notes |
|-----------|------|-------|
| Load session list (metadata only) | <1ms | Via ChunkedSessionStorage |
| Load full session (1000 screenshots) | <1s | Progressive chunked loading |
| Search 1000 sessions | <100ms | Via InvertedIndexManager (7 indexes) |
| Add 100 tasks (batch) | Instant | Stored in PersistenceQueue, 0ms blocking |
| Update cache hit rate | >90% | Target hit rate for hot data |
| UI blocking on save | 0ms | Via PersistenceQueue background processing |
| Storage reduction | 50% | Via ContentAddressableStorage deduplication |

---

## Next Steps

1. **Read Full Architecture Document**: `/Users/jamesmcarthur/Documents/taskerino/ARCHITECTURE_DATA_FLOW_ANALYSIS.md`

2. **Study Existing Patterns**:
   - EnrichmentContext (progress tracking)
   - sessionEnrichmentService (parallel processing)
   - RelationshipManager (atomic operations)
   - PersistenceQueue (background batching)

3. **Implement ReprocessingService**:
   - Follow existing service patterns
   - Use PersistenceQueue for persistence
   - Emit progress via callbacks
   - Track cost in real-time

4. **Create UI**:
   - Bulk selection interface
   - Progress monitoring
   - Cost display
   - Control buttons

5. **Test**:
   - 100+ items batch processing
   - Cost estimation accuracy
   - Relationship linking on re-process
   - Storage persistence verification

---

## Common Gotchas

1. **Don't debounce saves manually** - PersistenceQueue handles it automatically
2. **Always use RelationshipManager for linking** - Never update relationship arrays directly
3. **Emit eventBus events after updates** - For cross-window sync and consistency
4. **Use transactions for multi-table updates** - Atomicity is critical
5. **Throttle progress updates to 100ms** - Smoother UI, lower CPU usage
6. **Check for existing relationships** - Prevent duplicates with `relationshipManager.hasRelationship()`
7. **Estimate costs before processing** - Ask user permission first
8. **Implement cancellation support** - Users need to stop long operations
9. **Use PersistenceQueue priority levels** - Critical/normal/low affect batching
10. **Update InvertedIndexManager after bulk changes** - Re-run indexing after large updates

---

**Generated**: October 26, 2025  
**For**: Taskerino Re-processing & Bulk Operations Implementation
