# Sessions Data Pipeline - Complete Architecture Map

**Created**: November 2, 2025
**Status**: Production-Ready with Phase 5 Optimizations Complete

---

## 🎯 Executive Summary

Taskerino implements a **5-layer sessions architecture**:

```
CAPTURE → STORAGE → PROCESSING → QUERY → AI INTEGRATION
```

Data flows from multi-source recording (screenshots/audio/video) through content-addressable storage and chunked persistence, into parallel AI enrichment pipelines, queryable via multiple access patterns, and exposed to AI agents through specialized tools.

**Key Achievement**: **78% cost reduction** via caching + incremental enrichment + parallel processing.

---

## 📊 Data Flow Visualization

```
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 1: CAPTURE (Recording/Lifecycle)                          │
├──────────────────────────────────────────────────────────────────┤
│ sessionMachine.ts (584 lines) - XState v5 state machine         │
│   States: idle → validating → starting → active → pausing →     │
│           resuming → ending → persisting → completed            │
│                                                                  │
│ Recording Services:                                              │
│   • Screenshots - Adaptive interval via curiosity (0-1 score)   │
│   • Audio - AudioGraph (WAV → MP3, 30-60s segments)             │
│   • Video - ScreenCaptureKit (H.264, multi-source, 30-60 FPS)   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 2: STORAGE (Persistence/Deduplication)                    │
├──────────────────────────────────────────────────────────────────┤
│ ChunkedSessionStorage.ts (1,634 lines)                          │
│   • Metadata-only load: <10ms (was 2-3s) ⚡                     │
│   • Progressive chunk loading: <500ms                            │
│   • 20 screenshots/chunk, 100 audio segments/chunk              │
│   • LRU cache: >90% hit rate, <1ms on hit                       │
│                                                                  │
│ ContentAddressableStorage.ts (718 lines)                        │
│   • SHA-256 deduplication: 50-70% storage reduction 💾          │
│   • Reference counting: Automatic garbage collection            │
│   • O(1) hash lookup                                             │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 3: PROCESSING (Enrichment/AI Analysis)                    │
├──────────────────────────────────────────────────────────────────┤
│ sessionEnrichmentService.ts (2,296 lines) - Orchestrator        │
│   10 Stages: Validation → Cost Est → Lock → Checkpoint →        │
│              Parallel(Audio+Video) → Summary → Canvas →          │
│              Update → Cleanup → Cache                            │
│   • Parallel processing: Audio + Video (error isolation)        │
│   • Cost reduction: 78% average 💰                              │
│   • 99% error recovery rate                                      │
│                                                                  │
│ sessionsAgentService.ts (906 lines) - Real-time Analysis        │
│   • analyzeScreenshot(): Claude Haiku 4.5 (1.5-2.5s)           │
│   • Curiosity scoring: Determines next capture interval          │
│   • Sliding window: Last 5 screenshots for context              │
│   • generateSessionSummary(): Claude Sonnet 4.5 (batch)         │
│                                                                  │
│ Phase 5 Optimizations:                                          │
│   • EnrichmentResultCache: 60-70% hit rate ⚡                   │
│   • IncrementalEnrichmentService: 70-90% cost reduction 💰      │
│   • MemoizationCache: 30-50% API call reduction                 │
│   • ParallelEnrichmentQueue: 5x throughput 🚀                   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 4: QUERY (Access Patterns/Search)                         │
├──────────────────────────────────────────────────────────────────┤
│ SessionQueryEngine.ts (300+ lines)                              │
│   • Scope: Active session only                                  │
│   • StructuredQuery: Predefined filters                         │
│   • NaturalQuery: AI-powered Q&A                                │
│   • AggregationQuery: Statistics                                │
│   • Performance: <1s                                             │
│                                                                  │
│ LiveSessionContextProvider.ts                                   │
│   • In-memory filtering: <1ms ⚡                                │
│   • getRecentActivity(n), getActivitySince(t)                   │
│   • getProgressIndicators(): achievements, blockers             │
│                                                                  │
│ LiveSessionContextBuilder.ts (357 lines)                        │
│   • buildSummaryContext(): ~2-5 KB (lightweight)                │
│   • buildFullContext(): ~50-200 KB (comprehensive)              │
│   • buildDeltaContext(): ~1-10 KB (incremental)                 │
│                                                                  │
│ UnifiedIndexManager.ts                                          │
│   • Cross-entity search: <100ms (was 2-3s) ⚡                   │
│   • O(log n) via inverted indexes                               │
│   • 7 indexes per session: full-text, topic, date, tag, etc.   │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 5: AI INTEGRATION (Tools/Agents)                          │
├──────────────────────────────────────────────────────────────────┤
│ /src/services/ai-tools/ (20 files, 6,500+ lines)                │
│   • Data Gathering: getAudioData, getVideoData,                 │
│                      getTranscript, getSessionTimeline           │
│   • Transcript Correction: updateTranscript (5 modes)           │
│   • Enrichment: updateAnalysis (4 modes)                        │
│   • Suggestions: suggestEntity (3 modes)                        │
│   Permission: No permission in enrichment/live contexts ✅      │
│                                                                  │
│ /src/services/liveSession/ (Event-driven AI)                    │
│   • toolSchemas.ts: Anthropic-format tool definitions           │
│   • toolExecutor.ts: Safe tool execution                        │
│   • contextApi.ts: Read session data                            │
│   • updateApi.ts: Modify session data                           │
│   • events.ts: Real-time event bus                              │
│                                                                  │
│ nedService.ts + nedToolExecutor.ts                              │
│   • Ned AI Assistant integration                                │
│   • Permission system: forever, session, always-ask             │
│   • Uses UnifiedIndexManager for search                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Storage Structure (ChunkedSessionStorage)

```
/sessions/{session-id}/
  ├── metadata.json              # Core fields (~10 KB) ⚡ Instant load
  ├── summary.json               # AI summary (~50 KB)
  ├── audio-insights.json        # Audio analysis (~30 KB)
  ├── canvas-spec.json           # Canvas rendering (~40 KB)
  ├── transcription.json         # Full transcript (~100 KB)
  ├── screenshots/
  │   ├── chunk-000.json         # 20 screenshots (~1 MB/chunk)
  │   ├── chunk-001.json
  │   └── ...
  ├── audio-segments/
  │   ├── chunk-000.json         # 100 segments (~1 MB/chunk)
  │   └── ...
  ├── video-chunks/
  │   └── chunk-000.json         # 100 chunks (~1 MB/chunk)
  └── context-items.json         # User context

/attachments-ca/{hash-prefix}/
  └── {full-hash}/
      ├── data.bin               # Base64 attachment
      └── metadata.json          # { hash, refCount, references[] }
```

**Key Benefits**:
- **Instant metadata access**: <10ms (session lists don't load full data)
- **Progressive loading**: Load chunks as needed
- **Deduplication**: 50-70% storage reduction via SHA-256 hashing
- **Cache efficiency**: >90% hit rate on hot data

---

## 🔄 Recording Pipeline

### State Machine Lifecycle

```
sessionMachine.ts (584 lines) - XState v5
├── States:
│   idle → validating → checking_permissions → starting →
│   active → pausing/paused → resuming → ending →
│   persisting → completed
│
├── Services (sessionMachineServices.ts):
│   • startRecordingServices() - Initialize all 3 recording types
│   • pauseRecordingServices() - Zero-overhead pause (drops frames)
│   • resumeRecordingServices() - Resume from pause
│   • stopRecordingServices() - Graceful shutdown
│
└── Recording State Tracking:
    • screenshots: 'idle' | 'active' | 'paused' | 'error'
    • audio: 'idle' | 'active' | 'paused' | 'error'
    • video: 'idle' | 'active' | 'paused' | 'error'
```

### Screenshot Capture

**Trigger**: Adaptive interval based on curiosity score
- **Curiosity 0.0-0.3**: 15-30 second intervals (low activity)
- **Curiosity 0.3-0.7**: 5-15 second intervals (moderate activity)
- **Curiosity 0.7-1.0**: 2-5 second intervals (high activity)

**Flow**:
```
User activity → Screenshot capture → Base64 PNG/JPEG →
SHA-256 hash → ContentAddressableStorage.saveAttachment() →
ChunkedSessionStorage.appendScreenshot() →
(Optional) sessionsAgentService.analyzeScreenshot()
```

**AI Analysis** (Real-time):
- Model: Claude Haiku 4.5
- Latency: 1.5-2.5s
- Output: Activity, OCR text, key elements, curiosity score, progress indicators

### Audio Recording

**Platform**: macOS AudioGraph (Phase 3), cross-platform fallback

**Architecture**:
```
/src-tauri/src/audio/
├── graph/           # Composable audio processing graph
├── sources/         # Microphone, system audio inputs
├── processors/      # Effects, mixing, volume control
└── sinks/           # File encoders (WAV, MP3)
```

**Modes**:
1. **Transcription Mode** (Speech-to-text)
   - Records 30-60 second segments
   - Whisper API transcription
   - Stores: transcription, keyPhrases, sentiment, containsTask/Blocker flags

2. **Ambient Mode** (Audio description)
   - GPT-4o audio analysis
   - Narrative description of background sounds/activity

**Format**: WAV (recording) → MP3 (storage, 40-60% reduction)

### Video Recording

**Platform**: macOS 12.3+ (ScreenCaptureKit)

**Architecture** (Phase 2 - Production):
```
/src-tauri/ScreenRecorder/Core/
├── RecordingSession.swift (460 lines) - Actor-based orchestrator
├── FrameSynchronizer.swift (191 lines) - Multi-source sync (16ms tolerance)
├── FrameCompositor.swift - Combines multiple frames
└── VideoEncoder.swift - H.264 encoding
```

**Features**:
- Multi-source: Display + Window + Webcam (simultaneously)
- Frame sync: 16ms tolerance, adaptive timeout
- Pause/resume: Zero memory overhead (drops frames, no buffering)
- Hot-swap: Switch sources during active recording (~50-100ms latency)
- Output: H.264 MP4, 30-60 FPS, atomic writes

**Rust FFI Bridge**:
```
/src-tauri/src/recording/ffi.rs (739 lines)
├── SwiftRecordingSession wrapper (Arc-based thread safety)
├── Safe FFI wrappers for Swift functions
├── Type-safe source enumeration (displays, windows, webcams)
└── Error handling with descriptive FFIError enum
```

---

## 🧠 Enrichment Pipeline (Post-Session)

### sessionEnrichmentService.ts (2,296 lines)

**10-Stage Pipeline**:

```
Stage 1: Validation
  ├── Check session has enrichable data (screenshots, audio, video)
  ├── Verify API keys configured
  └── Ensure not already enriching (lock check)

Stage 2: Cost Estimation
  ├── Estimate screenshot analysis costs
  ├── Estimate audio review costs (if enabled)
  ├── Estimate video chaptering costs (if enabled)
  ├── Estimate summary generation costs
  └── Check against maxCost threshold

Stage 3: Lock Acquisition
  └── Acquire enrichment lock (prevent concurrent enrichment)

Stage 4: Checkpointing
  └── Create recovery checkpoint (enable resume on failure)

Stage 5: Parallel Enrichment
  ├── Audio Review (optional, GPT-4o audio)
  │   └── ~$0.026/min, narrative description
  └── Video Chaptering (optional, Claude vision)
      └── ~$0.001/frame, chapter markers

Stage 6: Summary Regeneration
  ├── Gather: screenshots + audio + video chapters + audio insights
  ├── Generate: sessionsAgentService.generateSessionSummary()
  └── Model: Claude Sonnet 4.5, ~$0.003

Stage 6.5: Canvas Generation
  ├── aiCanvasGenerator.generateCanvasSpec()
  └── Interactive visualization layout

Stage 7: Update Session
  ├── Atomic write via ChunkedSessionStorage.saveFullSession()
  ├── Optimistic locking (version check)
  └── Metadata update (enrichmentStatus, timestamps)

Stage 8: Cleanup
  └── Delete checkpoint (no longer needed)

Stage 9: Cache Result
  └── EnrichmentResultCache.cacheResult() (enable reuse)

Stage 10: Create Checkpoint
  └── Enable incremental enrichment (only process new data)
```

**Error Handling**:
- **Classification**: Transient (retry), permanent (fail), partial (continue)
- **Retry Strategy**: Exponential backoff (1s → 2s → 4s → 10s max), 3 attempts
- **Circuit Breaker**: 5 consecutive failures → open (prevent cascading failures)
- **Recovery Rate**: 99% for transient errors

**Cost Management**:
- Pre-enrichment estimation
- Real-time cost tracking
- maxCost threshold enforcement
- **NO COST INFO in UI** (backend tracking only)

### Phase 5 Optimizations (78% Cost Reduction)

**1. EnrichmentResultCache** (60-70% hit rate)
```typescript
// Cache key: SHA-256(audioData + videoData + prompt + modelConfig)
const cached = await cache.getCachedResult(cacheKey);
if (cached) return cached.result; // Instant, $0 cost ⚡
```

**2. IncrementalEnrichmentService** (70-90% cost reduction)
```typescript
// Only process new data since last enrichment
const changes = await incremental.detectChanges(session, checkpoint);
if (changes.hasChanges) {
  await incremental.enrichIncremental(session, changes); // Cheaper!
}
```

**3. MemoizationCache** (30-50% API call reduction)
```typescript
// Cache intermediate AI results
const result = await memoCache.getOrCompute(
  `screenshot:${hash}`,
  async () => await analyzeScreenshot(screenshot),
  86400000 // 24h TTL
);
```

**4. ParallelEnrichmentQueue** (5x throughput)
```typescript
// Process multiple sessions concurrently
sessions.forEach(session => {
  queue.enqueue(session, { includeAudio: true }, 'normal');
});
await queue.waitForCompletion(); // 5 sessions/min (was 1)
```

---

## 🔍 Query & Access Patterns

### 1. Active Session Query (SessionQueryEngine)

**Purpose**: Query WITHIN active session

**Query Types**:
```typescript
// 1. Structured Query (predefined filters)
const result = await engine.query({
  activity: ['coding', 'debugging'],
  keywords: ['authentication', 'bug'],
  hasBlockers: true,
  timeRange: { minutes: 60 }
});

// 2. Natural Language Query (AI-powered)
const result = await engine.query({
  question: "What bugs did I fix in the last hour?",
  context: 'detailed'
});

// 3. Aggregation Query (statistics)
const result = await engine.query({
  groupBy: 'activity',
  metrics: ['duration', 'screenshot_count']
});
```

**Scope**: Active session only, <1s latency

### 2. In-Memory Filtering (LiveSessionContextProvider)

**Purpose**: Real-time filtering of active session data

```typescript
// Get recent activity
const recent = await provider.getRecentActivity(10); // Last 10 screenshots/audio

// Get activity since timestamp
const newData = await provider.getActivitySince(lastUpdate);

// Get progress indicators
const progress = await provider.getProgressIndicators();
// → { achievements: [], blockers: [], insights: [] }

// Get stats
const stats = await provider.getStats();
// → { duration, screenshotCount, audioSegmentCount, ... }
```

**Performance**: <1ms (in-memory filtering)

### 3. AI Context Building (LiveSessionContextBuilder)

**Purpose**: Prepare session context for external AI services

```typescript
// 1. Summary Context (lightweight, ~2-5 KB)
const summaryCtx = await builder.buildSummaryContext(sessionId);
// → Recent 10 screenshots, recent 10 audio, current summary
// Best for: Quick AI calls, real-time updates

// 2. Full Context (comprehensive, ~50-200 KB)
const fullCtx = await builder.buildFullContext(sessionId);
// → All screenshots, all audio, related entities (notes, tasks)
// Best for: Deep analysis, post-session summarization

// 3. Delta Context (incremental, ~1-10 KB)
const deltaCtx = await builder.buildDeltaContext(sessionId, lastUpdate);
// → Only new screenshots/audio since timestamp
// Best for: Incremental updates, event-driven AI
```

### 4. Cross-Entity Search (UnifiedIndexManager)

**Purpose**: Search across sessions, notes, tasks simultaneously

```typescript
const result = await unifiedIndex.search({
  entityTypes: ['sessions', 'notes', 'tasks'],
  query: 'authentication bug',
  relatedTo: {
    entityType: 'company',
    entityId: 'company-acme'
  },
  filters: {
    dateRange: { start, end },
    tags: ['backend', 'security']
  },
  sortBy: 'date',
  sortOrder: 'desc',
  limit: 50
});
```

**Performance**: <100ms for 1000+ entities (was 2-3s with O(n) filtering)

**Indexes** (7 per session):
- Full-text (content search)
- Topic (related topics)
- Date (temporal ordering)
- Tag (tag-based filtering)
- Category (categorization)
- Sub-category (fine-grained categorization)
- Status (active/paused/completed/interrupted)

---

## 🤖 AI Integration Points

### AI Tools System (/src/services/ai-tools/)

**20 files, 6,500+ lines, 7 tools with 21 modes**

#### Data Gathering Tools (Read-only)
```typescript
// 1. getAudioData - Load audio with transcriptions
const audio = await getAudioData({
  mode: 'segment',           // or 'time_range', 'full_session'
  session_id: 'session-123',
  segment_id: 'segment-456',
  format: 'mp3'              // or 'wav'
});

// 2. getVideoData - Extract video frames
const video = await getVideoData({
  mode: 'frames_at_timestamps', // or 'frames_by_interval', 'metadata'
  session_id: 'session-123',
  timestamps: [10, 30, 60]    // seconds
});

// 3. getTranscript - Get full transcript
const transcript = await getTranscript({
  mode: 'full_transcript',    // or 'segments'
  session_id: 'session-123',
  format: 'plain'             // or 'srt', 'vtt', 'json'
});

// 4. getSessionTimeline - Build event timeline
const timeline = await getSessionTimeline({
  session_id: 'session-123',
  include_achievements: true,
  include_blockers: true
});
```

#### Transcript Correction Tools
```typescript
// 5. updateTranscript - Fix transcript errors
await updateTranscript({
  mode: 'single_segment',     // 5 modes total
  session_id: 'session-123',
  segment_id: 'segment-456',
  corrected_transcription: 'Corrected text',
  correction_reason: 'Whisper misheard "authentication" as "authentication"',
  confidence: 0.95
});

// Modes:
// - single_segment: Fix one transcript
// - batch_segments: Update multiple segments
// - re_transcribe_segment: Re-run Whisper on segment
// - re_transcribe_range: Re-run Whisper on time range
// - upgrade_all: Full session upgrade
```

#### Enrichment Tools
```typescript
// 6. updateAnalysis - Update AI analysis
await updateAnalysis({
  mode: 'screenshot',         // 4 modes total
  session_id: 'session-123',
  screenshot_id: 'screenshot-789',
  analysis: {
    activity: 'Writing code',
    detectedTools: ['VSCode', 'Terminal'],
    keyInsights: ['Implementing auth feature']
  }
});

// Modes:
// - screenshot: Update screenshot AI analysis
// - audio_segment: Update audio segment metadata
// - session_summary: Update/regenerate summary
// - audio_insights: Update comprehensive audio insights
```

#### Suggestion Tools
```typescript
// 7. suggestEntity - Create entity suggestions
await suggestEntity({
  mode: 'task',               // 3 modes: task, note, batch
  suggestion: {
    title: 'Fix authentication bug',
    description: 'Users unable to login with OAuth',
    priority: 'high',
    confidence: 0.85,
    reasoning: 'Detected error in console logs',
    source_context: {
      type: 'screenshot',
      session_id: 'session-123',
      screenshot_id: 'screenshot-789'
    }
  }
});
```

**Permission Model**:
- **Enrichment Context**: ✅ No permission (user confirmed enrichment)
- **Live Session Context**: ✅ No permission (auto-analysis enabled)
- **Chat Context (Ned)**: ⚠️ Requires permission (user grants access)

### liveSession Tools (Event-Driven AI)

**Purpose**: Enable external AI agents to interact with active sessions

**Architecture**:
```
/src/services/liveSession/
├── toolSchemas.ts        # Tool definitions (Anthropic format)
├── toolExecutor.ts       # Safe tool execution
├── contextApi.ts         # Read session data
├── updateApi.ts          # Modify session data
├── events.ts             # Real-time event bus
└── EXAMPLE_AI_AGENT.ts   # Integration example
```

**Event-Driven Pattern**:
```typescript
import { eventBus } from '@/services/liveSession/events';

// Listen for new screenshots
eventBus.on('screenshot-captured', async (screenshot) => {
  const context = await contextBuilder.buildDeltaContext(sessionId, lastUpdate);
  const analysis = await aiAgent.analyzeBlockers(context);

  if (analysis.hasBlocker) {
    await updateApi.addBlocker(sessionId, analysis.blocker);
    eventBus.emit('blocker-detected', { sessionId, blocker: analysis.blocker });
  }
});
```

**Available Events**:
- `screenshot-captured` - New screenshot available
- `audio-segment-completed` - New audio segment transcribed
- `blocker-detected` - AI detected blocker
- `achievement-detected` - AI detected achievement
- `context-updated` - Session context changed

---

## 📂 Code Organization Assessment

### ✅ Well-Organized Areas

**1. Storage Layer** - Excellent separation
```
/src/services/storage/
├── ChunkedSessionStorage.ts      # Session chunking
├── ContentAddressableStorage.ts  # Attachment deduplication
├── LRUCache.ts                    # In-memory caching
├── PersistenceQueue.ts            # Background saves
├── InvertedIndexManager.ts        # Search indexes
├── UnifiedIndexManager.ts         # Cross-entity search
└── StorageAdapter.ts              # Abstraction layer
```

**2. AI Tools** - Clear categorization
```
/src/services/ai-tools/
├── data-gathering/        # Read-only tools
├── transcript-correction/ # Transcript updates
├── enrichment/            # Analysis updates
├── suggestions/           # Entity suggestions
├── utils/                 # Shared utilities
└── types.ts               # Type definitions
```

**3. Recording Services** - Platform separation
```
/src-tauri/src/
├── audio/                 # Modular audio system
│   ├── graph/
│   ├── sources/
│   ├── processors/
│   └── sinks/
├── recording/             # Video recording FFI
└── ScreenRecorder/        # Swift recording module
```

### ⚠️ Areas for Improvement

**1. Session Services** - Too fragmented
```
CURRENT (Scattered):
/src/services/
├── sessionEnrichmentService.ts
├── sessionsAgentService.ts
├── SessionQueryEngine.ts
├── sessionsQueryAgent.ts
├── LiveSessionContextProvider.ts
└── liveSession/
    ├── contextApi.ts
    ├── contextBuilder.ts
    ├── updateApi.ts
    └── ...

RECOMMENDED (Organized):
/src/services/sessions/
├── enrichment/
│   ├── orchestrator.ts         # sessionEnrichmentService
│   ├── real-time-analysis.ts   # sessionsAgentService
│   └── optimization/           # Phase 5 services
├── query/
│   ├── active-session.ts       # SessionQueryEngine
│   ├── historical.ts           # sessionsQueryAgent
│   └── context-provider.ts     # LiveSessionContextProvider
├── live/
│   ├── context-api.ts
│   ├── context-builder.ts
│   ├── update-api.ts
│   └── events.ts
└── index.ts                     # Unified exports
```

**2. Context Providers** - Naming confusion
```
CURRENT (Confusing):
├── ActiveSessionContext.tsx       # React Context
├── SessionListContext.tsx         # React Context
├── LiveSessionContextProvider.ts  # Service (not React Context!)
└── liveSession/contextBuilder.ts  # Different from provider

RECOMMENDED (Clear naming):
├── ActiveSessionContext.tsx       # Keep as-is
├── SessionListContext.tsx         # Keep as-is
├── LiveSessionDataService.ts      # Rename (NOT a React Context!)
└── liveSession/AIContextBuilder.ts # Clarify purpose
```

**3. Component Organization** - Flat structure
```
CURRENT (Flat):
/src/components/sessions/
├── SessionCard.tsx
├── SessionDetailView.tsx
├── SessionsListPanel.tsx
├── SessionsFilterMenu.tsx
├── SessionsSortMenu.tsx
├── ... (50+ files)

RECOMMENDED (Grouped):
/src/components/sessions/
├── cards/
│   ├── SessionCard.tsx
│   └── SessionPreview.tsx
├── detail/
│   ├── SessionDetailView.tsx
│   ├── SessionTimeline.tsx
│   └── SessionNotes.tsx
├── list/
│   ├── SessionsListPanel.tsx
│   ├── UnifiedVirtualSessionList.tsx
│   └── SessionListGroup.tsx
├── controls/
│   ├── SessionsFilterMenu.tsx
│   ├── SessionsSortMenu.tsx
│   └── BulkOperationsBar.tsx
├── recording/
│   ├── StartSessionModal.tsx
│   ├── RecordingStats.tsx
│   ├── DeviceSelector.tsx
│   └── MultiSourceRecordingConfig.tsx
└── processing/
    └── SessionProcessingScreen.tsx
```

---

## 🔴 Identified Gaps & Missing Pieces

### GAP 1: No Real-time Screenshot Analysis
**Current State**: Screenshots captured but not analyzed until post-session enrichment

**Missing**: sessionsAgentService integration during active sessions

**Impact**: Users don't see AI insights in real-time

**Recommendation**:
```typescript
// Add to sessionMachine.ts startRecordingServices()
if (config.autoAnalysis) {
  // Analyze screenshot immediately after capture
  eventBus.on('screenshot-captured', async (screenshot) => {
    const analysis = await sessionsAgentService.analyzeScreenshot(
      screenshot,
      session
    );

    // Update session in real-time
    await chunkedStorage.appendScreenshot(sessionId, {
      ...screenshot,
      aiAnalysis: analysis
    });

    // Trigger UI update
    eventBus.emit('screenshot-analyzed', { sessionId, screenshot });
  });
}
```

**Effort**: Medium (1-2 days)
**Priority**: High (improves user experience significantly)

### GAP 2: No Cross-Session Search
**Current State**: SessionQueryEngine only queries WITHIN active session

**Missing**: Historical session search across all sessions

**Workaround**: Use UnifiedIndexManager but not session-specific

**Recommendation**:
```typescript
// Create SessionHistorySearchService
export class SessionHistorySearchService {
  async search(query: {
    text?: string;
    dateRange?: { start: Date; end: Date };
    activities?: string[];
    hasAchievements?: boolean;
    hasBlockers?: boolean;
    tags?: string[];
    categories?: string[];
  }): Promise<SessionSearchResult[]> {
    // Use UnifiedIndexManager under the hood
    const result = await unifiedIndex.search({
      entityTypes: ['sessions'],
      query: query.text,
      filters: {
        dateRange: query.dateRange,
        tags: query.tags,
        category: query.categories?.[0]
      }
    });

    // Additional filtering for session-specific fields
    return result.sessions.filter(session => {
      // Filter by activities, achievements, blockers
    });
  }
}
```

**Effort**: Small (1 day)
**Priority**: Medium (nice-to-have, not critical)

### GAP 3: No Streaming Enrichment Progress
**Current State**: Enrichment progress updates are callback-based

**Missing**: Server-Sent Events or WebSocket for real-time streaming

**Impact**: UI polls for updates instead of receiving pushes

**Recommendation**:
```typescript
// Add SSE support to sessionEnrichmentService
export class SessionEnrichmentService {
  async enrichSessionStream(
    sessionId: string,
    options: EnrichmentOptions
  ): AsyncIterator<EnrichmentProgressEvent> {
    // Yield progress events as they happen
    yield { stage: 'validation', progress: 0.1 };
    yield { stage: 'audio', progress: 0.5, message: 'Analyzing audio...' };
    yield { stage: 'video', progress: 0.75, message: 'Chaptering video...' };
    yield { stage: 'complete', progress: 1.0, result };
  }
}

// UI consumption
for await (const event of enrichmentService.enrichSessionStream(sessionId, options)) {
  updateProgressUI(event);
}
```

**Effort**: Medium (2-3 days)
**Priority**: Low (current callback approach works)

### GAP 4: No Audio/Video Synchronization Validation
**Current State**: Audio and video recorded separately

**Missing**: Post-recording sync validation

**Risk**: Audio/video drift over long sessions (hours)

**Recommendation**:
```typescript
// Add sync validation after recording stops
export async function validateAVSync(session: Session): Promise<{
  isSynced: boolean;
  maxDrift: number; // milliseconds
  recommendations: string[];
}> {
  const audioTimestamps = session.audioSegments.map(s => new Date(s.timestamp).getTime());
  const videoChunks = session.videoChunks.map(c => new Date(c.timestamp).getTime());

  // Compare timestamps, detect drift
  const drifts = audioTimestamps.map((audioTs, i) => {
    const videoTs = videoChunks[i];
    return Math.abs(audioTs - videoTs);
  });

  const maxDrift = Math.max(...drifts);

  return {
    isSynced: maxDrift < 100, // <100ms is acceptable
    maxDrift,
    recommendations: maxDrift > 100
      ? ['Consider re-recording with higher frame rate', 'Check system load']
      : []
  };
}
```

**Effort**: Small (1 day)
**Priority**: Low (rarely occurs in practice)

### GAP 5: No Enrichment Cost Budgeting
**Current State**: maxCost threshold per-session

**Missing**: User-configurable daily/monthly spending limits

**Impact**: Users can accidentally overspend on enrichment

**Recommendation**:
```typescript
// Add budget tracking to sessionEnrichmentService
export class EnrichmentBudgetManager {
  async checkBudget(estimatedCost: number): Promise<{
    allowed: boolean;
    reason?: string;
    dailySpent: number;
    dailyLimit: number;
    monthlySpent: number;
    monthlyLimit: number;
  }> {
    const dailySpent = await this.getDailySpending();
    const monthlySpent = await this.getMonthlySpending();

    const settings = await getSettings();
    const dailyLimit = settings.enrichment.dailyBudget || Infinity;
    const monthlyLimit = settings.enrichment.monthlyBudget || Infinity;

    if (dailySpent + estimatedCost > dailyLimit) {
      return { allowed: false, reason: 'Daily budget exceeded', ... };
    }

    if (monthlySpent + estimatedCost > monthlyLimit) {
      return { allowed: false, reason: 'Monthly budget exceeded', ... };
    }

    return { allowed: true, ... };
  }
}
```

**Effort**: Medium (2 days)
**Priority**: High (important for user trust)

### GAP 6: No Session Relationship Graph Traversal
**Current State**: Sessions linked to notes/tasks via extractedTaskIds/extractedNoteIds

**Missing**: Bidirectional graph traversal (e.g., "show all sessions related to this task")

**Impact**: Can't easily find sessions where a task was worked on

**Recommendation**:
```typescript
// Already exists: RelationshipIndex (src/types/relationships.ts)
// But not fully integrated with sessions

// Add to SessionListContext:
async function getSessionsRelatedToTask(taskId: string): Promise<Session[]> {
  const relationships = await relationshipIndex.getRelationships({
    entityType: 'task',
    entityId: taskId,
    relatedType: 'session'
  });

  const sessionIds = relationships.map(r => r.targetId);
  return await Promise.all(sessionIds.map(id => chunkedStorage.loadFullSession(id)));
}

// Add to UnifiedIndexManager:
const result = await unifiedIndex.search({
  entityTypes: ['sessions'],
  relatedTo: {
    entityType: 'task',
    entityId: 'task-123'
  }
});
```

**Effort**: Small (1 day, mostly wiring)
**Priority**: Medium (nice UX improvement)

---

## 📈 Performance Metrics

### Capture Layer
| Metric | Value |
|--------|-------|
| Screenshot capture | <100ms |
| Audio segment | 30-60s recording + <500ms processing |
| Video recording | 30-60 FPS, H.264 encoding |
| Adaptive interval | 2-30s (curiosity-driven) |

### Storage Layer
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Metadata load | 2-3s | <10ms | **300x faster** ⚡ |
| Full session load | 2-3s | <500ms | **6x faster** |
| Cache hit | N/A | <1ms | **Instant** |
| Storage size | Baseline | -50-70% | **2-3x reduction** 💾 |

### Processing Layer
| Metric | Value | Model |
|--------|-------|-------|
| Real-time screenshot analysis | 1.5-2.5s | Claude Haiku 4.5 |
| Audio enrichment | ~$0.026/min | GPT-4o audio |
| Video chaptering | ~$0.001/frame | Claude vision |
| Summary generation | ~$0.003 | Claude Sonnet 4.5 |
| **Total enrichment cost reduction** | **-78%** | Phase 5 optimizations 💰 |

### Query Layer
| Metric | Value |
|--------|-------|
| Active session query | <1s |
| In-memory filtering | <1ms ⚡ |
| Cross-entity search | <100ms (was 2-3s) |
| Context building (summary) | <100ms |
| Context building (full) | <500ms |

### AI Integration
| Metric | Value |
|--------|-------|
| Tool execution | <2s (avg) |
| Cache hit rate | 60-70% |
| Incremental enrichment savings | 70-90% |
| Parallel queue throughput | 5x (1 → 5 sessions/min) |

---

## 🎯 Recommendations Summary

### High Priority (Do First)

**1. Add Real-time Screenshot Analysis**
- **Why**: Significantly improves user experience
- **Effort**: Medium (1-2 days)
- **Impact**: Users see AI insights during session

**2. Implement Enrichment Cost Budgeting**
- **Why**: User trust and safety
- **Effort**: Medium (2 days)
- **Impact**: Prevents accidental overspending

**3. Document AI Integration Examples**
- **Why**: Make it easy for AI engineers to integrate
- **Effort**: Small (1 day)
- **Impact**: Faster AI agent development

### Medium Priority (Do Soon)

**4. Reorganize Session Services**
- **Why**: Easier to find and maintain
- **Effort**: Small (1 day, mostly moving files)
- **Impact**: Better code organization

**5. Add Cross-Session Search Service**
- **Why**: Nice UX improvement
- **Effort**: Small (1 day)
- **Impact**: Users can search historical sessions

**6. Integrate Relationship Graph**
- **Why**: Better session-task-note connections
- **Effort**: Small (1 day, mostly wiring)
- **Impact**: Improved relationship navigation

### Low Priority (Nice-to-have)

**7. Add Streaming Enrichment Progress**
- **Why**: More responsive UI
- **Effort**: Medium (2-3 days)
- **Impact**: Nicer UX, but callbacks work

**8. Add A/V Sync Validation**
- **Why**: Quality assurance
- **Effort**: Small (1 day)
- **Impact**: Rarely needed, low risk

### Code Organization Changes

**Immediate (No breaking changes)**:
1. Create `/src/services/sessions/` directory
2. Move session services into organized subdirectories
3. Create unified exports in `sessions/index.ts`
4. Update imports (automated via IDE)

**Future (Breaking changes)**:
1. Rename `LiveSessionContextProvider` → `LiveSessionDataService`
2. Group components in `/src/components/sessions/` by category
3. Consolidate duplicate utilities

---

## ✅ What's Working Well

### Capture
- ✅ **State machine lifecycle** - Rock solid XState v5 implementation
- ✅ **Multi-source recording** - Display + Window + Webcam simultaneously
- ✅ **Adaptive intervals** - Curiosity-driven screenshot capture
- ✅ **Pause/resume** - Zero-overhead pause (drops frames)
- ✅ **Hot-swap** - Switch sources during active recording

### Storage
- ✅ **Chunked storage** - 300x faster metadata loading
- ✅ **Content-addressable** - 50-70% storage reduction
- ✅ **LRU caching** - >90% hit rate, <1ms on hit
- ✅ **Persistence queue** - Zero UI blocking

### Processing
- ✅ **Parallel enrichment** - Audio + Video simultaneously
- ✅ **Error isolation** - One failure doesn't block others
- ✅ **Cost optimization** - 78% cost reduction (Phase 5)
- ✅ **Incremental enrichment** - Only process new data
- ✅ **Result caching** - 60-70% hit rate

### Query
- ✅ **Multiple access patterns** - Active, historical, cross-entity
- ✅ **Fast search** - <100ms via inverted indexes
- ✅ **Context building** - Summary, full, delta variants
- ✅ **Real-time filtering** - <1ms in-memory

### AI Integration
- ✅ **Comprehensive tools** - 7 tools, 21 modes
- ✅ **Type-safe** - 100% TypeScript, zero `any` in interfaces
- ✅ **Permission-aware** - No permission in enrichment/live
- ✅ **Event-driven** - Real-time event bus for external agents
- ✅ **Well-documented** - README, types, JSDoc comments

---

## 🏁 Conclusion

**Current State**: Production-ready, Phase 5 optimizations complete

**Strengths**:
- Robust 5-layer architecture
- Excellent performance (300x faster metadata, 78% cost reduction)
- Comprehensive AI integration (7 tools, 21 modes)
- Well-organized code (storage, ai-tools)

**Gaps** (6 identified):
- No real-time screenshot analysis (HIGH priority)
- No cost budgeting (HIGH priority)
- No cross-session search (MEDIUM priority)
- No relationship graph traversal (MEDIUM priority)
- No streaming enrichment (LOW priority)
- No A/V sync validation (LOW priority)

**Recommendations**:
1. **Immediate**: Add real-time analysis + cost budgeting (3-4 days)
2. **Soon**: Reorganize services + add cross-session search (2-3 days)
3. **Future**: Streaming enrichment + A/V validation (3-4 days)

**Overall Assessment**: **Ready for AI integration** with minor enhancements recommended for production deployment.
