# Refs Elimination Plan - SessionsZone.tsx

**Task**: 1.6 - Eliminate Refs in SessionsZone
**Date**: 2025-10-23
**Status**: In Progress

---

## Executive Summary

SessionsZone.tsx currently uses **9 refs** total, of which **7 are state refs** that need elimination and **2 are DOM refs** that should be kept. The primary issues are stale closures in recording service callbacks that miss state updates.

### Ref Breakdown
- **State Refs (to eliminate)**: 7
- **DOM Refs (keep)**: 2
- **Total Refs**: 9

---

## Complete Ref Audit

### 1. Line 157: `activeSessionIdRef`
```typescript
const activeSessionIdRef = useRef<string | null>(activeSessionId);
```

**Purpose**: Store current active session ID for callbacks to avoid stale closures

**Problem**:
- Recording callbacks (screenshot, audio) capture stale `activeSessionId` from when listeners were registered
- When session changes, callbacks still reference old session ID
- Results in screenshots/audio being added to wrong session or ignored

**Current Usage**:
- Line 352: Updated on every render
- Line 618: Read in `handleScreenshotCaptured` callback
- Line 687: Read in `handleAudioSegmentProcessed` callback
- Line 1091: Read in audio-chunk event listener

**Solution**: **Pattern 1 - State Machine Context**
```typescript
// BEFORE
const currentActiveSessionId = activeSessionIdRef.current;

// AFTER
import { useSessionMachine } from '@/hooks/useSessionMachine';
const { context } = useSessionMachine();
const currentActiveSessionId = context.sessionId;
```

**Dependencies to Add**: `[context.sessionId]` in affected callbacks

**Status**: ❌ To be eliminated

---

### 2. Line 160: `prevActiveSessionIdRef`
```typescript
const prevActiveSessionIdRef = useRef<string | null>(null);
```

**Purpose**: Track previous active session ID to detect completion transitions

**Problem**:
- Used to detect when session ends (activeSessionId goes from value to null)
- Creates complex state tracking logic that React should handle

**Current Usage**:
- Line 891-960: Detect session completion for video stopping
- Line 1530-1542: Auto-transition to summary view

**Solution**: **Pattern 3 - Event-Based State Updates**
```typescript
// BEFORE
const prevSessionId = prevActiveSessionIdRef.current;
if (prevSessionId && !currentSessionId) {
  // Session completed
}

// AFTER
// Use useEffect with proper dependencies to detect changes
useEffect(() => {
  if (!activeSessionId) {
    // Session was just cleared - handle completion
  }
}, [activeSessionId]);
```

**Alternative**: Use state instead of ref:
```typescript
const [prevActiveSessionId, setPrevActiveSessionId] = useState<string | null>(null);

useEffect(() => {
  // Detect transition
  if (prevActiveSessionId && !activeSessionId) {
    // Handle completion
  }
  setPrevActiveSessionId(activeSessionId ?? null);
}, [activeSessionId]);
```

**Status**: ❌ To be eliminated

---

### 3. Line 163: `videoRecordingInitializedRef`
```typescript
const videoRecordingInitializedRef = useRef<string | null>(null);
```

**Purpose**: Prevent duplicate video recording initialization attempts

**Problem**:
- Uses ref to track initialization state outside React's render cycle
- Creates race conditions when session changes rapidly
- Hard to debug initialization failures

**Current Usage**:
- Line 786: Check if initialization attempted
- Line 791: Mark as attempted
- Line 821: Reset on error
- Line 840: Reset when video disabled
- Line 943: Reset after stopping
- Line 953: Reset on no video to stop

**Solution**: **Convert to State**
```typescript
// BEFORE
const videoRecordingInitializedRef = useRef<string | null>(null);
const hasAttemptedInitialization = videoRecordingInitializedRef.current === activeSession.id;

// AFTER
const [videoInitializedSessionId, setVideoInitializedSessionId] = useState<string | null>(null);
const hasAttemptedInitialization = videoInitializedSessionId === activeSession.id;
```

**Why State**:
- Initialization state is UI-relevant (affects whether to show error messages)
- State changes should trigger re-renders to update UI
- No callback closure issues since it's session-specific

**Status**: ❌ To be eliminated (convert to state)

---

### 4. Line 166: `stateRef`
```typescript
const stateRef = useRef({ sessions });
```

**Purpose**: Store latest sessions state to avoid stale closures in callbacks

**Problem**:
- Entire sessions array stored in ref
- Used to access fresh state in callbacks without adding to dependencies
- Workaround for improper dependency management

**Current Usage**:
- Line 352: Updated on every render
- Line 625: Access session in `handleScreenshotCaptured` to check autoAnalysis
- Line 1366: Access fresh session in metadata generation
- Line 1485: Access fresh session in synthesis generation

**Solution**: **Remove entirely - use proper context hooks**

For screenshot analysis:
```typescript
// BEFORE
const sessionForAnalysis = stateRef.current.sessions.find(s => s.id === currentActiveSessionId);

// AFTER
const { activeSession } = useActiveSession();
// activeSession is always fresh from context
```

For metadata/synthesis:
```typescript
// BEFORE
const freshSession = stateRef.current.sessions.find(s => s.id === activeSession.id);

// AFTER
const { activeSession } = useActiveSession();
// activeSession is always fresh - no need to find
```

**Status**: ❌ To be eliminated

---

### 5. Line 169: `handleAudioSegmentProcessedRef`
```typescript
const handleAudioSegmentProcessedRef = useRef<((segment: SessionAudioSegment) => void) | null>(null);
```

**Purpose**: Store audio segment handler to prevent duplicate event listeners

**Problem**:
- Stores callback in ref to maintain reference stability
- Updated via separate useEffect (lines 697-699)
- Creates indirection - hard to trace callback updates

**Current Usage**:
- Line 698: Updated when `handleAudioSegmentProcessed` changes
- Line 1102: Retrieved in audio-chunk event listener

**Solution**: **Remove entirely - use proper callback with dependencies**
```typescript
// BEFORE
const handler = handleAudioSegmentProcessedRef.current;
if (!handler) return;
await handler(audioSegment);

// AFTER
// handleAudioSegmentProcessed is defined with proper deps
// No need for ref - just use it directly
await handleAudioSegmentProcessed(audioSegment);
```

**Dependency Management**: Ensure audio-chunk listener re-registers when callback changes:
```typescript
useEffect(() => {
  const unlisten = listen('audio-chunk', handleAudioSegmentProcessed);
  return unlisten;
}, [handleAudioSegmentProcessed]); // Re-register when callback changes
```

**Status**: ❌ To be eliminated

---

### 6. Line 172: `audioListenerActiveRef`
```typescript
const audioListenerActiveRef = useRef<boolean>(false);
```

**Purpose**: Track if audio listener is already active (prevents duplicate registration in StrictMode)

**Problem**:
- React 18 Strict Mode double-invokes effects in development
- Ref used to prevent duplicate listener registration
- Workaround for async `listen()` function

**Current Usage**:
- Line 1071: Check if listener active
- Line 1079: Mark as active
- Line 1146: Reset to false on cleanup

**Solution**: **Keep this ref - it's a legitimate use case**

**Justification**:
- React's effect cleanup doesn't wait for async operations
- The `listen()` function is async, so cleanup can run before listener is registered
- This is a React limitation, not a state management issue
- Tauri's event system requires this pattern

**Alternative considered**: Use state instead of ref
```typescript
const [audioListenerActive, setAudioListenerActive] = useState(false);
```

**Rejected because**:
- Would cause unnecessary re-renders
- State changes are synchronous, but `listen()` is async - race condition
- Ref is appropriate here (guards against duplicate side effects)

**Status**: ✅ **KEEP THIS REF** (legitimate use case for preventing duplicate listeners)

---

### 7. Line 175: `sessionListScrollRef` (DOM ref)
```typescript
const sessionListScrollRef = useRef<HTMLDivElement>(null);
```

**Purpose**: Reference to session list scroll container DOM element

**Problem**: None - this is a proper use of refs

**Current Usage**:
- Line 307: Register scroll container
- Line 591: Programmatic scrolling
- Line 1977: Passed to SessionsListPanel component

**Solution**: **KEEP THIS REF** - DOM refs are appropriate and necessary

**Status**: ✅ **KEEP THIS REF** (DOM reference)

---

### 8. Line 315: `contentRef` (DOM ref)
```typescript
const contentRef = useRef<HTMLDivElement>(null);
```

**Purpose**: Reference to content container DOM element

**Problem**: None - this is a proper use of refs

**Current Usage**:
- Line 1910: Attached to content div element

**Solution**: **KEEP THIS REF** - DOM refs are appropriate

**Status**: ✅ **KEEP THIS REF** (DOM reference)

---

### 9. Line 318: `mainContainerRef` (DOM ref)
```typescript
const mainContainerRef = useRef<HTMLDivElement>(null);
```

**Purpose**: Reference to main container for dynamic padding adjustment

**Problem**: None - this is a proper use of refs

**Current Usage**:
- Line 1155: Access in scroll-driven padding effect
- Line 1767: Attached to main container div

**Solution**: **KEEP THIS REF** - DOM refs are appropriate

**Status**: ✅ **KEEP THIS REF** (DOM reference)

---

### 10. Line 321: `statsPillRef` (DOM ref)
```typescript
const statsPillRef = useRef<HTMLDivElement>(null);
```

**Purpose**: Reference to stats pill for scroll-driven fade animation

**Problem**: None - this is a proper use of refs

**Current Usage**:
- Line 1188: Access in scroll-driven fade effect
- Line 1857: Passed to SessionsStatsBar component

**Solution**: **KEEP THIS REF** - DOM refs are appropriate

**Status**: ✅ **KEEP THIS REF** (DOM reference)

---

### 11. Line 327: `menuBarMeasurementRef` (DOM ref)
```typescript
const menuBarMeasurementRef = useRef<HTMLDivElement>(null);
```

**Purpose**: Reference to hidden measurement element for compact mode detection

**Problem**: None - this is a proper use of refs

**Current Usage**:
- Line 1239: Access in compact mode detection
- Line 1770: Attached to hidden measurement div

**Solution**: **KEEP THIS REF** - DOM refs are appropriate

**Status**: ✅ **KEEP THIS REF** (DOM reference)

---

### 12. Line 450: `saveTimeoutRef` (in SessionsContext.tsx)
```typescript
const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
```

**Purpose**: Track debounce timeout for auto-save

**Problem**: None - this is a proper use of refs for timers

**Solution**: **KEEP THIS REF** - Timer refs are appropriate

**Status**: ✅ **KEEP THIS REF** (timer reference)

---

## Summary of Refs to Eliminate

### State Refs (Must Eliminate)
1. ❌ `activeSessionIdRef` - Replace with state machine context
2. ❌ `prevActiveSessionIdRef` - Convert to state or use effect dependencies
3. ❌ `videoRecordingInitializedRef` - Convert to state
4. ❌ `stateRef` - Remove entirely, use proper context hooks
5. ❌ `handleAudioSegmentProcessedRef` - Remove entirely, use callback directly

### Refs to Keep (Legitimate Use Cases)
1. ✅ `audioListenerActiveRef` - Guards async listener registration
2. ✅ `sessionListScrollRef` - DOM reference
3. ✅ `contentRef` - DOM reference
4. ✅ `mainContainerRef` - DOM reference
5. ✅ `statsPillRef` - DOM reference
6. ✅ `menuBarMeasurementRef` - DOM reference
7. ✅ `saveTimeoutRef` - Timer reference (in SessionsContext)

**Total to eliminate**: 5 state refs
**Total to keep**: 7 refs (6 DOM + 1 async guard)

---

## Implementation Plan

### Phase 1: Check for State Machine Context (Task 1.4 Dependency)
- [ ] Verify if Task 1.4 state machine is implemented
- [ ] Check for `useSessionMachine` hook
- [ ] Check for ActiveSession context

**Finding**: Task 1.4 has NOT been completed yet. State machine context does not exist.

**Impact**: Cannot use Pattern 1 (state machine context) yet. Must use alternative approaches.

---

### Phase 2: Create ActiveSession Context (Temporary Solution)

Since Task 1.4 state machine is not ready, create a minimal ActiveSession context:

```typescript
// src/context/ActiveSessionContext.tsx
import React, { createContext, useContext } from 'react';
import { useSessions } from './SessionsContext';
import type { Session } from '../types';

interface ActiveSessionContextType {
  activeSession: Session | null;
  updateActiveSession: (updates: Partial<Session>) => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextType | undefined>(undefined);

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
  const { sessions, activeSessionId, updateSession } = useSessions();

  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null;

  const updateActiveSession = (updates: Partial<Session>) => {
    if (activeSession) {
      updateSession({ ...activeSession, ...updates });
    }
  };

  return (
    <ActiveSessionContext.Provider value={{ activeSession, updateActiveSession }}>
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  const context = useContext(ActiveSessionContext);
  if (!context) {
    throw new Error('useActiveSession must be used within ActiveSessionProvider');
  }
  return context;
}
```

---

### Phase 3: Eliminate `activeSessionIdRef`

**Current Code** (lines 614-676):
```typescript
const handleScreenshotCaptured = useCallback(async (screenshot: SessionScreenshot) => {
  // Get current active session ID from ref (avoids stale closure)
  const currentActiveSessionId = activeSessionIdRef.current;
  if (!currentActiveSessionId) return;

  addScreenshot(currentActiveSessionId, screenshot);

  // Get the session from stateRef to check autoAnalysis setting
  const sessionForAnalysis = stateRef.current.sessions.find(s => s.id === currentActiveSessionId);
  // ...
}, [updateScreenshotAnalysis]);
```

**New Code**:
```typescript
// NOTE: Previously used activeSessionIdRef to avoid stale closure.
// Now using activeSession from context which provides fresh state.
const { activeSession } = useActiveSession();

const handleScreenshotCaptured = useCallback(async (screenshot: SessionScreenshot) => {
  if (!activeSession) return;

  addScreenshot(activeSession.id, screenshot);

  // Trigger AI analysis if enabled
  if (activeSession.autoAnalysis) {
    // ... rest of analysis logic using activeSession directly
  }
}, [activeSession, addScreenshot, updateScreenshotAnalysis]);
```

**Changes**:
- Remove `activeSessionIdRef.current` reads
- Add `activeSession` from `useActiveSession()` hook
- Add `activeSession` to callback dependencies
- Remove ref update in useEffect (line 352)

---

### Phase 4: Eliminate `stateRef`

**Related to Phase 3** - Once we use `activeSession` from context, we don't need `stateRef`.

**Changes**:
- Remove line 166: `const stateRef = useRef({ sessions });`
- Remove line 353: `stateRef.current = { sessions };`
- Replace all `stateRef.current.sessions.find(...)` with direct context access

---

### Phase 5: Eliminate `handleAudioSegmentProcessedRef`

**Current Code** (lines 683-699):
```typescript
const handleAudioSegmentProcessed = useCallback(async (segment: SessionAudioSegment) => {
  const currentActiveSessionId = activeSessionIdRef.current;
  if (!currentActiveSessionId) return;

  addAudioSegment(currentActiveSessionId, segment);
}, [addAudioSegment]);

// Update ref whenever callback changes
useEffect(() => {
  handleAudioSegmentProcessedRef.current = handleAudioSegmentProcessed;
}, [handleAudioSegmentProcessed]);
```

**New Code**:
```typescript
// NOTE: Previously used handleAudioSegmentProcessedRef to avoid recreating listener.
// Now using proper callback with dependencies and re-registering listener when needed.
const { activeSession } = useActiveSession();

const handleAudioSegmentProcessed = useCallback(async (segment: SessionAudioSegment) => {
  if (!activeSession) return;

  addAudioSegment(activeSession.id, segment);
}, [activeSession, addAudioSegment]);
```

**Changes in audio-chunk listener** (lines 1065-1148):
```typescript
useEffect(() => {
  let unlistenAudioChunk: (() => void) | undefined;

  const setupAudioListener = async () => {
    if (audioListenerActiveRef.current) return;

    audioListenerActiveRef.current = true;

    const unlistenFn = await listen('audio-chunk', async (event) => {
      // ... event processing ...

      // BEFORE: Get handler from ref
      // const handler = handleAudioSegmentProcessedRef.current;
      // if (!handler) return;
      // await handler(segment);

      // AFTER: Use callback directly
      await handleAudioSegmentProcessed(segment);
    });

    unlistenAudioChunk = unlistenFn;
  };

  setupAudioListener();

  return () => {
    if (unlistenAudioChunk) {
      unlistenAudioChunk();
    }
    audioListenerActiveRef.current = false;
  };
}, [handleAudioSegmentProcessed]); // Re-register when callback changes
```

**Changes**:
- Remove `handleAudioSegmentProcessedRef`
- Remove ref update useEffect (lines 697-699)
- Add `handleAudioSegmentProcessed` to listener dependencies
- Call callback directly in listener

**Important**: Listener will re-register when `activeSession` changes. This is correct behavior.

---

### Phase 6: Eliminate `prevActiveSessionIdRef`

**Option A: Convert to State**
```typescript
const [prevActiveSessionId, setPrevActiveSessionId] = useState<string | null>(null);

useEffect(() => {
  // Detect transition from active to completed
  if (prevActiveSessionId && !activeSessionId) {
    const completedSession = sessions.find(s => s.id === prevActiveSessionId && s.status === 'completed');
    if (completedSession) {
      // Handle completion (video stopping, summary transition)
    }
  }

  setPrevActiveSessionId(activeSessionId ?? null);
}, [activeSessionId, sessions, prevActiveSessionId]);
```

**Option B: Separate Effects for Each Concern**

Instead of tracking previous ID, split into focused effects:

For video stopping (lines 890-960):
```typescript
// Dedicated effect for video stopping on session completion
useEffect(() => {
  // Find recently completed sessions
  const recentlyCompleted = sessions.filter(s =>
    s.status === 'completed' &&
    !s.video && // No video data yet
    s.videoRecording // Was recording video
  );

  recentlyCompleted.forEach(session => {
    // Stop video recording if active for this session
    const activeVideoSessionId = videoRecordingService.getActiveSessionId();
    if (activeVideoSessionId === session.id) {
      // Stop and attach video
    }
  });
}, [sessions]); // Runs when sessions change
```

For summary transition (lines 1528-1542):
```typescript
// Dedicated effect for auto-transition to summary
useEffect(() => {
  if (!activeSession && sessions.length > 0) {
    // Find most recently completed session
    const recentlyCompleted = sessions
      .filter(s => s.status === 'completed')
      .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())[0];

    if (recentlyCompleted) {
      setSelectedSessionId(recentlyCompleted.id);
    }
  }
}, [activeSession, sessions]);
```

**Recommendation**: Use Option B (separate effects) - more declarative and easier to understand.

---

### Phase 7: Eliminate `videoRecordingInitializedRef`

**Current Code** (lines 779-844):
```typescript
const hasAttemptedInitialization = videoRecordingInitializedRef.current === activeSession.id;

if (!isAlreadyRecordingThisSession && !hasAttemptedInitialization) {
  videoRecordingInitializedRef.current = activeSession.id;
  // Start recording...
}
```

**New Code**:
```typescript
const [videoInitializedSessionId, setVideoInitializedSessionId] = useState<string | null>(null);

const hasAttemptedInitialization = videoInitializedSessionId === activeSession.id;

if (!isAlreadyRecordingThisSession && !hasAttemptedInitialization) {
  setVideoInitializedSessionId(activeSession.id);
  // Start recording...
}
```

**Changes**:
- Replace all `videoRecordingInitializedRef.current` with `videoInitializedSessionId`
- Replace all assignments with `setVideoInitializedSessionId(...)`
- No need to add to dependencies (state is already tracked)

---

## Callback Dependency Analysis

### Callbacks that Need Dependency Updates

#### 1. `handleScreenshotCaptured` (line 614)
**Before**: `[updateScreenshotAnalysis]`
**After**: `[activeSession, addScreenshot, updateScreenshotAnalysis]`

#### 2. `handleAudioSegmentProcessed` (line 683)
**Before**: `[addAudioSegment]`
**After**: `[activeSession, addAudioSegment]`

#### 3. `loadDevices` (line 184)
**Before**: `[audioDevices.length, displays.length, windows.length, webcams.length, loadingDevices]`
**After**: Same (no changes needed)

#### 4. `handleStartSessionFromModal` (line 1586)
**Before**: `[lastSettings, startSessionWithCountdown]`
**After**: Same (no changes needed)

---

## Effect Dependency Analysis

### Effects that Need Dependency Updates

#### 1. Audio-chunk listener (line 1065)
**Before**: `[]` (empty deps - listener set up once)
**After**: `[handleAudioSegmentProcessed]` (re-register when callback changes)

**Justification**:
- Callback now depends on `activeSession` which can change
- Listener must re-register to capture fresh callback with new session

**Performance Impact**:
- Listener will re-register when active session changes
- This is acceptable - sessions don't change frequently
- Ensures callback always has fresh session data

#### 2. Session lifecycle management (line 704)
**Before**: `[activeSession?.id, activeSession?.status, activeSession?.audioRecording, activeSession?.videoRecording, activeSession?.enableScreenshots, activeSession?.screenshotInterval, handleScreenshotCaptured, handleAudioSegmentProcessed]`
**After**: Same dependencies (handleScreenshotCaptured and handleAudioSegmentProcessed will change when activeSession changes, which is correct)

---

## Elimination Progress Checklist

### Phase 1: Setup
- [x] Read SessionsZone.tsx completely
- [x] Created refs elimination plan document
- [x] Identified ALL refs in SessionsZone
- [x] Categorized each ref by solution pattern
- [ ] Verify Task 1.4 state machine exists
- [ ] Create ActiveSession context (if state machine doesn't exist)

### Phase 2: Ref Elimination
- [ ] Eliminate `activeSessionIdRef` - Replace with ActiveSession context
- [ ] Eliminate `stateRef` - Remove entirely, use context
- [ ] Eliminate `handleAudioSegmentProcessedRef` - Use callback directly
- [ ] Eliminate `prevActiveSessionIdRef` - Convert to state or split effects
- [ ] Eliminate `videoRecordingInitializedRef` - Convert to state

### Phase 3: Dependency Updates
- [ ] Update `handleScreenshotCaptured` dependencies
- [ ] Update `handleAudioSegmentProcessed` dependencies
- [ ] Update audio-chunk listener dependencies
- [ ] Verify all callbacks have correct dependencies
- [ ] Verify all effects have correct dependencies

### Phase 4: Testing
- [ ] Run ESLint - verify zero `exhaustive-deps` warnings
- [ ] Create unit tests for refactored callbacks
- [ ] Manual testing - start session, capture screenshots/audio
- [ ] Manual testing - pause/resume session
- [ ] Manual testing - end session
- [ ] Verify no lost screenshots/audio

### Phase 5: Verification
- [ ] All state refs eliminated
- [ ] Zero ESLint exhaustive-deps warnings
- [ ] All tests passing
- [ ] Manual verification successful
- [ ] Create verification report

---

## Risk Assessment

### High Risk Changes
1. **Audio-chunk listener re-registration** - Adding dependency will cause listener to re-register when session changes
   - **Mitigation**: Tauri's `listen()` properly handles cleanup, this should be safe
   - **Testing**: Verify audio chunks are received correctly after session changes

2. **Removing `stateRef`** - Callbacks currently depend on stale-proof ref
   - **Mitigation**: Use ActiveSession context which provides fresh state
   - **Testing**: Verify screenshot analysis gets correct session config

### Medium Risk Changes
1. **Converting `prevActiveSessionIdRef` to state** - May cause extra re-renders
   - **Mitigation**: Use focused effects instead of tracking previous ID
   - **Testing**: Verify video stopping works correctly

2. **Converting `videoRecordingInitializedRef` to state** - May cause effect to re-run
   - **Mitigation**: Properly guard video initialization logic
   - **Testing**: Verify video only initializes once per session

### Low Risk Changes
1. **Removing `handleAudioSegmentProcessedRef`** - Simple callback wrapper
   - **Mitigation**: None needed, straightforward change
   - **Testing**: Verify audio segments are added correctly

---

## Notes

### Why We Can't Use State Machine (Task 1.4)
Task 1.4 (XState integration) has NOT been completed yet. The following files don't exist:
- `src/hooks/useSessionMachine.ts`
- `src/machines/sessionMachine.ts`
- Any XState-based state management

**Impact**: Cannot use Pattern 1 (state machine context) from the task requirements.

**Solution**: Create a temporary ActiveSession context as a stepping stone. When Task 1.4 is completed, we can migrate from ActiveSession context to state machine context.

---

## Next Steps

1. ✅ Create ActiveSession context (this document section)
2. ⬜ Implement Phase 3 (Eliminate activeSessionIdRef)
3. ⬜ Implement Phase 4 (Eliminate stateRef)
4. ⬜ Implement Phase 5 (Eliminate handleAudioSegmentProcessedRef)
5. ⬜ Implement Phase 6 (Eliminate prevActiveSessionIdRef)
6. ⬜ Implement Phase 7 (Eliminate videoRecordingInitializedRef)
7. ⬜ Run tests and verify
8. ⬜ Create verification report

---

**Last Updated**: 2025-10-23
**Status**: Audit Complete - Ready for Implementation
