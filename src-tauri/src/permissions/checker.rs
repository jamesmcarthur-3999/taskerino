//! Permission Checker with Caching
//!
//! Provides efficient permission detection with time-based caching to avoid
//! repeated expensive system calls. Cache entries expire after 5 seconds.

use super::error::{RecordingError, PermissionType};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Cache time-to-live: 5 seconds
///
/// Permission states don't change frequently, so we cache results for a short
/// duration to avoid hammering the system APIs. This provides a good balance
/// between freshness and performance.
const CACHE_TTL: Duration = Duration::from_secs(5);

/// Permission cache entry
///
/// Stores the permission check result along with the timestamp when it was cached.
#[derive(Debug, Clone)]
struct CacheEntry {
    /// The cached permission state
    granted: bool,
    /// When this entry was cached
    cached_at: Instant,
}

impl CacheEntry {
    /// Check if this cache entry has expired
    fn is_expired(&self) -> bool {
        self.cached_at.elapsed() > CACHE_TTL
    }
}

lazy_static::lazy_static! {
    /// Global permission cache
    ///
    /// Maps permission types to their cached state and timestamp.
    /// Protected by a Mutex for thread-safe access.
    static ref PERMISSION_CACHE: Mutex<HashMap<PermissionType, CacheEntry>> =
        Mutex::new(HashMap::new());
}

/// Helper function to safely acquire permission cache lock
///
/// Recovers from poisoned lock by using the poisoned data.
/// This is safe because permission cache corruption is not critical -
/// worst case is we re-check permissions.
fn lock_cache() -> std::sync::MutexGuard<'static, HashMap<PermissionType, CacheEntry>> {
    match PERMISSION_CACHE.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("⚠️ [PERMISSIONS] Cache lock poisoned, recovering...");
            poisoned.into_inner()
        }
    }
}

/// Check a permission with caching
///
/// This function first checks the cache for a recent result. If the cache entry
/// is missing or expired, it calls the platform-specific checker and updates
/// the cache.
///
/// # Arguments
///
/// * `perm` - The permission type to check
///
/// # Returns
///
/// * `Ok(true)` - Permission is granted
/// * `Ok(false)` - Permission is denied
/// * `Err(RecordingError)` - An error occurred while checking
///
/// # Example
///
/// ```rust
/// use crate::permissions::checker::check_permission_cached;
/// use crate::permissions::error::PermissionType;
///
/// match check_permission_cached(PermissionType::ScreenRecording) {
///     Ok(true) => println!("Screen recording is allowed"),
///     Ok(false) => println!("Screen recording is denied"),
///     Err(e) => eprintln!("Error checking permission: {}", e),
/// }
/// ```
pub fn check_permission_cached(perm: PermissionType) -> Result<bool, RecordingError> {
    // Try to get cached result first
    {
        let cache = lock_cache();
        if let Some(entry) = cache.get(&perm) {
            if !entry.is_expired() {
                // Cache hit - return cached value
                return Ok(entry.granted);
            }
        }
    }

    // Cache miss or expired - perform actual check
    let granted = check_permission_uncached(perm)?;

    // Update cache
    {
        let mut cache = lock_cache();
        cache.insert(
            perm,
            CacheEntry {
                granted,
                cached_at: Instant::now(),
            },
        );
    }

    Ok(granted)
}

/// Check a permission without caching
///
/// Calls the platform-specific permission checker directly without consulting
/// or updating the cache.
///
/// # Arguments
///
/// * `perm` - The permission type to check
///
/// # Returns
///
/// * `Ok(true)` - Permission is granted
/// * `Ok(false)` - Permission is denied
/// * `Err(RecordingError)` - An error occurred while checking
fn check_permission_uncached(perm: PermissionType) -> Result<bool, RecordingError> {
    match perm {
        PermissionType::ScreenRecording => {
            #[cfg(target_os = "macos")]
            {
                super::macos::check_screen_recording_permission()
            }
            #[cfg(not(target_os = "macos"))]
            {
                Err(RecordingError::PlatformUnsupported {
                    feature: "Screen recording".to_string(),
                    required_version: "macOS 10.15+".to_string(),
                })
            }
        }
        PermissionType::Microphone => {
            #[cfg(target_os = "macos")]
            {
                super::macos::check_microphone_permission()
            }
            #[cfg(not(target_os = "macos"))]
            {
                // On non-macOS platforms, assume microphone is available
                Ok(true)
            }
        }
        PermissionType::SystemAudio => {
            #[cfg(target_os = "macos")]
            {
                super::macos::check_system_audio_permission()
            }
            #[cfg(not(target_os = "macos"))]
            {
                Err(RecordingError::PlatformUnsupported {
                    feature: "System audio capture".to_string(),
                    required_version: "macOS 13.0+".to_string(),
                })
            }
        }
        PermissionType::Camera => {
            #[cfg(target_os = "macos")]
            {
                super::macos::check_camera_permission()
            }
            #[cfg(not(target_os = "macos"))]
            {
                // On non-macOS platforms, assume camera is available
                Ok(true)
            }
        }
    }
}

/// Check all permissions and return results
///
/// Checks all permission types (screen recording, microphone, system audio, camera)
/// and returns a vector of results. Each result is a tuple of the permission type
/// and the check result.
///
/// This function is useful for displaying a comprehensive permission status screen
/// to the user.
///
/// # Returns
///
/// A vector of tuples containing each permission type and its check result.
///
/// # Example
///
/// ```rust
/// use crate::permissions::checker::check_all_permissions;
///
/// let results = check_all_permissions();
/// for (perm, result) in results {
///     match result {
///         Ok(true) => println!("{:?} is granted", perm),
///         Ok(false) => println!("{:?} is denied", perm),
///         Err(e) => println!("{:?} check failed: {}", perm, e),
///     }
/// }
/// ```
pub fn check_all_permissions() -> Vec<(PermissionType, Result<bool, RecordingError>)> {
    vec![
        PermissionType::ScreenRecording,
        PermissionType::Microphone,
        PermissionType::SystemAudio,
        PermissionType::Camera,
    ]
    .into_iter()
    .map(|perm| {
        let result = check_permission_cached(perm);
        (perm, result)
    })
    .collect()
}

/// Invalidate the permission cache
///
/// Clears all cached permission entries, forcing the next check to query the
/// system directly. This should be called after the user grants a permission
/// in System Settings.
///
/// # Example
///
/// ```rust
/// use crate::permissions::checker::invalidate_cache;
///
/// // User just granted screen recording permission in System Settings
/// invalidate_cache();
///
/// // Next check will query the system directly
/// let granted = check_permission_cached(PermissionType::ScreenRecording);
/// ```
pub fn invalidate_cache() {
    let mut cache = lock_cache();
    cache.clear();
}

/// Invalidate a specific permission in the cache
///
/// Clears the cached entry for a single permission type, forcing the next check
/// to query the system. This is more efficient than invalidating the entire cache
/// when you know which permission was just granted.
///
/// # Arguments
///
/// * `perm` - The permission type to invalidate
///
/// # Example
///
/// ```rust
/// use crate::permissions::checker::invalidate_permission;
/// use crate::permissions::error::PermissionType;
///
/// // User just granted microphone permission
/// invalidate_permission(PermissionType::Microphone);
/// ```
pub fn invalidate_permission(perm: PermissionType) {
    let mut cache = lock_cache();
    cache.remove(&perm);
}

/// Get cache statistics for debugging
///
/// Returns information about the current cache state, including the number of
/// cached entries and how many are expired.
///
/// # Returns
///
/// A tuple of (total_entries, expired_entries)
#[allow(dead_code)]
pub fn get_cache_stats() -> (usize, usize) {
    let cache = lock_cache();
    let total = cache.len();
    let expired = cache.values().filter(|entry| entry.is_expired()).count();
    (total, expired)
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn test_cache_entry_expiration() {
        let entry = CacheEntry {
            granted: true,
            cached_at: Instant::now(),
        };

        // Fresh entry should not be expired
        assert!(!entry.is_expired());

        // Create an old entry
        let old_entry = CacheEntry {
            granted: true,
            cached_at: Instant::now() - Duration::from_secs(10),
        };

        // Old entry should be expired
        assert!(old_entry.is_expired());
    }

    #[test]
    fn test_invalidate_cache() {
        // Clear cache first
        invalidate_cache();

        // Manually populate cache
        {
            let mut cache = lock_cache();
            cache.insert(
                PermissionType::Microphone,
                CacheEntry {
                    granted: true,
                    cached_at: Instant::now(),
                },
            );
        }

        // Verify cache has entry
        {
            let cache = lock_cache();
            assert_eq!(cache.len(), 1);
        }

        // Invalidate cache
        invalidate_cache();

        // Verify cache is empty
        {
            let cache = lock_cache();
            assert_eq!(cache.len(), 0);
        }
    }

    #[test]
    fn test_invalidate_permission() {
        // Clear cache first
        invalidate_cache();

        // Populate cache with multiple entries
        {
            let mut cache = lock_cache();
            cache.insert(
                PermissionType::Microphone,
                CacheEntry {
                    granted: true,
                    cached_at: Instant::now(),
                },
            );
            cache.insert(
                PermissionType::Camera,
                CacheEntry {
                    granted: false,
                    cached_at: Instant::now(),
                },
            );
        }

        // Verify cache has 2 entries
        {
            let cache = lock_cache();
            assert_eq!(cache.len(), 2);
        }

        // Invalidate only microphone permission
        invalidate_permission(PermissionType::Microphone);

        // Verify only microphone was removed
        {
            let cache = lock_cache();
            assert_eq!(cache.len(), 1);
            assert!(cache.contains_key(&PermissionType::Camera));
            assert!(!cache.contains_key(&PermissionType::Microphone));
        }
    }

    #[test]
    fn test_get_cache_stats() {
        // Clear cache first
        invalidate_cache();

        // Populate cache with fresh and expired entries
        {
            let mut cache = lock_cache();

            // Fresh entry
            cache.insert(
                PermissionType::Microphone,
                CacheEntry {
                    granted: true,
                    cached_at: Instant::now(),
                },
            );

            // Expired entry
            cache.insert(
                PermissionType::Camera,
                CacheEntry {
                    granted: false,
                    cached_at: Instant::now() - Duration::from_secs(10),
                },
            );
        }

        let (total, expired) = get_cache_stats();
        assert_eq!(total, 2);
        assert_eq!(expired, 1);
    }

    #[test]
    fn test_check_all_permissions() {
        let results = check_all_permissions();

        // Should return results for all 4 permission types
        assert_eq!(results.len(), 4);

        // Verify all permission types are present
        let perm_types: Vec<PermissionType> = results.iter().map(|(perm, _)| *perm).collect();
        assert!(perm_types.contains(&PermissionType::ScreenRecording));
        assert!(perm_types.contains(&PermissionType::Microphone));
        assert!(perm_types.contains(&PermissionType::SystemAudio));
        assert!(perm_types.contains(&PermissionType::Camera));
    }

    #[test]
    fn test_cache_expiration_integration() {
        // Clear cache
        invalidate_cache();

        // Test 1: Insert a fresh entry
        {
            let mut cache = lock_cache();
            cache.insert(
                PermissionType::Microphone,
                CacheEntry {
                    granted: true,
                    cached_at: Instant::now(),
                },
            );
        }

        // Fresh entry should not be expired
        {
            let cache = lock_cache();
            let entry = cache.get(&PermissionType::Microphone).unwrap();
            assert!(!entry.is_expired());
        }

        // Test 2: Insert an already-expired entry (6 seconds old)
        {
            let mut cache = lock_cache();
            cache.insert(
                PermissionType::Camera,
                CacheEntry {
                    granted: false,
                    cached_at: Instant::now() - Duration::from_secs(6),
                },
            );
        }

        // Old entry should be expired
        {
            let cache = lock_cache();
            let entry = cache.get(&PermissionType::Camera).unwrap();
            assert!(entry.is_expired());
        }
    }
}
