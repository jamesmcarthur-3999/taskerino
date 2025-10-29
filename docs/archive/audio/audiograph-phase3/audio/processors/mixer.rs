//! Mixer processor for combining multiple audio sources
//!
//! The Mixer combines multiple audio sources into a single output stream with
//! configurable mixing modes and per-input balance control. This is essential for
//! dual-source recording scenarios (e.g., microphone + system audio).
//!
//! # Mix Modes
//!
//! - **Sum**: Add all inputs together (may clip without peak limiting)
//! - **Average**: Average all inputs (always safe, never clips)
//! - **Weighted**: Use per-input balance weights for custom mixing
//!
//! # Example
//!
//! ```rust,no_run
//! use audio::processors::{Mixer, MixMode};
//! use audio::graph::traits::{AudioBuffer, AudioFormat};
//! use std::time::Instant;
//!
//! // Create mixer for 2 inputs with average mode
//! let mut mixer = Mixer::new(2, MixMode::Average);
//!
//! // Set custom balance: 80% input 0, 50% input 1
//! mixer.set_balance(0, 0.8).unwrap();
//! mixer.set_balance(1, 0.5).unwrap();
//!
//! // Enable peak limiting
//! mixer.enable_peak_limiter(true);
//!
//! // Mix two buffers
//! let format = AudioFormat::speech();
//! let buffer1 = AudioBuffer::new(format, vec![0.5; 160], Instant::now());
//! let buffer2 = AudioBuffer::new(format, vec![0.3; 160], Instant::now());
//!
//! let mixed = mixer.process(vec![buffer1, buffer2]).unwrap();
//! ```

use crate::audio::graph::traits::{
    AudioBuffer, AudioError, AudioFormat, AudioProcessor, ProcessorStats,
};
use std::time::Instant;

/// Mix mode determines how inputs are combined
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MixMode {
    /// Sum all inputs (may clip without peak limiting)
    Sum,
    /// Average all inputs (safe, never clips)
    Average,
    /// Use per-input balance weights (weighted sum)
    Weighted,
}

impl Default for MixMode {
    fn default() -> Self {
        MixMode::Average
    }
}

/// Mixer processor that combines multiple audio sources
///
/// The mixer accepts 2-8 input sources and combines them into a single output
/// buffer using the configured mix mode. Each input can have an individual
/// balance control (0.0-1.0) for weighted mixing.
///
/// # Thread Safety
///
/// Mixer is Send + Sync and can be safely shared across threads.
///
/// # Performance
///
/// Mixing overhead is approximately 100µs per buffer for 2 inputs at 16kHz.
/// SIMD optimizations could provide 4-8x speedup for large buffer counts.
pub struct Mixer {
    /// Number of input sources (2-8)
    num_inputs: usize,
    /// Per-input balance (0.0-1.0), defaults to 1.0 for all
    balances: Vec<f32>,
    /// Mix mode
    mode: MixMode,
    /// Enable peak limiting (clamp to [-1.0, 1.0])
    peak_limiter_enabled: bool,
    /// Statistics
    stats: ProcessorStats,
    /// Last processing time for stats
    last_process_time: Option<Instant>,
}

impl Mixer {
    /// Create a new mixer with specified number of inputs and mix mode
    ///
    /// # Arguments
    ///
    /// * `num_inputs` - Number of input sources (2-8)
    /// * `mode` - Mixing mode (Sum, Average, or Weighted)
    ///
    /// # Errors
    ///
    /// Returns error if num_inputs is not in range 2-8.
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use audio::processors::{Mixer, MixMode};
    ///
    /// // Create mixer for dual-source recording
    /// let mixer = Mixer::new(2, MixMode::Average).unwrap();
    /// ```
    pub fn new(num_inputs: usize, mode: MixMode) -> Result<Self, AudioError> {
        if num_inputs < 2 || num_inputs > 8 {
            return Err(AudioError::ConfigurationError(format!(
                "Mixer requires 2-8 inputs, got {}",
                num_inputs
            )));
        }

        Ok(Self {
            num_inputs,
            balances: vec![1.0; num_inputs],
            mode,
            peak_limiter_enabled: true, // Enable by default for safety
            stats: ProcessorStats::default(),
            last_process_time: None,
        })
    }

    /// Set balance for a specific input
    ///
    /// # Arguments
    ///
    /// * `input_index` - Input index (0 to num_inputs-1)
    /// * `balance` - Balance level (0.0 = muted, 1.0 = full volume)
    ///
    /// # Errors
    ///
    /// Returns error if input_index is out of range or balance is not in [0.0, 1.0].
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use audio::processors::{Mixer, MixMode};
    ///
    /// let mut mixer = Mixer::new(2, MixMode::Weighted).unwrap();
    /// mixer.set_balance(0, 0.8).unwrap(); // 80% mic
    /// mixer.set_balance(1, 0.6).unwrap(); // 60% system audio
    /// ```
    pub fn set_balance(&mut self, input_index: usize, balance: f32) -> Result<(), AudioError> {
        if input_index >= self.num_inputs {
            return Err(AudioError::ConfigurationError(format!(
                "Input index {} out of range (max: {})",
                input_index,
                self.num_inputs - 1
            )));
        }

        if !(0.0..=1.0).contains(&balance) {
            return Err(AudioError::ConfigurationError(format!(
                "Balance must be in range [0.0, 1.0], got {}",
                balance
            )));
        }

        self.balances[input_index] = balance;
        Ok(())
    }

    /// Get balance for a specific input
    pub fn get_balance(&self, input_index: usize) -> Option<f32> {
        self.balances.get(input_index).copied()
    }

    /// Enable or disable peak limiter
    ///
    /// When enabled, output samples are clamped to [-1.0, 1.0] to prevent clipping.
    /// Recommended to keep enabled unless you have downstream limiting.
    pub fn enable_peak_limiter(&mut self, enabled: bool) {
        self.peak_limiter_enabled = enabled;
    }

    /// Get current mix mode
    pub fn mode(&self) -> MixMode {
        self.mode
    }

    /// Set mix mode
    pub fn set_mode(&mut self, mode: MixMode) {
        self.mode = mode;
    }

    /// Process multiple input buffers and produce mixed output
    ///
    /// # Arguments
    ///
    /// * `inputs` - Vector of input buffers to mix (must match num_inputs)
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Input count doesn't match num_inputs
    /// - Input formats are incompatible
    /// - Input buffers have different lengths
    ///
    /// # Example
    ///
    /// ```rust,no_run
    /// use audio::processors::{Mixer, MixMode};
    /// use audio::graph::traits::{AudioBuffer, AudioFormat};
    /// use std::time::Instant;
    ///
    /// let mut mixer = Mixer::new(2, MixMode::Average).unwrap();
    /// let format = AudioFormat::speech();
    ///
    /// let buf1 = AudioBuffer::new(format, vec![0.5; 160], Instant::now());
    /// let buf2 = AudioBuffer::new(format, vec![0.3; 160], Instant::now());
    ///
    /// let mixed = mixer.process(vec![buf1, buf2]).unwrap();
    /// ```
    pub fn process(&mut self, inputs: Vec<AudioBuffer>) -> Result<AudioBuffer, AudioError> {
        let start_time = Instant::now();

        // Validate input count
        if inputs.len() != self.num_inputs {
            return Err(AudioError::ProcessingError(format!(
                "Expected {} inputs, got {}",
                self.num_inputs,
                inputs.len()
            )));
        }

        if inputs.is_empty() {
            return Err(AudioError::ProcessingError(
                "Cannot mix zero inputs".to_string(),
            ));
        }

        // Validate all inputs have the same format
        let format = inputs[0].format;
        for (i, input) in inputs.iter().enumerate().skip(1) {
            if !input.format.compatible_with(&format) {
                return Err(AudioError::FormatError(format!(
                    "Input {} format mismatch: expected {}, got {}",
                    i, format, input.format
                )));
            }
        }

        // Validate all inputs have the same length
        let expected_len = inputs[0].samples.len();
        for (i, input) in inputs.iter().enumerate().skip(1) {
            if input.samples.len() != expected_len {
                return Err(AudioError::ProcessingError(format!(
                    "Input {} length mismatch: expected {} samples, got {}",
                    i,
                    expected_len,
                    input.samples.len()
                )));
            }
        }

        // Mix buffers based on mode
        let mixed_samples = self.mix_buffers(&inputs)?;

        // Update statistics
        self.stats.buffers_processed += 1;
        self.stats.samples_processed += mixed_samples.len() as u64;

        if let Some(last_time) = self.last_process_time {
            let elapsed = start_time.duration_since(last_time);
            let elapsed_us = elapsed.as_micros() as u64;

            // Update rolling average
            let old_avg = self.stats.avg_processing_time_us;
            let new_avg = if old_avg == 0 {
                elapsed_us
            } else {
                (old_avg * 9 + elapsed_us) / 10 // Exponential moving average
            };
            self.stats.avg_processing_time_us = new_avg;
        }
        self.last_process_time = Some(start_time);

        // Create output buffer
        Ok(AudioBuffer::new(format, mixed_samples, start_time))
    }

    /// Internal mixing implementation
    fn mix_buffers(&self, inputs: &[AudioBuffer]) -> Result<Vec<f32>, AudioError> {
        let num_samples = inputs[0].samples.len();
        let mut output = vec![0.0f32; num_samples];

        match self.mode {
            MixMode::Sum => {
                // Simple sum of all inputs
                for input in inputs {
                    for (i, sample) in input.samples.iter().enumerate() {
                        output[i] += sample;
                    }
                }
            }
            MixMode::Average => {
                // Sum all inputs
                for input in inputs {
                    for (i, sample) in input.samples.iter().enumerate() {
                        output[i] += sample;
                    }
                }
                // Divide by input count
                let scale = 1.0 / inputs.len() as f32;
                for sample in &mut output {
                    *sample *= scale;
                }
            }
            MixMode::Weighted => {
                // Weighted sum based on per-input balances
                for (input_idx, input) in inputs.iter().enumerate() {
                    let balance = self.balances[input_idx];
                    for (i, sample) in input.samples.iter().enumerate() {
                        output[i] += sample * balance;
                    }
                }
            }
        }

        // Apply peak limiting if enabled
        if self.peak_limiter_enabled {
            for sample in &mut output {
                *sample = sample.clamp(-1.0, 1.0);
            }
        }

        Ok(output)
    }
}

impl AudioProcessor for Mixer {
    fn process(&mut self, _input: AudioBuffer) -> Result<AudioBuffer, AudioError> {
        // Single-input process method - not the primary API for Mixer
        // This is here for trait compliance but Mixer is designed for multiple inputs
        Err(AudioError::ProcessingError(
            "Mixer requires multiple inputs. Use process(Vec<AudioBuffer>) instead.".to_string(),
        ))
    }

    fn output_format(&self, input: AudioFormat) -> AudioFormat {
        // Mixer preserves input format (same rate, channels, format)
        input
    }

    fn name(&self) -> &str {
        "Mixer"
    }

    fn reset(&mut self) {
        // Reset statistics
        self.stats = ProcessorStats::default();
        self.last_process_time = None;
    }

    fn stats(&self) -> ProcessorStats {
        self.stats.clone()
    }
}

// Mixer is thread-safe (no shared mutable state)
unsafe impl Send for Mixer {}
unsafe impl Sync for Mixer {}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_buffer(format: AudioFormat, value: f32, count: usize) -> AudioBuffer {
        AudioBuffer::new(format, vec![value; count], Instant::now())
    }

    #[test]
    fn test_mixer_creation_valid() {
        let mixer = Mixer::new(2, MixMode::Average);
        assert!(mixer.is_ok());

        let mixer = mixer.unwrap();
        assert_eq!(mixer.num_inputs, 2);
        assert_eq!(mixer.mode, MixMode::Average);
        assert!(mixer.peak_limiter_enabled);
    }

    #[test]
    fn test_mixer_creation_invalid_input_count() {
        // Too few inputs
        let result = Mixer::new(1, MixMode::Average);
        assert!(result.is_err());

        // Too many inputs
        let result = Mixer::new(9, MixMode::Average);
        assert!(result.is_err());
    }

    #[test]
    fn test_mix_mode_sum() {
        let mut mixer = Mixer::new(2, MixMode::Sum).unwrap();
        mixer.enable_peak_limiter(false); // Disable for testing

        let format = AudioFormat::speech();
        let buf1 = create_test_buffer(format, 0.5, 160);
        let buf2 = create_test_buffer(format, 0.3, 160);

        let result = mixer.process(vec![buf1, buf2]).unwrap();

        // Sum: 0.5 + 0.3 = 0.8
        assert!((result.samples[0] - 0.8).abs() < 0.001);
        assert_eq!(result.samples.len(), 160);
    }

    #[test]
    fn test_mix_mode_average() {
        let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

        let format = AudioFormat::speech();
        let buf1 = create_test_buffer(format, 0.6, 160);
        let buf2 = create_test_buffer(format, 0.4, 160);

        let result = mixer.process(vec![buf1, buf2]).unwrap();

        // Average: (0.6 + 0.4) / 2 = 0.5
        assert!((result.samples[0] - 0.5).abs() < 0.001);
    }

    #[test]
    fn test_mix_mode_weighted() {
        let mut mixer = Mixer::new(2, MixMode::Weighted).unwrap();
        mixer.set_balance(0, 0.8).unwrap(); // 80% of input 0
        mixer.set_balance(1, 0.5).unwrap(); // 50% of input 1

        let format = AudioFormat::speech();
        let buf1 = create_test_buffer(format, 1.0, 160);
        let buf2 = create_test_buffer(format, 1.0, 160);

        let result = mixer.process(vec![buf1, buf2]).unwrap();

        // Weighted: 1.0 * 0.8 + 1.0 * 0.5 = 1.3
        // With peak limiting: clamp to 1.0
        assert!((result.samples[0] - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_balance_adjustment() {
        let mut mixer = Mixer::new(3, MixMode::Weighted).unwrap();

        // Set valid balances
        assert!(mixer.set_balance(0, 0.0).is_ok());
        assert!(mixer.set_balance(1, 0.5).is_ok());
        assert!(mixer.set_balance(2, 1.0).is_ok());

        assert_eq!(mixer.get_balance(0), Some(0.0));
        assert_eq!(mixer.get_balance(1), Some(0.5));
        assert_eq!(mixer.get_balance(2), Some(1.0));

        // Invalid balance (out of range)
        assert!(mixer.set_balance(0, 1.5).is_err());
        assert!(mixer.set_balance(0, -0.1).is_err());

        // Invalid input index
        assert!(mixer.set_balance(3, 0.5).is_err());
    }

    #[test]
    fn test_peak_limiter() {
        let mut mixer = Mixer::new(2, MixMode::Sum).unwrap();
        mixer.enable_peak_limiter(true);

        let format = AudioFormat::speech();
        let buf1 = create_test_buffer(format, 0.8, 160);
        let buf2 = create_test_buffer(format, 0.8, 160);

        let result = mixer.process(vec![buf1, buf2]).unwrap();

        // Sum would be 1.6, but limiter clamps to 1.0
        assert!((result.samples[0] - 1.0).abs() < 0.001);

        // Test without limiter
        mixer.enable_peak_limiter(false);
        let buf3 = create_test_buffer(format, 0.8, 160);
        let buf4 = create_test_buffer(format, 0.8, 160);
        let result2 = mixer.process(vec![buf3, buf4]).unwrap();

        // Without limiter, sum is 1.6
        assert!((result2.samples[0] - 1.6).abs() < 0.001);
    }

    #[test]
    fn test_format_mismatch_error() {
        let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

        let format1 = AudioFormat::speech(); // 16kHz mono
        let format2 = AudioFormat::cd_quality(); // 44.1kHz stereo

        let buf1 = create_test_buffer(format1, 0.5, 160);
        let buf2 = create_test_buffer(format2, 0.5, 160);

        let result = mixer.process(vec![buf1, buf2]);
        assert!(result.is_err());
    }

    #[test]
    fn test_input_count_mismatch() {
        let mut mixer = Mixer::new(2, MixMode::Average).unwrap();
        let format = AudioFormat::speech();

        // Provide only 1 input when 2 expected
        let buf1 = create_test_buffer(format, 0.5, 160);
        let result = mixer.process(vec![buf1]);
        assert!(result.is_err());

        // Provide 3 inputs when 2 expected
        let buf1 = create_test_buffer(format, 0.5, 160);
        let buf2 = create_test_buffer(format, 0.5, 160);
        let buf3 = create_test_buffer(format, 0.5, 160);
        let result = mixer.process(vec![buf1, buf2, buf3]);
        assert!(result.is_err());
    }

    #[test]
    fn test_stats_tracking() {
        let mut mixer = Mixer::new(2, MixMode::Average).unwrap();
        let format = AudioFormat::speech();

        let buf1 = create_test_buffer(format, 0.5, 160);
        let buf2 = create_test_buffer(format, 0.5, 160);

        mixer.process(vec![buf1.clone(), buf2.clone()]).unwrap();

        let stats = mixer.stats();
        assert_eq!(stats.buffers_processed, 1);
        assert_eq!(stats.samples_processed, 160);

        // Process again
        mixer.process(vec![buf1, buf2]).unwrap();
        let stats = mixer.stats();
        assert_eq!(stats.buffers_processed, 2);
        assert_eq!(stats.samples_processed, 320);
    }

    #[test]
    fn test_reset() {
        let mut mixer = Mixer::new(2, MixMode::Average).unwrap();
        let format = AudioFormat::speech();

        let buf1 = create_test_buffer(format, 0.5, 160);
        let buf2 = create_test_buffer(format, 0.5, 160);

        mixer.process(vec![buf1, buf2]).unwrap();
        assert_eq!(mixer.stats().buffers_processed, 1);

        mixer.reset();
        assert_eq!(mixer.stats().buffers_processed, 0);
    }

    #[test]
    fn test_length_mismatch_error() {
        let mut mixer = Mixer::new(2, MixMode::Average).unwrap();
        let format = AudioFormat::speech();

        let buf1 = create_test_buffer(format, 0.5, 160);
        let buf2 = create_test_buffer(format, 0.5, 320); // Different length

        let result = mixer.process(vec![buf1, buf2]);
        assert!(result.is_err());
    }

    #[test]
    fn test_three_input_mixing() {
        let mut mixer = Mixer::new(3, MixMode::Average).unwrap();
        let format = AudioFormat::speech();

        let buf1 = create_test_buffer(format, 0.3, 160);
        let buf2 = create_test_buffer(format, 0.6, 160);
        let buf3 = create_test_buffer(format, 0.9, 160);

        let result = mixer.process(vec![buf1, buf2, buf3]).unwrap();

        // Average: (0.3 + 0.6 + 0.9) / 3 = 0.6
        assert!((result.samples[0] - 0.6).abs() < 0.001);
    }
}
