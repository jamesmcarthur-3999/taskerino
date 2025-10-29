//! Core audio graph traits for modular audio processing
//!
//! This module defines the fundamental building blocks for Taskerino's audio graph
//! architecture. The design follows a node-based approach where audio flows through
//! a directed acyclic graph (DAG) of sources, processors, and sinks.
//!
//! # Design Philosophy
//!
//! 1. **Trait-based abstraction**: All nodes implement core traits (AudioSource,
//!    AudioProcessor, AudioSink) enabling polymorphic composition
//! 2. **Zero-copy where possible**: Use Arc and shared references to avoid buffer copies
//! 3. **Type-safe**: Leverage Rust's type system to prevent invalid configurations
//! 4. **Send + Sync**: All types are thread-safe for multi-threaded processing
//! 5. **Pull-based model**: Sinks pull data from sources through the graph
//!
//! # Example
//!
//! ```rust,no_run
//! use audio::graph::{AudioSource, AudioSink, AudioBuffer};
//!
//! fn process_audio(
//!     source: &mut dyn AudioSource,
//!     sink: &mut dyn AudioSink
//! ) -> Result<(), AudioError> {
//!     source.start()?;
//!
//!     while let Some(buffer) = source.read()? {
//!         sink.write(buffer)?;
//!     }
//!
//!     source.stop()?;
//!     sink.flush()?;
//!     Ok(())
//! }
//! ```

use std::fmt;
use std::sync::Arc;
use std::time::Instant;
use thiserror::Error;

/// Sample format specification for audio buffers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SampleFormat {
    /// 32-bit floating point samples (-1.0 to 1.0)
    F32,
    /// 16-bit signed integer samples
    I16,
    /// 24-bit signed integer samples (stored in i32)
    I24,
    /// 32-bit signed integer samples
    I32,
}

impl SampleFormat {
    /// Size in bytes of a single sample
    pub fn sample_size(&self) -> usize {
        match self {
            SampleFormat::F32 => 4,
            SampleFormat::I16 => 2,
            SampleFormat::I24 => 3,
            SampleFormat::I32 => 4,
        }
    }

    /// Convert a sample to f32 for internal processing
    pub fn to_f32(&self, sample: i32) -> f32 {
        match self {
            SampleFormat::F32 => f32::from_bits(sample as u32),
            SampleFormat::I16 => (sample as i16) as f32 / i16::MAX as f32,
            SampleFormat::I24 => {
                // Sign extend 24-bit to 32-bit
                let extended = if sample & 0x800000 != 0 {
                    sample | 0xFF000000u32 as i32
                } else {
                    sample
                };
                extended as f32 / 8388607.0 // 2^23 - 1
            }
            SampleFormat::I32 => sample as f32 / i32::MAX as f32,
        }
    }

    /// Convert f32 sample to target format
    pub fn from_f32(&self, sample: f32) -> i32 {
        match self {
            SampleFormat::F32 => sample.to_bits() as i32,
            SampleFormat::I16 => (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i32,
            SampleFormat::I24 => {
                let val = (sample.clamp(-1.0, 1.0) * 8388607.0) as i32;
                val & 0xFFFFFF // Mask to 24 bits
            }
            SampleFormat::I32 => (sample.clamp(-1.0, 1.0) * i32::MAX as f32) as i32,
        }
    }
}

/// Audio format specification describing sample rate, channels, and format
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AudioFormat {
    /// Sample rate in Hz (e.g., 16000, 44100, 48000)
    pub sample_rate: u32,
    /// Number of channels (1 = mono, 2 = stereo)
    pub channels: u16,
    /// Sample format (F32, I16, etc.)
    pub sample_format: SampleFormat,
}

impl AudioFormat {
    /// Create a new audio format specification
    pub fn new(sample_rate: u32, channels: u16, sample_format: SampleFormat) -> Self {
        Self {
            sample_rate,
            channels,
            sample_format,
        }
    }

    /// Standard format for speech recognition (16kHz mono)
    pub fn speech() -> Self {
        Self::new(16000, 1, SampleFormat::F32)
    }

    /// Standard format for CD quality audio (44.1kHz stereo)
    pub fn cd_quality() -> Self {
        Self::new(44100, 2, SampleFormat::I16)
    }

    /// Standard format for professional audio (48kHz stereo)
    pub fn professional() -> Self {
        Self::new(48000, 2, SampleFormat::F32)
    }

    /// Calculate bytes per second for this format
    pub fn bytes_per_second(&self) -> usize {
        self.sample_rate as usize
            * self.channels as usize
            * self.sample_format.sample_size()
    }

    /// Check if two formats are compatible (same rate and channels, any format)
    pub fn compatible_with(&self, other: &AudioFormat) -> bool {
        self.sample_rate == other.sample_rate && self.channels == other.channels
    }
}

impl fmt::Display for AudioFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{}Hz {}ch {:?}",
            self.sample_rate, self.channels, self.sample_format
        )
    }
}

/// Audio buffer containing samples with metadata
///
/// Internally, samples are always stored as f32 for consistent processing.
/// The original format is preserved in the AudioFormat metadata.
#[derive(Clone)]
pub struct AudioBuffer {
    /// Format specification
    pub format: AudioFormat,
    /// Audio samples (always f32 internally, interleaved for multi-channel)
    pub samples: Arc<Vec<f32>>,
    /// Timestamp when buffer was captured/created
    pub timestamp: Instant,
    /// Sequence number for ordering (optional)
    pub sequence: Option<u64>,
}

impl AudioBuffer {
    /// Create a new audio buffer
    pub fn new(format: AudioFormat, samples: Vec<f32>, timestamp: Instant) -> Self {
        Self {
            format,
            samples: Arc::new(samples),
            timestamp,
            sequence: None,
        }
    }

    /// Create a new audio buffer with sequence number
    pub fn with_sequence(
        format: AudioFormat,
        samples: Vec<f32>,
        timestamp: Instant,
        sequence: u64,
    ) -> Self {
        Self {
            format,
            samples: Arc::new(samples),
            timestamp,
            sequence: Some(sequence),
        }
    }

    /// Create an empty (silent) buffer with specified duration
    pub fn silent(format: AudioFormat, duration_secs: f32) -> Self {
        let num_samples = (format.sample_rate as f32 * duration_secs) as usize * format.channels as usize;
        Self::new(format, vec![0.0; num_samples], Instant::now())
    }

    /// Get duration in seconds
    pub fn duration_secs(&self) -> f32 {
        self.samples.len() as f32 / (self.format.sample_rate as f32 * self.format.channels as f32)
    }

    /// Get number of frames (samples per channel)
    pub fn num_frames(&self) -> usize {
        self.samples.len() / self.format.channels as usize
    }

    /// Get RMS (Root Mean Square) level for visualization
    pub fn rms(&self) -> f32 {
        if self.samples.is_empty() {
            return 0.0;
        }
        let sum_squares: f32 = self.samples.iter().map(|s| s * s).sum();
        (sum_squares / self.samples.len() as f32).sqrt()
    }

    /// Get peak level for visualization
    pub fn peak(&self) -> f32 {
        self.samples
            .iter()
            .map(|s| s.abs())
            .fold(0.0f32, |a, b| a.max(b))
    }

    /// Check if buffer is effectively silent (below threshold)
    pub fn is_silent(&self, threshold: f32) -> bool {
        self.rms() < threshold
    }

    /// Clone buffer data (creates a new Arc, does not copy samples)
    pub fn clone_data(&self) -> Self {
        Self {
            format: self.format,
            samples: Arc::clone(&self.samples),
            timestamp: self.timestamp,
            sequence: self.sequence,
        }
    }
}

impl fmt::Debug for AudioBuffer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AudioBuffer")
            .field("format", &self.format)
            .field("num_samples", &self.samples.len())
            .field("duration_secs", &self.duration_secs())
            .field("rms", &self.rms())
            .field("peak", &self.peak())
            .field("sequence", &self.sequence)
            .finish()
    }
}

/// Comprehensive audio error types
#[derive(Error, Debug, Clone)]
pub enum AudioError {
    /// Device not found or unavailable
    #[error("Audio device error: {0}")]
    DeviceError(String),

    /// Format not supported by device or processor
    #[error("Unsupported audio format: {0}")]
    FormatError(String),

    /// Configuration is invalid
    #[error("Invalid configuration: {0}")]
    ConfigurationError(String),

    /// Resource is not ready or already in use
    #[error("Resource not ready: {0}")]
    NotReady(String),

    /// Source, processor, or sink is in wrong state
    #[error("Invalid state: {0}")]
    InvalidState(String),

    /// Buffer overflow or underflow
    #[error("Buffer error: {0}")]
    BufferError(String),

    /// Processing error (resampling, mixing, etc.)
    #[error("Processing error: {0}")]
    ProcessingError(String),

    /// I/O error (file, network, etc.)
    #[error("I/O error: {0}")]
    IoError(String),

    /// Timeout waiting for data or operation
    #[error("Timeout: {0}")]
    Timeout(String),

    /// Generic error with custom message
    #[error("{0}")]
    Other(String),
}

/// Audio source that produces audio buffers
///
/// Sources are the entry points to the audio graph. Examples include:
/// - Microphone input (via cpal)
/// - System audio capture (via ScreenCaptureKit)
/// - Per-application audio capture
/// - File playback (for testing)
/// - Silence generator (for testing)
///
/// # Thread Safety
///
/// All AudioSource implementations must be Send + Sync to enable
/// multi-threaded graph processing.
///
/// # State Machine
///
/// Sources follow this state machine:
/// ```text
/// Created → Started → Active → Stopped
///     ↓        ↓        ↓
///     └────────┴────────┘
///          (can restart)
/// ```
pub trait AudioSource: Send + Sync {
    /// Get the output format of this source
    ///
    /// This format defines the sample rate, channel count, and sample format
    /// that will be produced by read() calls.
    fn format(&self) -> AudioFormat;

    /// Start producing audio
    ///
    /// This should initialize any underlying devices or resources and begin
    /// capturing audio. Multiple start() calls should be idempotent.
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Device is not available
    /// - Permissions are missing
    /// - Resource is already in use
    fn start(&mut self) -> Result<(), AudioError>;

    /// Stop producing audio
    ///
    /// This should release any underlying devices or resources. After stop(),
    /// the source should be in a state where start() can be called again.
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Source is not running
    /// - Cleanup fails
    fn stop(&mut self) -> Result<(), AudioError>;

    /// Read next audio buffer (non-blocking)
    ///
    /// Returns Some(buffer) if audio is available, None if no audio is ready yet.
    /// This is non-blocking and should return quickly.
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Source is not started
    /// - Buffer overflow occurred
    /// - Device was disconnected
    fn read(&mut self) -> Result<Option<AudioBuffer>, AudioError>;

    /// Check if source is currently active
    fn is_active(&self) -> bool;

    /// Get source name for debugging/logging
    fn name(&self) -> &str {
        "AudioSource"
    }

    /// Get statistics about the source (optional)
    fn stats(&self) -> SourceStats {
        SourceStats::default()
    }
}

/// Statistics about an audio source
#[derive(Debug, Clone, Default)]
pub struct SourceStats {
    /// Total buffers produced
    pub buffers_produced: u64,
    /// Total samples produced
    pub samples_produced: u64,
    /// Number of buffer overruns
    pub overruns: u64,
    /// Average buffer fullness (0.0 - 1.0)
    pub avg_buffer_fullness: f32,
    /// Last activity timestamp
    pub last_activity: Option<Instant>,
}

/// Audio processor that transforms audio buffers
///
/// Processors sit in the middle of the audio graph, transforming audio as it
/// flows from sources to sinks. Examples include:
/// - Mixer (combine multiple sources)
/// - Resampler (change sample rate)
/// - Volume control (gain adjustment)
/// - Silence detector (VAD)
/// - Compressor (dynamic range compression)
/// - Equalizer (frequency adjustment)
///
/// # Thread Safety
///
/// All AudioProcessor implementations must be Send + Sync.
///
/// # Zero-Copy
///
/// Processors should avoid copying buffers when possible. Use Arc::clone()
/// to share buffer data when the processor doesn't modify samples.
pub trait AudioProcessor: Send + Sync {
    /// Process an input buffer and produce an output buffer
    ///
    /// This is the core processing method. Implementations should:
    /// 1. Validate input buffer format
    /// 2. Transform samples as needed
    /// 3. Return output buffer with appropriate format
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Input format is unsupported
    /// - Processing fails
    /// - Resource exhaustion
    fn process(&mut self, input: AudioBuffer) -> Result<AudioBuffer, AudioError>;

    /// Get the output format given an input format
    ///
    /// This allows the graph to validate format compatibility at construction
    /// time. Some processors (like resampler) change the format, others
    /// (like volume) preserve it.
    fn output_format(&self, input: AudioFormat) -> AudioFormat;

    /// Get processor name for debugging/logging
    fn name(&self) -> &str {
        "AudioProcessor"
    }

    /// Reset processor state (optional, for stateful processors)
    fn reset(&mut self) {
        // Default: no-op
    }

    /// Get statistics about the processor (optional)
    fn stats(&self) -> ProcessorStats {
        ProcessorStats::default()
    }
}

/// Statistics about an audio processor
#[derive(Debug, Clone, Default)]
pub struct ProcessorStats {
    /// Total buffers processed
    pub buffers_processed: u64,
    /// Total samples processed
    pub samples_processed: u64,
    /// Average processing time per buffer (microseconds)
    pub avg_processing_time_us: u64,
    /// Number of processing errors
    pub errors: u64,
}

/// Audio sink that consumes audio buffers
///
/// Sinks are the exit points of the audio graph. Examples include:
/// - File encoder (WAV, MP3, Opus)
/// - Network streamer
/// - Audio output device (speakers)
/// - Buffer accumulator (for preview)
/// - Null sink (discard, for testing)
///
/// # Thread Safety
///
/// All AudioSink implementations must be Send + Sync.
///
/// # Buffering
///
/// Sinks should implement internal buffering to handle bursty input.
/// The flush() method ensures all buffered data is written.
pub trait AudioSink: Send + Sync {
    /// Write an audio buffer to the sink
    ///
    /// This should accept the buffer and queue it for writing. The method
    /// should return quickly and not block on I/O.
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Sink is not open/ready
    /// - Buffer format is incompatible
    /// - Write would overflow buffer
    /// - I/O error occurred
    fn write(&mut self, buffer: AudioBuffer) -> Result<(), AudioError>;

    /// Flush any pending data
    ///
    /// This ensures all buffered data is written to the underlying storage
    /// or device. Should be called before closing the sink.
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Flush operation fails
    /// - I/O error occurred
    fn flush(&mut self) -> Result<(), AudioError>;

    /// Get sink name for debugging/logging
    fn name(&self) -> &str {
        "AudioSink"
    }

    /// Close the sink and release resources
    ///
    /// Default implementation calls flush(). Override if additional cleanup
    /// is needed.
    fn close(&mut self) -> Result<(), AudioError> {
        self.flush()
    }

    /// Get statistics about the sink (optional)
    fn stats(&self) -> SinkStats {
        SinkStats::default()
    }
}

/// Statistics about an audio sink
#[derive(Debug, Clone, Default)]
pub struct SinkStats {
    /// Total buffers written
    pub buffers_written: u64,
    /// Total samples written
    pub samples_written: u64,
    /// Total bytes written
    pub bytes_written: u64,
    /// Number of write errors
    pub errors: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sample_format_conversions() {
        // F32 round-trip
        let f32_val = 0.5f32;
        let converted = SampleFormat::F32.to_f32(SampleFormat::F32.from_f32(f32_val));
        assert!((converted - f32_val).abs() < 0.001);

        // I16 round-trip
        let i16_val = 0.5f32;
        let converted = SampleFormat::I16.to_f32(SampleFormat::I16.from_f32(i16_val));
        assert!((converted - i16_val).abs() < 0.001);
    }

    #[test]
    fn test_audio_format_compatibility() {
        let fmt1 = AudioFormat::new(48000, 2, SampleFormat::F32);
        let fmt2 = AudioFormat::new(48000, 2, SampleFormat::I16);
        let fmt3 = AudioFormat::new(44100, 2, SampleFormat::F32);

        assert!(fmt1.compatible_with(&fmt2)); // Same rate and channels
        assert!(!fmt1.compatible_with(&fmt3)); // Different rate
    }

    #[test]
    fn test_audio_buffer_metrics() {
        let format = AudioFormat::speech();
        let samples = vec![0.0, 0.5, -0.5, 1.0, -1.0]; // 5 samples
        let buffer = AudioBuffer::new(format, samples, Instant::now());

        assert_eq!(buffer.num_frames(), 5);
        assert!(buffer.rms() > 0.0);
        assert_eq!(buffer.peak(), 1.0);
        assert!(!buffer.is_silent(0.1));
    }

    #[test]
    fn test_silent_buffer() {
        let format = AudioFormat::speech();
        let buffer = AudioBuffer::silent(format, 1.0); // 1 second

        assert_eq!(buffer.num_frames(), 16000); // 16kHz
        assert!(buffer.is_silent(0.001));
        assert_eq!(buffer.peak(), 0.0);
    }

    #[test]
    fn test_format_bytes_per_second() {
        let format = AudioFormat::new(48000, 2, SampleFormat::F32);
        assert_eq!(format.bytes_per_second(), 48000 * 2 * 4); // 384000
    }
}
