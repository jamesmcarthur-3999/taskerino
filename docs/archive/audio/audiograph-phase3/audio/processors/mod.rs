//! Audio processors for the graph-based audio architecture
//!
//! This module provides processors that transform audio buffers as they flow through
//! the audio graph. Processors implement the `AudioProcessor` trait and can be chained
//! together to create complex audio processing pipelines.
//!
//! # Available Processors
//!
//! ## Core Processors
//!
//! - **Mixer**: Combines multiple audio sources into a single stream with configurable
//!   balance and mix modes
//! - **Resampler**: High-quality sample rate conversion using FFT-based resampling
//!
//! ## Utility Processors
//!
//! - **VolumeControl**: Gain adjustment with smooth ramping to avoid clicks
//! - **SilenceDetector**: Voice activity detection (VAD) for cost optimization
//! - **Normalizer**: Peak normalization with look-ahead buffering
//!
//! # Example
//!
//! ```rust,no_run
//! use audio::processors::{Mixer, VolumeControl, SilenceDetector};
//! use audio::graph::traits::{AudioProcessor, AudioBuffer, AudioFormat};
//!
//! // Create a mixer with 2 inputs
//! let mut mixer = Mixer::new(2, MixMode::Average);
//!
//! // Add volume control
//! let mut volume = VolumeControl::new_db(-6.0);
//!
//! // Add silence detection
//! let mut vad = SilenceDetector::new(-40.0, 500.0, 16000);
//! ```

mod mixer;
mod normalizer;
mod resampler;
mod vad;
mod volume;

pub use mixer::{Mixer, MixMode};
pub use normalizer::Normalizer;
pub use resampler::Resampler;
pub use vad::SilenceDetector;
pub use volume::VolumeControl;

// Re-export AudioProcessor trait for convenience
pub use crate::audio::graph::traits::AudioProcessor;
