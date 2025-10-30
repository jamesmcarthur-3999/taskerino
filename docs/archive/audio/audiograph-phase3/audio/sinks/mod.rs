//! Audio sinks for consuming and encoding audio buffers
//!
//! This module provides implementations of the AudioSink trait for various
//! output destinations:
//!
//! - `WavEncoderSink`: High-quality WAV file encoding using hound
//! - `BufferSink`: In-memory accumulator for testing and preview
//! - `NullSink`: Discards audio (for benchmarking)
//!
//! # Example
//!
//! ```rust,no_run
//! use audio::sinks::WavEncoderSink;
//! use audio::graph::traits::AudioSink;
//!
//! let mut sink = WavEncoderSink::new("output.wav", AudioFormat::speech())?;
//! sink.write(buffer)?;
//! sink.close()?;
//! ```

// Re-export the AudioSink trait for convenience
pub use crate::audio::graph::traits::AudioSink;

mod wav_encoder;
pub use wav_encoder::WavEncoderSink;

mod buffer;
pub use buffer::BufferSink;

mod null;
pub use null::NullSink;
