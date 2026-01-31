# Baleybots Integration

This directory contains the Baleybots SDK integration for Taskerino, replacing the previous fragmented AI services with a unified, type-safe implementation.

## Architecture

```
src/bots/
├── config.ts              # API key management, model configs
├── types.ts               # Zod schemas for bot outputs
├── index.ts               # Main exports
├── screenshot-analyzer.ts # Live screenshot analysis (replaces sessionsAgentService)
├── session-summarizer.ts  # Session summaries (replaces sessionsAgentService)
├── audio-reviewer.ts      # Audio analysis (replaces audioReviewService)
├── capture-processor.ts   # Input processing (replaces claudeService)
├── context-searcher.ts    # Notes/tasks search (replaces contextAgent)
├── session-searcher.ts    # Session search (replaces sessionsQueryAgent)
├── ned-assistant.ts       # Ned AI assistant (replaces nedService)
├── tools/                 # Ned's tool definitions
│   ├── query-tools.ts     # Read-only tools
│   ├── mutation-tools.ts  # Write tools
│   └── session-tools.ts   # Session tools
├── hooks/                 # React integration
│   ├── useNed.ts          # Ned chat hook
│   └── useBots.ts         # Initialization hook
└── adapters/              # Drop-in replacements for old services
    ├── sessions-agent-adapter.ts
    └── claude-service-adapter.ts
```

## Migration Status

| Old Service | New Implementation | Status |
|------------|-------------------|--------|
| sessionsAgentService | screenshot-analyzer + session-summarizer | ✅ |
| audioReviewService | audio-reviewer | ✅ |
| claudeService | capture-processor | ✅ |
| contextAgent | context-searcher | ✅ |
| sessionsQueryAgent | session-searcher | ✅ |
| nedService | ned-assistant | ✅ |
| videoAnalysisAgent | (future) | 🔄 |

## Usage

### Initialization

```typescript
import { initializeBots } from './bots';

// On app startup
await initializeBots();
```

### Using Ned Assistant

```typescript
import { useNed } from './bots';

function Chat() {
  const { messages, sendMessage, isLoading, streamingContent } = useNed({
    config: { notes, tasks, topics, companies, contacts, sessions },
    dispatch,
  });

  return (
    <div>
      {messages.map(msg => <Message key={msg.id} {...msg} />)}
      {isLoading && <div>{streamingContent}</div>}
    </div>
  );
}
```

### Processing Capture Input

```typescript
import { processCapture } from './bots';

const result = await processCapture(
  'Meeting notes: discussed Q4 targets with @john',
  existingTopics,
  existingNotes,
  existingTasks
);

// result.notes - extracted notes
// result.tasks - extracted tasks
// result.detectedTopics - detected topics
```

### Screenshot Analysis

```typescript
import { analyzeScreenshot, clearScreenshotContext } from './bots';

// During session
const analysis = await analyzeScreenshot(
  screenshotBase64,
  sessionId,
  'Work Session'
);

// When session ends
clearScreenshotContext(sessionId);
```

## Benefits Over Old System

1. **Type Safety** - All outputs validated with Zod schemas
2. **Unified API** - One SDK for all AI operations
3. **Composable** - Bots can be chained, parallelized, looped
4. **Streaming** - Real-time visibility into bot thinking
5. **Multi-turn** - Conversation history management built-in
6. **Provider Agnostic** - Easy to swap Claude ↔ GPT
