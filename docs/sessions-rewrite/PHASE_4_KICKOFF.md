# Phase 4: Storage Rewrite - Kickoff Brief

**Phase**: 4 of 7
**Status**: Ready to Start
**Estimated Duration**: 8-9 days
**Tasks**: 12 tasks (0/12 complete)
**Dependencies**: Phase 3 Complete ✅

---

## 🎯 Use This Document to Start Phase 4

**When starting a new conversation**, copy the "Phase 4 Kickoff Prompt" section below and paste it as your first message to Claude Code. This will provide all necessary context to begin Phase 4 implementation.

---

# Phase 4 Kickoff Prompt

Copy everything below this line to start Phase 4 in a new conversation:

---

You are continuing work on the **Sessions V2 Rewrite** project for Taskerino, a desktop application at `/Users/jamesmcarthur/Documents/taskerino`.

# Project Context

## What is Taskerino?

Taskerino is an AI-powered desktop application (Tauri + React + Rust) that helps users capture and organize their work through **Sessions** - recordings of work sessions with screenshots, audio, and video that are enriched by AI to generate insights, tasks, and summaries.

## Project Status: Phases 1-3 Complete ✅

**Overall Progress**: 47.7% (42/88 tasks complete)

### Phase 1: Critical Fixes & Foundation ✅ (12/12 tasks)
**Completed**: October 23-24, 2025

**Key Deliverables**:
- Rust FFI safety wrappers with RAII pattern
- Audio service critical fixes
- Storage transaction support (atomic multi-key writes)
- Split contexts (SessionListContext, ActiveSessionContext, RecordingContext)
- XState session lifecycle machine with 21 tests
- PersistenceQueue (zero UI blocking, was 200-500ms)

**Impact**: Foundation for reliable, performant sessions system.

### Phase 2: Swift Recording Rewrite ✅ (16/16 tasks)
**Completed**: October 23-24, 2025

**Key Deliverables**:
- Extracted Swift components (VideoEncoder, RecordingSource, FrameCompositor)
- FrameSynchronizer actor (16ms tolerance, multi-stream sync)
- Three compositors: Passthrough, Grid (2x2/3x3), Side-by-Side
- RecordingSession orchestrator
- New FFI API (8 functions, safe wrappers)
- Rust integration (330 lines)
- TypeScript integration (MultiSourceRecordingConfig, RecordingStats)
- 98 comprehensive tests

**Impact**: Multi-source recording architecture complete and tested.

### Phase 3: Audio Architecture ✅ (10/10 tasks)
**Completed**: October 23-24, 2025

**Key Deliverables**:
- Graph-based audio architecture (AudioGraph with trait-based nodes)
- 3 sources (Microphone, SystemAudio, Silence)
- 5 processors (Mixer, Resampler, Volume, VAD, Normalizer)
- 3 sinks (WavEncoder, Buffer, Null)
- Backward-compatible wrapper (AudioRecorder wraps AudioGraph)
- 218 automated tests (100% passing)
- 16,812 lines of production-ready code

**Performance**: 5-333x faster than targets, 100% backward compatible

**Impact**: Production-ready audio system with comprehensive testing.

**Summary**: See `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/PHASE_3_SUMMARY.md`

---

# Your Mission: Phase 4 - Storage Rewrite

## Objectives

Rewrite the storage layer to support:
1. **Chunked session storage** - Split large sessions into small chunks for fast loading
2. **Content-addressable attachments** - Deduplicate screenshots and media
3. **Inverted indexes** - Fast search by topic, task, date, etc.
4. **Background compression** - Reduce storage footprint
5. **LRU caching** - Keep hot data in memory
6. **Data migration** - Migrate existing data seamlessly

## Current Storage Problems

### Problem 1: Slow Session Loading
- **Current**: Load entire session JSON (can be 50MB+)
- **Impact**: 5-10 second load times for large sessions
- **Target**: <1 second load time

### Problem 2: Duplicate Attachments
- **Current**: Each screenshot stored separately
- **Impact**: 100MB+ wasted storage per session (similar screenshots)
- **Target**: 50%+ storage reduction via deduplication

### Problem 3: Slow Searches
- **Current**: Linear scan through all sessions
- **Impact**: 2-3 seconds to find sessions by topic
- **Target**: <100ms search time

### Problem 4: UI Blocking on Save
- **Current**: Already fixed by Phase 1 PersistenceQueue
- **Impact**: Was 200-500ms, now 0ms ✅
- **Status**: SOLVED (maintain this)

## Phase 4 Task Breakdown

### Week 8: Core Storage (Tasks 4.1-4.6)

#### Task 4.1: Chunked Session Storage (2 days)
**Objective**: Split sessions into metadata + chunks for progressive loading.

**Design**:
```
Session Storage:
/sessions/
  {session-id}/
    metadata.json          # 5KB - Load instantly
    chunks/
      screenshots-001.json # 1MB chunks
      screenshots-002.json
      audio-001.json
      summary.json
```

**Benefits**:
- Load metadata instantly (<10ms)
- Load chunks progressively as needed
- Cache hot chunks in memory

**Implementation**:
- Create `ChunkedSessionStorage` class
- Implement `splitSession()` and `mergeSession()`
- Update SessionListContext to load metadata only
- Update ActiveSessionContext to load chunks on demand
- Migrate existing data

**Deliverables**:
- `src/services/storage/ChunkedSessionStorage.ts` (~500 lines)
- Tests (~300 lines)
- Migration script (~200 lines)
- Verification report

#### Task 4.2: Content-Addressable Attachments (2 days)
**Objective**: Store attachments by content hash to deduplicate.

**Design**:
```
Attachments Storage:
/attachments/
  {content-hash}/
    data.bin             # Actual file
    metadata.json        # References, mime type, etc.
```

**Benefits**:
- Automatic deduplication
- 50-70% storage reduction (similar screenshots)
- Easy to implement garbage collection

**Implementation**:
- Create `ContentAddressableStorage` class
- Implement SHA-256 hashing
- Add reference counting
- Update attachmentStorage to use CA storage
- Migrate existing attachments

**Deliverables**:
- `src/services/storage/ContentAddressableStorage.ts` (~600 lines)
- Tests (~400 lines)
- Migration script (~300 lines)
- Verification report

#### Task 4.3: Inverted Indexes (1.5 days)
**Objective**: Build indexes for fast search.

**Design**:
```
Indexes:
/indexes/
  by-topic.json          # topic-id → [session-ids]
  by-date.json           # date → [session-ids]
  by-tag.json            # tag → [session-ids]
  full-text.json         # word → [session-ids]
```

**Benefits**:
- <100ms search times
- Support complex queries
- Easy to rebuild if corrupted

**Implementation**:
- Create `InvertedIndexManager` class
- Implement index building
- Implement incremental updates
- Add index rebuilding
- Update search functions

**Deliverables**:
- `src/services/storage/InvertedIndexManager.ts` (~700 lines)
- Tests (~500 lines)
- Verification report

#### Task 4.4: Storage Queue Optimization (1 day)
**Objective**: Enhance Phase 1 PersistenceQueue for chunked storage.

**Current**: PersistenceQueue handles simple key-value saves
**Needed**: Handle chunk writes, index updates, garbage collection

**Implementation**:
- Add chunk write batching
- Add index update batching
- Add cleanup scheduling
- Maintain 0ms UI blocking

**Deliverables**:
- Updates to `src/services/storage/PersistenceQueue.ts` (~200 lines)
- Tests (~200 lines)
- Verification report

#### Task 4.5: Compression Workers (1.5 days)
**Objective**: Background compression of old sessions.

**Design**:
- Web Worker compresses chunks in background
- Use gzip for JSON chunks
- Use WebP for screenshots
- Process oldest sessions first

**Benefits**:
- 60-80% storage reduction
- No UI impact (background)
- User-configurable

**Implementation**:
- Create `CompressionWorker.ts`
- Implement gzip compression for JSON
- Implement WebP conversion for images
- Add worker queue management
- Add user settings

**Deliverables**:
- `src/workers/CompressionWorker.ts` (~400 lines)
- Worker queue manager (~300 lines)
- Tests (~300 lines)
- Verification report

#### Task 4.6: LRU Cache (1 day)
**Objective**: In-memory cache for hot session data.

**Design**:
- 100MB max cache size (configurable)
- LRU eviction policy
- Cache metadata, recent chunks
- Invalidate on updates

**Implementation**:
- Create `LRUCache` class
- Implement cache for ChunkedSessionStorage
- Add cache invalidation
- Add cache statistics

**Deliverables**:
- `src/services/storage/LRUCache.ts` (~400 lines)
- Tests (~300 lines)
- Verification report

### Week 9: Migration & Polish (Tasks 4.7-4.12)

#### Task 4.7: Data Migration Tools (1 day)
**Objective**: Migrate existing data to new storage format.

**Requirements**:
- Migrate all existing sessions to chunked format
- Migrate all attachments to CA storage
- Build initial indexes
- Verify data integrity
- Support rollback

**Deliverables**:
- `src/migrations/migrate-to-phase4-storage.ts` (~600 lines)
- Migration UI with progress bar
- Tests (~400 lines)
- Verification report

#### Task 4.8: Background Migration (1.5 days)
**Objective**: Migrate data in background without blocking app.

**Design**:
- Migrate 10-20 sessions at a time
- Show progress in UI
- Allow user to pause/resume
- Detect and handle errors
- Support cancellation

**Deliverables**:
- `src/services/BackgroundMigrationService.ts` (~500 lines)
- Migration progress UI component
- Tests (~300 lines)
- Verification report

#### Task 4.9: Rollback Mechanism (1 day)
**Objective**: Allow rollback to pre-Phase-4 storage if needed.

**Design**:
- Keep old storage for 30 days
- One-click rollback button
- Automatic rollback on critical errors
- Data verification before deleting old storage

**Deliverables**:
- `src/services/storage/StorageRollback.ts` (~400 lines)
- Tests (~200 lines)
- Verification report

#### Task 4.10: Storage Benchmarks (1 day)
**Objective**: Verify performance targets are met.

**Benchmarks**:
- Session load time: <1s (target)
- Search time: <100ms (target)
- Storage size: 50% reduction (target)
- UI blocking: 0ms (maintain Phase 1 fix)

**Deliverables**:
- `src/services/storage/__tests__/storage-benchmarks.test.ts` (~500 lines)
- Benchmark report with graphs
- Verification report

#### Task 4.11: Integration Testing (1 day)
**Objective**: Comprehensive E2E testing of new storage system.

**Test Scenarios**:
- Create session → verify chunks created
- Load session → verify progressive loading
- Search sessions → verify indexes used
- Delete session → verify cleanup
- Migration → verify data integrity
- Compression → verify storage reduction

**Deliverables**:
- `src/services/storage/__tests__/storage-integration.test.ts` (~600 lines)
- Manual testing checklist
- Verification report

#### Task 4.12: Documentation (1 day)
**Objective**: Complete Phase 4 documentation.

**Required Docs**:
- Architecture overview
- Migration guide for developers
- Performance tuning guide
- Troubleshooting guide
- Phase 4 summary report

**Deliverables**:
- `docs/sessions-rewrite/STORAGE_ARCHITECTURE.md` (~800 lines)
- `docs/sessions-rewrite/PHASE_4_SUMMARY.md` (~500 lines)
- Updated CLAUDE.md (storage section)
- Updated PROGRESS.md

---

## Quality Standards

### Code Quality (Same as Phase 3)
✅ **FULLY COMPLETE** - No placeholders, no TODOs, no "implement later"
✅ **PRODUCTION QUALITY** - Every line ready to ship
✅ **COMPREHENSIVELY TESTED** - All edge cases covered
✅ **THOROUGHLY DOCUMENTED** - Every public item has documentation
✅ **ZERO COMPROMISES** - Solve problems properly

❌ **UNACCEPTABLE**:
- TODO comments in code
- unimplemented!() or placeholders
- Mock data or fake responses
- Skipped error handling
- Missing documentation
- Failing tests
- Compiler warnings in new code

### Testing Requirements
- **Unit Tests**: 80%+ coverage for all new code
- **Integration Tests**: All user scenarios covered
- **Benchmarks**: Verify all performance targets met
- **Manual Tests**: Real-world usage validated

### Performance Targets
| Metric | Current | Target |
|--------|---------|--------|
| Session load time | 5-10s | <1s |
| Search time | 2-3s | <100ms |
| Storage size | Baseline | 50% reduction |
| UI blocking | 0ms | 0ms (maintain) |

---

## Important Files to Read

### Project Context
- `/Users/jamesmcarthur/Documents/taskerino/CLAUDE.md` - Codebase guide
- `/Users/jamesmcarthur/Documents/taskerino/SESSIONS_REWRITE.md` - Master plan
- `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/README.md` - Documentation overview

### Phase 1-3 Summaries
- `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/PHASE_3_SUMMARY.md` - Phase 3 details
- `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/PROGRESS.md` - Overall progress

### Current Storage Implementation
- `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/index.ts` - Storage adapters
- `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/IndexedDBAdapter.ts` - Browser storage
- `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/TauriFileSystemAdapter.ts` - Desktop storage
- `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/PersistenceQueue.ts` - Background saves (Phase 1)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/attachmentStorage.ts` - Current attachment storage

### Architecture Specs
- `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/ARCHITECTURE.md` - System architecture
- `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/STORAGE_QUEUE_DESIGN.md` - PersistenceQueue design (Phase 1)

---

## Execution Strategy

### Recommended Approach

**Week 8** (Core Storage):
1. Start with Task 4.1 (Chunked Storage) - Foundation
2. Then Task 4.2 (CA Attachments) - Builds on 4.1
3. Then Task 4.3 (Indexes) - Independent, can run in parallel
4. Then Task 4.4 (Queue Optimization) - Quick enhancement
5. Then Task 4.5 (Compression) - Background work
6. Then Task 4.6 (LRU Cache) - Performance optimization

**Week 9** (Migration & Polish):
1. Task 4.7 (Migration Tools) - Required first
2. Task 4.8 (Background Migration) - Depends on 4.7
3. Task 4.9 (Rollback) - Safety net
4. Task 4.10 (Benchmarks) - Verify targets met
5. Task 4.11 (Integration Tests) - Comprehensive validation
6. Task 4.12 (Documentation) - Final deliverable

### Parallelization Opportunities
- Tasks 4.3 (Indexes) and 4.5 (Compression) can run in parallel after 4.1-4.2
- Tasks 4.10 (Benchmarks) and 4.11 (Tests) can run in parallel

---

## Success Criteria

Phase 4 is complete when:
1. ✅ All 12 tasks complete
2. ✅ All tests passing (80%+ coverage)
3. ✅ All performance targets met (<1s load, <100ms search, 50% storage reduction)
4. ✅ Data migration successful (100% data integrity)
5. ✅ Zero UI blocking (maintain Phase 1 fix)
6. ✅ Rollback mechanism tested
7. ✅ Documentation complete
8. ✅ Manual testing passed

---

## Getting Started

### Step 1: Read Context (1-2 hours)
Read the files listed in "Important Files to Read" section above.

### Step 2: Understand Current Storage (1 hour)
Study how storage currently works:
- How sessions are saved (PersistenceQueue from Phase 1)
- How attachments are stored (attachmentStorage)
- How data is loaded (getStorage())

### Step 3: Start Task 4.1 (Chunked Storage)
This is the foundation - everything else builds on this.

### Step 4: Work Systematically
- One task at a time
- Test thoroughly
- Document as you go
- Update PROGRESS.md after each task

---

## Quality Reminders

**This is production code used by real customers.**

Every line you write must be:
- ✅ Complete (no TODOs)
- ✅ Tested (80%+ coverage)
- ✅ Documented (clear comments)
- ✅ Production-ready (no shortcuts)

**Take your time. Do it right. Ship quality.**

---

**Ready to begin Phase 4?**

Start by reading the context files, then begin with Task 4.1: Chunked Session Storage.

Update `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/PROGRESS.md` as you complete each task.

Good luck! 🚀

---

END OF KICKOFF PROMPT - Copy everything above to start Phase 4
