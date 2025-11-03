# Media Controls Quick Fix Guide
## Critical Integration Fixes for Stage 6

**Estimated Time**: 6 hours total
**Priority**: High - Blocks all media controls functionality

---

## Fix #1: Register Device Enumeration Commands (30 minutes)

### Problem
Device enumeration commands exist in backend but are NOT registered in the Tauri invoke handler.

### Location
`src-tauri/src/lib.rs`

### Fix
Add these commands to the `tauri::generate_handler![]` macro (around line 220):

```rust
// Find this section in lib.rs:
.invoke_handler(tauri::generate_handler![
    capture_primary_screen,
    capture_all_screens,
    // ... existing commands ...

    // ADD THESE LINES: ↓↓↓
    // Media Controls - Audio Device Enumeration
    audio_capture::get_audio_devices,
    audio_capture::get_audio_mix_config,
    audio_capture::set_audio_mix_config,

    // Media Controls - Video Device Enumeration
    video_recording::enumerate_displays,
    video_recording::enumerate_windows,
    video_recording::enumerate_webcams,
    // END OF NEW LINES ↑↑↑

    video_recording::start_video_recording,
    // ... rest of commands ...
])
```

### Implementation Required
These commands need to be implemented in the backend first:

**In `src-tauri/src/audio_capture.rs`**, add:

```rust
#[tauri::command]
pub fn get_audio_devices() -> Result<Vec<crate::types::AudioDevice>, String> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let host = cpal::default_host();
    let mut devices = Vec::new();

    // Get input devices (microphones)
    if let Ok(input_devices) = host.input_devices() {
        for device in input_devices {
            if let Ok(name) = device.name() {
                if let Ok(config) = device.default_input_config() {
                    devices.push(crate::types::AudioDevice {
                        id: name.clone(), // Use device name as ID
                        name,
                        device_type: crate::types::AudioDeviceType::Input,
                        is_default: false, // TODO: Detect default device
                        sample_rate: config.sample_rate().0,
                        channels: config.channels(),
                    });
                }
            }
        }
    }

    // Get output devices (for system audio loopback)
    if let Ok(output_devices) = host.output_devices() {
        for device in output_devices {
            if let Ok(name) = device.name() {
                if let Ok(config) = device.default_output_config() {
                    devices.push(crate::types::AudioDevice {
                        id: name.clone(),
                        name,
                        device_type: crate::types::AudioDeviceType::Output,
                        is_default: false,
                        sample_rate: config.sample_rate().0,
                        channels: config.channels(),
                    });
                }
            }
        }
    }

    Ok(devices)
}

#[tauri::command]
pub fn get_audio_mix_config(
    audio_recorder: tauri::State<Arc<AudioRecorder>>,
) -> Result<crate::types::AudioMixConfig, String> {
    // TODO: Add method to AudioRecorder to get current config
    // For now, return default
    Ok(crate::types::AudioMixConfig::default())
}

#[tauri::command]
pub fn set_audio_mix_config(
    audio_recorder: tauri::State<Arc<AudioRecorder>>,
    config: crate::types::AudioMixConfig,
) -> Result<(), String> {
    // Extract balance and call existing update_audio_balance
    if let Some(balance) = config.balance {
        audio_recorder.update_audio_balance(balance)?;
    }
    // TODO: Store full config in AudioRecorder for future queries
    Ok(())
}
```

**In `src-tauri/src/video_recording.rs`**, add:

```rust
#[tauri::command]
pub fn enumerate_displays() -> Result<Vec<crate::types::DisplayInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CStr;

        unsafe {
            let json_ptr = screen_recorder_enumerate_displays();
            if json_ptr.is_null() {
                return Err("Failed to enumerate displays".to_string());
            }

            let json_str = CStr::from_ptr(json_ptr)
                .to_str()
                .map_err(|e| format!("Invalid UTF-8: {}", e))?;

            let displays: Vec<crate::types::DisplayInfo> = serde_json::from_str(json_str)
                .map_err(|e| format!("Failed to parse displays: {}", e))?;

            Ok(displays)
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Display enumeration only supported on macOS".to_string())
    }
}

#[tauri::command]
pub fn enumerate_windows() -> Result<Vec<crate::types::WindowInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CStr;

        unsafe {
            let json_ptr = screen_recorder_enumerate_windows();
            if json_ptr.is_null() {
                return Err("Failed to enumerate windows".to_string());
            }

            let json_str = CStr::from_ptr(json_ptr)
                .to_str()
                .map_err(|e| format!("Invalid UTF-8: {}", e))?;

            let windows: Vec<crate::types::WindowInfo> = serde_json::from_str(json_str)
                .map_err(|e| format!("Failed to parse windows: {}", e))?;

            Ok(windows)
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Window enumeration only supported on macOS".to_string())
    }
}

#[tauri::command]
pub fn enumerate_webcams() -> Result<Vec<crate::types::WebcamInfo>, String> {
    #[cfg(target_os = "macos")]
    {
        use std::ffi::CStr;

        unsafe {
            let json_ptr = screen_recorder_enumerate_webcams();
            if json_ptr.is_null() {
                return Err("Failed to enumerate webcams".to_string());
            }

            let json_str = CStr::from_ptr(json_ptr)
                .to_str()
                .map_err(|e| format!("Invalid UTF-8: {}", e))?;

            let webcams: Vec<crate::types::WebcamInfo> = serde_json::from_str(json_str)
                .map_err(|e| format!("Failed to parse webcams: {}", e))?;

            Ok(webcams)
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Webcam enumeration only supported on macOS".to_string())
    }
}
```

### Verification
After implementing and registering:

```bash
# Rebuild Tauri app
npm run tauri:build

# Test from frontend console
await invoke('get_audio_devices'); // Should return device list
await invoke('enumerate_displays'); // Should return display list
await invoke('enumerate_webcams'); // Should return webcam list
```

---

## Fix #2: Implement Video Hot-Swap Commands (2 hours)

### Problem
Frontend calls `switch_display` and `update_webcam_mode` but these commands don't exist.

### Location
`src-tauri/src/video_recording.rs`

### Implementation

Add these commands to `video_recording.rs`:

```rust
#[tauri::command]
pub fn switch_display(
    video_recorder: tauri::State<Arc<Mutex<VideoRecorder>>>,
    display_id: String,
) -> Result<(), String> {
    let recorder = video_recorder.lock()
        .map_err(|e| format!("Failed to lock recorder: {}", e))?;

    if !recorder.is_recording() {
        return Err("No active recording to switch display".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        // TODO: Implement display switching via ScreenCaptureKit
        // This requires updating the SCStream content filter dynamically
        // For now, return not implemented
        Err("Display switching not yet implemented".to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Display switching only supported on macOS".to_string())
    }
}

#[tauri::command]
pub fn update_webcam_mode(
    video_recorder: tauri::State<Arc<Mutex<VideoRecorder>>>,
    pip_config: crate::types::PiPConfig,
) -> Result<(), String> {
    let recorder = video_recorder.lock()
        .map_err(|e| format!("Failed to lock recorder: {}", e))?;

    if !recorder.is_recording() {
        return Err("No active recording to update webcam mode".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        // Serialize PiP config to JSON
        let config_json = serde_json::to_string(&pip_config)
            .map_err(|e| format!("Failed to serialize PiP config: {}", e))?;

        let config_cstr = CString::new(config_json)
            .map_err(|e| format!("Failed to create CString: {}", e))?;

        unsafe {
            let result = screen_recorder_update_pip_config(config_cstr.as_ptr());
            if result == 0 {
                Ok(())
            } else {
                Err(format!("Failed to update PiP config: error code {}", result))
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("PiP configuration only supported on macOS".to_string())
    }
}
```

### Register Commands

Add to `lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...

    // ADD THESE LINES:
    video_recording::switch_display,
    video_recording::update_webcam_mode,

    // ... rest of commands ...
])
```

### Verification

```typescript
// Test from frontend
await invoke('switch_display', { displayId: 'display-123' });
await invoke('update_webcam_mode', {
  enabled: true,
  position: 'bottom-right',
  size: 'small',
  borderRadius: 10
});
```

---

## Fix #3: Implement Video Config Passthrough (2 hours)

### Problem
`startRecordingWithConfig` reads `session.videoConfig` but only passes `quality` to backend.

### Location
- Backend: `src-tauri/src/video_recording.rs`
- Frontend: `src/services/videoRecordingService.ts`

### Backend Implementation

Add new command to `video_recording.rs`:

```rust
#[tauri::command]
pub fn start_video_recording_with_config(
    video_recorder: tauri::State<Arc<Mutex<VideoRecorder>>>,
    session_id: String,
    output_path: String,
    config: crate::types::VideoRecordingConfig,
) -> Result<(), String> {
    let mut recorder = video_recorder.lock()
        .map_err(|e| format!("Failed to lock recorder: {}", e))?;

    println!("[VIDEO] Starting recording with full config:");
    println!("  Source Type: {:?}", config.source_type);
    println!("  Display IDs: {:?}", config.display_ids);
    println!("  Window ID: {:?}", config.window_id);
    println!("  Webcam ID: {:?}", config.webcam_device_id);
    println!("  PiP Config: {:?}", config.pip_config);
    println!("  Quality: {:?}", config.quality);
    println!("  FPS: {}", config.fps);

    #[cfg(target_os = "macos")]
    {
        use std::ffi::CString;
        use std::path::PathBuf;

        let output_path_buf = PathBuf::from(&output_path);
        let output_cstr = CString::new(output_path.as_str())
            .map_err(|e| format!("Invalid output path: {}", e))?;

        // Map quality preset to dimensions
        let (width, height, fps) = match config.quality {
            crate::types::VideoQuality::Low => (854, 480, 10),
            crate::types::VideoQuality::Medium => (1280, 720, 15),
            crate::types::VideoQuality::High => (1920, 1080, 30),
            crate::types::VideoQuality::Ultra => (2560, 1440, 60),
        };

        let fps = config.fps.min(fps); // Use config FPS if lower

        unsafe {
            match config.source_type {
                crate::types::VideoSourceType::Display => {
                    if let Some(display_ids) = &config.display_ids {
                        let display_json = serde_json::to_string(display_ids)
                            .map_err(|e| format!("Failed to serialize display IDs: {}", e))?;
                        let display_cstr = CString::new(display_json)
                            .map_err(|e| format!("Failed to create CString: {}", e))?;

                        let result = screen_recorder_start_display_recording(
                            display_cstr.as_ptr(),
                            output_cstr.as_ptr(),
                            fps as i32,
                            width as i32,
                            height as i32,
                        );

                        if result != 0 {
                            return Err(format!("Failed to start display recording: error {}", result));
                        }
                    } else {
                        return Err("Display IDs required for display recording".to_string());
                    }
                },

                crate::types::VideoSourceType::Window => {
                    if let Some(window_id) = &config.window_id {
                        let window_cstr = CString::new(window_id.as_str())
                            .map_err(|e| format!("Failed to create CString: {}", e))?;

                        let result = screen_recorder_start_window_recording(
                            window_cstr.as_ptr(),
                            output_cstr.as_ptr(),
                            fps as i32,
                            width as i32,
                            height as i32,
                        );

                        if result != 0 {
                            return Err(format!("Failed to start window recording: error {}", result));
                        }
                    } else {
                        return Err("Window ID required for window recording".to_string());
                    }
                },

                crate::types::VideoSourceType::Webcam => {
                    if let Some(webcam_id) = &config.webcam_device_id {
                        let webcam_cstr = CString::new(webcam_id.as_str())
                            .map_err(|e| format!("Failed to create CString: {}", e))?;

                        let result = screen_recorder_start_webcam_recording(
                            webcam_cstr.as_ptr(),
                            output_cstr.as_ptr(),
                            fps as i32,
                            width as i32,
                            height as i32,
                        );

                        if result != 0 {
                            return Err(format!("Failed to start webcam recording: error {}", result));
                        }
                    } else {
                        return Err("Webcam ID required for webcam recording".to_string());
                    }
                },

                crate::types::VideoSourceType::DisplayWithWebcam => {
                    // Serialize full config to JSON for PiP recording
                    let config_json = serde_json::to_string(&config)
                        .map_err(|e| format!("Failed to serialize config: {}", e))?;
                    let config_cstr = CString::new(config_json)
                        .map_err(|e| format!("Failed to create CString: {}", e))?;

                    let result = screen_recorder_start_pip_recording(
                        config_cstr.as_ptr(),
                        output_cstr.as_ptr(),
                    );

                    if result != 0 {
                        return Err(format!("Failed to start PiP recording: error {}", result));
                    }
                },
            }
        }

        // Store config and state
        *recorder.current_session_id.lock().unwrap() = Some(session_id.clone());
        *recorder.output_path.lock().unwrap() = Some(output_path_buf);
        *recorder.recording_config.lock().unwrap() = Some(config);

        println!("[VIDEO] Recording started successfully with config");
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Video recording with config only supported on macOS".to_string())
    }
}
```

### Frontend Update

Update `src/services/videoRecordingService.ts`:

```typescript
async startRecordingWithConfig(session: Session): Promise<void> {
  console.log('🎬 [VIDEO SERVICE] Starting recording with config:', session.videoConfig);

  await this.ensureVideoDir();

  const appDataDir = await path.appDataDir();
  const videoFileName = `session-${session.id}-${Date.now()}.mp4`;
  const outputPath = await path.join(appDataDir, 'videos', videoFileName);

  this.activeSessionId = session.id;
  this.isRecording = true;

  try {
    if (session.videoConfig) {
      // UPDATED: Pass full config, not just quality
      await invoke('start_video_recording_with_config', {
        sessionId: session.id,
        outputPath,
        config: session.videoConfig, // ✅ Full config
      });
    } else {
      // Fallback to simple recording
      const quality = { width: 1280, height: 720, fps: 15 };
      await invoke('start_video_recording', {
        sessionId: session.id,
        outputPath,
        quality,
      });
    }

    console.log('✅ [VIDEO SERVICE] Recording started successfully');
  } catch (error) {
    this.isRecording = false;
    this.activeSessionId = null;
    console.error('❌ [VIDEO SERVICE] Failed to start recording:', error);
    throw error;
  }
}
```

### Register Command

Add to `lib.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...

    // ADD THIS LINE:
    video_recording::start_video_recording_with_config,

    // ... rest of commands ...
])
```

### Verification

```typescript
// Test from frontend
const session: Session = {
  id: 'test-123',
  videoRecording: true,
  videoConfig: {
    sourceType: 'display-with-webcam',
    displayIds: ['display-1'],
    webcamDeviceId: 'cam-456',
    pipConfig: {
      enabled: true,
      position: 'bottom-right',
      size: 'small',
      borderRadius: 10
    },
    quality: 'high',
    fps: 30,
  },
  // ... other required fields
};

await videoRecordingService.startRecordingWithConfig(session);
```

---

## Fix #4: Integrate Validation into SessionsContext (1 hour)

### Problem
`SessionsContext` doesn't call `validateSession()` before starting a session.

### Location
`src/context/SessionsContext.tsx`

### Implementation

Update the `startSession` action:

```typescript
import { validateSession } from '../utils/sessionValidation';

// In SessionsContext reducer, find START_SESSION case
case 'START_SESSION': {
  const newSession: Session = {
    id: generateId(),
    name: payload.name,
    description: payload.description,
    status: 'active',
    startTime: new Date().toISOString(),
    screenshotInterval: payload.screenshotInterval ?? 2,
    autoAnalysis: payload.autoAnalysis ?? true,
    enableScreenshots: payload.enableScreenshots ?? true,
    audioMode: payload.audioMode ?? 'off',
    audioRecording: payload.audioRecording ?? false,
    videoRecording: payload.videoRecording ?? false,
    screenshots: [],
    audioSegments: [],
    extractedTaskIds: [],
    extractedNoteIds: [],
    tags: payload.tags ?? [],
    audioReviewCompleted: false,

    // NEW: Include media configs
    audioConfig: payload.audioConfig,
    videoConfig: payload.videoConfig,
    enrichmentConfig: payload.enrichmentConfig,
  };

  // NEW: Validate session before starting
  const validation = validateSession(newSession);
  if (!validation.valid) {
    console.error('❌ [SESSIONS] Session validation failed:', validation.errors);
    // Show error notification (implement based on your notification system)
    // For now, just log and continue with warnings
    validation.errors.forEach(error => {
      console.warn(`⚠️ [SESSIONS] Validation warning: ${error}`);
    });
  }

  return {
    ...state,
    sessions: [...state.sessions, newSession],
    activeSessionId: newSession.id,
  };
}
```

### Verification

```typescript
// Test invalid session
dispatch({
  type: 'START_SESSION',
  payload: {
    name: 'Test Session',
    audioRecording: true,
    audioConfig: {
      sourceType: 'microphone',
      micDeviceId: '', // Invalid: empty
      balance: 150, // Invalid: > 100
    }
  }
});

// Check console for validation errors
```

---

## Fix #5: Add Swift Implementations (If Missing)

### Check Required
Verify that `ScreenRecorder.swift` implements these FFI functions:

```swift
@_cdecl("screen_recorder_enumerate_displays")
public func screen_recorder_enumerate_displays() -> UnsafePointer<CChar>?

@_cdecl("screen_recorder_enumerate_windows")
public func screen_recorder_enumerate_windows() -> UnsafePointer<CChar>?

@_cdecl("screen_recorder_enumerate_webcams")
public func screen_recorder_enumerate_webcams() -> UnsafePointer<CChar>?

@_cdecl("screen_recorder_start_display_recording")
public func screen_recorder_start_display_recording(
    display_ids_json: UnsafePointer<CChar>?,
    output_path: UnsafePointer<CChar>?,
    fps: Int32,
    width: Int32,
    height: Int32
) -> Int32

@_cdecl("screen_recorder_update_pip_config")
public func screen_recorder_update_pip_config(
    config_json: UnsafePointer<CChar>?
) -> Int32
```

If missing, these need to be implemented in the Swift bridge. Refer to the implementation plan Stage 3 for details.

---

## Testing Checklist

After applying all fixes:

### Backend Tests
```bash
# Compile and run Rust tests
cd src-tauri
cargo test --lib types
cargo build
```

### Frontend Tests
```bash
# Run validation tests
npm run test sessionValidation

# Type check
npm run type-check
```

### Manual Integration Tests
1. Start Tauri app: `npm run tauri:dev`
2. Open browser console
3. Test commands:
   ```javascript
   // Test device enumeration
   const audio = await invoke('get_audio_devices');
   console.log('Audio devices:', audio);

   const displays = await invoke('enumerate_displays');
   console.log('Displays:', displays);

   const webcams = await invoke('enumerate_webcams');
   console.log('Webcams:', webcams);

   // Test audio mix config
   await invoke('set_audio_mix_config', {
     config: {
       micDeviceId: 'test-mic',
       systemAudioDeviceId: 'test-sys',
       sourceType: 'both',
       balance: 50,
       micVolume: 1.0,
       systemVolume: 0.8
     }
   });

   const config = await invoke('get_audio_mix_config');
   console.log('Audio config:', config);
   ```

---

## Expected Results

After applying all fixes:

✅ All device enumeration commands should work
✅ Audio mix configuration should be settable and retrievable
✅ Video recording with full config should work (once Swift bridge is complete)
✅ Hot-swap commands should be callable (may return "not implemented" until Swift side is done)
✅ Session validation should run automatically on session start
✅ TypeScript should compile without errors
✅ Rust should compile without errors

---

## Next Steps (After These Fixes)

1. **Complete Swift Bridge** (if not done):
   - Implement missing FFI functions in `ScreenRecorder.swift`
   - Test ScreenCaptureKit integration
   - Test AVFoundation webcam capture
   - Test PiPCompositor

2. **Implement UI Components** (Stage 5):
   - Build `StartSessionModal.tsx`
   - Build `ActiveSessionMediaControls.tsx`
   - Build device selector components
   - Integrate with SessionsContext

3. **Add Error Handling** (Stage 6):
   - Device disconnect monitoring
   - Permission checks
   - Error recovery

4. **Performance Testing** (Stage 7):
   - Profile with Instruments
   - Optimize memory usage
   - Test thermal management

---

**Estimated Total Time**: 6 hours for critical fixes
**Blocker Status**: After these fixes, UI implementation can proceed (Stage 5)
