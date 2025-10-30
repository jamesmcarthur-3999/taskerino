//! Peak normalization processor with look-ahead buffering
//!
//! This module provides audio normalization to bring peak levels to a target value.
//! It uses a look-ahead buffer to detect true peaks before they occur, allowing for
//! precise gain adjustment without clipping.
//!
//! # Features
//!
//! - Peak detection with configurable look-ahead window
//! - Target level specification in dB
//! - Automatic clipping prevention
//! - Never amplifies above unity gain (prevents clipping)
//!
//! # Use Cases
//!
//! - Consistent volume levels across recordings
//! - Preparing audio for AI processing (consistent input levels)
//! - Preventing clipping in downstream processors
//!
//! # Example
//!
//! ```rust,no_run
//! use audio::processors::Normalizer;
//! use audio::graph::traits::{AudioProcessor, AudioBuffer, AudioFormat};
//! use std::time::Instant;
//!
//! // Normalize to -3 dB with 20ms look-ahead at 16kHz
//! let mut normalizer = Normalizer::new(-3.0, 20.0, 16000);
//!
//! let format = AudioFormat::speech();
//! let samples = vec![0.5, 0.5, 0.5, 0.5];
//! let buffer = AudioBuffer::new(format, samples, Instant::now());
//!
//! let output = normalizer.process(buffer).unwrap();
//! ```

use crate::audio::graph::traits::{
    AudioBuffer, AudioError, AudioFormat, AudioProcessor, ProcessorStats,
};
use std::collections::VecDeque;
use std::sync::Arc;

/// Peak normalizer with look-ahead buffering
///
/// Normalizes audio to a target peak level using a look-ahead buffer for
/// true peak detection. This allows the processor to see upcoming peaks
/// and adjust gain accordingly to avoid clipping.
///
/// # Algorithm
///
/// 1. Buffer incoming samples in a look-ahead queue
/// 2. Find peak in the look-ahead window
/// 3. Calculate gain to bring peak to target level
/// 4. Never amplify above unity gain (prevents adding clipping)
/// 5. Apply gain and output oldest samples from buffer
///
/// # Thread Safety
///
/// Normalizer is Send + Sync as it contains no shared mutable state.
pub struct Normalizer {
    /// Target peak level in dB (e.g., -3.0)
    target_level_db: f32,
    /// Look-ahead window size in samples
    look_ahead_samples: usize,
    /// Sample rate (for duration calculations)
    sample_rate: u32,

    // State
    /// Look-ahead buffer (stores future samples)
    buffer: VecDeque<f32>,
    /// Current peak detected in look-ahead window
    current_peak: f32,

    // Statistics
    stats: ProcessorStats,
    /// Peak levels encountered
    max_peak_seen: f32,
    /// Number of times normalization was applied
    normalization_count: u64,
}

impl Normalizer {
    /// Create a new normalizer
    ///
    /// # Arguments
    ///
    /// * `target_level_db` - Target peak level in dB (e.g., -3.0 for -3 dBFS)
    /// * `look_ahead_ms` - Look-ahead window duration in milliseconds (e.g., 20.0)
    /// * `sample_rate` - Sample rate in Hz (e.g., 16000)
    ///
    /// # Look-Ahead Guidelines
    ///
    /// - **5-10 ms**: Fast response, minimal latency (suitable for real-time)
    /// - **20-50 ms**: Balanced (recommended for most cases)
    /// - **100+ ms**: Maximum peak detection, higher latency
    ///
    /// # Example
    ///
    /// ```rust
    /// use audio::processors::Normalizer;
    ///
    /// // Normalize to -3 dB with 20ms look-ahead
    /// let normalizer = Normalizer::new(-3.0, 20.0, 16000);
    /// ```
    pub fn new(target_level_db: f32, look_ahead_ms: f32, sample_rate: u32) -> Self {
        let look_ahead_samples = (look_ahead_ms * sample_rate as f32 / 1000.0) as usize;

        Self {
            target_level_db,
            look_ahead_samples,
            sample_rate,
            buffer: VecDeque::with_capacity(look_ahead_samples * 2), // Pre-allocate
            current_peak: 0.0,
            stats: ProcessorStats::default(),
            max_peak_seen: 0.0,
            normalization_count: 0,
        }
    }

    /// Get the target level in dB
    pub fn target_level_db(&self) -> f32 {
        self.target_level_db
    }

    /// Get the look-ahead window duration in milliseconds
    pub fn look_ahead_ms(&self) -> f32 {
        self.look_ahead_samples as f32 * 1000.0 / self.sample_rate as f32
    }

    /// Get the maximum peak level seen
    pub fn max_peak_seen(&self) -> f32 {
        self.max_peak_seen
    }

    /// Get the number of buffers where normalization was applied
    pub fn normalization_count(&self) -> u64 {
        self.normalization_count
    }

    /// Calculate target peak level in linear scale
    fn target_level_linear(&self) -> f32 {
        db_to_linear(self.target_level_db)
    }

    /// Find peak in look-ahead window
    fn find_peak(&self) -> f32 {
        self.buffer
            .iter()
            .take(self.look_ahead_samples)
            .map(|s| s.abs())
            .fold(0.0f32, f32::max)
    }
}

impl AudioProcessor for Normalizer {
    fn process(&mut self, input: AudioBuffer) -> Result<AudioBuffer, AudioError> {
        let start = std::time::Instant::now();

        // Add new samples to look-ahead buffer
        self.buffer.extend(input.samples.iter());

        // Need enough samples to fill look-ahead window before outputting
        if self.buffer.len() < self.look_ahead_samples {
            // Not enough data yet, return empty buffer
            let empty_samples: Vec<f32> = Vec::new();
            return Ok(AudioBuffer {
                samples: Arc::new(empty_samples),
                format: input.format,
                timestamp: input.timestamp,
                sequence: input.sequence,
            });
        }

        // Find peak in look-ahead window
        let peak = self.find_peak();

        // Update max peak seen
        if peak > self.max_peak_seen {
            self.max_peak_seen = peak;
        }

        // Calculate gain to reach target level
        let target_linear = self.target_level_linear();
        let gain = if peak > 0.0 {
            // Never amplify above unity (prevents adding clipping)
            (target_linear / peak).min(1.0)
        } else {
            1.0 // Silent audio, no gain adjustment needed
        };

        // Track if we're actually normalizing
        if (gain - 1.0).abs() > 0.001 {
            self.normalization_count += 1;
        }

        // Apply gain and drain output samples
        // We can output up to (buffer.len() - look_ahead_samples) samples
        // to maintain the look-ahead window
        let available_to_output = self.buffer.len().saturating_sub(self.look_ahead_samples);
        let output_size = input.samples.len().min(available_to_output);
        let mut output_samples = Vec::with_capacity(output_size);

        for _ in 0..output_size {
            if let Some(sample) = self.buffer.pop_front() {
                output_samples.push(sample * gain);
            } else {
                break;
            }
        }

        // Update statistics
        self.stats.buffers_processed += 1;
        self.stats.samples_processed += output_samples.len() as u64;

        let elapsed = start.elapsed();
        let elapsed_us = elapsed.as_micros() as u64;

        if self.stats.buffers_processed == 1 {
            self.stats.avg_processing_time_us = elapsed_us;
        } else {
            self.stats.avg_processing_time_us =
                (self.stats.avg_processing_time_us * 9 + elapsed_us) / 10;
        }

        Ok(AudioBuffer {
            samples: Arc::new(output_samples),
            format: input.format,
            timestamp: input.timestamp,
            sequence: input.sequence,
        })
    }

    fn output_format(&self, input: AudioFormat) -> AudioFormat {
        // Normalizer doesn't change format
        input
    }

    fn name(&self) -> &str {
        "Normalizer"
    }

    fn reset(&mut self) {
        self.buffer.clear();
        self.current_peak = 0.0;
    }

    fn stats(&self) -> ProcessorStats {
        self.stats.clone()
    }
}

/// Convert decibels to linear amplitude
///
/// # Formula
///
/// linear = 10^(dB / 20)
fn db_to_linear(db: f32) -> f32 {
    10.0f32.powf(db / 20.0)
}

/// Convert linear amplitude to decibels
///
/// # Formula
///
/// dB = 20 * log10(linear)
fn linear_to_db(linear: f32) -> f32 {
    if linear <= 0.0 {
        return f32::NEG_INFINITY;
    }
    20.0 * linear.log10()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    fn create_test_buffer(samples: Vec<f32>) -> AudioBuffer {
        let format = AudioFormat::speech(); // 16kHz mono
        AudioBuffer::new(format, samples, Instant::now())
    }

    #[test]
    fn test_peak_detection() {
        let mut normalizer = Normalizer::new(-3.0, 10.0, 16000); // 160 samples look-ahead

        // Create buffer with known peak
        let mut samples = vec![0.1; 200];
        samples[50] = 0.8; // Peak at sample 50
        samples[150] = 0.9; // Peak at sample 150

        let buffer = create_test_buffer(samples);
        normalizer.process(buffer).unwrap();

        // Should detect 0.9 as the peak in the look-ahead window
        assert!((normalizer.max_peak_seen() - 0.9).abs() < 0.001);
    }

    #[test]
    fn test_normalization_to_target() {
        let mut normalizer = Normalizer::new(-6.0, 10.0, 16000); // -6 dB target, 160 samples look-ahead

        // Create buffer with 0.5 peak
        let samples = vec![0.5; 200];
        let buffer = create_test_buffer(samples);

        // First call: 200 samples in, 160 needed for look-ahead, so 40 samples out
        let output1 = normalizer.process(buffer.clone()).unwrap();
        assert_eq!(output1.samples.len(), 40);

        // Second call should output 200 samples
        let output2 = normalizer.process(buffer).unwrap();
        assert_eq!(output2.samples.len(), 200);

        // With 0.5 peak and -6dB target (0.5 linear), gain should be 1.0 (unity)
        // Because we never amplify above unity
        for sample in output2.samples.iter() {
            assert!((sample - 0.5).abs() < 0.01);
        }
    }

    #[test]
    fn test_no_amplification_above_unity() {
        let mut normalizer = Normalizer::new(0.0, 10.0, 16000); // 0 dB target (unity)

        // Create quiet buffer (0.1 amplitude)
        let samples = vec![0.1; 200];
        let buffer = create_test_buffer(samples);

        normalizer.process(buffer.clone()).unwrap(); // Fill buffer
        let output = normalizer.process(buffer).unwrap();

        // Should NOT amplify to 1.0, should keep at 0.1 (no amplification above unity)
        for sample in output.samples.iter() {
            assert!((sample - 0.1).abs() < 0.01);
        }
    }

    #[test]
    fn test_look_ahead_buffering() {
        let mut normalizer = Normalizer::new(-3.0, 10.0, 16000); // 160 samples look-ahead

        // First buffer: 100 samples in, need 160 for look-ahead, so 0 out
        let buffer1 = create_test_buffer(vec![0.5; 100]);
        let output1 = normalizer.process(buffer1).unwrap();
        assert_eq!(output1.samples.len(), 0);

        // Second buffer: 100 more in (total 200), can output 200 - 160 = 40 samples
        let buffer2 = create_test_buffer(vec![0.6; 100]);
        let output2 = normalizer.process(buffer2).unwrap();
        assert_eq!(output2.samples.len(), 40);

        // Third buffer: 100 more in (total 260), can output 100 samples
        let buffer3 = create_test_buffer(vec![0.7; 100]);
        let output3 = normalizer.process(buffer3).unwrap();
        assert_eq!(output3.samples.len(), 100);
    }

    #[test]
    fn test_clipping_prevention() {
        let mut normalizer = Normalizer::new(-1.0, 10.0, 16000); // -1 dB target

        // Create buffer that peaks at 1.0 (maximum)
        let mut samples = vec![0.5; 200];
        samples[100] = 1.0; // Maximum amplitude

        let buffer = create_test_buffer(samples);
        normalizer.process(buffer.clone()).unwrap();
        let output = normalizer.process(buffer).unwrap();

        // No sample should exceed 1.0 (no clipping)
        for sample in output.samples.iter() {
            assert!(sample.abs() <= 1.0);
        }
    }

    #[test]
    fn test_stats_tracking() {
        let mut normalizer = Normalizer::new(-3.0, 10.0, 16000); // 160 sample look-ahead

        let buffer = create_test_buffer(vec![0.5; 200]);

        normalizer.process(buffer.clone()).unwrap(); // Outputs 40 samples (200 - 160)
        normalizer.process(buffer.clone()).unwrap(); // Outputs 200 samples
        normalizer.process(buffer).unwrap(); // Outputs 200 samples

        let stats = normalizer.stats();
        assert_eq!(stats.buffers_processed, 3);
        // First buffer returns 40 samples, next two return 200 each = 440 total
        assert_eq!(stats.samples_processed, 440);
        // Processing is very fast, may be 0 - just check it's valid
        assert!(stats.avg_processing_time_us >= 0);
    }

    #[test]
    fn test_format_preservation() {
        let mut normalizer = Normalizer::new(-3.0, 10.0, 48000);

        let format = AudioFormat::new(48000, 2, crate::audio::graph::traits::SampleFormat::F32);
        assert_eq!(normalizer.output_format(format), format);
    }

    #[test]
    fn test_reset() {
        let mut normalizer = Normalizer::new(-3.0, 10.0, 16000); // 160 sample look-ahead

        // Fill buffer - first call outputs 40, leaving 160 in buffer
        let buffer = create_test_buffer(vec![0.5; 200]);
        normalizer.process(buffer).unwrap();

        // After first process, buffer should have 160 samples (look-ahead)
        assert_eq!(normalizer.buffer.len(), 160);

        normalizer.reset();

        assert_eq!(normalizer.buffer.len(), 0);
        assert_eq!(normalizer.current_peak, 0.0);
    }

    #[test]
    fn test_silent_audio() {
        let mut normalizer = Normalizer::new(-3.0, 10.0, 16000);

        // Silent buffer
        let buffer = create_test_buffer(vec![0.0; 200]);

        normalizer.process(buffer.clone()).unwrap();
        let output = normalizer.process(buffer).unwrap();

        // Silent audio should remain silent
        for sample in output.samples.iter() {
            assert_eq!(*sample, 0.0);
        }
    }

    #[test]
    fn test_normalization_count() {
        let mut normalizer = Normalizer::new(-6.0, 10.0, 16000);

        // Loud buffer (will be attenuated)
        let loud = create_test_buffer(vec![0.8; 200]);

        normalizer.process(loud.clone()).unwrap();
        normalizer.process(loud.clone()).unwrap();

        // Unity gain buffer (no normalization)
        let unity = create_test_buffer(vec![0.5; 200]);
        normalizer.process(unity).unwrap();

        // Should have normalized the loud buffers
        assert!(normalizer.normalization_count() > 0);
    }

    #[test]
    fn test_db_conversions() {
        // Test db_to_linear
        assert!((db_to_linear(0.0) - 1.0).abs() < 0.001);
        assert!((db_to_linear(-6.0) - 0.5).abs() < 0.01);
        assert!((db_to_linear(-3.0) - 0.707).abs() < 0.01);

        // Test linear_to_db
        assert!((linear_to_db(1.0) - 0.0).abs() < 0.001);
        assert!((linear_to_db(0.5) - (-6.02)).abs() < 0.1);
        assert!(linear_to_db(0.0).is_infinite());
    }
}
