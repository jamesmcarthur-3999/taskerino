# Component Migration Template

**Template Version**: 1.0
**Created**: 2025-10-23
**Based On**: SessionCard.tsx pilot migration

This template provides a step-by-step guide for migrating components from the deprecated `SessionsContext` to the new Phase 1 context providers.

---

## Prerequisites

Before starting migration:

- [ ] Read `/docs/sessions-rewrite/CONTEXT_MIGRATION_GUIDE.md`
- [ ] Understand the new context structure (SessionListContext, ActiveSessionContext, RecordingContext)
- [ ] Have the pilot migration analysis available for reference: `/docs/sessions-rewrite/PILOT_MIGRATION_ANALYSIS.md`

---

## Step 1: Component Analysis

### 1.1 Identify Current Hook Usage

Create an analysis document (copy this template):

```markdown
# Migration Analysis: [ComponentName]

## Current Implementation
- **File**: src/components/.../[ComponentName].tsx
- **Lines of Code**: XXX
- **Date Analyzed**: YYYY-MM-DD

### Hooks Used
- `useSessions()` - [What values are accessed?]
- Other hooks: [List them]

### Context Values Accessed
From `useSessions()`:
- `sessions` - [How is it used?]
- `activeSessionId` - [How is it used?]
- `startSession()` - [How is it used?]
- ... [List all accessed values/methods]

### Component Responsibilities
[What does this component do?]
- Display: ...
- Actions: ...
- Side effects: ...
```

### 1.2 Map Old → New Patterns

Create a mapping table:

| Old (SessionsContext) | New Context | New Method | Notes |
|----------------------|-------------|------------|-------|
| `sessions` | SessionListContext | `sessions` | For historical sessions |
| `activeSessionId` | ActiveSessionContext | `activeSessionId` | Current active session |
| `startSession()` | ActiveSessionContext | `startSession()` | Session lifecycle |
| ... | ... | ... | ... |

---

## Step 2: Implementation Plan

### 2.1 Import Changes

**Before**:
```typescript
import { useSessions } from '@/context/SessionsContext';
```

**After** (choose based on what you need):
```typescript
// For session list operations (viewing, filtering, sorting)
import { useSessionList } from '@/context/SessionListContext';

// For active session lifecycle (start, pause, resume, end)
import { useActiveSession } from '@/context/ActiveSessionContext';

// For recording services (screenshots, audio, video)
import { useRecording } from '@/context/RecordingContext';
```

### 2.2 Hook Replacement

**Pattern 1: Session List Operations**
```typescript
// BEFORE
const { sessions, updateSession, deleteSession } = useSessions();

// AFTER
const { sessions, updateSession, deleteSession } = useSessionList();
```

**Pattern 2: Active Session Lifecycle**
```typescript
// BEFORE
const { activeSessionId, startSession, pauseSession, endSession } = useSessions();

// AFTER
const { activeSession, startSession, pauseSession, endSession } = useActiveSession();
```

**Pattern 3: Recording Services**
```typescript
// BEFORE
const { startScreenshots, stopScreenshots } = useSessions(); // Not available in old context

// AFTER
const { startScreenshots, stopScreenshots } = useRecording();
```

### 2.3 Handle API Differences

Check for signature differences:

1. **Async Methods**: Some new context methods return Promises
   ```typescript
   // BEFORE (synchronous)
   deleteSession(id);

   // AFTER (async - add error handling!)
   try {
     await deleteSession(id);
     // Success notification
   } catch (error) {
     // Error handling
   }
   ```

2. **Parameter Changes**: Check if method signatures changed
   ```typescript
   // BEFORE
   updateSession({ ...session, tags: newTags });

   // AFTER (SessionListContext uses id + partial updates)
   updateSession(session.id, { tags: newTags });
   ```

3. **Missing Helper Methods**: If a convenience method doesn't exist, use the base method
   ```typescript
   // BEFORE
   addExtractedTask(sessionId, taskId);

   // AFTER (manual update)
   updateSession(sessionId, {
     extractedTaskIds: [...session.extractedTaskIds, taskId]
   });
   ```

---

## Step 3: Implementation

### 3.1 Make the Changes

1. Update imports
2. Replace hook usage
3. Fix method calls (signatures, async/await)
4. Add proper error handling
5. Test locally

### 3.2 Common Patterns

**Pattern: Update Session Tags**
```typescript
// Update session with new tags
updateSession(session.id, { tags: newTags });
```

**Pattern: Delete Session with Error Handling**
```typescript
const handleDelete = async (sessionId: string) => {
  try {
    await deleteSession(sessionId);

    addNotification({
      type: 'success',
      title: 'Session Deleted',
      message: 'Session has been deleted.',
    });
  } catch (error) {
    addNotification({
      type: 'error',
      title: 'Delete Failed',
      message: error instanceof Error ? error.message : 'Failed to delete session',
    });
  }
};
```

**Pattern: Batch Update Extracted Tasks**
```typescript
// Collect all new task IDs
const extractedTaskIds: string[] = [];

tasks.forEach(task => {
  tasksDispatch({ type: 'ADD_TASK', payload: task });
  extractedTaskIds.push(task.id);
});

// Update session once with all IDs
updateSession(session.id, {
  extractedTaskIds: [...session.extractedTaskIds, ...extractedTaskIds]
});
```

---

## Step 4: Testing

### 4.1 Type Check
```bash
npm run type-check
```

Look for errors related to your component.

### 4.2 Build Check
```bash
npm run build
```

Ensure the component builds without errors.

### 4.3 Runtime Verification
```bash
npm run dev
```

**Manual Test Checklist**:
- [ ] Component renders without errors
- [ ] No deprecation warnings in console
- [ ] All user interactions work
- [ ] Data updates persist correctly
- [ ] Error handling works (test error cases)
- [ ] Performance is acceptable

### 4.4 Edge Cases
- [ ] Test with empty data
- [ ] Test with large datasets
- [ ] Test error scenarios (e.g., deletion fails)
- [ ] Test async race conditions (if applicable)

---

## Step 5: Documentation

### 5.1 Before/After Comparison

Document the changes:

```markdown
## Migration Results

### Lines of Code
- **Before**: XXX lines
- **After**: YYY lines
- **Change**: ±ZZ lines (±W%)

### Complexity
- **Before**: [Description of old approach]
- **After**: [Description of new approach]
- **Improvement**: [What got better?]

### Dependencies
- **Before**:
  - `useSessions()` (deprecated)
  - Other hooks...
- **After**:
  - `useSessionList()` (new)
  - `useActiveSession()` (new, if used)
  - Other hooks...

### Deprecation Warnings
- **Before**: X warnings
- **After**: 0 warnings
```

### 5.2 Lessons Learned

Document any challenges or insights:

```markdown
## Lessons Learned

1. **Challenge**: [What was difficult?]
   - **Solution**: [How did you solve it?]

2. **Gotcha**: [Any unexpected issues?]
   - **Prevention**: [How to avoid in future migrations?]

3. **Improvement Opportunity**: [What could be better?]
   - **Recommendation**: [What should we do about it?]
```

---

## Step 6: Verification Report

Create a verification report (see template below):

```markdown
# Migration Verification Report

**Component**: [ComponentName]
**Migrated By**: [Your Name/Agent ID]
**Date**: YYYY-MM-DD

## Summary
Component successfully migrated from deprecated `SessionsContext` to new Phase 1 contexts.

## Changes Made
- Replaced `useSessions()` with `useSessionList()`
- Updated method signatures to match new APIs
- Added proper error handling for async operations
- Fixed X bugs discovered during migration

## Testing Results
- [x] Type checks pass
- [x] Builds successfully
- [x] Runs without errors
- [x] No deprecation warnings
- [x] All features working
- [x] Performance verified

## Metrics
- LOC: XXX → YYY (±Z%)
- Complexity: [Improved/No change/Increased]
- Test Coverage: X% → Y%

## Notes
[Any additional notes or recommendations]
```

---

## Common Gotchas

### 1. Async Method Signatures

**Problem**: `deleteSession()` is now async in `SessionListContext`

**Solution**: Always await and add try/catch
```typescript
try {
  await deleteSession(id);
} catch (error) {
  // Handle error
}
```

### 2. `updateSession()` Signature Change

**Problem**: Old context accepted full session, new context accepts id + partial

**Solution**: Update call signature
```typescript
// OLD
updateSession({ ...session, field: value });

// NEW
updateSession(session.id, { field: value });
```

### 3. Missing Helper Methods

**Problem**: Convenience method like `addExtractedTask()` doesn't exist

**Solution**: Use base `updateSession()` method
```typescript
updateSession(session.id, {
  extractedTaskIds: [...session.extractedTaskIds, newTaskId]
});
```

### 4. ActiveSession vs Historical Sessions

**Problem**: Confused about when to use `ActiveSessionContext` vs `SessionListContext`

**Solution**:
- Use `ActiveSessionContext` for the ONE currently active session
- Use `SessionListContext` for completed/historical sessions (even if they were just completed)

---

## Quick Reference

### SessionListContext
**When to use**: Managing completed/historical sessions

**Common methods**:
- `sessions: Session[]` - All completed sessions
- `filteredSessions: Session[]` - Filtered/sorted sessions
- `getSessionById(id): Session | undefined`
- `updateSession(id, updates): Promise<void>`
- `deleteSession(id): Promise<void>`
- `setFilter(filter): void`
- `setSortBy(sort): void`

### ActiveSessionContext
**When to use**: Managing the currently active session

**Common methods**:
- `activeSession: Session | null` - Current active session
- `startSession(config): void`
- `pauseSession(): void`
- `resumeSession(): void`
- `endSession(): Promise<void>`
- `updateActiveSession(updates): void`
- `addScreenshot(screenshot): void`
- `addAudioSegment(segment): void`

### RecordingContext
**When to use**: Managing recording services

**Common methods**:
- `startScreenshots(sessionId, config): void`
- `stopScreenshots(): void`
- `startAudio(sessionId, config): Promise<void>`
- `stopAudio(): Promise<void>`
- `startVideo(sessionId, config): void`
- `stopVideo(): void`

---

## Migration Checklist

Use this checklist for each component:

- [ ] Analysis complete (document created)
- [ ] Old → New mapping defined
- [ ] Imports updated
- [ ] Hook usage replaced
- [ ] Method signatures fixed
- [ ] Error handling added
- [ ] Type check passes
- [ ] Build successful
- [ ] Manual testing complete
- [ ] No console warnings
- [ ] Documentation updated
- [ ] Verification report created

---

## Next Steps

After completing migration:

1. Submit verification report
2. Mark component as migrated in tracking document
3. Move to next component
4. Share learnings with team

---

## Getting Help

If you encounter issues:

1. Check `/docs/sessions-rewrite/PILOT_MIGRATION_ANALYSIS.md` for reference
2. Review `/docs/sessions-rewrite/CONTEXT_MIGRATION_GUIDE.md` for context details
3. Look at migrated SessionCard.tsx as example
4. Ask for help with specific error messages

---

**Remember**: Migration is an opportunity to improve code quality. Add error handling, fix bugs, and improve readability while you're at it!
