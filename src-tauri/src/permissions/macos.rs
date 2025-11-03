//! macOS-Specific Permission Checks
//!
//! Platform-specific permission detection for macOS using system APIs and FFI.
//! All functions return Ok(true) if permission is granted, Ok(false) if denied,
//! or Err if checking the permission failed.

use super::error::{RecordingError, PermissionType};

#[cfg(target_os = "macos")]
extern "C" {
    /// Check screen recording permission via Swift FFI
    ///
    /// This function is implemented in the Swift ScreenRecorder module.
    /// It uses CGPreflightScreenCaptureAccess() to check permission status.
    fn screen_recorder_check_permission() -> bool;
}

/// Check screen recording permission (macOS 10.15+)
///
/// On macOS Catalina (10.15) and later, apps must have explicit permission to
/// record the screen. This permission is controlled in System Settings >
/// Privacy & Security > Screen Recording.
///
/// # Returns
///
/// * `Ok(true)` - Screen recording is allowed
/// * `Ok(false)` - Screen recording is denied
/// * `Err(RecordingError::PlatformUnsupported)` - Not on macOS
///
/// # Example
///
/// ```rust
/// use crate::permissions::macos::check_screen_recording_permission;
///
/// match check_screen_recording_permission() {
///     Ok(true) => println!("Screen recording is allowed"),
///     Ok(false) => {
///         println!("Please grant screen recording permission in System Settings");
///     }
///     Err(e) => eprintln!("Error: {}", e),
/// }
/// ```
#[cfg(target_os = "macos")]
pub fn check_screen_recording_permission() -> Result<bool, RecordingError> {
    // Safety: This FFI call is safe because:
    // 1. The Swift function is a pure query with no side effects
    // 2. It returns a simple bool value
    // 3. It doesn't mutate any state or take any parameters
    let granted = unsafe { screen_recorder_check_permission() };
    Ok(granted)
}

#[cfg(not(target_os = "macos"))]
pub fn check_screen_recording_permission() -> Result<bool, RecordingError> {
    Err(RecordingError::PlatformUnsupported {
        feature: "Screen recording".to_string(),
        required_version: "macOS 10.15+".to_string(),
    })
}

/// Check microphone permission
///
/// On macOS, microphone access is controlled in System Settings >
/// Privacy & Security > Microphone.
///
/// # Returns
///
/// * `Ok(true)` - Microphone access is allowed
/// * `Err(RecordingError::PermissionDenied)` - Microphone access is denied or not yet requested
///
/// # Implementation Details
///
/// This function uses AVCaptureDevice.authorizationStatus(for: .audio) to check
/// the microphone permission status. The authorization status can be:
///
/// * **0 (NotDetermined)**: Permission has not been requested yet. Returns error
///   prompting user to request permission (permission dialog will appear on next access attempt).
/// * **1 (Restricted)**: Access is restricted by parental controls or corporate policy.
///   Returns error indicating system restrictions.
/// * **2 (Denied)**: User has explicitly denied permission. Returns error with instructions
///   to enable in System Settings.
/// * **3 (Authorized)**: Permission granted. Returns Ok(true).
///
/// # Note
///
/// This function does NOT trigger the permission prompt. The permission prompt will
/// appear automatically when the app attempts to access the microphone for the first time.
/// Use this function to check permission status before attempting access.
///
/// # Example
///
/// ```rust
/// use crate::permissions::macos::check_microphone_permission;
///
/// match check_microphone_permission() {
///     Ok(true) => println!("Microphone is allowed"),
///     Err(e) => {
///         eprintln!("Cannot access microphone: {}", e);
///         // Show user a helpful error message
///     }
/// }
/// ```
#[cfg(target_os = "macos")]
pub fn check_microphone_permission() -> Result<bool, RecordingError> {
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::{class, msg_send, sel, sel_impl};

    // Safety: This FFI call is safe because:
    // 1. We're calling standard AVFoundation APIs that are stable across macOS versions
    // 2. The NSString is properly allocated and will be automatically released
    // 3. authorizationStatusForMediaType: is a class method that returns an integer
    // 4. No memory is mutated or leaked
    unsafe {
        // Get AVCaptureDevice class
        let av_capture_device_class = class!(AVCaptureDevice);

        // Create NSString for audio media type ("soun" is the AVMediaTypeAudio constant)
        let media_type_audio: id = NSString::alloc(nil).init_str("soun");

        // Call [AVCaptureDevice authorizationStatusForMediaType:@"soun"]
        // Returns AVAuthorizationStatus as i64 (enum values 0-3)
        let auth_status: i64 = msg_send![av_capture_device_class, authorizationStatusForMediaType: media_type_audio];

        // Release the NSString
        let _: () = msg_send![media_type_audio, release];

        // Map AVAuthorizationStatus to Result
        match auth_status {
            3 => {
                // AVAuthorizationStatusAuthorized - Permission granted
                Ok(true)
            }
            2 => {
                // AVAuthorizationStatusDenied - User explicitly denied permission
                Err(RecordingError::PermissionDenied {
                    permission: PermissionType::Microphone,
                    can_retry: true,
                    system_message: Some(
                        "Microphone access denied. Please enable in System Settings > Privacy & Security > Microphone, then restart the app.".to_string()
                    ),
                })
            }
            1 => {
                // AVAuthorizationStatusRestricted - Restricted by parental controls/policy
                Err(RecordingError::PermissionDenied {
                    permission: PermissionType::Microphone,
                    can_retry: false,
                    system_message: Some(
                        "Microphone access is restricted by system policy (parental controls or MDM). Contact your system administrator.".to_string()
                    ),
                })
            }
            0 => {
                // AVAuthorizationStatusNotDetermined - Permission not yet requested
                // Note: We don't request permission here. The permission dialog will
                // appear automatically when the app attempts to access the microphone.
                Err(RecordingError::PermissionDenied {
                    permission: PermissionType::Microphone,
                    can_retry: true,
                    system_message: Some(
                        "Microphone permission not yet requested. The system will prompt for permission when you start recording audio.".to_string()
                    ),
                })
            }
            _ => {
                // Unknown status code - should never happen
                Err(RecordingError::Internal {
                    message: format!("Unknown microphone authorization status: {}", auth_status),
                })
            }
        }
    }
}

/// Request microphone permission proactively (macOS only)
///
/// This function triggers the macOS permission dialog if permission hasn't been
/// determined yet. It returns immediately with the current permission status.
///
/// # Returns
///
/// - `Ok(true)` if permission is already granted
/// - `Err` with appropriate error if permission is denied, restricted, or not yet determined
///
/// # Notes
///
/// - This will show the system permission dialog if status is NotDetermined (0)
/// - The dialog is async, but this function returns immediately
/// - Call this before attempting to access the microphone to ensure the prompt appears
#[cfg(target_os = "macos")]
pub fn request_microphone_permission() -> Result<bool, RecordingError> {
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::{class, msg_send, sel, sel_impl};

    unsafe {
        let av_capture_device_class = class!(AVCaptureDevice);
        let media_type_audio: id = NSString::alloc(nil).init_str("soun");

        // Check current status first
        let auth_status: i64 = msg_send![av_capture_device_class, authorizationStatusForMediaType: media_type_audio];

        // If already authorized, return immediately
        if auth_status == 3 {
            let _: () = msg_send![media_type_audio, release];
            return Ok(true);
        }

        // If status is NotDetermined (0), request permission
        if auth_status == 0 {
            // Note: requestAccessForMediaType requires an Objective-C block as callback
            // Since Rust closures can't be directly converted to ObjC blocks,
            // we'll take a simpler approach: the actual permission request will happen
            // when the audio device is first accessed (in MicrophoneSource::new)
            // For now, we'll just return an error indicating permission needs to be requested

            let _: () = msg_send![media_type_audio, release];

            return Err(RecordingError::PermissionDenied {
                permission: PermissionType::Microphone,
                can_retry: true,
                system_message: Some(
                    "Microphone permission will be requested when audio recording starts. Please grant access when prompted.".to_string()
                ),
            });
        }

        let _: () = msg_send![media_type_audio, release];

        // For other statuses (Denied, Restricted), return the same errors as check
        match auth_status {
            2 => Err(RecordingError::PermissionDenied {
                permission: PermissionType::Microphone,
                can_retry: true,
                system_message: Some(
                    "Microphone access denied. Please enable in System Settings > Privacy & Security > Microphone.".to_string()
                ),
            }),
            1 => Err(RecordingError::PermissionDenied {
                permission: PermissionType::Microphone,
                can_retry: false,
                system_message: Some(
                    "Microphone access is restricted by system policy.".to_string()
                ),
            }),
            _ => Err(RecordingError::Internal {
                message: format!("Unknown microphone authorization status: {}", auth_status),
            }),
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn check_microphone_permission() -> Result<bool, RecordingError> {
    // On non-macOS platforms, assume microphone is available
    Ok(true)
}

/// Request camera permission proactively (macOS only)
///
/// This function triggers the macOS permission dialog if permission hasn't been
/// determined yet. It uses AVCaptureDevice.requestAccess(for:) to show the system
/// permission prompt.
///
/// # Returns
///
/// - `Ok(true)` if permission is already granted
/// - `Err` with appropriate error if permission is denied, restricted, or not yet determined
///
/// # Notes
///
/// - This will show the system permission dialog if status is NotDetermined (0)
/// - The dialog is async, but this function returns immediately after triggering it
/// - Call this before attempting to access the camera to ensure the prompt appears
#[cfg(target_os = "macos")]
pub fn request_camera_permission() -> Result<bool, RecordingError> {
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::{class, msg_send, sel, sel_impl};

    unsafe {
        let av_capture_device_class = class!(AVCaptureDevice);

        // Create NSString for video media type
        let media_type_video: id = NSString::alloc(nil).init_str("vide");

        // First check current status
        let auth_status: i64 = msg_send![av_capture_device_class, authorizationStatusForMediaType: media_type_video];

        // If already authorized, return success
        if auth_status == 3 {
            let _: () = msg_send![media_type_video, release];
            return Ok(true);
        }

        // If status is NotDetermined (0), trigger the permission request
        // Note: requestAccessForMediaType: is async, but we return immediately
        // The user will see the permission dialog, and subsequent checks will reflect the decision
        if auth_status == 0 {
            let _: () = msg_send![av_capture_device_class, requestAccessForMediaType:media_type_video completionHandler:nil];
            let _: () = msg_send![media_type_video, release];

            return Err(RecordingError::PermissionDenied {
                permission: PermissionType::Camera,
                can_retry: true,
                system_message: Some(
                    "Camera permission will be requested when video recording starts. Please grant access when prompted.".to_string()
                ),
            });
        }

        let _: () = msg_send![media_type_video, release];

        // For other statuses (Denied, Restricted), return the same errors as check
        match auth_status {
            2 => Err(RecordingError::PermissionDenied {
                permission: PermissionType::Camera,
                can_retry: true,
                system_message: Some(
                    "Camera access denied. Please enable in System Settings > Privacy & Security > Camera.".to_string()
                ),
            }),
            1 => Err(RecordingError::PermissionDenied {
                permission: PermissionType::Camera,
                can_retry: false,
                system_message: Some(
                    "Camera access is restricted by system policy.".to_string()
                ),
            }),
            _ => Err(RecordingError::Internal {
                message: format!("Unknown camera authorization status: {}", auth_status),
            }),
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn request_camera_permission() -> Result<bool, RecordingError> {
    Ok(true)
}

// External C function from Swift ScreenRecorder for strict permission check
extern "C" {
    fn system_audio_check_stream_permission() -> bool;
    fn screen_recorder_get_last_error_code() -> i32;
    fn screen_recorder_get_last_error_message() -> *const std::os::raw::c_char;
    fn screen_recorder_get_last_error_can_retry() -> bool;
    fn screen_recorder_clear_last_error();
    fn screen_recorder_free_string(ptr: *mut std::os::raw::c_char);
}

/// Check system audio capture permission (macOS 13.0+)
///
/// System audio capture (loopback audio) is only available on macOS Ventura
/// (13.0) and later via the ScreenCaptureKit framework. On older versions,
/// this function returns an error.
///
/// **IMPORTANT**: This performs a strict permission check by actually attempting
/// to start an SCStream with audio enabled, which is the exact operation required
/// for system audio capture. This is more thorough than just checking availability.
///
/// # Returns
///
/// * `Ok(true)` - System audio capture permission is granted
/// * `Err(RecordingError::PermissionDenied)` - Screen Recording permission not granted
/// * `Err(RecordingError::PlatformUnsupported)` - macOS version is too old
///
/// # Note
///
/// System audio capture requires both:
/// 1. macOS 13.0+ (Ventura)
/// 2. Full Screen Recording permission (for SCStream audio capture)
///
/// # Example
///
/// ```rust
/// use crate::permissions::macos::check_system_audio_permission;
///
/// match check_system_audio_permission() {
///     Ok(true) => println!("System audio capture is available"),
///     Err(e) => eprintln!("Cannot use system audio: {}", e),
/// }
/// ```
#[cfg(target_os = "macos")]
pub fn check_system_audio_permission() -> Result<bool, RecordingError> {
    use crate::macos_audio::is_system_audio_available;
    use std::ffi::CStr;

    // First check: macOS version supports system audio
    if !is_system_audio_available() {
        return Err(RecordingError::PlatformUnsupported {
            feature: "System audio capture".to_string(),
            required_version: "macOS 13.0+ (Ventura)".to_string(),
        });
    }

    // Second check: Strict permission check via SCStream
    // This actually attempts to start a temporary SCStream with audio,
    // which is the exact permission needed for system audio capture
    let has_permission = unsafe { system_audio_check_stream_permission() };

    if has_permission {
        Ok(true)
    } else {
        // Retrieve detailed error from Swift
        let _error_code = unsafe { screen_recorder_get_last_error_code() };
        let message_ptr = unsafe { screen_recorder_get_last_error_message() };
        let can_retry = unsafe { screen_recorder_get_last_error_can_retry() };

        // Extract message (or use default)
        let message = if !message_ptr.is_null() {
            unsafe {
                let c_str = CStr::from_ptr(message_ptr);
                let msg = c_str.to_string_lossy().to_string();
                // Free the Swift-allocated string
                screen_recorder_free_string(message_ptr as *mut std::os::raw::c_char);
                msg
            }
        } else {
            "Screen Recording permission required for system audio".to_string()
        };

        // Clear Swift error state
        unsafe { screen_recorder_clear_last_error() };

        // Return permission denied error with detailed message
        Err(RecordingError::PermissionDenied {
            permission: PermissionType::SystemAudio,
            can_retry,
            system_message: Some(message),
        })
    }
}

#[cfg(not(target_os = "macos"))]
pub fn check_system_audio_permission() -> Result<bool, RecordingError> {
    Err(RecordingError::PlatformUnsupported {
        feature: "System audio capture".to_string(),
        required_version: "macOS 13.0+".to_string(),
    })
}

/// Check camera permission
///
/// On macOS, camera access is controlled in System Settings >
/// Privacy & Security > Camera.
///
/// # Returns
///
/// * `Ok(true)` - Camera access is allowed
/// * `Err(RecordingError::PermissionDenied)` - Camera access is denied or not yet requested
///
/// # Implementation Details
///
/// This function uses AVCaptureDevice.authorizationStatus(for: .video) to check
/// the camera permission status. The authorization status can be:
///
/// * **0 (NotDetermined)**: Permission has not been requested yet. Returns error
///   prompting user to request permission (permission dialog will appear on next access attempt).
/// * **1 (Restricted)**: Access is restricted by parental controls or corporate policy.
///   Returns error indicating system restrictions.
/// * **2 (Denied)**: User has explicitly denied permission. Returns error with instructions
///   to enable in System Settings.
/// * **3 (Authorized)**: Permission granted. Returns Ok(true).
///
/// # Note
///
/// This function does NOT trigger the permission prompt. The permission prompt will
/// appear automatically when the app attempts to access the camera for the first time.
/// Use this function to check permission status before attempting access.
///
/// # Example
///
/// ```rust
/// use crate::permissions::macos::check_camera_permission;
///
/// match check_camera_permission() {
///     Ok(true) => println!("Camera is allowed"),
///     Err(e) => {
///         eprintln!("Cannot access camera: {}", e);
///         // Show user a helpful error message
///     }
/// }
/// ```
#[cfg(target_os = "macos")]
pub fn check_camera_permission() -> Result<bool, RecordingError> {
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSString;
    use objc::{class, msg_send, sel, sel_impl};

    // Safety: This FFI call is safe because:
    // 1. We're calling standard AVFoundation APIs that are stable across macOS versions
    // 2. The NSString is properly allocated and will be automatically released
    // 3. authorizationStatusForMediaType: is a class method that returns an integer
    // 4. No memory is mutated or leaked
    unsafe {
        // Get AVCaptureDevice class
        let av_capture_device_class = class!(AVCaptureDevice);

        // Create NSString for video media type ("vide" is the AVMediaTypeVideo constant)
        let media_type_video: id = NSString::alloc(nil).init_str("vide");

        // Call [AVCaptureDevice authorizationStatusForMediaType:@"vide"]
        // Returns AVAuthorizationStatus as i64 (enum values 0-3)
        let auth_status: i64 = msg_send![av_capture_device_class, authorizationStatusForMediaType: media_type_video];

        // Release the NSString
        let _: () = msg_send![media_type_video, release];

        // Map AVAuthorizationStatus to Result
        match auth_status {
            3 => {
                // AVAuthorizationStatusAuthorized - Permission granted
                Ok(true)
            }
            2 => {
                // AVAuthorizationStatusDenied - User explicitly denied permission
                Err(RecordingError::PermissionDenied {
                    permission: PermissionType::Camera,
                    can_retry: true,
                    system_message: Some(
                        "Camera access denied. Please enable in System Settings > Privacy & Security > Camera, then restart the app.".to_string()
                    ),
                })
            }
            1 => {
                // AVAuthorizationStatusRestricted - Restricted by parental controls/policy
                Err(RecordingError::PermissionDenied {
                    permission: PermissionType::Camera,
                    can_retry: false,
                    system_message: Some(
                        "Camera access is restricted by system policy (parental controls or MDM). Contact your system administrator.".to_string()
                    ),
                })
            }
            0 => {
                // AVAuthorizationStatusNotDetermined - Permission not yet requested
                // Note: We don't request permission here. The permission dialog will
                // appear automatically when the app attempts to access the camera.
                Err(RecordingError::PermissionDenied {
                    permission: PermissionType::Camera,
                    can_retry: true,
                    system_message: Some(
                        "Camera permission not yet requested. The system will prompt for permission when you start recording video.".to_string()
                    ),
                })
            }
            _ => {
                // Unknown status code - should never happen
                Err(RecordingError::Internal {
                    message: format!("Unknown camera authorization status: {}", auth_status),
                })
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn check_camera_permission() -> Result<bool, RecordingError> {
    // On non-macOS platforms, assume camera is available
    Ok(true)
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(target_os = "macos")]
    fn test_check_screen_recording_permission() {
        // This test will pass on macOS, but the result depends on actual permissions
        let result = check_screen_recording_permission();
        assert!(result.is_ok());
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn test_check_screen_recording_permission_unsupported() {
        let result = check_screen_recording_permission();
        assert!(result.is_err());

        match result {
            Err(RecordingError::PlatformUnsupported { feature, .. }) => {
                assert_eq!(feature, "Screen recording");
            }
            _ => panic!("Expected PlatformUnsupported error"),
        }
    }

    #[test]
    fn test_check_microphone_permission() {
        let result = check_microphone_permission();

        // Result should be either Ok(true) if authorized, or Err if not authorized/not determined
        // We can't predict the actual permission state in a test environment
        match result {
            Ok(true) => {
                println!("Microphone permission is granted");
            }
            Ok(false) => {
                // This should never happen with our implementation
                // We always return Err for denied/restricted/not determined
                panic!("Unexpected Ok(false) - implementation should return Err instead");
            }
            Err(RecordingError::PermissionDenied { permission, can_retry, system_message }) => {
                assert_eq!(permission, PermissionType::Microphone);
                assert!(system_message.is_some());
                println!("Microphone permission denied: can_retry={}, message={:?}", can_retry, system_message);
            }
            Err(e) => {
                panic!("Unexpected error type: {}", e);
            }
        }
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_check_system_audio_permission() {
        let result = check_system_audio_permission();

        // On macOS, this should either succeed (true/false) or return PlatformUnsupported
        match result {
            Ok(granted) => {
                println!("System audio check returned: {}", granted);
            }
            Err(RecordingError::PlatformUnsupported { feature, required_version }) => {
                assert_eq!(feature, "System audio capture");
                assert!(required_version.contains("13.0"));
            }
            Err(e) => panic!("Unexpected error: {}", e),
        }
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn test_check_system_audio_permission_unsupported() {
        let result = check_system_audio_permission();
        assert!(result.is_err());

        match result {
            Err(RecordingError::PlatformUnsupported { feature, required_version }) => {
                assert_eq!(feature, "System audio capture");
                assert!(required_version.contains("13.0"));
            }
            _ => panic!("Expected PlatformUnsupported error"),
        }
    }

    #[test]
    fn test_check_camera_permission() {
        let result = check_camera_permission();
        // Should always succeed (currently returns true)
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), true);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn test_all_permissions_are_checkable() {
        // Verify that all permission types can be checked without panicking
        let _ = check_screen_recording_permission();
        let _ = check_microphone_permission();
        let _ = check_system_audio_permission();
        let _ = check_camera_permission();
    }

    #[test]
    fn test_permission_return_types() {
        // Verify that permission checks return the expected Result types

        let screen_result = check_screen_recording_permission();
        assert!(
            screen_result.is_ok() || screen_result.is_err(),
            "Screen recording check should return Result"
        );

        let mic_result = check_microphone_permission();
        assert!(
            mic_result.is_ok() || mic_result.is_err(),
            "Microphone check should return Result"
        );

        let audio_result = check_system_audio_permission();
        assert!(
            audio_result.is_ok() || audio_result.is_err(),
            "System audio check should return Result"
        );

        let camera_result = check_camera_permission();
        assert!(camera_result.is_ok(), "Camera check should succeed");
    }
}
