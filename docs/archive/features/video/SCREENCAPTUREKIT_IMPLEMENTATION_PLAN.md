# ScreenCaptureKit Video Recording - Implementation Plan

## Overview
Implement video recording for Taskerino sessions using Apple's modern ScreenCaptureKit framework (macOS 12.3+).

**Architecture**: Swift → Rust FFI → Tauri Commands → TypeScript Services → React UI

---

## Phase 1: Swift Recording Layer (Day 1-2)

### 1.1 Create Swift Module
**File**: `src-tauri/ScreenRecorder/ScreenRecorder.swift`

```swift
import Foundation
import ScreenCaptureKit
import AVFoundation

@available(macOS 12.3, *)
public class ScreenRecorder: NSObject {
    private var stream: SCStream?
    private var output: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var isRecording = false
    private var outputURL: URL?

    // Public C-compatible functions for Rust FFI
    @_cdecl("screen_recorder_create")
    public static func create() -> UnsafeMutableRawPointer

    @_cdecl("screen_recorder_start")
    public static func start(recorder: UnsafeMutableRawPointer,
                            path: UnsafePointer<CChar>,
                            width: Int32,
                            height: Int32,
                            fps: Int32) -> Bool

    @_cdecl("screen_recorder_stop")
    public static func stop(recorder: UnsafeMutableRawPointer) -> Bool

    @_cdecl("screen_recorder_is_recording")
    public static func isRecording(recorder: UnsafeMutableRawPointer) -> Bool

    @_cdecl("screen_recorder_destroy")
    public static func destroy(recorder: UnsafeMutableRawPointer)

    @_cdecl("screen_recorder_check_permission")
    public static func checkPermission() -> Bool

    @_cdecl("screen_recorder_request_permission")
    public static func requestPermission()
}
```

**Implementation details**:
- Use `SCShareableContent.getCurrentProcessContent()` to get available screens
- Create `SCStreamConfiguration` with desired quality/FPS settings
- Use `SCContentFilter` to capture main display
- Set up `AVAssetWriter` to write H.264 video to file
- Implement `SCStreamOutput` delegate for frame callbacks
- Handle start/stop/pause/resume state machine
- Proper cleanup on errors

### 1.2 Create Swift Build Configuration
**File**: `src-tauri/build.rs` (modify existing)

```rust
fn main() {
    // Existing Tauri build...
    tauri_build::build();

    // Compile Swift module
    #[cfg(target_os = "macos")]
    compile_swift_module();
}

#[cfg(target_os = "macos")]
fn compile_swift_module() {
    use std::process::Command;

    println!("cargo:rerun-if-changed=ScreenRecorder/ScreenRecorder.swift");

    // Compile Swift to object file
    let output = Command::new("swiftc")
        .args(&[
            "-emit-library",
            "-emit-objc-header",
            "-emit-module",
            "-module-name", "ScreenRecorder",
            "-o", "target/libScreenRecorder.dylib",
            "ScreenRecorder/ScreenRecorder.swift",
            "-target", "arm64-apple-macosx12.3", // or x86_64 for Intel
            "-sdk", "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
        ])
        .output()
        .expect("Failed to compile Swift module");

    if !output.status.success() {
        panic!("Swift compilation failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    // Link against ScreenCaptureKit and AVFoundation
    println!("cargo:rustc-link-lib=framework=ScreenCaptureKit");
    println!("cargo:rustc-link-lib=framework=AVFoundation");
    println!("cargo:rustc-link-search=native=target");
    println!("cargo:rustc-link-lib=dylib=ScreenRecorder");
}
```

### 1.3 Add Swift Bridging Header
**File**: `src-tauri/ScreenRecorder/ScreenRecorder-Bridging-Header.h`

```c
#include <stdbool.h>
#include <stdint.h>

// Forward declarations for Rust
void* screen_recorder_create(void);
bool screen_recorder_start(void* recorder, const char* path, int32_t width, int32_t height, int32_t fps);
bool screen_recorder_stop(void* recorder);
bool screen_recorder_is_recording(void* recorder);
void screen_recorder_destroy(void* recorder);
bool screen_recorder_check_permission(void);
void screen_recorder_request_permission(void);
```

---

## Phase 2: Rust FFI Bridge (Day 2-3)

### 2.1 Replace video_recording.rs with ScreenCaptureKit Implementation
**File**: `src-tauri/src/video_recording.rs` (complete rewrite)

```rust
use std::ffi::{CStr, CString};
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
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VideoQuality {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

impl Default for VideoQuality {
    fn default() -> Self {
        VideoQuality {
            width: 1280,
            height: 720,
            fps: 15,
        }
    }
}

pub struct VideoRecorder {
    #[cfg(target_os = "macos")]
    swift_recorder: Option<*mut std::ffi::c_void>,
    current_session_id: Arc<Mutex<Option<String>>>,
    output_path: Arc<Mutex<Option<PathBuf>>>,
}

impl VideoRecorder {
    pub fn new() -> Self {
        VideoRecorder {
            #[cfg(target_os = "macos")]
            swift_recorder: None,
            current_session_id: Arc::new(Mutex::new(None)),
            output_path: Arc::new(Mutex::new(None)),
        }
    }

    pub fn start_recording(
        &mut self,
        session_id: String,
        output_path: PathBuf,
        quality: VideoQuality,
    ) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            if !Self::check_permission()? {
                return Err("Screen recording permission not granted".to_string());
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
                return Err("Failed to start screen recording".to_string());
            }

            self.swift_recorder = Some(recorder);
            *self.current_session_id.lock().unwrap() = Some(session_id.clone());
            *self.output_path.lock().unwrap() = Some(output_path.clone());

            println!("🎬 Started screen recording for session: {}", session_id);
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        Err("Screen recording only supported on macOS".to_string())
    }

    pub fn stop_recording(&mut self) -> Result<PathBuf, String> {
        #[cfg(target_os = "macos")]
        {
            let recorder = self.swift_recorder
                .take()
                .ok_or("No active recording")?;

            let success = unsafe { screen_recorder_stop(recorder) };

            if !success {
                return Err("Failed to stop recording".to_string());
            }

            let path = self.output_path.lock().unwrap()
                .take()
                .ok_or("No output path set")?;

            unsafe { screen_recorder_destroy(recorder) };
            *self.current_session_id.lock().unwrap() = None;

            println!("⏹️  Stopped screen recording");
            Ok(path)
        }

        #[cfg(not(target_os = "macos"))]
        Err("Screen recording only supported on macOS".to_string())
    }

    pub fn is_recording(&self) -> bool {
        #[cfg(target_os = "macos")]
        {
            if let Some(recorder) = self.swift_recorder {
                return unsafe { screen_recorder_is_recording(recorder) };
            }
        }
        false
    }

    pub fn check_permission() -> Result<bool, String> {
        #[cfg(target_os = "macos")]
        {
            Ok(unsafe { screen_recorder_check_permission() })
        }

        #[cfg(not(target_os = "macos"))]
        Ok(false)
    }

    pub fn request_permission() -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            unsafe { screen_recorder_request_permission() };
            Ok(())
        }

        #[cfg(not(target_os = "macos"))]
        Err("Screen recording only supported on macOS".to_string())
    }
}

impl Drop for VideoRecorder {
    fn drop(&mut self) {
        #[cfg(target_os = "macos")]
        {
            if let Some(recorder) = self.swift_recorder.take() {
                unsafe {
                    screen_recorder_stop(recorder);
                    screen_recorder_destroy(recorder);
                }
            }
        }
    }
}

// Tauri commands
#[tauri::command]
pub async fn start_video_recording(
    session_id: String,
    output_path: String,
    quality: Option<VideoQuality>,
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<(), String> {
    let mut recorder = recorder.lock().unwrap();
    let quality = quality.unwrap_or_default();
    let path = PathBuf::from(output_path);
    recorder.start_recording(session_id, path, quality)
}

#[tauri::command]
pub async fn stop_video_recording(
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<String, String> {
    let mut recorder = recorder.lock().unwrap();
    let path = recorder.stop_recording()?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn check_screen_recording_permission() -> Result<bool, String> {
    VideoRecorder::check_permission()
}

#[tauri::command]
pub async fn request_screen_recording_permission() -> Result<(), String> {
    VideoRecorder::request_permission()
}

#[tauri::command]
pub async fn is_recording(
    recorder: State<'_, Arc<Mutex<VideoRecorder>>>,
) -> Result<bool, String> {
    let recorder = recorder.lock().unwrap();
    Ok(recorder.is_recording())
}
```

### 2.2 Register Commands in lib.rs
**File**: `src-tauri/src/lib.rs`

```rust
mod video_recording;

use std::sync::{Arc, Mutex};
use video_recording::VideoRecorder;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Arc::new(Mutex::new(VideoRecorder::new())))
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            video_recording::start_video_recording,
            video_recording::stop_video_recording,
            video_recording::check_screen_recording_permission,
            video_recording::request_screen_recording_permission,
            video_recording::is_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## Phase 3: TypeScript Service Layer (Day 3)

### 3.1 Create Video Recording Service
**File**: `src/services/videoRecordingService.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';
import type { Session } from '../types';

export interface VideoQuality {
  width: number;
  height: number;
  fps: number;
}

export const VIDEO_QUALITY_PRESETS = {
  low: { width: 854, height: 480, fps: 15 } as VideoQuality,
  medium: { width: 1280, height: 720, fps: 15 } as VideoQuality,
  high: { width: 1920, height: 1080, fps: 30 } as VideoQuality,
};

class VideoRecordingService {
  private currentSessionId: string | null = null;
  private outputPath: string | null = null;

  /**
   * Start recording screen for a session
   */
  async startRecording(
    session: Session,
    quality: VideoQuality = VIDEO_QUALITY_PRESETS.medium
  ): Promise<void> {
    try {
      // Check permission first
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        await this.requestPermission();
        throw new Error('Screen recording permission required');
      }

      // Generate output path
      const outputPath = await this.generateOutputPath(session.id);

      // Invoke Rust command
      await invoke('start_video_recording', {
        sessionId: session.id,
        outputPath,
        quality,
      });

      this.currentSessionId = session.id;
      this.outputPath = outputPath;

      console.log('🎬 Video recording started for session:', session.id);
    } catch (error) {
      console.error('Failed to start video recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return video path
   */
  async stopRecording(): Promise<string> {
    try {
      const path = await invoke<string>('stop_video_recording');

      console.log('⏹️  Video recording stopped:', path);

      this.currentSessionId = null;
      this.outputPath = null;

      return path;
    } catch (error) {
      console.error('Failed to stop video recording:', error);
      throw error;
    }
  }

  /**
   * Check if currently recording
   */
  async isRecording(): Promise<boolean> {
    try {
      return await invoke<boolean>('is_recording');
    } catch (error) {
      console.error('Failed to check recording state:', error);
      return false;
    }
  }

  /**
   * Check if screen recording permission is granted
   */
  async checkPermission(): Promise<boolean> {
    try {
      return await invoke<boolean>('check_screen_recording_permission');
    } catch (error) {
      console.error('Failed to check permission:', error);
      return false;
    }
  }

  /**
   * Request screen recording permission
   */
  async requestPermission(): Promise<void> {
    try {
      await invoke('request_screen_recording_permission');
    } catch (error) {
      console.error('Failed to request permission:', error);
      throw error;
    }
  }

  /**
   * Generate output path for video file
   */
  private async generateOutputPath(sessionId: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `session-${sessionId}-${timestamp}.mp4`;

    // Get app data directory
    const { appDataDir } = await import('@tauri-apps/api/path');
    const dataDir = await appDataDir();

    return `${dataDir}/videos/${filename}`;
  }

  /**
   * Get current recording session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }
}

export const videoRecordingService = new VideoRecordingService();
```

### 3.2 Create Permission Utility
**File**: `src/utils/videoPermissions.ts`

```typescript
import { useState, useEffect } from 'react';
import { videoRecordingService } from '../services/videoRecordingService';

/**
 * Hook to check screen recording permission status
 */
export function useScreenRecordingPermission() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkPermission = async () => {
    setIsChecking(true);
    try {
      const granted = await videoRecordingService.checkPermission();
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error('Permission check failed:', error);
      setHasPermission(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const requestPermission = async () => {
    try {
      await videoRecordingService.requestPermission();
      // Re-check after request
      await checkPermission();
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  return {
    hasPermission,
    isChecking,
    checkPermission,
    requestPermission,
  };
}

/**
 * Show instructions for enabling screen recording permission
 */
export function showPermissionInstructions() {
  // This will be a modal component
  return {
    title: 'Screen Recording Permission Required',
    message: `To record your screen during sessions:

1. Open System Settings
2. Go to Privacy & Security > Screen Recording
3. Enable permission for Taskerino
4. Restart Taskerino`,
  };
}
```

---

## Phase 4: UI Integration (Day 4)

### 4.1 Add Recording Toggle to SessionsZone
**File**: `src/components/SessionsZone.tsx` (modify)

```typescript
import { videoRecordingService, VIDEO_QUALITY_PRESETS } from '../services/videoRecordingService';
import { useScreenRecordingPermission } from '../utils/videoPermissions';

// Inside SessionsZone component:
const { hasPermission, requestPermission } = useScreenRecordingPermission();
const [videoRecordingEnabled, setVideoRecordingEnabled] = useState(false);

// In the session start form, add toggle:
<div className="flex items-center justify-between">
  <label className="text-sm font-medium text-gray-700">
    Record Screen
  </label>
  <button
    type="button"
    onClick={() => setVideoRecordingEnabled(!videoRecordingEnabled)}
    className={cn(
      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
      videoRecordingEnabled ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-gray-300"
    )}
  >
    <span
      className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
        videoRecordingEnabled ? "translate-x-6" : "translate-x-1"
      )}
    />
  </button>
</div>

// When starting session:
const handleStartSession = async () => {
  // ... existing screenshot/audio setup

  // Start video recording if enabled
  if (videoRecordingEnabled) {
    if (!hasPermission) {
      await requestPermission();
      return; // Don't start session yet
    }

    try {
      await videoRecordingService.startRecording(
        newSession,
        VIDEO_QUALITY_PRESETS.medium
      );
    } catch (error) {
      console.error('Failed to start video recording:', error);
      // Continue with session even if video fails
    }
  }

  // ... rest of session start logic
};

// When stopping session:
const handleStopSession = async () => {
  // ... existing stop logic

  // Stop video recording
  const isRecording = await videoRecordingService.isRecording();
  if (isRecording) {
    try {
      const videoPath = await videoRecordingService.stopRecording();

      // Save video to session
      await saveVideoToSession(activeSession.id, videoPath);
    } catch (error) {
      console.error('Failed to stop video recording:', error);
    }
  }

  // ... rest of stop logic
};
```

### 4.2 Add Recording Indicator
**Component**: Visual indicator when recording is active

```typescript
// In SessionsZone, when session is active:
{activeSession && videoRecordingEnabled && (
  <div className="fixed top-4 right-4 bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
    <div className="w-3 h-3 bg-white rounded-full" />
    <span className="text-sm font-medium">Recording Screen</span>
  </div>
)}
```

### 4.3 Add Permission Modal
**File**: `src/components/PermissionModal.tsx`

```typescript
interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}

export function PermissionModal({ isOpen, onClose, onOpenSettings }: PermissionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/90 backdrop-blur-xl rounded-[24px] border-2 border-white/50 p-8 max-w-md">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Screen Recording Permission Required
        </h3>

        <p className="text-gray-700 mb-6">
          To record your screen during sessions, please enable screen recording permission:
        </p>

        <ol className="text-sm text-gray-600 space-y-2 mb-6 list-decimal list-inside">
          <li>Open System Settings</li>
          <li>Go to Privacy & Security → Screen Recording</li>
          <li>Enable permission for Taskerino</li>
          <li>Restart Taskerino</li>
        </ol>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-xl font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onOpenSettings}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium"
          >
            Open Settings
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 5: Basic Video Playback (Day 5)

### 5.1 Create Video Storage Service
**File**: `src/services/videoStorageService.ts`

```typescript
import { attachmentStorageService } from './attachmentStorageService';

class VideoStorageService {
  /**
   * Save video file to session as attachment
   */
  async saveVideoToSession(sessionId: string, videoPath: string): Promise<string> {
    try {
      // Read video file
      const { readBinaryFile } = await import('@tauri-apps/api/fs');
      const videoData = await readBinaryFile(videoPath);

      // Save as attachment
      const attachmentId = await attachmentStorageService.saveAttachment({
        sessionId,
        type: 'video',
        data: videoData,
        metadata: {
          filename: videoPath.split('/').pop() || 'video.mp4',
          mimeType: 'video/mp4',
        },
      });

      return attachmentId;
    } catch (error) {
      console.error('Failed to save video:', error);
      throw error;
    }
  }

  /**
   * Get video URL for playback
   */
  async getVideoUrl(attachmentId: string): Promise<string> {
    return attachmentStorageService.getAttachmentUrl(attachmentId);
  }
}

export const videoStorageService = new VideoStorageService();
```

### 5.2 Create Simple Video Player
**File**: `src/components/VideoPlayer.tsx`

```typescript
import React, { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export function VideoPlayer({ videoUrl, onTimeUpdate }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const time = pos * duration;

    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-[20px] border-2 border-white/60 overflow-hidden">
      {/* Video Element */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
        />
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Progress Bar */}
        <div
          className="h-2 bg-gray-200 rounded-full cursor-pointer"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg transition-shadow"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <button
            onClick={toggleMute}
            className="p-2 bg-gray-200 hover:bg-gray-300 rounded-xl transition-colors"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          <span className="text-sm text-gray-600 ml-auto">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

### 5.3 Integrate Video Player into SessionReview
**File**: `src/components/SessionReview.tsx` (modify line 173-177)

```typescript
import { VideoPlayer } from './VideoPlayer';
import { videoStorageService } from '../services/videoStorageService';

// Add state for video URL
const [videoUrl, setVideoUrl] = useState<string | null>(null);

// Load video URL when component mounts
useEffect(() => {
  const loadVideo = async () => {
    if (session.video?.fullVideoAttachmentId) {
      try {
        const url = await videoStorageService.getVideoUrl(
          session.video.fullVideoAttachmentId
        );
        setVideoUrl(url);
      } catch (error) {
        console.error('Failed to load video:', error);
      }
    }
  };
  loadVideo();
}, [session.video?.fullVideoAttachmentId]);

// Replace the placeholder (lines 173-177):
{mediaMode === 'video' && videoUrl && (
  <VideoPlayer
    videoUrl={videoUrl}
    onTimeUpdate={setCurrentTime}
  />
)}
```

---

## Phase 6: Testing & Validation (Day 5-6)

### 6.1 Manual Test Checklist
- [ ] Permission check works (returns true/false correctly)
- [ ] Permission request opens System Settings
- [ ] Can start recording (no errors)
- [ ] Recording indicator shows while recording
- [ ] Can stop recording (generates .mp4 file)
- [ ] Video file exists at expected path
- [ ] Video plays back in VideoPlayer
- [ ] Video syncs with timeline
- [ ] Multiple record/stop cycles work
- [ ] Session without video still works normally
- [ ] App doesn't crash if recording fails

### 6.2 Edge Cases to Test
- [ ] Start recording without permission → shows modal
- [ ] Stop recording prematurely (< 1 second)
- [ ] Very long recording (> 1 hour)
- [ ] Start new session while previous is recording
- [ ] Quit app while recording (should stop gracefully)
- [ ] Insufficient disk space
- [ ] External display connected/disconnected

### 6.3 Performance Validation
- [ ] Recording doesn't impact screenshot capture
- [ ] CPU usage stays reasonable (< 20% on modern Mac)
- [ ] Memory usage doesn't balloon
- [ ] 720p @ 15fps generates ~30MB/hour
- [ ] Video playback is smooth

---

## Timeline

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1** | Swift module, build config, FFI headers | 1-2 days | Xcode, swiftc |
| **Phase 2** | Rust FFI bridge, Tauri commands | 1 day | Phase 1 |
| **Phase 3** | TypeScript service, permissions hook | 0.5 day | Phase 2 |
| **Phase 4** | UI integration (toggle, indicator, modal) | 0.5 day | Phase 3 |
| **Phase 5** | Video storage, player, SessionReview integration | 1 day | Phase 4 |
| **Phase 6** | Testing, bug fixes, polish | 1 day | Phase 5 |

**Total: 5-6 days** for basic recording → playback

---

## Success Criteria

### Minimum Viable Product (MVP)
- ✅ Can start/stop screen recording during session
- ✅ Recording creates .mp4 file
- ✅ Video plays back in Review tab
- ✅ Video syncs with timeline (current time indicator)
- ✅ Permission handling works gracefully
- ✅ No crashes or data loss

### Future Enhancements (Post-MVP)
- Intelligent chunking (Phase 2 of original plan)
- AI analysis (Phase 4 of original plan)
- Chunk selector dropdown
- Playback speed controls
- Export video clips
- Storage management UI

---

## Next Steps

**Immediate Actions**:
1. Create `src-tauri/ScreenRecorder/` directory
2. Write `ScreenRecorder.swift` with ScreenCaptureKit implementation
3. Update `build.rs` to compile Swift module
4. Test Swift compilation in isolation
5. Proceed to Rust FFI bridge once Swift works

**Verification Command**:
```bash
cd src-tauri
swiftc -v # Verify Swift compiler available
```

Ready to start implementing?
