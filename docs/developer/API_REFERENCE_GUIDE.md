# Taskerino API Reference Guide
## Key Services, Contexts, and Database Operations

---

## STATE MANAGEMENT CONTEXTS

### NotesContext - `/src/context/NotesContext.tsx`

**Hook**: `useNotes()`

**Methods**:
```typescript
// CRUD Operations
addNote(note: Note): void                          // Add single note
updateNote(note: Note): void                       // Update note
deleteNote(id: string): void                       // Delete note
batchAddNotes(notes: Note[]): void                // ✓ Bulk add
createManualNote(data: ManualNoteData): void      // Create from UI

// Query Operations  
queryNotes(
  filters: QueryFilter[],
  sort?: QuerySort,
  limit?: number
): Promise<Note[]>

// Relationship Operations
linkNoteToTopic(noteId: string, topicId: string): Promise<void>
unlinkNoteFromTopic(noteId: string, topicId: string): Promise<void>
linkNoteToCompany(noteId: string, companyId: string): Promise<void>
unlinkNoteFromCompany(noteId: string, companyId: string): Promise<void>
linkNoteToContact(noteId: string, contactId: string): Promise<void>
unlinkNoteFromContact(noteId: string, contactId: string): Promise<void>

// State Access
state.notes: Note[]                                // All notes in memory
state.dispatch: React.Dispatch                     // For actions
```

**Actions**:
```typescript
{ type: 'ADD_NOTE', payload: Note }
{ type: 'UPDATE_NOTE', payload: Note }
{ type: 'DELETE_NOTE', payload: string }
{ type: 'BATCH_ADD_NOTES', payload: Note[] }
{ type: 'CREATE_MANUAL_NOTE', payload: ManualNoteData }
{ type: 'LOAD_NOTES', payload: Note[] }
```

**Storage**: Saved via PersistenceQueue, 5s debounce, persists to both IndexedDB and Tauri FS

---

### TasksContext - `/src/context/TasksContext.tsx`

**Hook**: `useTasks()`

**Methods**:
```typescript
// CRUD Operations
state.dispatch({ type: 'ADD_TASK', payload: Task })
state.dispatch({ type: 'UPDATE_TASK', payload: Task })
state.dispatch({ type: 'DELETE_TASK', payload: taskId })
state.dispatch({ type: 'TOGGLE_TASK', payload: taskId })
state.dispatch({ type: 'BATCH_ADD_TASKS', payload: Task[] })
state.dispatch({ type: 'BATCH_UPDATE_TASKS', payload: { ids: string[], updates: Partial<Task> } })
state.dispatch({ type: 'BATCH_DELETE_TASKS', payload: string[] })

// Query Operations
queryTasks(
  filters: QueryFilter[],
  sort?: QuerySort,
  limit?: number
): Promise<Task[]>

// Relationship Operations
linkTaskToNote(taskId: string, noteId: string): Promise<void>
unlinkTaskFromNote(taskId: string, noteId: string): Promise<void>
linkTaskToSession(taskId: string, sessionId: string): Promise<void>
unlinkTaskFromSession(taskId: string, sessionId: string): Promise<void>

// State Access
state.tasks: Task[]                                 // All tasks in memory
```

**Storage**: Same as NotesContext - PersistenceQueue, 5s debounce

---

### SessionListContext - `/src/context/SessionListContext.tsx`

**Hook**: `useSessionList()`

**Methods**:
```typescript
// Session Management
loadSessions(): Promise<void>                      // Load all sessions
addSession(session: Session): Promise<void>        // Add completed session
updateSession(id: string, updates: Partial<Session>): Promise<void>
deleteSession(id: string): Promise<void>
refreshSessions(): Promise<void>                   // Reload from storage
getSessionById(id: string): Session | undefined

// Filtering & Sorting
setFilter(filter: SessionFilter | null): void      // Apply filter
setSortBy(sort: SessionSortOption): void           // Sort sessions
filteredSessions: Session[]                        // Computed, memoized

// Relationship Helpers
linkSessionToTask(sessionId: string, taskId: string, metadata?: object): Promise<void>
linkSessionToNote(sessionId: string, noteId: string, metadata?: object): Promise<void>

// State
sessions: Session[]                                 // All sessions
loading: boolean
error: string | null
filter: SessionFilter | null
sortBy: SessionSortOption
```

**Storage**: 
- Metadata loaded from ChunkedSessionStorage (~1ms)
- Full sessions loaded progressively (~500ms)
- Via PersistenceQueue for async updates

---

### ActiveSessionContext - `/src/context/ActiveSessionContext.tsx`

**Hook**: `useActiveSession()`

**Methods**:
```typescript
// Lifecycle
startSession(config: SessionConfig): Promise<void>    // Begin session
pauseSession(): void
resumeSession(): void
endSession(): Promise<void>                            // End and hand off to SessionList

// Data Updates
addScreenshot(screenshot: SessionScreenshot): void
addAudioSegment(segment: SessionAudioSegment): void
deleteAudioSegmentFile(segmentId: string): void
updateScreenshotAnalysis(
  screenshotId: string,
  analysis: AIAnalysis,
  status: AnalysisStatus,
  error?: string
): void
addScreenshotComment(screenshotId: string, comment: string): void
toggleScreenshotFlag(screenshotId: string): void

// Session Metadata
updateActiveSession(updates: Partial<Session>): void

// Extracted Items
addExtractedTask(taskId: string): void
addExtractedNote(noteId: string): void
addContextItem(item: SessionContextItem): void

// Loading
loadSession(sessionId: string): Promise<void>         // Load from chunked storage

// State
activeSession: Session | null                         // Current session
activeSessionId: string | undefined
```

**Storage**:
- Session metadata saved immediately to ChunkedSessionStorage
- Screenshots/audio appended via PersistenceQueue (queued, 0ms blocking)
- Full session saved on endSession()

---

### EnrichmentContext - `/src/context/EnrichmentContext.tsx`

**Hook**: `useEnrichmentContext()`

**Methods**:
```typescript
// Tracking
startTracking(sessionId: string, sessionName: string): void
updateProgress(sessionId: string, progress: EnrichmentProgress): void
stopTracking(sessionId: string): void

// Query
getActiveEnrichment(sessionId: string): ActiveEnrichment | undefined
hasActiveEnrichments: boolean
activeEnrichments: Map<string, ActiveEnrichment>

// State
interface ActiveEnrichment {
  sessionId: string
  sessionName: string
  progress: number                    // 0-100
  stage: 'validating'|'estimating'|'audio'|'video'|'canvas'|...
  startTime: number
  lastUpdate: number
}
```

**Features**:
- Throttled updates to 100ms (smooth UI, lower CPU)
- No persistence (in-memory only)
- Supports multiple concurrent enrichments
- For progress feedback during long operations

---

### RelationshipContext - `/src/context/RelationshipContext.tsx`

**Hook**: `useRelationships()`

**Methods**:
```typescript
// CRUD Operations
addRelationship(params: AddRelationshipParams): Promise<Relationship>
removeRelationship(relationshipId: string): Promise<void>

// Query Operations
getRelationships(entityId: string, type?: RelationshipType): Relationship[]
getRelatedEntities<T>(entityId: string, type?: RelationshipType): Promise<T[]>

// Error Handling
clearError(): void

// State
isLoading: boolean
error: Error | null
optimisticRelationships: Map<string, Relationship>    // Pending updates
stats: {
  totalRelationships: number
  aiRelationships: number
  manualRelationships: number
}
```

**Features**:
- Optimistic updates (immediate UI feedback)
- Automatic rollback on error
- Event-driven via eventBus
- Bidirectional sync (via RelationshipManager)

---

## CORE SERVICES

### RelationshipManager - `/src/services/relationshipManager.ts`

**Singleton**: `relationshipManager`

**Methods**:
```typescript
// Initialization
async init(): Promise<void>

// CRUD
async addRelationship(params: AddRelationshipParams): Promise<Relationship>
async removeRelationship(relationshipId: string): Promise<void>
getRelationships(params: GetRelationshipsParams): Relationship[]
async getRelatedEntities<T>(entityId: string, type?: RelationshipType): Promise<T[]>

// Utility
hasRelationship(sourceId: string, targetId: string, type: RelationshipType): boolean
getRelationshipsBetween(sourceId: string, targetId: string): Relationship[]
async updateRelationshipMetadata(relationshipId: string, metadata: Partial<RelationshipMetadata>): Promise<void>

// Strategy Registration
registerStrategy(type: RelationshipType, strategy: RelationshipStrategy): void
```

**Interface**: `AddRelationshipParams`
```typescript
{
  sourceType: EntityType                          // 'task'|'note'|'session'|...
  sourceId: string
  targetType: EntityType
  targetId: string
  type: RelationshipType                          // 'task-note'|'note-session'|...
  metadata?: Partial<RelationshipMetadata>        // Optional metadata
}
```

**Key Features**:
- Atomic transactions (all-or-nothing)
- O(1) lookups via RelationshipIndex
- Bidirectional sync automatic
- Event emission via eventBus
- Strategy pattern for type-specific logic

**Performance**: <10ms per operation (target)

---

### EventBus - `/src/services/eventBus.ts`

**Singleton**: `eventBus`

**Methods**:
```typescript
// Subscription
on(event: RelationshipEvent, handler: EventHandler): string       // Returns subscription ID
off(subscriptionId: string): void

// Publishing
emit(event: RelationshipEvent, data: any, source?: string): void

// Utility
clear(): void                                      // Clear all listeners
getSubscriberCount(event: RelationshipEvent): number
getTotalSubscriptions(): number
hasSubscribers(event: RelationshipEvent): boolean
```

**Event Types**:
```typescript
'RELATIONSHIP_ADDED'    // New relationship created
'RELATIONSHIP_REMOVED'  // Relationship deleted
'RELATIONSHIP_UPDATED'  // Metadata changed
'ENTITY_DELETED'        // Entity deleted (cascades)
```

**Event Data Structure**:
```typescript
{
  timestamp: string                    // ISO timestamp
  source: string                       // Source component/service
  data: any                           // Event-specific payload
}
```

**Performance**: <1ms emit with 10 subscribers

---

## STORAGE SERVICES

### ChunkedSessionStorage - `/src/services/storage/ChunkedSessionStorage.ts`

**Singleton**: `getChunkedStorage()`

**Methods**:
```typescript
// Metadata Loading (Fast)
async loadAllMetadata(): Promise<SessionMetadata[]>    // <1ms, instant load
async loadMetadata(sessionId: string): Promise<SessionMetadata>

// Full Session Loading (Progressive)
async loadFullSession(sessionId: string): Promise<Session>  // <1s
async loadSessionChunk(sessionId: string, chunkType: string, chunkNum: number): Promise<any>

// Session Writing
async saveFullSession(session: Session): Promise<void>
async appendScreenshot(sessionId: string, screenshot: SessionScreenshot): Promise<void>
async appendAudioSegment(sessionId: string, segment: SessionAudioSegment): Promise<void>

// Session Deletion
async deleteSession(sessionId: string): Promise<void>

// Cache Management
getCacheStats(): CacheStats                         // Hit rate, size, TTL
clearCache(): void
clearSessionCache(sessionId: string): void
setCacheSize(bytes: number): void
```

**Features**:
- Metadata: ~10 KB, loads in <1ms
- Progressive chunking (20 screenshots/chunk, 100 audio segments/chunk)
- LRU cache with >90% hit rate target
- TTL: 5 minutes per entry

**Directory Structure**:
```
/sessions-chunked/{session-id}/
  metadata.json
  summary.json
  screenshots/
    chunk-000.json
    chunk-001.json
  audio-segments/
    chunk-000.json
```

---

### ContentAddressableStorage - `/src/services/storage/ContentAddressableStorage.ts`

**Singleton**: `getCAStorage()`

**Methods**:
```typescript
// Attachment Management
async saveAttachment(attachment: Attachment): Promise<string>  // Returns hash
async loadAttachment(hash: string): Promise<Attachment>
async deleteAttachment(hash: string): Promise<void>

// Reference Management
async addReference(hash: string, entityId: string, attachmentId: string): Promise<void>
async removeReference(hash: string, entityId: string, attachmentId: string): Promise<void>

// Garbage Collection
async collectGarbage(): Promise<GarbageCollectionResult>  // Remove unreferenced

// Deduplication
async findDuplicate(content: Buffer): Promise<string | null>  // Check if exists
```

**Features**:
- SHA-256 deduplication (30-50% storage savings)
- Reference counting
- Automatic garbage collection
- Atomic operations via transactions

**Directory Structure**:
```
/attachments-ca/
  {hash-prefix}/
    {full-hash}/
      data.bin
      metadata.json
```

---

### InvertedIndexManager - `/src/services/storage/InvertedIndexManager.ts`

**Singleton**: `getInvertedIndexManager()`

**Methods**:
```typescript
// Search
async search(options: SearchOptions): Promise<Session[]>    // <100ms

// Index Updates
async updateSession(session: Session): Promise<void>
async updateSessions(sessions: Session[]): Promise<void>
async deleteSession(sessionId: string): Promise<void>

// Index Management
async rebuildIndexes(): Promise<void>              // Rebuild from scratch
async optimizeIndexes(): Promise<void>             // Defragment/compress
async checkIndexHealth(): Promise<HealthReport>

// Utility
getIndexStats(): IndexStats
```

**Search Options**:
```typescript
{
  text?: string                                    // Full-text search (TF-IDF)
  tags?: string[]                                 // Tag matching
  dateRange?: { start: Date; end: Date }         // Date filtering
  category?: string
  subCategory?: string
  status?: 'active'|'paused'|'completed'
  operator?: 'AND'|'OR'|'NOT'                    // Logical operators
}
```

**Indexes** (7 total):
1. by-topic - For topic-based filtering
2. by-date - For date range queries
3. by-tag - For tag matching
4. full-text - For keyword search (TF-IDF)
5. by-category - For category filtering
6. by-subcategory - For sub-category filtering
7. by-status - For status filtering

**Performance**: <100ms for complex queries on 1000+ sessions

---

### PersistenceQueue - `/src/services/storage/PersistenceQueue.ts`

**Singleton**: `getPersistenceQueue()`

**Methods**:
```typescript
// Queueing
enqueue(key: string, value: unknown, priority: QueuePriority): void
enqueueChunk(sessionId: string, chunkPath: string, data: unknown, priority: QueuePriority): void
enqueueIndex(indexName: string, data: unknown, priority: QueuePriority): void
enqueueCAStorage(hash: string, metadata: unknown, priority: QueuePriority): void

// Control
async shutdown(): Promise<void>                    // Flush on app close
pause(): void
resume(): void

// Statistics
getStats(): QueueStats                             // Pending, processing, etc.

// Cleanup
enqueueCleanup(type: 'gc'|'optimize', priority: QueuePriority): void
```

**Priority Levels**:
- **critical**: Immediate write (1 retry max)
- **normal**: Batched 100ms (3 retries)
- **low**: Idle-time only, ~10s batching (5 retries)

**Batching** (Phase 4):
- Chunk writes: 10 chunks → 1 transaction
- Index updates: Multiple → 1 write
- CA storage refs: 20 refs → 1 transaction

**Performance**: 0ms UI blocking, automatic retry with backoff

---

### LRUCache - `/src/services/storage/LRUCache.ts`

**Usage**: Via ChunkedSessionStorage (transparent)

**Methods**:
```typescript
// Cache Control
get<T>(key: string): T | undefined                // O(1)
set<T>(key: string, value: T, ttl?: number): void // O(1)
has(key: string): boolean
delete(key: string): void
clear(): void

// Eviction
setMaxSize(bytes: number): void                    // Default: 100MB
```

**Features**:
- Size-based eviction (LRU)
- TTL support (5 minutes default)
- Pattern-based invalidation
- O(1) operations

---

## AI SERVICES

### SessionEnrichmentService - `/src/services/sessionEnrichmentService.ts`

**Methods**:
```typescript
async enrichSession(
  session: Session,
  options: EnrichmentOptions
): Promise<EnrichmentResult>
```

**Options**:
```typescript
{
  includeAudio?: boolean                           // Run audio review
  includeVideo?: boolean                           // Run video analysis
  includeSummary?: boolean                         // Generate summary
  includeCanvas?: boolean                          // Generate canvas (requires summary)
  forceRegenerate?: boolean                        // Re-run even if done
  maxCost?: number                                 // USD cost cap
  resumeFromCheckpoint?: boolean                   // Resume after failure
  onProgress?: (progress: EnrichmentProgress) => void
}
```

**Progress Callback**:
```typescript
{
  stage: 'validating'|'estimating'|'locking'|'audio'|'video'|'summary'|'canvas'|'complete'
  message: string
  progress: number                                 // 0-100
  stages?: {
    audio: { status, progress }
    video: { status, progress }
    summary: { status, progress }
    canvas: { status, progress }
  }
}
```

**Result**:
```typescript
{
  success: boolean
  audio?: {
    completed: boolean
    fullTranscription?: string
    insights?: AudioInsights
    cost: number
    duration: number
    error?: string
  }
  video?: {
    completed: boolean
    chapters?: VideoChapter[]
    cost: number
    duration: number
    error?: string
  }
  summary?: {
    completed: boolean
    summary?: any
    duration: number
    error?: string
  }
  canvas?: {
    completed: boolean
    canvasSpec?: any
    cost: number
    duration: number
    error?: string
  }
}
```

**Features**:
- Parallel audio/video processing
- Checkpoint-based recovery
- Cost estimation and enforcement
- Error isolation (partial success)
- Real-time progress tracking

**Costs Approximate**:
- Audio review: ~$0.10/minute
- Video analysis: ~$0.05/frame
- Summary: ~$0.02
- Canvas: ~$0.05

---

### ClaudeService - `/src/services/claudeService.ts`

**Methods**:
```typescript
async processInput(
  text: string,
  existingTopics: Topic[],
  existingNotes: Note[],
  settings: AppState['aiSettings'],
  userLearnings?: AppState['learnings'],
  learningSettings?: AppState['learningSettings'],
  existingTasks?: Task[],
  attachments?: Attachment[],
  extractTasks: boolean = true
): Promise<AIProcessResult>

async setApiKey(apiKey: string): Promise<void>
```

**Result**:
```typescript
{
  topics: Topic[]                                  // Detected/created
  notes: Note[]                                   // Created/merged
  tasks: Task[]                                   // Extracted
  processingSteps: string[]                       // For UI progress
}
```

**Features**:
- Topic detection with fuzzy matching (confidence scoring)
- Note merging (30% similarity threshold)
- Task extraction with priority inference
- Recent context inclusion (learning system)
- Attachment handling

---

## UTILITIES & HELPERS

### QueryEngine - `/src/services/storage/QueryEngine.ts`

**Methods**:
```typescript
async query<T>(
  entities: T[],
  filters: QueryFilter[],
  sort?: QuerySort,
  limit?: number
): Promise<T[]>
```

**Filter Types**:
```typescript
{
  field: string                                   // e.g., 'status', 'topic'
  operator: '='|'!='|'>'|'<'|'contains'|'in'
  value: any
}
```

**Sort Types**:
```typescript
{
  field: string
  direction: 'asc'|'desc'
}
```

**Usage in Contexts**:
```typescript
const { queryNotes } = useNotes();
const results = await queryNotes(
  [{ field: 'status', operator: '=', value: 'done' }],
  { field: 'createdAt', direction: 'desc' },
  10
);
```

---

## COMMON PATTERNS

### Bulk Update Pattern

```typescript
import { useTasks } from '@/context/TasksContext';

const { state } = useTasks();

// Mark 100 tasks as done
const taskIds = tasks.slice(0, 100).map(t => t.id);
state.dispatch({
  type: 'BATCH_UPDATE_TASKS',
  payload: {
    ids: taskIds,
    updates: { done: true, status: 'done' }
  }
});

// Automatically persisted via PersistenceQueue (5s debounce, 0ms UI blocking)
```

### Progress Tracking Pattern

```typescript
import { useEnrichmentContext } from '@/context/EnrichmentContext';

const enrichmentContext = useEnrichmentContext();

enrichmentContext.startTracking('session-123', 'My Session');

await someOperation({
  onProgress: (progress) => {
    enrichmentContext.updateProgress('session-123', progress);
  }
});

enrichmentContext.stopTracking('session-123');
```

### Relationship Linking Pattern

```typescript
import { useRelationships } from '@/context/RelationshipContext';

const { addRelationship } = useRelationships();

await addRelationship({
  sourceType: 'task',
  sourceId: 'task-123',
  targetType: 'note',
  targetId: 'note-456',
  type: 'task-note',
  metadata: {
    source: 'ai',
    confidence: 0.95,
    reasoning: 'Task extracted from note'
  }
});

// Propagates via:
// 1. RelationshipContext optimistic update
// 2. relationshipManager persistence
// 3. eventBus emission
// 4. PersistenceQueue batching
```

---

**Last Updated**: October 26, 2025
**For**: Taskerino Development & Re-processing Implementation
