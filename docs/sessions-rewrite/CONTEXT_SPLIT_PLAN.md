# SessionsContext Split Analysis & Implementation Plan

**Date**: 2025-10-23
**Total Lines**: 1155 lines (SessionsContext.tsx)
**Target**: Split into 3 contexts, each < 400 lines

---

## Executive Summary

The SessionsContext is a classic "god object" that violates the Single Responsibility Principle by managing three distinct concerns:
1. **Session List Management**: CRUD operations for completed sessions
2. **Active Session State**: Current session lifecycle and state machine
3. **Recording Services**: Screenshot, audio, and video capture services

This split will improve:
- **Performance**: Reduce re-renders by isolating concerns
- **Maintainability**: Each context has a clear, focused responsibility
- **Testability**: Easier to test isolated concerns
- **Developer Experience**: Clearer API surface area

---

## Current State Analysis

### State Variables (15 total)

#### Session List State (4 variables)
```typescript
sessions: Session[]                    // All sessions (active + completed)
activeSessionId?: string              // ID of currently active session
```

#### Active Session Internal State (2 variables)
```typescript
hasLoaded: boolean                    // Initialization flag
stateRef: useRef(state)              // Ref for avoiding stale closures
```

#### Recording Service State (9 variables - mostly refs)
```typescript
saveTimeoutRef: useRef<NodeJS.Timeout>           // Debounced save
audioChunkQueueRef: useRef<Map>                  // Audio queue management
processingAudioRef: useRef<Map>                  // Audio processing flags
cleanupMetricsRef: useRef<CleanupMetrics>        // Cleanup tracking
activeSessionIdRef: useRef<string>               // Ref for callbacks
prevActiveSessionIdRef: useRef<string>           // Transition detection
videoRecordingInitializedRef: useRef<string>     // Video init flag
handleAudioSegmentProcessedRef: useRef<Function> // Audio handler ref
audioListenerActiveRef: useRef<boolean>          // Audio listener guard
```

### Actions/Functions (21 total)

#### Session List Actions (6 functions)
```typescript
startSession()           // Create new session
endSession()            // Mark session complete (also cleanup)
pauseSession()          // Pause active session
resumeSession()         // Resume paused session
updateSession()         // Update session properties
deleteSession()         // Delete session + cleanup attachments
```

#### Screenshot Management (4 functions)
```typescript
addScreenshot()              // Add screenshot to session
updateScreenshotAnalysis()   // Update AI analysis
addScreenshotComment()       // Add user comment
toggleScreenshotFlag()       // Toggle flag status
```

#### Audio/Video Management (3 functions)
```typescript
addAudioSegment()           // Add audio chunk to session
deleteAudioSegmentFile()    // Remove audio file
getCleanupMetrics()         // Get cleanup statistics
```

#### Session Metadata (4 functions)
```typescript
setActiveSession()          // Set active session ID
addExtractedTask()         // Link task to session
addExtractedNote()         // Link note to session
addContextItem()           // Add context item
```

#### Internal Helpers (4 functions)
```typescript
dispatch()                 // Custom dispatch wrapper
processAudioChunkQueue()   // Audio backpressure handling
loadSessions()            // Load from storage
handleBeforeUnload()      // Save on app close
```

### Reducer Actions (19 total)

#### Session Lifecycle (5 actions)
- `START_SESSION`
- `END_SESSION`
- `PAUSE_SESSION`
- `RESUME_SESSION`
- `MARK_SESSION_INTERRUPTED`

#### Session Data (6 actions)
- `UPDATE_SESSION`
- `DELETE_SESSION`
- `SET_ACTIVE_SESSION`
- `ADD_SESSION_SCREENSHOT`
- `ADD_SESSION_AUDIO_SEGMENT`
- `DELETE_AUDIO_SEGMENT_FILE`

#### Screenshot Management (3 actions)
- `UPDATE_SCREENSHOT_ANALYSIS`
- `ADD_SCREENSHOT_COMMENT`
- `TOGGLE_SCREENSHOT_FLAG`

#### Session Links (3 actions)
- `ADD_EXTRACTED_TASK_TO_SESSION`
- `ADD_EXTRACTED_NOTE_TO_SESSION`
- `ADD_SESSION_CONTEXT_ITEM`

#### System (2 actions)
- `LOAD_SESSIONS`
- `UPDATE_CONTEXT_ITEM` (defined but unused)
- `DELETE_CONTEXT_ITEM` (defined but unused)

### Dependencies

#### External Services
- `storage` - Session persistence
- `attachmentStorage` - Binary data (screenshots, audio, video)
- `audioConcatenationService` - Audio processing
- `keyMomentsDetectionService` - Key moments detection
- `sessionEnrichmentService` - Post-session AI enrichment
- `UIContext` - Notifications
- `EnrichmentContext` - Enrichment progress tracking

#### Validation
- `validateAudioConfig()` - Audio config validation
- `validateVideoConfig()` - Video config validation
- `validateSession()` - Session validation

---

## Split Strategy

### Context 1: SessionListContext
**Responsibility**: Manage the list of completed sessions (CRUD, filtering, sorting)

**State**:
```typescript
sessions: Session[]                    // All sessions
loading: boolean                       // Load state
error: string | null                   // Error state
filter: SessionFilter | null           // Active filters
sortBy: SessionSortOption              // Sort option
```

**Actions**:
```typescript
// CRUD
loadSessions(): Promise<void>
createSession(session): Promise<Session>
updateSession(id, updates): Promise<void>
deleteSession(id): Promise<void>

// Filtering & Sorting
setFilter(filter): void
setSortBy(sort): void
refreshSessions(): Promise<void>

// Computed
filteredSessions: Session[]            // Filtered & sorted list
```

**Size Estimate**: ~300 lines
- Reducer: ~80 lines
- State management: ~50 lines
- CRUD operations: ~100 lines
- Filtering/sorting logic: ~50 lines
- Provider/hooks: ~20 lines

---

### Context 2: ActiveSessionContext
**Responsibility**: Manage currently active session state and lifecycle

**State**:
```typescript
activeSession: Session | null          // Current session
sessionState: string                   // State machine state
isRecording: boolean                   // Recording flag
isPaused: boolean                      // Pause flag
```

**Actions**:
```typescript
// Lifecycle
startSession(config): Promise<void>
pauseSession(): Promise<void>
resumeSession(): Promise<void>
endSession(): Promise<void>

// Data Updates
updateActiveSession(updates): void
addScreenshot(screenshot): void
addAudioSegment(segment): void
updateScreenshotAnalysis(id, analysis): void
addScreenshotComment(id, comment): void
toggleScreenshotFlag(id): void

// Session Links
addExtractedTask(taskId): void
addExtractedNote(noteId): void
addContextItem(item): void
```

**Size Estimate**: ~350 lines
- State management: ~50 lines
- Lifecycle actions: ~100 lines
- Data updates: ~80 lines
- Session links: ~40 lines
- Integration with SessionListContext: ~60 lines
- Provider/hooks: ~20 lines

**Key Design Decision**:
- ActiveSessionContext will CREATE sessions and manage them while active
- When session ends, it saves to SessionListContext
- This creates a clean handoff between "working on it" and "completed work"

---

### Context 3: RecordingContext
**Responsibility**: Manage recording services (screenshots, audio, video)

**State**:
```typescript
recordingState: {
  screenshots: RecordingServiceState  // 'idle' | 'active' | 'paused' | 'stopped' | 'error'
  audio: RecordingServiceState
  video: RecordingServiceState
}
cleanupMetrics: CleanupMetrics         // Metrics tracking
```

**Actions**:
```typescript
// Screenshot Service
startScreenshots(interval): Promise<void>
stopScreenshots(): Promise<void>
pauseScreenshots(): Promise<void>
resumeScreenshots(): Promise<void>

// Audio Service
startAudio(config): Promise<void>
stopAudio(): Promise<void>
pauseAudio(): Promise<void>
resumeAudio(): Promise<void>

// Video Service
startVideo(config): Promise<void>
stopVideo(): Promise<void>
pauseVideo(): Promise<void>
resumeVideo(): Promise<void>

// Batch Operations
stopAll(): Promise<void>
pauseAll(): Promise<void>
resumeAll(): Promise<void>

// Metrics
getCleanupMetrics(): CleanupMetrics
```

**Size Estimate**: ~380 lines
- State management: ~40 lines
- Screenshot service: ~80 lines
- Audio service: ~100 lines
- Video service: ~80 lines
- Batch operations: ~30 lines
- Cleanup/metrics: ~30 lines
- Provider/hooks: ~20 lines

**Key Design Decision**:
- RecordingContext is stateless - it's a thin wrapper around recording services
- Actual screenshot/audio/video data flows to ActiveSessionContext
- RecordingContext just manages START/STOP/PAUSE state
- Uses callbacks to send data to ActiveSessionContext

---

## Integration Strategy

### Data Flow

```
User Action (SessionsZone)
    ↓
┌─────────────────────────────────────────────────┐
│ 1. Start Session                                │
│    → ActiveSessionContext.startSession()        │
│    → RecordingContext.startScreenshots()        │
│    → RecordingContext.startAudio()              │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ 2. Recording (active)                           │
│    RecordingContext → ActiveSessionContext      │
│    (screenshots, audio chunks via callbacks)    │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ 3. End Session                                  │
│    → RecordingContext.stopAll()                 │
│    → ActiveSessionContext.endSession()          │
│    → SessionListContext.addSession()            │
│    → activeSession = null                       │
└─────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────┐
│ 4. View Past Sessions                           │
│    SessionListContext.filteredSessions          │
│    (no interaction with other contexts)         │
└─────────────────────────────────────────────────┘
```

### Provider Hierarchy

```tsx
<SessionListProvider>
  <ActiveSessionProvider>
    <RecordingProvider>
      {/* App */}
    </RecordingProvider>
  </ActiveSessionProvider>
</SessionListProvider>
```

**Reasoning**:
- SessionListProvider is outermost (no dependencies)
- ActiveSessionProvider depends on SessionListProvider (to save completed sessions)
- RecordingProvider depends on ActiveSessionProvider (to send data)

### Component Usage Patterns

#### Before (SessionsZone)
```typescript
const {
  sessions,
  activeSessionId,
  startSession,
  endSession,
  addScreenshot,
  ...
} = useSessions();
```

#### After (SessionsZone)
```typescript
// For session list
const { sessions, filteredSessions } = useSessionList();

// For active session
const {
  activeSession,
  startSession,
  endSession,
  addScreenshot,
} = useActiveSession();

// For recording controls
const {
  recordingState,
  startScreenshots,
  stopAll,
} = useRecording();
```

---

## Migration Checklist

### Phase 1: Create New Contexts
- [x] Analyze SessionsContext (this document)
- [ ] Create SessionListContext.tsx
- [ ] Create ActiveSessionContext.tsx
- [ ] Create RecordingContext.tsx

### Phase 2: Update Providers
- [ ] Update App.tsx with new provider hierarchy
- [ ] Keep SessionsProvider for backward compatibility

### Phase 3: Add Deprecation Warnings
- [ ] Add console warnings to useSessions()
- [ ] Add JSDoc deprecation notices
- [ ] Create migration guide

### Phase 4: Testing
- [ ] Unit tests for SessionListContext
- [ ] Unit tests for ActiveSessionContext
- [ ] Unit tests for RecordingContext
- [ ] Integration tests for all three working together

### Phase 5: Documentation
- [ ] Create migration guide
- [ ] Update CLAUDE.md
- [ ] Add inline documentation

---

## Risks & Mitigations

### Risk 1: Breaking Changes
**Impact**: HIGH - Many components use SessionsContext
**Mitigation**: Keep old SessionsContext working alongside new contexts
**Timeline**: Remove in Phase 7 (Week 14)

### Risk 2: State Synchronization
**Impact**: MEDIUM - ActiveSession must sync with SessionList
**Mitigation**: Use callback pattern - ActiveSessionContext calls SessionListContext.addSession()
**Test**: Integration tests verify state consistency

### Risk 3: Recording Service Callbacks
**Impact**: MEDIUM - Recording services send data via callbacks
**Mitigation**: RecordingContext uses stable callback refs
**Test**: Test callback flow in integration tests

### Risk 4: Performance Regression
**Impact**: LOW - More providers = more React tree depth
**Mitigation**: Contexts are small and focused, re-renders are localized
**Test**: Performance benchmarks before/after

---

## Success Criteria

### Quantitative
- [x] Analysis document created
- [ ] SessionListContext < 400 lines
- [ ] ActiveSessionContext < 400 lines
- [ ] RecordingContext < 400 lines
- [ ] Total reduction: 1155 → ~1030 lines (10% reduction)
- [ ] Test coverage: 80%+ for each context
- [ ] Zero breaking changes (backward compatible)

### Qualitative
- [ ] Each context has single, clear responsibility
- [ ] Contexts are composable (work together via hooks)
- [ ] API is intuitive and well-documented
- [ ] Migration path is clear and low-risk

---

## Implementation Priority

1. **SessionListContext** (FIRST)
   - Simplest: just CRUD operations
   - No dependencies on other contexts
   - Can be tested in isolation

2. **ActiveSessionContext** (SECOND)
   - Depends on SessionListContext
   - Core session lifecycle logic
   - Most complex business logic

3. **RecordingContext** (THIRD)
   - Depends on ActiveSessionContext
   - Thin wrapper around services
   - Simplest once others are done

---

## Next Steps

1. Create SessionListContext.tsx
2. Create unit tests for SessionListContext
3. Create ActiveSessionContext.tsx
4. Create integration tests (SessionList + ActiveSession)
5. Create RecordingContext.tsx
6. Update App.tsx provider hierarchy
7. Add deprecation warnings
8. Create migration guide
9. Verify all 21 components still work
10. Submit verification report

---

## Appendix: File Imports Analysis

Files importing SessionsContext (21 total):
1. `/App.tsx` - Provider setup
2. `/context/SessionsContext.tsx` - Self (exports)
3. `/components/SessionsZone.tsx` - Main sessions UI (HEAVY user)
4. `/components/ActiveSessionView.tsx` - Active session display
5. `/components/CaptureZone.tsx` - Quick capture
6. `/context/EnrichmentContext.tsx` - Enrichment tracking
7. `/components/CanvasView.tsx` - Session canvas
8. `/components/SessionDetailView.tsx` - Session details
9. `/components/TopNavigation/index.tsx` - Nav bar
10. `/components/SettingsModal.tsx` - Settings
11. `/components/QuickNoteFromSession.tsx` - Quick note
12. `/components/QuickTaskFromSession.tsx` - Quick task
13. `/components/sessions/SessionCard.tsx` - Session card
14. `/components/ned/NedChat.tsx` - AI assistant
15. `/components/TopNavigation/useNavData.ts` - Nav data
16. `/components/FloatingControls.tsx` - Floating controls
17. `/components/CommandPalette.tsx` - Command palette
18. `/hooks/useSessionStarting.ts` - Start hook
19. `/hooks/useSessionEnding.ts` - End hook
20. `/components/AudioReviewStatusBanner.tsx` - Audio banner
21. `/hooks/useSession.ts` - Session hook

**Migration Strategy**:
- Components will gradually migrate to new contexts
- Old `useSessions()` will remain for backward compatibility
- Phase 7 will remove SessionsContext entirely
