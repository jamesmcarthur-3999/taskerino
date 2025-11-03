# Agent Delegation Plan - Sessions System Fix
**Date**: 2025-10-27
**Status**: Ready for Execution
**Goal**: Fix session machine integration and eliminate data loss risks

## Executive Summary

This plan coordinates **5 specialized agents** to fix critical issues in the sessions system discovered through comprehensive audit. Total estimated time: **22 hours over 3 days** (though we're not time-constrained).

**Critical Issues to Fix**:
1. ✅ **Revert Agent**: Undo incorrect quick-fix changes (30 minutes)
2. 🔴 **Machine Integration Agent**: Fix session machine orchestration (12-18 hours)
3. 🔴 **Storage Layer Agent**: Eliminate data corruption risks (4-6 hours)
4. 🟡 **Index Enablement Agent**: Enable Phase 4 search performance (6-8 hours)
5. 🟢 **Component Fix Agent**: Fix React hooks violation (10 minutes)

**Dependencies**:
- Revert Agent → Must complete first (clears way for proper fixes)
- Machine Integration Agent → Blocks Component Fix Agent (fixes architecture)
- Storage Layer Agent → Independent (can run in parallel)
- Index Enablement Agent → Depends on Storage Layer Agent
- Component Fix Agent → Depends on Machine Integration Agent

---

## Agent #1: Revert Agent

### Mission
Revert incorrect quick-fix changes that made problems worse.

### Context
During initial troubleshooting, two incorrect changes were made:
1. **videoRecordingService.ts**: Moved state assignment from BEFORE invoke to AFTER
   - **Why Wrong**: This was actually correct for current architecture (SessionsZone bypass)
   - **Impact**: Caused undefined session.id crash
2. **RecordingStats.tsx**: Added early return BEFORE hooks
   - **Why Wrong**: Violates React Rules of Hooks
   - **Impact**: "Hooks order changed" error

### Files to Revert

#### File 1: `/Users/jamesmcarthur/Documents/taskerino/src/services/videoRecordingService.ts`
**Lines 127-162**

**Current (WRONG)**:
```typescript
const defaultQuality: VideoQuality = {
  width: 1280,
  height: 720,
  fps: 15
};

try {
  await invoke('start_video_recording', {
    sessionId: session.id,
    outputPath,
    quality: quality || defaultQuality
  });

  // Set state only after successful invoke
  this.activeSessionId = session.id;
  this.isRecording = true;
  this.recordingStartTime = Date.now();

  console.log('✅ [VIDEO SERVICE] Video recording started');
} catch (error) {
  // Reset state defensively
  this.isRecording = false;
  this.activeSessionId = null;
  this.recordingStartTime = null;
  console.error('❌ [VIDEO SERVICE] Failed to start video recording:', error);
```

**Target (CORRECT)**:
```typescript
// Set state before invoke (correct for current bypass architecture)
this.activeSessionId = session.id;
this.isRecording = true;
this.recordingStartTime = Date.now();

const defaultQuality: VideoQuality = {
  width: 1280,
  height: 720,
  fps: 15
};

try {
  await invoke('start_video_recording', {
    sessionId: session.id,
    outputPath,
    quality: quality || defaultQuality
  });

  console.log('✅ [VIDEO SERVICE] Video recording started');
} catch (error) {
  // Reset state on failure
  this.isRecording = false;
  this.activeSessionId = null;
  this.recordingStartTime = null;
  console.error('❌ [VIDEO SERVICE] Failed to start video recording:', error);
```

**Verification**:
- [ ] State assigned BEFORE invoke call
- [ ] recordingStartTime initialized before invoke
- [ ] Error handler still resets state correctly

#### File 2: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/RecordingStats.tsx`
**Lines 21-62**

**Current (WRONG)**:
```typescript
export function RecordingStats() {
  const { recordingState } = useRecording();
  const [stats, setStats] = useState<RecordingStatsType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ❌ WRONG: Early return BEFORE useEffect
  if (recordingState.video !== 'active') {
    return null;
  }

  useEffect(() => {
    // ... polling logic
  }, []);

  // ... rest of component
}
```

**Target (CORRECT)**:
```typescript
export function RecordingStats() {
  const { recordingState } = useRecording();
  const [stats, setStats] = useState<RecordingStatsType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Early return inside useEffect is fine
    if (recordingState.video !== 'active') {
      return;
    }

    // Poll stats every second
    const interval = setInterval(async () => {
      try {
        const currentStats = await videoRecordingService.getStats();
        setStats(currentStats);
        setError(null);
      } catch (err) {
        console.error('Failed to get recording stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }, 1000);

    // Initial fetch
    (async () => {
      try {
        const currentStats = await videoRecordingService.getStats();
        setStats(currentStats);
        setError(null);
      } catch (err) {
        console.error('Failed to get recording stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    })();

    return () => clearInterval(interval);
  }, [recordingState.video]);

  // ✅ CORRECT: Early return AFTER all hooks
  if (recordingState.video !== 'active' || !stats || !stats.isRecording) {
    return null;
  }

  // ... rest of component (render logic unchanged)
}
```

**Verification**:
- [ ] All hooks (useRecording, useState, useEffect) called before any return
- [ ] Early return moved to after hooks
- [ ] useEffect has proper dependencies [recordingState.video]
- [ ] Component still doesn't render when video not active

### Acceptance Criteria
- [ ] Both files reverted to correct original state
- [ ] No TypeScript errors
- [ ] Rust compilation succeeds
- [ ] App launches without crashes
- [ ] Video recording errors return to original "Session not found" (to be fixed by Machine Integration Agent)

### Estimated Time
**30 minutes** (simple revert + verification)

### Dependencies
**None** - This is the first agent that must run

---

## Agent #2: Machine Integration Agent

### Mission
Fix XState session machine to actually orchestrate recording services instead of being a "zombie" that tracks state but doesn't control anything.

### Problem Statement

**Current Architecture (BROKEN)**:
```
User clicks "Start Session"
  ↓
ActiveSessionContext.startSession() creates session
  ↓
Sends START event to machine with only { config }
  ↓
Machine invokes startRecordingServices with { sessionId, config }
  ↓
Service expects { sessionId, config, session, callbacks }
  ↓
session = UNDEFINED → CRASH
  ↓
Meanwhile, SessionsZone.tsx useEffect watches activeSession.status
  ↓
Manually starts all services (bypassing machine)
  ↓
Machine becomes "zombie" - tracks state but doesn't orchestrate
```

**Target Architecture (CORRECT)**:
```
User clicks "Start Session"
  ↓
ActiveSessionContext.startSession() creates session
  ↓
Sends START event with { config, session, callbacks }
  ↓
Machine stores session + callbacks in context
  ↓
Machine invokes startRecordingServices with all 4 parameters
  ↓
Service orchestrates all recording starts
  ↓
SessionsZone.tsx useEffect REMOVED (machine handles everything)
  ↓
Machine is "conductor" - fully orchestrates session lifecycle
```

### Files to Modify

#### File 1: `/Users/jamesmcarthur/Documents/taskerino/src/machines/sessionMachine.ts`

**Current Issues**:
- **Line 20-30**: Context missing `session` and `callbacks`
- **Line 36**: START event doesn't accept session or callbacks
- **Line 164-168**: Invoke input only passes sessionId and config

**Changes Required**:

##### Change 1.1: Update SessionMachineContext (lines 20-30)
```typescript
// BEFORE:
export interface SessionMachineContext {
  sessionId: string | null;
  config: SessionRecordingConfig | null;
  error: string | null;
}

// AFTER:
export interface SessionMachineContext {
  sessionId: string | null;
  config: SessionRecordingConfig | null;
  session: Session | null;  // ✅ NEW
  callbacks: {  // ✅ NEW
    onScreenshotCapture?: (screenshot: SessionScreenshot) => void;
    onAudioSegment?: (segment: SessionAudioSegment) => void;
  } | null;
  error: string | null;
}
```

##### Change 1.2: Update START event type (line 36)
```typescript
// BEFORE:
| { type: 'START'; config: SessionRecordingConfig }

// AFTER:
| { type: 'START';
    config: SessionRecordingConfig;
    session: Session;  // ✅ NEW
    callbacks: {  // ✅ NEW
      onScreenshotCapture?: (screenshot: SessionScreenshot) => void;
      onAudioSegment?: (segment: SessionAudioSegment) => void;
    };
  }
```

##### Change 1.3: Store session + callbacks in context (after line 58)
```typescript
// BEFORE:
START: {
  actions: assign({
    config: ({ event }) => event.config,
  }),
  target: 'validating',
},

// AFTER:
START: {
  actions: assign({
    config: ({ event }) => event.config,
    session: ({ event }) => event.session,  // ✅ NEW
    callbacks: ({ event }) => event.callbacks,  // ✅ NEW
  }),
  target: 'validating',
},
```

##### Change 1.4: Update invoke input (lines 164-168)
```typescript
// BEFORE:
starting: {
  invoke: {
    src: 'startRecordingServices',
    input: ({ context }) => ({
      sessionId: context.sessionId!,
      config: context.config!,
    }),
  }
}

// AFTER:
starting: {
  invoke: {
    src: 'startRecordingServices',
    input: ({ context }) => ({
      sessionId: context.sessionId!,
      config: context.config!,
      session: context.session!,  // ✅ NEW
      callbacks: context.callbacks!,  // ✅ NEW
    }),
  }
}
```

##### Change 1.5: Update resuming invoke input (similar pattern around line 200)
```typescript
// Apply same pattern to resumeRecordingServices invoke
resuming: {
  invoke: {
    src: 'resumeRecordingServices',
    input: ({ context }) => ({
      sessionId: context.sessionId!,
      config: context.config!,
      session: context.session!,  // ✅ NEW
      callbacks: context.callbacks!,  // ✅ NEW
    }),
  }
}
```

##### Change 1.6: Clear session + callbacks on END (around line 250)
```typescript
// BEFORE:
END: {
  actions: assign({
    sessionId: null,
    config: null,
    error: null,
  }),
  target: 'idle',
},

// AFTER:
END: {
  actions: assign({
    sessionId: null,
    config: null,
    session: null,  // ✅ NEW
    callbacks: null,  // ✅ NEW
    error: null,
  }),
  target: 'idle',
},
```

**Verification**:
- [ ] TypeScript compiles with no errors
- [ ] Machine context includes session and callbacks
- [ ] START event requires session and callbacks
- [ ] Invoke passes all 4 parameters

#### File 2: `/Users/jamesmcarthur/Documents/taskerino/src/machines/sessionMachineServices.ts`

**Current Issues**:
- **Line 165-234**: startRecordingServices expects parameters machine doesn't provide
- **Line 284-312**: resumeRecordingServices is a STUB

**Changes Required**:

##### Change 2.1: Verify startRecordingServices signature (lines 165-178)
```typescript
// This is CORRECT - just verify machine now passes these parameters
export const startRecordingServices = fromPromise(
  async ({ input }: {
    input: {
      sessionId: string;
      config: SessionRecordingConfig;
      session: Session;  // Machine must pass this
      callbacks: {      // Machine must pass this
        onScreenshotCapture?: (screenshot: SessionScreenshot) => void;
        onAudioSegment?: (segment: SessionAudioSegment) => void;
      };
    }
  }) => {
    // Implementation is fine - machine was the problem
  }
);
```

##### Change 2.2: Implement resumeRecordingServices (lines 284-312)
```typescript
// BEFORE (STUB):
export const resumeRecordingServices = fromPromise(
  async ({ input }: {
    input: {
      sessionId: string;
      config: SessionRecordingConfig;
    }
  }) => {
    // ... stub comments about RecordingContext handling it
    console.log(`[sessionMachine] Screenshot service resume (handled by RecordingContext)`);
    // ... more stubs
  }
);

// AFTER (IMPLEMENTED):
export const resumeRecordingServices = fromPromise(
  async ({ input }: {
    input: {
      sessionId: string;
      config: SessionRecordingConfig;
      session: Session;  // ✅ NEW
      callbacks: {      // ✅ NEW
        onScreenshotCapture?: (screenshot: SessionScreenshot) => void;
        onAudioSegment?: (segment: SessionAudioSegment) => void;
      };
    }
  }) => {
    const { sessionId, config, session, callbacks } = input;

    console.log(`[sessionMachine] Resuming recording services for session: ${sessionId}`);

    const services = [];

    // Resume screenshots if enabled
    if (config.enableScreenshots) {
      console.log(`[sessionMachine] Resuming screenshot capture`);
      services.push(
        startScreenshotService(sessionId, session, callbacks.onScreenshotCapture)
      );
    }

    // Resume audio if enabled
    if (config.audioRecording) {
      console.log(`[sessionMachine] Resuming audio recording`);
      services.push(
        startAudioService(sessionId, session, callbacks.onAudioSegment)
      );
    }

    // Resume video if enabled
    if (config.videoRecording) {
      console.log(`[sessionMachine] Resuming video recording`);
      services.push(
        startVideoService(sessionId, session)
      );
    }

    // Start all services in parallel
    await Promise.all(services);

    console.log(`[sessionMachine] ✅ All recording services resumed`);
  }
);
```

**Verification**:
- [ ] resumeRecordingServices fully implemented (no stubs)
- [ ] Proper error handling
- [ ] Logging matches startRecordingServices pattern

#### File 3: `/Users/jamesmcarthur/Documents/taskerino/src/context/ActiveSessionContext.tsx`

**Current Issues**:
- **Line 222**: Comment admits "Machine services are stubs, so we handle actual work here"
- **Line 223**: Only passes config to machine

**Changes Required**:

##### Change 3.1: Update startSession to pass complete data (around line 223)
```typescript
// BEFORE:
// Note: Machine services are stubs, so we handle actual work here
send({ type: 'START', config: sessionConfig });

// AFTER:
// Machine now fully handles recording orchestration
send({
  type: 'START',
  config: sessionConfig,
  session: newSession,  // ✅ NEW
  callbacks: {         // ✅ NEW
    onScreenshotCapture: addScreenshot,
    onAudioSegment: addAudioSegment,
  },
});
```

##### Change 3.2: Remove or update comment (line 222)
```typescript
// BEFORE:
// Note: Machine services are stubs, so we handle actual work here

// AFTER (remove or update):
// Machine handles all recording service orchestration
```

**Verification**:
- [ ] START event includes session and callbacks
- [ ] addScreenshot and addAudioSegment are available in scope
- [ ] Comment updated to reflect new architecture

#### File 4: `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionsZone.tsx`

**Current Issues**:
- **Lines 791-987**: 200-line useEffect bypassing machine

**Changes Required**:

##### Change 4.1: Simplify or remove useEffect (lines 791-987)

**OPTION A - Remove Entirely** (Recommended):
```typescript
// DELETE lines 791-987
// Machine now handles all service orchestration

// Keep only essential UI logic (if any)
```

**OPTION B - Reduce to Minimal Observer** (If needed for UI):
```typescript
// BEFORE: 200 lines of manual service starts
useEffect(() => {
  if (!activeSession) {
    stopAll();
    return;
  }

  if (activeSession.status === 'active') {
    // ❌ Manual starts (DELETE)
    if (activeSession.enableScreenshots && !isCurrentlyCapturing) {
      startScreenshots(activeSession, handleScreenshotCaptured);
    }
    // ... etc
  }
}, [/* 15 dependencies */]);

// AFTER: Minimal UI state observer only
useEffect(() => {
  if (!activeSession) {
    return; // Machine handles cleanup
  }

  // Only update UI state based on machine state
  // NO direct service calls

  console.log(`[SessionsZone] Active session status: ${activeSession.status}`);
}, [activeSession?.id, activeSession?.status]);
```

**Verification**:
- [ ] No direct calls to startScreenshots, startAudio, startVideo
- [ ] useEffect reduced from 200 lines to <20 lines or removed
- [ ] Machine fully controls service lifecycle

### Testing Requirements

#### Unit Tests (New)
Create: `/Users/jamesmcarthur/Documents/taskerino/src/machines/sessionMachine.test.ts`

```typescript
describe('sessionMachine - Integration Fix', () => {
  it('should store session and callbacks in context on START', () => {
    const machine = createActor(sessionMachine);
    machine.start();

    const session = createMockSession();
    const callbacks = { onScreenshotCapture: vi.fn() };

    machine.send({
      type: 'START',
      config: mockConfig,
      session,
      callbacks,
    });

    expect(machine.getSnapshot().context.session).toEqual(session);
    expect(machine.getSnapshot().context.callbacks).toEqual(callbacks);
  });

  it('should pass all 4 parameters to startRecordingServices', async () => {
    const mockService = vi.fn().mockResolvedValue(undefined);
    const machine = createActor(sessionMachine, {
      services: { startRecordingServices: mockService },
    });

    const session = createMockSession();
    machine.start();
    machine.send({
      type: 'START',
      config: mockConfig,
      session,
      callbacks: mockCallbacks,
    });

    await waitFor(() => {
      expect(mockService).toHaveBeenCalledWith({
        input: {
          sessionId: session.id,
          config: mockConfig,
          session,
          callbacks: mockCallbacks,
        },
      });
    });
  });

  it('should implement resumeRecordingServices (not stub)', async () => {
    // Test that resume actually starts services
    const machine = createActor(sessionMachine);
    machine.start();

    // ... start session, pause, then resume
    machine.send({ type: 'PAUSE' });
    await waitFor(() => machine.getSnapshot().matches('paused'));

    machine.send({ type: 'RESUME' });
    await waitFor(() => machine.getSnapshot().matches('active'));

    // Verify services restarted
    expect(screenshotCaptureService.isCapturing()).toBe(true);
  });
});
```

#### Integration Tests

**Test 1: End-to-End Session Start**
```typescript
describe('Session Start Integration', () => {
  it('should start session through machine without SessionsZone bypass', async () => {
    render(<SessionsZone />);

    // Start session
    fireEvent.click(screen.getByText('Start Session'));
    fireEvent.change(screen.getByPlaceholderText('Session name'), {
      target: { value: 'Test Session' },
    });
    fireEvent.click(screen.getByText('Start'));

    // Verify machine handled everything
    await waitFor(() => {
      expect(screen.getByText('Recording')).toBeInTheDocument();
      expect(screenshotCaptureService.isCapturing()).toBe(true);
      expect(audioRecordingService.isRecording()).toBe(true);
    });

    // No errors
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
  });
});
```

**Test 2: Pause/Resume Flow**
```typescript
describe('Session Pause/Resume', () => {
  it('should pause and resume services through machine', async () => {
    // Start session
    const { activeSession } = useActiveSession();
    await startSession({ name: 'Test', enableScreenshots: true });

    // Pause
    await pauseSession();
    await waitFor(() => {
      expect(activeSession?.status).toBe('paused');
      expect(screenshotCaptureService.isCapturing()).toBe(false);
    });

    // Resume
    await resumeSession();
    await waitFor(() => {
      expect(activeSession?.status).toBe('active');
      expect(screenshotCaptureService.isCapturing()).toBe(true);
    });
  });
});
```

### Acceptance Criteria

- [ ] Machine context includes session and callbacks
- [ ] START event requires session and callbacks
- [ ] Machine invokes services with all 4 parameters
- [ ] resumeRecordingServices fully implemented (no stubs)
- [ ] ActiveSessionContext passes complete data to machine
- [ ] SessionsZone useEffect reduced or removed
- [ ] No "undefined is not an object" errors
- [ ] Video recording starts successfully
- [ ] Pause/resume works through machine
- [ ] All tests pass (21 existing + 8 new = 29 total)
- [ ] No TypeScript errors
- [ ] Rust compilation succeeds

### Estimated Time
**12-18 hours** (complex multi-file refactor with testing)

### Dependencies
- **Requires**: Revert Agent complete (clears way)
- **Blocks**: Component Fix Agent (RecordingStats needs working video service)

---

## Agent #3: Storage Layer Agent

### Mission
Eliminate all writes to deprecated 'sessions' storage key to prevent data corruption and sync issues with ChunkedStorage.

### Problem Statement

**Current Issue**:
Four code paths still write directly to old 'sessions' storage key:
1. SessionsContext.tsx fallback (line 829)
2. ProfileZone.tsx import (line 235)
3. videoChapteringService.ts monolithic save (line 372)
4. batchScreenshotAnalysis.ts monolithic save (line 274)

**Impact**:
- ChunkedStorage becomes out of sync with old storage
- 50MB writes cause 2-3s UI freezes
- Data loss risk when mixing storage layers
- Phase 4 optimizations (50% storage reduction, 20-50x search speed) unusable

### Files to Modify

#### File 1: `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionsContext.tsx`

**Line 829**: Remove fallback write to old storage key

**Current (WRONG)**:
```typescript
// Fallback on PersistenceQueue failure
} catch (flushError) {
  console.error('[SessionsContext] PersistenceQueue flush failed, falling back to direct save:', flushError);
  // ❌ WRONG: Writes to old storage key
  await storage.save('sessions', stateRef.current.sessions);
}
```

**Target (CORRECT)**:
```typescript
// Fallback on PersistenceQueue failure
} catch (flushError) {
  console.error('[SessionsContext] PersistenceQueue flush failed:', flushError);

  // ✅ CORRECT: Use ChunkedStorage for fallback
  const chunkedStorage = await getChunkedStorage();

  for (const session of stateRef.current.sessions) {
    try {
      await chunkedStorage.saveSession(session);
    } catch (saveError) {
      console.error(`[SessionsContext] Failed to save session ${session.id}:`, saveError);
      // Log but continue - don't fail entire save
    }
  }
}
```

**Verification**:
- [ ] No `storage.save('sessions', ...)` calls
- [ ] Uses ChunkedStorage for fallback
- [ ] Error handling preserves all sessions even if one fails

#### File 2: `/Users/jamesmcarthur/Documents/taskerino/src/components/ProfileZone.tsx`

**Line 235**: Fix import to use ChunkedStorage

**Current (WRONG)**:
```typescript
// Import backup file
if (data.sessions) {
  console.log(`Importing ${data.sessions.length} sessions...`);
  // ❌ WRONG: Bypasses ChunkedStorage
  await storage.save('sessions', data.sessions);
  dispatch({ type: 'LOAD_SESSIONS_SUCCESS', payload: data.sessions });
}
```

**Target (CORRECT)**:
```typescript
// Import backup file
if (data.sessions) {
  console.log(`Importing ${data.sessions.length} sessions...`);

  // ✅ CORRECT: Import through ChunkedStorage
  const chunkedStorage = await getChunkedStorage();
  const indexManager = await getInvertedIndexManager();

  let importedCount = 0;
  let failedCount = 0;

  for (const session of data.sessions) {
    try {
      // Save to ChunkedStorage
      await chunkedStorage.saveSession(session);

      // Update indexes
      await indexManager.updateSession(session);

      importedCount++;
    } catch (error) {
      console.error(`Failed to import session ${session.id}:`, error);
      failedCount++;
    }
  }

  console.log(`Import complete: ${importedCount} succeeded, ${failedCount} failed`);

  // Reload sessions from ChunkedStorage
  dispatch({ type: 'LOAD_SESSIONS_REQUEST' });
}
```

**Verification**:
- [ ] No `storage.save('sessions', ...)` calls
- [ ] Uses ChunkedStorage for imports
- [ ] Updates InvertedIndexManager for search
- [ ] Handles partial failures gracefully
- [ ] Reloads sessions from ChunkedStorage after import

#### File 3: `/Users/jamesmcarthur/Documents/taskerino/src/services/videoChapteringService.ts`

**Line 372**: Fix video chapter save to use ChunkedStorage

**Current (WRONG)**:
```typescript
// Update session with chapters
session.video.chapters = videoChapters;

// ❌ WRONG: Saves entire 50MB sessions array for one update
await storage.save('sessions', sessions);
```

**Target (CORRECT)**:
```typescript
// Update session with chapters
session.video.chapters = videoChapters;

// ✅ CORRECT: Save only the updated session
const chunkedStorage = await getChunkedStorage();
await chunkedStorage.saveSession(session);

// Update search index
const indexManager = await getInvertedIndexManager();
await indexManager.updateSession(session);

console.log(`✅ Video chapters saved for session ${session.id}`);
```

**Verification**:
- [ ] No monolithic `storage.save('sessions', ...)` calls
- [ ] Uses ChunkedStorage.saveSession() for single session
- [ ] Updates InvertedIndexManager
- [ ] 0ms UI blocking (PersistenceQueue handles async)

#### File 4: `/Users/jamesmcarthur/Documents/taskerino/src/services/batchScreenshotAnalysis.ts`

**Line 274**: Fix batch analysis save to use ChunkedStorage

**Current (WRONG)**:
```typescript
// Update screenshots with analysis
sessions[sessionIndex].screenshots = screenshots;

// ❌ WRONG: Saves entire 50MB array for screenshot updates
await storage.save('sessions', sessions);
```

**Target (CORRECT)**:
```typescript
// Update screenshots with analysis
const session = sessions[sessionIndex];
session.screenshots = screenshots;

// ✅ CORRECT: Use ChunkedStorage append operation
const chunkedStorage = await getChunkedStorage();

// Append updated screenshots (efficient chunk updates)
for (const screenshot of screenshots) {
  await chunkedStorage.appendScreenshot(session.id, screenshot);
}

// Update index for search
const indexManager = await getInvertedIndexManager();
await indexManager.updateSession(session);

console.log(`✅ Batch screenshot analysis saved for session ${session.id}`);
```

**Verification**:
- [ ] No monolithic `storage.save('sessions', ...)` calls
- [ ] Uses ChunkedStorage.appendScreenshot() for efficiency
- [ ] Updates InvertedIndexManager
- [ ] 0ms UI blocking (PersistenceQueue handles async)

### Verification Tests

#### Verification 1: Grep for remaining old storage usage
```bash
cd /Users/jamesmcarthur/Documents/taskerino
grep -r "storage.save('sessions'," src/ --include="*.ts" --include="*.tsx"
# Expected: 0 results
```

#### Verification 2: Test import flow
```typescript
describe('ProfileZone - Backup Import', () => {
  it('should import sessions through ChunkedStorage', async () => {
    const backupData = {
      sessions: [createMockSession(), createMockSession()],
    };

    // Import
    await importBackup(backupData);

    // Verify saved to ChunkedStorage
    const chunkedStorage = await getChunkedStorage();
    const metadata = await chunkedStorage.loadAllMetadata();
    expect(metadata).toHaveLength(2);

    // Verify indexed
    const indexManager = await getInvertedIndexManager();
    const results = await indexManager.search({ text: 'test' });
    expect(results.sessionIds).toContain(backupData.sessions[0].id);
  });
});
```

#### Verification 3: Test video chapter save
```typescript
describe('videoChapteringService', () => {
  it('should save chapters through ChunkedStorage', async () => {
    const session = createMockSession();
    await chunkedStorage.saveSession(session);

    // Add chapters
    await videoChapteringService.generateChapters(session.id);

    // Verify saved to ChunkedStorage (not old storage)
    const loaded = await chunkedStorage.loadFullSession(session.id);
    expect(loaded.video?.chapters).toBeDefined();
    expect(loaded.video?.chapters?.length).toBeGreaterThan(0);
  });
});
```

### Acceptance Criteria

- [ ] Zero `storage.save('sessions', ...)` calls in codebase
- [ ] SessionsContext fallback uses ChunkedStorage
- [ ] ProfileZone import uses ChunkedStorage + indexes
- [ ] videoChapteringService uses ChunkedStorage.saveSession()
- [ ] batchScreenshotAnalysis uses ChunkedStorage.appendScreenshot()
- [ ] All 4 verification tests pass
- [ ] Grep shows no old storage usage
- [ ] No UI freezes during saves
- [ ] Import flow preserves all data
- [ ] Search indexes updated correctly

### Estimated Time
**4-6 hours** (4 files + verification tests)

### Dependencies
- **Independent** - Can run in parallel with Machine Integration Agent
- **Blocks** - Index Enablement Agent (must have clean storage first)

---

## Agent #4: Index Enablement Agent

### Mission
Remove TODO and enable InvertedIndexManager for 20-50x search performance improvement.

### Problem Statement

**Current Issue**:
- InvertedIndexManager exists and is fully implemented (71 tests passing)
- Line 520 in SessionListContext has TODO comment: "integrate async indexed search in Phase 4.3.2"
- Search falls back to linear scan (lines 522-564)
- 20-50x slower than design goal

**Impact**:
- Search on 100 sessions: 2-3s (should be <100ms)
- Linear scan doesn't scale (O(n) vs O(log n))
- Phase 4 benefits unrealized despite complete implementation

### Files to Modify

#### File 1: `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionListContext.tsx`

**Lines 520-564**: Replace linear scan with indexed search

**Current (TODO)**:
```typescript
// Line 520
// TODO: integrate async indexed search in Phase 4.3.2
if (hasIndexableFilters) {
  console.log('[SessionListContext] Using linear scan fallback for filters:', {
    searchTerm,
    selectedTopics,
    selectedTags,
  });

  // Lines 522-564: Linear scan implementation
  let filtered = [...sessions];

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(session =>
      session.name.toLowerCase().includes(term) ||
      session.description?.toLowerCase().includes(term) ||
      // ... many more lines
    );
  }

  if (selectedTopics.length > 0) {
    // ... more filtering
  }

  if (selectedTags.length > 0) {
    // ... more filtering
  }

  setFilteredSessions(filtered);
  return;
}
```

**Target (INDEXED)**:
```typescript
// ✅ CORRECT: Use InvertedIndexManager
if (hasIndexableFilters) {
  console.log('[SessionListContext] Using indexed search for filters:', {
    searchTerm,
    selectedTopics,
    selectedTags,
  });

  const indexManager = await getInvertedIndexManager();

  // Build search query
  const query: InvertedIndexSearchQuery = {
    text: searchTerm || undefined,
    topics: selectedTopics.length > 0 ? selectedTopics : undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    operator: 'AND',  // All filters must match
  };

  // Execute indexed search (20-50x faster)
  const startTime = performance.now();
  const results = await indexManager.search(query);
  const duration = performance.now() - startTime;

  console.log(`[SessionListContext] Indexed search completed in ${duration.toFixed(2)}ms (${results.sessionIds.length} results)`);

  // Filter sessions by indexed results
  const resultSet = new Set(results.sessionIds);
  const filtered = sessions.filter(s => resultSet.has(s.id));

  setFilteredSessions(filtered);
  return;
}
```

**Verification**:
- [ ] TODO comment removed
- [ ] Uses InvertedIndexManager.search()
- [ ] Search completes in <100ms (target)
- [ ] Results match expected sessions
- [ ] Logs search duration for monitoring

#### File 2: `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionListContext.tsx`

**Add index updates after session mutations** (multiple locations)

**Locations to Add**:
1. After ADD_SESSION (around line 150)
2. After UPDATE_SESSION (around line 200)
3. After DELETE_SESSION (around line 250)
4. After LOAD_SESSIONS_SUCCESS (around line 100)

**Pattern to Add**:
```typescript
// Example: After ADD_SESSION
case 'ADD_SESSION': {
  const newSessions = [...state.sessions, action.payload];

  // Update indexes
  (async () => {
    try {
      const indexManager = await getInvertedIndexManager();
      await indexManager.updateSession(action.payload);
    } catch (error) {
      console.error('[SessionListContext] Failed to update index:', error);
      // Non-fatal - search will use linear scan fallback
    }
  })();

  return { ...state, sessions: newSessions };
}

// Apply same pattern to UPDATE_SESSION, DELETE_SESSION, LOAD_SESSIONS_SUCCESS
```

**Verification**:
- [ ] Index updated after ADD_SESSION
- [ ] Index updated after UPDATE_SESSION
- [ ] Index updated after DELETE_SESSION
- [ ] Index updated after LOAD_SESSIONS_SUCCESS
- [ ] Errors logged but non-fatal

#### File 3: `/Users/jamesmcarthur/Documents/taskerino/src/App.tsx`

**Add Phase 4 migration check** (around line 50, in useEffect)

**Current (MISSING)**:
```typescript
useEffect(() => {
  // App initialization
  const init = async () => {
    // ... existing init logic
  };

  init();
}, []);
```

**Target (WITH MIGRATION CHECK)**:
```typescript
useEffect(() => {
  // App initialization
  const init = async () => {
    // ... existing init logic

    // ✅ NEW: Check Phase 4 migration status
    const storage = getStorage();
    const migrationComplete = await storage.load('phase4-migration-complete');

    if (!migrationComplete) {
      console.log('[App] Phase 4 storage migration not complete, running migration...');

      try {
        const result = await migrateToPhase4Storage({
          dryRun: false,
          verbose: true,
          onProgress: (progress) => {
            console.log(`[App] Migration: ${progress.percentage}% complete`);
            // TODO: Show progress UI (future enhancement)
          },
        });

        if (result.success) {
          await storage.save('phase4-migration-complete', true);
          console.log('[App] ✅ Phase 4 migration complete');
        } else {
          console.error('[App] ❌ Phase 4 migration failed:', result.errors);
          // App continues with Phase 3 storage (graceful degradation)
        }
      } catch (error) {
        console.error('[App] Phase 4 migration error:', error);
        // Non-fatal - app continues
      }
    } else {
      console.log('[App] Phase 4 storage already migrated');
    }
  };

  init();
}, []);
```

**Verification**:
- [ ] Migration check runs on app startup
- [ ] Migration runs if not complete
- [ ] Migration status persisted to storage
- [ ] Errors logged but non-fatal (app continues)
- [ ] Progress logged to console

### Performance Testing

#### Performance Test 1: Search Latency
```typescript
describe('Indexed Search Performance', () => {
  it('should complete search in <100ms', async () => {
    // Create 100 test sessions
    const sessions = Array.from({ length: 100 }, () => createMockSession());
    await Promise.all(sessions.map(s => chunkedStorage.saveSession(s)));

    // Build indexes
    const indexManager = await getInvertedIndexManager();
    await Promise.all(sessions.map(s => indexManager.updateSession(s)));

    // Measure search latency
    const startTime = performance.now();
    const results = await indexManager.search({ text: 'test', operator: 'AND' });
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(100);  // <100ms target
    expect(results.sessionIds.length).toBeGreaterThan(0);
  });
});
```

#### Performance Test 2: Linear Scan Comparison
```typescript
describe('Search Performance Comparison', () => {
  it('should be 20-50x faster than linear scan', async () => {
    const sessions = Array.from({ length: 100 }, () => createMockSession());

    // Linear scan
    const linearStart = performance.now();
    const linearResults = sessions.filter(s =>
      s.name.toLowerCase().includes('test') ||
      s.description?.toLowerCase().includes('test')
    );
    const linearDuration = performance.now() - linearStart;

    // Indexed search
    const indexManager = await getInvertedIndexManager();
    await Promise.all(sessions.map(s => indexManager.updateSession(s)));

    const indexedStart = performance.now();
    const indexedResults = await indexManager.search({ text: 'test' });
    const indexedDuration = performance.now() - indexedStart;

    const speedup = linearDuration / indexedDuration;
    console.log(`Speedup: ${speedup.toFixed(1)}x`);

    expect(speedup).toBeGreaterThan(20);  // 20x minimum
    expect(indexedResults.sessionIds.length).toBe(linearResults.length);
  });
});
```

### Acceptance Criteria

- [ ] TODO comment removed from SessionListContext
- [ ] InvertedIndexManager.search() used for filtered searches
- [ ] Index updates added after all session mutations
- [ ] Phase 4 migration check in App.tsx
- [ ] Search latency <100ms (target achieved)
- [ ] 20-50x faster than linear scan (verified)
- [ ] All performance tests pass
- [ ] Migration runs automatically for existing users
- [ ] Errors logged but non-fatal

### Estimated Time
**6-8 hours** (index integration + migration + performance testing)

### Dependencies
- **Requires**: Storage Layer Agent complete (clean storage)
- **Independent of**: Machine Integration Agent (can overlap)

---

## Agent #5: Component Fix Agent

### Mission
Fix React hooks violation in RecordingStats component (already partially reverted by Revert Agent).

### Problem Statement

After Revert Agent completes, RecordingStats will have early return after hooks, which is correct. However, we need to ensure it's properly integrated with the fixed video recording service.

### Files to Verify/Modify

#### File 1: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/RecordingStats.tsx`

**Verification After Revert Agent**:
- [ ] All hooks called before any return
- [ ] useEffect properly handles recordingState.video check
- [ ] Early return at end of component (after hooks)

**Additional Changes (if needed)**:
```typescript
export function RecordingStats() {
  const { recordingState } = useRecording();
  const [stats, setStats] = useState<RecordingStatsType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ✅ Check inside useEffect
    if (recordingState.video !== 'active') {
      return;
    }

    // Poll stats every second
    const interval = setInterval(async () => {
      try {
        const currentStats = await videoRecordingService.getStats();
        setStats(currentStats);
        setError(null);
      } catch (err) {
        console.error('Failed to get recording stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }, 1000);

    // Initial fetch
    (async () => {
      try {
        const currentStats = await videoRecordingService.getStats();
        setStats(currentStats);
        setError(null);
      } catch (err) {
        console.error('Failed to get recording stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    })();

    return () => clearInterval(interval);
  }, [recordingState.video]);  // ✅ Proper dependency

  // ✅ Early return AFTER hooks
  if (recordingState.video !== 'active' || !stats || !stats.isRecording) {
    return null;
  }

  // ... render logic (unchanged)
}
```

### Integration Testing

#### Test 1: Component renders when video active
```typescript
describe('RecordingStats Component', () => {
  it('should render when video recording is active', async () => {
    // Mock recording state
    const mockRecordingState = { video: 'active' };
    vi.mocked(useRecording).mockReturnValue({
      recordingState: mockRecordingState,
      // ... other methods
    });

    // Mock service
    const mockStats = {
      isRecording: true,
      framesProcessed: 100,
      framesDropped: 2,
    };
    vi.mocked(videoRecordingService.getStats).mockResolvedValue(mockStats);

    render(<RecordingStats />);

    // Wait for initial fetch
    await waitFor(() => {
      expect(screen.getByText('Recording')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();  // Frames
    });
  });

  it('should not render when video not active', () => {
    const mockRecordingState = { video: 'idle' };
    vi.mocked(useRecording).mockReturnValue({
      recordingState: mockRecordingState,
    });

    const { container } = render(<RecordingStats />);
    expect(container.firstChild).toBeNull();
  });

  it('should poll stats every second', async () => {
    vi.useFakeTimers();

    const mockRecordingState = { video: 'active' };
    vi.mocked(useRecording).mockReturnValue({
      recordingState: mockRecordingState,
    });

    const mockStats = { isRecording: true, framesProcessed: 100 };
    const getStatsSpy = vi.spyOn(videoRecordingService, 'getStats')
      .mockResolvedValue(mockStats);

    render(<RecordingStats />);

    // Initial call
    await waitFor(() => expect(getStatsSpy).toHaveBeenCalledTimes(1));

    // Advance 1 second
    vi.advanceTimersByTime(1000);
    await waitFor(() => expect(getStatsSpy).toHaveBeenCalledTimes(2));

    // Advance 1 more second
    vi.advanceTimersByTime(1000);
    await waitFor(() => expect(getStatsSpy).toHaveBeenCalledTimes(3));

    vi.useRealTimers();
  });
});
```

### Acceptance Criteria

- [ ] Component follows React Rules of Hooks
- [ ] No "Hooks order changed" errors
- [ ] Stats display correctly when video active
- [ ] Component hidden when video not active
- [ ] Polling interval works (every 1 second)
- [ ] All 3 tests pass
- [ ] No console errors

### Estimated Time
**10 minutes** (verification + minor adjustments if needed)

### Dependencies
- **Requires**: Revert Agent complete (hooks in correct order)
- **Requires**: Machine Integration Agent complete (video service working)

---

## Execution Order and Coordination

### Phase 1: Foundation (Sequential)
1. **Revert Agent** (30 min)
   - Clears incorrect changes
   - Prepares codebase for proper fixes
   - **MUST complete first**

### Phase 2: Core Fixes (Parallel Possible)
2. **Machine Integration Agent** (12-18 hours)
   - Critical fix for session orchestration
   - Independent of storage fixes
   - **Can run in parallel with Storage Layer Agent**

3. **Storage Layer Agent** (4-6 hours)
   - Critical fix for data integrity
   - Independent of machine fixes
   - **Can run in parallel with Machine Integration Agent**

### Phase 3: Optimization (Sequential after Phase 2)
4. **Index Enablement Agent** (6-8 hours)
   - Requires Storage Layer Agent complete (clean storage)
   - Can start immediately after Storage Layer Agent
   - Independent of Machine Integration Agent

### Phase 4: Polish (Sequential after Phase 2)
5. **Component Fix Agent** (10 min)
   - Requires Revert Agent + Machine Integration Agent complete
   - Quick verification and minor fixes
   - **Final step**

### Total Timeline

**Sequential (Conservative)**:
- Phase 1: 0.5 hours
- Phase 2: 18 hours (longest path)
- Phase 3: 8 hours
- Phase 4: 0.17 hours
- **Total: 26.67 hours (~3.3 days)**

**Parallel (Optimized)**:
- Phase 1: 0.5 hours
- Phase 2: 18 hours (parallel)
- Phase 3: 8 hours (after storage)
- Phase 4: 0.17 hours
- **Total: 26.67 hours wall time, but ~22 hours with parallelization**

---

## Verification Checklist

### Pre-Flight Checks (Before Starting)
- [ ] App currently running (verify with `npm run tauri:dev`)
- [ ] No uncommitted changes (or create backup branch)
- [ ] All background processes noted (5 bash processes running)

### After Revert Agent
- [ ] Both files reverted successfully
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] No Rust errors (`cd src-tauri && cargo check`)
- [ ] App launches without crashes

### After Machine Integration Agent
- [ ] Machine context includes session and callbacks
- [ ] No "undefined is not an object" errors
- [ ] Video recording starts successfully
- [ ] Pause/resume works
- [ ] 29 machine tests pass

### After Storage Layer Agent
- [ ] Zero `storage.save('sessions', ...)` calls (verified by grep)
- [ ] Import flow works correctly
- [ ] Video chaptering saves correctly
- [ ] Batch analysis saves correctly
- [ ] No UI freezes during saves

### After Index Enablement Agent
- [ ] Search completes in <100ms
- [ ] 20-50x faster than linear scan
- [ ] Phase 4 migration runs automatically
- [ ] All sessions indexed

### After Component Fix Agent
- [ ] RecordingStats renders correctly
- [ ] No hooks violations
- [ ] Stats polling works

### Final Integration Check
- [ ] Start session → All services start
- [ ] Pause session → All services pause
- [ ] Resume session → All services resume
- [ ] End session → Enrichment triggers
- [ ] Search sessions → <100ms latency
- [ ] Import backup → All data preserved
- [ ] No console errors
- [ ] No memory leaks (run for 10 minutes)

---

## Risk Mitigation

### Risk 1: Machine Refactor Breaks Existing Flows
**Mitigation**: Comprehensive testing before removing SessionsZone bypass

**Rollback Plan**: Keep SessionsZone.tsx useEffect commented (not deleted) until verified working

### Risk 2: Storage Migration Causes Data Loss
**Mitigation**:
- Test import flow with backup files first
- Verify ChunkedStorage parity with old storage
- Keep fallback path for emergencies

**Rollback Plan**: Phase 4 migration system has built-in rollback (30-day retention)

### Risk 3: Index Performance Doesn't Meet Target
**Mitigation**:
- Performance tests verify <100ms latency
- Fallback to linear scan if indexes corrupt

**Rollback Plan**: Leave TODO comment in place until performance verified

### Risk 4: Multiple Agents Create Merge Conflicts
**Mitigation**: Clear execution order (sequential phases)

**Conflict Resolution**: Storage and Machine agents touch different files (no conflicts expected)

---

## Success Criteria

### Definition of "Fully Working System"

✅ **Session Lifecycle**:
- [ ] Machine fully orchestrates recording services (no bypasses)
- [ ] Start → All services start through machine
- [ ] Pause → All services pause through machine
- [ ] Resume → All services resume through machine
- [ ] End → Enrichment triggers correctly

✅ **Data Integrity**:
- [ ] Zero writes to old 'sessions' storage key
- [ ] All saves use ChunkedStorage
- [ ] Import preserves all data
- [ ] No sync issues between storage layers

✅ **Performance**:
- [ ] Search latency <100ms (20-50x improvement)
- [ ] No UI freezes during saves
- [ ] Phase 4 optimizations fully realized

✅ **Code Quality**:
- [ ] Zero TypeScript errors
- [ ] Zero Rust errors
- [ ] All tests pass (existing + new)
- [ ] No React violations
- [ ] No console errors

✅ **Architecture**:
- [ ] Machine is "conductor" (not "zombie")
- [ ] Clean separation of concerns
- [ ] World-class system (not patchwork)

---

## Notes for Agents

### Communication Protocol
Each agent must provide:
1. **Before-After Evidence**: Screenshots or logs showing state before and after changes
2. **Test Results**: All test output (passing tests)
3. **Verification Results**: Checklist completion status
4. **Blockers**: Any issues encountered that need human decision

### When to Ask for Help
- TypeScript errors not covered in plan
- Unexpected architecture differences
- Test failures not covered by plan
- Merge conflicts with other agents

### Documentation Updates
Each agent should update:
- Relevant documentation in `/docs/sessions-rewrite/`
- Add comments explaining architectural decisions
- Update tests to reflect new patterns

---

**Plan Status**: Ready for Execution
**Next Step**: Launch Revert Agent
**Expected Completion**: 3-4 days (with parallel execution)
