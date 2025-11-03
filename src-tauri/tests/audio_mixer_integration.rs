//! Integration tests for Mixer processor
//!
//! These tests verify that the Mixer processor correctly integrates with
//! audio sources and sinks to create a complete dual-source recording pipeline.

use app_lib::audio::graph::traits::{AudioBuffer, AudioFormat, AudioProcessor, AudioSink, AudioSource};
use app_lib::audio::processors::{Mixer, MixMode};
use app_lib::audio::sinks::WavEncoderSink;
use app_lib::audio::sources::{MicrophoneSource, SilenceSource};
use std::fs;
use std::thread;
use std::time::Duration;

#[cfg(target_os = "macos")]
use app_lib::audio::sources::SystemAudioSource;

/// Test dual-source mixing with SilenceSource (deterministic)
#[test]
fn test_dual_source_mixer_pipeline_silence() {
    let format = AudioFormat::speech(); // 16kHz mono

    // Create two silence sources with different "volumes"
    let mut source1 = SilenceSource::new(format, 10); // 10ms buffer duration
    let mut source2 = SilenceSource::new(format, 10);

    // Create mixer with average mode
    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    // Create WAV sink
    let output_path = "/tmp/mixer_test_dual_silence.wav";
    let mut sink = WavEncoderSink::new(output_path, format).unwrap();

    // Start sources
    source1.start().unwrap();
    source2.start().unwrap();

    // Process 100 buffers (1 second of audio)
    let mut buffers_processed = 0;
    for _ in 0..100 {
        // Read from both sources
        let buf1 = source1.read().unwrap();
        let buf2 = source2.read().unwrap();

        if let (Some(b1), Some(b2)) = (buf1, buf2) {
            // Mix buffers
            let mixed = mixer.process(vec![b1, b2]).unwrap();

            // Write to sink
            sink.write(mixed).unwrap();
            buffers_processed += 1;
        }

        thread::sleep(Duration::from_millis(5));
    }

    // Stop sources
    source1.stop().unwrap();
    source2.stop().unwrap();

    // Finalize WAV file
    sink.close().unwrap();

    // Verify file exists and has content
    let metadata = fs::metadata(output_path).unwrap();
    assert!(metadata.len() > 1000); // WAV header + data

    // Verify stats
    let stats = mixer.stats();
    assert!(stats.buffers_processed > 0);
    assert_eq!(stats.buffers_processed, buffers_processed);

    // Cleanup
    fs::remove_file(output_path).ok();
}

/// Test mixer with weighted mode
#[test]
fn test_mixer_weighted_mode_integration() {
    let format = AudioFormat::speech();

    // Create sources
    let mut source1 = SilenceSource::new(format, 10);
    let mut source2 = SilenceSource::new(format, 10);

    // Create mixer with weighted mode: 80% source1, 20% source2
    let mut mixer = Mixer::new(2, MixMode::Weighted).unwrap();
    mixer.set_balance(0, 0.8).unwrap();
    mixer.set_balance(1, 0.2).unwrap();

    // Create WAV sink
    let output_path = "/tmp/mixer_test_weighted.wav";
    let mut sink = WavEncoderSink::new(output_path, format).unwrap();

    // Start sources
    source1.start().unwrap();
    source2.start().unwrap();

    // Process 50 buffers
    for _ in 0..50 {
        if let (Some(b1), Some(b2)) = (source1.read().unwrap(), source2.read().unwrap()) {
            let mixed = mixer.process(vec![b1, b2]).unwrap();
            sink.write(mixed).unwrap();
        }
        thread::sleep(Duration::from_millis(5));
    }

    // Stop sources
    source1.stop().unwrap();
    source2.stop().unwrap();
    sink.close().unwrap();

    // Verify file exists
    assert!(fs::metadata(output_path).unwrap().len() > 500);

    // Cleanup
    fs::remove_file(output_path).ok();
}

/// Test mixer with sum mode (no peak limiting)
#[test]
fn test_mixer_sum_mode_integration() {
    let format = AudioFormat::speech();

    let mut source1 = SilenceSource::new(format, 10);
    let mut source2 = SilenceSource::new(format, 10);

    let mut mixer = Mixer::new(2, MixMode::Sum).unwrap();
    mixer.enable_peak_limiter(false); // Disable limiting for testing

    let output_path = "/tmp/mixer_test_sum.wav";
    let mut sink = WavEncoderSink::new(output_path, format).unwrap();

    source1.start().unwrap();
    source2.start().unwrap();

    for _ in 0..50 {
        if let (Some(b1), Some(b2)) = (source1.read().unwrap(), source2.read().unwrap()) {
            let mixed = mixer.process(vec![b1, b2]).unwrap();
            sink.write(mixed).unwrap();
        }
        thread::sleep(Duration::from_millis(5));
    }

    source1.stop().unwrap();
    source2.stop().unwrap();
    sink.close().unwrap();

    assert!(fs::metadata(output_path).unwrap().len() > 500);
    fs::remove_file(output_path).ok();
}

/// Test three-source mixing
#[test]
fn test_three_source_mixing() {
    let format = AudioFormat::speech();

    let mut source1 = SilenceSource::new(format, 10);
    let mut source2 = SilenceSource::new(format, 10);
    let mut source3 = SilenceSource::new(format, 10);

    let mut mixer = Mixer::new(3, MixMode::Average).unwrap();

    let output_path = "/tmp/mixer_test_three_sources.wav";
    let mut sink = WavEncoderSink::new(output_path, format).unwrap();

    source1.start().unwrap();
    source2.start().unwrap();
    source3.start().unwrap();

    for _ in 0..50 {
        if let (Some(b1), Some(b2), Some(b3)) = (
            source1.read().unwrap(),
            source2.read().unwrap(),
            source3.read().unwrap(),
        ) {
            let mixed = mixer.process(vec![b1, b2, b3]).unwrap();
            sink.write(mixed).unwrap();
        }
        thread::sleep(Duration::from_millis(5));
    }

    source1.stop().unwrap();
    source2.stop().unwrap();
    source3.stop().unwrap();
    sink.close().unwrap();

    assert!(fs::metadata(output_path).unwrap().len() > 500);
    fs::remove_file(output_path).ok();
}

/// Test mixer with microphone source (real hardware)
#[test]
#[ignore] // Requires hardware, run with --ignored
fn test_mixer_with_microphone() {
    let format = AudioFormat::speech();

    // Try to create microphone source
    let mut mic_source = match MicrophoneSource::new(None) {
        Ok(s) => s,
        Err(_) => {
            println!("No microphone available, skipping test");
            return;
        }
    };

    // Create silence source as second input
    let mut silence_source = SilenceSource::new(format, 10);

    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    let output_path = "/tmp/mixer_test_microphone.wav";
    let mut sink = WavEncoderSink::new(output_path, format).unwrap();

    mic_source.start().unwrap();
    silence_source.start().unwrap();

    // Record for 2 seconds
    for _ in 0..200 {
        if let (Some(mic_buf), Some(silence_buf)) = (
            mic_source.read().unwrap(),
            silence_source.read().unwrap(),
        ) {
            let mixed = mixer.process(vec![mic_buf, silence_buf]).unwrap();
            sink.write(mixed).unwrap();
        }
        thread::sleep(Duration::from_millis(5));
    }

    mic_source.stop().unwrap();
    silence_source.stop().unwrap();
    sink.close().unwrap();

    // Verify file exists and has reasonable size (>10KB for 2 seconds)
    let metadata = fs::metadata(output_path).unwrap();
    assert!(metadata.len() > 10_000);

    println!(
        "Microphone + Silence mixed recording: {} bytes",
        metadata.len()
    );

    // Cleanup
    fs::remove_file(output_path).ok();
}

/// Test mixer with system audio source (macOS only)
#[cfg(target_os = "macos")]
#[test]
#[ignore] // Requires system permissions, run with --ignored
fn test_mixer_with_system_audio() {
    let format = AudioFormat::speech();

    // Try to create system audio source
    let mut system_source = match SystemAudioSource::new() {
        Ok(s) => s,
        Err(_) => {
            println!("System audio not available, skipping test");
            return;
        }
    };

    // Create silence source as second input
    let mut silence_source = SilenceSource::new(format, 10);

    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    let output_path = "/tmp/mixer_test_system_audio.wav";
    let mut sink = WavEncoderSink::new(output_path, format).unwrap();

    system_source.start().unwrap();
    silence_source.start().unwrap();

    // Record for 2 seconds
    for _ in 0..200 {
        if let (Some(sys_buf), Some(silence_buf)) = (
            system_source.read().unwrap(),
            silence_source.read().unwrap(),
        ) {
            let mixed = mixer.process(vec![sys_buf, silence_buf]).unwrap();
            sink.write(mixed).unwrap();
        }
        thread::sleep(Duration::from_millis(5));
    }

    system_source.stop().unwrap();
    silence_source.stop().unwrap();
    sink.close().unwrap();

    // Verify file exists and has reasonable size
    let metadata = fs::metadata(output_path).unwrap();
    assert!(metadata.len() > 10_000);

    println!(
        "System audio + Silence mixed recording: {} bytes",
        metadata.len()
    );

    // Cleanup
    fs::remove_file(output_path).ok();
}

/// Test dual-source recording: Microphone + System Audio (macOS only)
/// This is the primary use case for the mixer in Taskerino
#[cfg(target_os = "macos")]
#[test]
#[ignore] // Requires hardware and permissions, run with --ignored
fn test_dual_source_mic_and_system_audio() {
    let format = AudioFormat::speech();

    // Create microphone source
    let mut mic_source = match MicrophoneSource::new(None) {
        Ok(s) => s,
        Err(_) => {
            println!("No microphone available, skipping test");
            return;
        }
    };

    // Create system audio source
    let mut system_source = match SystemAudioSource::new() {
        Ok(s) => s,
        Err(_) => {
            println!("System audio not available, skipping test");
            return;
        }
    };

    // Create mixer with weighted balance: 60% mic, 40% system
    let mut mixer = Mixer::new(2, MixMode::Weighted).unwrap();
    mixer.set_balance(0, 0.6).unwrap(); // Mic
    mixer.set_balance(1, 0.4).unwrap(); // System audio

    let output_path = "/tmp/mixer_test_dual_source.wav";
    let mut sink = WavEncoderSink::new(output_path, format).unwrap();

    mic_source.start().unwrap();
    system_source.start().unwrap();

    println!("Recording dual-source (mic + system) for 3 seconds...");

    // Record for 3 seconds
    for _ in 0..300 {
        if let (Some(mic_buf), Some(sys_buf)) = (
            mic_source.read().unwrap(),
            system_source.read().unwrap(),
        ) {
            let mixed = mixer.process(vec![mic_buf, sys_buf]).unwrap();
            sink.write(mixed).unwrap();
        }
        thread::sleep(Duration::from_millis(5));
    }

    mic_source.stop().unwrap();
    system_source.stop().unwrap();
    sink.close().unwrap();

    // Verify file exists and has reasonable size (>15KB for 3 seconds)
    let metadata = fs::metadata(output_path).unwrap();
    assert!(metadata.len() > 15_000);

    println!("Dual-source recording: {} bytes", metadata.len());
    println!("WAV file created at: {}", output_path);
    println!("You can play it with: afplay {}", output_path);

    // Cleanup (comment out to keep file for manual inspection)
    // fs::remove_file(output_path).ok();
}

/// Test mixer performance with many buffers
#[test]
fn test_mixer_performance() {
    let format = AudioFormat::speech();

    let mut source1 = SilenceSource::new(format, 10);
    let mut source2 = SilenceSource::new(format, 10);

    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    let output_path = "/tmp/mixer_test_performance.wav";
    let mut sink = WavEncoderSink::new(output_path, format).unwrap();

    source1.start().unwrap();
    source2.start().unwrap();

    let start = std::time::Instant::now();
    let mut buffers_processed = 0;

    // Process 1000 buffers (10 seconds of audio)
    for _ in 0..1000 {
        if let (Some(b1), Some(b2)) = (source1.read().unwrap(), source2.read().unwrap()) {
            let mixed = mixer.process(vec![b1, b2]).unwrap();
            sink.write(mixed).unwrap();
            buffers_processed += 1;
        }
        thread::sleep(Duration::from_millis(1));
    }

    let elapsed = start.elapsed();

    source1.stop().unwrap();
    source2.stop().unwrap();
    sink.close().unwrap();

    // Verify stats
    let stats = mixer.stats();
    assert_eq!(stats.buffers_processed, buffers_processed);

    println!("Processed {} buffers in {:?}", buffers_processed, elapsed);
    println!(
        "Average processing time: {}µs",
        stats.avg_processing_time_us
    );

    // Verify performance: should process 1000 buffers in <10 seconds
    assert!(elapsed < Duration::from_secs(10));

    // Cleanup
    fs::remove_file(output_path).ok();
}

/// Test mixer statistics tracking
#[test]
fn test_mixer_stats_integration() {
    let format = AudioFormat::speech();

    let mut source1 = SilenceSource::new(format, 10);
    let mut source2 = SilenceSource::new(format, 10);

    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    source1.start().unwrap();
    source2.start().unwrap();

    // Process buffers without sink (just testing mixer stats)
    let mut expected_buffers = 0;
    let mut expected_samples = 0;

    for _ in 0..50 {
        if let (Some(b1), Some(b2)) = (source1.read().unwrap(), source2.read().unwrap()) {
            let mixed = mixer.process(vec![b1, b2]).unwrap();
            expected_buffers += 1;
            expected_samples += mixed.samples.len() as u64;
        }
        thread::sleep(Duration::from_millis(5));
    }

    source1.stop().unwrap();
    source2.stop().unwrap();

    // Verify stats
    let stats = mixer.stats();
    assert_eq!(stats.buffers_processed, expected_buffers);
    assert_eq!(stats.samples_processed, expected_samples);
    assert!(stats.avg_processing_time_us > 0); // Should have timing data
}
