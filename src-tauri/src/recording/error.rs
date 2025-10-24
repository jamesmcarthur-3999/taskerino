/**
 * Error Types for Recording FFI
 *
 * Provides type-safe error handling for Swift FFI interactions,
 * replacing generic string errors with structured error types.
 */

use std::fmt;

/// Errors that can occur during FFI operations with Swift ScreenRecorder
#[derive(Debug, Clone, PartialEq)]
pub enum FFIError {
    /// Swift returned a null pointer when creating recorder
    NullPointer,

    /// Operation timed out
    Timeout,

    /// Invalid state for the requested operation
    InvalidState(String),

    /// Error from Swift side (with message)
    SwiftError(String),

    /// Recording already started
    AlreadyStarted,

    /// Recording already stopped
    AlreadyStopped,

    /// Not currently recording
    NotRecording,

    /// Currently recording
    CurrentlyRecording,

    /// Invalid configuration
    InvalidConfig(String),

    /// IO error (file system operations)
    IoError(String),
}

impl fmt::Display for FFIError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FFIError::NullPointer => {
                write!(f, "Swift recorder returned null pointer")
            }
            FFIError::Timeout => {
                write!(f, "FFI operation timed out")
            }
            FFIError::InvalidState(msg) => {
                write!(f, "Invalid state: {}", msg)
            }
            FFIError::SwiftError(msg) => {
                write!(f, "Swift error: {}", msg)
            }
            FFIError::AlreadyStarted => {
                write!(f, "Recording already started")
            }
            FFIError::AlreadyStopped => {
                write!(f, "Recording already stopped")
            }
            FFIError::NotRecording => {
                write!(f, "Not currently recording")
            }
            FFIError::CurrentlyRecording => {
                write!(f, "Currently recording - stop first")
            }
            FFIError::InvalidConfig(msg) => {
                write!(f, "Invalid configuration: {}", msg)
            }
            FFIError::IoError(msg) => {
                write!(f, "IO error: {}", msg)
            }
        }
    }
}

impl std::error::Error for FFIError {}

// Conversions from std errors
impl From<std::io::Error> for FFIError {
    fn from(err: std::io::Error) -> Self {
        FFIError::IoError(err.to_string())
    }
}

impl From<FFIError> for String {
    fn from(err: FFIError) -> Self {
        err.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        assert_eq!(
            FFIError::NullPointer.to_string(),
            "Swift recorder returned null pointer"
        );
        assert_eq!(
            FFIError::Timeout.to_string(),
            "FFI operation timed out"
        );
        assert_eq!(
            FFIError::InvalidState("test".to_string()).to_string(),
            "Invalid state: test"
        );
    }

    #[test]
    fn test_error_clone() {
        let err = FFIError::SwiftError("test".to_string());
        let cloned = err.clone();
        assert_eq!(err, cloned);
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let ffi_err: FFIError = io_err.into();
        assert!(matches!(ffi_err, FFIError::IoError(_)));
    }

    #[test]
    fn test_string_conversion() {
        let err = FFIError::Timeout;
        let s: String = err.into();
        assert_eq!(s, "FFI operation timed out");
    }
}
