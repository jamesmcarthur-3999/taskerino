# Phase 2 Fix Implementation - Session Kickoff Prompt

Copy this entire prompt into a new Claude Code conversation:

---

**Context**: We are completing Phase 2 of the Sessions V2 Rewrite project at `/Users/jamesmcarthur/Documents/taskerino`. Phase 1 (Critical Fixes) and Phase 2 (Swift Recording Rewrite) are architecturally complete with 98 passing tests, but **3 critical integration gaps** prevent users from accessing multi-source recording.

**Current Status**:
- ✅ Phase 1: 100% complete (12/12 tasks)
- ✅ Phase 2: 100% complete (10/10 tasks)
- ❌ **Integration gaps**: Video persistence, session manager, compositor UI

**Audits Completed**:
- ✅ Swift code quality audit (9.2/10 - excellent)
- ✅ Rust/FFI security audit (mostly safe, 2 issues identified)
- ✅ TypeScript integration audit (90% ready)
- ✅ E2E integration audit (fully integrated)
- ✅ Storage alignment review (2 critical gaps found)
- ✅ UI integration review (partial integration)

---

## Your Mission

Implement **Wave 1 critical fixes** to make multi-source recording fully functional. This requires **3 agents working in parallel** on:

1. **Video Persistence Fix** (TypeScript) - 2-3 hours
2. **Session Manager** (Rust) - 3-4 hours
3. **Compositor UI** (React) - 3-4 hours

**Wall Time**: ~4-5 hours (parallel execution)
**Total Effort**: ~10-12 hours

---

## Documentation to Read First

Before starting, read these documents to understand the complete context:

1. **Master Fix Summary**: `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/PHASE_2_COMPLETE_FIX_SUMMARY.md`
   - Executive summary of all issues
   - Complete implementation plan
   - Testing checklist

2. **Storage Fix Plan**: `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/PHASE_2_FIX_PLAN.md`
   - Detailed backend fixes
   - Storage alignment issues
   - Code examples with line numbers

3. **UI Integration Plan**: `/Users/jamesmcarthur/Documents/taskerino/docs/sessions-rewrite/CORRECT_UI_INTEGRATION_PLAN.md`
   - Actual UI architecture (not assumptions)
   - CaptureQuickSettings integration
   - Compositor UI implementation

4. **Audit Reports** (optional deep dive):
   - `PHASE_2_SWIFT_AUDIT.md` - Swift code quality
   - `PHASE_2_RUST_AUDIT.md` - Rust/FFI security
   - `PHASE_2_TYPESCRIPT_AUDIT.md` - TypeScript integration
   - `PHASE_2_INTEGRATION_AUDIT.md` - E2E integration

---

## Implementation Instructions

### Step 1: Launch 3 Agents in Parallel

Use the Task tool to launch these agents **simultaneously**:

**Agent 1: TypeScript Specialist**
- **Task**: Fix video persistence in endSession()
- **File**: `src/context/SessionsContext.tsx` (lines 912-993)
- **Requirements**:
  - Add `videoRecordingService.stopRecording()` call
  - Attach returned SessionVideo to session object
  - Use storage transaction for atomic save
  - Test: Video properly saved to sessions
- **Reference**: PHASE_2_FIX_PLAN.md, Issue 1.1
- **Time**: 2-3 hours

**Agent 2: Rust Specialist**
- **Task**: Implement global session manager
- **Files**: `src-tauri/src/lib.rs`, `src-tauri/src/video_recording.rs`
- **Requirements**:
  - Create Arc<Mutex<HashMap<String, SwiftRecordingSession>>> in app state
  - Store sessions on creation (video_recording.rs:1031)
  - Implement get_recording_stats() command (video_recording.rs:1091)
  - Add cleanup on session end
  - Test: Stats polling returns live data
- **Reference**: PHASE_2_FIX_PLAN.md, Issue 1.2
- **Time**: 3-4 hours

**Agent 3: React Specialist**
- **Task**: Add compositor UI to CaptureQuickSettings
- **File**: `src/components/settings/CaptureQuickSettings.tsx`
- **Requirements**:
  - Add compositor state (passthrough/grid/side_by_side)
  - Add radio buttons (show only when 2+ sources selected)
  - Update SessionsTopBar.handleStartSession() to detect multi-source
  - Call startMultiSourceRecording() with compositor parameter
  - Test: Select 2 displays, compositor options appear
- **Reference**: CORRECT_UI_INTEGRATION_PLAN.md, Changes 1-4
- **Time**: 3-4 hours

### Step 2: Monitor Agent Progress

Each agent should:
- ✅ Create detailed todo list BEFORE coding
- ✅ Update PROGRESS.md as they work
- ✅ Run tests after each change
- ✅ Create verification report when complete

### Step 3: Integration Testing

After all 3 agents complete, run manual E2E test:

1. Open SessionsZone
2. Click capture chevron → CaptureQuickSettings
3. Select 2 displays
4. Choose "Grid" compositor
5. Click "Start Session"
6. Verify recording starts
7. Verify RecordingStats shows live data
8. Click "Stop Session"
9. Verify video saved to session
10. Verify video playable with grid layout

### Step 4: Update Documentation

After successful testing:
- [ ] Update PROGRESS.md (Phase 2 = 100% complete, ready for production)
- [ ] Mark all Wave 1 issues as resolved
- [ ] Document any edge cases discovered

---

## Quality Standards

All agents MUST:
- ✅ Read required documentation first
- ✅ Create detailed todo list before coding
- ✅ Write comprehensive tests
- ✅ Run type checking (npm run type-check, cargo check)
- ✅ Run all tests (npm test, cargo test)
- ✅ Create verification report
- ✅ Update PROGRESS.md

## Success Criteria

Wave 1 is complete when:
- [ ] All 3 agents report completion
- [ ] Video recordings attached to sessions
- [ ] Stats polling returns live data
- [ ] Compositor UI functional
- [ ] Manual E2E test passes
- [ ] All existing tests still pass (no regressions)
- [ ] Type checking passes (0 errors in new code)

---

## After Wave 1 (Optional - Future Session)

Consider **Wave 2: Context Migration** (4-6 hours):
- Migrate SessionsZone to Phase 1 contexts
- Enable PersistenceQueue (zero UI blocking)
- Add transaction support
- Fix remaining TypeScript errors

This is **not blocking** - multi-source recording will work after Wave 1.

---

## Important Notes

- ❌ **NO modal on "Start Session" click** - settings configured beforehand via CaptureQuickSettings
- ✅ **Unified Capture button** - don't separate screenshot/video
- ✅ **Use existing UI patterns** - integrate into CaptureQuickSettings dropdown
- ✅ **Backward compatible** - single-source recording must still work

---

## Questions or Issues?

If agents get blocked:
1. Check the detailed plans (PHASE_2_FIX_PLAN.md, CORRECT_UI_INTEGRATION_PLAN.md)
2. Review audit reports for additional context
3. Search codebase for existing patterns
4. Ask user for clarification if UI/UX questions arise

---

**You may proceed with launching the 3 agents in parallel now.**
