//! macOS system audio capture using ScreenCaptureKit
//!
//! This module provides a Rust FFI bridge to Swift's ScreenCaptureKit framework
//! for capturing system audio (application sounds, music players, etc.).
//!
//! Requirements: macOS 13.0+ (audio capture APIs introduced in Ventura)

use std::ffi::c_void;
use std::sync::{Arc, Mutex};
use std::collections::VecDeque;

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
    pub fn new() -> Result<Self, String> {
        if !is_system_audio_available() {
            return Err("System audio capture requires macOS 13.0 or later (Ventura)".to_string());
        }

        let handle = unsafe { system_audio_capture_create() };
        if handle.is_null() {
            return Err("Failed to create system audio capture".to_string());
        }

        let buffer = Arc::new(Mutex::new(SystemAudioBuffer::new(120))); // 120 second buffer

        Ok(Self { handle, buffer })
    }

    /// Start capturing system audio
    pub fn start(&self) -> Result<(), String> {
        // Create raw pointer to buffer for callback context
        let buffer_ptr = &self.buffer as *const Arc<Mutex<SystemAudioBuffer>> as *mut c_void;

        let success = unsafe {
            system_audio_capture_start(self.handle, audio_sample_callback, buffer_ptr)
        };

        if success {
            println!("✅ [MACOS AUDIO] System audio capture started");
            Ok(())
        } else {
            Err("Failed to start system audio capture".to_string())
        }
    }

    /// Stop capturing system audio
    pub fn stop(&self) -> Result<(), String> {
        let success = unsafe { system_audio_capture_stop(self.handle) };

        if success {
            println!("✅ [MACOS AUDIO] System audio capture stopped");
            Ok(())
        } else {
            Err("Failed to stop system audio capture".to_string())
        }
    }

    /// Get captured samples and clear buffer
    pub fn take_samples(&self) -> Result<Vec<f32>, String> {
        let mut buffer = self
            .buffer
            .lock()
            .map_err(|e| format!("Failed to lock buffer: {}", e))?;

        let samples = buffer.take_samples();
        println!(
            "🎵 [MACOS AUDIO] Took {} samples from system audio buffer",
            samples.len()
        );
        Ok(samples)
    }

    /// Get current buffer length
    pub fn buffer_len(&self) -> usize {
        self.buffer.lock().map(|b| b.len()).unwrap_or(0)
    }

    /// Get sample rate
    pub fn sample_rate(&self) -> u32 {
        self.buffer.lock().map(|b| b.sample_rate).unwrap_or(16000)
    }

    /// Get number of channels
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
