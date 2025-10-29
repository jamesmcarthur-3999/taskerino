//! System audio source using macOS ScreenCaptureKit
//!
//! Provides system audio capture on macOS 13.0+ via the ScreenCaptureKit framework.

use crate::audio::graph::traits::{
    AudioBuffer, AudioError, AudioFormat, AudioSource, SampleFormat, SourceStats,
};
use crate::macos_audio::SystemAudioCapture;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// System audio source (macOS only)
///
/// Captures system audio (application sounds, music players, etc.) on macOS
/// using the ScreenCaptureKit framework. Requires macOS 13.0 or later.
///
/// # Example
///
/// ```rust,no_run
/// use audio::sources::SystemAudioSource;
/// use audio::graph::traits::AudioSource;
///
/// let mut source = SystemAudioSource::new()?;
/// source.start()?;
///
/// while let Some(buffer) = source.read()? {
///     // Process audio buffer
/// }
///
/// source.stop()?;
/// # Ok::<(), audio::graph::traits::AudioError>(())
/// ```
pub struct SystemAudioSource {
    /// ScreenCaptureKit capture handle
    capture: Option<SystemAudioCapture>,
    /// Audio format (16kHz mono f32 from Swift)
    format: AudioFormat,
    /// Whether the source is currently active
    is_active: bool,
    /// Statistics
    stats: Arc<Mutex<SourceStats>>,
}

impl SystemAudioSource {
    /// Create a new system audio source
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - macOS version is older than 13.0 (Ventura)
    /// - Failed to initialize ScreenCaptureKit
    pub fn new() -> Result<Self, AudioError> {
        // Check if system audio is available
        if !crate::macos_audio::is_system_audio_available() {
            return Err(AudioError::DeviceError(
                "System audio capture requires macOS 13.0 or later (Ventura)".to_string(),
            ));
        }

        // Create capture (but don't start yet)
        let capture = SystemAudioCapture::new()
            .map_err(|e| AudioError::DeviceError(format!("Failed to create system audio capture: {}", e)))?;

        // Format is always 16kHz mono f32 (as configured in Swift)
        let format = AudioFormat::new(16000, 1, SampleFormat::F32);

        Ok(Self {
            capture: Some(capture),
            format,
            is_active: false,
            stats: Arc::new(Mutex::new(SourceStats::default())),
        })
    }
}

impl AudioSource for SystemAudioSource {
    fn format(&self) -> AudioFormat {
        self.format
    }

    fn start(&mut self) -> Result<(), AudioError> {
        if self.is_active {
            return Err(AudioError::InvalidState(
                "Source is already active".to_string(),
            ));
        }

        let capture = self.capture.as_ref().ok_or_else(|| {
            AudioError::InvalidState("Capture not initialized".to_string())
        })?;

        capture
            .start()
            .map_err(|e| AudioError::DeviceError(format!("Failed to start system audio: {}", e)))?;

        self.is_active = true;

        Ok(())
    }

    fn stop(&mut self) -> Result<(), AudioError> {
        if !self.is_active {
            return Ok(()); // Idempotent stop
        }

        if let Some(ref capture) = self.capture {
            capture
                .stop()
                .map_err(|e| AudioError::DeviceError(format!("Failed to stop system audio: {}", e)))?;
        }

        self.is_active = false;

        Ok(())
    }

    fn read(&mut self) -> Result<Option<AudioBuffer>, AudioError> {
        if !self.is_active {
            return Err(AudioError::InvalidState(
                "Source is not active".to_string(),
            ));
        }

        let capture = self.capture.as_ref().ok_or_else(|| {
            AudioError::InvalidState("Capture not initialized".to_string())
        })?;

        // Take samples from ScreenCaptureKit buffer
        let samples = capture
            .take_samples()
            .map_err(|e| AudioError::Other(format!("Failed to take samples: {}", e)))?;

        if samples.is_empty() {
            return Ok(None);
        }

        // Update stats
        if let Ok(mut stats) = self.stats.lock() {
            stats.buffers_produced += 1;
            stats.samples_produced += samples.len() as u64;
            stats.last_activity = Some(Instant::now());
        }

        // Create audio buffer
        let buffer = AudioBuffer::new(self.format, samples, Instant::now());

        Ok(Some(buffer))
    }

    fn is_active(&self) -> bool {
        self.is_active
    }

    fn name(&self) -> &str {
        "SystemAudioSource"
    }

    fn stats(&self) -> SourceStats {
        self.stats
            .lock()
            .map(|s| s.clone())
            .unwrap_or_default()
    }
}

impl Drop for SystemAudioSource {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

// SAFETY: SystemAudioSource wraps SystemAudioCapture which is Send + Sync
unsafe impl Send for SystemAudioSource {}
unsafe impl Sync for SystemAudioSource {}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn test_system_audio_creation() {
        // Test creating system audio source
        let result = SystemAudioSource::new();
        // May fail if macOS version is too old
        match result {
            Ok(_) => println!("Successfully created system audio source"),
            Err(e) => println!("Expected error (macOS < 13.0): {}", e),
        }
    }

    #[test]
    fn test_start_stop_lifecycle() {
        let mut source = match SystemAudioSource::new() {
            Ok(s) => s,
            Err(_) => return, // Skip if not available
        };

        assert!(!source.is_active());

        // Start
        if let Ok(()) = source.start() {
            assert!(source.is_active());

            // Stop
            assert!(source.stop().is_ok());
            assert!(!source.is_active());
        }
    }

    #[test]
    fn test_format_returns_correct() {
        let source = match SystemAudioSource::new() {
            Ok(s) => s,
            Err(_) => return,
        };

        let format = source.format();
        assert_eq!(format.sample_rate, 16000);
        assert_eq!(format.channels, 1);
        assert_eq!(format.sample_format, SampleFormat::F32);
    }

    #[test]
    fn test_double_start_prevention() {
        let mut source = match SystemAudioSource::new() {
            Ok(s) => s,
            Err(_) => return,
        };

        if source.start().is_ok() {
            // Second start should error
            let result = source.start();
            assert!(result.is_err());

            let _ = source.stop();
        }
    }

    #[test]
    fn test_read_when_not_started() {
        let mut source = match SystemAudioSource::new() {
            Ok(s) => s,
            Err(_) => return,
        };

        // Read should error if not started
        let result = source.read();
        assert!(result.is_err());
    }

    #[test]
    fn test_stats_tracking() {
        let source = match SystemAudioSource::new() {
            Ok(s) => s,
            Err(_) => return,
        };

        let stats = source.stats();
        // Initially zero
        assert_eq!(stats.buffers_produced, 0);
        assert_eq!(stats.samples_produced, 0);
    }

    #[test]
    fn test_graceful_cleanup() {
        // Test that Drop doesn't panic
        {
            let source = match SystemAudioSource::new() {
                Ok(s) => s,
                Err(_) => return,
            };
            // Drop happens here
        }
        // If we reach here, drop didn't panic
    }

    #[test]
    fn test_read_returns_none_when_no_data() {
        let mut source = match SystemAudioSource::new() {
            Ok(s) => s,
            Err(_) => return,
        };

        if source.start().is_ok() {
            // Immediately reading might return None if no audio captured yet
            match source.read() {
                Ok(None) | Ok(Some(_)) => {
                    // Both are valid outcomes
                }
                Err(e) => panic!("Unexpected error: {}", e),
            }

            let _ = source.stop();
        }
    }
}
