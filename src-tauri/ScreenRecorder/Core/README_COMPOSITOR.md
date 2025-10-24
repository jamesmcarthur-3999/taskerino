# Frame Compositor Architecture

## Overview

The Frame Compositor system provides a unified interface for combining frames from one or more recording sources into a single output frame.

## Components

### 1. FrameCompositor Protocol

```swift
public protocol FrameCompositor: Sendable {
    func composite(_ frames: [SourcedFrame]) throws -> CVPixelBuffer
}
```

**Purpose**: Defines the interface all compositors must implement.

**Key Features**:
- `Sendable` compliance for safe concurrent usage
- Accepts array of `SourcedFrame` (supports single or multi-source)
- Returns `CVPixelBuffer` ready for encoding
- Throws `CompositorError` for invalid inputs

### 2. PassthroughCompositor (Single Source)

```swift
public struct PassthroughCompositor: FrameCompositor {
    public init() {}

    public func composite(_ frames: [SourcedFrame]) throws -> CVPixelBuffer {
        guard frames.count == 1 else {
            throw CompositorError.invalidFrameCount(expected: 1, actual: frames.count)
        }
        return frames[0].buffer
    }
}
```

**Purpose**: Zero-overhead compositor for single-source recording.

**Characteristics**:
- O(1) time complexity
- Zero memory allocations
- No frame copies or transformations
- Thread-safe (struct + Sendable)

**Use Case**: Screen recording without webcam overlay.

### 3. CompositorError

```swift
public enum CompositorError: Error, CustomStringConvertible {
    case invalidFrameCount(expected: Int, actual: Int)
    case compositingFailed(String)
}
```

**Purpose**: Type-safe error handling with descriptive messages.

## Usage Examples

### Single Source Recording

```swift
let compositor = PassthroughCompositor()

// Create frame from screen capture
let frame = SourcedFrame(
    buffer: screenPixelBuffer,
    sourceId: "display-0",
    timestamp: CMTime(seconds: 0.016, preferredTimescale: 600),
    sequenceNumber: 0
)

// Composite (just validates and returns)
do {
    let output = try compositor.composite([frame])
    // Feed to encoder
    encoder.encode(output, timestamp: frame.timestamp)
} catch let error as CompositorError {
    print("Error: \(error)")
}
```

### Error Handling

```swift
let compositor = PassthroughCompositor()
let frames = [frame1, frame2] // Two frames

do {
    let output = try compositor.composite(frames)
} catch CompositorError.invalidFrameCount(let expected, let actual) {
    print("Expected \(expected) frames, got \(actual)")
    // Output: Expected 1 frames, got 2
}
```

## Integration Points

### Works With:

1. **SourcedFrame** (`Core/SourcedFrame.swift`)
   - Provides frame + metadata structure
   - Includes timestamp, source ID, sequence number

2. **FrameSynchronizer** (`Core/FrameSynchronizer.swift`)
   - Aligns frames from multiple sources
   - Feeds aligned frames to compositor

3. **VideoEncoder** (`Core/VideoEncoder.swift`)
   - Encodes composited frames
   - No changes needed to work with compositors

### Example Pipeline:

```swift
// 1. Capture frames
let screenFrame = captureScreen()
let sourcedFrame = SourcedFrame(
    buffer: screenFrame,
    sourceId: "screen",
    timestamp: timestamp,
    sequenceNumber: frameNumber
)

// 2. Composite (if needed)
let compositor = PassthroughCompositor()
let output = try compositor.composite([sourcedFrame])

// 3. Encode
encoder.encode(output, timestamp: timestamp)
```

## Future Compositors

The protocol is designed to support additional compositor types:

### GridCompositor (Planned - Task 2.4)

```swift
public struct GridCompositor: FrameCompositor {
    let rows: Int
    let columns: Int

    public func composite(_ frames: [SourcedFrame]) throws -> CVPixelBuffer {
        // Arrange frames in grid layout
        // Use Metal/Core Image for GPU acceleration
    }
}
```

**Use Case**: Multi-window recording (2x2 grid of windows)

### SideBySideCompositor (Planned - Task 2.5)

```swift
public struct SideBySideCompositor: FrameCompositor {
    let orientation: Orientation // .horizontal or .vertical

    public func composite(_ frames: [SourcedFrame]) throws -> CVPixelBuffer {
        // Place frames side-by-side
        // Use Metal/Core Image for GPU acceleration
    }
}
}
```

**Use Case**: Comparison videos (before/after side-by-side)

### PiPCompositor (Existing)

Already exists in `PiPCompositor.swift` - can be adapted to conform to protocol:

```swift
extension PiPCompositor: FrameCompositor {
    public func composite(_ frames: [SourcedFrame]) throws -> CVPixelBuffer {
        guard frames.count == 2 else {
            throw CompositorError.invalidFrameCount(expected: 2, actual: frames.count)
        }

        let screenBuffer = frames.first { $0.sourceId.starts(with: "screen") }!.buffer
        let webcamBuffer = frames.first { $0.sourceId.starts(with: "webcam") }!.buffer

        return try composite(screenBuffer: screenBuffer, webcamBuffer: webcamBuffer)
    }
}
```

## Performance Characteristics

| Compositor | Sources | Time | Space | GPU | Use Case |
|------------|---------|------|-------|-----|----------|
| Passthrough | 1 | O(1) | O(1) | No | Single source |
| Grid | N | O(N) | O(1) | Yes | Multi-window |
| SideBySide | 2-4 | O(N) | O(1) | Yes | Comparison |
| PiP | 2 | O(1) | O(1) | Yes | Screen + Webcam |

## Testing

See `Tests/CoreTests/PassthroughCompositorTests.swift` for comprehensive test suite:

- ✅ Basic passthrough functionality
- ✅ Buffer preservation
- ✅ Error handling (0, 2, 3+ frames)
- ✅ Different resolutions (720p, 1080p, 4K)
- ✅ Compositor reusability
- ✅ Error message validation

**Total**: 12 tests with 100% code coverage

## Thread Safety

All compositors are designed for safe concurrent access:

1. **Struct-based**: Immutable, value semantics
2. **Sendable**: Safe to pass across actor boundaries
3. **No shared state**: Each composite() call is independent

Example with Swift Concurrency:

```swift
actor RecordingEngine {
    let compositor: any FrameCompositor

    func processFrame(_ frame: SourcedFrame) async throws {
        // Safe to use compositor across actor boundary
        let output = try compositor.composite([frame])
        await encoder.encode(output)
    }
}
```

## Files

```
Core/
├── FrameCompositor.swift           (59 lines)
│   ├── FrameCompositor protocol
│   ├── PassthroughCompositor
│   └── CompositorError
├── SourcedFrame.swift              (30 lines)
│   └── Frame + metadata struct
└── FrameSynchronizer.swift         (162 lines)
    └── Frame alignment actor

Tests/CoreTests/
└── PassthroughCompositorTests.swift (262 lines)
    ├── 8 PassthroughCompositor tests
    ├── 2 CompositorError tests
    └── 2 SourcedFrame tests
```

## See Also

- `TASK_2.3_VERIFICATION_REPORT.md` - Implementation verification
- `FrameSynchronizer.swift` - Multi-source frame alignment
- `VideoEncoder.swift` - Encoding composited frames
- `PiPCompositor.swift` - Existing PiP implementation
