# Background Enrichment & Video/Audio Optimization Plan

**Status**: Planning
**Priority**: High
**Created**: 2025-10-28
**Owner**: System Architecture

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Goals & Requirements](#goals--requirements)
4. [Architecture Overview](#architecture-overview)
5. [Component Specifications](#component-specifications)
6. [Implementation Phases](#implementation-phases)
7. [Agent Task Assignments](#agent-task-assignments)
8. [Testing Requirements](#testing-requirements)
9. [Success Criteria](#success-criteria)
10. [Risks & Mitigations](#risks--mitigations)

---

## Executive Summary

Implement a **persistent background enrichment system** with **optimized video/audio merging** that:
- Merges video and audio into single compressed MP4 after session ends
- Processes sessions automatically in background (survives navigation/restart)
- Shows non-blocking processing screen during media optimization
- Enables enrichment to continue even when user closes app
- Provides global visibility into enrichment status

**Key Innovations**:
1. **One-Time Video/Audio Merge**: Concatenate audio segments and merge with video into single optimized MP4 (eliminates runtime audio sync)
2. **Persistent Job Queue**: IndexedDB-backed queue survives app restart
3. **Background Processing**: Enrichment continues regardless of user navigation
4. **Non-Blocking UX**: Processing screen shows progress but user can navigate away

**Impact**:
- ✅ Simpler playback (just play one file, no sync logic)
- ✅ Better performance (no runtime audio concatenation)
- ✅ Smaller files (64% reduction with compression)
- ✅ Automatic enrichment (no manual trigger required)
- ✅ Reliable operation (survives app restart)

---

## Problem Statement

### Current Issues

**1. Runtime Audio Concatenation** (Performance)
- Location: `src/components/UnifiedMediaPlayer.tsx:283-402`
- Audio segments concatenated **every time** user views session
- 2-3 second delay on session open
- Complex sync logic (150ms drift threshold, continuous monitoring)
- Code: 400+ lines of audio/video synchronization

**2. Fragile Audio/Video Sync** (Reliability)
- Master-slave pattern requires continuous monitoring
- Sync can drift during playback (150ms threshold)
- Audio segments loaded progressively (first 3 fast, rest background)
- Complex state management across multiple services

**3. In-Memory Enrichment** (Data Loss)
- `ParallelEnrichmentQueue` is in-memory only
- Enrichment stops when user navigates away
- Lost on app restart
- No visibility when in other zones

**4. Manual Enrichment Trigger** (UX)
- User must manually click "Enrich" (or auto-enrich on end)
- No way to track enrichment progress after navigation
- Unclear if enrichment is running

### User Impact

❌ **Slow session viewing** - 2-3 second delay to concatenate audio
❌ **Fragile playback** - audio can drift out of sync
❌ **Lost enrichment** - navigating away stops processing
❌ **No progress visibility** - can't see enrichment status
❌ **Large storage** - uncompressed video files (500MB vs 200MB)

---

## Goals & Requirements

### Primary Goals

1. **One-Time Media Processing**
   - Concatenate audio segments to single MP3 on session end
   - Merge video + audio into single compressed MP4
   - Store optimized file for instant playback
   - Keep originals for AI processing

2. **Background Enrichment**
   - Persist enrichment jobs to IndexedDB
   - Continue processing after navigation/app restart
   - Auto-resume pending jobs on app launch
   - Process multiple sessions concurrently (5x throughput)

3. **Non-Blocking UX**
   - Show processing screen during media optimization
   - Allow user to navigate away during processing
   - Display global enrichment status in TopNavigation
   - Send notification when enrichment completes

4. **Simplified Playback**
   - Remove runtime audio concatenation
   - Remove audio/video sync logic
   - Just play single optimized MP4 file
   - Fallback to separate audio/video for legacy sessions

### Functional Requirements

**FR-1: Video/Audio Merging**
- **FR-1.1**: Concatenate all audio segments into single MP3 file (< 5 seconds)
- **FR-1.2**: Merge video + MP3 into single MP4 with H.264 + AAC compression
- **FR-1.3**: Compress final file to ~40% of original size (500MB → 200MB)
- **FR-1.4**: Preserve originals for AI frame extraction
- **FR-1.5**: Support sessions with video-only, audio-only, or both

**FR-2: Persistent Job Queue**
- **FR-2.1**: Store enrichment jobs in IndexedDB
- **FR-2.2**: Auto-resume pending jobs on app launch
- **FR-2.3**: Support job priorities (high, normal, low)
- **FR-2.4**: Track job status (pending, processing, completed, failed)
- **FR-2.5**: Allow job cancellation and retry

**FR-3: Background Processing**
- **FR-3.1**: Process enrichment jobs independent of UI state
- **FR-3.2**: Continue processing after user navigates away
- **FR-3.3**: Survive app restart (resume on next launch)
- **FR-3.4**: Process up to 5 sessions concurrently
- **FR-3.5**: Emit progress events for UI updates

**FR-4: Processing Screen**
- **FR-4.1**: Show processing screen immediately after session ends
- **FR-4.2**: Display real-time progress for media optimization
- **FR-4.3**: Allow user to navigate away (non-blocking)
- **FR-4.4**: Auto-navigate to session summary when media ready
- **FR-4.5**: Show disclaimer that enrichment continues in background

**FR-5: Global Status Indicator**
- **FR-5.1**: Display enrichment count in TopNavigation
- **FR-5.2**: Show processing spinner when active
- **FR-5.3**: Click to expand enrichment panel
- **FR-5.4**: Hide when no active enrichments

**FR-6: Simplified Playback**
- **FR-6.1**: Play optimized MP4 file (single `<video>` element)
- **FR-6.2**: Remove audio concatenation logic
- **FR-6.3**: Remove audio/video sync logic
- **FR-6.4**: Fallback to legacy playback for old sessions

### Non-Functional Requirements

**NFR-1: Performance**
- Audio concatenation: < 5 seconds (typical 30-min session)
- Video/audio merge: < 30 seconds (typical 30-min session)
- Total processing time: < 40 seconds
- Queue initialization: < 500ms (app launch)
- Job status query: < 100ms

**NFR-2: Reliability**
- Job persistence: 100% (no data loss on crash)
- Job completion rate: > 95% (with retries)
- Queue recovery: 100% (all pending jobs resumed)
- Error isolation: 100% (one job failure doesn't block others)

**NFR-3: Storage**
- Optimized file size: ~40% of original (500MB → 200MB)
- Keep originals until enrichment complete
- Delete originals after enrichment (optional)
- Total storage during transition: ~140% (750MB for 500MB session)

**NFR-4: Concurrency**
- Max concurrent enrichments: 5 sessions
- Max concurrent video processing: 1 session (CPU-intensive)
- Queue throughput: 5 sessions/min (with cache)
- Priority handling: High priority within 5 seconds

**NFR-5: Observability**
- Log all job state transitions
- Track processing duration per stage
- Report errors with context
- Emit events for monitoring

---

## Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER SESSION END                         │
└────────────────────────────┬────────────────────────────────────┘
                             ↓
                    ┌────────────────┐
                    │ endSession()   │
                    │ (Context)      │
                    └────────┬───────┘
                             ↓
              ┌──────────────┴──────────────┐
              ↓                             ↓
    ┌─────────────────┐          ┌──────────────────┐
    │ Navigate to     │          │ Create Job       │
    │ Processing      │          │ (IndexedDB)      │
    │ Screen          │          └─────────┬────────┘
    └─────────────────┘                    ↓
              ↓                   ┌──────────────────┐
    ┌─────────────────┐          │ Background       │
    │ Show Progress:  │◄─────────│ Media Processor  │
    │ - Concat Audio  │          └─────────┬────────┘
    │ - Merge Video   │                    │
    └─────────────────┘          ┌─────────▼────────┐
              ↓                   │ Swift            │
    ┌─────────────────┐          │ VideoAudioMerger │
    │ Media Ready!    │          └─────────┬────────┘
    │ Auto-navigate   │                    │
    │ or User clicks  │          ┌─────────▼────────┐
    └────────┬────────┘          │ Save Optimized   │
             ↓                   │ MP4 to Disk      │
    ┌─────────────────┐          └─────────┬────────┘
    │ Session Summary │                    │
    │ (plays optimized│          ┌─────────▼────────┐
    │ video)          │          │ Mark Media       │
    └─────────────────┘          │ Processing       │
                                 │ Complete         │
                                 └─────────┬────────┘
                                           ↓
                                 ┌──────────────────┐
                                 │ Persistent       │
                                 │ Enrichment Queue │
                                 │ (IndexedDB)      │
                                 └─────────┬────────┘
                                           ↓
           ┌──────────────────────────────┴────────────────────────────────┐
           ↓                              ↓                                 ↓
  ┌────────────────┐          ┌────────────────┐              ┌────────────────┐
  │ Process Job 1  │          │ Process Job 2  │              │ Process Job 3  │
  │ (Audio Review) │          │ (Video Chapter)│              │ (Summary Gen)  │
  └────────┬───────┘          └────────┬───────┘              └────────┬───────┘
           ↓                            ↓                                ↓
  ┌────────────────┐          ┌────────────────┐              ┌────────────────┐
  │ Save Results   │          │ Save Results   │              │ Save Results   │
  │ to Session     │          │ to Session     │              │ to Session     │
  └────────┬───────┘          └────────┬───────┘              └────────┬───────┘
           └────────────────────────────┴──────────────────────────────┘
                                        ↓
                              ┌──────────────────┐
                              │ Job Complete!    │
                              │ Show Notification│
                              └──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    GLOBAL UI ELEMENTS                            │
├─────────────────────────────────────────────────────────────────┤
│  TopNavigation                                                   │
│  ┌────────────────────────────────────────┐                     │
│  │ 🔄 Enriching 3 sessions... (click)     │ ◄── Always visible  │
│  └────────────────────────────────────────┘                     │
│                                                                   │
│  EnrichmentPanel (expandable)                                    │
│  ┌────────────────────────────────────────┐                     │
│  │ Session A: Audio Review [━━━━━░░░] 60% │                     │
│  │ Session B: Summary Gen  [━━━━━━━━] 90% │                     │
│  │ Session C: Waiting...   [░░░░░░░░]  0% │                     │
│  └────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

**Phase 1: Session End → Media Processing**
```
1. User ends session
2. Stop recording services (video, audio, screenshots)
3. Navigate to /sessions/{id}/processing
4. Create job in IndexedDB (status: 'waiting_for_media')
5. Start BackgroundMediaProcessor
   5a. Concatenate audio segments → single MP3 (5s)
   5b. Merge video + MP3 → optimized MP4 (30s)
   5c. Save optimized file to disk
6. Update job (status: 'pending', mediaProcessingComplete: true)
7. Update processing screen: "Session Ready!"
8. Auto-navigate to session summary (or user clicks)
```

**Phase 2: Background Enrichment**
```
1. PersistentEnrichmentQueue detects pending job
2. Start processing (status: 'processing')
3. Execute sessionEnrichmentService.enrichSession()
   3a. Audio Review (if enabled)
   3b. Video Chaptering (if enabled)
   3c. Summary Generation
   3d. Canvas Generation
4. Save results to session (via SessionListContext)
5. Update job (status: 'completed')
6. Show notification: "Session '{name}' enriched!"
7. Update TopNavigation indicator (decrement count)
```

**Phase 3: App Restart Recovery**
```
1. App launches
2. BackgroundEnrichmentManager.initialize()
3. Load all jobs from IndexedDB
4. Reset 'processing' jobs to 'pending' (crashed mid-process)
5. Resume processing queue
6. Continue where left off
```

### Key Components

**Backend Services** (9 new files)

1. **PersistentEnrichmentQueue** (`src/services/enrichment/PersistentEnrichmentQueue.ts`)
   - IndexedDB storage for jobs
   - Job lifecycle management
   - Queue processing loop
   - Event emission

2. **BackgroundEnrichmentManager** (`src/services/enrichment/BackgroundEnrichmentManager.ts`)
   - Singleton orchestrator
   - Auto-initialization on app launch
   - Job enqueueing API
   - Status queries

3. **BackgroundMediaProcessor** (`src/services/enrichment/BackgroundMediaProcessor.ts`)
   - Audio concatenation wrapper
   - Video/audio merge orchestration
   - Progress tracking
   - Error handling

4. **VideoAudioMergerService** (`src/services/videoAudioMergerService.ts`)
   - TypeScript wrapper for Tauri command
   - Path validation
   - Compression settings
   - Progress callbacks

5. **Swift VideoAudioMerger** (`src-tauri/ScreenRecorder/VideoAudioMerger.swift`)
   - AVMutableComposition for merging
   - H.264 + AAC encoding
   - AVAssetExportSession
   - Progress reporting

6. **Rust FFI Wrapper** (`src-tauri/src/recording/video_audio_merger.rs`)
   - Safe FFI for Swift merger
   - CString handling
   - Error conversion
   - Progress callbacks

7. **Tauri Command** (`src-tauri/src/video_recording.rs` - add to existing)
   - `merge_video_and_audio` command
   - Path resolution
   - Progress streaming
   - Cleanup on error

**UI Components** (4 new files)

8. **SessionProcessingScreen** (`src/components/sessions/SessionProcessingScreen.tsx`)
   - Full-screen processing view
   - Real-time progress display
   - Stage indicators (concat, merge, complete)
   - Auto-navigation on complete

9. **EnrichmentStatusIndicator** (`src/components/TopNavigation/EnrichmentStatusIndicator.tsx`)
   - Compact status badge
   - Click to expand panel
   - Hide when no jobs
   - Animated spinner

10. **EnrichmentPanel** (`src/components/enrichment/EnrichmentPanel.tsx`)
    - Expandable job list
    - Per-job progress bars
    - Job actions (cancel, retry)
    - Error display

11. **UnifiedMediaPlayer** (simplify existing - `src/components/UnifiedMediaPlayer.tsx`)
    - Remove audio concatenation logic (lines 283-402)
    - Remove sync logic (lines 413-429)
    - Single `<video>` element
    - Fallback for legacy sessions

**Context Updates** (2 modified files)

12. **ActiveSessionContext** (`src/context/ActiveSessionContext.tsx`)
    - Update `endSession()` flow
    - Integration with BackgroundMediaProcessor
    - Navigation to processing screen
    - Job creation

13. **App.tsx** (`src/App.tsx`)
    - Initialize BackgroundEnrichmentManager
    - Add /sessions/:id/processing route
    - Global error boundary

---

## Component Specifications

### 1. PersistentEnrichmentQueue

**File**: `src/services/enrichment/PersistentEnrichmentQueue.ts`
**Lines**: ~800 (similar to ParallelEnrichmentQueue)
**Dependencies**: IndexedDB, sessionEnrichmentService, EventEmitter

**Interface**:
```typescript
interface EnrichmentJob {
  id: string;
  sessionId: string;
  sessionName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'high' | 'normal' | 'low';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  lastUpdated: number;

  // Progress tracking
  progress: number; // 0-100
  stage: string;

  // Media processing
  mediaProcessingComplete: boolean;
  optimizedVideoPath?: string;

  // Enrichment config
  options: EnrichmentOptions;

  // Error handling
  error?: string;
  attempts: number;
  maxAttempts: number;
}

class PersistentEnrichmentQueue extends EventEmitter {
  // Initialization
  async initialize(): Promise<void>;
  async shutdown(): Promise<void>;

  // Job management
  async enqueue(job: EnrichmentJob): Promise<string>;
  async updateJob(job: Partial<EnrichmentJob>): Promise<void>;
  async deleteJob(jobId: string): Promise<void>;
  async cancelJob(jobId: string): Promise<void>;

  // Queries
  async getJob(jobId: string): Promise<EnrichmentJob | null>;
  async getJobBySessionId(sessionId: string): Promise<EnrichmentJob | null>;
  async getJobsByStatus(status: JobStatus[]): Promise<EnrichmentJob[]>;
  async countByStatus(status: JobStatus): Promise<number>;

  // Processing
  private async processNextJob(): Promise<void>;
  private async executeEnrichment(job: EnrichmentJob): Promise<void>;

  // Recovery
  private async resumePendingJobs(): Promise<void>;

  // Events
  on(event: 'job-started', handler: (job: EnrichmentJob) => void): void;
  on(event: 'job-progress', handler: (job: EnrichmentJob) => void): void;
  on(event: 'job-completed', handler: (job: EnrichmentJob) => void): void;
  on(event: 'job-failed', handler: (job: EnrichmentJob, error: Error) => void): void;
}
```

**Key Behaviors**:
1. **Persistent Storage**: All jobs stored in IndexedDB (`enrichment_jobs` object store)
2. **Auto-Resume**: On `initialize()`, load all 'pending'/'processing' jobs and resume
3. **Processing Loop**: Continuously process highest priority pending job
4. **Error Isolation**: One job failure doesn't affect others
5. **Progress Events**: Emit events for UI updates (throttled to 100ms)
6. **Retry Logic**: Failed jobs retry up to 3 times with exponential backoff

**IndexedDB Schema**:
```typescript
Database: taskerino-enrichment
Version: 1

Object Stores:
- enrichment_jobs
  - keyPath: 'id'
  - indexes:
    - status (non-unique)
    - sessionId (unique)
    - priority (non-unique)
    - createdAt (non-unique)
```

### 2. BackgroundEnrichmentManager

**File**: `src/services/enrichment/BackgroundEnrichmentManager.ts`
**Lines**: ~400
**Dependencies**: PersistentEnrichmentQueue, sessionEnrichmentService

**Interface**:
```typescript
class BackgroundEnrichmentManager {
  private queue: PersistentEnrichmentQueue;
  private initialized: boolean;

  // Initialization
  async initialize(): Promise<void>;
  async shutdown(): Promise<void>;

  // Job creation
  async enqueueSession(
    sessionId: string,
    sessionName: string,
    options: EnrichmentOptions
  ): Promise<string>;

  // Media processing callbacks
  async markMediaProcessingComplete(
    sessionId: string,
    optimizedVideoPath: string
  ): Promise<void>;

  // Status queries
  async getQueueStatus(): Promise<QueueStatus>;
  async getJobStatus(sessionId: string): Promise<EnrichmentJob | null>;

  // Job control
  async cancelEnrichment(sessionId: string): Promise<void>;
  async retryEnrichment(sessionId: string): Promise<void>;

  // Notifications
  private showNotification(title: string, body: string): void;
}

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalJobs: number;
}

// Singleton export
export const backgroundEnrichmentManager = new BackgroundEnrichmentManager();
```

**Key Behaviors**:
1. **Singleton Pattern**: Single instance shared across app
2. **Auto-Initialize**: Called from App.tsx on mount
3. **Job Orchestration**: High-level API for creating/managing jobs
4. **Notification**: Shows OS-level notification when enrichment completes
5. **Event Forwarding**: Forwards queue events to UI components

### 3. BackgroundMediaProcessor

**File**: `src/services/enrichment/BackgroundMediaProcessor.ts`
**Lines**: ~500
**Dependencies**: audioConcatenationService, videoAudioMergerService, invoke

**Interface**:
```typescript
interface MediaProcessingJob {
  sessionId: string;
  sessionName: string;
  videoPath: string;
  audioSegments: SessionAudioSegment[];
  onProgress: (stage: ProcessingStage, progress: number) => void;
  onComplete: (optimizedVideoPath: string) => void;
  onError: (error: Error) => void;
}

type ProcessingStage = 'concatenating-audio' | 'merging-video' | 'complete';

class BackgroundMediaProcessor {
  private activeJobs: Map<string, MediaProcessingJob>;

  // Process session media
  async process(job: MediaProcessingJob): Promise<void>;

  // Cancel processing
  async cancel(sessionId: string): Promise<void>;

  // Query status
  getActiveJobs(): string[];
  isProcessing(sessionId: string): boolean;

  // Internal
  private async concatenateAudio(
    sessionId: string,
    audioSegments: SessionAudioSegment[]
  ): Promise<string>;

  private async mergeVideoAndAudio(
    sessionId: string,
    videoPath: string,
    audioPath: string
  ): Promise<string>;

  private async cleanup(sessionId: string): Promise<void>;
}

// Singleton export
export const backgroundMediaProcessor = new BackgroundMediaProcessor();
```

**Key Behaviors**:
1. **Two-Stage Processing**:
   - Stage 1: Concatenate audio segments (5s)
   - Stage 2: Merge video + audio with compression (30s)
2. **Progress Callbacks**: Real-time updates for UI
3. **Error Handling**: Cleanup on failure, retry support
4. **Path Management**: Generates output paths, validates inputs
5. **Singleton**: One instance, can process multiple sessions sequentially

### 4. VideoAudioMergerService

**File**: `src/services/videoAudioMergerService.ts`
**Lines**: ~300
**Dependencies**: @tauri-apps/api/core (invoke)

**Interface**:
```typescript
interface MergeOptions {
  videoPath: string;
  audioPath: string;
  outputPath: string;
  compressionQuality?: 'low' | 'medium' | 'high'; // default: 'medium'
  onProgress?: (progress: number) => void;
}

interface MergeResult {
  success: boolean;
  outputPath: string;
  duration: number;
  fileSize: number;
  compressionRatio: number; // e.g., 0.4 = 60% reduction
}

class VideoAudioMergerService {
  // Merge video and audio
  async mergeVideoAndAudio(options: MergeOptions): Promise<MergeResult>;

  // Validate paths exist
  private async validatePaths(videoPath: string, audioPath: string): Promise<void>;

  // Generate output path
  private generateOutputPath(videoPath: string): string;

  // Poll for progress (Swift doesn't have streaming yet)
  private async pollProgress(
    sessionId: string,
    onProgress: (progress: number) => void
  ): Promise<void>;
}

export const videoAudioMergerService = new VideoAudioMergerService();
```

**Key Behaviors**:
1. **Path Validation**: Ensures video/audio files exist before merging
2. **Output Path Generation**: Creates path in `videos/` directory
3. **Compression Settings**: Maps quality level to Swift export preset
4. **Progress Polling**: Polls Tauri command for progress (Swift async limitation)
5. **Error Handling**: User-friendly error messages

### 5. Swift VideoAudioMerger

**File**: `src-tauri/ScreenRecorder/VideoAudioMerger.swift`
**Lines**: ~300
**Dependencies**: AVFoundation, Foundation

**Interface**:
```swift
/// Video/Audio merger using AVFoundation
@available(macOS 10.15, *)
class VideoAudioMerger {
    /// Merge video and audio into single MP4 file
    /// - Parameters:
    ///   - videoPath: Path to video file (MP4, no audio)
    ///   - audioPath: Path to audio file (MP3, WAV, etc)
    ///   - outputPath: Path for output MP4 file
    ///   - quality: Export quality preset
    ///   - completion: Callback with result or error
    func mergeVideoAndAudio(
        videoPath: String,
        audioPath: String,
        outputPath: String,
        quality: ExportQuality,
        progressHandler: @escaping (Double) -> Void,
        completion: @escaping (Result<MergeResult, MergeError>) -> Void
    )
}

enum ExportQuality {
    case low    // AVAssetExportPresetMediumQuality
    case medium // AVAssetExportPresetHighQuality
    case high   // AVAssetExportPresetHEVCHighestQuality
}

struct MergeResult {
    let outputPath: String
    let duration: Double
    let fileSize: Int64
}

enum MergeError: Error {
    case videoNotFound
    case audioNotFound
    case exportFailed(String)
    case invalidDuration
}
```

**Key Implementation Details**:
1. **AVMutableComposition**: Create mutable composition
2. **Add Video Track**: Insert video track from source
3. **Add Audio Track**: Insert audio track from source
4. **Export**: Use AVAssetExportSession with quality preset
5. **Progress**: Report progress via progressHandler (0.0 - 1.0)
6. **Error Handling**: Detailed error messages for debugging

**Code Outline**:
```swift
func mergeVideoAndAudio(...) {
    // 1. Create composition
    let composition = AVMutableComposition()

    // 2. Load assets
    let videoAsset = AVURLAsset(url: URL(fileURLWithPath: videoPath))
    let audioAsset = AVURLAsset(url: URL(fileURLWithPath: audioPath))

    // 3. Add video track
    let videoTrack = composition.addMutableTrack(withMediaType: .video, ...)
    try videoTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: videoAsset.duration),
        of: videoAsset.tracks(withMediaType: .video)[0],
        at: .zero
    )

    // 4. Add audio track
    let audioTrack = composition.addMutableTrack(withMediaType: .audio, ...)
    try audioTrack.insertTimeRange(
        CMTimeRange(start: .zero, duration: audioAsset.duration),
        of: audioAsset.tracks(withMediaType: .audio)[0],
        at: .zero
    )

    // 5. Export with compression
    let exporter = AVAssetExportSession(
        asset: composition,
        presetName: quality.presetName
    )
    exporter.outputURL = URL(fileURLWithPath: outputPath)
    exporter.outputFileType = .mp4

    // 6. Monitor progress
    Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
        progressHandler(Double(exporter.progress))
    }

    // 7. Export asynchronously
    exporter.exportAsynchronously {
        completion(.success(MergeResult(...)))
    }
}
```

### 6. Rust FFI Wrapper

**File**: `src-tauri/src/recording/video_audio_merger.rs`
**Lines**: ~400
**Dependencies**: libc, std::ffi

**Interface**:
```rust
use std::ffi::{CString, CStr};
use std::os::raw::{c_char, c_void};

// FFI function declarations (implemented in Swift)
extern "C" {
    fn merge_video_and_audio(
        video_path: *const c_char,
        audio_path: *const c_char,
        output_path: *const c_char,
        quality: i32,
        progress_callback: extern "C" fn(f64),
        completion_callback: extern "C" fn(*const c_char, bool)
    );
}

// Safe Rust wrapper
pub struct VideoAudioMerger;

impl VideoAudioMerger {
    /// Merge video and audio files into single MP4
    pub async fn merge(
        video_path: &str,
        audio_path: &str,
        output_path: &str,
        quality: ExportQuality,
    ) -> Result<MergeResult, FFIError> {
        // Convert Rust strings to CStrings
        let video_c = CString::new(video_path)?;
        let audio_c = CString::new(audio_path)?;
        let output_c = CString::new(output_path)?;

        // Call Swift function
        unsafe {
            merge_video_and_audio(
                video_c.as_ptr(),
                audio_c.as_ptr(),
                output_c.as_ptr(),
                quality as i32,
                progress_callback,
                completion_callback
            );
        }

        // Wait for completion (via channel)
        // ...
    }
}

#[derive(Debug, Clone, Copy)]
pub enum ExportQuality {
    Low = 0,
    Medium = 1,
    High = 2,
}

pub struct MergeResult {
    pub output_path: String,
    pub duration: f64,
    pub file_size: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum FFIError {
    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Merge failed: {0}")]
    MergeFailed(String),

    #[error("FFI error: {0}")]
    FFI(String),
}
```

**Key Behaviors**:
1. **CString Conversion**: Safe Rust string → C string conversion
2. **Async Wrapper**: Wraps synchronous Swift call in async Rust
3. **Callback Handling**: Converts Swift callbacks to Rust futures
4. **Error Translation**: Maps Swift errors to Rust error types
5. **Memory Safety**: Ensures no memory leaks across FFI boundary

### 7. Tauri Command

**File**: `src-tauri/src/video_recording.rs` (add to existing)
**Lines**: +150

**New Commands**:
```rust
use crate::recording::video_audio_merger::{VideoAudioMerger, ExportQuality, MergeResult};

#[tauri::command]
pub async fn merge_video_and_audio(
    session_id: String,
    video_path: String,
    audio_path: String,
    output_path: String,
    quality: String, // "low" | "medium" | "high"
) -> Result<MergeResult, String> {
    println!("🎬 [MERGE] Starting merge for session {}", session_id);
    println!("🎬 [MERGE] Video: {}", video_path);
    println!("🎬 [MERGE] Audio: {}", audio_path);
    println!("🎬 [MERGE] Output: {}", output_path);

    // Parse quality
    let quality = match quality.as_str() {
        "low" => ExportQuality::Low,
        "medium" => ExportQuality::Medium,
        "high" => ExportQuality::High,
        _ => ExportQuality::Medium,
    };

    // Execute merge
    let result = VideoAudioMerger::merge(
        &video_path,
        &audio_path,
        &output_path,
        quality
    )
    .await
    .map_err(|e| format!("Merge failed: {}", e))?;

    println!("✅ [MERGE] Complete: {} bytes", result.file_size);

    Ok(result)
}

#[tauri::command]
pub async fn get_merge_progress(session_id: String) -> Result<f64, String> {
    // Query current progress from Swift
    // (Implementation depends on how Swift tracks progress)
    Ok(0.0)
}
```

**Register Commands** (in `main.rs`):
```rust
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            merge_video_and_audio,
            get_merge_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 8. SessionProcessingScreen

**File**: `src/components/sessions/SessionProcessingScreen.tsx`
**Lines**: ~400
**Dependencies**: React, framer-motion, backgroundMediaProcessor

**Interface**:
```typescript
interface SessionProcessingScreenProps {
  sessionId: string;
}

export function SessionProcessingScreen({ sessionId }: SessionProcessingScreenProps) {
  const [stage, setStage] = useState<ProcessingStage>('concatenating-audio');
  const [progress, setProgress] = useState(0);
  const [canNavigate, setCanNavigate] = useState(false);

  useEffect(() => {
    // Subscribe to processing events
    const unsubscribe = subscribeToProcessing(sessionId, (event) => {
      setStage(event.stage);
      setProgress(event.progress);

      if (event.stage === 'complete') {
        setCanNavigate(true);
        // Auto-navigate after 2 seconds
        setTimeout(() => navigate(`/sessions/${sessionId}`), 2000);
      }
    });

    return unsubscribe;
  }, [sessionId]);

  return (
    <div className="processing-screen">
      {/* Content */}
    </div>
  );
}
```

**UI Layout**:
```
┌─────────────────────────────────────────┐
│                                         │
│           [Animated Spinner]            │
│                                         │
│       Processing Your Session           │
│                                         │
│  🎵 Combining audio segments...         │
│  ━━━━━━━━━━━━━━━━━━━━━━ 100%          │
│                                         │
│  🎬 Optimizing video with audio...      │
│  ━━━━━━━━━━░░░░░░░░░░ 60%             │
│  ~15 seconds remaining                  │
│                                         │
│  ℹ️  You can close this page           │
│     Enrichment will continue in         │
│     the background                      │
│                                         │
│  [View Session] ← appears when ready    │
│                                         │
└─────────────────────────────────────────┘
```

**Key Features**:
1. **Full-Screen Modal**: Takes over entire viewport
2. **Stage Indicators**: Shows current stage with checkmarks for completed
3. **Progress Bars**: Animated progress for each stage
4. **Time Estimates**: Shows estimated time remaining
5. **Non-Blocking**: User can navigate away via back button or close tab
6. **Auto-Navigate**: Automatically goes to session after 2 seconds when complete

### 9. EnrichmentStatusIndicator

**File**: `src/components/TopNavigation/EnrichmentStatusIndicator.tsx`
**Lines**: ~200
**Dependencies**: React, framer-motion, backgroundEnrichmentManager

**Interface**:
```typescript
export function EnrichmentStatusIndicator() {
  const [status, setStatus] = useState<QueueStatus>({ pending: 0, processing: 0, ... });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Poll status every 5 seconds
    const interval = setInterval(async () => {
      const status = await backgroundEnrichmentManager.getQueueStatus();
      setStatus(status);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const activeJobs = status.pending + status.processing;
  if (activeJobs === 0) return null; // Hide when no jobs

  return (
    <>
      <motion.div
        className="enrichment-indicator"
        onClick={() => setExpanded(!expanded)}
        whileHover={{ scale: 1.05 }}
      >
        <SpinnerIcon className="animate-spin" />
        <span>Enriching {activeJobs} session{activeJobs > 1 ? 's' : ''}...</span>
      </motion.div>

      {expanded && <EnrichmentPanel onClose={() => setExpanded(false)} />}
    </>
  );
}
```

**UI Layout** (Collapsed):
```
┌─────────────────────────────┐
│ 🔄 Enriching 3 sessions...  │ ← Compact badge in TopNavigation
└─────────────────────────────┘
```

**Key Features**:
1. **Compact Badge**: Shows spinner + count
2. **Auto-Hide**: Hides when no active jobs
3. **Click to Expand**: Opens EnrichmentPanel
4. **Animated**: Spinner rotates, subtle hover effect
5. **Always Visible**: Shows in TopNavigation on all pages

### 10. EnrichmentPanel

**File**: `src/components/enrichment/EnrichmentPanel.tsx`
**Lines**: ~500
**Dependencies**: React, framer-motion, backgroundEnrichmentManager

**Interface**:
```typescript
interface EnrichmentPanelProps {
  onClose: () => void;
}

export function EnrichmentPanel({ onClose }: EnrichmentPanelProps) {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);

  useEffect(() => {
    // Subscribe to job updates
    const unsubscribe = subscribeToJobUpdates((updatedJobs) => {
      setJobs(updatedJobs);
    });

    return unsubscribe;
  }, []);

  return (
    <motion.div
      className="enrichment-panel"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Content */}
    </motion.div>
  );
}
```

**UI Layout** (Expanded):
```
┌──────────────────────────────────────────────────┐
│  Enrichment Queue                       [Close]  │
├──────────────────────────────────────────────────┤
│  📊 3 active jobs, 2 completed, 0 failed         │
├──────────────────────────────────────────────────┤
│  Session A: Planning Project                     │
│  🎵 Audio Review                                 │
│  ━━━━━━━━━━━━━━━━━━ 90%                        │
│  [Cancel]                                        │
├──────────────────────────────────────────────────┤
│  Session B: Coding Feature                       │
│  🎬 Video Chaptering                             │
│  ━━━━━━━━░░░░░░░░░░ 40%                        │
│  [Cancel]                                        │
├──────────────────────────────────────────────────┤
│  Session C: Research                             │
│  ⏳ Waiting for media processing...              │
│  [Cancel]                                        │
├──────────────────────────────────────────────────┤
│  ✅ Session D: Bug Fixing (completed 2m ago)     │
│  [View Session]                                  │
└──────────────────────────────────────────────────┘
```

**Key Features**:
1. **Job List**: Shows all active + recent completed jobs
2. **Progress Bars**: Per-job progress with stage indicator
3. **Job Actions**: Cancel, retry, view session
4. **Status Summary**: Count of pending/processing/completed/failed
5. **Auto-Refresh**: Updates every 2 seconds
6. **Expandable**: Slides down from TopNavigation

### 11. UnifiedMediaPlayer (Simplified)

**File**: `src/components/UnifiedMediaPlayer.tsx` (existing - simplify)
**Lines**: ~800 → ~300 (remove 500 lines)

**Changes**:
```typescript
// BEFORE (Complex)
const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
const webAudioPlaybackRef = useRef<WebAudioPlayback | null>(null);

useEffect(() => {
  // Load and concatenate audio segments (283-402) ❌ REMOVE
  const loadAudio = async () => {
    const loader = new ProgressiveAudioLoader();
    await loader.initialize(session.id, session.startTime, audioSegments);
    const playback = new WebAudioPlayback(loader);
    webAudioPlaybackRef.current = playback;
  };
  loadAudio();
}, [session]);

useEffect(() => {
  // Sync audio to video (413-429) ❌ REMOVE
  const drift = Math.abs(webAudioPlaybackRef.current.getCurrentTime() - videoRef.current.currentTime);
  if (drift > SYNC_THRESHOLD) {
    webAudioPlaybackRef.current.seek(videoRef.current.currentTime);
  }
}, [currentTime]);

// AFTER (Simple)
const videoUrl = useMemo(() => {
  if (session.video?.optimizedPath) {
    // New sessions: Use optimized MP4 with audio
    return convertFileSrc(session.video.optimizedPath);
  } else if (session.video?.path) {
    // Legacy sessions: Use original video (no audio) + separate audio
    return convertFileSrc(session.video.path);
  }
  return null;
}, [session]);

const hasAudio = session.video?.optimizedPath || session.audioSegments.length > 0;

return (
  <div className="unified-media-player">
    {session.video?.optimizedPath ? (
      // New sessions: Single video element with audio ✅ SIMPLE
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
      />
    ) : (
      // Legacy sessions: Fallback to old implementation
      <LegacyMediaPlayer session={session} />
    )}
  </div>
);
```

**Key Changes**:
1. **Remove Audio Concatenation** (lines 283-402)
2. **Remove Sync Logic** (lines 413-429)
3. **Remove Web Audio API** (WebAudioPlayback, ProgressiveAudioLoader)
4. **Add Optimized Video Path Check**
5. **Fallback to Legacy** for old sessions without optimizedPath
6. **Simplify State** (no audio buffer, no sync refs)

**Result**: ~500 lines removed, much simpler!

---

## Implementation Phases

### Phase 1: Foundation (Backend Services)

**Goal**: Build persistent job queue and media processing infrastructure

**Tasks**:
1. Create `PersistentEnrichmentQueue.ts` with IndexedDB storage
2. Create `BackgroundEnrichmentManager.ts` singleton
3. Create `BackgroundMediaProcessor.ts` orchestrator
4. Add IndexedDB schema and migrations
5. Write unit tests for queue operations

**Deliverables**:
- ✅ Persistent job queue with IndexedDB
- ✅ Background enrichment manager singleton
- ✅ Media processor orchestrator
- ✅ Unit tests (>80% coverage)

**Agent**: `general-purpose` (complex multi-file task)

**Estimated Time**: 8-10 hours

---

### Phase 2: Video/Audio Merging (Swift + Rust)

**Goal**: Implement video/audio merging with compression

**Tasks**:
1. Create `VideoAudioMerger.swift` with AVFoundation
2. Create `video_audio_merger.rs` FFI wrapper
3. Add `merge_video_and_audio` Tauri command
4. Create `videoAudioMergerService.ts` TypeScript wrapper
5. Test with sample video/audio files
6. Benchmark compression ratios and timing

**Deliverables**:
- ✅ Swift merger with progress reporting
- ✅ Rust FFI wrapper with safety checks
- ✅ Tauri command registration
- ✅ TypeScript service wrapper
- ✅ Compression benchmark report

**Agent**: `general-purpose` (multi-language FFI task)

**Estimated Time**: 10-12 hours

---

### Phase 3: UI Components (Processing Screen + Indicator)

**Goal**: Build processing screen and global enrichment indicator

**Tasks**:
1. Create `SessionProcessingScreen.tsx` full-screen modal
2. Create `EnrichmentStatusIndicator.tsx` compact badge
3. Create `EnrichmentPanel.tsx` expandable panel
4. Add animations with framer-motion
5. Add event subscriptions for real-time updates
6. Add auto-navigation logic

**Deliverables**:
- ✅ Processing screen with stage indicators
- ✅ Global enrichment status badge
- ✅ Expandable enrichment panel
- ✅ Smooth animations
- ✅ Real-time progress updates

**Agent**: `general-purpose` (React + animation task)

**Estimated Time**: 6-8 hours

---

### Phase 4: Integration (Context Updates)

**Goal**: Wire everything together in session end flow

**Tasks**:
1. Update `ActiveSessionContext.tsx` endSession() flow
2. Update `App.tsx` to initialize BackgroundEnrichmentManager
3. Add `/sessions/:id/processing` route
4. Update `SessionsZone.tsx` to handle processing state
5. Update session types to include `optimizedPath`
6. Test full end-to-end flow

**Deliverables**:
- ✅ Updated session end flow
- ✅ Background manager initialization
- ✅ Processing route added
- ✅ Type definitions updated
- ✅ End-to-end test passing

**Agent**: `general-purpose` (integration task)

**Estimated Time**: 4-6 hours

---

### Phase 5: Player Simplification (Remove Sync Logic)

**Goal**: Simplify UnifiedMediaPlayer to use optimized video

**Tasks**:
1. Remove audio concatenation logic (lines 283-402)
2. Remove audio/video sync logic (lines 413-429)
3. Add optimizedPath check and fallback
4. Create `LegacyMediaPlayer.tsx` for old sessions
5. Test with both new and legacy sessions
6. Update documentation

**Deliverables**:
- ✅ Simplified UnifiedMediaPlayer (~500 lines removed)
- ✅ Legacy player for backward compatibility
- ✅ Tested with new and old sessions
- ✅ Updated component documentation

**Agent**: `general-purpose` (refactoring task)

**Estimated Time**: 4-6 hours

---

### Phase 6: Testing & Polish

**Goal**: Comprehensive testing and bug fixes

**Tasks**:
1. Test media processing with various session lengths
2. Test enrichment queue persistence (app restart)
3. Test concurrent enrichment (multiple sessions)
4. Test error handling and retry logic
5. Test navigation during processing
6. Performance profiling and optimization
7. Update all documentation

**Deliverables**:
- ✅ All edge cases tested
- ✅ Performance benchmarks
- ✅ Error handling verified
- ✅ Documentation complete
- ✅ Known issues list

**Agent**: `general-purpose` (testing task)

**Estimated Time**: 6-8 hours

---

**Total Estimated Time**: 38-50 hours

---

## Agent Task Assignments

### Task 1: Persistent Enrichment Queue (Phase 1)

**Agent**: `general-purpose`
**Estimated Time**: 8-10 hours
**Priority**: High (foundation)

**Objective**: Create persistent job queue with IndexedDB storage that survives app restart.

**Requirements**:
1. Create `src/services/enrichment/PersistentEnrichmentQueue.ts`
2. Implement IndexedDB schema with `enrichment_jobs` object store
3. Implement job lifecycle: enqueue → process → complete/fail
4. Implement auto-resume on initialization (load pending jobs)
5. Implement priority queue (high → normal → low, FIFO within priority)
6. Implement event emission for UI updates
7. Implement error isolation (one job failure doesn't block others)
8. Implement retry logic (3 attempts with exponential backoff)
9. Write comprehensive unit tests (>80% coverage)

**Research Tasks**:
1. Study existing `ParallelEnrichmentQueue.ts` implementation
2. Research IndexedDB best practices for job queues
3. Review error handling patterns in codebase
4. Study event emission patterns (EventEmitter vs custom)

**Deliverables**:
- [ ] `PersistentEnrichmentQueue.ts` (~800 lines)
- [ ] `PersistentEnrichmentQueue.test.ts` (~400 lines)
- [ ] IndexedDB schema documentation
- [ ] API documentation (JSDoc comments)

**Acceptance Criteria**:
- ✅ Jobs persist across app restart
- ✅ Pending jobs auto-resume on initialize()
- ✅ Priority queue processes highest priority first
- ✅ One job failure doesn't block others
- ✅ Failed jobs retry up to 3 times
- ✅ Events emit for all state transitions
- ✅ Unit tests pass with >80% coverage

---

### Task 2: Background Enrichment Manager (Phase 1)

**Agent**: `general-purpose`
**Estimated Time**: 4-6 hours
**Priority**: High (foundation)
**Depends On**: Task 1

**Objective**: Create singleton orchestrator for background enrichment.

**Requirements**:
1. Create `src/services/enrichment/BackgroundEnrichmentManager.ts`
2. Implement singleton pattern with lazy initialization
3. Implement job enqueueing API with validation
4. Implement media processing callback handlers
5. Implement status query methods
6. Implement notification system (OS-level)
7. Implement event forwarding to UI

**Research Tasks**:
1. Study existing singleton patterns in codebase
2. Review notification APIs (Web Notification API vs Tauri)
3. Study event forwarding patterns

**Deliverables**:
- [ ] `BackgroundEnrichmentManager.ts` (~400 lines)
- [ ] `BackgroundEnrichmentManager.test.ts` (~200 lines)
- [ ] Integration tests with PersistentEnrichmentQueue

**Acceptance Criteria**:
- ✅ Singleton instance accessible globally
- ✅ Initializes on app launch
- ✅ Job enqueueing validated before submission
- ✅ Notifications shown on enrichment complete
- ✅ Status queries return accurate data
- ✅ Integration tests pass

---

### Task 3: Background Media Processor (Phase 1)

**Agent**: `general-purpose`
**Estimated Time**: 6-8 hours
**Priority**: High (foundation)
**Depends On**: None (independent)

**Objective**: Create orchestrator for video/audio processing.

**Requirements**:
1. Create `src/services/enrichment/BackgroundMediaProcessor.ts`
2. Implement audio concatenation wrapper (uses existing service)
3. Implement video/audio merge orchestration
4. Implement progress tracking and callbacks
5. Implement error handling and cleanup
6. Implement singleton pattern

**Research Tasks**:
1. Study `audioConcatenationService.ts` exportAsWAV() method
2. Review path management patterns in codebase
3. Study error handling and cleanup patterns

**Deliverables**:
- [ ] `BackgroundMediaProcessor.ts` (~500 lines)
- [ ] `BackgroundMediaProcessor.test.ts` (~300 lines)
- [ ] Integration tests with audioConcatenationService

**Acceptance Criteria**:
- ✅ Audio concatenation completes in <5 seconds
- ✅ Progress callbacks fire correctly
- ✅ Cleanup occurs on error
- ✅ Singleton accessible globally
- ✅ Integration tests pass

---

### Task 4: Swift Video/Audio Merger (Phase 2)

**Agent**: `general-purpose`
**Estimated Time**: 8-10 hours
**Priority**: High (critical path)
**Depends On**: None (independent)

**Objective**: Implement video/audio merging using AVFoundation.

**Requirements**:
1. Create `src-tauri/ScreenRecorder/VideoAudioMerger.swift`
2. Implement AVMutableComposition merging
3. Implement AVAssetExportSession with quality presets
4. Implement progress reporting (0.0 - 1.0)
5. Implement error handling with detailed messages
6. Add C FFI exports

**Research Tasks**:
1. Study AVMutableComposition documentation
2. Research AVAssetExportSession quality presets
3. Review existing Swift FFI patterns in `ScreenRecorder.swift`
4. Study compression ratios for different presets
5. Research progress reporting patterns

**Deliverables**:
- [ ] `VideoAudioMerger.swift` (~300 lines)
- [ ] Swift unit tests (if feasible)
- [ ] C FFI header file
- [ ] Compression benchmark report

**Acceptance Criteria**:
- ✅ Merges video + audio successfully
- ✅ Output file size ~40% of input (medium quality)
- ✅ Progress reports correctly (0.0 → 1.0)
- ✅ Handles errors gracefully
- ✅ FFI exports compile successfully
- ✅ Benchmark shows 30-40s for 30-min video

---

### Task 5: Rust FFI Wrapper (Phase 2)

**Agent**: `general-purpose`
**Estimated Time**: 6-8 hours
**Priority**: High (critical path)
**Depends On**: Task 4

**Objective**: Create safe Rust wrapper for Swift video/audio merger.

**Requirements**:
1. Create `src-tauri/src/recording/video_audio_merger.rs`
2. Implement FFI declarations (extern "C")
3. Implement safe Rust wrapper with CString conversion
4. Implement async wrapper for synchronous Swift call
5. Implement callback handling (progress, completion)
6. Implement error type translation
7. Add comprehensive error handling

**Research Tasks**:
1. Study existing FFI patterns in `recording/ffi.rs`
2. Review CString safety patterns
3. Study async callback patterns in Rust
4. Review error handling patterns in codebase

**Deliverables**:
- [ ] `video_audio_merger.rs` (~400 lines)
- [ ] Rust unit tests (~200 lines)
- [ ] FFI safety documentation

**Acceptance Criteria**:
- ✅ FFI calls succeed without crashes
- ✅ CString conversion safe (no memory leaks)
- ✅ Async wrapper works correctly
- ✅ Callbacks handled properly
- ✅ Errors translated correctly
- ✅ Unit tests pass

---

### Task 6: TypeScript Merger Service (Phase 2)

**Agent**: `general-purpose`
**Estimated Time**: 4-6 hours
**Priority**: Medium
**Depends On**: Task 5

**Objective**: Create TypeScript wrapper for Tauri merge command.

**Requirements**:
1. Create `src/services/videoAudioMergerService.ts`
2. Implement merge wrapper with invoke()
3. Implement path validation
4. Implement progress polling (Swift doesn't stream)
5. Implement output path generation
6. Implement error handling

**Research Tasks**:
1. Study existing Tauri service wrappers
2. Review path validation patterns
3. Study polling patterns for progress

**Deliverables**:
- [ ] `videoAudioMergerService.ts` (~300 lines)
- [ ] `videoAudioMergerService.test.ts` (~200 lines)
- [ ] Integration test with Tauri command

**Acceptance Criteria**:
- ✅ Merge command invoked correctly
- ✅ Path validation prevents errors
- ✅ Progress polling works smoothly
- ✅ Errors handled gracefully
- ✅ Integration test passes

---

### Task 7: Tauri Merge Command (Phase 2)

**Agent**: `general-purpose`
**Estimated Time**: 3-4 hours
**Priority**: Medium
**Depends On**: Task 5

**Objective**: Add merge_video_and_audio Tauri command.

**Requirements**:
1. Update `src-tauri/src/video_recording.rs`
2. Add `merge_video_and_audio` command
3. Add `get_merge_progress` command
4. Register commands in `main.rs`
5. Add error handling and logging

**Research Tasks**:
1. Review existing Tauri command patterns
2. Study command registration in `main.rs`

**Deliverables**:
- [ ] Updated `video_recording.rs` (+150 lines)
- [ ] Updated `main.rs` (command registration)
- [ ] Integration test

**Acceptance Criteria**:
- ✅ Command registered successfully
- ✅ Command invokable from TypeScript
- ✅ Progress query works
- ✅ Errors logged correctly
- ✅ Integration test passes

---

### Task 8: Session Processing Screen (Phase 3)

**Agent**: `general-purpose`
**Estimated Time**: 6-8 hours
**Priority**: High (user-facing)
**Depends On**: Task 3

**Objective**: Build full-screen processing modal with progress display.

**Requirements**:
1. Create `src/components/sessions/SessionProcessingScreen.tsx`
2. Implement full-screen modal layout
3. Implement stage indicators with animations
4. Implement progress bars with framer-motion
5. Implement event subscriptions for updates
6. Implement auto-navigation on complete
7. Add disclaimer about background processing

**Research Tasks**:
1. Study existing modal patterns in codebase
2. Review framer-motion animation patterns
3. Study event subscription patterns

**Deliverables**:
- [ ] `SessionProcessingScreen.tsx` (~400 lines)
- [ ] Styles (Tailwind classes)
- [ ] Component tests (~200 lines)

**Acceptance Criteria**:
- ✅ Full-screen modal displays correctly
- ✅ Progress updates in real-time
- ✅ Auto-navigates after 2 seconds when complete
- ✅ User can navigate away manually
- ✅ Animations smooth (60fps)
- ✅ Component tests pass

---

### Task 9: Enrichment Status Indicator (Phase 3)

**Agent**: `general-purpose`
**Estimated Time**: 4-6 hours
**Priority**: High (user-facing)
**Depends On**: Task 2

**Objective**: Build compact status badge for TopNavigation.

**Requirements**:
1. Create `src/components/TopNavigation/EnrichmentStatusIndicator.tsx`
2. Implement compact badge with spinner
3. Implement status polling (every 5 seconds)
4. Implement auto-hide when no jobs
5. Implement click to expand panel
6. Add animations with framer-motion

**Research Tasks**:
1. Study TopNavigation component structure
2. Review existing badge components
3. Study polling patterns for status updates

**Deliverables**:
- [ ] `EnrichmentStatusIndicator.tsx` (~200 lines)
- [ ] Styles (Tailwind classes)
- [ ] Component tests (~100 lines)

**Acceptance Criteria**:
- ✅ Badge displays in TopNavigation
- ✅ Status updates every 5 seconds
- ✅ Auto-hides when no jobs
- ✅ Click expands EnrichmentPanel
- ✅ Animations smooth
- ✅ Component tests pass

---

### Task 10: Enrichment Panel (Phase 3)

**Agent**: `general-purpose`
**Estimated Time**: 6-8 hours
**Priority**: Medium (user-facing)
**Depends On**: Task 9

**Objective**: Build expandable panel showing all enrichment jobs.

**Requirements**:
1. Create `src/components/enrichment/EnrichmentPanel.tsx`
2. Implement expandable panel layout
3. Implement job list with progress bars
4. Implement job actions (cancel, retry, view)
5. Implement auto-refresh (every 2 seconds)
6. Add animations with framer-motion

**Research Tasks**:
1. Study existing panel/drawer components
2. Review job action patterns
3. Study refresh patterns

**Deliverables**:
- [ ] `EnrichmentPanel.tsx` (~500 lines)
- [ ] Styles (Tailwind classes)
- [ ] Component tests (~250 lines)

**Acceptance Criteria**:
- ✅ Panel expands from TopNavigation
- ✅ Job list displays correctly
- ✅ Progress bars update in real-time
- ✅ Job actions work (cancel, retry, view)
- ✅ Auto-refreshes every 2 seconds
- ✅ Component tests pass

---

### Task 11: Context Integration (Phase 4)

**Agent**: `general-purpose`
**Estimated Time**: 4-6 hours
**Priority**: High (integration)
**Depends On**: Tasks 1, 2, 3, 8

**Objective**: Wire background enrichment into session end flow.

**Requirements**:
1. Update `src/context/ActiveSessionContext.tsx`
2. Modify `endSession()` to navigate to processing screen
3. Integrate BackgroundMediaProcessor
4. Integrate BackgroundEnrichmentManager
5. Update type definitions (add `optimizedPath`)
6. Write integration tests

**Research Tasks**:
1. Study existing endSession() implementation
2. Review context update patterns
3. Study type definition conventions

**Deliverables**:
- [ ] Updated `ActiveSessionContext.tsx` (~100 lines changed)
- [ ] Updated `types.ts` (SessionVideo interface)
- [ ] Integration tests (~300 lines)

**Acceptance Criteria**:
- ✅ endSession() navigates to processing screen
- ✅ Media processing starts automatically
- ✅ Enrichment job created automatically
- ✅ Type definitions updated
- ✅ Integration tests pass

---

### Task 12: App Initialization (Phase 4)

**Agent**: `general-purpose`
**Estimated Time**: 2-3 hours
**Priority**: High (integration)
**Depends On**: Task 2

**Objective**: Initialize background enrichment manager on app launch.

**Requirements**:
1. Update `src/App.tsx`
2. Add initialization in useEffect
3. Add `/sessions/:id/processing` route
4. Add global error boundary
5. Test initialization

**Research Tasks**:
1. Study existing App.tsx initialization patterns
2. Review route definitions

**Deliverables**:
- [ ] Updated `App.tsx` (~50 lines changed)
- [ ] Initialization test

**Acceptance Criteria**:
- ✅ BackgroundEnrichmentManager initializes on mount
- ✅ Processing route accessible
- ✅ Pending jobs resume automatically
- ✅ Initialization test passes

---

### Task 13: UnifiedMediaPlayer Simplification (Phase 5)

**Agent**: `general-purpose`
**Estimated Time**: 4-6 hours
**Priority**: Medium (refactoring)
**Depends On**: Task 11

**Objective**: Simplify UnifiedMediaPlayer to use optimized video.

**Requirements**:
1. Update `src/components/UnifiedMediaPlayer.tsx`
2. Remove audio concatenation logic (lines 283-402)
3. Remove audio/video sync logic (lines 413-429)
4. Add optimizedPath check and fallback
5. Create `LegacyMediaPlayer.tsx` for old sessions
6. Test with both new and legacy sessions

**Research Tasks**:
1. Study existing UnifiedMediaPlayer implementation
2. Identify all audio concatenation dependencies
3. Plan fallback strategy for legacy sessions

**Deliverables**:
- [ ] Updated `UnifiedMediaPlayer.tsx` (~500 lines removed)
- [ ] `LegacyMediaPlayer.tsx` (~400 lines)
- [ ] Component tests (~200 lines)

**Acceptance Criteria**:
- ✅ New sessions play optimized video
- ✅ Legacy sessions fallback to old player
- ✅ ~500 lines removed from UnifiedMediaPlayer
- ✅ Both players tested and working
- ✅ Component tests pass

---

### Task 14: End-to-End Testing (Phase 6)

**Agent**: `general-purpose`
**Estimated Time**: 6-8 hours
**Priority**: High (quality)
**Depends On**: All previous tasks

**Objective**: Comprehensive testing of entire system.

**Test Cases**:
1. **Happy Path**: End session → media processing → enrichment → complete
2. **Navigation During Processing**: Navigate away during media processing
3. **App Restart**: Restart app during enrichment, verify resume
4. **Multiple Sessions**: Enrich 3 sessions concurrently
5. **Error Handling**: Trigger various errors, verify retry
6. **Legacy Sessions**: Verify old sessions still play correctly
7. **Performance**: Benchmark processing times

**Research Tasks**:
1. Study existing test patterns
2. Review performance benchmarking tools
3. Study error injection patterns

**Deliverables**:
- [ ] Test suite (~800 lines)
- [ ] Performance benchmark report
- [ ] Known issues list
- [ ] Test coverage report

**Acceptance Criteria**:
- ✅ All test cases pass
- ✅ Performance within targets
- ✅ Error handling verified
- ✅ Test coverage >80%

---

### Task 15: Documentation (Phase 6)

**Agent**: `general-purpose`
**Estimated Time**: 3-4 hours
**Priority**: Medium (documentation)
**Depends On**: All previous tasks

**Objective**: Update all documentation.

**Documents to Update**:
1. `CLAUDE.md` - Add architecture overview
2. `ARCHITECTURE.md` - Add detailed component docs
3. `docs/sessions-rewrite/README.md` - Update status
4. API documentation (JSDoc comments)
5. User guide updates

**Deliverables**:
- [ ] Updated `CLAUDE.md`
- [ ] Updated `ARCHITECTURE.md`
- [ ] Updated README files
- [ ] Complete JSDoc coverage
- [ ] User guide updates

**Acceptance Criteria**:
- ✅ All documentation accurate
- ✅ JSDoc complete
- ✅ Examples included
- ✅ Diagrams updated

---

## Integration Phase Deep Dive

### Overview

Integration is the **most critical and risky phase**. This section provides exhaustive detail on every file that needs to change, every integration point, and every potential flow-on impact.

**Integration Principles**:
1. **Change files in dependency order** (bottom-up: services → contexts → components → app)
2. **Test each integration point independently** before moving to next
3. **Maintain backward compatibility** at every step (dual-path logic)
4. **Add feature flags** for gradual rollout
5. **Have rollback strategy** for each integration point

---

### Integration Point 1: Type System Updates

**Priority**: Critical (must happen first)
**Risk**: High (breaks entire codebase if wrong)

**Files to Change**:

1. **`src/types.ts`** (PRIMARY)
   ```typescript
   // CHANGE: Add optimizedPath to SessionVideo interface
   export interface SessionVideo {
     path: string;                    // Original video (no audio) - KEEP
     optimizedPath?: string;          // NEW - Merged video+audio (compressed)
     fullVideoAttachmentId: string;   // KEEP
     duration: number;                // KEEP
     chapters?: VideoChapter[];       // KEEP

     // Keep originals for processing
     originalVideoPath?: string;      // NEW - Backup of original
     originalAudioPath?: string;      // NEW - Concatenated audio path
   }

   // CHANGE: Add media processing status to Session
   export interface Session {
     // ... existing fields
     video?: SessionVideo;

     // NEW - Media processing tracking
     mediaProcessingStatus?: {
       status: 'pending' | 'processing' | 'complete' | 'failed';
       progress: number;
       stage: 'concatenating' | 'merging' | 'complete';
       error?: string;
       startedAt?: number;
       completedAt?: number;
     };
   }
   ```

2. **`src/services/enrichment/types.ts`** (NEW FILE)
   ```typescript
   // NEW - Enrichment job types (separate from main types.ts)
   export interface EnrichmentJob {
     id: string;
     sessionId: string;
     sessionName: string;
     status: JobStatus;
     priority: JobPriority;
     // ... (full interface from plan)
   }
   ```

**Flow-On Impacts**:
- ❌ **BREAKING**: All Session serialization/deserialization must handle new fields
- ❌ **BREAKING**: TypeScript compilation will fail for all files referencing SessionVideo
- ✅ **SAFE**: New fields are optional, so existing sessions still valid
- ⚠️ **WARNING**: Need migration for ChunkedSessionStorage schema

**Files Affected by Type Changes** (compile errors if not updated):
- `src/components/UnifiedMediaPlayer.tsx` (reads `session.video`)
- `src/components/sessions/SessionCard.tsx` (displays video info)
- `src/components/sessions/SessionDetailView.tsx` (displays video info)
- `src/context/SessionListContext.tsx` (CRUD operations)
- `src/context/ActiveSessionContext.tsx` (session creation)
- `src/services/sessionEnrichmentService.ts` (reads session data)
- `src/services/videoStorageService.ts` (creates video attachments)
- `src/services/videoRecordingService.ts` (saves video metadata)

**Testing Strategy**:
1. ✅ Change types.ts
2. ✅ Run TypeScript compiler (`npm run type-check`)
3. ✅ Fix ALL compilation errors (should be minimal - just add undefined checks)
4. ✅ Run all tests (`npm test`)
5. ✅ Manually test existing sessions still load

**Rollback Strategy**:
- If breaks too much, make all new fields optional and add later
- Use feature flag: `ENABLE_OPTIMIZED_VIDEO`

---

### Integration Point 2: Storage Layer Coordination

**Priority**: Critical (data persistence)
**Risk**: High (data loss if wrong)

**Files to Change**:

1. **`src/services/storage/ChunkedSessionStorage.ts`** (UPDATE)
   - Add `optimizedPath` to metadata schema
   - Update `saveMetadata()` to include new fields
   - Update `loadMetadata()` to handle missing fields (backward compat)

2. **`src/services/storage/ContentAddressableStorage.ts`** (UPDATE?)
   - Question: Should optimized video be in CA storage?
   - Answer: NO - too large, keep on disk like original video
   - No changes needed

3. **NEW: `src/services/storage/EnrichmentJobStorage.ts`** (NEW)
   ```typescript
   // Wrapper for IndexedDB enrichment_jobs store
   class EnrichmentJobStorage {
     private db: IDBDatabase;

     async initialize(): Promise<void> {
       // Open/create IndexedDB database
     }

     async saveJob(job: EnrichmentJob): Promise<void>;
     async getJob(id: string): Promise<EnrichmentJob | null>;
     async getAllJobs(): Promise<EnrichmentJob[]>;
     async updateJob(id: string, updates: Partial<EnrichmentJob>): Promise<void>;
     async deleteJob(id: string): Promise<void>;
   }
   ```

**IndexedDB Schema**:
```typescript
Database: taskerino-enrichment (NEW)
Version: 1

Object Stores:
- enrichment_jobs
  - keyPath: 'id'
  - indexes:
    - status (non-unique)
    - sessionId (unique) ← CRITICAL: Only one job per session
    - priority (non-unique)
    - createdAt (non-unique)
    - startedAt (non-unique)
```

**Flow-On Impacts**:
- ⚠️ **TWO IndexedDB databases**: `taskerino` (sessions) + `taskerino-enrichment` (jobs)
- ⚠️ **Coordination needed**: Session updates must trigger job updates
- ⚠️ **Cleanup needed**: Deleting session must delete job
- ⚠️ **Migration needed**: Existing in-flight enrichments lost (acceptable)

**Coordination Matrix**:
| Operation | Session Storage | Enrichment Storage | Who Triggers? |
|-----------|----------------|-------------------|---------------|
| Create session | Save metadata | No change | ActiveSessionContext |
| End session | Save metadata | Create job | ActiveSessionContext |
| Media processing complete | Update metadata | Update job | BackgroundMediaProcessor |
| Enrichment starts | No change | Update job | PersistentEnrichmentQueue |
| Enrichment progress | No change | Update job | PersistentEnrichmentQueue |
| Enrichment complete | Save enrichment data | Update job | SessionListContext |
| Delete session | Delete session | Delete job | SessionListContext |

**Testing Strategy**:
1. ✅ Create job → restart app → verify job still exists
2. ✅ Create job → delete session → verify job deleted
3. ✅ Update session → verify doesn't break job
4. ✅ Concurrent updates → verify no race conditions

**Rollback Strategy**:
- If IndexedDB fails, fallback to in-memory queue (lose persistence)
- Add feature flag: `ENABLE_PERSISTENT_QUEUE`

---

### Integration Point 3: Session End Flow (Most Complex)

**Priority**: Critical (main user flow)
**Risk**: Very High (touches 10+ files)

**Complete Call Chain**:
```
User clicks "End Session"
  ↓
SessionsZone.tsx - onClick handler
  ↓
ActiveSessionContext.tsx - endSession()
  ↓
┌─────────────────────────────────────┐
│ EXISTING LOGIC (keep)               │
├─────────────────────────────────────┤
│ 1. Stop screenshot service          │
│ 2. Stop audio recording             │
│ 3. Stop video recording             │
│ 4. Save session metadata            │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ NEW LOGIC (add)                     │
├─────────────────────────────────────┤
│ 5. Navigate to processing screen    │
│ 6. Start BackgroundMediaProcessor   │
│ 7. Create enrichment job (waiting)  │
└─────────────────────────────────────┘
  ↓
BackgroundMediaProcessor.process()
  ↓
┌─────────────────────────────────────┐
│ Stage 1: Concatenate Audio          │
├─────────────────────────────────────┤
│ - Call audioConcatenationService    │
│ - Save MP3 to disk                  │
│ - Emit progress: 50%                │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ Stage 2: Merge Video + Audio        │
├─────────────────────────────────────┤
│ - Call videoAudioMergerService      │
│ - Invoke Tauri command              │
│ - Swift merges with AVFoundation    │
│ - Save optimized MP4                │
│ - Emit progress: 100%               │
└─────────────────────────────────────┘
  ↓
BackgroundMediaProcessor.onComplete()
  ↓
┌─────────────────────────────────────┐
│ Finalize                            │
├─────────────────────────────────────┤
│ - Update session.video.optimizedPath│
│ - Save session to storage           │
│ - Mark job as ready for enrichment  │
│ - Update processing screen: "Ready!"│
└─────────────────────────────────────┘
  ↓
SessionProcessingScreen auto-navigates
  ↓
User sees session summary
  ↓
(Background enrichment starts automatically)
```

**Files to Change** (in order):

1. **`src/context/ActiveSessionContext.tsx`** (CRITICAL CHANGES)
   ```typescript
   // BEFORE
   async function endSession() {
     // Stop services
     await recordingService.stopAll();

     // Save session
     session.status = 'completed';
     await sessionListContext.updateSession(session.id, session);

     // Navigate
     navigate('/sessions');
   }

   // AFTER
   async function endSession() {
     // 1. Stop services (KEEP)
     const videoPath = await recordingService.stopVideo();
     await recordingService.stopAudio();
     await recordingService.stopScreenshots();

     // 2. Save session (KEEP)
     session.status = 'completed';
     session.mediaProcessingStatus = {
       status: 'pending',
       progress: 0,
       stage: 'concatenating',
       startedAt: Date.now()
     };
     await sessionListContext.updateSession(session.id, session);

     // 3. Navigate to processing screen (NEW)
     navigate(`/sessions/${session.id}/processing`);

     // 4. Start media processing in background (NEW)
     backgroundMediaProcessor.process({
       sessionId: session.id,
       sessionName: session.name,
       videoPath,
       audioSegments: session.audioSegments,
       onProgress: (stage, progress) => {
         // Emit event for processing screen
         eventBus.emit('media-processing-progress', {
           sessionId: session.id,
           stage,
           progress
         });
       },
       onComplete: async (optimizedVideoPath) => {
         // 5. Update session with optimized path (NEW)
         await sessionListContext.updateSession(session.id, {
           video: {
             ...session.video,
             optimizedPath: optimizedVideoPath
           },
           mediaProcessingStatus: {
             status: 'complete',
             progress: 100,
             stage: 'complete',
             completedAt: Date.now()
           }
         });

         // 6. Mark media processing complete - triggers enrichment (NEW)
         await backgroundEnrichmentManager.markMediaProcessingComplete(
           session.id,
           optimizedVideoPath
         );

         // 7. Emit complete event (NEW)
         eventBus.emit('media-processing-complete', {
           sessionId: session.id,
           optimizedPath: optimizedVideoPath
         });
       },
       onError: async (error) => {
         // Handle error
         await sessionListContext.updateSession(session.id, {
           mediaProcessingStatus: {
             status: 'failed',
             error: error.message
           }
         });
       }
     });
   }
   ```

2. **`src/context/RecordingContext.tsx`** (UPDATE)
   - Change `stopAll()` to return video path
   - Add `getVideoPath()` method

3. **`src/services/videoRecordingService.ts`** (UPDATE)
   - Ensure `stopRecording()` returns video file path
   - Already does this - verify it works

4. **`src/App.tsx`** (ADD ROUTE)
   ```typescript
   // Add new route
   <Route
     path="/sessions/:id/processing"
     element={<SessionProcessingScreen />}
   />
   ```

5. **`src/main.tsx`** (ADD PROVIDER?)
   - Question: Do we need EnrichmentJobProvider?
   - Answer: NO - BackgroundEnrichmentManager is singleton, uses events

6. **NEW: `src/utils/eventBus.ts`** (NEW)
   ```typescript
   // Simple event bus for cross-component communication
   class EventBus {
     private listeners = new Map<string, Set<Function>>();

     on(event: string, handler: Function) {
       if (!this.listeners.has(event)) {
         this.listeners.set(event, new Set());
       }
       this.listeners.get(event)!.add(handler);

       // Return unsubscribe function
       return () => this.off(event, handler);
     }

     off(event: string, handler: Function) {
       this.listeners.get(event)?.delete(handler);
     }

     emit(event: string, data: any) {
       this.listeners.get(event)?.forEach(handler => handler(data));
     }
   }

   export const eventBus = new EventBus();
   ```

**Flow-On Impacts**:
- ⚠️ **Navigation change**: User sees different screen after ending session
- ⚠️ **Timing change**: Session marked complete immediately, enrichment happens later
- ⚠️ **Event coordination**: Multiple event emitters (media processor, enrichment queue)
- ⚠️ **Error handling**: Need to handle failures at each stage

**Testing Strategy**:
1. ✅ End session → verify processing screen appears
2. ✅ End session → close app → verify session saved correctly
3. ✅ End session → navigate away → verify processing continues
4. ✅ End session → trigger error → verify error handling
5. ✅ End session with video only → verify works
6. ✅ End session with audio only → verify works
7. ✅ End session with both → verify works

**Rollback Strategy**:
- Add feature flag: `ENABLE_MEDIA_PROCESSING`
- If false, skip media processing and go straight to enrichment

---

### Integration Point 4: Event Coordination (Critical)

**Priority**: High (prevents race conditions)
**Risk**: Medium (subtle bugs)

**Problem**: Multiple event sources emitting similar events

**Event Sources**:
1. `BackgroundMediaProcessor` → media processing progress
2. `PersistentEnrichmentQueue` → enrichment progress
3. `SessionListContext` → session updates
4. `ActiveSessionContext` → session lifecycle

**Event Types Needed**:
```typescript
// Media processing events
'media-processing-started' → { sessionId, sessionName }
'media-processing-progress' → { sessionId, stage, progress }
'media-processing-complete' → { sessionId, optimizedPath }
'media-processing-failed' → { sessionId, error }

// Enrichment events
'enrichment-job-created' → { jobId, sessionId }
'enrichment-job-started' → { jobId, sessionId }
'enrichment-job-progress' → { jobId, sessionId, stage, progress }
'enrichment-job-completed' → { jobId, sessionId, result }
'enrichment-job-failed' → { jobId, sessionId, error }

// Session events (existing - keep)
'session-created' → { session }
'session-updated' → { sessionId, updates }
'session-deleted' → { sessionId }
```

**Coordination Strategy**:

1. **Use EventBus singleton** (NEW - `src/utils/eventBus.ts`)
   - All events go through single event bus
   - Components subscribe to events they care about
   - No direct component-to-component communication

2. **Event naming convention**:
   - Prefix: `media-processing-*`, `enrichment-*`, `session-*`
   - Always include `sessionId` or `jobId`
   - Use past tense for completed events (`-completed`, not `-complete`)

3. **Memory leak prevention**:
   - All subscriptions return unsubscribe function
   - Components MUST unsubscribe in cleanup (useEffect return)
   - EventBus tracks active listeners (for debugging)

**Files Using EventBus**:
- `ActiveSessionContext.tsx` - emit media processing events
- `BackgroundMediaProcessor.ts` - emit progress events
- `PersistentEnrichmentQueue.ts` - emit enrichment events
- `SessionProcessingScreen.tsx` - subscribe to media processing events
- `EnrichmentStatusIndicator.tsx` - subscribe to enrichment events
- `EnrichmentPanel.tsx` - subscribe to enrichment events

**Testing Strategy**:
1. ✅ Subscribe → emit → verify handler called
2. ✅ Subscribe → unsubscribe → emit → verify handler NOT called
3. ✅ Multiple subscribers → emit → verify all called
4. ✅ Component unmount → verify unsubscribe called (no memory leak)

---

### Integration Point 5: UI Component Wiring

**Priority**: Medium (visual, less risky)
**Risk**: Low (mostly presentational)

**Component Hierarchy**:
```
App.tsx
├─ TopNavigation/
│  ├─ EnrichmentStatusIndicator (NEW)
│  └─ (click) → EnrichmentPanel (NEW)
├─ Routes
   ├─ /sessions → SessionsZone
   ├─ /sessions/:id → SessionDetailView
   │  └─ UnifiedMediaPlayer (UPDATED)
   └─ /sessions/:id/processing → SessionProcessingScreen (NEW)
```

**Files to Change**:

1. **`src/components/TopNavigation/index.tsx`** (ADD INDICATOR)
   ```typescript
   import { EnrichmentStatusIndicator } from './EnrichmentStatusIndicator';

   export function TopNavigation() {
     return (
       <div className="top-navigation">
         <Logo />
         <EnrichmentStatusIndicator /> {/* NEW */}
         <NavTabs />
         <UserMenu />
       </div>
     );
   }
   ```

2. **`src/components/TopNavigation/EnrichmentStatusIndicator.tsx`** (NEW)
   - Subscribe to `enrichment-*` events
   - Poll queue status every 5 seconds (fallback)
   - Show badge when jobs active
   - Hide when no jobs

3. **`src/components/enrichment/EnrichmentPanel.tsx`** (NEW)
   - Subscribe to `enrichment-*` events
   - Display job list
   - Job actions (cancel, retry, view)

4. **`src/components/sessions/SessionProcessingScreen.tsx`** (NEW)
   - Subscribe to `media-processing-*` events
   - Display progress with animations
   - Auto-navigate when complete

5. **`src/App.tsx`** (ADD ROUTE + INIT)
   ```typescript
   function App() {
     // Initialize background enrichment manager
     useEffect(() => {
       backgroundEnrichmentManager.initialize();
       return () => backgroundEnrichmentManager.shutdown();
     }, []);

     return (
       <Routes>
         {/* Existing routes */}
         <Route path="/sessions/:id/processing" element={<SessionProcessingScreen />} />
       </Routes>
     );
   }
   ```

**Flow-On Impacts**:
- ⚠️ **TopNavigation height**: Adding indicator might increase height
- ⚠️ **Z-index conflicts**: EnrichmentPanel needs high z-index
- ⚠️ **Performance**: Polling every 5 seconds (acceptable)
- ⚠️ **Mobile**: Need responsive design for compact view

**Testing Strategy**:
1. ✅ Visual regression test (screenshots)
2. ✅ Test on narrow viewport (mobile)
3. ✅ Test with 0, 1, 5, 10 active jobs
4. ✅ Test panel expand/collapse
5. ✅ Test animations (no jank)

---

### Integration Point 6: Backward Compatibility (Legacy Sessions)

**Priority**: High (existing data)
**Risk**: Medium (data migration)

**Problem**: Existing sessions don't have `optimizedPath`

**Solution**: Dual-path playback logic

**Files to Change**:

1. **`src/components/UnifiedMediaPlayer.tsx`** (UPDATE)
   ```typescript
   function UnifiedMediaPlayer({ session }: Props) {
     // NEW: Check for optimized path
     const hasOptimizedVideo = !!session.video?.optimizedPath;

     if (hasOptimizedVideo) {
       // NEW PATH: Use optimized video (simple)
       return <OptimizedVideoPlayer session={session} />;
     } else {
       // LEGACY PATH: Use separate audio/video (complex)
       return <LegacyMediaPlayer session={session} />;
     }
   }
   ```

2. **`src/components/UnifiedMediaPlayer/OptimizedVideoPlayer.tsx`** (NEW)
   ```typescript
   // Simple player for optimized video
   function OptimizedVideoPlayer({ session }: Props) {
     const videoUrl = convertFileSrc(session.video!.optimizedPath!);

     return (
       <video
         src={videoUrl}
         controls
         onPlay={handlePlay}
         onPause={handlePause}
         onTimeUpdate={handleTimeUpdate}
       />
     );
   }
   ```

3. **`src/components/UnifiedMediaPlayer/LegacyMediaPlayer.tsx`** (NEW)
   ```typescript
   // Complex player for legacy sessions (existing logic)
   function LegacyMediaPlayer({ session }: Props) {
     // MOVE existing UnifiedMediaPlayer logic here
     // - Audio concatenation
     // - Audio/video sync
     // - Web Audio API playback
   }
   ```

**Migration Strategy**:

**Option 1: Lazy Migration** (RECOMMENDED)
- Old sessions play with LegacyMediaPlayer
- New sessions use OptimizedVideoPlayer
- Optionally: Add "Optimize" button to re-process old sessions

**Option 2: Batch Migration**
- On app launch, process all old sessions
- Too slow, not recommended

**Option 3: No Migration**
- Just use dual-path logic forever
- Acceptable, but more code to maintain

**Testing Strategy**:
1. ✅ Create session before upgrade → verify plays with LegacyMediaPlayer
2. ✅ Create session after upgrade → verify plays with OptimizedVideoPlayer
3. ✅ Load mix of old and new sessions → verify both work
4. ✅ Test legacy player still has all features (seek, playback rate, etc.)

---

### Integration Point 7: Error Handling & Recovery

**Priority**: High (reliability)
**Risk**: High (partial failures)

**Failure Scenarios**:

1. **Media processing fails mid-way**
   - Audio concatenation succeeds, video merge fails
   - Recovery: Mark session as "media processing failed", allow retry
   - User sees: Error message in processing screen, option to retry

2. **App crashes during media processing**
   - Orphaned files on disk (partial MP3, partial MP4)
   - Recovery: On startup, detect incomplete media processing, retry or cleanup
   - Implementation: Check `mediaProcessingStatus.status === 'processing'` on startup

3. **Enrichment fails**
   - Job marked as failed in IndexedDB
   - Recovery: Retry up to 3 times, then mark as permanently failed
   - User sees: Failed job in EnrichmentPanel, option to retry

4. **IndexedDB corruption**
   - Enrichment queue database corrupted
   - Recovery: Detect corruption, reset database, re-enrich all sessions
   - User sees: Notification about database reset

5. **Storage full during merge**
   - Video merge fails due to insufficient disk space
   - Recovery: Show error, cleanup temporary files, mark as failed
   - User sees: "Insufficient storage" error

**Error Handling Matrix**:
| Failure | Detection | Recovery | User Impact |
|---------|-----------|----------|-------------|
| Audio concat fails | Exception in BackgroundMediaProcessor | Mark failed, show error | Error in processing screen |
| Video merge fails | Tauri command error | Mark failed, cleanup temp files | Error in processing screen |
| App crashes during processing | Startup check for `status=processing` | Resume or cleanup | Auto-resume or retry prompt |
| Enrichment fails | Exception in PersistentEnrichmentQueue | Retry 3x, then mark failed | Failed job in panel |
| IndexedDB corrupt | Open database fails | Reset database, warn user | Notification + re-enrich |
| Disk full | File write error | Show error, cleanup | "Insufficient storage" |

**Files to Add**:

1. **`src/services/enrichment/ErrorRecovery.ts`** (NEW)
   ```typescript
   class ErrorRecovery {
     // Check for incomplete media processing on startup
     async checkForIncompleteProcessing(): Promise<void>;

     // Cleanup orphaned files
     async cleanupOrphanedFiles(): Promise<void>;

     // Reset corrupted IndexedDB
     async resetEnrichmentDatabase(): Promise<void>;

     // Retry failed jobs
     async retryFailedJobs(): Promise<void>;
   }
   ```

2. **`src/App.tsx`** (ADD RECOVERY ON STARTUP)
   ```typescript
   useEffect(() => {
     async function initialize() {
       // Check for recovery needed
       await errorRecovery.checkForIncompleteProcessing();
       await errorRecovery.cleanupOrphanedFiles();

       // Initialize background enrichment
       await backgroundEnrichmentManager.initialize();
     }

     initialize();
   }, []);
   ```

**Testing Strategy**:
1. ✅ Kill app during audio concat → restart → verify recovery
2. ✅ Kill app during video merge → restart → verify recovery
3. ✅ Inject audio concat error → verify error handling
4. ✅ Inject video merge error → verify error handling
5. ✅ Corrupt IndexedDB → restart → verify reset
6. ✅ Fill disk → trigger merge → verify error

---

### Integration Checklist (Master List)

**Phase 1: Type System** (Do First)
- [ ] Update `types.ts` with new fields
- [ ] Run `npm run type-check` and fix all errors
- [ ] Update all files that reference `SessionVideo`
- [ ] Test: Load existing session → verify no errors

**Phase 2: Storage Layer** (Do Second)
- [ ] Create `EnrichmentJobStorage.ts`
- [ ] Add IndexedDB schema migration
- [ ] Update `ChunkedSessionStorage.ts` metadata schema
- [ ] Test: Create job → restart app → verify persists

**Phase 3: Backend Services** (Do Third)
- [ ] Implement `PersistentEnrichmentQueue.ts`
- [ ] Implement `BackgroundEnrichmentManager.ts`
- [ ] Implement `BackgroundMediaProcessor.ts`
- [ ] Implement `videoAudioMergerService.ts`
- [ ] Test: Each service independently

**Phase 4: Swift/Rust FFI** (Do Fourth)
- [ ] Implement `VideoAudioMerger.swift`
- [ ] Implement `video_audio_merger.rs` FFI wrapper
- [ ] Add `merge_video_and_audio` Tauri command
- [ ] Test: Call command with sample files

**Phase 5: Event System** (Do Fifth)
- [ ] Create `eventBus.ts`
- [ ] Update all services to emit events
- [ ] Test: Subscribe → emit → verify received

**Phase 6: UI Components** (Do Sixth)
- [ ] Create `SessionProcessingScreen.tsx`
- [ ] Create `EnrichmentStatusIndicator.tsx`
- [ ] Create `EnrichmentPanel.tsx`
- [ ] Test: Each component independently

**Phase 7: Context Integration** (Do Seventh - CRITICAL)
- [ ] Update `ActiveSessionContext.tsx` endSession()
- [ ] Update `RecordingContext.tsx` stopAll()
- [ ] Add `/sessions/:id/processing` route
- [ ] Update `App.tsx` initialization
- [ ] Test: End session → verify entire flow

**Phase 8: Player Simplification** (Do Eighth)
- [ ] Extract legacy player to `LegacyMediaPlayer.tsx`
- [ ] Create `OptimizedVideoPlayer.tsx`
- [ ] Update `UnifiedMediaPlayer.tsx` with dual-path
- [ ] Test: Both old and new sessions

**Phase 9: Error Handling** (Do Ninth)
- [ ] Create `ErrorRecovery.ts`
- [ ] Add recovery logic to App.tsx startup
- [ ] Test: All failure scenarios

**Phase 10: End-to-End Testing** (Do Last)
- [ ] Test happy path (end to end)
- [ ] Test error scenarios
- [ ] Test app restart scenarios
- [ ] Test backward compatibility
- [ ] Performance benchmarks

---

### Integration Testing Matrix

| Test Case | Files Involved | Expected Behavior | Pass/Fail |
|-----------|---------------|-------------------|-----------|
| **Happy Path** |
| End session | ActiveSessionContext, BackgroundMediaProcessor | Navigate to processing screen | [ ] |
| Audio concat | audioConcatenationService, BackgroundMediaProcessor | MP3 created in <5s | [ ] |
| Video merge | Swift, Rust FFI, videoAudioMergerService | MP4 created in <30s | [ ] |
| Enrichment | PersistentEnrichmentQueue, sessionEnrichmentService | Job completes successfully | [ ] |
| Notification | BackgroundEnrichmentManager | OS notification shown | [ ] |
| **Error Scenarios** |
| Audio concat fails | BackgroundMediaProcessor | Error shown, cleanup occurs | [ ] |
| Video merge fails | Swift VideoAudioMerger | Error shown, cleanup occurs | [ ] |
| Enrichment fails | PersistentEnrichmentQueue | Retry 3x, then mark failed | [ ] |
| App crash during processing | ErrorRecovery | Resume on next startup | [ ] |
| **Navigation** |
| Navigate during processing | SessionProcessingScreen | Processing continues | [ ] |
| Close app during enrichment | PersistentEnrichmentQueue | Resume on next startup | [ ] |
| Multiple tabs | EventBus | Events sync across tabs | [ ] |
| **Backward Compatibility** |
| Load legacy session | LegacyMediaPlayer | Plays correctly | [ ] |
| Mix old/new sessions | UnifiedMediaPlayer | Both play correctly | [ ] |
| **Performance** |
| Audio concat (30min) | audioConcatenationService | <5 seconds | [ ] |
| Video merge (30min) | Swift VideoAudioMerger | <30 seconds | [ ] |
| Queue init | PersistentEnrichmentQueue | <500ms | [ ] |
| **Concurrency** |
| 5 concurrent enrichments | PersistentEnrichmentQueue | All complete successfully | [ ] |
| Media + enrichment same time | Coordination | No conflicts | [ ] |

---

### Rollback Plan

If integration fails at any point:

**Level 1: Feature Flag Rollback** (Fastest)
- Set `ENABLE_OPTIMIZED_VIDEO = false` in config
- App falls back to old behavior
- No data loss

**Level 2: Code Rollback** (Fast)
- Revert all changes to `ActiveSessionContext.tsx`
- Remove processing screen route
- App works as before
- Existing sessions unaffected

**Level 3: Database Rollback** (Medium)
- Drop `taskerino-enrichment` IndexedDB database
- Remove new fields from session metadata
- Migrate sessions back to old schema
- Lose in-flight enrichment jobs (acceptable)

**Level 4: Full Rollback** (Slow)
- Git revert to before integration started
- Full regression test suite
- Last resort only

---

## Testing Requirements

### Unit Tests

**Coverage Target**: >80%

**Critical Components**:
1. `PersistentEnrichmentQueue` (job lifecycle, persistence, recovery)
2. `BackgroundEnrichmentManager` (job orchestration, status queries)
3. `BackgroundMediaProcessor` (audio concat, video merge, progress)
4. `videoAudioMergerService` (path validation, error handling)
5. `SessionProcessingScreen` (event handling, navigation)

**Test Frameworks**:
- TypeScript: Vitest + React Testing Library
- Rust: cargo test
- Swift: XCTest (if feasible)

### Integration Tests

**Test Scenarios**:
1. **End-to-End Flow**: Session end → processing → enrichment → notification
2. **Queue Persistence**: Create job → restart app → verify resume
3. **Concurrent Enrichment**: Enqueue 5 sessions → verify all complete
4. **Error Recovery**: Inject failure → verify retry → verify success
5. **Media Processing**: Record session → verify audio concat → verify merge
6. **Legacy Playback**: Load old session → verify playback works

### Performance Tests

**Benchmarks**:
1. **Audio Concatenation**: 30-min session → <5 seconds
2. **Video/Audio Merge**: 30-min session → <30 seconds
3. **Queue Initialization**: App launch → <500ms
4. **Job Status Query**: <100ms
5. **Compression Ratio**: 500MB video → ~200MB (60% reduction)

### Manual Testing Checklist

- [ ] End session and verify processing screen appears
- [ ] Navigate away during processing, verify continues
- [ ] Close app during enrichment, restart, verify resumes
- [ ] Open enrichment panel, verify job list updates
- [ ] Play new session with optimized video
- [ ] Play legacy session with separate audio/video
- [ ] Verify notification appears when enrichment completes
- [ ] Cancel enrichment job mid-process
- [ ] Retry failed enrichment job
- [ ] Trigger various errors and verify handling

---

## Success Criteria

### Functional Requirements

✅ **Video/Audio Merging**:
- Audio concatenation completes in <5 seconds
- Video/audio merge completes in <30 seconds
- Final file size ~40% of original (60% reduction)
- Originals preserved for AI processing
- Supports video-only, audio-only, and both

✅ **Background Enrichment**:
- Jobs persist across app restart
- Pending jobs auto-resume on app launch
- Multiple sessions enrich concurrently (up to 5)
- Enrichment continues after navigation
- Enrichment survives app close/restart

✅ **User Experience**:
- Processing screen shows real-time progress
- User can navigate away during processing
- Global status indicator shows enrichment count
- Notification appears when enrichment completes
- Simplified playback (single video file)

### Performance Requirements

✅ **Processing Times**:
- Audio concatenation: <5 seconds (30-min session)
- Video/audio merge: <30 seconds (30-min session)
- Queue initialization: <500ms (app launch)
- Job status query: <100ms

✅ **Storage**:
- Optimized file: ~40% of original (200MB vs 500MB)
- Total storage during processing: ~140% (750MB)
- Originals deleted after enrichment (optional)

✅ **Reliability**:
- Job persistence: 100% (no data loss)
- Job completion rate: >95% (with retries)
- Queue recovery: 100% (all pending jobs resume)
- Error isolation: 100% (one failure doesn't block others)

### Code Quality

✅ **Test Coverage**: >80% overall
✅ **Documentation**: Complete JSDoc comments
✅ **Type Safety**: 100% TypeScript, no `any` types
✅ **Error Handling**: Comprehensive error messages
✅ **Performance**: No UI blocking (all async)

---

## Risks & Mitigations

### Risk 1: Swift FFI Complexity

**Risk**: FFI between Swift and Rust is complex and error-prone

**Likelihood**: Medium
**Impact**: High

**Mitigation**:
1. Use existing FFI patterns from `ScreenRecorder` module
2. Start with simple FFI calls before adding complexity
3. Add comprehensive error handling and logging
4. Test FFI boundary extensively with unit tests
5. Document FFI conventions for future work

**Contingency**:
- If Swift FFI too difficult, use Rust-only video/audio merging with `ffmpeg-next` crate (adds ~100MB dependency)

### Risk 2: IndexedDB Corruption

**Risk**: IndexedDB can corrupt, losing all job data

**Likelihood**: Low
**Impact**: High

**Mitigation**:
1. Add database version migrations
2. Implement corruption detection on startup
3. Add auto-repair logic (rebuild indexes)
4. Add backup/restore mechanism
5. Log all database operations for debugging

**Contingency**:
- If corruption detected, reset queue and re-enrich all sessions

### Risk 3: Video/Audio Sync Drift

**Risk**: Merged video/audio might drift out of sync

**Likelihood**: Low
**Impact**: Medium

**Mitigation**:
1. Use AVFoundation's built-in sync (reliable)
2. Verify timestamps match before merging
3. Add visual/audio sync test (manual verification)
4. Test with various session lengths (5min - 2hr)
5. Add drift detection in UnifiedMediaPlayer

**Contingency**:
- If drift detected, fallback to legacy sync logic for that session

### Risk 4: Long Processing Times

**Risk**: Video/audio merge takes >30 seconds for long sessions

**Likelihood**: Medium
**Impact**: Low (non-blocking UX)

**Mitigation**:
1. Show accurate time estimates in processing screen
2. Allow user to navigate away immediately
3. Process in background (non-blocking)
4. Optimize export quality preset (balance size/speed)
5. Add cancellation support if user wants to skip

**Contingency**:
- If too slow, add option to skip video/audio merge and use legacy playback

### Risk 5: App Restart During Media Processing

**Risk**: App crashes/closes during video/audio merge, leaving orphaned files

**Likelihood**: Medium
**Impact**: Medium

**Mitigation**:
1. Mark media processing jobs in IndexedDB
2. Add cleanup logic on app startup (detect orphaned files)
3. Add resume logic (restart merge if interrupted)
4. Use atomic file writes (temp → final rename)
5. Log all file operations

**Contingency**:
- On startup, detect incomplete merge and restart from beginning

### Risk 6: Concurrent Enrichment Resource Exhaustion

**Risk**: Enriching 5 sessions simultaneously exhausts CPU/memory

**Likelihood**: Low
**Impact**: Medium

**Mitigation**:
1. Limit concurrent video processing to 1 (most CPU-intensive)
2. Limit concurrent enrichment to 5 (configurable)
3. Monitor memory usage and throttle if needed
4. Add priority queue (high priority jobs first)
5. Add resource monitoring dashboard

**Contingency**:
- If resource exhaustion detected, reduce concurrency to 3

---

## Summary

This plan provides a comprehensive roadmap for implementing **persistent background enrichment** with **optimized video/audio merging**. The system will:

1. **Merge video and audio** into single compressed MP4 after session ends
2. **Process enrichment in background**, surviving navigation and app restart
3. **Show non-blocking processing screen** with real-time progress
4. **Provide global visibility** into enrichment status
5. **Simplify playback** by eliminating runtime audio concatenation and sync logic

**Key Benefits**:
- ✅ 64% storage reduction (500MB → 200MB)
- ✅ Simpler codebase (~500 lines removed from UnifiedMediaPlayer)
- ✅ Better UX (instant playback, no sync issues)
- ✅ Automatic enrichment (no manual trigger)
- ✅ Reliable operation (survives restart)

**Total Effort**: 38-50 hours across 15 agent tasks

**Next Steps**:
1. Review and approve plan
2. Assign tasks to agents
3. Begin Phase 1 (foundation)
4. Proceed through phases sequentially

---

**Plan Version**: 1.0
**Last Updated**: 2025-10-28
**Status**: Ready for Review
