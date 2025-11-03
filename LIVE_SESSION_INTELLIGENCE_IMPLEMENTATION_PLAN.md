# Live Session Intelligence - Implementation Plan

**Date:** 2025-11-02
**Target:** One comprehensive upgrade, no backward compatibility
**Timeline:** Focused execution with quality as priority

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [New Type Definitions](#new-type-definitions)
4. [Implementation Phases](#implementation-phases)
5. [Detailed Task Breakdown](#detailed-task-breakdown)
6. [Testing Strategy](#testing-strategy)
7. [Success Criteria](#success-criteria)
8. [Rollout Plan](#rollout-plan)

---

## Executive Summary

### What We're Building

Transform live session intelligence from a **fixed-interval polling system** to an **event-driven, AI-collaborative system** with:

1. **Event-Driven Updates** - Summary updates triggered by meaningful context changes, not arbitrary 1-minute intervals
2. **Queryable Context System** - AI queries session data using tools, rather than receiving massive context dumps
3. **Interactive AI Q&A** - AI proactively asks clarifying questions during sessions (with auto-timeout)
4. **Focus Modes** - User and AI can narrow analysis scope to specific work types
5. **Action-Oriented UI** - Task/note suggestions with one-click creation
6. **Modern Design** - Pill-shaped buttons, entity pills, consistent with post-session styling

### Core Innovation: Interactive AI Agent

**New Feature:** AI can ask questions during sessions:

```
┌────────────────────────────────────────────────┐
│ 🤔 Quick Question                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                │
│ I notice you're working on both authentication│
│ and dashboard features. Which should I focus  │
│ on for this summary?                          │
│                                                │
│ [Auth Flow] [Dashboard] [Both] [Other: ___]   │
│                                                │
│ Auto-continuing in 15s...                     │
└────────────────────────────────────────────────┘
```

**How It Works:**
- AI detects ambiguity (e.g., context switching, multiple projects)
- Generates question with 2-4 suggested answers + free text option
- 15-20s timeout → auto-continues with best guess
- User's answer refines summary focus for current session
- Dismissed suggestions stored with metadata → can resurface if still relevant

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     ActiveSessionView                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Header: Title, Stats, Entity Pills, Action Buttons       │  │
│  │ ┌──────────────────────────────────────────────────────┐ │  │
│  │ │ AI Q&A Bar (when active)                             │ │  │
│  │ └──────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Summary Tab: LiveIntelligencePanel                       │  │
│  │ - Current Focus Card                                     │  │
│  │ - Suggested Tasks (with Accept/Dismiss)                 │  │
│  │ - Suggested Notes (with Accept/Dismiss)                 │  │
│  │ - Active Blockers                                        │  │
│  │ - Focus Recommendations                                  │  │
│  │ - Progress Stats                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               ↑
                               │ subscribes to
                               │
                    ┌──────────┴──────────┐
                    │     EventBus         │
                    │ - screenshot-analyzed│
                    │ - summary-updated    │
                    │ - ai-question-asked  │
                    └──────────┬──────────┘
                               │ emits events
                               ↑
┌──────────────────────────────┴────────────────────────────────┐
│          LiveSessionIntelligenceService                       │
│  - Listens to analysis events                                 │
│  - Calculates significance score                              │
│  - Triggers summary updates (smart, not fixed-interval)       │
│  - Manages interactive Q&A flow                               │
└──────────────────────┬────────────────────────────────────────┘
                       │ calls when triggered
                       ↓
┌──────────────────────────────────────────────────────────────┐
│          SessionsAgentService.generateLiveSummary()          │
│  - Uses LiveSessionContextProvider for queryable context    │
│  - AI queries: searchScreenshots(), getActivitySince(), etc │
│  - Returns: suggestions, blockers, focus recommendations     │
│  - Can ask interactive questions                            │
└──────────────────────┬───────────────────────────────────────┘
                       │ uses
                       ↓
┌──────────────────────────────────────────────────────────────┐
│          LiveSessionContextProvider                          │
│  - searchScreenshots(query)                                  │
│  - searchAudioSegments(query)                                │
│  - getActivitySince(timestamp)                               │
│  - filterByActivity(type)                                    │
│  - getProgressIndicators(since?)                             │
│  - applyFocusFilter(filter) - NEW                           │
└──────────────────────────────────────────────────────────────┘
```

---

## New Type Definitions

### 1. Enhanced SessionSummary

**File:** `src/types.ts`

```typescript
export interface SessionSummary {
  // Existing fields...
  narrative: string;
  liveSnapshot?: {
    currentFocus: string;
    progressToday: string[];
    momentum: 'high' | 'medium' | 'low';
  };
  achievements: string[];
  blockers: string[];
  recommendedTasks: Array<{
    title: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    context: string;
    relatedScreenshotIds: string[];
  }>;
  keyInsights: Array<{
    insight: string;
    timestamp: string;
    screenshotIds: string[];
  }>;
  focusAreas: Array<{
    area: string;
    duration: number;
    percentage: number;
  }>;
  lastUpdated: string;
  screenshotCount: number;

  // ✅ NEW FIELDS FOR INTELLIGENCE UPGRADE

  /** Suggested notes with context */
  suggestedNotes?: Array<{
    id: string; // For dismissal tracking
    title: string;
    summary: string;
    reason: string; // Why this should be saved
    confidence: number; // 0-1
    relatedScreenshotIds: string[];
    relatedAudioSegmentIds?: string[];
    wasDismissed?: boolean; // Metadata for tracking
    dismissedAt?: string;
  }>;

  /** Focus recommendations */
  focusRecommendation?: {
    message: string;
    severity: 'info' | 'warning';
    suggestedFocus?: string; // What AI thinks user should focus on
    reason: string;
  };

  /** AI-asked questions for interactive refinement */
  interactivePrompt?: {
    id: string;
    question: string;
    suggestedAnswers: string[]; // 2-4 options
    allowFreeText: boolean;
    timeout: number; // seconds (15-20)
    createdAt: string;
    answered?: boolean;
    answer?: string;
    autoAnswered?: boolean; // True if timed out
  };

  /** Dismissed suggestions (for re-surfacing logic) */
  dismissedSuggestions?: {
    tasks: string[]; // Task IDs that were dismissed
    notes: string[]; // Note IDs that were dismissed
  };

  /** Current focus mode */
  focusMode?: {
    type: 'all' | 'custom';
    label: string; // "All Activity" or "Coding Only", etc.
    filter?: SessionFocusFilter;
    setAt: string; // When focus was set
    setBy: 'user' | 'ai'; // Who set the focus
  };

  /** Summary generation metadata */
  generationMetadata?: {
    method: 'event-driven' | 'manual' | 'focus-change';
    triggerReason?: string;
    queriesUsed?: string[]; // Which query tools AI used
    processingTime?: number; // ms
    confidence?: number; // 0-1
  };
}
```

---

### 2. Session Focus Filter

```typescript
export interface SessionFocusFilter {
  /** Activity types to include */
  activities?: string[]; // ['coding', 'debugging']

  /** Activity types to exclude */
  excludeActivities?: string[];

  /** Keywords to search for (OR logic) */
  keywords?: string[];

  /** Minimum curiosity score */
  minCuriosity?: number;

  /** Only include items with achievements */
  hasAchievements?: boolean;

  /** Only include items with blockers */
  hasBlockers?: boolean;

  /** Time range */
  since?: string; // ISO timestamp
  until?: string;
}
```

---

### 3. Event Types

```typescript
// EventBus events (add to existing EventMap)
interface EventMap {
  // Existing...
  'media-processing-progress': MediaProcessingProgressEvent;
  'enrichment-completed': EnrichmentCompletedEvent;

  // ✅ NEW SESSION INTELLIGENCE EVENTS
  'screenshot-analyzed': ScreenshotAnalyzedEvent;
  'audio-segment-processed': AudioSegmentProcessedEvent;
  'session-context-changed': SessionContextChangedEvent;
  'summary-update-triggered': SummaryUpdateTriggeredEvent;
  'summary-updated': SummaryUpdatedEvent;
  'ai-question-asked': AIQuestionAskedEvent;
  'ai-question-answered': AIQuestionAnsweredEvent;
  'focus-mode-changed': FocusModeChangedEvent;
  'suggestion-accepted': SuggestionAcceptedEvent;
  'suggestion-dismissed': SuggestionDismissedEvent;
}

export interface ScreenshotAnalyzedEvent {
  sessionId: string;
  screenshotId: string;
  analysis: SessionScreenshot['aiAnalysis'];
  significance: 'low' | 'medium' | 'high';
  hasNewEntities: boolean;
  hasProgressIndicators: boolean;
}

export interface AudioSegmentProcessedEvent {
  sessionId: string;
  segmentId: string;
  significance: 'low' | 'medium' | 'high';
  containsTask: boolean;
  containsBlocker: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface SessionContextChangedEvent {
  sessionId: string;
  changeType: 'screenshot' | 'audio' | 'entity-created' | 'context-item' | 'focus-changed';
  significance: 'low' | 'medium' | 'high';
  timestamp: string;
}

export interface SummaryUpdateTriggeredEvent {
  sessionId: string;
  reason: 'context-threshold' | 'manual' | 'focus-change' | 'ai-question-answered';
  pendingChanges: number;
  significanceScore: number;
}

export interface SummaryUpdatedEvent {
  sessionId: string;
  summary: SessionSummary;
  processingTime: number;
  queriesUsed: string[];
}

export interface AIQuestionAskedEvent {
  sessionId: string;
  promptId: string;
  question: string;
  suggestedAnswers: string[];
  timeout: number;
}

export interface AIQuestionAnsweredEvent {
  sessionId: string;
  promptId: string;
  answer: string;
  autoAnswered: boolean; // True if timed out
  answeredAt: string;
}

export interface FocusModeChangedEvent {
  sessionId: string;
  previousFocus: string;
  newFocus: string;
  setBy: 'user' | 'ai';
  filter?: SessionFocusFilter;
}

export interface SuggestionAcceptedEvent {
  sessionId: string;
  suggestionId: string;
  type: 'task' | 'note';
  createdItemId: string; // ID of created task/note
}

export interface SuggestionDismissedEvent {
  sessionId: string;
  suggestionId: string;
  type: 'task' | 'note';
  dismissedAt: string;
}
```

---

## Implementation Phases

### Phase 1: Foundation & Event System
**Goal:** Replace polling with event-driven updates
**Duration:** Week 1
**Output:** Smart summary triggers, no more 1-minute polling

### Phase 2: Queryable Context System
**Goal:** AI queries data efficiently
**Duration:** Week 2
**Output:** Token-efficient summaries, scalable to long sessions

### Phase 3: Interactive AI Q&A
**Goal:** AI asks clarifying questions
**Duration:** Week 3
**Output:** AI can request user input during sessions

### Phase 4: Focus Modes & Suggestions
**Goal:** User/AI focus narrowing, task/note suggestions
**Duration:** Week 4
**Output:** Action-oriented intelligence panel

### Phase 5: UI Modernization
**Goal:** Consistent design, modern controls
**Duration:** Week 5
**Output:** Polished, production-ready UI

### Phase 6: Integration & Testing
**Goal:** End-to-end testing, polish
**Duration:** Week 6
**Output:** Production-ready system

---

## Detailed Task Breakdown

### Phase 1: Foundation & Event System (Week 1)

#### Task 1.1: Extend EventBus with Session Events (4 hours)

**Files:**
- `src/utils/eventBus.ts`

**Steps:**
1. Add new event types to `EventMap` interface
2. Create event payload interfaces (ScreenshotAnalyzedEvent, etc.)
3. Add JSDoc documentation for each event
4. Export event types from index

**Output:**
```typescript
// eventBus.ts
interface EventMap {
  // ... existing
  'screenshot-analyzed': ScreenshotAnalyzedEvent;
  'audio-segment-processed': AudioSegmentProcessedEvent;
  'session-context-changed': SessionContextChangedEvent;
  'summary-update-triggered': SummaryUpdateTriggeredEvent;
  'summary-updated': SummaryUpdatedEvent;
  // ... 6 more
}
```

**Testing:**
- Unit test: Event subscription/emission
- Integration test: Multiple listeners receive events

---

#### Task 1.2: Create LiveSessionIntelligenceService (8 hours)

**Files:**
- `src/services/LiveSessionIntelligenceService.ts` (NEW)
- `src/services/LiveSessionIntelligenceService.test.ts` (NEW)

**Responsibilities:**
1. Listen to `screenshot-analyzed`, `audio-segment-processed` events
2. Calculate significance scores
3. Track pending changes per session
4. Implement smart trigger logic:
   - Trigger if: significance score >= 3 AND time >= 30s
   - OR: time >= 5 minutes (max wait)
5. Emit `summary-update-triggered` event
6. Call `sessionsAgentService.generateLiveSummary()`

**Key Logic:**
```typescript
export class LiveSessionIntelligenceService {
  private pendingChanges: Map<string, ContextChange[]> = new Map();
  private lastSummaryTime: Map<string, number> = new Map();

  // Thresholds
  private readonly MIN_SIGNIFICANCE_SCORE = 3;
  private readonly MIN_TIME_BETWEEN_UPDATES = 30 * 1000; // 30s
  private readonly MAX_TIME_WITHOUT_UPDATE = 5 * 60 * 1000; // 5min

  constructor() {
    eventBus.on('screenshot-analyzed', (e) => this.handleScreenshotAnalyzed(e));
    eventBus.on('audio-segment-processed', (e) => this.handleAudioProcessed(e));
  }

  private calculateSignificance(analysis: SessionScreenshot['aiAnalysis']): 'low' | 'medium' | 'high' {
    // High: blockers, high curiosity (>= 0.7), context changes
    // Medium: achievements, entities
    // Low: routine work
  }

  private async checkAndTriggerUpdate(sessionId: string) {
    const changes = this.pendingChanges.get(sessionId) || [];
    const score = this.calculateScore(changes);
    const timeSinceLastUpdate = Date.now() - (this.lastSummaryTime.get(sessionId) || 0);

    const shouldUpdate = (score >= this.MIN_SIGNIFICANCE_SCORE && timeSinceLastUpdate >= this.MIN_TIME_BETWEEN_UPDATES)
                      || timeSinceLastUpdate >= this.MAX_TIME_WITHOUT_UPDATE;

    if (shouldUpdate) {
      await this.triggerSummaryGeneration(sessionId);
    }
  }
}
```

**Testing:**
- Unit: Significance calculation
- Unit: Trigger logic with various scenarios
- Integration: Events flow through service correctly

---

#### Task 1.3: Emit Events from SessionsZone (4 hours)

**Files:**
- `src/components/SessionsZone.tsx`

**Changes:**
1. After `updateScreenshotAnalysis()` (line 763), emit `screenshot-analyzed`
2. After `addAudioSegment()` (line 858), emit `audio-segment-processed`
3. Calculate significance before emitting

**Code:**
```typescript
// After screenshot analysis complete (line 763)
updateScreenshotAnalysis(screenshot.id, analysis, 'complete');

// ✅ NEW: Emit event
const significance = calculateScreenshotSignificance(analysis);
eventBus.emit('screenshot-analyzed', {
  sessionId: currentSession.id,
  screenshotId: screenshot.id,
  analysis,
  significance,
  hasNewEntities: !!(analysis.detectedEntities && (
    (analysis.detectedEntities.topics?.length || 0) +
    (analysis.detectedEntities.companies?.length || 0) +
    (analysis.detectedEntities.contacts?.length || 0) > 0
  )),
  hasProgressIndicators: !!(analysis.progressIndicators && (
    (analysis.progressIndicators.achievements?.length || 0) +
    (analysis.progressIndicators.blockers?.length || 0) +
    (analysis.progressIndicators.insights?.length || 0) > 0
  ))
});
```

**Testing:**
- Manual: Start session, verify events in console
- Integration: Event listener receives correct data

---

#### Task 1.4: Remove Fixed Polling Logic (2 hours)

**Files:**
- `src/components/SessionsZone.tsx` (lines 1357-1471)

**Steps:**
1. **Delete** the synthesis useEffect (lines 1357-1471)
2. Remove `lastSynthesisUpdate` state
3. Remove `synthesisError` state
4. Clean up any references

**Verification:**
- Search codebase for `SYNTHESIS_INTERVAL` → should be 0 results
- Search for `generateSynthesis` → should be 0 results
- Verify summary still generates via event-driven system

---

### Phase 2: Queryable Context System (Week 2)

#### Task 2.1: Create LiveSessionContextProvider (12 hours)

**Files:**
- `src/services/LiveSessionContextProvider.ts` (NEW)
- `src/services/LiveSessionContextProvider.test.ts` (NEW)

**Query Methods:**

```typescript
export class LiveSessionContextProvider {
  private session: Session;
  private focusFilter?: SessionFocusFilter;

  constructor(session: Session, focusFilter?: SessionFocusFilter) {
    this.session = session;
    this.focusFilter = focusFilter;
  }

  /**
   * Search screenshots with filters
   */
  searchScreenshots(query: ScreenshotQuery): SessionScreenshot[] {
    let results = (this.session.screenshots || []).filter(s => s.aiAnalysis);

    // Apply focus filter first
    if (this.focusFilter) {
      results = this.applyFocusFilter(results);
    }

    // Activity filter
    if (query.activity) {
      results = results.filter(s =>
        s.aiAnalysis?.detectedActivity?.toLowerCase().includes(query.activity!.toLowerCase())
      );
    }

    // Text search
    if (query.text) {
      const term = query.text.toLowerCase();
      results = results.filter(s =>
        s.aiAnalysis?.extractedText?.toLowerCase().includes(term) ||
        s.aiAnalysis?.summary?.toLowerCase().includes(term)
      );
    }

    // Element search
    if (query.elements && query.elements.length > 0) {
      results = results.filter(s =>
        query.elements!.some(elem =>
          s.aiAnalysis?.keyElements?.some(ke =>
            ke.toLowerCase().includes(elem.toLowerCase())
          )
        )
      );
    }

    // Achievements filter
    if (query.hasAchievements) {
      results = results.filter(s =>
        (s.aiAnalysis?.progressIndicators?.achievements?.length || 0) > 0
      );
    }

    // Blockers filter
    if (query.hasBlockers) {
      results = results.filter(s =>
        (s.aiAnalysis?.progressIndicators?.blockers?.length || 0) > 0
      );
    }

    // Curiosity filter
    if (query.minCuriosity !== undefined) {
      results = results.filter(s =>
        (s.aiAnalysis?.curiosity || 0) >= query.minCuriosity!
      );
    }

    // Time range
    if (query.since) {
      const sinceTime = new Date(query.since).getTime();
      results = results.filter(s =>
        new Date(s.timestamp).getTime() >= sinceTime
      );
    }
    if (query.until) {
      const untilTime = new Date(query.until).getTime();
      results = results.filter(s =>
        new Date(s.timestamp).getTime() <= untilTime
      );
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Search audio segments
   */
  searchAudioSegments(query: AudioQuery): SessionAudioSegment[] {
    // Similar implementation for audio
  }

  /**
   * Get activity since timestamp (what's NEW)
   */
  getActivitySince(timestamp: string): TimelineItem[] {
    const sinceTime = new Date(timestamp).getTime();

    const screenshots = (this.session.screenshots || [])
      .filter(s => s.aiAnalysis && new Date(s.timestamp).getTime() >= sinceTime)
      .map(s => ({ type: 'screenshot' as const, timestamp: s.timestamp, data: s }));

    const audio = (this.session.audioSegments || [])
      .filter(a => new Date(a.timestamp).getTime() >= sinceTime)
      .map(a => ({ type: 'audio' as const, timestamp: a.timestamp, data: a }));

    return [...screenshots, ...audio]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Get aggregated progress indicators
   */
  getProgressIndicators(since?: string): ProgressSummary {
    let screenshots = this.session.screenshots || [];

    if (this.focusFilter) {
      screenshots = this.applyFocusFilter(screenshots);
    }

    if (since) {
      const sinceTime = new Date(since).getTime();
      screenshots = screenshots.filter(s =>
        new Date(s.timestamp).getTime() >= sinceTime
      );
    }

    const achievements = new Set<string>();
    const blockers = new Set<string>();
    const insights = new Set<string>();

    screenshots.forEach(s => {
      s.aiAnalysis?.progressIndicators?.achievements?.forEach(a => achievements.add(a));
      s.aiAnalysis?.progressIndicators?.blockers?.forEach(b => blockers.add(b));
      s.aiAnalysis?.progressIndicators?.insights?.forEach(i => insights.add(i));
    });

    return {
      achievements: Array.from(achievements),
      blockers: Array.from(blockers),
      insights: Array.from(insights),
    };
  }

  /**
   * Apply focus filter to screenshots
   */
  private applyFocusFilter(screenshots: SessionScreenshot[]): SessionScreenshot[] {
    if (!this.focusFilter) return screenshots;

    let filtered = screenshots;

    // Activity inclusion
    if (this.focusFilter.activities && this.focusFilter.activities.length > 0) {
      filtered = filtered.filter(s =>
        this.focusFilter!.activities!.some(activity =>
          s.aiAnalysis?.detectedActivity?.toLowerCase().includes(activity.toLowerCase())
        )
      );
    }

    // Activity exclusion
    if (this.focusFilter.excludeActivities && this.focusFilter.excludeActivities.length > 0) {
      filtered = filtered.filter(s =>
        !this.focusFilter!.excludeActivities!.some(activity =>
          s.aiAnalysis?.detectedActivity?.toLowerCase().includes(activity.toLowerCase())
        )
      );
    }

    // Keyword search
    if (this.focusFilter.keywords && this.focusFilter.keywords.length > 0) {
      filtered = filtered.filter(s =>
        this.focusFilter!.keywords!.some(keyword =>
          s.aiAnalysis?.extractedText?.toLowerCase().includes(keyword.toLowerCase()) ||
          s.aiAnalysis?.summary?.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    // Min curiosity
    if (this.focusFilter.minCuriosity !== undefined) {
      filtered = filtered.filter(s =>
        (s.aiAnalysis?.curiosity || 0) >= this.focusFilter!.minCuriosity!
      );
    }

    // Achievements/Blockers
    if (this.focusFilter.hasAchievements) {
      filtered = filtered.filter(s =>
        (s.aiAnalysis?.progressIndicators?.achievements?.length || 0) > 0
      );
    }
    if (this.focusFilter.hasBlockers) {
      filtered = filtered.filter(s =>
        (s.aiAnalysis?.progressIndicators?.blockers?.length || 0) > 0
      );
    }

    return filtered;
  }
}
```

**Testing:**
- Unit tests for each query method (15+ test cases)
- Test focus filter application
- Performance test: 100+ screenshots query time (<50ms target)

---

#### Task 2.2: Create generateLiveSummary Method (16 hours)

**Files:**
- `src/services/sessionsAgentService.ts`

**Add New Method:**

```typescript
/**
 * Generate live summary using queryable context
 * Called during active sessions (event-driven)
 */
async generateLiveSummary(
  session: Session,
  options: {
    lastSummaryTimestamp?: string;
    focusFilter?: SessionFocusFilter;
    previousSummary?: SessionSummary;
  }
): Promise<SessionSummary> {
  if (!this.hasApiKey) {
    throw new Error('API key not set');
  }

  const startTime = Date.now();

  // Create context provider with focus filter
  const contextProvider = new LiveSessionContextProvider(session, options.focusFilter);

  // Get what's NEW since last summary
  const newActivity = options.lastSummaryTimestamp
    ? contextProvider.getActivitySince(options.lastSummaryTimestamp)
    : contextProvider.getRecentActivity(20);

  // Build AI prompt with query tools
  const prompt = this.buildLiveSummaryPrompt(
    session,
    contextProvider,
    newActivity,
    options
  );

  // Call Claude API
  const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
    request: {
      model: 'claude-sonnet-4-5-20250929',
      maxTokens: 8000,
      messages: [{ role: 'user', content: prompt }],
      system: this.buildSystemPrompt(),
      temperature: undefined,
    }
  });

  // Parse response
  const result = this.parseLiveSummaryResponse(response);

  // Add metadata
  result.lastUpdated = new Date().toISOString();
  result.screenshotCount = session.screenshots?.length || 0;
  result.generationMetadata = {
    method: 'event-driven',
    processingTime: Date.now() - startTime,
    queriesUsed: result.queriesUsed || [],
    confidence: result.confidence || 0.8,
  };

  // Emit summary-updated event
  eventBus.emit('summary-updated', {
    sessionId: session.id,
    summary: result,
    processingTime: Date.now() - startTime,
    queriesUsed: result.queriesUsed || [],
  });

  return result;
}

/**
 * Build prompt for live summary with query tools
 */
private buildLiveSummaryPrompt(
  session: Session,
  contextProvider: LiveSessionContextProvider,
  newActivity: TimelineItem[],
  options: any
): string {
  const previousSummary = options.previousSummary;
  const focusMode = session.summary?.focusMode;

  return `You are analyzing an ACTIVE work session titled "${session.name}".

**Session Context:**
- Duration: ${this.calculateDuration(session)} minutes
- Status: ${session.status}
- Focus Mode: ${focusMode?.label || 'All Activity'}
- Last Summary: ${previousSummary ? new Date(previousSummary.lastUpdated).toLocaleTimeString() : 'None'}

**What's NEW Since Last Summary:**
${newActivity.length} new items (screenshots + audio):
${this.formatTimelineItems(newActivity.slice(0, 5))}
${newActivity.length > 5 ? `\n... and ${newActivity.length - 5} more` : ''}

**Query Tools Available:**
You have access to efficient query tools to find relevant information:

1. \`searchScreenshots(query)\` - Find screenshots matching:
   - activity: string
   - text: string (OCR search)
   - elements: string[] (UI element search)
   - hasAchievements: boolean
   - hasBlockers: boolean
   - minCuriosity: number (0-1)
   - since/until: timestamps
   - limit: number

2. \`searchAudioSegments(query)\` - Find audio matching:
   - text: string (transcription search)
   - phrases: string[]
   - sentiment: 'positive' | 'neutral' | 'negative'
   - containsTask/containsBlocker: boolean
   - since/until: timestamps
   - limit: number

3. \`getActivitySince(timestamp)\` - Get all activity since timestamp

4. \`getProgressIndicators(since?)\` - Get aggregated achievements/blockers/insights

**Your Strategy:**
1. Analyze what's NEW (provided above)
2. Use query tools to fetch additional context as needed
3. Focus analysis on: ${focusMode?.label || 'all work'}
4. Consider previous summary to avoid redundancy
5. Generate actionable suggestions (tasks, notes)

**Interactive Questions:**
You may ask the user ONE clarifying question if:
- You detect context switching (multiple activities)
- User's intent is ambiguous
- Focus could be narrowed for better analysis

Format question as:
{
  "interactivePrompt": {
    "question": "Clear, concise question",
    "suggestedAnswers": ["Option 1", "Option 2", "Option 3"],
    "allowFreeText": true
  }
}

**Output Format (JSON):**
{
  "liveSnapshot": {
    "currentFocus": "What user is doing RIGHT NOW (present tense)",
    "progressToday": ["achievement 1", "achievement 2", "achievement 3"],
    "momentum": "high" | "medium" | "low"
  },
  "achievements": ["achievement 1", "achievement 2"],
  "blockers": ["blocker 1"],
  "suggestedTasks": [
    {
      "id": "task-1",
      "title": "Task title",
      "priority": "high",
      "context": "Why this matters",
      "confidence": 0.85,
      "relatedScreenshotIds": ["screenshot-1"]
    }
  ],
  "suggestedNotes": [
    {
      "id": "note-1",
      "title": "Note title",
      "summary": "Brief summary",
      "reason": "Why save this",
      "confidence": 0.9,
      "relatedScreenshotIds": ["screenshot-2"]
    }
  ],
  "focusRecommendation": {
    "message": "You've switched contexts 5 times. Consider...",
    "severity": "warning",
    "suggestedFocus": "Authentication Flow",
    "reason": "Multiple unfinished tasks detected"
  },
  "interactivePrompt": { ... } // OPTIONAL
}

**Important:**
- Only suggest tasks/notes with confidence >= 0.7
- Consider relevance to current focus mode
- Check if suggestions were previously dismissed (resurrect if still relevant)
- Prioritize actionable insights over generic observations

Return ONLY valid JSON.`;
}
```

**Testing:**
- Unit: Prompt generation
- Integration: Full summary generation with real session data
- Performance: Response time <5s target

---

### Phase 3: Interactive AI Q&A (Week 3)

#### Task 3.1: Create AIQuestionManager (10 hours)

**Files:**
- `src/services/AIQuestionManager.ts` (NEW)
- `src/services/AIQuestionManager.test.ts` (NEW)

**Responsibilities:**
1. Manage active questions per session
2. Handle question timeouts (15-20s)
3. Auto-answer on timeout
4. Store answered questions

**Implementation:**

```typescript
export class AIQuestionManager {
  private activeQuestions: Map<string, ActiveQuestion> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Ask question to user
   */
  async askQuestion(
    sessionId: string,
    prompt: SessionSummary['interactivePrompt']
  ): Promise<string> {
    if (!prompt) throw new Error('No prompt provided');

    // Store active question
    const question: ActiveQuestion = {
      sessionId,
      prompt,
      createdAt: new Date().toISOString(),
      answered: false,
    };
    this.activeQuestions.set(prompt.id, question);

    // Emit event
    eventBus.emit('ai-question-asked', {
      sessionId,
      promptId: prompt.id,
      question: prompt.question,
      suggestedAnswers: prompt.suggestedAnswers,
      timeout: prompt.timeout,
    });

    // Set up timeout
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        // Auto-answer with best guess (first suggested answer)
        const autoAnswer = prompt.suggestedAnswers[0];
        this.answerQuestion(prompt.id, autoAnswer, true);
        resolve(autoAnswer);
      }, prompt.timeout * 1000);

      this.timeouts.set(prompt.id, timeoutId);
    });
  }

  /**
   * User answers question
   */
  answerQuestion(
    promptId: string,
    answer: string,
    autoAnswered: boolean = false
  ): void {
    const question = this.activeQuestions.get(promptId);
    if (!question) return;

    // Clear timeout
    const timeoutId = this.timeouts.get(promptId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timeouts.delete(promptId);
    }

    // Update question
    question.answered = true;
    question.answer = answer;
    question.answeredAt = new Date().toISOString();
    question.autoAnswered = autoAnswered;

    // Emit event
    eventBus.emit('ai-question-answered', {
      sessionId: question.sessionId,
      promptId,
      answer,
      autoAnswered,
      answeredAt: question.answeredAt,
    });

    // Remove from active
    this.activeQuestions.delete(promptId);
  }

  /**
   * Get active question for session
   */
  getActiveQuestion(sessionId: string): SessionSummary['interactivePrompt'] | null {
    for (const [_, question] of this.activeQuestions) {
      if (question.sessionId === sessionId && !question.answered) {
        return question.prompt;
      }
    }
    return null;
  }

  /**
   * Clear all questions for session (on session end)
   */
  clearSession(sessionId: string): void {
    for (const [promptId, question] of this.activeQuestions) {
      if (question.sessionId === sessionId) {
        const timeoutId = this.timeouts.get(promptId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.timeouts.delete(promptId);
        }
        this.activeQuestions.delete(promptId);
      }
    }
  }
}

export const aiQuestionManager = new AIQuestionManager();
```

**Testing:**
- Unit: Timeout logic
- Unit: Answer handling
- Integration: Event flow

---

#### Task 3.2: Create AIQuestionBar Component (8 hours)

**Files:**
- `src/components/sessions/AIQuestionBar.tsx` (NEW)

**UI Design:**

```tsx
export function AIQuestionBar({ session }: { session: Session }) {
  const [timeLeft, setTimeLeft] = useState(15);
  const [answer, setAnswer] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const question = session.summary?.interactivePrompt;

  if (!question || question.answered) return null;

  const handleAnswer = (selectedAnswer: string) => {
    aiQuestionManager.answerQuestion(question.id, selectedAnswer, false);
    // Trigger summary update with answer
    eventBus.emit('ai-question-answered', {
      sessionId: session.id,
      promptId: question.id,
      answer: selectedAnswer,
      autoAnswered: false,
      answeredAt: new Date().toISOString(),
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`w-full ${getGlassClasses('medium')} ${getRadiusClass('card')} p-4 shadow-lg border-2 border-cyan-400/50`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
          <span className="text-2xl">🤔</span>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-bold text-gray-900">Quick Question</h4>
            <span className="text-xs text-gray-500">
              Auto-continuing in {timeLeft}s...
            </span>
          </div>

          <p className="text-sm text-gray-700 mb-3">{question.question}</p>

          {/* Suggested Answers */}
          {!showCustomInput && (
            <div className="flex flex-wrap gap-2">
              {question.suggestedAnswers.map(ans => (
                <button
                  key={ans}
                  onClick={() => handleAnswer(ans)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-semibold
                    bg-white hover:bg-cyan-50 border-2 border-cyan-400
                    text-gray-900 transition-all duration-200
                    hover:shadow-md
                  `}
                >
                  {ans}
                </button>
              ))}

              {question.allowFreeText && (
                <button
                  onClick={() => setShowCustomInput(true)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-semibold
                    bg-white hover:bg-gray-100 border-2 border-gray-300
                    text-gray-700 transition-all duration-200
                  `}
                >
                  Other...
                </button>
              )}
            </div>
          )}

          {/* Custom Input */}
          {showCustomInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer..."
                className={`
                  flex-1 px-3 py-2 rounded-lg
                  border-2 border-gray-300 focus:border-cyan-400
                  text-sm
                `}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && answer.trim()) {
                    handleAnswer(answer.trim());
                  }
                }}
              />
              <button
                onClick={() => handleAnswer(answer.trim())}
                disabled={!answer.trim()}
                className={`
                  px-4 py-2 rounded-lg text-sm font-semibold
                  bg-cyan-500 text-white
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                Submit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: question.timeout, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}
```

**Testing:**
- Visual: Question appears and disappears
- Interaction: Answer selection works
- Timeout: Auto-answer after timeout

---

### Phase 4: Focus Modes & Suggestions (Week 4)

#### Task 4.1: Create FocusModeSelector Component (6 hours)

**Files:**
- `src/components/sessions/FocusModeSelector.tsx` (NEW)

**UI:**

```tsx
export function FocusModeSelector({ session }: { session: Session }) {
  const { updateActiveSession } = useActiveSession();
  const [customModalOpen, setCustomModalOpen] = useState(false);

  const currentFocus = session.summary?.focusMode?.label || 'All Activity';

  const presets = [
    { label: 'All Activity', filter: null },
    { label: 'Coding Only', filter: { activities: ['coding'] } },
    { label: 'Debugging Only', filter: { activities: ['debugging'] } },
    { label: 'Meetings Only', filter: { activities: ['meeting'] } },
    { label: 'Documentation Only', filter: { activities: ['documentation'] } },
  ];

  const handleFocusChange = (label: string, filter: SessionFocusFilter | null) => {
    updateActiveSession({
      summary: {
        ...session.summary,
        focusMode: {
          type: filter ? 'custom' : 'all',
          label,
          filter: filter || undefined,
          setAt: new Date().toISOString(),
          setBy: 'user',
        },
      },
    });

    // Emit event to trigger summary regeneration
    eventBus.emit('focus-mode-changed', {
      sessionId: session.id,
      previousFocus: currentFocus,
      newFocus: label,
      setBy: 'user',
      filter: filter || undefined,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 font-medium">Focus:</span>
      <select
        value={currentFocus}
        onChange={(e) => {
          const selected = presets.find(p => p.label === e.target.value);
          if (selected) {
            handleFocusChange(selected.label, selected.filter);
          } else if (e.target.value === 'custom') {
            setCustomModalOpen(true);
          }
        }}
        className={`
          px-3 py-1 rounded-full text-sm font-semibold
          bg-white/80 border-2 border-gray-300
          hover:border-cyan-400 transition-all
          cursor-pointer
        `}
      >
        {presets.map(preset => (
          <option key={preset.label} value={preset.label}>
            {preset.label}
          </option>
        ))}
        <option value="custom">Custom Filter...</option>
      </select>

      {/* AI-Suggested Focuses (if available) */}
      {session.summary?.focusRecommendation?.suggestedFocus && (
        <button
          onClick={() => {
            const suggested = session.summary!.focusRecommendation!.suggestedFocus!;
            handleFocusChange(suggested, { keywords: [suggested] });
          }}
          className={`
            px-3 py-1 rounded-full text-sm font-semibold
            bg-gradient-to-r from-cyan-500 to-blue-500 text-white
            hover:shadow-lg transition-all
            flex items-center gap-1
          `}
        >
          ✨ {session.summary.focusRecommendation.suggestedFocus}
        </button>
      )}
    </div>
  );
}
```

---

#### Task 4.2: Create LiveIntelligencePanel Component (16 hours)

**Files:**
- `src/components/sessions/LiveIntelligencePanel.tsx` (NEW)
- `src/components/sessions/TaskSuggestionCard.tsx` (NEW)
- `src/components/sessions/NoteSuggestionCard.tsx` (NEW)
- `src/components/sessions/CurrentFocusCard.tsx` (NEW)
- `src/components/sessions/BlockersPanel.tsx` (NEW)
- `src/components/sessions/FocusRecommendationBanner.tsx` (NEW)

**Main Panel:**

```tsx
export function LiveIntelligencePanel({ session }: { session: Session }) {
  const { addTask } = useTasks();
  const { addNote } = useNotes();
  const { updateActiveSession } = useActiveSession();

  const summary = session.summary;

  if (!summary?.liveSnapshot) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <div className="text-6xl mb-4">🧠</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Gathering intelligence...
        </h3>
        <p className="text-gray-600">
          AI will analyze your work as the session progresses.
        </p>
      </div>
    );
  }

  const handleAcceptTask = async (suggestion: SessionSummary['suggestedTasks'][0]) => {
    // Create task
    const taskId = await addTask({
      title: suggestion.title,
      description: suggestion.context,
      priority: suggestion.priority,
      status: 'todo',
      sourceSessionId: session.id,
    });

    // Emit event
    eventBus.emit('suggestion-accepted', {
      sessionId: session.id,
      suggestionId: suggestion.id,
      type: 'task',
      createdItemId: taskId,
    });

    // Remove from suggestions
    const updatedSuggestions = (summary.suggestedTasks || [])
      .filter(t => t.id !== suggestion.id);

    updateActiveSession({
      summary: {
        ...summary,
        suggestedTasks: updatedSuggestions,
      },
    });

    toast.success('Task created!');
  };

  const handleDismissTask = (suggestion: SessionSummary['suggestedTasks'][0]) => {
    // Emit event
    eventBus.emit('suggestion-dismissed', {
      sessionId: session.id,
      suggestionId: suggestion.id,
      type: 'task',
      dismissedAt: new Date().toISOString(),
    });

    // Update summary
    const updatedSuggestions = (summary.suggestedTasks || [])
      .filter(t => t.id !== suggestion.id);

    const dismissedList = summary.dismissedSuggestions?.tasks || [];

    updateActiveSession({
      summary: {
        ...summary,
        suggestedTasks: updatedSuggestions,
        dismissedSuggestions: {
          ...summary.dismissedSuggestions,
          tasks: [...dismissedList, suggestion.id],
        },
      },
    });
  };

  // Similar handlers for notes...

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Current Focus */}
      <CurrentFocusCard
        focus={summary.liveSnapshot.currentFocus}
        momentum={summary.liveSnapshot.momentum}
        progressToday={summary.liveSnapshot.progressToday}
        lastUpdated={summary.lastUpdated}
      />

      {/* Focus Recommendation Banner */}
      {summary.focusRecommendation && (
        <FocusRecommendationBanner
          message={summary.focusRecommendation.message}
          severity={summary.focusRecommendation.severity}
          suggestedFocus={summary.focusRecommendation.suggestedFocus}
          reason={summary.focusRecommendation.reason}
        />
      )}

      {/* Suggested Actions Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Suggested Tasks */}
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-5 shadow-xl`}>
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckSquare size={16} className="text-purple-600" />
            Suggested Tasks
            <span className="ml-auto text-xs text-gray-500">
              ({summary.suggestedTasks?.length || 0})
            </span>
          </h3>

          {summary.suggestedTasks && summary.suggestedTasks.length > 0 ? (
            <div className="space-y-3">
              {summary.suggestedTasks.map(task => (
                <TaskSuggestionCard
                  key={task.id}
                  suggestion={task}
                  onAccept={() => handleAcceptTask(task)}
                  onDismiss={() => handleDismissTask(task)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No task suggestions yet</p>
          )}
        </div>

        {/* Suggested Notes */}
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-5 shadow-xl`}>
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            Suggested Notes
            <span className="ml-auto text-xs text-gray-500">
              ({summary.suggestedNotes?.length || 0})
            </span>
          </h3>

          {summary.suggestedNotes && summary.suggestedNotes.length > 0 ? (
            <div className="space-y-3">
              {summary.suggestedNotes.map(note => (
                <NoteSuggestionCard
                  key={note.id}
                  suggestion={note}
                  onAccept={() => handleAcceptNote(note)}
                  onDismiss={() => handleDismissNote(note)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No note suggestions yet</p>
          )}
        </div>
      </div>

      {/* Active Blockers */}
      {summary.blockers && summary.blockers.length > 0 && (
        <BlockersPanel blockers={summary.blockers} />
      )}

      {/* Progress Stats */}
      <div className="grid grid-cols-3 gap-4">
        {/* Achievements */}
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-4`}>
          <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
            Achievements
          </h4>
          <p className="text-3xl font-bold text-gray-900">
            {summary.achievements?.length || 0}
          </p>
        </div>

        {/* Blockers */}
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-4`}>
          <h4 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">
            Blockers
          </h4>
          <p className="text-3xl font-bold text-gray-900">
            {summary.blockers?.length || 0}
          </p>
        </div>

        {/* Momentum */}
        <div className={`${getGlassClasses('medium')} ${getRadiusClass('card')} p-4`}>
          <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
            Momentum
          </h4>
          <p className={`text-2xl font-bold ${
            summary.liveSnapshot.momentum === 'high' ? 'text-green-600' :
            summary.liveSnapshot.momentum === 'medium' ? 'text-yellow-600' :
            'text-gray-600'
          }`}>
            {summary.liveSnapshot.momentum.toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Testing:**
- Visual: All panels render correctly
- Interaction: Accept/dismiss works
- State: Summary updates correctly

---

### Phase 5: UI Modernization (Week 5)

#### Task 5.1: Update ActiveSessionView Header (8 hours)

**Files:**
- `src/components/ActiveSessionView.tsx` (lines 179-326)

**Changes:**

1. **Pill-shaped buttons** (lines 301-323)
2. **Entity pills** (new section after stats)
3. **Integrate FocusModeSelector**
4. **Integrate AIQuestionBar**

**Code:**

```tsx
{/* Header */}
<div className={`relative z-10 flex-shrink-0 ${getGlassClasses('medium')} border-b-2 shadow-xl ${TRANSITIONS.standard}`}>
  {/* AI Question Bar (if active) */}
  <AnimatePresence>
    {session.summary?.interactivePrompt && !session.summary.interactivePrompt.answered && (
      <AIQuestionBar session={session} />
    )}
  </AnimatePresence>

  <div className="max-w-7xl mx-auto flex items-start justify-between gap-8 p-6">
    {/* Left: Title & Stats */}
    <div className="flex-1 min-w-0 space-y-3">
      {/* Title & Status */}
      <div className="flex items-center gap-3">
        <h1 className="font-bold text-2xl text-gray-900 truncate">
          {session.name}
        </h1>
        <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusBadgeClasses(session.status)}`}>
          {isPaused ? 'Paused' : 'Recording'}
        </span>
      </div>

      {/* Description */}
      {session.description && (
        <p className="text-sm text-gray-600">{session.description}</p>
      )}

      {/* Live Stats Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Timer */}
        <div className={`px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 ${getGlassClasses('subtle')} rounded-full flex items-center gap-2`}>
          <Clock size={18} className="text-blue-600" />
          <span className="text-lg font-bold text-gray-900 font-mono">
            {formatElapsed(liveElapsed)}
          </span>
        </div>

        {/* Screenshot count */}
        <div className={`px-4 py-2 ${getGlassClasses('medium')} rounded-full flex items-center gap-2`}>
          <Camera size={16} className="text-cyan-600" />
          <span className="text-sm font-bold text-gray-900">
            {session.screenshots?.length || 0}
          </span>
        </div>

        {/* Task count */}
        <div className={`px-4 py-2 ${getGlassClasses('medium')} rounded-full flex items-center gap-2`}>
          <CheckSquare size={16} className="text-purple-600" />
          <span className="text-sm font-bold text-gray-900">
            {sessionTaskCount}
          </span>
        </div>
      </div>

      {/* ✅ NEW: Entity Pills */}
      {session.summary?.liveSnapshot && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Detected:</span>

          {/* Topics */}
          {entitiesState.topics.slice(0, 3).map(topic => (
            <span
              key={topic.id}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer transition-all"
              onClick={() => navigate('/library', { state: { filter: { topicId: topic.id } } })}
            >
              🏷️ {topic.name}
            </span>
          ))}

          {/* Companies */}
          {entitiesState.companies.slice(0, 2).map(company => (
            <span
              key={company.id}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer transition-all"
              onClick={() => navigate('/library', { state: { filter: { companyId: company.id } } })}
            >
              🏢 {company.name}
            </span>
          ))}

          {/* Contacts */}
          {entitiesState.contacts.slice(0, 2).map(contact => (
            <span
              key={contact.id}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer transition-all"
              onClick={() => navigate('/library', { state: { filter: { contactId: contact.id } } })}
            >
              👤 {contact.name}
            </span>
          ))}
        </div>
      )}

      {/* ✅ NEW: Focus Mode Selector */}
      <FocusModeSelector session={session} />
    </div>

    {/* Right: Action Buttons */}
    <div className="flex items-center gap-2">
      {/* ✅ Pause/Resume - Pill shaped */}
      <button
        onClick={handlePauseResume}
        className={`
          px-5 py-2 rounded-full font-semibold text-sm shadow-md
          ${TRANSITIONS.standard}
          ${isPaused
            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg'
            : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:shadow-lg'
          }
        `}
      >
        {isPaused ? (
          <><Play size={16} className="inline mr-1" />Resume</>
        ) : (
          <><Pause size={16} className="inline mr-1" />Pause</>
        )}
      </button>

      {/* ✅ End Session - Pill shaped */}
      <button
        onClick={handleEndSession}
        className={`
          px-5 py-2 rounded-full font-semibold text-sm shadow-md
          bg-gradient-to-r from-red-500 to-rose-500 text-white
          hover:shadow-lg ${TRANSITIONS.standard}
        `}
      >
        <Square size={16} className="inline mr-1" />
        End
      </button>
    </div>
  </div>
</div>
```

---

#### Task 5.2: Replace Summary Tab Content (4 hours)

**Files:**
- `src/components/ActiveSessionView.tsx` (lines 447-636)

**Change:**

```tsx
{activeView === 'summary' ? (
  <LiveIntelligencePanel session={session} />
) : ...}
```

**Remove:**
- Old summary display (lines 447-636)
- Replace with single LiveIntelligencePanel

---

### Phase 6: Integration & Testing (Week 6)

#### Task 6.1: Integration Testing (12 hours)

**Test Scenarios:**

1. **Full Session Flow**
   - Start session
   - Capture 5-10 screenshots
   - Verify events fire
   - Verify summary updates (not on 1-min timer)
   - Answer AI question
   - Accept task suggestion
   - Dismiss note suggestion
   - Change focus mode
   - End session

2. **Event-Driven Updates**
   - High-significance screenshot → summary updates quickly
   - Low-significance screenshots → summary waits for threshold
   - 5 minutes without update → summary updates anyway

3. **Query Tools Performance**
   - 100+ screenshots in session
   - Verify query time <50ms
   - Verify AI response time <5s

4. **Interactive Q&A**
   - AI asks question
   - User answers before timeout → summary uses answer
   - User doesn't answer → auto-continues after 15s

5. **Focus Modes**
   - Set focus to "Coding Only"
   - Verify summary only considers coding screenshots
   - Change focus → summary regenerates

6. **Suggestions**
   - Accept task → task created in Tasks Zone
   - Dismiss task → removed from suggestions
   - Resurface dismissed → appears again if still relevant

---

#### Task 6.2: Performance Optimization (8 hours)

**Optimizations:**

1. **Memoization**
   - Memo expensive aggregations in LiveSessionContextProvider
   - Memo query results

2. **Debouncing**
   - Debounce significance calculations
   - Debounce event emissions

3. **Caching**
   - Cache query results
   - Invalidate on new data

4. **Bundle Size**
   - Code-split LiveIntelligencePanel
   - Lazy-load heavy components

---

#### Task 6.3: Bug Fixes & Polish (12 hours)

**Areas:**

1. **UI Polish**
   - Smooth animations
   - Loading states
   - Empty states
   - Error handling

2. **Edge Cases**
   - No screenshots yet
   - Session paused
   - API errors
   - Network issues

3. **Accessibility**
   - ARIA labels
   - Keyboard navigation
   - Focus management

---

## Testing Strategy

### Unit Tests
- All service methods (LiveSessionIntelligenceService, LiveSessionContextProvider, AIQuestionManager)
- Event handlers
- Query functions
- Significance calculations

**Target:** 80% coverage for new code

### Integration Tests
- Event flow end-to-end
- Summary generation with query tools
- AI Q&A flow
- Focus mode changes

**Target:** All critical paths covered

### Manual Testing Checklist

```
Session Start
  ☐ Session starts successfully
  ☐ Header displays correctly
  ☐ Stats update in real-time

Screenshots
  ☐ Screenshot captured
  ☐ screenshot-analyzed event fires
  ☐ Significance calculated correctly
  ☐ Summary updates when threshold reached

AI Q&A
  ☐ Question appears in header
  ☐ Suggested answers clickable
  ☐ Custom answer input works
  ☐ Timeout auto-continues
  ☐ Summary regenerates with answer

Suggestions
  ☐ Task suggestions appear
  ☐ Accept creates task
  ☐ Dismiss removes suggestion
  ☐ Dismissed can resurface

Focus Mode
  ☐ Selector displays options
  ☐ Change triggers summary update
  ☐ AI-suggested focus appears
  ☐ Custom filter works

UI
  ☐ Pill buttons styled correctly
  ☐ Entity pills clickable
  ☐ Animations smooth
  ☐ Responsive layout

Session End
  ☐ End button works
  ☐ Events cleaned up
  ☐ Summary persisted
```

---

## Success Criteria

### Quantitative Metrics

1. **Summary Update Latency**
   - ✅ < 5 seconds from trigger to display
   - ✅ < 50ms for query operations

2. **Token Efficiency**
   - ✅ 50-70% reduction vs. current (context dumps eliminated)
   - ✅ Average <4000 tokens per summary

3. **User Engagement**
   - ✅ 60%+ of sessions use Summary tab
   - ✅ 40%+ of suggestions accepted

4. **Performance**
   - ✅ <100ms UI response time
   - ✅ 0ms blocking operations

### Qualitative Metrics

1. **User Experience**
   - Summary feels "timely" not "delayed"
   - Suggestions are relevant and actionable
   - Focus modes improve summary quality
   - AI questions are helpful not annoying

2. **Code Quality**
   - All TypeScript strict mode
   - Comprehensive tests
   - Clear documentation
   - Maintainable architecture

---

## Rollout Plan

### Pre-Launch (Week 6)

1. **Code Review**
   - Review all new code
   - Check for security issues
   - Verify performance

2. **Documentation**
   - Update CLAUDE.md
   - Add JSDoc to all exports
   - Write user guide section

3. **Testing**
   - Run full test suite
   - Manual testing checklist
   - Performance profiling

### Launch (Week 7)

1. **Deploy**
   - Merge to main
   - Tag release
   - Deploy to production

2. **Monitor**
   - Watch error logs
   - Monitor performance
   - Gather user feedback

3. **Iterate**
   - Fix critical bugs
   - Adjust thresholds based on data
   - Refine AI prompts

---

## Risk Mitigation

### Risk 1: AI Question Fatigue
**Risk:** Users get annoyed by too many questions
**Mitigation:**
- Limit to 1 question per summary update
- Only ask when confidence < 0.6
- Track dismissal rate, adjust frequency

### Risk 2: Token Costs
**Risk:** Query-based system uses more tokens than expected
**Mitigation:**
- Monitor token usage per summary
- Add query result caching
- Limit query complexity

### Risk 3: Performance Degradation
**Risk:** Long sessions (100+ screenshots) slow down
**Mitigation:**
- Add in-memory indexes
- Implement query result caching
- Profile regularly

### Risk 4: Event Overload
**Risk:** Too many events overwhelm system
**Mitigation:**
- Debounce event emissions
- Batch similar events
- Add rate limiting

---

## Next Steps

1. **Review this plan** - Validate approach
2. **Approve architecture** - Confirm technical decisions
3. **Begin Phase 1** - Start with event system
4. **Iterate weekly** - Review progress, adjust plan

---

**Total Estimated Effort:** ~6 weeks, ~150 hours

**Key Deliverables:**
1. Event-driven summary updates (no more 1-min polling)
2. Queryable context system (token-efficient)
3. Interactive AI Q&A (proactive clarification)
4. Focus modes (user + AI narrowing)
5. Action-oriented UI (task/note suggestions)
6. Modern design (pill buttons, entity pills)

**Success:** Live sessions become an intelligent, collaborative experience where AI actively helps users stay focused and productive.

---

**Ready to begin implementation?**
