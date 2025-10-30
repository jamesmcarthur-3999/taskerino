# Pilot Migration Analysis: SessionCard.tsx

**Component**: `src/components/sessions/SessionCard.tsx`
**Analysis Date**: 2025-10-23
**Migration Priority**: HIGH (Pilot Component)

---

## Current Implementation Analysis

### 1. Current Hooks Used

```typescript
const { sessions, updateSession, deleteSession, addExtractedTask } = useSessions();
const { addNotification } = useUI();
const { dispatch: tasksDispatch } = useTasks();
```

**Dependencies**:
- `useSessions()` - From deprecated SessionsContext
- `useUI()` - Already using new context (good!)
- `useTasks()` - Already using new context (good!)

### 2. Context Values Accessed

From `useSessions()`:
- `sessions` - Array of all sessions (used for tag aggregation)
- `updateSession(session)` - Update session data
- `deleteSession(sessionId)` - Delete session
- `addExtractedTask(sessionId, taskId)` - Link extracted task to session

### 3. Component Responsibilities

**Display**:
- Renders session card with metadata (name, description, category, duration, stats)
- Shows tags with inline editing
- Displays delete button on hover
- Shows "NEW" badge for newly completed sessions
- Supports bulk selection mode

**Actions**:
1. Delete session (with confirmation)
2. Update session tags
3. Extract all recommended tasks from summary
4. Navigate to session detail view on click

### 4. Props Interface

```typescript
interface SessionCardProps {
  session: Session;              // The session to display
  onClick: () => void;            // Click handler (passed from parent)
  bulkSelectMode?: boolean;       // Enable checkbox selection
  isSelected?: boolean;           // Is selected in bulk mode
  onSelect?: (sessionId: string) => void;  // Selection handler
  onTagClick?: (tag: string) => void;      // Tag filter handler
  isNewlyCompleted?: boolean;     // Show NEW badge
  isViewing?: boolean;            // Highlight as currently viewing
}
```

**Key Observations**:
- Component receives `session` as prop (not fetched from context)
- Parent handles navigation and filtering
- Component only modifies session data (tags, deletion)

---

## Migration Plan

### Phase 1: Replace `useSessions()` with New Contexts

**Old Pattern**:
```typescript
const { sessions, updateSession, deleteSession, addExtractedTask } = useSessions();
```

**New Pattern**:
```typescript
const { sessions, updateSession, deleteSession } = useSessionList();
const { addExtractedTask } = useActiveSession();
```

**Mapping**:
| Old Hook | New Hook | Method | Notes |
|----------|----------|--------|-------|
| `useSessions()` | `useSessionList()` | `sessions` | For tag aggregation |
| `useSessions()` | `useSessionList()` | `updateSession()` | Update session data |
| `useSessions()` | `useSessionList()` | `deleteSession()` | Delete session |
| `useSessions()` | `useActiveSession()` | `addExtractedTask()` | Link task to session |

**Challenge**: `addExtractedTask()` exists in BOTH contexts!
- `SessionsContext.addExtractedTask(sessionId, taskId)` - accepts sessionId
- `ActiveSessionContext.addExtractedTask(taskId)` - only for active session

**Solution**: Since SessionCard displays COMPLETED sessions (not active), we need to add extracted tasks to historical sessions. The `ActiveSessionContext.addExtractedTask()` won't work here. We need to use the session list's mutation.

**Action Required**: Check if `SessionListContext` has this functionality. If not, we'll need to:
1. Update session directly via `updateSession()`
2. OR add `addExtractedTask()` to `SessionListContext`

### Phase 2: Update Imports

**Before**:
```typescript
import { useSessions } from '../../context/SessionsContext';
```

**After**:
```typescript
import { useSessionList } from '../../context/SessionListContext';
```

### Phase 3: Handle Missing Methods

**Issue**: `addExtractedTask(sessionId, taskId)` doesn't exist in `SessionListContext`.

**Solutions**:

**Option A**: Manual update via `updateSession()`
```typescript
const handleExtractAllTasks = (e: React.MouseEvent) => {
  // ... create tasks ...

  // Update session with extracted task IDs
  const updatedSession = {
    ...session,
    extractedTaskIds: [...session.extractedTaskIds, newTask.id]
  };
  updateSession(session.id, updatedSession);
};
```

**Option B**: Add helper to `SessionListContext`
```typescript
// In SessionListContext
addExtractedTask: (sessionId: string, taskId: string) => {
  const session = sessions.find(s => s.id === sessionId);
  if (!session) return;

  updateSession(sessionId, {
    extractedTaskIds: [...session.extractedTaskIds, taskId]
  });
};
```

**Recommendation**: Use Option A for this pilot. It's cleaner and doesn't require modifying the context.

---

## Changes Required

### File: `src/components/sessions/SessionCard.tsx`

**1. Import Changes**:
```diff
- import { useSessions } from '../../context/SessionsContext';
+ import { useSessionList } from '../../context/SessionListContext';
```

**2. Hook Usage**:
```diff
- const { sessions, updateSession, deleteSession, addExtractedTask } = useSessions();
+ const { sessions, updateSession, deleteSession } = useSessionList();
```

**3. Update `handleExtractAllTasks()` logic**:
```diff
  tasksDispatch({ type: 'ADD_TASK', payload: newTask });
- addExtractedTask(session.id, newTask.id);
+
+ // Update session with new extracted task ID
+ updateSession(session.id, {
+   ...session,
+   extractedTaskIds: [...session.extractedTaskIds, newTask.id]
+ });
```

**4. Update `handleDelete()` signature** (if needed):
- `SessionListContext.deleteSession()` is async: `Promise<void>`
- Current code doesn't await it, but should for proper error handling

**Updated**:
```typescript
const handleDelete = async (e: React.MouseEvent) => {
  e.stopPropagation();

  if (window.confirm(`Delete session "${session.name}"? This action cannot be undone.`)) {
    try {
      await deleteSession(session.id);

      addNotification({
        type: 'success',
        title: 'Session Deleted',
        message: `"${session.name}" has been deleted.`,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'Failed to delete session',
      });
    }
  }
};
```

---

## Testing Requirements

### Unit Tests
- [ ] Test tag update functionality
- [ ] Test delete confirmation and success notification
- [ ] Test extract all tasks functionality
- [ ] Test bulk selection mode
- [ ] Test hover states and click handlers

### Integration Tests
- [ ] Verify component renders with SessionListProvider
- [ ] Verify tags are aggregated correctly from sessions list
- [ ] Verify delete actually removes session from storage
- [ ] Verify extracted tasks are linked to session

### Manual Testing
- [ ] Component builds without errors
- [ ] No console warnings about deprecated hooks
- [ ] Delete button works correctly
- [ ] Tag editing works correctly
- [ ] Extract tasks works correctly
- [ ] Performance is acceptable (no regressions)

---

## Expected Outcomes

### Lines of Code
- **Before**: ~228 lines
- **After**: ~235 lines (slight increase due to error handling)
- **Change**: +7 lines (+3%)

### Complexity
- **Before**: Uses deprecated context with combined responsibilities
- **After**: Uses focused context for session list operations
- **Improvement**: Better separation of concerns

### Dependencies
- **Before**:
  - `useSessions()` (deprecated)
  - `useUI()`
  - `useTasks()`
- **After**:
  - `useSessionList()` (new)
  - `useUI()`
  - `useTasks()`

### Deprecation Warnings
- **Before**: 1 warning (useSessions deprecated)
- **After**: 0 warnings

---

## Risks and Mitigations

### Risk 1: Breaking Change in `deleteSession()` Signature
- **Impact**: Current code doesn't await the promise
- **Mitigation**: Add proper async/await with error handling
- **Severity**: LOW (improved error handling is a benefit)

### Risk 2: Missing `addExtractedTask()` Helper
- **Impact**: Need to manually update session
- **Mitigation**: Use `updateSession()` with spread operator
- **Severity**: LOW (simple workaround, no functionality loss)

### Risk 3: Tag Aggregation Performance
- **Impact**: Still iterating all sessions for tag suggestions
- **Mitigation**: No change from current behavior
- **Severity**: NONE (existing optimization opportunity, not a regression)

---

## Next Steps

1. Implement changes to SessionCard.tsx
2. Test component in isolation
3. Test component in app with real data
4. Document migration in COMPONENT_MIGRATION_TEMPLATE.md
5. Use template for remaining component migrations

---

## Lessons for Future Migrations

1. **Context Method Availability**: Always check if helper methods exist in new context before migrating
2. **Async Boundaries**: Pay attention to Promise return types and add proper error handling
3. **Minimal Changes**: Prefer using existing context methods over adding new ones
4. **Error Handling**: Migration is a good time to add proper error handling that may have been missing
