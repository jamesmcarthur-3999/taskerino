//! Null sink that discards all audio
//!
//! Useful for benchmarking audio pipelines without the overhead of actual
//! encoding or storage. Tracks statistics about throughput.

use crate::audio::graph::traits::{AudioBuffer, AudioError, AudioSink, SinkStats};

/// Null sink that discards all audio buffers
///
/// This sink accepts all audio but performs no actual work. Useful for:
/// - Benchmarking audio pipeline performance
/// - Testing graph topology without storage overhead
/// - Measuring source/processor throughput
///
/// Statistics are still tracked for monitoring purposes.
///
/// # Example
///
/// ```rust,no_run
/// use audio::sinks::NullSink;
/// use audio::graph::traits::AudioSink;
///
/// let mut sink = NullSink::new();
///
/// // All writes succeed instantly
/// for buffer in buffers {
///     sink.write(buffer)?;
/// }
///
/// // Check throughput stats
/// let stats = sink.stats();
/// println!("Processed {} buffers", stats.buffers_written);
/// ```
pub struct NullSink {
    /// Sink statistics
    stats: SinkStats,
}

impl NullSink {
    /// Creates a new null sink
    pub fn new() -> Self {
        Self {
            stats: SinkStats::default(),
        }
    }
}

impl Default for NullSink {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioSink for NullSink {
    fn write(&mut self, buffer: AudioBuffer) -> Result<(), AudioError> {
        // Update statistics but discard the buffer
        self.stats.buffers_written += 1;
        self.stats.samples_written += buffer.samples.len() as u64;
        self.stats.bytes_written = self.stats.samples_written * 4; // f32 = 4 bytes

        // Buffer is dropped here (no actual work)
        Ok(())
    }

    fn flush(&mut self) -> Result<(), AudioError> {
        // No-op - nothing to flush
        Ok(())
    }

    fn close(&mut self) -> Result<(), AudioError> {
        // No-op - nothing to close
        Ok(())
    }

    fn name(&self) -> &str {
        "NullSink"
    }

    fn stats(&self) -> SinkStats {
        self.stats.clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::graph::traits::AudioFormat;
    use std::time::Instant;

    fn create_test_buffer(format: AudioFormat, num_samples: usize) -> AudioBuffer {
        let samples: Vec<f32> = vec![0.5; num_samples];
        AudioBuffer::new(format, samples, Instant::now())
    }

    #[test]
    fn test_null_sink_creation() {
        let sink = NullSink::new();
        let stats = sink.stats();
        assert_eq!(stats.buffers_written, 0);
        assert_eq!(stats.samples_written, 0);
    }

    #[test]
    fn test_write_discards_data() {
        let mut sink = NullSink::new();
        let format = AudioFormat::speech();

        for _ in 0..1000 {
            let buffer = create_test_buffer(format, 160);
            sink.write(buffer).unwrap();
        }

        let stats = sink.stats();
        assert_eq!(stats.buffers_written, 1000);
        assert_eq!(stats.samples_written, 160000); // 1000 * 160

        // NullSink should not consume significant memory
        // (this is implicit - if test doesn't OOM, it passed)
    }

    #[test]
    fn test_stats_tracking() {
        let mut sink = NullSink::new();

        for i in 0..10 {
            let buffer = create_test_buffer(AudioFormat::speech(), (i + 1) * 100);
            sink.write(buffer).unwrap();
        }

        let stats = sink.stats();
        assert_eq!(stats.buffers_written, 10);
        // Sum: 100 + 200 + 300 + ... + 1000 = 5500
        assert_eq!(stats.samples_written, 5500);
    }

    #[test]
    fn test_flush_no_op() {
        let mut sink = NullSink::new();
        let buffer = create_test_buffer(AudioFormat::speech(), 160);
        sink.write(buffer).unwrap();

        assert!(sink.flush().is_ok());
    }

    #[test]
    fn test_close_no_op() {
        let mut sink = NullSink::new();
        let buffer = create_test_buffer(AudioFormat::speech(), 160);
        sink.write(buffer).unwrap();

        assert!(sink.close().is_ok());

        // Can still write after close (since it's a null sink)
        let buffer2 = create_test_buffer(AudioFormat::speech(), 160);
        assert!(sink.write(buffer2).is_ok());
    }

    #[test]
    fn test_multiple_formats() {
        let mut sink = NullSink::new();

        // NullSink accepts any format
        let formats = vec![
            AudioFormat::speech(),
            AudioFormat::cd_quality(),
            AudioFormat::professional(),
        ];

        for format in formats {
            let buffer = create_test_buffer(format, 100);
            assert!(sink.write(buffer).is_ok());
        }

        assert_eq!(sink.stats().buffers_written, 3);
    }

    #[test]
    fn test_high_throughput() {
        let mut sink = NullSink::new();
        let format = AudioFormat::speech();

        // Simulate high-throughput scenario (10k buffers)
        for _ in 0..10000 {
            let buffer = create_test_buffer(format, 160);
            sink.write(buffer).unwrap();
        }

        let stats = sink.stats();
        assert_eq!(stats.buffers_written, 10000);
        assert_eq!(stats.samples_written, 1600000);
    }

    #[test]
    fn test_default() {
        let sink = NullSink::default();
        assert_eq!(sink.name(), "NullSink");
    }

    #[test]
    fn test_name() {
        let sink = NullSink::new();
        assert_eq!(sink.name(), "NullSink");
    }

    #[test]
    fn test_large_buffers() {
        let mut sink = NullSink::new();

        // Write large buffers (1 second of audio at 48kHz stereo)
        let large_buffer = create_test_buffer(
            AudioFormat::new(48000, 2, crate::audio::graph::traits::SampleFormat::F32),
            96000, // 48000 * 2
        );

        assert!(sink.write(large_buffer).is_ok());
        assert_eq!(sink.stats().samples_written, 96000);
    }

    #[test]
    fn test_empty_buffer() {
        let mut sink = NullSink::new();
        let buffer = AudioBuffer::new(AudioFormat::speech(), vec![], Instant::now());

        assert!(sink.write(buffer).is_ok());
        assert_eq!(sink.stats().buffers_written, 1);
        assert_eq!(sink.stats().samples_written, 0);
    }
}
