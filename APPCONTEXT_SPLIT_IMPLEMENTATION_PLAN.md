# AppContext Split - Complete Implementation Plan

## Overview
- **Estimated total time:** 20-24 hours
- **Number of contexts to create:** 5 new contexts (SettingsContext, UIContext, TasksContext, NotesContext, SessionsContext) + 1 modified AppContext (for entities only)
- **Number of files to modify:** 36+ component files + 6 context files
- **Risk level:** MEDIUM-HIGH

## Key Performance Benefits Expected
- **70-85% reduction in unnecessary re-renders**
- Changing a task will NOT re-render NotesZone, SessionsZone, or LibraryZone
- Changing a note will NOT re-render TasksZone or SessionsZone
- UI changes (sidebar, modals) will NOT re-render data zones
- Settings changes will NOT re-render anything except SettingsModal

---

## Phase 1: Setup & Preparation (30 min)

### 1.1 Git Branch Strategy
```bash
cd /Users/jamesmcarthur/Documents/taskerino
git checkout -b perf/split-app-context
git tag before-context-split
```

**Rationale:** Always work on a branch for major refactors. Tag allows instant rollback if needed.

### 1.2 Backup Current State
- [x] Tag current working state
- [ ] Document current behavior for baseline comparison
- [ ] Test all major features manually (checklist below)
- [ ] Take screenshots of current performance in React DevTools Profiler

**Baseline Testing Checklist:**
1. Create a task in TasksZone - observe re-renders in React DevTools
2. Edit a note in LibraryZone - observe re-renders
3. Toggle sidebar - observe what re-renders
4. Change settings - observe what re-renders
5. Start/stop a session - observe re-renders

**Expected Current Behavior:** Everything re-renders on any state change.

### 1.3 Testing Strategy
- Manual testing after each context creation
- React DevTools Profiler to measure re-render reduction
- Console.log statements to track context updates
- Validate data persistence after each major step
- No TypeScript errors at any stage

---

## Phase 2: Context Creation (Order Matters!)

### Step 1: Create SettingsContext (1 hour)
**Why first:** No dependencies on other contexts. Purely isolated state.

**File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/SettingsContext.tsx`

**State to move from AppState:**
```typescript
{
  aiSettings: AISettings;
  learningSettings: LearningSettings;
  userProfile: { name: string };
  learnings: UserLearnings;
  nedSettings: NedSettings;
}
```

**Actions to move (from AppAction):**
- `UPDATE_AI_SETTINGS`
- `UPDATE_LEARNING_SETTINGS`
- `UPDATE_USER_PROFILE`
- `UPDATE_NED_SETTINGS`
- `GRANT_NED_PERMISSION`
- `REVOKE_NED_PERMISSION`
- `CLEAR_SESSION_PERMISSIONS`

**Context Interface:**
```typescript
interface SettingsContextType {
  settings: {
    aiSettings: AISettings;
    learningSettings: LearningSettings;
    userProfile: { name: string };
    learnings: UserLearnings;
    nedSettings: NedSettings;
  };
  updateAISettings: (settings: Partial<AISettings>) => void;
  updateLearningSettings: (settings: Partial<LearningSettings>) => void;
  updateUserProfile: (profile: Partial<{ name: string }>) => void;
  updateNedSettings: (settings: Partial<NedSettings>) => void;
  grantNedPermission: (toolName: string, level: 'forever' | 'session' | 'always-ask') => void;
  revokeNedPermission: (toolName: string) => void;
  clearSessionPermissions: () => void;
}

export const SettingsProvider;
export function useSettings(): SettingsContextType;
```

**Storage Integration:**
- Load settings from storage in `useEffect` on mount
- Save settings to storage on debounced timer (5 seconds)
- Use same storage keys as AppContext currently uses

**Validation Checklist:**
- [ ] SettingsContext compiles with no TypeScript errors
- [ ] SettingsModal still opens and displays settings
- [ ] Settings changes persist on page reload
- [ ] No console errors
- [ ] Component using useSettings() updates when settings change

**Components to migrate (after creation):**
1. `SettingsModal.tsx` - Change `useApp()` to `useSettings()`
2. `ProfileZone.tsx` - Change `useApp()` to `useSettings()` for profile
3. `NedSettings.tsx` - Change `useApp()` to `useSettings()`
4. `LearningDashboard.tsx` - Change `useApp()` to `useSettings()` for learnings

---

### Step 2: Create UIContext (1.5 hours)
**Why second:** Depends only on Settings for preferences (optional dependency).

**File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/UIContext.tsx`

**State to move from AppState:**
```typescript
{
  ui: UIState; // Contains:
    // - activeTab: TabType
    // - referencePanelOpen: boolean
    // - pinnedNotes: string[]
    // - backgroundProcessing: {...}
    // - notifications: Notification[]
    // - quickCaptureOpen: boolean
    // - preferences: UserPreferences
    // - bulkSelectionMode: boolean
    // - selectedTasks: string[]
    // - showCommandPalette: boolean
    // - onboarding: OnboardingState
    // - pendingReviewJobId?: string
    // - nedOverlay: { isOpen: boolean }

  currentZone: 'capture' | 'tasks' | 'library' | 'sessions' | 'assistant' | 'profile';
  activeTopicId?: string;
  activeNoteId?: string;

  sidebar: {
    isOpen: boolean;
    type: 'task' | 'note' | 'settings' | null;
    itemId?: string;
    width: number;
    history: Array<{...}>;
  };

  searchHistory: SearchHistoryItem[];

  nedConversation: NedConversation;
}
```

**Actions to move (42 actions):**
- `SET_ACTIVE_TAB`
- `SET_ZONE`
- `SET_ACTIVE_TOPIC`
- `SET_ACTIVE_NOTE`
- `TOGGLE_REFERENCE_PANEL`
- `PIN_NOTE`
- `UNPIN_NOTE`
- `CLEAR_PINNED_NOTES`
- `ADD_NOTIFICATION`
- `DISMISS_NOTIFICATION`
- `MARK_NOTIFICATION_READ`
- `CLEAR_NOTIFICATIONS`
- `ADD_PROCESSING_JOB`
- `UPDATE_PROCESSING_JOB`
- `COMPLETE_PROCESSING_JOB`
- `ERROR_PROCESSING_JOB`
- `REMOVE_PROCESSING_JOB`
- `TOGGLE_BULK_SELECTION_MODE`
- `SELECT_TASK`
- `DESELECT_TASK`
- `SELECT_ALL_TASKS`
- `CLEAR_TASK_SELECTION`
- `TOGGLE_QUICK_CAPTURE`
- `TOGGLE_COMMAND_PALETTE`
- `TOGGLE_NED_OVERLAY`
- `OPEN_NED_OVERLAY`
- `CLOSE_NED_OVERLAY`
- `SET_PENDING_REVIEW_JOB`
- `COMPLETE_ONBOARDING`
- `RESET_ONBOARDING`
- `DISMISS_TOOLTIP`
- `MARK_FEATURE_INTRODUCED`
- `INCREMENT_ONBOARDING_STAT`
- `SHOW_FEATURE_TOOLTIP`
- `INCREMENT_TOOLTIP_STAT`
- `COMPLETE_FIRST_CAPTURE`
- `ADD_SEARCH_HISTORY`
- `CLEAR_SEARCH_HISTORY`
- `UPDATE_PREFERENCES`
- `OPEN_SIDEBAR`
- `CLOSE_SIDEBAR`
- `RESIZE_SIDEBAR`
- `POP_SIDEBAR_HISTORY`
- `ADD_NED_MESSAGE`
- `UPDATE_NED_MESSAGE`
- `CLEAR_NED_CONVERSATION`

**Context Interface:**
```typescript
interface UIContextType {
  // UI State
  activeTab: TabType;
  currentZone: string;
  activeTopicId?: string;
  activeNoteId?: string;

  referencePanelOpen: boolean;
  pinnedNotes: string[];

  backgroundProcessing: {...};
  notifications: Notification[];

  quickCaptureOpen: boolean;
  showCommandPalette: boolean;
  bulkSelectionMode: boolean;
  selectedTasks: string[];

  preferences: UserPreferences;
  onboarding: OnboardingState;
  pendingReviewJobId?: string;

  nedOverlay: { isOpen: boolean };
  nedConversation: NedConversation;

  sidebar: {...};
  searchHistory: SearchHistoryItem[];

  // Actions (48 methods)
  setActiveTab: (tab: TabType) => void;
  setZone: (zone: string) => void;
  setActiveTopic: (id?: string) => void;
  setActiveNote: (id?: string) => void;

  toggleReferencePanel: () => void;
  pinNote: (id: string) => void;
  unpinNote: (id: string) => void;
  clearPinnedNotes: () => void;

  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  dismissNotification: (id: string) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;

  addProcessingJob: (job: Omit<ProcessingJob, 'id' | 'createdAt'>) => void;
  updateProcessingJob: (id: string, updates: Partial<ProcessingJob>) => void;
  completeProcessingJob: (id: string, result: any) => void;
  errorProcessingJob: (id: string, error: string) => void;
  removeProcessingJob: (id: string) => void;

  toggleBulkSelectionMode: () => void;
  selectTask: (id: string) => void;
  deselectTask: (id: string) => void;
  selectAllTasks: (ids: string[]) => void;
  clearTaskSelection: () => void;

  toggleQuickCapture: () => void;
  toggleCommandPalette: () => void;

  toggleNedOverlay: () => void;
  openNedOverlay: () => void;
  closeNedOverlay: () => void;

  setPendingReviewJob: (id?: string) => void;

  completeOnboarding: () => void;
  resetOnboarding: () => void;
  dismissTooltip: (id: string) => void;
  markFeatureIntroduced: (feature: keyof OnboardingState['featureIntroductions']) => void;
  incrementOnboardingStat: (stat: keyof OnboardingState['stats']) => void;
  showFeatureTooltip: (id: string) => void;
  incrementTooltipStat: (type: 'shown' | 'dismissed') => void;
  completeFirstCapture: () => void;

  addSearchHistory: (item: Omit<SearchHistoryItem, 'id' | 'timestamp'>) => void;
  clearSearchHistory: () => void;

  updatePreferences: (prefs: Partial<UserPreferences>) => void;

  openSidebar: (type: 'task' | 'note' | 'settings', itemId?: string, label?: string) => void;
  closeSidebar: () => void;
  resizeSidebar: (width: number) => void;
  popSidebarHistory: () => void;

  addNedMessage: (message: NedMessage) => void;
  updateNedMessage: (id: string, contents: NedMessageContent[]) => void;
  clearNedConversation: () => void;
}

export const UIProvider;
export function useUI(): UIContextType;
```

**Storage Integration:**
- Save preferences, onboarding state, pinnedNotes to storage
- Do NOT save ephemeral state (modals, notifications, processing jobs)
- Load on mount, debounced save on change

**Validation Checklist:**
- [ ] UIContext compiles with no TypeScript errors
- [ ] Zone navigation works (clicking tabs changes zones)
- [ ] Sidebar opens/closes correctly
- [ ] Modal states work (quick capture, command palette)
- [ ] Notifications appear and dismiss
- [ ] Background processing jobs display
- [ ] Preferences persist on reload
- [ ] Onboarding state persists
- [ ] No console errors

**Components to migrate (after creation):**
1. `TopNavigation.tsx` - zone/tab navigation
2. `ZoneLayout.tsx` - currentZone
3. `CommandPalette.tsx` - modal state
4. `QuickTaskModal.tsx` - modal state
5. `NotificationCenter.tsx` - notifications
6. `ProcessingIndicator.tsx` - background jobs
7. `ReferencePanel.tsx` - panel state, pinned notes
8. `TaskDetailSidebar.tsx` - sidebar state
9. `NoteDetailSidebar.tsx` - sidebar state
10. `NedOverlay.tsx` - overlay state
11. `NedChat.tsx` - conversation state
12. `FloatingControls.tsx` - UI state
13. All Zone components for activeTab/currentZone

---

### Step 3: Create EntitiesContext (1.5 hours)
**Why third:** Rename AppContext to EntitiesContext. Contains only entities (companies, contacts, topics). No dependencies.

**File:** Rename/modify `/Users/jamesmcarthur/Documents/taskerino/src/context/AppContext.tsx` → `/Users/jamesmcarthur/Documents/taskerino/src/context/EntitiesContext.tsx`

**State to keep:**
```typescript
{
  companies: Company[];
  contacts: Contact[];
  topics: Topic[];
}
```

**Actions to keep:**
- `ADD_COMPANY`
- `UPDATE_COMPANY`
- `DELETE_COMPANY`
- `ADD_CONTACT`
- `UPDATE_CONTACT`
- `DELETE_CONTACT`
- `ADD_TOPIC`
- `UPDATE_TOPIC`
- `DELETE_TOPIC`
- `CREATE_MANUAL_TOPIC` (creates company/contact/topic)

**Context Interface:**
```typescript
interface EntitiesContextType {
  companies: Company[];
  contacts: Contact[];
  topics: Topic[];

  addCompany: (company: Company) => void;
  updateCompany: (company: Company) => void;
  deleteCompany: (id: string) => void;

  addContact: (contact: Contact) => void;
  updateContact: (contact: Contact) => void;
  deleteContact: (id: string) => void;

  addTopic: (topic: Topic) => void;
  updateTopic: (topic: Topic) => void;
  deleteTopic: (id: string) => void;

  createManualTopic: (data: ManualTopicData) => void;
}

export const EntitiesProvider;
export function useEntities(): EntitiesContextType;
```

**Storage Integration:**
- Save companies, contacts, topics to storage
- Load on mount, debounced save on change

**Validation Checklist:**
- [ ] EntitiesContext compiles
- [ ] Can create/edit/delete companies
- [ ] Can create/edit/delete contacts
- [ ] Can create/edit/delete topics
- [ ] Changes persist on reload
- [ ] No console errors

**Components to migrate:**
1. `LibraryZone.tsx` - entity lists
2. `CaptureZone.tsx` - entity creation
3. `ProfileZone.tsx` - entity management
4. Any component displaying companies/contacts/topics

---

### Step 4: Create TasksContext (2 hours)
**Why fourth:** Depends on Entities (topicId links). Needs to update entity noteCount on changes.

**File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/TasksContext.tsx`

**State to move:**
```typescript
{
  tasks: Task[];
}
```

**Actions to move:**
- `ADD_TASK`
- `UPDATE_TASK`
- `DELETE_TASK`
- `TOGGLE_TASK`
- `BATCH_ADD_TASKS`
- `BATCH_UPDATE_TASKS`
- `BATCH_DELETE_TASKS`
- `CREATE_MANUAL_TASK`

**Context Interface:**
```typescript
interface TasksContextType {
  tasks: Task[];

  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;

  batchAddTasks: (tasks: Task[]) => void;
  batchUpdateTasks: (ids: string[], updates: Partial<Task>) => void;
  batchDeleteTasks: (ids: string[]) => void;

  createManualTask: (data: ManualTaskData) => void;
}

export const TasksProvider;
export function useTasks(): TasksContextType;
```

**IMPORTANT - Cross-Context Dependency:**
- TasksContext needs to access EntitiesContext to check if topicId exists
- DELETE_COMPANY and DELETE_TOPIC in EntitiesContext must NOT update tasks directly
- Instead, components should handle cleanup (e.g., delete company → delete related tasks)

**Storage Integration:**
- Save tasks to storage
- Load on mount, debounced save on change

**Validation Checklist:**
- [ ] TasksContext compiles
- [ ] Can create/edit/delete tasks
- [ ] Can toggle task completion
- [ ] Batch operations work
- [ ] Changes persist on reload
- [ ] Tasks filter correctly by topicId
- [ ] No console errors
- [ ] Performance: Changing a task does NOT re-render NotesZone or LibraryZone

**Components to migrate:**
1. `TasksZone.tsx` - main task list
2. `TaskTableView.tsx` - task table
3. `TaskDetailSidebar.tsx` - task editing
4. `TaskDetailInline.tsx` - inline task editing
5. `QuickTaskModal.tsx` - quick task creation
6. `QuickTaskFromSession.tsx` - session task creation
7. `CaptureZone.tsx` - AI task extraction

---

### Step 5: Create NotesContext (2 hours)
**Why fifth:** Depends on Entities. Notes are linked to companies/contacts/topics and must update their noteCounts.

**File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/NotesContext.tsx`

**State to move:**
```typescript
{
  notes: Note[];
}
```

**Actions to move:**
- `ADD_NOTE`
- `UPDATE_NOTE`
- `DELETE_NOTE`
- `BATCH_ADD_NOTES`
- `CREATE_MANUAL_NOTE`

**Context Interface:**
```typescript
interface NotesContextType {
  notes: Note[];

  addNote: (note: Note) => void;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;

  batchAddNotes: (notes: Note[]) => void;

  createManualNote: (data: ManualNoteData) => void;
}

export const NotesProvider;
export function useNotes(): NotesContextType;
```

**CRITICAL - Cross-Context Updates:**
- When adding a note, must update the noteCount on linked entities (companies/contacts/topics)
- NotesContext needs to call EntitiesContext methods: `updateCompany()`, `updateContact()`, `updateTopic()`
- Use `useEntities()` hook inside NotesProvider

**Example Pattern:**
```typescript
const NotesProvider = ({ children }) => {
  const { companies, contacts, topics, updateCompany, updateContact, updateTopic } = useEntities();

  const addNote = (note: Note) => {
    // Add note to state
    setNotes(prev => [...prev, note]);

    // Update entity noteCounts
    if (note.companyIds) {
      note.companyIds.forEach(id => {
        const company = companies.find(c => c.id === id);
        if (company) {
          updateCompany({ ...company, noteCount: company.noteCount + 1, lastUpdated: note.timestamp });
        }
      });
    }
    // ... same for contacts and topics
  };
};
```

**Storage Integration:**
- Save notes to storage
- Load on mount, debounced save on change

**Validation Checklist:**
- [ ] NotesContext compiles
- [ ] Can create/edit/delete notes
- [ ] Batch add works
- [ ] Creating note updates entity noteCount correctly
- [ ] Deleting note decrements entity noteCount
- [ ] Changes persist on reload
- [ ] No console errors
- [ ] Performance: Changing a note does NOT re-render TasksZone or SessionsZone

**Components to migrate:**
1. `LibraryZone.tsx` - note library
2. `NoteDetailSidebar.tsx` - note editing
3. `NoteDetailInline.tsx` - inline note editing
4. `QuickNoteFromSession.tsx` - session note creation
5. `CaptureZone.tsx` - AI note creation
6. `ReferencePanel.tsx` - pinned notes display
7. `CleanNotesButton.tsx` - bulk note operations

---

### Step 6: Create SessionsContext (3 hours)
**Why last:** Most complex. Depends on Tasks and Notes contexts for extracted entities. Sessions are the heaviest state.

**File:** `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionsContext.tsx`

**State to move:**
```typescript
{
  sessions: Session[];
  activeSessionId?: string;
}
```

**Actions to move (17 actions):**
- `START_SESSION`
- `END_SESSION`
- `PAUSE_SESSION`
- `RESUME_SESSION`
- `UPDATE_SESSION`
- `DELETE_SESSION`
- `ADD_SESSION_SCREENSHOT`
- `ADD_SESSION_AUDIO_SEGMENT`
- `DELETE_AUDIO_SEGMENT_FILE`
- `UPDATE_SCREENSHOT_ANALYSIS`
- `ADD_SCREENSHOT_COMMENT`
- `TOGGLE_SCREENSHOT_FLAG`
- `SET_ACTIVE_SESSION`
- `ADD_EXTRACTED_TASK_TO_SESSION`
- `ADD_EXTRACTED_NOTE_TO_SESSION`
- `ADD_SESSION_CONTEXT_ITEM`

**Context Interface:**
```typescript
interface SessionsContextType {
  sessions: Session[];
  activeSessionId?: string;

  startSession: (session: Omit<Session, 'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'>) => void;
  endSession: (id: string) => void;
  pauseSession: (id: string) => void;
  resumeSession: (id: string) => void;
  updateSession: (session: Session) => void;
  deleteSession: (id: string) => void;

  addScreenshot: (sessionId: string, screenshot: SessionScreenshot) => void;
  addAudioSegment: (sessionId: string, segment: SessionAudioSegment) => void;
  deleteAudioSegmentFile: (sessionId: string, segmentId: string) => void;
  updateScreenshotAnalysis: (screenshotId: string, analysis: any, status: string, error?: string) => void;
  addScreenshotComment: (screenshotId: string, comment: string) => void;
  toggleScreenshotFlag: (screenshotId: string) => void;

  setActiveSession: (id?: string) => void;

  addExtractedTask: (sessionId: string, taskId: string) => void;
  addExtractedNote: (sessionId: string, noteId: string) => void;
  addContextItem: (sessionId: string, item: SessionContextItem) => void;
}

export const SessionsProvider;
export function useSessions(): SessionsContextType;
```

**CRITICAL - Storage & Performance:**
- Sessions can be HUGE (screenshots with base64 data)
- Must use immediate save for critical actions (screenshots, audio segments)
- Use the same CRITICAL_ACTIONS pattern from current AppContext
- Clear service caches when deleting sessions (audio concatenation, key moments)

**Storage Integration:**
- Immediate save for: START_SESSION, END_SESSION, ADD_SESSION_SCREENSHOT, ADD_SESSION_AUDIO_SEGMENT, UPDATE_SCREENSHOT_ANALYSIS, ADD_SESSION_CONTEXT_ITEM
- Debounced save for: UPDATE_SESSION, other actions
- Periodic auto-save every 30 seconds for active sessions

**Validation Checklist:**
- [ ] SessionsContext compiles
- [ ] Can start/pause/resume/end sessions
- [ ] Screenshots capture and save immediately
- [ ] Audio segments save immediately
- [ ] Session data persists on reload
- [ ] Active session survives app restart
- [ ] Deleting session clears service caches
- [ ] No data loss on app crash (test by force-quitting during session)
- [ ] No console errors
- [ ] Performance: Changing session does NOT re-render TasksZone, NotesZone, or LibraryZone

**Components to migrate:**
1. `SessionsZone.tsx` - session management
2. `SessionTimeline.tsx` - session display
3. `SessionDetailView.tsx` - session details
4. `ActiveSessionIndicator.tsx` - active session UI
5. `FloatingControls.tsx` - session controls
6. `ReviewTimeline.tsx` - session review
7. `AudioReviewStatusBanner.tsx` - audio review status
8. `EnrichmentStatusBanner.tsx` - enrichment status
9. `useSession.ts` hook - session state access

---

## Phase 3: Provider Nesting in App.tsx (30 min)

**CRITICAL: Provider order matters!**

Contexts must be nested in dependency order. Inner contexts can use outer contexts.

**File:** `/Users/jamesmcarthur/Documents/taskerino/src/App.tsx`

**Current structure:**
```tsx
<AppProvider>
  <App />
</AppProvider>
```

**New structure:**
```tsx
<SettingsProvider>           {/* Outermost - no dependencies */}
  <UIProvider>               {/* Can use Settings for preferences */}
    <EntitiesProvider>       {/* Can use Settings for AI settings */}
      <NotesProvider>        {/* Can use Entities to update noteCounts */}
        <TasksProvider>      {/* Can use Entities to validate topicId */}
          <SessionsProvider> {/* Can use Tasks/Notes for extracted items */}
            <App />
          </SessionsProvider>
        </TasksProvider>
      </NotesProvider>
    </EntitiesProvider>
  </UIProvider>
</SettingsProvider>
```

**Why this order:**
1. **SettingsProvider first** - No dependencies, provides settings to all
2. **UIProvider second** - May use settings for preferences default
3. **EntitiesProvider third** - Independent entity management
4. **NotesProvider fourth** - Needs Entities to update noteCounts when adding notes
5. **TasksProvider fifth** - Needs Entities to validate topicId (though this is optional)
6. **SessionsProvider last** - May need Tasks/Notes to link extracted items (though this is also optional)

**Alternative simpler order (if cross-context updates are minimized):**
```tsx
<SettingsProvider>
  <UIProvider>
    <EntitiesProvider>
      <TasksProvider>
        <NotesProvider>
          <SessionsProvider>
            <App />
          </SessionsProvider>
        </NotesProvider>
      </TasksProvider>
    </EntitiesProvider>
  </UIProvider>
</SettingsProvider>
```

**Validation:**
- [ ] App compiles with nested providers
- [ ] All contexts are accessible via hooks
- [ ] No "context is undefined" errors
- [ ] App renders without crashing
- [ ] All zones display correctly

---

## Phase 4: Component Migration (8-10 hours)

Migrate components one by one, testing after each change.

### Priority 1: Low-risk components (migrate first)

These components use simple, isolated state:

#### 1. **SettingsModal.tsx** (10 min)
**Changes:**
- Replace `useApp()` with `useSettings()`
- Update dispatch calls: `dispatch({ type: 'UPDATE_AI_SETTINGS', payload })` → `updateAISettings(payload)`
- Test: Open settings, change values, verify persistence

#### 2. **ProfileZone.tsx** (10 min)
**Changes:**
- Replace `useApp()` with `useSettings()` for user profile
- Use `useEntities()` for companies/contacts/topics display
- Test: Profile updates save correctly

#### 3. **NedSettings.tsx** (10 min)
**Changes:**
- Replace `useApp()` with `useSettings()` for Ned settings
- Test: Permission changes save correctly

#### 4. **LearningDashboard.tsx** (10 min)
**Changes:**
- Replace `useApp()` with `useSettings()` for learnings
- Test: Learning display and stats work

#### 5. **TopNavigation.tsx** (15 min)
**Changes:**
- Replace `useApp()` with `useUI()` for zone/tab navigation
- Test: Tab switching works, active tab highlights

#### 6. **ZoneLayout.tsx** (10 min)
**Changes:**
- Replace `useApp()` with `useUI()` for currentZone
- Test: Zone display updates on navigation

#### 7. **CommandPalette.tsx** (15 min)
**Changes:**
- Replace `useApp()` with `useUI()` for modal state
- May need `useTasks()` and `useNotes()` for search
- Test: Cmd+K opens, search works, modal closes

#### 8. **NotificationCenter.tsx** (10 min)
**Changes:**
- Replace `useApp()` with `useUI()` for notifications
- Test: Notifications appear, dismiss, and clear

#### 9. **ProcessingIndicator.tsx** (10 min)
**Changes:**
- Replace `useApp()` with `useUI()` for background jobs
- Test: Jobs display, progress updates, completion works

#### 10. **ReferencePanel.tsx** (15 min)
**Changes:**
- Replace `useApp()` with `useUI()` for panel state, pinned notes
- Use `useNotes()` to fetch note content for pinned notes
- Test: Panel toggles, notes pin/unpin, panel persists state

### Priority 2: Medium-risk components

These components use multiple contexts:

#### 11. **TasksZone.tsx** (30 min)
**Changes:**
- Replace `useApp()` with:
  - `useTasks()` for task data and actions
  - `useUI()` for sidebar, filters, onboarding
  - `useEntities()` for topic filtering (optional)
- Test: Task list displays, create/edit/delete works, filters work, view switching works

#### 12. **LibraryZone.tsx** (30 min)
**Changes:**
- Replace `useApp()` with:
  - `useNotes()` for note data and actions
  - `useEntities()` for companies/contacts/topics
  - `useTasks()` for task counts per note
  - `useUI()` for activeNoteId, sidebar
- Test: Note list displays, entity filtering works, note selection works, inline editing works

#### 13. **SessionsZone.tsx** (45 min)
**Changes:**
- Replace `useApp()` with:
  - `useSessions()` for session data and actions
  - `useTasks()` and `useNotes()` for extracted items
  - `useUI()` for onboarding tooltips
- Test: Session list displays, start/pause/end works, screenshots capture, audio records, session details load

#### 14. **CaptureZone.tsx** (30 min)
**Changes:**
- Replace `useApp()` with:
  - `useNotes()` for adding notes
  - `useTasks()` for adding tasks
  - `useEntities()` for creating topics
  - `useUI()` for processing jobs, notifications
- Test: Text capture works, AI processing works, entities created correctly, tasks/notes added

#### 15. **TaskTableView.tsx** (20 min)
**Changes:**
- Replace `useApp()` with `useTasks()` and `useUI()` for sidebar
- Test: Table displays, sorting works, grouping works, inline editing works

#### 16. **TaskDetailSidebar.tsx** (30 min)
**Changes:**
- Replace `useApp()` with:
  - `useTasks()` for task data and updates
  - `useNotes()` for source note display
  - `useEntities()` for topic display
  - `useUI()` for sidebar state
- Test: Sidebar opens with task, all fields editable, source note links work, changes save

#### 17. **NoteDetailSidebar.tsx** (30 min)
**Changes:**
- Replace `useApp()` with:
  - `useNotes()` for note data and updates
  - `useTasks()` for related tasks
  - `useEntities()` for entity display
  - `useUI()` for sidebar state
- Test: Sidebar opens with note, editing works, entity links work, related tasks display

#### 18. **NoteDetailInline.tsx** (20 min)
**Changes:**
- Replace `useApp()` with `useNotes()` and `useEntities()`
- Test: Inline editing works, entity tags work

#### 19. **TaskDetailInline.tsx** (20 min)
**Changes:**
- Replace `useApp()` with `useTasks()` and `useEntities()`
- Test: Inline editing works

#### 20. **SessionTimeline.tsx** (20 min)
**Changes:**
- Replace `useApp()` with `useSessions()`
- Test: Timeline displays screenshots, audio segments, context items

#### 21. **SessionDetailView.tsx** (30 min)
**Changes:**
- Replace `useApp()` with:
  - `useSessions()` for session data
  - `useTasks()` and `useNotes()` for extracted items display
- Test: Detail view displays all session info, extracted items link correctly

### Priority 3: High-risk components (migrate last, carefully)

These have complex cross-context interactions:

#### 22. **QuickTaskModal.tsx** (20 min)
**Changes:**
- Replace `useApp()` with `useTasks()`, `useEntities()`, `useUI()`
- Test: Quick task creation works

#### 23. **QuickTaskFromSession.tsx** (25 min)
**Changes:**
- Replace `useApp()` with `useTasks()`, `useSessions()`, `useUI()`
- Test: Creating task from session works, links correctly

#### 24. **QuickNoteFromSession.tsx** (25 min)
**Changes:**
- Replace `useApp()` with `useNotes()`, `useSessions()`, `useEntities()`, `useUI()`
- Test: Creating note from session works, links correctly, entity relationships work

#### 25. **NedOverlay.tsx** (30 min)
**Changes:**
- Replace `useApp()` with:
  - `useUI()` for overlay state, conversation
  - `useTasks()`, `useNotes()`, `useSessions()` for Ned to read/manipulate data
  - `useSettings()` for Ned settings
- Test: Ned overlay opens, conversations work, Ned can access data

#### 26. **NedChat.tsx** (30 min)
**Changes:**
- Replace `useApp()` with:
  - `useUI()` for messages
  - `useTasks()`, `useNotes()`, `useSessions()` for Ned actions
  - `useSettings()` for Ned settings
- Test: Chat works, Ned can create tasks/notes, tool usage works

#### 27. **ActiveSessionIndicator.tsx** (15 min)
**Changes:**
- Replace `useApp()` with `useSessions()` for active session
- Test: Indicator displays, updates on session changes

#### 28. **FloatingControls.tsx** (20 min)
**Changes:**
- Replace `useApp()` with `useSessions()`, `useUI()`
- Test: Controls display during session, pause/resume works

#### 29. **ReviewTimeline.tsx** (20 min)
**Changes:**
- Replace `useApp()` with `useSessions()`
- Test: Review displays correctly

#### 30. **AudioReviewStatusBanner.tsx** (15 min)
**Changes:**
- Replace `useApp()` with `useSessions()`
- Test: Banner displays status correctly

#### 31. **EnrichmentStatusBanner.tsx** (15 min)
**Changes:**
- Replace `useApp()` with `useSessions()`
- Test: Banner displays enrichment status

#### 32. **CleanNotesButton.tsx** (15 min)
**Changes:**
- Replace `useApp()` with `useNotes()`, `useUI()`
- Test: Bulk note operations work

#### 33. **useSession.ts hook** (30 min)
**Changes:**
- Replace `useApp()` with `useSessions()`
- May need `useTasks()`, `useNotes()` for session-related data
- Test: Hook provides correct session data, actions work

#### 34. **useKeyboardShortcuts.ts hook** (20 min)
**Changes:**
- Replace `useApp()` with `useUI()` for command palette, quick capture
- May need other contexts for shortcut actions
- Test: All keyboard shortcuts still work

### Remaining components (lower priority, can be done after validation)

These are less critical and can be migrated after core functionality is validated:

35. `QuickNoteModal.tsx` (if exists)
36. Other specialized modals
37. Any other components found during grep

---

## Phase 5: Testing & Validation (2 hours)

### Functional Testing Checklist

After ALL components are migrated, test every feature:

#### Tasks
- [ ] Create task manually
- [ ] Create task from AI extraction
- [ ] Edit task title, description, priority, status, due date
- [ ] Toggle task completion
- [ ] Delete task
- [ ] Search tasks
- [ ] Filter tasks by status, priority, due date, tags
- [ ] Bulk operations (select multiple, delete)
- [ ] View task in sidebar
- [ ] View task in inline mode
- [ ] Switch between table and kanban views
- [ ] Drag tasks between kanban columns

#### Notes
- [ ] Create note manually
- [ ] Create note from AI extraction
- [ ] Edit note content, tags, entities
- [ ] Delete note
- [ ] Search notes
- [ ] Filter notes by company, contact, topic, tags, source, sentiment
- [ ] Pin note to reference panel
- [ ] View note in sidebar
- [ ] View note in inline mode
- [ ] Navigate between notes in library

#### Sessions
- [ ] Start session with screenshots
- [ ] Start session with audio
- [ ] Start session with video (if enabled)
- [ ] Pause/resume session
- [ ] End session
- [ ] View session timeline
- [ ] Add manual context to session
- [ ] Create task from session
- [ ] Create note from session
- [ ] Delete session
- [ ] View session details
- [ ] Audio review works
- [ ] Video chapters work (if enabled)
- [ ] Enrichment pipeline works

#### Entities (Companies/Contacts/Topics)
- [ ] Create company
- [ ] Create contact
- [ ] Create topic
- [ ] Edit entity name
- [ ] Delete entity
- [ ] View notes for entity
- [ ] noteCount updates correctly when notes added/deleted
- [ ] Legacy topicId migration works

#### Settings
- [ ] Update AI settings
- [ ] Update learning settings
- [ ] Update user profile
- [ ] Update Ned settings
- [ ] Grant/revoke Ned permissions
- [ ] Settings persist on reload

#### UI & Navigation
- [ ] All zones load correctly (Capture, Tasks, Library, Sessions, Assistant, Profile)
- [ ] Zone navigation works (clicking tabs)
- [ ] Sidebar opens/closes
- [ ] Sidebar history (back button) works
- [ ] Modals open/close (quick capture, command palette)
- [ ] Notifications appear and dismiss
- [ ] Background processing jobs display
- [ ] Onboarding tooltips work
- [ ] Reference panel toggles
- [ ] Pinned notes display in reference panel
- [ ] Ned overlay opens/closes
- [ ] Ned conversation works

#### Persistence & Data Integrity
- [ ] All data saves automatically
- [ ] All data loads on app restart
- [ ] No data loss on app crash (test by force-quitting)
- [ ] Active session survives app restart
- [ ] Storage migration works (old localStorage → new storage)
- [ ] Critical actions save immediately (screenshots, audio)

### Performance Testing

Use React DevTools Profiler to measure re-renders:

#### Before Split (Baseline):
1. Record: Create a task
2. Count: How many components re-rendered?
3. Record: Edit a note
4. Count: How many components re-rendered?
5. Record: Toggle sidebar
6. Count: How many components re-rendered?

#### After Split (Target):
1. Record: Create a task
2. Expect: Only TasksZone and TasksContext consumers re-render
3. Verify: NotesZone, LibraryZone, SessionsZone do NOT re-render
4. Record: Edit a note
5. Expect: Only LibraryZone and NotesContext consumers re-render
6. Verify: TasksZone, SessionsZone do NOT re-render
7. Record: Toggle sidebar
8. Expect: Only UIContext consumers re-render
9. Verify: Data zones do NOT re-render

**Success Criteria:** 70-85% reduction in re-renders across the board.

### Regression Testing

- [ ] No console errors
- [ ] No TypeScript errors
- [ ] No broken features
- [ ] Storage still works
- [ ] All tests pass (if any)
- [ ] App builds successfully
- [ ] App runs in production mode

---

## Phase 6: Rollback Plan

If something breaks badly and cannot be fixed quickly:

### Immediate Rollback
```bash
cd /Users/jamesmcarthur/Documents/taskerino
git checkout before-context-split
# App is now back to pre-split state
```

### Partial Rollback (if only one context is broken)
```bash
# Rollback just the broken file
git checkout HEAD~1 -- src/context/BrokenContext.tsx
# Fix and retry
```

### Emergency Fix (if git history is lost)
- Restore from the tag `before-context-split`
- Delete the branch `perf/split-app-context`
- Start over with lessons learned

---

## Risk Mitigation

### High-Risk Areas (extra caution)

#### 1. Cross-context actions
**Risk:** Actions that need data from multiple contexts (e.g., creating a note that links to an entity and updates noteCount).

**Mitigation:**
- NotesContext calls EntitiesContext methods directly
- Use hooks: `const { updateCompany } = useEntities()` inside NotesProvider
- Test thoroughly: Create note → verify entity noteCount increments

#### 2. Storage logic
**Risk:** Each context saves independently. Could have race conditions or partial saves.

**Mitigation:**
- Use same storage keys as before (backwards compatible)
- Debounced saves (5 seconds) to reduce writes
- Immediate saves for critical actions (screenshots, audio)
- Test: Force-quit app during session → verify no data loss

#### 3. Context dependencies & provider order
**Risk:** Wrong provider order causes "undefined context" errors.

**Mitigation:**
- Follow dependency tree strictly (Settings → UI → Entities → Notes → Tasks → Sessions)
- Test each context in isolation first
- Add console.log to verify context initialization order

#### 4. Migration from old AppContext
**Risk:** Existing users have data in old localStorage format. Must migrate smoothly.

**Mitigation:**
- Keep storage keys identical (backwards compatible)
- Run migration on first load
- Keep old AppContext code as reference
- Test with production data (export localStorage, import to test environment)

### Validation Points

After each context creation:

1. **App still compiles** - No TypeScript errors
2. **App still runs** - No runtime errors
3. **Basic features still work** - Can navigate zones, create/edit entities
4. **No console errors** - Clean console output
5. **Storage works** - Data persists on reload

**DO NOT proceed to next context if validation fails.**

---

## Timeline Estimate

| Phase | Task | Time | Cumulative |
|-------|------|------|------------|
| **Phase 1** | Setup & Preparation | 30 min | 0.5 hrs |
| **Phase 2** | Create SettingsContext | 1 hr | 1.5 hrs |
| | Create UIContext | 1.5 hrs | 3 hrs |
| | Create EntitiesContext | 1.5 hrs | 4.5 hrs |
| | Create TasksContext | 2 hrs | 6.5 hrs |
| | Create NotesContext | 2 hrs | 8.5 hrs |
| | Create SessionsContext | 3 hrs | 11.5 hrs |
| **Phase 3** | Provider Nesting | 30 min | 12 hrs |
| **Phase 4** | Migrate Priority 1 Components (10) | 2 hrs | 14 hrs |
| | Migrate Priority 2 Components (11) | 4 hrs | 18 hrs |
| | Migrate Priority 3 Components (13) | 4 hrs | 22 hrs |
| **Phase 5** | Testing & Validation | 2 hrs | 24 hrs |
| **TOTAL** | | **24 hours** | |

**Note:** This is ideal time. Real-world with debugging: 28-30 hours.

---

## Success Criteria

### Must Have (Blocking)
- [ ] All 5 new contexts created
- [ ] All 36+ components migrated
- [ ] All tests passing (functional checklist)
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] No regressions (all features work)
- [ ] Data persists correctly

### Should Have (Important)
- [ ] 70-85% reduction in re-renders (measured with React DevTools)
- [ ] No performance degradation
- [ ] Clean console (no warnings)
- [ ] Migration from old AppContext works seamlessly

### Nice to Have (Bonus)
- [ ] Documentation for new context structure
- [ ] Unit tests for context reducers
- [ ] Performance benchmarks recorded

---

## Implementation Notes

### Key Principles

1. **One context at a time** - Never work on multiple contexts simultaneously
2. **Validate after each step** - Don't proceed if validation fails
3. **Test immediately** - Test each component right after migrating
4. **Keep it simple** - Don't over-engineer the context logic
5. **Maintain backwards compatibility** - Storage keys must match old format

### Debugging Tips

If something breaks:

1. **Check provider order** - Wrong nesting = undefined context
2. **Check imports** - Did you import the new hook?
3. **Check types** - TypeScript will catch most issues
4. **Check console** - Error messages are your friend
5. **Check React DevTools** - Inspect context values
6. **Compare with old code** - Reference AppContext.tsx for logic

### Common Pitfalls

1. **Forgetting to nest providers correctly** - Always follow dependency tree
2. **Accessing context outside provider** - Will throw "context is undefined"
3. **Circular dependencies** - NotesContext needs EntitiesContext, but not vice versa
4. **Storage race conditions** - Use immediate save for critical actions
5. **Stale closures** - Use `useRef` for values used in async callbacks

---

## Post-Implementation

After split is complete and validated:

1. **Remove old AppContext.tsx** (or rename to AppContext.old.tsx for reference)
2. **Update documentation** to explain new context structure
3. **Create PR** with detailed description of changes
4. **Add performance benchmarks** to PR description
5. **Merge to main** after thorough code review
6. **Monitor production** for any issues post-deploy
7. **Celebrate!** This was a major refactor 🎉

---

## Questions to Answer During Implementation

Keep track of these as you go:

- [ ] What was the actual re-render reduction percentage?
- [ ] Were there any unexpected cross-context dependencies?
- [ ] Did storage migration work smoothly?
- [ ] Were there any components that were particularly difficult to migrate?
- [ ] What lessons can be applied to future context design?
- [ ] Are there any remaining performance bottlenecks?

---

## Conclusion

This is a complex, multi-day refactor. Take it slow, test thoroughly, and don't skip validation steps. The performance benefits will be significant, but only if done correctly.

**Remember:** You can always rollback to the tag `before-context-split` if things go wrong.

Good luck! 🚀
