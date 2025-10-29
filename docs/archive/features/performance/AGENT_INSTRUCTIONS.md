# Agent Instructions for Performance Optimization
## DO NOT CODE UNTIL YOU READ THIS ENTIRE DOCUMENT

**Created:** 2025-10-15
**Purpose:** Specific instructions for 4 task agents to implement performance improvements
**Source:** PERFORMANCE_TASKS_DETAILED.md

---

## CRITICAL RULES FOR ALL AGENTS

1. **READ FIRST, CODE SECOND**: Read the entire task section in PERFORMANCE_TASKS_DETAILED.md before writing any code
2. **FOLLOW EXACT IMPLEMENTATIONS**: Use the exact code provided in the detailed tasks document
3. **TEST EVERYTHING**: Complete ALL items in the testing checklist before marking complete
4. **GIT TAGGING**: Create git tag before starting (e.g., `git tag before-phase-1a`)
5. **VALIDATE PERFORMANCE**: Measure and log performance improvements
6. **NO SHORTCUTS**: Do not skip steps or simplify implementations
7. **ERROR HANDLING**: Include all error handling from the documentation
8. **CONSOLE LOGGING**: Add performance logging as specified in tasks

---

## AGENT 1: STARTUP PERFORMANCE
**Agent ID:** startup-performance-agent
**Tasks:** 1A, 1D, 2A
**Estimated Time:** 15 hours
**Dependencies:** None

### YOUR MISSION
Improve app startup time from 4-6 seconds to 1-2 seconds by:
1. Deferring video repair utility (15 min)
2. Implementing progressive state loading (6 hours)
3. Splitting monolithic AppContext (8-10 hours)

### TASK 1A: Defer Video Repair Utility
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/main.tsx`
**Lines to modify:** 7-21
**Time:** 15 minutes
**Impact:** +100-500ms faster startup

#### Instructions:
1. Create git tag: `git tag before-phase-1a`
2. Read lines 7-21 of src/main.tsx
3. The current code BLOCKS app rendering until fixCorruptedVideoAttachments() completes
4. Replace with immediate render + deferred repair (see PERFORMANCE_TASKS_DETAILED.md lines 38-59)
5. Use setTimeout with 5 second delay
6. Use dynamic import for the fixVideoAttachments module
7. Update console.log messages to indicate background operation

#### Testing Checklist (MUST COMPLETE ALL):
- [ ] App renders immediately on startup (no blank screen)
- [ ] Video repair runs in background (check console)
- [ ] Video repair completes successfully after 5 seconds
- [ ] Corrupted videos are still fixed
- [ ] No errors in console
- [ ] Measure time-to-first-render with console.time()

#### Success Criteria:
- Time to first render < 500ms (was 600-1000ms)
- No blocking operations during startup
- Console shows "🔧 [BACKGROUND] Starting video repair utility..." after 5 seconds

---

### TASK 1D: Implement Progressive State Loading
**Files:**
- `/Users/jamesmcarthur/Documents/taskerino/src/context/AppContext.tsx` (lines 1945-2070)
- `/Users/jamesmcarthur/Documents/taskerino/src/App.tsx`

**Time:** 6 hours
**Impact:** 50-70% faster perceived startup

#### Instructions:
1. Create git tag: `git tag before-phase-1d`
2. Read PERFORMANCE_TASKS_DETAILED.md lines 547-850 for complete implementation
3. Current code loads ALL state synchronously (2.5-7.5MB JSON before render)
4. Split loading into 3 phases:
   - **Phase 1 (Critical):** Settings, UI state, user profile (~50-100KB) - BLOCKS RENDER
   - **Phase 2 (Primary):** Notes, tasks, companies, contacts, topics (~1-3MB) - BACKGROUND
   - **Phase 3 (Secondary):** Session summaries only (~500KB) - BACKGROUND

#### Step-by-Step Implementation:
1. **Add Loading States** (lines 589-610 of tasks doc)
   - Add `loadingState` to AppContextType interface
   - Initialize with all three states as `true`

2. **Create loadCriticalState()** (lines 614-648 of tasks doc)
   - Load only: settings, aiSettings, learnings, learningSettings, userProfile
   - Dispatch 'LOAD_CRITICAL_STATE' action
   - Set loadingState.critical = false
   - Add performance.now() timing logs

3. **Create loadPrimaryData()** (lines 651-696 of tasks doc)
   - Load: companies, contacts, topics, notes, tasks
   - Apply migrations (migrateCompany, migrateContact, etc.)
   - Dispatch 'LOAD_PRIMARY_DATA' action
   - Set loadingState.primary = false
   - Log counts and timing

4. **Create loadSecondaryData()** (lines 699-735 of tasks doc)
   - Load sessions
   - Transform to SUMMARIES ONLY (id, name, times, counts - NOT full data)
   - Dispatch 'LOAD_SECONDARY_DATA' action
   - Set loadingState.secondary = false

5. **Update useEffect** (lines 740-764 of tasks doc)
   - Call loadCriticalState() first
   - Set hasLoaded = true (app can render!)
   - Call loadPrimaryData() in background
   - Call loadSecondaryData() last
   - Add try/catch error handling

6. **Add New Action Types** (lines 767-799 of tasks doc)
   - LOAD_CRITICAL_STATE
   - LOAD_PRIMARY_DATA
   - LOAD_SECONDARY_DATA
   - Update reducer to handle all three

#### Testing Checklist (MUST COMPLETE ALL):
- [ ] Phase 1 completes in < 200ms
- [ ] App renders after Phase 1 (don't wait for phases 2-3)
- [ ] Phase 2 loads in background (check console timing)
- [ ] Phase 3 loads last (check console timing)
- [ ] All data eventually loads (no data loss)
- [ ] Console shows 3 distinct phase completions
- [ ] Total load time logged for each phase
- [ ] No errors during any phase
- [ ] Session summaries are lightweight (not full session data)

#### Success Criteria:
- Time to interactive < 500ms (was 4-6 seconds)
- Phase 1 < 200ms
- Phase 2 < 2 seconds
- Phase 3 < 1 second
- User sees app immediately, data populates progressively

---

### TASK 2A: Split Monolithic AppContext
**Files:**
- `/Users/jamesmcarthur/Documents/taskerino/src/context/AppContext.tsx` (2,235 lines)
- Create: `src/context/TasksContext.tsx`
- Create: `src/context/NotesContext.tsx`
- Create: `src/context/SessionsContext.tsx`
- Create: `src/context/UIContext.tsx`
- Create: `src/context/SettingsContext.tsx`

**Time:** 8-10 hours
**Impact:** 70-85% reduction in unnecessary re-renders
**Dependency:** MUST complete 1D first

#### Instructions:
1. Create git tag: `git tag before-phase-2a`
2. Read PERFORMANCE_TASKS_DETAILED.md (this task is extensive - around lines 850-1200)
3. Current problem: 34+ components re-render on ANY state change
4. Solution: Split into 5 domain contexts

#### Implementation Order:
1. **Create SettingsContext.tsx** (simplest, no dependencies)
   - Extract: settings, aiSettings, learningSettings, userProfile
   - Actions: UPDATE_SETTINGS, UPDATE_AI_SETTINGS, UPDATE_LEARNING_SETTINGS, UPDATE_PROFILE

2. **Create UIContext.tsx** (UI state only)
   - Extract: activeZone, sidebarOpen, selectedTask, selectedNote, etc.
   - Actions: All UI-related actions

3. **Create TasksContext.tsx**
   - Extract: tasks array and task operations
   - Actions: CREATE_TASK, UPDATE_TASK, DELETE_TASK, etc.

4. **Create NotesContext.tsx**
   - Extract: notes array and note operations
   - Actions: CREATE_NOTE, UPDATE_NOTE, DELETE_NOTE, etc.

5. **Create SessionsContext.tsx**
   - Extract: sessions, audioSegments, recordings
   - Actions: CREATE_SESSION, UPDATE_SESSION, etc.

6. **Update AppContext.tsx**
   - Keep only: companies, contacts, topics (entities)
   - Remove all split-out state and actions

7. **Update App.tsx Provider Structure**
   ```typescript
   <SettingsProvider>
     <UIProvider>
       <TasksProvider>
         <NotesProvider>
           <SessionsProvider>
             <AppProvider>
               <YourApp />
             </AppProvider>
           </SessionsProvider>
         </NotesProvider>
       </TasksProvider>
     </UIProvider>
   </SettingsProvider>
   ```

8. **Update ALL Components** (34+ files)
   - Replace `useApp()` with appropriate context hook
   - TasksZone uses `useTasks()`
   - NotesZone uses `useNotes()`
   - SettingsModal uses `useSettings()`
   - etc.

#### Testing Checklist (MUST COMPLETE ALL):
- [ ] All 5 new contexts created
- [ ] Each context has proper TypeScript types
- [ ] All actions moved to appropriate contexts
- [ ] AppContext only contains entities
- [ ] App.tsx has correct provider nesting
- [ ] All 34+ components updated to use new hooks
- [ ] No TypeScript errors
- [ ] App compiles successfully
- [ ] All features still work (tasks, notes, sessions, etc.)
- [ ] Re-render count reduced (use React DevTools Profiler)
- [ ] Changing task doesn't re-render notes components
- [ ] Changing note doesn't re-render tasks components

#### Success Criteria:
- 70-85% reduction in re-renders
- Component using TasksContext only re-renders on task changes
- Component using NotesContext only re-renders on note changes
- No performance regressions
- All functionality preserved

---

## AGENT 2: DATA LOADING & CACHING
**Agent ID:** data-caching-agent
**Tasks:** 1B, 1C, 3A
**Estimated Time:** 14-18 hours
**Dependencies:** 1B must be done before 1C

### YOUR MISSION
Improve data loading performance by:
1. Implementing in-memory attachment cache (4 hours)
2. Parallelizing audio segment loading (2 hours)
3. Creating Rust backend APIs for parallel processing (8-12 hours)

### TASK 1B: Implement In-Memory Attachment Cache
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/services/attachmentStorage.ts`
**Time:** 4 hours
**Impact:** Eliminates 90% of file I/O on repeat loads

#### Instructions:
1. Create git tag: `git tag before-phase-1b`
2. Read PERFORMANCE_TASKS_DETAILED.md lines 81-380 for COMPLETE implementation
3. Current problem: Every attachment requires 2 file reads (metadata + data)
4. Solution: LRU cache with 100MB limit

#### Implementation Steps (FOLLOW EXACTLY):
1. **Add Cache Properties** (lines 116-133 of tasks doc)
   - cache: Map<string, Attachment>
   - cacheMetadata: Map with size and lastAccessed
   - currentCacheSize counter
   - MAX_CACHE_SIZE = 100MB
   - MAX_CACHE_AGE = 10 minutes
   - stats object (hits, misses, evictions)

2. **Refactor getAttachment()** (lines 136-161 of tasks doc)
   - Check cache FIRST
   - If hit: update lastAccessed, increment hits, return cached
   - If miss: load from disk, add to cache, return

3. **Create loadFromDisk()** (lines 164-191 of tasks doc)
   - Extract existing disk loading logic
   - Read metadata file
   - Read data file
   - Return Attachment object

4. **Implement addToCache()** (lines 194-222 of tasks doc)
   - Estimate attachment size
   - Evict LRU items if cache full
   - Don't cache if single item > MAX_CACHE_SIZE
   - Add to both maps
   - Update currentCacheSize

5. **Implement evictLRU()** (lines 225-251 of tasks doc)
   - Find least recently used item
   - Remove from both maps
   - Update currentCacheSize
   - Increment evictions stat

6. **Add Helper Methods** (lines 254-309 of tasks doc)
   - updateLastAccessed()
   - estimateSize() - calculate bytes for base64 + metadata
   - getCacheStats() - return hit rate, size, count
   - clearCache() - for testing

7. **Add Periodic Cleanup** (lines 312-348 of tasks doc)
   - Constructor with setInterval (5 min)
   - cleanupStaleEntries() removes items > MAX_CACHE_AGE
   - Log cleanup results

#### Testing Checklist (MUST COMPLETE ALL):
- [ ] First load: All attachments from disk (check logs)
- [ ] Second load: All attachments from cache (check logs)
- [ ] Cache hit rate > 80% on repeat loads
- [ ] Memory usage stays under 100MB (check getCacheStats())
- [ ] LRU eviction works when cache full
- [ ] Stale entries cleaned after 10 minutes
- [ ] getCacheStats() returns accurate data
- [ ] clearCache() works
- [ ] Console logs show "📦 [CACHE HIT]" on cached items
- [ ] Console logs show "💾 [CACHE MISS]" on disk loads

#### Performance Validation:
**Before:**
- 50 attachments = 100 file reads = 2-5 seconds
- 2nd load same as 1st load

**After:**
- 50 attachments = 50 file reads (1st) = 1-2 seconds
- 50 attachments = 0 file reads (2nd) = 0.1-0.2 seconds
- Must achieve 80-95% reduction on 2nd load

---

### TASK 1C: Parallelize Audio Segment Loading
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/services/audioConcatenationService.ts`
**Lines:** 246-252
**Time:** 2 hours
**Impact:** 60-70% faster audio loading
**Dependency:** MUST complete Task 1B first

#### Instructions:
1. Create git tag: `git tag before-phase-1c`
2. Read PERFORMANCE_TASKS_DETAILED.md lines 383-543
3. Current problem: Sequential loading (one after another)
4. Solution: Parallel loading with Promise.all()

#### Implementation Steps:
1. **Replace Sequential Loop** (lines 411-444 of tasks doc)
   - Current: `for (const segment of segments)` loop
   - New: `segments.map(async (segment) => ...)` with Promise.all
   - Maintain segment order in results
   - Add error handling per segment (don't fail entire operation)
   - Add performance timing with performance.now()

2. **Optional: Add Progress Callback** (lines 447-483 of tasks doc)
   - Create loadSegmentsParallel() method
   - Accept onProgress callback
   - Track loadedCount
   - Call onProgress after each segment loads

3. **Update exportAsWAV()** (lines 486-516 of tasks doc)
   - Replace sequential loading with loadSegmentsParallel()
   - Add progress logging
   - Maintain existing concatenation logic

#### Testing Checklist (MUST COMPLETE ALL):
- [ ] All segments load successfully
- [ ] Segments loaded in parallel (check timing in console)
- [ ] Order preserved in final audio
- [ ] Failed segments handled gracefully (no crash)
- [ ] Progress callbacks work (if implemented)
- [ ] Load time reduced by 60-70%
- [ ] Console shows parallel loading messages
- [ ] Final audio plays correctly (no corruption)

#### Performance Validation:
**Before:** 20 segments × 200ms = 4,000ms
**After:** 20 segments / 8 cores × 200ms = 500ms (87% faster!)

---

### TASK 3A: Create Rust Backend APIs
**Files:**
- Create: `src-tauri/src/session_storage.rs`
- Create: `src-tauri/src/attachment_loader.rs`
- Modify: `src-tauri/src/lib.rs`

**Time:** 8-12 hours
**Impact:** Multi-core parallel processing
**Dependency:** Complete 1D and 2A first

#### Instructions:
1. Create git tag: `git tag before-phase-3a`
2. Read PERFORMANCE_TASKS_DETAILED.md (extensive Rust implementation section)
3. Move heavy data operations to Rust backend
4. Use rayon for parallel processing across CPU cores

#### What to Implement:
1. **session_storage.rs** - Parallel session loading
   - load_sessions_parallel() command
   - Use rayon::par_iter for parallel file reads
   - Return only session summaries (not full data)
   - Error handling with Result<>

2. **attachment_loader.rs** - Parallel attachment loading
   - load_attachments_parallel() command
   - Batch loading with thread pool
   - Stream results back to frontend

3. **Update lib.rs**
   - Register new Tauri commands
   - Add CORS for API calls

4. **Create TypeScript bindings**
   - Update src/types/tauri-commands.ts
   - Create service wrappers in src/services/

#### Testing Checklist:
- [ ] Rust code compiles without errors
- [ ] Tauri commands registered
- [ ] TypeScript types generated
- [ ] Parallel loading works (check CPU usage - should use multiple cores)
- [ ] Session summaries returned correctly
- [ ] Attachments load in parallel
- [ ] Error handling works (try loading non-existent file)
- [ ] Performance improvement measured

#### Success Criteria:
- CPU usage 60-80% across multiple cores (was 12% on single core)
- Session loading 50-70% faster
- No data loss or corruption

---

## AGENT 3: UI PERFORMANCE
**Agent ID:** ui-performance-agent
**Tasks:** 2B, 2C, 2D
**Estimated Time:** 18 hours
**Dependencies:** 2B requires 1C complete

### YOUR MISSION
Eliminate UI lag and freezing by:
1. Moving audio concatenation to Web Worker (8 hours)
2. Adding timeline virtualization (6 hours)
3. Implementing lazy image loading (4 hours)

### TASK 2B: Move Audio Concatenation to Web Worker
**Files:**
- Create: `src/workers/audioConcatenation.worker.ts`
- Modify: `src/services/audioConcatenationService.ts`
- Modify: `vite.config.ts` (add worker support)

**Time:** 8 hours
**Impact:** Eliminates 2-15 second UI freeze
**Dependency:** Complete 1C first

#### Instructions:
1. Create git tag: `git tag before-phase-2b`
2. Read PERFORMANCE_TASKS_DETAILED.md (Web Worker implementation section)
3. Current problem: Audio processing blocks UI thread completely
4. Solution: Offload to Web Worker thread

#### Implementation Steps:
1. **Create Web Worker** (audioConcatenation.worker.ts)
   - Import AudioContext APIs
   - Implement message handler
   - Handle: 'CONCATENATE_AUDIO', 'CANCEL'
   - Post progress updates back to main thread
   - Return WAV blob when complete

2. **Update vite.config.ts**
   - Add worker plugin configuration
   - Enable SharedArrayBuffer support

3. **Refactor Service to Use Worker**
   - Create worker instance
   - Post message to worker with audio data
   - Listen for progress messages
   - Handle worker completion
   - Handle worker errors

4. **Add Progress Indicator**
   - Update UI to show "Processing audio..."
   - Show progress bar (0-100%)
   - Allow cancellation

#### Testing Checklist:
- [ ] Worker file created
- [ ] vite.config updated
- [ ] Audio service uses worker
- [ ] UI doesn't freeze during processing
- [ ] Progress updates shown
- [ ] Cancel button works
- [ ] Final audio plays correctly
- [ ] No memory leaks (check DevTools)
- [ ] Multiple concurrent operations handled

#### Success Criteria:
- Main thread never blocked > 16ms during audio processing
- UI stays responsive at 60fps
- User can continue using app while audio processes

---

### TASK 2C: Add Timeline Virtualization
**Files:**
- Modify: `src/components/ReviewTimeline.tsx`
- Add: `npm install react-window`

**Time:** 6 hours
**Impact:** 60fps timeline scrolling

#### Instructions:
1. Create git tag: `git tag before-phase-2c`
2. Install react-window: `npm install react-window @types/react-window`
3. Read PERFORMANCE_TASKS_DETAILED.md (virtualization section)
4. Current problem: All 100+ timeline items rendered (causes lag)
5. Solution: Only render visible items (5-10 at a time)

#### Implementation Steps:
1. **Install Dependencies**
   ```bash
   npm install react-window @types/react-window
   ```

2. **Refactor ReviewTimeline Component**
   - Replace manual list rendering
   - Use VariableSizeList from react-window
   - Create row renderer function
   - Calculate item heights dynamically
   - Add scroll position restoration

3. **Optimize Item Height Calculation**
   - Screenshots: 120px
   - Audio segments: 80px
   - Activities: 60px
   - Cache heights to avoid recalculation

#### Testing Checklist:
- [ ] react-window installed
- [ ] Timeline uses VariableSizeList
- [ ] Only visible items rendered (check React DevTools)
- [ ] Smooth scrolling at 60fps
- [ ] All timeline items still accessible
- [ ] Heights calculated correctly
- [ ] Scroll position maintained on updates
- [ ] No visual glitches

#### Success Criteria:
- Render < 10 items at any time (was 100+)
- 60fps scrolling even with 500+ items
- Memory usage reduced 80%

---

### TASK 2D: Implement Lazy Image Loading
**Files:**
- Create: `src/hooks/useLazyImage.ts`
- Modify: `src/components/ScreenshotScrubber.tsx`
- Modify: `src/components/ScreenshotViewer.tsx`

**Time:** 4 hours
**Impact:** 75% reduction in initial memory usage

#### Instructions:
1. Create git tag: `git tag before-phase-2d`
2. Read PERFORMANCE_TASKS_DETAILED.md (lazy loading section)
3. Current problem: All screenshots loaded immediately (100MB+)
4. Solution: Load only visible screenshots with IntersectionObserver

#### Implementation Steps:
1. **Create useLazyImage Hook**
   - Use IntersectionObserver API
   - Track visibility state
   - Load image when in viewport
   - Unload when out of viewport (optional)
   - Return loading state and image src

2. **Update ScreenshotScrubber**
   - Replace direct image src with useLazyImage hook
   - Show placeholder while loading
   - Fade in when loaded

3. **Update ScreenshotViewer**
   - Implement virtual scrolling
   - Preload adjacent screenshots (1 before, 1 after)
   - Unload screenshots outside window

4. **Add Placeholder Component**
   - Show skeleton loader
   - Match screenshot dimensions
   - Smooth transition to actual image

#### Testing Checklist:
- [ ] useLazyImage hook created
- [ ] IntersectionObserver working
- [ ] Screenshots load when scrolled into view
- [ ] Placeholders shown while loading
- [ ] Adjacent screenshots preloaded
- [ ] Memory usage reduced
- [ ] No flickering during scroll
- [ ] All screenshots eventually load

#### Success Criteria:
- Initial memory < 20MB (was 100MB+)
- Only 5-10 images loaded at once
- Smooth scrolling maintained
- 75% memory reduction

---

## AGENT 4: OPTIMIZATION & POLISH
**Agent ID:** optimization-agent
**Tasks:** 3B, 3C
**Estimated Time:** 12-20 hours
**Dependencies:** 3B requires 2A complete, 3C requires 3A complete

### YOUR MISSION
Final optimizations and polish:
1. Add React.memo and useMemo optimizations (4 hours)
2. Implement video streaming (8-12 hours)
3. Validate all performance improvements

### TASK 3B: Add React Memoization
**Files:** 34+ component files
**Time:** 4 hours
**Impact:** Prevent unnecessary re-renders
**Dependency:** Complete 2A first

#### Instructions:
1. Create git tag: `git tag before-phase-3b`
2. Use React DevTools Profiler to identify re-render hotspots
3. Add React.memo to pure components
4. Add useMemo for expensive calculations
5. Add useCallback for event handlers passed as props

#### Components to Optimize:
- TaskCard, NoteCard, SessionCard (list items)
- TimelineItem, ScreenshotItem (repeated elements)
- RichTextEditor (expensive component)
- VideoPlayer, AudioPlayer (media components)

#### Testing Checklist:
- [ ] React.memo added to appropriate components
- [ ] useMemo added for expensive calculations
- [ ] useCallback added for event handlers
- [ ] Profiler shows reduced re-renders
- [ ] No functionality broken
- [ ] Props properly memoized

#### Success Criteria:
- 30-50% reduction in overall re-renders
- Components only re-render when their props change

---

### TASK 3C: Implement Video Streaming
**Files:**
- Create: `src-tauri/src/video_streaming.rs`
- Modify: `src/components/VideoPlayer.tsx`
- Modify: `src-tauri/tauri.conf.json`

**Time:** 8-12 hours
**Impact:** Instant video playback
**Dependency:** Complete 3A first

#### Instructions:
1. Create git tag: `git tag before-phase-3c`
2. Current problem: Entire video loaded into memory before playback
3. Solution: HTTP range requests + streaming via Tauri asset protocol

#### Implementation Steps:
1. **Create Rust Streaming Handler**
   - Implement HTTP range request handler
   - Stream video chunks (1MB at a time)
   - Support seek operations

2. **Update tauri.conf.json**
   - Enable asset protocol
   - Configure MIME types for video

3. **Update VideoPlayer Component**
   - Use asset:// protocol URLs
   - Enable Media Source Extensions
   - Add buffering indicator

#### Testing Checklist:
- [ ] Video starts playing immediately
- [ ] Seek operations work
- [ ] Memory usage low during playback
- [ ] Buffering indicator shows when needed
- [ ] Multiple videos can be queued

#### Success Criteria:
- Time to first frame < 100ms (was 2-5 seconds)
- Memory usage < 50MB during playback (was 200MB+)

---

## FINAL VALIDATION (ALL AGENTS)

After completing your assigned tasks, run these validations:

### Performance Benchmarks:
1. **Startup Performance:**
   - [ ] Time to first render < 500ms
   - [ ] Time to interactive < 2 seconds
   - [ ] Initial data load < 1 second

2. **Sessions Page Performance:**
   - [ ] Audio concatenation < 2 seconds (20 segments)
   - [ ] Timeline scroll at 60fps
   - [ ] Screenshot scrubbing with no lag
   - [ ] Memory usage < 100MB
   - [ ] 2nd load < 500ms (cached)

3. **System Utilization:**
   - [ ] Multi-core CPU usage 60-80%
   - [ ] Main thread never blocked > 100ms
   - [ ] All file I/O non-blocking

### Code Quality:
- [ ] No TypeScript errors
- [ ] All tests passing
- [ ] No console errors
- [ ] Performance logs added
- [ ] Git tags created for rollback

---

## REPORTING BACK

When you complete your tasks, report:
1. Tasks completed (with git tags)
2. Performance improvements measured (before/after)
3. Any issues encountered
4. Testing results (all checkboxes)
5. Recommendation: proceed to next phase or rollback

**REMEMBER**: Do NOT code until you've read this entire document and the relevant sections of PERFORMANCE_TASKS_DETAILED.md!
