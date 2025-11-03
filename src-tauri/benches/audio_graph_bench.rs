//! Performance benchmarks for the audio graph system
//!
//! Measures CPU usage, latency, and throughput for core audio components.
//! Uses criterion for statistical benchmarking.

use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId, black_box};
use app_lib::audio::graph::traits::{AudioFormat, AudioSource, AudioSink, AudioProcessor, SampleFormat, AudioBuffer};
use app_lib::audio::sources::SilenceSource;
use app_lib::audio::sinks::NullSink;
use app_lib::audio::processors::{Mixer, MixMode, Resampler, VolumeControl, Normalizer, SilenceDetector};
use std::time::Instant;

/// Helper: Create a test buffer with specified format and sample count
fn create_test_buffer(format: &AudioFormat, frame_count: usize) -> AudioBuffer {
    let sample_count = frame_count * format.channels as usize;
    let samples: Vec<f32> = (0..sample_count)
        .map(|i| (i as f32 / sample_count as f32) * 0.5) // 0.0 to 0.5 amplitude
        .collect();

    AudioBuffer::new(*format, samples, Instant::now())
}

/// Benchmark 1: Mixer Processing (2 inputs)
///
/// Tests: Dual-source mixing performance
/// Format: 48kHz stereo
/// Buffer: 480 samples (10ms)
fn benchmark_mixer_processing(c: &mut Criterion) {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut mixer = Mixer::new(2, MixMode::Weighted).unwrap();
    mixer.set_balance(0, 0.6).unwrap();
    mixer.set_balance(1, 0.4).unwrap();

    let buf1 = create_test_buffer(&format, 480);
    let buf2 = create_test_buffer(&format, 480);

    c.bench_function("mixer_2_inputs_weighted", |b| {
        b.iter(|| {
            let result = mixer.process(vec![buf1.clone(), buf2.clone()]).unwrap();
            black_box(result);
        });
    });
}

/// Benchmark 2: Mixer Processing (Average mode)
fn benchmark_mixer_average_mode(c: &mut Criterion) {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    let buf1 = create_test_buffer(&format, 480);
    let buf2 = create_test_buffer(&format, 480);

    c.bench_function("mixer_2_inputs_average", |b| {
        b.iter(|| {
            let result = mixer.process(vec![buf1.clone(), buf2.clone()]).unwrap();
            black_box(result);
        });
    });
}

/// Benchmark 3: Resampler Processing (16kHz → 48kHz)
///
/// Tests: Upsampling performance
/// Input: 16kHz mono
/// Output: 48kHz mono
/// Buffer: 160 samples (10ms at 16kHz)
fn benchmark_resampler_16_to_48(c: &mut Criterion) {
    let input_format = AudioFormat::new(16000, 1, SampleFormat::F32);
    let mut resampler = Resampler::new(16000, 48000, 1, 160).unwrap();

    let input = create_test_buffer(&input_format, 160);

    c.bench_function("resampler_16_to_48_mono", |b| {
        b.iter(|| {
            let result = resampler.process(input.clone()).unwrap();
            black_box(result);
        });
    });
}

/// Benchmark 4: Resampler Processing (48kHz → 16kHz)
///
/// Tests: Downsampling performance
fn benchmark_resampler_48_to_16(c: &mut Criterion) {
    let input_format = AudioFormat::new(48000, 1, SampleFormat::F32);
    let mut resampler = Resampler::new(48000, 16000, 1, 480).unwrap();

    let input = create_test_buffer(&input_format, 480);

    c.bench_function("resampler_48_to_16_mono", |b| {
        b.iter(|| {
            let result = resampler.process(input.clone()).unwrap();
            black_box(result);
        });
    });
}

/// Benchmark 5: VolumeControl Processing
///
/// Tests: Gain multiplication performance
fn benchmark_volume_control(c: &mut Criterion) {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut volume = VolumeControl::new(0.8); // 80% volume

    let input = create_test_buffer(&format, 480);

    c.bench_function("volume_control", |b| {
        b.iter(|| {
            let result = volume.process(input.clone()).unwrap();
            black_box(result);
        });
    });
}

/// Benchmark 6: Normalizer Processing
///
/// Tests: Peak normalization with look-ahead
fn benchmark_normalizer(c: &mut Criterion) {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut normalizer = Normalizer::new(-3.0, 20.0, 48000);

    let input = create_test_buffer(&format, 480);

    c.bench_function("normalizer_lookahead_20ms", |b| {
        b.iter(|| {
            let result = normalizer.process(input.clone()).unwrap();
            black_box(result);
        });
    });
}

/// Benchmark 7: SilenceDetector (VAD) Processing
///
/// Tests: RMS calculation and silence detection
fn benchmark_silence_detector(c: &mut Criterion) {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut vad = SilenceDetector::new(-40.0, 500.0, 48000);

    let input = create_test_buffer(&format, 480);

    c.bench_function("silence_detector_vad", |b| {
        b.iter(|| {
            let result = vad.process(input.clone()).unwrap();
            black_box(result);
        });
    });
}

/// Benchmark 8: Full Pipeline (Taskerino use case)
///
/// Tests: Source → Mixer → Resampler → Sink
/// Scenario: Dual 16kHz sources → Mix → Upsample to 48kHz → Null sink
fn benchmark_full_pipeline(c: &mut Criterion) {
    c.bench_function("full_pipeline_dual_source", |b| {
        b.iter(|| {
            // Setup
            let input_format = AudioFormat::new(16000, 1, SampleFormat::F32);
            let _output_format = AudioFormat::new(48000, 1, SampleFormat::F32);

            let mut source1 = SilenceSource::new(input_format, 10);
            let mut source2 = SilenceSource::new(input_format, 10);
            let mut mixer = Mixer::new(2, MixMode::Average).unwrap();
            let mut resampler = Resampler::new(16000, 48000, 1, 160).unwrap();
            let mut sink = NullSink::new();

            source1.start().unwrap();
            source2.start().unwrap();

            // Process single buffer through pipeline
            let buf1 = source1.read().unwrap().unwrap();
            let buf2 = source2.read().unwrap().unwrap();
            let mixed = mixer.process(vec![buf1, buf2]).unwrap();
            let resampled = resampler.process(mixed).unwrap();
            if !resampled.samples.is_empty() {
                sink.write(resampled).unwrap();
            }

            source1.stop().unwrap();
            source2.stop().unwrap();
            sink.close().unwrap();
        });
    });
}

/// Benchmark 9: Source Read Performance
///
/// Tests: SilenceSource read overhead
fn benchmark_source_read(c: &mut Criterion) {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut source = SilenceSource::new(format, 10);
    source.start().unwrap();

    c.bench_function("silence_source_read", |b| {
        b.iter(|| {
            let result = source.read().unwrap();
            black_box(result);
        });
    });

    source.stop().unwrap();
}

/// Benchmark 10: Sink Write Performance
///
/// Tests: NullSink write overhead (minimal)
fn benchmark_sink_write(c: &mut Criterion) {
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut sink = NullSink::new();
    let buffer = create_test_buffer(&format, 480);

    c.bench_function("null_sink_write", |b| {
        b.iter(|| {
            sink.write(buffer.clone()).unwrap();
        });
    });

    sink.close().unwrap();
}

/// Benchmark 11: Parameterized Mixer (2-8 inputs)
///
/// Tests: Mixer scaling with input count
fn benchmark_mixer_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("mixer_scaling");
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);

    for num_inputs in [2, 4, 6, 8].iter() {
        let mut mixer = Mixer::new(*num_inputs, MixMode::Average).unwrap();
        let buffers: Vec<AudioBuffer> = (0..*num_inputs)
            .map(|_| create_test_buffer(&format, 480))
            .collect();

        group.bench_with_input(
            BenchmarkId::from_parameter(num_inputs),
            num_inputs,
            |b, _| {
                b.iter(|| {
                    let result = mixer.process(buffers.clone()).unwrap();
                    black_box(result);
                });
            },
        );
    }
    group.finish();
}

/// Benchmark 12: Buffer Size Scaling
///
/// Tests: Processing time vs buffer size
fn benchmark_buffer_size_scaling(c: &mut Criterion) {
    let mut group = c.benchmark_group("buffer_size_scaling");
    let format = AudioFormat::new(48000, 2, SampleFormat::F32);
    let mut mixer = Mixer::new(2, MixMode::Average).unwrap();

    for buffer_size in [128, 256, 512, 1024, 2048].iter() {
        let buf1 = create_test_buffer(&format, *buffer_size);
        let buf2 = create_test_buffer(&format, *buffer_size);

        group.bench_with_input(
            BenchmarkId::from_parameter(buffer_size),
            buffer_size,
            |b, _| {
                b.iter(|| {
                    let result = mixer.process(vec![buf1.clone(), buf2.clone()]).unwrap();
                    black_box(result);
                });
            },
        );
    }
    group.finish();
}

criterion_group!(
    benches,
    benchmark_mixer_processing,
    benchmark_mixer_average_mode,
    benchmark_resampler_16_to_48,
    benchmark_resampler_48_to_16,
    benchmark_volume_control,
    benchmark_normalizer,
    benchmark_silence_detector,
    benchmark_full_pipeline,
    benchmark_source_read,
    benchmark_sink_write,
    benchmark_mixer_scaling,
    benchmark_buffer_size_scaling
);

criterion_main!(benches);
