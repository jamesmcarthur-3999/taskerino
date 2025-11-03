# Live Session Intelligence - Integration Guide

This guide shows WHERE to integrate the Live Session Infrastructure into the existing codebase.

## Table of Contents

1. [Event Emission Integration](#event-emission-integration)
2. [Cleanup Tasks](#cleanup-tasks)
3. [Testing Integration](#testing-integration)

---

## Event Emission Integration

### 1. Emit screenshot-analyzed Event

**File**: `/src/components/sessions/SessionsZone.tsx` or `/src/context/RecordingContext.tsx`

**Location**: After screenshot analysis completes

**Current Code** (approximate location):
```typescript
// After screenshot is captured and analyzed
const newScreenshot = {
  id: screenshotId,
  sessionId: activeSession.id,
  timestamp: new Date().toISOString(),
  attachmentId: attachmentId,
  aiAnalysis: analysisResult,  // From sessionsAgentService.analyzeScreenshot()
  analysisStatus: 'complete'
};

// Add screenshot to session
session.screenshots.push(newScreenshot);
await saveSession(session);
```

**Add This**:
```typescript
import { LiveSessionEventEmitter } from '@/services/liveSession/events';

// After screenshot analysis completes
LiveSessionEventEmitter.emitScreenshotAnalyzed(
  activeSession.id,
  newScreenshot
);

// Optional: Emit context-changed if activity switched
if (analysisResult.detectedActivity !== previousActivity) {
  LiveSessionEventEmitter.emitContextChanged(
    activeSession.id,
    'activity-switch',
    previousActivity,
    analysisResult.detectedActivity
  );
}

// Optional: Emit for high-priority signals
if (analysisResult.progressIndicators?.blockers?.length > 0) {
  LiveSessionEventEmitter.emitContextChanged(
    activeSession.id,
    'blocker-detected',
    undefined,
    analysisResult.progressIndicators.blockers.join(', ')
  );
}
```

### 2. Emit audio-processed Event

**File**: `/src/context/RecordingContext.tsx` or wherever audio transcription happens

**Location**: After audio segment is transcribed

**Current Code** (approximate):
```typescript
// After audio transcription completes
const newAudioSegment = {
  id: audioId,
  sessionId: activeSession.id,
  timestamp: new Date().toISOString(),
  duration: duration,
  transcription: transcriptionResult,
  attachmentId: audioAttachmentId
};

// Add audio to session
session.audioSegments.push(newAudioSegment);
await saveSession(session);
```

**Add This**:
```typescript
import { LiveSessionEventEmitter } from '@/services/liveSession/events';

// After audio transcription completes
LiveSessionEventEmitter.emitAudioProcessed(
  activeSession.id,
  newAudioSegment
);
```

### 3. Emit summary-requested Event

**File**: Any UI component that has a "Update Summary" button

**Location**: Button click handler

**Add This**:
```typescript
import { LiveSessionEventEmitter } from '@/services/liveSession/events';

function handleUpdateSummaryClick() {
  LiveSessionEventEmitter.emitSummaryRequested(
    activeSession.id,
    'user'
  );
}
```

### 4. Listen to summary-updated Event (UI Updates)

**File**: `/src/components/sessions/LiveIntelligencePanel.tsx` (when you create it)

**Example**:
```typescript
import { subscribeToLiveSessionEvents } from '@/services/liveSession';
import { useEffect, useState } from 'react';

export const LiveIntelligencePanel: React.FC = () => {
  const { activeSession } = useActiveSession();
  const [summary, setSummary] = useState(activeSession?.summary);

  useEffect(() => {
    const unsubscribe = subscribeToLiveSessionEvents(
      'summary-updated',
      (event) => {
        if (event.sessionId === activeSession?.id) {
          setSummary(event.summary);
        }
      }
    );

    return () => unsubscribe();
  }, [activeSession?.id]);

  return (
    <div>
      <h2>Live Intelligence</h2>
      <p>Current Focus: {summary?.liveSnapshot?.currentFocus}</p>
      {/* ... */}
    </div>
  );
};
```

---

## Cleanup Tasks

### 1. Remove SessionQueryEngine (or Refactor)

**File**: `/src/services/SessionQueryEngine.ts`

**Current Status**: 1,414 lines with discriminated union routing

**Option A - Delete Entirely** (Recommended):
```bash
# Delete the file
rm src/services/SessionQueryEngine.ts
rm src/services/SessionQueryEngine.test.ts
```

**Reason**: UnifiedIndexManager already provides all the functionality. SessionQueryEngine is an unnecessary abstraction layer.

**Option B - Refactor to Thin Wrapper** (If you want to keep it):
```typescript
// Refactor to use UnifiedIndexManager under the hood
export class SessionQueryEngine {
  async search(params: any) {
    const indexManager = await getUnifiedIndexManager();
    return await indexManager.search(params);
  }
}
```

### 2. Remove Natural Language Query Handler (P1-T04)

**Files to Check**:
- `/src/services/SessionQueryEngine.ts` - Remove `naturalLanguageQuery()` method
- Any separate `NaturalLanguageQueryHandler.ts` files

**Reason**: The AI orchestrator IS the natural language handler. We don't need a separate layer that sends queries to Claude - your external AI service handles this.

### 3. Remove Structured Query Handler (P1-T03)

**Files to Check**:
- `/src/services/SessionQueryEngine.ts` - Remove `structuredQuery()` method

**Reason**: Tools provide structured query capabilities. No need for a separate handler.

### 4. Update Todo List

**File**: Your project management system

**Remove**:
- ❌ P1-T01: Create SessionQueryEngine core class (superseded by UnifiedIndexManager)
- ❌ P1-T02: Implement LiveSessionContextProvider (completed, but as part of infrastructure)
- ❌ P1-T03: Implement structured query handler (unnecessary - tools provide this)
- ❌ P1-T04: Implement natural language query handler (unnecessary - AI service handles this)
- ❌ P1-T05: Create Tauri query commands (completed)
- ❌ P1-T06: Implement real-time event subscription (completed - events.ts)
- ❌ P1-T07: Write query API documentation (completed - LIVE_SESSION_API.md)

### 5. Update Imports

**Search Project For**:
```typescript
import { SessionQueryEngine } from '@/services/SessionQueryEngine';
```

**Replace With** (if using wrapper approach):
```typescript
import { getUnifiedIndexManager } from '@/services/storage/UnifiedIndexManager';

const indexManager = await getUnifiedIndexManager();
```

**Or** (if using infrastructure):
```typescript
import { getLiveSessionTools } from '@/services/liveSession';

const { schemas, executor } = getLiveSessionTools(activeSession);
```

---

## Testing Integration

### 1. Test Event Emission

**Create Test File**: `/src/services/liveSession/__tests__/events.test.ts`

```typescript
import { LiveSessionEventEmitter } from '../events';
import { EventBus } from '@/services/eventBus';
import { vi, describe, it, expect } from 'vitest';

describe('LiveSessionEventEmitter', () => {
  it('should emit screenshot-analyzed event', async () => {
    const handler = vi.fn();
    EventBus.on('screenshot-analyzed', handler);

    const screenshot = {
      id: 'screenshot-1',
      sessionId: 'session-1',
      timestamp: new Date().toISOString(),
      attachmentId: 'att-1',
      aiAnalysis: { summary: 'Test', detectedActivity: 'coding' },
      analysisStatus: 'complete'
    };

    LiveSessionEventEmitter.emitScreenshotAnalyzed('session-1', screenshot);

    // Wait for async event emission
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'screenshot-analyzed',
        sessionId: 'session-1',
        screenshot: screenshot
      })
    );

    EventBus.off('screenshot-analyzed', handler);
  });
});
```

### 2. Test Tool Execution

**Create Test File**: `/src/services/liveSession/__tests__/toolExecutor.test.ts`

```typescript
import { LiveSessionToolExecutor } from '../toolExecutor';
import { getUnifiedIndexManager } from '@/services/storage/UnifiedIndexManager';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/services/storage/UnifiedIndexManager');

describe('LiveSessionToolExecutor', () => {
  it('should execute universal_search tool', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      results: { sessions: [], notes: [], tasks: [] },
      counts: { sessions: 0, notes: 0, tasks: 0, total: 0 },
      took: 10
    });

    (getUnifiedIndexManager as any).mockResolvedValue({
      search: mockSearch
    });

    const executor = new LiveSessionToolExecutor();

    const results = await executor.executeTools([
      {
        id: '1',
        name: 'universal_search',
        input: { query: 'test' }
      }
    ]);

    expect(results[0].tool_use_id).toBe('1');
    expect(results[0].content).toBeDefined();
    expect(mockSearch).toHaveBeenCalled();
  });
});
```

### 3. Test Context Building

**Create Test File**: `/src/services/liveSession/__tests__/contextBuilder.test.ts`

```typescript
import { LiveSessionContextBuilder } from '../contextBuilder';
import { getChunkedStorage } from '@/services/storage/ChunkedSessionStorage';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/services/storage/ChunkedSessionStorage');

describe('LiveSessionContextBuilder', () => {
  it('should build summary context', async () => {
    const mockSession = {
      id: 'session-1',
      name: 'Test Session',
      status: 'active',
      startTime: new Date().toISOString(),
      screenshots: [],
      audioSegments: []
    };

    (getChunkedStorage as any).mockResolvedValue({
      loadFullSession: vi.fn().mockResolvedValue(mockSession)
    });

    const builder = new LiveSessionContextBuilder();
    const context = await builder.buildSummaryContext('session-1');

    expect(context.session.id).toBe('session-1');
    expect(context.recentScreenshots).toBeDefined();
    expect(context.recentAudio).toBeDefined();
  });
});
```

### 4. Manual Integration Test

**Create Test Script**: `/scripts/test-live-session-integration.ts`

```typescript
import {
  getLiveSessionTools,
  subscribeToLiveSessionEvents,
  getSessionContext,
  updateLiveSessionSummary
} from '../src/services/liveSession';

async function testIntegration() {
  console.log('Testing Live Session Infrastructure...\n');

  // Test 1: Get tools
  console.log('1. Getting tools...');
  const { schemas, executor } = getLiveSessionTools();
  console.log(`   ✓ ${schemas.length} tools available`);

  // Test 2: Subscribe to events
  console.log('2. Subscribing to events...');
  let eventReceived = false;
  const unsubscribe = subscribeToLiveSessionEvents(
    'screenshot-analyzed',
    (event) => {
      console.log(`   ✓ Event received: ${event.type}`);
      eventReceived = true;
    }
  );

  // Test 3: Get context
  console.log('3. Getting session context...');
  try {
    // This will fail if no active session - that's ok for testing
    const context = await getSessionContext('test-session', 'summary');
    console.log(`   ✓ Context size: ${JSON.stringify(context).length} bytes`);
  } catch (error) {
    console.log(`   ⚠ No active session (expected): ${error.message}`);
  }

  // Test 4: Tool execution
  console.log('4. Testing tool execution...');
  const results = await executor.executeTools([
    { id: '1', name: 'get_progress_indicators', input: {} }
  ]);
  console.log(`   ${results[0].error ? '⚠' : '✓'} Tool executed`);

  // Cleanup
  unsubscribe();

  console.log('\n✅ Infrastructure tests complete!');
}

testIntegration().catch(console.error);
```

**Run**:
```bash
npx tsx scripts/test-live-session-integration.ts
```

---

## Integration Checklist

### Phase 2.2: Event Emission
- [ ] Add `LiveSessionEventEmitter.emitScreenshotAnalyzed()` after screenshot analysis
- [ ] Add `LiveSessionEventEmitter.emitAudioProcessed()` after audio transcription
- [ ] Add `LiveSessionEventEmitter.emitSummaryRequested()` on user button click
- [ ] Test event emission with console.log or event listener

### Phase 6: Cleanup
- [ ] Remove or refactor `SessionQueryEngine.ts`
- [ ] Remove natural language query handler
- [ ] Remove structured query handler
- [ ] Update imports across codebase
- [ ] Update todo list to reflect completed work

### Testing
- [ ] Write unit tests for event emitter
- [ ] Write unit tests for tool executor
- [ ] Write unit tests for context builder
- [ ] Run manual integration test script
- [ ] Verify no TypeScript errors
- [ ] Verify no broken imports

---

## Next Steps

1. **Emit Events**: Add event emission to SessionsZone and RecordingContext
2. **Build AI Orchestrator**: Use the infrastructure to integrate your AI service
3. **Test**: Run the test script to verify everything works
4. **Monitor**: Watch event logs to see when events fire
5. **Iterate**: Refine significance thresholds and context sizes
