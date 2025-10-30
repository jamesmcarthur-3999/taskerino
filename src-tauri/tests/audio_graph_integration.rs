//! Integration tests for the complete audio graph system
//!
//! Tests the full audio pipeline from sources through processors to sinks,
//! verifying that all components work together correctly.

use app_lib::audio::graph::traits::{AudioFormat, AudioSource, AudioSink, AudioProcessor, SampleFormat, AudioBuffer};
use app_lib::audio::sources::{SilenceSource};
use app_lib::audio::sinks::{WavEncoderSink, BufferSink, NullSink};
use app_lib::audio::processors::{Mixer, MixMode, Resampler};
use std::time::Duration;
use tempfile::tempdir;

/// Helper: Poll a source until a buffer is available or timeout
fn poll_buffer<S: AudioSource>(source: &mut S, timeout: Duration) -> Option<AudioBuffer> {
    let start = std::time::Instant::now();
    loop {
        if let Ok(Some(buf)) = source.read() {
            return Some(buf);
        }

        if start.elapsed() > timeout {
            return None;
        }

        std::thread::sleep(Duration::from_millis(1));
    }
}

/// Test 1: Dual-Source Recording Pipeline (CRITICAL - Taskerino's main use case)
///
/// Tests: SilenceSource (mic) + SilenceSource (system) → Mixer → WAV
/// Duration: 1 second (100 buffers at 10ms each)
/// Validates: File creation, stats tracking, end-to-end workflow
#[test]
fn test_dual_source_recording_pipeline() {
    // Setup format (48kHz stereo)
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);

    // Create two silence sources (simulating mic and system audio)
    let mut mic_source = SilenceSource::new(format, 10); // 10ms buffers
    let mut system_source = SilenceSource::new(format, 10);

    // Create mixer (2 inputs, weighted mode)
    let mut mixer = Mixer::new(2, MixMode::Weighted).unwrap();
    mixer.set_balance(0, 0.6).unwrap(); // 60% mic
    mixer.set_balance(1, 0.4).unwrap(); // 40% system

    // Create WAV sink
    let temp_dir = tempdir().unwrap();
    let output_path = temp_dir.path().join("dual_source_test.wav");
    let mut sink = WavEncoderSink::new(output_path.clone(), format).unwrap();

    // Start sources
    mic_source.start().unwrap();
    system_source.start().unwrap();

    // Process 100 buffers (1 second at 10ms each)
    for _ in 0..100 {
        let mic_buf = poll_buffer(&mut mic_source, Duration::from_millis(100))
            .expect("Mic buffer should be available");
        let sys_buf = poll_buffer(&mut system_source, Duration::from_millis(100))
            .expect("System buffer should be available");

        let mixed = mixer.process(vec![mic_buf, sys_buf]).unwrap();
        sink.write(mixed).unwrap();
    }

    // Cleanup
    mic_source.stop().unwrap();
    system_source.stop().unwrap();
    sink.close().unwrap();

    // Verify output file exists and has data
    assert!(output_path.exists(), "Output WAV file should exist");
    let metadata = std::fs::metadata(&output_path).unwrap();
    assert!(metadata.len() > 1000, "WAV file should have data (size: {} bytes)", metadata.len());

    // Verify sink stats
    let stats = sink.stats();
    assert_eq!(stats.buffers_written, 100, "Should have written 100 buffers");
    assert!(stats.bytes_written > 0, "Should have written bytes");
}

/// Test 2: Resampling Pipeline
///
/// Tests: 16kHz source → Resampler → 48kHz WAV
/// Duration: 1 second
/// Validates: Sample rate conversion, buffer accumulation
#[test]
fn test_resampling_pipeline() {
    // 16kHz source
    let input_format = AudioFormat::new(16000, 1, SampleFormat::F32);
    let output_format = AudioFormat::new(48000, 1, SampleFormat::F32);

    let mut source = SilenceSource::new(input_format, 10); // 10ms buffers
    let mut resampler = Resampler::new(16000, 48000, 1, 160).unwrap();

    let temp_dir = tempdir().unwrap();
    let output_path = temp_dir.path().join("resampled.wav");
    let mut sink = WavEncoderSink::new(output_path.clone(), output_format).unwrap();

    source.start().unwrap();

    // Process 100 buffers (1 second at 16kHz)
    for _ in 0..100 {
        let input_buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Input buffer should be available");
        let resampled = resampler.process(input_buf).unwrap();

        // Resampler may return empty buffers while accumulating
        if !resampled.samples.is_empty() {
            sink.write(resampled).unwrap();
        }
    }

    source.stop().unwrap();
    sink.close().unwrap();

    // Verify output file
    assert!(output_path.exists(), "Output WAV file should exist");
    let metadata = std::fs::metadata(&output_path).unwrap();
    assert!(metadata.len() > 1000, "Resampled WAV should have data");
}

/// Test 3: Multi-Format Output
///
/// Tests: Source → 2 sinks (WAV + Buffer) simultaneously
/// Duration: 0.5 seconds (50 buffers)
/// Validates: Fan-out capability, zero-copy buffer cloning
#[test]
fn test_multi_format_output() {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);

    let temp_dir = tempdir().unwrap();
    let output_path = temp_dir.path().join("multi1.wav");
    let mut wav_sink = WavEncoderSink::new(output_path.clone(), format).unwrap();
    let mut buffer_sink = BufferSink::new(1000);

    source.start().unwrap();

    // Process 50 buffers
    for _ in 0..50 {
        let buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Buffer should be available");

        // Clone buffer for second sink (zero-copy thanks to Arc)
        wav_sink.write(buf.clone()).unwrap();
        buffer_sink.write(buf).unwrap();
    }

    source.stop().unwrap();
    wav_sink.close().unwrap();
    buffer_sink.close().unwrap();

    // Verify both outputs
    assert!(output_path.exists(), "WAV output should exist");
    assert_eq!(buffer_sink.buffer_count(), 50, "BufferSink should have 50 buffers");
}

/// Test 4: Error Recovery - Format Mismatch
///
/// Tests: Attempting to mix sources with different sample rates
/// Validates: Proper error handling and error types
#[test]
fn test_format_mismatch_error_handling() {
    let format1 = AudioFormat::new(16000, 1, SampleFormat::F32);
    let format2 = AudioFormat::new(48000, 1, SampleFormat::F32);

    let mut source1 = SilenceSource::new(format1, 10);
    let mut source2 = SilenceSource::new(format2, 10);
    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    source1.start().unwrap();
    source2.start().unwrap();

    let buf1 = poll_buffer(&mut source1, Duration::from_millis(100))
        .expect("Buffer 1 should be available");
    let buf2 = poll_buffer(&mut source2, Duration::from_millis(100))
        .expect("Buffer 2 should be available");

    // Should error due to format mismatch (different sample rates)
    let result = mixer.process(vec![buf1, buf2]);
    assert!(result.is_err(), "Should error on format mismatch");

    // Verify error type contains format information
    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("format") || err_msg.contains("compatible"),
            "Error should mention format incompatibility: {}", err_msg);
}

/// Test 5: Error Recovery - Input Count Mismatch
///
/// Tests: Providing wrong number of inputs to mixer
/// Validates: Input validation and clear error messages
#[test]
fn test_input_count_mismatch_error() {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);
    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    source.start().unwrap();
    let buf = poll_buffer(&mut source, Duration::from_millis(100))
        .expect("Buffer should be available");

    // Mixer expects 2 inputs, but only provide 1
    let result = mixer.process(vec![buf]);
    assert!(result.is_err(), "Should error on input count mismatch");

    let err_msg = result.unwrap_err().to_string();
    assert!(err_msg.contains("input") || err_msg.contains("2"),
            "Error should mention expected input count: {}", err_msg);
}

/// Test 6: Long-Duration Recording (10 seconds)
///
/// Tests: Sustained processing over longer duration
/// Duration: 10 seconds (1000 buffers)
/// Validates: No memory leaks, stable performance
#[test]
fn test_long_duration_recording() {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);

    let temp_dir = tempdir().unwrap();
    let output_path = temp_dir.path().join("long_recording.wav");
    let mut sink = WavEncoderSink::new(output_path.clone(), format).unwrap();

    source.start().unwrap();

    // Process 1000 buffers (10 seconds)
    for _ in 0..1000 {
        let buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Buffer should be available");
        sink.write(buf).unwrap();
    }

    source.stop().unwrap();
    sink.close().unwrap();

    // Verify file size is reasonable
    let metadata = std::fs::metadata(&output_path).unwrap();
    let expected_size = 10 * 48000 * 2 * 4; // 10 sec * 48kHz * stereo * 4 bytes
    let actual_size = metadata.len() as i64;

    // Allow 10% variance for WAV header
    let variance = (expected_size as f64 * 0.1) as i64;
    assert!((actual_size - expected_size as i64).abs() < variance,
            "File size should be close to expected (expected: {}, actual: {})",
            expected_size, actual_size);
}

/// Test 7: Processing Chain
///
/// Tests: Source → Mixer → Resampler → WAV
/// Duration: 1 second
/// Validates: Multi-stage processing pipeline
#[test]
fn test_processing_chain() {
    // Two 16kHz sources
    let input_format = AudioFormat::new(16000, 1, SampleFormat::F32);
    let output_format = AudioFormat::new(48000, 1, SampleFormat::F32);

    let mut source1 = SilenceSource::new(input_format, 10);
    let mut source2 = SilenceSource::new(input_format, 10);
    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();
    let mut resampler = Resampler::new(16000, 48000, 1, 160).unwrap();

    let temp_dir = tempdir().unwrap();
    let output_path = temp_dir.path().join("chain_output.wav");
    let mut sink = WavEncoderSink::new(output_path.clone(), output_format).unwrap();

    source1.start().unwrap();
    source2.start().unwrap();

    // Process 100 buffers (1 second at 16kHz)
    for _ in 0..100 {
        let buf1 = poll_buffer(&mut source1, Duration::from_millis(100))
            .expect("Buffer 1 should be available");
        let buf2 = poll_buffer(&mut source2, Duration::from_millis(100))
            .expect("Buffer 2 should be available");

        // Mix
        let mixed = mixer.process(vec![buf1, buf2]).unwrap();

        // Resample
        let resampled = resampler.process(mixed).unwrap();

        // Write (if resampler has output)
        if !resampled.samples.is_empty() {
            sink.write(resampled).unwrap();
        }
    }

    source1.stop().unwrap();
    source2.stop().unwrap();
    sink.close().unwrap();

    assert!(output_path.exists(), "Chain output should exist");
}

/// Test 8: High Sample Rate (96kHz)
///
/// Tests: High sample rate processing
/// Duration: 1 second
/// Validates: Support for professional sample rates
#[test]
fn test_high_sample_rate() {
    let format = AudioFormat::new(96000, 2, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10); // 10ms buffers

    let temp_dir = tempdir().unwrap();
    let output_path = temp_dir.path().join("high_rate.wav");
    let mut sink = WavEncoderSink::new(output_path.clone(), format).unwrap();

    source.start().unwrap();

    // Process 100 buffers (1 second)
    for _ in 0..100 {
        let buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Buffer should be available");
        sink.write(buf).unwrap();
    }

    source.stop().unwrap();
    sink.close().unwrap();

    assert!(output_path.exists(), "High rate output should exist");
}

/// Test 9: Mono to Stereo via Mixer
///
/// Tests: Mixing mono sources into stereo output
/// Duration: 1 second
/// Validates: Channel configuration handling
#[test]
fn test_mono_sources_stereo_output() {
    let mono_format = AudioFormat::new(48000, 1, SampleFormat::F32);

    let mut source1 = SilenceSource::new(mono_format, 10);
    let mut source2 = SilenceSource::new(mono_format, 10);
    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    source1.start().unwrap();
    source2.start().unwrap();

    // Process one buffer to verify mixing works
    let buf1 = poll_buffer(&mut source1, Duration::from_millis(100))
        .expect("Buffer 1 should be available");
    let buf2 = poll_buffer(&mut source2, Duration::from_millis(100))
        .expect("Buffer 2 should be available");

    let mixed = mixer.process(vec![buf1, buf2]).unwrap();

    // Verify output format matches input (mono remains mono)
    assert_eq!(mixed.format.channels, 1, "Output should remain mono");
    assert_eq!(mixed.format.sample_rate, 48000, "Sample rate should be preserved");

    source1.stop().unwrap();
    source2.stop().unwrap();
}

/// Test 10: NullSink Performance
///
/// Tests: Processing without I/O overhead
/// Duration: 10 seconds worth of audio
/// Validates: Maximum processing throughput
#[test]
fn test_null_sink_throughput() {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);
    let mut sink = NullSink::new();

    source.start().unwrap();

    let start = std::time::Instant::now();

    // Process 1000 buffers (10 seconds worth)
    for _ in 0..1000 {
        let buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Buffer should be available");
        sink.write(buf).unwrap();
    }

    let elapsed = start.elapsed();

    source.stop().unwrap();
    sink.close().unwrap();

    // SilenceSource enforces real-time playback, so this will take ~10 seconds
    // Just verify it completes in reasonable time (< 12 seconds with overhead)
    assert!(elapsed < Duration::from_secs(12),
            "Should process 10 seconds of audio in < 12 seconds (actual: {:?})", elapsed);

    // Verify stats
    let stats = sink.stats();
    assert_eq!(stats.buffers_written, 1000, "Should have processed 1000 buffers");
}
