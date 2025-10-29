//! Microphone audio device implementation using cpal

use crate::audio::error::AudioError;
use crate::audio::traits::{
    AudioConfig, AudioDevice, AudioDeviceInfo, AudioSamples, DeviceHealth, SampleFormat,
};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Stream, StreamConfig};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// Microphone device state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DeviceState {
    Idle,
    Active,
}

/// Internal buffer for audio samples
struct AudioBuffer {
    samples: VecDeque<f32>,
    max_capacity: usize,
    dropped_frames: u64,
}

impl AudioBuffer {
    fn new(buffer_size: usize) -> Self {
        // Double the requested size for safety margin
        let max_capacity = buffer_size * 2;
        Self {
            samples: VecDeque::with_capacity(max_capacity),
            max_capacity,
            dropped_frames: 0,
        }
    }

    fn push_sample(&mut self, sample: f32) {
        if self.samples.len() >= self.max_capacity {
            // Drop oldest sample (ring buffer behavior)
            self.samples.pop_front();
            self.dropped_frames += 1;
        }
        self.samples.push_back(sample);
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

/// Microphone audio device (cpal wrapper)
pub struct MacOSMicrophone {
    info: AudioDeviceInfo,
    stream: Option<Stream>,
    buffer: Arc<Mutex<AudioBuffer>>,
    config: Option<AudioConfig>,
    state: DeviceState,
    last_activity: Arc<Mutex<Instant>>,
}

// SAFETY: cpal::Stream is not Send/Sync on all platforms, but macOS Core Audio
// is thread-safe and we protect all access with Arc<Mutex<>>
unsafe impl Send for MacOSMicrophone {}
unsafe impl Sync for MacOSMicrophone {}

impl MacOSMicrophone {
    /// Create a new microphone device
    pub fn new(device_id: Option<String>) -> Result<Self, AudioError> {
        let host = cpal::default_host();

        // Find the device
        let device = if let Some(ref id) = device_id {
            host.input_devices()
                .map_err(|e| AudioError::Other(format!("Failed to enumerate devices: {}", e)))?
                .find(|d| d.name().map(|n| n == *id).unwrap_or(false))
                .ok_or_else(|| AudioError::DeviceNotFound(id.clone()))?
        } else {
            host.default_input_device()
                .ok_or(AudioError::NoDevice)?
        };

        let name = device
            .name()
            .unwrap_or_else(|_| "Unknown Microphone".to_string());

        // Get supported configurations
        let supported_configs = Self::get_supported_configs(&device)?;

        let info = AudioDeviceInfo {
            id: name.clone(),
            name,
            is_default: device_id.is_none(),
            supported_configs,
        };

        Ok(Self {
            info,
            stream: None,
            buffer: Arc::new(Mutex::new(AudioBuffer::new(4096))),
            config: None,
            state: DeviceState::Idle,
            last_activity: Arc::new(Mutex::new(Instant::now())),
        })
    }

    /// Get supported configurations for a device
    fn get_supported_configs(device: &Device) -> Result<Vec<AudioConfig>, AudioError> {
        let default_config = device
            .default_input_config()
            .map_err(|e| AudioError::Other(format!("Failed to get device config: {}", e)))?;

        // For now, just return the default config
        // In the future, we could enumerate all supported configs
        Ok(vec![AudioConfig {
            sample_rate: default_config.sample_rate().0,
            channels: default_config.channels(),
            sample_format: match default_config.sample_format() {
                cpal::SampleFormat::F32 => SampleFormat::F32,
                cpal::SampleFormat::I16 => SampleFormat::I16,
                _ => SampleFormat::F32,
            },
            buffer_size: 1024,
        }])
    }

    /// Build audio stream for f32 samples
    fn build_stream_f32(
        device: &Device,
        config: StreamConfig,
        buffer: Arc<Mutex<AudioBuffer>>,
        last_activity: Arc<Mutex<Instant>>,
    ) -> Result<Stream, AudioError> {
        let stream = device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut buf) = buffer.lock() {
                        for &sample in data {
                            buf.push_sample(sample);
                        }
                    }
                    if let Ok(mut activity) = last_activity.lock() {
                        *activity = Instant::now();
                    }
                },
                |err| eprintln!("[AUDIO] Microphone stream error: {}", err),
                None,
            )
            .map_err(|e| AudioError::Other(format!("Failed to build stream: {}", e)))?;

        Ok(stream)
    }

    /// Build audio stream for i16 samples (convert to f32)
    fn build_stream_i16(
        device: &Device,
        config: StreamConfig,
        buffer: Arc<Mutex<AudioBuffer>>,
        last_activity: Arc<Mutex<Instant>>,
    ) -> Result<Stream, AudioError> {
        let stream = device
            .build_input_stream(
                &config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut buf) = buffer.lock() {
                        for &sample in data {
                            let normalized = sample as f32 / i16::MAX as f32;
                            buf.push_sample(normalized);
                        }
                    }
                    if let Ok(mut activity) = last_activity.lock() {
                        *activity = Instant::now();
                    }
                },
                |err| eprintln!("[AUDIO] Microphone stream error: {}", err),
                None,
            )
            .map_err(|e| AudioError::Other(format!("Failed to build stream: {}", e)))?;

        Ok(stream)
    }
}

impl AudioDevice for MacOSMicrophone {
    fn info(&self) -> &AudioDeviceInfo {
        &self.info
    }

    fn start(&mut self, config: AudioConfig) -> Result<(), AudioError> {
        if self.state == DeviceState::Active {
            return Err(AudioError::AlreadyActive);
        }

        let host = cpal::default_host();
        let device = host
            .input_devices()
            .map_err(|e| AudioError::Other(format!("Failed to enumerate devices: {}", e)))?
            .find(|d| d.name().map(|n| n == self.info.id).unwrap_or(false))
            .ok_or_else(|| AudioError::DeviceNotFound(self.info.id.clone()))?;

        let stream_config = StreamConfig {
            channels: config.channels,
            sample_rate: cpal::SampleRate(config.sample_rate),
            buffer_size: cpal::BufferSize::Fixed(config.buffer_size as u32),
        };

        // Recreate buffer with appropriate size
        let buffer_capacity = config.buffer_size * config.channels as usize;
        self.buffer = Arc::new(Mutex::new(AudioBuffer::new(buffer_capacity)));

        let stream = match config.sample_format {
            SampleFormat::F32 => Self::build_stream_f32(
                &device,
                stream_config,
                Arc::clone(&self.buffer),
                Arc::clone(&self.last_activity),
            )?,
            SampleFormat::I16 => Self::build_stream_i16(
                &device,
                stream_config,
                Arc::clone(&self.buffer),
                Arc::clone(&self.last_activity),
            )?,
        };

        stream
            .play()
            .map_err(|e| AudioError::Other(format!("Failed to start stream: {}", e)))?;

        self.stream = Some(stream);
        self.config = Some(config);
        self.state = DeviceState::Active;

        Ok(())
    }

    fn stop(&mut self) -> Result<(), AudioError> {
        if self.state != DeviceState::Active {
            return Err(AudioError::NotActive);
        }

        self.stream = None;
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
        let config = self.config.as_ref().unwrap();

        Ok(Some(AudioSamples::new(
            samples,
            config.sample_rate,
            config.channels,
        )))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_default_microphone() {
        // Try to create default microphone device
        let result = MacOSMicrophone::new(None);

        // May fail if no microphone available, but shouldn't crash
        match result {
            Ok(mic) => {
                assert!(mic.info().is_default);
                assert!(!mic.is_active());
            }
            Err(AudioError::NoDevice) => {
                println!("No microphone available, test skipped");
            }
            Err(e) => panic!("Unexpected error: {}", e),
        }
    }

    #[test]
    fn test_microphone_info() {
        if let Ok(mic) = MacOSMicrophone::new(None) {
            let info = mic.info();
            assert!(!info.name.is_empty());
            assert!(!info.supported_configs.is_empty());
        }
    }

    #[test]
    fn test_stop_before_start() {
        if let Ok(mut mic) = MacOSMicrophone::new(None) {
            let result = mic.stop();
            assert!(result.is_err());
            assert!(matches!(result.unwrap_err(), AudioError::NotActive));
        }
    }

    #[test]
    fn test_read_samples_when_inactive() {
        if let Ok(mut mic) = MacOSMicrophone::new(None) {
            let result = mic.read_samples();
            assert!(result.is_ok());
            assert!(result.unwrap().is_none());
        }
    }
}
