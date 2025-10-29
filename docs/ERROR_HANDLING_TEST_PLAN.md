# Error Handling System Test Plan

**System**: Recording Services Error Handling (Phase 1-4)
**Status**: Ready for Manual Testing
**Created**: 2025-10-27

## Overview

This test plan validates the end-to-end error handling system for recording services (screenshots, audio, video). The system provides:

- **Rust-level structured errors** with proper error propagation
- **Swift FFI error bridge** with detailed error context
- **TypeScript discriminated unions** with type-safe error handling
- **React UI error banners** with actionable recovery options

## Test Matrix

| Service | Error Type | Test Scenario | Expected UI Behavior |
|---------|-----------|---------------|---------------------|
| Screenshots | Permission Denied | Screen Recording permission revoked | Red banner with "Open Settings" button |
| Screenshots | System Error | Graphics system failure | Orange banner with "Retry" button |
| Screenshots | Device Not Found | Display disconnected | Orange banner with device info |
| Audio | Permission Denied | Microphone permission revoked | Red banner with "Open Settings" button |
| Audio | Device Not Found | Microphone unplugged | Orange banner with "Select Device" action |
| Audio | Device In Use | Microphone used by another app | Orange banner with "Retry" button |
| Video | Permission Denied | Screen Recording permission revoked | Red banner with "Open Settings" button |
| Video | System Error | ScreenCaptureKit failure | Orange banner with "Retry" button |
| Video | Timeout | Recording start timeout | Orange banner with timeout info |

**Total**: 9 critical test cases (3 services × 3 common error types)

## Prerequisites

### 1. Build Verification

```bash
cd /Users/jamesmcarthur/Documents/taskerino

# Verify Rust compilation
cd src-tauri
cargo build
# Expected: ✅ Successful (49 pre-existing warnings OK)

# Verify TypeScript compilation
cd ..
npx tsc --noEmit
# Expected: ✅ No errors (2 pre-existing in unrelated components OK)

# Run application
npm run tauri:dev
```

### 2. Initial Setup

1. **Grant all permissions** (start from clean state):
   - System Settings → Privacy & Security → Screen Recording → Enable Taskerino
   - System Settings → Privacy & Security → Microphone → Enable Taskerino

2. **Verify app starts without errors**:
   - Launch app via `npm run tauri:dev`
   - Navigate to Sessions Zone
   - Click "Start Session"
   - Verify all recording services start successfully
   - End session

3. **Clear permissions** (prepare for testing):
   ```bash
   tccutil reset All com.taskerino.desktop
   ```

## Test Cases

### Test 1: Screenshots Permission Denied

**Steps**:
1. Revoke Screen Recording permission:
   - System Settings → Privacy & Security → Screen Recording
   - **Disable** Taskerino
2. In app: Navigate to Sessions Zone
3. Click "Start Session"
4. Name session "Test Screenshots Permission"
5. Click "Start Session"

**Expected Behavior**:
- ✅ Session starts (audio may succeed independently)
- ✅ Red error banner appears at top of ActiveSessionView:
  - **Icon**: Camera icon with red background
  - **Text**: "Screen Recording permission denied. Please enable in System Settings."
  - **Buttons**: "Open System Settings" (primary) + "Dismiss" (secondary)
- ✅ Console log: `[RECORDING] Screenshots error: PermissionDenied`

**Actions to Test**:
- **Click "Open System Settings"**: Should open System Settings → Privacy & Security → Screen Recording
- **Click "Dismiss"**: Banner should fade out smoothly (AnimatePresence)
- **Grant permission in System Settings**: Return to app
- **Click "Retry"** (if available): Screenshots should start successfully, banner disappears

**Success Criteria**:
- Banner is clearly visible and non-blocking
- "Open System Settings" opens correct pane
- Retry works after granting permission
- Other services (audio) continue independently

---

### Test 2: Screenshots System Error

**Steps**:
1. Ensure Screen Recording permission is **granted**
2. Start session normally
3. While session is active, disconnect all displays (or use DisplayLink disconnect if available)

**Expected Behavior**:
- ✅ Orange warning banner appears:
  - **Icon**: Camera icon with orange background
  - **Text**: "Screenshot service encountered an error: [error details]"
  - **Buttons**: "Retry" + "Dismiss"

**Actions to Test**:
- **Click "Retry"**: Should attempt to restart screenshots
- **Reconnect display**: Should allow retry to succeed

**Success Criteria**:
- Error is classified correctly (not permission error)
- Retry mechanism works
- Session continues (not aborted)

---

### Test 3: Screenshots Device Not Found

**Setup**: This error is rare on macOS (requires display disconnection during capture). May need to simulate via code injection for full coverage.

**Expected Behavior**:
- Orange banner with device-specific error message
- "Retry" button available

---

### Test 4: Audio Permission Denied

**Steps**:
1. Revoke Microphone permission:
   - System Settings → Privacy & Security → Microphone
   - **Disable** Taskerino
2. Start new session with audio recording enabled

**Expected Behavior**:
- ✅ Red error banner appears:
  - **Icon**: Microphone icon with red background
  - **Text**: "Microphone permission denied. Please enable in System Settings."
  - **Buttons**: "Open System Settings" + "Dismiss"
- ✅ Console log: `[AUDIO] Permission denied error`

**Actions to Test**:
- **Click "Open System Settings"**: Should open System Settings → Privacy & Security → Microphone
- **Grant permission**: Return to app
- **Click "Retry"**: Audio should start successfully

**Success Criteria**:
- Correct System Settings pane opened
- Retry works after permission grant
- Other services (screenshots) continue

---

### Test 5: Audio Device Not Found

**Steps**:
1. Ensure Microphone permission is granted
2. Start session with audio recording enabled
3. **While session active**, unplug USB microphone (if using one) or disable input device in Sound settings

**Expected Behavior**:
- ✅ Orange warning banner appears:
  - **Icon**: Microphone icon
  - **Text**: "Audio device not found: [device name or ID]"
  - **Buttons**: "Retry" + "Dismiss"

**Actions to Test**:
- **Reconnect device**: Should allow retry to succeed
- **Click "Retry"**: Should attempt to re-initialize audio

**Success Criteria**:
- Device name/ID shown in error message
- Session continues (not aborted)

---

### Test 6: Audio Device In Use

**Steps**:
1. Open another app that uses microphone (e.g., Voice Memos, Zoom)
2. Start recording in that app
3. In Taskerino, start new session with audio

**Expected Behavior**:
- ✅ Orange warning banner:
  - **Text**: "Audio device is in use by another application"
  - **Buttons**: "Retry" + "Dismiss"

**Actions to Test**:
- **Stop other app's recording**: Release device
- **Click "Retry"**: Audio should start successfully

**Success Criteria**:
- Error clearly indicates device conflict
- Retry works after releasing device

---

### Test 7: Video Permission Denied

**Steps**:
1. Revoke Screen Recording permission (same as Test 1)
2. Start session with video recording enabled

**Expected Behavior**:
- ✅ Red error banner:
  - **Icon**: Video camera icon with red background
  - **Text**: "Screen Recording permission denied..."
  - **Buttons**: "Open System Settings" + "Dismiss"

**Success Criteria**:
- Same as Test 1 but for video service
- Independent of screenshot/audio state

---

### Test 8: Video System Error

**Steps**:
1. Start session with video recording
2. Use Activity Monitor to pause `Taskerino` process briefly (simulate resource contention)

**Expected Behavior**:
- Orange warning banner with system error details
- "Retry" available

**Success Criteria**:
- Error classified as system error (not permission)
- Retry mechanism works

---

### Test 9: Video Timeout Error

**Steps**:
1. Start session with video recording
2. Immediately after clicking "Start Session", open System Settings → Screen Recording (triggers macOS permission dialog if not granted)

**Expected Behavior**:
- Orange banner after 30-second timeout:
  - **Text**: "Video recording timed out after 30 seconds"
  - **Buttons**: "Retry" + "Dismiss"

**Success Criteria**:
- Timeout error classified correctly
- 30-second duration logged
- Retry available

---

## Cross-Service Tests

### Test 10: Multiple Simultaneous Errors

**Steps**:
1. Revoke both Screen Recording and Microphone permissions
2. Start session with all services enabled

**Expected Behavior**:
- ✅ **Two error banners appear** (AnimatePresence mode="popLayout"):
  - Screenshots permission banner (top)
  - Audio permission banner (below)
- ✅ Banners stack vertically with 0.5rem gap
- ✅ Both "Open System Settings" buttons work independently

**Success Criteria**:
- Multiple errors displayed without overlap
- Each error banner independently actionable
- Smooth animations (no jank)

---

### Test 11: Error Recovery During Active Session

**Steps**:
1. Start session with all permissions granted
2. All services recording successfully
3. Revoke Screen Recording permission during session
4. Observe error banner appears
5. Grant permission again
6. Click "Retry"

**Expected Behavior**:
- ✅ Session **does not abort** when service fails
- ✅ Error banner appears immediately upon failure
- ✅ "Retry" successfully restarts failed service
- ✅ Other services continue uninterrupted
- ✅ Banner disappears after successful retry

**Success Criteria**:
- Resilient session lifecycle (no full abort)
- Hot-swapping of failed services
- UI reflects real-time service state

---

### Test 12: Error Persistence Across Session Pause/Resume

**Steps**:
1. Start session
2. Cause error (e.g., revoke microphone)
3. Pause session (error banner should remain)
4. Resume session
5. Error should still be displayed

**Expected Behavior**:
- Error state persists across pause/resume
- Banner remains visible during pause
- Resume does not auto-retry (user must click "Retry")

**Success Criteria**:
- Error state tracked per-service in RecordingContext
- UI consistency across session state transitions

---

## UI/UX Validation

### Visual Checks

- [ ] Error banners use correct colors:
  - Red (permission errors): `bg-red-500/20 border-red-500/30 text-red-100`
  - Orange (other errors): `bg-orange-500/20 border-orange-500/30 text-orange-100`
- [ ] Icons match service type:
  - Screenshots: `Camera` from lucide-react
  - Audio: `Mic`
  - Video: `Video`
- [ ] Buttons are clearly visible and styled consistently
- [ ] Glass morphism effect applied (`backdrop-blur-md`)
- [ ] Animations smooth (60fps, no jank)
- [ ] Responsive on narrow viewports (tested at 1024px, 768px)

### Animation Checks

- [ ] Banner entrance: Fade in + slide down (0-10px) over 200ms
- [ ] Banner exit: Fade out + slide up over 150ms
- [ ] Multiple banners: Staggered layout shift (AnimatePresence mode="popLayout")
- [ ] No flashing or jank during state transitions

### Accessibility Checks

- [ ] Error messages are readable (high contrast)
- [ ] Buttons are keyboard-navigable (Tab key)
- [ ] Screen reader announces errors (aria-live="polite")
- [ ] Dismiss via Escape key (if implemented)

---

## Logging Validation

### Console Logs to Verify

Each error should produce detailed logs:

**TypeScript Console**:
```
[RECORDING] Screenshots error: PermissionDenied
[RECORDING] Error details: {type: 'PermissionDenied', data: {...}}
[RECORDING] Classified error from: Error: Permission denied...
```

**Rust Console** (Tauri logs):
```
[ERROR] video_recording: Failed to start recording: PermissionDenied { permission: ScreenRecording, can_retry: true, ... }
[ERROR] FFI error code: 1000
[ERROR] FFI error message: Screen Recording permission denied. Please grant access in System Settings...
```

### Log Checks

- [ ] Error type correctly identified in logs
- [ ] FFI error codes match (1000-1008 range)
- [ ] Error messages user-friendly (no stack traces in UI)
- [ ] Rust error propagation chain visible in logs

---

## Edge Cases

### Edge Case 1: Rapid Permission Changes

**Steps**:
1. Start session
2. Rapidly revoke → grant → revoke Screen Recording permission (within 5 seconds)

**Expected**:
- Error banners appear/disappear correctly
- No duplicate banners
- Cache invalidation works (5-second TTL)

### Edge Case 2: Permission Granted During "Open Settings" Flow

**Steps**:
1. Revoke permission
2. Start session → error banner appears
3. Click "Open System Settings"
4. Grant permission in System Settings (app still in foreground)
5. Return to app (don't click "Retry" yet)

**Expected**:
- Banner still visible (error state not auto-cleared)
- Click "Retry" → Banner disappears, recording starts

### Edge Case 3: App Restart with Pending Errors

**Steps**:
1. Start session with errors
2. Quit app (CMD+Q)
3. Restart app
4. Check if session resumed with error state

**Expected**:
- Error state does not persist after restart (fresh session start)
- User must re-trigger errors

---

## Performance Checks

- [ ] Error banner rendering: <16ms (60fps)
- [ ] Permission cache lookup: <1ms (in-memory)
- [ ] FFI error code retrieval: <5ms
- [ ] AnimatePresence layout shift: Smooth, no jank
- [ ] Memory: No leaks after 100 error banner cycles

---

## Regression Checks

Ensure existing functionality still works:

- [ ] Normal session start (all permissions granted): No errors
- [ ] Screenshot capture: Works as before
- [ ] Audio recording: Works as before
- [ ] Video recording: Works as before
- [ ] Session pause/resume: No regressions
- [ ] Session end: Enrichment pipeline unaffected
- [ ] Existing error handling (toast notifications): Still works

---

## Success Criteria Summary

**Phase 1-4 Complete** when:
- ✅ All 12 test cases pass
- ✅ UI/UX validation complete (visual + animation + accessibility)
- ✅ Logging validation complete (TypeScript + Rust)
- ✅ Edge cases handled correctly
- ✅ Performance targets met
- ✅ No regressions in existing features

**Production Ready** when:
- ✅ User can recover from all error types without restarting app
- ✅ Error messages are clear and actionable
- ✅ "Open System Settings" always opens correct pane
- ✅ Retry mechanism reliably restarts failed services
- ✅ Multiple simultaneous errors displayed without conflicts

---

## Known Limitations

1. **Swift Error Context**: Some Swift errors may not provide detailed device IDs (ScreenCaptureKit limitation)
2. **System Audio Permissions**: macOS uses Screen Recording permission for system audio (not intuitive, but documented)
3. **Permission Cache**: 5-second TTL means immediate permission changes may not reflect for 5 seconds (acceptable tradeoff)
4. **Error Classification**: Generic errors from external libraries may be classified as "Internal" (requires pattern matching in classifiers)

---

## Next Steps After Testing

1. **Fix Issues**: Address any test failures
2. **Update Documentation**: Document any discovered edge cases
3. **Performance Tuning**: Optimize if any performance issues found
4. **User Feedback**: Gather feedback on error message clarity
5. **Monitoring**: Add telemetry for error frequency in production

---

## Testing Checklist

**Before Starting**:
- [ ] Build successful (Rust + TypeScript)
- [ ] App launches without errors
- [ ] All permissions granted initially
- [ ] Permissions cleared for testing

**During Testing**:
- [ ] Test 1-12 completed and documented
- [ ] Visual checks passed
- [ ] Animation checks passed
- [ ] Accessibility checks passed
- [ ] Logging validation complete
- [ ] Edge cases tested
- [ ] Performance checks passed
- [ ] Regression checks passed

**After Testing**:
- [ ] All issues documented in GitHub
- [ ] Test results shared with team
- [ ] Documentation updated
- [ ] Production deployment approved

---

## Contact

For questions or issues during testing:
- **Developer**: Claude Code (this system)
- **Project**: Taskerino Recording Error Handling
- **Phase**: 1-4 Complete (Rust → Swift → TypeScript → React UI)
- **Status**: Ready for Manual Testing

---

**Last Updated**: 2025-10-27
**Version**: 1.0
**Test Plan Status**: Draft → Ready for Execution
