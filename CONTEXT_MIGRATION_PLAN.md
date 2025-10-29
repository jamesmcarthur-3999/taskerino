# Context Migration Plan - Taskerino

## Executive Summary

**Total Files to Migrate**: 25 files
- **SessionsContext**: 17 active imports
- **AppContext**: 8 active imports (2 legitimate uses in App.tsx, 6 requiring migration)

**Estimated Effort**: 16-24 hours
- SessionsContext Migration: 12-16 hours
- AppContext Migration: 4-8 hours

**Risk Level**: **Medium**
- Most migrations are straightforward API replacements
- Higher risk in SessionDetailView.tsx (large file, complex state)
- Moderate risk in hooks (useSession.ts, useSessionStarting.ts, useSessionEnding.ts)

**Blockers**: None - New contexts already functional and available

**Migration Order**: Bottom-up (hooks first, then components, then App.tsx)

---

## SessionsContext Migration

### Import Inventory

| File | Import Statement | Used APIs | Risk | Dependencies |
|------|------------------|-----------|------|--------------|
| **Hooks (3 files)** |
| hooks/useSession.ts | `import { useSessions } from '../context/SessionsContext'` | All session APIs (comprehensive hook) | **HIGH** | None |
| hooks/useSessionStarting.ts | `import { useSessions } from '../context/SessionsContext'` | `startSession`, `activeSessionId` | Low | None |
| hooks/useSessionEnding.ts | `import { useSessions } from '../context/SessionsContext'` | `sessions`, `endSession` | Low | None |
| **Components (14 files)** |
| components/SettingsModal.tsx | `import { useSessions } from '../context/SessionsContext'` | `sessions`, `activeSessionId`, `updateSession` | Medium | None |
| components/FloatingControls.tsx | `import { useSessions } from '../context/SessionsContext'` | `sessions`, `activeSessionId` | Low | None |
| components/CaptureZone.tsx | `import { useSessions } from '../context/SessionsContext'` | `sessions` (read-only) | Low | None |
| components/SessionDetailView.tsx | `import { useSessions } from '../context/SessionsContext'` | `sessions`, `updateSession` (2 usages) | **HIGH** | None |
| components/AudioReviewStatusBanner.tsx | `import { useSessions } from '../context/SessionsContext'` | `sessions`, `updateSession` | Low | None |
| components/CanvasView.tsx | `import { useSessions } from '../context/SessionsContext'` | `updateSession`, `sessions` | Medium | None |
| components/QuickNoteFromSession.tsx | `import { useSessions } from '../context/SessionsContext'` | `addExtractedNote` | Low | None |
| components/QuickTaskFromSession.tsx | `import { useSessions } from '../context/SessionsContext'` | `addExtractedTask` | Low | None |
| components/TopNavigation/index.tsx | `import { useSessions } from '../context/SessionsContext'` | `pauseSession`, `resumeSession`, `endSession`, `startSession`, `activeSessionId` | Medium | None |
| components/TopNavigation/useNavData.ts | `import { useSessions } from '../context/SessionsContext'` | `sessions`, `activeSessionId` | Low | None |
| components/ned/NedChat.tsx | `import { useSessions } from '../context/SessionsContext'` | `sessions`, `setActiveSession` | Low | None |
| **App.tsx** |
| App.tsx | `import { SessionsProvider } from './context/SessionsContext'` | Provider wrapping only | Low | All other migrations complete |

---

## API Migration Map

### SessionsContext → New Contexts

| Old API (`useSessions()`) | New API | Context | Notes |
|---------------------------|---------|---------|-------|
| **Session List Operations** |
| `sessions` | `sessions` | `useSessionList()` | Read-only list |
| `updateSession(session)` | `updateSession(id, updates)` | `useSessionList()` | ⚠️ API change: now takes id + partial updates |
| `deleteSession(id)` | `deleteSession(id)` | `useSessionList()` | Same signature |
| `filteredSessions` | `filteredSessions` | `useSessionList()` | Available via filtering |
| **Active Session Operations** |
| `activeSessionId` | `activeSessionId` | `useActiveSession()` | Same |
| `activeSession` (computed) | `activeSession` | `useActiveSession()` | Direct access (no compute needed) |
| `startSession(config)` | `startSession(config)` | `useActiveSession()` | Same signature |
| `endSession(id)` | `endSession()` | `useActiveSession()` | ⚠️ No id needed (uses active session) |
| `pauseSession(id)` | `pauseSession()` | `useActiveSession()` | ⚠️ No id needed |
| `resumeSession(id)` | `resumeSession()` | `useActiveSession()` | ⚠️ No id needed |
| `addScreenshot(sessionId, screenshot)` | `addScreenshot(screenshot)` | `useActiveSession()` | ⚠️ No sessionId needed |
| `addAudioSegment(sessionId, segment)` | `addAudioSegment(segment)` | `useActiveSession()` | ⚠️ No sessionId needed |
| `addExtractedTask(sessionId, taskId)` | `addExtractedTask(taskId)` | `useActiveSession()` | ⚠️ No sessionId needed |
| `addExtractedNote(sessionId, noteId)` | `addExtractedNote(noteId)` | `useActiveSession()` | ⚠️ No sessionId needed |
| `updateActiveSession(updates)` | `updateActiveSession(updates)` | `useActiveSession()` | Same |
| **Recording Operations** |
| N/A (was in services) | `startScreenshots(session, onCapture)` | `useRecording()` | New API |
| N/A (was in services) | `stopScreenshots()` | `useRecording()` | New API |
| N/A (was in services) | `startAudio(session, onSegment)` | `useRecording()` | New API |
| N/A (was in services) | `stopAudio()` | `useRecording()` | New API |
| **Utilities** |
| `setActiveSession(id)` | `loadSession(id)` | `useActiveSession()` | ⚠️ Renamed (loads full session) |
| `getCleanupMetrics()` | `getCleanupMetrics()` | `useRecording()` | Moved to RecordingContext |

---

## File-by-File Migration Strategy

### Batch 1: Hooks (Low Risk, No Dependencies)

#### 1.1 hooks/useSessionStarting.ts

**Risk Level**: Low
**Dependencies**: None
**Effort**: 30 minutes

**Current Code** (lines 60-72):
```typescript
import { useSessions } from '../context/SessionsContext';

export function useSessionStarting() {
  const { startSession, activeSessionId } = useSessions();
  // ... rest of hook
}
```

**New Code**:
```typescript
import { useActiveSession } from '../context/ActiveSessionContext';

export function useSessionStarting() {
  const { startSession, activeSessionId } = useActiveSession();
  // ... rest of hook (no other changes needed)
}
```

**Migration Steps**:
1. Update import from `SessionsContext` → `ActiveSessionContext`
2. Replace `useSessions()` → `useActiveSession()`
3. Run tests for session starting flow
4. Verify no regressions

**Testing**:
- [ ] Unit test: `useSessionStarting` hook behavior unchanged
- [ ] Integration test: Start session from FloatingControls
- [ ] Manual: Start session via TopNavigation

---

#### 1.2 hooks/useSessionEnding.ts

**Risk Level**: Low
**Dependencies**: None
**Effort**: 30 minutes

**Current Code** (lines 69-80):
```typescript
import { useSessions } from '../context/SessionsContext';

export function useSessionEnding() {
  const { sessions, endSession } = useSessions();
  // ... rest of hook
}
```

**New Code**:
```typescript
import { useSessionList } from '../context/SessionListContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useRecording } from '../context/RecordingContext';

export function useSessionEnding() {
  const { sessions } = useSessionList();
  const { endSession } = useActiveSession();
  const { stopAll } = useRecording();

  // Modify endSession calls to:
  // 1. Call stopAll() first (cleanup recordings)
  // 2. Then call endSession() (no id needed - uses active session)
}
```

**Migration Steps**:
1. Add three new imports (SessionListContext, ActiveSessionContext, RecordingContext)
2. Replace single `useSessions()` call with three separate context hooks
3. Update `endSession(id)` calls to `endSession()` (no id parameter)
4. Add `stopAll()` call before `endSession()` for proper cleanup
5. Test end session flow thoroughly

**Testing**:
- [ ] Unit test: `useSessionEnding` hook behavior
- [ ] Integration test: End session with active recordings
- [ ] Manual: End session via TopNavigation, verify cleanup

---

#### 1.3 hooks/useSession.ts ⚠️ HIGH RISK

**Risk Level**: **HIGH**
**Dependencies**: None
**Effort**: 2-3 hours
**Reason**: Comprehensive hook that wraps all session APIs (84 lines)

**Current Code** (lines 84-200+, summarized):
```typescript
import { useSessions } from '../context/SessionsContext';

export function useSession(sessionId?: string) {
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
    deleteAudioSegmentFile,
    updateScreenshotAnalysis,
    addScreenshotComment,
    toggleScreenshotFlag,
    setActiveSession,
    addExtractedTask,
    addExtractedNote,
    addContextItem,
  } = useSessions();

  const session = sessionId
    ? sessions.find(s => s.id === sessionId)
    : sessions.find(s => s.id === activeSessionId);

  // ... lots of wrapped functions
}
```

**New Code**:
```typescript
import { useSessionList } from '../context/SessionListContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useRecording } from '../context/RecordingContext';

export function useSession(sessionId?: string) {
  const { sessions, updateSession: updateInList, deleteSession } = useSessionList();
  const {
    activeSession,
    activeSessionId,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    updateActiveSession,
    addScreenshot,
    addAudioSegment,
    deleteAudioSegmentFile,
    updateScreenshotAnalysis,
    addScreenshotComment,
    toggleScreenshotFlag,
    addExtractedTask,
    addExtractedNote,
    addContextItem,
    loadSession,
  } = useActiveSession();
  const { stopAll } = useRecording();

  // Session lookup: prioritize activeSession if no sessionId provided
  const session = sessionId
    ? sessions.find(s => s.id === sessionId)
    : activeSession;

  // Wrapper functions (CRITICAL CHANGES):

  // updateSession: Now takes id + partial updates (not full session)
  const updateSession = useCallback((updates: Partial<Session>) => {
    if (!session) return;

    if (session.id === activeSessionId) {
      // Update active session
      updateActiveSession(updates);
    } else {
      // Update session in list
      updateInList(session.id, updates);
    }
  }, [session, activeSessionId, updateActiveSession, updateInList]);

  // endSession: No id needed (uses active session)
  const wrappedEndSession = useCallback(async () => {
    await stopAll(); // Cleanup recordings first
    await endSession(); // Then end session
  }, [endSession, stopAll]);

  // pauseSession: No id needed
  const wrappedPauseSession = useCallback(() => {
    pauseSession();
  }, [pauseSession]);

  // resumeSession: No id needed
  const wrappedResumeSession = useCallback(() => {
    resumeSession();
  }, [resumeSession]);

  // addScreenshot: No sessionId needed
  const wrappedAddScreenshot = useCallback((screenshot: SessionScreenshot) => {
    addScreenshot(screenshot);
  }, [addScreenshot]);

  // ... similar wrappers for other active session operations

  return {
    session,
    isActive: session?.id === activeSessionId,
    startSession,
    endSession: wrappedEndSession,
    pauseSession: wrappedPauseSession,
    resumeSession: wrappedResumeSession,
    updateSession,
    deleteSession: () => deleteSession(session!.id),
    addScreenshot: wrappedAddScreenshot,
    // ... rest of API
  };
}
```

**Migration Steps**:
1. Add three new context imports
2. Replace single `useSessions()` with three context hooks
3. Update `session` lookup to use `activeSession` when no `sessionId` provided
4. Create wrapper functions for API compatibility:
   - `updateSession`: Route to active or list context based on session
   - `endSession`: Call `stopAll()` then `endSession()`
   - `pauseSession/resumeSession`: Remove id parameter
   - `addScreenshot/addAudioSegment/etc.`: Remove sessionId parameter
5. Test extensively (this hook is used by many components)

**Testing**:
- [ ] Unit test: All `useSession()` operations
- [ ] Integration test: Session operations from SessionDetailView
- [ ] Manual: Full session lifecycle (start, pause, resume, end, delete)

---

### Batch 2: Simple Components (Low Risk)

#### 2.1 components/FloatingControls.tsx

**Risk Level**: Low
**Dependencies**: Batch 1 complete
**Effort**: 15 minutes

**Current Code** (lines 4-12):
```typescript
import { useSessions } from '../context/SessionsContext';

export function FloatingControls() {
  const { sessions, activeSessionId } = useSessions();
  const activeSession = sessions.find(s => s.id === activeSessionId);
  // ...
}
```

**New Code**:
```typescript
import { useActiveSession } from '../context/ActiveSessionContext';

export function FloatingControls() {
  const { activeSession, activeSessionId } = useActiveSession();
  // No need to find() - activeSession is directly available
  // ...
}
```

**Migration Steps**:
1. Update import
2. Replace `useSessions()` → `useActiveSession()`
3. Remove `find()` call (use direct `activeSession`)
4. Test floating controls display

**Testing**:
- [ ] Manual: Floating controls show correct session status

---

#### 2.2 components/CaptureZone.tsx

**Risk Level**: Low
**Dependencies**: Batch 1 complete
**Effort**: 15 minutes

**Current Code** (line 187):
```typescript
import { useSessions } from '../context/SessionsContext';

export default function CaptureZone() {
  const { sessions } = useSessions();
  // ... (read-only usage)
}
```

**New Code**:
```typescript
import { useSessionList } from '../context/SessionListContext';

export default function CaptureZone() {
  const { sessions } = useSessionList();
  // ... (no other changes)
}
```

**Migration Steps**:
1. Update import to `SessionListContext`
2. Replace `useSessions()` → `useSessionList()`
3. Test (no behavior change expected)

**Testing**:
- [ ] Manual: CaptureZone renders correctly

---

#### 2.3 components/QuickNoteFromSession.tsx

**Risk Level**: Low
**Dependencies**: Batch 1 complete
**Effort**: 15 minutes

**Current Code** (lines 4, 34):
```typescript
import { useSessions } from '../context/SessionsContext';

export function QuickNoteFromSession({ sessionId, onClose }) {
  const { addExtractedNote } = useSessions();

  const handleSave = () => {
    addExtractedNote(sessionId, noteId);
  };
}
```

**New Code**:
```typescript
import { useActiveSession } from '../context/ActiveSessionContext';

export function QuickNoteFromSession({ sessionId, onClose }) {
  const { addExtractedNote, activeSessionId } = useActiveSession();

  const handleSave = () => {
    // Only works if sessionId matches active session
    if (sessionId !== activeSessionId) {
      console.warn('Cannot add note to non-active session');
      return;
    }
    addExtractedNote(noteId); // No sessionId parameter
  };
}
```

**Migration Steps**:
1. Update import to `ActiveSessionContext`
2. Replace `useSessions()` → `useActiveSession()`
3. Update `addExtractedNote` call to remove sessionId parameter
4. Add validation to ensure sessionId matches activeSessionId
5. Test note extraction flow

**Testing**:
- [ ] Manual: Extract note from active session

---

#### 2.4 components/QuickTaskFromSession.tsx

**Risk Level**: Low
**Dependencies**: Batch 1 complete
**Effort**: 15 minutes

**Current Code** (lines 3, 32):
```typescript
import { useSessions } from '../context/SessionsContext';

export function QuickTaskFromSession({ sessionId, onClose }) {
  const { addExtractedTask } = useSessions();

  const handleSave = () => {
    addExtractedTask(sessionId, taskId);
  };
}
```

**New Code**:
```typescript
import { useActiveSession } from '../context/ActiveSessionContext';

export function QuickTaskFromSession({ sessionId, onClose }) {
  const { addExtractedTask, activeSessionId } = useActiveSession();

  const handleSave = () => {
    // Only works if sessionId matches active session
    if (sessionId !== activeSessionId) {
      console.warn('Cannot add task to non-active session');
      return;
    }
    addExtractedTask(taskId); // No sessionId parameter
  };
}
```

**Migration Steps**:
1. Update import to `ActiveSessionContext`
2. Replace `useSessions()` → `useActiveSession()`
3. Update `addExtractedTask` call to remove sessionId parameter
4. Add validation to ensure sessionId matches activeSessionId
5. Test task extraction flow

**Testing**:
- [ ] Manual: Extract task from active session

---

#### 2.5 components/TopNavigation/useNavData.ts

**Risk Level**: Low
**Dependencies**: Batch 1 complete
**Effort**: 15 minutes

**Current Code** (lines 12, 62):
```typescript
import { useSessions } from '../../context/SessionsContext';

export function useNavData() {
  const { sessions, activeSessionId } = useSessions();
  // ... (read-only)
}
```

**New Code**:
```typescript
import { useSessionList } from '../../context/SessionListContext';
import { useActiveSession } from '../../context/ActiveSessionContext';

export function useNavData() {
  const { sessions } = useSessionList();
  const { activeSessionId } = useActiveSession();
  // ... (no other changes)
}
```

**Migration Steps**:
1. Add two imports
2. Replace `useSessions()` with two context hooks
3. Test navigation data

**Testing**:
- [ ] Manual: TopNavigation displays correct session count

---

#### 2.6 components/ned/NedChat.tsx

**Risk Level**: Low
**Dependencies**: Batch 1 complete
**Effort**: 15 minutes

**Current Code** (lines 16, 78):
```typescript
import { useSessions } from '../../context/SessionsContext';

export function NedChat() {
  const { sessions, setActiveSession } = useSessions();
  // ...
}
```

**New Code**:
```typescript
import { useSessionList } from '../../context/SessionListContext';
import { useActiveSession } from '../../context/ActiveSessionContext';

export function NedChat() {
  const { sessions } = useSessionList();
  const { loadSession } = useActiveSession();

  // Replace setActiveSession(id) with loadSession(id)
}
```

**Migration Steps**:
1. Add two imports
2. Replace `useSessions()` with two context hooks
3. Replace `setActiveSession(id)` → `loadSession(id)`
4. Test Ned chat session switching

**Testing**:
- [ ] Manual: Ned can switch active session

---

### Batch 3: Medium Complexity Components

#### 3.1 components/AudioReviewStatusBanner.tsx

**Risk Level**: Low-Medium
**Dependencies**: Batch 2 complete
**Effort**: 30 minutes

**Current Code** (lines 17, 34):
```typescript
import { useSessions } from '../context/SessionsContext';

export function AudioReviewStatusBanner({ sessionId }) {
  const { sessions, updateSession } = useSessions();
  const session = sessions.find(s => s.id === sessionId);

  const handleUpdate = () => {
    updateSession({ ...session, enrichmentStatus: { ... } });
  };
}
```

**New Code**:
```typescript
import { useSessionList } from '../context/SessionListContext';

export function AudioReviewStatusBanner({ sessionId }) {
  const { sessions, updateSession } = useSessionList();
  const session = sessions.find(s => s.id === sessionId);

  const handleUpdate = () => {
    // New API: updateSession(id, updates) instead of updateSession(fullSession)
    updateSession(sessionId, {
      enrichmentStatus: { ... }
    });
  };
}
```

**Migration Steps**:
1. Update import to `SessionListContext`
2. Replace `useSessions()` → `useSessionList()`
3. Update `updateSession` calls to use new API (id + partial updates)
4. Test audio review status updates

**Testing**:
- [ ] Manual: Audio review status updates correctly

---

#### 3.2 components/CanvasView.tsx

**Risk Level**: Medium
**Dependencies**: Batch 2 complete
**Effort**: 30 minutes

**Current Code** (lines 18, 92):
```typescript
import { useSessions } from '../context/SessionsContext';

export function CanvasView({ sessionId }) {
  const { updateSession, sessions } = useSessions();
  const session = sessions.find(s => s.id === sessionId);

  const handleCanvasUpdate = () => {
    updateSession({ ...session, canvasSpec: newCanvasSpec });
  };
}
```

**New Code**:
```typescript
import { useSessionList } from '../context/SessionListContext';

export function CanvasView({ sessionId }) {
  const { updateSession, sessions } = useSessionList();
  const session = sessions.find(s => s.id === sessionId);

  const handleCanvasUpdate = () => {
    // New API: updateSession(id, updates)
    updateSession(sessionId, { canvasSpec: newCanvasSpec });
  };
}
```

**Migration Steps**:
1. Update import to `SessionListContext`
2. Replace `useSessions()` → `useSessionList()`
3. Update all `updateSession` calls to use new API
4. Test canvas updates

**Testing**:
- [ ] Manual: Canvas updates save correctly

---

#### 3.3 components/SettingsModal.tsx

**Risk Level**: Medium
**Dependencies**: Batch 2 complete
**Effort**: 45 minutes

**Current Code** (lines 5-26):
```typescript
import { useSessions } from '../context/SessionsContext';

export function SettingsModal() {
  const { sessions, activeSessionId, updateSession } = useSessions();

  // Update session settings
  const handleUpdateSession = (sessionId: string, settings: any) => {
    const session = sessions.find(s => s.id === sessionId);
    updateSession({ ...session, ...settings });
  };
}
```

**New Code**:
```typescript
import { useSessionList } from '../context/SessionListContext';
import { useActiveSession } from '../context/ActiveSessionContext';

export function SettingsModal() {
  const { sessions, updateSession } = useSessionList();
  const { activeSessionId } = useActiveSession();

  // Update session settings (new API)
  const handleUpdateSession = (sessionId: string, settings: any) => {
    updateSession(sessionId, settings); // No need to spread full session
  };
}
```

**Migration Steps**:
1. Add two imports
2. Replace `useSessions()` with two context hooks
3. Update `updateSession` calls to use new API
4. Test settings modal session updates

**Testing**:
- [ ] Manual: Update session settings (audio quality, screenshot interval)
- [ ] Manual: Settings persist correctly

---

#### 3.4 components/TopNavigation/index.tsx

**Risk Level**: Medium
**Dependencies**: Batch 2 complete
**Effort**: 1 hour

**Current Code** (lines 11, 30):
```typescript
import { useSessions } from '../../context/SessionsContext';

export function TopNavigation() {
  const {
    pauseSession,
    resumeSession,
    endSession,
    startSession,
    activeSessionId,
  } = useSessions();

  const handlePause = () => pauseSession(activeSessionId!);
  const handleResume = () => resumeSession(activeSessionId!);
  const handleEnd = () => endSession(activeSessionId!);
}
```

**New Code**:
```typescript
import { useActiveSession } from '../../context/ActiveSessionContext';
import { useRecording } from '../../context/RecordingContext';

export function TopNavigation() {
  const {
    pauseSession,
    resumeSession,
    endSession,
    startSession,
    activeSessionId,
  } = useActiveSession();
  const { pauseAll, resumeAll, stopAll } = useRecording();

  // No id needed - operates on active session
  const handlePause = () => {
    pauseSession(); // Pauses active session
    pauseAll(); // Pauses recordings
  };

  const handleResume = () => {
    resumeSession(); // Resumes active session
    resumeAll(); // Resumes recordings
  };

  const handleEnd = async () => {
    await stopAll(); // Stop recordings first
    await endSession(); // Then end session
  };
}
```

**Migration Steps**:
1. Update import to `ActiveSessionContext` and add `RecordingContext`
2. Replace `useSessions()` with two context hooks
3. Update all session control calls to remove id parameter
4. Add recording control calls (pauseAll, resumeAll, stopAll)
5. Test all session controls

**Testing**:
- [ ] Manual: Pause session from TopNavigation
- [ ] Manual: Resume session from TopNavigation
- [ ] Manual: End session from TopNavigation
- [ ] Integration: Verify recordings pause/resume/stop correctly

---

### Batch 4: High Risk Components ⚠️

#### 4.1 components/SessionDetailView.tsx ⚠️ HIGH RISK

**Risk Level**: **HIGH**
**Dependencies**: Batch 3 complete
**Effort**: 3-4 hours
**Reason**: Large file (1500+ lines), 2 separate `useSessions()` calls, complex session state

**Current Code** (lines 10, 69, 1488-1489):
```typescript
import { useSessions } from '../context/SessionsContext';

export function SessionDetailView({ sessionId }) {
  // First usage (line 69)
  const { sessions: allSessions, updateSession: updateSessionInContext } = useSessions();
  const session = allSessions.find(s => s.id === sessionId);

  // ... lots of code ...

  // Second usage (line 1488)
  const { sessions: allSessions2 } = useSessions();
  const { updateSession } = useSessions();

  const handleUpdate = () => {
    updateSessionInContext({ ...session, ...updates });
  };
}
```

**New Code**:
```typescript
import { useSessionList } from '../context/SessionListContext';
import { useActiveSession } from '../context/ActiveSessionContext';

export function SessionDetailView({ sessionId }) {
  const { sessions: allSessions, updateSession } = useSessionList();
  const { activeSession, activeSessionId } = useActiveSession();

  // Use activeSession if sessionId matches, otherwise find in list
  const session = sessionId === activeSessionId
    ? activeSession
    : allSessions.find(s => s.id === sessionId);

  // Update handler (new API)
  const handleUpdate = (updates: Partial<Session>) => {
    updateSession(sessionId, updates); // No need to spread full session
  };

  // Remove duplicate useSessions() calls (consolidate to one context usage)
}
```

**Migration Steps**:
1. Add two imports (SessionListContext, ActiveSessionContext)
2. **CRITICAL**: Remove duplicate `useSessions()` calls (consolidate)
3. Replace with two context hooks (`useSessionList()`, `useActiveSession()`)
4. Update session lookup to use `activeSession` if available
5. Update ALL `updateSession` calls to use new API (id + partial updates)
6. Search for ALL `updateSessionInContext` calls and migrate
7. Test extensively (this is a complex component)

**Testing**:
- [ ] Unit test: Session detail rendering
- [ ] Integration test: Update session metadata (name, description, tags)
- [ ] Integration test: Update enrichment status
- [ ] Integration test: Update canvas spec
- [ ] Manual: Full SessionDetailView workflow
- [ ] Manual: Verify no duplicate state updates

**Known Issues**:
- Line 1488-1489: Duplicate `useSessions()` calls - **MUST consolidate**
- Multiple `updateSession` call sites - **MUST find and migrate all**

---

### Batch 5: App.tsx Provider (Final Step)

#### 5.1 App.tsx

**Risk Level**: Low
**Dependencies**: **ALL BATCHES COMPLETE**
**Effort**: 15 minutes

**Current Code** (lines 134):
```typescript
import { SessionsProvider } from './context/SessionsContext';

function App() {
  return (
    <SettingsProvider>
      {/* ... other providers ... */}
      <SessionsProvider>
        {/* ... */}
      </SessionsProvider>
    </SettingsProvider>
  );
}
```

**New Code**:
```typescript
// Remove import entirely (SessionsProvider no longer needed)

function App() {
  return (
    <SettingsProvider>
      {/* ... other providers ... */}
      {/* SessionsProvider removed - functionality now in SessionListProvider, ActiveSessionProvider, RecordingProvider */}
    </SettingsProvider>
  );
}
```

**Migration Steps**:
1. **CRITICAL**: Verify ALL other files migrated first
2. Remove `SessionsProvider` import
3. Remove `<SessionsProvider>` wrapper from provider tree
4. Test entire app (smoke test all zones)
5. Monitor console for deprecation warnings

**Testing**:
- [ ] Smoke test: All zones load correctly
- [ ] Smoke test: Session lifecycle (start, pause, resume, end)
- [ ] Smoke test: Session list displays correctly
- [ ] Console: No deprecation warnings from `useSessions()`

---

## AppContext Migration

### Import Inventory

| File | Import Statement | Used APIs | Risk | Dependencies |
|------|------------------|-----------|------|--------------|
| App.tsx (2 uses) | `import { AppProvider, useApp } from './context/AppContext'` | `state`, `dispatch` (legitimate uses) | Low | None (keep for now) |
| components/ProfileZone.tsx | `import { useApp } from '../context/AppContext'` | `dispatch` (LOAD_STATE, RESET_ONBOARDING only) | Low | None |

**Note**: AppContext migration is **LOW PRIORITY** because:
1. Only 2 legitimate uses (App.tsx initialization, ProfileZone data management)
2. Most functionality already migrated to specialized contexts
3. Can be deferred to Phase 7

**Migration Strategy** (Future):
1. Move `LOAD_STATE` logic to storage initialization hook
2. Move `RESET_ONBOARDING` to UIContext
3. Remove AppContext entirely

---

## Execution Order

### Phase 1: Hooks (Week 1, Day 1-2)

**Batch 1A** (4 hours):
1. hooks/useSessionStarting.ts (30 min)
2. hooks/useSessionEnding.ts (30 min)
3. hooks/useSession.ts (2-3 hours) ⚠️ **HIGH RISK**

**Testing After Batch 1A**: Run all session lifecycle tests

---

### Phase 2: Simple Components (Week 1, Day 3)

**Batch 2A** (2 hours):
1. components/FloatingControls.tsx (15 min)
2. components/CaptureZone.tsx (15 min)
3. components/QuickNoteFromSession.tsx (15 min)
4. components/QuickTaskFromSession.tsx (15 min)
5. components/TopNavigation/useNavData.ts (15 min)
6. components/ned/NedChat.tsx (15 min)

**Testing After Batch 2A**: Smoke test all migrated components

---

### Phase 3: Medium Complexity (Week 1, Day 4-5)

**Batch 3A** (3 hours):
1. components/AudioReviewStatusBanner.tsx (30 min)
2. components/CanvasView.tsx (30 min)
3. components/SettingsModal.tsx (45 min)
4. components/TopNavigation/index.tsx (1 hour)

**Testing After Batch 3A**: Full session control flow test

---

### Phase 4: High Risk (Week 2, Day 1-2)

**Batch 4A** (4 hours):
1. components/SessionDetailView.tsx (3-4 hours) ⚠️ **HIGH RISK**

**Testing After Batch 4A**: Comprehensive SessionDetailView testing

---

### Phase 5: Cleanup (Week 2, Day 3)

**Batch 5A** (2 hours):
1. App.tsx - Remove SessionsProvider (15 min)
2. Delete deprecated SessionsContext.tsx (15 min)
3. Full regression testing (1.5 hours)

**Testing After Batch 5A**: Full app smoke test, monitor for issues

---

## Breaking Change Analysis

### What Breaks If We Remove Deprecated Contexts Today?

**SessionsContext Removal**:
- ❌ 17 components/hooks break immediately
- ❌ Session lifecycle stops working (start, pause, resume, end)
- ❌ Session list doesn't update
- ❌ Active session tracking fails
- ❌ Recording services not controlled

**AppContext Removal**:
- ❌ App initialization fails (LOAD_STATE)
- ❌ Onboarding reset broken (RESET_ONBOARDING)
- ⚠️ Most other functionality OK (migrated to specialized contexts)

### Minimum Changes for Clean Removal

**SessionsContext**:
1. Migrate ALL 17 import sites (see file-by-file plan above)
2. Test each migration thoroughly
3. Remove SessionsProvider from App.tsx
4. Delete SessionsContext.tsx file
5. Verify no console warnings

**AppContext**:
1. Move LOAD_STATE to storage initialization hook
2. Move RESET_ONBOARDING to UIContext
3. Remove AppProvider from App.tsx (keep specialized providers)
4. Delete AppContext.tsx file

### API Surface Changes

**SessionsContext → New Contexts**:

| Change | Impact | Migration Effort |
|--------|--------|------------------|
| `updateSession(fullSession)` → `updateSession(id, updates)` | Breaking | Medium (find all call sites) |
| `endSession(id)` → `endSession()` | Breaking | Low (remove id parameter) |
| `pauseSession(id)` → `pauseSession()` | Breaking | Low (remove id parameter) |
| `resumeSession(id)` → `resumeSession()` | Breaking | Low (remove id parameter) |
| `addScreenshot(sessionId, ...)` → `addScreenshot(...)` | Breaking | Low (remove sessionId parameter) |
| `setActiveSession(id)` → `loadSession(id)` | Breaking | Low (rename method) |
| `activeSession` computed → direct access | Non-breaking | None (improvement) |

---

## Test Strategy

### Unit Tests

**New Test Files**:
1. `hooks/useSessionStarting.test.ts` - Test session starting flow
2. `hooks/useSessionEnding.test.ts` - Test session ending flow
3. `hooks/useSession.test.ts` - Test session hook wrapper

**Test Coverage**:
- All API migrations have test coverage
- Verify old behavior matches new behavior
- Test error cases (e.g., no active session)

### Integration Tests

**Critical Flows**:
1. **Session Lifecycle**:
   - Start session → verify active
   - Pause session → verify paused
   - Resume session → verify active
   - End session → verify completed
   - Delete session → verify removed

2. **Recording Integration**:
   - Start session with recordings → verify all services start
   - Pause session → verify recordings pause
   - End session → verify recordings stop and cleanup

3. **Session Updates**:
   - Update session metadata → verify persisted
   - Update enrichment status → verify reflected in UI
   - Add screenshot → verify appears in session

### Manual Testing Checklist

**Before Migration**:
- [ ] Document current behavior (video recording recommended)
- [ ] Create test session with screenshots, audio, video
- [ ] Export session data for comparison

**After Each Batch**:
- [ ] Verify migrated components work as before
- [ ] Check console for errors/warnings
- [ ] Test session lifecycle operations

**Final Testing** (After All Batches):
- [ ] Full session lifecycle (start → pause → resume → end)
- [ ] Session list filtering/sorting
- [ ] Session detail view (all tabs)
- [ ] Screenshot capture and analysis
- [ ] Audio recording and review
- [ ] Video recording (macOS)
- [ ] AI enrichment pipeline
- [ ] Canvas generation
- [ ] Session deletion with attachment cleanup
- [ ] Settings modal session configuration
- [ ] Ned assistant session queries
- [ ] Task/note extraction from sessions

---

## Risk Mitigation

### Rollback Strategy

**Per-File Rollback**:
1. Git commit after each successful file migration
2. If issues found, revert single commit
3. Fix issues, re-migrate

**Batch Rollback**:
1. Git tag before each batch (`batch-1-pre`, `batch-1-post`)
2. If batch fails, rollback to pre-batch tag
3. Debug issues, re-attempt batch

**Full Rollback**:
1. Keep SessionsContext.tsx in deprecated/ folder (don't delete)
2. If critical issues, revert entire migration
3. Re-enable SessionsProvider in App.tsx

### Monitoring

**Console Monitoring**:
- Watch for deprecation warnings (should decrease after each batch)
- Watch for errors related to session operations
- Monitor storage persistence logs

**User Monitoring** (If in production):
- Track session start/end success rates
- Monitor session data persistence (no data loss)
- Watch for increased error reports

**Performance Monitoring**:
- Session list load time (should improve with metadata-only loading)
- Session detail load time (should be similar)
- Storage write frequency (should decrease with batched saves)

### Gradual Rollout (If needed)

**Feature Flag Approach**:
```typescript
// Environment variable to enable new contexts
const USE_NEW_SESSION_CONTEXTS = import.meta.env.VITE_NEW_SESSION_CONTEXTS === 'true';

// Conditional import
const SessionsContext = USE_NEW_SESSION_CONTEXTS
  ? NewSessionListContext
  : LegacySessionsContext;
```

**Rollout Stages**:
1. Week 1: Internal testing only (feature flag off)
2. Week 2: Beta users (feature flag on for 10%)
3. Week 3: Expanded rollout (50%)
4. Week 4: Full rollout (100%)
5. Week 5: Remove legacy code

---

## Success Criteria

### Migration Complete When:

**SessionsContext**:
- [ ] All 17 import sites migrated to new contexts
- [ ] No console deprecation warnings
- [ ] SessionsProvider removed from App.tsx
- [ ] SessionsContext.tsx file deleted (or moved to archive)
- [ ] All tests passing
- [ ] Full manual smoke test passes

**AppContext** (Deferred to Phase 7):
- [ ] LOAD_STATE moved to storage initialization
- [ ] RESET_ONBOARDING moved to UIContext
- [ ] App.tsx uses only specialized contexts
- [ ] AppContext.tsx deleted

### Performance Goals:

- [ ] Session list load: <1ms (metadata-only loading)
- [ ] Session detail load: <500ms (progressive chunking)
- [ ] No UI blocking during saves (PersistenceQueue handles background saves)
- [ ] Storage write reduction: 50% fewer transactions (batched via queue)

### Code Quality Goals:

- [ ] No deprecated imports remain
- [ ] All TypeScript errors resolved
- [ ] 100% test coverage for new context hooks
- [ ] Documentation updated (CLAUDE.md, API_REFERENCE.md)

---

## Appendices

### A. Quick Reference - API Mapping

```typescript
// OLD (SessionsContext)
const {
  sessions,                    // → useSessionList().sessions
  activeSessionId,             // → useActiveSession().activeSessionId
  activeSession,               // → useActiveSession().activeSession (computed → direct)
  startSession,                // → useActiveSession().startSession
  endSession(id),              // → useActiveSession().endSession() (no id)
  pauseSession(id),            // → useActiveSession().pauseSession() (no id)
  resumeSession(id),           // → useActiveSession().resumeSession() (no id)
  updateSession(session),      // → useSessionList().updateSession(id, updates) (API change)
  deleteSession,               // → useSessionList().deleteSession
  addScreenshot(sId, ss),      // → useActiveSession().addScreenshot(ss) (no sessionId)
  addAudioSegment(sId, seg),   // → useActiveSession().addAudioSegment(seg) (no sessionId)
  setActiveSession(id),        // → useActiveSession().loadSession(id) (renamed)
} = useSessions();
```

### B. File Migration Checklist

```markdown
- [ ] hooks/useSessionStarting.ts
- [ ] hooks/useSessionEnding.ts
- [ ] hooks/useSession.ts ⚠️ HIGH RISK
- [ ] components/FloatingControls.tsx
- [ ] components/CaptureZone.tsx
- [ ] components/QuickNoteFromSession.tsx
- [ ] components/QuickTaskFromSession.tsx
- [ ] components/TopNavigation/useNavData.ts
- [ ] components/ned/NedChat.tsx
- [ ] components/AudioReviewStatusBanner.tsx
- [ ] components/CanvasView.tsx
- [ ] components/SettingsModal.tsx
- [ ] components/TopNavigation/index.tsx
- [ ] components/SessionDetailView.tsx ⚠️ HIGH RISK
- [ ] App.tsx (remove SessionsProvider)
- [ ] Delete SessionsContext.tsx
```

### C. Common Migration Patterns

**Pattern 1: Read-Only Session List**
```typescript
// OLD
const { sessions } = useSessions();

// NEW
const { sessions } = useSessionList();
```

**Pattern 2: Active Session Operations**
```typescript
// OLD
const { activeSessionId, endSession } = useSessions();
endSession(activeSessionId);

// NEW
const { endSession } = useActiveSession();
endSession(); // No id needed
```

**Pattern 3: Update Session**
```typescript
// OLD
const { sessions, updateSession } = useSessions();
const session = sessions.find(s => s.id === sessionId);
updateSession({ ...session, name: 'New Name' });

// NEW
const { updateSession } = useSessionList();
updateSession(sessionId, { name: 'New Name' }); // Partial updates
```

**Pattern 4: Session + Recordings**
```typescript
// OLD
const { endSession, activeSessionId } = useSessions();
// (recordings stopped in service layer)
endSession(activeSessionId);

// NEW
const { endSession } = useActiveSession();
const { stopAll } = useRecording();
await stopAll(); // Stop recordings first
await endSession(); // Then end session
```

---

## Timeline Summary

| Week | Phase | Files | Hours | Cumulative |
|------|-------|-------|-------|------------|
| Week 1, Day 1-2 | Hooks | 3 | 4h | 4h |
| Week 1, Day 3 | Simple Components | 6 | 2h | 6h |
| Week 1, Day 4-5 | Medium Complexity | 4 | 3h | 9h |
| Week 2, Day 1-2 | High Risk | 1 | 4h | 13h |
| Week 2, Day 3 | Cleanup | 2 | 2h | 15h |
| **TOTAL** | | **16** | **15h** | |

**Buffer**: +3-5 hours for unexpected issues = **18-20 hours total**

---

## Notes

1. **AppContext Migration** deferred to Phase 7 (only 2 legitimate uses)
2. **SessionsContext Migration** is critical path (17 files)
3. **High Risk Files**: useSession.ts, SessionDetailView.tsx (thorough testing required)
4. **API Breaking Changes**: Most changes are parameter removal (simplification)
5. **Testing**: Integration tests critical for session lifecycle
6. **Rollback**: Git commits after each file, tags after each batch
7. **Monitoring**: Console warnings should decrease after each batch

---

**Generated**: 2025-10-26
**Author**: Claude Code (Sonnet 4.5)
**Status**: Ready for Implementation
