# Sessions System Architecture Specification

This document provides technical specifications for the Sessions Rewrite project.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Models](#data-models)
3. [State Machines](#state-machines)
4. [Storage Architecture](#storage-architecture)
5. [Recording Pipeline](#recording-pipeline)
6. [Enrichment Pipeline](#enrichment-pipeline)
7. [Review System](#review-system)
8. [API Specifications](#api-specifications)

---

## System Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              User Interface Layer (React)                   │
│  SessionsZone.tsx → SessionListContext + ActiveSessionContext│
└─────────────────────────────────────────────────────────────┘
                          ↓ Tauri IPC
┌─────────────────────────────────────────────────────────────┐
│          Business Logic Layer (Rust + TypeScript)           │
│  RecordingCoordinator → VideoStream, AudioGraph, Screenshots│
└─────────────────────────────────────────────────────────────┘
                          ↓ FFI
┌─────────────────────────────────────────────────────────────┐
│           Native Recording Layer (Swift + Rust)             │
│  RecordingSession → Sources → Compositor → Encoder          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Storage Layer (IndexedDB / FileSystem)         │
│  ChunkedStorage → ContentAddressable → Indexed              │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **UI**: React 19, TypeScript, Tailwind CSS, Framer Motion
- **State**: XState (state machines), React Context API
- **Desktop**: Tauri v2 (Rust 1.70+)
- **Native**: Swift 5.9+ (macOS 13.0+)
- **Storage**: IndexedDB (web), Tauri FS (desktop)
- **AI**: Claude API, OpenAI API
- **Testing**: Vitest, React Testing Library, XCTest (Swift)

---

## Data Models

### Session Lifecycle

#### SessionMetadata (New - Storage Efficient)
```typescript
interface SessionMetadata {
  // Core identity
  id: string;                    // UUID
  name: string;
  description?: string;
  schemaVersion: number;         // For migrations (current: 2)

  // Lifecycle timestamps
  startTime: string;             // ISO 8601
  endTime?: string;
  pauseTime?: string;
  resumeTime?: string;

  // Status
  status: 'active' | 'paused' | 'completed' | 'interrupted';
  totalDuration?: number;        // milliseconds

  // References to chunked data (NOT embedded)
  screenshotsRef: string;        // → "screenshots/{sessionId}"
  audioSegmentsRef: string;      // → "audioSegments/{sessionId}"
  summaryRef?: string;           // → "summaries/{sessionId}"
  videoRef?: string;             // → "videos/{sessionId}"

  // Lightweight embedded data
  tags: string[];
  topicIds: string[];
  extractedTaskIds: string[];
  extractedNoteIds: string[];

  // Configuration (what WAS recorded)
  recordingConfig: {
    screenshotsEnabled: boolean;
    audioEnabled: boolean;
    videoEnabled: boolean;
    sourceType: 'display' | 'window' | 'webcam';
    displayIds?: string[];
    windowIds?: string[];
  };

  // Enrichment status
  enrichmentStatus?: {
    status: 'idle' | 'in-progress' | 'completed' | 'failed';
    audioReviewCompleted?: boolean;
    videoChaptersGenerated?: boolean;
    summaryGenerated?: boolean;
    totalCost?: number;
    errors?: string[];
  };
}
```

#### SessionScreenshotChunk (New - Append-Only)
```typescript
interface SessionScreenshotChunk {
  sessionId: string;
  chunkIndex: number;             // 0, 1, 2, ...
  screenshots: SessionScreenshot[]; // Max 20 per chunk
  compressedSize: number;          // Bytes (after compression)
  checksum: string;                // SHA-256 for integrity
  createdAt: string;
}

interface SessionScreenshot {
  id: string;
  sessionId: string;
  timestamp: string;
  sequenceNumber: number;          // Monotonic counter
  attachmentId: string;            // Content-addressable storage

  // Analysis (optional)
  analysis?: {
    summary: string;
    detectedActivity: string;
    extractedText: string[];
    keyElements: string[];
    confidence: number;
    curiosity: number;
    curiosityReason: string;
  };

  // Deduplication
  isDuplicate?: boolean;
  duplicateOf?: string;            // Reference to original
  perceptualHash?: string;         // For similarity detection
}
```

#### SessionAudioChunk (New - Grouped)
```typescript
interface SessionAudioChunk {
  sessionId: string;
  chunkIndex: number;
  segments: SessionAudioSegment[];
  totalDuration: number;           // Sum of all segment durations
  createdAt: string;
}

interface SessionAudioSegment {
  id: string;
  sessionId: string;
  timestamp: string;
  duration: number;                // seconds
  transcription: string;
  attachmentId: string;            // WAV file reference

  // Enhanced metadata
  speakerConfidence?: number;
  noiseLevel?: number;
  isEmpty?: boolean;               // True if silence
}
```

### Attachment Storage (Content-Addressable)

```typescript
interface Attachment {
  // User-facing ID
  id: string;                      // UUID

  // Content addressing
  contentHash: string;             // SHA-256 of binary data
  storageKey: string;              // → "{contentHash}.dat"

  // Reference counting for GC
  refCount: number;
  referencedBy: string[];          // [sessionId1, sessionId2, ...]

  // Metadata
  type: 'image' | 'audio' | 'video';
  name: string;
  mimeType: string;
  size: number;                    // bytes
  width?: number;
  height?: number;
  duration?: number;

  // Lifecycle
  createdAt: string;
  lastAccessedAt: string;

  // Optional thumbnail (for images/video)
  thumbnail?: string;              // Base64 data URI (small)
}
```

---

## State Machines

### Session Lifecycle State Machine (XState)

```typescript
import { createMachine, assign } from 'xstate';

export const sessionMachine = createMachine({
  id: 'session',
  initial: 'idle',
  context: {
    sessionId: null,
    config: null,
    startTime: null,
    errors: [],
    recordingState: {
      screenshots: 'idle',
      audio: 'idle',
      video: 'idle',
    },
  },

  states: {
    idle: {
      on: {
        START: {
          target: 'validating',
          actions: assign({
            config: (_, event) => event.config,
          }),
        },
      },
    },

    validating: {
      invoke: {
        src: 'validateConfig',
        onDone: {
          target: 'checking_permissions',
          actions: assign({
            sessionId: (_, event) => event.data.sessionId,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            errors: (_, event) => [event.data.message],
          }),
        },
      },
    },

    checking_permissions: {
      invoke: {
        src: 'checkPermissions',
        onDone: {
          target: 'starting',
          cond: 'hasRequiredPermissions',
        },
        onError: {
          target: 'error',
          actions: assign({
            errors: (_, event) => ['Missing permissions: ' + event.data],
          }),
        },
      },
    },

    starting: {
      invoke: {
        src: 'startRecordingServices',
        onDone: {
          target: 'active',
          actions: assign({
            startTime: () => Date.now(),
            recordingState: (_, event) => event.data.recordingState,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            errors: (_, event) => [event.data.message],
          }),
        },
      },
    },

    active: {
      on: {
        PAUSE: 'pausing',
        END: 'ending',
        UPDATE_RECORDING_STATE: {
          actions: assign({
            recordingState: (context, event) => ({
              ...context.recordingState,
              ...event.updates,
            }),
          }),
        },
      },

      // Health monitoring
      invoke: {
        src: 'monitorRecordingHealth',
      },
    },

    pausing: {
      invoke: {
        src: 'pauseRecordingServices',
        onDone: 'paused',
        onError: {
          target: 'error',
          actions: assign({
            errors: (_, event) => [event.data.message],
          }),
        },
      },
    },

    paused: {
      on: {
        RESUME: 'resuming',
        END: 'ending',
      },
    },

    resuming: {
      invoke: {
        src: 'resumeRecordingServices',
        onDone: 'active',
        onError: {
          target: 'error',
          actions: assign({
            errors: (_, event) => [event.data.message],
          }),
        },
      },
    },

    ending: {
      invoke: {
        src: 'stopRecordingServices',
        onDone: {
          target: 'completed',
          actions: assign({
            recordingState: () => ({
              screenshots: 'stopped',
              audio: 'stopped',
              video: 'stopped',
            }),
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            errors: (_, event) => [event.data.message],
          }),
        },
      },
    },

    completed: {
      type: 'final',
    },

    error: {
      on: {
        RETRY: 'idle',
        DISMISS: 'idle',
      },
    },
  },
}, {
  guards: {
    hasRequiredPermissions: (_, event) => {
      return event.data.screen && event.data.camera;
    },
  },
});
```

### Recording Service States

Each recording service (screenshots, audio, video) has its own mini state machine:

```typescript
type RecordingServiceState =
  | 'idle'
  | 'initializing'
  | 'active'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

interface RecordingServiceStatus {
  state: RecordingServiceState;
  health: 'healthy' | 'degraded' | 'failed';
  lastActivity: Date;
  errorCount: number;
  metrics: {
    itemsRecorded: number;
    droppedItems: number;
    averageLatency: number;
  };
}
```

---

## Storage Architecture

### Chunked Storage Schema

#### Directory Structure (Tauri FileSystem)
```
AppData/
├── sessions/
│   └── metadata/
│       ├── {sessionId}.json          (SessionMetadata < 10KB)
│       └── index.json                (Session list for queries)
├── screenshots/
│   └── {sessionId}/
│       ├── 0.json                    (First 20 screenshots)
│       ├── 1.json                    (Next 20)
│       └── ...
├── audio/
│   └── {sessionId}/
│       ├── 0.json                    (Audio segments chunk)
│       └── ...
├── summaries/
│   └── {sessionId}.json              (Full summary)
├── videos/
│   └── {sessionId}.json              (Video metadata)
└── attachments/
    ├── blobs/
    │   └── {contentHash}.dat         (Binary data)
    └── metadata/
        └── {attachmentId}.json       (Attachment metadata)
```

#### IndexedDB Schema (Browser)
```typescript
const DB_NAME = 'taskerino';
const DB_VERSION = 2;

// Object Stores
const stores = {
  'session-metadata': {
    keyPath: 'id',
    indexes: [
      { name: 'status', keyPath: 'status' },
      { name: 'startTime', keyPath: 'startTime' },
      { name: 'tags', keyPath: 'tags', multiEntry: true },
      { name: 'status_startTime', keyPath: ['status', 'startTime'] },
    ],
  },
  'screenshot-chunks': {
    keyPath: ['sessionId', 'chunkIndex'],
  },
  'audio-chunks': {
    keyPath: ['sessionId', 'chunkIndex'],
  },
  'summaries': {
    keyPath: 'sessionId',
  },
  'attachments': {
    keyPath: 'id',
    indexes: [
      { name: 'contentHash', keyPath: 'contentHash' },
      { name: 'refCount', keyPath: 'refCount' },
    ],
  },
};
```

### Storage APIs

#### Session Storage
```typescript
interface SessionStorage {
  // Metadata operations (fast, < 10KB)
  getMetadata(sessionId: string): Promise<SessionMetadata>;
  saveMetadata(metadata: SessionMetadata): Promise<void>;
  listMetadata(filter?: SessionFilter): Promise<SessionMetadata[]>;

  // Chunk operations (incremental)
  appendScreenshot(sessionId: string, screenshot: SessionScreenshot): Promise<void>;
  appendAudioSegment(sessionId: string, segment: SessionAudioSegment): Promise<void>;
  getScreenshots(sessionId: string): Promise<SessionScreenshot[]>;
  getAudioSegments(sessionId: string): Promise<SessionAudioSegment[]>;

  // Full session hydration (lazy)
  getFullSession(sessionId: string): Promise<Session>;

  // Deletion (cascading)
  deleteSession(sessionId: string): Promise<void>; // Removes all chunks
}

interface SessionFilter {
  status?: SessionStatus | SessionStatus[];
  startAfter?: Date;
  startBefore?: Date;
  tags?: string[];
  topicIds?: string[];
  limit?: number;
  offset?: number;
}
```

#### Attachment Storage
```typescript
interface AttachmentStorage {
  // Save with automatic deduplication
  saveAttachment(data: ArrayBuffer, metadata: AttachmentMetadata): Promise<Attachment>;

  // Load with LRU caching
  loadAttachment(attachmentId: string): Promise<ArrayBuffer>;

  // Reference counting
  incrementRefCount(attachmentId: string, referencedBy: string): Promise<void>;
  decrementRefCount(attachmentId: string, referencedBy: string): Promise<void>;

  // Garbage collection
  deleteOrphanedAttachments(olderThan?: Date): Promise<number>; // Returns count deleted
}
```

### Transaction Support

```typescript
interface StorageTransaction {
  // Atomic multi-key writes
  save(key: string, value: any): void;
  delete(key: string): void;

  // Commit or rollback
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

// Usage
const tx = await storage.beginTransaction();
try {
  tx.save('sessions', updatedSessions);
  tx.save('settings', updatedSettings);
  await tx.commit();
} catch (error) {
  await tx.rollback();
  throw error;
}
```

---

## Recording Pipeline

### Swift RecordingSession Architecture

```swift
protocol RecordingSource: Sendable {
    func configure(width: Int, height: Int, fps: Int) async throws
    func start() async throws
    func stop() async throws
    var frameStream: AsyncStream<SourcedFrame> { get }
}

struct SourcedFrame {
    let buffer: CVPixelBuffer
    let sourceId: String
    let timestamp: CMTime
    let sequenceNumber: Int
}

actor FrameSynchronizer {
    private var buffers: [String: [SourcedFrame]] = [:]
    private var toleranceMs: Int = 16 // One frame at 60fps

    func addFrame(_ frame: SourcedFrame) {
        buffers[frame.sourceId, default: []].append(frame)
    }

    func getAlignedFrames() -> [SourcedFrame]? {
        guard buffers.values.allSatisfy({ !$0.isEmpty }) else {
            return nil // Wait for all sources to have data
        }

        // Find earliest timestamp across all sources
        let timestamps = buffers.values.compactMap { $0.first?.timestamp }
        guard let baseTime = timestamps.min() else { return nil }

        // Collect frames within tolerance
        var aligned: [SourcedFrame] = []
        for (sourceId, frames) in buffers {
            if let frame = frames.first(where: {
                abs($0.timestamp.seconds - baseTime.seconds) < Double(toleranceMs) / 1000.0
            }) {
                aligned.append(frame)
                // Remove consumed frames
                buffers[sourceId] = frames.filter { $0.sequenceNumber > frame.sequenceNumber }
            }
        }

        return aligned.count == buffers.count ? aligned : nil
    }
}

protocol FrameCompositor {
    func composite(_ frames: [SourcedFrame]) throws -> CVPixelBuffer
}

actor RecordingSession {
    private let sources: [RecordingSource]
    private let synchronizer: FrameSynchronizer
    private let compositor: FrameCompositor
    private let encoder: VideoEncoder

    func start() async throws {
        // Start all sources in parallel
        try await withThrowingTaskGroup(of: Void.self) { group in
            for source in sources {
                group.addTask {
                    try await source.start()
                }
            }
            try await group.waitForAll()
        }

        // Process frames continuously
        Task {
            for await frame in mergeFrameStreams(sources) {
                await synchronizer.addFrame(frame)

                if let alignedFrames = await synchronizer.getAlignedFrames() {
                    let composited = try compositor.composite(alignedFrames)
                    try encoder.writeFrame(composited, at: alignedFrames[0].timestamp)
                }
            }
        }
    }

    func stop() async throws {
        for source in sources {
            try await source.stop()
        }
        try await encoder.finish()
    }
}
```

### Rust FFI Layer

```rust
// src-tauri/src/recording/session.rs

use std::ptr::NonNull;
use std::time::Duration;
use tokio::time::timeout;

pub struct SwiftRecorderHandle(NonNull<c_void>);

// SAFETY: Swift recorder is thread-safe (uses actors)
unsafe impl Send for SwiftRecorderHandle {}
unsafe impl Sync for SwiftRecorderHandle {}

impl SwiftRecorderHandle {
    pub unsafe fn from_raw(ptr: *mut c_void) -> Result<Self, FFIError> {
        NonNull::new(ptr)
            .ok_or(FFIError::NullPointer)
            .map(SwiftRecorderHandle)
    }

    pub fn as_ptr(&self) -> *mut c_void {
        self.0.as_ptr()
    }
}

impl Drop for SwiftRecorderHandle {
    fn drop(&mut self) {
        unsafe {
            screen_recorder_destroy(self.as_ptr());
        }
    }
}

pub struct RecordingSession {
    handle: SwiftRecorderHandle,
    session_id: String,
    output_path: PathBuf,
    state: RecordingState,
}

impl RecordingSession {
    pub async fn start(config: RecordingConfig) -> Result<Self, FFIError> {
        // Call Swift with timeout
        let handle_ptr = timeout(
            Duration::from_secs(5),
            tokio::task::spawn_blocking(move || unsafe {
                let config_json = serde_json::to_string(&config)?;
                let config_cstr = CString::new(config_json)?;
                screen_recorder_create(config_cstr.as_ptr())
            })
        ).await??;

        let handle = unsafe { SwiftRecorderHandle::from_raw(handle_ptr)? };

        Ok(Self {
            handle,
            session_id: config.session_id,
            output_path: config.output_path,
            state: RecordingState::Active,
        })
    }

    pub async fn stop(mut self) -> Result<PathBuf, FFIError> {
        if self.state != RecordingState::Active {
            return Err(FFIError::InvalidState);
        }

        timeout(
            Duration::from_secs(10),
            tokio::task::spawn_blocking(move || unsafe {
                screen_recorder_stop(self.handle.as_ptr())
            })
        ).await??;

        self.state = RecordingState::Stopped;
        Ok(self.output_path)
    }
}
```

---

## Enrichment Pipeline

### Saga Pattern Implementation

```typescript
// Saga = Generator-based long-running process with checkpoints

async function* enrichSession(
  session: Session,
  options: EnrichmentOptions
): AsyncGenerator<EnrichmentProgress> {
  const checkpoint = await loadCheckpoint(session.id) || createCheckpoint(session.id);

  try {
    // Stage 1: Validation
    yield { stage: 'validating', progress: 5 };
    const capability = await validateSession(session);

    // Stage 2: Cost Estimation
    yield { stage: 'estimating', progress: 10 };
    const estimate = await estimateCost(session, options);
    if (estimate > options.maxCost) {
      throw new CostExceededError(estimate, options.maxCost);
    }

    // Stage 3: Lock Acquisition
    yield { stage: 'acquiring-lock', progress: 15 };
    await acquireLock(session.id);

    // Stage 4: Audio Review (if not completed)
    if (options.includeAudio && !checkpoint.completedStages.audio) {
      yield { stage: 'audio', progress: 20, substage: 'concatenating' };
      const audioResult = await processAudio(session);

      // Save checkpoint after each stage
      await saveCheckpoint(session.id, {
        ...checkpoint,
        completedStages: {
          ...checkpoint.completedStages,
          audio: { result: audioResult, cost: audioResult.cost }
        }
      });

      yield { stage: 'audio', progress: 50, substage: 'completed' };
    } else if (checkpoint.completedStages.audio) {
      yield { stage: 'audio', progress: 50, substage: 'skipped' };
    }

    // Stage 5: Video Chaptering
    if (options.includeVideo && !checkpoint.completedStages.video) {
      yield { stage: 'video', progress: 55, substage: 'analyzing' };
      const videoResult = await processVideo(session);

      await saveCheckpoint(session.id, {
        ...checkpoint,
        completedStages: {
          ...checkpoint.completedStages,
          video: { result: videoResult, cost: videoResult.cost }
        }
      });

      yield { stage: 'video', progress: 75, substage: 'completed' };
    }

    // Stage 6: Summary Generation
    yield { stage: 'summary', progress: 80, substage: 'generating' };
    const summaryResult = await generateSummary(
      session,
      checkpoint.completedStages.audio?.result,
      checkpoint.completedStages.video?.result
    );

    // Stage 7: Complete
    yield { stage: 'completed', progress: 100, results: {
      audio: checkpoint.completedStages.audio?.result,
      video: checkpoint.completedStages.video?.result,
      summary: summaryResult,
    }};

  } catch (error) {
    yield { stage: 'failed', progress: 0, error };
  } finally {
    await releaseLock(session.id);
  }
}

// Usage in Web Worker
self.onmessage = async (e) => {
  if (e.data.type === 'ENRICH_SESSION') {
    const saga = enrichSession(e.data.session, e.data.options);

    for await (const progress of saga) {
      self.postMessage({ type: 'PROGRESS', progress });
    }
  }
};
```

---

## Review System

### Progressive Audio Loading

```typescript
class ProgressiveAudioLoader {
  private sessionId: string;
  private segments: SessionAudioSegment[];
  private loadedBuffers: Map<string, AudioBuffer> = new Map();
  private loadQueue: Set<string> = new Set();

  async initialize(sessionId: string) {
    this.sessionId = sessionId;

    // 1. Load metadata instantly (no audio data)
    this.segments = await loadAudioSegmentsMetadata(sessionId);

    // 2. Load first 3 segments for immediate playback
    const priority = this.segments.slice(0, 3);
    await Promise.all(priority.map(s => this.loadSegment(s.id)));

    // 3. Background load remaining segments
    this.loadRemainingInBackground();
  }

  async loadSegment(segmentId: string): Promise<AudioBuffer> {
    if (this.loadedBuffers.has(segmentId)) {
      return this.loadedBuffers.get(segmentId)!;
    }

    const segment = this.segments.find(s => s.id === segmentId)!;
    const wav = await attachmentStorage.loadAttachment(segment.attachmentId);
    const buffer = await decodeAudioData(wav);

    this.loadedBuffers.set(segmentId, buffer);
    return buffer;
  }

  private async loadRemainingInBackground() {
    const remaining = this.segments.slice(3);

    // Load 2 at a time to avoid overwhelming system
    for (let i = 0; i < remaining.length; i += 2) {
      const batch = remaining.slice(i, i + 2);
      await Promise.all(batch.map(s => this.loadSegment(s.id)));

      // Yield to main thread
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Play segment immediately, load if needed
  async playSegmentAt(currentTime: number): Promise<void> {
    const segment = this.findSegmentAtTime(currentTime);
    if (!segment) return;

    const buffer = await this.loadSegment(segment.id);
    this.playBuffer(buffer, currentTime - segment.startTime);
  }
}
```

### Virtual Timeline

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function ReviewTimeline({ sessionId }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const items = useTimelineItems(sessionId); // Flattened list

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300, // Estimated height per item
    overscan: 5, // Render 5 items above/below viewport
  });

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const item = items[virtualItem.index];

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <TimelineItem item={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## API Specifications

### Tauri Commands

#### Video Recording
```rust
#[tauri::command]
async fn start_multi_window_recording(
    session_id: String,
    window_ids: Vec<String>,
    layout: String, // "grid" | "side-by-side"
    config: RecordingConfig,
) -> Result<(), String>

#[tauri::command]
async fn add_recording_source(
    session_id: String,
    source_type: String, // "display" | "window"
    source_id: String,
) -> Result<(), String>

#[tauri::command]
async fn stop_recording(
    session_id: String,
) -> Result<PathBuf, String>
```

#### Audio Recording
```rust
#[tauri::command]
async fn start_audio_recording_with_graph(
    session_id: String,
    config: AudioGraphConfig,
) -> Result<(), String>

#[tauri::command]
async fn update_audio_mix(
    session_id: String,
    balance: f32, // 0.0-1.0
) -> Result<(), String>
```

---

**Document Version**: 1.0
**Last Updated**: 2024-XX-XX
**Maintained By**: Lead Architect
