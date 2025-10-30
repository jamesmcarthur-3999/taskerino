//! Simple test to create a WAV file for manual verification
//!
//! Run with: cargo test --test create_test_wav -- --nocapture

use std::time::Instant;
use app_lib::audio::graph::traits::{AudioBuffer, AudioFormat, AudioSink, SampleFormat};
use app_lib::audio::sinks::WavEncoderSink;

/// Create a test WAV file with a 440Hz sine wave (A4 note)
#[test]
fn create_playable_test_wav() {
    let output_path = "/tmp/taskerino_test_output.wav";
    let format = AudioFormat::new(48000, 2, SampleFormat::F32); // 48kHz stereo
    let mut sink = WavEncoderSink::new(output_path, format).unwrap();

    let sample_rate = 48000.0;
    let frequency = 440.0; // A4 note
    let duration_secs = 3.0; // 3 seconds
    let buffer_duration_ms = 10; // 10ms buffers

    let samples_per_buffer = (sample_rate * (buffer_duration_ms as f32 / 1000.0)) as usize;
    let num_buffers = (duration_secs * 1000.0 / buffer_duration_ms as f32) as usize;

    println!("Creating WAV file at: {}", output_path);
    println!("Format: {} Hz, {} channels", format.sample_rate, format.channels);
    println!("Duration: {} seconds", duration_secs);
    println!("Frequency: {} Hz (A4 note)", frequency);

    let mut sample_index = 0;
    for buffer_num in 0..num_buffers {
        let mut samples = Vec::with_capacity(samples_per_buffer * format.channels as usize);

        for _ in 0..samples_per_buffer {
            let t = sample_index as f32 / sample_rate;
            let sample = (2.0 * std::f32::consts::PI * frequency * t).sin() * 0.5; // 50% amplitude

            // Duplicate for stereo
            for _ in 0..format.channels {
                samples.push(sample);
            }

            sample_index += 1;
        }

        let buffer = AudioBuffer::new(format, samples, Instant::now());
        sink.write(buffer).unwrap();

        if buffer_num % 100 == 0 {
            println!("Progress: {}/{} buffers written", buffer_num, num_buffers);
        }
    }

    sink.close().unwrap();

    println!("\n✓ WAV file created successfully!");
    println!("File location: {}", output_path);
    println!("Samples written: {}", sink.samples_written());
    println!("File size: {} bytes", sink.bytes_written());
    println!("\nYou can play this file with:");
    println!("  - macOS: afplay {}", output_path);
    println!("  - macOS: open {}", output_path);
    println!("  - ffplay: ffplay {}", output_path);
}
