# Context Migration Status

## PHASE 3: Provider Nesting ✅ COMPLETE

- [x] App.tsx updated with all 6 providers nested in correct order
- [x] TypeScript compilation verified (no errors)

## PHASE 4: Component Migration

### Priority 1: LOW-RISK (Simple, Few Context Dependencies)

#### Completed:
1. [x] **useKeyboardShortcuts.ts** - Migrated to useUI()
2. [x] **SettingsModal.tsx** - Migrated to useUI() + useSessions()

#### Remaining:
3. [ ] **ProfileZone.tsx** - Needs: useSettings(), useUI(), useEntities(), useNotes(), useTasks()
4. [ ] **TaskDetailSidebar.tsx** - Needs: useTasks(), useNotes(), useEntities(), useUI()
5. [ ] **NoteDetailSidebar.tsx** - Needs: useNotes(), useTasks(), useEntities(), useUI()
6. [ ] **useSession.ts** - Needs: useSessions()

### Priority 2: MEDIUM-RISK (Multiple Context Dependencies)

7. [ ] **NotificationCenter.tsx** - use UI()
8. [ ] **ProcessingIndicator.tsx** - useUI()
9. [ ] **ReferencePanel.tsx** - useUI(), useNotes()
10. [ ] **CommandPalette.tsx** - useUI(), useTasks(), useNotes()
11. [ ] **ZoneLayout.tsx** - useUI()
12. [ ] **TopNavigation.tsx** - useUI()
13. [ ] **ActiveSessionIndicator.tsx** - useSessions()
14. [ ] **FloatingControls.tsx** - useSessions(), useUI()
15. [ ] **SessionTimeline.tsx** - useSessions()
16. [ ] **SessionDetailView.tsx** - useSessions(), useTasks(), useNotes()
17. [ ] **ReviewTimeline.tsx** - useSessions()

### Priority 3: HIGH-RISK (Complex, Many Dependencies)

18. [ ] **TasksZone.tsx** - useTasks(), useUI(), useEntities()
19. [ ] **LibraryZone.tsx** - useNotes(), useEntities(), useTasks(), useUI()
20. [ ] **SessionsZone.tsx** - useSessions(), useTasks(), useNotes(), useUI()
21. [ ] **CaptureZone.tsx** - useNotes(), useTasks(), useEntities(), useUI(), useSettings()
22. [ ] **TaskTableView.tsx** - useTasks(), useUI()
23. [ ] **TaskDetailInline.tsx** - useTasks(), useEntities()
24. [ ] **NoteDetailInline.tsx** - useNotes(), useEntities()
25. [ ] **QuickTaskModal.tsx** - useTasks(), useEntities(), useUI()
26. [ ] **QuickTaskFromSession.tsx** - useTasks(), useSessions(), useUI()
27. [ ] **QuickNoteFromSession.tsx** - useNotes(), useSessions(), useEntities(), useUI()
28. [ ] **CleanNotesButton.tsx** - useNotes(), useUI()
29. [ ] **AudioReviewStatusBanner.tsx** - useSessions()
30. [ ] **EnrichmentStatusBanner.tsx** - useSessions()

### Priority 4: NED ASSISTANT (Special handling needed)

31. [ ] **NedOverlay.tsx** - useUI(), useTasks(), useNotes(), useSessions(), useSettings()
32. [ ] **NedChat.tsx** - useUI(), useTasks(), useNotes(), useSessions(), useSettings()
33. [ ] **NedSettings.tsx** - useSettings()
34. [ ] **LearningDashboard.tsx** - useSettings()

## Migration Pattern Reference

### Common Patterns:

**Old (AppContext):**
```typescript
import { useApp } from '../context/AppContext';
const { state, dispatch } = useApp();

// Access data
state.tasks
state.notes
state.ui.activeTab
state.aiSettings

// Dispatch actions
dispatch({ type: 'ADD_TASK', payload: task });
```

**New (Split Contexts):**
```typescript
import { useTasks } from '../context/TasksContext';
import { useNotes } from '../context/NotesContext';
import { useUI } from '../context/UIContext';
import { useSettings } from '../context/SettingsContext';

const { state: tasksState, dispatch: tasksDispatch } = useTasks();
const { state: notesState, dispatch: notesDispatch } = useNotes();
const { state: uiState, dispatch: uiDispatch } = useUI();
const { state: settingsState, dispatch: settingsDispatch } = useSettings();

// Access data
tasksState.tasks
notesState.notes
uiState.activeTab
settingsState.aiSettings

// Dispatch actions
tasksDispatch({ type: 'ADD_TASK', payload: task });
```

### Context Mapping:

| Old State Path | New Context | Hook |
|---------------|-------------|------|
| `state.tasks` | TasksContext | `useTasks()` |
| `state.notes` | NotesContext | `useNotes()` |
| `state.sessions` | SessionsContext | `useSessions()` |
| `state.activeSessionId` | SessionsContext | `useSessions()` |
| `state.companies` | EntitiesContext | `useEntities()` |
| `state.contacts` | EntitiesContext | `useEntities()` |
| `state.topics` | EntitiesContext | `useEntities()` |
| `state.ui.*` | UIContext | `useUI()` |
| `state.sidebar` | UIContext | `useUI()` |
| `state.ui.onboarding` | UIContext | `useUI()` |
| `state.ui.preferences` | UIContext | `useUI()` |
| `state.aiSettings` | SettingsContext | `useSettings()` |
| `state.learningSettings` | SettingsContext | `useSettings()` |
| `state.userProfile` | SettingsContext | `useSettings()` |
| `state.nedSettings` | SettingsContext | `useSettings()` |
| `state.learnings` | SettingsContext | `useSettings()` |

### Action Mapping:

| Action Type | New Context | Dispatch Variable |
|------------|-------------|-------------------|
| `ADD_TASK`, `UPDATE_TASK`, etc. | TasksContext | `tasksDispatch` |
| `ADD_NOTE`, `UPDATE_NOTE`, etc. | NotesContext | `notesDispatch` |
| `START_SESSION`, `END_SESSION`, etc. | SessionsContext | Sessions has methods instead |
| `ADD_COMPANY`, `UPDATE_TOPIC`, etc. | EntitiesContext | `entitiesDispatch` |
| `SET_ACTIVE_TAB`, `TOGGLE_SIDEBAR`, etc. | UIContext | `uiDispatch` |
| `UPDATE_AI_SETTINGS`, etc. | SettingsContext | `settingsDispatch` |

## Next Steps

1. Complete ProfileZone.tsx migration (in progress)
2. Systematically migrate remaining 31 files
3. Test each group after migration
4. Run full type-check after all migrations
5. Test app functionality end-to-end
