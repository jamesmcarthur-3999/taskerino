# PHASE 2: Swift Error Bridge for FFI - Implementation Report

**Date**: October 27, 2025
**Status**: ✅ COMPLETE
**Build Status**: ✅ PASSING (0 errors, 48 warnings - pre-existing)

## Overview

Successfully implemented structured error reporting for ScreenRecorder Swift FFI, enabling Rust to distinguish between different failure modes (permission denied, device not found, already started, etc.).

## Implementation Summary

### 1. New File: RecordingError.swift (192 lines)

**Location**: `/src-tauri/ScreenRecorder/Permissions/RecordingError.swift`

**Key Components**:

#### Error Codes (`RecordingErrorCode`)
```swift
public enum RecordingErrorCode: Int32 {
    case success = 0
    case permissionDenied = 1000
    case deviceNotFound = 1001
    case deviceInUse = 1002
    case configurationInvalid = 1003
    case alreadyStarted = 1004
    case notStarted = 1005
    case timeout = 1006
    case unknown = 9999
}
```

#### Error Context Structure
```swift
public struct FFIErrorContext {
    public let code: Int32
    public let message: String
    public let canRetry: Bool
}
```

#### Thread-Safe Storage
- `setLastFFIError()` - Store error with NSLock protection
- `getLastFFIError()` - Retrieve error safely
- `clearLastFFIError()` - Reset error state

#### FFI Accessor Functions (exported to Rust)
1. `screen_recorder_get_last_error_code()` → Int32
2. `screen_recorder_get_last_error_message()` → UnsafePointer<CChar>? (must be freed)
3. `screen_recorder_get_last_error_can_retry()` → Bool
4. `screen_recorder_clear_last_error()` → Void
5. `screen_recorder_free_string()` → Void (memory management)

#### Error Mapping Helpers
- `mapRecordingSourceError()` - Maps RecordingSourceError cases
- `mapAudioCaptureError()` - Maps AudioCaptureError cases
- `mapNSError()` - Maps generic NSErrors (handles ScreenCaptureKit -3801)

### 2. Updated: ScreenRecorder.swift

#### Modified Functions

**A. `screen_recorder_start` (lines 38-96)**
- Added `clearLastFFIError()` at start
- Added specific error handling for `RecordingSourceError`
- Added ScreenCaptureKit permission check (-3801)
- Maps errors to FFI error codes with user-friendly messages

**Error Mapping**:
```swift
catch let error as RecordingSourceError {
    setLastFFIError(mapRecordingSourceError(error))
}
catch {
    // Check for NSError permission denials
    if nsError.code == -3801 {
        setLastFFIError(FFIErrorContext(
            code: .permissionDenied,
            message: "Screen Recording permission denied...",
            canRetry: true
        ))
    }
}
```

**B. `system_audio_capture_start` (lines 2188-2273)**
- Added `clearLastFFIError()` at start
- Added specific error handling for `AudioCaptureError`
- Added ScreenCaptureKit permission check (-3801)
- Added error context for macOS 13.0+ requirement

**C. Made `AudioCaptureError` public (line 2030)**
```swift
// Before: enum AudioCaptureError: Error
// After:  public enum AudioCaptureError: Error
```
Required for RecordingError.swift to reference it in public functions.

### 3. Updated: build.rs

Added RecordingError.swift to build system:

**Line 17**: Added watch trigger
```rust
println!("cargo:rerun-if-changed=ScreenRecorder/Permissions/RecordingError.swift");
```

**Line 57**: Added to swiftc compilation
```rust
"ScreenRecorder/Permissions/RecordingError.swift",
```

## Verification

### Build Status
```bash
cargo build
# ✅ Finished `dev` profile [optimized + debuginfo] target(s) in 2m 17s
# 48 warnings (all pre-existing deprecation warnings)
# 0 errors
```

### FFI Symbol Verification
```bash
nm -g libScreenRecorder.dylib | grep "screen_recorder.*error"
```

**Exported Symbols** (verified present):
```
✅ _screen_recorder_clear_last_error
✅ _screen_recorder_get_last_error_can_retry
✅ _screen_recorder_get_last_error_code
✅ _screen_recorder_get_last_error_message
✅ _screen_recorder_free_string
```

**Existing Symbols** (verified unchanged):
```
✅ _screen_recorder_start
✅ _screen_recorder_start_display_recording
✅ _screen_recorder_start_pip_recording
✅ _screen_recorder_start_webcam_recording
✅ _screen_recorder_start_window_recording
✅ _system_audio_capture_start
```

## Design Decisions

### 1. Non-Breaking Changes
- Existing FFI functions keep same signature (Bool return)
- Error context is **additive** - opt-in via new accessor functions
- Rust code can continue using Bool return, or query error details

### 2. Thread Safety
- Used `NSLock` for error storage (multiple threads call FFI)
- Lock-protected read/write operations
- Error state is global but safely shared

### 3. Memory Management
- `strdup()` allocates C string for Rust
- Rust **must** call `screen_recorder_free_string()` to free
- Clear contract: Swift allocates, Rust deallocates

### 4. Error Code Ranges
- `0` = success
- `1000-1999` = user errors (permission, configuration)
- `9999` = unknown errors
- Leaves room for future expansion

### 5. Error Context Design
```swift
struct FFIErrorContext {
    code: Int32        // Machine-readable error code
    message: String    // Human-readable message (English)
    canRetry: Bool     // Hint: should user retry?
}
```

**Rationale**:
- `code`: Enables Rust to distinguish error types
- `message`: User-friendly message for UI display
- `canRetry`: Guides retry logic (e.g., permission errors are retryable after user grants permission)

## Usage Example (Rust Side)

```rust
// Existing usage (still works)
let success = screen_recorder_start(recorder, path, width, height, fps);
if !success {
    // Generic error handling
}

// New usage (with error details)
let success = screen_recorder_start(recorder, path, width, height, fps);
if !success {
    let code = screen_recorder_get_last_error_code();
    let message_ptr = screen_recorder_get_last_error_message();
    let can_retry = screen_recorder_get_last_error_can_retry();

    if !message_ptr.is_null() {
        let message = CStr::from_ptr(message_ptr).to_string_lossy();

        match code {
            1000 => println!("Permission denied: {}", message),
            1001 => println!("Device not found: {}", message),
            1004 => println!("Already started: {}", message),
            _ => println!("Unknown error: {}", message),
        }

        // IMPORTANT: Free the message
        screen_recorder_free_string(message_ptr);
    }

    screen_recorder_clear_last_error(); // Clear for next call
}
```

## Error Scenarios Covered

### 1. Permission Denied (Code 1000)
- **Trigger**: User hasn't granted Screen Recording permission
- **Message**: "Screen Recording permission denied. Enable in System Settings > Privacy & Security > Screen Recording"
- **Can Retry**: Yes (after user grants permission)
- **Detection**: ScreenCaptureKit error -3801, RecordingSourceError.permissionDenied

### 2. Device Not Found (Code 1001)
- **Trigger**: No display/window/device available
- **Example**: "No display found for system audio capture"
- **Can Retry**: Yes (user might plug in display)
- **Detection**: AudioCaptureError.displayNotFound, RecordingSourceError.captureFailed

### 3. Already Started (Code 1004)
- **Trigger**: Recording already in progress
- **Message**: "Recording already in progress" / "System audio already capturing"
- **Can Retry**: No (must stop first)
- **Detection**: RecordingSourceError.alreadyCapturing, AudioCaptureError.alreadyCapturing

### 4. Not Started (Code 1005)
- **Trigger**: Tried to stop when not recording
- **Can Retry**: No
- **Detection**: RecordingSourceError.notCapturing, AudioCaptureError.notCapturing

### 5. Configuration Invalid (Code 1003)
- **Trigger**: Invalid recording parameters
- **Can Retry**: Yes (with corrected config)
- **Detection**: RecordingSourceError.notConfigured, RecordingSourceError.configurationFailed

### 6. Unknown (Code 9999)
- **Trigger**: Unexpected errors
- **Message**: Includes `localizedDescription` from Swift error
- **Can Retry**: No (by default)
- **Detection**: Generic catch-all

## Future Enhancements (Not in Scope)

1. **Localization**: Error messages currently English-only
2. **Error Recovery Hints**: Could add `suggestedAction` field
3. **Error Timestamps**: Could track when error occurred
4. **Error History**: Could store last N errors (currently only last)
5. **Rust Type-Safe Bindings**: Could generate Rust enums matching Swift error codes

## Testing Recommendations

### Unit Tests (Swift)
```swift
// Test error mapping
XCTAssertEqual(
    mapRecordingSourceError(.permissionDenied).code,
    RecordingErrorCode.permissionDenied.rawValue
)

// Test thread safety
DispatchQueue.concurrentPerform(iterations: 100) { i in
    setLastFFIError(FFIErrorContext(code: .unknown, message: "\(i)"))
}
```

### Integration Tests (Rust)
```rust
#[test]
fn test_permission_denied_error() {
    // Trigger permission denied
    let recorder = screen_recorder_create();
    let success = screen_recorder_start(recorder, ...);

    assert!(!success);
    assert_eq!(screen_recorder_get_last_error_code(), 1000);

    let msg = screen_recorder_get_last_error_message();
    assert!(!msg.is_null());
    assert!(CStr::from_ptr(msg).to_string_lossy().contains("permission"));

    screen_recorder_free_string(msg);
}
```

### Manual Testing
1. **Permission Denied**: Disable Screen Recording permission, try to start
2. **Already Started**: Call `screen_recorder_start()` twice
3. **Device Not Found**: Unplug display, try system audio capture
4. **macOS Version**: Test on macOS <13.0 for system audio

## Files Changed

1. ✅ **NEW**: `src-tauri/ScreenRecorder/Permissions/RecordingError.swift` (192 lines)
2. ✅ **MODIFIED**: `src-tauri/ScreenRecorder/ScreenRecorder.swift` (+40 lines in 2 functions, 1 type change)
3. ✅ **MODIFIED**: `src-tauri/build.rs` (+2 lines)

## Constraints Met

- ✅ **Non-breaking**: Existing FFI functions unchanged (same signature)
- ✅ **Thread-safe**: NSLock protects error storage
- ✅ **Memory safe**: strdup() + explicit free contract
- ✅ **Zero errors**: Build passes cleanly
- ✅ **FFI exports**: All 5 new functions visible in dylib

## Deployment Checklist

- [x] RecordingError.swift created with full error infrastructure
- [x] screen_recorder_start updated with error handling
- [x] system_audio_capture_start updated with error handling
- [x] AudioCaptureError made public
- [x] build.rs updated to include RecordingError.swift
- [x] Cargo build passes (2m 17s)
- [x] FFI symbols verified with nm
- [ ] Rust bindings generated (NEXT PHASE)
- [ ] Integration tests written (NEXT PHASE)
- [ ] Documentation updated in Rust code (NEXT PHASE)

## Next Steps (Phase 3)

1. **Rust FFI Bindings**: Create type-safe Rust wrappers
   ```rust
   #[derive(Debug)]
   pub enum RecordingError {
       PermissionDenied(String),
       DeviceNotFound(String),
       AlreadyStarted(String),
       // ...
   }

   impl VideoRecorder {
       pub fn start(&self, path: &str, width: i32, height: i32, fps: i32)
           -> Result<(), RecordingError> {
           // Call FFI, check error, return Result
       }
   }
   ```

2. **Error Conversion**: Implement `From<i32>` for `RecordingError`

3. **Integration**: Update `src/video_recording.rs` to use new error system

4. **Testing**: Write Rust integration tests

5. **Documentation**: Add doc comments and examples

## Conclusion

Phase 2 is **complete**. The Swift error bridge is fully implemented, compiled, and verified. The FFI interface now provides structured error reporting while maintaining backward compatibility with existing code.

**Key Achievement**: Rust can now distinguish between "permission denied" vs "device not found" vs "already started" - enabling much better error handling and user experience.

**Build Time**: 2m 17s (includes Swift compilation)
**Memory Overhead**: ~200 bytes per error (1 stored at a time)
**Performance Impact**: Negligible (only on error path)

---

**Implementation by**: Claude (Anthropic AI)
**Review Status**: Ready for code review
**Documentation**: Complete
