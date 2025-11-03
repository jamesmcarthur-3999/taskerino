/**
 * Video/Audio Merger FFI Wrapper
 *
 * Safe Rust wrapper around Swift VideoAudioMerger C FFI.
 *
 * This module provides:
 * - Safe async interface for merging video and audio files
 * - Type-safe error handling
 * - Progress reporting via callbacks
 * - Memory-safe CString handling
 * - Thread-safe callback execution
 *
 * # Architecture
 *
 * ```text
 * VideoAudioMerger::merge() (async Rust API)
 *     ↓
 * tokio::sync::oneshot (async coordination)
 *     ↓
 * merge_video_and_audio() (extern "C" Swift FFI)
 *     ↓
 * Callbacks (extern "C" Rust → Rust)
 * ```
 *
 * # Example
 *
 * ```no_run
 * # async fn example() -> Result<(), Box<dyn std::error::Error>> {
 * use recording::video_audio_merger::{VideoAudioMerger, ExportQuality, MergeResult};
 *
 * let result = VideoAudioMerger::merge(
 *     "/path/to/video.mp4",
 *     "/path/to/audio.m4a",
 *     "/path/to/output.mp4",
 *     ExportQuality::Medium,
 *     Some(Box::new(|progress| {
 *         println!("Progress: {:.1}%", progress * 100.0);
 *     }))
 * ).await?;
 *
 * println!("Merged: {} bytes", result.file_size);
 * # Ok(())
 * # }
 * ```
 *
 * # Swift Implementation
 *
 * - File: `ScreenRecorder/VideoAudioMerger.swift`
 * - Header: `ScreenRecorder/VideoAudioMerger.h`
 * - FFI Functions: `merge_video_and_audio`, `free_merge_string`
 */

use std::ffi::{CString, CStr};
use std::os::raw::{c_char, c_int};
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

use super::error::FFIError;

// MARK: - FFI Declarations

// External Swift FFI functions for video/audio merging
extern "C" {
    /// Merge video and audio files into single MP4
    ///
    /// # Parameters
    /// - `video_path`: C string path to video file
    /// - `audio_path`: C string path to audio file
    /// - `output_path`: C string path for output file
    /// - `quality`: Quality preset (0=Low, 1=Medium, 2=High)
    /// - `progress_callback`: Progress callback (0.0-1.0)
    /// - `completion_callback`: Completion callback (error string or NULL, success bool)
    ///
    /// # Notes
    /// - Function returns immediately (async in Swift)
    /// - Callbacks invoked on main thread
    /// - Error strings must be freed with `free_merge_string`
    fn merge_video_and_audio(
        video_path: *const c_char,
        audio_path: *const c_char,
        output_path: *const c_char,
        quality: c_int,
        progress_callback: extern "C" fn(f64),
        completion_callback: extern "C" fn(*const c_char, bool),
    );

    /// Free string allocated by Swift
    ///
    /// REQUIRED: Must call for all error strings from completion callback.
    fn free_merge_string(string: *mut c_char);
}

// MARK: - Rust Types

/// Export quality preset for video/audio merging
///
/// Maps to Swift `ExportQuality` enum and AVFoundation export presets.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(i32)]
pub enum ExportQuality {
    /// Low quality - AVAssetExportPresetMediumQuality
    /// - Size: ~40% of input
    /// - Speed: Fast
    /// - Use: Quick preview, temporary files
    Low = 0,

    /// Medium quality - AVAssetExportPresetHighQuality (DEFAULT)
    /// - Size: ~60% of input
    /// - Speed: Balanced
    /// - Use: Normal session recordings
    Medium = 1,

    /// High quality - AVAssetExportPresetHEVCHighestQuality
    /// - Size: ~80% of input
    /// - Speed: Slow
    /// - Use: Important sessions, archival
    High = 2,
}

impl Default for ExportQuality {
    fn default() -> Self {
        ExportQuality::Medium
    }
}

impl ExportQuality {
    /// Parse quality from string
    ///
    /// # Examples
    /// ```
    /// # use recording::video_audio_merger::ExportQuality;
    /// assert_eq!(ExportQuality::from_str("low"), Some(ExportQuality::Low));
    /// assert_eq!(ExportQuality::from_str("medium"), Some(ExportQuality::Medium));
    /// assert_eq!(ExportQuality::from_str("high"), Some(ExportQuality::High));
    /// assert_eq!(ExportQuality::from_str("invalid"), None);
    /// ```
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "low" => Some(ExportQuality::Low),
            "medium" => Some(ExportQuality::Medium),
            "high" => Some(ExportQuality::High),
            _ => None,
        }
    }

    /// Get human-readable name
    pub fn display_name(&self) -> &'static str {
        match self {
            ExportQuality::Low => "Low",
            ExportQuality::Medium => "Medium",
            ExportQuality::High => "High",
        }
    }
}

/// Result of successful merge operation
///
/// Contains metadata about the merged video file.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct MergeResult {
    /// Output file path
    pub output_path: String,

    /// Total duration in seconds
    pub duration: f64,

    /// Output file size in bytes
    pub file_size: u64,

    /// Compression ratio (output_size / input_size)
    ///
    /// Example: 0.4 = 60% size reduction
    pub compression_ratio: f64,
}

/// Errors specific to video/audio merging
///
/// Extends base `FFIError` with merge-specific error types.
#[derive(Debug, Clone, PartialEq)]
pub enum MergeError {
    /// Video file not found
    VideoNotFound(String),

    /// Audio file not found
    AudioNotFound(String),

    /// Video file contains no video track
    NoVideoTrack,

    /// Audio file contains no audio track
    NoAudioTrack,

    /// Composition failed (AVFoundation error)
    CompositionFailed(String),

    /// Export failed (AVAssetExportSession error)
    ExportFailed(String),

    /// Export was cancelled by user
    Cancelled,

    /// Invalid track duration
    InvalidDuration,

    /// Output file already exists
    OutputFileExists(String),

    /// File system error
    FileSystemError(String),

    /// Generic FFI error
    FFI(FFIError),
}

impl std::fmt::Display for MergeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MergeError::VideoNotFound(path) => write!(f, "Video file not found: {}", path),
            MergeError::AudioNotFound(path) => write!(f, "Audio file not found: {}", path),
            MergeError::NoVideoTrack => write!(f, "Video file contains no video track"),
            MergeError::NoAudioTrack => write!(f, "Audio file contains no audio track"),
            MergeError::CompositionFailed(msg) => write!(f, "Composition failed: {}", msg),
            MergeError::ExportFailed(msg) => write!(f, "Export failed: {}", msg),
            MergeError::Cancelled => write!(f, "Export was cancelled"),
            MergeError::InvalidDuration => write!(f, "Invalid track duration"),
            MergeError::OutputFileExists(path) => write!(f, "Output file already exists: {}", path),
            MergeError::FileSystemError(msg) => write!(f, "File system error: {}", msg),
            MergeError::FFI(err) => write!(f, "FFI error: {}", err),
        }
    }
}

impl std::error::Error for MergeError {}

impl From<FFIError> for MergeError {
    fn from(err: FFIError) -> Self {
        MergeError::FFI(err)
    }
}

/// Parse error string from Swift into MergeError
///
/// Maps Swift error messages to typed Rust errors.
fn parse_swift_error(error_msg: &str) -> MergeError {
    if error_msg.contains("Video file not found") {
        let path = error_msg.split(": ").nth(1).unwrap_or("unknown");
        MergeError::VideoNotFound(path.to_string())
    } else if error_msg.contains("Audio file not found") {
        let path = error_msg.split(": ").nth(1).unwrap_or("unknown");
        MergeError::AudioNotFound(path.to_string())
    } else if error_msg.contains("no video track") {
        MergeError::NoVideoTrack
    } else if error_msg.contains("no audio track") {
        MergeError::NoAudioTrack
    } else if error_msg.contains("Composition failed") {
        let details = error_msg.split(": ").nth(1).unwrap_or("unknown");
        MergeError::CompositionFailed(details.to_string())
    } else if error_msg.contains("Export failed") {
        let details = error_msg.split(": ").nth(1).unwrap_or("unknown");
        MergeError::ExportFailed(details.to_string())
    } else if error_msg.contains("cancelled") {
        MergeError::Cancelled
    } else if error_msg.contains("Invalid track duration") {
        MergeError::InvalidDuration
    } else if error_msg.contains("Output file already exists") {
        let path = error_msg.split(": ").nth(1).unwrap_or("unknown");
        MergeError::OutputFileExists(path.to_string())
    } else if error_msg.contains("File system error") {
        let details = error_msg.split(": ").nth(1).unwrap_or("unknown");
        MergeError::FileSystemError(details.to_string())
    } else {
        // Generic export failure for unknown errors
        MergeError::ExportFailed(error_msg.to_string())
    }
}

// MARK: - Callback State Management

/// Thread-safe state for async callbacks
///
/// Stores completion channel and progress callback for FFI callbacks.
/// Uses Arc<Mutex> for thread-safe access from extern "C" callbacks.
struct CallbackState {
    /// Oneshot sender for completion signal
    completion_tx: Option<oneshot::Sender<Result<(), MergeError>>>,

    /// Optional progress callback
    progress_callback: Option<Box<dyn Fn(f64) + Send + 'static>>,
}

/// Global callback state for current merge operation
///
/// Only one merge can be active at a time (enforced by Swift global merger).
static CALLBACK_STATE: Mutex<Option<Arc<Mutex<CallbackState>>>> = Mutex::new(None);

/// Set the global callback state for a new merge operation
fn set_callback_state(state: Arc<Mutex<CallbackState>>) {
    let mut global = CALLBACK_STATE.lock().unwrap();
    *global = Some(state);
}

/// Clear the global callback state after merge completes
fn clear_callback_state() {
    let mut global = CALLBACK_STATE.lock().unwrap();
    *global = None;
}

/// Get the current callback state (if any)
fn get_callback_state() -> Option<Arc<Mutex<CallbackState>>> {
    let global = CALLBACK_STATE.lock().unwrap();
    global.clone()
}

// MARK: - FFI Callbacks

/// Progress callback invoked by Swift
///
/// Called periodically during export (10Hz = 100ms intervals).
/// Progress ranges from 0.0 (start) to 1.0 (complete).
extern "C" fn rust_progress_callback(progress: f64) {
    if let Some(state) = get_callback_state() {
        let state = state.lock().unwrap();
        if let Some(ref callback) = state.progress_callback {
            callback(progress);
        }
    }
}

/// Completion callback invoked by Swift
///
/// Called once when export completes (success or failure).
///
/// # Parameters
/// - `error`: C string error message (or NULL on success)
/// - `success`: true if merge succeeded, false otherwise
///
/// # Memory Safety
/// - Error string allocated by Swift via `strdup`
/// - MUST call `free_merge_string` to free the string
extern "C" fn rust_completion_callback(error: *const c_char, success: bool) {
    // Get the callback state
    let state = match get_callback_state() {
        Some(state) => state,
        None => {
            eprintln!("❌ [MERGE FFI] Completion callback called but no state found");
            return;
        }
    };

    // Extract completion sender
    let completion_tx = {
        let mut state = state.lock().unwrap();
        state.completion_tx.take()
    };

    // Parse result
    let result = if success {
        println!("✅ [MERGE FFI] Merge completed successfully");
        Ok(())
    } else if !error.is_null() {
        // SAFETY: Error string allocated by Swift, valid UTF-8
        let error_msg = unsafe {
            CStr::from_ptr(error)
                .to_str()
                .unwrap_or("Unknown error")
                .to_string()
        };

        println!("❌ [MERGE FFI] Merge failed: {}", error_msg);

        // Free the error string (CRITICAL for memory safety)
        unsafe {
            free_merge_string(error as *mut c_char);
        }

        Err(parse_swift_error(&error_msg))
    } else {
        eprintln!("❌ [MERGE FFI] Merge failed but no error message provided");
        Err(MergeError::ExportFailed("Unknown error".to_string()))
    };

    // Signal completion
    if let Some(tx) = completion_tx {
        let _ = tx.send(result);
    }

    // Clear global state
    clear_callback_state();
}

// MARK: - VideoAudioMerger API

/// Main API for video/audio merging
///
/// Provides a safe async interface for merging video and audio files.
pub struct VideoAudioMerger;

impl VideoAudioMerger {
    /// Merge video and audio files into single MP4
    ///
    /// Merges separate video and audio files using AVFoundation.
    /// The operation is asynchronous and reports progress via callback.
    ///
    /// # Parameters
    /// - `video_path`: Path to video file (MP4, MOV, no audio required)
    /// - `audio_path`: Path to audio file (MP3, WAV, M4A, AAC)
    /// - `output_path`: Path for output MP4 file
    /// - `quality`: Export quality preset
    /// - `progress_callback`: Optional progress callback (0.0-1.0)
    ///
    /// # Returns
    /// `MergeResult` on success with output metadata
    ///
    /// # Errors
    /// Returns `MergeError` if:
    /// - Video or audio file not found
    /// - Files contain no valid tracks
    /// - Composition or export fails
    /// - Operation is cancelled
    ///
    /// # Example
    /// ```no_run
    /// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
    /// use recording::video_audio_merger::{VideoAudioMerger, ExportQuality};
    ///
    /// let result = VideoAudioMerger::merge(
    ///     "/tmp/video.mp4",
    ///     "/tmp/audio.m4a",
    ///     "/tmp/output.mp4",
    ///     ExportQuality::Medium,
    ///     Some(Box::new(|p| println!("Progress: {:.0}%", p * 100.0)))
    /// ).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn merge(
        video_path: &str,
        audio_path: &str,
        output_path: &str,
        quality: ExportQuality,
        progress_callback: Option<Box<dyn Fn(f64) + Send + 'static>>,
    ) -> Result<MergeResult, MergeError> {
        println!("🎬 [MERGE FFI] Starting merge:");
        println!("   Video: {}", video_path);
        println!("   Audio: {}", audio_path);
        println!("   Output: {}", output_path);
        println!("   Quality: {}", quality.display_name());

        // Convert Rust strings to CStrings
        let video_c = CString::new(video_path)
            .map_err(|_| FFIError::InvalidConfig("Video path contains null byte".to_string()))?;
        let audio_c = CString::new(audio_path)
            .map_err(|_| FFIError::InvalidConfig("Audio path contains null byte".to_string()))?;
        let output_c = CString::new(output_path)
            .map_err(|_| FFIError::InvalidConfig("Output path contains null byte".to_string()))?;

        // Create oneshot channel for async completion
        let (tx, rx) = oneshot::channel();

        // Create callback state
        let state = Arc::new(Mutex::new(CallbackState {
            completion_tx: Some(tx),
            progress_callback,
        }));

        // Set global callback state
        set_callback_state(state);

        // Call Swift FFI function
        // SAFETY:
        // - CStrings are valid for the duration of the call
        // - Callbacks are extern "C" functions with correct signatures
        // - Swift retains callbacks until completion
        unsafe {
            merge_video_and_audio(
                video_c.as_ptr(),
                audio_c.as_ptr(),
                output_c.as_ptr(),
                quality as c_int,
                rust_progress_callback,
                rust_completion_callback,
            );
        }

        println!("🚀 [MERGE FFI] Swift merge started, awaiting completion...");

        // Await completion signal from callback
        match rx.await {
            Ok(Ok(())) => {
                // Success - query file metadata
                let file_size = std::fs::metadata(output_path)
                    .map(|m| m.len())
                    .unwrap_or(0);

                // Calculate compression ratio (requires input sizes)
                let video_size = std::fs::metadata(video_path)
                    .map(|m| m.len())
                    .unwrap_or(0);
                let audio_size = std::fs::metadata(audio_path)
                    .map(|m| m.len())
                    .unwrap_or(0);
                let input_size = video_size + audio_size;
                let compression_ratio = if input_size > 0 {
                    file_size as f64 / input_size as f64
                } else {
                    1.0
                };

                println!("✅ [MERGE FFI] Merge complete:");
                println!("   Size: {} bytes", file_size);
                println!("   Compression: {:.1}% of input", compression_ratio * 100.0);

                Ok(MergeResult {
                    output_path: output_path.to_string(),
                    duration: 0.0, // Swift doesn't return duration yet
                    file_size,
                    compression_ratio,
                })
            }
            Ok(Err(err)) => {
                // Swift returned error
                Err(err)
            }
            Err(_) => {
                // Oneshot receiver dropped (shouldn't happen)
                Err(MergeError::ExportFailed(
                    "Completion callback was not called".to_string(),
                ))
            }
        }
    }
}

// MARK: - Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_quality_from_str() {
        assert_eq!(ExportQuality::from_str("low"), Some(ExportQuality::Low));
        assert_eq!(ExportQuality::from_str("LOW"), Some(ExportQuality::Low));
        assert_eq!(ExportQuality::from_str("medium"), Some(ExportQuality::Medium));
        assert_eq!(ExportQuality::from_str("high"), Some(ExportQuality::High));
        assert_eq!(ExportQuality::from_str("invalid"), None);
    }

    #[test]
    fn test_export_quality_default() {
        assert_eq!(ExportQuality::default(), ExportQuality::Medium);
    }

    #[test]
    fn test_export_quality_display_name() {
        assert_eq!(ExportQuality::Low.display_name(), "Low");
        assert_eq!(ExportQuality::Medium.display_name(), "Medium");
        assert_eq!(ExportQuality::High.display_name(), "High");
    }

    #[test]
    fn test_parse_swift_error_video_not_found() {
        let err = parse_swift_error("Video file not found: /path/to/video.mp4");
        assert!(matches!(err, MergeError::VideoNotFound(_)));
        if let MergeError::VideoNotFound(path) = err {
            assert_eq!(path, "/path/to/video.mp4");
        }
    }

    #[test]
    fn test_parse_swift_error_audio_not_found() {
        let err = parse_swift_error("Audio file not found: /path/to/audio.mp3");
        assert!(matches!(err, MergeError::AudioNotFound(_)));
    }

    #[test]
    fn test_parse_swift_error_no_video_track() {
        let err = parse_swift_error("Video file contains no video track");
        assert!(matches!(err, MergeError::NoVideoTrack));
    }

    #[test]
    fn test_parse_swift_error_cancelled() {
        let err = parse_swift_error("Export was cancelled");
        assert!(matches!(err, MergeError::Cancelled));
    }

    #[test]
    fn test_parse_swift_error_generic() {
        let err = parse_swift_error("Some unknown error");
        assert!(matches!(err, MergeError::ExportFailed(_)));
    }

    #[test]
    fn test_merge_error_display() {
        let err = MergeError::VideoNotFound("/path/video.mp4".to_string());
        assert_eq!(err.to_string(), "Video file not found: /path/video.mp4");

        let err = MergeError::Cancelled;
        assert_eq!(err.to_string(), "Export was cancelled");
    }

    #[test]
    fn test_merge_result_equality() {
        let result1 = MergeResult {
            output_path: "/tmp/output.mp4".to_string(),
            duration: 30.0,
            file_size: 1024,
            compression_ratio: 0.5,
        };

        let result2 = MergeResult {
            output_path: "/tmp/output.mp4".to_string(),
            duration: 30.0,
            file_size: 1024,
            compression_ratio: 0.5,
        };

        assert_eq!(result1, result2);
    }

    // Note: Integration tests with actual Swift FFI should be in separate
    // integration test files where we can set up the Swift runtime properly.
}
