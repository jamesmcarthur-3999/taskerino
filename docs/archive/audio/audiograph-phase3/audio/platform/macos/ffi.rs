//! Safe FFI wrappers for macOS system audio (ScreenCaptureKit)

use crate::audio::error::AudioError;
use std::ffi::c_void;
use std::ptr::NonNull;

// External C functions from Swift
extern "C" {
    fn system_audio_capture_create() -> *mut c_void;
    fn system_audio_capture_start(
        capture: *mut c_void,
        callback: extern "C" fn(*const f32, i32, u32, u16, *mut c_void),
        context: *mut c_void,
    ) -> bool;
    fn system_audio_capture_stop(capture: *mut c_void) -> bool;
    fn system_audio_capture_is_available() -> bool;
    fn system_audio_capture_destroy(capture: *mut c_void);
}

/// Safe handle to Swift system audio capture
/// Uses RAII pattern for automatic cleanup
#[derive(Debug)]
pub struct SystemAudioHandle(NonNull<c_void>);

unsafe impl Send for SystemAudioHandle {}
unsafe impl Sync for SystemAudioHandle {}

impl SystemAudioHandle {
    /// Create a new handle from a raw pointer
    ///
    /// # Safety
    ///
    /// The pointer must be a valid system audio capture handle from Swift,
    /// and must not be null.
    pub unsafe fn from_raw(ptr: *mut c_void) -> Result<Self, AudioError> {
        NonNull::new(ptr)
            .ok_or(AudioError::NullPointer)
            .map(SystemAudioHandle)
    }

    /// Get the raw pointer for FFI calls
    pub fn as_ptr(&self) -> *mut c_void {
        self.0.as_ptr()
    }

    /// Create a new system audio capture handle
    pub fn new() -> Result<Self, AudioError> {
        if !Self::is_available() {
            return Err(AudioError::PlatformUnsupported);
        }

        let ptr = unsafe { system_audio_capture_create() };
        unsafe { Self::from_raw(ptr) }
    }

    /// Check if system audio capture is available
    pub fn is_available() -> bool {
        unsafe { system_audio_capture_is_available() }
    }

    /// Start capturing audio
    pub fn start(
        &self,
        callback: extern "C" fn(*const f32, i32, u32, u16, *mut c_void),
        context: *mut c_void,
    ) -> Result<(), AudioError> {
        let success = unsafe { system_audio_capture_start(self.as_ptr(), callback, context) };

        if success {
            Ok(())
        } else {
            Err(AudioError::FFIError("Failed to start system audio capture".to_string()))
        }
    }

    /// Stop capturing audio
    pub fn stop(&self) -> Result<(), AudioError> {
        let success = unsafe { system_audio_capture_stop(self.as_ptr()) };

        if success {
            Ok(())
        } else {
            Err(AudioError::FFIError("Failed to stop system audio capture".to_string()))
        }
    }
}

impl Drop for SystemAudioHandle {
    fn drop(&mut self) {
        // SAFETY: self.0 is guaranteed to be valid by construction
        unsafe {
            system_audio_capture_destroy(self.as_ptr());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_null_pointer_rejected() {
        let result = unsafe { SystemAudioHandle::from_raw(std::ptr::null_mut()) };
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AudioError::NullPointer));
    }

    #[test]
    fn test_is_available() {
        // Just test that it doesn't crash
        let _ = SystemAudioHandle::is_available();
    }

    #[test]
    #[ignore] // Requires macOS 13.0+
    fn test_create_handle() {
        if !SystemAudioHandle::is_available() {
            println!("System audio not available, skipping test");
            return;
        }

        let handle = SystemAudioHandle::new();
        assert!(handle.is_ok());
    }
}
