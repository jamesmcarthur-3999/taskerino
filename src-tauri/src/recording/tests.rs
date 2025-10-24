/**
 * Unit Tests for Recording Module
 *
 * These tests verify the safety and correctness of the FFI wrappers
 * without requiring the full Swift runtime.
 */

use super::*;

#[cfg(test)]
mod error_tests {
    use super::*;

    #[test]
    fn test_all_error_variants_display() {
        let errors = vec![
            FFIError::NullPointer,
            FFIError::Timeout,
            FFIError::InvalidState("test state".to_string()),
            FFIError::SwiftError("swift error".to_string()),
            FFIError::AlreadyStarted,
            FFIError::AlreadyStopped,
            FFIError::NotRecording,
            FFIError::CurrentlyRecording,
            FFIError::InvalidConfig("bad config".to_string()),
            FFIError::IoError("io failed".to_string()),
        ];

        for error in errors {
            let display = error.to_string();
            assert!(!display.is_empty(), "Error display should not be empty");
        }
    }

    #[test]
    fn test_error_equality() {
        assert_eq!(FFIError::NullPointer, FFIError::NullPointer);
        assert_ne!(FFIError::NullPointer, FFIError::Timeout);
        assert_eq!(
            FFIError::InvalidState("a".to_string()),
            FFIError::InvalidState("a".to_string())
        );
        assert_ne!(
            FFIError::InvalidState("a".to_string()),
            FFIError::InvalidState("b".to_string())
        );
    }

    #[test]
    fn test_error_from_io_error() {
        use std::io::{Error, ErrorKind};

        let io_err = Error::new(ErrorKind::NotFound, "file not found");
        let ffi_err: FFIError = io_err.into();

        assert!(matches!(ffi_err, FFIError::IoError(_)));
        assert!(ffi_err.to_string().contains("file not found"));
    }

    #[test]
    fn test_error_into_string() {
        let err = FFIError::Timeout;
        let s: String = err.into();
        assert_eq!(s, "FFI operation timed out");
    }
}

#[cfg(test)]
mod video_quality_tests {
    use super::*;

    #[test]
    fn test_quality_presets_have_correct_values() {
        assert_eq!(VideoQuality::LOW.width, 854);
        assert_eq!(VideoQuality::LOW.height, 480);
        assert_eq!(VideoQuality::LOW.fps, 15);

        assert_eq!(VideoQuality::MEDIUM.width, 1280);
        assert_eq!(VideoQuality::MEDIUM.height, 720);
        assert_eq!(VideoQuality::MEDIUM.fps, 15);

        assert_eq!(VideoQuality::HIGH.width, 1920);
        assert_eq!(VideoQuality::HIGH.height, 1080);
        assert_eq!(VideoQuality::HIGH.fps, 30);

        assert_eq!(VideoQuality::ULTRA.width, 2560);
        assert_eq!(VideoQuality::ULTRA.height, 1440);
        assert_eq!(VideoQuality::ULTRA.fps, 30);
    }

    #[test]
    fn test_quality_default_is_medium() {
        let default = VideoQuality::default();
        assert_eq!(default, VideoQuality::MEDIUM);
    }

    #[test]
    fn test_quality_equality() {
        assert_eq!(VideoQuality::MEDIUM, VideoQuality::MEDIUM);
        assert_ne!(VideoQuality::LOW, VideoQuality::HIGH);

        let custom1 = VideoQuality {
            width: 1920,
            height: 1080,
            fps: 30,
        };
        let custom2 = VideoQuality {
            width: 1920,
            height: 1080,
            fps: 30,
        };
        assert_eq!(custom1, custom2);
        assert_eq!(custom1, VideoQuality::HIGH);
    }

    #[test]
    fn test_quality_copy() {
        let q1 = VideoQuality::HIGH;
        let q2 = q1; // Should copy, not move
        assert_eq!(q1, q2);
        assert_eq!(q1, VideoQuality::HIGH); // q1 still accessible
    }
}

#[cfg(test)]
mod recording_config_tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_config_creation() {
        let config = RecordingConfig {
            session_id: "test-session".to_string(),
            output_path: PathBuf::from("/tmp/test.mp4"),
            quality: VideoQuality::HIGH,
        };

        assert_eq!(config.session_id, "test-session");
        assert_eq!(config.output_path, PathBuf::from("/tmp/test.mp4"));
        assert_eq!(config.quality, VideoQuality::HIGH);
    }

    #[test]
    fn test_config_clone() {
        let config1 = RecordingConfig {
            session_id: "test".to_string(),
            output_path: PathBuf::from("/tmp/test.mp4"),
            quality: VideoQuality::MEDIUM,
        };

        let config2 = config1.clone();

        assert_eq!(config1.session_id, config2.session_id);
        assert_eq!(config1.output_path, config2.output_path);
        assert_eq!(config1.quality, config2.quality);
    }
}

// Mock tests for FFI handle (without actually calling Swift)
#[cfg(test)]
mod ffi_handle_tests {
    use super::*;

    #[test]
    fn test_from_raw_rejects_null() {
        // SAFETY: Testing null pointer handling
        let result = unsafe { SwiftRecorderHandle::from_raw(std::ptr::null_mut()) };
        assert!(matches!(result, Err(FFIError::NullPointer)));
    }

    // Note: Tests with dummy pointers removed because they cause segfaults
    // when Drop calls screen_recorder_destroy on fake pointers.
    // Real pointer tests require the Swift runtime and should be in integration tests.
}

// Integration-style tests that can run without Swift
#[cfg(test)]
mod integration_style_tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_config_with_invalid_path_has_no_parent() {
        // Root path has no parent
        let config = RecordingConfig {
            session_id: "test".to_string(),
            output_path: PathBuf::from("/"),
            quality: VideoQuality::default(),
        };

        assert!(config.output_path.parent().is_none());
    }

    #[test]
    fn test_config_with_valid_path_has_parent() {
        let config = RecordingConfig {
            session_id: "test".to_string(),
            output_path: PathBuf::from("/tmp/test.mp4"),
            quality: VideoQuality::default(),
        };

        assert!(config.output_path.parent().is_some());
        assert_eq!(config.output_path.parent().unwrap(), PathBuf::from("/tmp"));
    }
}

// Async test utilities
#[cfg(test)]
mod async_test_helpers {
    /// Helper to run async tests
    /// Not actually used here but available for future async tests
    #[allow(dead_code)]
    pub fn block_on<F: std::future::Future>(f: F) -> F::Output {
        tokio::runtime::Runtime::new().unwrap().block_on(f)
    }
}
