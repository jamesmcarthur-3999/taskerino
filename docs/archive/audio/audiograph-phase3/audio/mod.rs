//! Cross-platform audio abstraction layer
//!
//! This module provides a platform-agnostic interface for audio capture,
//! supporting both microphone and system audio on supported platforms.
//!
//! # Platform Support
//!
//! - **macOS**: Full support for microphone (cpal) and system audio (ScreenCaptureKit)
//! - **Windows**: Stub implementation (TODO: WASAPI)
//! - **Linux**: Stub implementation (TODO: PulseAudio/PipeWire)
//!
//! # Example
//!
//! ```no_run
//! use audio::{create_microphone, AudioConfig};
//!
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! // Create a microphone device
//! let mut mic = create_microphone(None)?;
//!
//! // Start capturing
//! let config = AudioConfig::default();
//! mic.start(config)?;
//!
//! // Read samples
//! if let Some(samples) = mic.read_samples()? {
//!     println!("Captured {} samples", samples.data.len());
//! }
//!
//! // Stop capturing
//! mic.stop()?;
//! # Ok(())
//! # }
//! ```

// Allow dead code for now - this module is not yet integrated with the main application
#![allow(dead_code)]

pub mod buffer;
pub mod error;
pub mod graph;  // Audio graph architecture
pub mod sources;  // Audio source implementations
pub mod sinks;  // Audio sink implementations
pub mod processors;  // Audio processor implementations
pub mod platform;
pub mod traits;

pub use error::AudioError;
pub use traits::{AudioDevice, AudioDeviceInfo};

// Re-export buffer management types
pub use buffer::{
    AudioChunk, AudioRingBuffer, BackpressureDetector, BackpressureEvent, BufferHealthMonitor,
    BufferPool, BufferStats,
};

// Re-export graph architecture types
pub use graph::traits::{AudioSource as AudioSourceTrait, AudioProcessor, AudioSink, AudioBuffer, AudioFormat};

// Re-export audio source implementations
pub use sources::{MicrophoneSource, SilenceSource};

#[cfg(target_os = "macos")]
pub use sources::SystemAudioSource;

// Re-export audio sink implementations
pub use sinks::{BufferSink, NullSink, WavEncoderSink};

// Re-export audio processor implementations
pub use processors::{Mixer, MixMode, Resampler};

/// Platform capabilities
#[derive(Debug, Clone)]
pub struct PlatformCapabilities {
    /// Microphone input supported
    pub supports_microphone: bool,
    /// System-wide audio capture supported
    pub supports_system_audio: bool,
    /// Per-application audio capture supported
    pub supports_per_app_audio: bool,
    /// Audio loopback supported
    pub supports_loopback: bool,
}

/// Get current platform capabilities
pub fn get_capabilities() -> PlatformCapabilities {
    platform::platform::get_capabilities()
}

/// Enumerate available audio devices
pub fn enumerate_devices() -> Result<Vec<AudioDeviceInfo>, AudioError> {
    platform::platform::enumerate_devices()
}

/// Create a microphone audio device
///
/// # Arguments
///
/// * `device_id` - Optional device ID. If None, uses the default device.
///
/// # Examples
///
/// ```no_run
/// use audio::create_microphone;
///
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// // Use default microphone
/// let mic = create_microphone(None)?;
///
/// // Use specific device
/// let mic = create_microphone(Some("Built-in Microphone".to_string()))?;
/// # Ok(())
/// # }
/// ```
pub fn create_microphone(device_id: Option<String>) -> Result<Box<dyn AudioDevice>, AudioError> {
    platform::platform::create_microphone(device_id)
}

/// Create a system audio device
///
/// System audio capture allows recording of all system sounds,
/// including application audio, music, etc.
///
/// # Platform Notes
///
/// - **macOS**: Requires macOS 13.0+ (Ventura). Uses ScreenCaptureKit.
/// - **Windows**: Not yet implemented (TODO: WASAPI loopback)
/// - **Linux**: Not yet implemented (TODO: PulseAudio monitor)
///
/// # Examples
///
/// ```no_run
/// use audio::create_system_audio;
///
/// # fn main() -> Result<(), Box<dyn std::error::Error>> {
/// let sys_audio = create_system_audio()?;
/// # Ok(())
/// # }
/// ```
pub fn create_system_audio() -> Result<Box<dyn AudioDevice>, AudioError> {
    platform::platform::create_system_audio()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_capabilities() {
        let caps = get_capabilities();

        #[cfg(target_os = "macos")]
        {
            assert!(caps.supports_microphone);
        }

        #[cfg(not(target_os = "macos"))]
        {
            // Stubs should return false
            assert!(!caps.supports_microphone);
        }
    }

    #[test]
    fn test_enumerate_devices() {
        let result = enumerate_devices();
        assert!(result.is_ok());
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_create_microphone_macos() {
        // May fail if no hardware available, but shouldn't crash
        let _ = create_microphone(None);
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn test_create_microphone_stub() {
        let result = create_microphone(None);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AudioError::PlatformUnsupported));
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn test_create_system_audio_stub() {
        let result = create_system_audio();
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AudioError::PlatformUnsupported));
    }
}
