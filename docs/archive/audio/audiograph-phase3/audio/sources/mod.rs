//! Audio sources module
//!
//! This module provides implementations of the AudioSource trait for various
//! audio input sources (microphone, system audio, silence generator).

// Re-export the AudioSource trait from the graph module
pub use crate::audio::graph::traits::AudioSource;

// Microphone source (cross-platform via cpal)
mod microphone;
pub use microphone::MicrophoneSource;

// System audio source (macOS only via ScreenCaptureKit)
#[cfg(target_os = "macos")]
mod system_audio;
#[cfg(target_os = "macos")]
pub use system_audio::SystemAudioSource;

// Silence source (testing/debugging)
mod silence;
pub use silence::SilenceSource;
