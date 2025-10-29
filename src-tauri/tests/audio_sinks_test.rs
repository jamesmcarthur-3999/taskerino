//! Integration tests for audio sinks
//!
//! Tests the complete sink implementations with real WAV file operations,
//! large buffer counts, and format validation.

use std::time::Instant;
use tempfile::TempDir;
use app_lib::audio::graph::traits::{AudioBuffer, AudioFormat, AudioSink, SampleFormat};
use app_lib::audio::sinks::{BufferSink, NullSink, WavEncoderSink};

/// Helper to create a test buffer with sinusoidal samples
fn create_sine_buffer(format: AudioFormat, num_frames: usize, frequency: f32) -> AudioBuffer {
    let samples_per_channel = num_frames;
    let sample_rate = format.sample_rate as f32;
    let mut samples = Vec::with_capacity(num_frames * format.channels as usize);

    for i in 0..samples_per_channel {
        let t = i as f32 / sample_rate;
        let sample = (2.0 * std::f32::consts::PI * frequency * t).sin();

        // Duplicate for all channels
        for _ in 0..format.channels {
            samples.push(sample);
        }
    }

    AudioBuffer::new(format, samples, Instant::now())
}

#[test]
fn test_wav_encoder_1000_buffers() {
    let temp_dir = TempDir::new().unwrap();
    let path = temp_dir.path().join("large_test.wav");
    let format = AudioFormat::speech();
    let mut sink = WavEncoderSink::new(&path, format).unwrap();

    // Write 1000 buffers (10 seconds at 10ms intervals, 16kHz)
    for i in 0..1000 {
        let frequency = 440.0 + (i as f32 * 0.1); // Varying frequency
        let buffer = create_sine_buffer(format, 160, frequency);
        sink.write(buffer).unwrap();
    }

    sink.close().unwrap();

    // Verify file size
    let metadata = std::fs::metadata(&path).unwrap();
    assert!(metadata.len() > 100_000); // At least 100KB

    // Verify file is valid WAV (can be opened)
    let reader = hound::WavReader::open(&path).unwrap();
    assert_eq!(reader.spec().sample_rate, 16000);
    assert_eq!(reader.spec().channels, 1);
    assert_eq!(reader.len(), 160000); // 1000 buffers * 160 samples
}

#[test]
fn test_wav_output_is_valid() {
    let temp_dir = TempDir::new().unwrap();
    let path = temp_dir.path().join("valid_test.wav");
    let format = AudioFormat::speech();
    let mut sink = WavEncoderSink::new(&path, format).unwrap();

    // Write 100 buffers with constant amplitude
    for _ in 0..100 {
        let samples = vec![0.5_f32; 160];
        let buffer = AudioBuffer::new(format, samples, Instant::now());
        sink.write(buffer).unwrap();
    }

    sink.close().unwrap();

    // Verify samples are correct by reading back
    let mut reader = hound::WavReader::open(&path).unwrap();
    let samples: Vec<f32> = reader.samples::<f32>().map(|s| s.unwrap()).collect();

    assert_eq!(samples.len(), 16000); // 100 buffers * 160 samples

    // Check first few samples are approximately 0.5
    for &sample in samples.iter().take(10) {
        assert!((sample - 0.5).abs() < 0.01, "Sample was {}", sample);
    }
}

#[test]
fn test_buffer_sink_accumulation() {
    let mut sink = BufferSink::new(100);
    let format = AudioFormat::speech();

    for i in 0..50 {
        let buffer = create_sine_buffer(format, 160, 440.0 + i as f32);
        sink.write(buffer).unwrap();
    }

    assert_eq!(sink.buffer_count(), 50);

    let buffers = sink.get_buffers();
    assert_eq!(buffers.len(), 50);
    assert_eq!(buffers[0].samples.len(), 160);
    assert_eq!(buffers[0].format, format);
}

#[test]
fn test_buffer_sink_overflow() {
    let mut sink = BufferSink::new(10); // Max 10 buffers
    let format = AudioFormat::speech();

    // Fill to capacity
    for _ in 0..10 {
        let buffer = AudioBuffer::new(format, vec![0.0; 160], Instant::now());
        assert!(sink.write(buffer).is_ok());
    }

    assert!(sink.is_full());

    // 11th write should error
    let buffer = AudioBuffer::new(format, vec![0.0; 160], Instant::now());
    let result = sink.write(buffer);
    assert!(result.is_err());
}

#[test]
fn test_null_sink_discards() {
    let mut sink = NullSink::new();
    let format = AudioFormat::speech();

    // Write 1000 buffers
    for _ in 0..1000 {
        let buffer = AudioBuffer::new(format, vec![0.0; 160], Instant::now());
        sink.write(buffer).unwrap();
    }

    let stats = sink.stats();
    assert_eq!(stats.buffers_written, 1000);
    assert_eq!(stats.samples_written, 160000);

    // NullSink should not consume significant memory
    // (implicit test - if we don't OOM, it passed)
}

#[test]
fn test_file_size_matches_expected() {
    let temp_dir = TempDir::new().unwrap();
    let path = temp_dir.path().join("size_test.wav");
    let format = AudioFormat::speech();
    let mut sink = WavEncoderSink::new(&path, format).unwrap();

    let num_buffers = 100;
    let samples_per_buffer = 160;

    for _ in 0..num_buffers {
        let buffer = AudioBuffer::new(format, vec![0.0; samples_per_buffer], Instant::now());
        sink.write(buffer).unwrap();
    }

    sink.close().unwrap();

    let total_samples = num_buffers * samples_per_buffer;
    assert_eq!(sink.samples_written(), total_samples as u64);

    // Verify actual file size (header + data)
    let metadata = std::fs::metadata(&path).unwrap();
    let expected_data_size = total_samples * 4; // f32 = 4 bytes
    let header_size = 44; // WAV header
    assert!(metadata.len() >= (expected_data_size + header_size) as u64);
}

#[test]
fn test_multi_format_encoding() {
    let temp_dir = TempDir::new().unwrap();

    // Test F32 format
    {
        let path = temp_dir.path().join("test_f32.wav");
        let format = AudioFormat::new(16000, 1, SampleFormat::F32);
        let mut sink = WavEncoderSink::new(&path, format).unwrap();

        for _ in 0..10 {
            let buffer = create_sine_buffer(format, 160, 440.0);
            sink.write(buffer).unwrap();
        }

        sink.close().unwrap();
        assert!(path.exists());

        let reader = hound::WavReader::open(&path).unwrap();
        assert_eq!(reader.spec().sample_format, hound::SampleFormat::Float);
    }

    // Test I16 format
    {
        let path = temp_dir.path().join("test_i16.wav");
        let format = AudioFormat::new(16000, 1, SampleFormat::I16);
        let mut sink = WavEncoderSink::new(&path, format).unwrap();

        for _ in 0..10 {
            let buffer = create_sine_buffer(format, 160, 440.0);
            sink.write(buffer).unwrap();
        }

        sink.close().unwrap();
        assert!(path.exists());

        let reader = hound::WavReader::open(&path).unwrap();
        assert_eq!(reader.spec().sample_format, hound::SampleFormat::Int);
        assert_eq!(reader.spec().bits_per_sample, 16);
    }
}

#[test]
fn test_stereo_multi_channel() {
    let temp_dir = TempDir::new().unwrap();
    let path = temp_dir.path().join("test_stereo.wav");
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut sink = WavEncoderSink::new(&path, format).unwrap();

    // Write stereo buffers (320 samples = 160 frames * 2 channels)
    for _ in 0..100 {
        let buffer = create_sine_buffer(format, 160, 440.0);
        sink.write(buffer).unwrap();
    }

    sink.close().unwrap();

    let reader = hound::WavReader::open(&path).unwrap();
    assert_eq!(reader.spec().channels, 2);
    assert_eq!(reader.spec().sample_rate, 48000);
    assert_eq!(reader.len(), 32000); // 100 buffers * 160 frames * 2 channels
}

#[test]
fn test_sink_statistics_accuracy() {
    let temp_dir = TempDir::new().unwrap();
    let path = temp_dir.path().join("stats_test.wav");
    let format = AudioFormat::speech();
    let mut sink = WavEncoderSink::new(&path, format).unwrap();

    let num_buffers = 50;
    let samples_per_buffer = 160;

    for _ in 0..num_buffers {
        let buffer = AudioBuffer::new(format, vec![0.5; samples_per_buffer], Instant::now());
        sink.write(buffer).unwrap();
    }

    let stats = sink.stats();
    assert_eq!(stats.buffers_written, num_buffers as u64);
    assert_eq!(
        stats.samples_written,
        (num_buffers * samples_per_buffer) as u64
    );
    assert_eq!(
        stats.bytes_written,
        (num_buffers * samples_per_buffer * 4) as u64
    ); // f32 = 4 bytes

    sink.close().unwrap();
}

#[test]
fn test_concurrent_writes_buffer_sink() {
    use std::sync::{Arc, Mutex};
    use std::thread;

    let sink = Arc::new(Mutex::new(BufferSink::new(1000)));
    let mut handles = vec![];

    // Spawn 5 threads, each writing 20 buffers
    for thread_id in 0..5 {
        let sink_clone = Arc::clone(&sink);
        let handle = thread::spawn(move || {
            let format = AudioFormat::speech();
            for _ in 0..20 {
                let buffer =
                    create_sine_buffer(format, 160, 440.0 + thread_id as f32 * 10.0);
                let mut sink_guard = sink_clone.lock().unwrap();
                sink_guard.write(buffer).unwrap();
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        handle.join().unwrap();
    }

    let sink_guard = sink.lock().unwrap();
    assert_eq!(sink_guard.buffer_count(), 100); // 5 threads * 20 buffers
}

#[test]
fn test_high_sample_rate_encoding() {
    let temp_dir = TempDir::new().unwrap();
    let path = temp_dir.path().join("high_rate.wav");
    let format = AudioFormat::professional(); // 48kHz stereo
    let mut sink = WavEncoderSink::new(&path, format).unwrap();

    // Write 1 second of audio (100 buffers of 10ms each = 960 samples per buffer for stereo)
    for _ in 0..100 {
        let buffer = create_sine_buffer(format, 480, 1000.0); // 480 frames * 2 channels
        sink.write(buffer).unwrap();
    }

    sink.close().unwrap();

    let reader = hound::WavReader::open(&path).unwrap();
    assert_eq!(reader.spec().sample_rate, 48000);
    assert_eq!(reader.spec().channels, 2);
}
