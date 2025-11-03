# Live Session Intelligence - Architecture Proposal

**Date:** 2025-11-01
**Status:** Architectural Design Proposal
**Author:** Claude Code

---

## Executive Summary

This proposal redesigns live session summarization from a fixed-interval polling system to an **event-driven, queryable intelligence architecture** that:

1. **Updates summaries when meaningful context arrives** (not every 1 minute)
2. **Provides AI tools to query session data efficiently** (not sending massive context)
3. **Enables focus modes** (user can narrow analysis scope)
4. **Surfaces actionable intelligence during sessions** (tasks, notes, blockers)
5. **Modernizes the UI** to match post-session styling

**Core Principle:** Let the AI decide what's relevant by giving it search/query capabilities, rather than sending all data and hoping it extracts the right information.

---

## Current State Analysis

### What Exists Today ✅

**Data Capture:**
- ✅ Screenshot analysis with rich metadata:
  - `detectedActivity` - activity categorization
  - `keyElements` - UI elements detected
  - `extractedText` - OCR results
  - `contextDelta` - what changed since last screenshot
  - `curiosity` - adaptive scheduling signal (0-1 score)
  - `progressIndicators` - achievements/blockers/insights
  - `detectedEntities` - topics/companies/contacts auto-created

- ✅ Audio transcription with metadata:
  - `transcription` - speech-to-text
  - `keyPhrases` - important phrases
  - `sentiment` - emotional tone
  - `containsTask` / `containsBlocker` - boolean flags

**Storage Architecture:**
- ✅ ChunkedSessionStorage - progressive loading, metadata-first
- ✅ ContentAddressableStorage - deduplicated attachments
- ✅ InvertedIndexManager - fast search (7 indexes: topic, date, tag, full-text, category, sub-category, status)

**Summary Generation:**
- ✅ `generateSessionSummary()` - comprehensive AI synthesis
- ✅ Runs every 1 minute during active sessions (SessionsZone.tsx line 1396)
- ✅ Requires 2+ analyzed screenshots or audio segments (line 1388)

**Event System:**
- ✅ EventBus exists (`src/utils/eventBus.ts`)
- ✅ Currently used for: media-processing, enrichment events
- ❌ NO events for: screenshot-analyzed, audio-processed, summary-updated

---

### Problems with Current Approach ❌

#### 1. Fixed 1-Minute Interval is Arbitrary
```typescript
const SYNTHESIS_INTERVAL_MS = 1 * 60 * 1000; // ❌ Why 1 minute?
```

**Problems:**
- User taking screenshots every 30 seconds (high activity) → waits 60s for summary
- User taking screenshots every 10 minutes (low activity) → summary runs unnecessarily
- No correlation between data availability and summary generation

**Better:** Event-driven updates when meaningful context accumulates.

---

#### 2. Massive Context Dumping
```typescript
// Line 272-293 in sessionsAgentService.ts
const analyses = timelineItems.map((item, index) => {
  if (item.type === 'screenshot') {
    return `**Screenshot ${index + 1}** ...
    - Activity: ${s.aiAnalysis?.detectedActivity}
    - Summary: ${s.aiAnalysis?.summary}
    - Key Elements: ${s.aiAnalysis?.keyElements?.join(', ')}`;
  }
  // ... dumps ALL screenshots + ALL audio
}).join('\n');
```

**Problems:**
- Sends ALL screenshots + ALL audio to AI every time
- For a 2-hour session with 60 screenshots → massive prompt
- AI can't efficiently find "what changed since last summary"
- Wastes tokens re-analyzing old data

**Better:** Give AI query tools to fetch only relevant context.

---

#### 3. No Focus Modes
- User working on 3 different projects in one session
- AI summarizes everything → diluted, unfocused summary
- No way to say "only analyze coding activity" or "only analyze meeting discussions"

**Better:** User-selectable focus filters.

---

#### 4. Summary UI Not Actionable
**Current Summary Tab** (lines 447-636 in ActiveSessionView.tsx):
- Shows narrative paragraph ("what you did") - not useful during active work
- Shows achievements/blockers - good but static
- No actionable suggestions (tasks to create, notes to write)
- No real-time guidance

**Better:** Action-oriented intelligence panel.

---

## Proposed Architecture

### 1. Event-Driven Summary Updates

#### New Events in EventBus

**File:** `src/utils/eventBus.ts`

```typescript
interface EventMap {
  // ... existing events

  // Session analysis events
  'screenshot-analyzed': ScreenshotAnalyzedEvent;
  'audio-segment-processed': AudioSegmentProcessedEvent;
  'session-context-changed': SessionContextChangedEvent;
  'summary-update-triggered': SummaryUpdateTriggeredEvent;
  'summary-updated': SummaryUpdatedEvent;
}

export interface ScreenshotAnalyzedEvent {
  sessionId: string;
  screenshotId: string;
  analysis: SessionScreenshot['aiAnalysis'];
  hasNewEntities: boolean;
  hasProgressIndicators: boolean;
}

export interface AudioSegmentProcessedEvent {
  sessionId: string;
  segmentId: string;
  containsTask: boolean;
  containsBlocker: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface SessionContextChangedEvent {
  sessionId: string;
  changeType: 'screenshot' | 'audio' | 'entity-created' | 'context-item';
  significance: 'low' | 'medium' | 'high'; // How meaningful is this change
}

export interface SummaryUpdateTriggeredEvent {
  sessionId: string;
  reason: 'context-threshold' | 'manual' | 'focus-change';
  pendingChanges: number;
}

export interface SummaryUpdatedEvent {
  sessionId: string;
  summary: SessionSummary;
  processingTime: number;
}
```

---

#### Smart Update Trigger Logic

**File:** `src/services/LiveSessionIntelligenceService.ts` (NEW)

```typescript
/**
 * LiveSessionIntelligenceService - Event-driven summary updates
 *
 * Triggers summary updates based on meaningful context accumulation,
 * not fixed time intervals.
 */
export class LiveSessionIntelligenceService {
  private pendingChanges: Map<string, ContextChange[]> = new Map();
  private lastSummaryTime: Map<string, number> = new Map();

  // Thresholds for triggering updates
  private readonly MIN_CHANGES_FOR_UPDATE = 3; // Need 3+ meaningful changes
  private readonly MIN_TIME_BETWEEN_UPDATES = 30 * 1000; // At least 30s apart
  private readonly MAX_TIME_WITHOUT_UPDATE = 5 * 60 * 1000; // Max 5 min without update

  constructor() {
    // Listen to analysis events
    eventBus.on('screenshot-analyzed', (event) => this.handleScreenshotAnalyzed(event));
    eventBus.on('audio-segment-processed', (event) => this.handleAudioProcessed(event));
  }

  private handleScreenshotAnalyzed(event: ScreenshotAnalyzedEvent) {
    const { sessionId, analysis } = event;

    // Calculate significance
    const significance = this.calculateSignificance(analysis);

    // Record change
    this.recordChange(sessionId, {
      type: 'screenshot',
      significance,
      timestamp: Date.now(),
    });

    // Check if we should trigger summary update
    this.checkAndTriggerUpdate(sessionId);
  }

  private calculateSignificance(analysis: SessionScreenshot['aiAnalysis']): 'low' | 'medium' | 'high' {
    if (!analysis) return 'low';

    // High significance indicators
    const hasAchievements = (analysis.progressIndicators?.achievements?.length || 0) > 0;
    const hasBlockers = (analysis.progressIndicators?.blockers?.length || 0) > 0;
    const hasEntities = (analysis.detectedEntities?.topics?.length || 0) +
                       (analysis.detectedEntities?.companies?.length || 0) +
                       (analysis.detectedEntities?.contacts?.length || 0) > 0;
    const highCuriosity = (analysis.curiosity || 0) >= 0.7;
    const hasContextChange = !!analysis.contextDelta;

    if (hasBlockers || highCuriosity) return 'high';
    if (hasAchievements || hasEntities || hasContextChange) return 'medium';
    return 'low';
  }

  private async checkAndTriggerUpdate(sessionId: string) {
    const changes = this.pendingChanges.get(sessionId) || [];
    const lastUpdate = this.lastSummaryTime.get(sessionId) || 0;
    const now = Date.now();

    // Calculate total significance score
    const significanceScore = changes.reduce((sum, change) => {
      return sum + (change.significance === 'high' ? 3 : change.significance === 'medium' ? 2 : 1);
    }, 0);

    // Decision logic
    const hasEnoughChanges = significanceScore >= this.MIN_CHANGES_FOR_UPDATE;
    const enoughTimePassed = (now - lastUpdate) >= this.MIN_TIME_BETWEEN_UPDATES;
    const tooLongSinceUpdate = (now - lastUpdate) >= this.MAX_TIME_WITHOUT_UPDATE;

    const shouldUpdate = (hasEnoughChanges && enoughTimePassed) || tooLongSinceUpdate;

    if (shouldUpdate) {
      console.log(`🎯 [Intelligence] Triggering summary update for session ${sessionId}`, {
        significanceScore,
        pendingChanges: changes.length,
        timeSinceLastUpdate: Math.floor((now - lastUpdate) / 1000),
        reason: tooLongSinceUpdate ? 'max-time-exceeded' : 'context-threshold'
      });

      // Emit trigger event
      eventBus.emit('summary-update-triggered', {
        sessionId,
        reason: tooLongSinceUpdate ? 'max-time' : 'context-threshold',
        pendingChanges: changes.length,
      });

      // Clear pending changes
      this.pendingChanges.set(sessionId, []);
      this.lastSummaryTime.set(sessionId, now);

      // Trigger actual summary generation (delegated to summary service)
      await this.triggerSummaryGeneration(sessionId);
    }
  }
}
```

**Benefits:**
- ✅ Updates when meaningful (3+ significant changes OR 5 minutes elapsed)
- ✅ Respects minimum time between updates (30s)
- ✅ High-priority events (blockers, high curiosity) trigger faster
- ✅ Low-activity sessions don't waste API calls

---

### 2. Queryable Context System

#### AI Tools for Efficient Context Retrieval

Instead of sending ALL screenshots, give the AI **tools to query** what it needs.

**File:** `src/services/LiveSessionContextTools.ts` (NEW)

```typescript
/**
 * Context query tools for AI to efficiently retrieve session data
 */
export interface SessionContextTools {
  searchScreenshots(query: ScreenshotQuery): SessionScreenshot[];
  searchAudioSegments(query: AudioQuery): SessionAudioSegment[];
  getRecentActivity(limit: number): TimelineItem[];
  getActivitySince(timestamp: string): TimelineItem[];
  filterByActivity(activityType: string): TimelineItem[];
  getProgressIndicators(since?: string): ProgressSummary;
}

export interface ScreenshotQuery {
  /** Activity type filter */
  activity?: string; // 'coding', 'debugging', 'email', etc.

  /** Text search in extractedText */
  text?: string;

  /** Element search in keyElements */
  elements?: string[];

  /** Has achievements */
  hasAchievements?: boolean;

  /** Has blockers */
  hasBlockers?: boolean;

  /** Minimum curiosity score */
  minCuriosity?: number;

  /** Time range */
  since?: string; // ISO timestamp
  until?: string;

  /** Limit results */
  limit?: number;
}

export interface AudioQuery {
  /** Text search in transcription */
  text?: string;

  /** Phrase search in keyPhrases */
  phrases?: string[];

  /** Sentiment filter */
  sentiment?: 'positive' | 'neutral' | 'negative';

  /** Has task flag */
  containsTask?: boolean;

  /** Has blocker flag */
  containsBlocker?: boolean;

  /** Time range */
  since?: string;
  until?: string;

  /** Limit results */
  limit?: number;
}

export class LiveSessionContextProvider {
  private session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  /**
   * Search screenshots with filters
   * Uses existing metadata - NO external API calls
   */
  searchScreenshots(query: ScreenshotQuery): SessionScreenshot[] {
    let results = (this.session.screenshots || []).filter(s => s.aiAnalysis);

    // Filter by activity
    if (query.activity) {
      results = results.filter(s =>
        s.aiAnalysis?.detectedActivity?.toLowerCase().includes(query.activity!.toLowerCase())
      );
    }

    // Text search in extractedText
    if (query.text) {
      const searchTerm = query.text.toLowerCase();
      results = results.filter(s =>
        s.aiAnalysis?.extractedText?.toLowerCase().includes(searchTerm) ||
        s.aiAnalysis?.summary?.toLowerCase().includes(searchTerm)
      );
    }

    // Element search
    if (query.elements && query.elements.length > 0) {
      results = results.filter(s =>
        query.elements!.some(elem =>
          s.aiAnalysis?.keyElements?.some(ke => ke.toLowerCase().includes(elem.toLowerCase()))
        )
      );
    }

    // Has achievements
    if (query.hasAchievements) {
      results = results.filter(s =>
        (s.aiAnalysis?.progressIndicators?.achievements?.length || 0) > 0
      );
    }

    // Has blockers
    if (query.hasBlockers) {
      results = results.filter(s =>
        (s.aiAnalysis?.progressIndicators?.blockers?.length || 0) > 0
      );
    }

    // Minimum curiosity
    if (query.minCuriosity !== undefined) {
      results = results.filter(s =>
        (s.aiAnalysis?.curiosity || 0) >= query.minCuriosity!
      );
    }

    // Time range
    if (query.since) {
      const sinceTime = new Date(query.since).getTime();
      results = results.filter(s => new Date(s.timestamp).getTime() >= sinceTime);
    }
    if (query.until) {
      const untilTime = new Date(query.until).getTime();
      results = results.filter(s => new Date(s.timestamp).getTime() <= untilTime);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Search audio segments with filters
   */
  searchAudioSegments(query: AudioQuery): SessionAudioSegment[] {
    let results = this.session.audioSegments || [];

    // Text search
    if (query.text) {
      const searchTerm = query.text.toLowerCase();
      results = results.filter(s =>
        s.transcription?.toLowerCase().includes(searchTerm)
      );
    }

    // Phrase search
    if (query.phrases && query.phrases.length > 0) {
      results = results.filter(s =>
        query.phrases!.some(phrase =>
          s.keyPhrases?.some(kp => kp.toLowerCase().includes(phrase.toLowerCase()))
        )
      );
    }

    // Sentiment filter
    if (query.sentiment) {
      results = results.filter(s => s.sentiment === query.sentiment);
    }

    // Task flag
    if (query.containsTask) {
      results = results.filter(s => s.containsTask === true);
    }

    // Blocker flag
    if (query.containsBlocker) {
      results = results.filter(s => s.containsBlocker === true);
    }

    // Time range
    if (query.since) {
      const sinceTime = new Date(query.since).getTime();
      results = results.filter(s => new Date(s.timestamp).getTime() >= sinceTime);
    }
    if (query.until) {
      const untilTime = new Date(query.until).getTime();
      results = results.filter(s => new Date(s.timestamp).getTime() <= untilTime);
    }

    // Sort by timestamp
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Get recent activity (last N items, chronological)
   */
  getRecentActivity(limit: number = 10): TimelineItem[] {
    const screenshots = (this.session.screenshots || [])
      .filter(s => s.aiAnalysis)
      .map(s => ({ type: 'screenshot' as const, timestamp: s.timestamp, data: s }));

    const audio = (this.session.audioSegments || [])
      .map(a => ({ type: 'audio' as const, timestamp: a.timestamp, data: a }));

    return [...screenshots, ...audio]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get activity since timestamp
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
   * Filter by activity type
   */
  filterByActivity(activityType: string): TimelineItem[] {
    const screenshots = (this.session.screenshots || [])
      .filter(s =>
        s.aiAnalysis?.detectedActivity?.toLowerCase().includes(activityType.toLowerCase())
      )
      .map(s => ({ type: 'screenshot' as const, timestamp: s.timestamp, data: s }));

    return screenshots.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Get aggregated progress indicators
   */
  getProgressIndicators(since?: string): ProgressSummary {
    let screenshots = this.session.screenshots || [];

    if (since) {
      const sinceTime = new Date(since).getTime();
      screenshots = screenshots.filter(s => new Date(s.timestamp).getTime() >= sinceTime);
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
}
```

---

#### Updated AI Summary Prompt with Tool Access

**File:** `src/services/sessionsAgentService.ts`

**Key Change:** Instead of dumping ALL data, teach AI to use query tools:

```typescript
const prompt = `You are analyzing an ACTIVE work session titled "${session.name}".

**Session Duration:** ${this.calculateDuration(session)} minutes
**Current Status:** ${session.status}

**Available Tools:**
You have access to session query tools to efficiently find relevant information:

1. **searchScreenshots(query)** - Find screenshots matching criteria:
   - activity: Filter by detected activity type
   - text: Search extracted text (OCR)
   - elements: Search UI elements
   - hasAchievements: Only screenshots with achievements
   - hasBlockers: Only screenshots with blockers
   - minCuriosity: Filter by curiosity score
   - since/until: Time range
   - limit: Max results

2. **searchAudioSegments(query)** - Find audio matching criteria:
   - text: Search transcriptions
   - phrases: Search key phrases
   - sentiment: Filter by sentiment
   - containsTask/containsBlocker: Boolean flags
   - since/until: Time range
   - limit: Max results

3. **getRecentActivity(limit)** - Get last N items chronologically

4. **getActivitySince(timestamp)** - Get all activity since last summary

5. **filterByActivity(type)** - Get all screenshots of specific activity type

6. **getProgressIndicators(since?)** - Get aggregated achievements/blockers/insights

**Your Task:**
Generate a live summary by QUERYING for relevant information, not by analyzing ALL data.

**Strategy:**
1. First, use getActivitySince(lastSummaryTimestamp) to see what's NEW
2. If significant changes detected, query for specific context:
   - Use searchScreenshots({ hasBlockers: true }) for blockers
   - Use searchScreenshots({ hasAchievements: true }) for achievements
   - Use searchScreenshots({ minCuriosity: 0.7 }) for high-interest moments
3. Generate focused summary based on QUERIED data only

**Output Format (JSON):**
{
  "liveSnapshot": {
    "currentFocus": "What user is doing RIGHT NOW (from latest activity)",
    "progressToday": ["achievement 1", "achievement 2"],
    "momentum": "high" | "medium" | "low"
  },
  "achievements": ["achievement 1", "achievement 2"],
  "blockers": ["blocker 1"],
  "suggestedTasks": [
    {
      "title": "Task title",
      "description": "Why this matters",
      "priority": "high",
      "context": "Based on blocker X"
    }
  ],
  "suggestedNotes": [
    {
      "title": "Note title",
      "summary": "Brief summary",
      "reason": "Why save this"
    }
  ],
  "focusRecommendation": {
    "message": "You're context-switching frequently. Consider...",
    "severity": "info" | "warning"
  }
}

Return ONLY valid JSON.`;
```

**Benefits:**
- ✅ AI only fetches what it needs (saves tokens)
- ✅ Faster processing (less data to analyze)
- ✅ More focused summaries (AI isn't overwhelmed)
- ✅ Scalable to long sessions (doesn't break with 100+ screenshots)

---

### 3. Focus Modes

Allow users to narrow analysis scope during sessions.

**UI Addition:** Focus selector in ActiveSessionView header

```tsx
<div className="flex items-center gap-2">
  <span className="text-sm text-gray-600">Focus:</span>
  <select
    value={sessionFocus}
    onChange={(e) => updateSessionFocus(e.target.value)}
    className="px-3 py-1 rounded-full bg-white/80 text-sm font-medium"
  >
    <option value="all">All Activity</option>
    <option value="coding">Coding Only</option>
    <option value="debugging">Debugging Only</option>
    <option value="meetings">Meetings Only</option>
    <option value="documentation">Documentation Only</option>
    <option value="custom">Custom Filter...</option>
  </select>
</div>
```

**Backend Support:**

```typescript
export interface SessionFocusFilter {
  activities?: string[]; // ['coding', 'debugging']
  excludeActivities?: string[];
  keywords?: string[]; // Only screenshots/audio containing these keywords
  minCuriosity?: number; // Ignore low-curiosity items
}

// Apply filter to context provider
const contextProvider = new LiveSessionContextProvider(session, focusFilter);
```

**Summary Generation with Focus:**

```typescript
// Only pass filtered context to AI
const relevantScreenshots = contextProvider.searchScreenshots({
  activity: focusFilter.activities?.[0],
  limit: 20, // Max 20 most relevant
});

// AI summary only considers focused data
```

**Benefits:**
- ✅ User working on multiple projects → can get focused summary per project
- ✅ Reduces noise for AI
- ✅ More actionable summaries

---

### 4. Action-Oriented Summary UI

**Current:** Paragraph narrative + static achievement/blocker lists
**Proposed:** Intelligence panel with actionable suggestions

**New Component:** `LiveIntelligencePanel.tsx`

```tsx
export function LiveIntelligencePanel({ session }: { session: Session }) {
  const summary = session.summary;

  if (!summary?.liveSnapshot) {
    return <EmptyState message="Gathering intelligence..." />;
  }

  return (
    <div className="space-y-4">
      {/* Current Focus */}
      <CurrentFocusCard
        focus={summary.liveSnapshot.currentFocus}
        momentum={summary.liveSnapshot.momentum}
        lastUpdate={summary.lastUpdated}
      />

      {/* Suggested Actions */}
      <ActionsSuggestionPanel>
        {/* Suggested Tasks */}
        {summary.suggestedTasks?.map(task => (
          <TaskSuggestionCard
            key={task.title}
            task={task}
            onAccept={() => createTask(task)}
            onDismiss={() => dismissSuggestion(task.title)}
          />
        ))}

        {/* Suggested Notes */}
        {summary.suggestedNotes?.map(note => (
          <NoteSuggestionCard
            key={note.title}
            note={note}
            onAccept={() => createNote(note)}
            onDismiss={() => dismissSuggestion(note.title)}
          />
        ))}
      </ActionsSuggestionPanel>

      {/* Active Blockers (with suggested resolutions) */}
      <BlockersPanel blockers={summary.blockers} />

      {/* Focus Recommendation */}
      {summary.focusRecommendation && (
        <FocusRecommendationBanner
          message={summary.focusRecommendation.message}
          severity={summary.focusRecommendation.severity}
        />
      )}

      {/* Progress Stats */}
      <ProgressStatsGrid
        achievements={summary.achievements}
        blockers={summary.blockers}
        momentum={summary.liveSnapshot.momentum}
      />
    </div>
  );
}
```

**Key UI Elements:**

1. **Task Suggestion Card**
   ```
   ┌─────────────────────────────────────────┐
   │ 📋 Suggested Task                       │
   │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
   │                                         │
   │ Fix API timeout error in auth service  │
   │ Priority: High                          │
   │                                         │
   │ Context: Encountered blocker at 2:30pm │
   │                                         │
   │ [✓ Create Task] [✕ Dismiss]            │
   └─────────────────────────────────────────┘
   ```

2. **Note Suggestion Card**
   ```
   ┌─────────────────────────────────────────┐
   │ 📝 Suggested Note                       │
   │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
   │                                         │
   │ JWT token expiry causing login issues  │
   │                                         │
   │ Summary: Discovered that tokens expire │
   │ after 1 hour, causing logout. Need to │
   │ implement refresh token logic.         │
   │                                         │
   │ [✓ Save Note] [✕ Dismiss]              │
   └─────────────────────────────────────────┘
   ```

3. **Focus Recommendation Banner**
   ```
   ┌─────────────────────────────────────────┐
   │ ⚠️ You've switched contexts 5 times     │
   │    in the last hour.                     │
   │                                         │
   │ Consider: Finishing the auth flow      │
   │ before starting the dashboard work.     │
   │                                         │
   │ [Set Focus Mode] [Dismiss]              │
   └─────────────────────────────────────────┘
   ```

---

### 5. UI Modernization

**Current Header Issues:**
- Buttons not pill-shaped (inconsistent with design system)
- Large rectangular buttons don't match post-session styling
- Stats badges look different from Library Zone

**Proposed Changes:**

#### Header Redesign (ActiveSessionView.tsx lines 179-326)

```tsx
{/* Right: Action Buttons */}
<div className="flex items-center gap-2">
  {/* Pause/Resume - Pill shaped */}
  <button
    onClick={handlePauseResume}
    className={`
      px-5 py-2 rounded-full font-semibold text-sm shadow-md
      ${getRadiusClass('pill')}
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

  {/* End Session - Pill shaped */}
  <button
    onClick={handleEndSession}
    className={`
      px-5 py-2 rounded-full font-semibold text-sm shadow-md
      bg-gradient-to-r from-red-500 to-rose-500 text-white
      hover:shadow-lg ${TRANSITIONS.standard}
      ${getRadiusClass('pill')}
    `}
  >
    <Square size={16} className="inline mr-1" />
    End
  </button>
</div>
```

#### Entity Pills (matching Library Zone style)

```tsx
{/* Detected Entities */}
{session.detectedEntities && (
  <div className="flex items-center gap-2 flex-wrap">
    <span className="text-xs text-gray-500">Detected:</span>

    {/* Topic Pills */}
    {session.detectedEntities.topics?.slice(0, 3).map(topic => (
      <span
        key={topic.name}
        className={`
          px-3 py-1 rounded-full text-xs font-semibold
          bg-blue-100 text-blue-700 hover:bg-blue-200
          cursor-pointer ${TRANSITIONS.standard}
        `}
        onClick={() => navigateToLibrary({ topic: topic.name })}
      >
        🏷️ {topic.name}
      </span>
    ))}

    {/* Company Pills */}
    {session.detectedEntities.companies?.slice(0, 2).map(company => (
      <span
        key={company.name}
        className={`
          px-3 py-1 rounded-full text-xs font-semibold
          bg-purple-100 text-purple-700 hover:bg-purple-200
          cursor-pointer ${TRANSITIONS.standard}
        `}
        onClick={() => navigateToLibrary({ company: company.name })}
      >
        🏢 {company.name}
      </span>
    ))}

    {/* Contact Pills */}
    {session.detectedEntities.contacts?.slice(0, 2).map(contact => (
      <span
        key={contact.name}
        className={`
          px-3 py-1 rounded-full text-xs font-semibold
          bg-green-100 text-green-700 hover:bg-green-200
          cursor-pointer ${TRANSITIONS.standard}
        `}
        onClick={() => navigateToLibrary({ contact: contact.name })}
      >
        👤 {contact.name}
      </span>
    ))}
  </div>
)}
```

---

## Data Architecture for Growth

### Extensibility Principles

1. **Metadata-Driven Analysis**
   - All analysis data stored as structured metadata (already done)
   - New analysis types = new metadata fields (no code changes)
   - Query tools automatically support new fields

2. **Tool-Based AI Interaction**
   - AI uses tools to fetch data (not all-at-once dumps)
   - New tools can be added without changing prompt structure
   - Example: `getCodeChanges()`, `getErrorLogs()`, `getKeyboardActivity()`

3. **Event-Driven Architecture**
   - All significant changes emit events
   - Services subscribe to relevant events
   - Easy to add new reactions (e.g., auto-pause on blocker detected)

4. **Inverted Indexes**
   - Already have 7 indexes for fast search
   - Easy to add new indexes (e.g., by-error-type, by-curiosity-level)
   - Query tools leverage indexes automatically

---

## Implementation Roadmap

### Phase 1: Event System (Week 1, ~8 hours)

1. **Add session events to EventBus** (1 hour)
   - `screenshot-analyzed`
   - `audio-segment-processed`
   - `session-context-changed`
   - `summary-update-triggered`
   - `summary-updated`

2. **Create LiveSessionIntelligenceService** (3 hours)
   - Event listeners
   - Significance calculation
   - Smart trigger logic
   - Replace 1-minute polling

3. **Emit events from SessionsZone** (2 hours)
   - After `updateScreenshotAnalysis`
   - After `addAudioSegment`
   - Test event flow

4. **Testing** (2 hours)
   - Verify events fire correctly
   - Test trigger logic with various scenarios
   - Monitor console logs

---

### Phase 2: Queryable Context (Week 2, ~10 hours)

1. **Create LiveSessionContextProvider** (4 hours)
   - Implement search methods
   - Test with real session data
   - Optimize for performance

2. **Update sessionsAgentService.generateSessionSummary** (3 hours)
   - Add tool-based prompt
   - Integrate context provider
   - Return action-oriented summary

3. **Add suggestedTasks/suggestedNotes to return type** (1 hour)
   - Update SessionSummary interface
   - Handle in response parser

4. **Testing** (2 hours)
   - Verify query tools work correctly
   - Test summary generation with tools
   - Compare token usage (should be lower)

---

### Phase 3: UI Modernization (Week 3, ~12 hours)

1. **Update ActiveSessionView header** (3 hours)
   - Pill-shaped buttons
   - Entity pills
   - Focus mode selector

2. **Create LiveIntelligencePanel** (4 hours)
   - TaskSuggestionCard
   - NoteSuggestionCard
   - BlockersPanel
   - FocusRecommendationBanner
   - ProgressStatsGrid

3. **Add action handlers** (3 hours)
   - Create task from suggestion
   - Create note from suggestion
   - Dismiss suggestions
   - Update focus mode

4. **Testing & Polish** (2 hours)
   - Visual consistency
   - Animations
   - Responsive design

---

### Phase 4: Focus Modes (Week 4, ~6 hours)

1. **Add SessionFocusFilter to types** (1 hour)

2. **Create focus selector UI** (2 hours)
   - Dropdown with presets
   - Custom filter modal

3. **Integrate with context provider** (2 hours)
   - Apply filters to queries
   - Update summary generation

4. **Testing** (1 hour)
   - Test various focus modes
   - Verify filtered summaries

---

## Success Metrics

### Quantitative
- **Summary Update Latency**: < 5 seconds from context change to summary update
- **Token Usage**: 50-70% reduction vs. current (from not sending all data)
- **UI Response Time**: < 100ms for action buttons
- **Summary Accuracy**: 80%+ user approval rate on suggestions

### Qualitative
- Users create tasks/notes directly from suggestions
- Users report summaries feel "timely" not "delayed"
- Users use focus modes for multi-project sessions
- Users trust AI blockers/recommendations

---

## Open Questions

1. **Suggestion Persistence**: Should dismissed suggestions stay hidden forever or resurface if still relevant?
   - **Recommendation**: Session-scoped dismissals (reset on new session)

2. **Focus Mode Default**: Should new sessions start with "All Activity" or try to infer focus?
   - **Recommendation**: Default to "All", let AI suggest focus after 5-10 minutes

3. **Suggestion Threshold**: How confident should AI be before suggesting tasks/notes?
   - **Recommendation**: 70%+ confidence, user feedback adjusts threshold

4. **Context Provider Performance**: With 100+ screenshots, query performance?
   - **Recommendation**: In-memory indexes for screenshots (O(log n) search)

---

## Conclusion

This architecture transforms live session intelligence from:

**Before:**
- Fixed 1-minute polling ❌
- Dump all data to AI ❌
- Generic summaries ❌
- No actionable suggestions ❌

**After:**
- Event-driven updates ✅
- AI queries what it needs ✅
- Focused, relevant summaries ✅
- Task/note suggestions ✅
- Focus modes ✅
- Modern, consistent UI ✅

**Effort:** ~4 weeks, ~36 hours total
**Risk:** Low (incremental changes, backward compatible events)
**Impact:** High (fundamental improvement to live session experience)

---

**Ready to discuss and refine this proposal?**
