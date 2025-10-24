/**
 * Recording Session Management
 *
 * Provides high-level API for managing screen recording sessions with:
 * - Single-use pattern (consumes self on stop)
 * - Type-safe state tracking
 * - Automatic cleanup
 */

use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

use super::error::FFIError;
use super::ffi::SwiftRecorderHandle;

/// Video quality presets
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VideoQuality {
    pub width: i32,
    pub height: i32,
    pub fps: i32,
}

impl VideoQuality {
    /// 480p @ 15fps (low file size, good for long sessions)
    pub const LOW: Self = Self {
        width: 854,
        height: 480,
        fps: 15,
    };

    /// 720p @ 15fps (default - good balance)
    pub const MEDIUM: Self = Self {
        width: 1280,
        height: 720,
        fps: 15,
    };

    /// 1080p @ 30fps (high quality)
    pub const HIGH: Self = Self {
        width: 1920,
        height: 1080,
        fps: 30,
    };

    /// 1440p @ 30fps (ultra quality)
    pub const ULTRA: Self = Self {
        width: 2560,
        height: 1440,
        fps: 30,
    };
}

impl Default for VideoQuality {
    fn default() -> Self {
        Self::MEDIUM
    }
}

/// Configuration for a recording session
#[derive(Debug, Clone)]
pub struct RecordingConfig {
    pub session_id: String,
    pub output_path: PathBuf,
    pub quality: VideoQuality,
}

/// State of a recording session
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RecordingState {
    Active,
    Stopped,
}

/// A recording session that manages the lifecycle of a Swift recorder
///
/// This type uses the "consume on stop" pattern to prevent:
/// - Double-stop bugs
/// - Use-after-stop errors
/// - Leaked recorders
///
/// # Example
///
/// ```no_run
/// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
/// use std::path::PathBuf;
/// use recording::{RecordingSession, RecordingConfig, VideoQuality};
///
/// let config = RecordingConfig {
///     session_id: "test-session".to_string(),
///     output_path: PathBuf::from("/tmp/test.mp4"),
///     quality: VideoQuality::default(),
/// };
///
/// let session = RecordingSession::start(config).await?;
///
/// // ... record ...
///
/// let output_path = session.stop().await?;
/// println!("Video saved to: {:?}", output_path);
/// # Ok(())
/// # }
/// ```
pub struct RecordingSession {
    handle: Arc<Mutex<Option<SwiftRecorderHandle>>>,
    session_id: String,
    output_path: PathBuf,
    state: Arc<Mutex<RecordingState>>,
}

impl RecordingSession {
    /// Start a new recording session
    ///
    /// # Errors
    ///
    /// Returns `FFIError` if:
    /// - Failed to create Swift recorder (timeout, null pointer)
    /// - Failed to start recording (Swift error)
    /// - Output path is invalid
    pub async fn start(config: RecordingConfig) -> Result<Self, FFIError> {
        // Validate output path
        let parent = config.output_path.parent().ok_or_else(|| {
            FFIError::InvalidConfig("Output path has no parent directory".to_string())
        })?;

        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| {
                FFIError::IoError(format!("Failed to create output directory: {}", e))
            })?;
        }

        // Create Swift recorder handle
        let handle = SwiftRecorderHandle::create().await?;

        // Convert path to string
        let path_str = config.output_path.to_str().ok_or_else(|| {
            FFIError::InvalidConfig("Output path contains invalid UTF-8".to_string())
        })?;

        // Start recording
        handle
            .start(
                path_str,
                config.quality.width,
                config.quality.height,
                config.quality.fps,
            )
            .await?;

        Ok(Self {
            handle: Arc::new(Mutex::new(Some(handle))),
            session_id: config.session_id,
            output_path: config.output_path,
            state: Arc::new(Mutex::new(RecordingState::Active)),
        })
    }

    /// Stop recording and return the output path
    ///
    /// This consumes the session to prevent double-stop bugs.
    ///
    /// # Errors
    ///
    /// Returns `FFIError` if:
    /// - Session already stopped
    /// - Swift stop failed
    pub async fn stop(self) -> Result<PathBuf, FFIError> {
        // Check state
        let mut state = self.state.lock().await;
        if *state == RecordingState::Stopped {
            return Err(FFIError::AlreadyStopped);
        }

        // Get handle
        let mut handle_lock = self.handle.lock().await;
        let handle = handle_lock.take().ok_or(FFIError::AlreadyStopped)?;

        // Stop recording
        handle.stop().await?;

        // Update state
        *state = RecordingState::Stopped;

        // Clone output path before consuming self
        let output = self.output_path.clone();

        // Return output path
        Ok(output)
    }

    /// Check if session is currently recording
    pub async fn is_recording(&self) -> bool {
        let state = self.state.lock().await;
        *state == RecordingState::Active
    }

    /// Get the session ID
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Get the output path
    pub fn output_path(&self) -> &PathBuf {
        &self.output_path
    }
}

// Automatic cleanup on drop
impl Drop for RecordingSession {
    fn drop(&mut self) {
        // If session is still active, we need to stop it
        // We can't use async in Drop, so we spawn a blocking task
        let handle = self.handle.clone();
        let state = self.state.clone();

        tokio::spawn(async move {
            let current_state = *state.lock().await;
            if current_state == RecordingState::Active {
                let mut handle_lock = handle.lock().await;
                if let Some(recorder) = handle_lock.take() {
                    // Try to stop gracefully, but don't panic if it fails
                    if let Err(e) = recorder.stop().await {
                        eprintln!("Warning: Failed to stop recorder in drop: {}", e);
                    }
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_video_quality_presets() {
        assert_eq!(VideoQuality::LOW.width, 854);
        assert_eq!(VideoQuality::MEDIUM.width, 1280);
        assert_eq!(VideoQuality::HIGH.width, 1920);
        assert_eq!(VideoQuality::ULTRA.width, 2560);
    }

    #[test]
    fn test_video_quality_default() {
        let default = VideoQuality::default();
        assert_eq!(default, VideoQuality::MEDIUM);
    }

    #[test]
    fn test_recording_config_clone() {
        let config = RecordingConfig {
            session_id: "test".to_string(),
            output_path: PathBuf::from("/tmp/test.mp4"),
            quality: VideoQuality::HIGH,
        };
        let cloned = config.clone();
        assert_eq!(config.session_id, cloned.session_id);
        assert_eq!(config.output_path, cloned.output_path);
        assert_eq!(config.quality, cloned.quality);
    }

    // Note: Tests that actually start/stop recording require integration tests
    // with the Swift runtime available
}
