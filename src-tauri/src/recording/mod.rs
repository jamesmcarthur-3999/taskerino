/**
 * Recording Module
 *
 * Safe Rust abstractions for Swift ScreenRecorder FFI.
 *
 * This module provides:
 * - Memory-safe wrappers around Swift pointers
 * - Type-safe error handling
 * - High-level session management API
 * - Timeout protection for all FFI calls
 *
 * # Architecture
 *
 * ```text
 * RecordingSession (high-level API)
 *     ↓
 * SwiftRecorderHandle (RAII wrapper)
 *     ↓
 * FFI functions (unsafe Swift calls)
 * ```
 *
 * # Example
 *
 * ```no_run
 * # async fn example() -> Result<(), Box<dyn std::error::Error>> {
 * use recording::{RecordingSession, RecordingConfig, VideoQuality};
 * use std::path::PathBuf;
 *
 * let config = RecordingConfig {
 *     session_id: "my-session".to_string(),
 *     output_path: PathBuf::from("/tmp/recording.mp4"),
 *     quality: VideoQuality::MEDIUM,
 * };
 *
 * let session = RecordingSession::start(config).await?;
 *
 * // Record...
 * tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
 *
 * let output = session.stop().await?;
 * println!("Saved to: {:?}", output);
 * # Ok(())
 * # }
 * ```
 */
mod error;
mod ffi;
mod session;

#[cfg(test)]
mod tests;

// Public exports
#[allow(unused_imports)] // Will be used by video_recording.rs
pub use error::FFIError;
#[allow(unused_imports)] // Will be used by video_recording.rs
pub use ffi::SwiftRecorderHandle;
#[allow(unused_imports)] // Will be used by video_recording.rs
pub use session::{RecordingConfig, RecordingSession, VideoQuality};
