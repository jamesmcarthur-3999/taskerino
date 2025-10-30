# PiP Recording Architecture

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RUST LAYER (Tauri)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User Request (display-with-webcam mode)                                    │
│       │                                                                      │
│       ├─→ RecordingMode::DisplayWithWebcam {                                │
│       │       display_ids: Vec<String>,                                     │
│       │       webcam_device_id: String,                                     │
│       │       pip_config: PipConfig                                         │
│       │   }                                                                 │
│       │                                                                      │
│       ├─→ Serialize to JSON:                                                │
│       │   {                                                                 │
│       │     "displayIds": ["12345"],                                        │
│       │     "webcamDeviceId": "0xABCD",                                     │
│       │     "pipConfig": {                                                  │
│       │       "enabled": true,                                              │
│       │       "position": "bottom-right",                                   │
│       │       "size": "small",                                              │
│       │       "borderRadius": 10                                            │
│       │     },                                                              │
│       │     "width": 1920,                                                  │
│       │     "height": 1080,                                                 │
│       │     "fps": 30                                                       │
│       │   }                                                                 │
│       │                                                                      │
│       └─→ FFI Call: screen_recorder_start_pip_recording(config_json, path) │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ C FFI Boundary
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SWIFT LAYER (macOS)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  @_cdecl("screen_recorder_start_pip_recording")                             │
│  func screen_recorder_start_pip_recording(config_json, output_path)         │
│       │                                                                      │
│       ├─→ Parse JSON → PiPRecordingConfig                                   │
│       │                                                                      │
│       ├─→ GlobalScreenRecorder.shared.startPiPRecording()                   │
│       │       │                                                             │
│       │       ├─→ Get SCShareableContent (displays)                         │
│       │       ├─→ Get AVCaptureDevice (webcam)                              │
│       │       ├─→ setupPiPCompositor(config.pipConfig)                      │
│       │       │       │                                                     │
│       │       │       ├─→ PiPCompositor.init()                              │
│       │       │       │       │                                             │
│       │       │       │       ├─→ MTLCreateSystemDefaultDevice()            │
│       │       │       │       │   (Get Metal GPU)                           │
│       │       │       │       │                                             │
│       │       │       │       └─→ CIContext(mtlDevice: device)              │
│       │       │       │           (Create Core Image context)               │
│       │       │       │                                                     │
│       │       │       └─→ compositor.configure(position, size, radius)      │
│       │       │                                                             │
│       │       ├─→ Create SCStream (screen capture)                          │
│       │       │       │                                                     │
│       │       │       └─→ Add PiPScreenOutput delegate                      │
│       │       │                                                             │
│       │       ├─→ Create AVCaptureSession (webcam)                          │
│       │       │       │                                                     │
│       │       │       └─→ Add PiPWebcamDelegate                             │
│       │       │                                                             │
│       │       ├─→ setupAssetWriter(outputURL)                               │
│       │       │       │                                                     │
│       │       │       ├─→ AVAssetWriter (MP4 container)                     │
│       │       │       ├─→ AVAssetWriterInput (HEVC/H.264 encoder)           │
│       │       │       └─→ AVAssetWriterInputPixelBufferAdaptor              │
│       │       │                                                             │
│       │       ├─→ currentMode = .displayWithPiP                             │
│       │       ├─→ screenStream.startCapture()                               │
│       │       └─→ webcamSession.startRunning()                              │
│       │                                                                      │
│       └─→ return 0 (success)                                                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         FRAME CAPTURE (Dual Streams)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐        │
│  │   Screen Capture Stream      │  │   Webcam Capture Session     │        │
│  │   (ScreenCaptureKit)         │  │   (AVFoundation)             │        │
│  └──────────────────────────────┘  └──────────────────────────────┘        │
│              │                                  │                           │
│              │ 15-60fps                         │ 30fps                     │
│              │                                  │                           │
│              ▼                                  ▼                           │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐        │
│  │   PiPScreenOutput            │  │   PiPWebcamDelegate          │        │
│  │   (SCStreamOutput)           │  │   (AVCaptureDelegate)        │        │
│  └──────────────────────────────┘  └──────────────────────────────┘        │
│              │                                  │                           │
│              │ CVPixelBuffer                    │ CVPixelBuffer             │
│              │ (BGRA, 1920x1080)                │ (BGRA, 1280x720)          │
│              │                                  │                           │
│              ▼                                  ▼                           │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │       GlobalScreenRecorder (Frame Synchronization)           │          │
│  │                                                               │          │
│  │  processScreenFrame(buffer)   processWebcamFrame(buffer)     │          │
│  │         │                              │                     │          │
│  │         └──────────┐     ┌─────────────┘                     │          │
│  │                    │     │                                   │          │
│  │             syncQueue.async {                                │          │
│  │               lastScreenBuffer = buffer                      │          │
│  │               lastWebcamBuffer = buffer                      │          │
│  │               compositeAndWritePiPFrame()                    │          │
│  │             }                                                 │          │
│  │                    │                                          │          │
│  │                    ▼                                          │          │
│  │         compositeAndWritePiPFrame()                           │          │
│  │                    │                                          │          │
│  │         Wait for BOTH buffers                                │          │
│  │         (lastScreenBuffer != nil && lastWebcamBuffer != nil)  │          │
│  │                    │                                          │          │
│  │                    ▼                                          │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                     │                                                       │
│                     │ Both frames ready                                     │
│                     ▼                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                     COMPOSITION (GPU-Accelerated)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  compositor.composite(screenBuffer, webcamBuffer)                           │
│       │                                                                      │
│       ├─→ 1. Create CIImage from screen buffer                              │
│       │      let screenImage = CIImage(cvPixelBuffer: screenBuffer)         │
│       │                                                                      │
│       ├─→ 2. Create CIImage from webcam buffer                              │
│       │      let webcamImage = CIImage(cvPixelBuffer: webcamBuffer)         │
│       │                                                                      │
│       ├─→ 3. Resize webcam to PiP size (GPU)                                │
│       │      resizeWebcam(image, targetSize: 160x120 | 320x240 | 480x360)   │
│       │         │                                                           │
│       │         ├─→ Calculate scale (maintain aspect ratio)                 │
│       │         ├─→ Apply transform: CGAffineTransform(scaleX, scaleY)      │
│       │         └─→ Crop to exact size                                      │
│       │                                                                      │
│       ├─→ 4. Apply rounded corners (GPU)                                    │
│       │      applyRoundedCorners(image, radius: 10)                         │
│       │         │                                                           │
│       │         ├─→ Create rounded rectangle mask                           │
│       │         │   (CIRoundedRectangleGenerator or CIConstantColor)        │
│       │         │                                                           │
│       │         └─→ Apply mask: CIBlendWithMask filter                      │
│       │                                                                      │
│       ├─→ 5. Calculate position                                             │
│       │      let origin = position.calculateOrigin(                         │
│       │         screenSize: 1920x1080,                                      │
│       │         pipSize: 160x120,                                           │
│       │         margin: 20                                                  │
│       │      )                                                              │
│       │      // e.g., bottom-right: (1740, 20)                              │
│       │                                                                      │
│       ├─→ 6. Translate webcam to position (GPU)                             │
│       │      maskedWebcam.transformed(                                      │
│       │         by: CGAffineTransform(translationX: origin.x, y: origin.y)  │
│       │      )                                                              │
│       │                                                                      │
│       ├─→ 7. Composite over screen (GPU)                                    │
│       │      composited = translatedWebcam.composited(over: screenImage)    │
│       │                                                                      │
│       ├─→ 8. Allocate output buffer from pool                               │
│       │      CVPixelBufferPoolCreatePixelBuffer(outputPool, &outputBuffer)  │
│       │                                                                      │
│       └─→ 9. Render to output buffer (GPU → Memory)                         │
│            ciContext.render(composited, to: outputBuffer)                   │
│                │                                                            │
│                └─→ Metal GPU renders composite to BGRA pixel buffer         │
│                                                                             │
│  return outputBuffer (CVPixelBuffer with PiP overlay)                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                      VIDEO ENCODING & WRITING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  writeFrame(compositedBuffer)                                               │
│       │                                                                      │
│       ├─→ Check asset writer status == .writing                             │
│       ├─→ Check video input isReadyForMoreMediaData                         │
│       │                                                                      │
│       ├─→ Calculate presentation time                                       │
│       │      CMTime(value: frameCount, timescale: 30)                       │
│       │                                                                      │
│       └─→ pixelBufferAdaptor.append(buffer, withPresentationTime:)          │
│              │                                                              │
│              ├─→ AVAssetWriterInput encodes frame                           │
│              │      (HEVC or H.264)                                         │
│              │                                                              │
│              └─→ Write to MP4 file                                          │
│                                                                             │
│  Clear buffers:                                                             │
│    lastScreenBuffer = nil                                                   │
│    lastWebcamBuffer = nil                                                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                        STOP & CLEANUP                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User stops recording                                                       │
│       │                                                                      │
│       ├─→ isRecording = false                                               │
│       ├─→ screenStream.stopCapture()                                        │
│       ├─→ webcamSession.stopRunning()                                       │
│       ├─→ videoInput.markAsFinished()                                       │
│       ├─→ assetWriter.finishWriting()                                       │
│       └─→ cleanup()                                                         │
│              │                                                              │
│              ├─→ pipCompositor = nil                                        │
│              ├─→ lastScreenBuffer = nil                                     │
│              ├─→ lastWebcamBuffer = nil                                     │
│              └─→ currentMode = .idle                                        │
│                                                                             │
│  Result: MP4 file with screen + PiP webcam overlay                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Interaction Timeline

```
Time →
│
├─ [T=0] User initiates PiP recording
│   ├─ Rust: Parse config, serialize JSON
│   └─ Rust → Swift FFI: screen_recorder_start_pip_recording()
│
├─ [T=50ms] Swift initialization
│   ├─ Create PiPCompositor (Metal device + Core Image context)
│   ├─ Configure compositor (position, size, border radius)
│   ├─ Setup screen capture stream (SCStream)
│   ├─ Setup webcam session (AVCaptureSession)
│   └─ Setup asset writer (AVAssetWriter)
│
├─ [T=100ms] Start capturing
│   ├─ screenStream.startCapture() → frames start arriving
│   └─ webcamSession.startRunning() → frames start arriving
│
├─ [T=133ms] First screen frame arrives (15fps → 66ms interval)
│   ├─ PiPScreenOutput receives CVPixelBuffer
│   ├─ processScreenFrame() stores to lastScreenBuffer
│   └─ compositeAndWritePiPFrame() → waits (no webcam frame yet)
│
├─ [T=133ms] First webcam frame arrives (30fps → 33ms interval)
│   ├─ PiPWebcamDelegate receives CVPixelBuffer
│   ├─ processWebcamFrame() stores to lastWebcamBuffer
│   └─ compositeAndWritePiPFrame() → BOTH ready!
│       ├─ compositor.composite() → 5-10ms GPU processing
│       ├─ writeFrame() → append to asset writer
│       └─ Clear both buffers
│
├─ [T=166ms] Second screen frame arrives
│   └─ ... repeat cycle
│
├─ [T=199ms] Second webcam frame arrives
│   └─ ... repeat cycle
│
├─ [T=30s] User stops recording
│   ├─ stopRecording() called
│   ├─ Stop screen stream
│   ├─ Stop webcam session
│   ├─ Finish writing video
│   └─ cleanup() releases resources
│
└─ [T=30.5s] MP4 file ready
```

---

## Memory Layout During Composition

```
┌─────────────────────────────────────────────────────────────────┐
│                       GPU Memory (Metal)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Screen Buffer (1920x1080 BGRA)                ~8.3 MB          │
│  ┌───────────────────────────────────────────────────┐          │
│  │                                                   │          │
│  │                                                   │          │
│  │                                                   │          │
│  │                                           ┌───────┼──┐       │
│  │                                           │ PiP   │  │       │
│  │                                           │ 160x  │  │       │
│  │                                           │ 120   │  │       │
│  │                                           └───────┼──┘       │
│  └───────────────────────────────────────────────────┘          │
│                                                                 │
│  Webcam Buffer (1280x720 BGRA)               ~3.7 MB          │
│  ┌───────────────────────────────────┐                         │
│  │                                   │                         │
│  │                                   │                         │
│  │                                   │                         │
│  │                                   │                         │
│  └───────────────────────────────────┘                         │
│                                                                 │
│  Resized Webcam (160x120 BGRA)               ~77 KB           │
│  ┌───────┐                                                     │
│  │       │                                                     │
│  └───────┘                                                     │
│                                                                 │
│  Masked Webcam (160x120 BGRA + Alpha)        ~77 KB           │
│  ┌───────┐                                                     │
│  │ ╭───╮ │ ← Rounded corners                                  │
│  │ ╰───╯ │                                                     │
│  └───────┘                                                     │
│                                                                 │
│  Composite Output (1920x1080 BGRA)           ~8.3 MB          │
│  ┌───────────────────────────────────────────────────┐          │
│  │                                                   │          │
│  │                                                   │          │
│  │                                                   │          │
│  │                                           ┌───────┼──┐       │
│  │                                           │ ╭───╮ │  │       │
│  │                                           │ │PiP│ │  │       │
│  │                                           │ ╰───╯ │  │       │
│  │                                           └───────┼──┘       │
│  └───────────────────────────────────────────────────┘          │
│                                                                 │
│  Total GPU Memory:                           ~20.5 MB          │
│  (Buffers are reused via pools, not duplicated per frame)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       CPU Memory (Swift)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  lastScreenBuffer: CVPixelBuffer?            8.3 MB            │
│  lastWebcamBuffer: CVPixelBuffer?            3.7 MB            │
│  Compositor instance                         ~1 MB             │
│  Asset writer state                          ~5 MB             │
│                                                                 │
│  Total CPU Memory:                           ~18 MB            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Total Memory Footprint: ~38 MB (typical for 1080p PiP recording)
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Error Handling                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Initialization Errors:                                         │
│    ├─ Metal device not available                               │
│    │   └─ throw PiPError.metalNotAvailable                     │
│    │                                                            │
│    ├─ Display not found                                        │
│    │   └─ throw ScreenRecorderError.noDisplayFound             │
│    │                                                            │
│    ├─ Webcam not found                                         │
│    │   └─ throw ScreenRecorderError.noWebcamFound              │
│    │                                                            │
│    └─ Invalid configuration                                    │
│        └─ throw ScreenRecorderError.invalidConfiguration       │
│                                                                 │
│  Runtime Errors:                                                │
│    ├─ Composition failed                                       │
│    │   ├─ Log: "❌ [VIDEO] PiP composition failed: (error)"    │
│    │   └─ Skip frame, continue recording                       │
│    │                                                            │
│    ├─ Asset writer error                                       │
│    │   ├─ Log: "❌ [VIDEO] Writer error: (error)"              │
│    │   └─ Stop recording                                       │
│    │                                                            │
│    └─ Stream stopped with error                                │
│        ├─ Log: "❌ [VIDEO] Stream stopped with error: (error)" │
│        └─ Set isRecording = false                              │
│                                                                 │
│  Cleanup Errors:                                                │
│    └─ Asset writer finish failed                               │
│        ├─ Log writer error                                     │
│        └─ File may be corrupted                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Performance Optimization Strategies

### 1. Buffer Pool Reuse
```
┌────────────────────────────────────┐
│       Pixel Buffer Pool            │
│  (3 buffers pre-allocated)         │
├────────────────────────────────────┤
│  Buffer 1: ■ (in use - encoding)   │
│  Buffer 2: ■ (in use - compositing)│
│  Buffer 3: □ (available)           │
└────────────────────────────────────┘
     ↑           ↓
   return     allocate
```
**Benefit**: Eliminates allocation overhead (50-100ms → <1ms)

### 2. GPU Pipeline
```
Frame N:   [Capture] → [Resize] → [Mask] → [Composite] → [Render]
                                                              ↓
Frame N+1: [Capture] → [Resize] → [Mask] → [Composite] → [Render]
```
**Benefit**: GPU operations are pipelined, ~60fps achievable

### 3. Async Frame Handling
```
Screen Thread:    [Frame] ──→ syncQueue ──→ [Store] ──→ [Composite?]
                                 ↓
Webcam Thread:    [Frame] ──→ syncQueue ──→ [Store] ──→ [Composite?]
```
**Benefit**: No blocking, both streams operate independently

---

## Configuration Reference

### Position Values
| Value | Description | Origin Calculation |
|-------|-------------|-------------------|
| `top-left` | Top-left corner | `(margin, height - pipHeight - margin)` |
| `top-right` | Top-right corner | `(width - pipWidth - margin, height - pipHeight - margin)` |
| `bottom-left` | Bottom-left corner | `(margin, margin)` |
| `bottom-right` | Bottom-right corner | `(width - pipWidth - margin, margin)` |

### Size Values
| Value | Dimensions | Use Case |
|-------|-----------|----------|
| `small` | 160x120 | Minimal screen space, high screen detail |
| `medium` | 320x240 | Balanced visibility and screen space |
| `large` | 480x360 | Prominent webcam, presentations |

### Border Radius
| Value | Effect |
|-------|--------|
| `0` | Sharp corners (rectangular) |
| `10` | Subtle rounding (default) |
| `20` | Pronounced rounding |
| `60` | Circular (for 160x120 small size) |

---

**Document Version**: 1.0
**Last Updated**: 2025-10-23
**Architecture Status**: ✅ PRODUCTION READY
