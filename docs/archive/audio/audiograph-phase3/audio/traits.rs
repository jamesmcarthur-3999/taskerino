//! Platform-agnostic audio traits and types

use super::error::AudioError;
use std::time::Instant;

/// Audio sample format
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SampleFormat {
    /// 32-bit float (-1.0 to 1.0)
    F32,
    /// 16-bit signed integer
    I16,
}

impl Default for SampleFormat {
    fn default() -> Self {
        SampleFormat::F32
    }
}

/// Audio configuration
#[derive(Debug, Clone)]
pub struct AudioConfig {
    /// Sample rate in Hz
    pub sample_rate: u32,
    /// Number of channels
    pub channels: u16,
    /// Sample format
    pub sample_format: SampleFormat,
    /// Buffer size in frames
    pub buffer_size: usize,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000,  // 16kHz for speech
            channels: 1,         // Mono
            sample_format: SampleFormat::F32,
            buffer_size: 1024,
        }
    }
}

/// Audio device information
#[derive(Debug, Clone)]
pub struct AudioDeviceInfo {
    /// Unique device identifier
    pub id: String,
    /// Human-readable device name
    pub name: String,
    /// Whether this is the default device
    pub is_default: bool,
    /// Supported configurations
    pub supported_configs: Vec<AudioConfig>,
}

/// Audio samples container
pub struct AudioSamples {
    /// Sample data (always f32 internally for consistency)
    pub data: Vec<f32>,
    /// Sample rate in Hz
    pub sample_rate: u32,
    /// Number of channels
    pub channels: u16,
    /// Timestamp when samples were captured
    pub timestamp: Instant,
}

impl AudioSamples {
    /// Create new audio samples
    pub fn new(data: Vec<f32>, sample_rate: u32, channels: u16) -> Self {
        Self {
            data,
            sample_rate,
            channels,
            timestamp: Instant::now(),
        }
    }

    /// Get duration in seconds
    pub fn duration(&self) -> f64 {
        self.data.len() as f64 / (self.sample_rate as f64 * self.channels as f64)
    }

    /// Get number of frames (samples / channels)
    pub fn frame_count(&self) -> usize {
        self.data.len() / self.channels as usize
    }
}

/// Device health metrics
#[derive(Debug, Clone)]
pub struct DeviceHealth {
    /// Buffer usage percentage (0-100)
    pub buffer_usage_percent: u8,
    /// Number of dropped frames
    pub dropped_frames: u64,
    /// Last error message (if any)
    pub last_error: Option<String>,
    /// Last activity timestamp
    pub last_activity: Instant,
}

impl Default for DeviceHealth {
    fn default() -> Self {
        Self {
            buffer_usage_percent: 0,
            dropped_frames: 0,
            last_error: None,
            last_activity: Instant::now(),
        }
    }
}

/// Audio device trait (microphone or system audio)
pub trait AudioDevice: Send + Sync {
    /// Get device information
    fn info(&self) -> &AudioDeviceInfo;

    /// Start capturing audio with specified configuration
    fn start(&mut self, config: AudioConfig) -> Result<(), AudioError>;

    /// Stop capturing audio
    fn stop(&mut self) -> Result<(), AudioError>;

    /// Read audio samples (non-blocking)
    /// Returns None if no data available
    fn read_samples(&mut self) -> Result<Option<AudioSamples>, AudioError>;

    /// Check if device is currently active
    fn is_active(&self) -> bool;

    /// Get current buffer health metrics
    fn health(&self) -> DeviceHealth;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sample_format_default() {
        assert_eq!(SampleFormat::default(), SampleFormat::F32);
    }

    #[test]
    fn test_audio_config_default() {
        let config = AudioConfig::default();
        assert_eq!(config.sample_rate, 16000);
        assert_eq!(config.channels, 1);
        assert_eq!(config.sample_format, SampleFormat::F32);
        assert_eq!(config.buffer_size, 1024);
    }

    #[test]
    fn test_audio_samples_duration() {
        // 16000 samples at 16kHz mono = 1 second
        let samples = AudioSamples::new(vec![0.0; 16000], 16000, 1);
        assert!((samples.duration() - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_audio_samples_frame_count() {
        // 1000 samples, stereo (2 channels) = 500 frames
        let samples = AudioSamples::new(vec![0.0; 1000], 16000, 2);
        assert_eq!(samples.frame_count(), 500);
    }

    #[test]
    fn test_device_health_default() {
        let health = DeviceHealth::default();
        assert_eq!(health.buffer_usage_percent, 0);
        assert_eq!(health.dropped_frames, 0);
        assert!(health.last_error.is_none());
    }
}
