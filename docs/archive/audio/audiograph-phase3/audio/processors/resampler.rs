//! High-quality sample rate conversion using FFT-based resampling
//!
//! This module provides the `Resampler` processor which converts audio between
//! different sample rates using the `rubato` library's FFT-based algorithm.
//! This is essential when mixing sources with different sample rates.
//!
//! # Example
//!
//! ```rust,no_run
//! use audio::processors::Resampler;
//! use audio::graph::traits::{AudioProcessor, AudioBuffer, AudioFormat, SampleFormat};
//! use std::time::Instant;
//!
//! // Convert 16kHz to 48kHz
//! let mut resampler = Resampler::new(16000, 48000, 1, 256).unwrap();
//!
//! let input = AudioBuffer::new(
//!     AudioFormat::new(16000, 1, SampleFormat::F32),
//!     vec![0.0; 256],
//!     Instant::now()
//! );
//!
//! let output = resampler.process(input).unwrap();
//! assert_eq!(output.format.sample_rate, 48000);
//! ```

use crate::audio::graph::traits::{
    AudioBuffer, AudioError, AudioFormat, AudioProcessor, ProcessorStats,
};
use rubato::{FftFixedInOut, Resampler as RubatoResampler};
use std::time::Instant;

/// High-quality audio resampler using FFT-based algorithm
///
/// The Resampler converts audio from one sample rate to another using
/// rubato's FftFixedInOut resampler, which provides high-quality results
/// with low distortion.
///
/// # Features
///
/// - High-quality FFT-based resampling
/// - Support for common sample rates (16kHz, 44.1kHz, 48kHz, etc.)
/// - Mono and stereo channel support
/// - Buffer accumulation for fixed chunk size processing
/// - Statistics tracking (buffers processed, processing time)
///
/// # Implementation Notes
///
/// The rubato resampler requires fixed chunk sizes for input and output.
/// This implementation handles buffer accumulation internally, collecting
/// input samples until enough are available to process a full chunk.
///
/// # Thread Safety
///
/// This struct is Send + Sync, allowing it to be used in multi-threaded
/// audio graphs. However, mutable access must be synchronized externally.
pub struct Resampler {
    /// The underlying rubato resampler
    resampler: FftFixedInOut<f32>,
    /// Input sample rate in Hz
    input_rate: u32,
    /// Output sample rate in Hz
    output_rate: u32,
    /// Number of channels (1 = mono, 2 = stereo)
    channels: u16,
    /// Input buffer accumulator (one Vec per channel)
    input_buffer: Vec<Vec<f32>>,
    /// Output buffer accumulator (one Vec per channel)
    output_buffer: Vec<Vec<f32>>,
    /// Statistics tracker
    stats: ProcessorStats,
    /// Timestamp of the first sample in input buffer
    buffer_start_timestamp: Option<Instant>,
}

impl Resampler {
    /// Create a new resampler
    ///
    /// # Arguments
    ///
    /// * `input_rate` - Input sample rate in Hz (e.g., 16000, 44100, 48000)
    /// * `output_rate` - Output sample rate in Hz
    /// * `channels` - Number of channels (1 = mono, 2 = stereo)
    /// * `chunk_size` - Internal chunk size for processing (larger = more efficient but higher latency)
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Sample rates are invalid (zero or too high)
    /// - Channel count is invalid (zero or too high)
    /// - Chunk size is invalid
    /// - Resampler initialization fails
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use audio::processors::Resampler;
    ///
    /// // Convert 16kHz mono to 48kHz mono with 256-sample chunks
    /// let resampler = Resampler::new(16000, 48000, 1, 256).unwrap();
    /// ```
    pub fn new(
        input_rate: u32,
        output_rate: u32,
        channels: u16,
        chunk_size: usize,
    ) -> Result<Self, AudioError> {
        // Validate parameters
        if input_rate == 0 || input_rate > 192000 {
            return Err(AudioError::ConfigurationError(format!(
                "Invalid input sample rate: {}",
                input_rate
            )));
        }
        if output_rate == 0 || output_rate > 192000 {
            return Err(AudioError::ConfigurationError(format!(
                "Invalid output sample rate: {}",
                output_rate
            )));
        }
        if channels == 0 || channels > 32 {
            return Err(AudioError::ConfigurationError(format!(
                "Invalid channel count: {}",
                channels
            )));
        }
        if chunk_size == 0 || chunk_size > 16384 {
            return Err(AudioError::ConfigurationError(format!(
                "Invalid chunk size: {}",
                chunk_size
            )));
        }

        // Create the rubato resampler
        let resampler = FftFixedInOut::<f32>::new(
            input_rate as usize,
            output_rate as usize,
            chunk_size,
            channels as usize,
        )
        .map_err(|e| AudioError::ProcessingError(format!("Failed to create resampler: {}", e)))?;

        // Initialize per-channel buffers
        let input_buffer = vec![Vec::new(); channels as usize];
        let output_buffer = vec![Vec::new(); channels as usize];

        Ok(Self {
            resampler,
            input_rate,
            output_rate,
            channels,
            input_buffer,
            output_buffer,
            stats: ProcessorStats::default(),
            buffer_start_timestamp: None,
        })
    }

    /// Get the input sample rate
    pub fn input_rate(&self) -> u32 {
        self.input_rate
    }

    /// Get the output sample rate
    pub fn output_rate(&self) -> u32 {
        self.output_rate
    }

    /// Get the number of channels
    pub fn channels(&self) -> u16 {
        self.channels
    }

    /// Get the required input chunk size
    pub fn input_chunk_size(&self) -> usize {
        self.resampler.input_frames_next()
    }

    /// Get the expected output chunk size
    pub fn output_chunk_size(&self) -> usize {
        self.resampler.output_frames_next()
    }

    /// Convert interleaved samples to per-channel format
    ///
    /// Input: [L1, R1, L2, R2, ...]
    /// Output: [[L1, L2, ...], [R1, R2, ...]]
    fn deinterleave(&self, samples: &[f32]) -> Vec<Vec<f32>> {
        let channels = self.channels as usize;
        let frames = samples.len() / channels;
        let mut result = vec![Vec::with_capacity(frames); channels];

        for (i, &sample) in samples.iter().enumerate() {
            result[i % channels].push(sample);
        }

        result
    }

    /// Convert per-channel samples to interleaved format
    ///
    /// Input: [[L1, L2, ...], [R1, R2, ...]]
    /// Output: [L1, R1, L2, R2, ...]
    fn interleave(&self, per_channel: &[Vec<f32>]) -> Vec<f32> {
        if per_channel.is_empty() || per_channel[0].is_empty() {
            return Vec::new();
        }

        let channels = per_channel.len();
        let frames = per_channel[0].len();
        let mut result = Vec::with_capacity(channels * frames);

        for frame_idx in 0..frames {
            for channel in per_channel.iter() {
                result.push(channel[frame_idx]);
            }
        }

        result
    }

    /// Calculate the output timestamp based on resampling ratio
    fn calculate_output_timestamp(&self, input_timestamp: Instant, samples_processed: usize) -> Instant {
        let input_frames = samples_processed / self.channels as usize;
        let input_duration_secs = input_frames as f64 / self.input_rate as f64;
        input_timestamp + std::time::Duration::from_secs_f64(input_duration_secs)
    }
}

impl AudioProcessor for Resampler {
    fn process(&mut self, input: AudioBuffer) -> Result<AudioBuffer, AudioError> {
        let start_time = Instant::now();

        // Validate input format
        if input.format.sample_rate != self.input_rate {
            return Err(AudioError::FormatError(format!(
                "Input sample rate {} does not match resampler input rate {}",
                input.format.sample_rate, self.input_rate
            )));
        }
        if input.format.channels != self.channels {
            return Err(AudioError::FormatError(format!(
                "Input channel count {} does not match resampler channel count {}",
                input.format.channels, self.channels
            )));
        }

        // If input buffer is empty, return empty output
        if input.samples.is_empty() {
            return Ok(AudioBuffer::new(
                AudioFormat {
                    sample_rate: self.output_rate,
                    channels: self.channels,
                    sample_format: input.format.sample_format,
                },
                Vec::new(),
                input.timestamp,
            ));
        }

        // Track timestamp of first sample in buffer
        if self.buffer_start_timestamp.is_none() {
            self.buffer_start_timestamp = Some(input.timestamp);
        }

        // Deinterleave input samples and add to accumulator
        let per_channel = self.deinterleave(&input.samples);
        for (ch_idx, channel_data) in per_channel.iter().enumerate() {
            self.input_buffer[ch_idx].extend(channel_data);
        }

        // Check if we have enough samples to process
        let chunk_size = self.resampler.input_frames_next();
        if self.input_buffer[0].len() < chunk_size {
            // Not enough data yet, return empty buffer
            return Ok(AudioBuffer::new(
                AudioFormat {
                    sample_rate: self.output_rate,
                    channels: self.channels,
                    sample_format: input.format.sample_format,
                },
                Vec::new(),
                input.timestamp,
            ));
        }

        // Extract chunk for processing
        let mut input_chunk: Vec<Vec<f32>> = Vec::with_capacity(self.channels as usize);
        for channel_buf in self.input_buffer.iter_mut() {
            let chunk: Vec<f32> = channel_buf.drain(..chunk_size).collect();
            input_chunk.push(chunk);
        }

        // Calculate output timestamp from buffer start
        let output_timestamp = self.buffer_start_timestamp.unwrap();

        // Update buffer start timestamp for remaining samples
        if self.input_buffer[0].is_empty() {
            self.buffer_start_timestamp = None;
        } else {
            self.buffer_start_timestamp = Some(self.calculate_output_timestamp(
                output_timestamp,
                chunk_size * self.channels as usize,
            ));
        }

        // Perform resampling
        let output_chunk = self
            .resampler
            .process(&input_chunk, None)
            .map_err(|e| AudioError::ProcessingError(format!("Resampling failed: {}", e)))?;

        // Interleave output samples
        let interleaved = self.interleave(&output_chunk);

        // Update statistics
        let processing_time = start_time.elapsed();
        self.stats.buffers_processed += 1;
        self.stats.samples_processed += interleaved.len() as u64;

        // Update running average of processing time
        let new_time_us = processing_time.as_micros() as u64;
        if self.stats.buffers_processed == 1 {
            self.stats.avg_processing_time_us = new_time_us;
        } else {
            // Exponential moving average
            self.stats.avg_processing_time_us =
                (self.stats.avg_processing_time_us * 9 + new_time_us) / 10;
        }

        Ok(AudioBuffer::new(
            AudioFormat {
                sample_rate: self.output_rate,
                channels: self.channels,
                sample_format: input.format.sample_format,
            },
            interleaved,
            output_timestamp,
        ))
    }

    fn output_format(&self, input: AudioFormat) -> AudioFormat {
        AudioFormat {
            sample_rate: self.output_rate,
            channels: input.channels,
            sample_format: input.sample_format,
        }
    }

    fn name(&self) -> &str {
        "Resampler"
    }

    fn reset(&mut self) {
        // Clear accumulated buffers
        for channel in self.input_buffer.iter_mut() {
            channel.clear();
        }
        for channel in self.output_buffer.iter_mut() {
            channel.clear();
        }
        self.buffer_start_timestamp = None;

        // Reset resampler state
        self.resampler.reset();
    }

    fn stats(&self) -> ProcessorStats {
        self.stats.clone()
    }
}

// Safety: Resampler is Send + Sync because:
// - FftFixedInOut is Send + Sync (documented in rubato)
// - All other fields (Vec, u32, u16, etc.) are Send + Sync
// - No interior mutability without synchronization
unsafe impl Send for Resampler {}
unsafe impl Sync for Resampler {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::graph::traits::SampleFormat;
    use std::f32::consts::PI;

    /// Generate a sine wave at specified frequency
    fn generate_sine_wave(
        frequency: f32,
        sample_rate: u32,
        duration_secs: f32,
        channels: u16,
    ) -> Vec<f32> {
        let num_frames = (sample_rate as f32 * duration_secs) as usize;
        let mut samples = Vec::with_capacity(num_frames * channels as usize);

        for i in 0..num_frames {
            let t = i as f32 / sample_rate as f32;
            let sample = (2.0 * PI * frequency * t).sin();

            // Duplicate for each channel
            for _ in 0..channels {
                samples.push(sample);
            }
        }

        samples
    }

    /// Find peak frequency in signal using simple DFT
    fn find_peak_frequency(samples: &[f32], sample_rate: u32, channels: u16) -> f32 {
        // Extract first channel only
        let mono: Vec<f32> = samples
            .iter()
            .enumerate()
            .filter(|(i, _)| i % channels as usize == 0)
            .map(|(_, &s)| s)
            .collect();

        let n = mono.len().min(1024); // Use first 1024 samples
        let mut max_magnitude = 0.0f32;
        let mut max_freq = 0.0f32;

        // Simple DFT for frequency detection (20Hz to 5kHz range)
        for k in (20..5000).step_by(10) {
            let freq = k as f32;
            let mut real = 0.0f32;
            let mut imag = 0.0f32;

            for (i, &sample) in mono.iter().take(n).enumerate() {
                let angle = 2.0 * PI * freq * i as f32 / sample_rate as f32;
                real += sample * angle.cos();
                imag += sample * angle.sin();
            }

            let magnitude = (real * real + imag * imag).sqrt();
            if magnitude > max_magnitude {
                max_magnitude = magnitude;
                max_freq = freq;
            }
        }

        max_freq
    }

    #[test]
    fn test_resampler_creation() {
        let resampler = Resampler::new(16000, 48000, 1, 256);
        assert!(resampler.is_ok());

        let resampler = resampler.unwrap();
        assert_eq!(resampler.input_rate(), 16000);
        assert_eq!(resampler.output_rate(), 48000);
        assert_eq!(resampler.channels(), 1);
    }

    #[test]
    fn test_resampler_invalid_rates() {
        // Zero input rate
        assert!(Resampler::new(0, 48000, 1, 256).is_err());

        // Zero output rate
        assert!(Resampler::new(16000, 0, 1, 256).is_err());

        // Too high rate
        assert!(Resampler::new(16000, 999999, 1, 256).is_err());
    }

    #[test]
    fn test_resampler_invalid_channels() {
        // Zero channels
        assert!(Resampler::new(16000, 48000, 0, 256).is_err());

        // Too many channels
        assert!(Resampler::new(16000, 48000, 100, 256).is_err());
    }

    #[test]
    fn test_resampler_invalid_chunk_size() {
        // Zero chunk size
        assert!(Resampler::new(16000, 48000, 1, 0).is_err());

        // Too large chunk size
        assert!(Resampler::new(16000, 48000, 1, 99999).is_err());
    }

    #[test]
    fn test_16khz_to_48khz_mono() {
        let mut resampler = Resampler::new(16000, 48000, 1, 256).unwrap();

        // Generate 256 samples at 16kHz
        let input_samples = vec![0.5f32; 256];
        let input = AudioBuffer::new(
            AudioFormat::new(16000, 1, SampleFormat::F32),
            input_samples,
            Instant::now(),
        );

        let output = resampler.process(input).unwrap();

        assert_eq!(output.format.sample_rate, 48000);
        assert_eq!(output.format.channels, 1);

        // Output should be ~3x larger (48000/16000)
        // Exact size depends on resampler implementation
        assert!(output.samples.len() > 0);
    }

    #[test]
    fn test_48khz_to_16khz_mono() {
        let mut resampler = Resampler::new(48000, 16000, 1, 480).unwrap();

        // Generate enough samples for processing (use chunk_size)
        let chunk_size = resampler.input_chunk_size();
        let input_samples = vec![0.5f32; chunk_size];
        let input = AudioBuffer::new(
            AudioFormat::new(48000, 1, SampleFormat::F32),
            input_samples,
            Instant::now(),
        );

        let output = resampler.process(input).unwrap();

        assert_eq!(output.format.sample_rate, 16000);
        assert_eq!(output.format.channels, 1);

        // Output should be ~1/3 smaller (16000/48000)
        assert!(output.samples.len() > 0);
        let expected_output_size = chunk_size / 3;
        assert!((output.samples.len() as i32 - expected_output_size as i32).abs() < 10);
    }

    #[test]
    fn test_44100_to_48000() {
        let mut resampler = Resampler::new(44100, 48000, 1, 441).unwrap();

        // Use the actual chunk size required
        let chunk_size = resampler.input_chunk_size();
        let input_samples = vec![0.5f32; chunk_size];
        let input = AudioBuffer::new(
            AudioFormat::new(44100, 1, SampleFormat::F32),
            input_samples,
            Instant::now(),
        );

        let output = resampler.process(input).unwrap();

        assert_eq!(output.format.sample_rate, 48000);
        assert!(output.samples.len() > 0);
        // 48000 / 44100 ≈ 1.088, so output should be slightly larger
        assert!(output.samples.len() as f32 > chunk_size as f32 * 1.05);
    }

    #[test]
    fn test_stereo_resampling() {
        let mut resampler = Resampler::new(16000, 48000, 2, 256).unwrap();

        // Generate stereo samples (512 total = 256 frames × 2 channels)
        let input_samples = vec![0.5f32; 512];
        let input = AudioBuffer::new(
            AudioFormat::new(16000, 2, SampleFormat::F32),
            input_samples,
            Instant::now(),
        );

        let output = resampler.process(input).unwrap();

        assert_eq!(output.format.sample_rate, 48000);
        assert_eq!(output.format.channels, 2);
        assert!(output.samples.len() > 0);

        // Output should still be interleaved stereo
        assert_eq!(output.samples.len() % 2, 0);
    }

    #[test]
    fn test_buffer_accumulation() {
        let mut resampler = Resampler::new(16000, 48000, 1, 256).unwrap();

        // Send a buffer smaller than chunk size
        let small_samples = vec![0.5f32; 128];
        let input = AudioBuffer::new(
            AudioFormat::new(16000, 1, SampleFormat::F32),
            small_samples,
            Instant::now(),
        );

        let output = resampler.process(input).unwrap();

        // Should return empty buffer (not enough data)
        assert_eq!(output.samples.len(), 0);

        // Send another buffer
        let more_samples = vec![0.5f32; 128];
        let input2 = AudioBuffer::new(
            AudioFormat::new(16000, 1, SampleFormat::F32),
            more_samples,
            Instant::now(),
        );

        let output2 = resampler.process(input2).unwrap();

        // Now should have output (accumulated 256 samples)
        assert!(output2.samples.len() > 0);
    }

    #[test]
    fn test_format_mismatch_error() {
        let mut resampler = Resampler::new(16000, 48000, 1, 256).unwrap();

        // Send buffer with wrong sample rate
        let input = AudioBuffer::new(
            AudioFormat::new(44100, 1, SampleFormat::F32),
            vec![0.5f32; 256],
            Instant::now(),
        );

        let result = resampler.process(input);
        assert!(result.is_err());

        // Send buffer with wrong channel count
        let input2 = AudioBuffer::new(
            AudioFormat::new(16000, 2, SampleFormat::F32),
            vec![0.5f32; 512],
            Instant::now(),
        );

        let result2 = resampler.process(input2);
        assert!(result2.is_err());
    }

    #[test]
    fn test_empty_buffer() {
        let mut resampler = Resampler::new(16000, 48000, 1, 256).unwrap();

        let input = AudioBuffer::new(
            AudioFormat::new(16000, 1, SampleFormat::F32),
            Vec::new(),
            Instant::now(),
        );

        let output = resampler.process(input).unwrap();
        assert_eq!(output.samples.len(), 0);
    }

    #[test]
    fn test_stats_tracking() {
        let mut resampler = Resampler::new(16000, 48000, 1, 256).unwrap();

        let input_samples = vec![0.5f32; 256];
        let input = AudioBuffer::new(
            AudioFormat::new(16000, 1, SampleFormat::F32),
            input_samples,
            Instant::now(),
        );

        let _ = resampler.process(input).unwrap();

        let stats = resampler.stats();
        assert_eq!(stats.buffers_processed, 1);
        assert!(stats.samples_processed > 0);
        assert!(stats.avg_processing_time_us > 0);
    }

    #[test]
    fn test_reset() {
        let mut resampler = Resampler::new(16000, 48000, 1, 256).unwrap();

        // Process some data
        let input = AudioBuffer::new(
            AudioFormat::new(16000, 1, SampleFormat::F32),
            vec![0.5f32; 128],
            Instant::now(),
        );
        let _ = resampler.process(input).unwrap();

        // Reset
        resampler.reset();

        // Input buffer should be cleared
        assert!(resampler.input_buffer[0].is_empty());
    }

    #[test]
    fn test_output_format() {
        let resampler = Resampler::new(16000, 48000, 2, 256).unwrap();

        let input_format = AudioFormat::new(16000, 2, SampleFormat::F32);
        let output_format = resampler.output_format(input_format);

        assert_eq!(output_format.sample_rate, 48000);
        assert_eq!(output_format.channels, 2);
        assert_eq!(output_format.sample_format, SampleFormat::F32);
    }

    #[test]
    fn test_preserves_frequency() {
        // Generate 440Hz sine wave at 16kHz
        let input_samples = generate_sine_wave(440.0, 16000, 0.1, 1);
        let mut resampler = Resampler::new(16000, 48000, 1, 256).unwrap();

        // Feed all samples through resampler
        let mut all_output = Vec::new();
        for chunk in input_samples.chunks(256) {
            let input = AudioBuffer::new(
                AudioFormat::new(16000, 1, SampleFormat::F32),
                chunk.to_vec(),
                Instant::now(),
            );

            let output = resampler.process(input).unwrap();
            all_output.extend_from_slice(&output.samples);
        }

        // Find peak frequency in output
        let peak_freq = find_peak_frequency(&all_output, 48000, 1);

        // Should be close to 440Hz (allow 5Hz tolerance)
        assert!(
            (peak_freq - 440.0).abs() < 5.0,
            "Frequency drift too large: expected 440Hz, got {}Hz",
            peak_freq
        );
    }

    #[test]
    fn test_name() {
        let resampler = Resampler::new(16000, 48000, 1, 256).unwrap();
        assert_eq!(resampler.name(), "Resampler");
    }
}
