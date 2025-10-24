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
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;

// FFI declarations for Swift functions
#[cfg(target_os = "macos")]
extern "C" {
    fn screen_recorder_create() -> *mut std::ffi::c_void;
    fn screen_recorder_start(
        recorder: *mut std::ffi::c_void,
        path: *const c_char,
        width: i32,
        height: i32,
        fps: i32,
    ) -> bool;
    fn screen_recorder_stop(recorder: *mut std::ffi::c_void) -> bool;
    fn screen_recorder_is_recording(recorder: *mut std::ffi::c_void) -> bool;
    fn screen_recorder_destroy(recorder: *mut std::ffi::c_void);
    fn screen_recorder_check_permission() -> bool;
    fn screen_recorder_request_permission();
    fn screen_recorder_get_duration(path: *const c_char) -> f64;
    fn screen_recorder_generate_thumbnail(path: *const c_char, time: f64) -> *const c_char;
    fn screen_recorder_enumerate_displays() -> *const c_char;
    fn screen_recorder_enumerate_windows() -> *const c_char;
    fn screen_recorder_enumerate_webcams() -> *const c_char;
    fn screen_recorder_capture_display_thumbnail(displayId: *const c_char) -> *const c_char;
    fn screen_recorder_capture_window_thumbnail(windowId: *const c_char) -> *const c_char;

    // Advanced recording mode FFI
    fn screen_recorder_start_display_recording(
        display_ids_json: *const c_char,
        output_path: *const c_char,
        fps: i32,
        width: i32,
        height: i32,
    ) -> i32;

    fn screen_recorder_start_window_recording(
        window_id: *const c_char,
        output_path: *const c_char,
        fps: i32,
        width: i32,
        height: i32,
    ) -> i32;

    fn screen_recorder_start_webcam_recording(
        webcam_id: *const c_char,
        output_path: *const c_char,
        fps: i32,
        width: i32,
        height: i32,
    ) -> i32;

    fn screen_recorder_start_pip_recording(
        config_json: *const c_char,
        output_path: *const c_char,
    ) -> i32;

    fn screen_recorder_update_pip_config(
        config_json: *const c_char,
    ) -> i32;

    // PiP Compositor FFI
    fn pip_compositor_create() -> *mut std::ffi::c_void;
    fn pip_compositor_configure(
        compositor: *mut std::ffi::c_void,
        position: i32,
        size: i32,
        border_radius: f32,
    ) -> bool;
    fn pip_compositor_destroy(compositor: *mut std::ffi::c_void);
}

/// Video quality settings
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoQuality {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

impl Default for VideoQuality {
    fn default() -> Self {
        VideoQuality {
            width: 1280,  // 720p
            height: 720,
            fps: 15,      // Good balance for filesize/quality
        }
    }
}

/// Video recorder manages screen capture via Swift ScreenCaptureKit
pub struct VideoRecorder {
    #[cfg(target_os = "macos")]
    swift_recorder: Option<*mut std::ffi::c_void>,
    #[cfg(target_os = "macos")]
    pip_compositor: Option<*mut std::ffi::c_void>,
    current_session_id: Arc<Mutex<Option<String>>>,
    output_path: Arc<Mutex<Option<PathBuf>>>,
    recording_config: Arc<Mutex<Option<crate::types::VideoRecordingConfig>>>,
}

// Manual implementation of Send for VideoRecorder
// SAFETY: swift_recorder pointer is only accessed from a single thread
// and protected by the Arc<Mutex<VideoRecorder>> wrapper
unsafe impl Send for VideoRecorder {}
unsafe impl Sync for VideoRecorder {}

impl VideoRecorder {
    pub fn new() -> Self {
        VideoRecorder {
            #[cfg(target_os = "macos")]
            swift_recorder: None,
            #[cfg(target_os = "macos")]
            pip_compositor: None,
            current_session_id: Arc::new(Mutex::new(None)),
            output_path: Arc::new(Mutex::new(None)),
            recording_config: Arc::new(Mutex::new(None)),
        }
    }

    /// Start recording screen for a session
    pub fn start_recording(
        &mut self,
        session_id: String,
        output_path: PathBuf,
        quality: VideoQuality,
    ) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            // Check if already recording
            if self.swift_recorder.is_some() {
                return Err("Already recording".to_string());
            }

            // Check permission
            if !Self::check_permission()? {
                return Err("Screen recording permission not granted. Please enable in System Settings > Privacy & Security > Screen Recording".to_string());
            }

            // Create Swift recorder instance
            let recorder = unsafe { screen_recorder_create() };
            if recorder.is_null() {
                return Err("Failed to create screen recorder".to_string());
            }

            // Convert path to C string
            let path_str = output_path
                .to_str()
                .ok_or("Invalid output path")?;
            let c_path = CString::new(path_str)
                .map_err(|_| "Failed to convert path to C string")?;

            println!("🎬 Starting screen recording for session: {}", session_id);
            println!("   Output: {:?}", output_path);
            println!("   Quality: {}x{} @ {}fps", quality.width, quality.height, quality.fps);

            // Start recording
            let success = unsafe {
                screen_recorder_start(
                    recorder,
                    c_path.as_ptr(),
                    quality.width as i32,
                    quality.height as i32,
                    quality.fps as i32,
                )
            };

            if !success {
                unsafe { screen_recorder_destroy(recorder) };
                return Err("Failed to start screen recording. Check console for details.".to_string());
            }

            self.swift_recorder = Some(recorder);
            *self.current_session_id.lock()
                .map_err(|e| format!("Failed to lock session_id: {}", e))? = Some(session_id.clone());
            *self.output_path.lock()
                .map_err(|e| format!("Failed to lock output_path: {}", e))? = Some(output_path.clone());

            println!("✅ Screen recording started successfully");
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            Err("Screen recording only supported on macOS 12.3+".to_string())
        }
    }

    /// Stop recording and save video
    pub fn stop_recording(&mut self) -> Result<PathBuf, String> {
        #[cfg(target_os = "macos")]
        {
            let recorder = self.swift_recorder
                .take()
                .ok_or("No active recording")?;

            println!("⏹️  Stopping screen recording...");

            let success = unsafe { screen_recorder_stop(recorder) };

            if !success {
                println!("⚠️  Failed to stop recording gracefully, but continuing cleanup");
            }

            let path = self.output_path.lock()
                .map_err(|e| format!("Failed to lock output_path: {}", e))?
                .take()
                .ok_or("No output path set")?;

            // Clean up Swift recorder
            unsafe { screen_recorder_destroy(recorder) };
            *self.current_session_id.lock()
                .map_err(|e| format!("Failed to lock session_id: {}", e))? = None;

            println!("✅ Screen recording stopped, video saved to: {:?}", path);
            Ok(path)
        }

        #[cfg(not(target_os = "macos"))]
        {
            Err("Screen recording only supported on macOS 12.3+".to_string())
        }
    }

    /// Check if currently recording
    pub fn is_recording(&self) -> bool {
        #[cfg(target_os = "macos")]
        {
            if let Some(recorder) = self.swift_recorder {
                return unsafe { screen_recorder_is_recording(recorder) };
            }
        }
        false
    }

    /// Check if screen recording permission is granted
    pub fn check_permission() -> Result<bool, String> {
        #[cfg(target_os = "macos")]
        {
            Ok(unsafe { screen_recorder_check_permission() })
        }

        #[cfg(not(target_os = "macos"))]
        {
            Ok(false)
        }
    }

    /// Request screen recording permission
    pub fn request_permission() -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            unsafe { screen_recorder_request_permission() };
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            Err("Screen recording only supported on macOS 12.3+".to_string())
        }
    }

    /// Get current session ID if recording
    pub fn current_session_id(&self) -> Option<String> {
        self.current_session_id.lock()
            .ok()
            .and_then(|s| s.clone())
    }

    /// Start recording with advanced configuration
    pub fn start_recording_with_config(
        &mut self,
        session_id: String,
        output_path: PathBuf,
        config: crate::types::VideoRecordingConfig,
    ) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            // Check if already recording
            if self.swift_recorder.is_some() {
                return Err("Already recording".to_string());
            }

            // Check permission
            if !Self::check_permission()? {
                return Err("Screen recording permission not granted".to_string());
            }

            println!("[VIDEO] Starting advanced recording - mode: {:?}", config.source_type);

            // Convert quality preset to dimensions
            let quality = match config.quality {
                crate::types::VideoQuality::Low => VideoQuality {
                    width: 854,
                    height: 480,
                    fps: 15,
                },
                crate::types::VideoQuality::Medium => VideoQuality {
                    width: 1280,
                    height: 720,
                    fps: 15,
                },
                crate::types::VideoQuality::High => VideoQuality {
                    width: 1920,
                    height: 1080,
                    fps: 30,
                },
                crate::types::VideoQuality::Ultra => VideoQuality {
                    width: 2560,
                    height: 1440,
                    fps: 30,
                },
            };

            // Override with custom resolution if provided
            let final_quality = if let Some(res) = &config.resolution {
                VideoQuality {
                    width: res.width,
                    height: res.height,
                    fps: config.fps,
                }
            } else {
                VideoQuality {
                    width: quality.width,
                    height: quality.height,
                    fps: config.fps,
                }
            };

            let path_str = output_path.to_str().ok_or("Invalid output path")?;
            let c_output_path = CString::new(path_str)
                .map_err(|e| format!("Invalid output path string: {}", e))?;

            // Store configuration before starting
            *self.recording_config.lock()
                .map_err(|e| format!("Failed to lock config: {}", e))? = Some(config.clone());

            // Route to appropriate recording mode via FFI
            let result = unsafe {
                match config.source_type {
                    crate::types::VideoSourceType::Display => {
                        println!("[VIDEO] Starting display-only recording");

                        let display_ids_json = serde_json::to_string(
                            &config.display_ids.unwrap_or_else(|| vec![])
                        ).map_err(|e| format!("Failed to serialize display IDs: {}", e))?;

                        let c_display_ids = CString::new(display_ids_json)
                            .map_err(|e| format!("Invalid display IDs string: {}", e))?;

                        screen_recorder_start_display_recording(
                            c_display_ids.as_ptr(),
                            c_output_path.as_ptr(),
                            final_quality.fps as i32,
                            final_quality.width as i32,
                            final_quality.height as i32,
                        )
                    },

                    crate::types::VideoSourceType::Window => {
                        println!("[VIDEO] Starting window-only recording");

                        // Get first window ID from array (Swift layer currently supports single window)
                        let window_id = config.window_ids
                            .as_ref()
                            .and_then(|ids| ids.first())
                            .ok_or("At least one window ID required for window recording")?;

                        let c_window_id = CString::new(window_id.clone())
                            .map_err(|e| format!("Invalid window ID: {}", e))?;

                        screen_recorder_start_window_recording(
                            c_window_id.as_ptr(),
                            c_output_path.as_ptr(),
                            final_quality.fps as i32,
                            final_quality.width as i32,
                            final_quality.height as i32,
                        )
                    },

                    crate::types::VideoSourceType::Webcam => {
                        println!("[VIDEO] Starting webcam-only recording");

                        let webcam_id = config.webcam_device_id
                            .ok_or("Webcam device ID required for webcam recording")?;

                        let c_webcam_id = CString::new(webcam_id)
                            .map_err(|e| format!("Invalid webcam ID: {}", e))?;

                        screen_recorder_start_webcam_recording(
                            c_webcam_id.as_ptr(),
                            c_output_path.as_ptr(),
                            final_quality.fps as i32,
                            final_quality.width as i32,
                            final_quality.height as i32,
                        )
                    },

                    crate::types::VideoSourceType::DisplayWithWebcam => {
                        println!("[VIDEO] Starting display + PiP recording");

                        // Serialize full config for PiP mode
                        let config_json = serde_json::to_string(&config)
                            .map_err(|e| format!("Failed to serialize config: {}", e))?;

                        let c_config = CString::new(config_json)
                            .map_err(|e| format!("Invalid config JSON: {}", e))?;

                        screen_recorder_start_pip_recording(
                            c_config.as_ptr(),
                            c_output_path.as_ptr(),
                        )
                    },
                }
            };

            if result != 0 {
                return Err(format!("Failed to start recording (error code: {})", result));
            }

            // NOTE: For advanced recording modes (display/window/webcam/PiP), the Swift
            // GlobalScreenRecorder singleton manages the recorder lifecycle internally.
            // We do NOT create a separate handle here to avoid double-creation bugs.
            // The swift_recorder field remains None for these modes.

            *self.current_session_id.lock()
                .map_err(|e| format!("Failed to lock session_id: {}", e))? = Some(session_id.clone());
            *self.output_path.lock()
                .map_err(|e| format!("Failed to lock output_path: {}", e))? = Some(output_path.clone());

            println!("✅ [VIDEO] Advanced recording started successfully");
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        {
            Err("Advanced recording only supported on macOS 12.3+".to_string())
        }
    }

    /// Update PiP configuration during recording
    pub fn update_pip_config(&mut self, pip_config: crate::types::PiPConfig) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            if !self.is_recording() {
                return Err("Not currently recording".to_string());
            }

            println!("[VIDEO] Updating PiP configuration: {:?}", pip_config);

            // Serialize config to JSON
            let config_json = serde_json::to_string(&pip_config)
                .map_err(|e| format!("Failed to serialize PiP config: {}", e))?;

            let c_config = CString::new(config_json)
                .map_err(|e| format!("Invalid config JSON: {}", e))?;

            // Call FFI to update
            let result = unsafe {
                screen_recorder_update_pip_config(c_config.as_ptr())
            };

            if result == 0 {
                println!("✅ [VIDEO] PiP configuration updated successfully");
                Ok(())
            } else {
                Err(format!("Failed to update PiP configuration (error code: {})", result))
            }
        }

        #[cfg(not(target_os = "macos"))]
        {
            Err("PiP only supported on macOS".to_string())
        }
    }
}

impl Drop for VideoRecorder {
    fn drop(&mut self) {
        #[cfg(target_os = "macos")]
        {
            if let Some(recorder) = self.swift_recorder.take() {
                println!("🗑️  Cleaning up video recorder");
                unsafe {
                    screen_recorder_stop(recorder);
                    screen_recorder_destroy(recorder);
                }
            }

            if let Some(compositor) = self.pip_compositor.take() {
                println!("🗑️  Cleaning up PiP compositor");
                unsafe {
                    pip_compositor_destroy(compositor);
                }
            }
        }
    }
}

// ============================================================================
// Enumeration Functions
// ============================================================================
// Note: These internal functions are currently not used as the Swift bridge
// implementation is pending. The Tauri commands below return empty lists
// as a temporary workaround.

// /// Enumerate all available displays (internal function)
// fn enumerate_displays_internal() -> Result<Vec<crate::types::DisplayInfo>, String> {
//     #[cfg(target_os = "macos")]
//     {
//         use std::ffi::CStr;
//
//         let json_ptr = unsafe { screen_recorder_enumerate_displays() };
//
//         if json_ptr.is_null() {
//             return Err("Failed to enumerate displays".to_string());
//         }
//
//         let json_str = unsafe {
//             CStr::from_ptr(json_ptr)
//                 .to_string_lossy()
//                 .into_owned()
//         };
//
//         unsafe { libc::free(json_ptr as *mut libc::c_void) };
//
//         serde_json::from_str(&json_str)
//             .map_err(|e| format!("Failed to parse display info: {}", e))
//     }
//
//     #[cfg(not(target_os = "macos"))]
//     {
//         Err("Display enumeration only supported on macOS".to_string())
//     }
// }
//
// /// Enumerate all capturable windows (internal function)
// fn enumerate_windows_internal() -> Result<Vec<crate::types::WindowInfo>, String> {
//     #[cfg(target_os = "macos")]
//     {
//         use std::ffi::CStr;
//
//         let json_ptr = unsafe { screen_recorder_enumerate_windows() };
//
//         if json_ptr.is_null() {
//             return Err("Failed to enumerate windows".to_string());
//         }
//
//         let json_str = unsafe {
//             CStr::from_ptr(json_ptr)
//                 .to_string_lossy()
//                 .into_owned()
//         };
//
//         unsafe { libc::free(json_ptr as *mut libc::c_void) };
//
//         serde_json::from_str(&json_str)
//             .map_err(|e| format!("Failed to parse window info: {}", e))
//     }
//
//     #[cfg(not(target_os = "macos"))]
//     {
//         Err("Window enumeration only supported on macOS".to_string())
//     }
// }
//
// /// Enumerate all available webcams (internal function)
// fn enumerate_webcams_internal() -> Result<Vec<crate::types::WebcamInfo>, String> {
//     #[cfg(target_os = "macos")]
//     {
//         use std::ffi::CStr;
//
//         let json_ptr = unsafe { screen_recorder_enumerate_webcams() };
//
//         if json_ptr.is_null() {
//             return Err("Failed to enumerate webcams".to_string());
//         }
//
//         let json_str = unsafe {
//             CStr::from_ptr(json_ptr)
//                 .to_string_lossy()
//                 .into_owned()
//         };
//
//         unsafe { libc::free(json_ptr as *mut libc::c_void) };
//
//         serde_json::from_str(&json_str)
//             .map_err(|e| format!("Failed to parse webcam info: {}", e))
//     }
//
//     #[cfg(not(target_os = "macos"))]
//     {
//         Err("Webcam enumeration only supported on macOS".to_string())
//     }
// }

// ============================================================================
// Tauri Commands
// ============================================================================

/// Tauri command to start video recording
#[tauri::command]
pub async fn start_video_recording(
    session_id: String,
    output_path: String,
    quality: Option<VideoQuality>,
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<(), String> {
    let mut recorder = recorder.lock()
        .map_err(|e| format!("Failed to lock video recorder: {}", e))?;
    let quality = quality.unwrap_or_default();
    let path = PathBuf::from(output_path);

    recorder.start_recording(session_id, path, quality)
}

/// Tauri command to stop video recording
#[tauri::command]
pub async fn stop_video_recording(
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<String, String> {
    let mut recorder = recorder.lock()
        .map_err(|e| format!("Failed to lock video recorder: {}", e))?;
    let path = recorder.stop_recording()?;
    Ok(path.to_string_lossy().to_string())
}

/// Tauri command to check if currently recording
#[tauri::command]
pub async fn is_recording(
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<bool, String> {
    let recorder = recorder.lock()
        .map_err(|e| format!("Failed to lock video recorder: {}", e))?;
    Ok(recorder.is_recording())
}

/// Tauri command to get current session ID if recording
#[tauri::command]
pub async fn get_current_recording_session(
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<Option<String>, String> {
    let recorder = recorder.lock()
        .map_err(|e| format!("Failed to lock video recorder: {}", e))?;
    Ok(recorder.current_session_id())
}

/// Tauri command to get video duration in seconds
#[tauri::command]
pub async fn get_video_duration(video_path: String) -> Result<f64, String> {
    #[cfg(target_os = "macos")]
    {
        let c_path = CString::new(video_path)
            .map_err(|_| "Invalid video path")?;

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
pub async fn generate_video_thumbnail(video_path: String, time: Option<f64>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CStr;

        let c_path = CString::new(video_path)
            .map_err(|_| "Invalid video path")?;

        let time = time.unwrap_or(1.0); // Default to 1 second into video

        let thumbnail_ptr = unsafe { screen_recorder_generate_thumbnail(c_path.as_ptr(), time) };

        if thumbnail_ptr.is_null() {
            return Err("Failed to generate thumbnail".to_string());
        }

        // Convert C string to Rust String
        let thumbnail = unsafe {
            CStr::from_ptr(thumbnail_ptr)
                .to_string_lossy()
                .into_owned()
        };

        // Free the C string (allocated by Swift's strdup)
        unsafe {
            libc::free(thumbnail_ptr as *mut libc::c_void);
        }

        Ok(thumbnail)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Thumbnail generation only supported on macOS".to_string())
    }
}

/// Tauri command to start video recording with advanced configuration
#[tauri::command]
pub async fn start_video_recording_advanced(
    session_id: String,
    output_path: String,
    config: crate::types::VideoRecordingConfig,
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<(), String> {
    let mut recorder = recorder.lock()
        .map_err(|e| format!("Failed to lock video recorder: {}", e))?;
    let path = PathBuf::from(output_path);

    recorder.start_recording_with_config(session_id, path, config)
}

/// Tauri command to enumerate all displays
#[tauri::command]
pub async fn enumerate_displays() -> Result<Vec<crate::types::DisplayInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        println!("[VIDEO] enumerate_displays called");
        unsafe {
            let json_ptr = screen_recorder_enumerate_displays();
            if json_ptr.is_null() {
                return Err("Failed to enumerate displays".to_string());
            }

            let json_str = std::ffi::CStr::from_ptr(json_ptr)
                .to_str()
                .map_err(|e| format!("Invalid UTF-8: {}", e))?;

            let mut displays: Vec<crate::types::DisplayInfo> = serde_json::from_str(json_str)
                .map_err(|e| format!("Failed to parse display info: {}", e))?;

            // Free the C string
            libc::free(json_ptr as *mut libc::c_void);

            // Capture thumbnail for each display
            for display in &mut displays {
                let display_id_cstr = std::ffi::CString::new(display.display_id.clone())
                    .map_err(|e| format!("Invalid display ID: {}", e))?;

                let thumbnail_ptr = screen_recorder_capture_display_thumbnail(display_id_cstr.as_ptr());
                if !thumbnail_ptr.is_null() {
                    if let Ok(thumbnail_str) = std::ffi::CStr::from_ptr(thumbnail_ptr).to_str() {
                        display.thumbnail_data_uri = Some(thumbnail_str.to_string());
                    }
                    libc::free(thumbnail_ptr as *mut libc::c_void);
                }
            }

            Ok(displays)
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Display enumeration only supported on macOS".to_string())
    }
}

/// Tauri command to enumerate all windows
#[tauri::command]
pub async fn enumerate_windows() -> Result<Vec<crate::types::WindowInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        println!("[VIDEO] enumerate_windows called");
        unsafe {
            let json_ptr = screen_recorder_enumerate_windows();
            if json_ptr.is_null() {
                return Err("Failed to enumerate windows".to_string());
            }

            let json_str = std::ffi::CStr::from_ptr(json_ptr)
                .to_str()
                .map_err(|e| format!("Invalid UTF-8: {}", e))?;

            let mut windows: Vec<crate::types::WindowInfo> = serde_json::from_str(json_str)
                .map_err(|e| format!("Failed to parse window info: {}", e))?;

            // Free the C string
            libc::free(json_ptr as *mut libc::c_void);

            // Capture thumbnail for each window
            for window in &mut windows {
                let window_id_cstr = std::ffi::CString::new(window.window_id.clone())
                    .map_err(|e| format!("Invalid window ID: {}", e))?;

                let thumbnail_ptr = screen_recorder_capture_window_thumbnail(window_id_cstr.as_ptr());
                if !thumbnail_ptr.is_null() {
                    if let Ok(thumbnail_str) = std::ffi::CStr::from_ptr(thumbnail_ptr).to_str() {
                        window.thumbnail_data_uri = Some(thumbnail_str.to_string());
                    }
                    libc::free(thumbnail_ptr as *mut libc::c_void);
                }
            }

            Ok(windows)
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Window enumeration only supported on macOS".to_string())
    }
}

/// Tauri command to enumerate all webcams
#[tauri::command]
pub async fn enumerate_webcams() -> Result<Vec<crate::types::WebcamInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CStr;

        println!("[VIDEO] Enumerating webcams via Swift FFI...");

        // Call Swift FFI function
        let json_ptr = unsafe { screen_recorder_enumerate_webcams() };

        if json_ptr.is_null() {
            return Err("Failed to enumerate webcams".to_string());
        }

        // Convert C string to Rust String
        let json_string = unsafe {
            CStr::from_ptr(json_ptr)
                .to_string_lossy()
                .into_owned()
        };

        // Free the C string allocated by Swift
        unsafe {
            libc::free(json_ptr as *mut libc::c_void);
        }

        // Parse JSON
        let webcams: Vec<crate::types::WebcamInfo> = serde_json::from_str(&json_string)
            .map_err(|e| format!("Failed to parse webcam JSON: {}", e))?;

        println!("[VIDEO] Found {} webcam(s)", webcams.len());
        Ok(webcams)
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Webcam enumeration only supported on macOS".to_string())
    }
}

/// Tauri command to switch display during recording
#[tauri::command]
pub async fn switch_display(
    display_id: String,
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let recorder = recorder.lock()
            .map_err(|e| format!("Failed to lock video recorder: {}", e))?;

        if !recorder.is_recording() {
            return Err("Not currently recording".to_string());
        }

        // Get current config to ensure we're in display mode
        let config = recorder.recording_config.lock()
            .map_err(|e| format!("Failed to lock config: {}", e))?;

        if let Some(cfg) = config.as_ref() {
            if cfg.source_type != crate::types::VideoSourceType::Display {
                return Err("Can only switch display when in display recording mode".to_string());
            }
        } else {
            return Err("No recording config found".to_string());
        }

        println!("[VIDEO] Switching to display: {}", display_id);

        // For now, return an error indicating this needs Swift implementation
        // The Swift side needs to implement hot-swapping of display capture
        Err("Display hot-swap not yet implemented in Swift bridge. Please stop and restart recording with new display.".to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Display switching only supported on macOS".to_string())
    }
}

/// Tauri command to update PiP configuration during recording
#[tauri::command]
pub async fn update_webcam_mode(
    pip_config: crate::types::PiPConfig,
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<(), String> {
    let mut recorder = recorder.lock()
        .map_err(|e| format!("Failed to lock video recorder: {}", e))?;

    recorder.update_pip_config(pip_config)
}
