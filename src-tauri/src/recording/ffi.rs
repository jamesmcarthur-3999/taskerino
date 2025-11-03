/**
 * FFI Safety Layer for Swift ScreenRecorder
 *
 * Provides safe RAII wrappers around raw Swift FFI pointers to eliminate:
 * - Memory leaks from forgotten cleanup
 * - Use-after-free bugs
 * - Double-free errors
 * - Null pointer dereferences
 */
use std::ffi::{c_void, CString};
use std::ptr::NonNull;
use std::time::Duration;
use tokio::time::timeout;

use super::error::FFIError;

// External Swift FFI declarations (legacy single-source API)
// Kept for backward compatibility but no longer used by Rust code
#[allow(dead_code)]
extern "C" {
    fn screen_recorder_create() -> *mut c_void;
    fn screen_recorder_destroy(recorder: *mut c_void);
    fn screen_recorder_start(
        recorder: *mut c_void,
        path: *const std::os::raw::c_char,
        width: i32,
        height: i32,
        fps: i32,
    ) -> bool;
    fn screen_recorder_stop(recorder: *mut c_void) -> bool;
    fn screen_recorder_is_recording(recorder: *mut c_void) -> bool;
}

// New multi-source Recording Session FFI (Task 2.8 - Phase 2)
extern "C" {
    fn recording_session_create(
        output_path: *const std::os::raw::c_char,
        width: i32,
        height: i32,
        fps: i32,
    ) -> *mut c_void;

    fn recording_session_add_display_source(
        session: *mut c_void,
        display_id: u32,
    ) -> i32;

    fn recording_session_add_window_source(
        session: *mut c_void,
        window_id: u32,
    ) -> i32;

    fn recording_session_add_webcam_source(
        session: *mut c_void,
        device_id: *const std::os::raw::c_char,
    ) -> i32;

    fn recording_session_set_compositor(
        session: *mut c_void,
        compositor_type: i32,
    ) -> i32;

    fn recording_session_start(session: *mut c_void) -> i32;

    fn recording_session_stop(session: *mut c_void) -> i32;

    fn recording_session_get_stats(
        session: *mut c_void,
        out_frames_processed: *mut u64,
        out_frames_dropped: *mut u64,
        out_is_recording: *mut bool,
    ) -> i32;

    // New pause/resume/hot-swap functions
    fn recording_session_pause(session: *mut c_void) -> i32;
    fn recording_session_resume(session: *mut c_void) -> i32;
    fn recording_session_is_paused(session: *mut c_void) -> i32;
    fn recording_session_switch_source(
        session: *mut c_void,
        old_source_id: *const std::os::raw::c_char,
        source_type: i32,
        new_source_id: *const std::os::raw::c_char,
    ) -> i32;

    fn recording_session_destroy(session: *mut c_void);
}

// MARK: - Multi-Source Recording Session (Task 2.9 - Phase 2)

/// FFI Error codes from Swift RecordingSession
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum RecordingSessionError {
    Success = 0,
    InvalidParams = 1,
    NotFound = 2,
    AlreadyRecording = 3,
    NotRecording = 4,
    SourceLimitReached = 5,
    InternalError = 6,
}

impl RecordingSessionError {
    /// Convert FFI error code to Result
    pub fn from_code(code: i32) -> Result<(), FFIError> {
        match code {
            0 => Ok(()),
            1 => Err(FFIError::SwiftError("Invalid parameters".to_string())),
            2 => Err(FFIError::SwiftError("Display or window not found".to_string())),
            3 => Err(FFIError::SwiftError("Already recording".to_string())),
            4 => Err(FFIError::SwiftError("Not recording".to_string())),
            5 => Err(FFIError::SwiftError("Source limit reached (max 4)".to_string())),
            6 => Err(FFIError::SwiftError("Internal Swift error".to_string())),
            7 => Err(FFIError::SwiftError("Screen recording permission denied. Please enable screen recording permission in System Settings > Privacy & Security > Screen Recording".to_string())),
            _ => Err(FFIError::SwiftError(format!("Unknown error code: {}", code))),
        }
    }
}

/// Compositor type for multi-source recording
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum CompositorType {
    /// Single source passthrough (no composition)
    Passthrough = 0,
    /// Grid layout (2x2 or 3x3)
    Grid = 1,
    /// Side-by-side horizontal layout
    SideBySide = 2,
}

/// Source type for recording
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceType {
    Display,
    Window,
    Webcam,
}

/// Recording statistics
#[derive(Debug, Clone, Copy, Default, serde::Serialize, serde::Deserialize)]
pub struct RecordingStats {
    pub frames_processed: u64,
    pub frames_dropped: u64,
    pub is_recording: bool,
}

/// Safe handle for Swift RecordingSession with automatic cleanup
///
/// This wrapper provides RAII semantics for multi-source recording sessions:
/// - Guaranteed cleanup via Drop
/// - Null pointer safety via NonNull
/// - Support for multiple sources (display, window, webcam)
/// - Dynamic source management before start
/// - Configurable compositor
#[derive(Debug)]
pub struct SwiftRecordingSession(NonNull<c_void>);

// SAFETY: The Swift RecordingSession uses actors for thread safety
unsafe impl Send for SwiftRecordingSession {}
unsafe impl Sync for SwiftRecordingSession {}

impl SwiftRecordingSession {
    /// Create a new multi-source recording session
    ///
    /// # Errors
    ///
    /// Returns:
    /// - `FFIError::NullPointer` if Swift returns null
    /// - `FFIError::SwiftError` if parameters are invalid
    pub fn new(
        output_path: &str,
        width: i32,
        height: i32,
        fps: i32,
    ) -> Result<Self, FFIError> {
        if width <= 0 || height <= 0 || fps <= 0 {
            return Err(FFIError::SwiftError(
                "Invalid parameters: width, height, fps must be > 0".to_string(),
            ));
        }

        let c_path = CString::new(output_path)
            .map_err(|_| FFIError::SwiftError("Path contains null byte".to_string()))?;

        // SAFETY: recording_session_create is a Swift function that returns
        // either a valid pointer or null. We check for null below.
        let ptr = unsafe {
            recording_session_create(
                c_path.as_ptr(),
                width,
                height,
                fps,
            )
        };

        NonNull::new(ptr)
            .ok_or(FFIError::NullPointer)
            .map(SwiftRecordingSession)
    }

    /// Add a display source to the session (before starting)
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Already recording
    /// - Display not found
    /// - Source limit reached (max 4)
    pub fn add_display(&mut self, display_id: u32) -> Result<(), FFIError> {
        // SAFETY: We own the session pointer
        let result = unsafe {
            recording_session_add_display_source(self.0.as_ptr(), display_id)
        };

        RecordingSessionError::from_code(result)
    }

    /// Add a window source to the session (before starting)
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Already recording
    /// - Window not found
    /// - Source limit reached (max 4)
    pub fn add_window(&mut self, window_id: u32) -> Result<(), FFIError> {
        // SAFETY: We own the session pointer
        let result = unsafe {
            recording_session_add_window_source(self.0.as_ptr(), window_id)
        };

        RecordingSessionError::from_code(result)
    }

    /// Add a webcam source to the session (before starting)
    ///
    /// # Arguments
    ///
    /// * `device_id` - The AVCaptureDevice uniqueID for the webcam
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Already recording
    /// - Device not found
    /// - Source limit reached (max 4)
    pub fn add_webcam(&mut self, device_id: &str) -> Result<(), FFIError> {
        use std::ffi::CString;

        let c_device_id = CString::new(device_id)
            .map_err(|_| FFIError::InvalidConfig("Invalid device ID".to_string()))?;

        // SAFETY: We own the session pointer and c_device_id is valid for the duration of the call
        let result = unsafe {
            recording_session_add_webcam_source(self.0.as_ptr(), c_device_id.as_ptr())
        };

        RecordingSessionError::from_code(result)
    }

    /// Set the compositor type for combining multiple sources
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Already recording
    /// - Invalid compositor type
    pub fn set_compositor(&mut self, compositor: CompositorType) -> Result<(), FFIError> {
        // SAFETY: We own the session pointer
        let result = unsafe {
            recording_session_set_compositor(self.0.as_ptr(), compositor as i32)
        };

        RecordingSessionError::from_code(result)
    }

    /// Start recording with configured sources
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - No sources added
    /// - Already recording
    /// - Failed to start any source
    pub async fn start(&mut self) -> Result<(), FFIError> {
        self.start_with_timeout(Duration::from_secs(5)).await
    }

    /// Start recording with custom timeout
    ///
    /// # Errors
    ///
    /// Returns:
    /// - `FFIError::Timeout` if start takes longer than specified duration
    /// - `FFIError::SwiftError` if start fails
    pub async fn start_with_timeout(&mut self, duration: Duration) -> Result<(), FFIError> {
        let ptr_addr = self.0.as_ptr() as usize;

        let result = timeout(
            duration,
            tokio::task::spawn_blocking(move || {
                let ptr = ptr_addr as *mut c_void;
                // SAFETY: We own the session pointer
                unsafe { recording_session_start(ptr) }
            }),
        )
        .await;

        match result {
            Ok(Ok(code)) => RecordingSessionError::from_code(code),
            Ok(Err(_)) => Err(FFIError::SwiftError(
                "Failed to join start task".to_string(),
            )),
            Err(_) => Err(FFIError::Timeout),
        }
    }

    /// Stop recording and finalize video
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Not currently recording
    /// - Failed to stop sources or finalize video
    pub async fn stop(&mut self) -> Result<(), FFIError> {
        self.stop_with_timeout(Duration::from_secs(10)).await
    }

    /// Stop recording with custom timeout
    ///
    /// # Errors
    ///
    /// Returns:
    /// - `FFIError::Timeout` if stop takes longer than specified duration
    /// - `FFIError::SwiftError` if stop fails
    pub async fn stop_with_timeout(&mut self, duration: Duration) -> Result<(), FFIError> {
        let ptr_addr = self.0.as_ptr() as usize;

        let result = timeout(
            duration,
            tokio::task::spawn_blocking(move || {
                let ptr = ptr_addr as *mut c_void;
                // SAFETY: We own the session pointer
                unsafe { recording_session_stop(ptr) }
            }),
        )
        .await;

        match result {
            Ok(Ok(code)) => RecordingSessionError::from_code(code),
            Ok(Err(_)) => Err(FFIError::SwiftError("Failed to join stop task".to_string())),
            Err(_) => Err(FFIError::Timeout),
        }
    }

    /// Get recording statistics
    ///
    /// This is synchronous and should be fast.
    pub fn get_stats(&self) -> RecordingStats {
        let mut frames_processed: u64 = 0;
        let mut frames_dropped: u64 = 0;
        let mut is_recording: bool = false;

        // SAFETY: We own the session pointer and provide valid out-parameters
        let result = unsafe {
            recording_session_get_stats(
                self.0.as_ptr(),
                &mut frames_processed,
                &mut frames_dropped,
                &mut is_recording,
            )
        };

        // Stats query should never fail, but handle error just in case
        if result != 0 {
            eprintln!("Warning: recording_session_get_stats returned error code {}", result);
        }

        RecordingStats {
            frames_processed,
            frames_dropped,
            is_recording,
        }
    }

    /// Pause the recording session
    /// - Pauses frame processing without stopping sources
    /// - Can be resumed later
    pub async fn pause(&self) -> Result<(), FFIError> {
        let result = unsafe { recording_session_pause(self.as_ptr()) };

        match result {
            0 => {
                println!("✅ [RECORDING FFI] Session paused successfully");
                Ok(())
            }
            _ => {
                let error_msg = format!("Failed to pause session (code: {})", result);
                println!("❌ [RECORDING FFI] {}", error_msg);
                Err(FFIError::SwiftError(error_msg))
            }
        }
    }

    /// Resume a paused recording session
    /// - Resumes frame processing
    /// - Adjusts timestamps for pause duration
    pub async fn resume(&self) -> Result<(), FFIError> {
        let result = unsafe { recording_session_resume(self.as_ptr()) };

        match result {
            0 => {
                println!("✅ [RECORDING FFI] Session resumed successfully");
                Ok(())
            }
            _ => {
                let error_msg = format!("Failed to resume session (code: {})", result);
                println!("❌ [RECORDING FFI] {}", error_msg);
                Err(FFIError::SwiftError(error_msg))
            }
        }
    }

    /// Check if the recording session is currently paused
    pub fn is_paused(&self) -> bool {
        let result = unsafe { recording_session_is_paused(self.as_ptr()) };
        result == 1
    }

    /// Switch a recording source during active recording
    /// - Parameters:
    ///   - old_source_id: ID of source to replace
    ///   - source_type: Type of new source (Display, Window, or Webcam)
    ///   - new_source_id: ID of new source (display ID, window ID, or device ID)
    pub async fn switch_source(
        &self,
        old_source_id: &str,
        source_type: SourceType,
        new_source_id: &str,
    ) -> Result<(), FFIError> {
        let c_old_id = CString::new(old_source_id)
            .map_err(|e| FFIError::InvalidConfig(format!("Invalid old source ID: {}", e)))?;
        let c_new_id = CString::new(new_source_id)
            .map_err(|e| FFIError::InvalidConfig(format!("Invalid new source ID: {}", e)))?;

        let type_code = match source_type {
            SourceType::Display => 0,
            SourceType::Window => 1,
            SourceType::Webcam => 2,
        };

        let result = unsafe {
            recording_session_switch_source(
                self.as_ptr(),
                c_old_id.as_ptr(),
                type_code,
                c_new_id.as_ptr(),
            )
        };

        match result {
            0 => {
                println!("✅ [RECORDING FFI] Source switched successfully: {} → {:?} {}",
                         old_source_id, source_type, new_source_id);
                Ok(())
            }
            1 => {
                let error_msg = "Invalid parameters for source switch".to_string();
                println!("❌ [RECORDING FFI] {}", error_msg);
                Err(FFIError::InvalidConfig(error_msg))
            }
            2 => {
                let error_msg = format!("Source not found: {}", old_source_id);
                println!("❌ [RECORDING FFI] {}", error_msg);
                Err(FFIError::SwiftError(error_msg))
            }
            _ => {
                let error_msg = format!("Unknown error switching source (code: {})", result);
                println!("❌ [RECORDING FFI] {}", error_msg);
                Err(FFIError::SwiftError(error_msg))
            }
        }
    }

    /// Get the raw pointer for FFI calls (advanced usage)
    ///
    /// # Safety
    ///
    /// The returned pointer is only valid as long as this handle exists.
    /// Do not call `recording_session_destroy` on this pointer.
    pub fn as_ptr(&self) -> *mut c_void {
        self.0.as_ptr()
    }
}

// MARK: - Enumeration Functions (Phase 2)

/// Enumerate available displays for recording
pub async fn enumerate_displays() -> Result<Vec<crate::types::DisplayInfo>, FFIError> {
    use std::ffi::CStr;

    tokio::task::spawn_blocking(move || unsafe {
        // FFI is declared in video_recording.rs, we're calling it
        extern "C" {
            fn screen_recorder_enumerate_displays() -> *const std::os::raw::c_char;
        }

        let json_ptr = screen_recorder_enumerate_displays();
        if json_ptr.is_null() {
            return Err(FFIError::NullPointer);
        }

        let json_cstr = CStr::from_ptr(json_ptr);
        let json_str = json_cstr.to_str()
            .map_err(|e| FFIError::SwiftError(format!("Invalid UTF-8: {}", e)))?;

        serde_json::from_str(json_str)
            .map_err(|e| FFIError::SwiftError(format!("JSON parse error: {}", e)))
    })
    .await
    .map_err(|e| FFIError::SwiftError(format!("Task join error: {}", e)))?
}

/// Enumerate available windows for recording
pub async fn enumerate_windows() -> Result<Vec<crate::types::WindowInfo>, FFIError> {
    use std::ffi::CStr;

    tokio::task::spawn_blocking(move || unsafe {
        extern "C" {
            fn screen_recorder_enumerate_windows() -> *const std::os::raw::c_char;
        }

        let json_ptr = screen_recorder_enumerate_windows();
        if json_ptr.is_null() {
            return Err(FFIError::NullPointer);
        }

        let json_cstr = CStr::from_ptr(json_ptr);
        let json_str = json_cstr.to_str()
            .map_err(|e| FFIError::SwiftError(format!("Invalid UTF-8: {}", e)))?;

        serde_json::from_str(json_str)
            .map_err(|e| FFIError::SwiftError(format!("JSON parse error: {}", e)))
    })
    .await
    .map_err(|e| FFIError::SwiftError(format!("Task join error: {}", e)))?
}

/// Enumerate available webcams for recording
pub async fn enumerate_webcams() -> Result<Vec<crate::types::WebcamInfo>, FFIError> {
    use std::ffi::CStr;

    tokio::task::spawn_blocking(move || unsafe {
        extern "C" {
            fn screen_recorder_enumerate_webcams() -> *const std::os::raw::c_char;
        }

        let json_ptr = screen_recorder_enumerate_webcams();
        if json_ptr.is_null() {
            return Err(FFIError::NullPointer);
        }

        let json_cstr = CStr::from_ptr(json_ptr);
        let json_str = json_cstr.to_str()
            .map_err(|e| FFIError::SwiftError(format!("Invalid UTF-8: {}", e)))?;

        serde_json::from_str(json_str)
            .map_err(|e| FFIError::SwiftError(format!("JSON parse error: {}", e)))
    })
    .await
    .map_err(|e| FFIError::SwiftError(format!("Task join error: {}", e)))?
}

impl Drop for SwiftRecordingSession {
    /// Automatic cleanup when handle is dropped
    ///
    /// # Safety
    ///
    /// This is safe because:
    /// 1. NonNull guarantees the pointer is non-null
    /// 2. recording_session_destroy handles stopping if still recording
    /// 3. We only create handles from recording_session_create
    fn drop(&mut self) {
        // SAFETY: The pointer is guaranteed non-null by NonNull,
        // and we only create handles from recording_session_create.
        // recording_session_destroy is safe to call on any valid session pointer.
        unsafe {
            recording_session_destroy(self.as_ptr());
        }
    }
}

#[cfg(test)]
mod multi_source_tests {
    use super::*;

    // Note: These tests require the Swift runtime to be available.
    // They will be skipped in CI unless running on macOS with the app built.

    #[test]
    fn test_invalid_parameters() {
        // Invalid width
        let result = SwiftRecordingSession::new("/tmp/test.mp4", 0, 720, 30);
        assert!(result.is_err());

        // Invalid height
        let result = SwiftRecordingSession::new("/tmp/test.mp4", 1920, 0, 30);
        assert!(result.is_err());

        // Invalid FPS
        let result = SwiftRecordingSession::new("/tmp/test.mp4", 1920, 1080, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_null_byte_in_path() {
        let result = SwiftRecordingSession::new("/tmp/test\0.mp4", 1920, 1080, 30);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), FFIError::SwiftError(_)));
    }
}
