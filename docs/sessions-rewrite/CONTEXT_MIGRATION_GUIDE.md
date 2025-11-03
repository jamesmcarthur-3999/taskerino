# Context Migration Guide

**Date**: 2025-10-23
**Status**: NEW contexts available, OLD context deprecated
**Breaking Changes**: None (backward compatible)

---

## Overview

SessionsContext has been split into three focused contexts:
1. **SessionListContext** - Manages list of completed sessions
2. **ActiveSessionContext** - Manages currently active session
3. **RecordingContext** - Manages recording services

This migration is **backward compatible**. The old `useSessions()` hook still works, but is deprecated and will be removed in Phase 7.

---

## Quick Migration Examples

### Before (Old Pattern)
```typescript
import { useSessions } from '../context/SessionsContext';

function MyComponent() {
  const {
    sessions,
    activeSessionId,
    startSession,
    endSession,
    addScreenshot,
    ...
  } = useSessions();

  // ...
}
```

### After (New Pattern)
```typescript
import { useSessionList } from '../context/SessionListContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useRecording } from '../context/RecordingContext';

function MyComponent() {
  // For session list operations
  const { sessions, filteredSessions, updateSession, deleteSession } = useSessionList();

  // For active session operations
  const { activeSession, startSession, endSession, addScreenshot } = useActiveSession();

  // For recording controls
  const { recordingState, startScreenshots, stopAll } = useRecording();

  // ...
}
```

---

## API Mapping

### Session List Operations

#### `sessions`
```typescript
// Old
const { sessions } = useSessions();

// New
const { sessions } = useSessionList();
```

#### `updateSession()`
```typescript
// Old
const { updateSession } = useSessions();
updateSession(updatedSession);

// New
const { updateSession } = useSessionList();
updateSession(sessionId, updates);  // Note: Different signature
```

#### `deleteSession()`
```typescript
// Old
const { deleteSession } = useSessions();
await deleteSession(sessionId);

// New
const { deleteSession } = useSessionList();
await deleteSession(sessionId);  // Same
```

#### New: Filtering & Sorting
```typescript
// New only
const { setFilter, setSortBy, filteredSessions } = useSessionList();

setFilter({
  status: ['completed'],
  tags: ['work'],
  searchQuery: 'project',
});

setSortBy('startTime-desc');
```

### Active Session Operations

#### `activeSessionId` / `activeSession`
```typescript
// Old
const { activeSessionId, sessions } = useSessions();
const activeSession = sessions.find(s => s.id === activeSessionId);

// New
const { activeSession, activeSessionId } = useActiveSession();
// activeSession is ALWAYS fresh, never stale
```

#### `startSession()`
```typescript
// Old
const { startSession } = useSessions();
startSession({ name, description, ... });

// New
const { startSession } = useActiveSession();
startSession({ name, description, ... });  // Same
```

#### `pauseSession()` / `resumeSession()` / `endSession()`
```typescript
// Old
const { pauseSession, resumeSession, endSession } = useSessions();
pauseSession(sessionId);
resumeSession(sessionId);
await endSession(sessionId);

// New
const { pauseSession, resumeSession, endSession } = useActiveSession();
pauseSession();  // No ID needed - operates on active session
resumeSession();  // No ID needed
await endSession();  // No ID needed
```

#### `addScreenshot()` / `addAudioSegment()`
```typescript
// Old
const { addScreenshot, addAudioSegment } = useSessions();
addScreenshot(sessionId, screenshot);
addAudioSegment(sessionId, segment);

// New
const { addScreenshot, addAudioSegment } = useActiveSession();
addScreenshot(screenshot);  // No sessionId needed
addAudioSegment(segment);  // No sessionId needed
```

#### `updateScreenshotAnalysis()` / `addScreenshotComment()` / `toggleScreenshotFlag()`
```typescript
// Old
const { updateScreenshotAnalysis, addScreenshotComment, toggleScreenshotFlag } = useSessions();
updateScreenshotAnalysis(screenshotId, analysis, status, error);
addScreenshotComment(screenshotId, comment);
toggleScreenshotFlag(screenshotId);

// New
const { updateScreenshotAnalysis, addScreenshotComment, toggleScreenshotFlag } = useActiveSession();
updateScreenshotAnalysis(screenshotId, analysis, status, error);  // Same
addScreenshotComment(screenshotId, comment);  // Same
toggleScreenshotFlag(screenshotId);  // Same
```

### Recording Services

#### Starting Recording (NEW)
```typescript
// Old - manually managed in components
screenshotCaptureService.startCapture(session, callback);

// New - through context
const { startScreenshots, startAudio, startVideo } = useRecording();
startScreenshots(session, callback);
await startAudio(session, callback);
await startVideo(session);
```

#### Stopping Recording (NEW)
```typescript
// Old - manually managed
screenshotCaptureService.stopCapture();

// New - through context
const { stopScreenshots, stopAudio, stopVideo, stopAll } = useRecording();
stopScreenshots();
await stopAudio();
await stopVideo();
await stopAll();  // Stops all services
```

#### Recording State (NEW)
```typescript
// Old - no centralized state
const isCapturing = screenshotCaptureService.isCapturing();

// New - centralized state
const { recordingState } = useRecording();
console.log(recordingState.screenshots);  // 'idle' | 'active' | 'paused' | 'stopped' | 'error'
console.log(recordingState.audio);
console.log(recordingState.video);
```

---

## Component Migration Checklist

For each component using `useSessions()`:

### 1. Identify Which Contexts You Need

- [ ] **Do you work with the session list?** → `useSessionList()`
  - Viewing all sessions
  - Filtering/sorting sessions
  - Updating completed sessions
  - Deleting sessions

- [ ] **Do you work with the active session?** → `useActiveSession()`
  - Starting/pausing/resuming/ending sessions
  - Adding screenshots or audio
  - Updating active session data

- [ ] **Do you control recording services?** → `useRecording()`
  - Starting/stopping screenshots
  - Starting/stopping audio
  - Starting/stopping video
  - Checking recording state

### 2. Update Imports
```typescript
// Before
import { useSessions } from '../context/SessionsContext';

// After (pick what you need)
import { useSessionList } from '../context/SessionListContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useRecording } from '../context/RecordingContext';
```

### 3. Update Hook Usage
```typescript
// Before
const { sessions, activeSessionId, startSession, ... } = useSessions();

// After
const { sessions } = useSessionList();
const { activeSession, startSession } = useActiveSession();
```

### 4. Update Function Calls
- Remove `sessionId` parameters from active session operations
- Update `updateSession()` signature to `(id, updates)` instead of `(session)`
- Use `activeSession` directly instead of finding by `activeSessionId`

### 5. Test
- [ ] Component renders without errors
- [ ] All session operations work
- [ ] No console warnings

---

## Component-Specific Guides

### SessionsZone.tsx
**Complexity**: HIGH (uses all three contexts)

```typescript
// Before
const {
  sessions,
  activeSessionId,
  startSession,
  endSession,
  pauseSession,
  resumeSession,
  updateSession,
  deleteSession,
  addScreenshot,
  addAudioSegment,
  updateScreenshotAnalysis,
  ...
} = useSessions();

// After
const { sessions, deleteSession, updateSession } = useSessionList();
const {
  activeSession,
  startSession,
  endSession,
  pauseSession,
  resumeSession,
  addScreenshot,
  addAudioSegment,
  updateScreenshotAnalysis,
  ...
} = useActiveSession();
const { recordingState, startScreenshots, startAudio, stopAll } = useRecording();

// Update: Remove activeSessionId lookups
// const activeSession = sessions.find(s => s.id === activeSessionId);
// activeSession is now directly available
```

### SessionDetailView.tsx
**Complexity**: LOW (read-only, uses session list)

```typescript
// Before
const { sessions, updateSession } = useSessions();

// After
const { sessions, updateSession } = useSessionList();
// Note: updateSession signature changed
updateSession(session.id, updates);  // NOT updateSession({...session, ...updates})
```

### ActiveSessionView.tsx
**Complexity**: MEDIUM (uses active session)

```typescript
// Before
const { sessions, activeSessionId, updateSession } = useSessions();
const activeSession = sessions.find(s => s.id === activeSessionId);

// After
const { activeSession, updateActiveSession } = useActiveSession();
// No need to look up by ID - always fresh
```

### TopNavigation/index.tsx
**Complexity**: LOW (just needs active session ID)

```typescript
// Before
const { activeSessionId } = useSessions();

// After
const { activeSessionId } = useActiveSession();
```

---

## Common Pitfalls

### Pitfall 1: Stale Active Session
```typescript
// ❌ Old pattern - can be stale
const { sessions, activeSessionId } = useSessions();
const activeSession = sessions.find(s => s.id === activeSessionId);

// ✅ New pattern - always fresh
const { activeSession } = useActiveSession();
```

### Pitfall 2: updateSession Signature
```typescript
// ❌ Old signature
updateSession({ ...session, name: 'New Name' });

// ✅ New signature
updateSession(session.id, { name: 'New Name' });
```

### Pitfall 3: Session ID Parameters
```typescript
// ❌ Old - requires session ID
pauseSession(sessionId);
addScreenshot(sessionId, screenshot);

// ✅ New - no session ID (operates on active)
pauseSession();
addScreenshot(screenshot);
```

### Pitfall 4: Recording Service Access
```typescript
// ❌ Old - direct service access
import { screenshotCaptureService } from '../services/screenshotCaptureService';
screenshotCaptureService.startCapture(session, callback);

// ✅ New - through context
const { startScreenshots } = useRecording();
startScreenshots(session, callback);
```

---

## Testing Your Migration

### 1. Type Checking
```bash
npm run type-check
```

Should pass with no errors.

### 2. Component Tests
Update your component tests to provide new contexts:

```typescript
// Before
<SessionsProvider>
  <MyComponent />
</SessionsProvider>

// After
<SessionListProvider>
  <ActiveSessionProvider>
    <RecordingProvider>
      <MyComponent />
    </RecordingProvider>
  </ActiveSessionProvider>
</SessionListProvider>
```

### 3. Manual Testing
- [ ] Start a session
- [ ] Pause/resume works
- [ ] Screenshots/audio capture
- [ ] End session
- [ ] View past sessions
- [ ] Delete a session

---

## Benefits After Migration

### Performance
- **Reduced re-renders**: Components only re-render when their specific context changes
- **Smaller diffs**: Updating active session doesn't re-render session list components

### Maintainability
- **Clear responsibilities**: Each context has ONE job
- **Easier testing**: Test contexts in isolation
- **Better code organization**: Smaller, focused files

### Developer Experience
- **Clearer APIs**: `useActiveSession()` vs `useSessionList()` vs `useRecording()`
- **Type safety**: Better TypeScript inference
- **No stale closures**: `activeSession` is always fresh

---

## Need Help?

### Resources
- Split plan: `/docs/sessions-rewrite/CONTEXT_SPLIT_PLAN.md`
- Original context: `/src/context/SessionsContext.tsx` (deprecated)
- New contexts:
  - `/src/context/SessionListContext.tsx`
  - `/src/context/ActiveSessionContext.tsx`
  - `/src/context/RecordingContext.tsx`

### Common Questions

**Q: Can I use both old and new contexts in the same component?**
A: Yes! They're fully compatible. Migrate gradually.

**Q: When will the old context be removed?**
A: Phase 7 (Week 13-14). You'll see deprecation warnings in console until then.

**Q: What if I need the old behavior?**
A: The old `useSessions()` hook will continue to work during the migration period.

**Q: How do I know when to use which context?**
A: Use the checklist in "Component Migration Checklist" section above.

---

## Migration Status Tracking

Track your progress:

```markdown
### Components Using SessionsContext (21 total)

Session Management (3):
- [ ] SessionsZone.tsx
- [ ] ActiveSessionView.tsx
- [ ] SessionDetailView.tsx

Navigation (2):
- [ ] TopNavigation/index.tsx
- [ ] TopNavigation/useNavData.ts

Quick Actions (3):
- [ ] CaptureZone.tsx
- [ ] QuickNoteFromSession.tsx
- [ ] QuickTaskFromSession.tsx

UI Components (6):
- [ ] FloatingControls.tsx
- [ ] CommandPalette.tsx
- [ ] SettingsModal.tsx
- [ ] sessions/SessionCard.tsx
- [ ] AudioReviewStatusBanner.tsx
- [ ] CanvasView.tsx

Hooks (3):
- [ ] hooks/useSessionStarting.ts
- [ ] hooks/useSessionEnding.ts
- [ ] hooks/useSession.ts

Other (4):
- [ ] context/EnrichmentContext.tsx
- [ ] components/ned/NedChat.tsx
- [ ] App.tsx
```

---

## Summary

**Key Changes**:
1. Split `useSessions()` into 3 focused hooks
2. Remove `sessionId` from active session operations
3. Change `updateSession()` signature
4. Access recording services through context

**Migration is OPTIONAL** until Phase 7. Take your time and migrate components gradually.
