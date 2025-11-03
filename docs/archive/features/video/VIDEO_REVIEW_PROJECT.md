# Video Review System - Implementation Plan

## Overview
Add optional screen recording to sessions with intelligent post-processing and a unified Review tab that works with any combination of screenshots, audio, and video.

## Core Principles
1. **Record everything, process nothing automatically** - Video is stored but not analyzed until needed
2. **Post-session intelligent chunking** - AI breaks video into topic-aligned chunks (30s-5min)
3. **Adaptive Review UI** - Works with screenshots-only, audio-only, video-only, or any combination
4. **Agent-based video analysis** - Keep Ned's context clean by delegating heavy analysis to specialized agent

## Session Recording Modes

| Mode | UI Behavior |
|------|-------------|
| Screenshots only | Scrubber for browsing screenshots + timeline below (synced) |
| Audio only | Audio waveform player + timeline with transcripts |
| Video only | Video player + timeline with auto-detected chunks |
| Screenshots + Audio | Scrubber for screenshots + audio waveform + timeline |
| Screenshots + Video | Video player (primary) + screenshot markers + timeline |
| Audio + Video | Video player with audio + timeline with transcripts |
| All three | Video player (primary) + screenshot/audio markers + timeline |

## Architecture

### Type Definitions
```typescript
interface SessionVideo {
  id: string;
  sessionId: string;
  fullVideoAttachmentId: string; // Full session recording
  chunks?: SessionVideoChunk[];
  duration: number;
  chunkingStatus: 'pending' | 'processing' | 'complete' | 'error';
  processedAt?: string;
}

interface SessionVideoChunk {
  id: string;
  videoId: string;
  attachmentId: string; // Chunked video file
  startTime: number; // Seconds from session start
  endTime: number;
  topic: string; // AI-detected topic
  description: string;
  transcriptExcerpt: string;
  relatedScreenshotIds: string[];
  relatedAudioSegmentIds: string[];
}

interface Session {
  // ... existing fields
  video?: SessionVideo;
  videoRecording?: boolean; // User setting
}
```

## Phase 1: Screen Recording Infrastructure

### Rust Backend (src-tauri)
**New File: `src-tauri/src/video_recording.rs`**
- macOS AVFoundation screen capture
- Start/stop/pause recording
- Save to session-specific file
- Quality settings (resolution, FPS)

**Capabilities**: Add screen recording permissions to `default.json`

### TypeScript Service
**New File: `src/services/videoRecordingService.ts`**
- `startRecording(session)` - Invoke Rust recording
- `stopRecording()` - Stop and save
- `pauseRecording()` / `resumeRecording()` - Pause support
- `isRecording()` - Status check

**New File: `src/utils/videoPermissions.ts`**
- Check screen recording permission
- Show macOS instructions modal

### UI Integration
**Modify: `src/components/SessionsZone.tsx`**
- Add "Record Screen" toggle to session settings
- Wire up video recording lifecycle
- Handle permission errors

**Modify: `src/types.ts`**
- Add SessionVideo and SessionVideoChunk types
- Add videoRecording boolean to Session

## Phase 2: Post-Session Intelligent Chunking

### FFmpeg Integration
**New File: `src-tauri/src/video_processing.rs`**
- `split_video_at_timestamps()` - Split video into chunks
- `extract_video_frames()` - Extract frames for analysis
- `get_video_duration()` - Duration helper

### Chunking Agent
**New File: `src/utils/videoChunkingAgent.ts`**
- Analyze transcript + screenshot summaries
- Propose chunk boundaries (30s-5min, topic-aligned)
- Don't cut mid-activity
- Return structured chunk metadata

### Storage Service
**New File: `src/services/videoStorageService.ts`**
- `saveFullVideo()` - Store complete recording
- `saveVideoChunk()` - Store individual chunk
- `getVideoChunk()` - Retrieve chunk
- `deleteSessionVideo()` - Cleanup

### Post-Session Processing
**Modify: `src/components/SessionsZone.tsx`**
- Trigger chunking after session completes
- Show progress toast
- Update session with chunks
- Handle errors gracefully

## Phase 3: Review Tab UI

### Core Components

**New File: `src/components/SessionReview.tsx`**
Main review component that adapts to available media:
- Detects what's available (screenshots/audio/video)
- Renders appropriate player/scrubber at top
- Shows synced timeline below
- Handles bidirectional sync

**New File: `src/components/VideoPlayer.tsx`**
Video playback with controls:
- Play/pause, seek, volume
- Playback speed control
- Chunk selector dropdown
- Keyboard shortcuts (space, arrows)
- Timestamp overlay

**New File: `src/components/ScreenshotScrubber.tsx`**
Screenshot browsing (when no video):
- Horizontal strip of screenshots
- Click or drag to navigate
- Shows current screenshot large
- Syncs with timeline below

**New File: `src/components/AudioWaveform.tsx`**
Audio visualization:
- Waveform display
- Playback controls
- Transcript highlights
- Syncs with timeline

**New File: `src/components/ReviewTimeline.tsx`**
Unified timeline for all modes:
- Auto-scrolls with playback
- Click items to seek
- Highlights current position
- Shows screenshots/audio/context items
- Color-coded by type

**New File: `src/components/VideoChunkSelector.tsx`**
Dropdown to jump between topics:
- Lists all chunks with topics
- Shows duration for each
- Click to jump to timestamp

### Integration

**Modify: `src/components/SessionDetailView.tsx`**
- Replace "Timeline" + "Audio" tabs with single "Review" tab
- Render SessionReview component
- Pass session data

## Phase 4: Video Review Agent

### Frame Extraction
**Modify: `src-tauri/src/video_processing.rs`**
- Add `extract_video_frames()` command
- Parameters: video path, start/end time, frame count
- Return base64 encoded frames

### Video Review Agent
**New File: `src/services/videoReviewAgent.ts`**
```typescript
class VideoReviewAgent {
  async analyzeVideo(
    sessionId: string,
    startTime: number,
    endTime: number,
    query: string,
    detailLevel: 'quick' | 'standard' | 'detailed'
  ): Promise<string>

  // Adaptive FPS: quick=0.15, standard=0.5, detailed=1.5
  // Cap at 120 frames for cost control
  // Extract frames → get transcript → analyze with Claude
  // Cache results for repeated queries
}
```

### Ned Integration
**Modify: `src/services/sessionsAgentService.ts`**
- Add `analyze_session_video` tool
- Tool decides when video analysis is needed
- Invokes VideoReviewAgent
- Returns text summary to Ned (keeps context clean)

## Phase 5: Polish & Integration

### Loading States
- Video processing progress indicators
- Chunking progress toasts
- Frame extraction spinners

### Error Handling
- Permission denied → show instructions
- FFmpeg failures → fallback gracefully
- Storage full → warn user
- API errors → retry logic

### Settings
**Modify: Settings page**
- Video quality: 480p/720p/1080p
- Frame rate: 15/30 fps
- Enable/disable video by default
- Storage management

### Storage Management
**New component: Video Storage UI**
- Show total video storage used
- List sessions with video
- Delete video (keep screenshots/audio/summary)
- Warn if disk space < 5GB

### Performance
- Lazy load video chunks
- Compress older videos
- Limit concurrent video processing
- Optimize timeline rendering with virtualization

## User Flows

### Recording Session with Video
1. User starts session, enables "Record Screen"
2. Permission prompt (first time)
3. Red dot shows recording
4. Session runs normally
5. User clicks "Stop"
6. Transitions to summary → Review tab
7. Background: "Preparing video review..." toast
8. Chunks become available (30-60s)

### Reviewing Screenshots-Only Session
1. Open session in Review tab
2. See: Screenshot scrubber at top + timeline below
3. Click screenshot in scrubber → timeline scrolls to that moment
4. Click timeline item → scrubber updates
5. Arrow keys navigate screenshots

### Reviewing Video Session
1. Open session in Review tab
2. See: Video player + chunk selector + timeline
3. Play video → timeline auto-scrolls
4. Select "Authentication Demo" chunk → video seeks
5. Click screenshot marker on timeline → video jumps there
6. Scrub video → see corresponding timeline items

### Asking Ned About Video
```
User: "Ned, how did I implement login flow yesterday?"

Ned: [Searches sessions, finds relevant time range]
      [Invokes analyze_session_video tool]
      [Video Agent extracts 90 frames, analyzes]
      "At 14:20 you opened auth.ts and created loginUser function.
       At 14:35 you added JWT validation. At 15:50 you tested and
       got CORS error. At 16:20 you fixed the config. By 17:45
       the flow was working."

User: "What CORS config did I use?"

Ned: [Invokes video agent with narrower range, detailed level]
     "You added: { origin: 'http://localhost:3000', credentials: true }"
```

## Cost Estimates

### Storage
- 720p @ 15fps: ~30 MB/hour
- 8-hour day: 240 MB
- Week of sessions: ~1.2 GB
- Recommend cleanup after 30 days

### API Costs (per query)
- Quick (18 frames): $0.06
- Standard (60 frames): $0.22
- Detailed (180 frames): $0.65

Typical usage: 5 queries/day = $1-3/day

Much cheaper than auto-processing everything!

## Timeline

**Phase 1: Recording** (2-3 days)
- Rust video recording
- TypeScript service
- UI integration

**Phase 2: Chunking** (2-3 days)
- FFmpeg integration
- Chunking agent
- Post-session processing

**Phase 3: Review UI** (3-4 days)
- All review components
- Adaptive UI for all modes
- Bidirectional sync

**Phase 4: Video Agent** (2-3 days)
- Frame extraction
- Video analysis agent
- Ned integration

**Phase 5: Polish** (2 days)
- Loading states
- Error handling
- Settings & storage management

**Total: 11-15 days**

## Success Criteria

- [ ] Can record screen during sessions (with permission)
- [ ] Video automatically chunked after session completes
- [ ] Review tab works with all combinations (screenshots/audio/video)
- [ ] Video player syncs with timeline bidirectionally
- [ ] Screenshot scrubber works for non-video sessions
- [ ] Ned can analyze video on-demand via tool
- [ ] Video analysis returns clear, chronological answers
- [ ] Storage management prevents disk space issues
- [ ] User can export video clips
- [ ] All error cases handled gracefully
