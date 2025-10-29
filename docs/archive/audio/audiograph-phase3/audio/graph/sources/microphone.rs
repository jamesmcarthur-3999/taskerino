//! MicrophoneSource - AudioSource implementation that wraps an AudioDevice

use crate::audio::graph::traits::{AudioBuffer, AudioError, AudioFormat, AudioSource, SampleFormat, SourceStats};
use crate::audio::traits::{AudioConfig, AudioDevice};
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// AudioSource that wraps a microphone AudioDevice
pub struct MicrophoneSource {
    device: Arc<Mutex<Box<dyn AudioDevice>>>,
    format: AudioFormat,
    is_active: bool,
    buffers_produced: u64,
    samples_produced: u64,
    last_activity: Option<Instant>,
}

impl MicrophoneSource {
    /// Create from an existing AudioDevice
    pub fn new(device: Box<dyn AudioDevice>) -> Result<Self, AudioError> {
        // Extract format from device info
        let info = device.info();

        // Validate device has at least one supported configuration
        let config = info.supported_configs.first()
            .ok_or_else(|| AudioError::ConfigurationError(
                "Device has no supported configurations".to_string()
            ))?;

        // Convert AudioConfig to AudioFormat
        let format = AudioFormat::new(
            config.sample_rate,
            config.channels,
            match config.sample_format {
                crate::audio::traits::SampleFormat::F32 => SampleFormat::F32,
                crate::audio::traits::SampleFormat::I16 => SampleFormat::I16,
            }
        );

        Ok(Self {
            device: Arc::new(Mutex::new(device)),
            format,
            is_active: false,
            buffers_produced: 0,
            samples_produced: 0,
            last_activity: None,
        })
    }

    /// Create default microphone
    pub fn default() -> Result<Self, AudioError> {
        // Use crate::audio::create_microphone(None)
        let device = crate::audio::create_microphone(None)
            .map_err(|e| AudioError::DeviceError(e.to_string()))?;
        Self::new(device)
    }
}

impl AudioSource for MicrophoneSource {
    fn format(&self) -> AudioFormat {
        self.format
    }

    fn start(&mut self) -> Result<(), AudioError> {
        // Check if already active
        if self.is_active {
            return Err(AudioError::InvalidState(
                "MicrophoneSource is already active".to_string()
            ));
        }

        // Get device and start it
        let mut device = self.device.lock()
            .map_err(|e| AudioError::Other(format!("Failed to lock device: {}", e)))?;

        // Create AudioConfig from our format
        let config = AudioConfig {
            sample_rate: self.format.sample_rate,
            channels: self.format.channels,
            sample_format: match self.format.sample_format {
                SampleFormat::F32 => crate::audio::traits::SampleFormat::F32,
                SampleFormat::I16 => crate::audio::traits::SampleFormat::I16,
                _ => crate::audio::traits::SampleFormat::F32, // Default to F32 for other formats
            },
            buffer_size: 1024,
        };

        device.start(config)
            .map_err(|e| AudioError::DeviceError(e.to_string()))?;

        self.is_active = true;
        self.last_activity = Some(Instant::now());

        Ok(())
    }

    fn stop(&mut self) -> Result<(), AudioError> {
        // Check if not active (return Ok if already stopped)
        if !self.is_active {
            return Ok(());
        }

        // Get device and stop it
        let mut device = self.device.lock()
            .map_err(|e| AudioError::Other(format!("Failed to lock device: {}", e)))?;

        device.stop()
            .map_err(|e| AudioError::DeviceError(e.to_string()))?;

        self.is_active = false;

        Ok(())
    }

    fn read(&mut self) -> Result<Option<AudioBuffer>, AudioError> {
        // Check if active
        if !self.is_active {
            return Err(AudioError::InvalidState(
                "MicrophoneSource is not active".to_string()
            ));
        }

        // Get device and read samples
        let mut device = self.device.lock()
            .map_err(|e| AudioError::Other(format!("Failed to lock device: {}", e)))?;

        let samples_opt = device.read_samples()
            .map_err(|e| AudioError::DeviceError(e.to_string()))?;

        // Convert Option<AudioSamples> to Option<AudioBuffer>
        match samples_opt {
            Some(audio_samples) => {
                // Update statistics
                self.buffers_produced += 1;
                self.samples_produced += audio_samples.data.len() as u64;
                self.last_activity = Some(Instant::now());

                // Create AudioBuffer from AudioSamples
                let buffer = AudioBuffer::new(
                    self.format,
                    audio_samples.data,
                    audio_samples.timestamp,
                );

                Ok(Some(buffer))
            }
            None => Ok(None),
        }
    }

    fn is_active(&self) -> bool {
        self.is_active
    }

    fn name(&self) -> &str {
        "MicrophoneSource"
    }

    fn stats(&self) -> SourceStats {
        SourceStats {
            buffers_produced: self.buffers_produced,
            samples_produced: self.samples_produced,
            overruns: 0, // Device tracks this, we don't have access here
            avg_buffer_fullness: 0.0, // Would need device health info
            last_activity: self.last_activity,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::platform::mock::MockAudioDevice;

    #[test]
    fn test_microphone_source_creation() {
        // Create MicrophoneSource from MockAudioDevice
        let mock_device = MockAudioDevice::new_silence(1);
        let source = MicrophoneSource::new(Box::new(mock_device)).unwrap();

        // Verify format is correct (from default config)
        let format = source.format();
        assert_eq!(format.sample_rate, 16000);
        assert_eq!(format.channels, 1);
        assert_eq!(format.sample_format, SampleFormat::F32);
        assert!(!source.is_active());
    }

    #[test]
    fn test_microphone_source_start_stop() {
        let mock_device = MockAudioDevice::new_silence(1);
        let mut source = MicrophoneSource::new(Box::new(mock_device)).unwrap();

        // Initially not active
        assert!(!source.is_active());

        // Start device
        assert!(source.start().is_ok());
        assert!(source.is_active());

        // Stop device
        assert!(source.stop().is_ok());
        assert!(!source.is_active());

        // Stopping again should be Ok (idempotent)
        assert!(source.stop().is_ok());
    }

    #[test]
    fn test_microphone_source_read_samples() {
        let mock_device = MockAudioDevice::new_sine_wave(440.0, 1);
        let mut source = MicrophoneSource::new(Box::new(mock_device)).unwrap();

        // Start device
        source.start().unwrap();

        // Read samples
        let result = source.read();
        assert!(result.is_ok());

        let buffer_opt = result.unwrap();
        assert!(buffer_opt.is_some());

        let buffer = buffer_opt.unwrap();
        assert_eq!(buffer.format.sample_rate, 16000);
        assert_eq!(buffer.format.channels, 1);
        assert!(!buffer.samples.is_empty());

        // Verify statistics were updated
        let stats = source.stats();
        assert_eq!(stats.buffers_produced, 1);
        assert!(stats.samples_produced > 0);
        assert!(stats.last_activity.is_some());
    }

    #[test]
    fn test_microphone_source_read_when_inactive() {
        let mock_device = MockAudioDevice::new_silence(1);
        let mut source = MicrophoneSource::new(Box::new(mock_device)).unwrap();

        // Reading without start should error
        let result = source.read();
        assert!(result.is_err());

        match result.unwrap_err() {
            AudioError::InvalidState(msg) => {
                assert!(msg.contains("not active"));
            }
            _ => panic!("Expected InvalidState error"),
        }
    }

    #[test]
    fn test_microphone_source_double_start() {
        let mock_device = MockAudioDevice::new_silence(1);
        let mut source = MicrophoneSource::new(Box::new(mock_device)).unwrap();

        // First start should succeed
        assert!(source.start().is_ok());

        // Second start should error
        let result = source.start();
        assert!(result.is_err());

        match result.unwrap_err() {
            AudioError::InvalidState(msg) => {
                assert!(msg.contains("already active"));
            }
            _ => panic!("Expected InvalidState error"),
        }
    }

    #[test]
    fn test_microphone_source_name() {
        let mock_device = MockAudioDevice::new_silence(1);
        let source = MicrophoneSource::new(Box::new(mock_device)).unwrap();

        assert_eq!(source.name(), "MicrophoneSource");
    }
}
