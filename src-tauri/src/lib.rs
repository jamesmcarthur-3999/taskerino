mod activity_monitor;
mod ai_types;
mod api_keys;
mod audio_simple; // Simple audio recording implementation (replaces AudioGraph)
mod claude_api;
mod macos_audio;
mod macos_events;
mod openai_api;
pub mod permissions; // Permissions error handling and detection (Phase 1)
mod recording; // Safe FFI wrappers for video recording
mod shutdown; // Graceful shutdown handler (Fix #13)
mod storage_utils; // Disk space checking (Fix #4C)
mod types;
mod video_recording;
// Performance optimization modules (Task 3A)
mod attachment_loader;
mod session_models;
mod session_storage;
// Session Query API for external tools (Live Session Intelligence - Phase 1)
mod session_query_api;

use activity_monitor::{ActivityMetrics, ActivityMonitor};
use audio_simple::SimpleAudioRecorder;
use macos_events::MacOSEventMonitor;
use session_query_api::ActiveSessionState;
use screenshots::{
    image::{imageops, DynamicImage, ImageFormat, RgbaImage},
    Screen,
};
use std::io::Cursor;
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    Emitter, Manager,
};
// VideoRecorder removed - now using SessionManager with SwiftRecordingSession

// Multi-source recording session manager (Wave 1.2 - Phase 2)
use std::collections::HashMap;
use recording::{SwiftRecordingSession, RecordingStats};

/// Global session manager for multi-source recordings
///
/// Tracks active SwiftRecordingSession instances to prevent them from being dropped
/// immediately after creation. This allows stats polling and proper lifecycle management.
pub struct SessionManager {
    pub sessions: Mutex<HashMap<String, Arc<SwiftRecordingSession>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn insert(&self, id: String, session: SwiftRecordingSession) {
        println!("✅ [SESSION MANAGER] Storing session: {}", id);
        match self.sessions.lock() {
            Ok(mut guard) => {
                guard.insert(id, Arc::new(session));
            }
            Err(poisoned) => {
                eprintln!("⚠️ [SESSION MANAGER] Session storage lock poisoned, recovering...");
                poisoned.into_inner().insert(id, Arc::new(session));
            }
        }
    }

    fn remove(&self, id: &str) -> Option<Arc<SwiftRecordingSession>> {
        println!("🗑️ [SESSION MANAGER] Removing session: {}", id);
        match self.sessions.lock() {
            Ok(mut guard) => guard.remove(id),
            Err(poisoned) => {
                eprintln!("⚠️ [SESSION MANAGER] Session storage lock poisoned, recovering...");
                poisoned.into_inner().remove(id)
            }
        }
    }

    fn get_stats(&self, id: &str) -> Option<RecordingStats> {
        let sessions = match self.sessions.lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("⚠️ [SESSION MANAGER] Session storage lock poisoned, recovering...");
                poisoned.into_inner()
            }
        };
        sessions.get(id).map(|session| {
            let stats = session.get_stats();
            println!("📊 [SESSION MANAGER] Stats for {}: processed={}, dropped={}, recording={}",
                id, stats.frames_processed, stats.frames_dropped, stats.is_recording);
            stats
        })
    }

    /// Utility method for monitoring active session count
    #[allow(dead_code)]
    fn session_count(&self) -> usize {
        match self.sessions.lock() {
            Ok(guard) => guard.len(),
            Err(poisoned) => {
                eprintln!("⚠️ [SESSION MANAGER] Session storage lock poisoned, recovering...");
                poisoned.into_inner().len()
            }
        }
    }
}

/// Request screen recording permission on macOS
/// This will trigger the system permission dialog if not already granted
#[cfg(target_os = "macos")]
#[tauri::command]
fn request_screen_recording_permission() -> Result<bool, String> {
    // Use CGRequestScreenCaptureAccess() to request permission
    // This is a system function that shows the permission dialog
    extern "C" {
        fn CGRequestScreenCaptureAccess() -> u8;
        fn CGPreflightScreenCaptureAccess() -> u8;
    }

    unsafe {
        // Check if we already have permission
        let has_permission = CGPreflightScreenCaptureAccess() != 0;

        if !has_permission {
            // Request permission - this will show the system dialog
            let granted = CGRequestScreenCaptureAccess() != 0;
            Ok(granted)
        } else {
            Ok(true)
        }
    }
}

/// Check if screen recording permission is granted (macOS only)
#[cfg(target_os = "macos")]
#[tauri::command]
fn check_screen_recording_permission() -> Result<bool, String> {
    extern "C" {
        fn CGPreflightScreenCaptureAccess() -> u8;
    }

    unsafe { Ok(CGPreflightScreenCaptureAccess() != 0) }
}

/// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn request_screen_recording_permission() -> Result<bool, String> {
    Ok(true)
}

/// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn check_screen_recording_permission() -> Result<bool, String> {
    Ok(true)
}

/// Check if the app has the screen-recording entitlement (macOS only)
/// This is different from permission - entitlement must be compiled into the app
#[cfg(target_os = "macos")]
#[tauri::command]
fn check_screen_recording_entitlement() -> Result<bool, String> {
    use std::process::Command;

    // Get the path to the current executable
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?;

    // Use codesign to check for screen-recording entitlement
    let output = Command::new("codesign")
        .args(&["-d", "--entitlements", ":-", exe_path.to_str().unwrap()])
        .output()
        .map_err(|e| format!("Failed to run codesign: {}", e))?;

    let entitlements = String::from_utf8_lossy(&output.stdout);

    // Check if the screen-recording entitlement is present
    let has_entitlement = entitlements.contains("com.apple.security.device.screen-recording");

    if !has_entitlement {
        println!("⚠️ [ENTITLEMENT CHECK] Screen recording entitlement is MISSING");
        println!("   This app needs to be rebuilt with the proper entitlement.");
    } else {
        println!("✅ [ENTITLEMENT CHECK] Screen recording entitlement is present");
    }

    Ok(has_entitlement)
}

/// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn check_screen_recording_entitlement() -> Result<bool, String> {
    Ok(true)
}

/// Check if microphone permission is granted (macOS only)
#[cfg(target_os = "macos")]
#[tauri::command]
fn check_microphone_permission() -> Result<bool, String> {
    use permissions::{check_permission_cached, PermissionType};

    match check_permission_cached(PermissionType::Microphone) {
        Ok(granted) => Ok(granted),
        Err(e) => Err(e.to_string()),
    }
}

/// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn check_microphone_permission() -> Result<bool, String> {
    Ok(true) // Assume microphone is available on other platforms
}

/// Request microphone permission proactively by attempting device access (macOS only)
/// This triggers the macOS permission dialog if permission hasn't been determined
#[cfg(target_os = "macos")]
#[tauri::command]
fn request_microphone_permission() -> Result<bool, String> {
    // Attempt to access the default input device
    // This will automatically trigger the macOS permission prompt if needed
    use cpal::traits::{DeviceTrait, HostTrait};

    let host = cpal::default_host();

    // Try to get default input device - this triggers the permission prompt
    match host.default_input_device() {
        Some(device) => {
            // Successfully got device - permission is granted
            // Try to get the config to ensure we really have access
            match device.default_input_config() {
                Ok(_) => Ok(true),
                Err(e) => Err(format!("Microphone access denied: {}", e)),
            }
        }
        None => {
            // No device available - likely permission denied or no mic connected
            Err("No microphone device available. Please check System Settings > Privacy & Security > Microphone".to_string())
        }
    }
}

/// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn request_microphone_permission() -> Result<bool, String> {
    Ok(true)
}

/// Check if camera permission is granted (macOS only)
#[cfg(target_os = "macos")]
#[tauri::command]
fn check_camera_permission() -> Result<bool, String> {
    use permissions::{check_permission_cached, PermissionType};

    match check_permission_cached(PermissionType::Camera) {
        Ok(granted) => Ok(granted),
        Err(e) => Err(e.to_string()),
    }
}

/// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn check_camera_permission() -> Result<bool, String> {
    Ok(true) // Assume camera is available on other platforms
}

/// Request camera permission proactively (macOS only)
#[cfg(target_os = "macos")]
#[tauri::command]
fn request_camera_permission() -> Result<bool, String> {
    use permissions::request_camera_permission as req_camera;

    match req_camera() {
        Ok(granted) => Ok(granted),
        Err(e) => Err(e.to_string()),
    }
}

/// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn request_camera_permission() -> Result<bool, String> {
    Ok(true)
}

/// Invalidate the permission cache
///
/// Call this after the user has granted permissions in System Settings
/// to immediately refresh the permission status without waiting for the
/// 5-second TTL to expire.
#[tauri::command]
fn invalidate_permission_cache() -> Result<(), String> {
    use permissions::invalidate_cache;
    invalidate_cache();
    Ok(())
}

/// Open macOS System Settings to a specific preference pane
#[cfg(target_os = "macos")]
#[tauri::command]
fn open_system_preferences(pane: String) -> Result<(), String> {
    use std::process::Command;

    let url = match pane.as_str() {
        "screenRecording" => "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
        "microphone" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
        "systemAudio" => "x-apple.systempreferences:com.apple.preference.sound",
        "camera" => "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera",
        _ => return Err(format!("Unknown preference pane: {}", pane))
    };

    Command::new("open")
        .arg(url)
        .spawn()
        .map_err(|e| format!("Failed to open System Settings: {}", e))?;

    Ok(())
}

/// Stub for non-macOS platforms
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn open_system_preferences(_pane: String) -> Result<(), String> {
    Err("System settings only supported on macOS".to_string())
}

/// Helper function for retry with exponential backoff
/// Retries an operation up to max_retries times with exponential backoff
fn capture_with_retry<F, T>(operation: F, max_retries: u32) -> Result<T, String>
where
    F: Fn() -> Result<T, String>,
{
    let mut last_error = String::new();

    for attempt in 0..max_retries {
        match operation() {
            Ok(result) => return Ok(result),
            Err(e) => {
                last_error = e.clone();
                if attempt < max_retries - 1 {
                    let delay_ms = 100 * 2_u64.pow(attempt);
                    eprintln!(
                        "Screenshot capture failed (attempt {}), retrying in {}ms: {}",
                        attempt + 1,
                        delay_ms,
                        e
                    );
                    std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                }
            }
        }
    }

    Err(format!(
        "Screenshot capture failed after {} attempts: {}",
        max_retries, last_error
    ))
}

/// Captures the primary screen and returns base64-encoded PNG data
#[tauri::command]
fn capture_primary_screen() -> Result<String, String> {
    capture_with_retry(
        || {
            let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

            if screens.is_empty() {
                return Err("No screens found".to_string());
            }

            // Capture the primary screen (first screen)
            let screen = &screens[0];
            let image = screen
                .capture()
                .map_err(|e| format!("Failed to capture screen: {}", e))?;

            // Convert to PNG bytes
            let mut bytes: Vec<u8> = Vec::new();
            let mut cursor = Cursor::new(&mut bytes);
            image
                .write_to(&mut cursor, ImageFormat::Png)
                .map_err(|e| format!("Failed to encode PNG: {}", e))?;

            // Encode to base64
            let base64_data =
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
            Ok(format!("data:image/png;base64,{}", base64_data))
        },
        3,
    )
}

/// Captures all screens and returns an array of base64-encoded PNG data
#[tauri::command]
fn capture_all_screens() -> Result<Vec<String>, String> {
    capture_with_retry(
        || {
            let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

            if screens.is_empty() {
                return Err("No screens found".to_string());
            }

            let mut results = Vec::new();

            for screen in screens {
                let image = screen
                    .capture()
                    .map_err(|e| format!("Failed to capture screen: {}", e))?;

                // Convert to PNG bytes
                let mut bytes: Vec<u8> = Vec::new();
                let mut cursor = Cursor::new(&mut bytes);
                image
                    .write_to(&mut cursor, ImageFormat::Png)
                    .map_err(|e| format!("Failed to encode PNG: {}", e))?;

                // Encode to base64
                let base64_data =
                    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
                results.push(format!("data:image/png;base64,{}", base64_data));
            }

            Ok(results)
        },
        3,
    )
}

/// Get information about available screens
#[tauri::command]
fn get_screen_info() -> Result<Vec<serde_json::Value>, String> {
    let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

    let info: Vec<serde_json::Value> = screens
        .iter()
        .enumerate()
        .map(|(i, screen)| {
            let display_info = screen.display_info;
            serde_json::json!({
                "index": i,
                "id": display_info.id,
                "x": display_info.x,
                "y": display_info.y,
                "width": display_info.width,
                "height": display_info.height,
                "is_primary": display_info.is_primary,
            })
        })
        .collect();

    Ok(info)
}

// Global state for menu bar countdown
struct CountdownState {
    active: bool,
    interval_minutes: f64,
    last_screenshot_time: String,
    session_status: String, // "active", "paused", or "idle"
    session_id: String,
}

impl CountdownState {
    fn new() -> Self {
        Self {
            active: false,
            interval_minutes: 2.0,
            last_screenshot_time: String::new(),
            session_status: "idle".to_string(),
            session_id: String::new(),
        }
    }
}

type CountdownStateHandle = Arc<Mutex<CountdownState>>;
type TrayIconHandle = Arc<Mutex<Option<TrayIcon<tauri::Wry>>>>;

/// Start menu bar countdown
#[tauri::command]
fn start_menubar_countdown(
    state: tauri::State<CountdownStateHandle>,
    interval_minutes: f64,
    last_screenshot_time: String,
    session_id: String,
) -> Result<(), String> {
    println!(
        "🚀 start_menubar_countdown called: interval={}, time={}, session={}",
        interval_minutes, last_screenshot_time, session_id
    );

    let mut countdown = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    countdown.active = true;
    countdown.interval_minutes = interval_minutes;
    countdown.last_screenshot_time = last_screenshot_time.clone();
    countdown.session_status = "active".to_string();
    countdown.session_id = session_id;

    println!(
        "✅ Countdown state set: active={}, status={}",
        countdown.active, countdown.session_status
    );
    Ok(())
}

/// Update menu bar countdown (when interval changes or screenshot taken)
#[tauri::command]
fn update_menubar_countdown(
    state: tauri::State<CountdownStateHandle>,
    interval_minutes: f64,
    last_screenshot_time: String,
    session_status: String,
) -> Result<(), String> {
    let mut countdown = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    println!(
        "🔄 update_menubar_countdown called: active={}, interval={}, status={}, time={}",
        countdown.active, interval_minutes, session_status, last_screenshot_time
    );
    if countdown.active {
        countdown.interval_minutes = interval_minutes;
        countdown.last_screenshot_time = last_screenshot_time;
        countdown.session_status = session_status;
        println!("✅ Updated countdown state");
    } else {
        println!("⚠️  Skipped update - countdown not active");
    }
    Ok(())
}

/// Stop menu bar countdown
#[tauri::command]
fn stop_menubar_countdown(state: tauri::State<CountdownStateHandle>) -> Result<(), String> {
    println!("🛑 stop_menubar_countdown called - setting active=false");
    let mut countdown = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    countdown.active = false;
    countdown.session_status = "idle".to_string();
    countdown.session_id = String::new();
    Ok(())
}

/// Audio recording commands - Dual-source implementation

/// Get list of available audio devices (inputs and outputs)
#[tauri::command]
fn get_audio_devices() -> Result<Vec<audio_simple::AudioDeviceInfo>, String> {
    audio_simple::enumerate_audio_devices().map_err(|e| e.to_string())
}

#[tauri::command]
fn start_audio_recording(
    audio_recorder: tauri::State<SimpleAudioRecorder>,
    app_handle: tauri::AppHandle,
    session_id: String,
    _chunk_duration_secs: u64, // Ignored - simple implementation always uses 10s
) -> Result<(), permissions::RecordingError> {
    // Reject new operations during shutdown
    if shutdown::is_shutting_down() {
        return Err(permissions::RecordingError::Internal {
            message: "Application is shutting down - cannot start new recording".to_string(),
        });
    }

    let config = audio_simple::AudioDeviceConfig::default();
    audio_recorder.start_recording(session_id, config, app_handle)
}

#[tauri::command]
fn start_audio_recording_with_config(
    audio_recorder: tauri::State<SimpleAudioRecorder>,
    app_handle: tauri::AppHandle,
    session_id: String,
    _chunk_duration_secs: u64, // Ignored - simple implementation always uses 10s
    config: audio_simple::AudioDeviceConfig,
) -> Result<(), permissions::RecordingError> {
    // Reject new operations during shutdown
    if shutdown::is_shutting_down() {
        return Err(permissions::RecordingError::Internal {
            message: "Application is shutting down - cannot start new recording".to_string(),
        });
    }

    audio_recorder.start_recording(session_id, config, app_handle)
}

#[tauri::command]
fn stop_audio_recording(audio_recorder: tauri::State<SimpleAudioRecorder>) -> Result<(), permissions::RecordingError> {
    audio_recorder.stop_recording()
}

#[tauri::command]
fn pause_audio_recording(audio_recorder: tauri::State<SimpleAudioRecorder>) -> Result<(), permissions::RecordingError> {
    audio_recorder.pause_recording()
}

#[tauri::command]
fn update_audio_balance(
    audio_recorder: tauri::State<SimpleAudioRecorder>,
    balance: u8,
) -> Result<(), permissions::RecordingError> {
    audio_recorder.update_balance(balance)
}

/// Get current audio health status
#[tauri::command]
fn get_audio_health_status(
    audio_recorder: tauri::State<SimpleAudioRecorder>,
) -> Result<audio_simple::AudioHealthStatus, permissions::RecordingError> {
    audio_recorder.get_health_status()
}

#[tauri::command]
fn switch_audio_input_device(
    audio_recorder: tauri::State<SimpleAudioRecorder>,
    device_name: Option<String>,
) -> Result<(), permissions::RecordingError> {
    audio_recorder.switch_audio_input_device(device_name)
}

#[tauri::command]
fn switch_audio_output_device(
    audio_recorder: tauri::State<SimpleAudioRecorder>,
    device_name: Option<String>,
) -> Result<(), permissions::RecordingError> {
    audio_recorder.switch_audio_output_device(device_name)
}

/// Write binary data to file (absolute path)
///
/// Simple file write operation for absolute paths.
/// Used by BackgroundMediaProcessor for temp file creation.
#[tauri::command]
fn write_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, contents)
        .map_err(|e| format!("Failed to write file {}: {}", path, e))
}

/// Delete file at absolute path
///
/// Simple file deletion operation for absolute paths.
/// Used by BackgroundMediaProcessor for temp file cleanup.
#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file {}: {}", path, e))
}

/// Concatenate MP3 files using ffmpeg (stream copy, no re-encoding)
///
/// This command uses the system's ffmpeg to concatenate multiple MP3 files
/// without re-encoding (stream copy mode). This is FAST and memory-efficient.
///
/// # Parameters
/// - `input_paths`: Array of MP3 file paths to concatenate (in order)
/// - `output_path`: Output path for concatenated MP3 file
///
/// # Returns
/// - `Ok(output_path)` on success
/// - `Err(String)` if ffmpeg not found, files not found, or concatenation fails
///
/// # Requirements
/// - ffmpeg must be installed on the system (via Homebrew on macOS)
/// - All input files must exist and be valid MP3 files
///
/// # Example
/// ```typescript
/// await invoke('concatenate_mp3_files', {
///   inputPaths: ['/tmp/audio1.mp3', '/tmp/audio2.mp3'],
///   outputPath: '/tmp/output.mp3'
/// });
/// ```
#[tauri::command]
async fn concatenate_mp3_files(
    input_paths: Vec<String>,
    output_path: String,
) -> Result<String, String> {
    println!("🎵 [MP3 CONCAT] Concatenating {} files", input_paths.len());
    println!("🎵 [MP3 CONCAT]   Output: {}", output_path);

    // Validate inputs
    if input_paths.is_empty() {
        return Err("No input files provided".to_string());
    }

    // Check all input files exist
    for path in &input_paths {
        if !std::path::Path::new(path).exists() {
            return Err(format!("Input file not found: {}", path));
        }
    }

    // Create temp directory for concat list file
    let temp_dir = std::env::temp_dir();
    let list_file_path = temp_dir.join(format!("ffmpeg_concat_{}.txt", uuid::Uuid::new_v4()));

    // Create ffmpeg concat demuxer list file
    // Format: file '/path/to/file1.mp3'\nfile '/path/to/file2.mp3'
    let list_content = input_paths
        .iter()
        .map(|path| format!("file '{}'", path))
        .collect::<Vec<_>>()
        .join("\n");

    std::fs::write(&list_file_path, list_content)
        .map_err(|e| format!("Failed to create concat list file: {}", e))?;

    println!("📝 [MP3 CONCAT] Created concat list: {:?}", list_file_path);

    // Run ffmpeg command
    // -f concat: Use concat demuxer
    // -safe 0: Allow absolute paths
    // -i list.txt: Input list file
    // -c copy: Stream copy (no re-encoding)
    // -y: Overwrite output file if exists
    let output = Command::new("ffmpeg")
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(&list_file_path)
        .arg("-c")
        .arg("copy")
        .arg("-y")
        .arg(&output_path)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                format!("ffmpeg not found. Please install ffmpeg: brew install ffmpeg")
            } else {
                format!("Failed to run ffmpeg: {}", e)
            }
        })?;

    // Clean up temp list file
    let _ = std::fs::remove_file(&list_file_path);

    // Check ffmpeg exit status
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg failed: {}", stderr));
    }

    // Verify output file was created
    if !std::path::Path::new(&output_path).exists() {
        return Err("Output file was not created".to_string());
    }

    let file_size = std::fs::metadata(&output_path)
        .map(|m| m.len())
        .unwrap_or(0);

    println!("✅ [MP3 CONCAT] Concatenation complete");
    println!("✅ [MP3 CONCAT]   Size: {} MB", file_size / 1024 / 1024);

    Ok(output_path)
}

/// Activity monitoring commands
#[tauri::command]
fn start_activity_monitoring(
    monitor: tauri::State<Arc<ActivityMonitor>>,
    event_monitor: tauri::State<Arc<MacOSEventMonitor>>,
) -> Result<(), String> {
    // Reject new operations during shutdown
    if shutdown::is_shutting_down() {
        return Err("Application is shutting down - cannot start activity monitoring".to_string());
    }

    // Start the base monitor
    monitor.start_monitoring()?;

    // Start macOS event monitoring
    event_monitor.start()?;

    Ok(())
}

#[tauri::command]
fn stop_activity_monitoring(
    monitor: tauri::State<Arc<ActivityMonitor>>,
    event_monitor: tauri::State<Arc<MacOSEventMonitor>>,
) -> Result<(), String> {
    // Stop macOS event monitoring
    event_monitor.stop()?;

    // Stop the base monitor
    monitor.stop_monitoring()?;

    Ok(())
}

#[tauri::command]
fn get_activity_metrics(
    monitor: tauri::State<Arc<ActivityMonitor>>,
    window_seconds: u64,
) -> Result<ActivityMetrics, String> {
    Ok(monitor.get_metrics(window_seconds))
}

#[tauri::command]
fn record_app_switch(monitor: tauri::State<Arc<ActivityMonitor>>) {
    monitor.increment_app_switch()
}

#[tauri::command]
fn record_mouse_click(monitor: tauri::State<Arc<ActivityMonitor>>) {
    monitor.increment_mouse_click()
}

#[tauri::command]
fn record_keyboard_event(monitor: tauri::State<Arc<ActivityMonitor>>) {
    monitor.increment_keyboard_event()
}

#[tauri::command]
fn record_window_focus(monitor: tauri::State<Arc<ActivityMonitor>>) {
    monitor.increment_window_focus()
}

/// Captures all screens and composites them into a single compressed JPEG image
#[tauri::command]
fn capture_all_screens_composite() -> Result<String, String> {
    use image::codecs::jpeg::JpegEncoder;

    capture_with_retry(
        || {
            let screens = Screen::all().map_err(|e| format!("Failed to get screens: {}", e))?;

            if screens.is_empty() {
                return Err("No screens found".to_string());
            }

            // Capture composite (handles single or multiple screens)
            let composite = if screens.len() == 1 {
                // Single screen - just capture it
                screens[0]
                    .capture()
                    .map_err(|e| format!("Failed to capture screen: {}", e))?
            } else {
                // Multiple screens - find bounding box
                let mut min_x = i32::MAX;
                let mut min_y = i32::MAX;
                let mut max_x = i32::MIN;
                let mut max_y = i32::MIN;

                for screen in &screens {
                    let info = screen.display_info;
                    min_x = min_x.min(info.x);
                    min_y = min_y.min(info.y);
                    max_x = max_x.max(info.x + info.width as i32);
                    max_y = max_y.max(info.y + info.height as i32);
                }

                let composite_width = (max_x - min_x) as u32;
                let composite_height = (max_y - min_y) as u32;

                // Create composite image
                let mut composite = RgbaImage::new(composite_width, composite_height);

                // Capture and place each screen
                for screen in screens {
                    let image = screen
                        .capture()
                        .map_err(|e| format!("Failed to capture screen: {}", e))?;
                    let info = screen.display_info;

                    // Calculate position in composite
                    let x_offset = (info.x - min_x) as u32;
                    let y_offset = (info.y - min_y) as u32;

                    // Convert to RgbaImage and overlay
                    let rgba_image = DynamicImage::ImageRgba8(image).to_rgba8();
                    imageops::overlay(
                        &mut composite,
                        &rgba_image,
                        x_offset as i64,
                        y_offset as i64,
                    );
                }

                composite
            };

            // Resize if too large (max 1920x1080 to keep file size reasonable)
            let resized = if composite.width() > 1920 || composite.height() > 1080 {
                let scale = f32::min(
                    1920.0 / composite.width() as f32,
                    1080.0 / composite.height() as f32,
                );
                let new_width = (composite.width() as f32 * scale) as u32;
                let new_height = (composite.height() as f32 * scale) as u32;

                imageops::resize(
                    &composite,
                    new_width,
                    new_height,
                    imageops::FilterType::Lanczos3,
                )
            } else {
                composite
            };

            // Convert RGBA to RGB (JPEG doesn't support alpha channel)
            let rgb_image = DynamicImage::ImageRgba8(resized).to_rgb8();

            // Compress to JPEG with quality 70 (optimized for 17% file size reduction)
            let mut bytes: Vec<u8> = Vec::new();
            let mut encoder = JpegEncoder::new_with_quality(&mut bytes, 70);
            encoder
                .encode(
                    &rgb_image,
                    rgb_image.width(),
                    rgb_image.height(),
                    image::ColorType::Rgb8.into(),
                )
                .map_err(|e| format!("Failed to encode JPEG: {}", e))?;

            // Encode to base64
            let base64_data =
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &bytes);
            Ok(format!("data:image/jpeg;base64,{}", base64_data))
        },
        3,
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize countdown state and tray icon handle
    let countdown_state: CountdownStateHandle = Arc::new(Mutex::new(CountdownState::new()));
    let tray_icon_handle: TrayIconHandle = Arc::new(Mutex::new(None));

    // Initialize audio recorder (uses interior mutability, no Arc<Mutex<>> needed)
    let audio_recorder = SimpleAudioRecorder::new();

    // Initialize activity monitor
    let activity_monitor = Arc::new(ActivityMonitor::new());

    // Initialize macOS event monitor
    let macos_event_monitor = Arc::new(MacOSEventMonitor::new(activity_monitor.clone()));

    // VideoRecorder removed - using SessionManager for recording sessions

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(countdown_state.clone())
        .manage(tray_icon_handle.clone())
        .manage(audio_recorder)
        .manage(activity_monitor.clone())
        .manage(macos_event_monitor.clone())
        .manage(SessionManager::new())  // Recording session manager (Phase 2 complete)
        .manage(ActiveSessionState::new())  // Active session tracking for query API (Live Session Intelligence)
        .invoke_handler(tauri::generate_handler![
            capture_primary_screen,
            capture_all_screens,
            capture_all_screens_composite,
            get_screen_info,
            request_screen_recording_permission,
            check_screen_recording_permission,
            check_screen_recording_entitlement,
            check_microphone_permission,
            request_microphone_permission,
            check_camera_permission,
            request_camera_permission,
            invalidate_permission_cache,
            open_system_preferences,
            start_menubar_countdown,
            update_menubar_countdown,
            stop_menubar_countdown,
            get_audio_devices,
            start_audio_recording,
            start_audio_recording_with_config,
            stop_audio_recording,
            pause_audio_recording,
            update_audio_balance,
            get_audio_health_status,
            switch_audio_input_device,
            switch_audio_output_device,
            write_file,
            delete_file,
            concatenate_mp3_files,
            start_activity_monitoring,
            stop_activity_monitoring,
            get_activity_metrics,
            record_app_switch,
            record_mouse_click,
            record_keyboard_event,
            record_window_focus,
            video_recording::start_video_recording,
            video_recording::stop_video_recording,
            video_recording::is_recording,
            video_recording::get_current_recording_session,
            video_recording::get_video_duration,
            video_recording::is_video_ready,
            video_recording::generate_video_thumbnail,
            video_recording::enumerate_displays,
            video_recording::enumerate_windows,
            video_recording::enumerate_webcams,
            video_recording::switch_display,
            video_recording::update_webcam_mode,
            // Multi-source recording (Task 2.9 - Phase 2)
            video_recording::start_multi_source_recording,
            video_recording::stop_multi_source_recording,
            video_recording::add_recording_source,
            video_recording::remove_recording_source,
            video_recording::get_recording_stats,
            video_recording::pause_recording,
            video_recording::resume_recording,
            video_recording::is_recording_paused,
            video_recording::switch_recording_source,
            // Video/Audio Merging (Background Enrichment - Task 7)
            video_recording::merge_video_and_audio,
            video_recording::get_merge_progress,
            // API key management
            api_keys::set_openai_api_key,
            api_keys::get_openai_api_key,
            api_keys::set_claude_api_key,
            api_keys::get_claude_api_key,
            api_keys::has_openai_api_key,
            api_keys::has_claude_api_key,
            // OpenAI API
            openai_api::openai_transcribe_audio,
            openai_api::openai_transcribe_audio_with_timestamps,
            openai_api::openai_analyze_full_audio,
            // Claude API
            claude_api::claude_chat_completion,
            claude_api::claude_chat_completion_vision,
            claude_api::claude_chat_completion_stream,
            // Performance optimization - Session storage (Task 3A)
            session_storage::load_session_summaries,
            session_storage::load_session_detail,
            session_storage::search_sessions,
            session_storage::get_session_count,
            // Performance optimization - Attachment loader (Task 3A)
            attachment_loader::load_attachments_metadata_parallel,
            attachment_loader::check_attachments_exist,
            attachment_loader::get_attachments_total_size,
            attachment_loader::count_attachments_by_type,
            // Storage utilities - Disk space checking (Fix #4C)
            storage_utils::check_storage_space,
            storage_utils::get_storage_info,
            storage_utils::open_storage_location,
            // Session Query API for external tools (Live Session Intelligence - Phase 1)
            session_query_api::query_active_session,
            session_query_api::query_sessions,
            session_query_api::get_session_by_id,
            session_query_api::set_active_session_id
        ])
        .setup(move |app| {
            // Audio recorder initialized on first use (no separate init needed)

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create system tray menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit Taskerino", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide Window", true, None::<&str>)?;
            let capture_i = MenuItem::with_id(app, "capture", "Quick Capture (⌘⇧Space)", true, None::<&str>)?;
            let countdown_i = MenuItem::with_id(app, "countdown", "⏱️ Taskerino", false, None::<&str>)?;
            let pause_i = MenuItem::with_id(app, "pause", "⏸ Pause Session", true, None::<&str>)?;
            let resume_i = MenuItem::with_id(app, "resume", "▶️ Resume Session", true, None::<&str>)?;
            let stop_i = MenuItem::with_id(app, "stop", "⏹ Stop Session", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[&countdown_i, &pause_i, &resume_i, &stop_i, &show_i, &hide_i, &capture_i, &quit_i],
            )?;

            // Build system tray
            let tray_handle_clone = tray_icon_handle.clone();
            let icon = app.default_window_icon()
                .ok_or("No default window icon")?
                .clone();
            let tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .title("⚫ Taskerino")
                .tooltip("Taskerino")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "countdown" => {
                        // Non-clickable, just shows info
                    }
                    "pause" => {
                        // Tell frontend to pause session
                        let _ = app.emit("menubar-pause-session", ());
                    }
                    "resume" => {
                        // Tell frontend to resume session
                        let _ = app.emit("menubar-resume-session", ());
                    }
                    "stop" => {
                        // Tell frontend to stop session
                        let _ = app.emit("menubar-stop-session", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "capture" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            // Emit event to frontend to open capture zone
                            let _ = app.emit("navigate-to-capture", ());
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // Store tray icon for later updates
            *tray_handle_clone.lock()
                .map_err(|e| format!("Failed to lock tray handle: {}", e))? = Some(tray);

            // Register global shortcuts using the plugin
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

                // Register plugin
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, shortcut, event| {
                            if event.state() == ShortcutState::Pressed {
                                if let Some(window) = app.get_webview_window("main") {
                                    // Cmd+Shift+Space for quick capture screenshot
                                    if shortcut == &Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space) {
                                        // Generate unique temp filename
                                        let timestamp = std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .map(|d| d.as_secs())
                                            .unwrap_or(0);
                                        let temp_path = std::env::temp_dir()
                                            .join(format!("taskerino_quick_capture_{}.png", timestamp));

                                        // Use macOS screencapture with interactive selection
                                        let status = Command::new("screencapture")
                                            .arg("-i")  // Interactive selection
                                            .arg(&temp_path)
                                            .status();

                                        // If screenshot was taken, read and send base64 data to session
                                        if status.is_ok() && temp_path.exists() {
                                            match std::fs::read(&temp_path) {
                                                Ok(data) => {
                                                    // Convert to base64
                                                    let base64_data = base64::Engine::encode(
                                                        &base64::engine::general_purpose::STANDARD,
                                                        &data
                                                    );

                                                    // Clean up temp file
                                                    let _ = std::fs::remove_file(&temp_path);

                                                    // Emit event to add screenshot to active session
                                                    let _ = app.emit("quick-capture-screenshot", format!("data:image/png;base64,{}", base64_data));
                                                },
                                                Err(e) => {
                                                    eprintln!("Failed to read quick capture screenshot: {}", e);
                                                }
                                            }
                                        }
                                    }
                                    // Cmd+Shift+T to toggle window visibility
                                    else if shortcut == &Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT) {
                                        match window.is_visible() {
                                            Ok(true) => { let _ = window.hide(); },
                                            _ => {
                                                let _ = window.show();
                                                let _ = window.set_focus();
                                            }
                                        }
                                    }
                                    // Cmd+Shift+4 for screenshot capture
                                    else if shortcut == &Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Digit4) {
                                        // Generate unique temp filename
                                        let timestamp = std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .map(|d| d.as_secs())
                                            .unwrap_or(0);
                                        let temp_path = std::env::temp_dir()
                                            .join(format!("taskerino_screenshot_{}.png", timestamp));

                                        // Use macOS screencapture with interactive selection
                                        let status = Command::new("screencapture")
                                            .arg("-i")  // Interactive selection
                                            .arg(&temp_path)
                                            .status();

                                        // If screenshot was taken, read and send base64 data
                                        if status.is_ok() && temp_path.exists() {
                                            match std::fs::read(&temp_path) {
                                                Ok(data) => {
                                                    // Convert to base64
                                                    let base64_data = base64::Engine::encode(
                                                        &base64::engine::general_purpose::STANDARD,
                                                        &data
                                                    );

                                                    // Clean up temp file
                                                    let _ = std::fs::remove_file(&temp_path);

                                                    // Emit with base64 data instead of path
                                                    let _ = window.show();
                                                    let _ = window.set_focus();
                                                    let _ = app.emit("screenshot-captured", format!("data:image/png;base64,{}", base64_data));
                                                },
                                                Err(e) => {
                                                    eprintln!("Failed to read screenshot: {}", e);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        })
                        .build(),
                )?;

                // Register shortcuts
                app.global_shortcut().register(Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space))?;
                app.global_shortcut().register(Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT))?;
                app.global_shortcut().register(Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Digit4))?;
            }

            // Spawn background task to update countdown in menu bar
            let app_handle = app.handle().clone();
            let countdown_state_clone = countdown_state.clone();
            let tray_handle_for_thread = tray_icon_handle.clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_secs(1));

                    // Get countdown state
                    let state = match countdown_state_clone.lock() {
                        Ok(s) => s,
                        Err(_) => continue, // Skip if lock fails
                    };
                    let is_active = state.active;
                    let session_status = state.session_status.clone();
                    let last_time = state.last_screenshot_time.clone();

                    if !is_active || last_time.is_empty() {
                        println!("⚫ Idle state: active={}, last_time_empty={}", is_active, last_time.is_empty());
                        // Update tray icon title to show idle state
                        if let Ok(tray_guard) = tray_handle_for_thread.lock() {
                            if let Some(tray) = tray_guard.as_ref() {
                                let _ = tray.set_title(Some("⚫ Taskerino"));
                            }
                        }

                        // Update menu to show idle state
                        if let Some(menu) = app_handle.menu() {
                            if let Some(item) = menu.get("countdown") {
                                if let Some(menuitem) = item.as_menuitem() {
                                    let _ = menuitem.set_text("⚫ Taskerino");
                                }
                            }
                            // Disable all session controls when idle
                            if let Some(item) = menu.get("pause") {
                                if let Some(menuitem) = item.as_menuitem() {
                                    let _ = menuitem.set_enabled(false);
                                }
                            }
                            if let Some(item) = menu.get("resume") {
                                if let Some(menuitem) = item.as_menuitem() {
                                    let _ = menuitem.set_enabled(false);
                                }
                            }
                            if let Some(item) = menu.get("stop") {
                                if let Some(menuitem) = item.as_menuitem() {
                                    let _ = menuitem.set_enabled(false);
                                }
                            }
                        }
                        drop(state);
                        continue;
                    }

                    // Parse last screenshot time
                    let interval_ms = (state.interval_minutes * 60.0 * 1000.0) as i64;
                    let last_shot_time = state.last_screenshot_time.clone();
                    drop(state);

                    // Calculate countdown
                    let status_icon = match session_status.as_str() {
                        "active" => "🟢",
                        "paused" => "🟡",
                        _ => "⚫"
                    };

                    match chrono::DateTime::parse_from_rfc3339(&last_shot_time) {
                        Ok(last_shot) => {
                        println!("📅 Parsed time: {}, status: {}", last_shot_time, session_status);
                        let next_shot = last_shot.timestamp_millis() + interval_ms;
                        let now = chrono::Utc::now().timestamp_millis();
                        let remaining_ms = next_shot - now;

                        let countdown_text = if session_status == "paused" {
                            format!("{} Paused", status_icon)
                        } else if remaining_ms <= 0 {
                            format!("{} Soon...", status_icon)
                        } else {
                            let remaining_secs = (remaining_ms / 1000) as u32;
                            if remaining_secs >= 60 {
                                format!("{} Next: {}m {}s", status_icon, remaining_secs / 60, remaining_secs % 60)
                            } else {
                                format!("{} Next: {}s", status_icon, remaining_secs)
                            }
                        };

                        // Update tray icon title in menu bar
                        println!("🟢 Updating tray title: {}", countdown_text);
                        if let Ok(tray_guard) = tray_handle_for_thread.lock() {
                            if let Some(tray) = tray_guard.as_ref() {
                                match tray.set_title(Some(&countdown_text)) {
                                    Ok(_) => println!("✅ Tray title set successfully"),
                                    Err(e) => println!("❌ Failed to set tray title: {:?}", e),
                                }
                            } else {
                                println!("❌ Tray icon not found in handle");
                            }
                        } else {
                            println!("❌ Failed to lock tray handle");
                        }

                        // Update menu item text and controls
                        if let Some(menu) = app_handle.menu() {
                            if let Some(item) = menu.get("countdown") {
                                if let Some(menuitem) = item.as_menuitem() {
                                    let _ = menuitem.set_text(&countdown_text);
                                }
                            }

                            // Enable/disable controls based on status
                            match session_status.as_str() {
                                "active" => {
                                    if let Some(item) = menu.get("pause") {
                                        if let Some(menuitem) = item.as_menuitem() {
                                            let _ = menuitem.set_enabled(true);
                                        }
                                    }
                                    if let Some(item) = menu.get("resume") {
                                        if let Some(menuitem) = item.as_menuitem() {
                                            let _ = menuitem.set_enabled(false);
                                        }
                                    }
                                    if let Some(item) = menu.get("stop") {
                                        if let Some(menuitem) = item.as_menuitem() {
                                            let _ = menuitem.set_enabled(true);
                                        }
                                    }
                                }
                                "paused" => {
                                    if let Some(item) = menu.get("pause") {
                                        if let Some(menuitem) = item.as_menuitem() {
                                            let _ = menuitem.set_enabled(false);
                                        }
                                    }
                                    if let Some(item) = menu.get("resume") {
                                        if let Some(menuitem) = item.as_menuitem() {
                                            let _ = menuitem.set_enabled(true);
                                        }
                                    }
                                    if let Some(item) = menu.get("stop") {
                                        if let Some(menuitem) = item.as_menuitem() {
                                            let _ = menuitem.set_enabled(true);
                                        }
                                    }
                                }
                                _ => {
                                    if let Some(item) = menu.get("pause") {
                                        if let Some(menuitem) = item.as_menuitem() {
                                            let _ = menuitem.set_enabled(false);
                                        }
                                    }
                                    if let Some(item) = menu.get("resume") {
                                        if let Some(menuitem) = item.as_menuitem() {
                                            let _ = menuitem.set_enabled(false);
                                        }
                                    }
                                    if let Some(item) = menu.get("stop") {
                                        if let Some(menuitem) = item.as_menuitem() {
                                            let _ = menuitem.set_enabled(false);
                                        }
                                    }
                                }
                            }
                        }
                        }
                        Err(e) => {
                            println!("❌ Failed to parse timestamp '{}': {:?}", last_shot_time, e);
                        }
                    }
                }
            });

            // Handle window close requests - Graceful shutdown with Rust-side cleanup (Fix #13)
            // This prevents data loss by:
            // 1. Stopping all recording services (audio/video/activity monitoring)
            // 2. Coordinating with frontend to flush persistence queue (5s timeout)
            // 3. Cleaning up temporary files
            if let Some(window) = app.get_webview_window("main") {
                use tauri::Listener;
                let app_handle = window.app_handle().clone();

                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        println!("🛑 [TAURI] CloseRequested - starting graceful shutdown sequence");

                        // Prevent immediate close
                        api.prevent_close();

                        // Clone app_handle for thread
                        let app_handle_thread = app_handle.clone();

                        std::thread::spawn(move || {
                            // Step 1: Execute Rust-side shutdown (stop recordings, cleanup)
                            println!("[TAURI] Executing Rust-side shutdown...");
                            let shutdown_handler = shutdown::ShutdownHandler::new(app_handle_thread.clone());
                            let shutdown_result = tauri::async_runtime::block_on(async {
                                shutdown_handler.shutdown().await
                            });

                            match shutdown_result {
                                Ok(_) => println!("✅ [TAURI] Rust-side shutdown complete"),
                                Err(e) => println!("⚠️  [TAURI] Rust-side shutdown completed with errors: {}", e),
                            }

                            // Step 2: Tell frontend to flush data (existing flow)
                            println!("[TAURI] Emitting shutdown-requested event to frontend...");
                            if let Err(e) = app_handle_thread.emit("shutdown-requested", ()) {
                                eprintln!("❌ [TAURI] Failed to emit shutdown-requested: {}", e);
                                // Force close after 1 second if event fails
                                std::thread::sleep(Duration::from_secs(1));
                                app_handle_thread.exit(0);
                                return;
                            }

                            println!("✅ [TAURI] shutdown-requested emitted, waiting for frontend response...");

                            // Wait up to 5 seconds for frontend to complete flush
                            // Frontend will emit 'shutdown-complete' when done
                            let mut waited = 0;
                            let mut shutdown_complete = false;

                            // Listen for shutdown-complete event
                            let app_handle_listen = app_handle_thread.clone();
                            let (tx, rx) = std::sync::mpsc::channel();

                            let _listen_id = app_handle_listen.listen("shutdown-complete", move |_event| {
                                let _ = tx.send(());
                            });

                            // Wait with timeout
                            while waited < 5000 && !shutdown_complete {
                                if rx.recv_timeout(Duration::from_millis(100)).is_ok() {
                                    shutdown_complete = true;
                                    break;
                                }
                                waited += 100;
                            }

                            if shutdown_complete {
                                println!("✅ [TAURI] Frontend confirmed flush complete ({} ms)", waited);
                            } else {
                                println!("⚠️ [TAURI] Frontend flush timeout after {} ms - forcing close", waited);
                            }

                            println!("🏁 [TAURI] Graceful shutdown complete - exiting");
                            // Now actually close the app
                            app_handle_thread.exit(0);
                        });
                    }
                });
            }

            // Main window now shows immediately (no splash screen)
            // Main window visibility controlled by tauri.conf.json
            println!("✅ [TAURI] Main window ready");

            Ok(())
        })
        .run(tauri::generate_context!())
        .map_err(|e| eprintln!("Error running Tauri application: {}", e))
        .ok();
}
