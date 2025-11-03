/**
 * Recording Module
 *
 * Safe Rust abstractions for Swift ScreenRecorder FFI.
 *
 * This module provides:
 * - Memory-safe wrappers around Swift pointers
 * - Type-safe error handling
 * - Multi-source recording session management
 * - Timeout protection for all FFI calls
 *
 * # Architecture
 *
 * ```text
 * SwiftRecordingSession (modern multi-source API)
 *     ↓
 * FFI functions (unsafe Swift calls)
 * ```
 *
 * # Example
 *
 * ```no_run
 * # async fn example() -> Result<(), Box<dyn std::error::Error>> {
 * use recording::SwiftRecordingSession;
 *
 * let mut session = SwiftRecordingSession::new(
 *     "/tmp/recording.mp4",
 *     1920, 1080, 30
 * ).await?;
 *
 * session.add_display(0).await?;
 * session.start().await?;
 *
 * // Record...
 * tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
 *
 * session.stop().await?;
 * # Ok(())
 * # }
 * ```
 */
mod error;
mod ffi;
mod video_audio_merger;

// Public exports
#[allow(unused_imports)] // Will be used by video_recording.rs
pub use error::FFIError;
#[allow(unused_imports)] // Will be used by video_recording.rs
pub use ffi::{
    enumerate_displays, enumerate_webcams, enumerate_windows,
    CompositorType, RecordingStats, RecordingSessionError, SourceType,
    SwiftRecordingSession,
};
#[allow(unused_imports)] // Will be used by video_recording.rs
pub use video_audio_merger::{ExportQuality, MergeError, MergeResult, VideoAudioMerger};
