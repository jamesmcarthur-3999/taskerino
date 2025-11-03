# Live Session Intelligence API

Complete API reference for integrating external AI services with Taskerino's live session system.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Tool API](#tool-api)
4. [Event API](#event-api)
5. [Context API](#context-api)
6. [Update API](#update-api)
7. [Complete Integration Example](#complete-integration-example)
8. [Best Practices](#best-practices)

---

## Overview

The Live Session Intelligence Infrastructure provides **APIs and tools** for external AI services to integrate with Taskerino's session system. It does NOT include AI orchestration - you bring your own AI service.

### What You Get

- **9 Tools** - Search entities, query sessions, create tasks/notes, ask questions
- **6 Events** - Real-time notifications when session data changes
- **3 Context Types** - Summary (2-5KB), Full (50-200KB), Delta (1-10KB)
- **Update API** - Functions to modify summaries and create entities

### What You Need to Provide

- **AI Service** - Your own AI orchestrator (Claude, GPT-4, custom model)
- **Decision Logic** - When to update summaries, what to suggest
- **Event Handlers** - Listen to events and trigger AI updates

---

## Quick Start

### 1. Install Dependencies

```typescript
import {
  getLiveSessionTools,
  subscribeToLiveSessionEvents,
  getSessionContext,
  updateLiveSessionSummary,
  type ToolCall,
  type ToolResult
} from '@/services/liveSession';
```

### 2. Listen to Events

```typescript
// Listen for new screenshots
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  console.log(`New screenshot: ${event.screenshot.id}`);

  // Your AI decides: should we update summary?
  const shouldUpdate = await yourAI.shouldUpdateSummary(event);

  if (shouldUpdate) {
    await handleSummaryUpdate(event.sessionId);
  }
});
```

### 3. Get Session Context

```typescript
async function handleSummaryUpdate(sessionId: string) {
  // Get lightweight context
  const context = await getSessionContext(sessionId, 'summary');

  // Call your AI service
  const aiResponse = await yourAI.generateUpdate(context);

  // Update summary
  await updateLiveSessionSummary(sessionId, {
    currentFocus: aiResponse.currentFocus,
    progressToday: aiResponse.progressToday,
    momentum: aiResponse.momentum
  });
}
```

### 4. Use Tools (Optional)

```typescript
// Get tools for AI
const { schemas, executor } = getLiveSessionTools(activeSession);

// Pass schemas to your AI
const aiResponse = await yourAI.chat({
  messages: [...],
  tools: schemas  // AI can call these tools
});

// Execute tool calls from AI
if (aiResponse.tool_calls) {
  const results = await executor.executeTools(aiResponse.tool_calls);
  // Continue conversation with results...
}
```

---

## Tool API

### Available Tools

#### 1. universal_search

Search across all entities (sessions, notes, tasks) with relationship awareness.

**Input**:
```typescript
{
  query?: string;                    // Full-text search
  entityTypes?: ('sessions' | 'notes' | 'tasks')[];
  relatedTo?: {
    entityType: 'session' | 'note' | 'task' | 'topic' | 'company' | 'contact';
    entityId: string;
    maxHops?: number;                // Default: 1
  };
  filters?: {
    status?: string;                 // Task status
    priority?: string;               // Task priority
    completed?: boolean;             // Task completion
    topicIds?: string[];             // Filter by topics
    companyIds?: string[];           // Filter by companies
    // ... more filters
  };
  limit?: number;                    // Default: 50
}
```

**Output**:
```typescript
{
  results: {
    sessions: SearchResultItem[];
    notes: SearchResultItem[];
    tasks: SearchResultItem[];
  };
  counts: {
    sessions: number;
    notes: number;
    tasks: number;
    total: number;
  };
  took: number;  // milliseconds
}
```

**Example**:
```typescript
// Find all notes about topic X
const result = await executor.executeTools([{
  id: '1',
  name: 'universal_search',
  input: {
    entityTypes: ['notes'],
    relatedTo: {
      entityType: 'topic',
      entityId: 'topic-auth-123'
    }
  }
}]);
```

#### 2. search_session_screenshots

Search screenshots in active session by activity, text, or progress indicators.

**Input**:
```typescript
{
  activity?: string;         // e.g., "coding", "email-writing"
  text?: string;             // Search OCR text
  elements?: string[];       // UI elements, e.g., ["Gmail", "VS Code"]
  hasAchievements?: boolean;
  hasBlockers?: boolean;
  minCuriosity?: number;     // 0-1
  since?: string;            // ISO 8601
  limit?: number;            // Default: 50
}
```

**Output**:
```typescript
{
  screenshots: SessionScreenshot[];
  count: number;
}
```

#### 3. search_session_audio

Search audio segments by transcription, phrases, or sentiment.

**Input**:
```typescript
{
  text?: string;                     // Search transcription
  phrases?: string[];                // Key phrases
  sentiment?: 'positive' | 'neutral' | 'negative';
  containsTask?: boolean;
  containsBlocker?: boolean;
  since?: string;                    // ISO 8601
  limit?: number;                    // Default: 50
}
```

#### 4. get_progress_indicators

Get aggregated achievements, blockers, and insights.

**Input**:
```typescript
{
  since?: string;  // ISO 8601 - only include progress after this time
}
```

**Output**:
```typescript
{
  achievements: string[];
  blockers: string[];
  insights: string[];
}
```

#### 5. get_recent_activity

Get recent timeline (screenshots + audio).

**Input**:
```typescript
{
  limit?: number;  // Default: 20
}
```

**Output**:
```typescript
TimelineItem[]  // Array of screenshots and audio segments
```

#### 6. create_task

Create task with complete metadata.

**Input**:
```typescript
{
  title: string;           // Required
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;        // YYYY-MM-DD
  dueTime?: string;        // HH:MM
  tags?: string[];
  topicId?: string;        // Use universal_search to find topics
  sessionId?: string;      // Auto-set for active session
}
```

**Output**:
```typescript
{
  task: Task;
  created: true;
}
```

#### 7. create_note

Create note with complete metadata.

**Input**:
```typescript
{
  content: string;         // Required (markdown)
  topicId?: string;
  tags?: string[];
  companyIds?: string[];
  contactIds?: string[];
  sessionId?: string;      // Auto-set for active session
}
```

**Output**:
```typescript
{
  note: Note;
  created: true;
}
```

#### 8. ask_user_question

Ask user a clarifying question (returns after user responds or timeout).

**Input**:
```typescript
{
  question: string;        // Required
  context?: string;        // Why asking
  suggestedAnswers?: string[];  // Quick-reply options (max 4)
  timeoutSeconds?: number;      // Default: 30
}
```

**Output**:
```typescript
{
  answer: string | null;
  timedOut: boolean;
}
```

### Tool Executor

```typescript
import { LiveSessionToolExecutor } from '@/services/liveSession';

// Create executor
const executor = new LiveSessionToolExecutor(activeSession);

// Execute tools
const results = await executor.executeTools([
  { id: '1', name: 'universal_search', input: { query: 'authentication' } },
  { id: '2', name: 'get_progress_indicators', input: {} }
]);

// Results have same order as input
results.forEach(result => {
  if (result.error) {
    console.error(`Tool ${result.tool_use_id} failed: ${result.error}`);
  } else {
    console.log(`Tool ${result.tool_use_id} result:`, result.content);
  }
});
```

---

## Event API

### Event Types

#### 1. screenshot-analyzed

Fired when screenshot captured and analyzed.

```typescript
{
  type: 'screenshot-analyzed';
  sessionId: string;
  screenshot: SessionScreenshot;
  timestamp: string;  // ISO 8601
}
```

**When to Update**: If `screenshot.aiAnalysis.curiosity > 0.7` or blockers detected.

#### 2. audio-processed

Fired when audio segment transcribed.

```typescript
{
  type: 'audio-processed';
  sessionId: string;
  audioSegment: SessionAudioSegment;
  timestamp: string;
}
```

**When to Update**: If `audioSegment.containsBlocker === true` or important phrases detected.

#### 3. context-changed

Fired when significant context changes (activity switch, focus change).

```typescript
{
  type: 'context-changed';
  sessionId: string;
  changeType: 'activity-switch' | 'focus-change' | 'blocker-detected' | 'achievement-detected';
  previousContext?: string;
  newContext?: string;
  timestamp: string;
}
```

**When to Update**: Always (this is a manually-emitted significance signal).

#### 4. summary-requested

Fired when user explicitly requests update.

```typescript
{
  type: 'summary-requested';
  sessionId: string;
  requestedBy: 'user' | 'system';
  timestamp: string;
}
```

**When to Update**: Always (user-requested has priority).

#### 5. user-question-answered

Fired when user responds to AI question.

```typescript
{
  type: 'user-question-answered';
  sessionId: string;
  questionId: string;
  question: string;
  answer: string;
  timestamp: string;
}
```

**When to Update**: Incorporate answer into next update.

#### 6. summary-updated

Fired when summary has been updated (UI can refresh).

```typescript
{
  type: 'summary-updated';
  sessionId: string;
  summary: any;
  updatedBy: 'ai' | 'user';
  timestamp: string;
}
```

### Subscribing to Events

```typescript
import { subscribeToLiveSessionEvents } from '@/services/liveSession';

// Subscribe to specific event
const unsubscribe = subscribeToLiveSessionEvents(
  'screenshot-analyzed',
  async (event) => {
    console.log(`New screenshot: ${event.screenshot.id}`);
    // Handle event...
  }
);

// Cleanup
unsubscribe();
```

```typescript
// Subscribe to all events (debugging)
import { subscribeToAllLiveSessionEvents } from '@/services/liveSession';

const unsubscribe = subscribeToAllLiveSessionEvents((event) => {
  console.log(`[Event] ${event.type}`, event);
});
```

---

## Context API

### Context Types

| Type | Size | Use Case | Contains |
|------|------|----------|----------|
| `summary` | 2-5 KB | Quick AI calls | Recent 10 screenshots, recent 10 audio, progress indicators |
| `full` | 50-200 KB | Deep analysis | ALL screenshots, ALL audio, related entities |
| `delta` | 1-10 KB | Incremental updates | Only new screenshots/audio since timestamp |

### Getting Context

```typescript
import { getSessionContext } from '@/services/liveSession';

// Summary context (lightweight)
const context = await getSessionContext(sessionId, 'summary');

// Full context (comprehensive)
const fullContext = await getSessionContext(sessionId, 'full');

// Delta context (what changed)
const delta = await getSessionContext(sessionId, 'delta', lastUpdateTime);
```

### Smart Context

Automatically chooses best context type:

```typescript
import { getSmartContext } from '@/services/liveSession';

const { contextType, context, sizeBytes } = await getSmartContext(
  sessionId,
  lastUpdateTime
);

console.log(`Using ${contextType} context (${sizeBytes} bytes)`);
```

### Estimating Size

```typescript
import { estimateContextSize } from '@/services/liveSession';

const summarySize = await estimateContextSize(sessionId, 'summary');
const fullSize = await estimateContextSize(sessionId, 'full');

if (fullSize > 100000) {
  // Use summary instead
  const context = await getSessionContext(sessionId, 'summary');
}
```

---

## Update API

### Update Summary

```typescript
import { updateLiveSessionSummary } from '@/services/liveSession';

await updateLiveSessionSummary(sessionId, {
  currentFocus: "Writing customer email about API integration",
  progressToday: ["Fixed auth bug", "Deployed to staging"],
  momentum: "high",
  blockers: ["Waiting on API key from customer"],
  suggestedTasks: [{
    title: "Follow up with customer for API key",
    priority: "high",
    context: "Blocker detected at 14:32"
  }]
});
```

### Append Progress Indicators

Add achievements/blockers without replacing existing:

```typescript
import { appendProgressIndicators } from '@/services/liveSession';

await appendProgressIndicators(sessionId, 'achievements', [
  "Completed login flow",
  "Fixed API timeout bug"
]);

await appendProgressIndicators(sessionId, 'blockers', [
  "Waiting on API key"
]);
```

### Create Tasks from Suggestions

```typescript
import { createTaskFromSuggestion, batchCreateTasksFromSuggestions } from '@/services/liveSession';

// Single task
const task = await createTaskFromSuggestion({
  title: "Fix authentication timeout",
  description: "User reported 30s timeout during login",
  priority: "high",
  tags: ["backend", "urgent"],
  topicId: "topic-auth-123"
}, sessionId);

// Batch create
const tasks = await batchCreateTasksFromSuggestions([
  { title: "Fix bug 1", priority: "high" },
  { title: "Fix bug 2", priority: "medium" }
], sessionId);
```

### Create Notes from Suggestions

```typescript
import { createNoteFromSuggestion } from '@/services/liveSession';

const note = await createNoteFromSuggestion({
  content: "## Meeting Notes\n\nDiscussed API integration strategy...",
  topicId: "topic-api-123",
  tags: ["meeting", "planning"]
}, sessionId);
```

---

## Complete Integration Example

```typescript
import {
  getLiveSessionTools,
  subscribeToLiveSessionEvents,
  getSessionContext,
  updateLiveSessionSummary,
  createTaskFromSuggestion
} from '@/services/liveSession';

// Track last update time per session
const lastUpdateTimes = new Map<string, string>();

// 1. Listen for screenshot events
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  const { sessionId, screenshot } = event;

  // Check if significant enough to update
  const curiosity = screenshot.aiAnalysis?.curiosity || 0;
  const hasBlockers = screenshot.aiAnalysis?.progressIndicators?.blockers?.length > 0;

  if (curiosity > 0.7 || hasBlockers) {
    await handleSignificantChange(sessionId);
  }
});

// 2. Listen for user requests
subscribeToLiveSessionEvents('summary-requested', async (event) => {
  await handleSignificantChange(event.sessionId);
});

// 3. Handle significant changes
async function handleSignificantChange(sessionId: string) {
  // Get context (use delta if we have previous update)
  const lastUpdate = lastUpdateTimes.get(sessionId);
  const context = lastUpdate
    ? await getSessionContext(sessionId, 'delta', lastUpdate)
    : await getSessionContext(sessionId, 'summary');

  // Get tools for AI
  const { schemas, executor } = getLiveSessionTools();

  // Call your AI service
  const aiResponse = await yourAIService.generateUpdate({
    context,
    tools: schemas,
    messages: [
      {
        role: 'user',
        content: `Analyze this session update and provide:
1. Current focus (what user is doing RIGHT NOW)
2. Progress today (achievements so far)
3. Momentum (high/medium/low)
4. Any blockers
5. Suggested tasks (if blockers detected)`
      }
    ]
  });

  // Execute any tool calls from AI
  if (aiResponse.tool_calls) {
    const results = await executor.executeTools(aiResponse.tool_calls);

    // Continue conversation with tool results...
    const finalResponse = await yourAIService.continueConversation({
      previousResponse: aiResponse,
      toolResults: results
    });

    // Parse final response...
  }

  // Update summary
  await updateLiveSessionSummary(sessionId, {
    currentFocus: aiResponse.currentFocus,
    progressToday: aiResponse.progressToday,
    momentum: aiResponse.momentum,
    blockers: aiResponse.blockers
  });

  // Create suggested tasks
  if (aiResponse.suggestedTasks) {
    for (const taskSuggestion of aiResponse.suggestedTasks) {
      await createTaskFromSuggestion(taskSuggestion, sessionId);
    }
  }

  // Update last update time
  lastUpdateTimes.set(sessionId, new Date().toISOString());
}

// 4. Cleanup on unmount
export function cleanup() {
  // Unsubscribe from all events
  subscribeToLiveSessionEvents('screenshot-analyzed', () => {})();
  subscribeToLiveSessionEvents('summary-requested', () => {})();
}
```

---

## Best Practices

### 1. Use Delta Context for Frequent Updates

```typescript
// ✅ GOOD: Delta context (1-10 KB)
const delta = await getSessionContext(sessionId, 'delta', lastUpdateTime);

// ❌ BAD: Full context every time (50-200 KB)
const full = await getSessionContext(sessionId, 'full');
```

### 2. Filter Events by Significance

```typescript
// ✅ GOOD: Only update on significant changes
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  if (event.screenshot.aiAnalysis?.curiosity > 0.7) {
    await handleUpdate(event.sessionId);
  }
});

// ❌ BAD: Update on every screenshot
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  await handleUpdate(event.sessionId);
});
```

### 3. Batch Tool Calls

```typescript
// ✅ GOOD: Execute all tools in one call
const results = await executor.executeTools([
  { id: '1', name: 'universal_search', input: {...} },
  { id: '2', name: 'get_progress_indicators', input: {} }
]);

// ❌ BAD: Execute tools one at a time
const result1 = await executor.executeTools([{ id: '1', name: 'universal_search', input: {...} }]);
const result2 = await executor.executeTools([{ id: '2', name: 'get_progress_indicators', input: {} }]);
```

### 4. Handle Errors Gracefully

```typescript
try {
  await updateLiveSessionSummary(sessionId, updates);
} catch (error) {
  console.error(`[LiveSession] Failed to update summary:`, error);
  // Don't throw - log and continue
}
```

### 5. Unsubscribe from Events

```typescript
useEffect(() => {
  const unsubscribe = subscribeToLiveSessionEvents('screenshot-analyzed', handler);

  return () => {
    unsubscribe();  // ← Always cleanup
  };
}, []);
```

---

## Integration Checklist

- [ ] Subscribe to events (`screenshot-analyzed`, `summary-requested`)
- [ ] Implement significance filtering (curiosity > 0.7, blockers, etc.)
- [ ] Get session context (use `delta` for frequent updates)
- [ ] Call your AI service with context + tools
- [ ] Execute tool calls from AI
- [ ] Update summary via `updateLiveSessionSummary()`
- [ ] Create tasks/notes from suggestions
- [ ] Handle errors gracefully
- [ ] Unsubscribe from events on cleanup

---

## Next Steps

1. **Wire Event Emission**: Add `LiveSessionEventEmitter.emitScreenshotAnalyzed()` after screenshot analysis
2. **Test Integration**: Use the complete example above to integrate your AI
3. **Monitor Performance**: Track context sizes, update frequency, API costs
4. **Iterate**: Refine significance thresholds based on user feedback
