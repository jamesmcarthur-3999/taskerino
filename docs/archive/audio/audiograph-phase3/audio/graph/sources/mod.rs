//! Audio graph sources module

pub mod microphone;

#[cfg(test)]
mod tests;

pub use microphone::MicrophoneSource;
