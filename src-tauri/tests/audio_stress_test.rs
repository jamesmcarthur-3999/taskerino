//! Stress tests for the audio graph system
//!
//! Long-running tests to verify stability, resource management, and performance
//! under sustained load. These tests are marked #[ignore] by default and should
//! be run explicitly with `cargo test -- --ignored`.

use app_lib::audio::graph::traits::{AudioFormat, AudioSource, AudioSink, SampleFormat, AudioBuffer};
use app_lib::audio::sources::SilenceSource;
use app_lib::audio::sinks::{WavEncoderSink, BufferSink, NullSink};
use app_lib::audio::processors::{Mixer, MixMode};
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

/// Test 1: 1-Hour Continuous Recording
///
/// Duration: 1 hour (360,000 buffers at 10ms each)
/// Tests: Memory leaks, resource cleanup, file size accuracy
/// Run with: `cargo test test_1_hour_continuous_recording -- --ignored --nocapture`
#[test]
#[ignore]
fn test_1_hour_continuous_recording() {
    println!("Starting 1-hour continuous recording stress test...");

    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);

    let temp_dir = tempdir().unwrap();
    let output_path = temp_dir.path().join("1hour.wav");
    let mut sink = WavEncoderSink::new(output_path.clone(), format).unwrap();

    source.start().unwrap();

    // 1 hour = 3600 seconds = 360,000 buffers at 10ms each
    let total_buffers = 360_000;
    let progress_interval = 36_000; // Log every 10%

    for i in 0..total_buffers {
        let buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Buffer should be available");
        sink.write(buf).unwrap();

        if i % progress_interval == 0 && i > 0 {
            let progress = (i * 100) / total_buffers;
            println!("Progress: {}% complete ({} / {} buffers)", progress, i, total_buffers);
        }
    }

    source.stop().unwrap();
    sink.close().unwrap();

    // Verify file size is correct (shouldn't grow beyond expected)
    let metadata = std::fs::metadata(&output_path).unwrap();
    let expected_size = 3600 * 48000 * 2 * 4; // 1hr * 48kHz * stereo * 4 bytes per sample
    let actual_size = metadata.len() as i64;

    // Allow 1% variance for WAV header overhead
    let max_variance = (expected_size as f64 * 0.01) as i64;
    assert!((actual_size - expected_size as i64).abs() < max_variance,
            "File size should be within 1% of expected (expected: {}, actual: {}, diff: {})",
            expected_size, actual_size, (actual_size - expected_size as i64).abs());

    println!("1-hour stress test COMPLETE. File size: {} bytes (expected: {})",
             actual_size, expected_size);
}

/// Test 2: Rapid Start/Stop Cycles
///
/// Duration: ~30 seconds (100 cycles)
/// Tests: Resource cleanup, initialization overhead, leak prevention
/// Run with: `cargo test test_rapid_start_stop_cycles -- --ignored --nocapture`
#[test]
#[ignore]
fn test_rapid_start_stop_cycles() {
    println!("Starting rapid start/stop cycles test (100 cycles)...");

    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let num_cycles = 100;

    for i in 0..num_cycles {
        let mut source = SilenceSource::new(format, 10);

        source.start().unwrap();

        // Read a few buffers
        for _ in 0..10 {
            let _ = poll_buffer(&mut source, Duration::from_millis(100));
        }

        source.stop().unwrap();
        // Source dropped, should cleanup properly

        if (i + 1) % 10 == 0 {
            println!("Completed {} / {} cycles", i + 1, num_cycles);
        }
    }

    println!("Rapid start/stop test COMPLETE. All {} cycles successful.", num_cycles);
}

/// Test 3: Multiple Simultaneous Graphs
///
/// Duration: ~10 seconds (4 graphs running in parallel)
/// Tests: Thread safety, concurrent processing, resource contention
/// Run with: `cargo test test_multiple_simultaneous_graphs -- --ignored --nocapture`
#[test]
#[ignore]
fn test_multiple_simultaneous_graphs() {
    println!("Starting multiple simultaneous graphs test (4 parallel graphs)...");

    let num_graphs = 4;
    let buffers_per_graph = 1000; // 10 seconds each

    let handles: Vec<_> = (0..num_graphs)
        .map(|graph_id| {
            std::thread::spawn(move || {
                println!("Graph {} starting...", graph_id);

                let format = AudioFormat::new(48000, 2, SampleFormat::F32);
                let mut source = SilenceSource::new(format, 10);
                let mut sink = BufferSink::new(2000); // Enough capacity

                source.start().unwrap();

                for i in 0..buffers_per_graph {
                    let buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Buffer should be available");
                    sink.write(buf).unwrap();

                    if (i + 1) % 200 == 0 {
                        println!("Graph {}: {} / {} buffers", graph_id, i + 1, buffers_per_graph);
                    }
                }

                source.stop().unwrap();
                sink.close().unwrap();

                println!("Graph {} COMPLETE ({} buffers processed)", graph_id, buffers_per_graph);
                (graph_id, sink.buffer_count())
            })
        })
        .collect();

    // Wait for all graphs to complete
    for handle in handles {
        let (graph_id, buffer_count) = handle.join().unwrap();
        assert_eq!(buffer_count, buffers_per_graph,
                   "Graph {} should have {} buffers", graph_id, buffers_per_graph);
    }

    println!("Multiple graphs test COMPLETE. All {} graphs processed successfully.", num_graphs);
}

/// Test 4: High-Frequency Operations
///
/// Duration: ~10 seconds (very small buffers, high frequency)
/// Tests: Overhead handling, frequent processing
/// Run with: `cargo test test_high_frequency_operations -- --ignored --nocapture`
#[test]
#[ignore]
fn test_high_frequency_operations() {
    println!("Starting high-frequency operations test (1ms buffers)...");

    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    // 1ms buffers at 48kHz = 48 samples per channel
    let mut source = SilenceSource::new(format, 48);
    let mut sink = NullSink::new();

    source.start().unwrap();

    // Process for 10 seconds at 1ms per buffer = 10,000 buffers
    let total_buffers = 10_000;
    let start = std::time::Instant::now();

    for i in 0..total_buffers {
        let buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Buffer should be available");
        sink.write(buf).unwrap();

        if (i + 1) % 1000 == 0 {
            println!("Processed {} / {} buffers ({:.1}s elapsed)",
                     i + 1, total_buffers, start.elapsed().as_secs_f32());
        }
    }

    let elapsed = start.elapsed();

    source.stop().unwrap();
    sink.close().unwrap();

    // Should complete in reasonable time (< 5 seconds for 10 seconds of audio)
    assert!(elapsed < Duration::from_secs(5),
            "Should process 10 seconds of audio in < 5 seconds (actual: {:?})", elapsed);

    println!("High-frequency test COMPLETE. Processed {} buffers in {:?}", total_buffers, elapsed);
}

/// Test 5: Memory Stress (Large Buffer Accumulation)
///
/// Duration: ~30 seconds
/// Tests: Memory management, large buffer counts
/// Run with: `cargo test test_memory_stress -- --ignored --nocapture`
#[test]
#[ignore]
fn test_memory_stress() {
    println!("Starting memory stress test (accumulating 10,000 buffers)...");

    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);
    let mut sink = BufferSink::new(15000); // Enough capacity

    source.start().unwrap();

    // Accumulate 10,000 buffers in memory (~100 seconds of audio)
    let total_buffers = 10_000;

    for i in 0..total_buffers {
        let buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Buffer should be available");
        sink.write(buf).unwrap();

        if (i + 1) % 1000 == 0 {
            println!("Accumulated {} / {} buffers", i + 1, total_buffers);
        }
    }

    source.stop().unwrap();

    // Verify all buffers were stored
    assert_eq!(sink.buffer_count(), total_buffers,
               "Should have accumulated all {} buffers", total_buffers);

    // Clear and verify memory is released
    sink.clear();
    assert_eq!(sink.buffer_count(), 0, "Buffer should be empty after clear");

    sink.close().unwrap();

    println!("Memory stress test COMPLETE. Successfully accumulated and cleared {} buffers.",
             total_buffers);
}

/// Test 6: Mixed Workload (Concurrent Recording + Processing)
///
/// Duration: ~15 seconds
/// Tests: CPU scheduling, mixed operations
/// Run with: `cargo test test_mixed_workload -- --ignored --nocapture`
#[test]
#[ignore]
fn test_mixed_workload() {
    println!("Starting mixed workload test (2 recording + 2 processing threads)...");

    let num_buffers = 1500; // 15 seconds worth

    // Recording threads
    let recording_handles: Vec<_> = (0..2)
        .map(|id| {
            std::thread::spawn(move || {
                println!("Recording thread {} starting...", id);
                let format = AudioFormat::new(48000, 2, SampleFormat::F32);
                let mut source = SilenceSource::new(format, 10);

                let temp_dir = tempdir().unwrap();
                let output_path = temp_dir.path().join(format!("mixed_{}.wav", id));
                let mut sink = WavEncoderSink::new(output_path, format).unwrap();

                source.start().unwrap();

                for _ in 0..num_buffers {
                    let buf = poll_buffer(&mut source, Duration::from_millis(100))
            .expect("Buffer should be available");
                    sink.write(buf).unwrap();
                }

                source.stop().unwrap();
                sink.close().unwrap();

                println!("Recording thread {} COMPLETE", id);
            })
        })
        .collect();

    // Processing threads
    let processing_handles: Vec<_> = (0..2)
        .map(|id| {
            std::thread::spawn(move || {
                println!("Processing thread {} starting...", id);
                let format = AudioFormat::new(48000, 2, SampleFormat::F32);
                let mut source1 = SilenceSource::new(format, 10);
                let mut source2 = SilenceSource::new(format, 10);
                let mut mixer = Mixer::new(2, MixMode::Average).unwrap();
                let mut sink = NullSink::new();

                source1.start().unwrap();
                source2.start().unwrap();

                for _ in 0..num_buffers {
                    let buf1 = poll_buffer(&mut source1, Duration::from_millis(100))
                        .expect("Buffer 1 should be available");
                    let buf2 = poll_buffer(&mut source2, Duration::from_millis(100))
                        .expect("Buffer 2 should be available");
                    let mixed = mixer.process(vec![buf1, buf2]).unwrap();
                    sink.write(mixed).unwrap();
                }

                source1.stop().unwrap();
                source2.stop().unwrap();
                sink.close().unwrap();

                println!("Processing thread {} COMPLETE", id);
            })
        })
        .collect();

    // Wait for all threads
    for handle in recording_handles {
        handle.join().unwrap();
    }
    for handle in processing_handles {
        handle.join().unwrap();
    }

    println!("Mixed workload test COMPLETE. All threads finished successfully.");
}

/// Test 7: Error Recovery Under Stress
///
/// Duration: ~5 seconds
/// Tests: Error handling in high-frequency scenarios
/// Run with: `cargo test test_error_recovery_stress -- --ignored --nocapture`
#[test]
#[ignore]
fn test_error_recovery_stress() {
    println!("Starting error recovery stress test...");

    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mismatched_format = AudioFormat::new(16000, 1, SampleFormat::F32);

    let mut source1 = SilenceSource::new(format, 10);
    let mut source2 = SilenceSource::new(mismatched_format, 10);
    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    source1.start().unwrap();
    source2.start().unwrap();

    // Attempt 1000 mixing operations with mismatched formats
    // All should error gracefully without panicking
    let mut error_count = 0;

    for _ in 0..1000 {
        let buf1 = poll_buffer(&mut source1, Duration::from_millis(100))
            .expect("Buffer 1 should be available");
        let buf2 = poll_buffer(&mut source2, Duration::from_millis(100))
            .expect("Buffer 2 should be available");

        let result = mixer.process(vec![buf1, buf2]);
        if result.is_err() {
            error_count += 1;
        }
    }

    source1.stop().unwrap();
    source2.stop().unwrap();

    // All 1000 should have errored
    assert_eq!(error_count, 1000, "All operations should have errored due to format mismatch");

    println!("Error recovery stress test COMPLETE. Handled {} errors gracefully.", error_count);
}
