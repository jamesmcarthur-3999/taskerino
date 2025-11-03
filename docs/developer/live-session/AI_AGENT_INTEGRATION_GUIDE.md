# AI Agent Integration Guide

**Last Updated**: November 2025
**Target Audience**: Developers building AI agents for Live Session Intelligence
**Prerequisites**: TypeScript, React, Event-driven architecture basics

This guide shows you how to build an AI agent that integrates with Taskerino's Live Session Intelligence system. You'll learn how to subscribe to events, query session data, generate suggestions, and update the UI - all without modifying the core infrastructure.

---

## Table of Contents

1. [Quick Start (15 minutes)](#quick-start-15-minutes)
2. [Architecture Overview](#architecture-overview)
3. [Event Subscription](#event-subscription)
4. [Context Retrieval](#context-retrieval)
5. [Tool Execution (Optional)](#tool-execution-optional)
6. [Generating Suggestions](#generating-suggestions)
7. [Asking Questions](#asking-questions)
8. [Complete Example Agent](#complete-example-agent)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start (15 minutes)

### Step 1: Create Your AI Service File

Create `/src/services/myLiveSessionAgent.ts`:

```typescript
import { subscribeToLiveSessionEvents } from '@/services/liveSession/events';
import { getSessionContext } from '@/services/liveSession/contextApi';
import { updateLiveSessionSummary } from '@/services/liveSession/updateApi';

class MyLiveSessionAgent {
  private sessionId: string | null = null;

  start(sessionId: string) {
    this.sessionId = sessionId;
    console.log('[MyAgent] Starting for session:', sessionId);

    // Subscribe to screenshot analysis events
    subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
      if (event.sessionId === sessionId) {
        await this.handleScreenshotAnalyzed(event);
      }
    });
  }

  private async handleScreenshotAnalyzed(event: any) {
    // Get session context
    const context = await getSessionContext(this.sessionId!, 'summary');

    // Call your AI (Claude, GPT-4, etc.)
    const suggestions = await this.callYourAI(context);

    // Update summary with suggestions
    await updateLiveSessionSummary(this.sessionId!, {
      suggestedTasks: suggestions.tasks,
      suggestedNotes: suggestions.notes,
      currentFocus: suggestions.currentFocus,
      momentum: suggestions.momentum
    });
  }

  private async callYourAI(context: any) {
    // TODO: Call your AI service here
    // Return: { tasks, notes, currentFocus, momentum }
    return {
      tasks: [],
      notes: [],
      currentFocus: 'Working on implementation',
      momentum: 'medium' as const
    };
  }
}

export const myLiveSessionAgent = new MyLiveSessionAgent();
```

### Step 2: Start the Agent

In your `ActiveSessionContext.tsx` or `SessionsZone.tsx`, start the agent when a session begins:

```typescript
import { myLiveSessionAgent } from '@/services/myLiveSessionAgent';

// When session starts
function handleSessionStart(sessionId: string) {
  myLiveSessionAgent.start(sessionId);
}
```

### Step 3: Test It

1. Start a session
2. Take a screenshot
3. Check console logs for `[MyAgent] Starting for session:`
4. Verify agent is receiving `screenshot-analyzed` events

**Congratulations!** You now have a working AI agent skeleton. Now let's make it intelligent.

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│          Your AI Agent (This Guide)                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  1. Subscribe to Events                           │  │
│  │  2. Get Session Context (when triggered)          │  │
│  │  3. Call Your AI Model (Claude, GPT-4, etc.)      │  │
│  │  4. Generate Suggestions (tasks, notes, etc.)     │  │
│  │  5. Update Summary (emit events)                  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
            ▲                           │
            │ Events In                 │ Updates Out
            │                           ▼
┌─────────────────────────────────────────────────────────┐
│  Live Session Infrastructure (Built-In)                 │
│  - Events: screenshot-analyzed, audio-processed, etc.   │
│  - Context API: getSessionContext() for data access     │
│  - Update API: updateLiveSessionSummary() for updates   │
│  - Tools (optional): Search, query, create entities     │
└─────────────────────────────────────────────────────────┘
            ▲                           │
            │ Display                   │ User Actions
            │                           ▼
┌─────────────────────────────────────────────────────────┐
│  UI Components (Built-In)                               │
│  - LiveIntelligencePanel: Main display                  │
│  - TaskSuggestionCard: One-click task creation          │
│  - NoteSuggestionCard: One-click note creation          │
│  - AIQuestionBar: Interactive Q&A                       │
│  - BlockersPanel, AchievementsPanel, etc.               │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Action** → Screenshot captured, audio transcribed
2. **Event Emitted** → `screenshot-analyzed`, `audio-processed`
3. **Your Agent** → Receives event, decides if update needed
4. **Context Query** → Calls `getSessionContext()` to get data
5. **AI Processing** → Your AI analyzes context, generates suggestions
6. **Update Summary** → Calls `updateLiveSessionSummary()`
7. **Event Emitted** → `summary-updated`
8. **UI Updates** → Components receive event and re-render

---

## Event Subscription

### Available Events

```typescript
import { subscribeToLiveSessionEvents } from '@/services/liveSession/events';

// 1. Screenshot analyzed (every 30-180s during session)
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  console.log('Screenshot:', event.screenshot.id);
  console.log('Analysis:', event.screenshot.aiAnalysis);
  // Use: Detect activity changes, blockers, achievements
});

// 2. Audio processed (every 5-10s during session)
subscribeToLiveSessionEvents('audio-processed', async (event) => {
  console.log('Audio segment:', event.audioSegment.transcription);
  // Use: Detect conversations, voice commands, context
});

// 3. Context changed (triggered by AI or system)
subscribeToLiveSessionEvents('context-changed', async (event) => {
  console.log('Change type:', event.changeType);
  console.log('Before:', event.previousContext);
  console.log('After:', event.newContext);
  // Use: React to focus changes, blocker detection, etc.
});

// 4. Summary requested (user clicked "Refresh" button)
subscribeToLiveSessionEvents('summary-requested', async (event) => {
  console.log('Reason:', event.reason); // 'user' or 'system'
  // Use: Force immediate summary regeneration
});

// 5. User answered question (from AIQuestionBar)
subscribeToLiveSessionEvents('user-question-answered', async (event) => {
  console.log('Question:', event.question);
  console.log('Answer:', event.answer);
  // Use: Incorporate user feedback into summary
});

// 6. Summary updated (your agent or another agent)
subscribeToLiveSessionEvents('summary-updated', async (event) => {
  console.log('Updated by:', event.updatedBy); // 'ai' or 'user'
  console.log('New summary:', event.summary);
  // Use: Track summary changes, avoid loops
});
```

### Event Filtering (Prevent Noise)

**Problem**: Too many events can overwhelm your AI and waste tokens.

**Solution**: Filter by significance.

```typescript
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  const { aiAnalysis } = event.screenshot;

  // Filter 1: Check curiosity score (>0.7 = interesting)
  if (aiAnalysis.curiosity < 0.7) {
    console.log('Low curiosity, skipping');
    return;
  }

  // Filter 2: Check for blockers
  const hasBlockers = aiAnalysis.progressIndicators?.blockers?.length > 0;

  // Filter 3: Check for activity change
  const activityChanged = aiAnalysis.detectedActivity !== lastActivity;

  // Only process if significant
  if (aiAnalysis.curiosity > 0.7 || hasBlockers || activityChanged) {
    await processScreenshot(event);
  }
});
```

### Unsubscribing (Important!)

Always unsubscribe when session ends or component unmounts:

```typescript
class MyAgent {
  private unsubscribers: Array<() => void> = [];

  start(sessionId: string) {
    // Subscribe and store unsubscribe function
    const unsubScreenshot = subscribeToLiveSessionEvents(
      'screenshot-analyzed',
      this.handleScreenshot
    );
    this.unsubscribers.push(unsubScreenshot);

    const unsubAudio = subscribeToLiveSessionEvents(
      'audio-processed',
      this.handleAudio
    );
    this.unsubscribers.push(unsubAudio);
  }

  stop() {
    // Unsubscribe from all events
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }
}
```

---

## Context Retrieval

### Three Context Types

**1. Summary Context (2-5 KB)** - Lightweight, for frequent updates

```typescript
import { getSessionContext } from '@/services/liveSession/contextApi';

const context = await getSessionContext(sessionId, 'summary');
// Returns: { session, currentSummary, recentScreenshots, recentAudio, progressIndicators }
```

**When to use**: Every screenshot/audio event, quick checks

**2. Full Context (50-200 KB)** - Comprehensive, for deep analysis

```typescript
const context = await getSessionContext(sessionId, 'full');
// Returns: { session, summary, allScreenshots, allAudio, relatedNotes, relatedTasks }
```

**When to use**: Manual refresh, end-of-session summary, complex queries

**3. Delta Context (1-10 KB)** - What changed since last update

```typescript
const context = await getSessionContext(sessionId, 'delta', lastUpdateTime);
// Returns: { newScreenshots, newAudio, since, changeCount }
```

**When to use**: Incremental updates, avoiding redundant processing

### Smart Context Selection

```typescript
import { getSmartContext } from '@/services/liveSession/contextApi';

// Automatically chooses best context type
const { contextType, context, sizeBytes } = await getSmartContext(
  sessionId,
  lastUpdateTime
);

console.log(`Using ${contextType} context (${sizeBytes} bytes)`);
// contextType: 'summary' | 'full' | 'delta'
```

### Context Structure

```typescript
// Summary Context Example
{
  session: {
    id: 'session-123',
    name: 'Working on authentication',
    status: 'active',
    startTime: '2025-11-02T10:30:00Z',
    duration: 3600 // seconds
  },
  currentSummary: {
    liveSnapshot: {
      currentFocus: 'Fixing login timeout bug',
      progressToday: ['Set up OAuth', 'Fixed 2 bugs'],
      momentum: 'high'
    },
    achievements: ['Completed login flow'],
    blockers: ['Waiting on API key']
  },
  recentScreenshots: [
    {
      id: 'screenshot-1',
      timestamp: '2025-11-02T10:35:00Z',
      aiAnalysis: {
        summary: 'VS Code with authentication code',
        detectedActivity: 'coding',
        curiosity: 0.85
      }
    }
  ],
  recentAudio: [
    {
      id: 'audio-1',
      transcription: 'Okay, let me try this fix...',
      timestamp: '2025-11-02T10:35:30Z'
    }
  ],
  progressIndicators: {
    achievements: ['Fixed timeout bug'],
    blockers: [],
    insights: ['User prefers OAuth over basic auth']
  }
}
```

---

## Tool Execution (Optional)

Tools allow your AI to query session data dynamically. **Note**: Most agents don't need tools - context API is usually sufficient.

### Available Tools

```typescript
import { getLiveSessionTools } from '@/services/liveSession';

const { schemas, executor } = getLiveSessionTools(activeSession);

// Pass schemas to your AI
const aiResponse = await yourAI.chat({
  messages: [...],
  tools: schemas // AI can call these tools
});

// Execute tool calls
if (aiResponse.tool_calls) {
  const results = await executor.executeTools(aiResponse.tool_calls);
  // results: Array<{ tool_use_id, content }>
}
```

### Tool Examples

**1. universal_search** - Search across entities

```typescript
{
  name: 'universal_search',
  input: {
    query: 'authentication',
    entityTypes: ['sessions', 'notes', 'tasks'],
    filters: { status: 'in_progress' }
  }
}
// Returns: { results: { sessions, notes, tasks }, counts, took }
```

**2. get_progress_indicators** - Get achievements/blockers

```typescript
{
  name: 'get_progress_indicators',
  input: {}
}
// Returns: { achievements, blockers, insights }
```

**3. create_task** - Create task from suggestion

```typescript
{
  name: 'create_task',
  input: {
    title: 'Fix authentication timeout',
    priority: 'high',
    topicId: 'topic-auth-123'
  }
}
// Returns: { task: { id, title, ... } }
```

---

## Generating Suggestions

### Task Suggestions

```typescript
import { updateLiveSessionSummary } from '@/services/liveSession/updateApi';

// Generate task suggestions
const taskSuggestions = [
  {
    title: 'Fix authentication timeout',
    description: 'User reported 30s timeout during login',
    priority: 'high' as const,
    context: 'Detected blocker in screenshot at 14:32',
    confidence: 0.85,
    relevance: 0.90,
    tags: ['backend', 'urgent'],
    topicId: 'topic-auth-123'
  },
  {
    title: 'Add unit tests for OAuth flow',
    priority: 'medium' as const,
    context: 'Test coverage gap detected',
    confidence: 0.70,
    relevance: 0.75
  }
];

// Update summary
await updateLiveSessionSummary(sessionId, {
  suggestedTasks: taskSuggestions
});
```

### Note Suggestions

```typescript
// Generate note suggestions
const noteSuggestions = [
  {
    content: '## Meeting Notes\n\nDiscussed OAuth implementation...',
    context: 'Detected conversation about OAuth in audio',
    confidence: 0.80,
    relevance: 0.85,
    tags: ['meeting', 'authentication'],
    topicIds: ['topic-auth-123']
  }
];

// Update summary
await updateLiveSessionSummary(sessionId, {
  suggestedNotes: noteSuggestions
});
```

### Updating Live Snapshot

```typescript
// Update current focus, progress, momentum
await updateLiveSessionSummary(sessionId, {
  currentFocus: 'Debugging authentication flow',
  progressToday: [
    'Fixed login timeout',
    'Added OAuth support',
    'Deployed to staging'
  ],
  momentum: 'high'
});
```

### Appending Progress Indicators

```typescript
import { appendProgressIndicators } from '@/services/liveSession/updateApi';

// Add achievements without replacing existing
await appendProgressIndicators(sessionId, 'achievements', [
  'Completed login flow',
  'Fixed API timeout bug'
]);

// Add blockers
await appendProgressIndicators(sessionId, 'blockers', [
  'Waiting on API key from customer'
]);

// Add insights
await appendProgressIndicators(sessionId, 'insights', [
  'User prefers OAuth over basic auth'
]);
```

---

## Asking Questions

### When to Ask Questions

Your AI should ask questions when:
- Uncertain about user's intention (confidence < 0.6)
- Multiple valid interpretations exist
- Need clarification on focus/priority
- Detect ambiguous activity

### How to Ask Questions

```typescript
// Emit custom event for AIQuestionBar
window.dispatchEvent(new CustomEvent('ai-question-asked', {
  detail: {
    questionId: `question-${Date.now()}`,
    question: 'Are you working on the login feature or user profile?',
    context: 'Detected both login and profile code in screenshots',
    suggestedAnswers: ['Login feature', 'User profile', 'Both'],
    timeoutSeconds: 20
  }
}));

// Subscribe to answer
subscribeToLiveSessionEvents('user-question-answered', async (event) => {
  if (event.questionId === yourQuestionId) {
    console.log('User answered:', event.answer);
    // Incorporate answer into summary
    await updateSummaryWithAnswer(event.answer);
  }
});
```

### Example: Asking About Focus

```typescript
async function maybeAskAboutFocus(context: any) {
  const activities = detectActivities(context.recentScreenshots);

  // If multiple activities detected, ask user
  if (activities.length > 1) {
    window.dispatchEvent(new CustomEvent('ai-question-asked', {
      detail: {
        questionId: `focus-${Date.now()}`,
        question: `You seem to be working on multiple things. What should I focus on?`,
        context: `Detected: ${activities.join(', ')}`,
        suggestedAnswers: activities.slice(0, 3),
        timeoutSeconds: 15
      }
    }));
  }
}
```

---

## Complete Example Agent

See [`EXAMPLE_AI_AGENT.ts`](./examples/EXAMPLE_AI_AGENT.ts) for a fully working implementation (250 lines).

**Preview**:

```typescript
import { subscribeToLiveSessionEvents } from '@/services/liveSession/events';
import { getSessionContext } from '@/services/liveSession/contextApi';
import { updateLiveSessionSummary } from '@/services/liveSession/updateApi';

class CompleteLiveSessionAgent {
  private sessionId: string | null = null;
  private lastUpdateTime: string | null = null;
  private unsubscribers: Array<() => void> = [];

  start(sessionId: string) {
    this.sessionId = sessionId;
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // Screenshot analysis
    this.unsubscribers.push(
      subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
        if (this.shouldProcess(event)) {
          await this.processScreenshot(event);
        }
      })
    );

    // Manual refresh
    this.unsubscribers.push(
      subscribeToLiveSessionEvents('summary-requested', async (event) => {
        await this.regenerateSummary();
      })
    );

    // User answers
    this.unsubscribers.push(
      subscribeToLiveSessionEvents('user-question-answered', async (event) => {
        await this.incorporateAnswer(event);
      })
    );
  }

  private shouldProcess(event: any): boolean {
    const { curiosity } = event.screenshot.aiAnalysis;
    const hasBlockers = event.screenshot.aiAnalysis.progressIndicators?.blockers?.length > 0;
    return curiosity > 0.7 || hasBlockers;
  }

  private async processScreenshot(event: any) {
    // Get context (delta if available, summary otherwise)
    const context = await getSessionContext(
      this.sessionId!,
      this.lastUpdateTime ? 'delta' : 'summary',
      this.lastUpdateTime
    );

    // Call your AI
    const analysis = await this.callYourAI(context);

    // Update summary
    await updateLiveSessionSummary(this.sessionId!, {
      currentFocus: analysis.currentFocus,
      progressToday: analysis.progressToday,
      momentum: analysis.momentum,
      suggestedTasks: analysis.tasks,
      suggestedNotes: analysis.notes
    });

    this.lastUpdateTime = new Date().toISOString();
  }

  private async callYourAI(context: any) {
    // TODO: Implement your AI call
    return {
      currentFocus: 'Working on implementation',
      progressToday: [],
      momentum: 'medium' as const,
      tasks: [],
      notes: []
    };
  }

  stop() {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }
}
```

---

## Best Practices

### ✅ DO

1. **Filter events by significance** - Don't process every screenshot
2. **Use delta context** - Avoid redundant processing
3. **Unsubscribe on stop** - Prevent memory leaks
4. **Handle errors gracefully** - Wrap AI calls in try/catch
5. **Provide context** - Explain why you're suggesting tasks/notes
6. **Set confidence scores** - Help users trust suggestions
7. **Ask questions** - When uncertain, clarify with user
8. **Track last update time** - Enable delta context

### ❌ DON'T

1. **Don't process every event** - Token costs add up
2. **Don't use full context always** - Use summary/delta
3. **Don't update on every event** - Batch updates (every 2-3 screenshots)
4. **Don't forget to unsubscribe** - Memory leaks!
5. **Don't ignore errors** - Log and handle failures
6. **Don't hardcode thresholds** - Make configurable
7. **Don't create duplicate suggestions** - Check existing
8. **Don't block UI thread** - Keep processing async

---

## Troubleshooting

### Agent not receiving events

**Check**:
1. Event emitters are called in SessionsZone/RecordingContext
2. Session ID matches (`event.sessionId === yourSessionId`)
3. Subscription happened before events fired

**Fix**:
```typescript
// Subscribe immediately after session starts
subscribeToLiveSessionEvents('screenshot-analyzed', handler);
```

### Context API returns empty data

**Check**:
1. Session exists and is active
2. Screenshots/audio have been captured
3. Correct session ID passed

**Fix**:
```typescript
const context = await getSessionContext(sessionId, 'summary');
if (!context.session) {
  console.error('Session not found:', sessionId);
}
```

### Suggestions not appearing in UI

**Check**:
1. `suggestedTasks`/`suggestedNotes` arrays are populated
2. `updateLiveSessionSummary()` was called successfully
3. `LiveIntelligencePanel` is rendered in ActiveSessionView

**Fix**:
```typescript
// Verify update succeeded
await updateLiveSessionSummary(sessionId, { suggestedTasks });
console.log('Updated summary with', suggestedTasks.length, 'tasks');
```

### AI costs too high

**Solutions**:
1. Increase significance threshold (curiosity > 0.8)
2. Use delta context instead of full
3. Batch updates (every 3-5 screenshots)
4. Cache AI responses (same context → same response)
5. Use cheaper model for routine updates (Haiku vs Sonnet)

---

## Next Steps

1. **Read**: [AI_DATA_CONTRACTS.md](./AI_DATA_CONTRACTS.md) - TypeScript interfaces
2. **Read**: [AI_EVENT_REFERENCE.md](./AI_EVENT_REFERENCE.md) - Event catalog
3. **Read**: [AI_TOOL_COOKBOOK.md](./AI_TOOL_COOKBOOK.md) - Recipe-style examples
4. **Build**: Use [EXAMPLE_AI_AGENT.ts](./examples/EXAMPLE_AI_AGENT.ts) as template
5. **Test**: Start session, verify events, check UI updates
6. **Iterate**: Refine thresholds, prompts, and filters

---

## Questions?

- **Infrastructure API**: `/docs/developer/LIVE_SESSION_API.md`
- **Integration Guide**: `/docs/developer/LIVE_SESSION_INTEGRATION_GUIDE.md`
- **Example Code**: `/docs/developer/live-session/examples/`

**Happy building!** 🚀
