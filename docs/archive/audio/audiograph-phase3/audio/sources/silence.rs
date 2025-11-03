//! Silence audio source for testing
//!
//! Generates silent audio buffers at a specified rate for testing and debugging.

use crate::audio::graph::traits::{
    AudioBuffer, AudioError, AudioFormat, AudioSource, SourceStats,
};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Silence audio source
///
/// Generates silent audio buffers (all zeros) at a configurable rate. Useful for:
/// - Testing graph topology without hardware
/// - Debugging audio pipelines
/// - Placeholder during development
///
/// # Example
///
/// ```rust
/// use audio::sources::SilenceSource;
/// use audio::graph::traits::{AudioSource, AudioFormat};
///
/// let format = AudioFormat::speech(); // 16kHz mono
/// let mut source = SilenceSource::new(format, 100); // 100ms buffers
/// source.start()?;
///
/// while let Some(buffer) = source.read()? {
///     assert!(buffer.is_silent(0.001)); // Verify it's silent
/// }
///
/// source.stop()?;
/// # Ok::<(), audio::graph::traits::AudioError>(())
/// ```
pub struct SilenceSource {
    /// Audio format
    format: AudioFormat,
    /// Buffer duration in milliseconds
    buffer_duration_ms: u32,
    /// Whether the source is currently active
    is_active: bool,
    /// Statistics
    stats: Arc<Mutex<SourceStats>>,
    /// Last buffer generation time
    last_buffer_time: Option<Instant>,
}

impl SilenceSource {
    /// Create a new silence source
    ///
    /// # Arguments
    ///
    /// * `format` - Audio format for generated buffers
    /// * `buffer_duration_ms` - Duration of each buffer in milliseconds (typically 10-100ms)
    ///
    /// # Example
    ///
    /// ```rust
    /// use audio::sources::SilenceSource;
    /// use audio::graph::traits::AudioFormat;
    ///
    /// let format = AudioFormat::speech(); // 16kHz mono
    /// let source = SilenceSource::new(format, 10); // 10ms buffers
    /// ```
    pub fn new(format: AudioFormat, buffer_duration_ms: u32) -> Self {
        Self {
            format,
            buffer_duration_ms,
            is_active: false,
            stats: Arc::new(Mutex::new(SourceStats::default())),
            last_buffer_time: None,
        }
    }

    /// Calculate number of samples for a buffer
    fn calculate_samples(&self) -> usize {
        let duration_secs = self.buffer_duration_ms as f32 / 1000.0;
        let frames = (self.format.sample_rate as f32 * duration_secs) as usize;
        frames * self.format.channels as usize
    }
}

impl AudioSource for SilenceSource {
    fn format(&self) -> AudioFormat {
        self.format
    }

    fn start(&mut self) -> Result<(), AudioError> {
        if self.is_active {
            return Err(AudioError::InvalidState(
                "Source is already active".to_string(),
            ));
        }

        self.is_active = true;
        self.last_buffer_time = None; // Reset to allow immediate first buffer

        Ok(())
    }

    fn stop(&mut self) -> Result<(), AudioError> {
        if !self.is_active {
            return Ok(()); // Idempotent stop
        }

        self.is_active = false;
        self.last_buffer_time = None;

        Ok(())
    }

    fn read(&mut self) -> Result<Option<AudioBuffer>, AudioError> {
        if !self.is_active {
            return Err(AudioError::InvalidState(
                "Source is not active".to_string(),
            ));
        }

        // Check if enough time has passed for next buffer
        let now = Instant::now();
        let should_generate = if let Some(last_time) = self.last_buffer_time {
            let elapsed = now.duration_since(last_time);
            let buffer_duration = Duration::from_millis(self.buffer_duration_ms as u64);
            elapsed >= buffer_duration
        } else {
            true // First buffer
        };

        if !should_generate {
            return Ok(None);
        }

        // Generate silent buffer (all zeros)
        let num_samples = self.calculate_samples();
        let samples = vec![0.0_f32; num_samples];

        // Update stats
        if let Ok(mut stats) = self.stats.lock() {
            stats.buffers_produced += 1;
            stats.samples_produced += num_samples as u64;
            stats.last_activity = Some(now);
        }

        // Update last buffer time
        self.last_buffer_time = Some(now);

        // Create audio buffer
        let buffer = AudioBuffer::new(self.format, samples, now);

        Ok(Some(buffer))
    }

    fn is_active(&self) -> bool {
        self.is_active
    }

    fn name(&self) -> &str {
        "SilenceSource"
    }

    fn stats(&self) -> SourceStats {
        self.stats
            .lock()
            .map(|s| s.clone())
            .unwrap_or_default()
    }
}

impl Drop for SilenceSource {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

// SAFETY: SilenceSource uses Arc<Mutex<>> for thread-safe stats access
unsafe impl Send for SilenceSource {}
unsafe impl Sync for SilenceSource {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::graph::traits::SampleFormat;

    #[test]
    fn test_silence_creation() {
        let format = AudioFormat::speech();
        let source = SilenceSource::new(format, 10);
        assert!(!source.is_active());
        assert_eq!(source.format(), format);
    }

    #[test]
    fn test_start_stop_lifecycle() {
        let format = AudioFormat::speech();
        let mut source = SilenceSource::new(format, 10);

        assert!(!source.is_active());

        // Start
        assert!(source.start().is_ok());
        assert!(source.is_active());

        // Stop
        assert!(source.stop().is_ok());
        assert!(!source.is_active());
    }

    #[test]
    fn test_buffer_production() {
        let format = AudioFormat::speech();
        let mut source = SilenceSource::new(format, 10); // 10ms buffers

        source.start().unwrap();

        // Read first buffer (should be immediate since last_buffer_time is None after start)
        let buffer1 = source.read().unwrap();
        assert!(buffer1.is_some(), "First read should return a buffer immediately");

        let buffer = buffer1.unwrap();
        assert!(buffer.is_silent(0.001)); // Should be silent
        assert_eq!(buffer.format, format);

        // Immediately reading again should return None (not enough time passed)
        let buffer2 = source.read().unwrap();
        assert!(buffer2.is_none());

        // Wait for buffer duration and try again
        std::thread::sleep(Duration::from_millis(12));
        let buffer3 = source.read().unwrap();
        assert!(buffer3.is_some());

        source.stop().unwrap();
    }

    #[test]
    fn test_format_returns_correct() {
        let format = AudioFormat::new(48000, 2, SampleFormat::F32);
        let source = SilenceSource::new(format, 10);
        assert_eq!(source.format(), format);
    }

    #[test]
    fn test_double_start_prevention() {
        let format = AudioFormat::speech();
        let mut source = SilenceSource::new(format, 10);

        source.start().unwrap();

        // Second start should error
        let result = source.start();
        assert!(result.is_err());

        source.stop().unwrap();
    }

    #[test]
    fn test_read_when_not_started() {
        let format = AudioFormat::speech();
        let mut source = SilenceSource::new(format, 10);

        // Read should error if not started
        let result = source.read();
        assert!(result.is_err());
    }

    #[test]
    fn test_stats_tracking() {
        let format = AudioFormat::speech();
        let mut source = SilenceSource::new(format, 10);

        let stats = source.stats();
        // Initially zero
        assert_eq!(stats.buffers_produced, 0);
        assert_eq!(stats.samples_produced, 0);

        // Produce a buffer
        source.start().unwrap();

        // First read should succeed immediately
        let buffer = source.read().unwrap();
        assert!(buffer.is_some(), "First read should return a buffer");

        let stats_after = source.stats();
        assert_eq!(stats_after.buffers_produced, 1);
        assert!(stats_after.samples_produced > 0);

        source.stop().unwrap();
    }

    #[test]
    fn test_graceful_cleanup() {
        // Test that Drop doesn't panic
        {
            let format = AudioFormat::speech();
            let _source = SilenceSource::new(format, 10);
            // Drop happens here
        }
        // If we reach here, drop didn't panic
    }

    #[test]
    fn test_buffer_sample_count() {
        let format = AudioFormat::new(16000, 1, SampleFormat::F32); // 16kHz mono
        let mut source = SilenceSource::new(format, 10); // 10ms

        source.start().unwrap();

        // First read should succeed immediately
        let buffer = source.read().unwrap();
        assert!(buffer.is_some(), "First read should return a buffer");
        let buffer = buffer.unwrap();

        // 16kHz * 0.01s * 1 channel = 160 samples
        assert_eq!(buffer.num_frames(), 160);

        source.stop().unwrap();
    }

    #[test]
    fn test_stereo_buffer_sample_count() {
        let format = AudioFormat::new(48000, 2, SampleFormat::F32); // 48kHz stereo
        let mut source = SilenceSource::new(format, 20); // 20ms

        source.start().unwrap();

        // First read should succeed immediately
        let buffer = source.read().unwrap();
        assert!(buffer.is_some(), "First read should return a buffer");
        let buffer = buffer.unwrap();

        // 48kHz * 0.02s * 2 channels = 1920 samples, 960 frames
        assert_eq!(buffer.num_frames(), 960);

        source.stop().unwrap();
    }
}
