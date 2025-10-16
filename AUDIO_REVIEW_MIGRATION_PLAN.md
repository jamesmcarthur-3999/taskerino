# Audio Review Architecture Migration Plan

**Version:** 1.0
**Date:** 2025-10-13
**Status:** Planning Phase

---

## Executive Summary

This document outlines the complete migration plan for restructuring Taskerino's audio processing architecture. The goal is to simplify real-time recording while adding comprehensive post-session audio review capabilities.

### Key Changes

1. **Remove audio description mode** from real-time recording
2. **Use only Whisper-1** during active sessions (fast, text-only transcription)
3. **Add one-time GPT-4o-audio-preview review** when user first opens summary page
4. **Cache review results** to avoid redundant processing
5. **Keep summary agent reactive** - regenerate on timeline edits

---

## 1. Research Findings: GPT-4o Audio Limits

### API Constraints

| Limit Type | Value | Source |
|------------|-------|--------|
| **Maximum File Size** | 20 MB | GPT-4o-audio-preview (Chat Completions) |
| **Maximum Duration** | ~25 minutes (1500 seconds) | Inferred from gpt-4o-transcribe limits |
| **Supported Formats** | WAV, MP3, FLAC, Opus, M4A | OpenAI Chat Completions Audio API |
| **Rate Limits** | Standard tier limits apply | Adjusted for preview model |

### Comparison Table

| API | Model | Max Size | Max Duration | Cost/Min | Use Case |
|-----|-------|----------|--------------|----------|----------|
| **Whisper** | whisper-1 | 25 MB | None documented | $0.006 | Fast transcription |
| **Chat (Audio)** | gpt-4o-audio-preview | 20 MB | ~25 min | $0.026 | Rich audio understanding |
| **Transcribe** | gpt-4o-transcribe | 25 MB | 25 min | TBD | Specialized transcription |

### Implications for Taskerino

**Typical Session Sizes:**
- Average session: 2 hours
- Screenshot interval: 2 minutes
- Audio clip interval: 2 minutes (matched to screenshots)
- Number of 10-second clips: 720 clips
- Estimated concatenated size: ~40-60 MB for 2 hours (at 16kHz mono WAV)

**Problem:** Most sessions will exceed 20 MB limit!

**Solution Strategy:**
1. **Primary approach:** Downsample audio to 8kHz mono before concatenation
   - 8kHz mono: ~15-20 MB for 2 hours ✅
   - Still good enough for speech understanding

2. **Fallback for long sessions:** Chunk processing
   - If session > 20 minutes, split into 15-minute chunks
   - Process each chunk separately
   - Merge insights programmatically

3. **User warning:** Add UI warning if session approaches limits

---

## 2. Current Architecture Documentation

### Audio Processing Flow (Current State)

```
┌─────────────────────────────────────────────────────────────┐
│                    ACTIVE SESSION                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌─────────────────────────┐
                │  Audio Mode Selection   │
                │  - Off                  │
                │  - Transcription        │◄── USER CHOICE (TO BE REMOVED)
                │  - Description          │
                └─────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          │                                       │
          ▼                                       ▼
┌─────────────────────┐              ┌─────────────────────┐
│   TRANSCRIPTION     │              │   DESCRIPTION       │
│   (whisper-1)       │              │   (gpt-4o-audio)    │
│   - Fast            │              │   - Slow            │
│   - $0.006/min      │              │   - $0.026/min      │
│   - Text only       │              │   - Rich context    │
└─────────────────────┘              └─────────────────────┘
          │                                       │
          └───────────────────┬───────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  SessionAudioSegment  │
                  │  - transcription      │
                  │  - description?       │
                  │  - attachmentId       │
                  │  - mode               │
                  └───────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   Audio Segments      │
                  │   Stored in DB        │
                  └───────────────────────┘
```

### Data Models (Current)

#### Session Type
```typescript
interface Session {
  // ... other fields
  audioMode: 'off' | 'transcription' | 'description';  // ← TO BE SIMPLIFIED
  audioRecording: boolean;
  audioSegments?: SessionAudioSegment[];
  fullAudioAttachmentId?: string;  // Currently unused
  audioKeyMoments?: AudioKeyMoment[];
}
```

#### SessionAudioSegment Type
```typescript
interface SessionAudioSegment {
  id: string;
  sessionId: string;
  timestamp: string;
  duration: number;
  transcription: string;
  description?: string;  // ← Only populated in 'description' mode
  mode: 'transcription' | 'description';  // ← TO BE REMOVED
  model: string;
  attachmentId?: string;
}
```

### Key Services (Current)

#### `/src/services/audioRecordingService.ts`
- **Responsibilities:**
  - Start/stop/pause audio recording
  - Process audio chunks every 2 minutes (matching screenshot interval)
  - Call OpenAI based on selected mode (transcription OR description)
  - Create SessionAudioSegment objects
  - Store audio attachments

- **Key Methods:**
  - `startRecording()` - Initializes Rust audio capture
  - `processAudioChunk()` - Handles incoming audio data
  - `stopRecording()` - Cleanup

#### `/src/services/openAIService.ts`
- **Responsibilities:**
  - Transcribe audio with Whisper-1 OR GPT-4o-audio-preview
  - Mode-based routing

- **Key Methods:**
  - `transcribeAudio(audioBase64, mode: 'transcription' | 'description')` ← TO BE SIMPLIFIED

#### `/src/services/audioConcatenationService.ts`
- **Responsibilities:**
  - Build virtual timeline from segments
  - Generate concatenated WAV file
  - Time mapping between segments and session timeline

- **Key Methods:**
  - `buildTimeline()` - Creates time mappings
  - `exportAsWAV()` - Generates single audio file
  - `sessionTimeToSegment()` - Time conversion

---

## 3. Proposed Architecture

### New Audio Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ACTIVE SESSION                            │
│                    (Real-time)                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌─────────────────────────┐
                │  Audio Recording        │
                │  - ALWAYS Whisper-1     │◄── SIMPLIFIED (NO CHOICE)
                │  - Fast transcription   │
                │  - $0.006/min           │
                └─────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  SessionAudioSegment  │
                  │  - transcription      │
                  │  - attachmentId       │
                  └───────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │   Segments Stored     │
                  └───────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               SUMMARY PAGE (Post-Session)                    │
│               (One-time processing)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  Check Review Status  │
                  │  audioReviewCompleted?│
                  └───────────────────────┘
                     │              │
                  NO │              │ YES
                     │              │
                     ▼              ▼
     ┌───────────────────────┐   ┌──────────────────┐
     │  Generate Full Audio  │   │  Load Cached     │
     │  - Concatenate clips  │   │  Insights        │
     │  - Downsample to 8kHz │   │                  │
     │  - Save as attachment │   │                  │
     └───────────────────────┘   └──────────────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │  GPT-4o-audio-preview │
     │  - Full context       │
     │  - $0.026/min         │
     │  - Rich understanding │
     └───────────────────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │  Save Results         │
     │  - fullTranscription  │
     │  - audioInsights      │
     │  - fullAudioAttachment│
     │  - Set flag: true     │
     └───────────────────────┘
                 │
                 └──────────┬────────────┘
                            │
                            ▼
          ┌─────────────────────────────────┐
          │    Summary Agent (Reactive)      │
          │    - Uses cached audio insights  │
          │    - Regenerates on edits        │
          │    - Comprehensive synthesis     │
          └─────────────────────────────────┘
```

### New Data Models

#### Updated Session Type
```typescript
interface Session {
  // ... existing fields

  // SIMPLIFIED: Only boolean for audio
  audioRecording: boolean;  // On or Off (no mode selection)

  // Real-time segments (Whisper-1 only)
  audioSegments?: SessionAudioSegment[];

  // ONE-TIME REVIEW RESULTS (cached)
  audioReviewCompleted: boolean;  // NEW - prevents reprocessing
  fullAudioAttachmentId?: string;  // NEW - full concatenated audio
  fullTranscription?: string;  // NEW - complete transcript from GPT-4o
  audioInsights?: {  // NEW - comprehensive analysis
    narrative: string;  // Story of the session
    emotionalJourney: string[];  // Tone changes over time
    keyMoments: Array<{
      timestamp: number;
      type: 'achievement' | 'blocker' | 'decision' | 'insight';
      description: string;
      context: string;
    }>;
    workPatterns: {
      focusLevel: 'high' | 'medium' | 'low';
      interruptions: number;
      flowStates: Array<{ start: number; end: number }>;
    };
    environmentalContext: {
      ambientNoise: string;
      workSetting: string;
      timeOfDay: string;
    };
  };

  // Legacy field (deprecated)
  audioMode?: 'off' | 'transcription' | 'description';  // TO BE REMOVED
}
```

#### Simplified SessionAudioSegment Type
```typescript
interface SessionAudioSegment {
  id: string;
  sessionId: string;
  timestamp: string;
  duration: number;
  transcription: string;  // Always from Whisper-1
  attachmentId?: string;

  // REMOVED: description, mode fields
}
```

### New Services

#### `/src/services/audioReviewService.ts` (NEW)

```typescript
/**
 * Audio Review Service
 *
 * Handles one-time comprehensive audio review using GPT-4o-audio-preview.
 * Only runs when user first opens summary page for a completed session.
 */
export class AudioReviewService {
  /**
   * Check if session needs audio review
   */
  needsReview(session: Session): boolean {
    return (
      session.audioSegments &&
      session.audioSegments.length > 0 &&
      !session.audioReviewCompleted
    );
  }

  /**
   * Perform comprehensive audio review
   *
   * Steps:
   * 1. Generate concatenated audio (downsampled to 8kHz)
   * 2. Check size/duration constraints
   * 3. Send to GPT-4o-audio-preview with comprehensive prompt
   * 4. Parse and structure insights
   * 5. Save to session with audioReviewCompleted = true
   */
  async reviewSession(
    session: Session,
    onProgress?: (status: string) => void
  ): Promise<AudioReviewResult> {
    // Implementation details...
  }

  /**
   * Handle large sessions (> 20 minutes or > 20 MB)
   */
  private async reviewInChunks(
    audioSegments: SessionAudioSegment[]
  ): Promise<AudioReviewResult> {
    // Split into 15-minute chunks
    // Process each separately
    // Merge insights programmatically
  }
}
```

#### Updated `/src/services/audioRecordingService.ts`

**Changes:**
- Remove `audioMode` parameter
- Always use Whisper-1 for transcription
- Remove description logic
- Simplify SessionAudioSegment creation

```typescript
// BEFORE
async startRecording(
  session: Session,
  onAudioSegmentProcessed: (segment: SessionAudioSegment) => void
): Promise<void> {
  this.audioMode = session.audioMode;  // ← REMOVE
  // ...
}

// AFTER
async startRecording(
  session: Session,
  onAudioSegmentProcessed: (segment: SessionAudioSegment) => void
): Promise<void> {
  // audioMode removed - always use transcription
  // ...
}
```

#### Updated `/src/services/openAIService.ts`

**Changes:**
- Keep `transcribeAudio()` for Whisper-1 (used during recording)
- Add new `analyzeFullAudio()` for GPT-4o-audio-preview (used in review)
- Remove mode parameter from `transcribeAudio()`

```typescript
// NEW METHOD
async analyzeFullAudio(
  audioBase64: string
): Promise<{
  transcription: string;
  insights: AudioInsights;
}> {
  // Use GPT-4o-audio-preview with comprehensive prompt
  // Return structured analysis
}

// SIMPLIFIED
async transcribeAudio(audioBase64: string): Promise<string> {
  // Always use whisper-1, no mode parameter
}
```

---

## 4. Migration Implementation Plan

### Phase 1: Database Schema Updates ✓

**Files to modify:**
- `/src/types.ts` - Update Session and SessionAudioSegment types

**Changes:**
```typescript
// Session interface
+ audioReviewCompleted: boolean;
+ fullAudioAttachmentId?: string;
+ fullTranscription?: string;
+ audioInsights?: AudioInsights;
- audioMode?: 'off' | 'transcription' | 'description';  // Deprecate

// SessionAudioSegment interface
- description?: string;  // Remove
- mode: 'transcription' | 'description';  // Remove
```

**Migration Strategy:**
- Keep deprecated fields temporarily for backward compatibility
- Add migration utility to convert old sessions
- Set `audioReviewCompleted = false` for existing sessions

---

### Phase 2: Service Layer Updates ✓

#### 2.1 Create `audioReviewService.ts`

**Location:** `/src/services/audioReviewService.ts`

**Implementation checklist:**
- [ ] Create service class
- [ ] Implement `needsReview()`
- [ ] Implement `reviewSession()`
- [ ] Add audio downsampling (16kHz → 8kHz)
- [ ] Implement chunking strategy for large sessions
- [ ] Add comprehensive GPT-4o prompt
- [ ] Parse and structure response
- [ ] Handle errors gracefully

#### 2.2 Update `openAIService.ts`

**Changes:**
- [ ] Add `analyzeFullAudio()` method
- [ ] Simplify `transcribeAudio()` to always use Whisper-1
- [ ] Remove `getModelForMode()` - no longer needed
- [ ] Update cost estimation methods

#### 2.3 Update `audioRecordingService.ts`

**Changes:**
- [ ] Remove `audioMode` from `startRecording()`
- [ ] Always use 'transcription' mode
- [ ] Simplify `processAudioChunk()` - remove description logic
- [ ] Update SessionAudioSegment creation (remove mode/description)

#### 2.4 Update `audioConcatenationService.ts`

**Changes:**
- [ ] Add `exportDownsampledWAV()` method (8kHz mono)
- [ ] Ensure compatibility with audioReviewService

---

### Phase 3: UI Components Updates ✓

#### 3.1 Remove Audio Mode Selection

**Files to modify:**
- Find all components with audio mode toggles/selectors
- Typically in session creation/settings dialogs

**Search commands:**
```bash
grep -r "audioMode" src/components/
grep -r "transcription.*description" src/components/
```

**Changes:**
- [ ] Replace audio mode dropdown with simple on/off toggle
- [ ] Update UI copy: "Enable Audio Recording" (no mode choice)
- [ ] Remove cost comparison between modes

#### 3.2 Add Audio Review Status UI

**New components needed:**

##### `AudioReviewStatusBanner.tsx` (NEW)
Shows review progress on summary page:
```tsx
<div className="review-banner">
  {session.audioReviewCompleted ? (
    <span>✅ Audio review complete</span>
  ) : needsReview(session) ? (
    <button onClick={startReview}>
      🎧 Ned is reviewing the session audio...
    </button>
  ) : (
    <span>No audio to review</span>
  )}
</div>
```

##### `AudioReviewProgressModal.tsx` (NEW)
Shows progress during review:
```tsx
<Modal>
  <h2>Ned is reviewing your work...</h2>
  <ProgressBar value={progress} />
  <p>{currentStep}</p>
  <ul>
    <li>✓ Preparing audio</li>
    <li>⏳ Analyzing context...</li>
    <li>⏸ Extracting insights</li>
  </ul>
</Modal>
```

#### 3.3 Update Session Summary Components

**Files to modify:**
- `/src/components/SessionDetailView.tsx`
- `/src/components/SessionSummaryPanel.tsx` (if exists)

**Changes:**
- [ ] Add audio review trigger on first load
- [ ] Show review status banner
- [ ] Display audio insights (from cached review)
- [ ] Add "Refresh Summary" button (triggers summary regeneration)

#### 3.4 Update Audio Player

**Files to modify:**
- `/src/components/UnifiedSessionAudioPlayer.tsx`

**Changes:**
- [ ] Remove mode-specific UI elements
- [ ] Show full transcription (from audioInsights) if available
- [ ] Display key moments from audio review

---

### Phase 4: Summary Agent Integration ✓

#### 4.1 Create/Update Summary Service

**Location:** `/src/services/summaryService.ts`

**Implementation:**
```typescript
export class SummaryService {
  /**
   * Generate or regenerate session summary
   * Uses cached audio insights if available
   */
  async generateSummary(session: Session): Promise<SessionSummary> {
    const context = {
      screenshots: session.screenshots,
      audioSegments: session.audioSegments,  // Real-time transcripts
      audioInsights: session.audioInsights,  // Cached GPT-4o review
      contextItems: session.contextItems,
      extractedTasks: getTasksForSession(session.id),
      extractedNotes: getNotesForSession(session.id),
    };

    // Send to Claude API with comprehensive prompt
    const summary = await this.generateWithClaude(context);
    return summary;
  }

  /**
   * Check if summary needs regeneration
   */
  needsRegeneration(session: Session): boolean {
    // Check if anything changed since last summary update
    return hasChanges(session);
  }
}
```

#### 4.2 Update Summary Triggers

**Reactive triggers:**
- User adds comment to screenshot
- User flags screenshot
- User adds task/note from session
- User edits context items

**Implementation:**
```typescript
// In session edit handlers
onScreenshotComment(screenshotId: string, comment: string) {
  // Update screenshot
  updateScreenshot(screenshotId, { userComment: comment });

  // Trigger summary regeneration
  if (summaryService.needsRegeneration(session)) {
    summaryService.generateSummary(session);
  }
}
```

---

### Phase 5: Testing & Validation ✓

#### 5.1 Unit Tests

**New test files:**
- `/src/services/audioReviewService.test.ts`
- `/src/services/summaryService.test.ts`

**Test cases:**
- [ ] Audio review with small session (< 20 MB)
- [ ] Audio review with large session (chunking)
- [ ] Audio review with no audio segments
- [ ] Summary regeneration triggers
- [ ] Cached insights usage
- [ ] Error handling (API failures)

#### 5.2 Integration Tests

**Scenarios:**
- [ ] Complete session workflow (record → complete → review → summary)
- [ ] Edit session after review (summary regeneration)
- [ ] Multiple sessions in parallel
- [ ] Session with mixed content (audio + screenshots + notes)

#### 5.3 Performance Tests

**Metrics:**
- [ ] Audio concatenation time (2-hour session)
- [ ] GPT-4o review latency
- [ ] Summary generation time
- [ ] Memory usage during concatenation

---

### Phase 6: Migration & Deployment ✓

#### 6.1 Data Migration

**Migration script:** `/scripts/migrate-audio-schema.ts`

```typescript
/**
 * Migrate existing sessions to new audio schema
 */
export async function migrateAudioSchema() {
  const sessions = await getAllSessions();

  for (const session of sessions) {
    // Set review flag to false (requires review)
    session.audioReviewCompleted = false;

    // Clean up old audio segments (remove description/mode)
    if (session.audioSegments) {
      session.audioSegments = session.audioSegments.map(segment => ({
        ...segment,
        // Remove deprecated fields
        description: undefined,
        mode: undefined,
      }));
    }

    await saveSession(session);
  }
}
```

#### 6.2 Deployment Checklist

- [ ] Run migration script on production data
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Monitor error rates
- [ ] Check OpenAI API usage/costs
- [ ] User acceptance testing

#### 6.3 Rollback Plan

**If issues arise:**
1. Revert database schema changes
2. Restore old audioMode selection UI
3. Re-enable description mode in audioRecordingService
4. Disable audioReviewService calls

**Rollback script:** `/scripts/rollback-audio-migration.ts`

---

## 5. Files Reference

### Files to Create

1. `/src/services/audioReviewService.ts` - One-time audio review
2. `/src/services/summaryService.ts` - Reactive summary generation
3. `/src/components/AudioReviewStatusBanner.tsx` - Review status UI
4. `/src/components/AudioReviewProgressModal.tsx` - Progress indicator
5. `/scripts/migrate-audio-schema.ts` - Migration utility
6. `/scripts/rollback-audio-migration.ts` - Rollback utility

### Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `/src/types.ts` | Update Session, SessionAudioSegment | 🔴 Critical |
| `/src/services/audioRecordingService.ts` | Remove audioMode, always use Whisper | 🔴 Critical |
| `/src/services/openAIService.ts` | Add analyzeFullAudio(), simplify | 🔴 Critical |
| `/src/services/audioConcatenationService.ts` | Add downsampling | 🟡 High |
| `/src/components/SessionDetailView.tsx` | Add review trigger | 🟡 High |
| `/src/components/UnifiedSessionAudioPlayer.tsx` | Update for simplified schema | 🟡 High |
| Session creation UI components | Remove mode selector | 🔵 Medium |
| Settings components | Update audio preferences | 🔵 Medium |

### Files to Search For

**Audio mode selectors:**
```bash
grep -rn "audioMode.*off.*transcription.*description" src/
grep -rn "description.*mode" src/components/
```

**OpenAI service usage:**
```bash
grep -rn "openAIService.transcribeAudio" src/
grep -rn "transcription.*description" src/
```

---

## 6. Implementation Timeline

### Week 1: Foundation
- [ ] Day 1-2: Schema updates + migration script
- [ ] Day 3-4: Create audioReviewService
- [ ] Day 5: Update openAIService

### Week 2: Core Features
- [ ] Day 1-2: Update audioRecordingService
- [ ] Day 3-4: Create summaryService
- [ ] Day 5: Integration testing

### Week 3: UI & Polish
- [ ] Day 1-2: Update session components
- [ ] Day 3: Remove audio mode selectors
- [ ] Day 4-5: Add review status UI

### Week 4: Testing & Launch
- [ ] Day 1-2: End-to-end testing
- [ ] Day 3: Performance optimization
- [ ] Day 4: Migration testing
- [ ] Day 5: Production deployment

---

## 7. Risk Assessment

### High Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sessions exceed 20MB limit | Review fails | Implement chunking + downsampling |
| GPT-4o rate limits | Blocked reviews | Queue system + retry logic |
| Migration breaks existing sessions | Data loss | Comprehensive testing + rollback plan |

### Medium Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Downsampling degrades quality | Poor insights | Test quality with 8kHz samples |
| Review takes too long (>2 min) | Poor UX | Show progress, allow background processing |
| Summary regeneration too frequent | High costs | Add debouncing + confirmation |

### Low Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| UI confusion from mode removal | User questions | Clear documentation + tooltips |
| Cached insights become stale | Outdated summary | Add "Force Review" button |

---

## 8. Success Metrics

### Performance Metrics
- Audio review completion time < 2 minutes (90th percentile)
- Summary regeneration < 30 seconds
- Memory usage during concatenation < 500MB
- Zero data loss during migration

### Quality Metrics
- GPT-4o insights rated "helpful" by users > 80%
- Summary accuracy (compared to manual review) > 85%
- User satisfaction score > 4/5

### Cost Metrics
- Average cost per session < $1
- 50% reduction in real-time API costs
- Total API cost increase < 20% (with better insights)

---

## 9. Open Questions

1. **Chunking Strategy:** Should we split by time or by natural breaks in audio?
   - **Recommendation:** Time-based (15 min chunks) for simplicity

2. **Force Re-review Option:** Should users be able to manually trigger re-review?
   - **Recommendation:** Yes, add "Refresh Audio Insights" button (with cost warning)

3. **Review Queueing:** Should we process reviews immediately or queue for background?
   - **Recommendation:** Immediate with progress modal for better UX

4. **Old Sessions:** Should we automatically review all existing sessions?
   - **Recommendation:** No, only review on-demand (when user opens summary)

---

## 10. Next Steps

**Immediate Actions:**
1. ✅ Get user approval on this migration plan
2. Create feature branch: `feature/audio-review-architecture`
3. Begin Phase 1: Database schema updates
4. Set up testing environment with sample audio files

**Before Implementation:**
- [ ] User reviews and approves this plan
- [ ] Confirm GPT-4o audio limits with test API calls
- [ ] Create sample 2-hour audio file for testing
- [ ] Set up monitoring for API costs

---

## Appendix A: GPT-4o Audio Prompt Template

```
You are analyzing a work session recording. The user has been working for {duration} minutes.

Context:
- Session name: {session.name}
- Description: {session.description}
- Start time: {session.startTime}
- Screenshots captured: {session.screenshots.length}
- Real-time transcripts available: {session.audioSegments.length} clips

Task: Provide a comprehensive analysis of this session's audio, including:

1. FULL TRANSCRIPTION
   - Clean, accurate transcription of all speech
   - Note any unclear sections

2. EMOTIONAL JOURNEY
   - Track tone/emotion changes over time
   - Identify frustration, excitement, focus, confusion moments
   - Note vocal cues (sighs, exclamations, pace changes)

3. KEY MOMENTS (with timestamps in seconds from start)
   - Achievements: "Got the login working"
   - Blockers: "Can't figure out why this test fails"
   - Decisions: "Going to try a different approach"
   - Insights: "Oh, the issue is the async timing"

4. WORK PATTERNS
   - Focus level: high/medium/low
   - Interruptions count
   - Flow states (start/end timestamps)

5. ENVIRONMENTAL CONTEXT
   - Ambient noise description
   - Work setting indicators
   - Background sounds

Format your response as structured JSON:
{
  "fullTranscription": "...",
  "narrative": "...",
  "emotionalJourney": [...],
  "keyMoments": [...],
  "workPatterns": {...},
  "environmentalContext": {...}
}
```

---

**Document End**

Questions? Contact: [Project Lead]
Last Updated: 2025-10-13
