//! Permissions Module
//!
//! Comprehensive permissions error handling and detection system for recording
//! services (screenshots, audio, video).
//!
//! # Architecture
//!
//! This module provides three main components:
//!
//! 1. **Error Types** (`error.rs`) - Structured error handling with Serde
//!    serialization for TypeScript interop
//! 2. **Permission Checker** (`checker.rs`) - Cached permission detection
//!    with 5-second TTL
//! 3. **Platform Implementation** (`macos.rs`) - macOS-specific permission
//!    checks using system APIs
//!
//! # Usage
//!
//! ## Basic Permission Check
//!
//! ```rust
//! use crate::permissions::{check_permission_cached, PermissionType};
//!
//! match check_permission_cached(PermissionType::ScreenRecording) {
//!     Ok(true) => println!("Screen recording is allowed"),
//!     Ok(false) => println!("Screen recording is denied"),
//!     Err(e) => eprintln!("Error checking permission: {}", e),
//! }
//! ```
//!
//! ## Check All Permissions
//!
//! ```rust
//! use crate::permissions::check_all_permissions;
//!
//! let results = check_all_permissions();
//! for (perm, result) in results {
//!     match result {
//!         Ok(true) => println!("{:?} is granted", perm),
//!         Ok(false) => println!("{:?} is denied", perm),
//!         Err(e) => println!("{:?} check failed: {}", perm, e),
//!     }
//! }
//! ```
//!
//! ## Cache Invalidation
//!
//! ```rust
//! use crate::permissions::{invalidate_cache, invalidate_permission, PermissionType};
//!
//! // User just granted screen recording permission in System Settings
//! invalidate_permission(PermissionType::ScreenRecording);
//!
//! // Or clear entire cache
//! invalidate_cache();
//! ```
//!
//! ## Error Handling
//!
//! ```rust
//! use crate::permissions::{RecordingError, check_permission_cached, PermissionType};
//!
//! match check_permission_cached(PermissionType::SystemAudio) {
//!     Ok(true) => { /* proceed */ }
//!     Ok(false) => {
//!         // Show user a dialog to grant permission
//!     }
//!     Err(RecordingError::PlatformUnsupported { feature, required_version }) => {
//!         eprintln!("{} requires {}", feature, required_version);
//!     }
//!     Err(e) => {
//!         eprintln!("Unexpected error: {}", e);
//!     }
//! }
//! ```
//!
//! # Platform Support
//!
//! - **macOS**: Full support for all permission types
//!   - Screen Recording: Requires macOS 10.15+ (Catalina)
//!   - System Audio: Requires macOS 13.0+ (Ventura)
//!   - Microphone: All versions
//!   - Camera: All versions
//! - **Other Platforms**: Limited support (returns PlatformUnsupported for
//!   screen recording and system audio)

pub mod error;
pub mod checker;

#[cfg(target_os = "macos")]
pub mod macos;

// Re-export core types for convenient access
pub use error::{
    RecordingError,
    PermissionType,
    DeviceType,
    ErrorSource,
};

// Re-export checker functions
pub use checker::{
    check_permission_cached,
    check_all_permissions,
    invalidate_cache,
    invalidate_permission,
};

// Re-export platform-specific functions when on macOS
#[cfg(target_os = "macos")]
pub use macos::{
    check_screen_recording_permission,
    check_microphone_permission,
    check_system_audio_permission,
    check_camera_permission,
    request_microphone_permission,
    request_camera_permission,
};
