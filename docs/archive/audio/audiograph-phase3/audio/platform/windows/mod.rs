//! Windows audio backend (stub implementation)
//!
//! TODO: Implement using Windows Audio Session API (WASAPI)

use crate::audio::error::AudioError;
use crate::audio::traits::{AudioDevice, AudioDeviceInfo};
use crate::audio::PlatformCapabilities;

/// Get Windows platform capabilities
pub fn get_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        supports_microphone: false, // TODO: Implement
        supports_system_audio: false, // TODO: Implement with WASAPI
        supports_per_app_audio: false, // TODO: Implement with WASAPI
        supports_loopback: false,
    }
}

/// Enumerate available audio devices on Windows
pub fn enumerate_devices() -> Result<Vec<AudioDeviceInfo>, AudioError> {
    // TODO: Implement using Windows Core Audio APIs
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
