//! System audio device implementation using ScreenCaptureKit

use crate::audio::error::AudioError;
use crate::audio::platform::macos::ffi::SystemAudioHandle;
use crate::audio::traits::{
    AudioConfig, AudioDevice, AudioDeviceInfo, AudioSamples, DeviceHealth, SampleFormat,
};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// System audio device state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DeviceState {
    Idle,
    Active,
}

/// Internal buffer for system audio samples
struct SystemAudioBuffer {
    samples: VecDeque<f32>,
    max_capacity: usize,
    dropped_frames: u64,
    sample_rate: u32,
    channels: u16,
}

impl SystemAudioBuffer {
    fn new(buffer_size: usize, sample_rate: u32, channels: u16) -> Self {
        let max_capacity = buffer_size * 2;
        Self {
            samples: VecDeque::with_capacity(max_capacity),
            max_capacity,
            dropped_frames: 0,
            sample_rate,
            channels,
        }
    }

    fn push_samples(&mut self, new_samples: &[f32]) {
        for &sample in new_samples {
            if self.samples.len() >= self.max_capacity {
                self.samples.pop_front();
                self.dropped_frames += 1;
            }
            self.samples.push_back(sample);
        }
    }

    fn take_samples(&mut self) -> Vec<f32> {
        self.samples.drain(..).collect()
    }

    fn usage_percent(&self) -> u8 {
        if self.max_capacity == 0 {
            return 0;
        }
        ((self.samples.len() * 100) / self.max_capacity).min(100) as u8
    }

    fn clear(&mut self) {
        self.samples.clear();
        self.dropped_frames = 0;
    }
}

/// System audio device (ScreenCaptureKit wrapper)
pub struct MacOSSystemAudio {
    info: AudioDeviceInfo,
    handle: Option<SystemAudioHandle>,
    buffer: Arc<Mutex<SystemAudioBuffer>>,
    config: Option<AudioConfig>,
    state: DeviceState,
    last_activity: Arc<Mutex<Instant>>,
}

/// FFI callback for audio samples
extern "C" fn audio_sample_callback(
    samples: *const f32,
    count: i32,
    sample_rate: u32,
    channels: u16,
    context: *mut std::ffi::c_void,
) {
    if samples.is_null() || context.is_null() || count <= 0 {
        return;
    }

    // SAFETY: context is a pointer to Arc<Mutex<SystemAudioBuffer>>
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

impl MacOSSystemAudio {
    /// Create a new system audio device
    pub fn new() -> Result<Self, AudioError> {
        if !SystemAudioHandle::is_available() {
            return Err(AudioError::PlatformUnsupported);
        }

        let info = AudioDeviceInfo {
            id: "system-audio".to_string(),
            name: "System Audio".to_string(),
            is_default: true,
            supported_configs: vec![AudioConfig {
                sample_rate: 16000,
                channels: 1,
                sample_format: SampleFormat::F32,
                buffer_size: 1024,
            }],
        };

        Ok(Self {
            info,
            handle: None,
            buffer: Arc::new(Mutex::new(SystemAudioBuffer::new(4096, 16000, 1))),
            config: None,
            state: DeviceState::Idle,
            last_activity: Arc::new(Mutex::new(Instant::now())),
        })
    }
}

impl AudioDevice for MacOSSystemAudio {
    fn info(&self) -> &AudioDeviceInfo {
        &self.info
    }

    fn start(&mut self, config: AudioConfig) -> Result<(), AudioError> {
        if self.state == DeviceState::Active {
            return Err(AudioError::AlreadyActive);
        }

        // Create handle
        let handle = SystemAudioHandle::new()?;

        // Recreate buffer with appropriate size
        let buffer_capacity = config.buffer_size * config.channels as usize;
        self.buffer = Arc::new(Mutex::new(SystemAudioBuffer::new(
            buffer_capacity,
            config.sample_rate,
            config.channels,
        )));

        // Create raw pointer to buffer for callback context
        let buffer_ptr = &self.buffer as *const Arc<Mutex<SystemAudioBuffer>> as *mut std::ffi::c_void;

        // Start capture with callback
        handle.start(audio_sample_callback, buffer_ptr)?;

        self.handle = Some(handle);
        self.config = Some(config);
        self.state = DeviceState::Active;

        // Update activity
        if let Ok(mut activity) = self.last_activity.lock() {
            *activity = Instant::now();
        }

        Ok(())
    }

    fn stop(&mut self) -> Result<(), AudioError> {
        if self.state != DeviceState::Active {
            return Err(AudioError::NotActive);
        }

        if let Some(ref handle) = self.handle {
            handle.stop()?;
        }

        self.handle = None;
        self.state = DeviceState::Idle;

        if let Ok(mut buffer) = self.buffer.lock() {
            buffer.clear();
        }

        Ok(())
    }

    fn read_samples(&mut self) -> Result<Option<AudioSamples>, AudioError> {
        if self.state != DeviceState::Active {
            return Ok(None);
        }

        let mut buffer = self
            .buffer
            .lock()
            .map_err(|e| AudioError::Other(format!("Failed to lock buffer: {}", e)))?;

        if buffer.samples.is_empty() {
            return Ok(None);
        }

        let samples = buffer.take_samples();
        let sample_rate = buffer.sample_rate;
        let channels = buffer.channels;

        // Update activity
        if let Ok(mut activity) = self.last_activity.lock() {
            *activity = Instant::now();
        }

        Ok(Some(AudioSamples::new(samples, sample_rate, channels)))
    }

    fn is_active(&self) -> bool {
        self.state == DeviceState::Active
    }

    fn health(&self) -> DeviceHealth {
        let (buffer_usage, dropped_frames) = if let Ok(buffer) = self.buffer.lock() {
            (buffer.usage_percent(), buffer.dropped_frames)
        } else {
            (0, 0)
        };

        let last_activity = if let Ok(activity) = self.last_activity.lock() {
            *activity
        } else {
            Instant::now()
        };

        DeviceHealth {
            buffer_usage_percent: buffer_usage,
            dropped_frames,
            last_error: None,
            last_activity,
        }
    }
}

// SAFETY: SystemAudioBuffer is protected by Arc<Mutex<>>
unsafe impl Send for MacOSSystemAudio {}
unsafe impl Sync for MacOSSystemAudio {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_system_audio() {
        let result = MacOSSystemAudio::new();

        // May fail if not macOS 13.0+
        match result {
            Ok(device) => {
                assert_eq!(device.info().id, "system-audio");
                assert!(!device.is_active());
            }
            Err(AudioError::PlatformUnsupported) => {
                println!("System audio not supported, test skipped");
            }
            Err(e) => panic!("Unexpected error: {}", e),
        }
    }

    #[test]
    fn test_system_audio_info() {
        if let Ok(device) = MacOSSystemAudio::new() {
            let info = device.info();
            assert_eq!(info.name, "System Audio");
            assert!(info.is_default);
            assert!(!info.supported_configs.is_empty());
        }
    }

    #[test]
    fn test_stop_before_start() {
        if let Ok(mut device) = MacOSSystemAudio::new() {
            let result = device.stop();
            assert!(result.is_err());
            assert!(matches!(result.unwrap_err(), AudioError::NotActive));
        }
    }
}
