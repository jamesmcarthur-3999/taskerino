//! Integration tests for audio sources
//!
//! Tests the complete functionality of audio source implementations.

use app_lib::audio::graph::traits::{AudioSource, AudioFormat, SampleFormat};
use app_lib::audio::sources::{MicrophoneSource, SilenceSource};
use std::time::{Duration, Instant};

#[cfg(target_os = "macos")]
use app_lib::audio::sources::SystemAudioSource;

#[test]
fn test_silence_record_one_second() {
    // Create silence source with 10ms buffers
    let format = AudioFormat::new(16000, 1, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);

    source.start().expect("Failed to start source");

    let start = Instant::now();
    let mut buffer_count = 0;
    let mut total_samples = 0;

    // Record for 1 second
    while start.elapsed() < Duration::from_secs(1) {
        match source.read() {
            Ok(Some(buffer)) => {
                buffer_count += 1;
                total_samples += buffer.samples.len();

                // Verify buffer is actually silent
                assert!(buffer.is_silent(0.001), "Buffer should be silent");

                // Verify format matches
                assert_eq!(buffer.format, format);
            }
            Ok(None) => {
                // No buffer available yet, wait a bit
                std::thread::sleep(Duration::from_millis(1));
            }
            Err(e) => {
                panic!("Failed to read buffer: {}", e);
            }
        }
    }

    source.stop().expect("Failed to stop source");

    // Should have approximately 100 buffers (1 second / 10ms = 100)
    // Allow some margin for timing variance
    assert!(
        buffer_count >= 90 && buffer_count <= 110,
        "Expected ~100 buffers, got {}",
        buffer_count
    );

    // Should have approximately 16000 samples (1 second * 16kHz)
    // Allow wider margin due to timing variance
    assert!(
        total_samples >= 14000 && total_samples <= 18000,
        "Expected ~16000 samples, got {}",
        total_samples
    );

    // Verify stats
    let stats = source.stats();
    assert_eq!(stats.buffers_produced, buffer_count as u64);
    assert_eq!(stats.samples_produced, total_samples as u64);
}

#[test]
fn test_microphone_record_one_second() {
    // Try to create microphone source
    let mut source = match MicrophoneSource::new(None) {
        Ok(s) => s,
        Err(_) => {
            println!("Skipping test - no microphone available");
            return;
        }
    };

    source.start().expect("Failed to start microphone");

    let start = Instant::now();
    let mut buffer_count = 0;

    // Record for 1 second
    while start.elapsed() < Duration::from_secs(1) {
        match source.read() {
            Ok(Some(buffer)) => {
                buffer_count += 1;

                // Verify buffer has correct format
                let format = source.format();
                assert_eq!(buffer.format, format);

                // Verify buffer duration is reasonable (1-100ms typical)
                let duration = buffer.duration_secs();
                assert!(
                    duration > 0.0 && duration < 0.1,
                    "Buffer duration {} seems unreasonable",
                    duration
                );
            }
            Ok(None) => {
                // No buffer available yet, wait a bit
                std::thread::sleep(Duration::from_millis(1));
            }
            Err(e) => {
                panic!("Failed to read buffer: {}", e);
            }
        }
    }

    source.stop().expect("Failed to stop microphone");

    // Should have captured some buffers
    assert!(buffer_count > 0, "Should have captured at least one buffer");

    println!("Captured {} buffers from microphone", buffer_count);
}

#[test]
#[cfg(target_os = "macos")]
fn test_system_audio_record_one_second() {
    // Try to create system audio source
    let mut source = match SystemAudioSource::new() {
        Ok(s) => s,
        Err(_) => {
            println!("Skipping test - system audio not available");
            return;
        }
    };

    // Try to start system audio - may fail without permissions
    if let Err(e) = source.start() {
        println!("Skipping test - could not start system audio: {}", e);
        return;
    }

    let start = Instant::now();
    let mut buffer_count = 0;

    // Record for 1 second
    while start.elapsed() < Duration::from_secs(1) {
        match source.read() {
            Ok(Some(buffer)) => {
                buffer_count += 1;

                // Verify buffer has correct format (16kHz mono f32)
                assert_eq!(buffer.format.sample_rate, 16000);
                assert_eq!(buffer.format.channels, 1);
                assert_eq!(buffer.format.sample_format, SampleFormat::F32);
            }
            Ok(None) => {
                // No buffer available yet, wait a bit
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(e) => {
                panic!("Failed to read buffer: {}", e);
            }
        }
    }

    source.stop().expect("Failed to stop system audio");

    // Note: buffer_count might be 0 if no system audio was playing
    println!("Captured {} buffers from system audio", buffer_count);
}

#[test]
fn test_buffer_timestamps_monotonic() {
    let format = AudioFormat::new(16000, 1, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);

    source.start().expect("Failed to start source");

    let mut last_timestamp: Option<Instant> = None;
    let mut buffer_count = 0;

    // Collect a few buffers
    while buffer_count < 10 {
        if let Ok(Some(buffer)) = source.read() {
            if let Some(last) = last_timestamp {
                // Timestamps should always increase
                assert!(
                    buffer.timestamp >= last,
                    "Timestamps should be monotonically increasing"
                );
            }
            last_timestamp = Some(buffer.timestamp);
            buffer_count += 1;
        } else {
            std::thread::sleep(Duration::from_millis(5));
        }
    }

    source.stop().expect("Failed to stop source");

    assert_eq!(buffer_count, 10, "Should have collected 10 buffers");
}

#[test]
fn test_no_buffer_overruns_with_proper_read_rate() {
    let format = AudioFormat::new(16000, 1, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);

    source.start().expect("Failed to start source");

    let start = Instant::now();
    let mut buffer_count = 0;

    // Read at proper rate (every 10ms) for 0.5 seconds
    while start.elapsed() < Duration::from_millis(500) {
        if let Ok(Some(_buffer)) = source.read() {
            buffer_count += 1;
        }
        std::thread::sleep(Duration::from_millis(10));
    }

    source.stop().expect("Failed to stop source");

    let stats = source.stats();
    assert_eq!(
        stats.overruns, 0,
        "Should have no overruns when reading at proper rate"
    );
    assert!(buffer_count > 0, "Should have read some buffers");
}

#[test]
fn test_simultaneous_sources() {
    // Create two silence sources
    let format1 = AudioFormat::new(16000, 1, SampleFormat::F32);
    let format2 = AudioFormat::new(48000, 2, SampleFormat::F32);

    let mut source1 = SilenceSource::new(format1, 10);
    let mut source2 = SilenceSource::new(format2, 20);

    // Start both
    source1.start().expect("Failed to start source1");
    source2.start().expect("Failed to start source2");

    let start = Instant::now();
    let mut count1 = 0;
    let mut count2 = 0;

    // Read from both for 0.2 seconds
    while start.elapsed() < Duration::from_millis(200) {
        if let Ok(Some(_)) = source1.read() {
            count1 += 1;
        }
        if let Ok(Some(_)) = source2.read() {
            count2 += 1;
        }
        std::thread::sleep(Duration::from_millis(5));
    }

    // Stop both
    source1.stop().expect("Failed to stop source1");
    source2.stop().expect("Failed to stop source2");

    // Both should have produced buffers
    assert!(count1 > 0, "Source 1 should have produced buffers");
    assert!(count2 > 0, "Source 2 should have produced buffers");

    println!("Source 1: {} buffers, Source 2: {} buffers", count1, count2);
}

#[test]
fn test_source_format_preservation() {
    // Test that different formats are preserved correctly
    let formats = vec![
        AudioFormat::new(16000, 1, SampleFormat::F32),
        AudioFormat::new(44100, 2, SampleFormat::F32),
        AudioFormat::new(48000, 2, SampleFormat::F32),
    ];

    for format in formats {
        let mut source = SilenceSource::new(format, 10);
        source.start().expect("Failed to start source");

        // Read one buffer
        let buffer = loop {
            if let Ok(Some(buf)) = source.read() {
                break buf;
            }
            std::thread::sleep(Duration::from_millis(5));
        };

        // Verify format matches
        assert_eq!(buffer.format.sample_rate, format.sample_rate);
        assert_eq!(buffer.format.channels, format.channels);
        assert_eq!(buffer.format.sample_format, format.sample_format);

        source.stop().expect("Failed to stop source");
    }
}
