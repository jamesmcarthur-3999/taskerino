# Phase 2 Issue Resolution Plan

**Date**: October 24, 2025
**Version**: 1.0
**Status**: CRITICAL - Storage Integration Issues Identified

---

## Executive Summary

### Storage Alignment Status: **MISALIGNED - CRITICAL INTEGRATION GAPS**

Phase 1 and Phase 2 are **NOT properly integrated with the storage system**. While Phase 1 introduced excellent storage improvements (transactions, PersistenceQueue), Phase 2's multi-source recording is **not persisting video data to sessions**.

**Critical Issues Count**: **2 blocking issues**
**Major Issues Count**: **6 issues**
**Minor Issues Count**: **12 issues**
**Total Fix Time**: **12-18 hours** (critical path: 6-8 hours)

### Ready to Start: **YES** - All prerequisites clear, fix plan actionable

---

## Storage Alignment Analysis

### Current Storage Architecture (Phase 1 - Complete)

Phase 1 successfully implemented a robust dual-adapter storage system:

1. **Transaction Support** (`storage/index.ts`):
   - Atomic multi-key transactions
   - IndexedDB: Native `IDBTransaction`
   - Tauri FS: Staging directory pattern with atomic rename
   - Full rollback capability on failure
   - ✅ Status: **WORKING**

2. **Persistence Queue** (`storage/PersistenceQueue.ts`):
   - 3 priority levels (critical, normal, low)
   - Zero UI blocking (was 200-500ms, now 0ms)
   - Automatic retry with exponential backoff
   - Event system for tracking
   - Queue size limit (1000 items)
   - ✅ Status: **WORKING**

3. **Dual-Adapter Pattern**:
   - Browser: `IndexedDBAdapter` - Uses IndexedDB
   - Desktop (Tauri): `TauriFileSystemAdapter` - Native file system
   - Auto-detection via `getStorage()`
   - ✅ Status: **WORKING**

### Phase 1/2 Integration Status

| Component | Aligned | Misaligned | Verification Needed |
|-----------|---------|------------|---------------------|
| **Session Schema** | ✅ | - | SessionVideo fits schema perfectly |
| **Storage Keys** | ✅ | - | Sessions stored as `sessions` key |
| **Transactions** | - | ❌ | Phase 2 NOT using transaction API |
| **Queue Integration** | - | ❌ | Phase 2 NOT using PersistenceQueue |
| **Context Usage** | - | ⚠️ | Phase 2 uses DEPRECATED SessionsContext |
| **Video Metadata** | ✅ | - | Compositor/sources can be stored |
| **Attachment Storage** | ✅ | - | videoStorageService creates attachments |
| **Migration Path** | ✅ | - | Schema is backward compatible |

### Compatibility Issues Found

#### Issue 1: Video Recording Not Persisted to Session (CRITICAL)

**Impact**: Multi-source recordings are lost - session.video field never populated
**Root Cause**: SessionsContext.endSession() does NOT call videoRecordingService.stopRecording()

**Current Code** (`SessionsContext.tsx`, lines 912-993):
```typescript
endSession: React.useCallback(async (id: string) => {
  // ...

  // Stop screenshot capture ✅
  screenshotCaptureService.stopCapture();

  // Stop audio recording ✅
  await audioRecordingService.stopRecording();

  // ❌ MISSING: No call to videoRecordingService.stopRecording()
  // ❌ MISSING: No attachment of SessionVideo to session

  dispatch({ type: 'END_SESSION', payload: id });
}, [dispatch, addNotification]),
```

**What Should Happen**:
1. Call `videoRecordingService.stopRecording()` → Returns `SessionVideo` object
2. Attach `SessionVideo` to session via `session.video = sessionVideo`
3. Save updated session to storage

**What Actually Happens**:
1. Video recording continues running (memory leak)
2. Session is marked complete without video
3. Video file exists on disk but is orphaned
4. Session.video field is never populated
5. Enrichment pipeline cannot access video for chaptering

**Fix Required**: Add video stop logic to endSession (see Wave 1.1 below)

#### Issue 2: Missing Session Manager in Rust (CRITICAL)

**Impact**: `get_recording_stats()` command returns error - stats UI shows nothing
**Root Cause**: No global state to track active `SwiftRecordingSession` instances

**Current Code** (`video_recording.rs`, lines 1091-1106):
```rust
#[tauri::command]
pub async fn get_recording_stats(
    session_id: String,
) -> Result<RecordingStats, String> {
    #[cfg(target_os = "macos")]
    {
        // This would require a global session manager
        // For now, return a placeholder error
        Err("Recording stats not yet implemented. Requires global session manager.".to_string())
    }
    // ...
}
```

**Problem Flow**:
```
User starts multi-source recording
  ↓
video_recording.rs:start_multi_source_recording()
  ↓
session = SwiftRecordingSession::new(...)
session.start().await  ✅ Recording starts
  ↓
Function returns, session goes out of scope
  ↓
Drop called → recording_session_destroy() → ❌ Recording stops immediately!
  ↓
RecordingStats.tsx polls getStats() every 1s
  ↓
Rust returns error: "not yet implemented"
  ↓
UI shows: "Stats unavailable"
```

**Fix Required**: Implement global session manager (see Wave 1.2 below)

#### Issue 3: Phase 2 Using Deprecated SessionsContext (MAJOR)

**Impact**: Phase 2 not using Phase 1's improved context architecture
**Root Cause**: RecordingContext and components still import deprecated SessionsContext

**Evidence**:
- `ActiveSessionView.tsx` line 10: `import { useSessions } from '../context/SessionsContext';`
- `RecordingContext.tsx` line 238: Calls videoRecordingService but doesn't integrate with ActiveSessionContext
- Should use: `useActiveSession()`, `useSessionList()`, `useRecording()`

**Fix Required**: Migrate components to Phase 1 contexts (see Wave 2.1 below)

#### Issue 4: No Transaction Usage in Phase 2 (MAJOR)

**Impact**: Multi-key updates not atomic - data corruption risk on crash
**Root Cause**: Phase 2 code predates Phase 1 transaction implementation

**Current Pattern** (SessionListContext.tsx, lines 97-99):
```typescript
const storage = await getStorage();
const currentSessions = await storage.load<Session[]>('sessions') || [];
await storage.save('sessions', [...currentSessions, session]);  // ❌ Not atomic
```

**Problem**: If app crashes between load and save, or concurrent writes occur, data loss/corruption possible.

**Fix Required**: Use transaction API for multi-step updates (see Wave 2.2 below)

#### Issue 5: No PersistenceQueue Usage in Phase 2 (MAJOR)

**Impact**: UI blocking during session saves
**Root Cause**: Phase 2 contexts use direct `storage.save()` instead of queue

**Current Pattern** (SessionListContext.tsx, line 99):
```typescript
await storage.save('sessions', [...currentSessions, session]);  // ❌ Blocks UI
```

**Measurement**: 200-500ms UI freeze per save (Phase 1 fixed this globally but Phase 2 contexts don't use queue)

**Fix Required**: Replace direct saves with queue (see Wave 2.3 below)

---

## Issue Resolution Roadmap

### Wave 1: Critical Storage Fixes (BLOCKING)

**Duration**: 6-8 hours
**Can Start**: Immediately
**Blocks**: Production deployment, manual testing

#### Issue 1.1: Add Video Recording Stop to endSession

**Priority**: CRITICAL
**Files Affected**:
- `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionsContext.tsx` (lines 912-993)
- `/Users/jamesmcarthur/Documents/taskerino/src/context/ActiveSessionContext.tsx` (lines 172-215)

**Problem**:
Video recording is never stopped when session ends. Session.video field is never populated.

**Solution**:
Add video stop logic to both contexts (deprecated and Phase 1):

**Implementation Steps**:

1. **Update SessionsContext.endSession()** (lines 912-993):
   ```typescript
   endSession: React.useCallback(async (id: string) => {
     console.log('[SESSION END] Starting cleanup for session:', id);

     cleanupMetricsRef.current.sessionEnds.total++;
     let hadErrors = false;
     let sessionVideo: SessionVideo | null = null;  // ← ADD THIS

     const { screenshotCaptureService } = await import('../services/screenshotCaptureService');
     const { audioRecordingService } = await import('../services/audioRecordingService');
     const { videoRecordingService } = await import('../services/videoRecordingService');  // ← ADD THIS

     // ... existing screenshot stop code ...

     // ... existing audio stop code ...

     // ← ADD THIS SECTION (after audio, before dispatch):
     // Stop video recording (only if this session is active)
     try {
       const activeVideoSessionId = videoRecordingService.getActiveSessionId();
       if (activeVideoSessionId === id) {
         console.log('[SESSION END] Stopping video recording for session:', id);
         sessionVideo = await videoRecordingService.stopRecording();
         console.log('[SESSION END] Video recording stopped, attachment:', sessionVideo?.fullVideoAttachmentId);
       } else {
         console.log('[SESSION END] Video recording not active for this session (active:', activeVideoSessionId, ')');
       }
     } catch (error) {
       console.error('[SESSION END] Failed to stop video recording:', error);
       hadErrors = true;
       addNotification({
         type: 'warning',
         title: 'Cleanup Warning',
         message: 'Failed to stop video recording. Video may not be saved.',
       });
     }

     // ... existing audio queue cleanup ...

     dispatch({ type: 'END_SESSION', payload: id });

     // ← ADD THIS SECTION (after dispatch):
     // Attach video to session if recording was active
     if (sessionVideo) {
       const session = stateRef.current.sessions.find(s => s.id === id);
       if (session) {
         dispatch({
           type: 'UPDATE_SESSION',
           payload: {
             ...session,
             video: sessionVideo,
           },
         });
       }
     }

     // ... existing metrics tracking ...
   }, [dispatch, addNotification]),
   ```

2. **Update ActiveSessionContext.endSession()** (lines 172-215):
   ```typescript
   const endSession = useCallback(async () => {
     if (!activeSession) {
       console.warn('[ActiveSessionContext] Cannot end: no active session');
       return;
     }

     if (isEndingRef.current) {
       console.warn('[ActiveSessionContext] Session is already ending');
       return;
     }
     isEndingRef.current = true;

     if (activeSession.status === 'completed') {
       console.warn('[ActiveSessionContext] Attempted to end already-completed session');
       isEndingRef.current = false;
       return;
     }

     console.log('[ActiveSessionContext] Ending session:', activeSession.id);

     // ← ADD THIS SECTION (before creating completedSession):
     // Stop video recording if enabled
     let sessionVideo: SessionVideo | null = null;
     if (activeSession.videoRecording) {
       try {
         const { videoRecordingService } = await import('../services/videoRecordingService');
         console.log('[ActiveSessionContext] Stopping video recording');
         sessionVideo = await videoRecordingService.stopRecording();
         console.log('[ActiveSessionContext] Video stopped, attachment:', sessionVideo?.fullVideoAttachmentId);
       } catch (error) {
         console.error('[ActiveSessionContext] Failed to stop video recording:', error);
       }
     }

     const endTime = new Date().toISOString();
     let totalDuration: number | undefined;

     if (activeSession.startTime) {
       // ... existing duration calculation ...
     }

     const completedSession: Session = {
       ...activeSession,
       status: 'completed',
       endTime,
       totalDuration,
       pausedAt: undefined,
       video: sessionVideo || activeSession.video,  // ← MODIFY THIS LINE
     };

     await addToSessionList(completedSession);
     setActiveSession(null);
     isEndingRef.current = false;

     console.log('[ActiveSessionContext] Session ended and saved:', completedSession.id);
   }, [activeSession, addToSessionList]);
   ```

3. **Add getActiveSessionId() to videoRecordingService.ts** (if missing):
   ```typescript
   /**
    * Get the active session ID (if recording)
    */
   getActiveSessionId(): string | null {
     return this.activeSessionId;
   }
   ```

**Testing**:
1. Start session with video recording enabled (multi-source or legacy)
2. Capture some video frames
3. End session
4. Verify:
   - `session.video` field is populated
   - `session.video.fullVideoAttachmentId` exists
   - Attachment file exists on disk
   - Video playable in Review tab
   - No console errors

**Time Estimate**: 2-3 hours

**Dependencies**: None

---

#### Issue 1.2: Implement Global Session Manager (Rust)

**Priority**: CRITICAL
**Files Affected**:
- `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/lib.rs` (lines 580-610)
- `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/video_recording.rs` (lines 964-1106)

**Problem**:
Multi-source sessions are created but immediately dropped. Stats polling fails.

**Solution**:
Add global HashMap to track active sessions.

**Implementation Steps**:

1. **Add SessionManager to lib.rs** (after imports, before run()):
   ```rust
   use std::sync::Mutex;
   use std::collections::HashMap;
   use crate::recording::ffi::SwiftRecordingSession;

   // Global session manager for multi-source recordings
   struct SessionManager {
       sessions: Mutex<HashMap<String, SwiftRecordingSession>>,
   }

   impl SessionManager {
       fn new() -> Self {
           Self {
               sessions: Mutex::new(HashMap::new()),
           }
       }

       fn insert(&self, id: String, session: SwiftRecordingSession) {
           self.sessions.lock().unwrap().insert(id, session);
       }

       fn remove(&self, id: &str) -> Option<SwiftRecordingSession> {
           self.sessions.lock().unwrap().remove(id)
       }

       fn get_stats(&self, id: &str) -> Option<RecordingStats> {
           let sessions = self.sessions.lock().unwrap();
           sessions.get(id).map(|session| session.get_stats())
       }
   }
   ```

2. **Register manager in run() function** (line 605, after Builder::default()):
   ```rust
   .manage(SessionManager::new())  // ← ADD THIS
   .invoke_handler(tauri::generate_handler![
       // ... existing commands ...
   ])
   ```

3. **Update start_multi_source_recording** (lines 964-1042):
   ```rust
   #[tauri::command]
   pub async fn start_multi_source_recording(
       app_handle: tauri::AppHandle,  // ← ADD THIS
       session_id: String,
       output_path: String,
       width: i32,
       height: i32,
       fps: i32,
       display_ids: Option<Vec<u32>>,
       window_ids: Option<Vec<u32>>,
       compositor_type: Option<String>,
   ) -> Result<(), String> {
       // ... existing validation ...

       // ... existing session creation ...

       session.start().await
           .map_err(|e| format!("Failed to start recording: {:?}", e))?;

       // ← ADD THIS SECTION (replace TODO):
       // Store session in global manager
       let manager = app_handle.state::<SessionManager>();
       manager.insert(session_id.clone(), session);
       console.log("✅ [RUST] Multi-source session stored in manager: {}", session_id);

       Ok(())
   }
   ```

4. **Implement get_recording_stats** (lines 1091-1106):
   ```rust
   #[tauri::command]
   pub async fn get_recording_stats(
       app_handle: tauri::AppHandle,  // ← ADD THIS
       session_id: String,
   ) -> Result<RecordingStats, String> {
       #[cfg(target_os = "macos")]
       {
           let manager = app_handle.state::<SessionManager>();

           manager.get_stats(&session_id)
               .ok_or_else(|| format!("Session not found: {}", session_id))
       }

       #[cfg(not(target_os = "macos"))]
       {
           Err("Recording stats only available on macOS".to_string())
       }
   }
   ```

5. **Update stop_video_recording** (lines 654-663):
   ```rust
   #[tauri::command]
   pub async fn stop_video_recording(
       app_handle: tauri::AppHandle,  // ← ADD THIS if missing
   ) -> Result<String, String> {
       // ... existing code ...

       // ← ADD THIS SECTION (before return):
       // Remove from global manager if this was a multi-source session
       if let Some(session_id) = recorder.get_active_session_id() {
           let manager = app_handle.state::<SessionManager>();
           if let Some(session) = manager.remove(&session_id) {
               drop(session);  // Ensure cleanup
               println!("✅ [RUST] Multi-source session removed from manager: {}", session_id);
           }
       }

       Ok(output_path.to_string_lossy().to_string())
   }
   ```

**Testing**:
1. Start multi-source recording
2. Open browser DevTools → Network tab → check console
3. Verify stats polling succeeds (every 1 second)
4. Verify `RecordingStats` component shows:
   - Frames processed count
   - Frames dropped count
   - Drop rate percentage
   - Color-coded indicators
5. Stop recording
6. Verify stats component disappears
7. Verify no memory leaks (session properly cleaned up)

**Time Estimate**: 3-4 hours

**Dependencies**: None

---

### Wave 2: Major Fixes (Should Fix Before Production)

**Duration**: 6-8 hours
**Can Start**: After Wave 1
**Blocks**: Clean architecture, performance

#### Issue 2.1: Migrate Phase 2 to Phase 1 Contexts

**Priority**: MAJOR
**Files Affected**:
- `/Users/jamesmcarthur/Documents/taskerino/src/components/ActiveSessionView.tsx`
- `/Users/jamesmcarthur/Documents/taskerino/src/context/RecordingContext.tsx`
- `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/RecordingStats.tsx`

**Problem**:
Components still use deprecated `SessionsContext` instead of Phase 1 contexts.

**Solution**:
Replace imports and refactor to use `useActiveSession()`, `useSessionList()`, `useRecording()`.

**Implementation Steps**:

1. **ActiveSessionView.tsx** (line 10):
   ```typescript
   // ❌ REMOVE THIS:
   import { useSessions } from '../context/SessionsContext';

   // ✅ ADD THIS:
   import { useActiveSession } from '../context/ActiveSessionContext';
   import { useSessionList } from '../context/SessionListContext';

   // Line 22 - UPDATE THIS:
   const { addScreenshotComment, toggleScreenshotFlag, addContextItem } = useActiveSession();
   const { updateSession: updateInList } = useSessionList();

   // Line 139 - UPDATE THIS (replace updateSession with updateInList):
   const handleVideoConfigChange = async (config: VideoRecordingConfig) => {
     const updatedSession = { ...session, /* ... */ };
     await updateInList(session.id, updatedSession);  // ← Changed from updateSession
   };
   ```

2. **RecordingContext.tsx** (integrate with ActiveSessionContext):
   ```typescript
   // Add import:
   import { useActiveSession } from './ActiveSessionContext';

   export function RecordingProvider({ children }: RecordingProviderProps) {
     const { updateActiveSession } = useActiveSession();  // ← ADD THIS

     // ... existing code ...

     const stopVideo = useCallback(async () => {
       console.log('[RecordingContext] Stopping video recording');
       try {
         const sessionVideo = await videoRecordingService.stopRecording();  // ← MODIFY

         // ← ADD THIS: Attach video to active session
         if (sessionVideo && updateActiveSession) {
           updateActiveSession({ video: sessionVideo });
         }

         setRecordingState(prev => ({ ...prev, video: 'stopped' }));
       } catch (error) {
         console.error('[RecordingContext] Failed to stop video:', error);
         throw error;
       }
     }, [updateActiveSession]);  // ← ADD DEPENDENCY
   }
   ```

**Testing**:
1. Start session
2. Verify all media controls work (screenshots, audio, video)
3. Add context item → verify it appears
4. Add screenshot comment → verify it appears
5. End session → verify all data persisted
6. No console errors or warnings about deprecated contexts

**Time Estimate**: 2-3 hours

**Dependencies**: Wave 1 complete

---

#### Issue 2.2: Add Transaction Support to Session Saves

**Priority**: MAJOR
**Files Affected**:
- `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionListContext.tsx` (lines 70-120)
- `/Users/jamesmcarthur/Documents/taskerino/src/context/ActiveSessionContext.tsx` (lines 200-215)

**Problem**:
Multi-key updates (sessions + settings) not atomic - risk of inconsistency.

**Solution**:
Use Phase 1 transaction API for multi-step operations.

**Implementation Steps**:

1. **SessionListContext.addSession()** (lines 96-100):
   ```typescript
   // ❌ CURRENT (non-atomic):
   const storage = await getStorage();
   const currentSessions = await storage.load<Session[]>('sessions') || [];
   await storage.save('sessions', [...currentSessions, session]);
   dispatch({ type: 'ADD_SESSION', payload: session });

   // ✅ REPLACE WITH (atomic):
   const storage = await getStorage();
   const tx = await storage.beginTransaction();

   try {
     const currentSessions = await storage.load<Session[]>('sessions') || [];
     tx.save('sessions', [...currentSessions, session]);

     // Also save activeSessionId in same transaction
     const settings = await storage.load<any>('settings') || {};
     tx.save('settings', { ...settings, activeSessionId: session.id });

     await tx.commit();
     dispatch({ type: 'ADD_SESSION', payload: session });

     console.log('✅ Session added atomically:', session.id);
   } catch (error) {
     await tx.rollback();
     console.error('❌ Transaction failed, rolled back:', error);
     throw error;
   }
   ```

2. **ActiveSessionContext.endSession()** (lines 200-215):
   ```typescript
   // ADD AFTER completedSession creation:
   const storage = await getStorage();
   const tx = await storage.beginTransaction();

   try {
     // Load current sessions
     const sessions = await storage.load<Session[]>('sessions') || [];

     // Add completed session
     tx.save('sessions', [...sessions, completedSession]);

     // Clear activeSessionId
     const settings = await storage.load<any>('settings') || {};
     tx.save('settings', { ...settings, activeSessionId: undefined });

     await tx.commit();

     setActiveSession(null);
     isEndingRef.current = false;

     console.log('[ActiveSessionContext] Session ended and saved atomically:', completedSession.id);
   } catch (error) {
     await tx.rollback();
     console.error('[ActiveSessionContext] Failed to save session, rolled back:', error);
     isEndingRef.current = false;
     throw error;
   }
   ```

**Testing**:
1. Start session → verify transaction commits
2. End session → verify transaction commits
3. Simulate crash during save (add `throw new Error()` before commit) → verify rollback
4. Verify no data corruption (sessions list intact after rollback)

**Time Estimate**: 2 hours

**Dependencies**: Wave 1 complete

---

#### Issue 2.3: Migrate to PersistenceQueue

**Priority**: MAJOR
**Files Affected**:
- `/Users/jamesmcarthur/Documents/taskerino/src/context/SessionListContext.tsx` (lines 147-175)

**Problem**:
Direct `storage.save()` calls block UI (200-500ms).

**Solution**:
Use `getPersistenceQueue()` with priority-based batching.

**Implementation Steps**:

1. **SessionListContext** - Add imports:
   ```typescript
   import { getPersistenceQueue } from '../services/storage/PersistenceQueue';

   export function SessionListProvider({ children }: SessionListProviderProps) {
     const queue = getPersistenceQueue();  // ← ADD THIS

     // ... existing code ...
   }
   ```

2. **Replace direct saves in useEffect** (lines 147-175):
   ```typescript
   // ❌ REMOVE THIS:
   useEffect(() => {
     if (!hasLoaded) return;

     const saveData = async () => {
       try {
         perfMonitor.start('save-sessions');
         const storage = await getStorage();
         await storage.save('sessions', state.sessions);  // ← BLOCKS UI
         perfMonitor.end('save-sessions');
       } catch (error) {
         console.error('Failed to save sessions:', error);
       }
     };

     saveData();
   }, [hasLoaded, state.sessions]);

   // ✅ REPLACE WITH THIS:
   useEffect(() => {
     if (!hasLoaded) return;

     // Enqueue with normal priority (batched 100ms, zero UI blocking)
     queue.enqueue('sessions', state.sessions, 'normal');

     console.log('[SessionListContext] Sessions enqueued for background save');
   }, [hasLoaded, state.sessions, queue]);
   ```

3. **Add shutdown handler** (at end of provider):
   ```typescript
   // Flush queue on unmount
   useEffect(() => {
     return () => {
       console.log('[SessionListContext] Flushing persistence queue on unmount');
       queue.flush();
     };
   }, [queue]);
   ```

**Testing**:
1. Add new session → verify UI does not freeze
2. Update session rapidly (e.g., add 10 screenshots in 1 second) → verify batching works
3. Check console → verify "Sessions enqueued" messages
4. Close app → verify queue flushes (all data saved)
5. Reopen app → verify no data loss

**Time Estimate**: 1-2 hours

**Dependencies**: Wave 1 complete

---

### Wave 3: Minor Improvements (Post-Production)

**Duration**: 8-12 hours
**Can Start**: After Wave 2
**Blocks**: Nothing (polish items)

#### Issue 3.1: Add ID Validation in videoRecordingService.ts

**Priority**: MINOR
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/videoRecordingService.ts` (lines 461-467)

**Problem**: `parseInt(s.id, 10)` can return `NaN` if ID is non-numeric.

**Solution**:
```typescript
const displayIds = config.sources
  .filter(s => s.type === 'display')
  .map(s => {
    const id = parseInt(s.id, 10);
    if (isNaN(id)) {
      throw new Error(`Invalid display ID: ${s.id}`);
    }
    return id;
  });
```

**Time**: 15 minutes

---

#### Issue 3.2: Add Stale Closure Protection in RecordingStats.tsx

**Priority**: MINOR
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/RecordingStats.tsx` (lines 26-47)

**Problem**: Interval can continue after unmount if async call is in-flight.

**Solution**:
```typescript
useEffect(() => {
  let active = true;

  const fetchStats = async () => {
    if (!active) return;
    try {
      const currentStats = await videoRecordingService.getStats();
      if (active) {
        setStats(currentStats);
        setError(null);
      }
    } catch (err) {
      if (active) {
        console.error('Failed to get recording stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }
  };

  fetchStats(); // Initial fetch
  const interval = setInterval(fetchStats, 1000);

  return () => {
    active = false;
    clearInterval(interval);
  };
}, []);
```

**Time**: 30 minutes

---

#### Issue 3.3: Fix Type Cast in MultiSourceRecordingConfig.tsx

**Priority**: MINOR
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/MultiSourceRecordingConfig.tsx` (line 235)

**Problem**: `as any` bypasses type safety.

**Solution**:
```typescript
// ❌ CURRENT:
onChange={(e) => onCompositorChange(e.target.value as any)}

// ✅ REPLACE WITH:
onChange={(e) => onCompositorChange(e.target.value as 'passthrough' | 'grid' | 'sidebyside')}
```

**Time**: 5 minutes

---

#### Issue 3.4: Enforce Max Sources Limit (4)

**Priority**: MINOR
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/MultiSourceRecordingConfig.tsx`

**Problem**: UI mentions limit of 4 but doesn't enforce it.

**Solution**:
```typescript
// Line 148 - Disable add button when at limit:
<button
  onClick={() => setShowDisplayPicker(!showDisplayPicker)}
  disabled={isLoadingDevices || sources.length >= 4}  // ← ADD THIS
  className={...}
>
  {/* ... */}
</button>

// Line 195 - Same for window picker:
<button
  onClick={() => setShowWindowPicker(!showWindowPicker)}
  disabled={isLoadingDevices || sources.length >= 4}  // ← ADD THIS
  className={...}
>
  {/* ... */}
</button>

// Add tooltip when disabled:
{sources.length >= 4 && (
  <span className="text-xs text-gray-500 ml-2">
    Maximum of 4 sources reached
  </span>
)}
```

**Time**: 30 minutes

---

#### Issue 3.5: Add Click-Outside-to-Close for Pickers

**Priority**: MINOR
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/MultiSourceRecordingConfig.tsx`

**Solution**: Use `useOutsideClick` hook or add global click listener.

**Time**: 1 hour

---

#### Issue 3.6: Clarify Drop Rate Calculation

**Priority**: MINOR
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/components/sessions/RecordingStats.tsx` (lines 58-60)

**Problem**: Formula is ambiguous - should be `framesDropped / totalFrames`.

**Solution**:
```typescript
const totalFrames = stats.framesProcessed + stats.framesDropped;
const dropRate = totalFrames > 0
  ? (stats.framesDropped / totalFrames) * 100
  : 0;
```

**Time**: 10 minutes

---

#### Issue 3.7-3.12: TypeScript Type Errors (13 total)

**Priority**: LOW (pre-existing technical debt)
**Files**:
- `GlassSelect/index.tsx` (4 errors)
- `SessionsTopBar.tsx` (1 error)
- `StartSessionModal.tsx` (1 error)
- `SessionsZone.tsx` (3 errors)
- `TasksZone.tsx` (2 errors)
- `RecordingContext.tsx` (1 error)
- `LazyLoader.ts` (2 errors)

**Note**: These are NOT related to Phase 2. Fix in separate cleanup task.

**Time**: 4-6 hours total

---

#### Issue 3.8: Clean Up Rust Clippy Warnings (79 total)

**Priority**: LOW (code quality)
**Files**: Various Rust files

**Categories**:
1. Unexpected cfg warnings (6) - Update `objc` crate
2. Unused variables (6) - Prefix with `_`
3. Dead code warnings (49) - Remove or mark with `#[allow(dead_code)]`
4. Empty line after attribute (1) - Style fix
5. Other warnings (17) - Cleanup

**Time**: 1-2 hours

---

#### Issue 3.9: Add SAFETY Comments (3 blocks)

**Priority**: VERY LOW (documentation)
**File**: `/Users/jamesmcarthur/Documents/taskerino/src-tauri/src/recording/ffi.rs`

**Locations**: Lines 138, 148, 299

**Time**: 15 minutes

---

#### Issue 3.10: Swift 6 Warnings (7 total)

**Priority**: VERY LOW (minor)
**Files**: Various Swift files

**Note**: Minor compatibility warnings, non-critical.

**Time**: 30 minutes

---

## Implementation Order

### Dependency Graph

```
Wave 1 (Critical - Parallel)
├── Issue 1.1: Video Stop in endSession (NO DEPENDENCIES)
└── Issue 1.2: Session Manager in Rust (NO DEPENDENCIES)

Wave 2 (Major - Sequential after Wave 1)
├── Issue 2.1: Context Migration (DEPENDS ON: Wave 1 complete)
├── Issue 2.2: Transaction Support (DEPENDS ON: Wave 1 complete)
└── Issue 2.3: PersistenceQueue (DEPENDS ON: Wave 1 complete)

Wave 3 (Minor - Can run in parallel after Wave 2)
├── Issue 3.1: ID Validation (INDEPENDENT)
├── Issue 3.2: Stale Closure (INDEPENDENT)
├── Issue 3.3: Type Cast (INDEPENDENT)
├── Issue 3.4: Max Sources (INDEPENDENT)
├── Issue 3.5: Click Outside (INDEPENDENT)
├── Issue 3.6: Drop Rate (INDEPENDENT)
├── Issue 3.7-3.12: TypeScript Errors (INDEPENDENT)
├── Issue 3.8: Clippy Warnings (INDEPENDENT)
├── Issue 3.9: SAFETY Comments (INDEPENDENT)
└── Issue 3.10: Swift Warnings (INDEPENDENT)
```

### Recommended Execution Order

1. **Start Immediately** (can run in parallel):
   - Issue 1.1 (TypeScript agent)
   - Issue 1.2 (Rust agent)

2. **After both Wave 1 complete** (can run in parallel):
   - Issue 2.1 (TypeScript agent)
   - Issue 2.2 (TypeScript agent)
   - Issue 2.3 (TypeScript agent)

3. **After Wave 2 complete** (cherry-pick by priority):
   - Issue 3.1, 3.2 (TypeScript - high value)
   - Issue 3.3, 3.4, 3.5 (TypeScript - UX polish)
   - Issue 3.6 (TypeScript - correctness)
   - Issue 3.8 (Rust - code quality)
   - Issues 3.7, 3.9, 3.10 (low priority)

---

## Testing Strategy

### Wave 1 Testing (Critical Path)

**Manual E2E Test**:
1. Start session with multi-source video enabled
2. Add 2 displays to recording
3. Select "Grid" compositor
4. Wait 30 seconds (capture some frames)
5. Verify stats appear and update every second
6. End session
7. Verify session.video field populated
8. Verify video file exists and is playable
9. Navigate to Sessions → Review tab
10. Verify video appears in session detail
11. Verify no console errors

**Automated Tests** (add to test suite):
```typescript
// videoRecordingService.test.ts
describe('Video Recording Integration', () => {
  it('should attach SessionVideo to session on stop', async () => {
    const service = new VideoRecordingService();
    await service.startMultiSourceRecording(config);
    const sessionVideo = await service.stopRecording();

    expect(sessionVideo).toBeDefined();
    expect(sessionVideo?.fullVideoAttachmentId).toBeTruthy();
    expect(sessionVideo?.duration).toBeGreaterThan(0);
  });
});

// ActiveSessionContext.test.tsx
describe('ActiveSessionContext.endSession', () => {
  it('should attach video when ending session with recording', async () => {
    const { result } = renderHook(() => useActiveSession(), {
      wrapper: ActiveSessionProvider,
    });

    // Start session with video
    act(() => {
      result.current.startSession({
        name: 'Test',
        videoRecording: true,
        /* ... */
      });
    });

    // Mock video stop
    vi.mocked(videoRecordingService.stopRecording).mockResolvedValue({
      id: 'video-1',
      sessionId: 'session-1',
      fullVideoAttachmentId: 'attach-1',
      duration: 30,
      chunkingStatus: 'pending',
    });

    // End session
    await act(async () => {
      await result.current.endSession();
    });

    // Verify video attached
    const sessions = await storage.load('sessions');
    expect(sessions[0].video).toBeDefined();
    expect(sessions[0].video.fullVideoAttachmentId).toBe('attach-1');
  });
});
```

### Wave 2 Testing (Integration)

**Transaction Tests**:
```typescript
describe('Transaction Integration', () => {
  it('should rollback on failure', async () => {
    const storage = await getStorage();
    const tx = await storage.beginTransaction();

    tx.save('sessions', [session1]);
    tx.save('settings', { error: true });  // Simulate error

    await expect(tx.commit()).rejects.toThrow();

    // Verify rollback
    const sessions = await storage.load('sessions');
    expect(sessions).toEqual([]);  // Empty, not session1
  });
});
```

**Queue Tests**:
```typescript
describe('PersistenceQueue Integration', () => {
  it('should batch saves without blocking UI', async () => {
    const queue = getPersistenceQueue();

    const startTime = performance.now();

    // Enqueue 100 saves
    for (let i = 0; i < 100; i++) {
      queue.enqueue('sessions', [session], 'normal');
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete instantly (< 10ms)
    expect(duration).toBeLessThan(10);

    // Wait for queue to flush
    await queue.flush();

    // Verify data saved
    const sessions = await storage.load('sessions');
    expect(sessions).toEqual([session]);
  });
});
```

### Wave 3 Testing (Polish)

**Manual Checks**:
- [ ] Stats polling shows correct drop rate
- [ ] Max 4 sources enforced
- [ ] Pickers close when clicking outside
- [ ] No TypeScript errors in console
- [ ] No clippy warnings in build output

---

## Risk Assessment

### Wave 1 Risks

| Change | Breaking Change Risk | Data Migration | Backward Compatibility |
|--------|---------------------|----------------|------------------------|
| Issue 1.1 | **Low** | No | Maintained - only adds video field |
| Issue 1.2 | **Low** | No | Maintained - new sessions only |

**Mitigation**:
- Add defensive null checks for `session.video`
- Test with existing sessions (no video field)
- Ensure schema migration handles missing video gracefully

### Wave 2 Risks

| Change | Breaking Change Risk | Data Migration | Backward Compatibility |
|--------|---------------------|----------------|------------------------|
| Issue 2.1 | **Medium** | No | Breaking - requires context rewiring |
| Issue 2.2 | **Low** | No | Maintained - transactions are atomic |
| Issue 2.3 | **Low** | No | Maintained - queue is transparent |

**Mitigation**:
- Test thoroughly with manual E2E before deploying
- Keep SessionsContext as deprecated but functional during migration
- Add feature flags for transaction/queue rollback

### Wave 3 Risks

**Low Risk** - All polish items, no architectural changes.

---

## Rollback Plan

### If Wave 1 Causes Regressions

**Issue 1.1 Rollback**:
1. Comment out video stop code in endSession
2. Redeploy previous version
3. Sessions will save without video (existing behavior)
4. No data loss

**Issue 1.2 Rollback**:
1. Remove SessionManager from lib.rs
2. Restore stub get_recording_stats
3. Stats UI will show "unavailable" (existing behavior)
4. No data loss

### If Wave 2 Causes Regressions

**Issue 2.1 Rollback**:
1. Revert context imports
2. Re-enable SessionsContext
3. Functionality restored immediately

**Issue 2.2/2.3 Rollback**:
1. Disable transaction/queue usage
2. Revert to direct storage.save() calls
3. UI blocking returns but functionality intact

---

## Success Criteria

### Phase 2 is Production-Ready When:

#### Critical (Wave 1)
- [x] **Storage System Verified** - Phase 1 working correctly
- [ ] **Video Attached to Sessions** - session.video field populated
- [ ] **Stats Polling Works** - RecordingStats component shows live data
- [ ] **Manual E2E Test Passes** - Complete recording flow works end-to-end
- [ ] **No Regressions** - Existing features (screenshots, audio) still work

#### Major (Wave 2)
- [ ] **Context Migration Complete** - No deprecated contexts used
- [ ] **Transactions Used** - Multi-key updates are atomic
- [ ] **Queue Integrated** - Zero UI blocking during saves
- [ ] **All Tests Passing** - Automated test suite passes
- [ ] **Performance Verified** - No UI freezes > 100ms

#### Minor (Wave 3 - Optional)
- [ ] **ID Validation Added** - No NaN errors
- [ ] **Stale Closures Fixed** - No memory leaks
- [ ] **Type Safety Improved** - No `as any` casts
- [ ] **UX Polish** - Max sources enforced, pickers closeable
- [ ] **Code Quality** - No clippy warnings, SAFETY comments added

---

## Agent Task Assignments

### Agent Type: TypeScript/React Specialist

**Prerequisites**: Read all files in `/src/context/`, `/src/services/videoRecordingService.ts`, `/src/components/sessions/`

**Wave 1 Deliverables**:
1. Implement Issue 1.1 (video stop in endSession)
   - Files: SessionsContext.tsx, ActiveSessionContext.tsx
   - Add video stop logic
   - Add SessionVideo attachment
   - Test manually

**Wave 2 Deliverables**:
1. Implement Issue 2.1 (context migration)
   - Files: ActiveSessionView.tsx, RecordingContext.tsx, RecordingStats.tsx
   - Replace useSessions with useActiveSession/useSessionList
2. Implement Issue 2.2 (transactions)
   - Files: SessionListContext.tsx, ActiveSessionContext.tsx
   - Add transaction wrapping
3. Implement Issue 2.3 (queue)
   - Files: SessionListContext.tsx
   - Replace direct saves with queue.enqueue

**Wave 3 Deliverables**:
1. Fix Issues 3.1-3.6 (all TypeScript polish)

**Verification**: Run test suite, manual E2E test, verify no console errors

---

### Agent Type: Rust/FFI Specialist

**Prerequisites**: Read `/src-tauri/src/lib.rs`, `/src-tauri/src/video_recording.rs`, `/src-tauri/src/recording/`

**Wave 1 Deliverables**:
1. Implement Issue 1.2 (session manager)
   - Files: lib.rs, video_recording.rs
   - Add SessionManager struct
   - Update start/stop/stats commands
   - Test with frontend

**Wave 3 Deliverables**:
1. Fix Issue 3.8 (clippy warnings)
   - Update objc crate
   - Prefix unused vars
   - Remove dead code
2. Fix Issue 3.9 (SAFETY comments)
   - Add missing comments
3. Fix Issue 3.10 (Swift warnings - if time permits)

**Verification**: Cargo build succeeds, cargo clippy passes, cargo test passes

---

### Agent Type: Integration Tester

**Prerequisites**: Read all audit reports, fix plan, test all user flows

**Wave 1 Deliverables**:
1. Run manual E2E test (see Testing Strategy)
2. Verify video attached to sessions
3. Verify stats polling works
4. Document any regressions

**Wave 2 Deliverables**:
1. Run automated test suite
2. Verify transaction rollback
3. Verify queue performance (no UI blocking)

**Wave 3 Deliverables**:
1. Verify all polish items
2. Final QA sign-off

**Verification**: All tests pass, no regressions, performance metrics met

---

## Time Breakdown

### Critical Path (Wave 1)

| Task | Time | Agent |
|------|------|-------|
| Issue 1.1: Video Stop | 2-3 hours | TypeScript |
| Issue 1.2: Session Manager | 3-4 hours | Rust |
| **Wave 1 Total** | **6-8 hours** | - |

### Major Improvements (Wave 2)

| Task | Time | Agent |
|------|------|-------|
| Issue 2.1: Context Migration | 2-3 hours | TypeScript |
| Issue 2.2: Transactions | 2 hours | TypeScript |
| Issue 2.3: Queue Integration | 1-2 hours | TypeScript |
| **Wave 2 Total** | **6-8 hours** | - |

### Polish (Wave 3)

| Task | Time | Agent |
|------|------|-------|
| Issues 3.1-3.6: TypeScript | 2-3 hours | TypeScript |
| Issues 3.7-3.12: Type Errors | 4-6 hours | TypeScript |
| Issue 3.8: Clippy | 1-2 hours | Rust |
| Issues 3.9-3.10: Docs/Swift | 45 min | Rust |
| **Wave 3 Total** | **8-12 hours** | - |

### **Total Time**: **20-28 hours**
### **Critical Path**: **6-8 hours** (Wave 1 only for production readiness)

---

## Appendix: Storage Architecture Reference

### Phase 1 Storage Components

**Transaction API** (`storage/index.ts`, lines 15-20):
```typescript
interface StorageTransaction {
  save<T>(key: string, value: T): void;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
```

**PersistenceQueue API** (`storage/PersistenceQueue.ts`, lines 40-50):
```typescript
enqueue<T>(
  key: string,
  value: T,
  priority: 'critical' | 'normal' | 'low'
): void;

flush(): Promise<void>;
shutdown(): Promise<void>;
```

**Dual Adapter** (`storage/index.ts`, line 80):
```typescript
export async function getStorage(): Promise<StorageAdapter> {
  // Auto-detects Tauri vs Browser
  return window.__TAURI__ ? tauriAdapter : indexedDBAdapter;
}
```

### Session Storage Schema

**Current Schema** (types.ts, lines 700-750):
```typescript
interface Session {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'interrupted';
  startTime: string;
  endTime?: string;
  screenshots: SessionScreenshot[];
  audioSegments?: SessionAudioSegment[];
  video?: SessionVideo;  // ← Phase 2 adds this
  videoRecording?: boolean;
  // ... other fields
}

interface SessionVideo {
  id: string;
  sessionId: string;
  fullVideoAttachmentId: string;  // ← References Attachment
  duration: number;
  chunkingStatus: 'pending' | 'processing' | 'complete' | 'error';
  chunks?: SessionVideoChunk[];
  chapters?: VideoChapter[];
}
```

### Attachment Storage

**Attachment Reference** (types.ts, lines 120-150):
```typescript
interface Attachment {
  id: string;
  type: 'video' | 'image' | 'audio' | 'file';
  name: string;
  mimeType: string;
  size: number;
  path?: string;  // Local file path (Tauri)
  base64?: string;  // Inline data (small files)
  duration?: number;  // For videos (seconds)
  dimensions?: { width: number; height: number };
  // ... other fields
}
```

**Storage Location**:
- Browser: IndexedDB → `attachments` object store
- Tauri: File system → `~/Library/Application Support/taskerino/attachments/`

---

## Document Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-24 | Initial comprehensive fix plan |

---

**Plan Status**: ✅ **READY FOR IMPLEMENTATION**
**Next Action**: Assign Wave 1 tasks to agents and begin parallel execution
**Estimated Ship Date**: 6-8 hours after Wave 1 starts (critical path)
