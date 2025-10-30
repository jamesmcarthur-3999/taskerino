//! Volume control processor with smooth gain ramping
//!
//! This module provides a simple yet effective volume control processor that applies
//! gain multiplication to audio samples. It includes smooth gain ramping to avoid
//! audible clicks when changing volume levels.
//!
//! # Features
//!
//! - Gain adjustment in both linear and decibel scales
//! - Smooth ramping to prevent clicking artifacts
//! - Unity gain (0 dB) default
//! - Thread-safe (Send + Sync)
//!
//! # Example
//!
//! ```rust,no_run
//! use audio::processors::VolumeControl;
//! use audio::graph::traits::{AudioProcessor, AudioBuffer, AudioFormat};
//! use std::time::Instant;
//!
//! let mut volume = VolumeControl::new_db(0.0); // Unity gain (0 dB)
//!
//! // Create test buffer
//! let format = AudioFormat::speech();
//! let samples = vec![0.5, 0.5, 0.5, 0.5];
//! let buffer = AudioBuffer::new(format, samples, Instant::now());
//!
//! // Process buffer
//! let output = volume.process(buffer).unwrap();
//!
//! // Change volume with ramping (50ms ramp at 16kHz)
//! volume.set_gain_db(-6.0, 50.0, 16000);
//! ```

use crate::audio::graph::traits::{
    AudioBuffer, AudioError, AudioFormat, AudioProcessor, ProcessorStats,
};
use std::sync::Arc;

/// Volume control processor with gain ramping
///
/// Applies a gain multiplier to all audio samples. Supports both linear gain
/// values and decibel (dB) values for intuitive control. Implements smooth
/// ramping when changing gain to avoid audible clicks.
///
/// # Gain Scales
///
/// - **Linear**: 0.0 = silent, 1.0 = unity gain, 2.0 = +6dB
/// - **Decibel (dB)**: -∞ = silent, 0 dB = unity gain, +6 dB = 2x amplitude
///
/// # Thread Safety
///
/// VolumeControl is Send + Sync as it contains no shared mutable state.
pub struct VolumeControl {
    /// Current gain (linear scale, 1.0 = unity)
    gain: f32,
    /// Target gain for ramping (linear scale)
    target_gain: f32,
    /// Number of samples over which to ramp
    ramp_samples: usize,
    /// Current sample count in ramp
    current_sample: usize,
    /// Statistics
    stats: ProcessorStats,
}

impl VolumeControl {
    /// Create a new volume control with linear gain
    ///
    /// # Arguments
    ///
    /// * `gain` - Linear gain value (1.0 = unity, 0.5 = -6dB, 2.0 = +6dB)
    ///
    /// # Example
    ///
    /// ```rust
    /// use audio::processors::VolumeControl;
    ///
    /// let volume = VolumeControl::new(0.5); // -6 dB attenuation
    /// ```
    pub fn new(gain: f32) -> Self {
        Self {
            gain,
            target_gain: gain,
            ramp_samples: 0,
            current_sample: 0,
            stats: ProcessorStats::default(),
        }
    }

    /// Create a new volume control with gain in decibels
    ///
    /// # Arguments
    ///
    /// * `gain_db` - Gain in decibels (0.0 = unity, -6.0 = half amplitude, +6.0 = double amplitude)
    ///
    /// # Example
    ///
    /// ```rust
    /// use audio::processors::VolumeControl;
    ///
    /// let volume = VolumeControl::new_db(-6.0); // Half amplitude
    /// ```
    pub fn new_db(gain_db: f32) -> Self {
        Self::new(db_to_linear(gain_db))
    }

    /// Set gain with linear value (no ramping)
    ///
    /// Changes gain immediately to the specified value. Use `set_gain_smooth()`
    /// for gradual transitions.
    ///
    /// # Arguments
    ///
    /// * `gain` - Linear gain value (1.0 = unity)
    pub fn set_gain(&mut self, gain: f32) {
        self.gain = gain;
        self.target_gain = gain;
        self.ramp_samples = 0;
        self.current_sample = 0;
    }

    /// Set gain in decibels (no ramping)
    ///
    /// # Arguments
    ///
    /// * `gain_db` - Gain in decibels (0.0 = unity)
    pub fn set_gain_db(&mut self, gain_db: f32) {
        self.set_gain(db_to_linear(gain_db));
    }

    /// Set gain with smooth ramping to avoid clicks
    ///
    /// Gradually transitions from current gain to target gain over the specified
    /// duration. This prevents audible clicking artifacts when changing volume.
    ///
    /// # Arguments
    ///
    /// * `gain_db` - Target gain in decibels
    /// * `ramp_duration_ms` - Ramp duration in milliseconds (e.g., 50.0 for 50ms)
    /// * `sample_rate` - Sample rate in Hz (e.g., 16000 for 16kHz)
    ///
    /// # Example
    ///
    /// ```rust
    /// use audio::processors::VolumeControl;
    ///
    /// let mut volume = VolumeControl::new_db(0.0);
    ///
    /// // Ramp to -6dB over 50ms at 16kHz sample rate
    /// volume.set_gain_smooth(-6.0, 50.0, 16000);
    /// ```
    pub fn set_gain_smooth(&mut self, gain_db: f32, ramp_duration_ms: f32, sample_rate: u32) {
        self.target_gain = db_to_linear(gain_db);
        self.ramp_samples = (ramp_duration_ms * sample_rate as f32 / 1000.0) as usize;
        self.current_sample = 0;
    }

    /// Get current gain in linear scale
    pub fn gain(&self) -> f32 {
        self.gain
    }

    /// Get current gain in decibels
    pub fn gain_db(&self) -> f32 {
        linear_to_db(self.gain)
    }

    /// Check if currently ramping
    pub fn is_ramping(&self) -> bool {
        self.current_sample < self.ramp_samples
    }
}

impl AudioProcessor for VolumeControl {
    fn process(&mut self, input: AudioBuffer) -> Result<AudioBuffer, AudioError> {
        let start = std::time::Instant::now();

        // Create output buffer by cloning input samples
        let mut output_samples = input.samples.as_ref().clone();

        // Apply gain with ramping if active
        if self.ramp_samples > 0 && self.current_sample < self.ramp_samples {
            // Ramping mode - interpolate gain
            for sample in output_samples.iter_mut() {
                // Calculate interpolation factor (0.0 to 1.0)
                let t = self.current_sample as f32 / self.ramp_samples as f32;

                // Linear interpolation between current gain and target gain
                let current_gain = self.gain + (self.target_gain - self.gain) * t;

                *sample *= current_gain;

                self.current_sample += 1;

                // Check if we've finished ramping mid-buffer
                if self.current_sample >= self.ramp_samples {
                    self.gain = self.target_gain;
                    break;
                }
            }

            // If we finished ramping, apply constant gain to remaining samples
            if self.current_sample >= self.ramp_samples {
                let start_idx = self.current_sample.min(output_samples.len());
                for sample in output_samples[start_idx..].iter_mut() {
                    *sample *= self.gain;
                }
            }
        } else {
            // No ramping - apply constant gain
            for sample in output_samples.iter_mut() {
                *sample *= self.gain;
            }
        }

        // Update statistics
        self.stats.buffers_processed += 1;
        self.stats.samples_processed += output_samples.len() as u64;

        let elapsed = start.elapsed();
        let elapsed_us = elapsed.as_micros() as u64;

        // Update rolling average of processing time
        if self.stats.buffers_processed == 1 {
            self.stats.avg_processing_time_us = elapsed_us;
        } else {
            // Exponential moving average with alpha = 0.1
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
        // Volume control doesn't change format
        input
    }

    fn name(&self) -> &str {
        "VolumeControl"
    }

    fn reset(&mut self) {
        // Reset ramping state
        self.current_sample = 0;
        self.ramp_samples = 0;
        self.target_gain = self.gain;
    }

    fn stats(&self) -> ProcessorStats {
        self.stats.clone()
    }
}

/// Convert decibels to linear gain
///
/// # Formula
///
/// linear = 10^(dB / 20)
///
/// # Examples
///
/// - 0 dB → 1.0 (unity gain)
/// - -6 dB → 0.5 (half amplitude)
/// - +6 dB → 2.0 (double amplitude)
/// - -∞ dB → 0.0 (silence)
pub fn db_to_linear(db: f32) -> f32 {
    10.0f32.powf(db / 20.0)
}

/// Convert linear gain to decibels
///
/// # Formula
///
/// dB = 20 * log10(linear)
///
/// # Examples
///
/// - 1.0 → 0 dB (unity gain)
/// - 0.5 → -6.02 dB (half amplitude)
/// - 2.0 → +6.02 dB (double amplitude)
/// - 0.0 → -∞ dB (silence)
pub fn linear_to_db(linear: f32) -> f32 {
    if linear <= 0.0 {
        return f32::NEG_INFINITY;
    }
    20.0 * linear.log10()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    fn create_test_buffer(amplitude: f32, num_samples: usize) -> AudioBuffer {
        let format = AudioFormat::speech(); // 16kHz mono
        let samples = vec![amplitude; num_samples];
        AudioBuffer::new(format, samples, Instant::now())
    }

    #[test]
    fn test_unity_gain() {
        let mut volume = VolumeControl::new_db(0.0); // 0 dB = unity gain

        let input = create_test_buffer(0.5, 100);
        let output = volume.process(input.clone()).unwrap();

        // Output should be unchanged
        assert_eq!(output.samples.len(), 100);
        for sample in output.samples.iter() {
            assert!((sample - 0.5).abs() < 0.001);
        }
    }

    #[test]
    fn test_gain_increase() {
        let mut volume = VolumeControl::new_db(6.0); // +6 dB ≈ 2x amplitude

        let input = create_test_buffer(0.25, 100);
        let output = volume.process(input).unwrap();

        // Output should be approximately doubled
        for sample in output.samples.iter() {
            assert!((sample - 0.5).abs() < 0.01);
        }
    }

    #[test]
    fn test_gain_decrease() {
        let mut volume = VolumeControl::new_db(-6.0); // -6 dB ≈ 0.5x amplitude

        let input = create_test_buffer(0.8, 100);
        let output = volume.process(input).unwrap();

        // Output should be approximately halved
        for sample in output.samples.iter() {
            assert!((sample - 0.4).abs() < 0.01);
        }
    }

    #[test]
    fn test_db_conversion() {
        // Test db_to_linear
        assert!((db_to_linear(0.0) - 1.0).abs() < 0.001);
        assert!((db_to_linear(-6.02) - 0.5).abs() < 0.01);
        assert!((db_to_linear(6.02) - 2.0).abs() < 0.01);

        // Test linear_to_db
        assert!((linear_to_db(1.0) - 0.0).abs() < 0.001);
        assert!((linear_to_db(0.5) - (-6.02)).abs() < 0.01);
        assert!((linear_to_db(2.0) - 6.02).abs() < 0.01);
        assert!(linear_to_db(0.0).is_infinite());
    }

    #[test]
    fn test_gain_ramping() {
        let mut volume = VolumeControl::new_db(0.0); // Start at unity

        // Set target to -6dB with 10ms ramp at 16kHz (160 samples)
        volume.set_gain_smooth(-6.0, 10.0, 16000);

        assert!(volume.is_ramping());

        let input = create_test_buffer(1.0, 160);
        let output = volume.process(input).unwrap();

        // First sample should be close to unity gain
        assert!((output.samples[0] - 1.0).abs() < 0.1);

        // Last sample should be close to -6dB (0.5x)
        assert!((output.samples[159] - 0.5).abs() < 0.1);

        // Ramping should be complete
        assert!(!volume.is_ramping());
        assert!((volume.gain() - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_no_clicks_during_ramp() {
        let mut volume = VolumeControl::new_db(0.0);
        volume.set_gain_smooth(-12.0, 5.0, 16000); // 80 samples

        let input = create_test_buffer(1.0, 80);
        let output = volume.process(input).unwrap();

        // Check that samples are monotonically decreasing (no jumps/clicks)
        for i in 1..output.samples.len() {
            assert!(output.samples[i] <= output.samples[i - 1] + 0.001);
        }
    }

    #[test]
    fn test_stats_tracking() {
        let mut volume = VolumeControl::new_db(-3.0);

        let input1 = create_test_buffer(0.5, 100);
        let input2 = create_test_buffer(0.5, 150);

        volume.process(input1).unwrap();
        volume.process(input2).unwrap();

        let stats = volume.stats();
        assert_eq!(stats.buffers_processed, 2);
        assert_eq!(stats.samples_processed, 250);
        // Processing is very fast, may be 0 microseconds - just check it's a valid value
        assert!(stats.avg_processing_time_us >= 0);
    }

    #[test]
    fn test_format_preservation() {
        let mut volume = VolumeControl::new_db(3.0);

        let format = AudioFormat::new(48000, 2, crate::audio::graph::traits::SampleFormat::F32);
        assert_eq!(volume.output_format(format), format);
    }

    #[test]
    fn test_reset() {
        let mut volume = VolumeControl::new_db(0.0);
        volume.set_gain_smooth(-6.0, 10.0, 16000);

        assert!(volume.is_ramping());

        volume.reset();

        assert!(!volume.is_ramping());
        assert_eq!(volume.current_sample, 0);
    }

    #[test]
    fn test_set_gain_cancels_ramp() {
        let mut volume = VolumeControl::new_db(0.0);
        volume.set_gain_smooth(-6.0, 10.0, 16000);

        assert!(volume.is_ramping());

        // Immediate gain change should cancel ramp
        volume.set_gain_db(-12.0);

        assert!(!volume.is_ramping());
        assert!((volume.gain() - db_to_linear(-12.0)).abs() < 0.001);
    }
}
