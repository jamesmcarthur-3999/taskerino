/**
 * Video Recording Module
 *
 * Captures screen recordings during sessions using ScreenCaptureKit (via Swift FFI).
 *
 * **Implementation Status**: Functional via Swift ScreenRecorder module
 * **Platform**: macOS 12.3+ only
 */
use std::ffi::CString;
use std::os::raw::c_char;
use std::sync::Arc;
use tauri::Manager;

// Note: RecordingError and related types now mostly handled by recording/ module

// FFI declarations for Swift functions
// NOTE: Most video recording functionality now uses recording/ module with recording_session_* FFI
// These remaining functions are used by legacy commands and will be phased out
#[cfg(target_os = "macos")]
extern "C" {
    // Utility functions (still used by commands)
    fn screen_recorder_get_duration(path: *const c_char) -> f64;
    fn screen_recorder_is_video_ready(path: *const c_char) -> bool;
    fn screen_recorder_generate_thumbnail(path: *const c_char, time: f64) -> *const c_char;

    // Enumeration functions (wrapped by recording/ module, not called directly)
    #[allow(dead_code)]
    fn screen_recorder_enumerate_displays() -> *const c_char;
    #[allow(dead_code)]
    fn screen_recorder_enumerate_windows() -> *const c_char;
    #[allow(dead_code)]
    fn screen_recorder_enumerate_webcams() -> *const c_char;
}

/// Video quality settings (legacy - kept for backward compatibility with old commands)
/// New code should use recording::VideoQuality from recording/ module
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[allow(dead_code)]  // Used by Tauri command parameters
pub struct VideoQuality {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

impl Default for VideoQuality {
    fn default() -> Self {
        VideoQuality {
            width: 1280, // 720p
            height: 720,
            fps: 15, // Good balance for filesize/quality
        }
    }
}

// VideoRecorder struct REMOVED - migrated to recording/ module
// All functionality now uses SwiftRecordingSession from recording/ module

// ============================================================================
// Enumeration Functions
// ============================================================================
// Enumeration is handled by recording::ffi module
// ============================================================================
// Tauri Commands
// ============================================================================

/// Tauri command to start a simple single-source recording
/// This is a simplified API for basic use cases - migrated to use recording/ module
#[tauri::command]
pub async fn start_video_recording(
    session_id: String,
    output_path: String,
    quality: Option<VideoQuality>,
    display_id: Option<u32>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use crate::SessionManager;
    use crate::recording::SwiftRecordingSession;

    // Reject new operations during shutdown (Fix #13)
    if crate::shutdown::is_shutting_down() {
        return Err("Application is shutting down - cannot start new recording".to_string());
    }

    let manager = app_handle.state::<SessionManager>();

    // Parse quality
    let quality_preset = quality.unwrap_or_default();
    let (width, height, fps) = (
        quality_preset.width as i32,
        quality_preset.height as i32,
        quality_preset.fps as i32,
    );

    // Create recording session (defaults to capturing main display)
    let mut session = SwiftRecordingSession::new(&output_path, width, height, fps)
        .map_err(|e| format!("Failed to create recording session: {}", e))?;

    // Add display (use provided display_id or default to 0)
    let display_to_use = display_id.unwrap_or(0);
    println!("🖥️ [VIDEO] Adding display ID: {}", display_to_use);
    session.add_display(display_to_use)
        .map_err(|e| format!("Failed to add display {}: {}", display_to_use, e))?;

    // Start recording
    session.start().await
        .map_err(|e| format!("Failed to start recording: {}", e))?;

    // Store in SessionManager
    {
        let mut sessions = manager.sessions.lock()
            .map_err(|e| format!("Failed to lock sessions: {}", e))?;
        sessions.insert(session_id.clone(), std::sync::Arc::new(session));
    }

    println!("✅ [VIDEO] Started recording session: {}", session_id);
    Ok(())
}

/// Tauri command to stop a recording session - migrated to use SessionManager
#[tauri::command]
pub async fn stop_video_recording(
    session_id: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    use crate::SessionManager;

    let manager = app_handle.state::<SessionManager>();

    // Remove session from manager
    let session_arc = {
        let mut sessions = manager.sessions.lock()
            .map_err(|e| format!("Failed to lock sessions: {}", e))?;
        sessions.remove(&session_id)
            .ok_or_else(|| format!("Session not found: {}", session_id))?
    };

    // Try to get exclusive ownership to call stop explicitly
    match std::sync::Arc::try_unwrap(session_arc) {
        Ok(mut session) => {
            println!("🛑 [VIDEO] Stopping recording session: {}", session_id);
            session.stop().await
                .map_err(|e| format!("Failed to stop recording: {}", e))?;

            Ok("Recording stopped successfully".to_string())
        }
        Err(arc) => {
            println!("⚠️  [VIDEO] Multiple references to session exist, relying on Drop");
            // Put it back if there are other references
            let mut sessions = manager.sessions.lock()
                .map_err(|e| format!("Failed to lock sessions: {}", e))?;
            sessions.insert(session_id, arc);
            Err("Cannot stop session with multiple references".to_string())
        }
    }
}

/// Tauri command to check if currently recording - migrated to use SessionManager
#[tauri::command]
pub async fn is_recording(
    session_id: String,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    use crate::SessionManager;

    let manager = app_handle.state::<SessionManager>();
    let sessions = manager.sessions.lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    Ok(sessions.contains_key(&session_id))
}

/// Tauri command to get current recording session - migrated to use SessionManager
#[tauri::command]
pub async fn get_current_recording_session(
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, String> {
    use crate::SessionManager;

    let manager = app_handle.state::<SessionManager>();
    let sessions = manager.sessions.lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    // Return first session ID if any exist
    Ok(sessions.keys().next().map(|s| s.clone()))
}

/// Tauri command to get video duration in seconds
#[tauri::command]
pub async fn get_video_duration(video_path: String) -> Result<f64, String> {
    #[cfg(target_os = "macos")]
    {
        let c_path = CString::new(video_path).map_err(|_| "Invalid video path")?;

        let duration = unsafe { screen_recorder_get_duration(c_path.as_ptr()) };
        Ok(duration)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Video duration extraction only supported on macOS".to_string())
    }
}

/// Tauri command to generate video thumbnail
#[tauri::command]
pub async fn generate_video_thumbnail(
    video_path: String,
    time: Option<f64>,
) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CStr;

        let c_path = CString::new(video_path).map_err(|_| "Invalid video path")?;

        let time = time.unwrap_or(1.0); // Default to 1 second into video

        let thumbnail_ptr = unsafe { screen_recorder_generate_thumbnail(c_path.as_ptr(), time) };

        if thumbnail_ptr.is_null() {
            return Err("Failed to generate thumbnail: Swift returned null pointer".to_string());
        }

        // Convert C string to Rust String
        let thumbnail = unsafe { CStr::from_ptr(thumbnail_ptr).to_string_lossy().into_owned() };

        // Free the C string (allocated by Swift's strdup)
        unsafe {
            libc::free(thumbnail_ptr as *mut libc::c_void);
        }

        // Check if Swift returned an error message instead of thumbnail data
        if thumbnail.starts_with("ERROR:") {
            return Err(thumbnail.trim_start_matches("ERROR:").trim().to_string());
        }

        Ok(thumbnail)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Thumbnail generation only supported on macOS".to_string())
    }
}

/// Tauri command to check if video file is ready for reading
#[tauri::command]
pub async fn is_video_ready(video_path: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let c_path = CString::new(video_path.clone()).map_err(|_| "Invalid video path")?;

        let is_ready = unsafe { screen_recorder_is_video_ready(c_path.as_ptr()) };

        println!("🔍 [VIDEO READY CHECK] {}: {}", video_path, if is_ready { "READY" } else { "NOT READY" });

        Ok(is_ready)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Video readiness check only supported on macOS".to_string())
    }
}

// DEPRECATED: start_video_recording_advanced command removed
// Use start_multi_source_recording instead for advanced recording scenarios

/// Tauri command to enumerate all displays
#[tauri::command]
pub async fn enumerate_displays() -> Result<Vec<crate::types::DisplayInfo>, String> {
    use crate::recording::enumerate_displays as enumerate;

    enumerate().await
        .map_err(|e| format!("Failed to enumerate displays: {}", e))
}

/// Tauri command to enumerate all windows
#[tauri::command]
pub async fn enumerate_windows() -> Result<Vec<crate::types::WindowInfo>, String> {
    use crate::recording::enumerate_windows as enumerate;

    enumerate().await
        .map_err(|e| format!("Failed to enumerate windows: {}", e))
}

/// Tauri command to enumerate all webcams
#[tauri::command]
pub async fn enumerate_webcams() -> Result<Vec<crate::types::WebcamInfo>, String> {
    use crate::recording::enumerate_webcams as enumerate;

    enumerate().await
        .map_err(|e| format!("Failed to enumerate webcams: {}", e))
}

/// Tauri command to switch display during recording - migrated to use switch_recording_source
#[tauri::command]
pub async fn switch_display(
    display_id: String,
    session_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // Delegate to switch_recording_source with proper parameters
    // Assumes we're switching FROM a display to another display
    switch_recording_source(
        session_id,
        "0".to_string(),  // Old display ID (placeholder - actual ID doesn't matter for display->display switch)
        "display".to_string(),
        display_id,
        app_handle,
    ).await
}

/// Tauri command to update PiP configuration during recording
/// NOTE: This command is deprecated - PiP config should be set at session creation time
#[tauri::command]
pub async fn update_webcam_mode(
    _pip_config: crate::types::PiPConfig,
    _session_id: String,
    _app_handle: tauri::AppHandle,
) -> Result<(), String> {
    // PiP configuration is not dynamically updateable in the new architecture
    // It must be set when creating the recording session
    Err("Dynamic PiP configuration updates not supported. Please restart recording with new PiP settings.".to_string())
}

/// Tauri command to pause an active multi-source recording session
#[tauri::command]
pub async fn pause_recording(
    session_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use crate::SessionManager;

    let manager = app_handle.state::<SessionManager>();

    // Clone the Arc to avoid holding the mutex across await
    let session = {
        let sessions = manager.sessions.lock()
            .map_err(|e| format!("Failed to lock sessions: {}", e))?;
        sessions.get(&session_id)
            .cloned()
            .ok_or_else(|| format!("Session not found: {}", session_id))?
    };

    session.pause().await
        .map_err(|e| format!("Failed to pause recording: {}", e))
}

/// Tauri command to resume a paused multi-source recording session
#[tauri::command]
pub async fn resume_recording(
    session_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use crate::SessionManager;

    let manager = app_handle.state::<SessionManager>();

    // Clone the Arc to avoid holding the mutex across await
    let session = {
        let sessions = manager.sessions.lock()
            .map_err(|e| format!("Failed to lock sessions: {}", e))?;
        sessions.get(&session_id)
            .cloned()
            .ok_or_else(|| format!("Session not found: {}", session_id))?
    };

    session.resume().await
        .map_err(|e| format!("Failed to resume recording: {}", e))
}

/// Tauri command to check if a recording session is paused
#[tauri::command]
pub fn is_recording_paused(
    session_id: String,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    use crate::SessionManager;

    let manager = app_handle.state::<SessionManager>();

    // Access session from manager (borrow, don't clone)
    let sessions = manager.sessions.lock()
        .map_err(|e| format!("Failed to lock sessions: {}", e))?;

    let session = sessions.get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    Ok(session.is_paused())
}

/// Tauri command to switch a source in an active recording
#[tauri::command]
pub async fn switch_recording_source(
    session_id: String,
    old_source_id: String,
    source_type: String,  // "display", "window", "webcam"
    new_source_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use crate::SessionManager;
    use crate::recording::SourceType;

    let manager = app_handle.state::<SessionManager>();

    // Clone the Arc to avoid holding the mutex across await
    let session = {
        let sessions = manager.sessions.lock()
            .map_err(|e| format!("Failed to lock sessions: {}", e))?;
        sessions.get(&session_id)
            .cloned()
            .ok_or_else(|| format!("Session not found: {}", session_id))?
    };

    let src_type = match source_type.as_str() {
        "display" => SourceType::Display,
        "window" => SourceType::Window,
        "webcam" => SourceType::Webcam,
        _ => return Err(format!("Invalid source type: {}", source_type)),
    };

    session.switch_source(&old_source_id, src_type, &new_source_id).await
        .map_err(|e| format!("Failed to switch source: {}", e))
}

// ============================================================================
// Multi-Source Recording API (Task 2.9 - Phase 2)
// ============================================================================

use crate::recording::{CompositorType, RecordingStats, SwiftRecordingSession};

/// Tauri command to start multi-source recording
///
/// This is the new API that supports recording from multiple displays/windows simultaneously
/// with configurable composition.
///
/// # Arguments
/// * `session_id` - Unique identifier for this recording session
/// * `output_path` - Path where the video file will be saved
/// * `width` - Output video width in pixels
/// * `height` - Output video height in pixels
/// * `fps` - Output video frame rate
/// * `display_ids` - Optional array of display IDs to record (CGDirectDisplayID values)
/// * `window_ids` - Optional array of window IDs to record (CGWindowID values)
/// * `compositor_type` - Layout type: "passthrough", "grid", or "sidebyside"
#[tauri::command]
pub async fn start_multi_source_recording(
    app_handle: tauri::AppHandle,
    session_id: String,
    output_path: String,
    width: i32,
    height: i32,
    fps: i32,
    display_ids: Option<Vec<u32>>,
    window_ids: Option<Vec<u32>>,
    webcam_device_ids: Option<Vec<String>>,
    compositor_type: Option<String>,
) -> Result<(), String> {
    // Reject new operations during shutdown (Fix #13)
    if crate::shutdown::is_shutting_down() {
        return Err("Application is shutting down - cannot start new recording".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        println!("🎬 [Multi-Source] Starting recording for session: {}", session_id);
        println!("   Output: {}", output_path);
        println!("   Resolution: {}x{} @ {}fps", width, height, fps);
        println!("   Displays: {:?}", display_ids);
        println!("   Windows: {:?}", window_ids);
        println!("   Webcams: {:?}", webcam_device_ids);
        println!("   Compositor: {:?}", compositor_type);

        // Validate parameters
        if width <= 0 || height <= 0 || fps <= 0 {
            return Err("Invalid parameters: width, height, and fps must be > 0".to_string());
        }

        // Validate that at least one source is specified
        let has_displays = display_ids.as_ref().map_or(false, |ids| !ids.is_empty());
        let has_windows = window_ids.as_ref().map_or(false, |ids| !ids.is_empty());
        let has_webcams = webcam_device_ids.as_ref().map_or(false, |ids| !ids.is_empty());

        if !has_displays && !has_windows && !has_webcams {
            return Err("At least one display, window, or webcam must be specified".to_string());
        }

        // Create recording session
        let mut session = SwiftRecordingSession::new(&output_path, width, height, fps)
            .map_err(|e| format!("Failed to create recording session: {:?}", e))?;

        // Add display sources
        if let Some(displays) = display_ids {
            for display_id in displays {
                session.add_display(display_id)
                    .map_err(|e| format!("Failed to add display {}: {:?}", display_id, e))?;
            }
        }

        // Add window sources
        if let Some(windows) = window_ids {
            for window_id in windows {
                session.add_window(window_id)
                    .map_err(|e| format!("Failed to add window {}: {:?}", window_id, e))?;
            }
        }

        // Add webcam sources
        if let Some(webcam_devices) = webcam_device_ids {
            for device_id in webcam_devices {
                session.add_webcam(&device_id)
                    .map_err(|e| format!("Failed to add webcam {}: {:?}", device_id, e))?;
            }
        }

        // Set compositor type
        let compositor = match compositor_type.as_deref() {
            Some("grid") => CompositorType::Grid,
            Some("sidebyside") => CompositorType::SideBySide,
            Some("passthrough") | None => CompositorType::Passthrough,
            Some(other) => return Err(format!("Invalid compositor type: {}", other)),
        };

        session.set_compositor(compositor)
            .map_err(|e| format!("Failed to set compositor: {:?}", e))?;

        // Start recording
        session.start().await
            .map_err(|e| format!("Failed to start recording: {:?}", e))?;

        // Store session in global manager (Wave 1.2 - Phase 2)
        let manager = app_handle.state::<crate::SessionManager>();
        manager.insert(session_id.clone(), session);
        println!("✅ [Multi-Source] Recording started successfully - session stored in manager: {}", session_id);
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Multi-source recording only supported on macOS".to_string())
    }
}

/// Tauri command to add a source to an active recording
///
/// Note: Currently not supported - sources must be added before calling start()
#[tauri::command]
pub async fn add_recording_source(
    _session_id: String,
    _source_type: String,
    _source_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // This would require:
        // 1. A global session manager to track active sessions
        // 2. Support in Swift for hot-adding sources (currently not implemented)
        Err("Adding sources to active recording not yet implemented. Please specify all sources when calling start_multi_source_recording.".to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Multi-source recording only supported on macOS".to_string())
    }
}

/// Tauri command to remove a source from an active recording
///
/// Note: Currently not supported - sources cannot be removed after start()
#[tauri::command]
pub async fn remove_recording_source(
    _session_id: String,
    _source_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // This would require:
        // 1. A global session manager to track active sessions
        // 2. Support in Swift for hot-removing sources (currently not implemented)
        Err("Removing sources from active recording not yet implemented.".to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Multi-source recording only supported on macOS".to_string())
    }
}

/// Tauri command to get recording statistics
#[tauri::command]
pub async fn get_recording_stats(
    app_handle: tauri::AppHandle,
    session_id: String,
) -> Result<RecordingStats, String> {
    #[cfg(target_os = "macos")]
    {
        println!("📊 [RUST] Getting stats for session: {}", session_id);

        let manager = app_handle.state::<crate::SessionManager>();

        match manager.get_stats(&session_id) {
            Some(stats) => {
                println!("✅ [RUST] Stats found: processed={}, dropped={}, recording={}",
                    stats.frames_processed, stats.frames_dropped, stats.is_recording);
                Ok(stats)
            }
            None => {
                println!("❌ [RUST] Session not found: {}", session_id);
                Err(format!("Session not found: {}", session_id))
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Recording stats only available on macOS".to_string())
    }
}

/// Tauri command to stop multi-source recording
///
/// Stops recording and removes the session from the global manager
#[tauri::command]
pub async fn stop_multi_source_recording(
    app_handle: tauri::AppHandle,
    session_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        println!("🛑 [Multi-Source] Stopping recording for session: {}", session_id);

        let manager = app_handle.state::<crate::SessionManager>();

        // Remove session from manager
        match manager.remove(&session_id) {
            Some(session_arc) => {
                // Try to get exclusive ownership to call stop()
                match Arc::try_unwrap(session_arc) {
                    Ok(mut session) => {
                        // We have exclusive ownership - explicitly stop
                        session.stop().await
                            .map_err(|e| format!("Failed to stop recording: {:?}", e))?;
                        drop(session);  // Ensure cleanup
                    }
                    Err(_arc) => {
                        // Still have other references - Drop will handle cleanup
                        println!("⚠️ [Multi-Source] Session has multiple references, Drop will clean up");
                    }
                }
                println!("✅ [Multi-Source] Recording stopped and session removed from manager: {}", session_id);
                Ok(())
            }
            None => {
                println!("❌ [Multi-Source] Session not found: {}", session_id);
                Err(format!("Session not found: {}", session_id))
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Multi-source recording only supported on macOS".to_string())
    }
}

// ============================================================================
// Video/Audio Merging API (Background Enrichment Plan - Task 7)
// ============================================================================

use crate::recording::{VideoAudioMerger, ExportQuality, MergeResult};

/// Tauri command to merge video and audio files into single optimized MP4
///
/// This is the primary entry point for the background enrichment system to
/// merge video and audio files after a session ends.
///
/// # Arguments
/// * `video_path` - Path to video file (MP4, MOV)
/// * `audio_path` - Path to audio file (MP3, WAV, M4A, AAC)
/// * `output_path` - Path for output MP4 file
/// * `quality` - Export quality: "low" | "medium" | "high"
///
/// # Returns
/// `MergeResult` containing output path, duration, file size, and compression ratio
///
/// # Example
/// ```typescript
/// const result = await invoke('merge_video_and_audio', {
///   videoPath: '/path/to/video.mp4',
///   audioPath: '/path/to/audio.mp3',
///   outputPath: '/path/to/output.mp4',
///   quality: 'medium'
/// });
/// ```
#[tauri::command]
pub async fn merge_video_and_audio(
    video_path: String,
    audio_path: String,
    output_path: String,
    quality: String, // "low" | "medium" | "high"
) -> Result<MergeResult, String> {
    println!("🎬 [MERGE COMMAND] Starting merge");
    println!("  Video: {}", video_path);
    println!("  Audio: {}", audio_path);
    println!("  Output: {}", output_path);
    println!("  Quality: {}", quality);

    // Parse quality string to enum
    let quality_enum = match quality.to_lowercase().as_str() {
        "low" => ExportQuality::Low,
        "medium" => ExportQuality::Medium,
        "high" => ExportQuality::High,
        _ => {
            println!("⚠️  [MERGE COMMAND] Invalid quality '{}', defaulting to Medium", quality);
            ExportQuality::Medium
        }
    };

    println!("  Parsed quality: {} ({})", quality_enum.display_name(), quality_enum as i32);

    // Execute merge (async)
    let result = VideoAudioMerger::merge(
        &video_path,
        &audio_path,
        &output_path,
        quality_enum,
        None, // No progress callback for now (Task 6 will add this)
    )
    .await
    .map_err(|e| {
        println!("❌ [MERGE COMMAND] Failed: {}", e);
        format!("Merge failed: {}", e)
    })?;

    println!("✅ [MERGE COMMAND] Success!");
    println!("  Output: {}", result.output_path);
    println!("  Size: {} bytes ({:.1} MB)", result.file_size, result.file_size as f64 / 1_048_576.0);
    println!("  Duration: {:.1}s", result.duration);
    println!("  Compression: {:.1}% of input", result.compression_ratio * 100.0);

    Ok(result)
}

/// Tauri command to query merge progress
///
/// Returns the current progress of an ongoing merge operation as a percentage (0.0-1.0).
///
/// # Implementation Notes
/// This is currently a stub that returns 0.0. The Swift VideoAudioMerger does support
/// progress reporting via callbacks, but we need to:
/// 1. Store active merge operations in a global map (similar to SessionManager)
/// 2. Update progress via the callback provided to VideoAudioMerger::merge()
/// 3. Query that map from this command
///
/// For now, this returns 0.0 to satisfy the API contract. Task 6 will implement
/// full progress tracking.
///
/// # Returns
/// Progress as a float from 0.0 (starting) to 1.0 (complete)
///
/// # Example
/// ```typescript
/// const progress = await invoke('get_merge_progress');
/// console.log(`Merge is ${progress * 100}% complete`);
/// ```
#[tauri::command]
pub async fn get_merge_progress() -> Result<f64, String> {
    // TODO: Query Swift merger progress
    // For now: return 0.0 (not implemented)
    // This will be implemented in Task 6 when we add BackgroundMediaProcessor
    Ok(0.0)
}
