# Media Controls Architecture Documentation

**Taskerino Advanced Media Controls - Technical Architecture**
Internal documentation for developers extending or debugging the media subsystem.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [Component Breakdown](#component-breakdown)
4. [Audio System](#audio-system)
5. [Video System](#video-system)
6. [FFI Integration](#ffi-integration)
7. [Adding New Device Types](#adding-new-device-types)
8. [Extending the Audio Mixer](#extending-the-audio-mixer)
9. [Debugging PiP Issues](#debugging-pip-issues)
10. [Performance Optimization](#performance-optimization)
11. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────┐
│                   User Interface (React)                │
│  StartSessionModal / ActiveSessionMediaControls         │
└────────────────────┬────────────────────────────────────┘
                     │ Session config (TypeScript)
                     ▼
┌─────────────────────────────────────────────────────────┐
│               SessionsContext (State)                   │
│  Validation + Persistence + Session Lifecycle           │
└────────────────────┬────────────────────────────────────┘
                     │ invoke('tauri_command')
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Frontend Services (TypeScript)               │
│  audioRecordingService / videoRecordingService          │
└────────────────────┬────────────────────────────────────┘
                     │ Tauri IPC
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Tauri Commands (Rust)                      │
│  audio_capture.rs / video_recording.rs / lib.rs         │
└────────────────────┬────────────────────────────────────┘
                     │ FFI calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 Swift Bridge (macOS)                    │
│  ScreenRecorder.swift / PiPCompositor.swift             │
└────────────────────┬────────────────────────────────────┘
                     │ System APIs
                     ▼
┌─────────────────────────────────────────────────────────┐
│               macOS Frameworks                          │
│  cpal / ScreenCaptureKit / AVFoundation / Metal         │
└─────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Separation of Concerns**: Each layer has a single responsibility
2. **Type Safety**: TypeScript → Rust → Swift type consistency via serde
3. **Error Propagation**: Errors bubble up from system APIs to UI with context
4. **State Immutability**: React state managed via reducers, Rust state via Arc<Mutex<>>
5. **GPU Acceleration**: Metal for video, CPU for audio (ARM NEON optimized)
6. **Memory Efficiency**: Pixel buffer pools, ring buffers, zero-copy where possible

---

## Data Flow

### Complete Recording Flow

```
USER ACTION: Click "Start Recording"
       ↓
1. UI: StartSessionModal collects config
   - name, description
   - audioConfig (devices, balance)
   - videoConfig (displays, webcam, PiP)
       ↓
2. SessionsContext validates config
   - validateSession() checks required fields
   - Ensures at least one recording mode enabled
       ↓
3. Services invoke Tauri commands
   audioRecordingService.startRecording()
   videoRecordingService.startAdvancedRecording()
       ↓
4. Rust receives config, starts capture
   - audio_capture.rs → spawn audio thread
   - video_recording.rs → FFI to Swift
       ↓
5. Swift initializes system APIs
   - ScreenCaptureKit for display/system audio
   - AVFoundation for webcam
   - Metal for PiP composition
       ↓
6. RECORDING LOOP (runs until stopped)
   ┌─────────────────────────────────┐
   │ Audio Thread (Rust)             │
   │  - Capture mic samples (cpal)   │
   │  - Capture system audio (FFI)   │
   │  - Mix with AudioMixBuffer      │
   │  - Resample to 16kHz            │
   │  - WAV encode chunks            │
   │  - Emit event → Frontend        │
   └─────────────────────────────────┘

   ┌─────────────────────────────────┐
   │ Video Thread (Swift)            │
   │  - SCStream captures screen     │
   │  - AVCapture captures webcam    │
   │  - PiPCompositor overlays       │
   │  - H.264/H.265 encode           │
   │  - Write to MP4 file            │
   └─────────────────────────────────┘
       ↓
7. USER ACTION: Click "Stop"
       ↓
8. Cleanup sequence
   - Stop audio streams gracefully
   - Flush video encoder
   - Close file handles
   - Emit final metadata event
       ↓
9. Session saved to storage
   - IndexedDB (browser) or Tauri FS (desktop)
   - Attachments stored separately
```

### Hot-Swap Device Flow

```
USER ACTION: Change device in ActiveSessionMediaControls
       ↓
1. UI: DeviceSelector onChange handler
       ↓
2. onAudioConfigChange() or onVideoConfigChange()
       ↓
3. SessionsContext updates session state
       ↓
4. Service invokes Tauri command
   switchAudioInputDevice(deviceId)
   updateWebcamMode(pipConfig)
       ↓
5. Rust hot-swaps device
   - Audio: Close old stream, open new stream
   - Video: Update SCStream content filter
       ↓
6. Recording continues seamlessly
   - <100ms gap for audio switch
   - <1 frame gap for video switch
```

---

## Component Breakdown

### Frontend Components

#### StartSessionModal.tsx
**Purpose:** Comprehensive session configuration modal.

**Key Features:**
- Device enumeration and selection
- Quality preset selection
- Advanced settings (custom resolution, FPS, codec)
- Audio balance slider
- PiP mode selector
- Test audio button

**Props:**
```typescript
interface StartSessionModalProps {
  show: boolean;
  onClose: () => void;
  onStartSession: (config: SessionStartConfig) => void;
  lastSettings?: LastSessionSettings;
  initialAudioDevice?: string;
  initialVideoDevice?: string;
}
```

**State Management:**
- Local state for UI (dropdowns, toggles)
- Loads devices on mount via services
- Persists settings to localStorage as "LastSessionSettings"

#### ActiveSessionMediaControls.tsx
**Purpose:** Mid-session device control panel.

**Key Features:**
- Collapsible panel (expand/collapse animation)
- Real-time device switching
- Audio balance slider with live adjustment
- Audio level meters
- Warning indicators for disconnected devices

**Props:**
```typescript
interface ActiveSessionMediaControlsProps {
  session: Session;
  onAudioConfigChange: (config: AudioDeviceConfig) => void;
  onVideoConfigChange: (config: VideoRecordingConfig) => void;
}
```

**Memoization:**
- All device change handlers are `useCallback` memoized
- Prevents infinite render loops in DeviceSelector
- Derives webcamMode from videoConfig with `useMemo`

#### DeviceSelector.tsx
**Purpose:** Reusable dropdown for device selection.

**Supports:**
- `audio-input` (microphones)
- `audio-output` (speakers/system audio)
- `webcam` (cameras)
- `display` (screens)

**Features:**
- Icons per device type
- Default device badge
- Empty state handling
- Loading skeleton
- Compact mode for inline usage

#### AudioBalanceSlider.tsx
**Purpose:** Visual slider for mic/system audio mixing.

**Implementation:**
- Framer Motion for draggable thumb
- Gradient track: red → purple → cyan
- Keyboard controls (arrow keys, Home/End)
- Live value display
- ARIA labels for accessibility

#### WebcamModeSelector.tsx
**Purpose:** 3-way toggle for webcam modes.

**Modes:**
```typescript
type WebcamMode =
  | { mode: 'off' }
  | { mode: 'standalone' }
  | { mode: 'pip', pipConfig: { position: PiPPosition, size: PiPSize } }
```

**UI:**
- 3-way toggle: Off / PiP / Standalone
- Position selector (4 corners, visual layout)
- Size selector (Small/Medium/Large)
- Conditional rendering (position only for PiP)

### Frontend Services

#### audioRecordingService.ts
**Location:** `src/services/audioRecordingService.ts`

**API:**
```typescript
class AudioRecordingService {
  // Device enumeration
  async getAudioDevices(): Promise<AudioDevice[]>

  // Recording control
  async startRecording(config: AudioConfig): Promise<void>
  async stopRecording(): Promise<void>

  // Device switching
  async switchInputDevice(deviceId: string): Promise<void>
  async switchOutputDevice(deviceId: string): Promise<void>

  // Mix control
  async setMixConfig(config: AudioMixConfig): Promise<void>
}
```

**Error Handling:**
- Try-catch around all Tauri invocations
- Throws errors with context for UI display
- Logs errors to console for debugging

#### videoRecordingService.ts
**Location:** `src/services/videoRecordingService.ts`

**API:**
```typescript
class VideoRecordingService {
  // Device enumeration
  async enumerateDisplays(): Promise<DisplayInfo[]>
  async enumerateWindows(): Promise<WindowInfo[]>
  async enumerateWebcams(): Promise<WebcamInfo[]>

  // Recording control
  async startAdvancedRecording(config: VideoRecordingConfig): Promise<void>
  async stopRecording(): Promise<void>

  // Device switching
  async switchDisplay(displayId: string): Promise<void>
  async updateWebcamMode(mode: PiPConfig): Promise<void>
}
```

**Caching:**
- Display thumbnails cached with 5s TTL
- Reduces repeated FFI calls for preview images

---

## Audio System

### Audio Processing Pipeline

```
Microphone Input (cpal)          System Audio (SCStream)
       │                                  │
       └──────────┬───────────────────────┘
                  │
                  ▼
           AudioMixBuffer
     ┌──────────────────────┐
     │  Balance: 0-100      │
     │  Mix Algorithm:      │
     │  out = mic*(1-b)     │
     │      + sys*b         │
     └──────────┬───────────┘
                │
                ▼
         Resample to 16kHz
         (Linear interpolation)
                │
                ▼
          WAV Encoding
          (hound crate)
                │
                ▼
        Base64 + Emit Event
                │
                ▼
    OpenAI Whisper Transcription
    (or local processing)
```

### Audio Capture (Rust)

**File:** `src-tauri/src/audio_capture.rs`

**Key Structures:**

```rust
pub struct AudioMixBuffer {
    balance: Arc<Mutex<u8>>,        // 0-100
    target_sample_rate: u32,        // 16000 Hz
}

pub struct AudioRecorder {
    state: Arc<Mutex<RecordingState>>,
    mic_stream: Option<Stream>,
    system_stream: Option<SystemAudioCapture>,
    mixer: AudioMixBuffer,
    wav_writer: Arc<Mutex<WavWriter<BufWriter<File>>>>,
}
```

**Mixing Algorithm:**

```rust
// Mix samples from two sources based on balance
fn mix_samples(
    mic_samples: &[f32],
    mic_sample_rate: u32,
    system_samples: &[f32],
    system_sample_rate: u32,
    balance: u8,
) -> Result<Vec<f32>, String> {
    // 1. Resample both sources to 16kHz
    let mic_16k = resample(mic_samples, mic_sample_rate, 16000)?;
    let sys_16k = resample(system_samples, system_sample_rate, 16000)?;

    // 2. Calculate gains
    let balance_f32 = balance as f32 / 100.0;
    let mic_gain = 1.0 - balance_f32;
    let sys_gain = balance_f32;

    // 3. Mix samples
    let mixed: Vec<f32> = mic_16k.iter()
        .zip(sys_16k.iter())
        .map(|(m, s)| (m * mic_gain + s * sys_gain).clamp(-1.0, 1.0))
        .collect();

    Ok(mixed)
}
```

**Resampling:**
- Linear interpolation for simplicity
- Target: 16kHz mono (optimal for speech recognition)
- Quality: Sufficient for voice, not for music production

**WAV Encoding:**
```rust
let wav_spec = WavSpec {
    channels: 1,              // Mono
    sample_rate: 16000,       // 16kHz
    bits_per_sample: 16,      // 16-bit PCM
    sample_format: hound::SampleFormat::Int,
};
```

### System Audio Capture (macOS-specific)

**File:** `src-tauri/src/macos_audio.rs`

**Implementation:**
- Uses ScreenCaptureKit audio APIs (macOS 12.3+)
- FFI bridge to Swift `AudioCapture` class
- CMSampleBuffer conversion to raw PCM

**Swift Side:**
```swift
class AudioCapture: NSObject, SCStreamOutput {
    func stream(
        _ stream: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard outputType == .audio else { return }

        // Convert CMSampleBuffer to PCM floats
        let audioBuffer = CMSampleBufferGetDataBuffer(sampleBuffer)
        // ... conversion logic ...

        // Send to Rust via callback
        audioCallback(pcmData, sampleRate)
    }
}
```

---

## Video System

### Video Processing Pipeline

```
Screen Capture (SCStream)    Webcam (AVFoundation)
       │                            │
       │                            ▼
       │                    WebcamCapture
       │                            │
       │                            ▼
       │                      Resize/Scale
       │                            │
       └────────┬───────────────────┘
                │
                ▼
         PiPCompositor
    ┌────────────────────┐
    │  Core Image + Metal│
    │  GPU Composition   │
    │  Position: 4 corners│
    │  Size: S/M/L       │
    └────────┬───────────┘
             │
             ▼
      H.264/H.265 Encode
      (Hardware accelerated)
             │
             ▼
        MP4 Output File
             │
             ▼
    Attachment Storage
    (IndexedDB or Tauri FS)
```

### Screen Recording (Swift)

**File:** `src-tauri/ScreenRecorder/ScreenRecorder.swift`

**Key Classes:**

```swift
class ScreenRecorder {
    private var stream: SCStream?
    private var streamOutput: ScreenRecorderOutput

    func startRecording(displayID: CGDirectDisplayID) async throws {
        // 1. Get shareable content
        let content = try await SCShareableContent.current

        // 2. Find target display
        guard let display = content.displays.first(
            where: { $0.displayID == displayID }
        ) else {
            throw RecordingError.displayNotFound
        }

        // 3. Create content filter
        let filter = SCContentFilter(
            display: display,
            excludingWindows: []
        )

        // 4. Configure stream
        let config = SCStreamConfiguration()
        config.width = display.width
        config.height = display.height
        config.pixelFormat = kCVPixelFormatType_32BGRA
        config.minimumFrameInterval = CMTime(
            value: 1,
            timescale: CMTimeScale(fps)
        )

        // 5. Start stream
        stream = SCStream(filter: filter, configuration: config, delegate: nil)
        try stream?.addStreamOutput(streamOutput, type: .screen, ...)
        try await stream?.startCapture()
    }
}
```

### PiP Compositor (Swift + Metal)

**File:** `src-tauri/ScreenRecorder/PiPCompositor.swift`

**Core Image Pipeline:**

```swift
class PiPCompositor {
    private let ciContext: CIContext
    private let metalDevice: MTLDevice
    private var outputBufferPool: CVPixelBufferPool?

    func composite(
        screenBuffer: CVPixelBuffer,
        webcamBuffer: CVPixelBuffer,
        position: PiPPosition,
        size: PiPSize
    ) -> CVPixelBuffer {
        // 1. Create CIImages from pixel buffers
        let screenImage = CIImage(cvPixelBuffer: screenBuffer)
        let webcamImage = CIImage(cvPixelBuffer: webcamBuffer)

        // 2. Scale webcam to PiP size
        let pipSize = size.dimensions
        let scaleX = pipSize.width / webcamImage.extent.width
        let scaleY = pipSize.height / webcamImage.extent.height
        let scaledWebcam = webcamImage.transformed(
            by: CGAffineTransform(scaleX: scaleX, y: scaleY)
        )

        // 3. Apply rounded corner mask
        let maskedWebcam = scaledWebcam.applyingFilter("CIRoundedRectangleMask", parameters: [
            "inputRadius": borderRadius
        ])

        // 4. Calculate position
        let origin = position.calculateOrigin(
            screenSize: screenImage.extent.size,
            pipSize: pipSize,
            margin: margin
        )

        // 5. Composite webcam over screen
        let compositedImage = maskedWebcam
            .transformed(by: CGAffineTransform(translationX: origin.x, y: origin.y))
            .composited(over: screenImage)

        // 6. Render to output pixel buffer
        var outputBuffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, outputBufferPool!, &outputBuffer)

        ciContext.render(
            compositedImage,
            to: outputBuffer!,
            bounds: screenImage.extent,
            colorSpace: CGColorSpaceCreateDeviceRGB()
        )

        return outputBuffer!
    }
}
```

**Performance Optimizations:**
1. **Pixel Buffer Pools**: Reuse CVPixelBuffers to avoid allocation overhead
2. **Metal Backend**: GPU acceleration via `CIContext(mtlDevice: metalDevice)`
3. **Lazy Rendering**: Only render frames when both screen + webcam are available
4. **Bounded Queues**: Prevent memory growth from frame backlog

### Webcam Capture (Swift)

**Implementation:**

```swift
class WebcamCapture: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    private var session: AVCaptureSession
    private var device: AVCaptureDevice
    private var output: AVCaptureVideoDataOutput

    func startCapture(deviceID: String, width: Int, height: Int, fps: Int) throws {
        // 1. Find device
        guard let device = AVCaptureDevice(uniqueID: deviceID) else {
            throw CaptureError.deviceNotFound
        }

        // 2. Create input
        let input = try AVCaptureDeviceInput(device: device)

        // 3. Create session
        session = AVCaptureSession()
        session.sessionPreset = .high
        session.addInput(input)

        // 4. Configure output
        output = AVCaptureVideoDataOutput()
        output.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        output.setSampleBufferDelegate(self, queue: captureQueue)
        session.addOutput(output)

        // 5. Start session
        session.startRunning()
    }

    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }

        // Send to PiP compositor
        webcamCallback(pixelBuffer)
    }
}
```

---

## FFI Integration

### Rust ↔ Swift Bridge

**Pattern:** C-compatible function pointers + JSON serialization

**Swift → Rust:**

```swift
// Swift: Define C-callable function
@_cdecl("screen_recorder_enumerate_displays")
public func screen_recorder_enumerate_displays() -> UnsafePointer<CChar>? {
    do {
        let displays = try await getShareableDisplays()
        let json = try JSONEncoder().encode(displays)
        let cString = String(data: json, encoding: .utf8)!.cString(using: .utf8)!
        let ptr = UnsafeMutablePointer<CChar>.allocate(capacity: cString.count)
        ptr.initialize(from: cString, count: cString.count)
        return UnsafePointer(ptr)
    } catch {
        return nil
    }
}
```

```rust
// Rust: Declare external function
extern "C" {
    fn screen_recorder_enumerate_displays() -> *const c_char;
}

// Rust: Call and deserialize
pub fn enumerate_displays() -> Result<Vec<DisplayInfo>, String> {
    unsafe {
        let ptr = screen_recorder_enumerate_displays();
        if ptr.is_null() {
            return Err("FFI returned null".into());
        }

        let c_str = CStr::from_ptr(ptr);
        let json = c_str.to_str().map_err(|e| format!("UTF-8 error: {}", e))?;
        let displays: Vec<DisplayInfo> = serde_json::from_str(json)
            .map_err(|e| format!("JSON error: {}", e))?;

        // Free Swift-allocated memory
        libc::free(ptr as *mut c_void);

        Ok(displays)
    }
}
```

### Type Definitions (Shared via JSON)

**Rust:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub display_id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}
```

**Swift:**
```swift
struct DisplayInfo: Codable {
    let displayId: String
    let name: String
    let width: Int
    let height: Int
    let isPrimary: Bool
}
```

**TypeScript:**
```typescript
interface DisplayInfo {
  displayId: string;
  name: string;
  width: number;
  height: number;
  isPrimary: boolean;
}
```

### Memory Management Rules

1. **Swift allocates, Rust frees**: For FFI strings (via `libc::free`)
2. **Rust allocates, JavaScript GCs**: For Tauri IPC (serialized JSON)
3. **No shared pointers**: Avoid Arc/Rc across FFI boundary
4. **Copy-on-return**: Always return owned data, never references

---

## Adding New Device Types

### Example: Adding MIDI Input Device Support

**1. Define Types (Rust)**

```rust
// src-tauri/src/types.rs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiDeviceInfo {
    pub device_id: String,
    pub device_name: String,
    pub manufacturer: String,
    pub is_input: bool,
}
```

**2. Add to Session Config**

```rust
// src/types.ts (TypeScript)
interface MidiConfig {
  deviceId?: string;
  channels: number[];  // Which MIDI channels to record
}

interface Session {
  // ... existing fields ...
  midiConfig?: MidiConfig;
}
```

**3. Create Service**

```typescript
// src/services/midiRecordingService.ts
class MidiRecordingService {
  async enumerateMidiDevices(): Promise<MidiDeviceInfo[]> {
    return await invoke('enumerate_midi_devices');
  }

  async startMidiRecording(config: MidiConfig): Promise<void> {
    return await invoke('start_midi_recording', { config });
  }

  async stopMidiRecording(): Promise<void> {
    return await invoke('stop_midi_recording');
  }
}

export const midiRecordingService = new MidiRecordingService();
```

**4. Implement Tauri Command (Rust)**

```rust
// src-tauri/src/midi_capture.rs
use midir::{MidiInput, MidiInputPort};

#[tauri::command]
pub fn enumerate_midi_devices() -> Result<Vec<MidiDeviceInfo>, String> {
    let midi_in = MidiInput::new("Taskerino MIDI")
        .map_err(|e| format!("MIDI error: {}", e))?;

    let ports = midi_in.ports();
    let devices = ports.iter().enumerate().map(|(i, port)| {
        MidiDeviceInfo {
            device_id: format!("midi_{}", i),
            device_name: midi_in.port_name(port).unwrap_or_default(),
            manufacturer: "Unknown".to_string(),
            is_input: true,
        }
    }).collect();

    Ok(devices)
}

#[tauri::command]
pub fn start_midi_recording(config: MidiConfig) -> Result<(), String> {
    // Implementation...
    Ok(())
}
```

**5. Register Command**

```rust
// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...
            enumerate_midi_devices,
            start_midi_recording,
            stop_midi_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**6. Add UI Components**

```typescript
// src/components/sessions/MidiDeviceSelector.tsx
export function MidiDeviceSelector({ ... }) {
  const [midiDevices, setMidiDevices] = useState<MidiDeviceInfo[]>([]);

  useEffect(() => {
    midiRecordingService.enumerateMidiDevices().then(setMidiDevices);
  }, []);

  return (
    <DeviceSelector
      type="midi"
      devices={midiDevices}
      // ...
    />
  );
}
```

**7. Update StartSessionModal**

Add MIDI section to the modal, persist config to session.

---

## Extending the Audio Mixer

### Adding Volume Normalization

**Current Limitation:** Audio levels not normalized, can clip or be too quiet.

**Solution:** Add AGC (Automatic Gain Control)

**Implementation (Rust):**

```rust
// src-tauri/src/audio_capture.rs
pub struct AudioMixBuffer {
    balance: Arc<Mutex<u8>>,
    target_sample_rate: u32,

    // NEW: AGC state
    mic_gain: Arc<Mutex<f32>>,      // Dynamic gain for mic
    system_gain: Arc<Mutex<f32>>,   // Dynamic gain for system
    target_level: f32,              // Target RMS level (e.g., -20dB)
}

impl AudioMixBuffer {
    fn apply_agc(&self, samples: &mut [f32], gain: &Arc<Mutex<f32>>) {
        // 1. Calculate RMS level
        let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();

        // 2. Calculate desired gain
        let desired_gain = self.target_level / rms.max(0.001);

        // 3. Smooth gain adjustment (attack/release)
        let mut current_gain = gain.lock().unwrap();
        let attack_rate = 0.1;   // Fast attack
        let release_rate = 0.01; // Slow release

        if desired_gain > *current_gain {
            *current_gain += (desired_gain - *current_gain) * attack_rate;
        } else {
            *current_gain += (desired_gain - *current_gain) * release_rate;
        }

        // 4. Apply gain with limiter
        let final_gain = current_gain.min(4.0); // Max 12dB boost
        for sample in samples.iter_mut() {
            *sample = (*sample * final_gain).clamp(-1.0, 1.0);
        }
    }

    pub fn mix_samples(
        &self,
        mic_samples: &mut [f32],
        system_samples: &mut [f32],
        balance: u8,
    ) -> Result<Vec<f32>, String> {
        // Apply AGC to each source
        self.apply_agc(mic_samples, &self.mic_gain);
        self.apply_agc(system_samples, &self.system_gain);

        // Then mix as before
        // ...
    }
}
```

### Adding Noise Gate

**Purpose:** Remove background noise when not speaking.

```rust
struct NoiseGate {
    threshold: f32,     // RMS threshold (e.g., -50dB)
    attack: f32,        // How fast to open (ms)
    release: f32,       // How fast to close (ms)
    state: GateState,
}

enum GateState {
    Closed,
    Opening,
    Open,
    Closing,
}

impl NoiseGate {
    fn process(&mut self, samples: &mut [f32]) {
        let rms = (samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32).sqrt();

        // State machine
        match self.state {
            GateState::Closed if rms > self.threshold => {
                self.state = GateState::Opening;
            }
            GateState::Open if rms < self.threshold => {
                self.state = GateState::Closing;
            }
            _ => {}
        }

        // Apply fade in/out based on state
        let gain = match self.state {
            GateState::Closed | GateState::Closing => 0.0,
            GateState::Open => 1.0,
            GateState::Opening => 0.5, // Could use envelope
        };

        for sample in samples.iter_mut() {
            *sample *= gain;
        }
    }
}
```

---

## Debugging PiP Issues

### Common Issues

#### 1. PiP Overlay Not Visible

**Symptoms:** Screen recorded but webcam overlay missing.

**Debug Steps:**
1. Check logs for PiP compositor initialization:
   ```
   [PiPCompositor] Initialized with Metal device: Apple M1
   ```
2. Verify webcam is capturing:
   ```
   [WebcamCapture] Started capture on device: FaceTime HD Camera
   ```
3. Check frame synchronization:
   ```
   [PiPCompositor] Frame count: screen=120, webcam=119 (within tolerance)
   ```

**Potential Causes:**
- Webcam buffer not arriving (check `webcamCallback`)
- Metal device creation failed (no GPU)
- PiP position outside screen bounds

**Fix:**
```swift
// Add defensive checks
func composite(screenBuffer: CVPixelBuffer, webcamBuffer: CVPixelBuffer?) -> CVPixelBuffer {
    guard let webcam = webcamBuffer else {
        // No webcam frame available, return screen-only
        return screenBuffer
    }

    // Validate position is within bounds
    let origin = position.calculateOrigin(...)
    guard origin.x >= 0 && origin.y >= 0 else {
        print("[PiPCompositor] ERROR: Invalid origin \(origin)")
        return screenBuffer
    }

    // Continue composition...
}
```

#### 2. PiP Performance Issues / Dropped Frames

**Symptoms:** Video stutters, frame rate drops below target.

**Debug Steps:**
1. Enable performance logging:
   ```swift
   // In PiPCompositor.swift
   private func logPerformanceMetrics() {
       let now = Date()
       if now.timeIntervalSince(lastLogTime) > 5.0 {
           let fps = Double(frameCount) / 5.0
           print("[PiPCompositor] FPS: \(fps), Dropped: \(droppedFrames)")
           frameCount = 0
           droppedFrames = 0
           lastLogTime = now
       }
   }
   ```
2. Profile with Instruments:
   - Xcode → Product → Profile → Time Profiler
   - Look for bottlenecks in `composite()` function

**Potential Causes:**
- CPU-side rendering instead of GPU
- Pixel buffer pool exhausted (allocating on-demand)
- Excessive Core Image filter chain

**Fix:**
```swift
// 1. Ensure Metal backend
guard let device = MTLCreateSystemDefaultDevice() else {
    fatalError("No Metal device available")
}
let ciContext = CIContext(mtlDevice: device, options: [
    .cacheIntermediates: false,  // Reduce memory usage
    .workingColorSpace: NSNull(), // Don't color-manage (faster)
])

// 2. Pre-allocate pixel buffer pool
let poolAttributes: [String: Any] = [
    kCVPixelBufferPoolMinimumBufferCountKey as String: 3
]
CVPixelBufferPoolCreate(
    nil,
    poolAttributes as CFDictionary,
    pixelBufferAttributes as CFDictionary,
    &outputBufferPool
)

// 3. Simplify filter chain
let maskedWebcam = scaledWebcam.clampedToExtent()
    .cropped(to: CGRect(origin: .zero, size: pipSize))
    .applyingFilter("CIMaskToAlpha", parameters: [
        "inputImage": roundedMask
    ])
```

#### 3. PiP Aspect Ratio Distorted

**Symptoms:** Webcam feed appears stretched or squashed.

**Debug Steps:**
1. Log webcam and PiP dimensions:
   ```swift
   print("Webcam: \(webcamImage.extent.size)")
   print("PiP size: \(pipSize)")
   print("Scale: \(scaleX) x \(scaleY)")
   ```

**Fix:** Use aspect-fit scaling instead of fill:
```swift
func scaleToFit(image: CIImage, targetSize: CGSize) -> CIImage {
    let imageSize = image.extent.size
    let scaleX = targetSize.width / imageSize.width
    let scaleY = targetSize.height / imageSize.height
    let scale = min(scaleX, scaleY) // Aspect-fit (not fill)

    return image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
}
```

---

## Performance Optimization

### Profiling Tools

1. **Instruments (macOS):**
   - Time Profiler: CPU bottlenecks
   - Allocations: Memory leaks
   - Metal System Trace: GPU performance
   - Energy Log: Battery impact

2. **Rust Profiling:**
   ```bash
   cargo install flamegraph
   cargo flamegraph --bin taskerino
   ```

3. **Chrome DevTools (Frontend):**
   - Performance tab: React render times
   - Memory tab: JS heap usage

### Optimization Checklist

#### Audio (Rust)

- [x] Use ARM NEON intrinsics for mixing (optional)
- [x] Ring buffer for sample alignment
- [x] Minimize allocations (reuse buffers)
- [x] Target sample rate: 16kHz (not 48kHz)
- [ ] Optional: Use `rayon` for parallel processing

**NEON Example (ARM-specific):**
```rust
#[cfg(target_arch = "aarch64")]
use std::arch::aarch64::*;

#[cfg(target_arch = "aarch64")]
unsafe fn mix_neon(mic: &[f32], sys: &[f32], balance: f32) -> Vec<f32> {
    let mic_gain = 1.0 - balance;
    let sys_gain = balance;

    let mic_gain_vec = vdupq_n_f32(mic_gain);
    let sys_gain_vec = vdupq_n_f32(sys_gain);

    let mut output = vec![0.0f32; mic.len()];

    for i in (0..mic.len()).step_by(4) {
        let mic_vec = vld1q_f32(mic.as_ptr().add(i));
        let sys_vec = vld1q_f32(sys.as_ptr().add(i));

        let mic_scaled = vmulq_f32(mic_vec, mic_gain_vec);
        let sys_scaled = vmulq_f32(sys_vec, sys_gain_vec);
        let mixed = vaddq_f32(mic_scaled, sys_scaled);

        vst1q_f32(output.as_mut_ptr().add(i), mixed);
    }

    output
}
```

#### Video (Swift + Metal)

- [x] Metal for GPU acceleration
- [x] Pixel buffer pools
- [x] Minimize filter chain
- [ ] Use lower-level Metal shaders instead of Core Image

**Custom Metal Shader Example:**
```metal
// PiPShader.metal
#include <metal_stdlib>
using namespace metal;

struct VertexOut {
    float4 position [[position]];
    float2 texCoord;
};

fragment float4 pip_fragment(
    VertexOut in [[stage_in]],
    texture2d<float> screenTexture [[texture(0)]],
    texture2d<float> webcamTexture [[texture(1)]],
    constant float2& pipPosition [[buffer(0)]],
    constant float2& pipSize [[buffer(1)]]
) {
    constexpr sampler textureSampler(mag_filter::linear, min_filter::linear);

    // Sample screen
    float4 screenColor = screenTexture.sample(textureSampler, in.texCoord);

    // Check if in PiP region
    float2 coord = in.texCoord;
    if (coord.x >= pipPosition.x && coord.x <= pipPosition.x + pipSize.x &&
        coord.y >= pipPosition.y && coord.y <= pipPosition.y + pipSize.y) {
        // Sample webcam
        float2 webcamCoord = (coord - pipPosition) / pipSize;
        float4 webcamColor = webcamTexture.sample(textureSampler, webcamCoord);
        return webcamColor;
    }

    return screenColor;
}
```

#### Frontend (React)

- [x] Memoize device change handlers (`useCallback`)
- [x] Derive state with `useMemo`
- [x] Lazy load heavy components
- [ ] Virtualize long device lists (if >100 devices)

---

## Testing Strategy

### Unit Tests

**Audio Mixing (Rust):**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mix_balance_0_is_mic_only() {
        let mixer = AudioMixBuffer::new(0);
        let mic = vec![1.0, 1.0, 1.0];
        let sys = vec![0.5, 0.5, 0.5];

        let result = mixer.mix_samples(&mic, 16000, &sys, 16000).unwrap();
        assert_eq!(result, mic);
    }

    #[test]
    fn test_mix_balance_100_is_system_only() {
        let mixer = AudioMixBuffer::new(100);
        let mic = vec![1.0, 1.0, 1.0];
        let sys = vec![0.5, 0.5, 0.5];

        let result = mixer.mix_samples(&mic, 16000, &sys, 16000).unwrap();
        assert_eq!(result, sys);
    }

    #[test]
    fn test_resampling() {
        // Test 48kHz → 16kHz resampling
        let input = vec![1.0; 4800]; // 0.1s at 48kHz
        let output = resample(&input, 48000, 16000).unwrap();
        assert_eq!(output.len(), 1600); // 0.1s at 16kHz
    }
}
```

**PiP Compositor (Swift):**
```swift
// ScreenRecorder/Tests/PiPCompositorTests.swift
import XCTest
@testable import ScreenRecorder

class PiPCompositorTests: XCTestCase {
    func testPositionCalculation() {
        let screenSize = CGSize(width: 1920, height: 1080)
        let pipSize = CGSize(width: 320, height: 240)
        let margin: CGFloat = 20

        // Bottom-right
        let brOrigin = PiPPosition.bottomRight.calculateOrigin(
            screenSize: screenSize,
            pipSize: pipSize,
            margin: margin
        )
        XCTAssertEqual(brOrigin.x, 1580) // 1920 - 320 - 20
        XCTAssertEqual(brOrigin.y, 20)
    }

    func testAspectRatioPreservation() {
        // TODO: Verify scaled webcam maintains 16:9 or 4:3
    }
}
```

### Integration Tests

**End-to-End Recording Flow:**
```typescript
// tests/integration/recording.test.ts
describe('Recording Flow', () => {
  it('should start and stop audio recording', async () => {
    // 1. Start session
    const session = await sessionsContext.startSession({
      name: 'Test Session',
      audioRecording: true,
      audioConfig: { micDeviceId: 'default', sourceType: 'microphone' }
    });

    // 2. Verify recording started
    await waitFor(() => {
      expect(session.status).toBe('active');
    });

    // 3. Wait 5 seconds
    await sleep(5000);

    // 4. Stop session
    await sessionsContext.endSession(session.id);

    // 5. Verify audio file exists
    const audioSegments = session.audioSegments;
    expect(audioSegments.length).toBeGreaterThan(0);
    expect(audioSegments[0].attachmentId).toBeTruthy();
  });
});
```

### Manual QA Test Plan

**Audio Recording:**
- [ ] Enumerate devices (mic, system audio)
- [ ] Record mic-only for 30s
- [ ] Record system-only for 30s
- [ ] Record both with balance 0/25/50/75/100
- [ ] Change balance mid-recording
- [ ] Hot-swap mic device
- [ ] Disconnect device during recording → fallback to default
- [ ] Test audio button shows levels
- [ ] Verify WAV file plays in VLC

**Video Recording:**
- [ ] Enumerate displays/windows/webcams
- [ ] Record single display
- [ ] Record multi-display (2+ monitors)
- [ ] Record specific window
- [ ] Record webcam-only
- [ ] Record display + PiP at all 4 positions
- [ ] Record display + PiP at all 3 sizes
- [ ] Change PiP position mid-recording
- [ ] Hot-swap display
- [ ] Verify MP4 file plays in VLC

**Performance:**
- [ ] CPU <15% during full recording (Activity Monitor)
- [ ] GPU <20% during PiP (Metal HUD)
- [ ] Memory <200MB (Instruments)
- [ ] No thermal throttling on M1 Air (1-hour test)
- [ ] Battery drain <25%/hour

**Error Handling:**
- [ ] No permissions → helpful error message
- [ ] Invalid device ID → fallback to default
- [ ] Disk full → graceful error
- [ ] App crash → session recoverable

---

## Appendix: File Reference

### TypeScript Files
- `src/types.ts` - Type definitions
- `src/components/sessions/StartSessionModal.tsx`
- `src/components/sessions/ActiveSessionMediaControls.tsx`
- `src/components/sessions/DeviceSelector.tsx`
- `src/components/sessions/AudioBalanceSlider.tsx`
- `src/components/sessions/WebcamModeSelector.tsx`
- `src/components/sessions/DisplayMultiSelect.tsx`
- `src/services/audioRecordingService.ts`
- `src/services/videoRecordingService.ts`

### Rust Files
- `src-tauri/src/types.rs` - Shared types
- `src-tauri/src/audio_capture.rs` - Audio system
- `src-tauri/src/macos_audio.rs` - System audio (macOS)
- `src-tauri/src/video_recording.rs` - Video system
- `src-tauri/src/lib.rs` - Tauri command registration

### Swift Files
- `src-tauri/ScreenRecorder/ScreenRecorder.swift` - Screen + audio capture
- `src-tauri/ScreenRecorder/PiPCompositor.swift` - PiP overlay

---

**Last Updated:** 2025-01-23
**Taskerino Version:** 2.0
