//! Voice Activity Detection (VAD) processor
//!
//! This module provides a silence detector based on RMS (Root Mean Square) energy
//! analysis. It's useful for:
//! - Reducing storage costs (only record when speech detected)
//! - Reducing AI processing costs (skip silent segments)
//! - Triggering actions based on speech presence
//!
//! # Algorithm
//!
//! The detector calculates the RMS energy of each audio buffer and compares it
//! to a threshold. If the energy is below the threshold for a minimum duration,
//! the audio is considered silent.
//!
//! # Example
//!
//! ```rust,no_run
//! use audio::processors::SilenceDetector;
//! use audio::graph::traits::{AudioProcessor, AudioBuffer, AudioFormat};
//! use std::time::Instant;
//!
//! // Threshold: -40 dB, Min silence duration: 500ms, Sample rate: 16kHz
//! let mut vad = SilenceDetector::new(-40.0, 500.0, 16000);
//!
//! let format = AudioFormat::speech();
//! let samples = vec![0.001; 160]; // Quiet audio
//! let buffer = AudioBuffer::new(format, samples, Instant::now());
//!
//! let output = vad.process(buffer).unwrap();
//!
//! if vad.is_silent() {
//!     println!("Silence detected!");
//! }
//! ```

use crate::audio::graph::traits::{
    AudioBuffer, AudioError, AudioFormat, AudioProcessor, ProcessorStats,
};

/// Voice Activity Detector based on RMS energy analysis
///
/// Detects silence by monitoring the RMS (Root Mean Square) energy level of
/// audio buffers. When the RMS is below a threshold for a minimum duration,
/// the audio is classified as silent.
///
/// # Parameters
///
/// - **threshold_db**: RMS level in dB below which audio is considered silent
/// - **min_silence_duration_ms**: Minimum duration of silence before triggering
/// - **sample_rate**: Sample rate in Hz (used for duration calculations)
///
/// # Thread Safety
///
/// SilenceDetector is Send + Sync as it contains no shared mutable state.
pub struct SilenceDetector {
    /// Silence threshold in dB (e.g., -40.0)
    threshold_db: f32,
    /// Minimum silence duration in milliseconds
    min_silence_duration_ms: f32,
    /// Sample rate in Hz
    sample_rate: u32,

    // State
    /// Number of consecutive silent samples
    silence_sample_count: usize,
    /// Current silence state
    is_silent: bool,

    // Statistics
    /// Number of buffers classified as silent
    silent_buffers: u64,
    /// Number of buffers classified as active (speech)
    active_buffers: u64,
    /// Processor statistics
    stats: ProcessorStats,
}

impl SilenceDetector {
    /// Create a new silence detector
    ///
    /// # Arguments
    ///
    /// * `threshold_db` - RMS threshold in dB (e.g., -40.0 for quiet silence detection)
    /// * `min_silence_duration_ms` - Minimum silence duration in milliseconds (e.g., 500.0)
    /// * `sample_rate` - Sample rate in Hz (e.g., 16000)
    ///
    /// # Threshold Guidelines
    ///
    /// - **-20 dB**: Very quiet speech (aggressive detection, may miss quiet speech)
    /// - **-30 dB**: Typical quiet room noise
    /// - **-40 dB**: Recommended for most cases (balances false positives/negatives)
    /// - **-50 dB**: Very sensitive (may not trigger in noisy environments)
    ///
    /// # Example
    ///
    /// ```rust
    /// use audio::processors::SilenceDetector;
    ///
    /// // Conservative settings: -35 dB threshold, 1 second min duration
    /// let vad = SilenceDetector::new(-35.0, 1000.0, 16000);
    /// ```
    pub fn new(threshold_db: f32, min_silence_duration_ms: f32, sample_rate: u32) -> Self {
        Self {
            threshold_db,
            min_silence_duration_ms,
            sample_rate,
            silence_sample_count: 0,
            is_silent: false,
            silent_buffers: 0,
            active_buffers: 0,
            stats: ProcessorStats::default(),
        }
    }

    /// Check if audio is currently silent
    ///
    /// Returns true if the detector has observed silence for at least
    /// `min_silence_duration_ms` milliseconds.
    pub fn is_silent(&self) -> bool {
        self.is_silent
    }

    /// Get the number of buffers classified as silent
    pub fn silent_buffer_count(&self) -> u64 {
        self.silent_buffers
    }

    /// Get the number of buffers classified as active (speech)
    pub fn active_buffer_count(&self) -> u64 {
        self.active_buffers
    }

    /// Get the silence ratio (0.0 to 1.0)
    ///
    /// Returns the fraction of buffers that were classified as silent.
    /// Useful for analyzing session characteristics.
    pub fn silence_ratio(&self) -> f32 {
        let total = self.silent_buffers + self.active_buffers;
        if total == 0 {
            return 0.0;
        }
        self.silent_buffers as f32 / total as f32
    }

    /// Reset the detector state
    ///
    /// Clears silence detection state but preserves statistics.
    pub fn reset_state(&mut self) {
        self.silence_sample_count = 0;
        self.is_silent = false;
    }

    /// Calculate RMS energy in decibels
    fn calculate_rms_db(&self, samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return f32::NEG_INFINITY;
        }

        // Calculate RMS (Root Mean Square)
        let sum_squares: f32 = samples.iter().map(|s| s * s).sum();
        let rms = (sum_squares / samples.len() as f32).sqrt();

        // Convert to dB (20 * log10(rms))
        if rms <= 0.0 {
            return f32::NEG_INFINITY;
        }

        20.0 * rms.log10()
    }
}

impl AudioProcessor for SilenceDetector {
    fn process(&mut self, input: AudioBuffer) -> Result<AudioBuffer, AudioError> {
        let start = std::time::Instant::now();

        // Calculate RMS energy level
        let rms_db = self.calculate_rms_db(&input.samples);

        // Check if below threshold
        let is_below_threshold = rms_db < self.threshold_db;

        if is_below_threshold {
            // Accumulate silent samples
            self.silence_sample_count += input.samples.len();
        } else {
            // Reset silence counter (speech detected)
            self.silence_sample_count = 0;
        }

        // Calculate minimum silence samples needed
        let min_silence_samples = (self.min_silence_duration_ms
            * self.sample_rate as f32
            / 1000.0) as usize;

        // Update silence state based on accumulated silence
        self.is_silent = self.silence_sample_count >= min_silence_samples;

        // Update buffer classification stats
        if self.is_silent {
            self.silent_buffers += 1;
        } else {
            self.active_buffers += 1;
        }

        // Update statistics
        self.stats.buffers_processed += 1;
        self.stats.samples_processed += input.samples.len() as u64;

        let elapsed = start.elapsed();
        let elapsed_us = elapsed.as_micros() as u64;

        // Update rolling average of processing time
        if self.stats.buffers_processed == 1 {
            self.stats.avg_processing_time_us = elapsed_us;
        } else {
            self.stats.avg_processing_time_us =
                (self.stats.avg_processing_time_us * 9 + elapsed_us) / 10;
        }

        // Pass through buffer unchanged (VAD doesn't modify audio)
        Ok(input.clone_data())
    }

    fn output_format(&self, input: AudioFormat) -> AudioFormat {
        // VAD doesn't modify format
        input
    }

    fn name(&self) -> &str {
        "SilenceDetector"
    }

    fn reset(&mut self) {
        self.reset_state();
    }

    fn stats(&self) -> ProcessorStats {
        self.stats.clone()
    }
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
    fn test_silent_buffer_detection() {
        let mut vad = SilenceDetector::new(-40.0, 100.0, 16000); // 100ms min duration

        // Create very quiet buffer (well below -40 dB)
        let samples = vec![0.0001; 1600]; // 100ms at 16kHz
        let buffer = create_test_buffer(samples);

        vad.process(buffer.clone()).unwrap();

        // After 100ms of silence, should be detected
        assert!(vad.is_silent());
        assert_eq!(vad.silent_buffer_count(), 1);
        assert_eq!(vad.active_buffer_count(), 0);
    }

    #[test]
    fn test_active_buffer_detection() {
        let mut vad = SilenceDetector::new(-40.0, 100.0, 16000);

        // Create loud buffer (well above -40 dB)
        let samples = vec![0.1; 1600]; // 100ms at 16kHz
        let buffer = create_test_buffer(samples);

        vad.process(buffer).unwrap();

        // Should not be silent
        assert!(!vad.is_silent());
        assert_eq!(vad.silent_buffer_count(), 0);
        assert_eq!(vad.active_buffer_count(), 1);
    }

    #[test]
    fn test_min_duration_requirement() {
        let mut vad = SilenceDetector::new(-40.0, 200.0, 16000); // 200ms min duration

        // Send 100ms of silence (below threshold)
        let samples = vec![0.0001; 1600]; // 100ms
        let buffer = create_test_buffer(samples);

        vad.process(buffer.clone()).unwrap();

        // Should NOT be silent yet (need 200ms)
        assert!(!vad.is_silent());

        // Send another 100ms of silence
        vad.process(buffer.clone()).unwrap();

        // Now should be silent (200ms total)
        assert!(vad.is_silent());
    }

    #[test]
    fn test_rms_calculation() {
        let vad = SilenceDetector::new(-40.0, 100.0, 16000);

        // Test known RMS values
        let samples = vec![0.5; 100]; // RMS = 0.5
        let rms_db = vad.calculate_rms_db(&samples);
        assert!((rms_db - (-6.02)).abs() < 0.1); // 0.5 amplitude ≈ -6 dB

        // Test silence
        let samples = vec![0.0; 100];
        let rms_db = vad.calculate_rms_db(&samples);
        assert!(rms_db.is_infinite() && rms_db.is_sign_negative());

        // Test empty buffer
        let samples: Vec<f32> = vec![];
        let rms_db = vad.calculate_rms_db(&samples);
        assert!(rms_db.is_infinite() && rms_db.is_sign_negative());
    }

    #[test]
    fn test_threshold_sensitivity() {
        // Test with lenient threshold (-20 dB)
        let mut vad_lenient = SilenceDetector::new(-20.0, 100.0, 16000);

        // Quiet but not silent (0.01 amplitude ≈ -40 dB)
        let samples = vec![0.01; 1600];
        let buffer = create_test_buffer(samples.clone());

        vad_lenient.process(buffer.clone()).unwrap();
        assert!(vad_lenient.is_silent()); // Should be silent with lenient threshold

        // Test with strict threshold (-50 dB)
        let mut vad_strict = SilenceDetector::new(-50.0, 100.0, 16000);

        vad_strict.process(buffer).unwrap();
        assert!(!vad_strict.is_silent()); // Should NOT be silent with strict threshold
    }

    #[test]
    fn test_false_positive_prevention() {
        let mut vad = SilenceDetector::new(-40.0, 500.0, 16000); // 500ms min duration

        // Brief silence (100ms)
        let quiet = vec![0.0001; 1600]; // 100ms
        vad.process(create_test_buffer(quiet)).unwrap();

        // Speech (100ms)
        let speech = vec![0.1; 1600];
        vad.process(create_test_buffer(speech)).unwrap();

        // Should NOT be silent (speech interrupted silence counter)
        assert!(!vad.is_silent());
    }

    #[test]
    fn test_stats_tracking() {
        let mut vad = SilenceDetector::new(-40.0, 100.0, 16000);

        // Process 3 silent buffers
        let quiet = vec![0.0001; 1600];
        vad.process(create_test_buffer(quiet.clone())).unwrap();
        vad.process(create_test_buffer(quiet.clone())).unwrap();
        vad.process(create_test_buffer(quiet)).unwrap();

        // Process 2 active buffers
        let speech = vec![0.1; 1600];
        vad.process(create_test_buffer(speech.clone())).unwrap();
        vad.process(create_test_buffer(speech)).unwrap();

        assert_eq!(vad.silent_buffer_count(), 3);
        assert_eq!(vad.active_buffer_count(), 2);
        assert!((vad.silence_ratio() - 0.6).abs() < 0.01); // 3/5 = 0.6

        let stats = vad.stats();
        assert_eq!(stats.buffers_processed, 5);
        assert_eq!(stats.samples_processed, 8000); // 5 * 1600
        assert!(stats.avg_processing_time_us > 0);
    }

    #[test]
    fn test_pass_through() {
        let mut vad = SilenceDetector::new(-40.0, 100.0, 16000);

        let samples = vec![0.1, 0.2, 0.3, 0.4];
        let buffer = create_test_buffer(samples.clone());

        let output = vad.process(buffer).unwrap();

        // VAD should not modify samples
        assert_eq!(output.samples.len(), 4);
        for (i, sample) in output.samples.iter().enumerate() {
            assert_eq!(*sample, samples[i]);
        }
    }

    #[test]
    fn test_reset_state() {
        let mut vad = SilenceDetector::new(-40.0, 100.0, 16000);

        // Accumulate silence
        let quiet = vec![0.0001; 1600];
        vad.process(create_test_buffer(quiet)).unwrap();

        assert!(vad.is_silent());

        // Reset state
        vad.reset_state();

        assert!(!vad.is_silent());
        assert_eq!(vad.silence_sample_count, 0);

        // Stats should be preserved
        assert_eq!(vad.silent_buffer_count(), 1);
    }

    #[test]
    fn test_format_preservation() {
        let mut vad = SilenceDetector::new(-40.0, 100.0, 48000);

        let format = AudioFormat::new(48000, 2, crate::audio::graph::traits::SampleFormat::F32);
        assert_eq!(vad.output_format(format), format);
    }

    #[test]
    fn test_silence_to_speech_transition() {
        let mut vad = SilenceDetector::new(-40.0, 200.0, 16000);

        // Start with silence (200ms)
        let quiet = vec![0.0001; 1600];
        vad.process(create_test_buffer(quiet.clone())).unwrap();
        vad.process(create_test_buffer(quiet)).unwrap();

        assert!(vad.is_silent());

        // Introduce speech
        let speech = vec![0.1; 1600];
        vad.process(create_test_buffer(speech)).unwrap();

        // Should immediately transition to non-silent
        assert!(!vad.is_silent());
        assert_eq!(vad.silence_sample_count, 0);
    }
}
