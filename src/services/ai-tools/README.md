# AI Tools System

**Purpose**: Provides AI agents with comprehensive tools to gather session data, correct transcripts, update analysis, and suggest entities.

## Architecture

This system is organized into 5 functional categories:

### 1. Data Gathering (`data-gathering/`)
Read-only tools for accessing session data:
- `getAudioData` - Retrieve audio segments, time ranges, or full session audio
- `getVideoData` - Extract video frames at timestamps or intervals
- `getTranscript` - Get transcript segments or full transcript in various formats
- `getSessionTimeline` - Build chronological timeline of session events

### 2. Transcript Correction (`transcript-correction/`)
Tools for improving transcript quality:
- `updateTranscript` - Update single/batch segments, re-transcribe, or upgrade all
- Includes validation and diff utilities

### 3. Enrichment (`enrichment/`)
Tools for updating AI analysis:
- `updateAnalysis` - Update screenshot/audio/summary analysis
- `updateSessionMetadata` - Update session fields, flags, comments

### 4. Suggestions (`suggestions/`)
AI suggestion system for tasks/notes:
- `suggestEntity` - Create task/note suggestions
- `createFromSuggestion` - Convert approved suggestions to entities
- Stores suggestions on session for user review

### 5. Utilities (`utils/`)
Shared utilities across all tools:
- Audio/video/session loaders
- Validation helpers
- Error handling patterns

## Usage

### For AI Agents (via nedToolExecutor)

```typescript
// Example: Get full transcript
const result = await toolExecutor.execute({
  id: 'tool-123',
  name: 'get_transcript',
  input: {
    session_id: 'session-abc',
    mode: 'full_transcript',
    format: 'json',
    quality: 'best'
  }
});

// Example: Correct transcript segment
const result = await toolExecutor.execute({
  id: 'tool-456',
  name: 'update_transcript',
  input: {
    mode: 'single_segment',
    segment_id: 'segment-xyz',
    corrected_transcription: 'The authentication flow is working now',
    correction_reason: 'Fixed garbled text in original',
    confidence: 0.85
  }
});

// Example: Suggest task from audio
const result = await toolExecutor.execute({
  id: 'tool-789',
  name: 'suggest_entity',
  input: {
    entity_type: 'task',
    session_id: 'session-abc',
    task_data: {
      title: 'Fix authentication bug',
      description: 'User mentioned auth flow issue',
      priority: 'high'
    },
    source_context: {
      type: 'audio',
      audio_segment_id: 'segment-xyz',
      excerpt: 'The auth flow is broken again'
    },
    confidence: 0.9
  }
});
```

### For Direct Service Usage

```typescript
import { getAudioData, updateTranscript, suggestEntity } from '@/services/ai-tools';

// Get audio segment
const audioData = await getAudioData({
  mode: 'segment',
  session_id: 'session-abc',
  segment_id: 'segment-xyz',
  format: 'mp3'
});

// Update transcript
const result = await updateTranscript({
  mode: 'single_segment',
  segment_id: 'segment-xyz',
  corrected_transcription: 'New text',
  correction_reason: 'Fixed error',
  confidence: 0.9
});

// Create suggestion
const suggestion = await suggestEntity({
  entity_type: 'task',
  session_id: 'session-abc',
  task_data: { ... },
  source_context: { ... },
  confidence: 0.85
});
```

## Tool Categories

### Read-Only (No Permission Required)
- All `data-gathering/` tools
- Safe to call during enrichment, live sessions, or chat

### Write Operations (Permission-Aware)
- `transcript-correction/` tools
- `enrichment/` tools
- `suggestions/` tools

**Permission Handling:**
- **Enrichment Context**: Auto-approved (user already confirmed "Enrich Session")
- **Live Session Context**: Auto-approved (user enabled auto-analysis)
- **Chat Context (Ned)**: Requires user permission

## Error Handling

All tools follow consistent error patterns:

```typescript
try {
  const result = await someTool(input);
  // result.success = true
  // result.data = { ... }
} catch (error) {
  // Errors are always thrown as ToolExecutionError
  // with structured error info
  if (error instanceof ToolExecutionError) {
    console.error(error.userMessage);    // User-friendly message
    console.error(error.backendDetails); // Full technical details
  }
}
```

## Testing

Every tool has comprehensive tests in `__tests__/` directories:
- Unit tests for individual functions
- Integration tests for end-to-end workflows
- Mock data for session/audio/video

Run tests:
```bash
npm test src/services/ai-tools
```

## Adding New Tools

1. Create new file in appropriate category directory
2. Implement tool function with full TypeScript types
3. Add validation using `utils/validation.ts`
4. Add comprehensive error handling
5. Write tests in `__tests__/`
6. Export from category `index.ts`
7. Add tool definition to `nedTools.ts`
8. Add handler to `nedToolExecutor.ts`

## Type Safety

All tools use shared types from:
- `ai-tools/types.ts` - Tool-specific types
- `types.ts` - Global application types

This ensures consistency and prevents type mismatches.
