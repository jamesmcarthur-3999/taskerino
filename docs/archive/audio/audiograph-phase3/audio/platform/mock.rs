//! Mock audio device for testing

use crate::audio::error::AudioError;
use crate::audio::traits::{
    AudioConfig, AudioDevice, AudioDeviceInfo, AudioSamples, DeviceHealth, SampleFormat,
};
use std::time::Instant;

/// Mock audio device for testing
pub struct MockAudioDevice {
    info: AudioDeviceInfo,
    samples: Vec<f32>,
    sample_index: usize,
    is_active: bool,
    config: Option<AudioConfig>,
    dropped_frames: u64,
}

impl MockAudioDevice {
    /// Create a new mock device with predefined samples
    pub fn new_with_samples(samples: Vec<f32>) -> Self {
        Self {
            info: AudioDeviceInfo {
                id: "mock-device".to_string(),
                name: "Mock Audio Device".to_string(),
                is_default: true,
                supported_configs: vec![
                    AudioConfig {
                        sample_rate: 16000,
                        channels: 1,
                        sample_format: SampleFormat::F32,
                        buffer_size: 1024,
                    },
                    AudioConfig {
                        sample_rate: 48000,
                        channels: 2,
                        sample_format: SampleFormat::F32,
                        buffer_size: 1024,
                    },
                ],
            },
            samples,
            sample_index: 0,
            is_active: false,
            config: None,
            dropped_frames: 0,
        }
    }

    /// Create a mock device with silence
    pub fn new_silence(duration_secs: u64) -> Self {
        let samples = vec![0.0; (16000 * duration_secs) as usize];
        Self::new_with_samples(samples)
    }

    /// Create a mock device with a sine wave
    pub fn new_sine_wave(frequency: f32, duration_secs: u64) -> Self {
        let sample_rate = 16000;
        let num_samples = (sample_rate * duration_secs) as usize;
        let mut samples = Vec::with_capacity(num_samples);

        for i in 0..num_samples {
            let t = i as f32 / sample_rate as f32;
            let sample = (2.0 * std::f32::consts::PI * frequency * t).sin();
            samples.push(sample * 0.5); // Reduce amplitude
        }

        Self::new_with_samples(samples)
    }

    /// Reset the device to start from the beginning
    pub fn reset(&mut self) {
        self.sample_index = 0;
        self.is_active = false;
        self.dropped_frames = 0;
    }

    /// Set dropped frames for testing health metrics
    pub fn set_dropped_frames(&mut self, count: u64) {
        self.dropped_frames = count;
    }
}

impl AudioDevice for MockAudioDevice {
    fn info(&self) -> &AudioDeviceInfo {
        &self.info
    }

    fn start(&mut self, config: AudioConfig) -> Result<(), AudioError> {
        if self.is_active {
            return Err(AudioError::AlreadyActive);
        }

        self.config = Some(config);
        self.is_active = true;
        self.sample_index = 0;
        Ok(())
    }

    fn stop(&mut self) -> Result<(), AudioError> {
        if !self.is_active {
            return Err(AudioError::NotActive);
        }

        self.is_active = false;
        Ok(())
    }

    fn read_samples(&mut self) -> Result<Option<AudioSamples>, AudioError> {
        if !self.is_active {
            return Ok(None);
        }

        if self.sample_index >= self.samples.len() {
            return Ok(None);
        }

        let config = self.config.as_ref().unwrap();
        let chunk_size = config.buffer_size * config.channels as usize;
        let end = (self.sample_index + chunk_size).min(self.samples.len());

        if self.sample_index == end {
            return Ok(None);
        }

        let data = self.samples[self.sample_index..end].to_vec();
        self.sample_index = end;

        Ok(Some(AudioSamples::new(
            data,
            config.sample_rate,
            config.channels,
        )))
    }

    fn is_active(&self) -> bool {
        self.is_active
    }

    fn health(&self) -> DeviceHealth {
        let buffer_usage = if self.sample_index < self.samples.len() {
            ((self.sample_index * 100) / self.samples.len()).min(100) as u8
        } else {
            100
        };

        DeviceHealth {
            buffer_usage_percent: buffer_usage,
            dropped_frames: self.dropped_frames,
            last_error: None,
            last_activity: Instant::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_device_creation() {
        let samples = vec![0.5; 1000];
        let device = MockAudioDevice::new_with_samples(samples);

        assert_eq!(device.info().id, "mock-device");
        assert!(!device.is_active());
    }

    #[test]
    fn test_mock_device_silence() {
        let device = MockAudioDevice::new_silence(1);
        assert_eq!(device.samples.len(), 16000);
        assert_eq!(device.samples[0], 0.0);
    }

    #[test]
    fn test_mock_device_sine_wave() {
        let device = MockAudioDevice::new_sine_wave(440.0, 1);
        assert_eq!(device.samples.len(), 16000);

        // Check that we have a non-zero signal
        let has_signal = device.samples.iter().any(|&s| s != 0.0);
        assert!(has_signal);
    }

    #[test]
    fn test_mock_device_start_stop() {
        let mut device = MockAudioDevice::new_silence(1);

        // Start device
        let config = AudioConfig::default();
        assert!(device.start(config.clone()).is_ok());
        assert!(device.is_active());

        // Try to start again - should fail
        assert!(device.start(config).is_err());

        // Stop device
        assert!(device.stop().is_ok());
        assert!(!device.is_active());

        // Try to stop again - should fail
        assert!(device.stop().is_err());
    }

    #[test]
    fn test_mock_device_read_samples() {
        let mut device = MockAudioDevice::new_silence(1);

        // Can't read when not active
        assert!(device.read_samples().unwrap().is_none());

        // Start device
        device.start(AudioConfig::default()).unwrap();

        // Read samples
        let result = device.read_samples();
        assert!(result.is_ok());
        let samples = result.unwrap();
        assert!(samples.is_some());

        let audio_samples = samples.unwrap();
        assert_eq!(audio_samples.sample_rate, 16000);
        assert_eq!(audio_samples.channels, 1);
        assert!(!audio_samples.data.is_empty());
    }

    #[test]
    fn test_mock_device_health() {
        let mut device = MockAudioDevice::new_silence(1);
        device.set_dropped_frames(42);

        let health = device.health();
        assert_eq!(health.dropped_frames, 42);
        assert!(health.last_error.is_none());
    }

    #[test]
    fn test_mock_device_reset() {
        let mut device = MockAudioDevice::new_silence(1);

        device.start(AudioConfig::default()).unwrap();
        device.read_samples().unwrap();
        device.set_dropped_frames(10);

        assert!(device.sample_index > 0);
        assert!(device.is_active);
        assert_eq!(device.dropped_frames, 10);

        device.reset();

        assert_eq!(device.sample_index, 0);
        assert!(!device.is_active);
        assert_eq!(device.dropped_frames, 0);
    }
}
