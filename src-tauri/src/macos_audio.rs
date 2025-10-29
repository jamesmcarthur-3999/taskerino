//! macOS system audio capture using ScreenCaptureKit
//!
//! This module provides a Rust FFI bridge to Swift's ScreenCaptureKit framework
//! for capturing system audio (application sounds, music players, etc.).
//!
//! Requirements: macOS 13.0+ (audio capture APIs introduced in Ventura)

use std::collections::VecDeque;
use std::ffi::c_void;
use std::sync::{Arc, Mutex};

// Import RecordingError from Phase 1
use crate::permissions::{RecordingError, PermissionType, ErrorSource, DeviceType};

/// System audio capture handle (opaque pointer to Swift object)
pub struct SystemAudioCapture {
    handle: *mut c_void,
    buffer: Arc<Mutex<SystemAudioBuffer>>,
}

/// Thread-safe buffer for system audio samples
struct SystemAudioBuffer {
    samples: VecDeque<f32>,
    sample_rate: u32,
    channels: u16,
    max_samples: usize,
}

impl SystemAudioBuffer {
    fn new(max_duration_secs: u64) -> Self {
        // Assume 16kHz mono (as configured in Swift)
        let max_samples = (16000 * max_duration_secs) as usize;
        Self {
            samples: VecDeque::with_capacity(max_samples),
            sample_rate: 16000,
            channels: 1,
            max_samples,
        }
    }

    fn push_samples(&mut self, new_samples: &[f32]) {
        for &sample in new_samples {
            if self.samples.len() >= self.max_samples {
                // Drop oldest sample if buffer full
                self.samples.pop_front();
            }
            self.samples.push_back(sample);
        }
    }

    fn take_samples(&mut self) -> Vec<f32> {
        let samples: Vec<f32> = self.samples.drain(..).collect();
        samples
    }

    fn len(&self) -> usize {
        self.samples.len()
    }
}

// External C functions from Swift (ScreenRecorder.swift)
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

    // Swift FFI error retrieval functions
    fn screen_recorder_get_last_error_code() -> i32;
    fn screen_recorder_get_last_error_message() -> *const std::os::raw::c_char;
    fn screen_recorder_get_last_error_can_retry() -> bool;
    fn screen_recorder_clear_last_error();
    fn screen_recorder_free_string(ptr: *mut std::os::raw::c_char);
}

/// Retrieve detailed error from Swift FFI
///
/// Call this after a Swift FFI function returns false to get the detailed error message.
/// Automatically clears the Swift error state after retrieval.
fn get_swift_error() -> RecordingError {
    use std::ffi::CStr;

    unsafe {
        let code = screen_recorder_get_last_error_code();
        let message_ptr = screen_recorder_get_last_error_message();
        let can_retry = screen_recorder_get_last_error_can_retry();

        // Extract message (or use default)
        let message = if !message_ptr.is_null() {
            let c_str = CStr::from_ptr(message_ptr);
            let message = c_str.to_string_lossy().to_string();
            // Free the Swift-allocated string
            screen_recorder_free_string(message_ptr as *mut std::os::raw::c_char);
            message
        } else {
            "Unknown system audio error".to_string()
        };

        // Clear Swift error state
        screen_recorder_clear_last_error();

        // Map Swift error code to RecordingError
        // Swift codes from RecordingError.swift:
        // permissionDenied = 1000
        // deviceNotFound = 1001
        // deviceInUse = 1002
        // configurationInvalid = 1003
        // alreadyStarted = 1004
        // notStarted = 1005
        // timeout = 1006
        // unknown = 9999
        match code {
            1000 => RecordingError::PermissionDenied {
                permission: PermissionType::SystemAudio,
                can_retry,
                system_message: Some(message),
            },
            1001 => RecordingError::DeviceNotFound {
                device_type: DeviceType::SystemAudio,
                device_id: None,
                details: Some(message),
            },
            1002 => RecordingError::DeviceInUse {
                device_type: DeviceType::SystemAudio,
                device_id: message.clone(),
            },
            1003 => RecordingError::SystemError {
                source: ErrorSource::ScreenCaptureKit,
                message: format!("Configuration invalid: {}", message),
                is_recoverable: can_retry,
            },
            1004 => RecordingError::SystemError {
                source: ErrorSource::ScreenCaptureKit,
                message: format!("Already started: {}", message),
                is_recoverable: false,
            },
            1005 => RecordingError::SystemError {
                source: ErrorSource::ScreenCaptureKit,
                message: format!("Not started: {}", message),
                is_recoverable: false,
            },
            1006 => RecordingError::SystemError {
                source: ErrorSource::ScreenCaptureKit,
                message: format!("Timeout: {}", message),
                is_recoverable: can_retry,
            },
            _ => RecordingError::SystemError {
                source: ErrorSource::ScreenCaptureKit,
                message,
                is_recoverable: can_retry,
            },
        }
    }
}

/// Audio sample callback from Swift
/// Called on background thread with audio samples
extern "C" fn audio_sample_callback(
    samples: *const f32,
    count: i32,
    sample_rate: u32,
    channels: u16,
    context: *mut c_void,
) {
    if samples.is_null() || context.is_null() || count <= 0 {
        return;
    }

    // Convert context back to buffer reference
    let buffer_ptr = context as *const Arc<Mutex<SystemAudioBuffer>>;
    let buffer = unsafe { &*buffer_ptr };

    // Convert samples to slice
    let sample_slice = unsafe { std::slice::from_raw_parts(samples, count as usize) };

    // Push to buffer
    if let Ok(mut buf) = buffer.lock() {
        buf.sample_rate = sample_rate;
        buf.channels = channels;
        buf.push_samples(sample_slice);
    }
}

impl SystemAudioCapture {
    /// Create a new system audio capture instance
    pub fn new() -> Result<Self, RecordingError> {
        if !is_system_audio_available() {
            return Err(RecordingError::PlatformUnsupported {
                feature: "System audio capture".to_string(),
                required_version: "macOS 13.0+ (Ventura)".to_string(),
            });
        }

        let handle = unsafe { system_audio_capture_create() };
        if handle.is_null() {
            return Err(RecordingError::DeviceNotFound {
                device_type: DeviceType::SystemAudio,
                device_id: None,
                details: None,  // No additional info available here
            });
        }

        let buffer = Arc::new(Mutex::new(SystemAudioBuffer::new(120))); // 120 second buffer

        Ok(Self { handle, buffer })
    }

    /// Start capturing system audio
    pub fn start(&self) -> Result<(), RecordingError> {
        // Create raw pointer to buffer for callback context
        let buffer_ptr = &self.buffer as *const Arc<Mutex<SystemAudioBuffer>> as *mut c_void;

        let success =
            unsafe { system_audio_capture_start(self.handle, audio_sample_callback, buffer_ptr) };

        if success {
            println!("✅ [MACOS AUDIO] System audio capture started");
            Ok(())
        } else {
            // Retrieve detailed error from Swift FFI
            let error = get_swift_error();
            println!("❌ [MACOS AUDIO] Failed to start system audio: {}", error);
            Err(error)
        }
    }

    /// Stop capturing system audio
    pub fn stop(&self) -> Result<(), RecordingError> {
        let success = unsafe { system_audio_capture_stop(self.handle) };

        if success {
            println!("✅ [MACOS AUDIO] System audio capture stopped");
            Ok(())
        } else {
            Err(RecordingError::SystemError {
                source: ErrorSource::CoreAudio,
                message: "Failed to stop system audio capture".to_string(),
                is_recoverable: false,
            })
        }
    }

    /// Get captured samples and clear buffer
    pub fn take_samples(&self) -> Result<Vec<f32>, RecordingError> {
        let mut buffer = self
            .buffer
            .lock()
            .map_err(|e| RecordingError::Internal {
                message: format!("Failed to lock buffer: {}", e),
            })?;

        let samples = buffer.take_samples();
        println!(
            "🎵 [MACOS AUDIO] Took {} samples from system audio buffer",
            samples.len()
        );
        Ok(samples)
    }

    /// Inspection method for buffer state - part of public API
    #[allow(dead_code)]
    pub fn len(&self) -> usize {
        self.buffer.lock().map(|b| b.len()).unwrap_or(0)
    }

    /// Inspection method for buffer state - part of public API
    #[allow(dead_code)]
    pub fn buffer_len(&self) -> usize {
        self.buffer.lock().map(|b| b.len()).unwrap_or(0)
    }

    /// Inspection method for buffer state - part of public API
    #[allow(dead_code)]
    pub fn sample_rate(&self) -> u32 {
        self.buffer.lock().map(|b| b.sample_rate).unwrap_or(16000)
    }

    /// Inspection method for buffer state - part of public API
    #[allow(dead_code)]
    pub fn channels(&self) -> u16 {
        self.buffer.lock().map(|b| b.channels).unwrap_or(1)
    }
}

impl Drop for SystemAudioCapture {
    fn drop(&mut self) {
        if !self.handle.is_null() {
            unsafe {
                system_audio_capture_destroy(self.handle);
            }
            self.handle = std::ptr::null_mut();
        }
    }
}

// SAFETY: SystemAudioCapture uses Arc<Mutex<>> for thread-safe buffer access
unsafe impl Send for SystemAudioCapture {}
unsafe impl Sync for SystemAudioCapture {}

/// Check if system audio capture is available on this macOS version
/// Returns true on macOS 13.0+ (Ventura and later)
pub fn is_system_audio_available() -> bool {
    #[cfg(target_os = "macos")]
    {
        unsafe { system_audio_capture_is_available() }
    }

    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "macos")]
    fn test_system_audio_availability() {
        // Should return true on macOS 13.0+ (Ventura)
        let available = is_system_audio_available();
        println!("System audio available: {}", available);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_create_system_audio_capture() {
        if !is_system_audio_available() {
            println!("Skipping test - system audio not available");
            return;
        }

        let capture = SystemAudioCapture::new();
        assert!(capture.is_ok(), "Failed to create system audio capture");
    }
}
