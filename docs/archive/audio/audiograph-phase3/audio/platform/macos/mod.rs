//! macOS audio backend implementation

pub mod ffi;
pub mod microphone;
pub mod system_audio;

use crate::audio::error::AudioError;
use crate::audio::traits::{AudioDevice, AudioDeviceInfo};
use crate::audio::PlatformCapabilities;

pub use microphone::MacOSMicrophone;
pub use system_audio::MacOSSystemAudio;

/// Get macOS platform capabilities
pub fn get_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        supports_microphone: true,
        supports_system_audio: ffi::SystemAudioHandle::is_available(),
        supports_per_app_audio: false, // Future feature
        supports_loopback: false,      // Future feature
    }
}

/// Enumerate available audio devices on macOS
pub fn enumerate_devices() -> Result<Vec<AudioDeviceInfo>, AudioError> {
    let mut devices = Vec::new();

    // Try to add default microphone
    match MacOSMicrophone::new(None) {
        Ok(mic) => {
            devices.push(mic.info().clone());
        }
        Err(AudioError::NoDevice) => {
            // No microphone available, that's okay
        }
        Err(e) => {
            eprintln!("[AUDIO] Warning: Failed to enumerate microphone: {}", e);
        }
    }

    // Try to add system audio
    match MacOSSystemAudio::new() {
        Ok(sys_audio) => {
            devices.push(sys_audio.info().clone());
        }
        Err(AudioError::PlatformUnsupported) => {
            // macOS < 13.0, that's okay
        }
        Err(e) => {
            eprintln!("[AUDIO] Warning: Failed to enumerate system audio: {}", e);
        }
    }

    Ok(devices)
}

/// Create a microphone audio device
pub fn create_microphone(device_id: Option<String>) -> Result<Box<dyn AudioDevice>, AudioError> {
    let mic = MacOSMicrophone::new(device_id)?;
    Ok(Box::new(mic))
}

/// Create a system audio device
pub fn create_system_audio() -> Result<Box<dyn AudioDevice>, AudioError> {
    let sys_audio = MacOSSystemAudio::new()?;
    Ok(Box::new(sys_audio))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_capabilities() {
        let caps = get_capabilities();
        assert!(caps.supports_microphone);
        // System audio support depends on macOS version
    }

    #[test]
    fn test_enumerate_devices() {
        let result = enumerate_devices();
        assert!(result.is_ok());

        let devices = result.unwrap();
        // Should have at least some devices (may be 0 if no hardware)
        println!("Found {} audio devices", devices.len());
    }
}
