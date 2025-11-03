//! WAV file encoder sink using the hound library
//!
//! Provides high-quality uncompressed WAV encoding with support for multiple
//! sample formats (f32, i16). Extracted from the existing audio_capture.rs
//! implementation and adapted to the AudioSink trait.

use crate::audio::graph::traits::{AudioBuffer, AudioError, AudioFormat, AudioSink, SampleFormat, SinkStats};
use hound::{SampleFormat as HoundSampleFormat, WavSpec, WavWriter};
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

/// WAV encoder sink that writes audio to a WAV file
///
/// Uses the hound library for high-quality uncompressed WAV encoding.
/// Supports f32 and i16 sample formats. Files are finalized on close()
/// or when the sink is dropped.
///
/// # Example
///
/// ```rust,no_run
/// use audio::sinks::WavEncoderSink;
/// use audio::graph::traits::{AudioFormat, AudioSink};
///
/// let mut sink = WavEncoderSink::new("recording.wav", AudioFormat::speech())?;
///
/// // Write audio buffers
/// for buffer in buffers {
///     sink.write(buffer)?;
/// }
///
/// // Finalize the file
/// sink.close()?;
/// ```
pub struct WavEncoderSink {
    /// Output file path
    path: PathBuf,
    /// WAV writer (None if closed)
    writer: Option<WavWriter<BufWriter<File>>>,
    /// Audio format specification
    format: AudioFormat,
    /// Total samples written
    samples_written: u64,
    /// Total bytes written (estimated)
    bytes_written: u64,
    /// Sink statistics
    stats: SinkStats,
}

impl WavEncoderSink {
    /// Creates a new WAV encoder sink that writes to the specified path.
    ///
    /// The file will be created or overwritten if it exists. The parent
    /// directory must exist.
    ///
    /// # Arguments
    ///
    /// * `path` - Output file path (will be created/overwritten)
    /// * `format` - Audio format specification
    ///
    /// # Errors
    ///
    /// Returns `AudioError::IoError` if:
    /// - File cannot be created (permission denied, path doesn't exist, etc.)
    /// - Invalid path
    /// - Parent directory does not exist
    ///
    /// Returns `AudioError::FormatError` if:
    /// - Sample format is not supported by WAV (only f32, i16, i24, i32)
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// let sink = WavEncoderSink::new("output.wav", AudioFormat::speech())?;
    /// ```
    pub fn new<P: AsRef<Path>>(path: P, format: AudioFormat) -> Result<Self, AudioError> {
        let path = path.as_ref().to_path_buf();

        // Validate path (parent directory must exist)
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                return Err(AudioError::IoError(format!(
                    "Parent directory does not exist: {:?}",
                    parent
                )));
            }
        }

        // Create WavSpec from AudioFormat
        let spec = WavSpec {
            channels: format.channels,
            sample_rate: format.sample_rate,
            bits_per_sample: match format.sample_format {
                SampleFormat::F32 => 32,
                SampleFormat::I16 => 16,
                SampleFormat::I24 => 24,
                SampleFormat::I32 => 32,
            },
            sample_format: match format.sample_format {
                SampleFormat::F32 => HoundSampleFormat::Float,
                _ => HoundSampleFormat::Int,
            },
        };

        // Create writer
        let writer = WavWriter::create(&path, spec)
            .map_err(|e| AudioError::IoError(format!("Failed to create WAV file: {}", e)))?;

        Ok(Self {
            path,
            writer: Some(writer),
            format,
            samples_written: 0,
            bytes_written: 0,
            stats: SinkStats::default(),
        })
    }

    /// Returns the output file path.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Returns the number of samples written so far.
    pub fn samples_written(&self) -> u64 {
        self.samples_written
    }

    /// Returns the estimated file size in bytes.
    ///
    /// This is an estimate based on samples written and format.
    /// The actual file size includes WAV header overhead.
    pub fn bytes_written(&self) -> u64 {
        self.bytes_written
    }

    /// Returns the audio format this sink expects.
    pub fn format(&self) -> AudioFormat {
        self.format
    }
}

impl AudioSink for WavEncoderSink {
    fn write(&mut self, buffer: AudioBuffer) -> Result<(), AudioError> {
        let writer = self.writer.as_mut().ok_or_else(|| {
            AudioError::InvalidState("Sink is closed, cannot write".to_string())
        })?;

        // Verify format matches
        if buffer.format != self.format {
            return Err(AudioError::FormatError(format!(
                "Buffer format {:?} does not match sink format {:?}",
                buffer.format, self.format
            )));
        }

        // Write samples based on format
        match self.format.sample_format {
            SampleFormat::F32 => {
                for &sample in buffer.samples.iter() {
                    writer
                        .write_sample(sample)
                        .map_err(|e| AudioError::IoError(format!("Write failed: {}", e)))?;
                }
            }
            SampleFormat::I16 => {
                for &sample in buffer.samples.iter() {
                    let i16_sample = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                    writer
                        .write_sample(i16_sample)
                        .map_err(|e| AudioError::IoError(format!("Write failed: {}", e)))?;
                }
            }
            SampleFormat::I24 => {
                for &sample in buffer.samples.iter() {
                    let i24_sample = (sample.clamp(-1.0, 1.0) * 8388607.0) as i32;
                    writer
                        .write_sample(i24_sample)
                        .map_err(|e| AudioError::IoError(format!("Write failed: {}", e)))?;
                }
            }
            SampleFormat::I32 => {
                for &sample in buffer.samples.iter() {
                    let i32_sample = (sample.clamp(-1.0, 1.0) * i32::MAX as f32) as i32;
                    writer
                        .write_sample(i32_sample)
                        .map_err(|e| AudioError::IoError(format!("Write failed: {}", e)))?;
                }
            }
        }

        self.samples_written += buffer.samples.len() as u64;
        self.bytes_written = self.samples_written
            * (self.format.sample_format.sample_size() as u64);
        self.stats.buffers_written += 1;
        self.stats.samples_written = self.samples_written;
        self.stats.bytes_written = self.bytes_written;

        Ok(())
    }

    fn flush(&mut self) -> Result<(), AudioError> {
        if let Some(writer) = self.writer.as_mut() {
            writer
                .flush()
                .map_err(|e| AudioError::IoError(format!("Flush failed: {}", e)))?;
        }
        Ok(())
    }

    fn close(&mut self) -> Result<(), AudioError> {
        if let Some(writer) = self.writer.take() {
            writer
                .finalize()
                .map_err(|e| AudioError::IoError(format!("Finalize failed: {}", e)))?;
        }
        Ok(())
    }

    fn name(&self) -> &str {
        "WavEncoderSink"
    }

    fn stats(&self) -> SinkStats {
        self.stats.clone()
    }
}

impl Drop for WavEncoderSink {
    fn drop(&mut self) {
        // Ensure file is finalized on drop (ignore errors since we're dropping)
        let _ = self.close();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;
    use tempfile::TempDir;

    fn create_test_buffer(format: AudioFormat, num_samples: usize) -> AudioBuffer {
        let samples: Vec<f32> = (0..num_samples)
            .map(|i| (i as f32 / num_samples as f32) * 2.0 - 1.0)
            .collect();
        AudioBuffer::new(format, samples, Instant::now())
    }

    #[test]
    fn test_wav_encoder_creation() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.wav");
        let result = WavEncoderSink::new(&path, AudioFormat::speech());
        assert!(result.is_ok());
    }

    #[test]
    fn test_wav_encoder_invalid_path() {
        // Try to create in non-existent directory
        let result = WavEncoderSink::new("/nonexistent/dir/test.wav", AudioFormat::speech());
        assert!(result.is_err());
        if let Err(AudioError::IoError(msg)) = result {
            assert!(msg.contains("Parent directory does not exist"));
        } else {
            panic!("Expected IoError");
        }
    }

    #[test]
    fn test_write_buffers() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.wav");
        let mut sink = WavEncoderSink::new(&path, AudioFormat::speech()).unwrap();

        // Write 10 buffers
        for _ in 0..10 {
            let buffer = create_test_buffer(AudioFormat::speech(), 160);
            sink.write(buffer).unwrap();
        }

        sink.close().unwrap();

        // Verify file exists and has samples
        assert!(path.exists());
        assert_eq!(sink.samples_written(), 1600);
    }

    #[test]
    fn test_format_mismatch_error() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.wav");
        let mut sink = WavEncoderSink::new(&path, AudioFormat::speech()).unwrap();

        // Try to write buffer with different format
        let wrong_format = AudioFormat::new(48000, 2, SampleFormat::F32);
        let buffer = AudioBuffer::new(wrong_format, vec![0.0; 100], Instant::now());

        let result = sink.write(buffer);
        assert!(result.is_err());
        if let Err(AudioError::FormatError(msg)) = result {
            assert!(msg.contains("does not match"));
        } else {
            panic!("Expected FormatError");
        }
    }

    #[test]
    fn test_flush_works() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.wav");
        let mut sink = WavEncoderSink::new(&path, AudioFormat::speech()).unwrap();

        sink.write(create_test_buffer(AudioFormat::speech(), 160))
            .unwrap();
        assert!(sink.flush().is_ok());
    }

    #[test]
    fn test_close_prevents_further_writes() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.wav");
        let mut sink = WavEncoderSink::new(&path, AudioFormat::speech()).unwrap();

        sink.close().unwrap();

        // Try to write after close
        let result = sink.write(create_test_buffer(AudioFormat::speech(), 160));
        assert!(result.is_err());
        if let Err(AudioError::InvalidState(msg)) = result {
            assert!(msg.contains("closed"));
        } else {
            panic!("Expected InvalidState error");
        }
    }

    #[test]
    fn test_double_close_safe() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.wav");
        let mut sink = WavEncoderSink::new(&path, AudioFormat::speech()).unwrap();

        sink.close().unwrap();
        // Second close should not panic
        assert!(sink.close().is_ok());
    }

    #[test]
    fn test_stats_tracking() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.wav");
        let mut sink = WavEncoderSink::new(&path, AudioFormat::speech()).unwrap();

        for _ in 0..5 {
            sink.write(create_test_buffer(AudioFormat::speech(), 160))
                .unwrap();
        }

        let stats = sink.stats();
        assert_eq!(stats.buffers_written, 5);
        assert_eq!(stats.samples_written, 800); // 5 * 160
    }

    #[test]
    fn test_path_accessor() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.wav");
        let sink = WavEncoderSink::new(&path, AudioFormat::speech()).unwrap();

        assert_eq!(sink.path(), path.as_path());
    }

    #[test]
    fn test_i16_format_encoding() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test_i16.wav");
        let format = AudioFormat::new(16000, 1, SampleFormat::I16);
        let mut sink = WavEncoderSink::new(&path, format).unwrap();

        let buffer = create_test_buffer(format, 160);
        sink.write(buffer).unwrap();
        sink.close().unwrap();

        assert!(path.exists());
    }

    #[test]
    fn test_stereo_encoding() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test_stereo.wav");
        let format = AudioFormat::new(48000, 2, SampleFormat::F32);
        let mut sink = WavEncoderSink::new(&path, format).unwrap();

        // Create stereo buffer (320 samples = 160 frames * 2 channels)
        let buffer = create_test_buffer(format, 320);
        sink.write(buffer).unwrap();
        sink.close().unwrap();

        assert!(path.exists());
    }
}
