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

// External Swift FFI declarations
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

/// Safe handle for Swift ScreenRecorder with automatic cleanup
///
/// This wrapper provides RAII semantics for Swift recorder instances:
/// - Guaranteed cleanup via Drop
/// - Null pointer safety via NonNull
/// - No manual memory management required
pub struct SwiftRecorderHandle(NonNull<c_void>);

// SAFETY: The Swift ScreenRecorder uses actors for thread safety,
// making it safe to send across thread boundaries
unsafe impl Send for SwiftRecorderHandle {}
unsafe impl Sync for SwiftRecorderHandle {}

impl SwiftRecorderHandle {
    /// Create a safe handle from a raw pointer
    ///
    /// # Safety
    ///
    /// Caller must ensure:
    /// - The pointer was created by `screen_recorder_create`
    /// - The pointer has not been passed to `screen_recorder_destroy`
    /// - The pointer is not used after being passed to this function
    ///
    /// # Errors
    ///
    /// Returns `FFIError::NullPointer` if the pointer is null
    pub unsafe fn from_raw(ptr: *mut c_void) -> Result<Self, FFIError> {
        NonNull::new(ptr)
            .ok_or(FFIError::NullPointer)
            .map(SwiftRecorderHandle)
    }

    /// Get the raw pointer for FFI calls
    ///
    /// # Safety
    ///
    /// The returned pointer is only valid as long as this handle exists.
    /// Do not call `screen_recorder_destroy` on this pointer.
    pub fn as_ptr(&self) -> *mut c_void {
        self.0.as_ptr()
    }

    /// Create a new Swift recorder instance with timeout
    ///
    /// # Errors
    ///
    /// Returns:
    /// - `FFIError::Timeout` if creation takes longer than 5 seconds
    /// - `FFIError::NullPointer` if Swift returns null
    pub async fn create() -> Result<Self, FFIError> {
        Self::create_with_timeout(Duration::from_secs(5)).await
    }

    /// Create a new Swift recorder instance with custom timeout
    ///
    /// # Errors
    ///
    /// Returns:
    /// - `FFIError::Timeout` if creation takes longer than specified duration
    /// - `FFIError::NullPointer` if Swift returns null
    pub async fn create_with_timeout(duration: Duration) -> Result<Self, FFIError> {
        // Run FFI call in blocking thread pool
        // We use usize to make the pointer Send-safe across thread boundaries
        let result = timeout(
            duration,
            tokio::task::spawn_blocking(|| {
                // SAFETY: screen_recorder_create is a Swift function that returns
                // either a valid pointer or null. We check for null below.
                let ptr = unsafe { screen_recorder_create() };
                ptr as usize
            }),
        )
        .await;

        match result {
            Ok(Ok(ptr_addr)) => {
                let ptr = ptr_addr as *mut c_void;
                // SAFETY: We just received this pointer from Swift
                unsafe { Self::from_raw(ptr) }
            }
            Ok(Err(_)) => {
                // Task join error (very unlikely)
                Err(FFIError::SwiftError("Failed to join creation task".to_string()))
            }
            Err(_) => {
                // Timeout
                Err(FFIError::Timeout)
            }
        }
    }

    /// Start recording with timeout
    ///
    /// # Errors
    ///
    /// Returns:
    /// - `FFIError::Timeout` if start takes longer than 5 seconds
    /// - `FFIError::SwiftError` if Swift returns false
    pub async fn start(
        &self,
        path: &str,
        width: i32,
        height: i32,
        fps: i32,
    ) -> Result<(), FFIError> {
        self.start_with_timeout(path, width, height, fps, Duration::from_secs(5))
            .await
    }

    /// Start recording with custom timeout
    ///
    /// # Errors
    ///
    /// Returns:
    /// - `FFIError::Timeout` if start takes longer than specified duration
    /// - `FFIError::SwiftError` if Swift returns false
    pub async fn start_with_timeout(
        &self,
        path: &str,
        width: i32,
        height: i32,
        fps: i32,
        duration: Duration,
    ) -> Result<(), FFIError> {
        let c_path = CString::new(path).map_err(|_| {
            FFIError::SwiftError("Path contains null byte".to_string())
        })?;

        let ptr_addr = self.as_ptr() as usize;

        let result = timeout(
            duration,
            tokio::task::spawn_blocking(move || {
                let ptr = ptr_addr as *mut c_void;
                // SAFETY: We own the recorder pointer and c_path is valid
                unsafe { screen_recorder_start(ptr, c_path.as_ptr(), width, height, fps) }
            }),
        )
        .await;

        match result {
            Ok(Ok(true)) => Ok(()),
            Ok(Ok(false)) => {
                Err(FFIError::SwiftError("Swift start returned false".to_string()))
            }
            Ok(Err(_)) => {
                Err(FFIError::SwiftError("Failed to join start task".to_string()))
            }
            Err(_) => Err(FFIError::Timeout),
        }
    }

    /// Stop recording with timeout
    ///
    /// # Errors
    ///
    /// Returns:
    /// - `FFIError::Timeout` if stop takes longer than 10 seconds
    /// - `FFIError::SwiftError` if Swift returns false
    pub async fn stop(&self) -> Result<(), FFIError> {
        self.stop_with_timeout(Duration::from_secs(10)).await
    }

    /// Stop recording with custom timeout
    ///
    /// # Errors
    ///
    /// Returns:
    /// - `FFIError::Timeout` if stop takes longer than specified duration
    /// - `FFIError::SwiftError` if Swift returns false
    pub async fn stop_with_timeout(&self, duration: Duration) -> Result<(), FFIError> {
        let ptr_addr = self.as_ptr() as usize;

        let result = timeout(
            duration,
            tokio::task::spawn_blocking(move || {
                let ptr = ptr_addr as *mut c_void;
                // SAFETY: We own the recorder pointer
                unsafe { screen_recorder_stop(ptr) }
            }),
        )
        .await;

        match result {
            Ok(Ok(true)) => Ok(()),
            Ok(Ok(false)) => {
                Err(FFIError::SwiftError("Swift stop returned false".to_string()))
            }
            Ok(Err(_)) => {
                Err(FFIError::SwiftError("Failed to join stop task".to_string()))
            }
            Err(_) => Err(FFIError::Timeout),
        }
    }

    /// Check if currently recording
    ///
    /// This is a synchronous check that should be fast.
    pub fn is_recording(&self) -> bool {
        // SAFETY: We own the recorder pointer
        unsafe { screen_recorder_is_recording(self.as_ptr()) }
    }
}

impl Drop for SwiftRecorderHandle {
    /// Automatic cleanup when handle is dropped
    ///
    /// # Safety
    ///
    /// This is safe because:
    /// 1. NonNull guarantees the pointer is non-null
    /// 2. screen_recorder_destroy is idempotent (can be called multiple times)
    /// 3. We only create handles from screen_recorder_create
    fn drop(&mut self) {
        // SAFETY: The pointer is guaranteed non-null by NonNull,
        // and we only create handles from screen_recorder_create.
        // screen_recorder_destroy is safe to call on any valid recorder pointer.
        unsafe {
            screen_recorder_destroy(self.as_ptr());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_raw_null_pointer() {
        // SAFETY: Testing null pointer handling
        let result = unsafe { SwiftRecorderHandle::from_raw(std::ptr::null_mut()) };
        assert!(matches!(result, Err(FFIError::NullPointer)));
    }

    // Note: test_from_raw_valid_pointer is removed because it causes segfaults
    // when Drop calls screen_recorder_destroy on a fake pointer.
    // Proper tests with real Swift pointers should be in integration tests
    // with the Swift runtime available.

    // Note: More comprehensive tests that actually interact with Swift
    // should be in integration tests where we can set up the Swift runtime
}
