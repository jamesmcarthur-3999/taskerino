# Performance Optimization Task List
## Detailed Implementation Guide for Task Agents

**Total Tasks:** 39
**Estimated Total Time:** 40-60 hours
**Priority Levels:** CRITICAL (6), HIGH (10), MEDIUM (14), LOW (9)

---

## CRITICAL PRIORITY TASKS (Week 1)

### TASK 1.1: Memoize LibraryZone Relationship Calculations
**Priority:** CRITICAL
**Estimated Time:** 2 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/components/LibraryZone.tsx`
**Lines:** 294-311

**Problem:**
Multiple filter operations executed inside `.map()` render loop causing 12,000+ array iterations per render with 50 notes.

**Implementation Steps:**
1. Locate the `displayedNotes.map((note) => { ... })` render loop around line 294
2. Add a new `useMemo` hook BEFORE the render loop (around line 290)
3. Name the new memo `notesWithRelations`
4. Move all relationship calculation logic INTO the useMemo
5. Update dependencies: `[displayedNotes, state.companies, state.contacts, state.topics, state.tasks]`
6. Update the render loop to use pre-computed values

**Code to Add:**
```typescript
// Add this BEFORE the render loop (around line 290)
const notesWithRelations = useMemo(() => {
  return displayedNotes.map(note => {
    const relatedCompanies = state.companies.filter(c => note.companyIds?.includes(c.id));
    const relatedContacts = state.contacts.filter(c => note.contactIds?.includes(c.id));
    const relatedTopics = state.topics.filter(t => note.topicIds?.includes(t.id));

    // Legacy support for single topicId
    if (note.topicId) {
      const legacyCompany = state.companies.find(c => c.id === note.topicId);
      const legacyContact = state.contacts.find(c => c.id === note.topicId);
      const legacyTopic = state.topics.find(t => t.id === note.topicId);
      if (legacyCompany && !relatedCompanies.some(c => c.id === legacyCompany.id)) {
        relatedCompanies.push(legacyCompany);
      }
      if (legacyContact && !relatedContacts.some(c => c.id === legacyContact.id)) {
        relatedContacts.push(legacyContact);
      }
      if (legacyTopic && !relatedTopics.some(t => t.id === legacyTopic.id)) {
        relatedTopics.push(legacyTopic);
      }
    }

    const noteTasks = state.tasks.filter(t => t.noteId === note.id);

    return {
      note,
      relatedCompanies,
      relatedContacts,
      relatedTopics,
      noteTasks,
      sentiment: note.metadata?.sentiment,
    };
  });
}, [displayedNotes, state.companies, state.contacts, state.topics, state.tasks]);
```

**Code to Update:**
```typescript
// Change the render loop from:
{displayedNotes.map((note) => {
  const relatedCompanies = state.companies.filter(...);
  // ... etc

// To:
{notesWithRelations.map(({ note, relatedCompanies, relatedContacts, relatedTopics, noteTasks, sentiment }) => {
  const isSelected = note.id === selectedNoteIdForInline;
  return (
    <div key={note.id} /* ... */>
      {/* Use pre-computed values directly */}
    </div>
  );
})}
```

**Acceptance Criteria:**
- [ ] useMemo added with correct dependencies
- [ ] All relationship calculations moved into useMemo
- [ ] Render loop updated to use pre-computed values
- [ ] No TypeScript errors
- [ ] App runs without errors
- [ ] Library zone renders notes correctly
- [ ] Performance improvement visible (use React DevTools Profiler)

**Testing:**
1. Open Library zone with 20+ notes
2. Open React DevTools Profiler
3. Record performance while filtering notes
4. Verify render time reduced by 50%+

---

### TASK 1.10: Build Search Index for SessionsZone
**Priority:** CRITICAL
**Estimated Time:** 3 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionsZone.tsx`
**Lines:** 191-270

**Problem:**
Nested array operations in search filter with O(n*m*p) complexity. With 50 sessions × 20 screenshots = 1000 items scanned per keystroke.

**Implementation Steps:**
1. Locate `filteredSessions` useMemo around line 191
2. Add new `searchIndex` useMemo BEFORE filteredSessions
3. Build searchable text once from all session data
4. Update search filter to use index lookup instead of nested iterations
5. Chain filters: basic filters → search filter → sort

**Code to Add:**
```typescript
// Add BEFORE filteredSessions useMemo (around line 185)
const searchIndex = useMemo(() => {
  console.log('🔍 [SESSIONS] Building search index for', allPastSessions.length, 'sessions');

  return allPastSessions.map(session => ({
    id: session.id,
    searchableText: [
      session.name || '',
      session.description || '',
      session.summary?.narrative || '',
      session.summary?.keyInsights?.join(' ') || '',
      // Flatten screenshot data
      ...(session.screenshots?.flatMap(s => [
        s.aiAnalysis?.summary || '',
        s.aiAnalysis?.detectedActivity || '',
        ...(s.aiAnalysis?.keyElements || [])
      ]) || []),
      // Flatten audio data
      ...(session.audioSegments?.map(a => a.transcription || '') || [])
    ].join(' ').toLowerCase()
  }));
}, [allPastSessions]);

// Update filteredSessions to use index
const filteredSessions = useMemo(() => {
  let filtered = allPastSessions;

  // Apply category filters first (fast)
  if (selectedCategories.length > 0) {
    filtered = filtered.filter(s => s.category && selectedCategories.includes(s.category));
  }

  if (selectedSubCategories.length > 0) {
    filtered = filtered.filter(s => s.subCategory && selectedSubCategories.includes(s.subCategory));
  }

  if (selectedTags.length > 0) {
    filtered = filtered.filter(s =>
      s.tags && s.tags.some(tag => selectedTags.includes(tag))
    );
  }

  // Apply search filter using index (fast!)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    const matchingIds = new Set(
      searchIndex
        .filter(item => item.searchableText.includes(query))
        .map(item => item.id)
    );

    filtered = filtered.filter(s => matchingIds.has(s.id));
  }

  // Filter by status
  if (selectedFilter === 'in-progress') {
    filtered = filtered.filter(s => s.status === 'in-progress');
  } else if (selectedFilter === 'completed') {
    filtered = filtered.filter(s => s.status === 'completed');
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    } else if (sortBy === 'oldest') {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'duration') {
      const durationA = a.endTime ? new Date(a.endTime).getTime() - new Date(a.startTime).getTime() : 0;
      const durationB = b.endTime ? new Date(b.endTime).getTime() - new Date(b.startTime).getTime() : 0;
      return durationB - durationA;
    }
    return 0;
  });

  return sorted;
}, [allPastSessions, searchIndex, selectedCategories, selectedSubCategories, selectedTags, selectedFilter, searchQuery, sortBy]);
```

**Acceptance Criteria:**
- [ ] searchIndex useMemo added
- [ ] All session data flattened into searchableText
- [ ] Search filter updated to use index lookup
- [ ] No TypeScript errors
- [ ] Search works correctly
- [ ] Search is 85%+ faster (use console.time)

**Testing:**
1. Open Sessions zone with 30+ sessions
2. Add console.time before and after search
3. Type in search box
4. Verify search completes in <50ms (vs 500ms+ before)

---

### TASK 2.1: Implement Dirty Tracking for Storage
**Priority:** CRITICAL
**Estimated Time:** 4 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/AppContext.tsx`
**Lines:** 1972-2042

**Problem:**
Entire state saved every 5 seconds regardless of what changed. With large datasets, writes 500KB-1MB every 5 seconds.

**Implementation Steps:**
1. Add `dirtyCollections` state near top of AppProvider (after other useState hooks)
2. Update reducer to mark collections as dirty on mutations
3. Replace existing useEffect save logic with dirty-tracking version
4. Create helper function to save specific collections
5. Update debounce to 10 seconds (from 5)

**Code to Add:**
```typescript
// Add after other useState hooks (around line 100)
const [dirtyCollections, setDirtyCollections] = useState<Set<string>>(new Set());

// Add helper function (around line 200)
const markDirty = useCallback((collections: string[]) => {
  setDirtyCollections(prev => {
    const next = new Set(prev);
    collections.forEach(c => next.add(c));
    return next;
  });
}, []);

// Add save helper (around line 210)
const saveCollections = useCallback(async (collections: string[]) => {
  console.log('💾 [STORAGE] Saving dirty collections:', collections);

  for (const collection of collections) {
    try {
      switch (collection) {
        case 'companies':
          await storageService.save('companies', state.companies);
          break;
        case 'contacts':
          await storageService.save('contacts', state.contacts);
          break;
        case 'topics':
          await storageService.save('topics', state.topics);
          break;
        case 'notes':
          await storageService.save('notes', state.notes);
          break;
        case 'tasks':
          await storageService.save('tasks', state.tasks);
          break;
        case 'sessions':
          await storageService.save('sessions', state.sessions);
          break;
        case 'settings':
          await storageService.save('settings', {
            aiSettings: state.aiSettings,
            learningSettings: state.learningSettings,
            userProfile: state.userProfile,
            nedSettings: state.nedSettings,
            searchHistory: state.searchHistory,
          });
          break;
        case 'ui':
          await storageService.save('ui', state.ui);
          break;
      }
    } catch (error) {
      console.error(`❌ [STORAGE] Failed to save ${collection}:`, error);
    }
  }
}, [state]);
```

**Update Reducer Cases:**
```typescript
// In appReducer, add markDirty calls. Example:

case 'ADD_NOTE': {
  // Existing logic...

  // Mark as dirty (call from dispatch wrapper)
  markDirty(['notes', 'companies', 'contacts', 'topics']);

  return {
    ...state,
    notes: [...state.notes, note],
    // ... rest
  };
}

case 'UPDATE_NOTE': {
  markDirty(['notes']);
  // ... existing logic
}

case 'DELETE_NOTE': {
  markDirty(['notes', 'companies', 'contacts', 'topics']);
  // ... existing logic
}

// Repeat for all mutation actions
```

**Replace Existing useEffect:**
```typescript
// REPLACE the existing useEffect (lines 1972-1997) with:
useEffect(() => {
  if (!hasLoaded || dirtyCollections.size === 0) return;

  const timeoutId = setTimeout(async () => {
    const collectionsToSave = Array.from(dirtyCollections);
    await saveCollections(collectionsToSave);
    setDirtyCollections(new Set()); // Clear dirty flags
  }, 10000); // Increased from 5000 to 10000

  return () => clearTimeout(timeoutId);
}, [dirtyCollections, hasLoaded, saveCollections]);
```

**Acceptance Criteria:**
- [ ] dirtyCollections state added
- [ ] All reducer cases updated with markDirty calls
- [ ] saveCollections helper implemented
- [ ] useEffect replaced with dirty-tracking version
- [ ] Debounce increased to 10 seconds
- [ ] Storage operations reduced by 70%+ (check logs)
- [ ] No data loss (test by making changes and restarting app)

**Testing:**
1. Add console logs to track save operations
2. Make a single note change
3. Verify only 'notes' collection is saved (not all 7)
4. Make multiple changes across collections
5. Verify only dirty collections saved
6. Restart app and verify all data persisted

---

### TASK 3.1: Cache Session Summary Generation
**Priority:** CRITICAL
**Estimated Time:** 3 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/services/sessionsAgentService.ts`
**Lines:** 242-602

**Problem:**
Session summaries regenerated on every enrichment call, wasting $0.003-$0.015 per session in API costs.

**Implementation Steps:**
1. Add cache Map property to SessionsAgentService class
2. Create data hashing function
3. Update `generateSessionSummary()` to check cache first
4. Cache results with data hash for invalidation
5. Add cache clearing method
6. Update AppContext to clear cache when session deleted

**Code to Add:**
```typescript
// Add to SessionsAgentService class (around line 30)
private summaryCache = new Map<string, {
  summary: any;
  dataHash: string;
  timestamp: number;
}>();

// Add helper method (around line 50)
private generateDataHash(session: Session): string {
  // Hash based on content that affects summary
  return JSON.stringify({
    screenshotsHash: session.screenshots?.map(s => ({
      id: s.id,
      summaryHash: s.aiAnalysis?.summary?.substring(0, 100) // First 100 chars
    })),
    audioHash: session.audioSegments?.map(a => ({
      id: a.id,
      transcriptHash: a.transcription?.substring(0, 100)
    })),
    videoHash: session.video?.chapters?.map(c => ({
      id: c.id,
      title: c.title
    })),
    insightsHash: session.audioInsights?.narrative?.substring(0, 100)
  });
}

// Add cache management methods (around line 80)
clearSummaryCache(sessionId?: string): void {
  if (sessionId) {
    this.summaryCache.delete(sessionId);
    console.log(`🗑️ [SESSION SUMMARY] Cleared cache for session ${sessionId}`);
  } else {
    this.summaryCache.clear();
    console.log('🗑️ [SESSION SUMMARY] Cleared all cached summaries');
  }
}

getSummaryCacheStats() {
  return {
    cachedSessions: this.summaryCache.size,
    oldestCache: Math.min(...Array.from(this.summaryCache.values()).map(c => c.timestamp)),
    newestCache: Math.max(...Array.from(this.summaryCache.values()).map(c => c.timestamp))
  };
}
```

**Update generateSessionSummary:**
```typescript
// REPLACE the beginning of generateSessionSummary (around line 242) with:
async generateSessionSummary(
  session: Session,
  screenshots: SessionScreenshot[],
  audioSegments?: SessionAudioSegment[]
): Promise<{
  narrative: string;
  keyInsights: string[];
  recommendations: string[];
  suggestedTags?: string[];
  suggestedCategory?: string;
  suggestedSubCategory?: string;
}> {
  // Check cache first
  const dataHash = this.generateDataHash(session);
  const cached = this.summaryCache.get(session.id);

  if (cached && cached.dataHash === dataHash) {
    console.log(`✅ [SESSION SUMMARY] Using cached summary for session ${session.id}`);
    return cached.summary;
  }

  console.log(`🔄 [SESSION SUMMARY] Generating new summary for session ${session.id}...`);

  // ... existing API call logic ...

  // After getting result (before return):
  this.summaryCache.set(session.id, {
    summary: result,
    dataHash,
    timestamp: Date.now()
  });

  console.log(`💾 [SESSION SUMMARY] Cached summary for session ${session.id}`);

  return result;
}
```

**Update AppContext:**
```typescript
// In AppContext.tsx, in the DELETE_SESSION case (around line 1200):
case 'DELETE_SESSION': {
  const sessionId = action.payload;

  // Clear AI service caches
  sessionsAgentService.clearSummaryCache(sessionId);
  // Also clear other caches (will add in other tasks)

  return {
    ...state,
    sessions: state.sessions.filter(s => s.id !== sessionId),
  };
}
```

**Acceptance Criteria:**
- [ ] summaryCache Map added to class
- [ ] generateDataHash method implemented
- [ ] Cache check added at start of generateSessionSummary
- [ ] Cache set after API call
- [ ] clearSummaryCache method added
- [ ] AppContext clears cache on session delete
- [ ] Console logs show cache hits
- [ ] Second call to generateSessionSummary returns instantly
- [ ] API costs reduced (check Claude API dashboard)

**Testing:**
1. Generate summary for a session
2. Check console for "🔄 Generating new summary"
3. Trigger summary generation again (without changing data)
4. Check console for "✅ Using cached summary"
5. Verify instant return (no API call)
6. Delete session, verify cache cleared

---

### TASK 4.1: Split Monolithic Context into Domain Contexts
**Priority:** CRITICAL
**Estimated Time:** 8-10 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/AppContext.tsx` and new files

**Problem:**
Single AppContext contains all state, causing 200-500+ unnecessary re-renders per interaction.

**This is a LARGE task - break into sub-tasks:**

#### Sub-task 4.1.A: Create TasksContext (2 hours)

**New File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/TasksContext.tsx`

**Implementation:**
```typescript
import { createContext, useContext, useReducer, useMemo, ReactNode } from 'react';
import type { Task } from '../types';

interface TasksState {
  tasks: Task[];
}

type TaskAction =
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: Task }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'TOGGLE_TASK'; payload: string }
  | { type: 'SET_TASKS'; payload: Task[] };

interface TasksContextType {
  tasks: Task[];
  dispatch: React.Dispatch<TaskAction>;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

function tasksReducer(state: TasksState, action: TaskAction): TasksState {
  switch (action.type) {
    case 'ADD_TASK':
      return { tasks: [...state.tasks, action.payload] };

    case 'UPDATE_TASK':
      return {
        tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t)
      };

    case 'DELETE_TASK':
      return { tasks: state.tasks.filter(t => t.id !== action.payload) };

    case 'TOGGLE_TASK':
      return {
        tasks: state.tasks.map(t =>
          t.id === action.payload ? { ...t, done: !t.done } : t
        )
      };

    case 'SET_TASKS':
      return { tasks: action.payload };

    default:
      return state;
  }
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tasksReducer, { tasks: [] });

  const value = useMemo(
    () => ({ tasks: state.tasks, dispatch }),
    [state.tasks]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasks must be used within TasksProvider');
  }
  return context;
}
```

**Acceptance Criteria:**
- [ ] TasksContext.tsx created
- [ ] TasksProvider component implemented
- [ ] useTasks hook exported
- [ ] All task actions moved from AppContext
- [ ] Value properly memoized
- [ ] No TypeScript errors

#### Sub-task 4.1.B: Create NotesContext (3 hours)

**New File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx`

**Implementation:** Similar structure but includes companies, contacts, topics (notes domain)

```typescript
interface NotesState {
  notes: Note[];
  companies: Company[];
  contacts: Contact[];
  topics: Topic[];
}

// ... implement similar to TasksContext but with note-related actions
```

#### Sub-task 4.1.C: Create SessionsContext (2 hours)

**New File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionsContext.tsx`

#### Sub-task 4.1.D: Update App.tsx to use all contexts (2 hours)

```typescript
// In App.tsx
<TasksProvider>
  <NotesProvider>
    <SessionsProvider>
      <UIProvider>
        <SettingsProvider>
          {/* App content */}
        </SettingsProvider>
      </UIProvider>
    </SessionsProvider>
  </NotesProvider>
</TasksProvider>
```

#### Sub-task 4.1.E: Update all components to use new hooks (3-4 hours)

**Pattern to follow:**
```typescript
// Old:
const { state, dispatch } = useApp();
const tasks = state.tasks;

// New:
const { tasks, dispatch } = useTasks();
```

**Components to update:**
- TasksZone.tsx → useTasks()
- LibraryZone.tsx → useNotes()
- SessionsZone.tsx → useSessions()
- CaptureZone.tsx → useSessions(), useTasks(), useNotes()
- And 20+ more components

**Acceptance Criteria (Overall):**
- [ ] All 5 contexts created
- [ ] All providers added to App.tsx
- [ ] All components updated to use new hooks
- [ ] No TypeScript errors
- [ ] App functions identically to before
- [ ] Re-render count reduced by 70%+ (use React DevTools)
- [ ] All tests pass

**Testing:**
1. Use React DevTools Profiler
2. Record interaction (e.g., toggle task)
3. Verify only TasksZone re-renders (not Library, Sessions, etc.)
4. Test all functionality still works
5. Check for performance improvement

---

### TASK 5.1: Lazy Load All Zone Components
**Priority:** CRITICAL
**Estimated Time:** 2 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/App.tsx`
**Lines:** 8-12, 90-100

**Problem:**
All zones loaded eagerly, creating 600-800KB initial bundle and 4-6s time to interactive.

**Implementation Steps:**
1. Import React.lazy and Suspense
2. Convert all zone imports to lazy()
3. Wrap zone rendering in Suspense
4. Create loading fallback component
5. Test lazy loading works

**Code Changes:**
```typescript
// REPLACE (lines 8-12):
import { CaptureZone } from './components/CaptureZone';
import { TasksZone } from './components/TasksZone';
import { LibraryZone } from './components/LibraryZone';
import { SessionsZone } from './components/SessionsZone';
import { AssistantZone } from './components/AssistantZone';
import { ProfileZone } from './components/ProfileZone';

// WITH:
import { lazy, Suspense } from 'react';

const CaptureZone = lazy(() => import('./components/CaptureZone'));
const TasksZone = lazy(() => import('./components/TasksZone'));
const LibraryZone = lazy(() => import('./components/LibraryZone'));
const SessionsZone = lazy(() => import('./components/SessionsZone'));
const AssistantZone = lazy(() => import('./components/AssistantZone'));
const ProfileZone = lazy(() => import('./components/ProfileZone'));

// Add loading fallback component (around line 30)
function ZoneLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

// REPLACE zone rendering (around line 90-100):
{/* OLD */}
{state.ui.activeTab === 'capture' && <CaptureZone />}
{state.ui.activeTab === 'tasks' && <TasksZone />}
// ...

{/* NEW */}
<Suspense fallback={<ZoneLoadingFallback />}>
  {state.ui.activeTab === 'capture' && <CaptureZone />}
  {state.ui.activeTab === 'tasks' && <TasksZone />}
  {state.ui.activeTab === 'library' && <LibraryZone />}
  {state.ui.activeTab === 'sessions' && <SessionsZone />}
  {state.ui.activeTab === 'assistant' && <NedOverlay />}
  {state.ui.activeTab === 'profile' && <ProfileZone />}
</Suspense>
```

**Update Zone Components for Named Exports:**
```typescript
// In each zone component file (e.g., CaptureZone.tsx)
// Make sure component is default export:

// CHANGE FROM:
export function CaptureZone() { ... }

// TO:
function CaptureZone() { ... }
export default CaptureZone;

// Or use named export with default:
export default function CaptureZone() { ... }
```

**Acceptance Criteria:**
- [ ] React.lazy imported
- [ ] All zone imports converted to lazy()
- [ ] Suspense wrapper added around zone rendering
- [ ] Loading fallback component created
- [ ] Zone components updated for default export
- [ ] No TypeScript errors
- [ ] App loads and functions correctly
- [ ] Network tab shows code splitting (separate chunks per zone)
- [ ] Initial bundle size reduced to 200-300KB
- [ ] Time to interactive reduced to 1-2 seconds

**Testing:**
1. Run `npm run build`
2. Check `dist/assets` folder sizes
3. Verify multiple JS chunks created (one per zone)
4. Open Network tab in DevTools
5. Load app and verify initial bundle is small
6. Switch between zones and verify chunks load on-demand
7. Use Lighthouse to verify TTI improved to <2s

---

## HIGH PRIORITY TASKS (Week 2)

### TASK 1.2: Add useCallback to LibraryZone Event Handlers
**Priority:** HIGH
**Estimated Time:** 1 hour
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/components/LibraryZone.tsx`
**Lines:** 161-171, 173-187, 151-157

**Implementation:**
```typescript
// Import useCallback at top
import { useState, useMemo, useCallback } from 'react';

// WRAP handleNoteClick (line 161):
const handleNoteClick = useCallback((noteId: string, e: React.MouseEvent) => {
  if (e.metaKey || e.ctrlKey) {
    const note = state.notes.find(n => n.id === noteId);
    if (note) {
      dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: note.id, label: note.summary } });
    }
  } else {
    setSelectedNoteIdForInline(noteId);
  }
}, [state.notes, dispatch]);

// WRAP handleCreateNewNote (line 173):
const handleCreateNewNote = useCallback(() => {
  const now = new Date().toISOString();
  const newNote: Note = {
    id: generateId(),
    content: '',
    summary: 'New Note',
    timestamp: now,
    lastUpdated: now,
    source: 'thought',
    tags: [],
  };
  dispatch({ type: 'ADD_NOTE', payload: newNote });
  setSelectedNoteIdForInline(newNote.id);
}, [dispatch]);

// WRAP toggleTag (line 151):
const toggleTag = useCallback((tag: string) => {
  setSelectedTags(prev =>
    prev.includes(tag)
      ? prev.filter(t => t !== tag)
      : [...prev, tag]
  );
}, []);
```

**Acceptance Criteria:**
- [ ] useCallback imported
- [ ] All three handlers wrapped
- [ ] Correct dependencies specified
- [ ] No TypeScript errors
- [ ] Functions work correctly

**Testing:**
- Click notes, create new note, toggle tags
- Verify functionality unchanged
- Use React DevTools to verify fewer re-renders

---

### TASK 1.3: Memoize SessionDetailView Inline Styles
**Priority:** HIGH
**Estimated Time:** 1 hour
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionDetailView.tsx`
**Lines:** 506-509, 975, 987-990

**Implementation:**
```typescript
// Add at component top level (after other useMemo hooks):

// For line 506-509:
const descriptionStyle = useMemo(() => ({
  maxHeight: `${Math.max(0, (1 - scrollProgress) * 120)}px`,
  opacity: Math.max(0, 1 - scrollProgress * 1.2),
}), [scrollProgress]);

// For line 975:
const getActivityStyle = useCallback((color: string) => ({
  background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`
}), []);

// For line 987-990:
const getProgressStyle = useCallback((percentage: number, color: string) => ({
  width: `${percentage}%`,
  background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`,
}), []);

// Update JSX to use memoized values:
<div style={descriptionStyle}>

<div style={getActivityStyle(activity.color)}>

<div style={getProgressStyle(activity.percentage, activity.color)}>
```

**Acceptance Criteria:**
- [ ] All inline styles converted to useMemo/useCallback
- [ ] JSX updated to use memoized values
- [ ] Scrolling smoother (test with slow CPU throttling)

---

### TASK 2.2: Implement Screenshot LRU Cache
**Priority:** HIGH
**Estimated Time:** 2 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/components/ScreenshotViewer.tsx`
**Lines:** 42-76

**Implementation Steps:**
1. Install or create LRU cache utility
2. Create module-level cache (shared across instances)
3. Update useEffect to check cache first
4. Add screenshot to cache after loading

**Code:**
```typescript
// Add at top of file (after imports):
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove if exists
    this.cache.delete(key);

    // Add to end
    this.cache.set(key, value);

    // Evict oldest if over max size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Create cache (module-level, shared across all ScreenshotViewer instances)
const screenshotCache = new LRUCache<string, string>(20); // Cache 20 screenshots

// UPDATE useEffect (lines 42-76):
useEffect(() => {
  async function loadImage() {
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = screenshotCache.get(screenshot.attachmentId);
      if (cached) {
        console.log('✅ [SCREENSHOT] Using cached image');
        setImageData(cached);
        setLoading(false);
        return;
      }

      // Load from storage
      console.log('🔄 [SCREENSHOT] Loading from storage');
      const attachment = await attachmentStorage.getAttachment(screenshot.attachmentId);

      if (attachment && attachment.base64) {
        // Add to cache
        screenshotCache.set(screenshot.attachmentId, attachment.base64);
        setImageData(attachment.base64);
      } else {
        setError('Screenshot not found');
      }
    } catch (err) {
      console.error('Failed to load screenshot:', err);
      setError('Failed to load screenshot');
    } finally {
      setLoading(false);
    }
  }

  loadImage();
}, [screenshot.attachmentId]);
```

**Acceptance Criteria:**
- [ ] LRUCache class implemented
- [ ] Module-level cache created
- [ ] useEffect checks cache before loading
- [ ] Screenshots added to cache after loading
- [ ] Console logs show cache hits
- [ ] Second view of same screenshot is instant

---

### TASK 2.12: Implement IndexedDB Batch Writes
**Priority:** HIGH
**Estimated Time:** 2 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/services/storage/IndexedDBAdapter.ts`
**Lines:** 78-103

**Implementation:**
```typescript
// Add new method to IndexedDBAdapter class:

async saveBatch(entries: Array<{ key: string; data: any }>): Promise<void> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }

  console.log('💾 [INDEXEDDB] Batch saving', entries.length, 'collections');

  return new Promise((resolve, reject) => {
    const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
    const store = transaction.objectStore(this.STORE_NAME);

    const promises = entries.map(({ key, data }) =>
      new Promise<void>((res, rej) => {
        const request = store.put({ key, value: data });
        request.onsuccess = () => res();
        request.onerror = () => rej(request.error);
      })
    );

    Promise.all(promises)
      .then(() => {
        console.log('✅ [INDEXEDDB] Batch save complete');
        resolve();
      })
      .catch(reject);

    transaction.onerror = () => reject(transaction.error);
  });
}
```

**Update AppContext to use batch save:**
```typescript
// In saveCollections helper (created in Task 2.1):
const saveCollections = useCallback(async (collections: string[]) => {
  console.log('💾 [STORAGE] Batch saving collections:', collections);

  const entries = collections.map(collection => {
    let data: any;

    switch (collection) {
      case 'companies':
        data = state.companies;
        break;
      case 'contacts':
        data = state.contacts;
        break;
      case 'topics':
        data = state.topics;
        break;
      case 'notes':
        data = state.notes;
        break;
      case 'tasks':
        data = state.tasks;
        break;
      case 'sessions':
        data = state.sessions;
        break;
      case 'settings':
        data = {
          aiSettings: state.aiSettings,
          learningSettings: state.learningSettings,
          userProfile: state.userProfile,
          nedSettings: state.nedSettings,
          searchHistory: state.searchHistory,
        };
        break;
      case 'ui':
        data = state.ui;
        break;
      default:
        return null;
    }

    return { key: collection, data };
  }).filter(Boolean) as Array<{ key: string; data: any }>;

  try {
    await storageService.saveBatch(entries);
    console.log('✅ [STORAGE] Batch save complete');
  } catch (error) {
    console.error('❌ [STORAGE] Batch save failed:', error);
  }
}, [state]);
```

**Acceptance Criteria:**
- [ ] saveBatch method added to IndexedDBAdapter
- [ ] Single transaction used for multiple saves
- [ ] AppContext updated to use batch save
- [ ] Console logs show single batch operation
- [ ] Save time reduced by 50%

---

### TASK 3.2: Cache Screenshot Analysis
**Priority:** HIGH
**Estimated Time:** 3 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/services/sessionsAgentService.ts`
**Lines:** 77-203

**Implementation:**
```typescript
// Add to SessionsAgentService class:

private screenshotAnalysisCache = new Map<string, {
  analysis: SessionScreenshot['aiAnalysis'];
  imageHash: string;
}>();

private async generateImageHash(base64Data: string): Promise<string> {
  // Use first 10KB as sample for hash
  const encoder = new TextEncoder();
  const sample = base64Data.substring(0, 10000);
  const data = encoder.encode(sample);

  // Generate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

clearScreenshotCache(): void {
  this.screenshotAnalysisCache.clear();
  console.log('🗑️ [SCREENSHOT] Cleared all cached analyses');
}

// UPDATE analyzeScreenshot method (line 77):
async analyzeScreenshot(
  screenshot: SessionScreenshot,
  session: Session,
  screenshotBase64: string,
  mimeType: string
): Promise<SessionScreenshot['aiAnalysis']> {
  // Generate hash from image data
  const imageHash = await this.generateImageHash(screenshotBase64);

  // Check cache
  const cached = this.screenshotAnalysisCache.get(imageHash);
  if (cached) {
    console.log('✅ [SCREENSHOT] Using cached analysis (visually similar screenshot)');
    return cached.analysis;
  }

  console.log('🔄 [SCREENSHOT] Analyzing new screenshot...');

  // ... existing API call logic ...

  // After getting result (before return):
  this.screenshotAnalysisCache.set(imageHash, {
    analysis: analysisResult,
    imageHash
  });

  console.log('💾 [SCREENSHOT] Cached analysis for image hash:', imageHash.substring(0, 8));

  return analysisResult;
}
```

**Acceptance Criteria:**
- [ ] Image hash generation implemented
- [ ] Cache check added before API call
- [ ] Results cached after analysis
- [ ] Console logs show cache hits
- [ ] Similar screenshots reuse analysis
- [ ] API costs reduced (check dashboard)

---

### TASK 3.3: Cache Video Chapter Generation
**Priority:** HIGH
**Estimated Time:** 2 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/services/videoChapteringService.ts`
**Lines:** 40-72

**Implementation:**
```typescript
// Add to VideoChapteringService class:

private chapterCache = new Map<string, {
  chapters: ChapterProposal[];
  videoHash: string;
  timestamp: number;
}>();

clearChapterCache(videoId?: string): void {
  if (videoId) {
    this.chapterCache.delete(videoId);
    console.log(`🗑️ [VIDEO CHAPTERS] Cleared cache for video ${videoId}`);
  } else {
    this.chapterCache.clear();
    console.log('🗑️ [VIDEO CHAPTERS] Cleared all cached chapters');
  }
}

// UPDATE proposeChapters method (line 40):
async proposeChapters(session: Session): Promise<ChapterProposal[]> {
  const videoAttachmentId = session.video?.fullVideoAttachmentId;

  if (!videoAttachmentId) {
    console.log('⚠️ [VIDEO CHAPTERS] No video attachment found');
    return [];
  }

  // Check cache (video is immutable after recording)
  const cached = this.chapterCache.get(videoAttachmentId);
  if (cached) {
    console.log('✅ [VIDEO CHAPTERS] Using cached chapters for video', videoAttachmentId);
    return cached.chapters;
  }

  console.log('🔄 [VIDEO CHAPTERS] Generating chapters for video', videoAttachmentId);

  // ... existing frame extraction and API call logic ...

  // After generating chapters (before return):
  this.chapterCache.set(videoAttachmentId, {
    chapters,
    videoHash: videoAttachmentId,
    timestamp: Date.now()
  });

  console.log('💾 [VIDEO CHAPTERS] Cached', chapters.length, 'chapters for video');

  return chapters;
}
```

**Update AppContext to clear cache:**
```typescript
// In DELETE_SESSION case:
case 'DELETE_SESSION': {
  const sessionId = action.payload;
  const session = state.sessions.find(s => s.id === sessionId);

  // Clear video chapter cache if session has video
  if (session?.video?.fullVideoAttachmentId) {
    videoChapteringService.clearChapterCache(session.video.fullVideoAttachmentId);
  }

  // ... rest of delete logic
}
```

**Acceptance Criteria:**
- [ ] Chapter cache Map added
- [ ] Cache check at start of proposeChapters
- [ ] Chapters cached after generation
- [ ] clearChapterCache method added
- [ ] AppContext clears cache on session delete
- [ ] 100% cache hit rate on re-open (video immutable)
- [ ] API costs reduced

---

### TASK 5.2: Lazy Load Sidebars and Modals
**Priority:** HIGH
**Estimated Time:** 1 hour
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/App.tsx`
**Lines:** 13-14, 16-17

**Implementation:**
```typescript
// REPLACE:
import { TaskDetailSidebar } from './components/TaskDetailSidebar';
import { NoteDetailSidebar } from './components/NoteDetailSidebar';
import { FloatingControls } from './components/FloatingControls';
import { NedOverlay } from './components/NedOverlay';

// WITH:
const TaskDetailSidebar = lazy(() => import('./components/TaskDetailSidebar'));
const NoteDetailSidebar = lazy(() => import('./components/NoteDetailSidebar'));
const FloatingControls = lazy(() => import('./components/FloatingControls'));
const NedOverlay = lazy(() => import('./components/NedOverlay'));

// Wrap conditionally rendered sidebars in Suspense:
<Suspense fallback={null}>
  {state.sidebar.isOpen && state.sidebar.type === 'task' && state.sidebar.itemId && (
    <TaskDetailSidebar taskId={state.sidebar.itemId} />
  )}
  {state.sidebar.isOpen && state.sidebar.type === 'note' && state.sidebar.itemId && (
    <NoteDetailSidebar noteId={state.sidebar.itemId} />
  )}
</Suspense>

<Suspense fallback={null}>
  <FloatingControls />
</Suspense>
```

**Update components for default export:**
- TaskDetailSidebar.tsx
- NoteDetailSidebar.tsx (already done)
- FloatingControls.tsx
- NedOverlay.tsx

**Acceptance Criteria:**
- [ ] All sidebars converted to lazy imports
- [ ] Suspense wrappers added
- [ ] Components updated for default export
- [ ] Sidebars load on-demand
- [ ] Network tab shows separate chunks

---

### TASK 5.3: Defer Video Repair Utility
**Priority:** HIGH
**Estimated Time:** 15 minutes
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/main.tsx`
**Lines:** 7-8

**Implementation:**
```typescript
// REMOVE:
import './utils/debugActivityMonitor' // Remove entirely (dev only)
import { fixCorruptedVideoAttachments } from './utils/fixVideoAttachments'

fixCorruptedVideoAttachments().catch(error => {
  console.error('❌ [MAIN] Video repair failed:', error);
});

// REPLACE WITH:
// Defer video repair to after app is interactive
setTimeout(() => {
  import('./utils/fixVideoAttachments')
    .then(({ fixCorruptedVideoAttachments }) => {
      return fixCorruptedVideoAttachments();
    })
    .then(() => {
      console.log('✅ [MAIN] Video repair check complete');
    })
    .catch(error => {
      console.error('❌ [MAIN] Video repair failed:', error);
    });
}, 5000); // Run after 5 seconds
```

**Acceptance Criteria:**
- [ ] Debug utility import removed
- [ ] Video repair deferred to setTimeout
- [ ] Dynamic import used
- [ ] App starts 100-200ms faster
- [ ] Video repair still runs (check logs)

---

## MEDIUM PRIORITY TASKS (Week 3)

[Continue with remaining 14 medium priority tasks...]

### TASK 1.4: Fix NoteDetailInline useEffect Dependencies
**Priority:** MEDIUM
**Estimated Time:** 30 minutes
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/components/NoteDetailInline.tsx`
**Line:** 35

**Implementation:**
```typescript
// Add useMemo before useEffect:
const activeNote = useMemo(() =>
  state.notes.find(n => n.id === state.activeNoteId),
  [state.notes, state.activeNoteId]
);

// Update useEffect:
useEffect(() => {
  if (activeNote) {
    dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'note', itemId: activeNote.id, label: activeNote.summary } });
    dispatch({ type: 'SET_ACTIVE_NOTE', payload: undefined });
  }
}, [activeNote, dispatch]);
```

**Acceptance Criteria:**
- [ ] activeNote memoized
- [ ] useEffect dependencies updated
- [ ] Effect only runs when active note changes

---

### TASK 2.3: Preload Adjacent Screenshots in Scrubber
**Priority:** MEDIUM
**Estimated Time:** 2 hours
**File:** `/Users/jamesmcarthur/Documents/taskerino/src/components/ScreenshotScrubber.tsx`
**Lines:** 46-61

**Implementation:**
```typescript
useEffect(() => {
  if (!currentScreenshot) return;

  const loadImages = async () => {
    const currentIndex = session.screenshots.findIndex(s => s.id === currentScreenshot.id);

    // Load current + 2 ahead + 2 behind
    const toPreload = [
      session.screenshots[currentIndex - 2],
      session.screenshots[currentIndex - 1],
      currentScreenshot,
      session.screenshots[currentIndex + 1],
      session.screenshots[currentIndex + 2],
    ].filter(Boolean);

    // Load in parallel
    const promises = toPreload.map(async s => {
      // Check cache first (using cache from Task 2.2)
      const cached = screenshotCache.get(s.attachmentId);
      if (cached) return cached;

      // Load from storage
      const attachment = await attachmentStorage.getAttachment(s.attachmentId);
      if (attachment?.base64) {
        screenshotCache.set(s.attachmentId, attachment.base64);
        return attachment.base64;
      }
      return null;
    });

    const results = await Promise.all(promises);
    const currentImage = results[2]; // Index 2 is current screenshot

    if (currentImage) {
      setCurrentScreenshotImage(currentImage);
    }
  };

  loadImages();
}, [currentScreenshot?.id, session.screenshots]);
```

**Acceptance Criteria:**
- [ ] Preloads 5 screenshots (current + 2 each direction)
- [ ] Loads in parallel
- [ ] Uses cache from Task 2.2
- [ ] Scrubbing is smooth (no lag)

---

[Continue with remaining medium priority tasks: 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 3.5, 3.6, 4.4, 1.5, 1.6, 1.7...]

## LOW PRIORITY TASKS (Week 4+)

[Continue with 9 low priority tasks: 1.8, 1.9, 2.13, 4.2...]

---

## TESTING CHECKLIST

After implementing each group of tasks:

### Performance Testing
- [ ] Run React DevTools Profiler
- [ ] Record before/after metrics
- [ ] Verify render count reduction
- [ ] Check memory usage in Task Manager
- [ ] Test with large datasets (100+ items)

### Functionality Testing
- [ ] All features work correctly
- [ ] No regressions introduced
- [ ] Data persists correctly
- [ ] Caches clear appropriately
- [ ] Error handling works

### Bundle Size Testing
- [ ] Run `npm run build`
- [ ] Check `dist/assets` sizes
- [ ] Verify code splitting
- [ ] Test with Network throttling
- [ ] Use Lighthouse for TTI measurement

### API Cost Testing
- [ ] Monitor Claude API dashboard
- [ ] Track API call counts
- [ ] Verify cache hit rates
- [ ] Calculate cost savings

---

## IMPLEMENTATION ORDER

**Week 1 - Critical (30 hours):**
1. TASK 1.1 - LibraryZone memoization (2h)
2. TASK 1.10 - SessionsZone search index (3h)
3. TASK 2.1 - Dirty tracking (4h)
4. TASK 3.1 - Session summary cache (3h)
5. TASK 5.1 - Lazy load zones (2h)
6. TASK 4.1 - Split contexts (10h) - START but may continue into Week 2
7. TASK 5.3 - Defer video repair (15min)

**Week 2 - High Priority (20 hours):**
1. Finish TASK 4.1 if needed
2. TASK 1.2 - useCallback handlers (1h)
3. TASK 1.3 - Memoize styles (1h)
4. TASK 2.2 - Screenshot cache (2h)
5. TASK 2.12 - IndexedDB batching (2h)
6. TASK 3.2 - Screenshot analysis cache (3h)
7. TASK 3.3 - Video chapter cache (2h)
8. TASK 5.2 - Lazy sidebars (1h)
9. Start medium priority tasks

**Week 3 - Medium Priority (15-20 hours):**
- Complete remaining medium tasks

**Week 4+ - Low Priority & Polish (10 hours):**
- Complete low priority tasks
- Final testing and optimization

---

## SUCCESS METRICS

Track these metrics before and after:

### Rendering Performance
- [ ] Component render count (React DevTools)
- [ ] Time to render list of 50 items
- [ ] Scroll FPS (use Performance Monitor)
- [ ] Search response time

### I/O Performance
- [ ] Number of storage write operations
- [ ] Bytes written per minute
- [ ] File read count per session view
- [ ] IndexedDB transaction time

### Bundle & Startup
- [ ] Initial bundle size (KB)
- [ ] Time to Interactive (seconds)
- [ ] First Contentful Paint (seconds)
- [ ] Largest Contentful Paint (seconds)

### API Costs
- [ ] Claude API calls per session
- [ ] API cost per 100 sessions
- [ ] Cache hit rate percentage

### Memory
- [ ] JS Heap size (DevTools)
- [ ] DOM nodes count
- [ ] Event listeners count

---

## NOTES FOR TASK AGENTS

**General Guidelines:**
1. Always read the entire file before making changes
2. Verify dependencies are correct (don't miss any)
3. Test changes before marking task complete
4. Add console logs for debugging
5. Use TypeScript strict mode
6. Follow existing code style
7. Update tests if applicable

**Common Pitfalls:**
- Forgetting to import useCallback/useMemo
- Incorrect dependency arrays
- Not updating JSX after memoization
- Missing await keywords
- Not handling errors

**Code Style:**
- Use arrow functions for React components
- Prefer const over let
- Use early returns for guards
- Keep functions focused and small
- Add TypeScript types for everything

**Performance Testing:**
- Always use React DevTools Profiler
- Record before and after metrics
- Test with realistic data sizes
- Use Chrome Performance tab for deep analysis

---

**End of Task List**
