# AI Event Reference

**Last Updated**: November 2025

Complete reference for all Live Session Intelligence events.

---

## Event Catalog

### 1. screenshot-analyzed

**Emitted**: After screenshot is captured and analyzed by AI
**Frequency**: Every 30-180 seconds during active session (adaptive)
**Use Case**: Detect activity changes, blockers, achievements

**Event Structure**:
```typescript
{
  type: 'screenshot-analyzed',
  sessionId: string,
  screenshot: {
    id: string,
    timestamp: string,
    aiAnalysis: {
      summary: string,
      detectedActivity: string,
      curiosity: number, // 0-1
      progressIndicators?: {
        achievements?: string[],
        blockers?: string[],
        insights?: string[]
      }
    }
  },
  timestamp: string
}
```

**When to Listen**:
- Always (primary trigger for AI updates)
- Filter by curiosity > 0.7 to reduce noise
- Check for blockers/achievements in progressIndicators

**Example Handler**:
```typescript
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  if (event.sessionId !== mySessionId) return;

  const { curiosity, progressIndicators } = event.screenshot.aiAnalysis;

  // Only process if significant
  if (curiosity > 0.7 || progressIndicators?.blockers?.length > 0) {
    await updateSummary(event);
  }
});
```

---

### 2. audio-processed

**Emitted**: After audio segment is transcribed
**Frequency**: Every 5-10 seconds during active session
**Use Case**: Detect conversations, voice commands, context

**Event Structure**:
```typescript
{
  type: 'audio-processed',
  sessionId: string,
  audioSegment: {
    id: string,
    timestamp: string,
    duration: number,
    transcription: string
  },
  timestamp: string
}
```

**When to Listen**:
- When analyzing conversations
- When detecting voice commands
- When building audio-based context

**Example Handler**:
```typescript
subscribeToLiveSessionEvents('audio-processed', async (event) => {
  if (event.sessionId !== mySessionId) return;

  const { transcription } = event.audioSegment;

  // Detect keywords or commands
  if (transcription.includes('important') || transcription.includes('remember')) {
    await createNoteFromAudio(transcription);
  }
});
```

**Note**: Audio events are frequent. Consider batching (every 5-10 segments) to reduce AI calls.

---

### 3. context-changed

**Emitted**: When significant context change detected
**Frequency**: Variable (when AI detects change)
**Use Case**: React to focus changes, activity switches, blocker detection

**Event Structure**:
```typescript
{
  type: 'context-changed',
  sessionId: string,
  changeType: 'activity-switch' | 'blocker-detected' | 'achievement-detected' | 'focus-change',
  previousContext?: any,
  newContext?: any,
  timestamp: string,
  metadata?: Record<string, any>
}
```

**Change Types**:

**activity-switch**:
- User switched from coding to debugging
- User switched from documentation to meetings
- metadata: `{ from: 'coding', to: 'debugging' }`

**blocker-detected**:
- AI detected blocker in screenshot
- metadata: `{ blocker: 'Waiting on API key' }`

**achievement-detected**:
- AI detected achievement
- metadata: `{ achievement: 'Completed login flow' }`

**focus-change**:
- User's focus changed significantly
- metadata: `{ from: 'Authentication', to: 'User profile' }`

**Example Handler**:
```typescript
subscribeToLiveSessionEvents('context-changed', async (event) => {
  if (event.sessionId !== mySessionId) return;

  switch (event.changeType) {
    case 'activity-switch':
      await handleActivitySwitch(event.previousContext, event.newContext);
      break;

    case 'blocker-detected':
      await handleBlocker(event.metadata?.blocker);
      break;

    case 'achievement-detected':
      await celebrateAchievement(event.metadata?.achievement);
      break;

    case 'focus-change':
      await updateFocus(event.newContext);
      break;
  }
});
```

---

### 4. summary-requested

**Emitted**: User clicked "Refresh" button or system triggered update
**Frequency**: Manual (user-initiated) or periodic (system-initiated)
**Use Case**: Force immediate summary regeneration

**Event Structure**:
```typescript
{
  type: 'summary-requested',
  sessionId: string,
  reason: 'user' | 'system',
  timestamp: string
}
```

**When to Listen**:
- Always (user expects immediate update)
- Bypass significance filters
- Use full context (not delta)

**Example Handler**:
```typescript
subscribeToLiveSessionEvents('summary-requested', async (event) => {
  if (event.sessionId !== mySessionId) return;

  console.log(`Refresh requested by: ${event.reason}`);

  // Force full update (bypass filters)
  const context = await getSessionContext(sessionId, 'full');
  await regenerateCompleteSummary(context);
});
```

---

### 5. user-question-answered

**Emitted**: User answered AI question or question timed out
**Frequency**: Variable (when user responds)
**Use Case**: Incorporate user feedback into summary

**Event Structure**:
```typescript
{
  type: 'user-question-answered',
  sessionId: string,
  questionId: string,
  question: string,
  answer: string | null, // null = timeout
  timestamp: string
}
```

**Answer Values**:
- `string`: User provided answer
- `null`: Question timed out (no answer)
- `''` (empty string): User skipped

**Example Handler**:
```typescript
subscribeToLiveSessionEvents('user-question-answered', async (event) => {
  if (event.sessionId !== mySessionId) return;

  if (event.answer === null) {
    console.log('Question timed out, using default');
    // Use default/fallback answer
  } else if (event.answer === '') {
    console.log('User skipped question');
    // Continue without clarification
  } else {
    console.log('User answered:', event.answer);
    // Incorporate answer into summary
    await updateSummaryWithAnswer(event.question, event.answer);
  }
});
```

---

### 6. summary-updated

**Emitted**: Summary was updated by AI or user
**Frequency**: Variable (after each update)
**Use Case**: Track summary changes, avoid update loops, refresh UI

**Event Structure**:
```typescript
{
  type: 'summary-updated',
  sessionId: string,
  summary: SessionSummary,
  updatedBy: 'ai' | 'user',
  timestamp: string
}
```

**When to Listen**:
- When tracking summary changes
- When avoiding update loops
- When refreshing UI display

**Example Handler**:
```typescript
let isUpdating = false; // Prevent loops

subscribeToLiveSessionEvents('summary-updated', async (event) => {
  if (event.sessionId !== mySessionId) return;
  if (isUpdating) return; // Avoid loop

  console.log(`Summary updated by: ${event.updatedBy}`);

  // Only react if updated by another agent
  if (event.updatedBy !== 'my-agent-id') {
    await handleExternalUpdate(event.summary);
  }
});
```

**Avoiding Update Loops**:
```typescript
// BAD: Causes infinite loop
subscribeToLiveSessionEvents('summary-updated', async (event) => {
  await updateLiveSessionSummary(sessionId, { momentum: 'high' }); // Triggers another summary-updated!
});

// GOOD: Track state to prevent loops
let lastUpdateTime = null;

subscribeToLiveSessionEvents('summary-updated', async (event) => {
  if (event.timestamp === lastUpdateTime) return; // Skip duplicate
  lastUpdateTime = event.timestamp;

  // Safe to process
});
```

---

## Event Timing Expectations

| Event | Typical Frequency | Processing Time | Notes |
|-------|------------------|-----------------|-------|
| screenshot-analyzed | 30-180s | 5-30s | Adaptive interval |
| audio-processed | 5-10s | 1-5s | High frequency |
| context-changed | Variable | Instant | Triggered by AI |
| summary-requested | Manual | N/A | User-initiated |
| user-question-answered | Manual | Instant | User response |
| summary-updated | Variable | Instant | After each update |

---

## Event Filtering Strategies

### Strategy 1: Curiosity Threshold

```typescript
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  const { curiosity } = event.screenshot.aiAnalysis;

  if (curiosity < 0.7) {
    console.log('Low curiosity, skipping');
    return;
  }

  await processScreenshot(event);
});
```

### Strategy 2: Time-Based Batching

```typescript
let audioBuffer: any[] = [];
let batchTimer: NodeJS.Timeout | null = null;

subscribeToLiveSessionEvents('audio-processed', async (event) => {
  audioBuffer.push(event.audioSegment);

  // Clear existing timer
  if (batchTimer) clearTimeout(batchTimer);

  // Process batch after 30 seconds of no new audio
  batchTimer = setTimeout(async () => {
    await processAudioBatch(audioBuffer);
    audioBuffer = [];
    batchTimer = null;
  }, 30000);
});
```

### Strategy 3: Significance Check

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

subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  if (!isSignificant(event)) return;
  await processScreenshot(event);
});
```

### Strategy 4: Debouncing

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

---

## Event Subscription Best Practices

### ✅ DO

1. **Filter by session ID**:
```typescript
if (event.sessionId !== mySessionId) return;
```

2. **Unsubscribe on cleanup**:
```typescript
const unsubscribe = subscribeToLiveSessionEvents(...);
return unsubscribe; // In React useEffect cleanup
```

3. **Handle errors**:
```typescript
subscribeToLiveSessionEvents('screenshot-analyzed', async (event) => {
  try {
    await processScreenshot(event);
  } catch (error) {
    console.error('[Agent] Failed to process screenshot:', error);
  }
});
```

4. **Log for debugging**:
```typescript
console.log('[Agent] Received event:', event.type, event.timestamp);
```

### ❌ DON'T

1. **Don't process every event** - Use filters
2. **Don't forget to unsubscribe** - Memory leaks
3. **Don't create update loops** - Check updatedBy
4. **Don't block the thread** - Keep handlers async and fast

---

## Emitting Events (For Infrastructure Only)

**Note**: Your AI agent should NOT emit these events directly. Use the Update API instead.

### Correct Way (AI Agent):
```typescript
// ✅ Use update API
await updateLiveSessionSummary(sessionId, { momentum: 'high' });
// This automatically emits 'summary-updated' event
```

### Incorrect Way (Don't Do This):
```typescript
// ❌ Don't emit events directly
LiveSessionEventEmitter.emitSummaryUpdated(sessionId, summary, 'ai');
// This bypasses persistence and can cause issues
```

### Exception: Asking Questions

```typescript
// ✅ OK to emit custom event for questions
window.dispatchEvent(new CustomEvent('ai-question-asked', {
  detail: {
    questionId: 'q-123',
    question: 'What are you working on?',
    suggestedAnswers: ['Login', 'Profile'],
    timeoutSeconds: 20
  }
}));
```

---

## Debugging Events

### Log All Events

```typescript
const events = [
  'screenshot-analyzed',
  'audio-processed',
  'context-changed',
  'summary-requested',
  'user-question-answered',
  'summary-updated'
] as const;

events.forEach(eventType => {
  subscribeToLiveSessionEvents(eventType, (event) => {
    console.log(`[Event] ${event.type}:`, event);
  });
});
```

### Count Events

```typescript
const eventCounts = {};

subscribeToLiveSessionEvents('screenshot-analyzed', (event) => {
  eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
  console.log('Event counts:', eventCounts);
});
```

---

## Next Steps

- **Implementation**: See [AI_AGENT_INTEGRATION_GUIDE.md](./AI_AGENT_INTEGRATION_GUIDE.md)
- **Types**: See [AI_DATA_CONTRACTS.md](./AI_DATA_CONTRACTS.md)
- **Examples**: See [AI_TOOL_COOKBOOK.md](./AI_TOOL_COOKBOOK.md)
