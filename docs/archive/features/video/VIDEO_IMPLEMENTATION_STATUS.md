# Video Recording Implementation Status

## Summary
The **Review UI framework** has been implemented and works beautifully for screenshots and audio. However, **actual video recording capabilities are not yet functional** - only scaffolding exists.

---

## ✅ What's Been Completed

### Phase 3: Review Tab UI (80% Complete)
- ✅ **SessionReview.tsx** - Adaptive review component that detects available media types
- ✅ **ScreenshotScrubber.tsx** - Screenshot browsing with timeline sync
- ✅ **ReviewTimeline.tsx** - Unified timeline for all media types
- ✅ **SessionDetailView.tsx** - Integrated SessionReview component
- ✅ **Types defined** - SessionVideo and SessionVideoChunk in types.ts

**Status**: Review tab works perfectly for screenshots + audio combinations. Shows placeholder for video mode.

### Phase 1: Recording Infrastructure (10% Complete)
- ⚠️ **video_recording.rs** - Exists but contains only scaffolding with TODOs
  - Has type definitions (VideoQuality, RecordingState, VideoRecorder)
  - Has Tauri command signatures
  - **Missing**: Actual AVFoundation implementation (all marked as TODO)
  - Returns errors saying "not yet implemented"

---

## ❌ What's Missing to Fulfill the Vision

### Phase 1: Screen Recording Infrastructure (90% remaining)

#### Backend (Rust)
- **video_recording.rs** - Needs AVFoundation implementation:
  - [ ] Add Objective-C interop dependencies to Cargo.toml
  - [ ] Implement `start_recording()` with AVCaptureSession
  - [ ] Implement `stop_recording()` with video file finalization
  - [ ] Implement `pause_recording()` and `resume_recording()`
  - [ ] Implement `check_permission()` using CGPreflightScreenCaptureAccess
  - [ ] Implement `request_permission()` using CGRequestScreenCaptureAccess
  - [ ] Register commands in `lib.rs`
  - [ ] Add VideoRecorder to Tauri state management

#### Frontend (TypeScript)
- **NEW: src/services/videoRecordingService.ts** - Needs creation:
  - [ ] `startRecording(session)` - Invoke Rust recording
  - [ ] `stopRecording()` - Stop and return video path
  - [ ] `pauseRecording()` / `resumeRecording()` - Pause support
  - [ ] `isRecording()` - Status check
  - [ ] `getRecordingState()` - Get current state

- **NEW: src/utils/videoPermissions.ts** - Needs creation:
  - [ ] `checkScreenRecordingPermission()` - Check TCC status
  - [ ] `requestScreenRecordingPermission()` - Show instructions modal
  - [ ] Permission status hook

#### UI Integration
- **SessionsZone.tsx** - Needs updates:
  - [ ] Add "Record Screen" toggle to session settings
  - [ ] Wire up video recording lifecycle (start/stop with session)
  - [ ] Handle permission errors with user-friendly messaging
  - [ ] Show recording indicator when active

---

### Phase 2: Post-Session Intelligent Chunking (100% missing)

#### FFmpeg Integration
- **NEW: src-tauri/src/video_processing.rs** - Needs creation:
  - [ ] `split_video_at_timestamps()` - Split video into topic chunks
  - [ ] `extract_video_frames()` - Extract frames for AI analysis
  - [ ] `get_video_duration()` - Duration helper
  - [ ] Add FFmpeg as dependency (bundled or external)

#### Chunking Agent
- **NEW: src/utils/videoChunkingAgent.ts** - Needs creation:
  - [ ] Analyze transcript + screenshot summaries
  - [ ] Propose chunk boundaries (30s-5min, topic-aligned)
  - [ ] Ensure chunks don't cut mid-activity
  - [ ] Return structured chunk metadata with topics

#### Storage Service
- **NEW: src/services/videoStorageService.ts** - Needs creation:
  - [ ] `saveFullVideo()` - Store complete recording as attachment
  - [ ] `saveVideoChunk()` - Store individual chunk
  - [ ] `getVideoChunk()` - Retrieve chunk by ID
  - [ ] `deleteSessionVideo()` - Cleanup video files
  - [ ] Integration with existing attachment system

#### Post-Session Processing
- **SessionsZone.tsx** - Additional updates needed:
  - [ ] Trigger chunking after session completes (if video exists)
  - [ ] Show progress toast during chunking
  - [ ] Update session with chunk metadata
  - [ ] Handle chunking errors gracefully

---

### Phase 3: Review Tab UI - Video Components (20% missing)

- **NEW: src/components/VideoPlayer.tsx** - Needs creation:
  - [ ] HTML5 video player with custom controls
  - [ ] Play/pause, seek, volume controls
  - [ ] Playback speed control (0.5x, 1x, 1.5x, 2x)
  - [ ] Chunk selector dropdown
  - [ ] Keyboard shortcuts (space, arrows, etc.)
  - [ ] Timestamp overlay
  - [ ] Sync with ReviewTimeline

- **NEW: src/components/VideoChunkSelector.tsx** - Needs creation:
  - [ ] Dropdown to jump between video chunks
  - [ ] List all chunks with topic names
  - [ ] Show duration for each chunk
  - [ ] Click to jump to timestamp in video

- **SessionReview.tsx** - Minor update needed:
  - [ ] Replace video mode placeholder with actual VideoPlayer component
  - [ ] Wire up video sync with timeline

---

### Phase 4: Video Review Agent (100% missing)

#### Frame Extraction
- **src-tauri/src/video_processing.rs** - Additional functions:
  - [ ] `extract_video_frames()` command
  - [ ] Parameters: video path, start/end time, frame count
  - [ ] Return base64 encoded frames for AI analysis

#### Video Review Agent
- **NEW: src/services/videoReviewAgent.ts** - Needs creation:
  - [ ] `analyzeVideo()` - Extract frames and analyze with Claude
  - [ ] Adaptive FPS based on detail level (quick/standard/detailed)
  - [ ] Cap at 120 frames for cost control
  - [ ] Cache results for repeated queries
  - [ ] Return text summaries (not raw frames)

#### Ned Integration
- **src/services/sessionsAgentService.ts** - Needs updates:
  - [ ] Add `analyze_session_video` tool for Ned
  - [ ] Tool decides when video analysis is needed
  - [ ] Invokes VideoReviewAgent
  - [ ] Returns text summary to keep Ned's context clean

---

### Phase 5: Polish & Integration (100% missing)

#### Settings
- **Settings page** - Video settings section:
  - [ ] Video quality: 480p/720p/1080p dropdown
  - [ ] Frame rate: 15/30 fps toggle
  - [ ] Enable/disable video recording by default
  - [ ] Storage management panel

#### Storage Management
- **NEW: Video Storage UI component**:
  - [ ] Show total video storage used
  - [ ] List sessions with video + size
  - [ ] Delete video (keep screenshots/audio/summary)
  - [ ] Warn if disk space < 5GB

#### Loading States & Error Handling
- [ ] Video processing progress indicators
- [ ] Chunking progress toasts
- [ ] Frame extraction spinners
- [ ] Permission denied → show instructions modal
- [ ] FFmpeg failures → fallback gracefully
- [ ] Storage full → warn user
- [ ] API errors → retry logic

#### Performance Optimizations
- [ ] Lazy load video chunks
- [ ] Compress older videos
- [ ] Limit concurrent video processing
- [ ] Optimize timeline rendering with virtualization

---

## Recommended Implementation Order

To get video recording working end-to-end, implement in this order:

### Milestone 1: Basic Recording (2-3 days)
1. Complete AVFoundation implementation in `video_recording.rs`
2. Create `videoRecordingService.ts`
3. Create `videoPermissions.ts`
4. Update `SessionsZone.tsx` with recording toggle
5. Test: Can start/stop recording during session

### Milestone 2: Video Playback (1-2 days)
6. Create `VideoPlayer.tsx` component
7. Create `videoStorageService.ts` (basic save/load)
8. Update `SessionReview.tsx` to use VideoPlayer
9. Test: Can play back recorded video in Review tab

### Milestone 3: Intelligent Chunking (2-3 days)
10. Create `video_processing.rs` with FFmpeg
11. Create `videoChunkingAgent.ts`
12. Implement post-session chunking in `SessionsZone.tsx`
13. Create `VideoChunkSelector.tsx`
14. Test: Videos are automatically chunked by topic

### Milestone 4: AI Analysis (2-3 days)
15. Add frame extraction to `video_processing.rs`
16. Create `videoReviewAgent.ts`
17. Integrate with Ned in `sessionsAgentService.ts`
18. Test: Ned can answer questions about recorded video

### Milestone 5: Polish (2 days)
19. Add settings UI for video quality
20. Add storage management
21. Add all loading states and error handling
22. Performance optimizations

---

## Critical Blockers

1. **AVFoundation Integration** - This is the biggest lift. Requires:
   - Objective-C/Swift interop in Rust
   - Understanding macOS screen capture APIs
   - Proper TCC permission handling
   - Video encoding/compression

2. **FFmpeg Integration** - Need to decide:
   - Bundle FFmpeg with app (increases size)
   - Require user to install FFmpeg
   - Use system FFmpeg if available

3. **Storage Strategy** - Videos are large:
   - Where to store (app data directory?)
   - How to handle cleanup
   - Integration with existing attachment system
   - Backup/export considerations

---

## Alternative Approaches to Consider

### Option A: Use Existing Screen Recording Library
Instead of raw AVFoundation, use a higher-level library like:
- **ScreenCaptureKit** (macOS 12.3+, Swift)
- Rust crate that wraps it

**Pros**: Less code, fewer bugs
**Cons**: Less control, newer macOS only

### Option B: Simpler Video Recording
- Skip chunking initially
- Skip Ned integration initially
- Just record → store → playback
- Add intelligence later

**Pros**: Faster MVP, validate usefulness first
**Cons**: Large video files without chunking

### Option C: External Recording Tool Integration
- Don't implement recording at all
- Let user use QuickTime/OBS
- Import video files into sessions
- Focus on playback + AI analysis

**Pros**: Much simpler, no permission issues
**Cons**: Worse UX, manual workflow

---

## Next Steps

**Recommended**: Start with **Milestone 1** (Basic Recording) using **Option A** (ScreenCaptureKit) for faster implementation.

Then validate with users before investing in chunking and AI analysis.

**Immediate Actions**:
1. Research ScreenCaptureKit Rust bindings
2. Set up test project for screen recording
3. Get basic recording working outside Tauri first
4. Integrate into Taskerino once proven
