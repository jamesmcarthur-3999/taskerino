# Sessions 2.0 Design Document

> **Purpose:** Rebuild Taskerino's Sessions feature from the ground up - cutting complexity, embracing Baleybots, and building excellent markdown summaries with evidence linking.

## Problem Statement

The current Sessions system has grown organically to 17,500+ lines with:
- Dual canvas systems (morphing canvas + flexible canvas)
- 40+ field SessionSummary with 16 section types
- Complex FlexibleSessionSummary abstraction
- CanvasSpec, CanvasLayout, CanvasSection hierarchies
- Heavy end-of-session batch processing (slow, unreliable)

**Result:** Over-engineered infrastructure that's hard to maintain and doesn't deliver value proportional to its complexity.

## Design Principles

1. **Raw data is king** - Keep screenshots, audio, video as pristine source material
2. **AI outputs are regenerable** - Never treat AI analysis as primary data
3. **Incremental over batch** - Process data as it arrives, not at session end
4. **Markdown first** - Beautiful markdown summaries, not complex UI components
5. **Evidence linking** - Every claim traces back to source material
6. **Right-sized models** - Haiku for speed, Sonnet for synthesis, Whisper for audio

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SESSION ORCHESTRATOR                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Screenshots  │  │    Audio     │  │    Video     │          │
│  │   Stream     │  │   Stream     │  │   Stream     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Screenshot  │  │    Audio     │  │   (Future)   │          │
│  │   Analyzer   │  │  Transcriber │  │    Video     │          │
│  │   (Haiku)    │  │  (Whisper)   │  │   Analyzer   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘          │
│         │                 │                                     │
│         │                 ▼                                     │
│         │          ┌──────────────┐                             │
│         │          │    Audio     │                             │
│         │          │   Analyzer   │                             │
│         │          │   (Haiku)    │                             │
│         │          └──────┬───────┘                             │
│         │                 │                                     │
│         ▼                 ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    ANALYSIS STORE                        │   │
│  │  Record<screenshotId, ScreenshotAnalysis>               │   │
│  │  Record<audioSegmentId, AudioAnalysis>                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼ (every 30-60s during session)    │
│                   ┌──────────────────┐                          │
│                   │  Summary Builder │                          │
│                   │     (Sonnet)     │                          │
│                   └────────┬─────────┘                          │
│                            │                                    │
│                            ▼                                    │
│                   ┌──────────────────┐                          │
│                   │  Markdown Summary │                         │
│                   │  + Evidence Links │                         │
│                   └──────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Baleybots Integration

### Pattern: Stateless Bots + Smart Orchestrator

**Bots are pure functions:** Data in → Analysis out. No state, no storage, no side effects.

**Orchestrator manages everything else:**
- Storage and persistence
- Scheduling and coordination
- Evidence index building
- Cost tracking
- Dynamic bot spawning

### Why This Pattern?

1. **Testable** - Bots are pure, easy to unit test
2. **Composable** - Mix and match bots for different workflows
3. **Debuggable** - Clear separation of concerns
4. **Regenerable** - Re-run any bot on stored data

---

## Bot Roster

### 1. Screenshot Analyzer
```typescript
// Input: Screenshot image
// Output: ScreenshotAnalysis
{
  activity: string;           // "Editing code in VS Code"
  extractedText: string[];    // OCR'd text
  elements: string[];         // UI elements detected
  confidence: number;
}
```
- **Model:** Haiku (fast, cheap)
- **Trigger:** New screenshot captured
- **Latency:** <2s per image

### 2. Audio Transcriber
```typescript
// Input: Audio chunk (WAV)
// Output: Transcript
{
  text: string;
  timestamps: { start: number; end: number; text: string }[];
}
```
- **Model:** Whisper
- **Trigger:** Audio segment complete
- **Chunk size:** 30-60 seconds

### 3. Audio Analyzer
```typescript
// Input: Transcript
// Output: AudioAnalysis
{
  topics: string[];
  speakers: { id: string; lines: string[] }[];
  sentiment: 'positive' | 'neutral' | 'frustrated';
  decisions: string[];
  questions: string[];
}
```
- **Model:** Haiku
- **Trigger:** New transcript available

### 4. Summary Builder
```typescript
// Input: All session analyses + existing summary
// Output: SessionSummary
{
  markdown: string;           // Full summary
  evidence: EvidenceLink[];   // Source references
  generatedAt: string;
}
```
- **Model:** Sonnet (synthesis requires intelligence)
- **Trigger:** Every 30-60s during active session
- **Goal:** 90% complete when session ends

### 5. Task Extractor
```typescript
// Input: Summary + analyses
// Output: ExtractedTasks
{
  tasks: {
    title: string;
    priority: 'high' | 'medium' | 'low';
    context: string;
    evidenceIds: string[];
  }[];
}
```
- **Model:** Haiku
- **Trigger:** Summary updated

---

## Dynamic Agent Spawning

The orchestrator can spawn specialist bots on demand using `spawnBaleybotTool`:

```typescript
// During summary building, if specialized analysis needed:
const specialists = [
  { trigger: 'code detected', spawn: 'codeReviewBot' },
  { trigger: 'meeting detected', spawn: 'meetingNotesBot' },
  { trigger: 'debug session', spawn: 'debugAnalysisBot' },
];
```

**Spawning Decision Made By:** Summary Builder (Sonnet has judgment to know when specialists help)

**Future Specialists (not MVP):**
- Code Review Bot - Deep code analysis when screenshots show IDEs
- Meeting Notes Bot - Structure meeting discussions
- Research Bot - Organize research/reading sessions
- Debug Analysis Bot - Track debugging approaches and solutions

---

## Evidence Linking

Every claim in the summary links to source material:

```typescript
interface EvidenceLink {
  id: string;
  type: 'screenshot' | 'audio' | 'video';
  sourceId: string;           // ID of raw data
  timestamp: string;          // When in session
  excerpt?: string;           // Relevant quote/description
}

interface SessionSummary {
  markdown: string;
  evidence: EvidenceLink[];
  generatedAt: string;
}
```

**Markdown Format:**
```markdown
## Key Decisions

- Decided to use Redis for caching [^1][^2]
- Agreed to postpone auth refactor [^3]

## Evidence

[^1]: Screenshot at 14:32 - Slack discussion with team
[^2]: Audio 14:30-14:35 - "Let's go with Redis, it's simpler"
[^3]: Audio 15:10-15:12 - "Auth can wait until next sprint"
```

---

## Data Model

### Simplified Session

```typescript
interface Session {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  startTime: string;
  endTime?: string;

  // Configuration
  config: {
    screenshotInterval: number;  // seconds
    audioEnabled: boolean;
  };

  // Raw Data (source of truth)
  screenshots: SessionScreenshot[];
  audioSegments: SessionAudioSegment[];

  // AI Outputs (regenerable, keyed by source ID)
  analyses: {
    screenshots: Record<string, ScreenshotAnalysis>;
    audio: Record<string, AudioAnalysis>;
  };

  // Summary (markdown + evidence)
  summary?: {
    markdown: string;
    generatedAt: string;
    evidence: EvidenceLink[];
  };

  // Extracted entities (optional, for quick access)
  extractedTasks?: ExtractedTask[];
  extractedTopics?: string[];
}
```

### What We're Cutting

**DELETE entirely:**
- `FlexibleSessionSummary` and its 16 section types
- `CanvasSpec`, `CanvasLayout`, `CanvasSection`
- `MorphingCanvas` component system
- `FlexibleCanvas` component system
- `SessionSummary` (old 40+ field version)
- `sessionsAgentService.ts` (use Baleybots)
- `videoAnalysisAgent.ts` (use Baleybots)
- Complex enrichment pipeline

**KEEP:**
- Raw data types: `SessionScreenshot`, `SessionAudioSegment`
- Core entity types: `Note`, `Task`, `Topic`, `Company`, `Contact`
- Storage adapters
- Core session lifecycle (start, pause, resume, end)

---

## UI Approach

### MVP: Markdown-First

The summary is rendered as beautiful markdown:

```
┌─────────────────────────────────────────────────────────────┐
│ Session: API Integration Work                               │
│ Duration: 2h 15m | Jan 30, 2026                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ## Summary                                                 │
│                                                             │
│  Implemented the user authentication API endpoints,         │
│  including JWT token generation and refresh logic. [^1]     │
│                                                             │
│  ## Key Decisions                                           │
│                                                             │
│  - Using RS256 for JWT signing [^2]                        │
│  - Token expiry set to 15 minutes [^3]                     │
│                                                             │
│  ## Tasks Created                                           │
│                                                             │
│  ☐ Add rate limiting to auth endpoints                     │
│  ☐ Write integration tests for token refresh               │
│                                                             │
│  ---                                                        │
│  [^1]: Screenshot 14:32 - VS Code with auth.ts             │
│  [^2]: Audio 14:45 - "RS256 is more secure for our use"    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Evidence Modal (on footnote click)

Clicking an evidence link opens a modal with:
- The source screenshot/audio
- Timestamp in session timeline
- Surrounding context

### Future (Not MVP)

- Interactive timeline view
- Evidence gallery
- Export to various formats

---

## Processing Flow

### During Session (Real-time)

```
1. Screenshot captured
   → Store raw screenshot
   → Queue for ScreenshotAnalyzer
   → Store analysis keyed by screenshot ID

2. Audio segment complete
   → Store raw audio
   → Queue for AudioTranscriber
   → Store transcript
   → Queue transcript for AudioAnalyzer
   → Store analysis keyed by segment ID

3. Every 30-60 seconds
   → SummaryBuilder receives all analyses
   → Generates/updates markdown summary
   → Builds evidence index
   → TaskExtractor runs on new summary
```

### Session End

```
1. Final summary generation (already 90% done)
2. TaskExtractor final pass
3. Optional: Spawn specialists if needed
4. Mark session complete
```

**Key insight:** No heavy batch processing at end. Summary is built incrementally.

---

## Cost Management

### Model Selection

| Bot | Model | Cost/1K tokens | Rationale |
|-----|-------|----------------|-----------|
| Screenshot Analyzer | Haiku | $0.25 | High volume, simple analysis |
| Audio Transcriber | Whisper | $0.006/min | Only option for audio |
| Audio Analyzer | Haiku | $0.25 | Process transcripts cheaply |
| Summary Builder | Sonnet | $3.00 | Synthesis needs quality |
| Task Extractor | Haiku | $0.25 | Simple extraction |

### Budget Controls

```typescript
interface SessionConfig {
  maxCostThreshold?: number;  // Stop if exceeded
  costWarningThreshold?: number;
}

// Track per-session
interface SessionCosts {
  screenshots: number;
  audio: number;
  summaries: number;
  total: number;
}
```

---

## Migration Strategy

### Phase 1: New Data Model
- Create new Session interface
- Build migration for existing sessions
- Keep old types for backwards compatibility

### Phase 2: Baleybots Integration
- Implement 5 core bots
- Build SessionOrchestrator
- Wire up real-time processing

### Phase 3: UI Rebuild
- Markdown summary renderer
- Evidence linking UI
- Session list/detail views

### Phase 4: Cleanup
- Delete old canvas components
- Delete old summary types
- Remove legacy services

---

## Success Criteria

1. **Simplicity:** <3,000 LOC for entire Sessions feature (down from 17,500+)
2. **Speed:** Summary 90% complete when session ends
3. **Quality:** Every summary claim has evidence link
4. **Reliability:** No more batch processing failures
5. **Maintainability:** Clear separation of concerns

---

## Open Questions

1. **Video support?** - Defer to post-MVP, but architecture supports it
2. **Offline sessions?** - Queue analyses, process when online
3. **Session templates?** - Different configs for meetings vs coding vs research

---

## Appendix: Files to Delete

Based on analysis, these files/components will be removed:

```
src/components/morphing-canvas/     # Entire directory
src/components/sessions/FlexibleCanvas*
src/services/sessionsAgentService.ts
src/services/videoAnalysisAgent.ts
src/services/sessionEnrichmentService.ts (most of it)
src/types.ts:                       # ~400 lines of session types
  - FlexibleSessionSummary
  - CanvasSpec
  - CanvasLayout
  - CanvasSection
  - All 16 section type interfaces
```

## Appendix: New Files to Create

```
src/bots/session-orchestrator.ts    # Core orchestrator
src/bots/evidence-linker.ts         # Evidence index builder
src/components/sessions/SummaryView.tsx  # Markdown renderer
src/components/sessions/EvidenceModal.tsx
src/components/sessions/SessionDetail.tsx  # New detail view
```
