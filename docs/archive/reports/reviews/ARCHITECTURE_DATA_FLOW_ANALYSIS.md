# Taskerino Architecture & Data Flow Analysis
## Re-processing and Bulk Operations Implementation Guide

**Date**: October 26, 2025  
**App Type**: Tauri 2.0 (Desktop) + React 19 + TypeScript  
**Database**: IndexedDB (browser) + Tauri File System (desktop) with dual adapters  
**State Management**: React Context (multiple specialized contexts) + XState machines  

---

## 1. HIGH-LEVEL DATA FLOW ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER INPUT LAYER                               │
│  (Capture Zone, Manual Entry, Voice, Screenshots, Video)                │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      ACTIVE SESSION CONTEXT                             │
│  • Manages current work session state                                    │
│  • Tracks screenshots, audio segments, video                            │
│  • Accumulates data during active session (no persistence yet)          │
│  File: src/context/ActiveSessionContext.tsx                             │
│  Exports: startSession, pauseSession, endSession, addScreenshot, etc.   │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                   ┌─────────┴─────────┐
                   │                   │
         End Session ▼                 │
┌───────────────────────────┐         │
│  CHUNKED STORAGE          │         │ (Active)
│  saveFullSession()        │         │
│  Progressive chunks       │         │ Session
│  Metadata first, data by  │         │ State
│  chunk                    │         │
│  File:                    │         │
│  ChunkedSessionStorage.ts │         │
└───────────┬───────────────┘         │
            │                          │
    ┌───────▼──────────┐              │
    │ Session Complete │              │
    │ Add to list      │              │
    └───────┬──────────┘              │
            │                          │
            ▼                          │
┌───────────────────────────────────────────────────┐
│         SESSION LIST CONTEXT                      │
│  • In-memory list of completed sessions           │
│  • Filtering, sorting, metadata loading           │
│  • Links to full sessions via IDs                 │
│  File: SessionListContext.tsx                     │
│  Exports: sessions[], updateSession(), etc.       │
└───────────┬─────────────────────────────────────┘
            │
            ├────────────────────────────────────────┐
            │                                        │
            ▼                                        ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│  ENRICHMENT PIPELINE     │      │ USER MANUAL OPERATIONS   │
│  sessionEnrichmentService│      │ (Create/Edit/Delete)     │
│  • Audio review          │      │                          │
│  • Video chaptering      │      │ NotesContext, TasksContext
│  • Summary generation    │      │ EntitiesContext          │
│  • Canvas generation     │      └──────────────────────────┘
│  • Cost tracking         │
│  • Progress monitoring   │
│  File:                   │
│  sessionEnrichmentSrvce  │
└───────────┬──────────────┘
            │
            ├─ AI Processing:
            │  • claudeService (text/topic/task extraction)
            │  • audioReviewService (GPT-4o audio analysis)
            │  • videoChapteringService (frame analysis)
            │  • sessionsAgentService (insight extraction)
            │  • aiCanvasGenerator (layout generation)
            │
            ▼
┌─────────────────────────────────────────────────┐
│        PERSISTENT STORAGE LAYER                 │
│                                                 │
│  ChunkedSessionStorage                          │
│  ├─ /sessions-chunked/{id}/                    │
│  │  ├─ metadata.json (~10 KB)                  │
│  │  ├─ summary.json                             │
│  │  ├─ screenshots/chunk-*.json (20 each)      │
│  │  └─ audioSegments/chunk-*.json              │
│  │                                              │
│  ContentAddressableStorage                      │
│  ├─ /attachments-ca/{hash}/                    │
│  │  ├─ data.bin (actual file)                  │
│  │  └─ metadata.json (refCount, refs)          │
│  │                                              │
│  InvertedIndexManager                           │
│  ├─ /session-indexes (7 indexes)               │
│  │  ├─ by-topic, by-date, by-tag               │
│  │  ├─ full-text, by-category, etc.            │
│  │                                              │
│  PersistenceQueue                               │
│  ├─ Priority levels: critical/normal/low       │
│  ├─ Batching (chunks, indexes, CA storage)    │
│  ├─ Automatic retry with backoff               │
│  └─ 0ms UI blocking via background processing │
│                                                 │
│  LRUCache (100MB default)                       │
│  └─ >90% hit rate for hot data                 │
│                                                 │
│  StorageAdapter (Dual)                          │
│  ├─ IndexedDBAdapter (browser)                 │
│  └─ TauriFileSystemAdapter (desktop)           │
│                                                 │
│  File: src/services/storage/                    │
└─────────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────┐
│     RELATIONSHIP MANAGEMENT LAYER               │
│                                                 │
│  RelationshipManager (Core Service)             │
│  • Bidirectional sync                           │
│  • Atomic transactions                          │
│  • O(1) lookups via RelationshipIndex           │
│  • Strategy pattern for type-specific logic     │
│                                                 │
│  RelationshipContext (React wrapper)            │
│  • Optimistic updates                           │
│  • Automatic rollback on error                  │
│  • Event-driven updates via eventBus            │
│                                                 │
│  EventBus (Pub/Sub System)                      │
│  Events:                                        │
│  • RELATIONSHIP_ADDED                           │
│  • RELATIONSHIP_REMOVED                         │
│  • RELATIONSHIP_UPDATED                         │
│  • ENTITY_DELETED                               │
│                                                 │
│  File: src/services/relationshipManager.ts     │
│        src/services/eventBus.ts                │
│        src/context/RelationshipContext.tsx     │
└─────────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────┐
│     SPECIALIZED ENTITY CONTEXTS                 │
│  (IN-MEMORY STATE MANAGEMENT)                   │
│                                                 │
│  NotesContext                                   │
│  • CRUD: add/update/delete notes                │
│  • BATCH: batch operations                      │
│  • Cross-context: link to topics, companies     │
│  • QueryEngine for filtered searches             │
│                                                 │
│  TasksContext                                   │
│  • CRUD: add/update/delete tasks                │
│  • BATCH: batch add/update/delete               │
│  • Toggle completion status                     │
│  • Link to notes, sessions                      │
│                                                 │
│  EntitiesContext                                │
│  • Topics, Companies, Contacts (metadata)      │
│  • noteCount, taskCount tracking                │
│                                                 │
│  EnrichmentContext                              │
│  • Tracks active enrichments (progress)         │
│  • Throttled updates (100ms)                    │
│  • No storage writes during enrichment          │
│  • Multi-enrichment support                     │
│                                                 │
│  File: src/context/                             │
└─────────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────────┐
│           UI LAYER                              │
│  • 6 Zone navigation (Capture, Tasks, Notes,   │
│    Sessions, Assistant, Profile)                │
│  • TopNavigation + MenuMorphPill animations     │
│  • MorphingCanvas for session reviews           │
│  • Real-time updates via context changes        │
└─────────────────────────────────────────────────┘
```

---

## 2. STATE MANAGEMENT ARCHITECTURE

### 2.1 Context Hierarchy (Phase 1 - Current)

```
┌─────────────────────────────────────┐
│        APP PROVIDERS (Root)         │
├─────────────────────────────────────┤
│  • SettingsProvider                 │
│  • UIProvider                       │
│  • ThemeProvider                    │
│  • ScrollAnimationProvider          │
│  • RelationshipProvider             │
│  • EntitiesProvider                 │
│  • NotesProvider                    │
│  • TasksProvider                    │
│  • EnrichmentProvider               │
│  • SessionListProvider              │
│  • ActiveSessionProvider            │
│  • RecordingProvider                │
└──────────────────┬──────────────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
         ▼                    ▼
  ┌─────────────┐      ┌──────────────┐
  │   Zones     │      │   Sidebar    │
  │ (lazy-load) │      │   Details    │
  └─────────────┘      └──────────────┘
```

### 2.2 Context-Specific Responsibilities

**SettingsContext** (`src/context/SettingsContext.tsx`)
- Line 1-50: Type definitions for settings state
- User AI configuration (Claude API key, GPT-4o key, OpenAI key)
- Feature flags, enrichment preferences
- Exports: `useSettings()` hook with state and update methods

**NotesContext** (`src/context/NotesContext.tsx`)
- Lines 11-109: State management with reducer pattern
- **Actions**: 
  - `ADD_NOTE` (line 32)
  - `UPDATE_NOTE` (line 35)
  - `DELETE_NOTE` (line 43)
  - `BATCH_ADD_NOTES` (line 49) ✓ Supports bulk
  - `BATCH_UPDATE_NOTES` (not shown, but extensible)
- Line 102-119: Storage integration on mount
- Line 129-143: Debounced save (5s) to storage
- Cross-context linking with EntitiesContext and RelationshipContext
- **Exports**: `addNote()`, `updateNote()`, `deleteNote()`, `batchAddNotes()`, `queryNotes()`

**TasksContext** (`src/context/TasksContext.tsx`)
- Lines 11-109: Similar reducer pattern to NotesContext
- **Actions**:
  - `ADD_TASK` (line 34)
  - `UPDATE_TASK` (line 38)
  - `DELETE_TASK` (line 45)
  - `BATCH_ADD_TASKS` (line 66) ✓ Supports bulk
  - `BATCH_UPDATE_TASKS` (line 69) ✓ Supports bulk
  - `BATCH_DELETE_TASKS` (line 79) ✓ Supports bulk
  - `TOGGLE_TASK` (line 51)
- Line 142-150: Storage integration
- Relationship linking with NotesContext and SessionListContext
- **Exports**: Task CRUD and batch operations

**SessionListContext** (`src/context/SessionListContext.tsx`)
- Lines 31-93: Rich state with filtering/sorting
- **State**:
  - `sessions: Session[]` - Completed sessions
  - `filter: SessionFilter | null` - Active filter
  - `sortBy: SessionSortOption` - Sorting
- **Actions**:
  - `LOAD_SESSIONS_START/SUCCESS/ERROR` (lines 101-108)
  - `ADD_SESSION`, `UPDATE_SESSION`, `DELETE_SESSION` (lines 110-127)
  - `SET_FILTER`, `SET_SORT` (lines 129-133)
- Line 87-90: Relationship helpers (linkSessionToTask, linkSessionToNote)
- **Exports**: Full session management API

**ActiveSessionContext** (`src/context/ActiveSessionContext.tsx`)
- Lines 28-55: Context value interface
- **Manages**: Currently active session (only ONE at a time)
- **Lifecycle**:
  - `startSession()` (line 34) - Creates new session
  - `pauseSession()` (line 35)
  - `resumeSession()` (line 36)
  - `endSession()` (line 37)
- **Data Updates**:
  - `addScreenshot()` (line 44)
  - `addAudioSegment()` (line 45)
  - `updateScreenshotAnalysis()` (line 47)
  - `addScreenshotComment()` (line 48)
- Line 69: Coordinates with SessionListContext for handoff
- **Exports**: Active session lifecycle + data updates

**EnrichmentContext** (`src/context/EnrichmentContext.tsx`)
- Lines 17-24: ActiveEnrichment interface
- **Purpose**: Track multiple concurrent enrichments in-memory
- **No persistence** during enrichment - only progress tracking
- **Key Feature**: Throttled updates (100ms) to smooth UI animations
- **Exports**: `startTracking()`, `updateProgress()`, `stopTracking()`

**RelationshipContext** (`src/context/RelationshipContext.tsx`)
- Lines 43-95: RelationshipContextValue interface
- **Core Operations**:
  - `addRelationship()` with optimistic update (line 50)
  - `removeRelationship()` (line 56)
  - `getRelationships()` (line 64)
  - `getRelatedEntities()` (line 72)
- **Optimistic Updates**: Map<string, Relationship> for pending operations
- **Event Integration**: Subscribes to eventBus events for cross-window sync
- **Exports**: Full relationship CRUD with async operations

### 2.3 AppContext (DEPRECATED - Being Phased Out)

**Status**: DEPRECATED as of Phase 1  
**File**: `src/context/AppContext.tsx` (lines 1-1000+)  
**Reason**: Too large, too many responsibilities  

**Actions still in use**:
- Line 49: `BATCH_ADD_NOTES` (delegates to NotesContext)
- Line 57-59: Batch task operations
- Line 144: `LOAD_STATE` (legacy data load)

**Migration Path**: Migrate all actions to specialized contexts

---

## 3. STORAGE ARCHITECTURE (PHASE 4 - PRODUCTION)

### 3.1 Performance Achievements

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Session List Load | 2-3s | <1ms (metadata) | **2000x** |
| Full Session Load | 2-3s | <1s | **3x** |
| Search | 2-3s | <100ms | **20-30x** |
| Storage Size | Baseline | -50% | **2x reduction** |
| UI Blocking | 200-500ms | 0ms | **100% eliminated** |

### 3.2 Storage Components

**ChunkedSessionStorage** (`src/services/storage/ChunkedSessionStorage.ts`)
```typescript
// Usage
const chunkedStorage = await getChunkedStorage();

// Load metadata only (instant, 10ms target)
const metadata = await chunkedStorage.loadAllMetadata();

// Load full session (progressive, 500ms target)
const session = await chunkedStorage.loadFullSession(sessionId);

// Append screenshot (queued, 0ms blocking)
await chunkedStorage.appendScreenshot(sessionId, screenshot);

// Append audio segment (queued, 0ms blocking)
await chunkedStorage.appendAudioSegment(sessionId, segment);
```

**Structure**:
```
/sessions-chunked/{session-id}/
  metadata.json              # Core fields (~10 KB)
  summary.json               # AI summary (~50 KB)
  audio-insights.json        # Audio analysis (~30 KB)
  canvas-spec.json           # Canvas rendering (~40 KB)
  transcription.json         # Full transcript (~100 KB)
  screenshots/
    chunk-000.json           # ~1 MB, ~20 screenshots
    chunk-001.json
    ...
  audio-segments/
    chunk-000.json           # ~1 MB, ~100 segments
    chunk-001.json
    ...
  context-items.json         # User context
```

**ContentAddressableStorage** (`src/services/storage/ContentAddressableStorage.ts`)
```typescript
// Usage
const caStorage = await getCAStorage();

// Save attachment (auto-deduplicates if hash exists)
const hash = await caStorage.saveAttachment(attachment);
await caStorage.addReference(hash, sessionId, attachmentId);

// Run garbage collection (frees unreferenced attachments)
const result = await caStorage.collectGarbage();
```

**Structure**:
```
/attachments-ca/
  {hash-prefix}/             # First 2 chars for sharding
    {full-hash}/
      data.bin               # Actual attachment
      metadata.json          # { hash, refCount, references[] }
```

**InvertedIndexManager** (`src/services/storage/InvertedIndexManager.ts`)
```typescript
// Usage
const indexManager = await getInvertedIndexManager();

// Full-text + structured search
const result = await indexManager.search({
  text: 'authentication bug',
  tags: ['backend', 'security'],
  dateRange: { start, end },
  operator: 'AND'
});

// Update indexes after changes
await indexManager.updateSession(session);
```

**7 Indexes**:
1. by-topic - Topic-based filtering
2. by-date - Date range queries
3. by-tag - Tag matching
4. full-text - Full-text search (TF-IDF)
5. by-category - Category filtering
6. by-subcategory - Sub-category filtering
7. by-status - Status filtering (active, paused, etc.)

**LRUCache** (`src/services/storage/LRUCache.ts`)
```typescript
// Usage (transparent via ChunkedSessionStorage)
const stats = chunkedStorage.getCacheStats();
console.log(`Hit rate: ${stats.hitRate}%`); // Target: >90%

// Manual control if needed
chunkedStorage.clearCache();
chunkedStorage.clearSessionCache(sessionId);
chunkedStorage.setCacheSize(200 * 1024 * 1024); // 200MB
```

**Features**:
- Size-based eviction (100MB default)
- TTL support (5 minutes default)
- Pattern invalidation for consistency
- O(1) lookup and insertion

**PersistenceQueue** (`src/services/storage/PersistenceQueue.ts`)
```typescript
// Usage
const queue = getPersistenceQueue();

// Priority levels
queue.enqueue('sessions', sessionData, 'critical');  // Immediate
queue.enqueue('notes', noteData, 'normal');         // Batched 100ms
queue.enqueue('tags', tagData, 'low');              // Idle time

// Phase 4: Specialized batching
queue.enqueueChunk(sessionId, 'screenshots/chunk-001', data, 'normal');
queue.enqueueIndex('by-topic', topicIndex, 'low');
queue.enqueueCAStorage(hash, metadata, 'normal');

// Get statistics
const stats = queue.getStats();
```

**Priority Batching**:
- **critical**: Immediate write (max 1 retry)
- **normal**: Batched every 100ms (max 3 retries)
- **low**: Idle-time only, batched per 10s (max 5 retries)

**Phase 4 Enhancements**:
- Chunk write batching: 10 chunks → 1 transaction
- Index update batching: Multiple indexes → 1 write
- CA storage batching: 20 refs → 1 transaction

---

## 4. RELATIONSHIP MANAGEMENT SYSTEM

### 4.1 Relationship Type System

**File**: `src/types/relationships.ts`

```typescript
// Relationship types (currently supported)
TASK_NOTE: 'task-note'          // Task created from/linked to note
TASK_SESSION: 'task-session'     // Task extracted from session
NOTE_SESSION: 'note-session'     // Note created during/linked to session
TASK_TOPIC: 'task-topic'         // Task belongs to topic
NOTE_TOPIC: 'note-topic'         // Note belongs to topic
NOTE_COMPANY: 'note-company'     // Note mentions company
NOTE_CONTACT: 'note-contact'     // Note mentions contact
NOTE_PARENT: 'note-parent'       // Note threading/hierarchy

// Future types (Phase 2+)
TASK_FILE, NOTE_FILE, SESSION_FILE
TASK_TASK                         // Task dependencies
PROJECT_TASK, PROJECT_NOTE        // Project relationships
GOAL_TASK                         // Goal relationships
```

**Relationship Metadata**:
```typescript
interface RelationshipMetadata {
  source: 'ai' | 'manual' | 'migration' | 'system';
  confidence?: number;            // 0-1, AI confidence
  reasoning?: string;             // Why AI suggested it
  createdAt: string;             // ISO timestamp
  createdBy?: string;            // User ID if manual
  updatedAt?: string;
  importance?: number;           // 0-1, user-rated
  tags?: string[];               // User tags for relationship
}
```

### 4.2 RelationshipManager Service

**File**: `src/services/relationshipManager.ts`

```typescript
// Core CRUD operations
addRelationship(params: AddRelationshipParams): Promise<Relationship>
removeRelationship(relationshipId: string): Promise<void>
getRelationships(entityId: string, type?: RelationshipType): Relationship[]
getRelatedEntities<T>(entityId: string, type?: RelationshipType): Promise<T[]>

// Utility operations
hasRelationship(sourceId: string, targetId: string, type: RelationshipType): boolean
getRelationshipsBetween(sourceId: string, targetId: string): Relationship[]
updateRelationshipMetadata(relationshipId: string, metadata: Partial<RelationshipMetadata>): Promise<void>
```

**Key Features**:
- **Bidirectional Sync**: Automatically maintains relationships on both entities
- **Atomic Transactions**: All operations use transactions (all-or-nothing)
- **O(1) Lookups**: Via RelationshipIndex
- **Extensible**: Strategy pattern for type-specific logic
- **Event-Driven**: Emits events via eventBus

### 4.3 RelationshipContext (React Wrapper)

**File**: `src/context/RelationshipContext.tsx`

```typescript
// Hook usage
const { 
  addRelationship,              // Add with optimistic update
  removeRelationship,           // Remove with rollback
  getRelationships,             // Query relationships
  getRelatedEntities,           // Get related data
  isLoading,                    // Operation in progress
  error,                        // Last error
  optimisticRelationships,      // Pending updates
  stats                         // Relationship statistics
} = useRelationships();

// Example: Link task to note
const relationship = await addRelationship({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  type: 'task-note',
  metadata: {
    source: 'manual',
    importance: 0.8
  }
});

// Optimistic UI update happens immediately
// Persisted to storage asynchronously
// Rolls back automatically on error
```

**Features**:
- **Optimistic Updates**: Immediate UI feedback
- **Automatic Rollback**: On error
- **Event-Driven**: Cross-window sync via eventBus
- **Proper Cleanup**: No memory leaks

### 4.4 EventBus (Pub/Sub System)

**File**: `src/services/eventBus.ts`

```typescript
// Event types
'RELATIONSHIP_ADDED'   // New relationship created
'RELATIONSHIP_REMOVED' // Relationship deleted
'RELATIONSHIP_UPDATED' // Metadata changed
'ENTITY_DELETED'       // Entity deleted (cascades to relationships)

// Usage
const subscriptionId = eventBus.on('RELATIONSHIP_ADDED', (data) => {
  const { timestamp, source, data: payload } = data;
  console.log(`Relationship added by ${source}:`, payload);
});

// Emit event
eventBus.emit('RELATIONSHIP_ADDED', {
  relationshipId: 'rel-123',
  sourceId: 'task-456',
  targetId: 'note-789'
}, 'TasksZone');

// Unsubscribe
eventBus.off(subscriptionId);
```

**Performance**:
- O(1) subscription lookup
- O(1) emit (list handlers)
- O(n) actual delivery where n = subscriber count
- <1ms emit time with 10 subscribers
- Error isolation (one handler error doesn't affect others)

---

## 5. AI PROCESSING & ENRICHMENT PIPELINE

### 5.1 Capture Processing Flow

**File**: `src/services/claudeService.ts`

```
User Input (text/attachments)
  ↓
claudeService.processInput()
  ├─ Step 1: Topic Detection
  │  ├─ fuzzy match against existing topics
  │  ├─ confidence scoring
  │  └─ create new topic if needed
  │
  ├─ Step 2: Note Management
  │  ├─ find similar existing notes (30% similarity threshold)
  │  ├─ merge if similar
  │  └─ create new note if unique
  │
  ├─ Step 3: Task Extraction
  │  ├─ parse action items
  │  ├─ infer priority
  │  └─ set default due dates
  │
  └─ Output: AIProcessResult
     ├─ topics: Topic[]
     ├─ notes: Note[]
     ├─ tasks: Task[]
     └─ processingSteps: string[] (for UI)
```

**Usage**:
```typescript
import { claudeService } from '@/services/claudeService';

const result = await claudeService.processInput(
  'User text input',
  existingTopics,
  existingNotes,
  aiSettings,
  userLearnings,
  learningSettings,
  existingTasks,
  attachments,
  extractTasks: true
);

// result.topics: new or matched topics
// result.notes: created/merged notes
// result.tasks: extracted tasks
```

### 5.2 Session Enrichment Pipeline

**File**: `src/services/sessionEnrichmentService.ts`

```
Session Ends
  ↓
sessionEnrichmentService.enrichSession()
  │
  ├─ Step 1: Validate
  │  └─ Check has enrichable data (audio/video)
  │
  ├─ Step 2: Estimate Costs
  │  ├─ Audio review: ~$0.10 per minute
  │  ├─ Video analysis: ~$0.05 per frame
  │  └─ Summary: ~$0.02
  │
  ├─ Step 3: Acquire Lock
  │  └─ Prevent concurrent enrichment (enrichmentLockService)
  │
  ├─ Step 4: Create Checkpoint
  │  └─ Recovery point in case of failure
  │
  ├─ Step 5: Execute in Parallel
  │  ├─ Audio Review
  │  │  ├─ Concatenate audio segments
  │  │  ├─ GPT-4o audio analysis
  │  │  ├─ Full transcription
  │  │  └─ Insights extraction
  │  │
  │  └─ Video Chaptering
  │     ├─ Extract key frames
  │     ├─ Vision API analysis
  │     └─ Chapter generation
  │
  ├─ Step 6: Handle Partial Failures
  │  └─ Use Promise.allSettled for isolation
  │
  ├─ Step 7: Regenerate Summary
  │  └─ Synthesize all enriched data
  │
  ├─ Step 8: Generate Canvas
  │  └─ AI-driven layout selection
  │
  └─ Output: EnrichmentResult
     ├─ success: boolean
     ├─ audio: { completed, insights, cost }
     ├─ video: { completed, chapters, cost }
     ├─ summary: { completed, summary }
     └─ canvas: { completed, spec }
```

**Usage**:
```typescript
const result = await sessionEnrichmentService.enrichSession(session, {
  includeAudio: true,
  includeVideo: true,
  includeSummary: true,
  includeCanvas: true,
  maxCost: 5.0,
  onProgress: (progress) => {
    console.log(`${progress.stage}: ${progress.progress}%`);
    // Update EnrichmentContext for UI
  }
});
```

**Progress Tracking**:
```typescript
interface EnrichmentProgress {
  stage: 'validating' | 'estimating' | 'locking' | 'checkpointing' | 
         'audio' | 'video' | 'summary' | 'canvas' | 'complete' | 'error';
  message: string;
  progress: number;           // 0-100
  stages?: {
    audio: { status: 'pending'|'processing'|'completed'|'failed'|'skipped'; progress: number };
    video: { status, progress };
    summary: { status, progress };
    canvas: { status, progress };
  };
}
```

### 5.3 Ned AI Assistant

**File**: `src/services/nedService.ts`

```typescript
// Tool execution with permission system
interface NedPermission {
  toolName: string;
  level: 'forever' | 'session' | 'always-ask';
  grantedAt: Date;
}

// Available tools
- Search sessions by query
- List tasks (with filters)
- Create/update/delete tasks
- List notes (with filters)
- Create/update/delete notes
- Query related sessions
- Trigger session enrichment
```

**Memory System** (`nedMemory.ts`):
- Maintains conversation context
- Stores user preferences
- Tracks tool usage
- Learns from user corrections

---

## 6. BULK OPERATIONS & RE-PROCESSING PATTERNS

### 6.1 Current Bulk Operation Support

**Existing Actions** (already implemented):

```typescript
// NotesContext
dispatch({ type: 'BATCH_ADD_NOTES', payload: notes[] });

// TasksContext  
dispatch({ type: 'BATCH_ADD_TASKS', payload: tasks[] });
dispatch({ type: 'BATCH_UPDATE_TASKS', payload: { ids, updates } });
dispatch({ type: 'BATCH_DELETE_TASKS', payload: ids[] });

// AppContext (deprecated but still works)
dispatch({ type: 'BATCH_ADD_NOTES', payload: notes[] });
dispatch({ type: 'BATCH_ADD_TASKS', payload: tasks[] });
dispatch({ type: 'BATCH_UPDATE_TASKS', payload: { ids, updates } });
dispatch({ type: 'BATCH_DELETE_TASKS', payload: ids[] });
```

### 6.2 Pattern for Bulk Task Operations

```typescript
// Example: Bulk update tasks to completed
const taskIds = ['task-1', 'task-2', 'task-3'];
const updates = { done: true, status: 'done' as const };

dispatch({
  type: 'BATCH_UPDATE_TASKS',
  payload: { ids: taskIds, updates }
});

// Storage happens via PersistenceQueue (debounced 5s)
```

### 6.3 Proposed Re-processing Pattern

For implementing **re-processing** (re-enriching sessions, re-extracting relationships):

```typescript
// New re-processing service pattern
export interface ReprocessingOptions {
  // What to reprocess
  target: 'sessions' | 'notes' | 'tasks' | 'relationships';
  
  // Which items
  itemIds?: string[];                    // Specific items
  filter?: { status?: string; dateRange?: {} };  // Filtered items
  
  // How to reprocess
  processors: {
    audio?: boolean;               // Re-run audio review
    video?: boolean;               // Re-run video analysis
    summary?: boolean;             // Regenerate summary
    extractRelationships?: boolean; // Re-extract AI relationships
    deduplication?: boolean;       // Re-run deduplication
  };
  
  // Control
  batchSize?: number;             // Items per batch (10-50)
  concurrency?: number;           // Parallel processors (1-5)
  maxCostPerItem?: number;        // Cost cap per item
  dryRun?: boolean;               // Preview without changes
  
  // Callbacks
  onProgress?: (progress: ReprocessingProgress) => void;
  onError?: (error: ReprocessingError) => void;
}

interface ReprocessingProgress {
  stage: 'validating' | 'estimating' | 'processing' | 'saving' | 'complete';
  processed: number;              // Items done
  total: number;                  // Total items
  percentage: number;             // 0-100
  currentItem: { id: string; name: string };
  estimatedTimeRemaining: number; // milliseconds
}

interface ReprocessingResult {
  success: boolean;
  processed: number;
  failed: number;
  totalCost: number;
  errors: ReprocessingError[];
  updates: {
    sessions?: Session[];
    notes?: Note[];
    tasks?: Task[];
    relationships?: Relationship[];
  };
}

// Usage
const result = await reprocessingService.reprocess({
  target: 'sessions',
  filter: { status: 'completed', dateRange: { days: 7 } },
  processors: {
    audio: true,
    video: true,
    summary: true,
    extractRelationships: true
  },
  batchSize: 20,
  concurrency: 3,
  onProgress: (progress) => {
    updateUI(`${progress.processed}/${progress.total}`);
  }
});
```

---

## 7. DATA PERSISTENCE & UPDATE PROPAGATION

### 7.1 Save Flow for Each Entity Type

**Notes**:
```
NotesContext.addNote(note)
  ↓
dispatch({ type: 'ADD_NOTE', payload: note })
  ↓
State updated (immediate UI)
  ↓
useEffect triggers (line 122-143)
  ↓
setTimeout 5000ms (debounced)
  ↓
storage.save('notes', state.notes)
  ↓
PersistenceQueue.enqueue() priority: 'normal'
  ↓
Batched with other saves (100ms window)
  ↓
Persisted to:
  • IndexedDB (browser)
  • Tauri FileSystem (desktop)
```

**Sessions** (Active):
```
ActiveSessionContext.addScreenshot(screenshot)
  ↓
State updated (activeSession.screenshots.push(...))
  ↓
ChunkedSessionStorage.appendScreenshot()
  ↓
PersistenceQueue.enqueueChunk() priority: 'normal'
  ↓
Written to /sessions-chunked/{id}/screenshots/chunk-NNN.json
  ↓
Index updated asynchronously
```

**Sessions** (Completed):
```
Session ends
  ↓
endSession() in ActiveSessionContext
  ↓
ChunkedSessionStorage.saveFullSession(session)
  ↓
SessionListContext.addSession(session)
  ↓
EnrichmentContext.startTracking() (if enabled)
  ↓
sessionEnrichmentService.enrichSession()
  ↓
Updates stored + indexed
```

### 7.2 Update Propagation Mechanism

**Via Context Changes** (Reactive):
```
1. Action dispatched
   ↓
2. Reducer creates new state
   ↓
3. React re-renders all consuming components
   ↓
4. UI updates instantly (optimistic)
   ↓
5. Storage happens async (via useEffect)
```

**Via EventBus** (Cross-Window):
```
1. RelationshipManager.addRelationship()
   ↓
2. eventBus.emit('RELATIONSHIP_ADDED', data)
   ↓
3. All subscribed handlers execute
   ↓
4. RelationshipContext updates state
   ↓
5. Components re-render
```

**Via Callbacks** (Streaming Progress):
```
sessionEnrichmentService.enrichSession(session, {
  onProgress: (progress) => {
    enrichmentContext.updateProgress(sessionId, progress)
    ↓
    State update (throttled 100ms)
    ↓
    UI re-renders with progress bar
  }
})
```

---

## 8. CACHING & OPTIMIZATION

### 8.1 LRU Cache Hit Rate Strategy

**Target**: >90% hit rate for hot data

```typescript
// Automatic via ChunkedSessionStorage
const chunkedStorage = await getChunkedStorage();
const stats = chunkedStorage.getCacheStats();

// Hot data (frequently accessed):
// - Current session metadata
// - Last 10 sessions
// - Open notes/tasks in sidebar

// Cold data (evicted after 5 min or when cache full):
// - Archive sessions (>30 days old)
// - Completed tasks
// - Archived notes
```

### 8.2 Index Cache (Implicit)

```typescript
// InvertedIndexManager caches all indexes in memory
// Rebuilt on corruption or schema change

const indexManager = await getInvertedIndexManager();

// These operations use cached indexes (< 100ms)
await indexManager.search({ text: 'bug', tags: ['backend'] });
await indexManager.search({ dateRange: { start, end } });
```

### 8.3 Relationship Index Cache

```typescript
// RelationshipIndex maintains in-memory O(1) lookup
// Updated on every relationship change via eventBus

const relationshipIndex = relationshipManager.getIndex();

// These are O(1) lookups (< 5ms)
relationshipIndex.getRelationships(entityId);
relationshipIndex.getRelationshipsBetween(sourceId, targetId);
```

---

## 9. TESTING & VALIDATION

### 9.1 Current Test Coverage

**Location**: `src/context/__tests__/` and `src/services/__tests__/`

```
SessionListContext.test.tsx     - Session list CRUD
RelationshipContext.test.tsx    - Relationship operations
ChunkedStorageIntegration.test  - Storage + relationship sync
integration.test.tsx           - End-to-end flows
```

### 9.2 Storage Test Validation

```
/src/services/storage/__tests__/
  ├─ ChunkedSessionStorage.test.ts (44 tests)
  ├─ ContentAddressableStorage.test.ts (39 tests)
  ├─ InvertedIndexManager.test.ts (71 tests)
  ├─ LRUCache.test.ts (39 tests)
  ├─ PersistenceQueue.test.ts (46 tests)
  └─ relationshipIndex.test.ts (extensive coverage)
```

---

## 10. ARCHITECTURE RECOMMENDATIONS FOR RE-PROCESSING

### 10.1 Service Pattern

```typescript
// New file: src/services/reprocessingService.ts

export interface ReprocessingTask {
  id: string;
  type: 'session' | 'note' | 'task' | 'relationship';
  itemId: string;
  processors: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  cost: number;
}

export class ReprocessingService {
  private queue: ReprocessingTask[] = [];
  private processing = false;
  private eventEmitter = new SimpleEventEmitter();
  
  async reprocess(options: ReprocessingOptions): Promise<ReprocessingResult> {
    // Validate
    // Estimate cost
    // Create tasks
    // Process in batches
    // Update storage
    // Emit progress
  }
  
  async cancel(taskId: string): Promise<void> {}
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
}
```

### 10.2 Integration Points

1. **Context Integration**:
   - Add `ReprocessingContext` for tracking active re-processing
   - Similar to `EnrichmentContext` pattern

2. **UI Components**:
   - `ReprocessingMonitor` component
   - Show progress, cost, cancel/pause buttons
   - Similar to `TasksZone` bulk operations

3. **Storage Integration**:
   - Use `PersistenceQueue` for batched updates
   - Use transactions for atomicity
   - Update indices automatically

4. **Relationship Integration**:
   - After re-processing, update relationships via `RelationshipManager`
   - Emit events via `eventBus`
   - Optimistic updates in `RelationshipContext`

### 10.3 Bulk Operations UI Pattern

```typescript
// In TasksZone or SessionsZone

interface BulkSelection {
  selectedIds: Set<string>;
  isSelectionMode: boolean;
}

const [bulkOps, setBulkOps] = useState<BulkSelection>();

// Actions available in selection mode
- Mark as done/pending
- Add tag(s)
- Change priority
- Assign to topic
- Delete
- Re-process (if sessions/notes)
- Re-extract relationships

// Implementation uses existing batch actions
dispatch({
  type: 'BATCH_UPDATE_TASKS',
  payload: { ids: Array.from(selectedIds), updates: { done: true } }
});
```

---

## 11. KEY FILES SUMMARY

### State Management (Read for Architecture)
- `src/context/AppContext.tsx` - Root state (DEPRECATED)
- `src/context/SessionListContext.tsx` - Session list management
- `src/context/ActiveSessionContext.tsx` - Active session lifecycle
- `src/context/NotesContext.tsx` - Note CRUD + batch operations
- `src/context/TasksContext.tsx` - Task CRUD + batch operations
- `src/context/EnrichmentContext.tsx` - Enrichment progress tracking
- `src/context/RelationshipContext.tsx` - Relationship CRUD

### Storage & Persistence (Critical for Re-processing)
- `src/services/storage/ChunkedSessionStorage.ts` - Session chunked storage
- `src/services/storage/ContentAddressableStorage.ts` - Deduplication
- `src/services/storage/InvertedIndexManager.ts` - Full-text search
- `src/services/storage/PersistenceQueue.ts` - Background persistence
- `src/services/storage/LRUCache.ts` - In-memory caching
- `src/services/storage/relationshipIndex.ts` - Relationship lookups

### AI Services (For Re-processing Implementation)
- `src/services/sessionEnrichmentService.ts` - Enrichment orchestration
- `src/services/claudeService.ts` - Text/topic/task processing
- `src/services/audioReviewService.ts` - Audio analysis
- `src/services/videoChapteringService.ts` - Video analysis
- `src/services/aiCanvasGenerator.ts` - Canvas generation

### Relationship System (For Linking)
- `src/services/relationshipManager.ts` - Core CRUD + transactions
- `src/context/RelationshipContext.tsx` - React wrapper
- `src/services/eventBus.ts` - Pub/sub for updates
- `src/types/relationships.ts` - Type definitions

### Data Models
- `src/types.ts` - Main type definitions (Session, Note, Task, etc.)
- `src/types/relationships.ts` - Relationship types and metadata

---

## 12. RECOMMENDED IMPLEMENTATION CHECKLIST

For implementing **re-processing** and **bulk operations**:

- [ ] Create `ReprocessingService` class with options validation
- [ ] Create `ReprocessingContext` for progress tracking (copy EnrichmentContext pattern)
- [ ] Create UI component for bulk selection and re-processing triggers
- [ ] Add batch operation support to NotesContext for re-extracted notes
- [ ] Add relationship extraction to re-processing pipeline
- [ ] Implement transaction wrapper for atomic multi-table updates
- [ ] Add cost estimation and enforcement
- [ ] Create progress callback with throttling (100ms like EnrichmentContext)
- [ ] Add error handling with partial success support
- [ ] Test with PersistenceQueue batching enabled
- [ ] Test with relationship updates + eventBus emissions
- [ ] Add UI integration for cancellation/pause/resume
- [ ] Document cost per processor type
- [ ] Add monitoring/metrics for re-processing jobs

---

## Conclusion

The Taskerino app has a **well-architected foundation** for implementing re-processing and bulk operations:

1. **Batch Actions Already Exist**: NotesContext and TasksContext have BATCH_* actions ready to use
2. **Storage is Optimized**: PersistenceQueue handles batching automatically
3. **Relationship System is in Place**: Can link re-processed items automatically
4. **Progress Tracking Pattern Available**: EnrichmentContext shows how to track long operations
5. **AI Services are Ready**: All processing services (audio, video, text) are production-ready

The recommended approach is to create a **ReprocessingService** following the existing patterns (EnrichmentContext, sessionEnrichmentService) and integrate with the specialized contexts rather than modifying the deprecated AppContext.

