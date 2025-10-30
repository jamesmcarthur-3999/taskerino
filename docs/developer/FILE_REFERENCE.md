# Taskerino Sessions System - Key Files Reference

## Review Documents Generated
- **Full Report**: `/Users/jamesmcarthur/Documents/taskerino/SESSIONS_SYSTEM_IMPLEMENTATION_REVIEW.md` (791 lines)
- **Summary**: `/Users/jamesmcarthur/Documents/taskerino/REVIEW_SUMMARY.txt` (165 lines)

---

## Storage Layer Files

### ChunkedSessionStorage
- **Implementation**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/ChunkedSessionStorage.ts` (1,283 lines)
- **Tests**: 
  - `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/ChunkedSessionStorage.test.ts`
  - `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/ChunkedSessionStorage.performance.test.ts`

### ContentAddressableStorage
- **Implementation**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/ContentAddressableStorage.ts` (595 lines)
- **Tests**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/ContentAddressableStorage.test.ts`

### InvertedIndexManager
- **Implementation**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/InvertedIndexManager.ts` (753 lines)
- **Tests**: 
  - `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/InvertedIndexManager.test.ts`
  - `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/InvertedIndexManager.performance.test.ts`

### LRUCache
- **Implementation**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/LRUCache.ts` (412 lines)
- **Tests**: 
  - `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/LRUCache.test.ts`
  - `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/LRUCache.performance.test.ts`

### PersistenceQueue
- **Implementation**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/PersistenceQueue.ts` (510 lines)
- **Tests**: 
  - `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/PersistenceQueue.test.ts`
  - `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/PersistenceQueue.enhanced.test.ts`

### Storage Adapters
- **Base**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/StorageAdapter.ts`
- **IndexedDB**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/IndexedDBAdapter.ts` (1,200+ lines)
- **Tauri FS**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/TauriFileSystemAdapter.ts` (1,500+ lines)
- **Index**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/index.ts` (137 lines)

---

## Recording Layer Files

### Recording Services
- **Screenshot**: `/Users/jamesmcarthur/Documents/taskerino/src/services/screenshotCaptureService.ts` (410 lines)
- **Audio**: `/Users/jamesmcarthur/Documents/taskerino/src/services/audioRecordingService.ts` (530 lines)
- **Video**: `/Users/jamesmcarthur/Documents/taskerino/src/services/videoRecordingService.ts` (485 lines)

### Audio Graph (Rust)
- **Module**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio/mod.rs`
- **Graph Engine**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio/graph/`
- **Sources**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio/sources/`
- **Processors**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio/processors/`
- **Sinks**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio/sinks/`

### Swift ScreenRecorder
- **Main**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/ScreenRecorder/ScreenRecorder.swift` (104 KB)
- **Core Module**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/ScreenRecorder/Core/`
  - `VideoEncoder.swift`
  - `FrameSynchronizer.swift`
  - `FrameCompositor.swift`
  - `RecordingSource.swift`
- **Sources**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/ScreenRecorder/Sources/`
- **Compositors**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/ScreenRecorder/Compositors/`
- **Tests**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/ScreenRecorder/Tests/`

### Audio Capture (Rust/FFI)
- **Implementation**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio_capture.rs` (1,000+ lines)
- **Recording Module**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/recording/`

---

## Context Architecture Files

### New Session Contexts (Phase 1)
- **SessionListContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionListContext.tsx` (650+ lines)
- **ActiveSessionContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/ActiveSessionContext.tsx` (500+ lines)
- **RecordingContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/RecordingContext.tsx` (350+ lines)

### Deprecated Context (Still Active)
- **SessionsContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionsContext.tsx` (1,100+ lines)

### Other Contexts
- **EnrichmentContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/EnrichmentContext.tsx`
- **UIContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/UIContext.tsx`
- **EntitiesContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/EntitiesContext.tsx`
- **NotesContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx`
- **TasksContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/TasksContext.tsx`
- **RelationshipContext**: `/Users/jamesmcarthur/Documents/taskerino/src/context/RelationshipContext.tsx`

---

## State Machine Files

### XState v5 Implementation
- **Machine Definition**: `/Users/jamesmcarthur/Documents/taskerino/src/machines/sessionMachine.ts` (312 lines)
- **Services**: `/Users/jamesmcarthur/Documents/taskerino/src/machines/sessionMachineServices.ts` (350+ lines)
- **Example**: `/Users/jamesmcarthur/Documents/taskerino/src/machines/sessionMachine.example.tsx`
- **Tests**: `/Users/jamesmcarthur/Documents/taskerino/src/machines/__tests__/`

---

## Component Integration Files

### Main Session UI
- **SessionsZone**: `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionsZone.tsx` (954 lines)
- **ActiveSessionView**: `/Users/jamesmcarthur/Documents/taskerino/src/components/ActiveSessionView.tsx` (320 lines)
- **SessionDetailView**: `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionDetailView.tsx`
- **CanvasView**: `/Users/jamesmcarthur/Documents/taskerino/src/components/CanvasView.tsx`

### Session Components
- **SessionsZone sub-components**: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/`
  - `SessionsSearchBar.tsx`
  - `SessionsSortMenu.tsx`
  - `SessionsStatsBar.tsx`
  - `BulkOperationsBar.tsx`
  - `SessionCard.tsx`
  - `SessionListGroup.tsx`
  - `ActiveSessionMediaControls.tsx`

---

## Test Files

### Storage Layer Tests
- **Location**: `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/`
- **Files**: 17 test files covering:
  - ChunkedSessionStorage (3 files)
  - InvertedIndexManager (2 files)
  - ContentAddressableStorage (1 file)
  - LRUCache (2 files)
  - PersistenceQueue (3 files)
  - Integration tests (3+ files)
  - Performance tests (multiple files)

### Test Utilities
- **Setup**: `/Users/jamesmcarthur/Documents/taskerino/src/test/setup.ts`
- **Fixtures**: `/Users/jamesmcarthur/Documents/taskerino/tests/fixtures/`
- **Mocks**: `/Users/jamesmcarthur/Documents/taskerino/tests/mocks/`
- **Helpers**: `/Users/jamesmcarthur/Documents/taskerino/tests/utils/`

### Test Configuration
- **vitest.config.ts**: `/Users/jamesmcarthur/Documents/taskerino/vitest.config.ts`
- **tsconfig.app.json**: `/Users/jamesmcarthur/Documents/taskerino/tsconfig.app.json`

---

## Documentation Files

### In Root
- **CLAUDE.md**: `/Users/jamesmcarthur/Documents/taskerino/CLAUDE.md` (29,575 bytes)
  - Contains all architecture documentation
  - Describes contexts, storage, state machines
  - Has migration guides
  - Documents all design patterns

### In Docs Directory
- **Location**: `/Users/jamesmcarthur/Documents/taskerino/docs/`
- **Sessions Rewrite**: `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/`
  - STORAGE_ARCHITECTURE.md
  - PHASE_4_SUMMARY.md
  - DEVELOPER_MIGRATION_GUIDE.md
  - PERFORMANCE_TUNING.md
  - AUDIO_MIGRATION_GUIDE.md
  - TROUBLESHOOTING.md

### Recent Review Documents
- **STORAGE_IMPLEMENTATION_TRACKING.md** - Implementation progress tracking
- **IMPLEMENTATION_STATUS.md** - Status of features
- **SESSIONS_REWRITE.md** - Rewrite planning
- **CHANGELOG.md** - Change log
- **ARCHITECTURE_ANALYSIS.md** - Architecture review
- **MIGRATION_REPORT.md** - Migration status

---

## Key Configuration Files

- **Package.json**: `/Users/jamesmcarthur/Documents/taskerino/package.json`
  - Dependencies: react 19, xstate 5, vitest 3.2, tauri 2.8
  - Scripts: dev, tauri:dev, build, test, type-check, lint

- **tsconfig.app.json**: `/Users/jamesmcarthur/Documents/taskerino/tsconfig.app.json`
  - Target: ES2020
  - Module: ESNext
  - Strict: true
  - Path alias: @ → ./src

- **vitest.config.ts**: `/Users/jamesmcarthur/Documents/taskerino/vitest.config.ts`
  - Environment: jsdom
  - Coverage thresholds: 30% (lines/functions/statements), 25% (branches)

---

## Build & Release

- **Main App**: `/Users/jamesmcarthur/Documents/taskerino/src/App.tsx`
- **Vite Config**: `/Users/jamesmcarthur/Documents/taskerino/vite.config.ts`
- **Tauri Config**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/tauri.conf.json`
- **Cargo.toml**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/Cargo.toml`

---

## Quick Navigation by Topic

### To understand storage layer:
1. Read `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/STORAGE_ARCHITECTURE.md`
2. Review `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/ChunkedSessionStorage.ts`
3. Check tests in `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/__tests__/`

### To understand context architecture:
1. Read `/Users/jamesmcarthur/Documents/taskerino/CLAUDE.md` (Context Architecture section)
2. Review contexts in `/Users/jamesmcarthur/Documents/taskerino/src/context/`
3. Check integration in `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionsZone.tsx`

### To understand state machines:
1. Review `/Users/jamesmcarthur/Documents/taskerino/src/machines/sessionMachine.ts`
2. Check services in `/Users/jamesmcarthur/Documents/taskerino/src/machines/sessionMachineServices.ts`
3. See tests in `/Users/jamesmcarthur/Documents/taskerino/src/machines/__tests__/`

### To understand recording layer:
1. Review services in `/Users/jamesmcarthur/Documents/taskerino/src/services/`
2. Check Swift implementation in `/Users/jamesmcarthur/Documents/taskerino/src-tauri/ScreenRecorder/`
3. See audio graph in `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/audio/`

### For migration status:
1. Check `/Users/jamesmcarthur/Documents/taskerino/STORAGE_IMPLEMENTATION_TRACKING.md`
2. Review `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/DEVELOPER_MIGRATION_GUIDE.md`
3. See TODO items in `/Users/jamesmcarthur/Documents/taskerino/CLAUDE.md`

---

Generated: October 26, 2025
Review Scope: Very Thorough
Total Analysis: 100+ files examined, 9,947 lines of tests analyzed
