# Audio-First Session Review

## Overview

Taskerino's audio-first session review transforms fragmented audio chunks into a unified, searchable, and navigable experience. Inspired by tools like Gong.io, this feature enables users to review their work sessions through audio as a primary timeline coordinate.

## Core Philosophy

**Audio as Timeline Coordinate**: Every moment in a session can be accessed through:
- Visual context (screenshots)
- Spoken context (audio transcription)
- Activity context (AI analysis)

All synchronized on a single, scrubable timeline.

## Architecture

### Components

1. **UnifiedSessionAudioPlayer** (`src/components/UnifiedSessionAudioPlayer.tsx`)
   - Continuous playback of all audio segments
   - Full-session waveform visualization
   - Sync markers for screenshots, speech, and key moments
   - Variable playback speed (0.5x - 3x)
   - Jump-to-time navigation

2. **AudioConcatenationService** (`src/services/audioConcatenationService.ts`)
   - Concatenates individual audio segments into virtual continuous stream
   - Manages gap insertion between segments
   - Provides time mapping between segment time and session time
   - Handles audio caching and streaming

3. **AudioExplorerView** (`src/components/AudioExplorerView.tsx`)
   - Tab in SessionDetailView
   - Full transcription feed with auto-scroll
   - Audio statistics panel
   - Smart highlights (questions, eureka moments, frustration)

4. **MultiTrackTimeline** (`src/components/MultiTrackTimeline.tsx`)
   - DAW-style multi-track view
   - Audio waveform track
   - Screenshot thumbnail track
   - Transcription text track
   - AI activity labels track
   - Synchronized playback and navigation

5. **TranscriptionSearchService** (`src/services/transcriptionSearchService.ts`)
   - Full-text search across all audio segments
   - Jump-to-audio from search results
   - Keyword highlighting
   - Context-aware search (find questions, find errors, etc.)

6. **KeyMomentsDetectionService** (`src/services/keyMomentsDetectionService.ts`)
   - Analyzes audio for volume spikes
   - Detects speech patterns (questions, excitement, frustration)
   - Correlates with activity changes
   - Creates timeline markers for key moments

7. **AudioExportService** (`src/services/audioExportService.ts`)
   - Exports full session audio as MP3/WAV/M4A
   - Generates SRT/VTT subtitle files from transcriptions
   - Creates video exports (screenshots + audio → MP4)
   - Markdown export with embedded audio timestamps

## Data Flow

### Continuous Playback
```
AudioSegment[] → AudioConcatenationService → VirtualContinuousStream
                                           ↓
                                    UnifiedAudioPlayer
                                           ↓
                          SyncWithScreenshots & Transcriptions
```

### Search & Navigation
```
User Search Query → TranscriptionSearchService → Matched Segments
                                               ↓
                                    Calculate Session Time
                                               ↓
                                    Jump UnifiedAudioPlayer
```

### Export
```
Session + Audio Segments → AudioExportService → Concatenate WAV files
                                              ↓
                                         Encode to MP3
                                              ↓
                                     Download single file
```

## Implementation Phases

### Phase 1: MVP (Continuous Playback & Export)
**Goal**: Users can play through entire session audio and export it as one file

Features:
1. Unified audio player with continuous playback
2. Export full session audio (concatenate → MP3)
3. Screenshot-audio sync markers on timeline
4. Search transcriptions → jump to audio

**Success Criteria**:
- Click "Play" → hears entire session without gaps
- Click "Export Audio" → downloads single MP3 file
- Search "database error" → finds 3 matches, click → jumps audio to that moment

### Phase 2: Enhanced (Multi-Track Timeline & Key Moments)
**Goal**: Rich visual timeline with waveforms and smart navigation

Features:
1. Multi-track timeline view (audio + screenshots + transcriptions)
2. Full-session waveform visualization
3. Key moments detection (volume spikes, speech patterns)
4. Export with transcription (SRT/VTT)

**Success Criteria**:
- See waveform for entire session with activity overlays
- Click screenshot → jumps audio to that moment
- See markers for "Key Moments" on timeline
- Export → gets SRT subtitle file with audio

### Phase 3: Advanced (Video Export & Smart Highlights)
**Goal**: AI-enhanced navigation and rich media export

Features:
1. Video export (screenshots + audio → MP4)
2. Smart highlights (questions, eureka moments, frustration detection)
3. Activity-based navigation ("Jump to debugging")
4. Session audio map (visual clustering)

## Key Moments Detection Algorithm

### Volume Spike Detection
```typescript
// Detect sudden volume increases (potential important moments)
if (currentVolume > averageVolume * 1.5 &&
    currentVolume > previousVolume * 1.3) {
  markAsKeyMoment('volume_spike', timestamp);
}
```

### Speech Pattern Detection
```typescript
// Question detection (voice pitch + words)
if (transcription.includes('?') ||
    transcription.match(/^(how|what|why|when|where|who)/i)) {
  markAsKeyMoment('question', timestamp);
}

// Excitement detection (volume + positive words)
if (transcription.match(/(yes|great|perfect|works|fixed)/i) &&
    volume > averageVolume * 1.2) {
  markAsKeyMoment('eureka', timestamp);
}

// Frustration detection (repeated attempts + negative words)
if (transcription.match(/(damn|ugh|why|again|failed)/i)) {
  markAsKeyMoment('frustration', timestamp);
}
```

### Activity Change Detection
```typescript
// Significant context switch (new activity detected)
if (currentActivity !== previousActivity &&
    timeSinceLastSwitch > 5 * 60) { // 5 minutes
  markAsKeyMoment('activity_change', timestamp, {
    from: previousActivity,
    to: currentActivity
  });
}
```

## Export Formats

### Audio Export
- **MP3** (128kbps): Default, small size, universal compatibility
- **WAV** (16-bit 44.1kHz): Lossless, for archival
- **M4A** (AAC): Apple ecosystem, good quality/size ratio

### Transcription Export
- **SRT**: Standard subtitle format (Premiere, Final Cut)
- **VTT**: WebVTT for web playback
- **TXT**: Plain text with timestamps
- **JSON**: Machine-readable with metadata

### Combined Export
- **Markdown with Audio**: Embedded timestamps as `[00:12:45]` links
- **MP4 Video**: Screenshots + audio with Ken Burns effect
- **HTML Report**: Interactive web page with embedded player

## User Flows

### Flow 1: Review Yesterday's Debugging Session
```
1. Open Sessions → Click yesterday's session
2. See "🎧 48 min audio recorded" badge
3. Click "Audio Explorer" tab (auto-opens if audio present)
4. Hit play → Audio starts, transcription auto-scrolls
5. Hear "this error is confusing..." at 15:23
6. Click that segment → Screenshot shows error message
7. Click "Export" → "Full session audio + transcription"
8. Downloads MP3 + SRT file
```

### Flow 2: Find When I Fixed the Bug
```
1. Open completed session
2. Type in search: "fixed the bug"
3. See 2 results:
   - 24:18 - "I think I fixed the bug"
   - 42:07 - "confirmed: bug is fixed"
4. Click first result → Audio jumps to 24:18
5. See screenshot showing code change
6. Click "Export this moment" → 30s clip + screenshot
```

### Flow 3: Create Video Summary
```
1. Open session with audio + screenshots
2. Click "Export" → "Create Video"
3. Select: Ken Burns effect, 2 sec per screenshot
4. Preview: Screenshots fade with audio narration
5. Export → Downloads MP4 video (5 min condensed session)
6. Share on team Slack
```

## Performance Considerations

### Audio Concatenation
- **Problem**: Loading 30x 2-minute WAV files = 60MB+ in memory
- **Solution**: Stream audio segments on-demand, maintain only current segment + next
- **Caching**: Keep decoded audio in IndexedDB for fast replay

### Waveform Generation
- **Problem**: Calculating waveform for 1-hour session = expensive
- **Solution**: Generate waveform during recording (background task)
- **Storage**: Store as compressed array (200 data points per segment)

### Search Performance
- **Problem**: Searching 1000+ audio segments is slow
- **Solution**: Build inverted index of words → segment IDs
- **Index Structure**:
  ```typescript
  {
    "error": [segment_15, segment_42, segment_89],
    "database": [segment_15, segment_43, segment_91],
    "authentication": [segment_28, segment_67]
  }
  ```

## Future Enhancements

### Speaker Diarization
Detect multiple speakers (e.g., pair programming, calls):
```
[00:12:45] You: "How should we handle authentication?"
[00:12:52] Colleague: "Let's use OAuth with refresh tokens"
```

### Audio Intelligence
- Detect typing sounds → correlate with code changes
- Detect notification sounds → flag interruptions
- Background music detection → filter from transcription

### Real-Time Transcription Display
Show transcription as it's being generated during active session:
```
[Live Preview]
🎤 Recording... (12:45 elapsed)
"Let me try debugging this authentication flow..."
```

### Audio Memory Palace
Spatial visualization of session audio:
- Productive work = green zones
- Blocked/debugging = red zones
- Meetings/calls = blue zones
- Click zone → jump to that part of session

## API Reference

### AudioConcatenationService

```typescript
class AudioConcatenationService {
  /**
   * Creates virtual continuous audio stream from segments
   * @returns AudioContext with all segments loaded
   */
  async createContinuousStream(
    segments: SessionAudioSegment[],
    options?: {
      gapDuration?: number; // Silence between segments (ms)
      fadeInOut?: boolean;  // Crossfade between segments
    }
  ): Promise<AudioContext>;

  /**
   * Maps segment-relative time to session-absolute time
   */
  segmentTimeToSessionTime(
    segmentId: string,
    segmentTime: number
  ): number;

  /**
   * Maps session-absolute time to segment + offset
   */
  sessionTimeToSegment(
    sessionTime: number
  ): { segmentId: string; offset: number };
}
```

### TranscriptionSearchService

```typescript
class TranscriptionSearchService {
  /**
   * Searches all transcriptions for query
   * @returns Matches with context and session time
   */
  search(
    session: Session,
    query: string,
    options?: {
      caseSensitive?: boolean;
      wholeWord?: boolean;
      contextChars?: number; // Characters before/after match
    }
  ): SearchResult[];

  /**
   * Builds search index for fast lookups
   */
  buildIndex(session: Session): void;

  /**
   * Context-aware search (find questions, errors, etc.)
   */
  searchByIntent(
    session: Session,
    intent: 'question' | 'error' | 'solution' | 'decision'
  ): SearchResult[];
}
```

### KeyMomentsDetectionService

```typescript
class KeyMomentsDetectionService {
  /**
   * Analyzes session audio and generates key moments
   */
  async detectKeyMoments(
    session: Session
  ): Promise<AudioKeyMoment[]>;

  /**
   * Detects specific moment type
   */
  async detectVolumeSpikes(segments: SessionAudioSegment[]): Promise<AudioKeyMoment[]>;
  async detectQuestions(segments: SessionAudioSegment[]): Promise<AudioKeyMoment[]>;
  async detectEurekaMoments(segments: SessionAudioSegment[]): Promise<AudioKeyMoment[]>;
  async detectFrustration(segments: SessionAudioSegment[]): Promise<AudioKeyMoment[]>;
}
```

## Testing Strategy

### Unit Tests
- Audio concatenation math (time mapping)
- Search index building and querying
- Key moments detection algorithms

### Integration Tests
- End-to-end playback (30 segments → continuous audio)
- Search → jump to audio → verify correct timestamp
- Export → verify file size and format

### E2E Tests
- Record 5-minute session with audio
- Review session → play audio continuously
- Search transcription → jump to moment
- Export audio → download MP3

## Metrics & Success

### User Engagement
- % of sessions with audio recording enabled
- Average audio playback duration vs. session length
- Search queries per session review
- Export usage (audio vs. transcription vs. video)

### Performance
- Time to load session audio player (<1 second)
- Search response time (<200ms for 1000 segments)
- Export generation time (<10s for 1-hour session)

### Quality
- Transcription accuracy (WER < 10%)
- Key moments precision (% relevant / total detected)
- User satisfaction (NPS score)
