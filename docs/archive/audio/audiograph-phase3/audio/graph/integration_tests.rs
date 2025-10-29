//! Integration tests for audio graph with real nodes
//!
//! These tests verify that all three production nodes work together correctly.

use super::*;
    use crate::audio::graph::sources::MicrophoneSource;
    use crate::audio::graph::processors::Mixer;
    use crate::audio::sinks::WavEncoderSink;  // Sinks are now in audio::sinks
    use crate::audio::graph::traits::{AudioSource, AudioSink, AudioBuffer, AudioFormat, SampleFormat};
    use crate::audio::platform::mock::MockAudioDevice;
    use std::time::Instant;
    use tempfile::TempDir;
    use std::path::PathBuf;

    #[test]
    fn test_microphone_to_wav_pipeline() {
        // 1. Create MockAudioDevice with 1 second of sine wave (440Hz)
        let mock_device = MockAudioDevice::new_sine_wave(440.0, 1);

        // 2. Wrap in MicrophoneSource
        let mut source = MicrophoneSource::new(Box::new(mock_device)).unwrap();

        // 3. Create WavEncoderSink for temp file
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("output.wav");
        let format = source.format();
        let mut sink = WavEncoderSink::new(&output_path, format).unwrap();

        // 4. Start source
        source.start().unwrap();

        // 5. Manually pull samples from source and push to sink
        let mut total_samples = 0;
        while let Some(buffer) = source.read().unwrap() {
            total_samples += buffer.samples.len();
            sink.write(buffer).unwrap();
        }

        // 6. Flush sink
        sink.flush().unwrap();

        // 7. Read WAV file back and verify
        let reader = hound::WavReader::open(&output_path).unwrap();
        let spec = reader.spec();

        // Verify correct sample rate
        assert_eq!(spec.sample_rate, 16000);

        // Verify correct duration (~1 second)
        let duration_samples = reader.len();
        assert!(duration_samples >= 15000 && duration_samples <= 17000,
                "Expected ~16000 samples, got {}", duration_samples);

        // Verify contains sine wave data (not all zeros)
        let has_signal = reader.into_samples::<f32>()
            .any(|s| s.unwrap().abs() > 0.01);
        assert!(has_signal, "WAV file should contain non-zero signal");
    }

    #[test]
    fn test_dual_source_mixer_to_wav() {
        // 1. Create 2 MicrophoneSources (different frequencies: 440Hz, 880Hz)
        let device1 = MockAudioDevice::new_sine_wave(440.0, 1);
        let device2 = MockAudioDevice::new_sine_wave(880.0, 1);

        let mut source1 = MicrophoneSource::new(Box::new(device1)).unwrap();
        let mut source2 = MicrophoneSource::new(Box::new(device2)).unwrap();

        // 2. Create Mixer with balance 0.5 (equal mix)
        let mut mixer = Mixer::new(2).unwrap();
        // Default is already 0.5 balance (equal gains)

        // 3. Create WavEncoderSink
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("mixed_output.wav");
        let format = source1.format();
        let mut sink = WavEncoderSink::new(&output_path, format).unwrap();

        // 4. Start both sources
        source1.start().unwrap();
        source2.start().unwrap();

        // 5. Pull from both sources, mix, write to sink
        loop {
            let buffer1 = source1.read().unwrap();
            let buffer2 = source2.read().unwrap();

            // If either source is done, stop
            if buffer1.is_none() && buffer2.is_none() {
                break;
            }

            // Add buffers to mixer if available
            if let Some(buf1) = buffer1 {
                mixer.add_input(buf1, 0).unwrap();
            }
            if let Some(buf2) = buffer2 {
                mixer.add_input(buf2, 1).unwrap();
            }

            // Mix and write
            let mixed = mixer.mix().unwrap();
            sink.write(mixed).unwrap();
        }

        // 6. Flush sink
        sink.flush().unwrap();

        // 7. Verify output WAV
        let reader = hound::WavReader::open(&output_path).unwrap();
        let spec = reader.spec();

        assert_eq!(spec.sample_rate, 16000);
        assert_eq!(spec.channels, 1);

        // Verify file contains mixed audio
        let samples: Vec<f32> = reader.into_samples::<f32>()
            .map(|s| s.unwrap())
            .collect();

        assert!(!samples.is_empty());

        // Verify signal is present (should be mix of both frequencies)
        let has_signal = samples.iter().any(|s| s.abs() > 0.01);
        assert!(has_signal);

        // RMS should be reasonable (not clipped, not silent)
        let rms: f32 = samples.iter()
            .map(|s| s * s)
            .sum::<f32>() / samples.len() as f32;
        let rms = rms.sqrt();

        assert!(rms > 0.1 && rms < 1.0, "RMS {} should be in reasonable range", rms);
    }

    #[test]
    fn test_audio_graph_with_real_nodes() {
        // 1. Create AudioGraph
        let mut graph = AudioGraph::new();

        // 2. Add MicrophoneSource node (with MockAudioDevice)
        let mock_device = MockAudioDevice::new_sine_wave(440.0, 1);
        let source = MicrophoneSource::new(Box::new(mock_device)).unwrap();
        let format = source.format();
        let source_id = graph.add_source(Box::new(source));

        // 3. Add WavEncoderSink node
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("graph_output.wav");
        let sink = WavEncoderSink::new(&output_path, format).unwrap();
        let sink_id = graph.add_sink(Box::new(sink));

        // 4. Connect source -> sink
        graph.connect(source_id, sink_id).unwrap();

        // 5. Call graph.start()
        graph.start().unwrap();

        // 6. Process for 1 second (estimate: ~100 buffers at 10ms each)
        let mut processed_count = 0;
        for _ in 0..200 {
            match graph.process_once() {
                Ok(processed) => {
                    if processed {
                        processed_count += 1;
                    }
                }
                Err(e) => {
                    // Buffer errors are ok (might be empty)
                    if !matches!(e, AudioError::BufferError(_)) {
                        panic!("Unexpected error: {}", e);
                    }
                }
            }
        }

        // 7. Call graph.stop()
        graph.stop().unwrap();

        // 8. Verify WAV file created and valid
        assert!(output_path.exists(), "Output WAV file should exist");

        let reader = hound::WavReader::open(&output_path).unwrap();
        let spec = reader.spec();

        assert_eq!(spec.sample_rate, 16000);
        assert_eq!(spec.channels, 1);

        // Should have written some data
        let sample_count = reader.len();
        assert!(sample_count > 0, "Should have written samples");

        // Verify it's not all zeros
        let has_signal = reader.into_samples::<f32>()
            .any(|s| s.unwrap().abs() > 0.01);
        assert!(has_signal);

        println!("Graph processed {} iterations, wrote {} samples",
                 processed_count, sample_count);
    }

    #[test]
    fn test_mixer_with_graph_orchestration() {
        // Test that Mixer works correctly when used as a processor in the graph
        let mut graph = AudioGraph::new();

        // Create two sources
        let device1 = MockAudioDevice::new_sine_wave(440.0, 1);
        let device2 = MockAudioDevice::new_sine_wave(880.0, 1);

        let source1 = MicrophoneSource::new(Box::new(device1)).unwrap();
        let source2 = MicrophoneSource::new(Box::new(device2)).unwrap();
        let format = source1.format();

        let source1_id = graph.add_source(Box::new(source1));
        let source2_id = graph.add_source(Box::new(source2));

        // Add mixer processor (will use single-input mode in current graph)
        let mixer = Mixer::new(2).unwrap();
        let mixer_id = graph.add_processor(Box::new(mixer));

        // Add sink
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("mixer_graph_output.wav");
        let sink = WavEncoderSink::new(&output_path, format).unwrap();
        let sink_id = graph.add_sink(Box::new(sink));

        // Connect: source1 -> mixer -> sink
        // Note: In current graph implementation, mixer will only process one input
        graph.connect(source1_id, mixer_id).unwrap();
        graph.connect(mixer_id, sink_id).unwrap();

        // Start and process
        graph.start().unwrap();

        for _ in 0..100 {
            let _ = graph.process_once();
        }

        graph.stop().unwrap();

        // Verify output exists and is valid
        assert!(output_path.exists());

        let reader = hound::WavReader::open(&output_path).unwrap();
        assert_eq!(reader.spec().sample_rate, 16000);
    }

    #[test]
    fn test_error_handling_format_mismatch() {
        // Test that format mismatches are caught
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("format_test.wav");

        let format1 = AudioFormat::new(16000, 1, SampleFormat::F32);
        let format2 = AudioFormat::new(48000, 1, SampleFormat::F32);

        let mut sink = WavEncoderSink::new(&output_path, format1).unwrap();

        // Try to write buffer with wrong format
        let wrong_buffer = AudioBuffer::new(format2, vec![0.5], Instant::now());
        let result = sink.write(wrong_buffer);

        assert!(result.is_err());
        match result.unwrap_err() {
            AudioError::FormatError(_) => {
                // Expected
            }
            e => panic!("Expected FormatError, got {:?}", e),
        }
    }

    #[test]
    fn test_statistics_tracking() {
        // Verify that all nodes track statistics correctly
        let mock_device = MockAudioDevice::new_sine_wave(440.0, 1);
        let mut source = MicrophoneSource::new(Box::new(mock_device)).unwrap();

        source.start().unwrap();

        // Read some buffers
        for _ in 0..5 {
            if let Some(_) = source.read().unwrap() {
                // Continue
            }
        }

        let stats = source.stats();
        assert!(stats.buffers_produced > 0);
        assert!(stats.samples_produced > 0);
        assert!(stats.last_activity.is_some());

        // Test mixer stats
        let mut mixer = Mixer::new(2).unwrap();
        let format = AudioFormat::new(16000, 1, SampleFormat::F32);
        let buffer = AudioBuffer::new(format, vec![0.5; 100], Instant::now());

        mixer.process(buffer).unwrap();

        let mixer_stats = mixer.stats();
        assert_eq!(mixer_stats.buffers_processed, 1);
        assert_eq!(mixer_stats.samples_processed, 100);

        // Test sink stats
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("stats_test.wav");
        let mut sink = WavEncoderSink::new(&output_path, format).unwrap();

        for i in 0..3 {
            let buffer = AudioBuffer::new(format, vec![0.5; 100], Instant::now());
            sink.write(buffer).unwrap();
        }

        let sink_stats = sink.stats();
        assert_eq!(sink_stats.buffers_written, 3);
        assert_eq!(sink_stats.samples_written, 300);
        assert!(sink_stats.bytes_written > 0);
    }
