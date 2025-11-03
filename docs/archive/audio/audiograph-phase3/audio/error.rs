//! Error types for audio abstraction layer

use std::fmt;

/// Audio-specific errors
#[derive(Debug, Clone)]
pub enum AudioError {
    /// No audio device available
    NoDevice,

    /// Device not found by ID
    DeviceNotFound(String),

    /// Platform doesn't support this feature
    PlatformUnsupported,

    /// Invalid configuration
    InvalidConfig(String),

    /// Device is not active
    NotActive,

    /// Null pointer from FFI
    NullPointer,

    /// FFI call failed
    FFIError(String),

    /// Device already active
    AlreadyActive,

    /// Buffer overflow/underflow
    BufferError(String),

    /// Sample format not supported
    UnsupportedFormat(String),

    /// Generic error
    Other(String),
}

impl fmt::Display for AudioError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AudioError::NoDevice => write!(f, "No audio device available"),
            AudioError::DeviceNotFound(id) => write!(f, "Audio device not found: {}", id),
            AudioError::PlatformUnsupported => write!(f, "Audio feature not supported on this platform"),
            AudioError::InvalidConfig(msg) => write!(f, "Invalid audio configuration: {}", msg),
            AudioError::NotActive => write!(f, "Audio device is not active"),
            AudioError::NullPointer => write!(f, "Null pointer received from FFI"),
            AudioError::FFIError(msg) => write!(f, "FFI error: {}", msg),
            AudioError::AlreadyActive => write!(f, "Audio device is already active"),
            AudioError::BufferError(msg) => write!(f, "Audio buffer error: {}", msg),
            AudioError::UnsupportedFormat(msg) => write!(f, "Unsupported audio format: {}", msg),
            AudioError::Other(msg) => write!(f, "Audio error: {}", msg),
        }
    }
}

impl std::error::Error for AudioError {}

// Conversions from other error types
impl From<String> for AudioError {
    fn from(s: String) -> Self {
        AudioError::Other(s)
    }
}

impl From<&str> for AudioError {
    fn from(s: &str) -> Self {
        AudioError::Other(s.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        assert_eq!(
            AudioError::NoDevice.to_string(),
            "No audio device available"
        );

        assert_eq!(
            AudioError::DeviceNotFound("mic-1".to_string()).to_string(),
            "Audio device not found: mic-1"
        );

        assert_eq!(
            AudioError::PlatformUnsupported.to_string(),
            "Audio feature not supported on this platform"
        );
    }

    #[test]
    fn test_error_from_string() {
        let err: AudioError = "test error".into();
        assert_eq!(err.to_string(), "Audio error: test error");
    }
}
