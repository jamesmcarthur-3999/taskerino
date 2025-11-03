# AppContext & types.ts Cleanup Plan

**Created**: October 26, 2025
**Scope**: Comprehensive cleanup (Option C level) for AppContext.tsx and types.ts
**Excluded**: SessionsContext.tsx (deferred to Phase 7)
**Total Effort**: 19.5 hours over 2-3 weeks
**Goal**: Production-ready documentation, reduced complexity, improved maintainability

---

## Executive Summary

This plan focuses on improving two critical files through documentation, helper extraction, and complexity reduction - **WITHOUT major restructuring**.

### Files in Scope

1. **AppContext.tsx** (2,236 lines) - Global app state management
2. **types.ts** (2,181 lines) - TypeScript type definitions

### Approach

- ✅ Add comprehensive JSDoc documentation
- ✅ Extract helpers to reduce duplication
- ✅ Simplify complex logic sections
- ✅ Add section comments for navigation
- ✅ Extract magic numbers to constants
- ❌ NO file splitting or major refactoring

### Effort Breakdown

| File | Quick Wins | Medium Wins | Total |
|------|-----------|-------------|-------|
| AppContext.tsx | 3h | 6.5h | **9.5h** |
| types.ts | 2.5h | 7.5h | **10h** |
| **TOTAL** | **5.5h** | **14h** | **19.5h** |

---

## Phase 1: Quick Wins (Week 1)

**Duration**: 5.5 hours
**Goal**: Immediate readability improvements

### Day 1: AppContext Quick Wins (3 hours)

#### Task 1.1: Add Section Comments to Reducer (45 min)
**Location**: `src/context/AppContext.tsx:296-1657`

**Before**: 1,361-line switch statement with 60+ cases, no organization

**After**:
```typescript
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // ========================================
    // SESSION ACTIONS (DEPRECATED - Use SessionsContext)
    // ========================================
    case 'START_SESSION':
    case 'END_SESSION':
    // ... (60 lines)

    // ========================================
    // ENTITY ACTIONS (Companies, Contacts, Topics)
    // ========================================
    case 'ADD_COMPANY':
    case 'UPDATE_COMPANY':
    case 'DELETE_COMPANY':
    case 'ADD_CONTACT':
    case 'UPDATE_CONTACT':
    case 'DELETE_CONTACT':
    case 'ADD_TOPIC':
    case 'UPDATE_TOPIC':
    case 'DELETE_TOPIC':
    // ... (70 lines)

    // ========================================
    // NOTE ACTIONS
    // ========================================
    case 'ADD_NOTE':
    case 'UPDATE_NOTE':
    case 'DELETE_NOTE':
    case 'BATCH_ADD_NOTES':
    // ... (175 lines)

    // ========================================
    // TASK ACTIONS
    // ========================================
    case 'ADD_TASK':
    case 'UPDATE_TASK':
    case 'TOGGLE_TASK':
    case 'BATCH_UPDATE_TASKS':
    // ... (70 lines)

    // ========================================
    // MANUAL CREATION (Topics, Notes, Tasks)
    // ========================================
    case 'CREATE_MANUAL_TASK':
    case 'CREATE_MANUAL_TOPIC':
    case 'CREATE_MANUAL_NOTE':
    // ... (136 lines)

    // ========================================
    // UI ACTIONS - Navigation
    // ========================================
    case 'SET_ACTIVE_TAB':
    case 'SET_ZONE':
    case 'SET_ACTIVE_TOPIC':
    // ... (13 lines)

    // ========================================
    // UI ACTIONS - Reference Panel
    // ========================================
    case 'TOGGLE_REFERENCE_PANEL':
    case 'PIN_NOTE':
    case 'UNPIN_NOTE':
    // ... (44 lines)

    // ========================================
    // UI ACTIONS - Notifications
    // ========================================
    case 'ADD_NOTIFICATION':
    case 'DISMISS_NOTIFICATION':
    // ... (42 lines)

    // ========================================
    // UI ACTIONS - Background Processing
    // ========================================
    case 'ADD_PROCESSING_JOB':
    case 'UPDATE_PROCESSING_JOB':
    case 'COMPLETE_PROCESSING_JOB':
    case 'FAIL_PROCESSING_JOB':
    // ... (98 lines)

    // ========================================
    // UI ACTIONS - Bulk Operations
    // ========================================
    case 'TOGGLE_BULK_SELECTION_MODE':
    case 'SELECT_TASK':
    case 'DESELECT_TASK':
    // ... (46 lines)

    // ========================================
    // UI ACTIONS - Modals & Overlays
    // ========================================
    case 'TOGGLE_QUICK_CAPTURE':
    case 'TOGGLE_COMMAND_PALETTE':
    case 'TOGGLE_NED_OVERLAY':
    case 'TOGGLE_SUBMENU_OVERLAY':
    // ... (54 lines)

    // ========================================
    // UI ACTIONS - Onboarding
    // ========================================
    case 'COMPLETE_ONBOARDING':
    case 'DISMISS_TOOLTIP':
    case 'START_INTERACTIVE_TOUR':
    // ... (123 lines)

    // ========================================
    // SEARCH HISTORY
    // ========================================
    case 'ADD_SEARCH_HISTORY':
    case 'CLEAR_SEARCH_HISTORY':
    // ... (14 lines)

    // ========================================
    // PREFERENCES & SETTINGS
    // ========================================
    case 'UPDATE_PREFERENCES':
    // ... (9 lines)

    // ========================================
    // SIDEBAR ACTIONS
    // ========================================
    case 'OPEN_SIDEBAR':
    case 'CLOSE_SIDEBAR':
    case 'RESIZE_SIDEBAR':
    case 'POP_SIDEBAR_HISTORY':
    case 'CLEAR_SIDEBAR_HISTORY':
    // ... (65 lines)

    // ========================================
    // SETTINGS (AI, Learning, User Profile, Ned)
    // ========================================
    case 'UPDATE_AI_SETTINGS':
    case 'UPDATE_LEARNING_SETTINGS':
    case 'UPDATE_USER_PROFILE':
    case 'UPDATE_NED_SETTINGS':
    case 'GRANT_NED_PERMISSION':
    case 'REVOKE_NED_PERMISSION':
    // ... (78 lines)

    // ========================================
    // NED CONVERSATION
    // ========================================
    case 'ADD_NED_MESSAGE':
    case 'UPDATE_NED_MESSAGE':
    case 'CLEAR_NED_CONVERSATION':
    case 'SET_NED_TYPING':
    // ... (30 lines)

    // ========================================
    // DATA MANAGEMENT
    // ========================================
    case 'LOAD_STATE':
    case 'CLEAR_ALL_DATA':
    // ... (3 lines)

    default:
      return state;
  }
}
```

**Checklist**:
- [ ] Add 15 section headers
- [ ] Verify all cases are under correct section
- [ ] Commit changes

---

#### Task 1.2: Extract Entity Update Helper (20 min)
**Location**: `src/context/AppContext.tsx:577, 600, 622`

**Problem**: Same update pattern repeated 3 times

**Before** (repeated 3x):
```typescript
case 'UPDATE_COMPANY':
  return {
    ...state,
    companies: state.companies.map(c =>
      c.id === action.payload.id ? action.payload : c
    ),
  };

case 'UPDATE_CONTACT':
  return {
    ...state,
    contacts: state.contacts.map(c =>
      c.id === action.payload.id ? action.payload : c
    ),
  };

case 'UPDATE_TOPIC':
  return {
    ...state,
    topics: state.topics.map(t =>
      t.id === action.payload.id ? action.payload : t
    ),
  };
```

**After**:
```typescript
// Add helper at top of file (after imports):

/**
 * Updates a single entity in a list by ID
 * @template T - Entity type with id field
 * @param entities - Array of entities
 * @param entityId - ID of entity to update
 * @param updates - Updated entity object
 * @returns New array with updated entity
 */
function updateEntityInList<T extends { id: string }>(
  entities: T[],
  entityId: string,
  updates: T
): T[] {
  return entities.map(entity =>
    entity.id === entityId ? updates : entity
  );
}

// Usage in reducer:
case 'UPDATE_COMPANY':
  return {
    ...state,
    companies: updateEntityInList(state.companies, action.payload.id, action.payload),
  };

case 'UPDATE_CONTACT':
  return {
    ...state,
    contacts: updateEntityInList(state.contacts, action.payload.id, action.payload),
  };

case 'UPDATE_TOPIC':
  return {
    ...state,
    topics: updateEntityInList(state.topics, action.payload.id, action.payload),
  };
```

**Checklist**:
- [ ] Add helper function with JSDoc
- [ ] Replace 3 usages
- [ ] Test entity updates work
- [ ] Commit changes

---

#### Task 1.3: Extract Magic Numbers (10 min)
**Location**: `src/context/AppContext.tsx:1047, 1456`

**Before**:
```typescript
case 'PIN_NOTE': {
  const noteId = action.payload;
  if (state.ui.pinnedNotes.length >= 5) { // Magic number!
    return {
      ...state,
      ui: {
        ...state.ui,
        pinnedNotes: [...state.ui.pinnedNotes.slice(1), noteId],
      },
    };
  }
  // ...
}

case 'ADD_SEARCH_HISTORY': {
  const newHistory = [item, ...state.searchHistory].slice(0, 50); // Magic number!
  return { ...state, searchHistory: newHistory };
}
```

**After**:
```typescript
// Add constants at top of file:

/**
 * UI Configuration Constants
 */
const UI_LIMITS = {
  /** Maximum number of notes that can be pinned in reference panel */
  MAX_PINNED_NOTES: 5,

  /** Maximum search history entries to keep */
  MAX_SEARCH_HISTORY: 50,
} as const;

// Usage:
case 'PIN_NOTE': {
  const noteId = action.payload;
  if (state.ui.pinnedNotes.length >= UI_LIMITS.MAX_PINNED_NOTES) {
    return {
      ...state,
      ui: {
        ...state.ui,
        pinnedNotes: [...state.ui.pinnedNotes.slice(1), noteId],
      },
    };
  }
  // ...
}

case 'ADD_SEARCH_HISTORY': {
  const newHistory = [item, ...state.searchHistory].slice(0, UI_LIMITS.MAX_SEARCH_HISTORY);
  return { ...state, searchHistory: newHistory };
}
```

**Checklist**:
- [ ] Add UI_LIMITS constant
- [ ] Replace 2 magic numbers
- [ ] Commit changes

---

#### Task 1.4: Simplify PIN_NOTE Logic (15 min)
**Location**: `src/context/AppContext.tsx:1044-1065`

**Before**:
```typescript
case 'PIN_NOTE': {
  const noteId = action.payload;
  if (state.ui.pinnedNotes.includes(noteId)) {
    return state;
  }
  if (state.ui.pinnedNotes.length >= 5) {
    return {
      ...state,
      ui: {
        ...state.ui,
        pinnedNotes: [...state.ui.pinnedNotes.slice(1), noteId],
      },
    };
  }
  return {
    ...state,
    ui: {
      ...state.ui,
      pinnedNotes: [...state.ui.pinnedNotes, noteId],
      referencePanelOpen: true,
    },
  };
}
```

**After**:
```typescript
case 'PIN_NOTE': {
  const noteId = action.payload;

  // Don't re-pin already pinned notes
  if (state.ui.pinnedNotes.includes(noteId)) {
    return state;
  }

  // If at max capacity, remove oldest and add new
  // Otherwise just add new
  const pinnedNotes = state.ui.pinnedNotes.length >= UI_LIMITS.MAX_PINNED_NOTES
    ? [...state.ui.pinnedNotes.slice(1), noteId] // Remove oldest (FIFO)
    : [...state.ui.pinnedNotes, noteId];         // Just add

  return {
    ...state,
    ui: {
      ...state.ui,
      pinnedNotes,
      referencePanelOpen: true, // Auto-open reference panel when pinning
    },
  };
}
```

**Checklist**:
- [ ] Refactor with clearer logic
- [ ] Add explanatory comments
- [ ] Test pin behavior
- [ ] Commit changes

---

#### Task 1.5: Add JSDoc to Defaults (30 min)
**Location**: `src/context/AppContext.tsx:146-266`

**Before**: 11 default objects with no documentation

**After**: Each default has comprehensive JSDoc

```typescript
/**
 * Default AI Settings for New Users
 *
 * Controls how Claude processes notes and extracts tasks:
 * - systemInstructions: Guides Claude's behavior and tone
 * - autoMergeNotes: Automatically combines similar notes to prevent duplicates
 * - autoExtractTasks: Detects action items in notes and creates tasks
 *
 * Users can customize these in Settings > AI Configuration
 */
const defaultAISettings: AppState['aiSettings'] = {
  systemInstructions: `You are a helpful assistant that organizes notes and extracts actionable tasks. Be concise and focus on what matters.`,
  autoMergeNotes: true,
  autoExtractTasks: true,
};

/**
 * Default Learning System Settings
 *
 * Controls how the AI learns from user feedback on topic detection and task extraction:
 * - enabled: Master switch for learning system
 * - confirmationPoints: Points added when user keeps AI suggestion (default: 10)
 * - rejectionPenalty: Points removed when user changes AI suggestion (default: 20)
 * - thresholds: Score ranges for pattern strength
 *   - observation (0-30): New pattern, low confidence
 *   - pattern (30-70): Emerging pattern, medium confidence
 *   - rule (70+): Strong pattern, high confidence
 *
 * Users can view learned patterns in Settings > Learning System
 */
const defaultLearningSettings: AppState['learningSettings'] = {
  enabled: true,
  confirmationPoints: 10,
  rejectionPenalty: 20,
  thresholds: {
    observation: 30,
    pattern: 70,
  },
};

/**
 * Default User Profile
 *
 * Minimal user information for personalization:
 * - name: User's display name (used in UI greetings)
 * - role: Optional role/title for context
 * - focusAreas: Optional areas of interest for AI context
 */
const defaultUserProfile: AppState['userProfile'] = {
  name: '',
  role: '',
  focusAreas: [],
};

/**
 * Default Learning Accumulator
 *
 * Empty learning data structure. Populated as AI observes user patterns:
 * - topicMappings: Company/contact detection patterns
 * - taskExtractionPatterns: Task identification patterns
 * - userCorrections: History of user overrides
 */
const defaultLearnings: AppState['learnings'] = {
  topicMappings: [],
  taskExtractionPatterns: [],
  userCorrections: [],
};

/**
 * Default User Preferences
 *
 * UI/UX preferences:
 * - theme: 'light' | 'dark' | 'auto' (follows system)
 * - compactMode: Reduces spacing for more content density
 * - showWelcome: Show welcome modal on app launch
 * - keyboardShortcutsEnabled: Global keyboard shortcut handling
 */
const defaultPreferences: AppState['preferences'] = {
  theme: 'light',
  compactMode: false,
  showWelcome: true,
  keyboardShortcutsEnabled: true,
};

/**
 * Default Onboarding State
 *
 * Tracks user onboarding progress:
 * - completed: Whether user has finished onboarding flow
 * - currentStep: Current step in onboarding (1-5)
 * - dismissedTooltips: Which tooltips user has dismissed
 * - interactiveTourActive: Whether interactive tour is running
 *
 * Reset via Settings > Reset Onboarding
 */
const defaultOnboardingState: AppState['onboarding'] = {
  completed: false,
  currentStep: 1,
  dismissedTooltips: [],
  interactiveTourActive: false,
};

/**
 * Default Ned AI Assistant Settings
 *
 * Controls Ned's behavior and capabilities:
 * - conversationStyle: 'concise' | 'detailed' | 'friendly'
 * - autoSearch: Automatically search notes/tasks when answering questions
 * - suggestActions: Proactively suggest actions based on context
 * - permissions: Tool permissions (search, create tasks, etc.)
 */
const defaultNedSettings: AppState['nedSettings'] = {
  conversationStyle: 'friendly',
  autoSearch: true,
  suggestActions: true,
  permissions: {},
};

/**
 * Default UI State
 *
 * Initial UI configuration:
 * - activeTab: Current navigation tab
 * - zone: Current app zone (capture, tasks, library, etc.)
 * - referencePanelOpen: Whether reference panel is visible
 * - pinnedNotes: Array of pinned note IDs (max 5)
 * - notifications: Toast notifications queue
 * - processingJobs: Background jobs (AI processing, imports, etc.)
 * - bulkSelectionMode: Whether bulk operations mode is active
 * - quickCaptureOpen: Whether quick capture modal is visible
 * - commandPaletteOpen: Whether command palette (⌘K) is visible
 * - nedOverlayOpen: Whether Ned chat overlay is visible
 * - showSubMenuOverlay: Whether sub-menu overlay is expanded
 * - onboarding: Onboarding state
 */
const defaultUIState: AppState['ui'] = {
  activeTab: 'tasks',
  zone: 'capture',
  referencePanelOpen: false,
  pinnedNotes: [],
  notifications: [],
  processingJobs: [],
  bulkSelectionMode: false,
  selectedTaskIds: [],
  quickCaptureOpen: false,
  commandPaletteOpen: false,
  nedOverlayOpen: false,
  showSubMenuOverlay: false,
  onboarding: defaultOnboardingState,
};

// Add JSDoc to remaining defaults: defaultSidebar, defaultNedConversationState, defaultAppState
```

**Checklist**:
- [ ] Add JSDoc to all 11 defaults
- [ ] Document purpose, fields, user impact
- [ ] Commit changes

---

#### Task 1.6: Add JSDoc to Dispatch Wrapper (20 min)
**Location**: `src/context/AppContext.tsx:1695`

**Before**: Minimal inline comment

**After**:
```typescript
/**
 * Custom Dispatch Wrapper with Critical Action Handling
 *
 * This wrapper intercepts all dispatch calls to provide immediate saves for critical actions.
 *
 * SAVE STRATEGY:
 * - Critical actions: Saved IMMEDIATELY after React state flush (prevents data loss on crash)
 * - Non-critical actions: Debounced save after 5 seconds (reduces write overhead)
 *
 * CRITICAL ACTIONS (immediate save):
 * - END_SESSION: Prevents session data loss
 * - DELETE_SESSION: Ensures deletion persists
 * - START_SESSION: Captures session start time immediately
 * - UPDATE_SESSION: Prevents enrichment status loss
 * - ADD_SESSION_SCREENSHOT: Prevents screenshot data loss (most frequent)
 * - ADD_SESSION_AUDIO_SEGMENT: Prevents audio transcription loss
 * - UPDATE_SCREENSHOT_ANALYSIS: Prevents AI analysis loss
 * - ADD_SESSION_CONTEXT_ITEM: Prevents manual notes loss
 *
 * TIMING:
 * Uses queueMicrotask + requestAnimationFrame to ensure save happens AFTER:
 * 1. React state update completes
 * 2. React renders to DOM
 * This prevents race conditions where save might serialize stale state.
 *
 * ERROR HANDLING:
 * Falls back to localStorage on storage system failure (browser compatibility).
 *
 * @param action - Redux-style action object
 * @see CRITICAL_ACTIONS - Set of action types requiring immediate save
 * @see saveToStorage - Primary save function (IndexedDB/Tauri FS)
 * @see saveToLocalStorage - Fallback save function
 */
const dispatch = React.useCallback((action: AppAction) => {
  baseDispatch(action);

  // Check if this action requires immediate save
  if (CRITICAL_ACTIONS.has(action.type)) {
    // Save after React flush to prevent stale state
    queueMicrotask(() => {
      requestAnimationFrame(async () => {
        try {
          await saveToStorage();
        } catch (error) {
          console.error('[CRITICAL SAVE] Failed to save, falling back to localStorage:', error);
          await saveToLocalStorage();
        }
      });
    });
  }
}, [saveToStorage, saveToLocalStorage]);
```

**Checklist**:
- [ ] Add comprehensive JSDoc
- [ ] Document timing rationale
- [ ] Document critical actions
- [ ] Commit changes

---

#### Task 1.7: Add JSDoc to Migration/Load Functions (30 min)
**Location**: `src/context/AppContext.tsx:1766, 1946, 2011`

**Before**: No JSDoc

**After**:

```typescript
/**
 * Migrates Legacy Topic Structure to Entity System
 *
 * OLD SYSTEM (pre-v2.0):
 * - Single "topics" array with type field ('company' | 'person' | 'other')
 * - Relationships via topicId on notes/tasks
 *
 * NEW SYSTEM (v2.0+):
 * - Separate arrays: companies[], contacts[], topics[]
 * - Relationships via unified relationships[] array
 *
 * MIGRATION PROCESS:
 * 1. Identify legacy topics (those with 'type' field)
 * 2. Split into appropriate entity arrays based on type
 * 3. Update note relationships (topicId → new entity ID)
 * 4. Preserve all metadata (noteCount, lastUpdated, etc.)
 *
 * IDEMPOTENT:
 * Safe to run multiple times - checks for type field presence.
 * Skips if no legacy topics found.
 *
 * @param state - Raw loaded state (potentially legacy format)
 * @returns Migrated state with separate entity collections
 *
 * @example
 * ```typescript
 * // Before:
 * { topics: [{ id: '1', name: 'Acme Corp', type: 'company', ... }] }
 *
 * // After:
 * {
 *   companies: [{ id: '1', name: 'Acme Corp', ... }],
 *   contacts: [],
 *   topics: []
 * }
 * ```
 */
const migrateTopicsToEntities = (state: any): any => {
  // ... existing implementation
};

/**
 * Loads Application State from New Storage System
 *
 * PRIMARY LOAD PATH for production. Loads from IndexedDB (browser) or
 * Tauri File System (desktop app).
 *
 * LOAD PROCESS:
 * 1. Initialize storage adapter (IndexedDB or Tauri FS)
 * 2. Load all collections in parallel:
 *    - companies, contacts, topics
 *    - notes, tasks, sessions
 *    - settings (AI, learning, preferences, Ned)
 *    - UI state (sidebar, notifications, etc.)
 * 3. Validate and normalize data (ensure arrays, handle nulls)
 * 4. Apply migrations if needed (topic-to-entity, etc.)
 * 5. Dispatch LOAD_STATE to populate reducer
 *
 * ERROR HANDLING:
 * Throws on failure - caller should catch and fall back to localStorage.
 *
 * PERFORMANCE:
 * Parallel loading reduces startup time by ~60% vs sequential loads.
 *
 * @throws Error if storage system is unavailable or corrupted
 * @see loadFromLocalStorage - Fallback for storage failures
 * @see migrateTopicsToEntities - Migration logic
 *
 * @example
 * ```typescript
 * try {
 *   await loadFromStorage();
 *   console.log('Loaded from new storage');
 * } catch (error) {
 *   console.warn('Storage failed, falling back to localStorage');
 *   await loadFromLocalStorage();
 * }
 * ```
 */
async function loadFromStorage() {
  // ... existing implementation
}

/**
 * FALLBACK: Loads Application State from Legacy localStorage
 *
 * Only used when new storage system is unavailable:
 * - Web app in browsers without IndexedDB support
 * - Storage system initialization failure
 * - Development/testing with localStorage backend
 *
 * LOAD PROCESS:
 * 1. Read 'taskerino-v3-state' key from localStorage
 * 2. Parse JSON with defensive error handling
 * 3. Apply data migrations (topic-to-entity, etc.)
 * 4. Clear corrupted data gracefully (prevents app crash)
 *
 * DATA LIMITS:
 * localStorage has 5-10MB quota limit. If sessions exceed this:
 * - Sessions are cleared automatically
 * - User warned via console
 * - App remains functional
 *
 * MIGRATION PATH:
 * When new storage becomes available, data is automatically
 * migrated from localStorage on next save.
 *
 * @see loadFromStorage - Primary load path
 * @see migrateTopicsToEntities - Migration logic
 *
 * @example
 * ```typescript
 * // Typical usage:
 * try {
 *   await loadFromStorage();
 * } catch (error) {
 *   await loadFromLocalStorage(); // This function
 * }
 * ```
 */
async function loadFromLocalStorage() {
  // ... existing implementation
}
```

**Checklist**:
- [ ] Add JSDoc to all 3 functions
- [ ] Document migration logic
- [ ] Document error handling
- [ ] Commit changes

---

### Day 2: types.ts Quick Wins (2.5 hours)

#### Task 2.1: Add Section Comments to Session Interface (30 min)
**Location**: `src/types.ts:1447-1676`

**Result**: 230-line interface divided into 10 logical sections (see Large File Review report for full example)

**Checklist**:
- [ ] Add 10 section headers
- [ ] Group related fields
- [ ] Mark deprecated fields clearly
- [ ] Commit changes

---

#### Task 2.2: Add Relationship Import Comment (5 min)
**Location**: `src/types.ts:1-4`

**Before**:
```typescript
import type { Relationship } from './types/relationships';
```

**After**:
```typescript
// ============================================================================
// UNIFIED RELATIONSHIP SYSTEM (Phase 2.0)
// ============================================================================
//
// Replaces legacy fields (topicId, noteId, sourceSessionId, etc.) with a
// flexible relationship array that can represent any entity-to-entity connection.
//
// Examples:
// - Task → Note: { fromId: taskId, fromType: 'task', toId: noteId, toType: 'note', type: 'TASK_NOTE' }
// - Session → Task: { fromId: sessionId, fromType: 'session', toId: taskId, toType: 'task', type: 'SESSION_TASK' }
//
// Migration: Legacy fields are marked @deprecated and will be removed after
// all entities are migrated to relationshipVersion: 1.
//
// See /src/types/relationships.ts for Relationship interface and helpers.
//
import type { Relationship } from './types/relationships';
```

**Checklist**:
- [ ] Add comprehensive header comment
- [ ] Include examples
- [ ] Reference migration guide
- [ ] Commit changes

---

#### Task 2.3: Add Migration Status Summary (10 min)
**Location**: `src/types.ts` (top of file, after imports)

**Add**:
```typescript
// ============================================================================
// MIGRATION STATUS (as of October 2025)
// ============================================================================
//
// ACTIVE MIGRATIONS:
//
// 1. Unified Relationships (Phase 2.0)
//    Status: In progress, check relationshipVersion field
//    Old: topicId, noteId, sourceSessionId, sourceNoteId, extractedTaskIds, extractedNoteIds
//    New: relationships[] array
//    Search: grep "@deprecated.*topicId\|noteId\|sourceSessionId" src/types.ts
//
// 2. Content-Addressable Storage (Phase 4)
//    Status: Complete for new data, migrating old screenshots
//    Old: SessionScreenshot.path
//    New: SessionScreenshot.attachmentId
//    Search: grep "@deprecated.*path" src/types.ts
//
// 3. Flexible Summaries (Phase 2)
//    Status: Both formats supported
//    Old: SessionSummary (fixed template)
//    New: FlexibleSessionSummary (AI-chosen sections)
//    Check: session.summary?.schemaVersion === '2.0'
//
// DEPRECATED FIELDS COUNT: 10+
// Run: grep -c "@deprecated" src/types.ts
//
// ============================================================================
```

**Checklist**:
- [ ] Add migration summary
- [ ] List all active migrations
- [ ] Add search patterns
- [ ] Commit changes

---

#### Task 2.4: Extract Status Types (20 min)
**Location**: `src/types.ts` (various locations)

**Before**: Inline union types

**After**:
```typescript
// ============================================================================
// STATUS ENUMS (Typed String Literals)
// ============================================================================

/**
 * Session Lifecycle Status
 * - active: Currently recording
 * - paused: Recording paused (can resume)
 * - completed: Ended normally
 * - interrupted: Ended due to crash/error
 */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'interrupted';

/**
 * Screenshot AI Analysis Status
 * - pending: Queued for analysis
 * - analyzing: Currently being analyzed by Claude Vision
 * - complete: Analysis finished successfully
 * - error: Analysis failed (rate limit, API error, etc.)
 */
export type ScreenshotAnalysisStatus = 'pending' | 'analyzing' | 'complete' | 'error';

/**
 * Task Lifecycle Status
 * - todo: Not started
 * - in-progress: Currently being worked on
 * - done: Completed
 * - blocked: Blocked by dependencies or issues
 */
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked';

/**
 * Enrichment Pipeline Status
 * - idle: Not started (default for new sessions)
 * - pending: Queued for enrichment
 * - in-progress: Currently enriching (audio/video/summary)
 * - completed: All enrichment stages completed successfully
 * - failed: Enrichment failed with unrecoverable error
 * - partial: Some stages completed, others failed/skipped
 */
export type EnrichmentStatus = 'idle' | 'pending' | 'in-progress' | 'completed' | 'failed' | 'partial';

/**
 * Individual Enrichment Stage Status
 * - pending: Not started
 * - processing: Currently running
 * - completed: Stage completed successfully
 * - failed: Stage failed with error
 * - skipped: Stage skipped (user preference or no data)
 */
export type EnrichmentStageStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

/**
 * Task Priority Level
 * - low: Nice to have
 * - medium: Should do soon
 * - high: Important, do ASAP
 * - urgent: Critical, blocking work
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// Usage in interfaces:
export interface Session {
  status: SessionStatus; // Instead of inline 'active' | 'paused' | ...
  // ...
}

export interface SessionScreenshot {
  analysisStatus: ScreenshotAnalysisStatus; // Instead of inline union
  // ...
}

export interface Task {
  status: TaskStatus;
  priority: TaskPriority;
  // ...
}
```

**Checklist**:
- [ ] Extract all status types
- [ ] Add JSDoc to each
- [ ] Update interfaces to use named types
- [ ] Verify TypeScript compiles
- [ ] Commit changes

---

#### Task 2.5: Review and Handle AudioMode (15 min)
**Location**: `src/types.ts:1778`

**Current**:
```typescript
export type AudioMode = 'off' | 'transcription' | 'description'; // DEPRECATED: Will be removed
```

**Action**: Search for usage

```bash
grep -r "AudioMode" src/ --include="*.ts" --include="*.tsx"
```

**Decision Tree**:
- If **0 usages found**: Delete type immediately
- If **used**: Add proper @deprecated JSDoc with replacement

**If still used, add**:
```typescript
/**
 * @deprecated AudioMode is deprecated and will be removed in v2.0.
 * Use audioConfig.enabled boolean instead.
 *
 * Migration:
 * - 'off' → audioConfig: undefined or enabled: false
 * - 'transcription' | 'description' → audioConfig: { enabled: true, ... }
 *
 * @see AudioDeviceConfig for replacement
 */
export type AudioMode = 'off' | 'transcription' | 'description';
```

**Checklist**:
- [ ] Search for AudioMode usage
- [ ] Either delete or add @deprecated JSDoc
- [ ] Commit changes

---

#### Task 2.6: Add JSDoc to Critical Types (1 hour)
**Location**: `src/types.ts` (various)

Add JSDoc to:
1. **EnrichmentStatus** (30 min) - Lines 1542-1629
2. **FlexibleSessionSummary** (20 min) - Line 1076
3. **AudioInsights** (20 min) - Line 2056

See Large File Review report for full JSDoc examples.

**Checklist**:
- [ ] Add JSDoc to EnrichmentStatus
- [ ] Add JSDoc to FlexibleSessionSummary
- [ ] Add JSDoc to AudioInsights
- [ ] Include usage examples
- [ ] Commit changes

---

## Phase 2: Medium Wins (Week 2-3)

**Duration**: 14 hours
**Goal**: Reduce complexity, comprehensive documentation

### Week 2: AppContext Refactoring (6.5 hours)

#### Task 3.1: Extract BATCH_ADD_NOTES Entity Tracking (1 hour)
**Location**: `src/context/AppContext.tsx:718-813`

**Problem**: 96 lines of complex nested loops for entity count tracking

**Solution**: Extract to helper function

**Before**:
```typescript
case 'BATCH_ADD_NOTES': {
  // 96 lines of entity count tracking inline
  // Three Maps for tracking
  // Nested loops
  // Complex timestamp logic
}
```

**After**:
```typescript
/**
 * Updates entity counts and timestamps when notes are batch-added
 *
 * Tracks which companies/contacts/topics are mentioned in notes and updates:
 * - noteCount: Increment for each new note mentioning this entity
 * - lastUpdated: Set to most recent note timestamp
 *
 * Handles both new relationship system (relationships[]) and legacy fields (topicId).
 *
 * @param notes - Notes being added
 * @param companies - Current companies array
 * @param contacts - Current contacts array
 * @param topics - Current topics array
 * @returns Updated entity arrays
 */
function updateEntityCountsForNotes(
  notes: Note[],
  companies: Company[],
  contacts: Contact[],
  topics: Topic[]
): {
  companies: Company[];
  contacts: Contact[];
  topics: Topic[];
} {
  // Track which entities need updates (ID → { count, lastUpdated })
  const companyUpdates = new Map<string, { count: number; timestamp: string }>();
  const contactUpdates = new Map<string, { count: number; timestamp: string }>();
  const topicUpdates = new Map<string, { count: number; timestamp: string }>();

  // Scan notes for entity mentions
  notes.forEach(note => {
    const timestamp = note.createdAt;

    // Handle new relationship system
    if (note.relationships) {
      note.relationships.forEach(rel => {
        if (rel.toType === 'company') {
          const existing = companyUpdates.get(rel.toId);
          companyUpdates.set(rel.toId, {
            count: (existing?.count || 0) + 1,
            timestamp: !existing || timestamp > existing.timestamp ? timestamp : existing.timestamp,
          });
        } else if (rel.toType === 'contact') {
          const existing = contactUpdates.get(rel.toId);
          contactUpdates.set(rel.toId, {
            count: (existing?.count || 0) + 1,
            timestamp: !existing || timestamp > existing.timestamp ? timestamp : existing.timestamp,
          });
        } else if (rel.toType === 'topic') {
          const existing = topicUpdates.get(rel.toId);
          topicUpdates.set(rel.toId, {
            count: (existing?.count || 0) + 1,
            timestamp: !existing || timestamp > existing.timestamp ? timestamp : existing.timestamp,
          });
        }
      });
    }

    // Handle legacy topicId field
    if (note.topicId) {
      const existing = topicUpdates.get(note.topicId);
      topicUpdates.set(note.topicId, {
        count: (existing?.count || 0) + 1,
        timestamp: !existing || timestamp > existing.timestamp ? timestamp : existing.timestamp,
      });
    }
  });

  // Apply updates to entity arrays
  return {
    companies: companies.map(c => {
      const update = companyUpdates.get(c.id);
      return update
        ? { ...c, noteCount: c.noteCount + update.count, lastUpdated: update.timestamp }
        : c;
    }),
    contacts: contacts.map(c => {
      const update = contactUpdates.get(c.id);
      return update
        ? { ...c, noteCount: c.noteCount + update.count, lastUpdated: update.timestamp }
        : c;
    }),
    topics: topics.map(t => {
      const update = topicUpdates.get(t.id);
      return update
        ? { ...t, noteCount: t.noteCount + update.count, lastUpdated: update.timestamp }
        : t;
    }),
  };
}

// Usage in reducer:
case 'BATCH_ADD_NOTES': {
  const { companies, contacts, topics } = updateEntityCountsForNotes(
    action.payload,
    state.companies,
    state.contacts,
    state.topics
  );

  return {
    ...state,
    notes: [...state.notes, ...action.payload],
    companies,
    contacts,
    topics,
  };
}
```

**Checklist**:
- [ ] Extract helper function
- [ ] Add comprehensive JSDoc
- [ ] Test batch note addition
- [ ] Verify entity counts update correctly
- [ ] Commit changes

---

#### Task 3.2: Extract CREATE_MANUAL_NOTE Entity Logic (1.5 hours)
**Location**: `src/context/AppContext.tsx:927-1022`

**Problem**: 96 lines of entity creation and linking logic

**Solution**: Extract entity creation to helper

**Before**:
```typescript
case 'CREATE_MANUAL_NOTE': {
  // 96 lines of:
  // - Entity type detection
  // - Entity creation if needed
  // - Fallback to "Uncategorized"
  // - Entity count updates
  // - State building in stages
}
```

**After**:
```typescript
/**
 * Creates or retrieves an entity for manual note creation
 *
 * Handles three entity types:
 * - Company: name starting with capital letter, business context
 * - Contact/Person: name with typical person name patterns
 * - Other/Topic: Everything else
 *
 * If entityName provided:
 * 1. Check if entity exists (fuzzy match by name)
 * 2. If exists, return existing entity
 * 3. If not, create new entity of appropriate type
 *
 * If no entityName:
 * 1. Look for "Uncategorized" topic
 * 2. Create if doesn't exist
 * 3. Return Uncategorized topic
 *
 * @param entityName - Optional entity name
 * @param entityType - Entity type hint ('company' | 'person' | 'other')
 * @param state - Current AppState
 * @returns { entity, updatedCompanies, updatedContacts, updatedTopics }
 */
function createOrGetEntity(
  entityName: string | undefined,
  entityType: 'company' | 'person' | 'other' | undefined,
  state: AppState
): {
  entity: Company | Contact | Topic;
  updatedCompanies: Company[];
  updatedContacts: Contact[];
  updatedTopics: Topic[];
} {
  // No entity name? Use "Uncategorized" topic
  if (!entityName) {
    let uncategorized = state.topics.find(t => t.name === 'Uncategorized');

    if (!uncategorized) {
      uncategorized = {
        id: generateId(),
        name: 'Uncategorized',
        noteCount: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      return {
        entity: uncategorized,
        updatedCompanies: state.companies,
        updatedContacts: state.contacts,
        updatedTopics: [...state.topics, uncategorized],
      };
    }

    return {
      entity: uncategorized,
      updatedCompanies: state.companies,
      updatedContacts: state.contacts,
      updatedTopics: state.topics,
    };
  }

  // Entity name provided - check if exists or create new
  if (entityType === 'company') {
    // Check existing companies
    let company = state.companies.find(c =>
      c.name.toLowerCase() === entityName.toLowerCase()
    );

    if (!company) {
      company = {
        id: generateId(),
        name: entityName,
        noteCount: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      return {
        entity: company,
        updatedCompanies: [...state.companies, company],
        updatedContacts: state.contacts,
        updatedTopics: state.topics,
      };
    }

    return {
      entity: company,
      updatedCompanies: state.companies,
      updatedContacts: state.contacts,
      updatedTopics: state.topics,
    };
  } else if (entityType === 'person') {
    // Check existing contacts
    let contact = state.contacts.find(c =>
      c.name.toLowerCase() === entityName.toLowerCase()
    );

    if (!contact) {
      contact = {
        id: generateId(),
        name: entityName,
        noteCount: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      return {
        entity: contact,
        updatedCompanies: state.companies,
        updatedContacts: [...state.contacts, contact],
        updatedTopics: state.topics,
      };
    }

    return {
      entity: contact,
      updatedCompanies: state.companies,
      updatedContacts: state.contacts,
      updatedTopics: state.topics,
    };
  } else {
    // Topic (other)
    let topic = state.topics.find(t =>
      t.name.toLowerCase() === entityName.toLowerCase()
    );

    if (!topic) {
      topic = {
        id: generateId(),
        name: entityName,
        noteCount: 0,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };

      return {
        entity: topic,
        updatedCompanies: state.companies,
        updatedContacts: state.contacts,
        updatedTopics: [...state.topics, topic],
      };
    }

    return {
      entity: topic,
      updatedCompanies: state.companies,
      updatedContacts: state.contacts,
      updatedTopics: state.topics,
    };
  }
}

// Usage in reducer:
case 'CREATE_MANUAL_NOTE': {
  const { content, entityName, entityType } = action.payload;

  // Get or create entity
  const { entity, updatedCompanies, updatedContacts, updatedTopics } = createOrGetEntity(
    entityName,
    entityType,
    state
  );

  // Create note with relationship
  const note: Note = {
    id: generateId(),
    content,
    summary: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: [],
    relationships: [{
      fromId: generateId(),
      fromType: 'note',
      toId: entity.id,
      toType: entity.hasOwnProperty('website') ? 'company' :
              entity.hasOwnProperty('email') ? 'contact' : 'topic',
      type: 'NOTE_ENTITY',
    }],
  };

  // Update entity count
  const finalEntity = { ...entity, noteCount: entity.noteCount + 1, lastUpdated: note.createdAt };
  const finalCompanies = entity.hasOwnProperty('website')
    ? updateEntityInList(updatedCompanies, entity.id, finalEntity as Company)
    : updatedCompanies;
  const finalContacts = entity.hasOwnProperty('email')
    ? updateEntityInList(updatedContacts, entity.id, finalEntity as Contact)
    : updatedContacts;
  const finalTopics = !entity.hasOwnProperty('website') && !entity.hasOwnProperty('email')
    ? updateEntityInList(updatedTopics, entity.id, finalEntity as Topic)
    : updatedTopics;

  return {
    ...state,
    notes: [...state.notes, note],
    companies: finalCompanies,
    contacts: finalContacts,
    topics: finalTopics,
  };
}
```

**Checklist**:
- [ ] Extract createOrGetEntity helper
- [ ] Add comprehensive JSDoc
- [ ] Test manual note creation
- [ ] Test entity creation/retrieval
- [ ] Test Uncategorized fallback
- [ ] Commit changes

---

#### Task 3.3: Add Comprehensive JSDoc to Functions (3 hours)

Add JSDoc to all remaining public functions (20+):

**Functions needing JSDoc**:
- Data operations: addNote, updateNote, deleteNote, addTask, updateTask, etc.
- UI operations: setActiveTab, setZone, toggleReferencePanel, etc.
- Settings: updateAISettings, updateLearningSettings, etc.
- Ned: addNedMessage, clearNedConversation, etc.
- Bulk operations: toggleBulkSelectionMode, bulkUpdateTasks, etc.

**Template**:
```typescript
/**
 * [Function name and brief description]
 *
 * [Detailed explanation of what it does]
 *
 * [Any important side effects]
 *
 * [Usage examples if complex]
 *
 * @param [paramName] - [description]
 * @returns [description]
 * @see [related functions/types]
 *
 * @example
 * ```typescript
 * [code example]
 * ```
 */
```

**Checklist**:
- [ ] Document all 20+ functions
- [ ] Include usage examples for complex ones
- [ ] Document side effects
- [ ] Commit changes

---

#### Task 3.4: Validate Zone Refactor Status (1 hour)
**Location**: `src/context/AppContext.tsx:2029-2032`

**Current Code**:
```typescript
// Validate zone if present
if (loadedState.ui?.zone) {
  const validZones = ['capture', 'tasks', 'library', 'sessions', 'assistant', 'profile'];
  if (!validZones.includes(loadedState.ui.zone)) {
    loadedState.ui.zone = 'capture'; // Reset to default
  }
}
```

**Task**: Verify if `zone` is still used after navigation refactor

```bash
# Search for zone usage
grep -r "state.ui.zone\|state.zone\|ui.zone" src/ --include="*.tsx" --include="*.ts"
```

**Decision Tree**:
- If **heavily used**: Add JSDoc explaining zone system
- If **partially used**: Document as transitional
- If **unused**: Remove validation, add deprecation notice

**Checklist**:
- [ ] Search for zone usage
- [ ] Document or deprecate accordingly
- [ ] Commit changes

---

### Week 3: types.ts Documentation (7.5 hours)

#### Task 4.1: Add JSDoc to All Summary Section Types (3 hours)
**Location**: `src/types.ts:1146-1445`

15 section types need JSDoc:
1. AchievementsSection
2. BlockersSection
3. InsightsSection
4. BreakthroughMomentsSection
5. ProblemSolvingJourneySection
6. TechnicalDiscoveriesSection
7. LearningHighlightsSection
8. FlowStateSection
9. FocusAreasSection
10. EmotionalJourneySection
11. CollaborationWinsSection
12. CreativeSolutionsSection
13. ContextSwitchesSection
14. ProblemSolutionPairsSection
15. NextStepsSection

**Template**:
```typescript
/**
 * [Section Name] - [Purpose]
 *
 * Used when AI detects [condition]. Common in [session types].
 *
 * FIELDS:
 * - [field]: [description]
 *
 * RENDERING:
 * - emphasis: Controls visual prominence (low/medium/high)
 * - position: Order in summary (lower = earlier)
 *
 * @see FlexibleSessionSummary for section system overview
 * @see getSectionByType helper for retrieving sections
 *
 * @example
 * ```typescript
 * {
 *   type: '[section-type]',
 *   title: '[example title]',
 *   emphasis: 'high',
 *   position: 1,
 *   data: {
 *     // example data structure
 *   }
 * }
 * ```
 */
```

**Checklist**:
- [ ] Add JSDoc to all 15 section types
- [ ] Include usage examples
- [ ] Document when each is used
- [ ] Commit changes

---

#### Task 4.2: Add JSDoc to Session-Related Types (2 hours)
**Location**: `src/types.ts` (various)

Types needing JSDoc:
1. SessionScreenshot
2. SessionAudioSegment
3. SessionVideo
4. VideoChapter
5. SessionContextItem
6. AudioDeviceConfig
7. VideoRecordingConfig

**See Large File Review report for full examples**

**Checklist**:
- [ ] Add JSDoc to all 7 types
- [ ] Document storage strategy
- [ ] Document AI processing
- [ ] Include examples
- [ ] Commit changes

---

#### Task 4.3: Add JSDoc to Enrichment Types (1.5 hours)
**Location**: `src/types.ts` (various)

Types needing JSDoc:
1. EnrichmentConfig
2. EnrichmentLock
3. AudioKeyMoment
4. EmotionalState
5. WorkPattern
6. EnvironmentalContext

**Checklist**:
- [ ] Add JSDoc to all 6 types
- [ ] Document enrichment pipeline
- [ ] Document cost tracking
- [ ] Include examples
- [ ] Commit changes

---

#### Task 4.4: Consolidate Deprecated Field Documentation (1 hour)
**Location**: `src/types.ts` (various)

**Action**: Create comprehensive guide for all deprecated fields

**Add to file header** (after migration status summary):

```typescript
// ============================================================================
// DEPRECATED FIELDS REFERENCE
// ============================================================================
//
// All deprecated fields are marked with @deprecated JSDoc tags.
// This section provides a centralized guide for migration.
//
// SEARCH PATTERN: grep "@deprecated" src/types.ts
//
// DEPRECATED RELATIONSHIP FIELDS:
//
// 1. Session.extractedTaskIds: string[]
//    Deprecated: October 2025
//    Replacement: relationships[] with type='SESSION_TASK'
//    Migration: Run relationship migration script
//    Remove: v2.0 (when relationshipVersion migration complete)
//
// 2. Session.extractedNoteIds: string[]
//    [Same as above, type='SESSION_NOTE']
//
// 3. Note.topicId?: string
//    Deprecated: October 2025
//    Replacement: relationships[] with toType='topic'
//    Usage: 175 occurrences across 31 files
//    Remove: After full migration (2-3 months)
//
// 4. Note.sourceSessionId?: string
//    [Similar to above, type='NOTE_SESSION']
//
// 5. Task.noteId?: string
//    Deprecated: October 2025
//    Replacement: relationships[] with toType='note'
//    Usage: Check TasksContext for active usage
//    Remove: After migration
//
// 6. Task.sourceNoteId?: string
//    [Similar to above]
//
// 7. Task.sourceSessionId?: string
//    [Similar to above, toType='session']
//
// DEPRECATED STORAGE FIELDS:
//
// 8. SessionScreenshot.path?: string
//    Deprecated: October 2025 (Phase 4 ContentAddressableStorage)
//    Replacement: attachmentId with CAS lookup
//    Usage: 4 occurrences as backward compatibility fallback
//    Migration: Screenshot path migration script (runs on startup)
//    Remove: v1.0 after migration completes
//
// DEPRECATED DATA FIELDS:
//
// 9. Session.audioKeyMoments?: AudioKeyMoment[]
//    Deprecated: October 2025
//    Replacement: audioInsights.keyMoments
//    Reason: Consolidated into AudioInsights structure
//    Remove: v1.0
//
// DEPRECATED TYPES:
//
// 10. AudioMode: 'off' | 'transcription' | 'description'
//     Deprecated: October 2025
//     Replacement: audioConfig.enabled boolean
//     Status: Check if still used (grep "AudioMode" src/)
//     Remove: Immediately if unused, otherwise v1.0
//
// ============================================================================
```

**Checklist**:
- [ ] Add comprehensive deprecated fields guide
- [ ] Document each field's migration path
- [ ] Add removal timeline
- [ ] Commit changes

---

## Phase 3: Testing & Validation

### Testing After Each Phase

**After Phase 1 (Quick Wins)**:
```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Run tests
npm test

# 3. Manual smoke testing
npm run dev
# - Test entity updates (companies, contacts, topics)
# - Test note creation
# - Test pin note functionality
# - Test search history
```

**After Phase 2 (Medium Wins)**:
```bash
# 1. TypeScript compilation
npx tsc --noEmit

# 2. Run tests
npm test

# 3. Manual testing
npm run dev
# - Test batch note addition
# - Test manual note creation with entities
# - Verify entity counts update
# - Test Uncategorized fallback
```

### Success Criteria

**Phase 1 Complete When**:
- [ ] All section comments added (3 files)
- [ ] All helpers extracted (2 helpers)
- [ ] All magic numbers extracted (2 constants)
- [ ] All quick JSDoc added (20+ functions/types)
- [ ] TypeScript compiles with 0 errors
- [ ] All tests pass
- [ ] Manual smoke test passes

**Phase 2 Complete When**:
- [ ] All complexity refactored (2 functions)
- [ ] All comprehensive JSDoc added (40+ functions/types)
- [ ] Zone refactor validated
- [ ] TypeScript compiles with 0 errors
- [ ] All tests pass
- [ ] Manual testing passes

**Final Success Criteria**:
- [ ] AppContext.tsx has section comments and helpers
- [ ] types.ts has comprehensive JSDoc
- [ ] All deprecated fields documented
- [ ] 0 TypeScript errors
- [ ] All 210+ tests passing
- [ ] Code coverage maintained or improved
- [ ] No regressions in functionality

---

## Timeline Summary

### Week 1: Quick Wins
| Day | Tasks | Hours |
|-----|-------|-------|
| Day 1 | AppContext quick wins (Tasks 1.1-1.7) | 3h |
| Day 2 | types.ts quick wins (Tasks 2.1-2.6) | 2.5h |
| **Total** | **Phase 1** | **5.5h** |

### Week 2: AppContext Refactoring
| Day | Tasks | Hours |
|-----|-------|-------|
| Day 3 | Extract entity tracking & creation (Tasks 3.1-3.2) | 2.5h |
| Day 4-5 | Add comprehensive JSDoc (Task 3.3) | 3h |
| Day 5 | Validate zone refactor (Task 3.4) | 1h |
| **Total** | **AppContext Phase 2** | **6.5h** |

### Week 3: types.ts Documentation
| Day | Tasks | Hours |
|-----|-------|-------|
| Day 6-7 | Add JSDoc to summary sections (Task 4.1) | 3h |
| Day 7-8 | Add JSDoc to session types (Task 4.2) | 2h |
| Day 8 | Add JSDoc to enrichment types (Task 4.3) | 1.5h |
| Day 8 | Document deprecated fields (Task 4.4) | 1h |
| **Total** | **types.ts Phase 2** | **7.5h** |

### Grand Total
| Phase | Duration | Hours |
|-------|----------|-------|
| Phase 1: Quick Wins | Week 1 | 5.5h |
| Phase 2: Refactoring | Week 2-3 | 14h |
| **TOTAL** | **2-3 weeks** | **19.5h** |

---

## Commit Strategy

**Commit after each task** to allow easy rollback:

```bash
# Phase 1
git commit -m "docs(AppContext): add section comments to reducer"
git commit -m "refactor(AppContext): extract updateEntityInList helper"
git commit -m "refactor(AppContext): extract UI limits constants"
git commit -m "refactor(AppContext): simplify PIN_NOTE logic"
git commit -m "docs(AppContext): add JSDoc to all default objects"
git commit -m "docs(AppContext): add JSDoc to dispatch wrapper"
git commit -m "docs(AppContext): add JSDoc to migration/load functions"

git commit -m "docs(types): add section comments to Session interface"
git commit -m "docs(types): add relationship system overview"
git commit -m "docs(types): add migration status summary"
git commit -m "refactor(types): extract status enums"
git commit -m "refactor(types): handle deprecated AudioMode type"
git commit -m "docs(types): add JSDoc to critical types"

# Phase 2
git commit -m "refactor(AppContext): extract updateEntityCountsForNotes helper"
git commit -m "refactor(AppContext): extract createOrGetEntity helper"
git commit -m "docs(AppContext): add JSDoc to all public functions"
git commit -m "docs(AppContext): validate zone refactor status"

git commit -m "docs(types): add JSDoc to all summary section types"
git commit -m "docs(types): add JSDoc to session-related types"
git commit -m "docs(types): add JSDoc to enrichment types"
git commit -m "docs(types): consolidate deprecated field documentation"
```

---

## Questions Before Starting

1. **Timeline**: Can you dedicate 5-7 hours per week?
2. **Priority**: Start with AppContext or types.ts first?
3. **Scope**: Any specific sections to prioritize or skip?
4. **Testing**: Want automated tests added, or just manual testing?

---

**Ready to begin when you are!**

Let me know if you want to:
- Start with Phase 1 immediately
- Adjust any tasks
- Add/remove scope
- Clarify anything
