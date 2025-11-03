# AI Agent Enrichment Integration Guide

**Date**: November 2, 2025
**Status**: Architecture Complete, Ready for AI Agent Implementation
**Version**: 1.0.0

---

## Overview

This guide documents the **Enrichment Adapter Architecture** that enables seamless switching between the legacy hardcoded enrichment pipeline and a new AI agent-driven approach using chain-of-thought reasoning and tool use.

### What Was Built

The system now has a **Strategy Pattern adapter** that:

1. ✅ Preserves all existing UI and progress tracking
2. ✅ Allows feature flag switching between implementations
3. ✅ Provides a clean interface for AI agent integration
4. ✅ Zero breaking changes to existing functionality

### Architecture

```
BackgroundEnrichmentManager (NO CHANGES)
    ↓
PersistentEnrichmentQueue (reads settings)
    ↓
EnrichmentOrchestrator (strategy selector)
    ↓
    ├─> LegacyEnrichmentStrategy (wraps existing sessionEnrichmentService)
    └─> AIAgentEnrichmentStrategy (NEW - ready for implementation)
```

---

## Files Created

### 1. EnrichmentStrategy Interface

**Location**: `/src/services/enrichment/strategies/EnrichmentStrategy.ts`

**Purpose**: Common interface for all enrichment implementations

**Key Types**:
```typescript
export interface EnrichmentStrategy {
  readonly name: 'legacy' | 'ai-agent';
  readonly version: string;

  // Core enrichment methods
  enrichSession(session: Session, options?: EnrichmentOptions): Promise<EnrichmentResult>;
  enrichSessionStreaming(session: Session, options?: Omit<EnrichmentOptions, 'onProgress'>): AsyncGenerator<EnrichmentProgress | EnrichmentResult, void, unknown>;

  // Validation & estimation
  estimateCost(session: Session, options?: EnrichmentOptions): Promise<number>;
  validateSession(session: Session): Promise<{ valid: boolean; errors: string[]; warnings?: string[] }>;

  // Control
  cancelEnrichment(sessionId: string): Promise<boolean>;
  supportsFeature(feature: EnrichmentFeature): boolean;
}
```

**Supported Features**:
- `streaming` - Real-time progress updates via async generator
- `tool_use` - AI tool use with chain-of-thought reasoning
- `self_healing` - Automatic error recovery
- `incremental` - Delta-based enrichment
- `cost_estimation` - Accurate cost estimation
- `parallel_stages` - Parallel audio/video processing

### 2. EnrichmentOrchestrator

**Location**: `/src/services/enrichment/EnrichmentOrchestrator.ts`

**Purpose**: Strategy selector and factory based on configuration

**Usage**:
```typescript
import { getEnrichmentOrchestrator } from '@/services/enrichment/EnrichmentOrchestrator';

// Get orchestrator with config from settings
const orchestrator = getEnrichmentOrchestrator({
  strategy: 'ai-agent',
  aiAgent: {
    model: 'claude-3-5-sonnet-20241022',
    enableStreaming: true,
    enableToolUse: true
  }
});

// Enrich session
const result = await orchestrator.enrichSession(session, options);
```

### 3. LegacyEnrichmentStrategy

**Location**: `/src/services/enrichment/strategies/LegacyEnrichmentStrategy.ts`

**Purpose**: Wrapper around existing `sessionEnrichmentService` with zero logic changes

**Implementation**: ✅ Complete - Production ready

### 4. AIAgentEnrichmentStrategy

**Location**: `/src/services/enrichment/strategies/AIAgentEnrichmentStrategy.ts`

**Purpose**: AI-driven enrichment with tool use and streaming

**Implementation**: 🚧 STUB - Ready for AI agent integration (see below)

### 5. Settings Integration

**Location**: `/src/context/SettingsContext.tsx`

**New Interface**:
```typescript
interface EnrichmentSettings {
  strategy: 'legacy' | 'ai-agent';
  legacy: {
    enableIncremental?: boolean;
    enableCaching?: boolean;
  };
  aiAgent: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    enableToolUse?: boolean;
    enableStreaming?: boolean;
  };
}
```

**New Hook**:
```typescript
export function useEnrichmentSettings() {
  const { enrichmentSettings, updateEnrichmentSettings, switchStrategy, ... } = useEnrichmentSettings();

  // Switch to AI agent
  switchStrategy('ai-agent');

  // Update AI agent config
  updateAIAgentConfig({ temperature: 0.8 });
}
```

---

## How to Implement the AI Agent

### Step 1: Understand the AI Tools System

The AI agent has access to **7 tools with 21 modes** for gathering and updating session data:

#### Data Gathering Tools (4 tools)

1. **`getAudioData`** - Get audio in various formats
   - Modes: `segment`, `time_range`, `full_session`
   - Returns: Base64 audio, waveform, duration

2. **`getVideoData`** - Extract video frames
   - Modes: `frames_at_timestamps`, `frames_by_interval`, `metadata`
   - Returns: Frame data URIs, timestamps

3. **`getTranscript`** - Get audio transcription
   - Modes: `segments`, `full_transcript`
   - Formats: `plain`, `srt`, `vtt`, `json`

4. **`getSessionTimeline`** - Get chronological timeline
   - Options: Include screenshots, audio, achievements, blockers

#### Update Tools (3 tools)

5. **`updateTranscript`** - Correct transcription errors
   - Modes: `single_segment`, `batch_segments`, `re_transcribe_segment`, `re_transcribe_range`, `upgrade_all`

6. **`updateAnalysis`** - Update AI analysis
   - Modes: `screenshot`, `audio_segment`, `session_summary`, `audio_insights`

7. **`suggestEntity`** - Create task/note suggestions
   - Modes: `task`, `note`, `batch`

**Documentation**: See `/src/services/ai-tools/` and `INTEGRATION_READINESS_CHECKLIST.md`

### Step 2: Implement `enrichSessionStreaming()`

This is the core method that the AI agent will implement. Here's the structure:

```typescript
async* enrichSessionStreaming(
  session: Session,
  options?: Omit<EnrichmentOptions, 'onProgress'>
): AsyncGenerator<EnrichmentProgress | EnrichmentResult, void, unknown> {
  const startTime = Date.now();

  // Stage 1: Validating (0-10%)
  yield this.createProgress(session.id, 'validating', 5, 'Validating session data...', startTime);

  // Validate session has enrichable data
  const validation = await this.validateSession(session);
  if (!validation.valid) {
    throw new Error(`Session validation failed: ${validation.errors.join(', ')}`);
  }

  // Stage 2: Audio Analysis (10-40%)
  if (!options?.skipAudio) {
    yield this.createProgress(session.id, 'audio', 15, 'Analyzing audio...', startTime);

    // Use AI tools to gather audio data
    const audioResult = await getAudioData({
      mode: 'full_session',
      session_id: session.id,
      format: 'mp3',
      include_waveform: false
    });

    const transcriptResult = await getTranscript({
      mode: 'full_transcript',
      session_id: session.id,
      format: 'plain',
      quality: 'best'
    });

    // Stream to Claude API with tool use
    const audioAnalysis = await this.analyzeAudioWithAI(transcriptResult.transcript);

    // Update session with results
    await updateAnalysis({
      mode: 'audio_insights',
      session_id: session.id,
      audio_insights: audioAnalysis
    });

    yield this.createProgress(session.id, 'audio', 40, 'Audio analysis complete', startTime);
  }

  // Stage 3: Video Analysis (40-70%)
  if (!options?.skipVideo) {
    yield this.createProgress(session.id, 'video', 45, 'Analyzing video...', startTime);

    // Extract key frames
    const videoResult = await getVideoData({
      mode: 'frames_by_interval',
      session_id: session.id,
      interval_seconds: 30,
      max_frames: 100
    });

    // Stream to Claude vision API
    const videoAnalysis = await this.analyzeVideoWithAI(videoResult.frames);

    // Yield progress updates
    yield this.createProgress(session.id, 'video', 70, 'Video analysis complete', startTime);
  }

  // Stage 4: Summary Generation (70-90%)
  if (!options?.skipSummary) {
    yield this.createProgress(session.id, 'summary', 75, 'Generating summary...', startTime);

    // Get full timeline
    const timeline = await getSessionTimeline({
      session_id: session.id,
      include_screenshots: true,
      include_audio: true,
      include_achievements: true,
      include_blockers: true
    });

    // Generate comprehensive summary with AI
    const summary = await this.generateSummaryWithAI(timeline);

    // Update session
    await updateAnalysis({
      mode: 'session_summary',
      session_id: session.id,
      summary
    });

    yield this.createProgress(session.id, 'summary', 90, 'Summary complete', startTime);
  }

  // Stage 5: Canvas Generation (90-100%)
  if (!options?.skipCanvas) {
    yield this.createProgress(session.id, 'canvas', 95, 'Generating canvas...', startTime);

    // Generate AI canvas (optional)
    // ...

    yield this.createProgress(session.id, 'canvas', 100, 'Canvas complete', startTime);
  }

  // Final result
  const endTime = Date.now();
  yield {
    success: true,
    sessionId: session.id,
    startTime,
    endTime,
    duration: endTime - startTime,
    stages: {
      audio: { success: true, skipped: false },
      video: { success: true, skipped: false },
      summary: { success: true, skipped: false },
      canvas: { success: true, skipped: false }
    },
    enrichmentVersion: this.version,
    strategyUsed: 'ai-agent'
  };
}
```

### Step 3: Implement Helper Methods

```typescript
/**
 * Analyze audio using Claude API
 */
private async analyzeAudioWithAI(transcript: string): Promise<any> {
  // Initialize Claude API client
  const anthropic = new Anthropic({
    apiKey: this.config.apiKey || settings.claudeApiKey
  });

  // Stream response with tool use
  const stream = await anthropic.messages.stream({
    model: this.config.model,
    max_tokens: this.config.maxTokens,
    temperature: this.config.temperature,
    messages: [{
      role: 'user',
      content: `Analyze this session transcript and extract:
1. Key achievements
2. Blockers encountered
3. Topics discussed
4. Sentiment analysis
5. Task suggestions

Transcript:
${transcript}

Use the available tools to update the session analysis as you work.`
    }],
    tools: this.getToolDefinitions() // From nedTools.ts
  });

  // Process streaming response
  let analysis = {};
  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      // Process text delta
    } else if (event.type === 'tool_use') {
      // Execute tool via nedToolExecutor
      const toolResult = await this.executeTool(event.tool_use);
      // Continue conversation with tool result
    }
  }

  return analysis;
}

/**
 * Execute AI tool
 */
private async executeTool(toolUse: any): Promise<any> {
  // Use nedToolExecutor for permission-based tool execution
  const { nedToolExecutor } = await import('../../services/nedToolExecutor');

  const result = await nedToolExecutor.execute({
    name: toolUse.name,
    input: toolUse.input
  });

  return result;
}

/**
 * Get tool definitions for Claude API
 */
private getToolDefinitions(): any[] {
  // Import tool definitions from nedTools.ts
  const { ALL_TOOLS } = await import('../../services/nedTools');
  return ALL_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema
  }));
}
```

### Step 4: Test the Implementation

```typescript
// In a test file
import { AIAgentEnrichmentStrategy } from '@/services/enrichment/strategies/AIAgentEnrichmentStrategy';

const strategy = new AIAgentEnrichmentStrategy({
  model: 'claude-3-5-sonnet-20241022',
  enableStreaming: true,
  enableToolUse: true,
  apiKey: 'sk-ant-...'
});

// Test streaming enrichment
for await (const update of strategy.enrichSessionStreaming(session, {})) {
  if ('success' in update) {
    console.log('✓ Enrichment complete:', update.success);
  } else {
    console.log(`${update.stage}: ${update.progress}% - ${update.message}`);
  }
}
```

### Step 5: Switch to AI Agent in Settings

```typescript
import { useEnrichmentSettings } from '@/context/SettingsContext';

function SettingsPanel() {
  const { enrichmentSettings, switchStrategy } = useEnrichmentSettings();

  return (
    <div>
      <label>
        <input
          type="radio"
          checked={enrichmentSettings.strategy === 'legacy'}
          onChange={() => switchStrategy('legacy')}
        />
        Legacy Pipeline (Current)
      </label>
      <label>
        <input
          type="radio"
          checked={enrichmentSettings.strategy === 'ai-agent'}
          onChange={() => switchStrategy('ai-agent')}
        />
        AI Agent (Experimental)
      </label>
    </div>
  );
}
```

---

## Testing Checklist

Before deploying AI agent strategy:

- [ ] Test with short session (1-2 minutes, few screenshots)
- [ ] Test with medium session (10-15 minutes, 50+ screenshots)
- [ ] Test with audio-only session
- [ ] Test with video-only session
- [ ] Test error handling (API failures, tool errors)
- [ ] Test cancellation
- [ ] Verify progress updates stream correctly
- [ ] Verify SessionProcessingScreen displays correctly
- [ ] Test switching back to legacy strategy
- [ ] Monitor cost per enrichment (target: <$0.50/session)

---

## Integration Points

### UI Integration (No Changes Required)

- ✅ **SessionProcessingScreen**: Already listens to progress events - will work with AI agent
- ✅ **SessionDetailView**: Displays enrichment results - no changes needed
- ✅ **EnrichmentStatusIndicator**: Shows queue status - no changes needed

### Event Bus (No Changes Required)

All events are preserved:
- `job-enqueued`
- `job-started`
- `job-progress`
- `job-completed`
- `job-failed`

### Storage (No Changes Required)

Enrichment results saved to ChunkedStorage as before.

---

## Performance Targets

| Metric | Legacy | AI Agent Target |
|--------|--------|-----------------|
| Cost | $0.50-2.00 | <$0.50 (via caching) |
| Duration | 30-60s | 40-80s (includes API latency) |
| Quality | Fixed logic | Adaptive, improves over time |
| Failures | ~5% | <1% (self-healing) |

---

## Rollback Plan

If AI agent encounters issues:

1. User switches strategy back to 'legacy' in Settings
2. System immediately uses LegacyEnrichmentStrategy
3. Zero downtime, instant switchover
4. Fix AI agent implementation offline
5. Re-enable when ready

---

## Next Steps

1. **Implement `enrichSessionStreaming()`** in `AIAgentEnrichmentStrategy.ts`
2. **Test thoroughly** with real session data
3. **Monitor costs** in production (add logging)
4. **Iterate** based on user feedback
5. **Document** lessons learned for future improvements

---

## Questions?

- **Architecture**: See this guide and `/src/services/enrichment/strategies/` files
- **AI Tools**: See `/src/services/ai-tools/` and `INTEGRATION_READINESS_CHECKLIST.md`
- **Testing**: See `/src/services/enrichment/__tests__/` for examples
- **Settings**: See `/src/context/SettingsContext.tsx` for `useEnrichmentSettings()` hook

**Ready to build!** The architecture is complete, and the AI agent just needs the implementation logic. Everything else is handled by the adapter.
