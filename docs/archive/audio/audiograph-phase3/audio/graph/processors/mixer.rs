//! Mixer - AudioProcessor that mixes multiple audio inputs
//!
//! Note: Due to the single-input constraint of the AudioProcessor trait,
//! this Mixer accumulates inputs through multiple process() calls and
//! produces a mixed output. For graph usage, connect multiple sources
//! and call process() for each input in sequence.

use crate::audio::graph::traits::{AudioBuffer, AudioError, AudioFormat, AudioProcessor, ProcessorStats};
use std::time::Instant;

/// Mixer modes for handling multiple inputs
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MixMode {
    /// Mix all inputs with equal gain
    Equal,
    /// Mix with custom per-input gains
    Custom,
    /// Two-input balance mode (0.0 = 100% input 0, 1.0 = 100% input 1)
    Balance(f32),
}

/// Mixes multiple audio inputs into a single output
/// Supports configurable gain per input and master gain
pub struct Mixer {
    num_inputs: usize,
    input_gains: Vec<f32>,
    master_gain: f32,
    mix_buffer: Vec<f32>,
    inputs_received: Vec<Option<AudioBuffer>>,
    expected_format: Option<AudioFormat>,
    buffers_processed: u64,
    samples_processed: u64,
}

impl Mixer {
    /// Create mixer for N inputs with equal balance
    pub fn new(num_inputs: usize) -> Result<Self, AudioError> {
        if num_inputs == 0 {
            return Err(AudioError::ConfigurationError(
                "Mixer must have at least 1 input".to_string()
            ));
        }

        // Initialize equal gains (1.0 / num_inputs for each)
        let equal_gain = 1.0 / num_inputs as f32;
        let input_gains = vec![equal_gain; num_inputs];

        Ok(Self {
            num_inputs,
            input_gains,
            master_gain: 1.0,
            mix_buffer: Vec::new(),
            inputs_received: vec![None; num_inputs],
            expected_format: None,
            buffers_processed: 0,
            samples_processed: 0,
        })
    }

    /// Set balance between two inputs (0.0 = 100% input0, 1.0 = 100% input1)
    /// For backwards compatibility with current audio_capture.rs
    pub fn set_balance(&mut self, balance: f32) -> Result<(), AudioError> {
        if self.num_inputs != 2 {
            return Err(AudioError::ConfigurationError(
                format!("set_balance only works with 2 inputs, got {}", self.num_inputs)
            ));
        }

        let balance = balance.clamp(0.0, 1.0);

        // balance 0.0 = [1.0, 0.0]
        // balance 0.5 = [0.5, 0.5]
        // balance 1.0 = [0.0, 1.0]
        self.input_gains[0] = 1.0 - balance;
        self.input_gains[1] = balance;

        Ok(())
    }

    /// Set individual input gain
    pub fn set_input_gain(&mut self, input_index: usize, gain: f32) -> Result<(), AudioError> {
        if input_index >= self.num_inputs {
            return Err(AudioError::ConfigurationError(
                format!("Input index {} out of range (max {})", input_index, self.num_inputs - 1)
            ));
        }

        if !(0.0..=1.0).contains(&gain) {
            return Err(AudioError::ConfigurationError(
                format!("Gain {} must be in range [0.0, 1.0]", gain)
            ));
        }

        self.input_gains[input_index] = gain;
        Ok(())
    }

    /// Set master output gain
    pub fn set_master_gain(&mut self, gain: f32) -> Result<(), AudioError> {
        if !(0.0..=1.0).contains(&gain) {
            return Err(AudioError::ConfigurationError(
                format!("Master gain {} must be in range [0.0, 1.0]", gain)
            ));
        }

        self.master_gain = gain;
        Ok(())
    }

    /// Add an input buffer to the mix (call num_inputs times before getting output)
    pub fn add_input(&mut self, input: AudioBuffer, input_index: usize) -> Result<(), AudioError> {
        if input_index >= self.num_inputs {
            return Err(AudioError::ConfigurationError(
                format!("Input index {} out of range", input_index)
            ));
        }

        // Validate format matches other inputs
        if let Some(expected) = &self.expected_format {
            if input.format.sample_rate != expected.sample_rate
                || input.format.channels != expected.channels {
                return Err(AudioError::FormatError(
                    format!("Input format mismatch: expected {}, got {}", expected, input.format)
                ));
            }
        } else {
            self.expected_format = Some(input.format);
        }

        self.inputs_received[input_index] = Some(input);
        Ok(())
    }

    /// Mix all received inputs and produce output
    pub fn mix(&mut self) -> Result<AudioBuffer, AudioError> {
        // Check that we have at least one input
        let active_inputs: Vec<_> = self.inputs_received.iter()
            .filter_map(|opt| opt.as_ref())
            .collect();

        if active_inputs.is_empty() {
            return Err(AudioError::ProcessingError(
                "No inputs available to mix".to_string()
            ));
        }

        // Get output format from first input
        let output_format = active_inputs[0].format;

        // Find minimum buffer length across all inputs
        let min_length = active_inputs.iter()
            .map(|buf| buf.samples.len())
            .min()
            .unwrap_or(0);

        // Initialize mix buffer
        self.mix_buffer.clear();
        self.mix_buffer.resize(min_length, 0.0);

        // Mix samples: output[i] = sum(input[j][i] * gain[j]) * master_gain
        for (input_idx, input_opt) in self.inputs_received.iter().enumerate() {
            if let Some(input) = input_opt {
                let gain = self.input_gains[input_idx];
                for (i, sample) in input.samples.iter().take(min_length).enumerate() {
                    self.mix_buffer[i] += sample * gain;
                }
            }
        }

        // Apply master gain and clip to [-1.0, 1.0]
        for sample in &mut self.mix_buffer {
            *sample = (*sample * self.master_gain).clamp(-1.0, 1.0);
        }

        // Update statistics
        self.buffers_processed += 1;
        self.samples_processed += min_length as u64;

        // Clear inputs for next mix
        self.inputs_received = vec![None; self.num_inputs];
        self.expected_format = None;

        // Create output buffer
        Ok(AudioBuffer::new(
            output_format,
            self.mix_buffer.clone(),
            Instant::now(),
        ))
    }

    /// Reset the mixer state
    pub fn reset(&mut self) {
        self.inputs_received = vec![None; self.num_inputs];
        self.expected_format = None;
        self.mix_buffer.clear();
    }
}

impl AudioProcessor for Mixer {
    fn process(&mut self, input: AudioBuffer) -> Result<AudioBuffer, AudioError> {
        // For single-input processing, just apply master gain
        // This allows the Mixer to work in single-input processor chains
        let output_samples: Vec<f32> = input.samples.iter()
            .map(|s| (*s * self.master_gain).clamp(-1.0, 1.0))
            .collect();

        self.buffers_processed += 1;
        self.samples_processed += output_samples.len() as u64;

        Ok(AudioBuffer::new(
            input.format,
            output_samples,
            input.timestamp,
        ))
    }

    fn output_format(&self, input_format: AudioFormat) -> AudioFormat {
        // Output format == input format (no conversion)
        input_format
    }

    fn name(&self) -> &str {
        "Mixer"
    }

    fn reset(&mut self) {
        self.reset();
    }

    fn stats(&self) -> ProcessorStats {
        ProcessorStats {
            buffers_processed: self.buffers_processed,
            samples_processed: self.samples_processed,
            avg_processing_time_us: 0, // Not tracking timing
            errors: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::graph::traits::SampleFormat;

    #[test]
    fn test_mixer_creation() {
        let mixer = Mixer::new(2).unwrap();
        assert_eq!(mixer.num_inputs, 2);
        assert_eq!(mixer.input_gains.len(), 2);
        assert_eq!(mixer.input_gains[0], 0.5);
        assert_eq!(mixer.input_gains[1], 0.5);
        assert_eq!(mixer.master_gain, 1.0);
    }

    #[test]
    fn test_mixer_zero_inputs() {
        let result = Mixer::new(0);
        assert!(result.is_err());
    }

    #[test]
    fn test_mixer_two_inputs_equal_balance() {
        let mut mixer = Mixer::new(2).unwrap();

        let format = AudioFormat::new(16000, 1, SampleFormat::F32);

        // Create two inputs with different values
        let input1 = AudioBuffer::new(format, vec![1.0, 1.0, 1.0, 1.0], Instant::now());
        let input2 = AudioBuffer::new(format, vec![0.0, 0.0, 0.0, 0.0], Instant::now());

        // Add both inputs
        mixer.add_input(input1, 0).unwrap();
        mixer.add_input(input2, 1).unwrap();

        // Mix
        let output = mixer.mix().unwrap();

        // With equal balance (0.5 each), output should be 0.5 * 1.0 + 0.5 * 0.0 = 0.5
        assert_eq!(output.samples.len(), 4);
        for sample in output.samples.iter() {
            assert!((sample - 0.5).abs() < 0.001);
        }
    }

    #[test]
    fn test_mixer_two_inputs_left_only() {
        let mut mixer = Mixer::new(2).unwrap();
        mixer.set_balance(0.0).unwrap(); // 100% left

        let format = AudioFormat::new(16000, 1, SampleFormat::F32);

        let input1 = AudioBuffer::new(format, vec![1.0, 1.0], Instant::now());
        let input2 = AudioBuffer::new(format, vec![0.5, 0.5], Instant::now());

        mixer.add_input(input1, 0).unwrap();
        mixer.add_input(input2, 1).unwrap();

        let output = mixer.mix().unwrap();

        // Balance 0.0 means only input 0 (gain 1.0 for input 0, gain 0.0 for input 1)
        for sample in output.samples.iter() {
            assert!((sample - 1.0).abs() < 0.001);
        }
    }

    #[test]
    fn test_mixer_set_input_gain() {
        let mut mixer = Mixer::new(2).unwrap();
        mixer.set_input_gain(0, 0.5).unwrap();
        mixer.set_input_gain(1, 0.3).unwrap();

        assert_eq!(mixer.input_gains[0], 0.5);
        assert_eq!(mixer.input_gains[1], 0.3);
    }

    #[test]
    fn test_mixer_invalid_input_gain() {
        let mut mixer = Mixer::new(2).unwrap();

        // Index out of range
        assert!(mixer.set_input_gain(5, 0.5).is_err());

        // Gain out of range
        assert!(mixer.set_input_gain(0, 1.5).is_err());
        assert!(mixer.set_input_gain(0, -0.1).is_err());
    }

    #[test]
    fn test_mixer_master_gain() {
        let mut mixer = Mixer::new(2).unwrap();
        mixer.set_master_gain(0.5).unwrap();

        let format = AudioFormat::new(16000, 1, SampleFormat::F32);

        let input1 = AudioBuffer::new(format, vec![1.0, 1.0], Instant::now());
        let input2 = AudioBuffer::new(format, vec![1.0, 1.0], Instant::now());

        mixer.add_input(input1, 0).unwrap();
        mixer.add_input(input2, 1).unwrap();

        let output = mixer.mix().unwrap();

        // Each input contributes 0.5 (equal balance), master gain is 0.5
        // Result: (0.5 + 0.5) * 0.5 = 0.5
        for sample in output.samples.iter() {
            assert!((sample - 0.5).abs() < 0.001);
        }
    }

    #[test]
    fn test_mixer_clipping() {
        let mut mixer = Mixer::new(2).unwrap();

        let format = AudioFormat::new(16000, 1, SampleFormat::F32);

        // Two full-scale inputs
        let input1 = AudioBuffer::new(format, vec![1.0, 1.0], Instant::now());
        let input2 = AudioBuffer::new(format, vec![1.0, 1.0], Instant::now());

        mixer.add_input(input1, 0).unwrap();
        mixer.add_input(input2, 1).unwrap();

        let output = mixer.mix().unwrap();

        // Each input contributes 0.5, total would be 1.0
        // But with clipping, should not exceed 1.0
        for sample in output.samples.iter() {
            assert!(*sample <= 1.0);
            assert!(*sample >= -1.0);
        }
    }

    #[test]
    fn test_mixer_different_lengths() {
        let mut mixer = Mixer::new(2).unwrap();

        let format = AudioFormat::new(16000, 1, SampleFormat::F32);

        // Different length inputs
        let input1 = AudioBuffer::new(format, vec![1.0; 100], Instant::now());
        let input2 = AudioBuffer::new(format, vec![1.0; 50], Instant::now());

        mixer.add_input(input1, 0).unwrap();
        mixer.add_input(input2, 1).unwrap();

        let output = mixer.mix().unwrap();

        // Should use minimum length (50)
        assert_eq!(output.samples.len(), 50);
    }

    #[test]
    fn test_mixer_format_validation() {
        let mut mixer = Mixer::new(2).unwrap();

        let format1 = AudioFormat::new(16000, 1, SampleFormat::F32);
        let format2 = AudioFormat::new(48000, 1, SampleFormat::F32); // Different sample rate

        let input1 = AudioBuffer::new(format1, vec![1.0], Instant::now());
        let input2 = AudioBuffer::new(format2, vec![1.0], Instant::now());

        mixer.add_input(input1, 0).unwrap();

        // Mismatched format should error
        let result = mixer.add_input(input2, 1);
        assert!(result.is_err());
    }

    #[test]
    fn test_mixer_single_input_processor() {
        let mut mixer = Mixer::new(2).unwrap();
        mixer.set_master_gain(0.5).unwrap();

        let format = AudioFormat::new(16000, 1, SampleFormat::F32);
        let input = AudioBuffer::new(format, vec![1.0, 1.0], Instant::now());

        // Use as single-input processor
        let output = mixer.process(input).unwrap();

        // Should apply master gain
        for sample in output.samples.iter() {
            assert!((sample - 0.5).abs() < 0.001);
        }
    }

    #[test]
    fn test_mixer_balance_validation() {
        let mut mixer = Mixer::new(2).unwrap();

        // Valid balance
        assert!(mixer.set_balance(0.0).is_ok());
        assert!(mixer.set_balance(0.5).is_ok());
        assert!(mixer.set_balance(1.0).is_ok());

        // Test with 3 inputs - should fail
        let mut mixer3 = Mixer::new(3).unwrap();
        assert!(mixer3.set_balance(0.5).is_err());
    }
}
