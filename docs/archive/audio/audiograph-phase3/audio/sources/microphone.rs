//! Microphone audio source using cpal
//!
//! Provides cross-platform microphone capture via the cpal crate.

use crate::audio::graph::traits::{
    AudioBuffer, AudioError, AudioFormat, AudioSource, SampleFormat, SourceStats,
};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Stream, StreamConfig};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// Microphone audio source
///
/// Captures audio from a microphone device using cpal. Supports:
/// - Device enumeration and selection by name
/// - Automatic format conversion to f32
/// - Ring buffer for managing captured audio
/// - Statistics tracking (buffer usage, overruns)
///
/// # Example
///
/// ```rust,no_run
/// use audio::sources::MicrophoneSource;
/// use audio::graph::traits::AudioSource;
///
/// let mut source = MicrophoneSource::new(None)?; // Use default device
/// source.start()?;
///
/// while let Some(buffer) = source.read()? {
///     // Process audio buffer
/// }
///
/// source.stop()?;
/// # Ok::<(), audio::graph::traits::AudioError>(())
/// ```
pub struct MicrophoneSource {
    /// Device name (or None for default)
    device_name: Option<String>,
    /// cpal audio stream
    stream: Option<Stream>,
    /// Ring buffer for captured audio samples
    buffer_queue: Arc<Mutex<VecDeque<AudioBuffer>>>,
    /// Audio format
    format: AudioFormat,
    /// Whether the source is currently active
    is_active: bool,
    /// Statistics
    stats: Arc<Mutex<SourceStats>>,
    /// Maximum queue size (number of buffers)
    max_queue_size: usize,
}

impl MicrophoneSource {
    /// Create a new microphone source
    ///
    /// # Arguments
    ///
    /// * `device_name` - Optional device name. If None, uses default input device.
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - No input device is available
    /// - Specified device is not found
    /// - Failed to get device configuration
    pub fn new(device_name: Option<String>) -> Result<Self, AudioError> {
        let host = cpal::default_host();

        // Find device
        let device = if let Some(ref name) = device_name {
            host.input_devices()
                .map_err(|e| AudioError::DeviceError(format!("Failed to enumerate devices: {}", e)))?
                .find(|d| {
                    d.name()
                        .map(|n| n == *name)
                        .unwrap_or(false)
                })
                .ok_or_else(|| {
                    AudioError::DeviceError(format!("Device '{}' not found", name))
                })?
        } else {
            host.default_input_device()
                .ok_or_else(|| AudioError::DeviceError("No input device available".to_string()))?
        };

        // Get device configuration
        let config = device
            .default_input_config()
            .map_err(|e| AudioError::DeviceError(format!("Failed to get device config: {}", e)))?;

        // Convert to AudioFormat
        let format = AudioFormat::new(
            config.sample_rate().0,
            config.channels(),
            SampleFormat::F32, // Always use F32 internally
        );

        Ok(Self {
            device_name,
            stream: None,
            buffer_queue: Arc::new(Mutex::new(VecDeque::new())),
            format,
            is_active: false,
            stats: Arc::new(Mutex::new(SourceStats::default())),
            max_queue_size: 20000, // 20,000 buffers = massive headroom to eliminate capacity issues
        })
    }

    /// Set maximum queue size (number of buffers)
    pub fn set_max_queue_size(&mut self, size: usize) {
        self.max_queue_size = size;
    }

    /// Build the audio input stream
    fn build_stream(&self, device: &Device, config: StreamConfig) -> Result<Stream, AudioError> {
        let buffer_queue = Arc::clone(&self.buffer_queue);
        let stats = Arc::clone(&self.stats);
        let format = self.format;
        let max_queue_size = self.max_queue_size;

        // Determine sample format and build appropriate stream
        let sample_format = device
            .default_input_config()
            .map_err(|e| AudioError::DeviceError(format!("Failed to get device config: {}", e)))?
            .sample_format();

        let stream = match sample_format {
            cpal::SampleFormat::F32 => device
                .build_input_stream(
                    &config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        Self::handle_samples_f32(
                            data,
                            &buffer_queue,
                            &stats,
                            format,
                            max_queue_size,
                        );
                    },
                    |err| eprintln!("Audio stream error: {}", err),
                    None,
                )
                .map_err(|e| AudioError::DeviceError(format!("Failed to build stream: {}", e)))?,

            cpal::SampleFormat::I16 => device
                .build_input_stream(
                    &config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        Self::handle_samples_i16(
                            data,
                            &buffer_queue,
                            &stats,
                            format,
                            max_queue_size,
                        );
                    },
                    |err| eprintln!("Audio stream error: {}", err),
                    None,
                )
                .map_err(|e| AudioError::DeviceError(format!("Failed to build stream: {}", e)))?,

            cpal::SampleFormat::U16 => device
                .build_input_stream(
                    &config,
                    move |data: &[u16], _: &cpal::InputCallbackInfo| {
                        Self::handle_samples_u16(
                            data,
                            &buffer_queue,
                            &stats,
                            format,
                            max_queue_size,
                        );
                    },
                    |err| eprintln!("Audio stream error: {}", err),
                    None,
                )
                .map_err(|e| AudioError::DeviceError(format!("Failed to build stream: {}", e)))?,

            _ => {
                return Err(AudioError::FormatError(format!(
                    "Unsupported sample format: {:?}",
                    sample_format
                )))
            }
        };

        Ok(stream)
    }

    /// Handle f32 samples from callback
    fn handle_samples_f32(
        data: &[f32],
        buffer_queue: &Arc<Mutex<VecDeque<AudioBuffer>>>,
        stats: &Arc<Mutex<SourceStats>>,
        format: AudioFormat,
        max_queue_size: usize,
    ) {
        let samples = data.to_vec();
        let buffer = AudioBuffer::new(format, samples, Instant::now());

        if let Ok(mut queue) = buffer_queue.lock() {
            // Check for overflow
            if queue.len() >= max_queue_size {
                // Drop oldest buffer
                queue.pop_front();

                // Track overrun and log periodically
                if let Ok(mut s) = stats.lock() {
                    s.overruns += 1;
                    // Log every 100 dropped buffers to detect buffer issues
                    if s.overruns % 100 == 0 {
                        eprintln!("[MICROPHONE] ⚠️  {} buffers dropped (ring buffer full - max: {})", s.overruns, max_queue_size);
                    }
                }
            }

            queue.push_back(buffer);

            // Update stats
            if let Ok(mut s) = stats.lock() {
                s.buffers_produced += 1;
                s.samples_produced += data.len() as u64;
                s.avg_buffer_fullness = queue.len() as f32 / max_queue_size as f32;
                s.last_activity = Some(Instant::now());
            }
        }
    }

    /// Handle i16 samples from callback (convert to f32)
    fn handle_samples_i16(
        data: &[i16],
        buffer_queue: &Arc<Mutex<VecDeque<AudioBuffer>>>,
        stats: &Arc<Mutex<SourceStats>>,
        format: AudioFormat,
        max_queue_size: usize,
    ) {
        let samples: Vec<f32> = data
            .iter()
            .map(|&s| s as f32 / i16::MAX as f32)
            .collect();

        let buffer = AudioBuffer::new(format, samples, Instant::now());

        if let Ok(mut queue) = buffer_queue.lock() {
            if queue.len() >= max_queue_size {
                queue.pop_front();
                if let Ok(mut s) = stats.lock() {
                    s.overruns += 1;
                    // Log every 100 dropped buffers to detect buffer issues
                    if s.overruns % 100 == 0 {
                        eprintln!("[MICROPHONE] ⚠️  {} buffers dropped (ring buffer full - max: {})", s.overruns, max_queue_size);
                    }
                }
            }

            queue.push_back(buffer);

            if let Ok(mut s) = stats.lock() {
                s.buffers_produced += 1;
                s.samples_produced += data.len() as u64;
                s.avg_buffer_fullness = queue.len() as f32 / max_queue_size as f32;
                s.last_activity = Some(Instant::now());
            }
        }
    }

    /// Handle u16 samples from callback (convert to f32)
    fn handle_samples_u16(
        data: &[u16],
        buffer_queue: &Arc<Mutex<VecDeque<AudioBuffer>>>,
        stats: &Arc<Mutex<SourceStats>>,
        format: AudioFormat,
        max_queue_size: usize,
    ) {
        let samples: Vec<f32> = data
            .iter()
            .map(|&s| (s as f32 / u16::MAX as f32) * 2.0 - 1.0)
            .collect();

        let buffer = AudioBuffer::new(format, samples, Instant::now());

        if let Ok(mut queue) = buffer_queue.lock() {
            if queue.len() >= max_queue_size {
                queue.pop_front();
                if let Ok(mut s) = stats.lock() {
                    s.overruns += 1;
                    // Log every 100 dropped buffers to detect buffer issues
                    if s.overruns % 100 == 0 {
                        eprintln!("[MICROPHONE] ⚠️  {} buffers dropped (ring buffer full - max: {})", s.overruns, max_queue_size);
                    }
                }
            }

            queue.push_back(buffer);

            if let Ok(mut s) = stats.lock() {
                s.buffers_produced += 1;
                s.samples_produced += data.len() as u64;
                s.avg_buffer_fullness = queue.len() as f32 / max_queue_size as f32;
                s.last_activity = Some(Instant::now());
            }
        }
    }
}

impl AudioSource for MicrophoneSource {
    fn format(&self) -> AudioFormat {
        self.format
    }

    fn start(&mut self) -> Result<(), AudioError> {
        if self.is_active {
            return Err(AudioError::InvalidState(
                "Source is already active".to_string(),
            ));
        }

        let host = cpal::default_host();

        // Find device
        let device = if let Some(ref name) = self.device_name {
            host.input_devices()
                .map_err(|e| AudioError::DeviceError(format!("Failed to enumerate devices: {}", e)))?
                .find(|d| {
                    d.name()
                        .map(|n| n == *name)
                        .unwrap_or(false)
                })
                .ok_or_else(|| {
                    AudioError::DeviceError(format!("Device '{}' not found", name))
                })?
        } else {
            host.default_input_device()
                .ok_or_else(|| AudioError::DeviceError("No input device available".to_string()))?
        };

        // Get device configuration
        let config = device
            .default_input_config()
            .map_err(|e| AudioError::DeviceError(format!("Failed to get device config: {}", e)))?;

        // Build stream
        let stream = self.build_stream(&device, config.into())?;

        // Start stream
        stream
            .play()
            .map_err(|e| AudioError::DeviceError(format!("Failed to start stream: {}", e)))?;

        self.stream = Some(stream);
        self.is_active = true;

        Ok(())
    }

    fn stop(&mut self) -> Result<(), AudioError> {
        if !self.is_active {
            return Ok(()); // Idempotent stop
        }

        // Drop stream (automatically stops)
        self.stream = None;
        self.is_active = false;

        // Clear buffer queue
        if let Ok(mut queue) = self.buffer_queue.lock() {
            queue.clear();
        }

        Ok(())
    }

    fn read(&mut self) -> Result<Option<AudioBuffer>, AudioError> {
        if !self.is_active {
            return Err(AudioError::InvalidState(
                "Source is not active".to_string(),
            ));
        }

        let mut queue = self
            .buffer_queue
            .lock()
            .map_err(|e| AudioError::Other(format!("Failed to lock buffer queue: {}", e)))?;

        Ok(queue.pop_front())
    }

    fn is_active(&self) -> bool {
        self.is_active
    }

    fn name(&self) -> &str {
        "MicrophoneSource"
    }

    fn stats(&self) -> SourceStats {
        self.stats
            .lock()
            .map(|s| s.clone())
            .unwrap_or_default()
    }
}

impl Drop for MicrophoneSource {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

// SAFETY: MicrophoneSource uses Arc<Mutex<>> for thread-safe buffer access
unsafe impl Send for MicrophoneSource {}
unsafe impl Sync for MicrophoneSource {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_microphone_creation() {
        // Test creating with default device
        let result = MicrophoneSource::new(None);
        // May fail if no device is available, which is acceptable
        match result {
            Ok(_) => println!("Successfully created microphone source"),
            Err(e) => println!("Expected error (no device available): {}", e),
        }
    }

    #[test]
    fn test_microphone_creation_invalid_device() {
        // Should return error for non-existent device
        let result = MicrophoneSource::new(Some("NonExistentDevice12345".to_string()));
        assert!(result.is_err());
    }

    #[test]
    fn test_start_stop_lifecycle() {
        let mut source = match MicrophoneSource::new(None) {
            Ok(s) => s,
            Err(_) => return, // Skip test if no device available
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
        let source = match MicrophoneSource::new(None) {
            Ok(s) => s,
            Err(_) => return,
        };

        let format = source.format();
        assert!(format.sample_rate > 0);
        assert!(format.channels > 0);
        assert_eq!(format.sample_format, SampleFormat::F32);
    }

    #[test]
    fn test_double_start_prevention() {
        let mut source = match MicrophoneSource::new(None) {
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
        let mut source = match MicrophoneSource::new(None) {
            Ok(s) => s,
            Err(_) => return,
        };

        // Read should error if not started
        let result = source.read();
        assert!(result.is_err());
    }

    #[test]
    fn test_stats_tracking() {
        let source = match MicrophoneSource::new(None) {
            Ok(s) => s,
            Err(_) => return,
        };

        let stats = source.stats();
        // Initially zero
        assert_eq!(stats.buffers_produced, 0);
        assert_eq!(stats.samples_produced, 0);
        assert_eq!(stats.overruns, 0);
    }

    #[test]
    fn test_graceful_cleanup() {
        // Test that Drop doesn't panic
        {
            let source = match MicrophoneSource::new(None) {
                Ok(s) => s,
                Err(_) => return,
            };
            // Drop happens here
        }
        // If we reach here, drop didn't panic
    }
}
