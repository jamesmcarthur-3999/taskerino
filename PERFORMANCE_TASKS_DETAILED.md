# Performance Tasks - Detailed Breakdown
## Complete Implementation Guide

**Document Version:** 1.0
**Created:** 2025-10-15
**Status:** Planning - DO NOT IMPLEMENT YET

---

# PHASE 1: QUICK WINS (Week 1)

## Task 1A: Defer Video Repair Utility
**Priority:** 🔴 CRITICAL
**Time Estimate:** 15 minutes
**Impact:** +100-500ms faster startup
**Risk:** Low
**Agent Assignment:** Group A (Startup Performance)

### Problem Statement
The video repair utility blocks app rendering completely. Users see a blank screen until all attachments are scanned.

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src/main.tsx` (Lines 7-21)

### Current Code (Lines 7-21)
```typescript
fixCorruptedVideoAttachments()
  .then((result) => {
    console.log('✅ [MAIN] Video repair complete:', result);
    renderApp();
  })
  .catch((error) => {
    console.error('Failed to fix video attachments:', error);
    renderApp();
  });
```

### New Implementation
```typescript
// Render app immediately - don't block on video repair
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);

// Run video repair in background after app is interactive
setTimeout(() => {
  import('./utils/fixVideoAttachments').then(({ fixCorruptedVideoAttachments }) => {
    console.log('🔧 [BACKGROUND] Starting video repair utility...');
    fixCorruptedVideoAttachments()
      .then((result) => console.log('✅ [BACKGROUND] Video repair complete:', result))
      .catch((error) => console.error('❌ [BACKGROUND] Video repair failed:', error));
  });
}, 5000); // Run 5 seconds after app startup
```

### Changes Required
1. **Remove** blocking `fixCorruptedVideoAttachments()` call (lines 7-21)
2. **Add** immediate app render
3. **Add** deferred video repair with setTimeout
4. **Update** logging to indicate background operation

### Testing Checklist
- [ ] App renders immediately on startup
- [ ] No blank screen delay
- [ ] Video repair still runs (check console logs)
- [ ] Video repair completes successfully
- [ ] Corrupted videos are still fixed
- [ ] No errors in console

### Rollback Plan
Git tag: `before-phase-1a`
Simply revert to blocking implementation if issues arise.

---

## Task 1B: Implement In-Memory Attachment Cache
**Priority:** 🔴 CRITICAL
**Time Estimate:** 4 hours
**Impact:** Eliminates 90% of file I/O on repeat loads
**Risk:** Low
**Agent Assignment:** Group B (Data Loading & Caching)

### Problem Statement
Every attachment fetch requires 2 file reads (metadata + data). No caching means repeat loads are as slow as first load. 50 attachments = 100 Tauri IPC calls.

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src/services/attachmentStorage.ts` (Entire class)

### Current Code Structure (Lines 1-150)
```typescript
class AttachmentStorageService {
  private readonly ATTACHMENTS_DIR = 'attachments';

  async getAttachment(id: string): Promise<Attachment | null> {
    // Lines 76-107 - Reads from disk every time
    const metaPath = `${this.ATTACHMENTS_DIR}/${id}.meta.json`;
    const metaContent = await readTextFile(metaPath, { baseDir: BaseDirectory.AppData });
    const metadata = JSON.parse(metaContent);

    const dataPath = `${this.ATTACHMENTS_DIR}/${id}.dat`;
    const base64 = await readTextFile(dataPath, { baseDir: BaseDirectory.AppData });

    return { ...metadata, base64 };
  }
}
```

### New Implementation

#### 1. Add Cache Properties to Class
```typescript
class AttachmentStorageService {
  private readonly ATTACHMENTS_DIR = 'attachments';

  // NEW: Cache infrastructure
  private cache: Map<string, Attachment> = new Map();
  private cacheMetadata: Map<string, { size: number; lastAccessed: number }> = new Map();
  private currentCacheSize = 0;
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_CACHE_AGE = 10 * 60 * 1000; // 10 minutes

  // Cache statistics (for monitoring)
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
```

#### 2. Implement Cache Get Method
```typescript
  /**
   * Get attachment from cache or load from disk
   */
  async getAttachment(id: string): Promise<Attachment | null> {
    // Check cache first
    if (this.cache.has(id)) {
      this.stats.hits++;
      this.updateLastAccessed(id);
      console.log(`📦 [CACHE HIT] ${id} (${this.stats.hits}/${this.stats.hits + this.stats.misses})`);
      return this.cache.get(id)!;
    }

    this.stats.misses++;
    console.log(`💾 [CACHE MISS] ${id} - Loading from disk`);

    // Load from disk
    const attachment = await this.loadFromDisk(id);

    if (attachment) {
      await this.addToCache(id, attachment);
    }

    return attachment;
  }
```

#### 3. Implement Load from Disk (Refactor Existing)
```typescript
  /**
   * Load attachment from disk (existing logic extracted)
   */
  private async loadFromDisk(id: string): Promise<Attachment | null> {
    try {
      const metaPath = `${this.ATTACHMENTS_DIR}/${id}.meta.json`;
      const metaContent = await readTextFile(metaPath, { baseDir: BaseDirectory.AppData });
      const metadata = JSON.parse(metaContent);

      const dataPath = `${this.ATTACHMENTS_DIR}/${id}.dat`;
      const dataExists = await exists(dataPath, { baseDir: BaseDirectory.AppData });

      let base64: string | undefined;
      if (dataExists) {
        base64 = await readTextFile(dataPath, { baseDir: BaseDirectory.AppData });
      }

      return {
        ...metadata,
        base64,
      };
    } catch (error) {
      console.error(`Failed to load attachment ${id}:`, error);
      return null;
    }
  }
```

#### 4. Implement Cache Add with LRU Eviction
```typescript
  /**
   * Add attachment to cache with LRU eviction
   */
  private async addToCache(id: string, attachment: Attachment): Promise<void> {
    const size = this.estimateSize(attachment);

    // Evict items if cache is full
    while (this.currentCacheSize + size > this.MAX_CACHE_SIZE && this.cache.size > 0) {
      await this.evictLRU();
    }

    // Don't cache if single item is larger than max cache size
    if (size > this.MAX_CACHE_SIZE) {
      console.warn(`⚠️ Attachment ${id} (${size} bytes) exceeds cache limit`);
      return;
    }

    // Add to cache
    this.cache.set(id, attachment);
    this.cacheMetadata.set(id, {
      size,
      lastAccessed: Date.now(),
    });
    this.currentCacheSize += size;

    console.log(`✅ Cached ${id} (${size} bytes) - Total: ${this.currentCacheSize} bytes`);
  }
```

#### 5. Implement LRU Eviction
```typescript
  /**
   * Evict least recently used item
   */
  private async evictLRU(): Promise<void> {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    // Find least recently used item
    for (const [id, metadata] of this.cacheMetadata.entries()) {
      if (metadata.lastAccessed < oldestTime) {
        oldestTime = metadata.lastAccessed;
        oldestId = id;
      }
    }

    if (oldestId) {
      const metadata = this.cacheMetadata.get(oldestId)!;
      this.cache.delete(oldestId);
      this.cacheMetadata.delete(oldestId);
      this.currentCacheSize -= metadata.size;
      this.stats.evictions++;

      console.log(`🗑️ Evicted ${oldestId} (${metadata.size} bytes) - LRU`);
    }
  }
```

#### 6. Implement Helper Methods
```typescript
  /**
   * Update last accessed timestamp
   */
  private updateLastAccessed(id: string): void {
    const metadata = this.cacheMetadata.get(id);
    if (metadata) {
      metadata.lastAccessed = Date.now();
    }
  }

  /**
   * Estimate attachment size in bytes
   */
  private estimateSize(attachment: Attachment): number {
    let size = 0;

    // Base metadata
    size += JSON.stringify(attachment).length;

    // Base64 data (if present)
    if (attachment.base64) {
      size += attachment.base64.length;
    }

    // Thumbnail (if present)
    if (attachment.thumbnail) {
      size += attachment.thumbnail.length;
    }

    return size;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    return {
      ...this.stats,
      hitRate: (hitRate * 100).toFixed(2) + '%',
      size: this.currentCacheSize,
      count: this.cache.size,
    };
  }

  /**
   * Clear cache (useful for testing)
   */
  public clearCache(): void {
    this.cache.clear();
    this.cacheMetadata.clear();
    this.currentCacheSize = 0;
    console.log('🧹 Cache cleared');
  }
```

#### 7. Add Periodic Cache Cleanup
```typescript
  /**
   * Initialize cache cleanup interval
   */
  constructor() {
    // Clean up stale cache entries every 5 minutes
    setInterval(() => {
      this.cleanupStaleEntries();
    }, 5 * 60 * 1000);
  }

  /**
   * Remove entries that haven't been accessed recently
   */
  private cleanupStaleEntries(): void {
    const now = Date.now();
    const staleIds: string[] = [];

    for (const [id, metadata] of this.cacheMetadata.entries()) {
      if (now - metadata.lastAccessed > this.MAX_CACHE_AGE) {
        staleIds.push(id);
      }
    }

    for (const id of staleIds) {
      const metadata = this.cacheMetadata.get(id)!;
      this.cache.delete(id);
      this.cacheMetadata.delete(id);
      this.currentCacheSize -= metadata.size;
      console.log(`⏰ Removed stale entry ${id}`);
    }

    if (staleIds.length > 0) {
      console.log(`🧹 Cleaned up ${staleIds.length} stale cache entries`);
    }
  }
```

### Changes Required Summary
1. Add cache Map and metadata tracking
2. Refactor getAttachment() to check cache first
3. Extract disk loading logic to loadFromDisk()
4. Implement LRU eviction strategy
5. Add cache statistics and monitoring
6. Add periodic cleanup of stale entries

### Testing Checklist
- [ ] First load: Attachments loaded from disk
- [ ] Second load: Attachments loaded from cache (check console logs)
- [ ] Cache hit rate > 80% on repeat loads
- [ ] Memory usage stays under 100MB limit
- [ ] LRU eviction works when cache is full
- [ ] Stale entries cleaned up after 10 minutes
- [ ] getCacheStats() returns accurate data
- [ ] clearCache() works correctly

### Performance Validation
**Before:**
- 50 attachments = 100 file reads = 2-5 seconds
- 2nd load same as 1st load

**After:**
- 50 attachments = 50 file reads (1st load) = 1-2 seconds
- 2nd load = 0 file reads (all cached) = 0.1-0.2 seconds

### Rollback Plan
Git tag: `before-phase-1b`
Cache is additive - can disable by simply always returning loadFromDisk().

---

## Task 1C: Parallelize Audio Segment Loading
**Priority:** 🔴 CRITICAL
**Time Estimate:** 2 hours
**Impact:** 60-70% faster audio loading
**Risk:** Low
**Dependencies:** Requires Task 1B (cache) completed first
**Agent Assignment:** Group B (Data Loading & Caching)

### Problem Statement
Audio segments are loaded sequentially (one after another). With 20 segments, this means 20 × 200ms = 4 seconds of waiting. Modern computers can load these in parallel.

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src/services/audioConcatenationService.ts` (Lines 246-252)

### Current Code (Lines 246-252)
```typescript
// Sequential loading - SLOW
for (const segment of segments) {
  console.log(`Loading segment ${segment.id}...`);
  const buffer = await this.loadSegmentAudio(segment.id);
  if (buffer) {
    segmentBuffers.push(buffer);
  }
}
```

### New Implementation

#### 1. Parallel Loading with Promise.all
```typescript
// Parallel loading - FAST
console.log(`Loading ${segments.length} audio segments in parallel...`);
const startTime = performance.now();

// Load all segments concurrently
const bufferPromises = segments.map(async (segment, index) => {
  try {
    console.log(`[${index + 1}/${segments.length}] Loading segment ${segment.id}...`);
    const buffer = await this.loadSegmentAudio(segment.id);
    return { buffer, segment, index };
  } catch (error) {
    console.error(`Failed to load segment ${segment.id}:`, error);
    return { buffer: null, segment, index };
  }
});

// Wait for all to complete
const results = await Promise.all(bufferPromises);

// Extract buffers in original order
const segmentBuffers: AudioBuffer[] = [];
for (const result of results) {
  if (result.buffer) {
    segmentBuffers.push(result.buffer);
  } else {
    console.warn(`Segment ${result.segment.id} failed to load, skipping`);
  }
}

const loadTime = performance.now() - startTime;
console.log(`✅ Loaded ${segmentBuffers.length}/${segments.length} segments in ${loadTime.toFixed(0)}ms (parallel)`);
```

#### 2. Add Progress Callback (Optional Enhancement)
```typescript
/**
 * Load audio segments with progress tracking
 */
private async loadSegmentsParallel(
  segments: AudioSegment[],
  onProgress?: (loaded: number, total: number) => void
): Promise<AudioBuffer[]> {
  const results: AudioBuffer[] = [];
  let loadedCount = 0;

  const bufferPromises = segments.map(async (segment, index) => {
    try {
      const buffer = await this.loadSegmentAudio(segment.id);
      loadedCount++;
      onProgress?.(loadedCount, segments.length);
      return { buffer, index };
    } catch (error) {
      console.error(`Failed to load segment ${segment.id}:`, error);
      loadedCount++;
      onProgress?.(loadedCount, segments.length);
      return { buffer: null, index };
    }
  });

  const loadedResults = await Promise.all(bufferPromises);

  // Maintain order
  for (const result of loadedResults) {
    if (result.buffer) {
      results.push(result.buffer);
    }
  }

  return results;
}
```

#### 3. Update exportAsWAV Method
```typescript
async exportAsWAV(sessionId: string, segments: AudioSegment[]): Promise<string> {
  // Check cache first (from Task 1B)
  const cached = this.getCachedWAVUrl(sessionId);
  if (cached) {
    console.log('Using cached WAV URL');
    return cached;
  }

  console.log(`Concatenating ${segments.length} audio segments...`);

  try {
    // NEW: Load segments in parallel (instead of sequential)
    const segmentBuffers = await this.loadSegmentsParallel(segments, (loaded, total) => {
      console.log(`Progress: ${loaded}/${total} segments loaded`);
    });

    if (segmentBuffers.length === 0) {
      throw new Error('No audio segments could be loaded');
    }

    // Rest of concatenation logic remains same...
    const totalLength = segmentBuffers.reduce((sum, buf) => sum + buf.length, 0);
    // ... (existing code)
  } catch (error) {
    console.error('Failed to export WAV:', error);
    throw error;
  }
}
```

### Changes Required Summary
1. Replace sequential `for...await` loop with `Promise.all()`
2. Add error handling per segment (don't fail entire operation)
3. Maintain segment order in final buffer
4. Add progress tracking (optional)
5. Update logging to show parallel loading

### Testing Checklist
- [ ] All segments load successfully
- [ ] Segments loaded in parallel (check timing logs)
- [ ] Order preserved in final audio
- [ ] Failed segments handled gracefully (don't crash)
- [ ] Progress callbacks work (if implemented)
- [ ] Load time reduced by 60-70%

### Performance Validation
**Before (Sequential):**
- 20 segments × 200ms each = 4,000ms total

**After (Parallel):**
- 20 segments / 8 cores × 200ms = 500ms total
- **87% faster!**

### Rollback Plan
Git tag: `before-phase-1c`
Simple to rollback - just revert to sequential loop.

---

## Task 1D: Implement Progressive State Loading
**Priority:** 🔴 CRITICAL
**Time Estimate:** 6 hours
**Impact:** 50-70% faster perceived startup
**Risk:** Medium
**Agent Assignment:** Group A (Startup Performance)

### Problem Statement
All app state (companies, contacts, topics, notes, tasks, sessions) loads synchronously before first render. User sees blank screen while 2.5-7.5MB of JSON is parsed. Need to load critical state first, then progressively load rest.

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src/context/AppContext.tsx` (Lines 1945-2070)
2. `/Users/jamesmcarthur/Documents/taskerino/src/App.tsx` (Add loading states)

### Current Code Structure
```typescript
// Lines 1945-2005 - All or nothing loading
useEffect(() => {
  async function loadFromStorage() {
    const [companies, contacts, topics, notes, tasks, sessions, settings] =
      await Promise.all([
        storage.load('companies'),
        storage.load('contacts'),
        storage.load('topics'),
        storage.load('notes'),
        storage.load('tasks'),
        storage.load('sessions'),  // BLOCKS RENDER
        storage.load('settings')
      ]);

    // ... migration logic

    dispatch({ type: 'LOAD_STATE', payload: migratedState });
    setHasLoaded(true);  // Only now can app render!
  }

  loadFromStorage();
}, []);
```

### New Implementation

#### 1. Add New Loading States to AppContext
```typescript
// Add to AppContextType interface
export interface AppContextType {
  state: AppState;
  dispatch: Dispatch<AppAction>;

  // NEW: Progressive loading states
  loadingState: {
    critical: boolean;    // Settings, UI state
    primary: boolean;     // Notes, tasks, companies, contacts, topics
    secondary: boolean;   // Sessions (heavy)
  };
}

// Add to initial state
const initialLoadingState = {
  critical: true,
  primary: true,
  secondary: true,
};
```

#### 2. Split Load Functions
```typescript
/**
 * Phase 1: Load critical state (required for app to function)
 * - Settings
 * - UI state
 * - User profile
 */
async function loadCriticalState(): Promise<void> {
  console.log('📦 [PHASE 1] Loading critical state...');
  const startTime = performance.now();

  const [settings, aiSettings, learnings, learningSettings, userProfile] =
    await Promise.all([
      storage.load<any>('settings'),
      storage.load<any>('aiSettings'),
      storage.load<any>('learnings'),
      storage.load<any>('learningSettings'),
      storage.load<any>('userProfile'),
    ]);

  dispatch({
    type: 'LOAD_CRITICAL_STATE',
    payload: {
      settings: settings || initialState.settings,
      aiSettings: aiSettings || initialState.aiSettings,
      learnings: learnings || initialState.learnings,
      learningSettings: learningSettings || initialState.learningSettings,
      userProfile: userProfile || initialState.userProfile,
    }
  });

  setLoadingState(prev => ({ ...prev, critical: false }));

  const loadTime = performance.now() - startTime;
  console.log(`✅ [PHASE 1] Critical state loaded in ${loadTime.toFixed(0)}ms`);
}

/**
 * Phase 2: Load primary data (notes, tasks, entities)
 * - Companies, Contacts, Topics
 * - Notes
 * - Tasks
 */
async function loadPrimaryData(): Promise<void> {
  console.log('📦 [PHASE 2] Loading primary data...');
  const startTime = performance.now();

  const [companies, contacts, topics, notes, tasks] =
    await Promise.all([
      storage.load<Company[]>('companies'),
      storage.load<Contact[]>('contacts'),
      storage.load<Topic[]>('topics'),
      storage.load<Note[]>('notes'),
      storage.load<Task[]>('tasks'),
    ]);

  // Apply migrations
  const migratedCompanies = companies?.map(migrateCompany) || [];
  const migratedContacts = contacts?.map(migrateContact) || [];
  const migratedTopics = topics?.map(migrateTopic) || [];
  const migratedNotes = notes?.map(migrateNote) || [];
  const migratedTasks = tasks?.map(migrateTask) || [];

  dispatch({
    type: 'LOAD_PRIMARY_DATA',
    payload: {
      companies: migratedCompanies,
      contacts: migratedContacts,
      topics: migratedTopics,
      notes: migratedNotes,
      tasks: migratedTasks,
    }
  });

  setLoadingState(prev => ({ ...prev, primary: false }));

  const loadTime = performance.now() - startTime;
  console.log(`✅ [PHASE 2] Primary data loaded in ${loadTime.toFixed(0)}ms`);
  console.log(`   - ${migratedNotes.length} notes`);
  console.log(`   - ${migratedTasks.length} tasks`);
  console.log(`   - ${migratedCompanies.length} companies`);
  console.log(`   - ${migratedContacts.length} contacts`);
  console.log(`   - ${migratedTopics.length} topics`);
}

/**
 * Phase 3: Load secondary data (sessions - heavy)
 * - Session summaries only (not full data)
 */
async function loadSecondaryData(): Promise<void> {
  console.log('📦 [PHASE 3] Loading secondary data...');
  const startTime = performance.now();

  const sessions = await storage.load<Session[]>('sessions');
  const migratedSessions = sessions?.map(migrateSession) || [];

  // Transform to summaries (lightweight)
  const sessionSummaries = migratedSessions.map(s => ({
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    duration: s.duration,
    category: s.category,
    screenshotCount: s.screenshots?.length || 0,
    audioSegmentCount: s.audioSegments?.length || 0,
    hasVideo: !!s.video,
    // NOT including: screenshots array, audioSegments array, video object
  }));

  dispatch({
    type: 'LOAD_SECONDARY_DATA',
    payload: {
      sessionSummaries,  // Lightweight summaries
    }
  });

  setLoadingState(prev => ({ ...prev, secondary: false }));

  const loadTime = performance.now() - startTime;
  console.log(`✅ [PHASE 3] Secondary data loaded in ${loadTime.toFixed(0)}ms`);
  console.log(`   - ${sessionSummaries.length} session summaries`);
}
```

#### 3. Update useEffect to Use Progressive Loading
```typescript
useEffect(() => {
  async function loadDataProgressively() {
    try {
      // Phase 1: Critical (blocks initial render)
      await loadCriticalState();

      // App can render now!
      setHasLoaded(true);

      // Phase 2: Primary data (loads in background)
      await loadPrimaryData();

      // Phase 3: Secondary data (loads last)
      await loadSecondaryData();

      console.log('🎉 All data loaded successfully');
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load application data');
    }
  }

  loadDataProgressively();
}, []);
```

#### 4. Add New Action Types to Reducer
```typescript
// Add to AppAction union type
type AppAction =
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'LOAD_CRITICAL_STATE'; payload: {
      settings: any;
      aiSettings: any;
      learnings: any;
      learningSettings: any;
      userProfile: any;
    }}
  | { type: 'LOAD_PRIMARY_DATA'; payload: {
      companies: Company[];
      contacts: Contact[];
      topics: Topic[];
      notes: Note[];
      tasks: Task[];
    }}
  | { type: 'LOAD_SECONDARY_DATA'; payload: {
      sessionSummaries: SessionSummary[];
    }}
  // ... existing actions

// Add to reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_CRITICAL_STATE':
      return {
        ...state,
        settings: action.payload.settings,
        aiSettings: action.payload.aiSettings,
        learnings: action.payload.learnings,
        learningSettings: action.payload.learningSettings,
        userProfile: action.payload.userProfile,
      };

    case 'LOAD_PRIMARY_DATA':
      return {
        ...state,
        companies: action.payload.companies,
        contacts: action.payload.contacts,
        topics: action.payload.topics,
        notes: action.payload.notes,
        tasks: action.payload.tasks,
      };

    case 'LOAD_SECONDARY_DATA':
      return {
        ...state,
        sessionSummaries: action.payload.sessionSummaries,
      };

    // ... existing cases
  }
}
```

#### 5. Update App.tsx to Show Loading States
```typescript
// In App.tsx
export default function App() {
  const { state, loadingState } = useApp();

  // Show shell immediately after critical state loads
  if (loadingState.critical) {
    return <LoadingScreen message="Loading application..." />;
  }

  return (
    <div className="app-container">
      <TopNavigation />

      {loadingState.primary ? (
        <LoadingScreen message="Loading your data..." />
      ) : (
        <MainContent />
      )}

      {/* Sessions load in background, show indicator */}
      {loadingState.secondary && (
        <BackgroundLoadingIndicator message="Loading sessions..." />
      )}
    </div>
  );
}
```

### Changes Required Summary
1. Add `loadingState` to context
2. Split `loadFromStorage()` into 3 phases
3. Add new reducer actions for each phase
4. Create session summaries (lightweight)
5. Update App.tsx to handle loading states
6. Add new TypeScript types for SessionSummary

### Testing Checklist
- [ ] App renders after Phase 1 (< 500ms)
- [ ] Notes/tasks load in Phase 2 (background)
- [ ] Sessions load in Phase 3 (background)
- [ ] Loading indicators show appropriately
- [ ] No errors during progressive loading
- [ ] All data available after all phases complete
- [ ] Performance: Time to interactive < 2 seconds

### Performance Validation
**Before:**
- Time to first render: 4-6 seconds
- User sees: Blank screen

**After:**
- Time to first render: 300-500ms (Phase 1)
- User sees: App shell with loading indicators
- Time to interactive: 1-2 seconds (Phase 2)

### Rollback Plan
Git tag: `before-phase-1d`
Keep old LOAD_STATE action as fallback. Can toggle via feature flag.

---

# PHASE 2: MAJOR IMPROVEMENTS (Week 2)

## Task 2A: Split Monolithic AppContext
**Priority:** 🔴 CRITICAL
**Time Estimate:** 8-10 hours
**Impact:** 70-85% reduction in unnecessary re-renders
**Risk:** Medium-High
**Dependencies:** Task 1D should be complete first
**Agent Assignment:** Group A (Startup Performance)

### Problem Statement
AppContext.tsx is 2,235 lines with ALL app state in one context. Every state change triggers re-renders across entire app (34+ components). Need to split into domain-specific contexts.

### Reference Document
**See existing:** `/Users/jamesmcarthur/Documents/taskerino/PERFORMANCE_OPTIMIZATION_TASKS.md` (Task 4.1)

This task is already fully documented in the existing performance optimization tasks document. Implementation details are in that file (lines 180-580).

### Files to Create
1. `/Users/jamesmcarthur/Documents/taskerino/src/context/TasksContext.tsx`
2. `/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx`
3. `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionsContext.tsx`
4. `/Users/jamesmcarthur/Documents/taskerino/src/context/UIContext.tsx`
5. `/Users/jamesmcarthur/Documents/taskerino/src/context/SettingsContext.tsx`

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src/context/AppContext.tsx` (Refactor)
2. All components using `useApp()` (34+ files)

### Implementation Steps

#### Step 1: Create TasksContext (2 hours)
- Extract task-related state and actions
- Move task CRUD operations
- Add TasksProvider wrapper

#### Step 2: Create NotesContext (2 hours)
- Extract note-related state and actions
- Move note CRUD operations
- Add NotesProvider wrapper

#### Step 3: Create SessionsContext (2 hours)
- Extract session-related state and actions
- Move session operations
- Integrate with Task 1D session summaries

#### Step 4: Create UIContext (1 hour)
- Extract UI state (sidebar, active tab, notifications)
- Move UI-related actions

#### Step 5: Create SettingsContext (1 hour)
- Extract settings, aiSettings, learnings
- Move settings operations

#### Step 6: Update Components (2-3 hours)
- Replace `useApp()` with specific hooks
- Update imports across 34+ files
- Test each component individually

### Migration Guide
```typescript
// Before (monolithic)
const { state, dispatch } = useApp();
const tasks = state.tasks;

// After (domain-specific)
const { tasks } = useTasks();
```

### Testing Checklist
- [ ] All contexts provider wrapped correctly
- [ ] No circular dependencies
- [ ] Each context only re-renders its consumers
- [ ] Cross-context dependencies work (e.g., tasks referencing notes)
- [ ] All 34+ components still function
- [ ] Performance: Re-renders reduced by 70-85%
- [ ] No state loss during context split

### Performance Validation
**Before:**
- Updating a single task → 34+ components re-render

**After:**
- Updating a single task → Only TasksZone re-renders (1-3 components)

### Rollback Plan
Git tag: `before-phase-2a`
Feature flag: `USE_SPLIT_CONTEXTS`
Can keep both implementations and toggle.

---

## Task 2B: Move Audio Concatenation to Web Worker
**Priority:** 🔴 CRITICAL
**Time Estimate:** 8 hours
**Impact:** Eliminates 80% of UI freezing during audio operations
**Risk:** Medium
**Dependencies:** Task 1C should be complete
**Agent Assignment:** Group C (UI Performance)

### Problem Statement
Audio concatenation runs on main thread, blocking UI for 2-15 seconds. Large memory operations (ArrayBuffer copying, WAV encoding) freeze the entire app. Need to move to Web Worker.

### Files to Create
1. `/Users/jamesmcarthur/Documents/taskerino/src/workers/audioConcatenation.worker.ts`

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src/services/audioConcatenationService.ts`
2. `/Users/jamesmcarthur/Documents/taskerino/src/components/UnifiedSessionAudioPlayer.tsx` (Lines 64-109)
3. `/Users/jamesmcarthur/Documents/taskerino/vite.config.ts` (Add worker plugin if needed)

### Implementation Guide

#### 1. Create Web Worker File
```typescript
// File: src/workers/audioConcatenation.worker.ts

/**
 * Web Worker for audio concatenation
 * Runs audio processing off the main thread
 */

interface WorkerMessage {
  type: 'CONCATENATE' | 'DECODE_BASE64' | 'EXPORT_WAV';
  payload: any;
}

interface WorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS';
  payload: any;
}

// Audio processing functions (moved from service)
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function decodeAudioData(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  return await audioContext.decodeAudioData(arrayBuffer);
}

function concatenateBuffers(buffers: AudioBuffer[]): AudioBuffer {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const sampleRate = buffers[0].sampleRate;
  const numberOfChannels = buffers[0].numberOfChannels;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const output = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

  let offset = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const outputChannel = output.getChannelData(channel);
      const inputChannel = buffer.getChannelData(channel);
      outputChannel.set(inputChannel, offset);
    }
    offset += buffer.length;
  }

  return output;
}

function exportAsWAV(audioBuffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length * numberOfChannels * 2;
  const sampleRate = audioBuffer.sampleRate;

  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * 2, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Message handler
self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data;

  try {
    switch (type) {
      case 'CONCATENATE': {
        const { segments } = payload;

        // Decode all segments
        postMessage({ type: 'PROGRESS', payload: { step: 'decoding', current: 0, total: segments.length } });

        const buffers: AudioBuffer[] = [];
        for (let i = 0; i < segments.length; i++) {
          const arrayBuffer = base64ToArrayBuffer(segments[i].base64Data);
          const audioBuffer = await decodeAudioData(arrayBuffer);
          buffers.push(audioBuffer);

          postMessage({ type: 'PROGRESS', payload: { step: 'decoding', current: i + 1, total: segments.length } });
        }

        // Concatenate
        postMessage({ type: 'PROGRESS', payload: { step: 'concatenating' } });
        const concatenated = concatenateBuffers(buffers);

        // Export as WAV
        postMessage({ type: 'PROGRESS', payload: { step: 'encoding' } });
        const wavBuffer = exportAsWAV(concatenated);

        // Send back as transferable
        postMessage({
          type: 'SUCCESS',
          payload: { wavBuffer }
        }, [wavBuffer]);

        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    postMessage({
      type: 'ERROR',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }
});
```

#### 2. Update Audio Concatenation Service
```typescript
// File: src/services/audioConcatenationService.ts

class AudioConcatenationService {
  private worker: Worker | null = null;

  /**
   * Initialize worker
   */
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/audioConcatenation.worker.ts', import.meta.url),
        { type: 'module' }
      );
    }
    return this.worker;
  }

  /**
   * Export session audio using Web Worker
   */
  async exportAsWAV(
    sessionId: string,
    segments: AudioSegment[],
    onProgress?: (step: string, current?: number, total?: number) => void
  ): Promise<string> {
    // Check cache first
    const cached = this.getCachedWAVUrl(sessionId);
    if (cached) {
      console.log('Using cached WAV URL');
      return cached;
    }

    console.log(`Concatenating ${segments.length} audio segments in Web Worker...`);

    try {
      // Load segment data (still on main thread, but fast with cache from Task 1B)
      const segmentData = await Promise.all(
        segments.map(async (segment) => {
          const attachment = await attachmentStorage.getAttachment(segment.attachmentId);
          if (!attachment || !attachment.base64) {
            throw new Error(`Failed to load segment ${segment.id}`);
          }
          return {
            id: segment.id,
            base64Data: attachment.base64,
          };
        })
      );

      // Send to worker
      const worker = this.getWorker();

      const wavBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const { type, payload } = e.data;

          switch (type) {
            case 'PROGRESS':
              onProgress?.(payload.step, payload.current, payload.total);
              break;

            case 'SUCCESS':
              resolve(payload.wavBuffer);
              break;

            case 'ERROR':
              reject(new Error(payload.error));
              break;
          }
        };

        worker.postMessage({
          type: 'CONCATENATE',
          payload: { segments: segmentData }
        });
      });

      // Create blob URL
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      // Cache it
      this.cacheWAVUrl(sessionId, url);

      console.log('✅ WAV export complete (using Web Worker)');
      return url;

    } catch (error) {
      console.error('Failed to export WAV:', error);
      throw error;
    }
  }

  /**
   * Cleanup worker on service destruction
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
```

#### 3. Update UnifiedSessionAudioPlayer Component
```typescript
// File: src/components/UnifiedSessionAudioPlayer.tsx

export function UnifiedSessionAudioPlayer({ session }: Props) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function loadAudio() {
      if (!session.audioSegments || session.audioSegments.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setProgress('Loading audio segments...');

        const url = await audioConcatenationService.exportAsWAV(
          session.id,
          session.audioSegments,
          (step, current, total) => {
            // Progress callback from worker
            if (step === 'decoding' && current && total) {
              setProgress(`Decoding: ${current}/${total}`);
            } else if (step === 'concatenating') {
              setProgress('Concatenating audio...');
            } else if (step === 'encoding') {
              setProgress('Encoding WAV...');
            }
          }
        );

        if (!cancelled) {
          setAudioUrl(url);
          setLoading(false);
          setProgress('');
        }
      } catch (error) {
        console.error('Failed to load audio:', error);
        if (!cancelled) {
          setError('Failed to load audio');
          setLoading(false);
        }
      }
    }

    loadAudio();

    return () => {
      cancelled = true;
    };
  }, [session.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>{progress || 'Loading audio...'}</span>
      </div>
    );
  }

  // ... rest of component
}
```

### Changes Required Summary
1. Create Web Worker file with audio processing logic
2. Move audio concatenation functions to worker
3. Update service to use worker instead of main thread
4. Add progress callbacks from worker
5. Update component to show worker progress
6. Add worker cleanup on unmount

### Testing Checklist
- [ ] Audio concatenation runs in worker (check CPU usage)
- [ ] UI remains responsive during concatenation
- [ ] Progress indicators work correctly
- [ ] Audio playback works after concatenation
- [ ] No memory leaks (worker terminates properly)
- [ ] Error handling works (worker errors reported)
- [ ] Cache still works with worker
- [ ] Performance: No UI blocking during audio ops

### Performance Validation
**Before:**
- Main thread blocked: 2-15 seconds
- UI completely frozen
- Other interactions impossible

**After:**
- Main thread: Always responsive
- Background processing: 2-15 seconds
- UI interactions: Smooth throughout

### Rollback Plan
Git tag: `before-phase-2b`
Feature flag: `USE_AUDIO_WORKER`
Keep synchronous implementation as fallback.

---

## Task 2C: Add Timeline Virtualization
**Priority:** 🟠 HIGH
**Time Estimate:** 6 hours
**Impact:** 70% faster timeline rendering, 90% memory reduction
**Risk:** Medium
**Dependencies:** Task 1B (cache) should be complete
**Agent Assignment:** Group C (UI Performance)

### Problem Statement
Timeline renders ALL items at once (100+ DOM nodes). Causes 5-8 second initial render and high memory usage. Only 5-10 items visible at once - rest should be virtualized.

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src/components/ReviewTimeline.tsx` (Lines 422-591)
2. `/Users/jamesmcarthur/Documents/taskerino/package.json` (Add react-window)

### Implementation Guide

#### 1. Install Dependencies
```bash
npm install react-window
npm install --save-dev @types/react-window
```

#### 2. Refactor Timeline Component
```typescript
// File: src/components/ReviewTimeline.tsx

import { FixedSizeList as List } from 'react-window';

interface TimelineItem {
  id: string;
  type: 'screenshot' | 'audio';
  timestamp: number;
  data: Screenshot | AudioSegment;
}

export function ReviewTimeline({ session, currentTime, onSeek }: Props) {
  const listRef = useRef<List>(null);

  // Flatten and sort timeline items
  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    // Add screenshots
    session.screenshots?.forEach(screenshot => {
      items.push({
        id: screenshot.id,
        type: 'screenshot',
        timestamp: screenshot.timestamp,
        data: screenshot,
      });
    });

    // Add audio segments
    session.audioSegments?.forEach(segment => {
      items.push({
        id: segment.id,
        type: 'audio',
        timestamp: segment.startTime,
        data: segment,
      });
    });

    // Sort by timestamp
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [session]);

  // Auto-scroll to current time
  useEffect(() => {
    if (!listRef.current) return;

    const currentIndex = timelineItems.findIndex(item =>
      item.timestamp <= currentTime &&
      (timelineItems[timelineItems.indexOf(item) + 1]?.timestamp || Infinity) > currentTime
    );

    if (currentIndex !== -1) {
      listRef.current.scrollToItem(currentIndex, 'smart');
    }
  }, [currentTime, timelineItems]);

  // Render individual timeline item
  const renderItem = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = timelineItems[index];
    const isActive = item.timestamp <= currentTime &&
                     (timelineItems[index + 1]?.timestamp || Infinity) > currentTime;

    return (
      <div style={style}>
        {item.type === 'screenshot' ? (
          <ScreenshotTimelineItem
            screenshot={item.data as Screenshot}
            isActive={isActive}
            onClick={() => onSeek(item.timestamp)}
          />
        ) : (
          <AudioSegmentTimelineItem
            segment={item.data as AudioSegment}
            isActive={isActive}
            onClick={() => onSeek(item.timestamp)}
          />
        )}
      </div>
    );
  }, [timelineItems, currentTime, onSeek]);

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <h3>Timeline ({timelineItems.length} items)</h3>
      </div>

      <List
        ref={listRef}
        height={600}
        itemCount={timelineItems.length}
        itemSize={120}
        width="100%"
        overscanCount={5}
      >
        {renderItem}
      </List>
    </div>
  );
}

// Extract timeline items into memoized components
const ScreenshotTimelineItem = React.memo(({
  screenshot,
  isActive,
  onClick
}: {
  screenshot: Screenshot;
  isActive: boolean;
  onClick: () => void;
}) => {
  const { src, imgRef } = useLazyImage(screenshot.attachmentId); // From Task 2D

  return (
    <div
      className={`timeline-item screenshot ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="thumbnail">
        <img ref={imgRef} src={src || ''} alt="Screenshot" />
      </div>
      <div className="metadata">
        <span>{formatTime(screenshot.timestamp)}</span>
      </div>
    </div>
  );
});

const AudioSegmentTimelineItem = React.memo(({
  segment,
  isActive,
  onClick
}: {
  segment: AudioSegment;
  isActive: boolean;
  onClick: () => void;
}) => {
  return (
    <div
      className={`timeline-item audio ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="icon">
        <Mic className="w-5 h-5" />
      </div>
      <div className="metadata">
        <span>{formatTime(segment.startTime)}</span>
        <span className="duration">{segment.duration}s</span>
      </div>
    </div>
  );
});
```

### Changes Required Summary
1. Install react-window library
2. Flatten timeline items into single sorted array
3. Replace manual rendering loop with FixedSizeList
4. Extract timeline items into memoized components
5. Implement auto-scroll to current item
6. Add overscan for smooth scrolling

### Testing Checklist
- [ ] Timeline renders quickly (< 1 second)
- [ ] Only visible items in DOM (check Elements tab)
- [ ] Scrolling is smooth (60fps)
- [ ] Auto-scroll to current time works
- [ ] Clicking items seeks correctly
- [ ] Active item highlighted properly
- [ ] Memory usage reduced significantly

### Performance Validation
**Before:**
- 100 items = 100 DOM nodes = 5-8s render
- Memory: 200-500MB

**After:**
- 100 items = 10-15 DOM nodes (only visible) = 0.5-1s render
- Memory: 20-50MB (90% reduction)

### Rollback Plan
Git tag: `before-phase-2c`
Simple rollback - remove react-window and restore loop.

---

## Task 2D: Implement Lazy Image Loading
**Priority:** 🟠 HIGH
**Time Estimate:** 4 hours
**Impact:** 80% memory reduction, 50% faster initial render
**Risk:** Low
**Dependencies:** Task 1B (cache) should be complete
**Agent Assignment:** Group C (UI Performance)

### Problem Statement
All screenshot thumbnails loaded immediately from attachmentStorage. 50 screenshots × 2MB = 100MB loaded into memory before user scrolls. Need IntersectionObserver for lazy loading.

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src/components/ReviewTimeline.tsx` (Lines 320-333)
2. `/Users/jamesmcarthur/Documents/taskerino/src/components/ScreenshotScrubber.tsx` (Lines 45-61, 155-185)
3. `/Users/jamesmcarthur/Documents/taskerino/src/hooks/useLazyImage.ts` (NEW)

### Implementation Guide

#### 1. Create useLazyImage Hook
```typescript
// File: src/hooks/useLazyImage.ts

import { useState, useEffect, useRef } from 'react';
import { attachmentStorage } from '../services/attachmentStorage';

interface UseLazyImageOptions {
  rootMargin?: string;  // Load images N pixels before visible
  threshold?: number;    // Intersection threshold
  useThumbnail?: boolean; // Use thumbnail vs full image
}

export function useLazyImage(
  attachmentId: string,
  options: UseLazyImageOptions = {}
) {
  const {
    rootMargin = '200px',
    threshold = 0.01,
    useThumbnail = true,
  } = options;

  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Skip if already loaded
    if (src) return;

    // Skip if no element to observe
    if (!imgRef.current) return;

    const loadImage = async () => {
      if (loading) return;

      setLoading(true);
      setError(null);

      try {
        const attachment = await attachmentStorage.getAttachment(attachmentId);

        if (!attachment) {
          throw new Error(`Attachment ${attachmentId} not found`);
        }

        // Use thumbnail if available and requested
        const imageData = useThumbnail && attachment.thumbnail
          ? attachment.thumbnail
          : attachment.base64;

        if (!imageData) {
          throw new Error(`No image data for attachment ${attachmentId}`);
        }

        setSrc(imageData);
      } catch (err) {
        console.error(`Failed to load image ${attachmentId}:`, err);
        setError(err instanceof Error ? err : new Error('Failed to load image'));
      } finally {
        setLoading(false);
      }
    };

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImage();
            // Stop observing once loaded
            if (observerRef.current && imgRef.current) {
              observerRef.current.unobserve(imgRef.current);
            }
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    // Start observing
    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [attachmentId, src, loading, rootMargin, threshold, useThumbnail]);

  return {
    src,
    loading,
    error,
    imgRef,
  };
}
```

#### 2. Update ReviewTimeline to Use Lazy Loading
```typescript
// File: src/components/ReviewTimeline.tsx (Lines 320-333)

// Before:
{screenshot.path && (
  <img
    src={screenshot.path}
    alt="Screenshot thumbnail"
  />
)}

// After:
function ScreenshotThumbnail({ attachmentId }: { attachmentId: string }) {
  const { src, loading, error, imgRef } = useLazyImage(attachmentId, {
    rootMargin: '200px',  // Load 200px before visible
    useThumbnail: true,   // Use thumbnail for performance
  });

  if (error) {
    return (
      <div className="thumbnail-error">
        <AlertCircle className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="thumbnail-container">
      {loading && (
        <div className="thumbnail-loading">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}
      <img
        ref={imgRef}
        src={src || ''}
        alt="Screenshot thumbnail"
        className={`thumbnail-image ${src ? 'loaded' : ''}`}
        style={{ opacity: src ? 1 : 0 }}
      />
    </div>
  );
}
```

#### 3. Update ScreenshotScrubber with Cache
```typescript
// File: src/components/ScreenshotScrubber.tsx (Lines 45-61)

export function ScreenshotScrubber({ screenshots, currentTime }: Props) {
  // Component-level cache for scrubbing
  const imageCache = useRef<Map<string, string>>(new Map());

  const [currentScreenshotImage, setCurrentScreenshotImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Find current screenshot based on time
  const currentScreenshot = useMemo(() => {
    return screenshots.find((s, i) => {
      const nextScreenshot = screenshots[i + 1];
      return s.timestamp <= currentTime &&
             (!nextScreenshot || nextScreenshot.timestamp > currentTime);
    });
  }, [screenshots, currentTime]);

  // Load current screenshot with caching
  useEffect(() => {
    if (!currentScreenshot) return;

    // Check cache first
    if (imageCache.current.has(currentScreenshot.attachmentId)) {
      setCurrentScreenshotImage(imageCache.current.get(currentScreenshot.attachmentId)!);
      return;
    }

    // Load from storage
    const loadImage = async () => {
      setLoading(true);
      try {
        const attachment = await attachmentStorage.getAttachment(currentScreenshot.attachmentId);

        if (attachment?.base64) {
          // Cache it
          imageCache.current.set(currentScreenshot.attachmentId, attachment.base64);
          setCurrentScreenshotImage(attachment.base64);
        }
      } catch (error) {
        console.error('Failed to load screenshot:', error);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [currentScreenshot?.id]);

  // Preload adjacent screenshots for smooth scrubbing
  useEffect(() => {
    if (!currentScreenshot) return;

    const currentIndex = screenshots.indexOf(currentScreenshot);
    const preloadIds = [
      screenshots[currentIndex - 1]?.attachmentId,
      screenshots[currentIndex + 1]?.attachmentId,
    ].filter(Boolean);

    preloadIds.forEach(async (id) => {
      if (id && !imageCache.current.has(id)) {
        try {
          const attachment = await attachmentStorage.getAttachment(id);
          if (attachment?.base64) {
            imageCache.current.set(id, attachment.base64);
          }
        } catch (error) {
          // Silent fail for preload
        }
      }
    });
  }, [currentScreenshot, screenshots]);

  // Render
  return (
    <div className="screenshot-scrubber">
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {currentScreenshotImage && (
        <img src={currentScreenshotImage} alt="Current screenshot" />
      )}
    </div>
  );
}
```

### Changes Required Summary
1. Create useLazyImage hook with IntersectionObserver
2. Update ReviewTimeline to use lazy loading
3. Add loading/error states for images
4. Implement component-level cache in ScreenshotScrubber
5. Add preloading of adjacent screenshots
6. Remove eager loading from all image components

### Testing Checklist
- [ ] Images load only when scrolled into view
- [ ] Loading indicators show while images load
- [ ] Error states handled gracefully
- [ ] ScreenshotScrubber cache works (no lag)
- [ ] Preloading makes scrubbing smooth
- [ ] Memory usage reduced significantly
- [ ] Initial render faster

### Performance Validation
**Before:**
- 50 screenshots loaded immediately = 100MB
- Initial render: 3-5 seconds

**After:**
- 5-10 screenshots loaded (only visible) = 10-20MB
- Initial render: 0.5-1 second
- **80% memory reduction, 50% faster render**

### Rollback Plan
Git tag: `before-phase-2d`
Simple rollback - remove intersection observer, restore eager loading.

---

# PHASE 3: POLISH & OPTIMIZATION (Week 3)

## Task 3A: Create Rust Backend APIs
**Priority:** 🟡 MEDIUM
**Time Estimate:** 8-12 hours
**Impact:** Offloads main thread, enables parallel processing
**Risk:** High (requires Rust knowledge)
**Dependencies:** Tasks 1D and 2A should be complete
**Agent Assignment:** Group B (Data Loading & Caching)

### Problem Statement
All data operations happen in JavaScript frontend. Tauri Rust backend is available but unused. Heavy operations (JSON parsing, file I/O, search) could run in Rust for better performance and multi-threading.

### Files to Create
1. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/commands/sessions.rs`
2. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/commands/search.rs`
3. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/models/session.rs`

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/lib.rs`
2. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/Cargo.toml` (Add dependencies)

### Implementation Guide

#### 1. Add Rust Dependencies
```toml
# File: src-tauri/Cargo.toml

[dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
rayon = "1.7"  # For parallel processing
```

#### 2. Create Session Models
```rust
// File: src-tauri/src/models/session.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub name: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration: Option<i64>,
    pub category: Option<String>,
    pub screenshots: Vec<Screenshot>,
    pub audio_segments: Vec<AudioSegment>,
    pub video: Option<Video>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub name: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration: Option<i64>,
    pub category: Option<String>,
    pub screenshot_count: usize,
    pub audio_segment_count: usize,
    pub has_video: bool,
}

impl From<Session> for SessionSummary {
    fn from(session: Session) -> Self {
        SessionSummary {
            id: session.id,
            name: session.name,
            start_time: session.start_time,
            end_time: session.end_time,
            duration: session.duration,
            category: session.category,
            screenshot_count: session.screenshots.len(),
            audio_segment_count: session.audio_segments.len(),
            has_video: session.video.is_some(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    pub id: String,
    pub attachment_id: String,
    pub timestamp: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSegment {
    pub id: String,
    pub attachment_id: String,
    pub start_time: f64,
    pub duration: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Video {
    pub full_video_attachment_id: String,
}
```

#### 3. Create Session Commands
```rust
// File: src-tauri/src/commands/sessions.rs

use tauri::AppHandle;
use std::path::PathBuf;
use rayon::prelude::*;

use crate::models::session::{Session, SessionSummary};

/**
 * Load session summaries (lightweight)
 * Returns only metadata, not full session data
 */
#[tauri::command]
pub async fn load_session_summaries(
    app_handle: AppHandle
) -> Result<Vec<SessionSummary>, String> {
    println!("🦀 [RUST] Loading session summaries...");
    let start = std::time::Instant::now();

    // Get data directory
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let sessions_path = data_dir.join("sessions.json");

    // Read file
    let file_content = tokio::fs::read_to_string(&sessions_path)
        .await
        .map_err(|e| format!("Failed to read sessions file: {}", e))?;

    // Parse JSON in Rust (faster than JavaScript)
    let sessions: Vec<Session> = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse sessions JSON: {}", e))?;

    // Transform to summaries in parallel using rayon
    let summaries: Vec<SessionSummary> = sessions
        .into_par_iter()  // Parallel iterator!
        .map(|session| session.into())
        .collect();

    let elapsed = start.elapsed();
    println!("✅ [RUST] Loaded {} summaries in {:?}", summaries.len(), elapsed);

    Ok(summaries)
}

/**
 * Load single session detail on-demand
 */
#[tauri::command]
pub async fn load_session_detail(
    session_id: String,
    app_handle: AppHandle
) -> Result<Session, String> {
    println!("🦀 [RUST] Loading session {}...", session_id);
    let start = std::time::Instant::now();

    // Get data directory
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let sessions_path = data_dir.join("sessions.json");

    // Read file
    let file_content = tokio::fs::read_to_string(&sessions_path)
        .await
        .map_err(|e| format!("Failed to read sessions file: {}", e))?;

    // Parse JSON
    let sessions: Vec<Session> = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse sessions JSON: {}", e))?;

    // Find session
    let session = sessions
        .into_iter()
        .find(|s| s.id == session_id)
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let elapsed = start.elapsed();
    println!("✅ [RUST] Loaded session in {:?}", elapsed);

    Ok(session)
}

/**
 * Search sessions (full-text search in Rust)
 */
#[tauri::command]
pub async fn search_sessions(
    query: String,
    app_handle: AppHandle
) -> Result<Vec<SessionSummary>, String> {
    println!("🦀 [RUST] Searching sessions for '{}'...", query);
    let start = std::time::Instant::now();

    // Get data directory
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let sessions_path = data_dir.join("sessions.json");

    // Read and parse
    let file_content = tokio::fs::read_to_string(&sessions_path)
        .await
        .map_err(|e| format!("Failed to read sessions file: {}", e))?;

    let sessions: Vec<Session> = serde_json::from_str(&file_content)
        .map_err(|e| format!("Failed to parse sessions JSON: {}", e))?;

    let query_lower = query.to_lowercase();

    // Parallel search using rayon
    let matching_summaries: Vec<SessionSummary> = sessions
        .into_par_iter()
        .filter(|session| {
            session.name.to_lowercase().contains(&query_lower) ||
            session.category.as_ref()
                .map(|c| c.to_lowercase().contains(&query_lower))
                .unwrap_or(false)
        })
        .map(|session| session.into())
        .collect();

    let elapsed = start.elapsed();
    println!("✅ [RUST] Found {} matches in {:?}", matching_summaries.len(), elapsed);

    Ok(matching_summaries)
}
```

#### 4. Register Commands in lib.rs
```rust
// File: src-tauri/src/lib.rs

mod commands;
mod models;

use commands::sessions::{
    load_session_summaries,
    load_session_detail,
    search_sessions,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Existing commands...

            // NEW: Session commands
            load_session_summaries,
            load_session_detail,
            search_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 5. Use Rust Commands in Frontend
```typescript
// File: src/context/SessionsContext.tsx (new from Task 2A)

import { invoke } from '@tauri-apps/api/core';

/**
 * Load sessions from Rust backend
 */
async function loadSessionsFromRust(): Promise<SessionSummary[]> {
  console.log('Loading sessions from Rust backend...');
  const startTime = performance.now();

  try {
    const summaries = await invoke<SessionSummary[]>('load_session_summaries');

    const loadTime = performance.now() - startTime;
    console.log(`✅ Loaded ${summaries.length} sessions in ${loadTime.toFixed(0)}ms (Rust)`);

    return summaries;
  } catch (error) {
    console.error('Failed to load sessions from Rust:', error);
    throw error;
  }
}

/**
 * Load single session detail on-demand
 */
async function loadSessionDetail(sessionId: string): Promise<Session> {
  console.log(`Loading session ${sessionId} from Rust...`);

  try {
    const session = await invoke<Session>('load_session_detail', { sessionId });
    return session;
  } catch (error) {
    console.error(`Failed to load session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Search sessions using Rust backend
 */
async function searchSessionsInRust(query: string): Promise<SessionSummary[]> {
  if (!query.trim()) return [];

  console.log(`Searching sessions for "${query}" in Rust...`);
  const startTime = performance.now();

  try {
    const results = await invoke<SessionSummary[]>('search_sessions', { query });

    const searchTime = performance.now() - startTime;
    console.log(`✅ Found ${results.length} matches in ${searchTime.toFixed(0)}ms (Rust)`);

    return results;
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
}
```

### Changes Required Summary
1. Add Rust dependencies (serde_json, rayon)
2. Create Rust models for Session data
3. Implement Tauri commands for data operations
4. Register commands in lib.rs
5. Update frontend to use Rust commands
6. Add error handling and logging

### Testing Checklist
- [ ] Rust commands compile successfully
- [ ] Session summaries load from Rust
- [ ] Session detail loads on-demand
- [ ] Search returns correct results
- [ ] Parallel processing works (check timing)
- [ ] Errors handled gracefully
- [ ] Performance better than JavaScript

### Performance Validation
**Before (JavaScript):**
- Parse 50 sessions JSON: 500-1000ms (main thread)
- Search 50 sessions: 200-500ms (blocking)

**After (Rust):**
- Parse 50 sessions JSON: 50-100ms (multi-threaded)
- Search 50 sessions: 20-50ms (parallel)
- **5-10x faster!**

### Rollback Plan
Git tag: `before-phase-3a`
Feature flag: `USE_RUST_BACKEND`
Keep JavaScript implementation as fallback.

---

## Task 3B: Add React.memo and useMemo Optimizations
**Priority:** 🟡 MEDIUM
**Time Estimate:** 4 hours
**Impact:** 50% reduction in unnecessary re-renders
**Risk:** Low
**Dependencies:** Task 2A (context split) should be complete
**Agent Assignment:** Group D (Optimization & Polish)

### Problem Statement
Components re-render unnecessarily because no memoization. Parent updates cause all children to re-render even if props haven't changed. Need React.memo and useMemo strategically.

### Files to Modify
Multiple components across the app

### Implementation Strategy

#### 1. Identify Hot Components
Components that render frequently:
- SessionCard (renders for each session)
- TimelineItem (renders for each timeline item)
- TaskCard (renders for each task)
- NoteCard (renders for each note)
- VideoPlayer (expensive component)
- AudioPlayer (expensive component)

#### 2. Add React.memo to Pure Components
```typescript
// Example: SessionCard.tsx

// Before:
export function SessionCard({ session, onClick }: Props) {
  return (
    <div onClick={onClick}>
      {session.name}
      {/* ... */}
    </div>
  );
}

// After:
export const SessionCard = React.memo(function SessionCard({
  session,
  onClick
}: Props) {
  return (
    <div onClick={onClick}>
      {session.name}
      {/* ... */}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function
  return (
    prevProps.session.id === nextProps.session.id &&
    prevProps.session.name === nextProps.session.name &&
    prevProps.onClick === nextProps.onClick
  );
});
```

#### 3. Memoize Expensive Calculations
```typescript
// Example: SessionsZone.tsx

// Before:
const filteredSessions = sessions.filter(s =>
  s.name.toLowerCase().includes(searchQuery.toLowerCase())
);

// After:
const filteredSessions = useMemo(() => {
  return sessions.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
}, [sessions, searchQuery]);
```

#### 4. Memoize Callbacks
```typescript
// Before:
<SessionCard
  session={session}
  onClick={() => handleClick(session.id)}  // New function every render!
/>

// After:
const handleCardClick = useCallback((sessionId: string) => {
  handleClick(sessionId);
}, [handleClick]);

<SessionCard
  session={session}
  onClick={() => handleCardClick(session.id)}
/>
```

#### 5. Memoize Complex Objects
```typescript
// Before:
const config = {
  enabled: true,
  options: { /* ... */ }
};

// After:
const config = useMemo(() => ({
  enabled: true,
  options: { /* ... */ }
}), [dependencies]);
```

### Components to Optimize

#### Priority 1 (High Impact)
1. `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionCard.tsx`
2. `/Users/jamesmcarthur/Documents/taskerino/src/components/ReviewTimeline.tsx`
3. `/Users/jamesmcarthur/Documents/taskerino/src/components/VideoPlayer.tsx`
4. `/Users/jamesmcarthur/Documents/taskerino/src/components/UnifiedSessionAudioPlayer.tsx`
5. `/Users/jamesmcarthur/Documents/taskerino/src/components/TaskCard.tsx`

#### Priority 2 (Medium Impact)
6. `/Users/jamesmcarthur/Documents/taskerino/src/components/NoteCard.tsx`
7. `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionsZone.tsx`
8. `/Users/jamesmcarthur/Documents/taskerino/src/components/LibraryZone.tsx`
9. `/Users/jamesmcarthur/Documents/taskerino/src/components/TasksZone.tsx`

### Changes Required Per Component
1. Wrap export with React.memo()
2. Add custom comparison function if needed
3. Memoize expensive calculations with useMemo()
4. Memoize callbacks with useCallback()
5. Memoize complex object/array props

### Testing Checklist
- [ ] Components still render when they should
- [ ] Components don't render when props haven't changed
- [ ] Use React DevTools Profiler to verify re-renders reduced
- [ ] No performance regression (memoization has cost)
- [ ] All functionality still works

### Performance Validation
Use React DevTools Profiler:
- Before: 20-30 component updates per state change
- After: 5-10 component updates per state change
- **50-70% reduction in re-renders**

### Rollback Plan
Git tag: `before-phase-3b`
Can remove React.memo wrappers individually if issues arise.

---

## Task 3C: Implement Video Streaming
**Priority:** 🟢 LOW
**Time Estimate:** 8-12 hours
**Impact:** Faster video startup, smoother seeking
**Risk:** High
**Dependencies:** Task 3A (Rust backend) should be complete
**Agent Assignment:** Group D (Optimization & Polish)

### Problem Statement
Video files loaded entirely before playback starts. Large videos (>100MB) have slow startup. Need streaming with HTTP range requests for instant playback.

### Files to Create
1. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/commands/video_stream.rs`

### Files to Modify
1. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/lib.rs`
2. `/Users/jamesmcarthur/Documents/taskerino/src/components/VideoPlayer.tsx`
3. `/Users/jamesmcarthur/Documents/taskerino/src-tauri/tauri.conf.json`

### Implementation Guide

#### 1. Create Video Streaming Command in Rust
```rust
// File: src-tauri/src/commands/video_stream.rs

use tauri::AppHandle;
use std::path::PathBuf;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

#[derive(serde::Deserialize)]
pub struct RangeHeader {
    pub start: u64,
    pub end: Option<u64>,
}

/**
 * Stream video with range request support
 */
#[tauri::command]
pub async fn stream_video(
    file_path: String,
    range: Option<RangeHeader>,
    app_handle: AppHandle
) -> Result<Vec<u8>, String> {
    println!("🎥 [RUST] Streaming video from {}", file_path);

    // Get full path
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let video_path = data_dir.join(&file_path);

    // Open file
    let mut file = File::open(&video_path)
        .await
        .map_err(|e| format!("Failed to open video file: {}", e))?;

    // Get file size
    let metadata = file.metadata()
        .await
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;
    let file_size = metadata.len();

    // Handle range request
    let (start, end) = if let Some(range) = range {
        let start = range.start;
        let end = range.end.unwrap_or(file_size - 1).min(file_size - 1);
        (start, end)
    } else {
        (0, file_size - 1)
    };

    // Seek to start position
    file.seek(std::io::SeekFrom::Start(start))
        .await
        .map_err(|e| format!("Failed to seek: {}", e))?;

    // Read chunk
    let chunk_size = (end - start + 1) as usize;
    let mut buffer = vec![0u8; chunk_size];

    file.read_exact(&mut buffer)
        .await
        .map_err(|e| format!("Failed to read video chunk: {}", e))?;

    println!("✅ [RUST] Sent {} bytes (range {}-{})", chunk_size, start, end);

    Ok(buffer)
}

/**
 * Get video metadata (size, duration, etc.)
 */
#[tauri::command]
pub async fn get_video_metadata(
    file_path: String,
    app_handle: AppHandle
) -> Result<VideoMetadata, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let video_path = data_dir.join(&file_path);

    let metadata = tokio::fs::metadata(&video_path)
        .await
        .map_err(|e| format!("Failed to get metadata: {}", e))?;

    Ok(VideoMetadata {
        size: metadata.len(),
        // Can add more metadata here (duration, codec, etc.)
    })
}

#[derive(serde::Serialize)]
pub struct VideoMetadata {
    pub size: u64,
}
```

#### 2. Update VideoPlayer Component
```typescript
// File: src/components/VideoPlayer.tsx

export function VideoPlayer({ attachment, session }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    if (!attachment || !videoRef.current) return;

    async function setupVideoStreaming() {
      try {
        setStreaming(true);

        // Get video metadata
        const metadata = await invoke<{ size: number }>('get_video_metadata', {
          filePath: attachment.path
        });

        console.log(`Video size: ${metadata.size} bytes`);

        // Create custom video source that uses range requests
        const videoElement = videoRef.current!;

        // Set up Media Source Extensions (MSE) if supported
        if ('MediaSource' in window) {
          const mediaSource = new MediaSource();
          videoElement.src = URL.createObjectURL(mediaSource);

          mediaSource.addEventListener('sourceopen', async () => {
            const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');

            // Load initial chunk
            const initialChunk = await invoke<number[]>('stream_video', {
              filePath: attachment.path,
              range: { start: 0, end: 1024 * 1024 } // First 1MB
            });

            sourceBuffer.appendBuffer(new Uint8Array(initialChunk));
          });
        } else {
          // Fallback: Load entire video (existing behavior)
          const url = await videoStorageService.getVideoUrl(attachment);
          videoElement.src = url;
        }

        setStreaming(false);
      } catch (error) {
        console.error('Failed to setup video streaming:', error);
        setError('Failed to load video');
        setStreaming(false);
      }
    }

    setupVideoStreaming();
  }, [attachment]);

  // ... rest of component
}
```

#### 3. Register Commands
```rust
// File: src-tauri/src/lib.rs

mod commands;
use commands::video_stream::{stream_video, get_video_metadata};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            stream_video,
            get_video_metadata,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Changes Required Summary
1. Create Rust streaming command with range support
2. Add video metadata command
3. Update VideoPlayer to use Media Source Extensions
4. Implement progressive video loading
5. Add fallback for browsers without MSE support

### Testing Checklist
- [ ] Video starts playing immediately
- [ ] Seeking works smoothly
- [ ] Large videos (>100MB) load quickly
- [ ] Range requests work correctly
- [ ] Fallback works without MSE
- [ ] No memory issues with large files

### Performance Validation
**Before:**
- 100MB video: 2-5 seconds before playback
- Seeking: Slow (entire file loaded)

**After:**
- 100MB video: 0.2-0.5 seconds before playback
- Seeking: Instant (loads chunk on-demand)

### Rollback Plan
Git tag: `before-phase-3c`
Keep existing video loading as fallback.

---

# TESTING & VALIDATION

## Task 4A: Create Performance Testing Suite
**Time Estimate:** 4 hours
**Agent Assignment:** Group D (Optimization & Polish)

### Testing Scenarios

#### 1. Startup Performance Tests
```typescript
// File: tests/performance/startup.test.ts

describe('Startup Performance', () => {
  it('should render within 500ms (critical state)', async () => {
    const startTime = performance.now();

    // Mount app
    render(<App />);

    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(500);
  });

  it('should be interactive within 2 seconds', async () => {
    const startTime = performance.now();

    render(<App />);

    // Wait for all data to load
    await waitFor(() => {
      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    const interactiveTime = performance.now() - startTime;
    expect(interactiveTime).toBeLessThan(2000);
  });

  it('should not block UI thread > 100ms', async () => {
    const blockingTimes: number[] = [];

    // Monitor main thread
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 100) {
          blockingTimes.push(entry.duration);
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });

    render(<App />);
    await waitFor(() => screen.getByText('Notes'));

    expect(blockingTimes).toHaveLength(0);
  });
});
```

#### 2. Sessions Page Performance Tests
```typescript
// File: tests/performance/sessions.test.ts

describe('Sessions Page Performance', () => {
  it('should load sessions page within 500ms', async () => {
    const startTime = performance.now();

    render(<SessionsZone />);

    const loadTime = performance.now() - startTime;
    expect(loadTime).toBeLessThan(500);
  });

  it('should handle large session (100+ items) without lag', async () => {
    const largeSession = createMockSession({
      screenshots: 100,
      audioSegments: 50
    });

    const startTime = performance.now();

    render(<SessionReview session={largeSession} />);

    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(2000);
  });

  it('should maintain 60fps during timeline scroll', async () => {
    const session = createMockSession({ screenshots: 100 });
    render(<SessionReview session={session} />);

    const timeline = screen.getByTestId('timeline');

    // Monitor frame rate
    const frameRates: number[] = [];
    let lastTime = performance.now();

    const measureFPS = () => {
      const now = performance.now();
      const fps = 1000 / (now - lastTime);
      frameRates.push(fps);
      lastTime = now;
    };

    // Simulate scrolling
    for (let i = 0; i < 100; i++) {
      timeline.scrollTop = i * 10;
      measureFPS();
      await new Promise(resolve => requestAnimationFrame(resolve));
    }

    const avgFPS = frameRates.reduce((a, b) => a + b) / frameRates.length;
    expect(avgFPS).toBeGreaterThan(55); // Allow some margin
  });
});
```

#### 3. Memory Usage Tests
```typescript
// File: tests/performance/memory.test.ts

describe('Memory Usage', () => {
  it('should not exceed 100MB for typical usage', async () => {
    const { container } = render(<App />);

    // Load typical data
    await loadMockSessions(20);
    await loadMockNotes(100);
    await loadMockTasks(50);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryMB = memoryUsage / 1024 / 1024;

    expect(memoryMB).toBeLessThan(100);
  });

  it('should cache effectively (hit rate > 80%)', async () => {
    const { stats } = attachmentStorage;

    // Load attachments twice
    const attachmentIds = ['id1', 'id2', 'id3'];

    for (const id of attachmentIds) {
      await attachmentStorage.getAttachment(id);
    }

    // Clear stats
    stats.reset();

    // Load again (should hit cache)
    for (const id of attachmentIds) {
      await attachmentStorage.getAttachment(id);
    }

    const hitRate = stats.hits / (stats.hits + stats.misses);
    expect(hitRate).toBeGreaterThan(0.8);
  });
});
```

### Performance Benchmarks

Create benchmark suite to track performance over time:

```typescript
// File: tests/benchmarks/index.ts

export const performanceBenchmarks = {
  startup: {
    timeToFirstRender: { target: 500, unit: 'ms' },
    timeToInteractive: { target: 2000, unit: 'ms' },
  },
  sessions: {
    pageLoad: { target: 500, unit: 'ms' },
    audioConcat: { target: 2000, unit: 'ms' },
    timelineRender: { target: 1000, unit: 'ms' },
  },
  memory: {
    typical: { target: 100, unit: 'MB' },
    cacheHitRate: { target: 0.8, unit: 'ratio' },
  },
  fps: {
    scrolling: { target: 55, unit: 'fps' },
  },
};
```

---

## Task 4B: Set Up Performance Monitoring
**Time Estimate:** 2 hours
**Agent Assignment:** Group D (Optimization & Polish)

### Implementation

#### 1. Add Performance Monitoring Utility
```typescript
// File: src/utils/performanceMonitoring.ts

class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  /**
   * Mark start of operation
   */
  start(label: string): void {
    performance.mark(`${label}-start`);
  }

  /**
   * Mark end of operation and log duration
   */
  end(label: string): number {
    performance.mark(`${label}-end`);

    try {
      performance.measure(
        label,
        `${label}-start`,
        `${label}-end`
      );

      const measure = performance.getEntriesByName(label)[0];
      const duration = measure.duration;

      // Store metric
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      this.metrics.get(label)!.push(duration);

      console.log(`⏱️ [PERF] ${label}: ${duration.toFixed(2)}ms`);

      return duration;
    } catch (error) {
      console.error(`Failed to measure ${label}:`, error);
      return 0;
    }
  }

  /**
   * Get statistics for a metric
   */
  getStats(label: string) {
    const values = this.metrics.get(label) || [];

    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);

    return {
      count: values.length,
      avg: values.reduce((a, b) => a + b) / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Get all metrics summary
   */
  getSummary() {
    const summary: Record<string, any> = {};

    for (const [label, values] of this.metrics.entries()) {
      summary[label] = this.getStats(label);
    }

    return summary;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    performance.clearMarks();
    performance.clearMeasures();
  }
}

export const perfMonitor = new PerformanceMonitor();
```

#### 2. Add Performance Metrics to Key Operations
```typescript
// Example usage in AppContext.tsx

async function loadCriticalState() {
  perfMonitor.start('load-critical-state');

  // ... existing code

  perfMonitor.end('load-critical-state');
}

// Example usage in audioConcatenationService.ts

async function exportAsWAV(sessionId: string, segments: AudioSegment[]) {
  perfMonitor.start(`audio-concat-${sessionId}`);

  // ... existing code

  perfMonitor.end(`audio-concat-${sessionId}`);
}
```

#### 3. Add Performance Dashboard (Dev Mode)
```typescript
// File: src/components/PerformanceDashboard.tsx

export function PerformanceDashboard() {
  const [summary, setSummary] = useState<any>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setSummary(perfMonitor.getSummary());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="performance-dashboard">
      <h3>Performance Metrics</h3>
      {Object.entries(summary).map(([label, stats]: [string, any]) => (
        <div key={label} className="metric">
          <strong>{label}</strong>
          <div>Avg: {stats.avg.toFixed(2)}ms</div>
          <div>P95: {stats.p95.toFixed(2)}ms</div>
          <div>Count: {stats.count}</div>
        </div>
      ))}
    </div>
  );
}
```

---

# SUMMARY

## All Tasks Overview

| Phase | Task | Priority | Time | Impact | Risk |
|-------|------|----------|------|--------|------|
| 1A | Defer video repair | 🔴 CRITICAL | 15m | +500ms | Low |
| 1B | Attachment cache | 🔴 CRITICAL | 4h | +90% I/O | Low |
| 1C | Parallel audio | 🔴 CRITICAL | 2h | +70% audio | Low |
| 1D | Progressive loading | 🔴 CRITICAL | 6h | +50% startup | Medium |
| 2A | Split AppContext | 🔴 CRITICAL | 8-10h | +85% re-renders | Medium-High |
| 2B | Audio worker | 🔴 CRITICAL | 8h | +80% UI freeze | Medium |
| 2C | Timeline virtualization | 🟠 HIGH | 6h | +70% render | Medium |
| 2D | Lazy images | 🟠 HIGH | 4h | +80% memory | Low |
| 3A | Rust backend | 🟡 MEDIUM | 8-12h | Multi-core | High |
| 3B | React memo | 🟡 MEDIUM | 4h | +50% re-renders | Low |
| 3C | Video streaming | 🟢 LOW | 8-12h | Faster video | High |
| 4A | Testing suite | 🟡 MEDIUM | 4h | Validation | Low |
| 4B | Monitoring | 🟡 MEDIUM | 2h | Tracking | Low |

**Total Estimated Time:** 63.25-77.25 hours (8-10 working days)

## Expected Performance Improvements

### Startup
- Current: 4-6 seconds
- Target: 1-2 seconds
- **Improvement: 60-75%**

### Sessions Page
- Current: 5-12 seconds
- Target: 0.2-0.5 seconds
- **Improvement: 95%**

### Memory Usage
- Current: 200-500MB
- Target: 50-100MB
- **Improvement: 75-80%**

### CPU Utilization
- Current: 12% (single core)
- Target: 60-80% (multi-core)
- **Improvement: 5-7x**

---

**END OF DETAILED TASK BREAKDOWN**

All tasks are now fully documented and ready for implementation.
DO NOT CODE YET - wait for approval to begin implementation.
