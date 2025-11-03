//! Linux audio backend (stub implementation)
//!
//! TODO: Implement using PulseAudio or PipeWire

use crate::audio::error::AudioError;
use crate::audio::traits::{AudioDevice, AudioDeviceInfo};
use crate::audio::PlatformCapabilities;

/// Get Linux platform capabilities
pub fn get_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        supports_microphone: false, // TODO: Implement with cpal (already available)
        supports_system_audio: false, // TODO: Implement with PulseAudio/PipeWire
        supports_per_app_audio: false, // TODO: Implement with PulseAudio
        supports_loopback: false,
    }
}

/// Enumerate available audio devices on Linux
pub fn enumerate_devices() -> Result<Vec<AudioDeviceInfo>, AudioError> {
    // TODO: Implement using PulseAudio/PipeWire
    Ok(Vec::new())
}

/// Create a microphone audio device
pub fn create_microphone(_device_id: Option<String>) -> Result<Box<dyn AudioDevice>, AudioError> {
    Err(AudioError::PlatformUnsupported)
}

/// Create a system audio device
pub fn create_system_audio() -> Result<Box<dyn AudioDevice>, AudioError> {
    Err(AudioError::PlatformUnsupported)
}
