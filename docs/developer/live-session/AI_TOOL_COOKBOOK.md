# AI Tool Cookbook - Recipe-Style Examples

**Last Updated**: November 2025

Quick copy-paste recipes for common AI agent operations with Live Session Intelligence.

---

## Table of Contents

1. [Searching & Querying](#searching--querying)
2. [Creating Suggestions](#creating-suggestions)
3. [Updating Summaries](#updating-summaries)
4. [Asking Questions](#asking-questions)
5. [Event Handling](#event-handling)
6. [Context Strategies](#context-strategies)
7. [Common Patterns](#common-patterns)
8. [Anti-Patterns](#anti-patterns)

---

## Searching & Querying

### Recipe: Find All Tasks Related to a Topic

```typescript
import { executeToolCall } from '@/services/liveSession/toolExecutor';

async function findTasksForTopic(topicId: string) {
  const result = await executeToolCall({
    id: 'tool-1',
    name: 'universal_search',
    input: {
      entityTypes: ['tasks'],
      relatedTo: {
        entityType: 'topic',
        entityId: topicId
      },
      sortBy: 'priority',
      sortOrder: 'desc'
    }
  });

  const tasks = JSON.parse(result.content);
  return tasks;
}

// Usage
const authTasks = await findTasksForTopic('topic-auth-123');
console.log(`Found ${authTasks.length} tasks related to authentication`);
```

### Recipe: Search Notes by Keyword

```typescript
async function searchNotesByKeyword(keyword: string) {
  const result = await executeToolCall({
    id: 'tool-2',
    name: 'universal_search',
    input: {
      query: keyword,
      entityTypes: ['notes'],
      sortBy: 'date',
      sortOrder: 'desc',
      limit: 20
    }
  });

  return JSON.parse(result.content);
}

// Usage
const oauthNotes = await searchNotesByKeyword('OAuth implementation');
```

### Recipe: Find High-Priority Incomplete Tasks

```typescript
async function getHighPriorityTasks() {
  const result = await executeToolCall({
    id: 'tool-3',
    name: 'universal_search',
    input: {
      entityTypes: ['tasks'],
      filters: {
        status: 'todo',
        priority: 'high'
      },
      sortBy: 'priority',
      limit: 10
    }
  });

  return JSON.parse(result.content);
}
```

### Recipe: Get All Sessions from Today

```typescript
async function getTodaySessions() {
  const today = new Date().toISOString().split('T')[0];

  const result = await executeToolCall({
    id: 'tool-4',
    name: 'universal_search',
    input: {
      entityTypes: ['sessions'],
      filters: {
        dateRange: {
          start: today,
          end: today
        }
      },
      sortBy: 'date',
      sortOrder: 'desc'
    }
  });

  return JSON.parse(result.content);
}
```

---

## Creating Suggestions

### Recipe: Suggest a Task Based on Screenshot Analysis

```typescript
import { updateLiveSessionSummary } from '@/services/liveSession/updateApi';
import type { TaskSuggestion } from '@/services/liveSession/toolExecutor';

async function suggestTaskFromScreenshot(
  sessionId: string,
  screenshotAnalysis: any
) {
  const taskSuggestion: TaskSuggestion = {
    title: "Fix authentication timeout issue",
    description: "User reported 30s timeout during login flow",
    priority: "high",
    context: `Detected error screen in screenshot at ${screenshotAnalysis.timestamp}`,
    confidence: 0.85,
    relevance: 0.90,
    tags: ["backend", "urgent", "authentication"],
    topicId: "topic-auth-123"
  };

  await updateLiveSessionSummary(sessionId, {
    suggestedTasks: [taskSuggestion]
  });

  console.log('[Agent] Suggested task:', taskSuggestion.title);
}
```

### Recipe: Suggest a Note from Audio Transcription

```typescript
import type { NoteSuggestion } from '@/services/liveSession/toolExecutor';

async function suggestNoteFromAudio(
  sessionId: string,
  transcription: string
) {
  const noteSuggestion: NoteSuggestion = {
    content: `## Meeting Notes\n\n${transcription}\n\n**Key Points:**\n- Discussed OAuth implementation\n- Decided on JWT tokens\n- Next: Set up auth server`,
    context: "Detected conversation about OAuth in audio",
    confidence: 0.80,
    relevance: 0.85,
    tags: ["meeting", "authentication", "oauth"],
    topicIds: ["topic-auth-123"]
  };

  await updateLiveSessionSummary(sessionId, {
    suggestedNotes: [noteSuggestion]
  });
}
```

### Recipe: Suggest Multiple Tasks at Once

```typescript
async function suggestMultipleTasks(sessionId: string) {
  const suggestions: TaskSuggestion[] = [
    {
      title: "Add unit tests for OAuth",
      priority: "medium",
      context: "Test coverage gap detected in screenshot",
      confidence: 0.75,
      tags: ["testing"]
    },
    {
      title: "Update OAuth documentation",
      priority: "low",
      context: "Documentation outdated based on code changes",
      confidence: 0.70,
      tags: ["docs"]
    }
  ];

  await updateLiveSessionSummary(sessionId, {
    suggestedTasks: suggestions
  });
}
```

### Recipe: Suggest Task with Due Date

```typescript
async function suggestUrgentTask(sessionId: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const taskSuggestion: TaskSuggestion = {
    title: "Deploy auth fix to production",
    description: "Critical timeout bug affecting 20% of users",
    priority: "urgent",
    context: "Production issue detected in error logs",
    confidence: 0.95,
    relevance: 1.0,
    dueDate: tomorrow.toISOString().split('T')[0],
    dueTime: "09:00",
    tags: ["production", "critical"]
  };

  await updateLiveSessionSummary(sessionId, {
    suggestedTasks: [taskSuggestion]
  });
}
```

---

## Updating Summaries

### Recipe: Update Current Focus

```typescript
import { updateLiveSessionSummary } from '@/services/liveSession/updateApi';

async function updateCurrentFocus(
  sessionId: string,
  newFocus: string
) {
  await updateLiveSessionSummary(sessionId, {
    currentFocus: newFocus
  });

  console.log('[Agent] Updated focus:', newFocus);
}

// Usage
await updateCurrentFocus('session-123', 'Debugging authentication flow');
```

### Recipe: Add Progress Update

```typescript
async function addProgressUpdate(
  sessionId: string,
  progressItem: string
) {
  const context = await getSessionContext(sessionId, 'summary');
  const currentProgress = context.currentSummary.liveSnapshot?.progressToday || [];

  await updateLiveSessionSummary(sessionId, {
    progressToday: [...currentProgress, progressItem]
  });
}

// Usage
await addProgressUpdate('session-123', 'Fixed login timeout bug');
```

### Recipe: Update Momentum

```typescript
async function updateMomentum(
  sessionId: string,
  momentum: 'high' | 'medium' | 'low'
) {
  await updateLiveSessionSummary(sessionId, {
    momentum
  });

  console.log('[Agent] Momentum updated to:', momentum);
}

// Usage - detect from screenshot frequency
const recentScreenshots = await getRecentScreenshots(sessionId);
const momentum = recentScreenshots.length > 10 ? 'high' : 'medium';
await updateMomentum(sessionId, momentum);
```

### Recipe: Add Achievement

```typescript
async function addAchievement(
  sessionId: string,
  achievement: string
) {
  const context = await getSessionContext(sessionId, 'summary');
  const currentAchievements = context.currentSummary.achievements || [];

  await updateLiveSessionSummary(sessionId, {
    achievements: [...currentAchievements, achievement]
  });

  // Emit context-changed event for celebration
  LiveSessionEventEmitter.emitContextChanged(
    sessionId,
    'achievement-detected',
    null,
    null,
    { achievement }
  );
}
```

### Recipe: Add Blocker

```typescript
async function addBlocker(
  sessionId: string,
  blocker: string
) {
  const context = await getSessionContext(sessionId, 'summary');
  const currentBlockers = context.currentSummary.blockers || [];

  await updateLiveSessionSummary(sessionId, {
    blockers: [...currentBlockers, blocker]
  });

  // Emit context-changed event
  LiveSessionEventEmitter.emitContextChanged(
    sessionId,
    'blocker-detected',
    null,
    null,
    { blocker }
  );
}
```

### Recipe: Complete Summary Update

```typescript
async function updateCompleteSummary(sessionId: string) {
  await updateLiveSessionSummary(sessionId, {
    currentFocus: "Debugging authentication flow",
    progressToday: [
      "Fixed login timeout",
      "Added OAuth support",
      "Deployed to staging"
    ],
    momentum: "high",
    achievements: ["Resolved critical auth bug"],
    blockers: [],
    suggestedTasks: [
      {
        title: "Add unit tests for OAuth",
        priority: "medium",
        context: "Test coverage gap detected",
        confidence: 0.75
      }
    ],
    suggestedNotes: [
      {
        content: "## OAuth Implementation\n\nSuccessfully integrated...",
        context: "Detected OAuth work in screenshots",
        confidence: 0.85
      }
    ]
  });
}
```

---

## Asking Questions

### Recipe: Ask Simple Question with Quick Replies

```typescript
async function askForCurrentFocus(sessionId: string) {
  window.dispatchEvent(new CustomEvent('ai-question-asked', {
    detail: {
      questionId: `q-${Date.now()}`,
      question: "What are you working on right now?",
      context: "I see multiple windows open - help me understand your focus",
      suggestedAnswers: [
        "Authentication",
        "User profile",
        "API integration",
        "Bug fixes"
      ],
      timeoutSeconds: 20
    }
  }));

  // Listen for answer
  const unsubscribe = subscribeToLiveSessionEvents('user-question-answered', (event) => {
    if (event.sessionId === sessionId) {
      console.log('[Agent] User answered:', event.answer);

      if (event.answer === null) {
        console.log('[Agent] Question timed out, using default');
      } else {
        // Update focus based on answer
        updateLiveSessionSummary(sessionId, {
          currentFocus: event.answer
        });
      }

      unsubscribe();
    }
  });
}
```

### Recipe: Ask Clarifying Question

```typescript
async function askClarification(sessionId: string, context: string) {
  const questionId = `q-clarify-${Date.now()}`;

  window.dispatchEvent(new CustomEvent('ai-question-asked', {
    detail: {
      questionId,
      question: "Is this related to the ongoing authentication work?",
      context,
      suggestedAnswers: ["Yes", "No", "Related but separate"],
      timeoutSeconds: 15
    }
  }));

  return new Promise((resolve) => {
    const unsubscribe = subscribeToLiveSessionEvents('user-question-answered', (event) => {
      if (event.questionId === questionId) {
        resolve(event.answer);
        unsubscribe();
      }
    });

    // Auto-resolve after timeout + 1s
    setTimeout(() => {
      resolve(null);
      unsubscribe();
    }, 16000);
  });
}

// Usage
const answer = await askClarification('session-123', 'Detected OAuth code changes');
if (answer === 'Yes') {
  // Link to authentication topic
}
```

### Recipe: Ask Free-Form Question

```typescript
async function askFreeFormQuestion(sessionId: string) {
  window.dispatchEvent(new CustomEvent('ai-question-asked', {
    detail: {
      questionId: `q-freeform-${Date.now()}`,
      question: "Can you describe what you're trying to accomplish?",
      context: "I see you've been switching between multiple tasks",
      suggestedAnswers: [], // Empty = free-form input only
      timeoutSeconds: 30
    }
  }));
}
```

---

## Event Handling

### Recipe: React to Screenshot Analysis

```typescript
import { subscribeToLiveSessionEvents } from '@/services/liveSession/events';

function startScreenshotMonitoring(sessionId: string) {
  const unsubscribe = subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
    if (event.sessionId !== sessionId) return;

    const { curiosity, progressIndicators, detectedActivity } = event.screenshot.aiAnalysis;

    // Only process significant screenshots
    if (curiosity < 0.7 && !progressIndicators?.blockers?.length) {
      console.log('[Agent] Low curiosity, skipping');
      return;
    }

    console.log('[Agent] Processing significant screenshot');

    // Check for blockers
    if (progressIndicators?.blockers?.length > 0) {
      for (const blocker of progressIndicators.blockers) {
        await addBlocker(sessionId, blocker);
      }
    }

    // Check for achievements
    if (progressIndicators?.achievements?.length > 0) {
      for (const achievement of progressIndicators.achievements) {
        await addAchievement(sessionId, achievement);
      }
    }

    // Update focus if activity changed
    if (detectedActivity !== lastActivity) {
      await updateCurrentFocus(sessionId, detectedActivity);
      lastActivity = detectedActivity;
    }
  });

  return unsubscribe;
}
```

### Recipe: Batch Audio Processing

```typescript
let audioBuffer: any[] = [];
let batchTimer: NodeJS.Timeout | null = null;

function startAudioMonitoring(sessionId: string) {
  const unsubscribe = subscribeToLiveSessionEvents('audio-processed', async (event) => {
    if (event.sessionId !== sessionId) return;

    audioBuffer.push(event.audioSegment);

    // Clear existing timer
    if (batchTimer) clearTimeout(batchTimer);

    // Process batch after 30 seconds of no new audio
    batchTimer = setTimeout(async () => {
      console.log(`[Agent] Processing ${audioBuffer.length} audio segments`);

      // Concatenate all transcriptions
      const fullTranscription = audioBuffer
        .map(seg => seg.transcription)
        .join(' ');

      // Analyze for keywords
      if (fullTranscription.toLowerCase().includes('oauth')) {
        await suggestNoteFromAudio(sessionId, fullTranscription);
      }

      audioBuffer = [];
      batchTimer = null;
    }, 30000);
  });

  return unsubscribe;
}
```

### Recipe: Handle Manual Refresh

```typescript
function startRefreshMonitoring(sessionId: string) {
  const unsubscribe = subscribeToLiveSessionEvents('summary-requested', async (event) => {
    if (event.sessionId !== sessionId) return;

    console.log(`[Agent] Refresh requested by: ${event.reason}`);

    // Force full update (bypass filters)
    const context = await getSessionContext(sessionId, 'full');
    await regenerateCompleteSummary(context);
  });

  return unsubscribe;
}
```

### Recipe: Avoid Update Loops

```typescript
let isUpdating = false;

function startSafeUpdateMonitoring(sessionId: string) {
  const unsubscribe = subscribeToLiveSessionEvents('summary-updated', async (event) => {
    if (event.sessionId !== sessionId) return;
    if (isUpdating) return; // Prevent loop

    console.log(`[Agent] Summary updated by: ${event.updatedBy}`);

    // Only react if updated by user or another agent
    if (event.updatedBy === 'user') {
      isUpdating = true;
      try {
        // React to user changes
        await handleUserUpdate(event.summary);
      } finally {
        isUpdating = false;
      }
    }
  });

  return unsubscribe;
}
```

---

## Context Strategies

### Recipe: Efficient Delta Updates

```typescript
import { getSessionContext } from '@/services/liveSession/contextBuilder';

let lastUpdateTime: string | null = null;

async function processNewChanges(sessionId: string) {
  // Get only changes since last update
  const context = await getSessionContext(sessionId, 'delta', lastUpdateTime || undefined);

  console.log(`[Agent] Processing ${context.changeCount} new changes`);

  // Process new screenshots
  for (const screenshot of context.newScreenshots) {
    await analyzeScreenshot(screenshot);
  }

  // Process new audio
  for (const audio of context.newAudio) {
    await analyzeAudio(audio);
  }

  lastUpdateTime = new Date().toISOString();
}
```

### Recipe: Full Context for Major Updates

```typescript
async function regenerateCompleteSummary(sessionId: string) {
  // Get complete context (expensive, use sparingly)
  const context = await getSessionContext(sessionId, 'full');

  console.log(`[Agent] Full context: ${context.allScreenshots.length} screenshots, ${context.allAudio.length} audio segments`);

  // Analyze everything
  const focus = await analyzeFocus(context);
  const progress = await analyzeProgress(context);
  const momentum = await analyzeMomentum(context);

  await updateLiveSessionSummary(sessionId, {
    currentFocus: focus,
    progressToday: progress,
    momentum
  });
}
```

### Recipe: Summary Context for Quick Updates

```typescript
async function quickUpdate(sessionId: string) {
  // Get lightweight summary context (2-5 KB)
  const context = await getSessionContext(sessionId, 'summary');

  console.log(`[Agent] Current focus: ${context.currentSummary.liveSnapshot?.currentFocus}`);

  // Quick analysis of recent data
  const recentScreenshot = context.recentScreenshots[0];
  if (recentScreenshot?.aiAnalysis?.curiosity > 0.8) {
    await updateMomentum(sessionId, 'high');
  }
}
```

---

## Common Patterns

### Pattern: Significance-Based Processing

```typescript
function isSignificant(event: ScreenshotAnalyzedEvent): boolean {
  const { aiAnalysis } = event.screenshot;

  return (
    aiAnalysis.curiosity > 0.7 ||
    aiAnalysis.progressIndicators?.blockers?.length > 0 ||
    aiAnalysis.progressIndicators?.achievements?.length > 0 ||
    aiAnalysis.detectedActivity !== lastActivity
  );
}

// Usage
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  if (!isSignificant(event)) return;
  await processScreenshot(event);
});
```

### Pattern: Debouncing Updates

```typescript
let debounceTimer: NodeJS.Timeout | null = null;

subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  // Clear existing timer
  if (debounceTimer) clearTimeout(debounceTimer);

  // Wait 5 seconds after last screenshot before processing
  debounceTimer = setTimeout(async () => {
    await processScreenshot(event);
    debounceTimer = null;
  }, 5000);
});
```

### Pattern: Error Handling

```typescript
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  try {
    await processScreenshot(event);
  } catch (error) {
    console.error('[Agent] Failed to process screenshot:', error);
    // Continue processing future screenshots
  }
});
```

### Pattern: Cleanup

```typescript
function startAgent(sessionId: string) {
  const unsubscribers: Array<() => void> = [];

  // Subscribe to multiple events
  unsubscribers.push(subscribeToLiveSessionEvents('screenshot-analyzed', handler1));
  unsubscribers.push(subscribeToLiveSessionEvents('audio-processed', handler2));
  unsubscribers.push(subscribeToLiveSessionEvents('summary-requested', handler3));

  // Return cleanup function
  return () => {
    console.log('[Agent] Cleaning up...');
    unsubscribers.forEach(unsub => unsub());
  };
}

// Usage
const cleanup = startAgent('session-123');
// Later...
cleanup();
```

---

## Anti-Patterns

### ❌ DON'T: Process Every Event

```typescript
// BAD: Processes every screenshot (expensive)
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  await heavyAIAnalysis(event);
});
```

**Instead, filter by significance:**

```typescript
// GOOD: Only processes significant screenshots
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  if (event.screenshot.aiAnalysis.curiosity < 0.7) return;
  await heavyAIAnalysis(event);
});
```

### ❌ DON'T: Create Update Loops

```typescript
// BAD: Causes infinite loop
subscribeToLiveSessionEvents('summary-updated', async (event) => {
  await updateLiveSessionSummary(sessionId, { momentum: 'high' }); // Triggers another summary-updated!
});
```

**Instead, track state:**

```typescript
// GOOD: Prevents loops
let isUpdating = false;

subscribeToLiveSessionEvents('summary-updated', async (event) => {
  if (isUpdating) return;

  isUpdating = true;
  try {
    await updateLiveSessionSummary(sessionId, { momentum: 'high' });
  } finally {
    isUpdating = false;
  }
});
```

### ❌ DON'T: Forget to Unsubscribe

```typescript
// BAD: Memory leak
function myComponent() {
  subscribeToLiveSessionEvents('screenshot-analyzed', handler);
  // No cleanup!
}
```

**Instead, always cleanup:**

```typescript
// GOOD: Proper cleanup
function myComponent() {
  const unsubscribe = subscribeToLiveSessionEvents('screenshot-analyzed', handler);
  return unsubscribe; // Or call it in cleanup
}
```

### ❌ DON'T: Emit Events Directly

```typescript
// BAD: Bypasses persistence
LiveSessionEventEmitter.emitSummaryUpdated(sessionId, summary, 'ai');
```

**Instead, use the Update API:**

```typescript
// GOOD: Uses proper API
await updateLiveSessionSummary(sessionId, { momentum: 'high' });
// This automatically emits 'summary-updated' event
```

### ❌ DON'T: Use Full Context Frequently

```typescript
// BAD: Expensive, called every 30 seconds
setInterval(async () => {
  const context = await getSessionContext(sessionId, 'full'); // 50-200 KB!
  await process(context);
}, 30000);
```

**Instead, use delta or summary context:**

```typescript
// GOOD: Efficient delta updates
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  const context = await getSessionContext(sessionId, 'delta'); // 1-10 KB
  await process(context);
});
```

### ❌ DON'T: Block the Event Loop

```typescript
// BAD: Synchronous heavy computation
subscribeToLiveSessionEvents('screenshot-analyzed', (event) => {
  const result = heavySyncComputation(event); // Blocks thread!
  return result;
});
```

**Instead, keep handlers async and fast:**

```typescript
// GOOD: Async processing
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  await processAsync(event); // Non-blocking
});
```

---

## Next Steps

- **Integration Guide**: See [AI_AGENT_INTEGRATION_GUIDE.md](./AI_AGENT_INTEGRATION_GUIDE.md)
- **Data Contracts**: See [AI_DATA_CONTRACTS.md](./AI_DATA_CONTRACTS.md)
- **Event Reference**: See [AI_EVENT_REFERENCE.md](./AI_EVENT_REFERENCE.md)
- **Example Implementation**: See [EXAMPLE_AI_AGENT.ts](../../../src/services/liveSession/EXAMPLE_AI_AGENT.ts)
