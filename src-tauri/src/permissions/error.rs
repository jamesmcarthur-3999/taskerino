//! Permissions Error Types
//!
//! Comprehensive error handling for recording services (screenshots, audio, video).
//! Uses Serde-tagged enums for type-safe error propagation from Rust to TypeScript.

use serde::{Serialize, Deserialize};
use std::fmt;

/// Root error type for all recording operations
///
/// This enum uses Serde's `tag` and `content` attributes for proper TypeScript
/// discriminated union support. Each variant serializes to:
/// ```json
/// { "type": "PermissionDenied", "data": { "permission": "screenRecording", ... } }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "data")]
pub enum RecordingError {
    /// Permission denied by the system
    ///
    /// User has not granted the required permission in System Settings.
    /// The `can_retry` flag indicates if retrying after user grants permission
    /// is likely to succeed.
    PermissionDenied {
        /// The specific permission that was denied
        permission: PermissionType,
        /// Whether retrying after user grants permission might succeed
        #[serde(rename = "canRetry")]
        can_retry: bool,
        /// Optional system-provided error message
        #[serde(rename = "systemMessage")]
        system_message: Option<String>,
    },

    /// Device or resource not found
    ///
    /// The requested device (microphone, camera, display) was not found or
    /// is no longer available.
    DeviceNotFound {
        /// Type of device that was not found
        #[serde(rename = "deviceType")]
        device_type: DeviceType,
        /// Optional device identifier (if known)
        #[serde(rename = "deviceId")]
        device_id: Option<String>,
        /// Optional details about the error (for debugging)
        #[serde(skip_serializing_if = "Option::is_none")]
        details: Option<String>,
    },

    /// Device is already in use
    ///
    /// Another application or process is currently using the device.
    /// The user should close other apps using this device.
    DeviceInUse {
        /// Type of device that is in use
        #[serde(rename = "deviceType")]
        device_type: DeviceType,
        /// Device identifier
        #[serde(rename = "deviceId")]
        device_id: String,
    },

    /// System API error (ScreenCaptureKit, AVFoundation, etc.)
    ///
    /// An error occurred in the underlying platform API. The `is_recoverable`
    /// flag indicates if retrying the operation might succeed.
    SystemError {
        /// The system API that produced the error
        source: ErrorSource,
        /// Human-readable error message
        message: String,
        /// Whether the error is transient and might succeed on retry
        #[serde(rename = "isRecoverable")]
        is_recoverable: bool,
    },

    /// Configuration invalid
    ///
    /// The provided configuration is invalid or malformed.
    /// The user should check their settings.
    InvalidConfiguration {
        /// The configuration field that is invalid
        field: String,
        /// Explanation of why the configuration is invalid
        reason: String,
    },

    /// Timeout waiting for operation
    ///
    /// The operation took longer than expected to complete.
    /// This usually indicates a system performance issue or API deadlock.
    Timeout {
        /// Description of the operation that timed out
        operation: String,
        /// The timeout duration in milliseconds
        #[serde(rename = "timeoutMs")]
        timeout_ms: u64,
    },

    /// Platform not supported
    ///
    /// The requested feature is not available on this platform or OS version.
    PlatformUnsupported {
        /// Name of the feature that is unsupported
        feature: String,
        /// Minimum required OS version
        #[serde(rename = "requiredVersion")]
        required_version: String,
    },

    /// Internal error (should be rare)
    ///
    /// An unexpected error occurred in the recording system.
    /// Users should report this as a bug.
    Internal {
        /// Error message
        message: String,
    },
}

/// Permission type enumeration
///
/// Represents the different system permissions required for recording operations.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum PermissionType {
    /// Screen recording permission (macOS 10.15+)
    ScreenRecording,
    /// Microphone access permission
    Microphone,
    /// System audio capture permission (macOS 13.0+)
    SystemAudio,
    /// Camera access permission
    Camera,
}

/// Device type enumeration
///
/// Represents the different types of devices used in recording operations.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum DeviceType {
    /// Audio input device (microphone)
    Microphone,
    /// System audio output device
    SystemAudio,
    /// Video camera device
    Camera,
    /// Display/monitor
    Display,
    /// Application window
    Window,
}

/// Error source enumeration
///
/// Identifies which system API produced an error.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum ErrorSource {
    /// macOS ScreenCaptureKit framework
    ScreenCaptureKit,
    /// macOS AVFoundation framework
    AvFoundation,
    /// macOS Core Audio framework
    CoreAudio,
    /// Cross-platform audio library (cpal)
    Cpal,
    /// Foreign Function Interface (Swift bridge)
    Ffi,
}

impl fmt::Display for RecordingError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RecordingError::PermissionDenied { permission, can_retry, system_message } => {
                write!(f, "Permission denied: {:?}", permission)?;
                if *can_retry {
                    write!(f, " (can retry after granting permission)")?;
                }
                if let Some(msg) = system_message {
                    write!(f, " - {}", msg)?;
                }
                Ok(())
            }
            RecordingError::DeviceNotFound { device_type, device_id, details } => {
                if let Some(id) = device_id {
                    write!(f, "Device not found: {:?} ({})", device_type, id)?;
                } else {
                    write!(f, "Device not found: {:?}", device_type)?;
                }
                if let Some(detail_msg) = details {
                    write!(f, " - {}", detail_msg)?;
                }
                Ok(())
            }
            RecordingError::DeviceInUse { device_type, device_id } => {
                write!(f, "Device in use: {:?} ({})", device_type, device_id)
            }
            RecordingError::SystemError { source, message, is_recoverable } => {
                write!(f, "System error ({:?}): {}", source, message)?;
                if *is_recoverable {
                    write!(f, " (recoverable)")?;
                }
                Ok(())
            }
            RecordingError::InvalidConfiguration { field, reason } => {
                write!(f, "Invalid configuration '{}': {}", field, reason)
            }
            RecordingError::Timeout { operation, timeout_ms } => {
                write!(f, "Operation timed out: {} ({}ms)", operation, timeout_ms)
            }
            RecordingError::PlatformUnsupported { feature, required_version } => {
                write!(f, "Platform unsupported: {} requires {}", feature, required_version)
            }
            RecordingError::Internal { message } => {
                write!(f, "Internal error: {}", message)
            }
        }
    }
}

impl std::error::Error for RecordingError {}

// ============================================================================
// From conversions for existing error types
// ============================================================================

// From<AudioError> removed - AudioGraph system archived
// Simple audio implementation doesn't need error type conversion

impl From<crate::recording::FFIError> for RecordingError {
    fn from(err: crate::recording::FFIError) -> Self {
        use crate::recording::FFIError;

        match err {
            FFIError::NullPointer => RecordingError::Internal {
                message: "Null pointer from Swift FFI".to_string(),
            },
            FFIError::Timeout => RecordingError::Timeout {
                operation: "Swift FFI call".to_string(),
                timeout_ms: 5000, // Default timeout assumption
            },
            FFIError::InvalidState(msg) => RecordingError::SystemError {
                source: ErrorSource::Ffi,
                message: format!("Invalid state: {}", msg),
                is_recoverable: false,
            },
            FFIError::SwiftError(msg) => RecordingError::SystemError {
                source: ErrorSource::ScreenCaptureKit,
                message: msg,
                is_recoverable: false,
            },
            FFIError::AlreadyStarted => RecordingError::DeviceInUse {
                device_type: DeviceType::Display,
                device_id: "screen_recorder".to_string(),
            },
            FFIError::AlreadyStopped => RecordingError::SystemError {
                source: ErrorSource::Ffi,
                message: "Recording already stopped".to_string(),
                is_recoverable: false,
            },
            FFIError::NotRecording => RecordingError::SystemError {
                source: ErrorSource::Ffi,
                message: "Not currently recording".to_string(),
                is_recoverable: false,
            },
            FFIError::CurrentlyRecording => RecordingError::DeviceInUse {
                device_type: DeviceType::Display,
                device_id: "screen_recorder".to_string(),
            },
            FFIError::InvalidConfig(msg) => RecordingError::InvalidConfiguration {
                field: "recording_config".to_string(),
                reason: msg,
            },
            FFIError::IoError(msg) => RecordingError::SystemError {
                source: ErrorSource::Ffi,
                message: format!("IO error: {}", msg),
                is_recoverable: true,
            },
        }
    }
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recording_error_serialization() {
        // Test PermissionDenied serialization
        let err = RecordingError::PermissionDenied {
            permission: PermissionType::ScreenRecording,
            can_retry: true,
            system_message: Some("Screen Recording permission required".to_string()),
        };

        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains(r#""type":"PermissionDenied"#));
        assert!(json.contains(r#""permission":"screenRecording"#));
        assert!(json.contains(r#""canRetry":true"#));

        // Test deserialization
        let deserialized: RecordingError = serde_json::from_str(&json).unwrap();
        assert_eq!(err, deserialized);
    }

    #[test]
    fn test_device_not_found_serialization() {
        let err = RecordingError::DeviceNotFound {
            device_type: DeviceType::Microphone,
            device_id: Some("mic-1".to_string()),
            details: Some("CPAL error: device not available".to_string()),
        };

        let json = serde_json::to_string(&err).unwrap();
        println!("Serialized JSON: {}", json);

        // With tag+content, format is: {"type":"DeviceNotFound","data":{...}}
        assert!(json.contains(r#""type":"DeviceNotFound"#));
        assert!(json.contains(r#""deviceType":"microphone"#));
        assert!(json.contains(r#""deviceId":"mic-1"#));
        assert!(json.contains(r#""details":"CPAL error: device not available"#));

        // Test deserialization
        let deserialized: RecordingError = serde_json::from_str(&json).unwrap();
        assert_eq!(err, deserialized);
    }

    #[test]
    fn test_system_error_serialization() {
        let err = RecordingError::SystemError {
            source: ErrorSource::ScreenCaptureKit,
            message: "Screen capture failed".to_string(),
            is_recoverable: false,
        };

        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains(r#""type":"SystemError"#));
        assert!(json.contains(r#""source":"screenCaptureKit"#));
        assert!(json.contains(r#""isRecoverable":false"#));
    }

    #[test]
    fn test_error_display() {
        let err = RecordingError::PermissionDenied {
            permission: PermissionType::Microphone,
            can_retry: true,
            system_message: None,
        };
        assert!(err.to_string().contains("Permission denied"));
        assert!(err.to_string().contains("Microphone"));
    }

    #[test]
    fn test_from_audio_error_no_device() {
        use crate::audio::error::AudioError;

        let audio_err = AudioError::NoDevice;
        let recording_err: RecordingError = audio_err.into();

        match recording_err {
            RecordingError::DeviceNotFound { device_type, device_id, details } => {
                assert_eq!(device_type, DeviceType::Microphone);
                assert_eq!(device_id, None);
                assert_eq!(details, None);
            }
            _ => panic!("Expected DeviceNotFound variant"),
        }
    }

    #[test]
    fn test_from_audio_error_device_not_found() {
        use crate::audio::error::AudioError;

        let audio_err = AudioError::DeviceNotFound("mic-1".to_string());
        let recording_err: RecordingError = audio_err.into();

        match recording_err {
            RecordingError::DeviceNotFound { device_type, device_id, details } => {
                assert_eq!(device_type, DeviceType::Microphone);
                assert_eq!(device_id, Some("mic-1".to_string()));
                assert_eq!(details, None);
            }
            _ => panic!("Expected DeviceNotFound variant"),
        }
    }

    #[test]
    fn test_from_audio_error_invalid_config() {
        use crate::audio::error::AudioError;

        let audio_err = AudioError::InvalidConfig("Invalid sample rate".to_string());
        let recording_err: RecordingError = audio_err.into();

        match recording_err {
            RecordingError::InvalidConfiguration { field, reason } => {
                assert_eq!(field, "audio_config");
                assert_eq!(reason, "Invalid sample rate");
            }
            _ => panic!("Expected InvalidConfiguration variant"),
        }
    }

    #[test]
    fn test_from_ffi_error_null_pointer() {
        use crate::recording::FFIError;

        let ffi_err = FFIError::NullPointer;
        let recording_err: RecordingError = ffi_err.into();

        match recording_err {
            RecordingError::Internal { message } => {
                assert!(message.contains("Null pointer"));
            }
            _ => panic!("Expected Internal variant"),
        }
    }

    #[test]
    fn test_from_ffi_error_timeout() {
        use crate::recording::FFIError;

        let ffi_err = FFIError::Timeout;
        let recording_err: RecordingError = ffi_err.into();

        match recording_err {
            RecordingError::Timeout { operation, timeout_ms } => {
                assert_eq!(operation, "Swift FFI call");
                assert_eq!(timeout_ms, 5000);
            }
            _ => panic!("Expected Timeout variant"),
        }
    }

    #[test]
    fn test_permission_type_serialization() {
        assert_eq!(
            serde_json::to_string(&PermissionType::ScreenRecording).unwrap(),
            r#""screenRecording""#
        );
        assert_eq!(
            serde_json::to_string(&PermissionType::Microphone).unwrap(),
            r#""microphone""#
        );
    }

    #[test]
    fn test_device_type_serialization() {
        assert_eq!(
            serde_json::to_string(&DeviceType::Microphone).unwrap(),
            r#""microphone""#
        );
        assert_eq!(
            serde_json::to_string(&DeviceType::SystemAudio).unwrap(),
            r#""systemAudio""#
        );
    }

    #[test]
    fn test_error_source_serialization() {
        assert_eq!(
            serde_json::to_string(&ErrorSource::ScreenCaptureKit).unwrap(),
            r#""screenCaptureKit""#
        );
        assert_eq!(
            serde_json::to_string(&ErrorSource::AvFoundation).unwrap(),
            r#""avFoundation""#
        );
    }
}
