# Phase 7: Testing & Launch - Kickoff Brief

**Created**: 2025-10-26
**Updated**: 2025-10-26 (Added Tasks 7.A-7.E based on UI/UX validation)
**Phase**: 7 - Testing & Production Launch
**Prerequisites**: Phases 1-6 Complete
**Estimated Duration**: 10 days (8 days + 2 days for critical fixes)
**Total Tasks**: 12 (4 complete, 8 remaining)
  - Original: 7 tasks (7.1-7.10, with 7.1-7.4 complete)
  - Added: 5 critical UI/UX fixes (7.A-7.E)
**Overall Project Status**: 80.7% complete (71/88 tasks)

---

## Executive Summary

Phase 7 is the **final phase** of the Sessions V2 Rewrite, focusing on comprehensive testing, production deployment infrastructure, and public launch. With **Phases 1-5 complete (80.7% overall)** and Phase 6 actively underway, Phase 7 will deliver the testing coverage, CI/CD pipeline, and production readiness needed for a successful launch.

**Current State**: Strong foundation with extensive unit tests (~1,683 tests), but critical gaps in E2E testing and deployment automation.

**Phase 7 Goals**:
1. **Testing Excellence**: Fill critical test gaps (60%+ coverage, zero failures)
2. **Production Infrastructure**: CI/CD, code signing, auto-updater
3. **Launch Success**: Public release with 99%+ reliability

**Simplified Approach**: This is not a migration from an existing production system. We're building and shipping the complete Sessions V2 system. No feature flags, no staged rollout—just thorough testing and confident deployment.

---

## Table of Contents

1. [Current Status](#1-current-status)
2. [Phase 7 Objectives](#2-phase-7-objectives)
3. [Critical Findings from Investigation](#3-critical-findings-from-investigation)
4. [Task Breakdown](#4-task-breakdown)
5. [Testing Strategy](#5-testing-strategy)
6. [Deployment Pipeline](#6-deployment-pipeline)
7. [Success Criteria](#7-success-criteria)
8. [Timeline & Milestones](#8-timeline--milestones)

---

## 1. Current Status

### Project Progress

| Phase | Status | Tasks | % Complete |
|-------|--------|-------|------------|
| Phase 1: Critical Fixes | ✅ COMPLETE | 12/12 | 100% |
| Phase 2: Swift Recording | ✅ COMPLETE | 16/16 | 100% |
| Phase 3: Audio Architecture | ✅ COMPLETE | 10/10 | 100% |
| Phase 4: Storage Rewrite | ✅ COMPLETE | 12/12 | 100% |
| Phase 5: Enrichment Optimization | ✅ COMPLETE | 14/14 | 100% |
| Phase 6: Review & Playback | 🟡 IN PROGRESS | 0/10 | 0% |
| **Phase 7: Testing & Launch** | 🟡 **READY** | **4/7** | **57%** |
| **TOTAL** | **80.7%** | **71/83** | **⭐** |

### Phase 7 Completed Tasks (4/7)

✅ **Task 7.1**: Master plan documentation (SESSIONS_REWRITE.md)
✅ **Task 7.2**: Agent task templates (AGENT_TASKS.md)
✅ **Task 7.3**: Progress tracking (PROGRESS.md, TODO_LIST.md)
✅ **Task 7.4**: Architecture specs (ARCHITECTURE.md, phase-specific docs)

### Phase 7 Remaining Tasks (8/12) **UPDATED Oct 26**

**Week 13: Critical Fixes** (2 days) **NEW**:
- [ ] Task 7.A: Implement microphone permission checks (0.5 days)
- [ ] Task 7.B: Add recording error recovery (0.5 days)
- [ ] Task 7.C: Upfront permission request modal (0.25 days)
- [ ] Task 7.D: Add camera permission to Info.plist (5 minutes)
- [ ] Task 7.E: Storage quota handling (0.5 days)

**Week 13: Testing** (3 days):
- [ ] Task 7.5: Integration & E2E test suite (2.5 days)
- [ ] Task 7.6: Performance & stress test suite (1.5 days)
- [ ] Task 7.7: Manual testing checklist (0.5 days)

**Week 14: Deploy** (3.5 days):
- [ ] Task 7.8: Final documentation (0.5 days)
- [ ] Task 7.9: Production deployment setup (2 days)
- [ ] Task 7.10: Production release (1 day)

---

## 2. Phase 7 Objectives

### Primary Goals

1. **Testing Completeness**
   - Target: 60%+ overall coverage (from 30%)
   - 100% E2E coverage for critical flows
   - Zero failing tests

2. **Production Infrastructure**
   - Code signing (macOS Gatekeeper approval)
   - CI/CD pipeline (automated builds/tests)
   - Auto-updater (seamless updates)

3. **Launch Excellence**
   - 99%+ reliability (zero critical bugs)
   - Performance targets met (all Phase 6 metrics)
   - User documentation complete

### Success Metrics

| Metric | Before | Target | Critical? |
|--------|--------|--------|-----------|
| Test Coverage | 30% | 60%+ | ✅ YES |
| E2E Test Scenarios | 3 | 15+ | ✅ YES |
| Missing Context Tests | 2 | 0 | ✅ YES |
| Code Signing | Not configured | Working | ✅ YES |
| CI/CD Pipeline | None | Operational | ✅ YES |
| Auto-Updater | None | Working | ⚠️ HIGH |
| Test Pass Rate | 95% | 100% | ✅ YES |
| Crash Rate (Production) | Unknown | <0.1% | ✅ YES |

---

## 3. Critical Findings from Investigation

### 3.1 Testing Infrastructure Assessment

**Overall Grade**: **B+ (Very Good)**

**Strengths** ✅:
- 86 test files, ~1,683 individual tests
- Excellent storage system coverage (Phases 3-4, 80%+)
- Comprehensive enrichment tests (Phase 5, 292 tests)
- Strong state machine tests (21 tests, all transitions)
- Performance baseline tracking in place

**Critical Gaps** ❌:
- **ActiveSessionContext**: NO unit tests (30-40 needed)
- **RecordingContext**: NO unit tests (25-35 needed)
- **Enrichment E2E**: NO end-to-end tests (15-20 needed)
- **Migration E2E**: NO full migration flow tests (10-15 needed)
- **Large Session Handling**: NO edge case tests (>1000 screenshots)

**Test Failures** ⚠️:
- Integration test timeouts (context coordination)
- React `act()` warnings (relationship tests)
- **Pass Rate**: ~95% (5% failing, mostly timeouts)

**Coverage Metrics**:
- Current thresholds: 30% (lines/functions), 25% (branches)
- **TOO LOW**: Should be 50-60% for critical paths
- Well-tested: Storage (80%+), Enrichment (80%+), State machine (90%+)
- Under-tested: Contexts (<50%), UI components (<30%), Hooks (<20%)

### 3.2 Deployment Infrastructure Assessment

**Overall Grade**: **C+ (Functional but Not Production-Ready)**

**Build Configuration**: ✅ **SOLID**
- Vite + Tauri v2 (modern stack)
- Build optimizations configured (LTO, code splitting)
- Pre-release validation script (9 checks)
- Version management working

**Critical Gaps** ❌:
1. **Code Signing NOT Configured** (BLOCKER)
   - Users see "unidentified developer" warning
   - Requires: Apple Developer Certificate
   - Impact: Trust issues, security warnings

2. **No CI/CD Pipeline** (BLOCKER)
   - Manual builds only
   - No automated testing
   - No release automation

3. **No Auto-Updater** (HIGH PRIORITY)
   - Users must manually download updates
   - No update notifications

4. **Rust Panic/Unwrap Usage** (CRITICAL)
   - 68 instances found in codebase
   - Potential crashes in production
   - Need comprehensive audit + fixes

**Platform Support**:
- **macOS 12.3+**: Production ready (Apple Silicon + Intel)
- **Windows/Linux**: Planned for future (Phase 8+)

### 3.3 UI/UX Validation Assessment (October 26, 2025)

**Overall Grade**: **B+ (8.5/10 - Solid Foundation with Critical Gaps)**

**Validation Scope**: SessionsZone interface, permissions flow, control wiring
**Duration**: ~4 hours (2 parallel validation agents)
**Documentation**: `/docs/sessions-rewrite/PHASE_7_UI_UX_FINDINGS.md`

**Strengths** ✅:
- **Control Wiring**: 10/10 - All primary controls (Start/Pause/Resume/Stop) correctly wired to context methods
- **State Management**: 9/10 - Clean 3-context architecture (SessionList, ActiveSession, Recording)
- **Loading States**: 9/10 - Good progress indicators and user feedback
- **Edge Cases**: 9/10 - Multiple rapid clicks properly handled

**Critical Gaps** ❌:

1. **Microphone Permission Checks Stubbed** (P0 - BLOCKS LAUNCH)
   - Location: `src/machines/sessionMachineServices.ts:308-313`
   - Problem: `checkMicrophonePermission()` always returns `true` (stub implementation)
   - Impact: Sessions start with audio enabled, but if permission denied, audio fails silently
   - User Impact: Work for 30 minutes thinking audio is recording → discover 0 audio segments
   - Fix: Task 7.A (0.5 days)

2. **No Error Recovery for Recording Failures** (P0 - BLOCKS LAUNCH)
   - Location: `src/machines/sessionMachine.ts`, recording services
   - Problem: Recording service errors logged but XState machine doesn't transition to `error` state
   - Impact: Sessions stay "active" indefinitely with no recording happening
   - User sees no indication of failure
   - Fix: Task 7.B (0.5 days)

3. **Missing Camera Permission in Info.plist** (P1 - HIGH)
   - Location: `src-tauri/Info.plist`
   - Problem: `NSCameraUsageDescription` not present (App Store rejection risk)
   - Impact: Generic permission dialog, potential rejection
   - Fix: Task 7.D (5 minutes)

4. **Storage Full Handling** (P1 - HIGH)
   - Location: `src/context/ActiveSessionContext.tsx`
   - Problem: Storage quota exceeded errors not surfaced to user
   - Impact: User thinks recording is working, but storage is full
   - Fix: Task 7.E (0.5 days)

**Key Decision**: User accepts restart requirement after granting permissions. This simplifies implementation - we just need **upfront permission checks** before session countdown, not runtime permission detection.

**Action Items**: New critical tasks (7.A-7.E) added to Week 13, Days 1-2 (before testing).

---

## 4. Task Breakdown

### **NEW: Critical UI/UX Fixes (Tasks 7.A-7.E)**

**Context**: UI/UX validation (October 26, 2025) revealed critical permission handling gaps that must be fixed before testing can proceed effectively.

**Total Estimated**: 2 days (fits within Week 13, Days 1-2)

---

### Task 7.A: Implement Microphone Permission Checks
**Priority**: P0 - CRITICAL (BLOCKS LAUNCH)
**Estimated**: 0.5 days
**Agent**: Rust/macOS Specialist

**Objective**: Replace stubbed microphone permission checks with actual macOS API calls

**Problem**:
- `src/machines/sessionMachineServices.ts:308-313` - `checkMicrophonePermission()` always returns `true`
- `src/services/audioRecordingService.ts` - No permission check before starting recording
- Result: Audio fails silently if permission denied

**Deliverables**:

1. **Create Tauri Command** (`src-tauri/src/lib.rs`):
   ```rust
   #[tauri::command]
   fn check_microphone_permission() -> Result<bool, String> {
       // Use AVCaptureDevice.authorizationStatus(for: .audio)
       // Return true if authorized (status == 3), false otherwise
   }
   ```

2. **Implement Permission Check** (`src/machines/sessionMachineServices.ts`):
   ```typescript
   async function checkMicrophonePermission(): Promise<boolean> {
     try {
       return await invoke<boolean>('check_microphone_permission');
     } catch (error) {
       console.error('[sessionMachine] Microphone permission check failed:', error);
       return false;
     }
   }
   ```

3. **Add Check to Audio Service** (`src/services/audioRecordingService.ts`):
   ```typescript
   async startRecording(session: Session): Promise<void> {
     const hasPermission = await invoke<boolean>('check_microphone_permission');
     if (!hasPermission) {
       throw new Error('Microphone permission required. Please grant permission in System Settings > Privacy & Security > Microphone, then restart Taskerino.');
     }
     // ... existing recording logic
   }
   ```

4. **Add Permission Request Modal** (if permission denied):
   - Show modal during XState `checking_permissions` state
   - "Microphone permission required" with clear explanation
   - "Grant Permission" button → triggers macOS dialog
   - After granting: "Please restart Taskerino and try again"

**Tests**:
- 8-10 unit tests
- Test permission check returns correct value
- Test audio service throws on denied permission
- Test XState machine blocks session start if permission missing

**Success Criteria**:
- ✅ Microphone permission actually checked (not stubbed)
- ✅ Audio service fails fast with clear error if permission denied
- ✅ User sees permission request modal before session countdown
- ✅ No silent audio failures

---

### Task 7.B: Add Recording Error Recovery
**Priority**: P0 - CRITICAL (BLOCKS LAUNCH)
**Estimated**: 0.5 days
**Agent**: React/XState Specialist

**Objective**: Propagate recording service errors to XState machine and show user feedback

**Problem**:
- If video/audio/screenshot service throws during `active` state, error is logged but machine doesn't transition to `error` state
- Session appears "active" but nothing is recording
- No UI indication of failure

**Deliverables**:

1. **Add Error Events to Recording Services**:
   ```typescript
   // In screenshotCaptureService, audioRecordingService, videoRecordingService
   try {
     await startRecording();
   } catch (error) {
     emit('recordingError', { service: 'audio', error });
     throw error;
   }
   ```

2. **Add Error Handlers to XState Machine** (`src/machines/sessionMachine.ts`):
   ```typescript
   states: {
     active: {
       on: {
         RECORDING_ERROR: {
           actions: ['logRecordingError', 'showErrorToast'],
           target: 'partial', // New state: some recording working, some failed
         },
       },
     },
     partial: {
       // Session active but some recording services failed
       on: {
         RETRY_RECORDING: { actions: ['retryFailedService'] },
         END_SESSION: { target: 'ending' },
       },
     },
   }
   ```

3. **Show Toast Notification**:
   ```typescript
   // When recording error occurs
   showToast({
     type: 'error',
     message: 'Recording stopped - microphone disconnected',
     action: { label: 'Retry', onClick: () => retryRecording() },
   });
   ```

4. **Update Session State**:
   - If audio fails: Set `session.audioRecording = false`
   - If video fails: Set `session.videoRecording = false`
   - If screenshots fail: Set `session.enableScreenshots = false`
   - UI reflects actual recording state (toggles disabled)

**Tests**:
- 12-15 unit tests
- Test RECORDING_ERROR event transitions to `partial` state
- Test error toast shown with correct message
- Test session state updated to reflect actual recording status
- Test retry button restarts failed service

**Success Criteria**:
- ✅ Recording errors propagate to XState machine
- ✅ User sees toast notification with retry option
- ✅ Session state reflects actual recording status
- ✅ No silent failures

---

### Task 7.C: Upfront Permission Request Modal
**Priority**: P1 - HIGH
**Estimated**: 0.25 days
**Agent**: React/UI Specialist

**Objective**: Request all required permissions **before** session countdown, with clear restart instructions

**Deliverables**:

1. **Permission Request Modal** (`src/components/sessions/PermissionRequestModal.tsx`):
   ```typescript
   interface Props {
     missingPermissions: Array<'screen' | 'microphone' | 'camera'>;
     onGranted: () => void; // User clicked "I've Granted Permission"
     onCancel: () => void;
   }

   // Shows for each missing permission:
   // - Icon + explanation
   // - "Grant Permission" button (triggers macOS dialog)
   // - After granting: "Restart Taskerino" button + explanation
   ```

2. **Show Modal During** `checking_permissions` **State**:
   ```typescript
   const { state, context } = useSessionMachine();

   if (state.matches('checking_permissions') && context.missingPermissions.length > 0) {
     return (
       <PermissionRequestModal
         missingPermissions={context.missingPermissions}
         onGranted={() => {
           showToast('Please restart Taskerino to continue');
         }}
         onCancel={() => send('CANCEL')}
       />
     );
   }
   ```

3. **Clear Messaging**:
   - "Taskerino needs [Screen Recording / Microphone / Camera] permission to record sessions"
   - "After granting permission, restart Taskerino to continue"
   - No ambiguity about restart requirement

**Tests**:
- 5-8 unit tests
- Test modal shows for each missing permission type
- Test modal shows restart instructions after user grants permission

**Success Criteria**:
- ✅ All permissions requested before session countdown
- ✅ Clear restart instructions shown
- ✅ No confusion about next steps

---

### Task 7.D: Add Camera Permission to Info.plist
**Priority**: P1 - HIGH (APP STORE REQUIREMENT)
**Estimated**: 5 minutes
**Agent**: DevOps/Config Specialist

**Objective**: Add `NSCameraUsageDescription` to avoid App Store rejection

**Deliverables**:

Update `src-tauri/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Taskerino needs camera access to include webcam footage in session recordings for enhanced context and review.</string>
```

**Tests**: Manual verification (webcam permission dialog shows custom message)

**Success Criteria**:
- ✅ Camera permission description present in Info.plist
- ✅ macOS shows custom message when requesting camera permission

---

### Task 7.E: Storage Quota Handling
**Priority**: P1 - HIGH
**Estimated**: 0.5 days
**Agent**: Storage Specialist

**Objective**: Detect storage quota exceeded errors and show persistent warning

**Deliverables**:

1. **Catch Quota Errors** (`src/context/ActiveSessionContext.tsx`):
   ```typescript
   async function addScreenshot(screenshot: SessionScreenshot) {
     try {
       await chunkedStorage.appendScreenshot(sessionId, screenshot);
     } catch (error) {
       if (error.name === 'QuotaExceededError') {
         emit('storageFullError');
         showPersistentWarning('Storage full - recording paused');
         disableRecording('screenshots');
       }
     }
   }
   ```

2. **Persistent Warning Banner**:
   ```typescript
   {isStorageFull && (
     <WarningBanner persistent>
       Storage full - recording paused.
       <Link to="/settings/storage">Free up space</Link>
     </WarningBanner>
   )}
   ```

3. **Disable Recording Toggles**:
   - Show tooltip: "Storage full - free up space to continue"
   - Disable screenshot/audio/video toggles
   - Re-enable after space freed

**Tests**:
- 6-8 unit tests
- Test quota exceeded error caught
- Test persistent warning shown
- Test recording toggles disabled
- Test toggles re-enabled after space freed

**Success Criteria**:
- ✅ Storage full errors caught and surfaced
- ✅ User sees persistent warning with actionable link
- ✅ Recording toggles disabled until space freed

---

### Task 7.5: Integration & E2E Test Suite
**Priority**: CRITICAL
**Estimated**: 2.5 days
**Agent**: Testing Specialist

**Scope**: Fill all critical test gaps

**Deliverables**:

1. **ActiveSessionContext Unit Tests** (~30-40 tests)
   ```typescript
   // /src/context/__tests__/ActiveSessionContext.test.tsx
   describe('ActiveSessionContext', () => {
     describe('startSession', () => {
       it('should create session with generated ID');
       it('should update state to active');
       it('should call state machine START event');
     });
     describe('addScreenshot', () => {
       it('should append screenshot to active session');
       it('should trigger queue persistence');
     });
     // ... 30-40 total tests
   });
   ```

2. **RecordingContext Unit Tests** (~25-35 tests)
   ```typescript
   // /src/context/__tests__/RecordingContext.test.tsx
   describe('RecordingContext', () => {
     describe('startScreenshots', () => {
       it('should invoke screenshotCaptureService');
       it('should update recordingState.screenshots to "active"');
       it('should handle service failures gracefully');
     });
     // ... 25-35 total tests
   });
   ```

3. **Enrichment E2E Tests** (~15-20 tests)
   ```typescript
   // /src/__tests__/e2e/enrichment-flow.test.tsx
   describe('Enrichment E2E Flow', () => {
     it('should enrich session: start → end → trigger → verify', async () => {
       // 1. Start session
       // 2. Add data (screenshots, audio)
       // 3. End session
       // 4. Trigger enrichment
       // 5. Verify: cache hit, summary generated, canvas spec created
     });

     it('should use cache on 2nd enrichment (instant, $0)', async () => {
       // Verify EnrichmentResultCache working
     });

     it('should use incremental enrichment (70-90% savings)', async () => {
       // Append screenshots → re-enrich → verify delta processing
     });
   });
   ```

4. **Migration E2E Tests** (~10-15 tests)
   ```typescript
   // /src/__tests__/e2e/migration-flow.test.tsx
   describe('Migration E2E Flow', () => {
     it('should migrate legacy session → chunked storage', async () => {
       // 1. Create legacy session
       // 2. Run migration
       // 3. Verify chunked format
       // 4. Verify data integrity
     });

     it('should rollback to legacy on failure', async () => {
       // Test rollback mechanism
     });
   });
   ```

**Success Metrics**:
- All new tests passing (0 failures)
- Coverage increase: 30% → 45-50%
- Zero `act()` warnings
- Zero test timeouts

---

### Task 7.6: Performance & Stress Test Suite
**Priority**: HIGH
**Estimated**: 1.5 days
**Agent**: Performance Specialist

**Scope**: Validate all Phase 1-6 performance targets + edge cases

**Deliverables**:

1. **Phase 4-6 Performance Validation**
   ```typescript
   // /src/__tests__/performance/validation.test.ts
   describe('Phase 4: Storage Performance', () => {
     it('should load session metadata <50ms (was 2-3s)', async () => {
       const start = performance.now();
       await chunkedStorage.loadAllMetadata();
       expect(performance.now() - start).toBeLessThan(50);
     });

     it('should search 100 sessions <100ms (was 2-3s)');
     it('should achieve >90% cache hit rate');
   });

   describe('Phase 5: Enrichment Performance', () => {
     it('should achieve 78% cost reduction');
     it('should process 5 sessions/min (5x throughput)');
     it('should achieve <1ms cache hit latency');
   });

   describe('Phase 6: Review & Playback Performance', () => {
     it('should load session <1s (was 1.5-6.5s)');
     it('should scroll timeline at 60fps (was 15-30fps)');
     it('should use <100MB memory (was 200-500MB)');
     it('should start playback <500ms (was 1-5s)');
   });
   ```

2. **Stress Tests** (~15-20 tests)
   ```typescript
   // /src/__tests__/stress/edge-cases.test.ts
   describe('Large Session Handling', () => {
     it('should handle session with 1000+ screenshots');
     it('should handle session with 5000+ audio segments');
     it('should handle very large summary (>100KB)');
   });

   describe('Concurrent Operations', () => {
     it('should handle 5 simultaneous active sessions');
     it('should enrich 10 sessions in parallel');
     it('should handle race conditions in storage');
   });

   describe('Sustained Operations', () => {
     it('should run 30-min session without memory leaks');
     it('should handle 100 rapid screenshot captures');
   });

   describe('Error Recovery', () => {
     it('should recover from corrupted storage');
     it('should handle API failures gracefully');
   });
   ```

3. **Performance Baseline Document**
   ```markdown
   # /docs/sessions-rewrite/PERFORMANCE_BASELINE.md

   ## Measured Performance (October 26, 2025)

   ### Phase 4: Storage
   | Metric | Before | After | Improvement | Target Met? |
   |--------|--------|-------|-------------|-------------|
   | Metadata Load | 2-3s | 42ms | 60x faster | ✅ YES |
   | Search (100) | 2-3s | 87ms | 28x faster | ✅ YES |
   | Cache Hit Rate | 0% | 93.4% | ∞ | ✅ YES |

   ### Phase 5: Enrichment
   | Metric | Before | After | Improvement | Target Met? |
   |--------|--------|-------|-------------|-------------|
   | Cost per Session | Baseline | -78% | 78% reduction | ✅ YES |
   | Throughput | 1/min | 5/min | 5x faster | ✅ YES |
   | Cache Hit Latency | N/A | <1ms | Instant | ✅ YES |

   ### Phase 6: Review & Playback
   | Metric | Before | After | Improvement | Target Met? |
   |--------|--------|-------|-------------|-------------|
   | Session Load | 1.5-6.5s | <1s | 3-6x faster | ✅ YES |
   | Memory Usage | 200-500MB | <100MB | 2-5x reduction | ✅ YES |
   | Timeline Scroll | 15-30fps | 60fps | 2-4x smoother | ✅ YES |
   | Playback Start | 1-5s | <500ms | 2-10x faster | ✅ YES |
   ```

**Success Metrics**:
- All performance targets met
- Baseline document created
- Stress tests passing (no crashes, no memory leaks)

---

### Task 7.7: Manual Testing Checklist
**Priority**: HIGH
**Estimated**: 0.5 days
**Agent**: QA Specialist

**Scope**: Comprehensive manual test checklist for final validation

**Deliverables**:

**Manual Testing Checklist** (`MANUAL_TESTING_CHECKLIST.md`)
```markdown
# Manual Testing Checklist - Sessions V2

## Pre-Launch Validation (45-60 minutes)

### Session Lifecycle (15 min)
- [ ] 1. Start new session
- [ ] 2. Verify recording starts (screenshots, audio, video)
- [ ] 3. Add description and tags
- [ ] 4. Extract task and note
- [ ] 5. Pause session
- [ ] 6. Verify pause accumulation
- [ ] 7. Resume session
- [ ] 8. End session
- [ ] 9. Verify session in list
- [ ] 10. Filter and sort sessions

### Enrichment Flow (10 min)
- [ ] 11. Trigger enrichment on completed session
- [ ] 12. Verify progress tracking (no cost shown)
- [ ] 13. Wait for completion
- [ ] 14. Verify summary generated
- [ ] 15. Verify canvas spec created
- [ ] 16. Re-enrich same session → verify cache hit (instant)

### Review & Playback (10 min)
- [ ] 17. Open session detail view
- [ ] 18. Play audio (<500ms start)
- [ ] 19. Scrub timeline (smooth 60fps)
- [ ] 20. Scroll screenshots (virtual scrolling, 60fps)
- [ ] 21. View chapters
- [ ] 22. Navigate between screenshots

### Storage & Performance (10 min)
- [ ] 23. Check storage usage (Settings → Storage)
- [ ] 24. Verify cache hit rate (>90%)
- [ ] 25. Run garbage collection
- [ ] 26. Load 100-session list (<1s)
- [ ] 27. Search 100 sessions (<100ms perceived)
- [ ] 28. Open session detail (<1s)

### Edge Cases (15 min)
- [ ] 29. Start session with no permissions → verify error
- [ ] 30. End session with no data → verify empty session
- [ ] 31. Rapid start/stop (10x in 1 min)
- [ ] 32. Large session (100+ screenshots)
- [ ] 33. Session with API error → verify graceful handling
- [ ] 34. Quit app during active session → verify recovery

### **NEW: Permission Flows** (15 min) **ADDED Oct 26**
- [ ] 39. Start session with screen recording permission denied
  - Verify permission request modal appears
  - Verify "Grant Permission" button triggers macOS dialog
  - Grant permission in System Settings
  - Verify restart instructions shown
  - Restart app
  - Start session → verify recording works
- [ ] 40. Start session with microphone permission denied
  - Verify permission request modal appears
  - Grant permission
  - Restart app
  - Verify audio recording works
- [ ] 41. Start session with camera permission denied (if using webcam)
  - Verify permission request modal appears
  - Verify custom camera permission description shown in macOS dialog
- [ ] 42. Mid-session recording error (disconnect microphone during recording)
  - Verify toast notification: "Recording stopped - microphone disconnected"
  - Verify "Retry" button shown
  - Verify session state updated (audio toggle disabled)
  - Reconnect microphone
  - Click "Retry"
  - Verify audio recording resumes
- [ ] 43. Storage full scenario
  - Fill storage to near quota
  - Start session
  - Verify persistent warning banner: "Storage full - recording paused"
  - Verify recording toggles disabled
  - Verify tooltip explains issue
  - Free up space (delete old sessions)
  - Verify recording toggles re-enabled

### Performance Validation (10 min)
- [ ] 44. Monitor memory usage (<100MB per session)
- [ ] 45. Verify timeline scrolling (60fps)
- [ ] 46. Verify audio playback (smooth, no gaps)
- [ ] 47. Check CPU usage during recording (<20%)
```

**Success Metrics**:
- All manual tests documented
- Checklist used for final validation
- Zero critical bugs found

---

### Task 7.8: Final Documentation
**Priority**: HIGH
**Estimated**: 0.5 days
**Agent**: Documentation Specialist

**Scope**: Complete and update all user and developer documentation

**Deliverables**:

1. **Update CLAUDE.md** (Sessions V2 Section)
   ```markdown
   ### Sessions System (V2 - Production Ready)

   **Status**: ✅ Production Ready (October 2025)
   **Documentation**: `/docs/sessions-rewrite/`

   Sessions V2 is a complete rewrite of the session recording, storage, enrichment, and review system, delivering 3-10x performance improvements across the board.

   **Key Improvements**:
   - Storage: 40-60x faster loads (ChunkedSessionStorage + ContentAddressableStorage)
   - Enrichment: 78% cost reduction (caching, incremental, parallel)
   - Review: 60fps scrolling, <1s loads, <100MB memory
   - Recording: AudioGraph architecture, multi-source support

   **Usage**: See `/docs/sessions-rewrite/README.md` for complete guide.
   ```

2. **Update README.md** (Project Root)
   ```markdown
   ## Recent Updates

   ### Sessions V2 (October 2025) ✨

   Complete rewrite of the session system with 3-10x performance improvements:
   - **Storage**: 40-60x faster loads, automatic deduplication
   - **Enrichment**: 78% cost reduction through intelligent caching
   - **Review**: 60fps scrolling, progressive audio loading
   - **Recording**: New AudioGraph architecture

   See `/docs/sessions-rewrite/` for technical details.
   ```

3. **Create PHASE_7_SUMMARY.md**
   ```markdown
   # Phase 7: Testing & Launch - Summary

   **Completed**: [DATE]
   **Duration**: [X] days
   **Status**: ✅ Production Ready

   ## Deliverables

   ### Testing
   - ✅ Integration & E2E test suite (100+ new tests)
   - ✅ Performance validation (all targets met)
   - ✅ Stress testing (edge cases, concurrency)
   - ✅ Manual testing checklist (38 checkpoints)

   ### Infrastructure
   - ✅ CI/CD pipeline operational
   - ✅ Code signing configured
   - ✅ Auto-updater implemented

   ### Launch
   - ✅ Documentation complete
   - ✅ Production deployment successful

   ## Key Metrics

   | Metric | Before | After | Improvement |
   |--------|--------|-------|-------------|
   | Test Coverage | 30% | 62% | 2.1x |
   | Test Count | 1,683 | 1,850+ | +167 tests |
   | Test Pass Rate | 95% | 100% | Zero failures |
   | Code Signing | None | Working | macOS approved |
   | CI/CD Pipeline | None | Operational | Automated |

   ## Production Launch

   **Release**: v1.0.0
   **Date**: [DATE]
   **Distribution**: GitHub Releases + Direct Download
   **Platforms**: macOS 12.3+ (Universal Binary)

   ## Post-Launch Metrics (30 days)

   - Crash Rate: [X]% (target: <0.1%)
   - Critical Bugs: [X] (target: 0)
   - Performance: All targets maintained
   ```

**Success Metrics**:
- All documentation complete and accurate
- Developer documentation up to date
- User documentation clear

---

### Task 7.9: Production Deployment Setup
**Priority**: CRITICAL
**Estimated**: 2 days
**Agent**: DevOps Specialist

**Scope**: Configure CI/CD, code signing, and auto-updater

**Deliverables**:

1. **Code Signing Configuration**
   ```bash
   # Obtain Apple Developer Certificate
   # - Sign up for Apple Developer Program ($99/year)
   # - Create "Developer ID Application" certificate
   # - Download and install certificate

   # Update src-tauri/tauri.conf.json
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
         "entitlements": "entitlements.plist"
       }
     }
   }

   # Sign app (automated in CI/CD)
   codesign --sign "Developer ID Application: Your Name (TEAM_ID)" \
     --options runtime \
     --entitlements src-tauri/entitlements.plist \
     --deep \
     --force \
     src-tauri/target/release/bundle/macos/Taskerino.app

   # Notarize
   xcrun notarytool submit \
     src-tauri/target/release/bundle/dmg/Taskerino_1.0.0_aarch64.dmg \
     --apple-id "your@email.com" \
     --password "app-specific-password" \
     --team-id "TEAM_ID" \
     --wait

   # Staple
   xcrun stapler staple \
     src-tauri/target/release/bundle/macos/Taskerino.app
   ```

2. **CI/CD Pipeline** (`.github/workflows/`)
   ```yaml
   # .github/workflows/test.yml
   name: Test
   on: [push, pull_request]
   jobs:
     test:
       runs-on: macos-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
         - uses: dtolnay/rust-toolchain@stable
         - run: npm install
         - run: npm run lint
         - run: npm run type-check
         - run: npm test
         - run: npm run build

   # .github/workflows/build.yml
   name: Build & Release
   on:
     push:
       tags:
         - 'v*'
   jobs:
     build-macos:
       runs-on: macos-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
         - uses: dtolnay/rust-toolchain@stable

         - run: npm install
         - run: npm run build

         - uses: tauri-apps/tauri-action@v0
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
             APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
             APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
             APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
             APPLE_ID: ${{ secrets.APPLE_ID }}
             APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
           with:
             tagName: v__VERSION__
             releaseName: 'Taskerino v__VERSION__'
             releaseBody: 'See CHANGELOG.md for details'
             releaseDraft: false
             prerelease: false
   ```

3. **Auto-Updater Setup**
   ```toml
   # src-tauri/Cargo.toml
   [dependencies]
   tauri-plugin-updater = "2"
   ```

   ```json
   // src-tauri/tauri.conf.json
   {
     "updater": {
       "active": true,
       "endpoints": [
         "https://github.com/yourusername/taskerino/releases/latest/download/latest.json"
       ],
       "dialog": true,
       "pubkey": "YOUR_PUBLIC_KEY"
     }
   }
   ```

   ```typescript
   // src/services/updateService.ts
   import { check } from '@tauri-apps/plugin-updater';

   export async function checkForUpdates() {
     try {
       const update = await check();
       if (update?.available) {
         await update.downloadAndInstall();
         // Restart app
       }
     } catch (error) {
       console.error('Update check failed:', error);
     }
   }
   ```

4. **GitHub Secrets Configuration**
   ```yaml
   # GitHub Repository Settings → Secrets
   APPLE_CERTIFICATE               # Base64 .p12
   APPLE_CERTIFICATE_PASSWORD      # Certificate password
   APPLE_SIGNING_IDENTITY          # "Developer ID Application: ..."
   APPLE_ID                        # Apple ID email
   APPLE_PASSWORD                  # App-specific password
   TAURI_PRIVATE_KEY               # Update signature key
   TAURI_KEY_PASSWORD              # Key password
   ```

**Success Metrics**:
- Code signing working (no Gatekeeper warnings)
- CI/CD pipeline operational
- Auto-updater tested and working

---

### Task 7.10: Production Release
**Priority**: CRITICAL
**Estimated**: 1 day
**Agent**: Release Manager

**Scope**: Execute production release

**Deliverables**:

**Production Deployment Checklist**
```markdown
# Production Deployment Checklist

## Pre-Deployment (Day Before)
- [ ] Run full test suite (npm test) - all passing
- [ ] Run manual testing checklist - all passing
- [ ] Update version (package.json, tauri.conf.json, Cargo.toml)
- [ ] Update CHANGELOG.md with release notes
- [ ] Code signing credentials configured
- [ ] CI/CD secrets configured
- [ ] Commit all changes to main branch

## Build Day
- [ ] Create git tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] GitHub Actions triggers build
- [ ] Monitor Actions tab (build succeeds)
- [ ] Artifacts created (DMG, app bundle)

## Verification
- [ ] Download built DMG from GitHub Release
- [ ] Install on clean macOS system
- [ ] Verify code signature (no warnings)
- [ ] Run smoke tests (start session, record, enrich, play)
- [ ] Verify auto-updater endpoint exists

## Release
- [ ] Publish GitHub Release (remove draft status)
- [ ] Verify release is marked as "Latest"
- [ ] Test download link
- [ ] Update website download link (if applicable)

## Post-Release
- [ ] Announce release (social media, email list, etc.)
- [ ] Monitor GitHub Issues
- [ ] Monitor error tracking (if configured)
- [ ] Track download metrics

## Success Criteria
- [ ] DMG downloads without issues
- [ ] No Gatekeeper warnings on install
- [ ] App launches successfully
- [ ] Core workflows functioning (session record/enrich/review)
- [ ] Auto-updater checking for updates
```

**Success Metrics**:
- Public release successful
- Zero critical bugs in first 24 hours
- Download link working
- Auto-updater functional

---

## 5. Testing Strategy

### 5.1 Test Pyramid

```
           /\
          /  \
         / E2E \                    15+ scenarios
        /______\
       /        \
      /  Integ.  \                  50+ integration tests
     /____________\
    /              \
   /   Unit Tests   \               1,850+ unit tests
  /__________________\
```

**Distribution**:
- **Unit Tests**: 85% (1,850+ tests) - Storage, enrichment, contexts, services
- **Integration Tests**: 10% (50+ tests) - Multi-context flows, storage layers
- **E2E Tests**: 5% (15+ tests) - Complete user journeys

### 5.2 Coverage Goals

| Category | Current | Target | Critical? |
|----------|---------|--------|-----------|
| **Overall** | 30% | 60%+ | ✅ |
| **Storage Systems** | 80%+ | 90%+ | ✅ |
| **Enrichment Services** | 80%+ | 90%+ | ✅ |
| **Contexts** | <50% | 80%+ | ✅ |
| **State Machine** | 90%+ | 95%+ | ⚠️ |
| **Hooks** | <20% | 70%+ | ⚠️ |

### 5.3 Test Execution

**Local Development**:
```bash
npm test               # Run all tests
npm run test:ui        # Interactive UI
npm run test:coverage  # Coverage report
```

**CI/CD** (GitHub Actions):
- Run on every push (linting, type-check, tests, build)
- Run on pull requests (full validation)
- Run on tags (release builds)

**Pre-Release**:
```bash
npm run pre-release    # 9-step validation
npm run tauri:build    # Production build
```

---

## 6. Deployment Pipeline

### 6.1 Build Process

**Development**:
```bash
npm run tauri:dev      # Hot reload, instant feedback
```

**Production**:
```bash
npm run pre-release    # Validation (9 checks)
npm run tauri:build    # Build + bundle
# → src-tauri/target/release/bundle/macos/Taskerino.app
# → src-tauri/target/release/bundle/dmg/Taskerino_1.0.0_aarch64.dmg
```

### 6.2 CI/CD Pipeline

```
GitHub Push (main)
  ↓
[Continuous Integration]
├─ Lint (ESLint)
├─ Type Check (tsc --noEmit)
├─ Tests (Vitest)
└─ Build Validation
    ↓
  Merge Approved

GitHub Tag (v1.0.0)
  ↓
[Continuous Deployment]
├─ Build macOS App
│   ├─ Code Sign
│   ├─ Notarize
│   └─ Create DMG
└─ Upload to GitHub Releases
    ↓
  Public Release
```

### 6.3 Release Process

**Day Before**:
1. Update versions (package.json, tauri.conf.json, Cargo.toml)
2. Update CHANGELOG.md
3. Run full test suite + manual testing
4. Commit changes

**Release Day**:
1. Create tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
2. Push tag: `git push origin v1.0.0`
3. GitHub Actions builds automatically
4. Download + test built DMG
5. Publish release

**Post-Release**:
1. Monitor error tracking
2. Check GitHub Issues
3. Track downloads
4. Announce release

---

## 7. Success Criteria

### 7.1 Testing Success

**Phase 7 Testing Complete When**:
- [ ] All new tests passing (0 failures)
- [ ] Test coverage ≥60% (from 30%)
- [ ] E2E test count ≥15 scenarios (from 3)
- [ ] Missing context tests complete (ActiveSession, Recording)
- [ ] All performance targets validated
- [ ] Zero test timeouts
- [ ] Zero `act()` warnings

### 7.2 Deployment Success

**Production Deployment Complete When**:
- [ ] Code signing working (no Gatekeeper warnings)
- [ ] CI/CD pipeline operational (automated builds/tests)
- [ ] Auto-updater working (users can update seamlessly)
- [ ] GitHub Release published
- [ ] DMG available for download
- [ ] Zero critical bugs in first 100 user sessions

### 7.3 Overall Project Success

**Sessions V2 Rewrite Complete When**:
- [ ] All 83 tasks marked complete
- [ ] All 7 phases complete
- [ ] All performance targets met
- [ ] All reliability targets met
- [ ] All cost targets met
- [ ] All documentation complete
- [ ] Production release successful

---

## 8. Timeline & Milestones

### Week 13: Testing (Days 1-5)

**UPDATED TIMELINE** (October 26, 2025): Critical UI/UX fixes added before testing

**Day 1-2: Critical Permission Fixes** (Tasks 7.A-7.E) **NEW**
- Task 7.A: Implement microphone permission checks (0.5 days)
  - Create `check_microphone_permission` Tauri command
  - Unstub `checkMicrophonePermission()` in sessionMachineServices.ts
  - Add permission check to audioRecordingService
  - 8-10 unit tests
- Task 7.B: Add recording error recovery (0.5 days)
  - Add error events to recording services
  - Add `partial` state to XState machine
  - Show toast notifications with retry button
  - Update session state to reflect actual recording status
  - 12-15 unit tests
- Task 7.C: Upfront permission request modal (0.25 days)
  - Create PermissionRequestModal component
  - Show during `checking_permissions` state
  - Clear restart instructions
  - 5-8 unit tests
- Task 7.D: Add camera permission to Info.plist (5 minutes)
  - Add NSCameraUsageDescription
- Task 7.E: Storage quota handling (0.5 days)
  - Catch QuotaExceededError in storage operations
  - Show persistent warning banner
  - Disable recording toggles until space freed
  - 6-8 unit tests

**Rationale**: These fixes are **critical** because:
1. Microphone permission stub causes silent audio failures (P0 blocker)
2. Recording errors not surfaced → broken sessions appear active (P0 blocker)
3. Permission flow confusing without upfront checks (P1)
4. Storage full errors cause silent failures (P1)

**Day 3: Test Suite Development** (Tasks 7.5-7.6)
- ActiveSessionContext unit tests (30-40 tests) **UPDATED: Now includes permission tests**
- RecordingContext unit tests (25-35 tests) **UPDATED: Now includes error propagation tests**
- Enrichment E2E tests (15-20 tests)
- Migration E2E tests (10-15 tests)
- Performance validation tests
- Stress tests (large sessions, concurrency)
- Fix integration test timeouts
- Fix `act()` warnings

**Day 4: Performance Baseline + UX Polish** (Task 7.6 continued)
- Create PERFORMANCE_BASELINE.md
- Validate all Phase 4-6 metrics
- Run stress test suite
- Optional: Recording status badge (Task 7.F) if time permits

**Day 5: Manual Testing** (Task 7.7) **UPDATED**
- Create manual testing checklist **with new permission scenarios**
- Run complete manual test suite (45+ checkpoints, was 38)
- **NEW scenarios**:
  - Permission flows (deny → grant → restart → verify)
  - Recording error recovery (disconnect device mid-session)
  - Storage full scenario
- Document any issues found

**Milestone**: ✅ Testing Complete (Coverage 60%+, all tests passing, permission flows validated)

---

### Week 14: Deploy (Days 6-8)

**Day 6: Documentation** (Task 7.8)
- Update CLAUDE.md (Sessions V2 section)
- Update README.md
- Create PHASE_7_SUMMARY.md
- Review all documentation for accuracy

**Day 7: CI/CD Setup** (Task 7.9)
- Configure code signing
- Set up GitHub Actions workflows (test.yml, build.yml)
- Configure GitHub secrets
- Test CI/CD pipeline

**Day 8: Production Release** (Task 7.10)
- Update versions + CHANGELOG
- Create and push v1.0.0 tag
- Monitor GitHub Actions build
- Download and test built DMG
- Publish release
- Announce

**Milestone**: ✅ Production Launch Complete

---

## 9. Risk Assessment

### 9.1 Critical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Test Failures Block Launch** | Medium | High | Start testing Day 1, fix incrementally |
| **Code Signing Issues** | Low | Critical | Test signing early, have manual fallback |
| **Rust Panics in Production** | Medium | High | Audit + fix 68 panic/unwrap instances |
| **CI/CD Configuration Errors** | Medium | High | Test pipeline before tag push |
| **Performance Regression** | Low | High | Validate all Phase 6 metrics |

### 9.2 Mitigation Strategies

**For Test Failures**:
- Daily test runs during Week 13
- Fix failing tests immediately
- Peer review test code

**For Code Signing**:
- Configure and test signing on Day 7
- Have manual signing process documented as fallback
- Test on clean macOS system before release

**For Rust Panics**:
- Audit all 68 panic/unwrap instances
- Replace with proper error handling
- Add tests for error paths

**For CI/CD**:
- Test pipeline with dummy tag first
- Monitor Actions tab closely
- Have manual build process ready

---

## 10. Deliverables Summary

### 10.1 Code Deliverables

**New Files** (~20 files) **UPDATED Oct 26**:
- **From Tasks 7.A-7.E (Critical Fixes)**:
  - `/src/components/sessions/PermissionRequestModal.tsx` (Task 7.C)
  - `/src/components/__tests__/PermissionRequestModal.test.tsx`
  - `/src/machines/__tests__/sessionMachine.permissions.test.ts` (Task 7.A)
  - `/src/services/__tests__/audioRecordingService.permissions.test.ts` (Task 7.A)
  - `/src/services/__tests__/recordingErrorRecovery.test.ts` (Task 7.B)
- **From Testing Tasks (7.5-7.7)**:
  - `/src/context/__tests__/ActiveSessionContext.test.tsx`
  - `/src/context/__tests__/RecordingContext.test.tsx`
  - `/src/__tests__/e2e/enrichment-flow.test.tsx`
  - `/src/__tests__/e2e/migration-flow.test.tsx`
  - `/src/__tests__/performance/validation.test.ts`
  - `/src/__tests__/stress/edge-cases.test.ts`
- **From Deployment Tasks (7.8-7.10)**:
  - `/src/services/updateService.ts`
  - `.github/workflows/test.yml`
  - `.github/workflows/build.yml`

**Updated Files** (~12 files) **UPDATED Oct 26**:
- **From Tasks 7.A-7.E (Critical Fixes)**:
  - `/src/machines/sessionMachineServices.ts` (unstub microphone permission check)
  - `/src/machines/sessionMachine.ts` (add `partial` state for recording errors)
  - `/src/services/audioRecordingService.ts` (add permission check)
  - `/src/services/screenshotCaptureService.ts` (error propagation)
  - `/src/services/videoRecordingService.ts` (error propagation)
  - `/src/context/ActiveSessionContext.tsx` (storage quota handling)
  - `/src-tauri/src/lib.rs` (add `check_microphone_permission` command)
  - `/src-tauri/Info.plist` (add NSCameraUsageDescription)
- **From Deployment Tasks (7.8-7.10)**:
  - `/src-tauri/tauri.conf.json` (code signing, updater)
  - `/src-tauri/Cargo.toml` (add tauri-plugin-updater)
  - `/package.json` (version bump to 1.0.0)
  - `/CHANGELOG.md` (v1.0.0 release notes)
  - `/CLAUDE.md` (Sessions V2 section)
  - `/README.md` (Sessions V2 highlights)

### 10.2 Documentation Deliverables

**New Documents** **UPDATED Oct 26**:
- `/docs/sessions-rewrite/PHASE_7_UI_UX_FINDINGS.md` **NEW** (UI/UX validation report)
- `/docs/sessions-rewrite/PHASE_7_SUMMARY.md`
- `/docs/sessions-rewrite/PERFORMANCE_BASELINE.md`
- `/docs/sessions-rewrite/MANUAL_TESTING_CHECKLIST.md` (now includes permission scenarios)

**Updated Documents** **UPDATED Oct 26**:
- `/docs/sessions-rewrite/PHASE_7_KICKOFF.md` **NEW** (this document - added Tasks 7.A-7.E)
- `/docs/sessions-rewrite/PROGRESS.md` **NEW** (Phase 7 section added)
- `/CLAUDE.md`
- `/README.md`
- `/CHANGELOG.md`
- `/docs/sessions-rewrite/README.md`

### 10.3 Testing Deliverables **UPDATED Oct 26**

**Test Suite Additions**:
- **From Tasks 7.A-7.E (Critical Fixes)**: +30-40 tests **NEW**
  - Permission check tests: 8-10
  - Recording error recovery tests: 12-15
  - Permission modal tests: 5-8
  - Storage quota tests: 6-8
- **From Testing Tasks (7.5-7.7)**:
  - Context unit tests: +60-70
  - E2E tests: +25-35
  - Performance tests: +30-40
  - Stress tests: +20-30
- **Total**: +165-215 new tests (was +135-175)

**Test Metrics**:
- Test count: 1,683 → 1,850-1,900 (was 1,820-1,860)
- Coverage: 30% → 60%+
- Pass rate: 95% → 100%
- E2E scenarios: 3 → 15+
- **NEW**: Permission flow coverage: 0% → 100%

---

## Appendix: Quick Reference

### Test Commands
```bash
npm test                    # Run all tests
npm run test:ui             # Interactive UI
npm run test:coverage       # Coverage report
npm run pre-release         # Pre-release validation
```

### Build Commands
```bash
npm run tauri:dev           # Development mode
npm run build               # Build frontend
npm run tauri:build         # Production build
```

### Release Commands
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0      # Triggers CI/CD
```

### Documentation Paths
- Master Plan: `/docs/sessions-rewrite/README.md`
- Architecture: `/docs/sessions-rewrite/ARCHITECTURE.md`
- Progress: `/docs/sessions-rewrite/PROGRESS.md`
- This Document: `/docs/sessions-rewrite/PHASE_7_KICKOFF.md`

---

**Document Status**: Updated and Ready for Execution
**Next Action**: Begin Task 7.A (Implement Microphone Permission Checks) **UPDATED Oct 26**
**Target Launch Date**: 10 days from Phase 7 start (was 8 days)

---

## Change Log

### October 26, 2025 - Critical UI/UX Fixes Added

**Summary**: Added 5 new critical tasks (7.A-7.E) based on comprehensive UI/UX validation findings.

**Changes Made**:
1. **Section 3.3**: Added UI/UX Validation Assessment (8.5/10 grade, 4 critical gaps identified)
2. **Section 4**: Inserted Tasks 7.A-7.E before Task 7.5
   - Task 7.A: Implement microphone permission checks (0.5 days)
   - Task 7.B: Add recording error recovery (0.5 days)
   - Task 7.C: Upfront permission request modal (0.25 days)
   - Task 7.D: Add camera permission to Info.plist (5 minutes)
   - Task 7.E: Storage quota handling (0.5 days)
3. **Section 8**: Updated Week 13 timeline to include Days 1-2 for critical fixes
4. **Task 7.7**: Updated manual testing checklist with 9 new permission flow scenarios (38 → 47 checkpoints)
5. **Section 10**: Updated deliverables to include new files and tests
6. **Header**: Updated task counts (7 → 12 tasks) and duration (8 → 10 days)

**Rationale**: UI/UX validation revealed critical permission handling gaps that would cause silent failures (microphone permission stubbed, recording errors not surfaced). These must be fixed before testing can proceed effectively.

**Impact**: +2 days to Phase 7 timeline, +30-40 tests, 100% permission flow coverage

**Reference**: `/docs/sessions-rewrite/PHASE_7_UI_UX_FINDINGS.md`

---

**END OF PHASE 7 KICKOFF DOCUMENT**
