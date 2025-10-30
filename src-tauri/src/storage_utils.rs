/**
 * Storage Utilities Module (Fix #4C)
 *
 * Provides disk space checking functionality to prevent silent failures
 * when disk is full. Implements cross-platform disk space checks with
 * platform-specific optimizations.
 *
 * **Features**:
 * - Cross-platform disk space checking (macOS, Linux, Windows)
 * - Minimum free space threshold enforcement (100 MB)
 * - Size estimation for data before writing
 * - User-friendly error messages
 */

use std::path::Path;
use tauri::{AppHandle, Manager};

/// Minimum free space threshold (100 MB)
/// This ensures the OS and other apps have enough space to function
const MIN_FREE_SPACE: u64 = 100 * 1024 * 1024; // 100 MB in bytes

/// Storage error types for disk space issues
#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("Insufficient disk space: {available_mb} MB available, {required_mb} MB required at {path}")]
    InsufficientSpace {
        available_mb: u64,
        required_mb: u64,
        path: String,
    },

    #[error("Invalid path")]
    InvalidPath,

    #[error("Filesystem error: {0}")]
    FilesystemError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),
}

/// Disk space information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiskSpaceInfo {
    /// Total disk space in bytes
    pub total: u64,
    /// Available disk space in bytes
    pub available: u64,
    /// Used disk space in bytes (total - available)
    pub used: u64,
    /// Available space in MB (for display)
    pub available_mb: u64,
    /// Path checked
    pub path: String,
}

/// Check if sufficient disk space is available before writing
///
/// # Arguments
/// * `path` - Directory path to check (typically app data directory)
/// * `required_bytes` - Number of bytes required for the operation
///
/// # Returns
/// * `Ok(())` if sufficient space is available
/// * `Err(StorageError::InsufficientSpace)` if not enough space
///
/// # Example
/// ```rust
/// let path = Path::new("/path/to/app/data");
/// let size = 50 * 1024 * 1024; // 50 MB
/// check_disk_space(path, size)?;
/// ```
pub fn check_disk_space(path: &Path, required_bytes: u64) -> Result<(), StorageError> {
    let available = get_available_space(path)?;

    // Ensure at least required bytes + minimum threshold
    // Use saturating_add to prevent overflow
    let needed = required_bytes.saturating_add(MIN_FREE_SPACE);

    if available < needed {
        return Err(StorageError::InsufficientSpace {
            available_mb: available / (1024 * 1024),
            required_mb: needed / (1024 * 1024),
            path: path.to_string_lossy().to_string(),
        });
    }

    Ok(())
}

/// Get available disk space for a path (macOS implementation)
#[cfg(target_os = "macos")]
fn get_available_space(path: &Path) -> Result<u64, StorageError> {
    use std::ffi::CString;
    use std::os::raw::c_char;

    // statvfs structure (macOS)
    #[repr(C)]
    struct statvfs {
        f_bsize: u64,   // File system block size
        f_frsize: u64,  // Fragment size
        f_blocks: u64,  // Total blocks
        f_bfree: u64,   // Free blocks
        f_bavail: u64,  // Available blocks (for non-root)
        f_files: u64,   // Total file nodes
        f_ffree: u64,   // Free file nodes
        f_favail: u64,  // Available file nodes
        f_fsid: u64,    // File system ID
        f_flag: u64,    // Mount flags
        f_namemax: u64, // Maximum filename length
    }

    extern "C" {
        fn statvfs(path: *const c_char, buf: *mut statvfs) -> i32;
    }

    let c_path = CString::new(path.to_str().ok_or(StorageError::InvalidPath)?)
        .map_err(|_| StorageError::InvalidPath)?;

    let mut stats: statvfs = unsafe { std::mem::zeroed() };

    unsafe {
        if statvfs(c_path.as_ptr(), &mut stats) == 0 {
            // Available space = available blocks * block size
            // Use f_bavail (available to non-root users) instead of f_bfree
            // Use checked multiplication to prevent overflow
            let available = stats
                .f_bavail
                .checked_mul(stats.f_bsize)
                .unwrap_or(u64::MAX);
            Ok(available)
        } else {
            Err(StorageError::FilesystemError(
                "Failed to get filesystem stats (statvfs returned error)".to_string(),
            ))
        }
    }
}

/// Get available disk space for a path (Linux implementation)
#[cfg(target_os = "linux")]
fn get_available_space(path: &Path) -> Result<u64, StorageError> {
    use std::ffi::CString;
    use std::os::raw::c_char;

    // Linux statvfs structure (same as macOS, but included for completeness)
    #[repr(C)]
    struct statvfs {
        f_bsize: u64,
        f_frsize: u64,
        f_blocks: u64,
        f_bfree: u64,
        f_bavail: u64,
        f_files: u64,
        f_ffree: u64,
        f_favail: u64,
        f_fsid: u64,
        f_flag: u64,
        f_namemax: u64,
    }

    extern "C" {
        fn statvfs(path: *const c_char, buf: *mut statvfs) -> i32;
    }

    let c_path = CString::new(path.to_str().ok_or(StorageError::InvalidPath)?)
        .map_err(|_| StorageError::InvalidPath)?;

    let mut stats: statvfs = unsafe { std::mem::zeroed() };

    unsafe {
        if statvfs(c_path.as_ptr(), &mut stats) == 0 {
            let available = stats
                .f_bavail
                .checked_mul(stats.f_bsize)
                .unwrap_or(u64::MAX);
            Ok(available)
        } else {
            Err(StorageError::FilesystemError(
                "Failed to get filesystem stats".to_string(),
            ))
        }
    }
}

/// Get available disk space for a path (Windows implementation)
#[cfg(target_os = "windows")]
fn get_available_space(path: &Path) -> Result<u64, StorageError> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    extern "system" {
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
    }

    let path_wide: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut available_bytes: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut free_bytes: u64 = 0;

    unsafe {
        if GetDiskFreeSpaceExW(
            path_wide.as_ptr(),
            &mut available_bytes,
            &mut total_bytes,
            &mut free_bytes,
        ) != 0
        {
            Ok(available_bytes)
        } else {
            Err(StorageError::FilesystemError(
                "Failed to get disk space (GetDiskFreeSpaceExW failed)".to_string(),
            ))
        }
    }
}

/// Estimate size of data to be written (for JSON serialization)
///
/// Serializes data to JSON to estimate the byte size, then adds 20% overhead
/// for formatting, metadata, compression, etc.
///
/// # Example
/// ```rust
/// let session = Session { ... };
/// let estimated_size = estimate_json_size(&session)?;
/// ```
pub fn estimate_json_size<T: serde::Serialize>(data: &T) -> Result<u64, StorageError> {
    // Serialize to JSON to estimate size
    let json = serde_json::to_string(data)
        .map_err(|e| StorageError::SerializationError(e.to_string()))?;

    // Add 20% overhead for formatting, metadata, compression artifacts, etc.
    let estimated = (json.len() as f64 * 1.2) as u64;

    Ok(estimated)
}

/// Get comprehensive disk space information
///
/// Returns total, used, and available space for the given path.
/// Used by UI to display storage information.
///
/// # Example
/// ```rust
/// let info = get_disk_space_info(Path::new("/app/data"))?;
/// println!("Available: {} MB", info.available_mb);
/// ```
pub fn get_disk_space_info(path: &Path) -> Result<DiskSpaceInfo, StorageError> {
    let available = get_available_space(path)?;

    // Get total space (platform-specific)
    let total = get_total_space(path)?;
    let used = total.saturating_sub(available);

    Ok(DiskSpaceInfo {
        total,
        available,
        used,
        available_mb: available / (1024 * 1024),
        path: path.to_string_lossy().to_string(),
    })
}

/// Get total disk space (macOS/Linux)
#[cfg(any(target_os = "macos", target_os = "linux"))]
fn get_total_space(path: &Path) -> Result<u64, StorageError> {
    use std::ffi::CString;
    use std::os::raw::c_char;

    #[repr(C)]
    struct statvfs {
        f_bsize: u64,
        f_frsize: u64,
        f_blocks: u64,
        f_bfree: u64,
        f_bavail: u64,
        f_files: u64,
        f_ffree: u64,
        f_favail: u64,
        f_fsid: u64,
        f_flag: u64,
        f_namemax: u64,
    }

    extern "C" {
        fn statvfs(path: *const c_char, buf: *mut statvfs) -> i32;
    }

    let c_path = CString::new(path.to_str().ok_or(StorageError::InvalidPath)?)
        .map_err(|_| StorageError::InvalidPath)?;

    let mut stats: statvfs = unsafe { std::mem::zeroed() };

    unsafe {
        if statvfs(c_path.as_ptr(), &mut stats) == 0 {
            let total = stats
                .f_blocks
                .checked_mul(stats.f_bsize)
                .unwrap_or(u64::MAX);
            Ok(total)
        } else {
            Err(StorageError::FilesystemError(
                "Failed to get total space".to_string(),
            ))
        }
    }
}

/// Get total disk space (Windows)
#[cfg(target_os = "windows")]
fn get_total_space(path: &Path) -> Result<u64, StorageError> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    extern "system" {
        fn GetDiskFreeSpaceExW(
            lpDirectoryName: *const u16,
            lpFreeBytesAvailableToCaller: *mut u64,
            lpTotalNumberOfBytes: *mut u64,
            lpTotalNumberOfFreeBytes: *mut u64,
        ) -> i32;
    }

    let path_wide: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut available_bytes: u64 = 0;
    let mut total_bytes: u64 = 0;
    let mut free_bytes: u64 = 0;

    unsafe {
        if GetDiskFreeSpaceExW(
            path_wide.as_ptr(),
            &mut available_bytes,
            &mut total_bytes,
            &mut free_bytes,
        ) != 0
        {
            Ok(total_bytes)
        } else {
            Err(StorageError::FilesystemError(
                "Failed to get total space".to_string(),
            ))
        }
    }
}

/// Tauri command: Check disk space before write operation
///
/// Called from TypeScript before storage writes to ensure sufficient space.
///
/// # Example (TypeScript)
/// ```typescript
/// await invoke('check_storage_space', { requiredBytes: 50_000_000 });
/// ```
#[tauri::command]
pub async fn check_storage_space(
    app_handle: AppHandle,
    required_bytes: u64,
) -> Result<(), String> {
    // Get app data directory
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Check disk space
    check_disk_space(&data_dir, required_bytes).map_err(|e| match e {
        StorageError::InsufficientSpace {
            available_mb,
            required_mb,
            ..
        } => {
            // User-friendly error message (NO TECHNICAL JARGON)
            format!(
                "Not enough disk space. {} MB available, {} MB needed. Please free up space and try again.",
                available_mb, required_mb
            )
        }
        _ => e.to_string(),
    })
}

/// Tauri command: Get disk space information for UI display
///
/// Returns comprehensive disk space info for settings/storage management UI.
///
/// # Example (TypeScript)
/// ```typescript
/// const info = await invoke<DiskSpaceInfo>('get_storage_info');
/// console.log(`Available: ${info.available_mb} MB`);
/// ```
#[tauri::command]
pub async fn get_storage_info(app_handle: AppHandle) -> Result<DiskSpaceInfo, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    get_disk_space_info(&data_dir).map_err(|e| e.to_string())
}

/// Tauri command: Open storage location in file explorer
///
/// Opens the app data directory in Finder (macOS), Explorer (Windows), or file manager (Linux).
#[tauri::command]
pub async fn open_storage_location(app_handle: AppHandle) -> Result<(), String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Open in system file manager
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open Explorer: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&data_dir)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_check_disk_space_sufficient() {
        // Test with a reasonable amount of space (1 KB)
        let path = Path::new("/tmp");
        let result = check_disk_space(path, 1024);

        // Should succeed on any system with at least 100 MB free
        assert!(
            result.is_ok(),
            "Expected disk space check to pass for 1 KB"
        );
    }

    #[test]
    fn test_check_disk_space_insufficient() {
        // Test with a very large (but not overflow-causing) amount
        let path = Path::new("/tmp");
        let available = get_available_space(path).expect("Should get available space");

        // Skip test if we encountered overflow (available == u64::MAX)
        if available == u64::MAX {
            println!("Skipping test: disk space query returned u64::MAX (overflow)");
            return;
        }

        // Request more than available: available - MIN_FREE_SPACE + 1GB
        // This ensures we request more than is actually available
        let requested = if available > MIN_FREE_SPACE + 1024 * 1024 * 1024 {
            available - MIN_FREE_SPACE + 1024 * 1024 * 1024
        } else {
            // If disk is nearly full, just request all available space
            available
        };

        let result = check_disk_space(path, requested);

        // Should fail - requesting more than available (after accounting for threshold)
        assert!(
            result.is_err(),
            "Expected disk space check to fail when requesting {} bytes with {} available",
            requested,
            available
        );

        if let Err(StorageError::InsufficientSpace { available_mb, required_mb, .. }) = result {
            println!("Correctly detected insufficient space: {} MB available, {} MB required", available_mb, required_mb);
        } else {
            panic!("Expected InsufficientSpace error, got: {:?}", result);
        }
    }

    #[test]
    fn test_get_available_space() {
        let path = Path::new("/tmp");
        let result = get_available_space(path);

        assert!(result.is_ok(), "Should get available space");
        let space = result.unwrap();
        assert!(space > 0, "Available space should be positive");
        println!("Available space: {} bytes ({} MB)", space, space / 1024 / 1024);
    }

    #[test]
    fn test_estimate_json_size() {
        #[derive(serde::Serialize)]
        struct TestData {
            name: String,
            value: i32,
        }

        let data = TestData {
            name: "test".to_string(),
            value: 42,
        };

        let result = estimate_json_size(&data);
        assert!(result.is_ok(), "Should estimate size");

        let size = result.unwrap();
        // JSON would be roughly: {"name":"test","value":42} = ~27 bytes
        // With 20% overhead: ~32 bytes
        assert!(size >= 20 && size <= 50, "Size estimate should be reasonable: {} bytes", size);
        println!("Estimated JSON size: {} bytes", size);
    }

    #[test]
    fn test_get_disk_space_info() {
        let path = Path::new("/tmp");
        let result = get_disk_space_info(path);

        assert!(result.is_ok(), "Should get disk space info");
        let info = result.unwrap();

        assert!(info.total > 0, "Total space should be positive");
        assert!(info.available > 0, "Available space should be positive");
        assert!(info.used >= 0, "Used space should be non-negative");
        assert!(info.total >= info.available, "Total should be >= available");

        println!(
            "Disk space info: {} MB available / {} MB total",
            info.available_mb,
            info.total / 1024 / 1024
        );
    }

    #[test]
    fn test_min_free_space_threshold() {
        // Verify MIN_FREE_SPACE is 100 MB
        assert_eq!(
            MIN_FREE_SPACE,
            100 * 1024 * 1024,
            "Minimum free space should be 100 MB"
        );
    }
}
