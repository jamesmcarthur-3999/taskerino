# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Taskerino is an AI-powered note-taking and task management desktop application built with Tauri + React. The app uses Claude AI (Sonnet 4.5) for intelligent processing of notes, automatic topic detection, task extraction, and an AI assistant named "Ned". It features a unique **Sessions** system that records screenshots and audio of work sessions, then uses AI to generate comprehensive summaries and insights.

**Key Philosophy**: Zero friction, maximum intelligence. Users capture thoughts quickly without manual organization - AI handles categorization, topic detection, and task extraction automatically.

## Development Commands

### Essential Commands
```bash
# Start development server (Vite + Tauri dev mode)
npm run dev
npm run tauri:dev

# Build for production (requires signing certificates configured)
npm run build
npm run tauri:build

# Type checking
npm run type-check

# Linting
npm run lint

# Run all tests
npm test

# Run tests in UI mode (recommended for development)
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Testing Individual Files
```bash
# Run specific test file
npx vitest run path/to/file.test.ts

# Run tests in watch mode for specific file
npx vitest watch path/to/file.test.ts

# Run all tests matching a pattern
npx vitest run --grep "SessionsContext"
```

## Architecture Overview

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Desktop**: Tauri v2 (Rust backend, web frontend)
- **Styling**: Tailwind CSS v3 with custom glass morphism effects
- **AI**: Claude API (claude-3-5-sonnet-20241022), OpenAI Whisper + GPT-4o
- **Storage**: IndexedDB (browser) + Tauri File System (desktop) with dual-adapter pattern
- **Recording**: Swift ScreenCaptureKit (macOS 12.3+) with Rust FFI bridge
- **Testing**: Vitest + React Testing Library

### Zone-Based Navigation

The app uses a **six-zone navigation model** with two distinct navigation systems:

#### 1. Top Navigation Island (`TopNavigation/`)
Fixed navigation bar at the top of the screen:
- **Collapsed State**: Shows navigation tabs for all 6 zones
- **Expanded States**: Expands into mode-specific interfaces (Search, Task, Note, Processing, Session)
- Uses spring-based expansion/collapse animations
- Adapts to compact mode on narrow viewports
- Keyboard shortcuts (CMD+K for search)

**Key Files**:
- `TopNavigation/index.tsx` - Main orchestrator
- `TopNavigation/components/NavigationIsland.tsx` - Dynamic island container
- `TopNavigation/components/NavTabs.tsx` - Tab navigation

#### 2. Space Sub Menus (In-Zone Morphing Menus)
Scroll-driven morphing menus within each zone:
- **MenuMorphPill** (`MenuMorphPill.tsx`) - Morphing wrapper with scroll-driven transforms
- **SpaceMenuBar** (`SpaceMenuBar.tsx`) - Menu content with controls (primary actions, view toggles, filters)
- Starts in document flow, becomes fixed and morphs to compact "Menu" button next to logo when scrolled
- Uses MotionValues for 60fps GPU-accelerated animations
- Individual menu items exit with staggered animations

**Usage Pattern**:
```tsx
<MenuMorphPill resetKey={selectedItemId}>
  <SpaceMenuBar
    primaryAction={...}
    viewControls={...}
    filters={...}
  />
</MenuMorphPill>
```

#### 6 Zones

1. **Capture Zone** (`CaptureZone.tsx`) - Universal input for quick note capture with AI processing
2. **Tasks Zone** (`TasksZone.tsx`) - Interactive task management with views (list/kanban/table)
3. **Library Zone** (`LibraryZone.tsx`) - Browse organized notes by topic with rich entity cards
4. **Sessions Zone** (`SessionsZone.tsx`) - Work session tracking with screenshots, audio, and AI summaries
5. **Assistant Zone** (`AssistantZone.tsx`) - Chat with Ned, the AI assistant
6. **Profile Zone** (`ProfileZone.tsx`) - Settings, API configuration, and user preferences

### Recording Architecture (Phase 2 - Complete)

**Status**: Production-ready (October 2025)
**Platform**: macOS 12.3+ (ScreenCaptureKit)
**Documentation**: `ARCHITECTURE.md` lines 623-660, Swift files with comprehensive headers

Taskerino uses a **modern actor-based recording system** with full pause/resume and hot-swap capabilities.

#### Swift Recording Stack

**1. RecordingSession** (`ScreenRecorder/Core/RecordingSession.swift` - 460 lines):
- Main orchestrator for multi-source recording (display, window, webcam)
- Actor-based for thread safety (no locks/semaphores)
- Frame synchronization, composition, and encoding
- **Features**:
  - `start()` / `stop()` - Session lifecycle
  - `pause()` / `resume()` - Pause with timestamp adjustment (drop frames, zero memory overhead)
  - `switchSource()` - Hot-swap sources during recording (sequential stop→update→start)
  - Statistics tracking with detailed synchronizer metrics

```swift
// Swift FFI exports (ScreenRecorder.swift)
@_cdecl("recording_session_pause")
@_cdecl("recording_session_resume")
@_cdecl("recording_session_is_paused")
@_cdecl("recording_session_switch_source")
```

**2. FrameSynchronizer** (`ScreenRecorder/Core/FrameSynchronizer.swift` - 191 lines):
- Frame alignment across multiple sources with timestamp tolerance (16ms default)
- Dynamic source management: `addSource()` / `removeSource()`
- Adaptive timeout with frame dropping
- Statistics: alignment rate, source lag tracking

**3. FrameCompositor** (Protocol):
- Combines multiple frames into single output
- Implementations: `GridCompositor`, `PiPCompositor`
- GPU-accelerated with Core Image filters

**4. VideoEncoder** (`ScreenRecorder/Core/VideoEncoder.swift`):
- H.264 encoding via AVAssetWriter
- Configurable: resolution, frame rate, bitrate
- Atomic file writes with temp→final rename

#### Rust FFI Bridge

**recording/ffi.rs** (`src-tauri/src/recording/ffi.rs` - 739 lines):
- Safe FFI wrappers for Swift recording functions
- Type-safe source enumeration (displays, windows, webcams)
- CString handling for cross-language strings
- Error handling with descriptive FFIError enum

**SwiftRecordingSession** wrapper:
```rust
pub struct SwiftRecordingSession {
    session: *mut c_void,  // Opaque pointer to Swift RecordingSessionManager
}

impl SwiftRecordingSession {
    pub async fn new(output_path: &str, width: u32, height: u32, fps: u32) -> Result<Self, FFIError>;
    pub async fn add_display(&mut self, display_id: u32) -> Result<(), FFIError>;
    pub async fn add_window(&mut self, window_id: u32) -> Result<(), FFIError>;
    pub async fn add_webcam(&mut self, device_id: &str) -> Result<(), FFIError>;
    pub async fn start(&mut self) -> Result<(), FFIError>;
    pub async fn stop(&mut self) -> Result<(), FFIError>;
    pub async fn pause(&self) -> Result<(), FFIError>;  // Phase 2
    pub async fn resume(&self) -> Result<(), FFIError>;  // Phase 2
    pub async fn is_paused(&self) -> Result<bool, FFIError>;  // Phase 2
    pub async fn switch_source(&self, old_id: &str, type: SourceType, new_id: &str) -> Result<(), FFIError>;  // Phase 2
}
```

**Source Enumeration**:
```rust
pub async fn enumerate_displays() -> Result<Vec<DisplayInfo>, FFIError>;
pub async fn enumerate_windows() -> Result<Vec<WindowInfo>, FFIError>;
pub async fn enumerate_webcams() -> Result<Vec<WebcamInfo>, FFIError>;
```

#### Tauri Command Layer

**video_recording.rs** (`src-tauri/src/video_recording.rs`):
- Tauri commands wrapping recording/ module
- SessionManager for state management with Arc-based thread safety

**Available Commands**:
```rust
// Lifecycle
start_video_recording(session_id, output_path, width, height, fps, sources)
stop_video_recording(session_id)
is_recording(session_id) -> bool
get_current_recording_session() -> Option<String>

// Phase 2: Pause/Resume
pause_recording(session_id)
resume_recording(session_id)
is_recording_paused(session_id) -> bool

// Phase 2: Hot-Swap
switch_recording_source(session_id, old_source_id, source_type, new_source_id)

// Enumeration
enumerate_displays() -> Vec<DisplayInfo>
enumerate_windows() -> Vec<WindowInfo>
enumerate_webcams() -> Vec<WebcamInfo>
enumerate_available_sources() -> AvailableRecordingSources

// Utilities
get_recording_duration(file_path) -> f64
generate_video_thumbnail(video_path, timestamp) -> String
```

**SessionManager Pattern**:
```rust
pub struct SessionManager {
    pub sessions: Mutex<HashMap<String, Arc<SwiftRecordingSession>>>,
}
```

- Arc wrapper for thread-safe session sharing across async boundaries
- Clone Arc, drop mutex guard, then await (prevent holding locks across awaits)
- Explicit cleanup with `Arc::try_unwrap` in stop commands

#### Thread Safety Guarantees

1. **Swift Actor Isolation**: All RecordingSession state accessed via actor context
2. **Rust Arc Pattern**: Sessions wrapped in Arc for multi-ownership
3. **Mutex Discipline**: Never hold mutex guard across await points
4. **Drop Safety**: Automatic cleanup via Drop trait if Arc::try_unwrap fails

#### Usage Example

```typescript
import { invoke } from '@tauri-apps/api/core';

// Start recording with multiple sources
await invoke('start_video_recording', {
  sessionId: 'session-123',
  outputPath: '/path/to/output.mp4',
  width: 1920,
  height: 1080,
  fps: 30,
  sources: [
    { type: 'Display', id: '0' },
    { type: 'Webcam', id: 'FaceTime HD Camera' }
  ]
});

// Pause during recording
await invoke('pause_recording', { sessionId: 'session-123' });

// Resume
await invoke('resume_recording', { sessionId: 'session-123' });

// Hot-swap to different display
await invoke('switch_recording_source', {
  sessionId: 'session-123',
  oldSourceId: 'display-0',
  sourceType: 'Display',
  newSourceId: 'display-1'
});

// Stop and save
await invoke('stop_video_recording', { sessionId: 'session-123' });
```

#### Best Practices

1. **Always enumerate sources** before starting recording (verify availability)
2. **Use Arc cloning** when passing sessions across async boundaries
3. **Call stop explicitly** for clean shutdown (don't rely on Drop alone)
4. **Check is_paused** before UI state changes
5. **Sequential hot-swap** - wait for previous swap to complete before starting another
6. **Handle FFIError** - all operations can fail, wrap in try/catch

#### Performance Characteristics

- **Frame Synchronization**: 16ms tolerance (60fps), adaptive timeout
- **Pause Overhead**: Zero (drops frames, no buffering)
- **Hot-Swap Latency**: ~50-100ms (stop + start)
- **Memory**: ~2MB per source buffer (10 frames @ 1080p)
- **CPU**: ~5-10% single core (encoding), ~2-3% per source (capture)

### Context Architecture (Updated - Phase 1 Complete)

The app uses **specialized contexts** with a clear separation of concerns:

#### Core Context Providers (Preferred)
- `SettingsContext` - User settings and AI configuration
- `UIContext` - UI state, preferences, onboarding
- `EntitiesContext` - Companies, contacts, topics (entities)
- `NotesContext` - Note CRUD and filtering
- `TasksContext` - Task CRUD, subtasks, filtering
- `EnrichmentContext` - Post-session AI enrichment pipeline
- `ThemeContext` - Dark/light theme management

#### Session Management Contexts (Phase 1 - New)
- `SessionListContext` - Session CRUD, filtering, sorting (read-only operations)
- `ActiveSessionContext` - Active session lifecycle and state management
- `RecordingContext` - Recording service management (screenshots, audio, video)

#### Deprecated Context (Being Removed)
- `SessionsContext` - **DEPRECATED** - See migration guide in `/docs/sessions-rewrite/`
  - Use `useSessionList()`, `useActiveSession()`, or `useRecording()` instead
  - Will be removed in Phase 7
- `AppContext` - **DEPRECATED** - Migrating to specialized contexts

**When adding new features**: Use the specialized contexts. Do NOT extend deprecated contexts.

### State Management (Phase 1 - New)

#### XState State Machines
The app uses **XState v5** for complex state management with type-safe state machines:

- `sessionMachine` - Session lifecycle state machine
  - Location: `src/machines/sessionMachine.ts`
  - Hook: `useSessionMachine()` from `src/hooks/useSessionMachine.ts`
  - States: `idle` → `validating` → `checking_permissions` → `starting` → `active` → `pausing`/`paused` → `resuming` → `ending` → `completed`
  - Guards: Permission checks, validation, device availability
  - Actions: Service start/stop, persistence, event emission

**Usage**:
```typescript
import { useSessionMachine } from '@/hooks/useSessionMachine';

function MyComponent() {
  const {
    state,           // Current state ('idle', 'active', etc.)
    context,         // Machine context (sessionId, config, etc.)
    isActive,        // Boolean helpers
    isIdle,
    startSession,    // Type-safe action functions
    pauseSession,
    endSession
  } = useSessionMachine();

  return (
    <div>
      {isActive && <p>Session {context.sessionId} is active</p>}
      <button onClick={() => startSession({ name: 'My Session' })}>
        Start Session
      </button>
    </div>
  );
}
```

**Benefits**:
- Type-safe transitions and actions
- Impossible states prevented at compile time
- Visual state diagram (`sessionMachine.ts` exports for XState inspector)
- Comprehensive testing (21 tests covering all transitions)

### Data Model Hierarchy

```
Session (work session with recordings)
├── screenshots[] → SessionScreenshot
│   └── attachmentId → Attachment (in storage)
├── audioSegments[] → SessionAudioSegment
│   └── attachmentId → Attachment (audio WAV)
├── video? → SessionVideo
│   └── fullVideoAttachmentId → Attachment
├── summary? → SessionSummary (AI-generated)
├── canvasSpec? → CanvasSpec (for rendering)
└── enrichmentStatus? → EnrichmentStatus (pipeline tracking)

Note
├── companyIds[] → Company
├── contactIds[] → Contact
├── topicIds[] → Topic
├── attachments[] → Attachment
├── updates[] → NoteUpdate (history)
└── sourceSessionId? → Session

Task
├── topicId? → Topic
├── noteId? → Note
├── subtasks[] → SubTask
├── attachments[] → Attachment
└── sourceSessionId? → Session
```

### Unified Search System (November 2025)

**Status**: Production-ready
**Documentation**: `/docs/UNIFIED_INDEX_MANAGER_IMPLEMENTATION_SUMMARY.md`

Taskerino consolidates all search operations into a **unified, relationship-aware search system** that eliminates fragmentation and delivers O(log n) performance.

#### Search System Architecture

**When to use which search API**:

1. **UnifiedIndexManager** - Cross-entity search (sessions, notes, tasks)
   - Use for: Searching across multiple entity types, relationship-based queries, AI tool integration
   - Performance: <100ms for 1000+ entities (O(log n))
   - Location: `src/services/storage/UnifiedIndexManager.ts`
   - Extends: `InvertedIndexManager` for backward compatibility

2. **InvertedIndexManager** - Session-only search (legacy)
   - Use for: Session-specific search operations (will be deprecated)
   - Performance: <100ms for 1000+ sessions (O(log n))
   - Location: `src/services/storage/InvertedIndexManager.ts`
   - Status: Still used but recommend migrating to UnifiedIndexManager

3. **SessionQueryEngine** - Active session AI Q&A
   - Use for: Querying WITHIN active session (screenshots, audio, AI questions)
   - Performance: Real-time (<1s)
   - Location: `src/services/SessionQueryEngine.ts`
   - Scope: Different from cross-entity search

4. **LiveSessionContextProvider** - In-memory active session filtering
   - Use for: Real-time filtering of active session data (screenshots, audio segments)
   - Performance: <1ms (in-memory)
   - Location: `src/services/LiveSessionContextProvider.ts`
   - Scope: Active session only, not for historical search

#### UnifiedIndexManager API

**Search across entity types**:
```typescript
import { getUnifiedIndexManager } from '@/services/storage/UnifiedIndexManager';

const unifiedIndex = await getUnifiedIndexManager();

// Example 1: Search notes by topic
const result = await unifiedIndex.search({
  entityTypes: ['notes'],
  relatedTo: {
    entityType: 'topic',
    entityId: 'topic-auth'
  },
  limit: 20
});

// Example 2: Search tasks with filters
const result = await unifiedIndex.search({
  entityTypes: ['tasks'],
  filters: {
    status: 'in_progress',
    priority: 'high'
  },
  sortBy: 'date',
  sortOrder: 'desc'
});

// Example 3: Cross-entity search
const result = await unifiedIndex.search({
  query: 'authentication bug',
  entityTypes: ['sessions', 'notes', 'tasks'],
  relatedTo: {
    entityType: 'company',
    entityId: 'company-acme'
  },
  limit: 50
});
```

**Indexing capabilities**:
- **Notes**: 7 indexes (full-text, topic, date, source, company, contact, session)
- **Tasks**: 8 indexes (full-text, status, priority, date, topic, note, session, completed)
- **Sessions**: Inherited from InvertedIndexManager (7 indexes)
- **Relationships**: O(1) lookups via RelationshipIndex integration

**Performance**:
- Search 1000 notes: 12ms (was 2-3s with O(n) filtering)
- Search 1000 tasks: 14ms (was 2-3s with O(n) filtering)
- 200x faster than linear filtering

**Integration with AI Tools**:
The UnifiedIndexManager is used by `nedToolExecutor.ts` for all search operations:
- `search_notes` tool: Uses UnifiedIndexManager for O(log n) performance
- `search_tasks` tool: Uses UnifiedIndexManager for O(log n) performance
- Performance metrics included in tool results for monitoring

#### Topics, Companies, and Contacts as Metadata

**Important**: Topics, Companies, and Contacts are **NOT** directly searchable entities. They function as **relationship anchors** and **filter dimensions** in other entity indexes.

**Rationale**:
- Small datasets (~100 entities, ~100 bytes each)
- Simple CRUD via EntitiesContext
- Used to filter notes/tasks/sessions, not searched independently
- Reduces index complexity without sacrificing functionality

**Usage**:
```typescript
// ✅ Search notes BY topic (correct)
const result = await unifiedIndex.search({
  entityTypes: ['notes'],
  relatedTo: { entityType: 'topic', entityId: 'topic-123' }
});

// ❌ Search topics directly (not supported, not needed)
// Use EntitiesContext for CRUD operations:
const { topics } = useEntities();
const topic = topics.find(t => t.name === 'Authentication');
```

#### Deprecated: QueryEngine

**Status**: Removed (November 2025)

The `QueryEngine` service has been removed and replaced by `UnifiedIndexManager`:
- **Old**: `QueryEngine` with SQL-like queries (O(n) linear filtering)
- **New**: `UnifiedIndexManager` with inverted indexes (O(log n))

**Migration**:
```typescript
// ❌ OLD (removed):
import { QueryEngine } from '@/services/storage/QueryEngine';
const results = await queryEngine.query(
  'notes',
  [{ field: 'status', operator: '=', value: 'active' }],
  { field: 'createdAt', direction: 'desc' },
  20
);

// ✅ NEW:
import { getUnifiedIndexManager } from '@/services/storage/UnifiedIndexManager';
const unifiedIndex = await getUnifiedIndexManager();
const result = await unifiedIndex.search({
  entityTypes: ['notes'],
  filters: { status: 'active' },
  sortBy: 'date',
  sortOrder: 'desc',
  limit: 20
});
```

**Context Changes**:
- `NotesContext.queryNotes()` - REMOVED (use UnifiedIndexManager directly)
- `TasksContext.queryTasks()` - REMOVED (use UnifiedIndexManager directly)

### Storage Architecture (Phase 4 - Complete)

**Status**: Production-ready, Phase 4 complete (October 2025)
**Documentation**: `/docs/sessions-rewrite/STORAGE_ARCHITECTURE.md`

Taskerino uses a **sophisticated multi-layer storage system** delivering dramatic performance improvements:

#### Performance Achievements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Session Load | 2-3s | <1s | **3-5x faster** |
| Cached Load | 2-3s | <1ms | **2000-3000x faster** |
| Search | 2-3s | <100ms | **20-30x faster** |
| Storage Size | Baseline | -50% | **2x reduction** |
| UI Blocking | 200-500ms | 0ms | **100% eliminated** |

#### Core Components

**1. ChunkedSessionStorage** (`/src/services/storage/ChunkedSessionStorage.ts`):
- Metadata-only loading for session lists (<1ms, was 2-3s)
- Progressive loading for full sessions (<500ms)
- Append operations for active sessions (0ms blocking)
- 44 tests passing, 100% type safe

```typescript
import { getChunkedStorage } from '@/services/storage/ChunkedSessionStorage';

const chunkedStorage = await getChunkedStorage();

// Load metadata only (20-30x faster for lists)
const metadata = await chunkedStorage.loadAllMetadata();

// Load full session (3-5x faster with progressive chunks)
const session = await chunkedStorage.loadFullSession(sessionId);

// Append screenshot (0ms blocking, queued automatically)
await chunkedStorage.appendScreenshot(sessionId, screenshot);
```

**2. ContentAddressableStorage** (`/src/services/storage/ContentAddressableStorage.ts`):
- SHA-256 deduplication (30-50% storage savings)
- Reference counting with garbage collection
- Atomic operations via transactions
- 39 tests passing, zero data integrity issues

```typescript
import { getCAStorage } from '@/services/storage/ContentAddressableStorage';

const caStorage = await getCAStorage();

// Save attachment (auto-deduplicates if hash exists)
const hash = await caStorage.saveAttachment(attachment);
await caStorage.addReference(hash, sessionId, attachmentId);

// Run garbage collection (frees unreferenced attachments)
const result = await caStorage.collectGarbage();
console.log(`Freed: ${result.freed} bytes`);
```

**3. InvertedIndexManager** (`/src/services/storage/InvertedIndexManager.ts`):
- Full-text + structured search (<100ms, was 2-3s)
- 7 indexes: topic, date, tag, full-text, category, sub-category, status
- Auto-rebuild on corruption
- 71 tests passing (47 main + 24 performance)

```typescript
import { getInvertedIndexManager } from '@/services/storage/InvertedIndexManager';

const indexManager = await getInvertedIndexManager();

// Search with multiple filters (20-500x faster than linear scan)
const result = await indexManager.search({
  text: 'authentication bug',
  tags: ['backend', 'security'],
  dateRange: { start, end },
  operator: 'AND'
});

// Update indexes after session changes
await indexManager.updateSession(session);
```

**4. LRUCache** (`/src/services/storage/LRUCache.ts`):
- In-memory cache with size-based eviction (100MB default)
- >90% hit rate for hot data (50-100x faster than storage)
- TTL support (5 minutes default)
- Pattern invalidation for cache consistency
- 39 tests passing, O(1) operations

```typescript
// Automatic caching via ChunkedSessionStorage
const stats = chunkedStorage.getCacheStats();
console.log(`Hit rate: ${stats.hitRate}%`);  // Target: >90%

// Manual cache management if needed
chunkedStorage.clearCache();  // Clear all
chunkedStorage.clearSessionCache(sessionId);  // Clear specific session
chunkedStorage.setCacheSize(200 * 1024 * 1024);  // Resize to 200MB
```

**5. PersistenceQueue** (`/src/services/storage/PersistenceQueue.ts`):
- Zero UI blocking (0ms, was 200-500ms)
- 3 priority levels: critical (immediate), normal (batched 100ms), low (idle)
- Phase 4 enhancements: Chunk batching (10x fewer transactions), index batching (5x faster), CA storage batching (20x fewer writes)
- 46 tests passing (25 Phase 1 + 21 Phase 4)

```typescript
import { getPersistenceQueue } from '@/services/storage/PersistenceQueue';

const queue = getPersistenceQueue();

// Phase 4: Chunk write batching (10 chunks → 1 transaction)
queue.enqueueChunk(sessionId, 'screenshots/chunk-001', data, 'normal');

// Phase 4: Index update batching
queue.enqueueIndex('by-topic', topicIndex, 'low');

// Phase 4: CA storage batching (20 refs → 1 transaction)
queue.enqueueCAStorage(hash, metadata, 'normal');

// Phase 4: Cleanup scheduling
queue.enqueueCleanup('gc', 'low');  // Garbage collection
```

**6. CompressionWorker** (`/src/workers/CompressionWorker.ts`):
- Background compression via Web Worker (0ms UI blocking)
- JSON gzip: 60-70% reduction
- Screenshot WebP: 20-40% reduction
- Overall: 55% average storage reduction
- Auto mode (idle-time) or manual mode

```typescript
// Enable in Settings > Background Compression
{
  enabled: true,
  mode: 'auto',  // or 'manual'
  maxCPU: 20,  // CPU usage threshold
  ageThresholdDays: 7,  // Only compress sessions >7 days old
  compressScreenshots: true  // WebP conversion
}
```

#### Storage Structure

```
/sessions-chunked/           # Chunked sessions (Phase 4)
  {session-id}/
    metadata.json            # Core fields (id, name, timestamps)
    summary.json             # AI-generated summary
    audioInsights.json       # Audio analysis
    screenshots/
      chunk-000.json         # 10 screenshots per chunk
      chunk-001.json
    audioSegments/
      chunk-000.json         # 50 audio segments per chunk

/attachments-ca/             # Content-addressable attachments
  {hash-prefix}/             # First 2 chars (sharding)
    {full-hash}/
      data.bin               # Actual attachment data
      metadata.json          # { hash, refCount, references[] }

/session-indexes             # Inverted indexes (single file)
```

#### Migration System

**Comprehensive migration from Phase 3 to Phase 4**:

```typescript
import { migrateToPhase4Storage } from '@/migrations/migrate-to-phase4-storage';
import { createRollbackPoint, rollbackToPhase3Storage } from '@/services/storage/StorageRollback';

// Step 1: Create rollback point (safety first)
const rollbackPoint = await createRollbackPoint('pre-phase4-migration');

// Step 2: Run migration (4 steps: chunked, CA, indexes, compression)
const result = await migrateToPhase4Storage({
  dryRun: false,  // Set true for testing
  verbose: true,
  onProgress: (progress) => {
    console.log(`Migration: ${progress.percentage}% complete`);
  }
});

// Step 3: Rollback if needed (30-day retention)
if (!result.success) {
  await rollbackToPhase3Storage(true);  // Requires confirmation
}
```

**Background Migration** (zero UI impact):

```typescript
import { getBackgroundMigrationService } from '@/services/BackgroundMigrationService';

const service = getBackgroundMigrationService();

// Start background migration (pauses when user active)
await service.start({
  batchSize: 20,
  pauseOnActivity: true,
  onProgress: (progress) => {
    console.log(`${progress.percentage}% complete`);
  }
});

// Control migration
service.pause();
service.resume();
await service.cancel();
```

#### Dual-Adapter Pattern (Foundation)

The app uses a **dual-adapter storage system** for cross-platform compatibility:

- **Browser**: `IndexedDBAdapter` - IndexedDB with transaction support
- **Desktop**: `TauriFileSystemAdapter` - Native file system with atomic writes

**Transaction Support** (Phase 1):

```typescript
import { getStorage } from '@/services/storage';

const storage = getStorage();
const tx = await storage.beginTransaction();

try {
  tx.save('sessions', updatedSessions);
  tx.save('activeSessionId', sessionId);
  await tx.commit();  // All succeed or all fail
} catch (error) {
  await tx.rollback();  // Restore previous state
}
```

#### Best Practices

1. **Use ChunkedSessionStorage** for all session operations
2. **Load metadata only** for list views (20-30x faster)
3. **Use ContentAddressableStorage** for attachments (30-50% savings)
4. **Update InvertedIndexManager** after session changes
5. **Monitor cache hit rate** (target: >90%) in Settings > Storage
6. **Enable background compression** for 50-70% storage reduction
7. **Run garbage collection** weekly or after bulk deletions

#### Documentation

- **Architecture**: `/docs/sessions-rewrite/STORAGE_ARCHITECTURE.md` (800+ lines)
- **Summary**: `/docs/sessions-rewrite/PHASE_4_SUMMARY.md` (500+ lines)
- **Migration Guide**: `/docs/sessions-rewrite/DEVELOPER_MIGRATION_GUIDE.md`
- **Performance Tuning**: `/docs/sessions-rewrite/PERFORMANCE_TUNING.md`
- **Troubleshooting**: `/docs/sessions-rewrite/TROUBLESHOOTING.md`

### AI Processing Pipeline

#### 1. Capture Processing (`claudeService.ts`)
```
User Input (text + attachments)
  ↓
Topic Detection (fuzzy matching with confidence scoring)
  ↓
Note Creation/Merging (similarity algorithm, 30% threshold)
  ↓
Task Extraction (natural language parsing with priority inference)
  ↓
AIProcessResult
```

#### 2. Sessions Agent (`sessionsAgentService.ts`)
```
Screenshot captured
  ↓
AI Analysis (activity detection, OCR, context delta)
  ↓
Progress Tracking (achievements, blockers, insights)
  ↓
Adaptive Scheduling (curiosity score for next interval)
```

#### 3. Enrichment Pipeline (`sessionEnrichmentService.ts`)
```
Session Ends
  ↓
Validation & Cost Estimation
  ↓
Audio Review (GPT-4o audio analysis) [OPTIONAL]
  ↓
Video Chaptering (frame analysis) [OPTIONAL]
  ↓
Summary Generation (synthesize all data)
  ↓
EnrichmentStatus (tracking + cost monitoring)
```

### Enrichment Optimization System (Phase 5 - Complete)

**Status**: Production-ready (October 2025)
**Cost Reduction**: 78% average (target: 70-85%)
**Throughput**: 5x faster (1 → 5 sessions/min)
**Documentation**: `/docs/sessions-rewrite/ENRICHMENT_OPTIMIZATION_GUIDE.md`

Phase 5 delivers comprehensive enrichment optimization through intelligent caching, parallel processing, and robust error handling.

#### Core Services

**1. EnrichmentResultCache** (`src/services/enrichment/EnrichmentResultCache.ts` - 732 lines):
- Two-tier caching (L1: LRU in-memory, L2: Content-addressable storage)
- Cache key: SHA-256(audioData + videoData + prompt + modelConfig)
- Cache hit rate: 60-70% typical
- Cache hit latency: <1ms (instant, $0 cost)

```typescript
import { getEnrichmentResultCache } from '@/services/enrichment/EnrichmentResultCache';

const cache = getEnrichmentResultCache();
const cached = await cache.getCachedResult(cacheKey);
if (cached) {
  return cached.result; // Instant, $0
}

// Cache miss - compute and cache
const result = await enrichSession(session);
await cache.cacheResult(cacheKey, result);
```

**2. IncrementalEnrichmentService** (`src/services/enrichment/IncrementalEnrichmentService.ts` - 630 lines):
- Delta detection for screenshots and audio segments
- Only processes new data since last enrichment
- 70-90% cost reduction for append operations
- Checkpoint persistence via ChunkedStorage

```typescript
import { getIncrementalEnrichmentService } from '@/services/enrichment/IncrementalEnrichmentService';

const incremental = getIncrementalEnrichmentService();
const checkpoint = await incremental.loadCheckpoint(sessionId);
const changes = await incremental.detectChanges(session, checkpoint);

if (changes.hasChanges) {
  // Only enrich new data (70-90% cheaper)
  await incremental.enrichIncremental(session, changes, options);
}
```

**3. MemoizationCache** (`src/services/enrichment/MemoizationCache.ts` - 637 lines):
- Caches intermediate AI API results
- Screenshot analysis: 40-60% hit rate
- Audio transcription: 20-30% hit rate
- 30-50% reduction in API calls overall

```typescript
import { getMemoizationCache } from '@/services/enrichment/MemoizationCache';

const memoCache = getMemoizationCache();
const result = await memoCache.getOrCompute(
  `screenshot:${hash}`,
  async () => await analyzeScreenshot(screenshot),
  86400000 // 24 hour TTL
);
```

**4. ParallelEnrichmentQueue** (`src/services/enrichment/ParallelEnrichmentQueue.ts` - 777 lines):
- Processes multiple sessions concurrently (5x throughput)
- Three priority levels (high, normal, low)
- 100% error isolation (one failure doesn't block others)
- Rate limiting with exponential backoff

```typescript
import { getParallelEnrichmentQueue } from '@/services/enrichment/ParallelEnrichmentQueue';

const queue = getParallelEnrichmentQueue();

// Enrich multiple sessions in parallel
sessions.forEach(session => {
  queue.enqueue(session, { includeAudio: true }, 'normal');
});

// Monitor progress
queue.on('completed', (job) => {
  console.log(`Session ${job.sessionId} enriched`);
});
```

**5. EnrichmentWorkerPool** (`src/services/enrichment/EnrichmentWorkerPool.ts` - 645 lines):
- Efficient resource management for parallel processing
- Worker lifecycle management (create, acquire, release)
- Health monitoring (99.9% uptime target)
- Auto-restart on persistent failures

**6. ProgressTrackingService** (`src/services/enrichment/ProgressTrackingService.ts` - 627 lines):
- Real-time enrichment progress tracking
- Stage-by-stage updates (Audio → Video → Summary → Canvas)
- Simple time-based ETA (NO COST ESTIMATES)
- **CRITICAL**: Zero cost information in UI

```typescript
import { getProgressTrackingService } from '@/services/enrichment/ProgressTrackingService';

const progress = getProgressTrackingService();

// Start tracking
progress.startProgress(sessionId, options);

// Update progress (NO COST INFO)
progress.updateProgress(sessionId, {
  stage: 'audio',
  progress: 0.5,
  message: 'Analyzing audio...' // NO COST
});

// Complete
progress.completeProgress(sessionId, true, 'Session enriched successfully');
```

**7. EnrichmentErrorHandler** (`src/services/enrichment/EnrichmentErrorHandler.ts` - 715 lines):
- Error classification (transient, permanent, partial)
- Exponential backoff retry (1s → 10s max)
- Circuit breaker pattern (5 failures → open)
- 99% recovery rate for transient errors
- User-friendly messages (NO COST INFO)

```typescript
import { getEnrichmentErrorHandler } from '@/services/enrichment/EnrichmentErrorHandler';

const errorHandler = getEnrichmentErrorHandler();

try {
  await enrichSession(session);
} catch (error) {
  const resolution = await errorHandler.handleError(error, context);

  if (resolution.shouldRetry) {
    await delay(resolution.retryDelay);
    return enrichSession(session); // Retry
  } else {
    // Show user-friendly message (NO COST)
    showError(resolution.userMessage);
  }
}
```

**8. CacheInvalidationService** (`src/services/enrichment/CacheInvalidationService.ts` - 645 lines):
- Smart cache invalidation rules
- Content change detection (automatic via SHA-256)
- Model version tracking
- Prompt fingerprinting
- Bulk invalidation API

#### Cost Optimization Strategies

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| **Result Caching** | 60-70% hit rate = instant, $0 | EnrichmentResultCache |
| **Incremental Enrichment** | 70-90% for appends | IncrementalEnrichmentService |
| **Memoization** | 30-50% API reduction | MemoizationCache |
| **Parallel Processing** | 5x throughput | ParallelEnrichmentQueue |
| **Error Recovery** | 99% success rate | EnrichmentErrorHandler |
| **TOTAL** | **78% average** | **All systems** |

#### Claude 4.5 Model Selection

Phase 5 uses the Claude 4.5 family:

1. **Haiku 4.5** (`claude-haiku-4-5-20251015`):
   - Real-time screenshot analysis (4-5x faster than Sonnet)
   - Cost: $1 input / $5 output per MTok
   - Quality: 90% of Sonnet 4.5 performance
   - Use: Simple classification, quick OCR, activity detection

2. **Sonnet 4.5** (`claude-sonnet-4-5-20250929`):
   - Batch analysis, comprehensive enrichment
   - Cost: $3 input / $15 output per MTok
   - Quality: Best overall, outperforms Opus in coding
   - Use: Session summaries, deep analysis (95% of enrichment)

3. **Opus 4.1** (`claude-opus-4-1-20250820`):
   - RARE - only for high-stakes complex reasoning
   - Cost: $15 input / $75 output per MTok (5x premium)
   - NOT RECOMMENDED for session enrichment

**Recommendation**: Use Sonnet 4.5 for 95% of enrichment, Haiku 4.5 for 5% (real-time).

#### NO COST UI Philosophy

**CRITICAL DESIGN CONSTRAINT**: Cost information is NEVER shown in the main Sessions UI.

**User-Facing** (MINIMAL):
- ❌ NO cost indicators in sessions list
- ❌ NO cost counters during enrichment
- ❌ NO cost warnings during normal usage
- ✅ Simple progress: "Analyzing audio...", "~5 minutes remaining"
- ✅ Users feel free to enrich without anxiety

**Backend Tracking** (Always On):
- ✅ Detailed cost attribution in logs
- ✅ Per-session cost tracking
- ✅ Daily/monthly aggregates
- ✅ Optimization recommendations

**Settings Zone Only** (Optional, Admin):
- Location: Settings → Advanced → System Health (hidden by default)
- Metrics: Historical cost trends, cache hit rates, savings
- **NOT prominent**: Requires explicit navigation

**User-Friendly Error Messages** (NO COST):
```typescript
// ✅ CORRECT (no cost info)
"Couldn't reach the API. Retrying..."
"Session partially enriched (audio only)"
"Your API key needs to be configured"

// ❌ WRONG (showing cost)
"Cost limit exceeded: $10.00"
"Each retry costs $0.50"
```

**Rationale**: Cost anxiety inhibits usage. We track costs for optimization, not to stress users.

#### Integration Example

```typescript
import { getEnrichmentResultCache } from '@/services/enrichment/EnrichmentResultCache';
import { getIncrementalEnrichmentService } from '@/services/enrichment/IncrementalEnrichmentService';
import { getParallelEnrichmentQueue } from '@/services/enrichment/ParallelEnrichmentQueue';
import { getProgressTrackingService } from '@/services/enrichment/ProgressTrackingService';
import { getEnrichmentErrorHandler } from '@/services/enrichment/EnrichmentErrorHandler';

// Single session enrichment (with caching)
async function enrichSessionOptimized(session: Session) {
  const cache = getEnrichmentResultCache();
  const incremental = getIncrementalEnrichmentService();
  const progress = getProgressTrackingService();
  const errorHandler = getEnrichmentErrorHandler();

  // Check cache first (60-70% hit rate)
  const cacheKey = generateCacheKey(session);
  const cached = await cache.getCachedResult(cacheKey);
  if (cached) return cached.result; // Instant, $0

  // Check if incremental possible (70-90% savings)
  const checkpoint = await incremental.loadCheckpoint(session.id);
  const changes = await incremental.detectChanges(session, checkpoint);

  try {
    progress.startProgress(session.id);

    let result;
    if (changes.hasChanges) {
      // Only process new data
      result = await incremental.enrichIncremental(session, changes);
    } else {
      // Full enrichment
      result = await enrichSession(session);
    }

    // Cache result for next time
    await cache.cacheResult(cacheKey, result);

    progress.completeProgress(session.id, true);
    return result;

  } catch (error) {
    const resolution = await errorHandler.handleError(error, {
      sessionId: session.id,
      operation: 'enrichment',
      attemptNumber: 1
    });

    if (resolution.shouldRetry) {
      await delay(resolution.retryDelay);
      return enrichSessionOptimized(session); // Retry
    } else {
      progress.completeProgress(session.id, false, resolution.userMessage);
      throw error;
    }
  }
}

// Batch enrichment (5x faster)
async function batchEnrichSessions(sessions: Session[]) {
  const queue = getParallelEnrichmentQueue();

  sessions.forEach(session => {
    queue.enqueue(session, { includeAudio: true }, 'normal');
  });

  await queue.waitForCompletion();
}
```

#### Performance Metrics

| Metric | Before Phase 5 | After Phase 5 | Improvement |
|--------|----------------|---------------|-------------|
| Enrichment Cost | Baseline | -78% | **70-85% target** |
| Throughput | 1 session/min | 5 sessions/min | **5x faster** |
| Cache Hit Rate | 0% | 60-70% | **Instant, $0** |
| Error Recovery | ~50% | 99% | **2x better** |
| Cache Latency | N/A | <1ms | **Instant** |

#### Best Practices

1. **Always use caching**: Check EnrichmentResultCache before processing
2. **Use incremental enrichment**: For append operations (70-90% savings)
3. **Batch process**: Use ParallelEnrichmentQueue for multiple sessions
4. **Monitor cache**: Target 60%+ hit rate (check Settings → Advanced)
5. **Never show cost**: All cost info is backend-only
6. **Handle errors gracefully**: Use EnrichmentErrorHandler for retries
7. **Track progress**: Use ProgressTrackingService (NO COST in UI)

#### Documentation

- **PHASE_5_SUMMARY.md**: Executive summary and metrics
- **ENRICHMENT_OPTIMIZATION_GUIDE.md**: Comprehensive developer guide
- **PHASE_5_DEPLOYMENT.md**: Production deployment checklist
- **API Reference**: See guide for detailed API documentation

### Background Enrichment System (Tasks 11-15 - Complete)

**Status**: Production-ready (October 2025)
**Documentation**: `/docs/sessions-rewrite/BACKGROUND_ENRICHMENT_IMPLEMENTATION_SUMMARY.md`
**User Guide**: `/docs/user-guides/BACKGROUND_ENRICHMENT_USER_GUIDE.md`
**API Reference**: `/docs/developer/BACKGROUND_ENRICHMENT_API.md`

The Background Enrichment System transforms session processing from blocking, synchronous operations to persistent, background-powered workflows.

#### Key Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Video Playback Delay | 2-3s | <1s | **3x faster** |
| Storage Size | 500MB | 200MB | **60% reduction** |
| Enrichment Reliability | ~95% | 99.9% | **5x fewer failures** |
| Session End Blocking | 200-500ms | 0ms | **100% eliminated** |

#### Core Architecture

```
Session End
    ↓
BackgroundEnrichmentManager (orchestrator)
    ↓
PersistentEnrichmentQueue (IndexedDB-backed, survives restart)
    ↓
BackgroundMediaProcessor (2-stage optimization)
    ├── Audio Concatenation (5s, 0-50% progress)
    └── Video/Audio Merge (30s, 50-100% progress)
    ↓
Session.video.optimizedPath saved
    ↓
UnifiedMediaPlayer (dual-path: optimized vs legacy)
```

#### Core Services

**1. BackgroundEnrichmentManager** (`src/services/enrichment/BackgroundEnrichmentManager.ts` - 582 lines):
- High-level API for enrichment lifecycle
- Job creation and validation
- Event forwarding to UI components
- OS-level notification management

```typescript
import { getBackgroundEnrichmentManager } from '@/services/enrichment/BackgroundEnrichmentManager';

const manager = await getBackgroundEnrichmentManager();
await manager.initialize(); // Call on app launch

// Enqueue session for enrichment
const jobId = await manager.enqueueSession({
  sessionId: session.id,
  sessionName: session.name,
  options: { includeAudio: true, includeVideo: true }
});

// Mark media processing complete (triggers enrichment)
await manager.markMediaProcessingComplete(sessionId, optimizedVideoPath);

// Get queue status
const status = await manager.getQueueStatus();
console.log(`${status.processing} jobs processing`);
```

**2. PersistentEnrichmentQueue** (`src/services/enrichment/PersistentEnrichmentQueue.ts` - 1,128 lines):
- IndexedDB-backed job queue (survives app restart)
- Priority-based processing (high → normal → low)
- Automatic retry with exponential backoff (3 attempts)
- Error isolation (one failure doesn't block others)
- Concurrency control (max 5 simultaneous jobs)

**Job Lifecycle**:
```
pending → processing → completed
              ↓
           failed → (retry 3x) → failed (permanent)
              ↓
          cancelled
```

**Recovery on App Restart**:
1. Scan for jobs stuck in `processing` (crashed during enrichment)
2. Reset to `pending`
3. Resume from highest priority pending job

**3. BackgroundMediaProcessor** (`src/services/enrichment/BackgroundMediaProcessor.ts` - 411 lines):
- Two-stage media optimization
- Stage 1: Audio concatenation (WAV segments → MP3, ~5s)
- Stage 2: Video/audio merge (separate files → optimized MP4, ~30s)
- Real-time progress callbacks
- Job cancellation support

**Media Optimization**:
```typescript
// Stage 1: Concatenate audio (0-50%)
concatenatedAudioPath = await audioConcatenationService.concatenateAndSave(
  sessionId,
  audioSegments
);

// Stage 2: Merge video + audio (50-100%)
optimizedVideoPath = await invoke('merge_video_audio', {
  sessionId,
  videoPath,        // Original video
  audioPath,        // Concatenated MP3
  compressionLevel  // 0.4 (60% size reduction)
});
```

**Result**: Single optimized MP4 file (500MB → 200MB) with H.264 video + AAC audio

**4. SessionProcessingScreen** (`src/components/sessions/SessionProcessingScreen.tsx` - 456 lines):
- Full-screen progress modal
- Real-time updates via `eventBus`
- Two stages: "Combining Audio" (0-50%) → "Optimizing Video" (50-100%)
- Auto-navigate to session detail after completion
- Non-blocking (user can navigate away)

#### Integration Points

**1. ActiveSessionContext**:
```typescript
async function endSession() {
  // Stop recording services
  await stopScreenshots();
  await stopAudioRecording();
  await stopVideoRecording();

  // Enqueue enrichment
  const manager = await getBackgroundEnrichmentManager();
  await manager.enqueueSession({
    sessionId: session.id,
    sessionName: session.name,
    options: { includeAudio: true, includeVideo: true }
  });

  // Navigate to processing screen
  navigate('/sessions/processing', { state: { sessionId: session.id } });
}
```

**2. App.tsx Initialization**:
```typescript
useEffect(() => {
  (async () => {
    const manager = await getBackgroundEnrichmentManager();
    await manager.initialize();
  })();
}, []);
```

**3. UnifiedMediaPlayer Dual-Path**:
```typescript
// NEW: Optimized path (instant playback, no sync)
if (session.video?.optimizedPath) {
  return <video src={convertFileSrc(session.video.optimizedPath)} controls />;
}

// LEGACY: Old sessions (runtime concatenation, sync logic)
return <LegacyMediaPlayer session={session} />;
```

#### Performance Metrics

| Metric | Target | Achieved |
|--------|--------|----------|
| Audio concatenation | <5s | ~5s ✅ |
| Video/audio merge | <30s | ~30s ✅ |
| Total processing | <40s | ~35-40s ✅ |
| Queue initialization | <500ms | ~100ms ✅ |
| Optimized file size | 40% of original | 40% ✅ |

#### Testing Coverage

- **Background Enrichment E2E**: 10 tests (full lifecycle, restart recovery, error retry)
- **UnifiedMediaPlayer Integration**: 15 tests (dual-path logic, legacy fallback)
- **Complete Lifecycle E2E**: 3 tests (MASTER test: session end → enrichment → playback)
- **Total**: 28 test cases across 1,986 lines of test code

#### Event Bus Events

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
- `job-cancelled` - User cancelled

#### Best Practices

1. **Always initialize manager**: Call `initialize()` on app launch
2. **Handle events**: Subscribe to progress events for UI updates
3. **Clean up listeners**: Unsubscribe on component unmount
4. **Check job status**: Verify status before actions (cancel, retry)
5. **Use TypeScript types**: Import types for type safety

#### Documentation

- **Implementation Summary**: `/docs/sessions-rewrite/BACKGROUND_ENRICHMENT_IMPLEMENTATION_SUMMARY.md` (comprehensive technical overview)
- **User Guide**: `/docs/user-guides/BACKGROUND_ENRICHMENT_USER_GUIDE.md` (user-facing documentation)
- **API Reference**: `/docs/developer/BACKGROUND_ENRICHMENT_API.md` (complete API docs with examples)
- **Test Report**: `/docs/sessions-rewrite/TASK_14_E2E_TESTING_REPORT.md` (28 test cases)

### Ned AI Assistant

Ned is a conversational AI with **tool execution capabilities**:

- **Core Service**: `nedService.ts` - Handles streaming responses with tool use
- **Tool Execution**: `nedToolExecutor.ts` - Executes tools with permission checks
- **Memory System**: `nedMemory.ts` - Maintains conversation context
- **Available Tools**: Search, task/note CRUD, session queries, enrichment triggers

**Permission System**: Users grant permissions at three levels:
- `forever` - Always allowed
- `session` - Allowed until app restart
- `always-ask` - Prompt every time

### Morphing Canvas System

The **Morphing Canvas** is a dynamic layout engine for session reviews:

**Location**: `src/components/morphing-canvas/`

**Key Concepts**:
- **Modules** - Self-contained UI components (Timeline, Tasks, Screenshots, etc.)
- **Layouts** - Predefined grid arrangements for modules
- **Config Generator** - AI-driven layout selection based on session data
- **Session Analyzer** - Examines session content to determine optimal layout

**Usage**: See `src/components/morphing-canvas/example.tsx` for implementation patterns.

## Design System

**Location**: `src/design-system/theme.ts`

Centralized design tokens and theme constants:
- `NAVIGATION` - Navigation-specific styles (logo, island, tabs)
- `KANBAN` - Kanban board styles
- `BACKGROUND_GRADIENT` - Gradient backgrounds for zones
- `Z_INDEX` - Z-index layering constants
- Utility functions: `getGlassClasses()`, `getRadiusClass()`, `getToastClasses()`, `getTaskCardClasses()`

**Usage**: Import theme constants instead of hardcoding values to maintain consistency.

## Important Patterns

### 1. Attachment Handling
```typescript
// Always use attachmentStorage for binary data
import { attachmentStorage } from './services/attachmentStorage';

// Create attachment
const attachment = await attachmentStorage.createAttachment({
  type: 'image',
  name: 'screenshot.png',
  mimeType: 'image/png',
  size: blob.size,
  base64: await blobToBase64(blob),
});

// Load attachment data
const data = await attachmentStorage.loadAttachment(attachmentId);
```

### 2. Session Lifecycle
```typescript
// Start session
dispatch({ type: 'START_SESSION', payload: { name, description, ... } });

// End session (triggers enrichment if configured)
dispatch({ type: 'END_SESSION', payload: sessionId });

// Enrichment runs automatically based on session's enrichmentConfig
```

### 3. Context Usage (Updated - Phase 1)
```typescript
// ❌ OLD (deprecated):
import { useSessions } from './context/SessionsContext';
const { sessions, activeSessionId, startSession } = useSessions();

// ✅ NEW (Phase 1):
import { useSessionList } from './context/SessionListContext';
import { useActiveSession } from './context/ActiveSessionContext';
import { useRecording } from './context/RecordingContext';

const { sessions, filteredSessions } = useSessionList();
const { activeSession, startSession, endSession } = useActiveSession();
const { recordingState, startScreenshots, stopAll } = useRecording();
```

**Migration Guide**: See `/docs/sessions-rewrite/CONTEXT_MIGRATION_GUIDE.md` for complete API mapping.

### 4. State Machine Usage (New - Phase 1)
```typescript
import { useSessionMachine } from '@/hooks/useSessionMachine';

const { state, context, isActive, startSession } = useSessionMachine();

// Type-safe state checks
if (state.matches('active')) {
  // Session is active
}

// Access machine context
console.log(context.sessionId);  // Current session ID
console.log(context.config);     // Session configuration
```

### 5. Refs Pattern (Updated - Phase 1)
```typescript
// ❌ AVOID: Using refs for state management (causes stale closures)
const activeSessionIdRef = useRef(activeSessionId);
const callback = useCallback(() => {
  const id = activeSessionIdRef.current;  // Stale closure risk
}, []);

// ✅ CORRECT: Use proper state/context dependencies
const { activeSession } = useActiveSession();
const callback = useCallback(() => {
  if (activeSession) {
    // activeSession is always fresh from context
  }
}, [activeSession]);  // Proper dependency

// ✅ OK: Using refs for DOM elements
const scrollRef = useRef<HTMLDivElement>(null);

// ✅ OK: Using refs for timers/async guards
const timeoutRef = useRef<NodeJS.Timeout | null>(null);
const listenerActiveRef = useRef<boolean>(false);  // Prevent duplicate async listeners
```

**Fixed**: SessionsZone now uses proper state management (Phase 1) - all state refs eliminated.

### 6. AI Service Error Handling
```typescript
// All AI services throw on missing API keys
try {
  const result = await claudeService.processInput(...);
} catch (error) {
  if (error.message.includes('API key')) {
    // Prompt user to configure API key
  }
}
```

## Testing Conventions

### Test Structure
```typescript
// Use descriptive test names with context
describe('SessionsContext', () => {
  describe('START_SESSION', () => {
    it('should create new session with generated ID', () => {
      // Arrange, Act, Assert
    });
  });
});
```

### Mocking AI Services
```typescript
// Mock at the module level
vi.mock('../services/claudeService', () => ({
  claudeService: {
    processInput: vi.fn(),
    setApiKey: vi.fn(),
  },
}));
```

### Coverage Thresholds
Current thresholds (see `vitest.config.ts`):
- Lines: 30%
- Functions: 30%
- Branches: 25%
- Statements: 30%

Focus on testing **critical paths**: session lifecycle, enrichment pipeline, storage adapters.

## Tauri-Specific Notes

### Rust Commands
All Tauri commands are in `src-tauri/src/`:

- `main.rs` - App initialization, window management
- `api_keys.rs` - Secure API key storage (using tauri-plugin-store)
- `activity_monitor.rs` - Activity metrics for adaptive screenshots (macOS-specific)
- `audio_capture.rs` - Audio recording (now uses AudioGraph internally, see [Migration Guide](docs/sessions-rewrite/AUDIO_MIGRATION_GUIDE.md))
- `audio/` - New modular audio system (Phase 3):
  - `audio/graph/` - Composable audio processing graph
  - `audio/sources/` - Audio input sources (microphone, system audio)
  - `audio/processors/` - Audio effects and mixing
  - `audio/sinks/` - Audio outputs (file encoders, buffers)
- `recording/` - **NEW** Modern recording system (Phase 2):
  - `recording/ffi.rs` - Safe FFI wrappers for Swift recording functions
  - `recording/mod.rs` - Module exports and types
- `video_recording.rs` - Recording Tauri commands (lifecycle, pause/resume, hot-swap, enumeration)
- `lib.rs` - SessionManager state management (Arc-based thread safety)
- `shutdown.rs` - Graceful recording cleanup on app shutdown
- `claude_api.rs` - Rust-side Claude API client (streaming)
- `openai_api.rs` - Rust-side OpenAI API client
- `session_storage.rs` - High-performance session data storage

### Invoking Rust Commands
```typescript
import { invoke } from '@tauri-apps/api/core';

// Example: Get API key from secure storage
const apiKey = await invoke<string | null>('get_claude_api_key');

// Example: Start activity monitoring
await invoke('start_activity_monitoring', { intervalMs: 5000 });
```

### macOS-Specific Features
- **Activity Monitoring**: Uses Core Graphics + Accessibility APIs (automatic OS-level tracking)
- **Screen Recording**: ScreenCaptureKit (macOS 12.3+) via Swift FFI bridge
  - Actor-based architecture for thread safety
  - Multi-source recording (display, window, webcam)
  - Pause/resume with zero memory overhead
  - Hot-swap sources during active recording
  - Frame synchronization across sources (16ms tolerance)
- **Audio Capture**: Uses AudioGraph architecture (composable audio pipeline)
  - **Backward Compatible**: All existing Tauri commands work unchanged
  - **New Features**: Direct AudioGraph usage for custom pipelines
  - **See**: [Audio Migration Guide](docs/sessions-rewrite/AUDIO_MIGRATION_GUIDE.md) for details

## Documentation Navigation

**Last Reorganized**: October 26, 2025

Taskerino has comprehensive documentation organized for easy navigation by AI agents and developers.

### Main Documentation Index

**Start Here**: `/docs/INDEX.md` - Central navigation hub for all documentation

### Quick Reference by Task

**For Understanding the Codebase**:
- Entry points with full JSDoc: `src/App.tsx` (122 lines), `src/main.tsx` (39 lines)
- Core utilities with JSDoc: `src/utils/helpers.ts`, `src/utils/sessionValidation.ts`
- Hooks with JSDoc: `src/hooks/useSessionStarting.ts`, `src/hooks/useSessionEnding.ts`
- Main types: `src/types.ts` (2000+ lines with deprecation markers)

**For Session-Related Work**:
- Master Plan: `/docs/sessions-rewrite/MASTER_PLAN.md` (formerly SESSIONS_REWRITE.md)
- Architecture: `/docs/sessions-rewrite/ARCHITECTURE.md`
- Current Status: `/docs/sessions-rewrite/README.md`
- Storage System: See "Storage Architecture (Phase 4)" section below
- Active session logic: `src/context/ActiveSessionContext.tsx`
- Session list/CRUD: `src/context/SessionListContext.tsx`
- Recording services: `src/context/RecordingContext.tsx`

**For Understanding Project History**:
- Archive Index: `/docs/archive/README.md` - 120+ archived documents
- Feature histories: `/docs/archive/features/{animation,audio,video,ui-ux,performance,etc.}/`
- Completion reports: `/docs/archive/reports/status/`
- Option C refactor: `/docs/archive/option-c-navigation-refactor/` (navigation evolution case study)

**For Code Examples**:
- AI Canvas: `/docs/examples/ai/aiCanvasGenerator.md`
- Unified Search: `/docs/UNIFIED_INDEX_MANAGER_IMPLEMENTATION_SUMMARY.md`
- Session Machine: `/docs/examples/sessionMachine.md`
- Component Examples: `/docs/examples/{Input,TopicPillManager,etc.}.md`
- Morphing Canvas: `/docs/examples/morphing-canvas/`

**For User Documentation**:
- User Guide: `/docs/user-guides/USER_GUIDE.md`
- Quick Start: `/docs/user-guides/QUICK_START.md`
- Keyboard Shortcuts: `/KEYBOARD_SHORTCUTS.md`

**For Developer Documentation**:
- API Reference: `/docs/developer/API_REFERENCE_GUIDE.md`
- File Reference: `/docs/developer/FILE_REFERENCE.md`
- Capture Flow: `/docs/developer/CAPTURE_FLOW_GUIDE.md`
- AI Architecture: `/docs/developer/AI_ARCHITECTURE.md`

**For TODO Tracking**:
- TODO Tracker: `/docs/developer/TODO_TRACKER.md` - 65 TODO markers catalogued by priority

### Documentation Archive Organization

The `/docs/archive/` directory contains 120+ historical documents organized by:
- **Features** (78 files): `animation/`, `audio/`, `video/`, `ui-ux/`, `performance/`, `sessions/`, `ned/`, `ai/`, etc.
- **Reports** (41 files): `testing/`, `reviews/`, `status/`, `phases/`
- **Special**: `option-c-navigation-refactor/` - Successful architecture evolution case study

**Why Archive?** Documents are archived (not deleted) to preserve institutional knowledge, provide historical context, and serve as reference for similar future work.

### Finding Information Quickly

**Use grep for code searches**:
```bash
# Find all TODO comments
grep -r "TODO" src/ --include="*.ts" --include="*.tsx"

# Find deprecated APIs
grep -r "@deprecated" src/ --include="*.ts" --include="*.tsx"

# Find XState machines
grep -r "createMachine" src/ --include="*.ts"
```

**Use documentation indices**:
- For codebase structure: See "File Organization" section below
- For project status: `/docs/sessions-rewrite/README.md`
- For historical context: `/docs/archive/README.md`
- For examples: `/docs/examples/` directory

### Deprecated Code Markers

Look for `@deprecated` JSDoc tags in the codebase. These indicate legacy code being phased out with migration guidance.

**Current Deprecated Items**:
- ❌ `SessionsContext` → Use `SessionListContext` + `ActiveSessionContext` + `RecordingContext`
- ❌ `AppContext` → Being split into specialized contexts (in progress)
- ❌ `SessionScreenshot.path` field → Use `attachmentId` with ContentAddressableStorage
- ❌ `MorphingMenuButton` component → Use `MenuMorphPill` instead (see `src/components/MorphingMenuButton.tsx:1-7`)
- ❌ `QueryEngine` service → REMOVED (November 2025) - Use `UnifiedIndexManager` instead
- ❌ `NotesContext.queryNotes()` → REMOVED (November 2025) - Use `UnifiedIndexManager` directly
- ❌ `TasksContext.queryTasks()` → REMOVED (November 2025) - Use `UnifiedIndexManager` directly

## File Organization

```
src/
├── components/          # React components (zones, cards, etc.)
│   ├── TopNavigation/   # Top navigation island system
│   ├── MorphingMenuButton.tsx  # [UNUSED] Alternative morphing menu (not currently integrated)
│   ├── MenuMorphPill.tsx       # [ACTIVE] Zone sub-menu morphing wrapper
│   ├── SpaceMenuBar.tsx        # [ACTIVE] Zone sub-menu content component
│   ├── morphing-canvas/ # Dynamic layout system for session reviews
│   ├── sessions/        # Session-specific components
│   └── ned/             # Ned assistant components
├── context/             # React contexts (state management)
├── contexts/            # Additional contexts (ScrollAnimationContext)
├── services/            # Business logic and AI services
│   └── storage/         # Storage adapters (IndexedDB, Tauri FS)
├── hooks/               # Custom React hooks
├── utils/               # Helper functions (matching, similarity, etc.)
├── migrations/          # Data migration scripts
├── types.ts             # TypeScript type definitions
├── types/               # Tauri-specific type definitions
├── design-system/       # Design tokens and theme constants
└── App.tsx              # Root component with providers

src-tauri/
├── src/                     # Rust source code
│   ├── main.rs              # Entry point
│   ├── lib.rs               # SessionManager state management
│   ├── api_keys.rs          # Secure key storage
│   ├── activity_monitor.rs  # Activity tracking
│   ├── audio_capture.rs     # Audio recording
│   ├── audio/               # Modular audio system (Phase 3)
│   │   ├── graph/           # Audio processing graph
│   │   ├── sources/         # Audio input sources
│   │   ├── processors/      # Audio effects and mixing
│   │   └── sinks/           # Audio outputs
│   ├── recording/           # NEW: Modern recording system (Phase 2)
│   │   ├── ffi.rs           # Safe FFI wrappers for Swift
│   │   └── mod.rs           # Module exports and types
│   ├── video_recording.rs   # Recording Tauri commands
│   ├── shutdown.rs          # Graceful app shutdown
│   ├── claude_api.rs        # Claude API client
│   ├── openai_api.rs        # OpenAI API client
│   ├── session_storage.rs   # High-perf storage
│   └── *.rs                 # Other Tauri commands
├── ScreenRecorder/          # Swift screen recording module (Phase 2)
│   ├── Core/                # Core actor-based recording system
│   │   ├── RecordingSession.swift      # Main orchestrator (460 lines)
│   │   ├── FrameSynchronizer.swift     # Frame sync (191 lines)
│   │   ├── FrameCompositor.swift       # Frame composition protocol
│   │   ├── VideoEncoder.swift          # H.264 encoding
│   │   ├── RecordingSource.swift       # Source protocol
│   │   └── SourcedFrame.swift          # Frame data structure
│   ├── Compositors/         # Compositor implementations
│   │   ├── GridCompositor.swift        # Grid layout
│   │   └── PiPCompositor.swift         # Picture-in-picture
│   ├── Sources/             # Recording source implementations
│   │   ├── DisplaySource.swift         # Display capture
│   │   ├── WindowSource.swift          # Window capture
│   │   └── WebcamSource.swift          # Webcam capture
│   └── ScreenRecorder.swift # FFI bridge (C exports)
└── Cargo.toml               # Rust dependencies
```

## Scroll Animation System

**ScrollAnimationContext** (`contexts/ScrollAnimationContext.tsx`) coordinates scroll-driven animations:

- Provides `scrollY` (number) and `scrollYMotionValue` (Framer Motion MotionValue) to all components
- Zones register their scroll containers via `registerScrollContainer()` / `unregisterScrollContainer()`
- Multiple scroll containers supported - tracks the "active" scrolling container
- Used by both navigation systems for coordinated morphing animations

**Key Integration Points**:
- TopNavigation uses `scrollY` for compact mode threshold (activates when scrollY >= certain value based on viewport)
- MenuMorphPill uses `scrollYMotionValue` for 60fps scroll-driven transforms (150-220px range)
- Both systems respond to the same scroll position for coordinated UX

## Common Gotchas

1. **API Keys**: Always check `hasApiKey` before calling AI services
2. **Attachment Lifecycle**: Delete attachments when deleting sessions/notes/tasks
3. **Enrichment Locks**: Prevent concurrent enrichment with `enrichmentLock`
4. **Storage Shutdown**: Call `storage.shutdown()` and `queue.shutdown()` on app close to flush pending writes
5. **Context Migration**: Use new session contexts (`useSessionList`, `useActiveSession`, `useRecording`) instead of deprecated `useSessions`
6. **Screenshot Paths**: Legacy `path` field is deprecated - use `attachmentId` instead
7. **Navigation vs Space Menus**: Don't confuse NavigationIsland (top tabs) with MenuMorphPill (zone sub-menus)
8. **Scroll Container Registration**: Always register/unregister scroll containers in useEffect cleanup
9. **MenuMorphPill resetKey**: Change `resetKey` prop when layout changes (e.g., sidebar toggle, item selection) to recalculate positions
10. **State Refs**: Never use refs for state management - use proper context/state with dependencies (causes stale closures)
11. **Persistence Queue**: Use queue for background saves - don't debounce manually (causes UI blocking)
12. **XState Machine**: Check machine state with `state.matches()`, not string equality
13. **Search API**: Use `UnifiedIndexManager` for all cross-entity search (QueryEngine removed, context.queryNotes/queryTasks removed)
14. **Metadata Entities**: Don't try to search Topics/Companies/Contacts directly - use them as filters in UnifiedIndexManager queries

## Performance Considerations

- **Lazy Loading**: Zones are lazy-loaded via React.lazy()
- **Virtual Scrolling**: Long lists use `@tanstack/react-virtual`
- **Image Compression**: Screenshots compressed before storage
- **Audio Compression**: Audio segments compressed to MP3 for AI processing
- **Debouncing**: Search and filter inputs are debounced (300ms)
- **Rust Parallelism**: Heavy operations use Rayon for parallel processing

## AI Cost Management

Sessions can be expensive due to:
- Screenshot analysis (vision API calls)
- Audio review (GPT-4o audio preview)
- Video chaptering (frame extraction + vision API)

**Cost Controls**:
- `enrichmentConfig.maxCostThreshold` - Stop if exceeded
- `enrichmentStatus.totalCost` - Running cost tracker
- Audio review is **ONE-TIME** only (never re-processed)

## Debugging Tips

1. **Storage Issues**: Check browser console for IndexedDB errors
2. **AI Processing**: Enable `showThinking` in Ned settings
3. **Session Enrichment**: Check `enrichmentStatus.errors` for pipeline failures
4. **Tauri Commands**: Use `tauri-plugin-log` output in terminal
5. **Context State**: Use React DevTools to inspect context values
