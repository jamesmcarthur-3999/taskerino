# Taskerino Context Architecture Guide

**Last Updated**: November 2, 2025

## Quick Reference

### Context Hierarchy
```
App.tsx
├── SettingsProvider
│   ├── UIProvider
│   │   ├── EntitiesProvider
│   │   │   ├── NotesProvider
│   │   │   │   ├── TasksProvider
│   │   │   │   │   ├── SessionsProvider
│   │   │   │   │   │   └── AppProvider (legacy)
```

### When to Use Which Context

| Need | Use Context | Import |
|------|-------------|--------|
| AI settings, user preferences | SettingsContext | `import { useSettings } from '../context/SettingsContext'` |
| UI state, navigation, modals | UIContext | `import { useUI } from '../context/UIContext'` |
| Companies, contacts, topics | EntitiesContext | `import { useEntities } from '../context/EntitiesContext'` |
| Notes CRUD | NotesContext | `import { useNotes } from '../context/NotesContext'` |
| Tasks CRUD | TasksContext | `import { useTasks } from '../context/TasksContext'` |
| Session list, filtering | SessionListContext | `import { useSessionList } from '../context/SessionListContext'` |
| Active session lifecycle | ActiveSessionContext | `import { useActiveSession } from '../context/ActiveSessionContext'` |
| Recording services | RecordingContext | `import { useRecording } from '../context/RecordingContext'` |

---

## Context Details

### SettingsContext

**Hook:** `useSettings()`

**State:**
```typescript
{
  aiSettings: AISettings
  learningSettings: LearningSettings
  userProfile: UserProfile
  learnings: UserLearnings
  nedSettings: NedSettings
}
```

**Common Actions:**
```typescript
dispatch({ type: 'UPDATE_AI_SETTINGS', payload: { autoMergeNotes: true } })
dispatch({ type: 'UPDATE_USER_PROFILE', payload: { name: 'John' } })
dispatch({ type: 'UPDATE_NED_SETTINGS', payload: { chattiness: 'verbose' } })
dispatch({ type: 'GRANT_NED_PERMISSION', payload: { toolName: 'search', level: 'forever' } })
```

**Example:**
```typescript
const { state, dispatch } = useSettings();
const systemInstructions = state.aiSettings.systemInstructions;
```

---

### UIContext

**Hook:** `useUI()`

**State:**
```typescript
{
  activeTab: TabType
  currentZone: string
  notifications: Notification[]
  backgroundProcessing: ProcessingState
  sidebar: SidebarState
  onboarding: OnboardingState
  preferences: UserPreferences
  // ... more UI state
}
```

**Helper Methods:**
```typescript
const { addNotification, addProcessingJob } = useUI();

addNotification({
  type: 'success',
  title: 'Task completed',
  message: 'Your task has been completed successfully',
  autoDismiss: true
})

addProcessingJob({
  type: 'session-analysis',
  status: 'processing',
  progress: 0,
  sessionId: 'session-123'
})
```

**Common Actions:**
```typescript
dispatch({ type: 'SET_ZONE', payload: 'tasks' })
dispatch({ type: 'OPEN_SIDEBAR', payload: { type: 'task', itemId: '123', label: 'Task Details' } })
dispatch({ type: 'TOGGLE_COMMAND_PALETTE' })
dispatch({ type: 'PIN_NOTE', payload: 'note-456' })
```

---

### EntitiesContext

**Hook:** `useEntities()`

**State:**
```typescript
{
  companies: Company[]
  contacts: Contact[]
  topics: Topic[]
}
```

**Helper Methods:**
```typescript
const { addTopic } = useEntities();

addTopic({
  id: generateId(),
  name: 'Project Alpha',
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  noteCount: 0
})
```

**Common Actions:**
```typescript
dispatch({ type: 'ADD_COMPANY', payload: newCompany })
dispatch({ type: 'UPDATE_CONTACT', payload: updatedContact })
dispatch({ type: 'DELETE_TOPIC', payload: 'topic-123' })
dispatch({ type: 'CREATE_MANUAL_TOPIC', payload: { name: 'New Topic', type: 'company' } })
```

---

### NotesContext

**Hook:** `useNotes()`

**State:**
```typescript
{
  notes: Note[]
}
```

**Helper Methods (Preferred):**
```typescript
const { addNote, updateNote, deleteNote, batchAddNotes, createManualNote } = useNotes();

// These methods automatically update EntitiesContext noteCounts
addNote(newNote)
deleteNote('note-123')
batchAddNotes([note1, note2, note3])

createManualNote({
  content: 'Meeting notes',
  source: 'manual',
  topicId: 'topic-123',
  tags: ['important']
})
```

**Why use helper methods?**
- They handle cross-context updates (noteCount in EntitiesContext)
- Ensure data consistency
- Handle entity creation if needed

---

### TasksContext

**Hook:** `useTasks()`

**State:**
```typescript
{
  tasks: Task[]
}
```

**Helper Methods:**
```typescript
const { addTask } = useTasks();

addTask({
  id: generateId(),
  title: 'Complete report',
  priority: 'high',
  status: 'todo',
  done: false,
  createdAt: new Date().toISOString()
})
```

**Common Actions:**
```typescript
dispatch({ type: 'TOGGLE_TASK', payload: 'task-123' })
dispatch({ type: 'BATCH_UPDATE_TASKS', payload: { ids: ['1', '2'], updates: { priority: 'high' } } })
dispatch({ type: 'DELETE_TASK', payload: 'task-123' })
```

---

### Session Contexts (Phase 1 - New)

**⚠️ DEPRECATED: SessionsContext removed Oct 27, 2025. Use specialized Phase 1 contexts instead.**

#### SessionListContext

**Hook:** `useSessionList()`

**State:**
```typescript
{
  sessions: Session[]
  filteredSessions: Session[]
  loading: boolean
  error: string | null
}
```

**Methods:**
```typescript
const {
  sessions,
  filteredSessions,
  updateSession,
  deleteSession,
  refreshSessions
} = useSessionList();
```

#### ActiveSessionContext

**Hook:** `useActiveSession()`

**State:**
```typescript
{
  activeSession: Session | null
  activeSessionId: string | null
}
```

**Methods:**
```typescript
const {
  activeSession,
  startSession,
  endSession,
  pauseSession,
  resumeSession,
  addScreenshot,
  addAudioSegment,
  updateScreenshotAnalysis
} = useActiveSession();

// Start a new session
await startSession({
  name: 'Work Session',
  description: 'Deep work on project',
  screenshotInterval: 120
});
```

#### RecordingContext

**Hook:** `useRecording()`

**Methods:**
```typescript
const {
  startScreenshots,
  stopScreenshots,
  startAudio,
  stopAudio,
  startVideo,
  stopVideo,
  isCapturing,
  isAudioRecording,
  isVideoRecording
} = useRecording();
```

**See**: `/docs/sessions-rewrite/CONTEXT_MIGRATION_GUIDE.md` for complete migration guide.

---

## Component Development Guide

### Creating a New Component

1. **Identify required contexts:**
   - Need to display tasks? → `useTasks()`
   - Need to show notifications? → `useUI()`
   - Need user settings? → `useSettings()`

2. **Import hooks:**
```typescript
import { useTasks } from '../context/TasksContext';
import { useUI } from '../context/UIContext';

function MyComponent() {
  const { state: tasksState, dispatch: tasksDispatch } = useTasks();
  const { state: uiState, addNotification } = useUI();
  
  // Component logic...
}
```

3. **Avoid using AppContext:**
   - Use specialized contexts instead
   - AppContext is legacy code

---

## Common Patterns

### Pattern 1: Creating a Note with Entity

```typescript
import { useNotes } from '../context/NotesContext';
import { useEntities } from '../context/EntitiesContext';

function CreateNoteForm() {
  const { createManualNote } = useNotes();
  
  const handleSubmit = (data) => {
    createManualNote({
      content: data.content,
      newTopicName: data.topicName,
      newTopicType: 'company', // or 'person' or 'other'
      tags: data.tags
    });
    // This automatically:
    // 1. Creates the entity if it doesn't exist
    // 2. Creates the note
    // 3. Updates entity noteCount
  };
}
```

### Pattern 2: Opening a Sidebar

```typescript
import { useUI } from '../context/UIContext';

function TaskList() {
  const { dispatch } = useUI();
  
  const handleTaskClick = (taskId: string, taskTitle: string) => {
    dispatch({
      type: 'OPEN_SIDEBAR',
      payload: {
        type: 'task',
        itemId: taskId,
        label: taskTitle
      }
    });
  };
}
```

### Pattern 3: Showing Notifications

```typescript
import { useUI } from '../context/UIContext';

function TaskActions() {
  const { addNotification } = useUI();
  
  const completeTask = async () => {
    // ... complete task logic
    
    addNotification({
      type: 'success',
      title: 'Task completed!',
      message: 'Great work!',
      autoDismiss: true,
      dismissAfter: 3000
    });
  };
}
```

### Pattern 4: Batch Operations

```typescript
import { useTasks } from '../context/TasksContext';
import { useUI } from '../context/UIContext';

function BulkActions() {
  const { state: tasksState, dispatch } = useTasks();
  const { state: uiState } = useUI();
  
  const selectedTaskIds = uiState.selectedTasks;
  
  const bulkComplete = () => {
    dispatch({
      type: 'BATCH_UPDATE_TASKS',
      payload: {
        ids: selectedTaskIds,
        updates: { status: 'done', done: true }
      }
    });
  };
}
```

### Pattern 5: Session Recording (Phase 1)

```typescript
import { useActiveSession } from '../context/ActiveSessionContext';
import { useRecording } from '../context/RecordingContext';
import { useUI } from '../context/UIContext';

function SessionControls() {
  const {
    activeSession,
    activeSessionId,
    startSession,
    endSession,
    pauseSession,
    resumeSession
  } = useActiveSession();
  const { startScreenshots, startAudio } = useRecording();
  const { addNotification } = useUI();

  const handleStart = async () => {
    await startSession({
      name: 'Work Session',
      description: '',
      screenshotInterval: 120,
      audioMode: 'transcription'
    });

    // Start recording services
    await startScreenshots(activeSessionId!, 120);
    await startAudio(activeSessionId!, 'default');

    addNotification({
      type: 'info',
      title: 'Session started',
      message: 'Recording your work session',
      autoDismiss: true
    });
  };

  const handleEnd = async () => {
    if (activeSessionId) {
      await endSession();
    }
  };
}
```

---

## Migration Guide for New Developers

### Old Pattern (AppContext)
```typescript
// DON'T DO THIS (legacy)
import { useApp } from '../context/AppContext';

function MyComponent() {
  const { state, dispatch } = useApp();
  const tasks = state.tasks;
  
  dispatch({ type: 'ADD_TASK', payload: newTask });
}
```

### New Pattern (Specialized Contexts)
```typescript
// DO THIS (current architecture)
import { useTasks } from '../context/TasksContext';

function MyComponent() {
  const { state, addTask } = useTasks();
  const tasks = state.tasks;
  
  addTask(newTask);
}
```

---

## Testing Contexts

### Unit Testing a Reducer
```typescript
import { tasksReducer } from '../context/TasksContext';

describe('TasksContext reducer', () => {
  it('should add a task', () => {
    const initialState = { tasks: [] };
    const action = { type: 'ADD_TASK', payload: newTask };
    
    const newState = tasksReducer(initialState, action);
    
    expect(newState.tasks).toHaveLength(1);
    expect(newState.tasks[0]).toEqual(newTask);
  });
});
```

### Integration Testing Cross-Context
```typescript
import { NotesProvider } from '../context/NotesContext';
import { EntitiesProvider } from '../context/EntitiesContext';

describe('NotesContext with EntitiesContext', () => {
  it('should update entity noteCount when adding note', () => {
    // Test that NotesContext properly updates EntitiesContext
    // when addNote() is called
  });
});
```

---

## Performance Tips

1. **Use context selectors sparingly** - Current contexts are focused enough
2. **Avoid unnecessary re-renders** - Only subscribe to contexts you need
3. **Use helper methods** - They're optimized for cross-context updates
4. **Leverage debounced persistence** - State saves automatically every 5s
5. **Critical actions save immediately** - ActiveSessionContext handles this automatically

---

## Troubleshooting

### Problem: Component re-renders too often
**Solution:** Check which contexts you're using. Only import contexts you actually need.

### Problem: State not persisting
**Solution:** 
- Check browser console for storage errors
- Verify context providers are properly nested
- For critical data, use ActiveSessionContext (immediate save)

### Problem: Cross-context updates not working
**Solution:**
- Use helper methods like `addNote()` instead of dispatch
- Verify context nesting order (Entities before Notes)

### Problem: TypeScript errors
**Solution:**
- Run `npx tsc --noEmit` to see all errors
- Ensure action payloads match type definitions
- Use proper typing for state and dispatch

---

## Quick Reference Table

| Context | Primary Use Case | State Size | Persistence | Cross-Context |
|---------|-----------------|------------|-------------|---------------|
| Settings | App config | Small | Debounced (5s) | No |
| UI | Navigation, modals | Medium | Partial (preferences only) | No |
| Entities | Companies, contacts, topics | Medium | Debounced (5s) | Read by Notes |
| Notes | Note management | Large | Debounced (5s) | Updates Entities |
| Tasks | Task management | Large | Debounced (5s) | No |
| Sessions | Session recording | Very Large | Immediate (critical) | No |

---

## File Locations

- **Context Definitions:** `/src/context/`
- **Type Definitions:** `/src/types.ts`
- **Storage Layer:** `/src/services/storage/`
- **Component Usage:** `/src/components/`

---

## Additional Resources

- **Full Migration Report:** `CONTEXT_MIGRATION_REPORT.md`
- **TypeScript Types:** `/src/types.ts`
- **Storage Service:** `/src/services/storage/index.ts`
- **Example Components:** `/src/components/CaptureZone.tsx`

---

**Last Updated:** October 15, 2025  
**Architecture Version:** 2.0  
**Status:** Production
