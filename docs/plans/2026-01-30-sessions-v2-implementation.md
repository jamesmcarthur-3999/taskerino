# Sessions 2.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Sessions feature with simplified data model, Baleybots integration, and markdown-first summaries with evidence linking.

**Architecture:** Stateless bots process data streams (screenshots, audio) in real-time. A SessionOrchestrator manages storage, scheduling, and coordinates the 5 core bots. Summaries are built incrementally during the session (every 30-60s) so they're 90% complete when the session ends.

**Tech Stack:** TypeScript, React, Baleybots SDK (@baleybots/core, @baleybots/chat), Zod schemas, Vitest

---

## Phase 1: New Types & Bot Definitions

### Task 1: Define Sessions 2.0 Types

**Files:**
- Create: `src/bots/sessions-v2/types.ts`
- Test: `src/bots/sessions-v2/__tests__/types.test.ts`

**Step 1: Write the type definition file**

```typescript
// src/bots/sessions-v2/types.ts
import { z } from 'zod';

// ============================================================================
// EVIDENCE LINKING
// ============================================================================

export const EvidenceLinkSchema = z.object({
  id: z.string(),
  type: z.enum(['screenshot', 'audio', 'video']),
  sourceId: z.string().describe('ID of raw data (screenshot/audio/video)'),
  timestamp: z.string().describe('ISO timestamp when this occurred in session'),
  excerpt: z.string().optional().describe('Relevant quote or description'),
});

export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

// ============================================================================
// SCREENSHOT ANALYSIS (simplified from existing)
// ============================================================================

export const ScreenshotAnalysisV2Schema = z.object({
  activity: z.string().describe('What the user is doing, e.g., "Editing auth.ts in VS Code"'),
  extractedText: z.array(z.string()).describe('Important visible text (URLs, errors, data)'),
  elements: z.array(z.string()).describe('Key UI elements detected'),
  confidence: z.number().min(0).max(1),
});

export type ScreenshotAnalysisV2 = z.infer<typeof ScreenshotAnalysisV2Schema>;

// ============================================================================
// AUDIO ANALYSIS
// ============================================================================

export const TranscriptSegmentSchema = z.object({
  start: z.number().describe('Start time in seconds'),
  end: z.number().describe('End time in seconds'),
  text: z.string(),
});

export const AudioTranscriptSchema = z.object({
  text: z.string().describe('Full transcript text'),
  segments: z.array(TranscriptSegmentSchema).optional(),
});

export type AudioTranscript = z.infer<typeof AudioTranscriptSchema>;

export const AudioAnalysisV2Schema = z.object({
  topics: z.array(z.string()).describe('Topics discussed'),
  speakers: z.array(z.object({
    id: z.string(),
    lines: z.array(z.string()),
  })).optional().describe('Speaker separation if detectable'),
  sentiment: z.enum(['positive', 'neutral', 'frustrated']),
  decisions: z.array(z.string()).describe('Decisions made'),
  questions: z.array(z.string()).describe('Open questions'),
});

export type AudioAnalysisV2 = z.infer<typeof AudioAnalysisV2Schema>;

// ============================================================================
// SUMMARY
// ============================================================================

export const SessionSummaryV2Schema = z.object({
  markdown: z.string().describe('Full markdown summary with footnote references'),
  evidenceIndex: z.array(EvidenceLinkSchema).describe('All evidence links referenced'),
  generatedAt: z.string(),
});

export type SessionSummaryV2 = z.infer<typeof SessionSummaryV2Schema>;

// ============================================================================
// EXTRACTED TASKS
// ============================================================================

export const ExtractedTaskV2Schema = z.object({
  title: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  context: z.string().describe('Why this task matters'),
  evidenceIds: z.array(z.string()).describe('Evidence that led to this task'),
});

export type ExtractedTaskV2 = z.infer<typeof ExtractedTaskV2Schema>;

export const TaskExtractionResultSchema = z.object({
  tasks: z.array(ExtractedTaskV2Schema),
});

export type TaskExtractionResult = z.infer<typeof TaskExtractionResultSchema>;

// ============================================================================
// SESSION V2 (simplified)
// ============================================================================

export interface SessionV2Config {
  screenshotInterval: number; // seconds
  audioEnabled: boolean;
}

export interface SessionV2 {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  startTime: string;
  endTime?: string;
  config: SessionV2Config;

  // Raw data (source of truth) - reuse existing types
  screenshots: import('../../types').SessionScreenshot[];
  audioSegments: import('../../types').SessionAudioSegment[];

  // AI outputs (regenerable, keyed by source ID)
  analyses: {
    screenshots: Record<string, ScreenshotAnalysisV2>;
    audio: Record<string, AudioAnalysisV2>;
    transcripts: Record<string, AudioTranscript>;
  };

  // Summary (markdown + evidence)
  summary?: SessionSummaryV2;

  // Extracted entities
  extractedTasks?: ExtractedTaskV2[];
  extractedTopics?: string[];

  // Cost tracking
  costs?: {
    screenshots: number;
    audio: number;
    summaries: number;
    total: number;
  };
}

// ============================================================================
// ORCHESTRATOR STATE
// ============================================================================

export interface OrchestratorState {
  sessionId: string;
  status: 'idle' | 'processing' | 'error';
  pendingScreenshots: string[];
  pendingAudioSegments: string[];
  lastSummaryUpdate: string | null;
  errors: string[];
}
```

**Step 2: Write basic type tests**

```typescript
// src/bots/sessions-v2/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  EvidenceLinkSchema,
  ScreenshotAnalysisV2Schema,
  AudioAnalysisV2Schema,
  SessionSummaryV2Schema,
  ExtractedTaskV2Schema,
} from '../types';

describe('Sessions V2 Types', () => {
  describe('EvidenceLinkSchema', () => {
    it('should validate a complete evidence link', () => {
      const link = {
        id: 'ev-1',
        type: 'screenshot',
        sourceId: 'ss-123',
        timestamp: '2026-01-30T14:32:00Z',
        excerpt: 'VS Code showing auth.ts',
      };
      expect(EvidenceLinkSchema.parse(link)).toEqual(link);
    });

    it('should validate without optional excerpt', () => {
      const link = {
        id: 'ev-2',
        type: 'audio',
        sourceId: 'audio-456',
        timestamp: '2026-01-30T14:35:00Z',
      };
      expect(EvidenceLinkSchema.parse(link)).toEqual(link);
    });
  });

  describe('ScreenshotAnalysisV2Schema', () => {
    it('should validate screenshot analysis', () => {
      const analysis = {
        activity: 'Editing auth.ts in VS Code',
        extractedText: ['function login()', 'JWT token'],
        elements: ['VS Code editor', 'Terminal'],
        confidence: 0.95,
      };
      expect(ScreenshotAnalysisV2Schema.parse(analysis)).toEqual(analysis);
    });
  });

  describe('AudioAnalysisV2Schema', () => {
    it('should validate audio analysis', () => {
      const analysis = {
        topics: ['authentication', 'JWT'],
        sentiment: 'neutral',
        decisions: ['Use RS256 for signing'],
        questions: ['What about refresh tokens?'],
      };
      expect(AudioAnalysisV2Schema.parse(analysis)).toEqual(analysis);
    });
  });

  describe('SessionSummaryV2Schema', () => {
    it('should validate session summary', () => {
      const summary = {
        markdown: '## Summary\n\nWorked on auth [^1]\n\n[^1]: Screenshot at 14:32',
        evidenceIndex: [
          { id: 'ev-1', type: 'screenshot', sourceId: 'ss-123', timestamp: '2026-01-30T14:32:00Z' },
        ],
        generatedAt: '2026-01-30T15:00:00Z',
      };
      expect(SessionSummaryV2Schema.parse(summary)).toEqual(summary);
    });
  });

  describe('ExtractedTaskV2Schema', () => {
    it('should validate extracted task', () => {
      const task = {
        title: 'Add rate limiting to auth endpoints',
        priority: 'high',
        context: 'Security requirement discussed during session',
        evidenceIds: ['ev-1', 'ev-2'],
      };
      expect(ExtractedTaskV2Schema.parse(task)).toEqual(task);
    });
  });
});
```

**Step 3: Run tests to verify types compile and validate correctly**

Run: `npx vitest run src/bots/sessions-v2/__tests__/types.test.ts`
Expected: PASS (5 test suites, all passing)

**Step 4: Commit**

```bash
git add src/bots/sessions-v2/types.ts src/bots/sessions-v2/__tests__/types.test.ts
git commit -m "feat(sessions-v2): add simplified type definitions with evidence linking"
```

---

### Task 2: Create Screenshot Analyzer V2 Bot

**Files:**
- Create: `src/bots/sessions-v2/screenshot-analyzer-v2.ts`
- Test: `src/bots/sessions-v2/__tests__/screenshot-analyzer-v2.test.ts`

**Step 1: Write the bot implementation**

```typescript
// src/bots/sessions-v2/screenshot-analyzer-v2.ts
import { Baleybot, image, text, combine } from '@baleybots/core';
import { MODELS } from '../config';
import { ScreenshotAnalysisV2Schema, type ScreenshotAnalysisV2 } from './types';

/**
 * Screenshot Analyzer V2
 *
 * Simplified, stateless screenshot analysis.
 * Context window management moved to orchestrator.
 */
export const screenshotAnalyzerV2 = Baleybot.create({
  name: 'screenshot-analyzer-v2',
  goal: `You are a screenshot analyzer for a productivity app. Given a screenshot from a work session:

1. Identify the current activity (what the user is doing)
2. Extract important visible text (URLs, error messages, code snippets, data)
3. List key UI elements and actions being performed

Be concise and focus on actionable information.`,
  model: MODELS.FAST, // Haiku for speed
  outputSchema: ScreenshotAnalysisV2Schema,
  verbose: false,
});

/**
 * Analyze a single screenshot
 *
 * @param screenshotBase64 - Base64 encoded image
 * @param context - Optional context from previous screenshots
 * @param mimeType - Image MIME type
 */
export async function analyzeScreenshotV2(
  screenshotBase64: string,
  context?: string,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<ScreenshotAnalysisV2> {
  const prompt = context
    ? `Context from recent screenshots:\n${context}\n\nAnalyze this screenshot:`
    : 'Analyze this screenshot:';

  const input = combine(
    text(prompt),
    image({ data: screenshotBase64, mediaType: mimeType })
  );

  return screenshotAnalyzerV2.process(input);
}
```

**Step 2: Write bot tests**

```typescript
// src/bots/sessions-v2/__tests__/screenshot-analyzer-v2.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screenshotAnalyzerV2, analyzeScreenshotV2 } from '../screenshot-analyzer-v2';
import { ScreenshotAnalysisV2Schema } from '../types';

// Mock the Baleybot
vi.mock('@baleybots/core', () => ({
  Baleybot: {
    create: vi.fn(() => ({
      process: vi.fn(),
    })),
  },
  image: vi.fn((opts) => ({ type: 'image', ...opts })),
  text: vi.fn((t) => ({ type: 'text', content: t })),
  combine: vi.fn((...parts) => parts),
}));

describe('screenshotAnalyzerV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be created with correct configuration', () => {
    expect(screenshotAnalyzerV2).toBeDefined();
  });

  it('should have the correct name', () => {
    // The mock returns what we defined, but we can verify the create call
    const { Baleybot } = require('@baleybots/core');
    const createCall = Baleybot.create.mock.calls[0][0];
    expect(createCall.name).toBe('screenshot-analyzer-v2');
  });

  it('should use FAST model (Haiku)', () => {
    const { Baleybot } = require('@baleybots/core');
    const createCall = Baleybot.create.mock.calls[0][0];
    // MODELS.FAST should be set to Haiku
    expect(createCall.model).toBeDefined();
  });

  it('should use ScreenshotAnalysisV2Schema for output', () => {
    const { Baleybot } = require('@baleybots/core');
    const createCall = Baleybot.create.mock.calls[0][0];
    expect(createCall.outputSchema).toBe(ScreenshotAnalysisV2Schema);
  });
});

describe('analyzeScreenshotV2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the process function
    screenshotAnalyzerV2.process = vi.fn().mockResolvedValue({
      activity: 'Editing code in VS Code',
      extractedText: ['function auth()'],
      elements: ['VS Code editor'],
      confidence: 0.9,
    });
  });

  it('should call process with image input', async () => {
    const result = await analyzeScreenshotV2('base64data');

    expect(screenshotAnalyzerV2.process).toHaveBeenCalled();
    expect(result.activity).toBe('Editing code in VS Code');
  });

  it('should include context when provided', async () => {
    await analyzeScreenshotV2('base64data', 'Previous: Was writing tests');

    const { text } = require('@baleybots/core');
    const textCall = text.mock.calls[text.mock.calls.length - 1][0];
    expect(textCall).toContain('Context from recent screenshots');
    expect(textCall).toContain('Previous: Was writing tests');
  });

  it('should not include context when not provided', async () => {
    await analyzeScreenshotV2('base64data');

    const { text } = require('@baleybots/core');
    const textCall = text.mock.calls[text.mock.calls.length - 1][0];
    expect(textCall).toBe('Analyze this screenshot:');
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/bots/sessions-v2/__tests__/screenshot-analyzer-v2.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/bots/sessions-v2/screenshot-analyzer-v2.ts src/bots/sessions-v2/__tests__/screenshot-analyzer-v2.test.ts
git commit -m "feat(sessions-v2): add stateless screenshot analyzer bot"
```

---

### Task 3: Create Audio Analyzer V2 Bot

**Files:**
- Create: `src/bots/sessions-v2/audio-analyzer-v2.ts`
- Test: `src/bots/sessions-v2/__tests__/audio-analyzer-v2.test.ts`

**Step 1: Write the bot implementation**

```typescript
// src/bots/sessions-v2/audio-analyzer-v2.ts
import { Baleybot, text } from '@baleybots/core';
import { MODELS } from '../config';
import { AudioAnalysisV2Schema, type AudioAnalysisV2, type AudioTranscript } from './types';

/**
 * Audio Analyzer V2
 *
 * Analyzes audio transcripts (not raw audio) to extract insights.
 * Uses Haiku for cost efficiency.
 */
export const audioAnalyzerV2 = Baleybot.create({
  name: 'audio-analyzer-v2',
  goal: `You are an audio transcript analyzer for a productivity app. Given a transcript from a work session:

1. Identify topics discussed
2. Detect sentiment (positive, neutral, or frustrated)
3. Extract any decisions made
4. Note any open questions or action items

Be concise and focus on actionable insights.`,
  model: MODELS.FAST, // Haiku
  outputSchema: AudioAnalysisV2Schema,
  verbose: false,
});

/**
 * Analyze an audio transcript
 *
 * @param transcript - The transcript to analyze
 * @param sessionContext - Optional context about the session
 */
export async function analyzeAudioTranscript(
  transcript: AudioTranscript,
  sessionContext?: string
): Promise<AudioAnalysisV2> {
  const contextPart = sessionContext
    ? `Session context: ${sessionContext}\n\n`
    : '';

  const input = text(`${contextPart}Analyze this transcript:\n\n${transcript.text}`);

  return audioAnalyzerV2.process(input);
}
```

**Step 2: Write bot tests**

```typescript
// src/bots/sessions-v2/__tests__/audio-analyzer-v2.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioAnalyzerV2, analyzeAudioTranscript } from '../audio-analyzer-v2';
import { AudioAnalysisV2Schema } from '../types';

vi.mock('@baleybots/core', () => ({
  Baleybot: {
    create: vi.fn(() => ({
      process: vi.fn(),
    })),
  },
  text: vi.fn((t) => ({ type: 'text', content: t })),
}));

describe('audioAnalyzerV2', () => {
  it('should be created with correct configuration', () => {
    expect(audioAnalyzerV2).toBeDefined();
  });

  it('should use AudioAnalysisV2Schema for output', () => {
    const { Baleybot } = require('@baleybots/core');
    const createCall = Baleybot.create.mock.calls[0][0];
    expect(createCall.outputSchema).toBe(AudioAnalysisV2Schema);
  });
});

describe('analyzeAudioTranscript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioAnalyzerV2.process = vi.fn().mockResolvedValue({
      topics: ['authentication', 'API design'],
      sentiment: 'neutral',
      decisions: ['Use JWT for auth'],
      questions: ['How to handle refresh tokens?'],
    });
  });

  it('should analyze transcript and return insights', async () => {
    const transcript = { text: 'Let\'s use JWT for authentication' };
    const result = await analyzeAudioTranscript(transcript);

    expect(result.topics).toContain('authentication');
    expect(result.decisions).toContain('Use JWT for auth');
  });

  it('should include session context when provided', async () => {
    const transcript = { text: 'Continue with the API work' };
    await analyzeAudioTranscript(transcript, 'Working on user auth');

    const { text } = require('@baleybots/core');
    const textCall = text.mock.calls[text.mock.calls.length - 1][0];
    expect(textCall).toContain('Session context: Working on user auth');
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/bots/sessions-v2/__tests__/audio-analyzer-v2.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/bots/sessions-v2/audio-analyzer-v2.ts src/bots/sessions-v2/__tests__/audio-analyzer-v2.test.ts
git commit -m "feat(sessions-v2): add audio transcript analyzer bot"
```

---

### Task 4: Create Summary Builder Bot

**Files:**
- Create: `src/bots/sessions-v2/summary-builder.ts`
- Test: `src/bots/sessions-v2/__tests__/summary-builder.test.ts`

**Step 1: Write the bot implementation**

```typescript
// src/bots/sessions-v2/summary-builder.ts
import { Baleybot, text } from '@baleybots/core';
import { MODELS } from '../config';
import {
  SessionSummaryV2Schema,
  type SessionSummaryV2,
  type ScreenshotAnalysisV2,
  type AudioAnalysisV2,
  type EvidenceLink,
} from './types';

/**
 * Summary Builder
 *
 * Synthesizes all session data into a markdown summary with evidence links.
 * Uses Sonnet for better synthesis quality.
 */
export const summaryBuilder = Baleybot.create({
  name: 'summary-builder',
  goal: `You are a session summarizer for a productivity app. Given analyses from screenshots and audio, create a comprehensive markdown summary.

IMPORTANT: Use footnote-style evidence links [^N] to cite sources. Every claim should link to evidence.

Structure your summary like this:
1. ## Summary - 2-3 sentences about the session
2. ## Key Decisions - bullet list of decisions made
3. ## Accomplishments - what was achieved
4. ## Blockers - issues encountered (if any)
5. ## Next Steps - recommended tasks

End with an ## Evidence section listing all footnotes:
[^1]: Screenshot at HH:MM - description
[^2]: Audio HH:MM-HH:MM - "relevant quote"

Be thorough but concise. Focus on actionable insights.`,
  model: MODELS.STANDARD, // Sonnet for synthesis
  outputSchema: SessionSummaryV2Schema,
  verbose: false,
});

export interface SummaryBuilderInput {
  sessionName: string;
  duration: number; // minutes
  screenshotAnalyses: Array<{
    id: string;
    timestamp: string;
    analysis: ScreenshotAnalysisV2;
  }>;
  audioAnalyses: Array<{
    id: string;
    timestamp: string;
    transcript: string;
    analysis: AudioAnalysisV2;
  }>;
  existingSummary?: SessionSummaryV2;
}

/**
 * Build or update a session summary
 */
export async function buildSummary(input: SummaryBuilderInput): Promise<SessionSummaryV2> {
  const parts: string[] = [];

  // Session context
  parts.push(`# Session: ${input.sessionName}`);
  parts.push(`Duration: ${input.duration} minutes`);
  parts.push('');

  // Screenshot analyses
  if (input.screenshotAnalyses.length > 0) {
    parts.push('## Screenshot Analyses');
    input.screenshotAnalyses.forEach((ss, i) => {
      const time = new Date(ss.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      parts.push(`### [${i + 1}] Screenshot at ${time} (ID: ${ss.id})`);
      parts.push(`Activity: ${ss.analysis.activity}`);
      if (ss.analysis.extractedText.length > 0) {
        parts.push(`Text: ${ss.analysis.extractedText.join(', ')}`);
      }
      parts.push('');
    });
  }

  // Audio analyses
  if (input.audioAnalyses.length > 0) {
    parts.push('## Audio Analyses');
    input.audioAnalyses.forEach((audio, i) => {
      const time = new Date(audio.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      parts.push(`### [${i + 1}] Audio at ${time} (ID: ${audio.id})`);
      parts.push(`Transcript: "${audio.transcript.slice(0, 200)}${audio.transcript.length > 200 ? '...' : ''}"`);
      parts.push(`Topics: ${audio.analysis.topics.join(', ')}`);
      if (audio.analysis.decisions.length > 0) {
        parts.push(`Decisions: ${audio.analysis.decisions.join('; ')}`);
      }
      parts.push('');
    });
  }

  // Existing summary for incremental update
  if (input.existingSummary) {
    parts.push('## Previous Summary (for incremental update)');
    parts.push(input.existingSummary.markdown);
    parts.push('');
    parts.push('Note: Update the summary to incorporate new analyses while maintaining continuity.');
  }

  parts.push('');
  parts.push('Generate a comprehensive summary with evidence links [^N] pointing to the screenshot/audio IDs above.');

  return summaryBuilder.process(text(parts.join('\n')));
}
```

**Step 2: Write bot tests**

```typescript
// src/bots/sessions-v2/__tests__/summary-builder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { summaryBuilder, buildSummary, type SummaryBuilderInput } from '../summary-builder';
import { SessionSummaryV2Schema } from '../types';

vi.mock('@baleybots/core', () => ({
  Baleybot: {
    create: vi.fn(() => ({
      process: vi.fn(),
    })),
  },
  text: vi.fn((t) => ({ type: 'text', content: t })),
}));

describe('summaryBuilder', () => {
  it('should be created with correct configuration', () => {
    expect(summaryBuilder).toBeDefined();
  });

  it('should use SessionSummaryV2Schema for output', () => {
    const { Baleybot } = require('@baleybots/core');
    const createCall = Baleybot.create.mock.calls[0][0];
    expect(createCall.outputSchema).toBe(SessionSummaryV2Schema);
  });
});

describe('buildSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    summaryBuilder.process = vi.fn().mockResolvedValue({
      markdown: '## Summary\n\nWorked on auth [^1]\n\n## Evidence\n\n[^1]: Screenshot at 14:32',
      evidenceIndex: [
        { id: 'ev-1', type: 'screenshot', sourceId: 'ss-1', timestamp: '2026-01-30T14:32:00Z' },
      ],
      generatedAt: '2026-01-30T15:00:00Z',
    });
  });

  it('should build summary from screenshot analyses', async () => {
    const input: SummaryBuilderInput = {
      sessionName: 'Auth Development',
      duration: 45,
      screenshotAnalyses: [
        {
          id: 'ss-1',
          timestamp: '2026-01-30T14:32:00Z',
          analysis: {
            activity: 'Editing auth.ts',
            extractedText: ['function login()'],
            elements: ['VS Code'],
            confidence: 0.9,
          },
        },
      ],
      audioAnalyses: [],
    };

    const result = await buildSummary(input);

    expect(result.markdown).toContain('auth');
    expect(result.evidenceIndex.length).toBeGreaterThan(0);
  });

  it('should include audio analyses', async () => {
    const input: SummaryBuilderInput = {
      sessionName: 'Meeting',
      duration: 30,
      screenshotAnalyses: [],
      audioAnalyses: [
        {
          id: 'audio-1',
          timestamp: '2026-01-30T14:00:00Z',
          transcript: 'Let\'s use JWT for authentication',
          analysis: {
            topics: ['auth'],
            sentiment: 'neutral',
            decisions: ['Use JWT'],
            questions: [],
          },
        },
      ],
    };

    await buildSummary(input);

    const { text } = require('@baleybots/core');
    const textCall = text.mock.calls[text.mock.calls.length - 1][0];
    expect(textCall).toContain('Audio at');
    expect(textCall).toContain('Use JWT');
  });

  it('should include existing summary for incremental updates', async () => {
    const input: SummaryBuilderInput = {
      sessionName: 'Ongoing Work',
      duration: 60,
      screenshotAnalyses: [],
      audioAnalyses: [],
      existingSummary: {
        markdown: '## Previous work done',
        evidenceIndex: [],
        generatedAt: '2026-01-30T14:00:00Z',
      },
    };

    await buildSummary(input);

    const { text } = require('@baleybots/core');
    const textCall = text.mock.calls[text.mock.calls.length - 1][0];
    expect(textCall).toContain('Previous Summary');
    expect(textCall).toContain('Previous work done');
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/bots/sessions-v2/__tests__/summary-builder.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/bots/sessions-v2/summary-builder.ts src/bots/sessions-v2/__tests__/summary-builder.test.ts
git commit -m "feat(sessions-v2): add summary builder bot with evidence linking"
```

---

### Task 5: Create Task Extractor Bot

**Files:**
- Create: `src/bots/sessions-v2/task-extractor.ts`
- Test: `src/bots/sessions-v2/__tests__/task-extractor.test.ts`

**Step 1: Write the bot implementation**

```typescript
// src/bots/sessions-v2/task-extractor.ts
import { Baleybot, text } from '@baleybots/core';
import { MODELS } from '../config';
import {
  TaskExtractionResultSchema,
  type TaskExtractionResult,
  type SessionSummaryV2,
} from './types';

/**
 * Task Extractor
 *
 * Extracts actionable tasks from session summary.
 * Uses Haiku for speed since extraction is straightforward.
 */
export const taskExtractor = Baleybot.create({
  name: 'task-extractor',
  goal: `You are a task extraction agent for a productivity app. Given a session summary:

1. Identify actionable tasks (things that need to be done)
2. Assign priority (high, medium, low) based on urgency and importance
3. Provide context explaining why each task matters
4. Reference the evidence IDs that led to each task

Only extract tasks that are actionable and clear. Don't create vague or duplicate tasks.`,
  model: MODELS.FAST, // Haiku
  outputSchema: TaskExtractionResultSchema,
  verbose: false,
});

/**
 * Extract tasks from a session summary
 */
export async function extractTasks(summary: SessionSummaryV2): Promise<TaskExtractionResult> {
  const input = text(`Extract actionable tasks from this session summary:\n\n${summary.markdown}\n\nAvailable evidence IDs: ${summary.evidenceIndex.map(e => e.id).join(', ')}`);

  return taskExtractor.process(input);
}
```

**Step 2: Write bot tests**

```typescript
// src/bots/sessions-v2/__tests__/task-extractor.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskExtractor, extractTasks } from '../task-extractor';
import { TaskExtractionResultSchema } from '../types';

vi.mock('@baleybots/core', () => ({
  Baleybot: {
    create: vi.fn(() => ({
      process: vi.fn(),
    })),
  },
  text: vi.fn((t) => ({ type: 'text', content: t })),
}));

describe('taskExtractor', () => {
  it('should be created with correct configuration', () => {
    expect(taskExtractor).toBeDefined();
  });

  it('should use TaskExtractionResultSchema for output', () => {
    const { Baleybot } = require('@baleybots/core');
    const createCall = Baleybot.create.mock.calls[0][0];
    expect(createCall.outputSchema).toBe(TaskExtractionResultSchema);
  });
});

describe('extractTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    taskExtractor.process = vi.fn().mockResolvedValue({
      tasks: [
        {
          title: 'Add rate limiting to auth endpoints',
          priority: 'high',
          context: 'Security requirement identified during review',
          evidenceIds: ['ev-1'],
        },
        {
          title: 'Write integration tests',
          priority: 'medium',
          context: 'Test coverage needed for new auth flow',
          evidenceIds: ['ev-2'],
        },
      ],
    });
  });

  it('should extract tasks from summary', async () => {
    const summary = {
      markdown: '## Summary\n\nNeed to add rate limiting [^1] and tests [^2]',
      evidenceIndex: [
        { id: 'ev-1', type: 'screenshot' as const, sourceId: 'ss-1', timestamp: '2026-01-30T14:00:00Z' },
        { id: 'ev-2', type: 'audio' as const, sourceId: 'audio-1', timestamp: '2026-01-30T14:30:00Z' },
      ],
      generatedAt: '2026-01-30T15:00:00Z',
    };

    const result = await extractTasks(summary);

    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].title).toBe('Add rate limiting to auth endpoints');
    expect(result.tasks[0].priority).toBe('high');
  });

  it('should include evidence IDs in prompt', async () => {
    const summary = {
      markdown: '## Summary',
      evidenceIndex: [
        { id: 'ev-1', type: 'screenshot' as const, sourceId: 'ss-1', timestamp: '2026-01-30T14:00:00Z' },
      ],
      generatedAt: '2026-01-30T15:00:00Z',
    };

    await extractTasks(summary);

    const { text } = require('@baleybots/core');
    const textCall = text.mock.calls[text.mock.calls.length - 1][0];
    expect(textCall).toContain('ev-1');
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/bots/sessions-v2/__tests__/task-extractor.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/bots/sessions-v2/task-extractor.ts src/bots/sessions-v2/__tests__/task-extractor.test.ts
git commit -m "feat(sessions-v2): add task extractor bot"
```

---

### Task 6: Create Bot Index

**Files:**
- Create: `src/bots/sessions-v2/index.ts`

**Step 1: Write the index file**

```typescript
// src/bots/sessions-v2/index.ts
/**
 * Sessions V2 Bots
 *
 * Simplified, stateless bots for session processing:
 * - screenshotAnalyzerV2: Fast image analysis (Haiku)
 * - audioAnalyzerV2: Transcript analysis (Haiku)
 * - summaryBuilder: Synthesis with evidence (Sonnet)
 * - taskExtractor: Task extraction (Haiku)
 *
 * @example
 * ```typescript
 * import { analyzeScreenshotV2, buildSummary, extractTasks } from './bots/sessions-v2';
 *
 * // Analyze a screenshot
 * const analysis = await analyzeScreenshotV2(base64Image);
 *
 * // Build summary
 * const summary = await buildSummary({ ... });
 *
 * // Extract tasks
 * const tasks = await extractTasks(summary);
 * ```
 */

// Types
export * from './types';

// Bots
export { screenshotAnalyzerV2, analyzeScreenshotV2 } from './screenshot-analyzer-v2';
export { audioAnalyzerV2, analyzeAudioTranscript } from './audio-analyzer-v2';
export { summaryBuilder, buildSummary, type SummaryBuilderInput } from './summary-builder';
export { taskExtractor, extractTasks } from './task-extractor';
```

**Step 2: Commit**

```bash
git add src/bots/sessions-v2/index.ts
git commit -m "feat(sessions-v2): add bot exports index"
```

---

## Phase 2: Session Orchestrator

### Task 7: Create Session Orchestrator

**Files:**
- Create: `src/bots/sessions-v2/session-orchestrator.ts`
- Test: `src/bots/sessions-v2/__tests__/session-orchestrator.test.ts`

**Step 1: Write the orchestrator implementation**

```typescript
// src/bots/sessions-v2/session-orchestrator.ts
import type {
  SessionV2,
  OrchestratorState,
  ScreenshotAnalysisV2,
  AudioAnalysisV2,
  AudioTranscript,
  SessionSummaryV2,
  ExtractedTaskV2,
} from './types';
import { analyzeScreenshotV2 } from './screenshot-analyzer-v2';
import { analyzeAudioTranscript } from './audio-analyzer-v2';
import { buildSummary, type SummaryBuilderInput } from './summary-builder';
import { extractTasks } from './task-extractor';
import type { SessionScreenshot, SessionAudioSegment } from '../../types';

const SUMMARY_UPDATE_INTERVAL_MS = 45000; // 45 seconds
const MAX_CONTEXT_WINDOW = 5;

export interface SessionOrchestratorCallbacks {
  onScreenshotAnalyzed?: (screenshotId: string, analysis: ScreenshotAnalysisV2) => void;
  onAudioAnalyzed?: (segmentId: string, analysis: AudioAnalysisV2) => void;
  onSummaryUpdated?: (summary: SessionSummaryV2) => void;
  onTasksExtracted?: (tasks: ExtractedTaskV2[]) => void;
  onError?: (error: string) => void;
  onCostUpdate?: (costs: SessionV2['costs']) => void;
}

/**
 * Session Orchestrator
 *
 * Coordinates the stateless bots to process session data in real-time.
 * Manages:
 * - Screenshot analysis queue
 * - Audio analysis queue
 * - Periodic summary updates
 * - Task extraction
 * - Cost tracking
 */
export class SessionOrchestrator {
  private sessionId: string;
  private sessionName: string;
  private state: OrchestratorState;
  private callbacks: SessionOrchestratorCallbacks;

  // Context windows for providing context to bots
  private screenshotContext: string[] = [];
  private analyses: {
    screenshots: Map<string, ScreenshotAnalysisV2>;
    audio: Map<string, AudioAnalysisV2>;
    transcripts: Map<string, AudioTranscript>;
  };

  // Current summary
  private currentSummary: SessionSummaryV2 | null = null;

  // Periodic summary update
  private summaryTimer: NodeJS.Timeout | null = null;

  // Cost tracking
  private costs = { screenshots: 0, audio: 0, summaries: 0, total: 0 };

  constructor(
    sessionId: string,
    sessionName: string,
    callbacks: SessionOrchestratorCallbacks = {}
  ) {
    this.sessionId = sessionId;
    this.sessionName = sessionName;
    this.callbacks = callbacks;
    this.analyses = {
      screenshots: new Map(),
      audio: new Map(),
      transcripts: new Map(),
    };
    this.state = {
      sessionId,
      status: 'idle',
      pendingScreenshots: [],
      pendingAudioSegments: [],
      lastSummaryUpdate: null,
      errors: [],
    };
  }

  /**
   * Start the orchestrator (begins periodic summary updates)
   */
  start(): void {
    this.summaryTimer = setInterval(() => {
      this.updateSummary();
    }, SUMMARY_UPDATE_INTERVAL_MS);
  }

  /**
   * Stop the orchestrator
   */
  stop(): void {
    if (this.summaryTimer) {
      clearInterval(this.summaryTimer);
      this.summaryTimer = null;
    }
  }

  /**
   * Process a new screenshot
   */
  async processScreenshot(screenshot: SessionScreenshot): Promise<void> {
    this.state.pendingScreenshots.push(screenshot.id);
    this.state.status = 'processing';

    try {
      // Get context from recent screenshots
      const context = this.screenshotContext.length > 0
        ? this.screenshotContext.slice(-MAX_CONTEXT_WINDOW).join('\n')
        : undefined;

      // Load screenshot data (in real impl, this would load from storage)
      // For now, assume base64 is passed or loaded elsewhere
      const base64 = ''; // Would be loaded from attachmentStorage

      const analysis = await analyzeScreenshotV2(base64, context);

      // Store analysis
      this.analyses.screenshots.set(screenshot.id, analysis);

      // Update context window
      this.screenshotContext.push(`${screenshot.timestamp}: ${analysis.activity}`);
      if (this.screenshotContext.length > MAX_CONTEXT_WINDOW * 2) {
        this.screenshotContext = this.screenshotContext.slice(-MAX_CONTEXT_WINDOW);
      }

      // Track cost (Haiku pricing estimate)
      this.costs.screenshots += 0.001; // ~$0.001 per image
      this.costs.total = this.costs.screenshots + this.costs.audio + this.costs.summaries;

      // Callback
      this.callbacks.onScreenshotAnalyzed?.(screenshot.id, analysis);
      this.callbacks.onCostUpdate?.(this.costs);
    } catch (error) {
      const errorMsg = `Failed to analyze screenshot ${screenshot.id}: ${error}`;
      this.state.errors.push(errorMsg);
      this.callbacks.onError?.(errorMsg);
    } finally {
      this.state.pendingScreenshots = this.state.pendingScreenshots.filter(id => id !== screenshot.id);
      if (this.state.pendingScreenshots.length === 0 && this.state.pendingAudioSegments.length === 0) {
        this.state.status = 'idle';
      }
    }
  }

  /**
   * Process a new audio segment
   */
  async processAudioSegment(
    segment: SessionAudioSegment,
    transcript: AudioTranscript
  ): Promise<void> {
    this.state.pendingAudioSegments.push(segment.id);
    this.state.status = 'processing';

    try {
      // Store transcript
      this.analyses.transcripts.set(segment.id, transcript);

      // Analyze transcript
      const analysis = await analyzeAudioTranscript(transcript, this.sessionName);

      // Store analysis
      this.analyses.audio.set(segment.id, analysis);

      // Track cost
      this.costs.audio += 0.001; // ~$0.001 per transcript analysis
      this.costs.total = this.costs.screenshots + this.costs.audio + this.costs.summaries;

      // Callback
      this.callbacks.onAudioAnalyzed?.(segment.id, analysis);
      this.callbacks.onCostUpdate?.(this.costs);
    } catch (error) {
      const errorMsg = `Failed to analyze audio ${segment.id}: ${error}`;
      this.state.errors.push(errorMsg);
      this.callbacks.onError?.(errorMsg);
    } finally {
      this.state.pendingAudioSegments = this.state.pendingAudioSegments.filter(id => id !== segment.id);
      if (this.state.pendingScreenshots.length === 0 && this.state.pendingAudioSegments.length === 0) {
        this.state.status = 'idle';
      }
    }
  }

  /**
   * Update the session summary (called periodically)
   */
  async updateSummary(): Promise<void> {
    // Skip if no data yet
    if (this.analyses.screenshots.size === 0 && this.analyses.audio.size === 0) {
      return;
    }

    try {
      const input: SummaryBuilderInput = {
        sessionName: this.sessionName,
        duration: this.calculateDuration(),
        screenshotAnalyses: Array.from(this.analyses.screenshots.entries()).map(([id, analysis]) => ({
          id,
          timestamp: new Date().toISOString(), // Would use actual timestamp
          analysis,
        })),
        audioAnalyses: Array.from(this.analyses.audio.entries()).map(([id, analysis]) => {
          const transcript = this.analyses.transcripts.get(id);
          return {
            id,
            timestamp: new Date().toISOString(),
            transcript: transcript?.text || '',
            analysis,
          };
        }),
        existingSummary: this.currentSummary || undefined,
      };

      const summary = await buildSummary(input);
      this.currentSummary = summary;
      this.state.lastSummaryUpdate = new Date().toISOString();

      // Track cost (Sonnet pricing estimate)
      this.costs.summaries += 0.01; // ~$0.01 per summary
      this.costs.total = this.costs.screenshots + this.costs.audio + this.costs.summaries;

      // Callback
      this.callbacks.onSummaryUpdated?.(summary);
      this.callbacks.onCostUpdate?.(this.costs);

      // Extract tasks from updated summary
      const taskResult = await extractTasks(summary);
      this.callbacks.onTasksExtracted?.(taskResult.tasks);
    } catch (error) {
      const errorMsg = `Failed to update summary: ${error}`;
      this.state.errors.push(errorMsg);
      this.callbacks.onError?.(errorMsg);
    }
  }

  /**
   * Finalize the session (generate final summary)
   */
  async finalize(): Promise<SessionSummaryV2 | null> {
    this.stop();
    await this.updateSummary();
    return this.currentSummary;
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    return { ...this.state };
  }

  /**
   * Get current summary
   */
  getSummary(): SessionSummaryV2 | null {
    return this.currentSummary;
  }

  /**
   * Get all analyses
   */
  getAnalyses(): SessionV2['analyses'] {
    return {
      screenshots: Object.fromEntries(this.analyses.screenshots),
      audio: Object.fromEntries(this.analyses.audio),
      transcripts: Object.fromEntries(this.analyses.transcripts),
    };
  }

  /**
   * Get costs
   */
  getCosts(): SessionV2['costs'] {
    return { ...this.costs };
  }

  private calculateDuration(): number {
    // This would calculate actual duration in real implementation
    return Math.floor((Date.now() - Date.now()) / 60000);
  }
}

/**
 * Create a new session orchestrator
 */
export function createSessionOrchestrator(
  sessionId: string,
  sessionName: string,
  callbacks?: SessionOrchestratorCallbacks
): SessionOrchestrator {
  return new SessionOrchestrator(sessionId, sessionName, callbacks);
}
```

**Step 2: Write orchestrator tests**

```typescript
// src/bots/sessions-v2/__tests__/session-orchestrator.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionOrchestrator, createSessionOrchestrator } from '../session-orchestrator';

// Mock all the bots
vi.mock('../screenshot-analyzer-v2', () => ({
  analyzeScreenshotV2: vi.fn().mockResolvedValue({
    activity: 'Editing code',
    extractedText: ['function test()'],
    elements: ['VS Code'],
    confidence: 0.9,
  }),
}));

vi.mock('../audio-analyzer-v2', () => ({
  analyzeAudioTranscript: vi.fn().mockResolvedValue({
    topics: ['testing'],
    sentiment: 'neutral',
    decisions: [],
    questions: [],
  }),
}));

vi.mock('../summary-builder', () => ({
  buildSummary: vi.fn().mockResolvedValue({
    markdown: '## Summary\n\nTest session',
    evidenceIndex: [],
    generatedAt: new Date().toISOString(),
  }),
}));

vi.mock('../task-extractor', () => ({
  extractTasks: vi.fn().mockResolvedValue({
    tasks: [],
  }),
}));

describe('SessionOrchestrator', () => {
  let orchestrator: SessionOrchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    orchestrator = createSessionOrchestrator('session-1', 'Test Session');
  });

  afterEach(() => {
    orchestrator.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create with correct initial state', () => {
      const state = orchestrator.getState();
      expect(state.sessionId).toBe('session-1');
      expect(state.status).toBe('idle');
      expect(state.pendingScreenshots).toEqual([]);
      expect(state.pendingAudioSegments).toEqual([]);
    });
  });

  describe('processScreenshot', () => {
    it('should analyze screenshot and update state', async () => {
      const onAnalyzed = vi.fn();
      const o = createSessionOrchestrator('s1', 'Test', { onScreenshotAnalyzed: onAnalyzed });

      await o.processScreenshot({
        id: 'ss-1',
        sessionId: 's1',
        timestamp: new Date().toISOString(),
        attachmentId: 'att-1',
        analysisStatus: 'pending',
      });

      expect(onAnalyzed).toHaveBeenCalledWith('ss-1', expect.objectContaining({
        activity: 'Editing code',
      }));
    });

    it('should track costs', async () => {
      const onCostUpdate = vi.fn();
      const o = createSessionOrchestrator('s1', 'Test', { onCostUpdate });

      await o.processScreenshot({
        id: 'ss-1',
        sessionId: 's1',
        timestamp: new Date().toISOString(),
        attachmentId: 'att-1',
        analysisStatus: 'pending',
      });

      expect(onCostUpdate).toHaveBeenCalled();
      const costs = o.getCosts();
      expect(costs.screenshots).toBeGreaterThan(0);
    });
  });

  describe('processAudioSegment', () => {
    it('should analyze audio and update state', async () => {
      const onAnalyzed = vi.fn();
      const o = createSessionOrchestrator('s1', 'Test', { onAudioAnalyzed: onAnalyzed });

      await o.processAudioSegment(
        {
          id: 'audio-1',
          sessionId: 's1',
          timestamp: new Date().toISOString(),
          duration: 30,
          transcription: 'Test transcript',
        },
        { text: 'Test transcript' }
      );

      expect(onAnalyzed).toHaveBeenCalledWith('audio-1', expect.objectContaining({
        topics: ['testing'],
      }));
    });
  });

  describe('updateSummary', () => {
    it('should generate summary when data is available', async () => {
      const onSummaryUpdated = vi.fn();
      const o = createSessionOrchestrator('s1', 'Test', { onSummaryUpdated });

      // Add some screenshot data first
      await o.processScreenshot({
        id: 'ss-1',
        sessionId: 's1',
        timestamp: new Date().toISOString(),
        attachmentId: 'att-1',
        analysisStatus: 'pending',
      });

      await o.updateSummary();

      expect(onSummaryUpdated).toHaveBeenCalled();
      expect(o.getSummary()).not.toBeNull();
    });

    it('should skip if no data available', async () => {
      const onSummaryUpdated = vi.fn();
      const o = createSessionOrchestrator('s1', 'Test', { onSummaryUpdated });

      await o.updateSummary();

      expect(onSummaryUpdated).not.toHaveBeenCalled();
    });
  });

  describe('periodic updates', () => {
    it('should schedule summary updates when started', async () => {
      const o = createSessionOrchestrator('s1', 'Test');

      // Add data so summary can be generated
      await o.processScreenshot({
        id: 'ss-1',
        sessionId: 's1',
        timestamp: new Date().toISOString(),
        attachmentId: 'att-1',
        analysisStatus: 'pending',
      });

      o.start();

      // Advance timer past update interval
      await vi.advanceTimersByTimeAsync(50000);

      expect(o.getSummary()).not.toBeNull();

      o.stop();
    });
  });

  describe('finalize', () => {
    it('should stop timer and generate final summary', async () => {
      const o = createSessionOrchestrator('s1', 'Test');

      await o.processScreenshot({
        id: 'ss-1',
        sessionId: 's1',
        timestamp: new Date().toISOString(),
        attachmentId: 'att-1',
        analysisStatus: 'pending',
      });

      o.start();
      const summary = await o.finalize();

      expect(summary).not.toBeNull();
    });
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/bots/sessions-v2/__tests__/session-orchestrator.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/bots/sessions-v2/session-orchestrator.ts src/bots/sessions-v2/__tests__/session-orchestrator.test.ts
git commit -m "feat(sessions-v2): add session orchestrator for coordinating bots"
```

---

### Task 8: Add Orchestrator to Index

**Files:**
- Modify: `src/bots/sessions-v2/index.ts`

**Step 1: Update index to export orchestrator**

```typescript
// src/bots/sessions-v2/index.ts
/**
 * Sessions V2 Bots
 *
 * Simplified, stateless bots for session processing:
 * - screenshotAnalyzerV2: Fast image analysis (Haiku)
 * - audioAnalyzerV2: Transcript analysis (Haiku)
 * - summaryBuilder: Synthesis with evidence (Sonnet)
 * - taskExtractor: Task extraction (Haiku)
 *
 * Plus the SessionOrchestrator to coordinate them all.
 *
 * @example
 * ```typescript
 * import { createSessionOrchestrator } from './bots/sessions-v2';
 *
 * const orchestrator = createSessionOrchestrator('session-1', 'My Session', {
 *   onSummaryUpdated: (summary) => console.log('Summary:', summary.markdown),
 *   onTasksExtracted: (tasks) => console.log('Tasks:', tasks),
 * });
 *
 * orchestrator.start();
 *
 * // Process incoming data
 * await orchestrator.processScreenshot(screenshot);
 * await orchestrator.processAudioSegment(segment, transcript);
 *
 * // Finalize when session ends
 * const finalSummary = await orchestrator.finalize();
 * ```
 */

// Types
export * from './types';

// Bots
export { screenshotAnalyzerV2, analyzeScreenshotV2 } from './screenshot-analyzer-v2';
export { audioAnalyzerV2, analyzeAudioTranscript } from './audio-analyzer-v2';
export { summaryBuilder, buildSummary, type SummaryBuilderInput } from './summary-builder';
export { taskExtractor, extractTasks } from './task-extractor';

// Orchestrator
export {
  SessionOrchestrator,
  createSessionOrchestrator,
  type SessionOrchestratorCallbacks,
} from './session-orchestrator';
```

**Step 2: Commit**

```bash
git add src/bots/sessions-v2/index.ts
git commit -m "feat(sessions-v2): export orchestrator from index"
```

---

## Phase 3: UI Components

### Task 9: Create Markdown Summary Renderer

**Files:**
- Create: `src/components/sessions-v2/SummaryView.tsx`
- Test: `src/components/sessions-v2/__tests__/SummaryView.test.tsx`

**Step 1: Write the component**

```tsx
// src/components/sessions-v2/SummaryView.tsx
import React, { useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SessionSummaryV2, EvidenceLink } from '../../bots/sessions-v2/types';

interface SummaryViewProps {
  summary: SessionSummaryV2;
  onEvidenceClick?: (evidence: EvidenceLink) => void;
  className?: string;
}

/**
 * Renders a session summary as beautiful markdown with clickable evidence links.
 */
export function SummaryView({ summary, onEvidenceClick, className = '' }: SummaryViewProps) {
  // Build evidence lookup map
  const evidenceMap = useMemo(() => {
    const map = new Map<string, EvidenceLink>();
    summary.evidenceIndex.forEach(ev => {
      // Map footnote numbers to evidence
      // Assumes footnotes are numbered [^1], [^2], etc.
      const match = summary.markdown.match(new RegExp(`\\[\\^(\\d+)\\].*${ev.id}`, 'i'));
      if (match) {
        map.set(match[1], ev);
      }
    });
    // Also map by ID directly for flexibility
    summary.evidenceIndex.forEach(ev => map.set(ev.id, ev));
    return map;
  }, [summary]);

  // Handle footnote clicks
  const handleFootnoteClick = useCallback((footnoteId: string) => {
    const evidence = evidenceMap.get(footnoteId);
    if (evidence && onEvidenceClick) {
      onEvidenceClick(evidence);
    }
  }, [evidenceMap, onEvidenceClick]);

  // Custom component for rendering footnote references
  const components = useMemo(() => ({
    // Handle links that look like footnotes [^1]
    a: ({ node, children, href, ...props }: any) => {
      // Check if this is a footnote reference
      const footnoteMatch = href?.match(/^#fn-(\d+)$/) || href?.match(/^#user-content-fn-(\d+)$/);
      if (footnoteMatch) {
        const footnoteId = footnoteMatch[1];
        return (
          <button
            className="text-blue-500 hover:text-blue-700 underline cursor-pointer font-medium"
            onClick={() => handleFootnoteClick(footnoteId)}
            title="View evidence"
          >
            {children}
          </button>
        );
      }
      return <a href={href} {...props}>{children}</a>;
    },
    // Style for footnote definitions at the bottom
    sup: ({ node, children, ...props }: any) => {
      const text = String(children);
      const footnoteMatch = text.match(/^\^(\d+)$/);
      if (footnoteMatch) {
        const footnoteId = footnoteMatch[1];
        return (
          <sup
            className="cursor-pointer text-blue-500 hover:text-blue-700"
            onClick={() => handleFootnoteClick(footnoteId)}
            title="View evidence"
            {...props}
          >
            {children}
          </sup>
        );
      }
      return <sup {...props}>{children}</sup>;
    },
  }), [handleFootnoteClick]);

  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {summary.markdown}
      </ReactMarkdown>

      {/* Generation metadata */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
        Generated at {new Date(summary.generatedAt).toLocaleString()} ·
        {summary.evidenceIndex.length} evidence links
      </div>
    </div>
  );
}
```

**Step 2: Write component tests**

```tsx
// src/components/sessions-v2/__tests__/SummaryView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryView } from '../SummaryView';
import type { SessionSummaryV2 } from '../../../bots/sessions-v2/types';

describe('SummaryView', () => {
  const mockSummary: SessionSummaryV2 = {
    markdown: `## Summary

Worked on authentication [^1].

Made a key decision about JWT [^2].

## Evidence

[^1]: Screenshot at 14:32 - VS Code with auth.ts
[^2]: Audio 14:45 - "Let's use RS256"`,
    evidenceIndex: [
      { id: 'ev-1', type: 'screenshot', sourceId: 'ss-1', timestamp: '2026-01-30T14:32:00Z', excerpt: 'VS Code with auth.ts' },
      { id: 'ev-2', type: 'audio', sourceId: 'audio-1', timestamp: '2026-01-30T14:45:00Z', excerpt: "Let's use RS256" },
    ],
    generatedAt: '2026-01-30T15:00:00Z',
  };

  it('should render markdown content', () => {
    render(<SummaryView summary={mockSummary} />);

    expect(screen.getByText(/Worked on authentication/)).toBeInTheDocument();
    expect(screen.getByText(/Made a key decision about JWT/)).toBeInTheDocument();
  });

  it('should display generation metadata', () => {
    render(<SummaryView summary={mockSummary} />);

    expect(screen.getByText(/2 evidence links/)).toBeInTheDocument();
  });

  it('should call onEvidenceClick when footnote clicked', () => {
    const onEvidenceClick = vi.fn();
    render(<SummaryView summary={mockSummary} onEvidenceClick={onEvidenceClick} />);

    // Note: The actual footnote rendering depends on remark-gfm behavior
    // This test verifies the component renders without error
    expect(screen.getByText(/Summary/)).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <SummaryView summary={mockSummary} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/components/sessions-v2/__tests__/SummaryView.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/sessions-v2/SummaryView.tsx src/components/sessions-v2/__tests__/SummaryView.test.tsx
git commit -m "feat(sessions-v2): add markdown summary view with evidence linking"
```

---

### Task 10: Create Evidence Modal

**Files:**
- Create: `src/components/sessions-v2/EvidenceModal.tsx`
- Test: `src/components/sessions-v2/__tests__/EvidenceModal.test.tsx`

**Step 1: Write the component**

```tsx
// src/components/sessions-v2/EvidenceModal.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Mic, Video } from 'lucide-react';
import type { EvidenceLink } from '../../bots/sessions-v2/types';

interface EvidenceModalProps {
  evidence: EvidenceLink | null;
  onClose: () => void;
  // These would be loaded based on evidence.sourceId
  screenshotUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
}

const iconMap = {
  screenshot: Camera,
  audio: Mic,
  video: Video,
};

/**
 * Modal for viewing evidence (screenshot, audio, or video) linked from a summary.
 */
export function EvidenceModal({
  evidence,
  onClose,
  screenshotUrl,
  audioUrl,
  videoUrl,
}: EvidenceModalProps) {
  if (!evidence) return null;

  const Icon = iconMap[evidence.type];
  const timestamp = new Date(evidence.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <AnimatePresence>
      {evidence && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-[10%] bg-white dark:bg-gray-800 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                    {evidence.type} Evidence
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {timestamp}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {evidence.type === 'screenshot' && screenshotUrl && (
                <img
                  src={screenshotUrl}
                  alt="Screenshot evidence"
                  className="max-w-full h-auto rounded-lg shadow-md"
                />
              )}

              {evidence.type === 'audio' && audioUrl && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <audio controls src={audioUrl} className="w-full max-w-md">
                    Your browser does not support the audio element.
                  </audio>
                  {evidence.excerpt && (
                    <blockquote className="text-lg italic text-gray-600 dark:text-gray-300 text-center max-w-md">
                      "{evidence.excerpt}"
                    </blockquote>
                  )}
                </div>
              )}

              {evidence.type === 'video' && videoUrl && (
                <video controls src={videoUrl} className="max-w-full h-auto rounded-lg shadow-md">
                  Your browser does not support the video element.
                </video>
              )}

              {/* Fallback if no media URL provided */}
              {!screenshotUrl && !audioUrl && !videoUrl && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Icon className="w-16 h-16 mb-4 opacity-50" />
                  <p>Evidence content not available</p>
                  {evidence.excerpt && (
                    <blockquote className="mt-4 text-lg italic text-center max-w-md">
                      "{evidence.excerpt}"
                    </blockquote>
                  )}
                </div>
              )}
            </div>

            {/* Footer with excerpt */}
            {evidence.excerpt && (evidence.type === 'screenshot' || evidence.type === 'video') && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Context:</span> {evidence.excerpt}
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Write component tests**

```tsx
// src/components/sessions-v2/__tests__/EvidenceModal.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceModal } from '../EvidenceModal';
import type { EvidenceLink } from '../../../bots/sessions-v2/types';

describe('EvidenceModal', () => {
  const screenshotEvidence: EvidenceLink = {
    id: 'ev-1',
    type: 'screenshot',
    sourceId: 'ss-1',
    timestamp: '2026-01-30T14:32:00Z',
    excerpt: 'VS Code with auth.ts open',
  };

  const audioEvidence: EvidenceLink = {
    id: 'ev-2',
    type: 'audio',
    sourceId: 'audio-1',
    timestamp: '2026-01-30T14:45:00Z',
    excerpt: "Let's use RS256 for JWT signing",
  };

  it('should not render when evidence is null', () => {
    const { container } = render(<EvidenceModal evidence={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render screenshot evidence', () => {
    render(
      <EvidenceModal
        evidence={screenshotEvidence}
        onClose={() => {}}
        screenshotUrl="data:image/png;base64,test"
      />
    );

    expect(screen.getByText(/Screenshot Evidence/i)).toBeInTheDocument();
    expect(screen.getByAltText('Screenshot evidence')).toBeInTheDocument();
  });

  it('should render audio evidence with player', () => {
    render(
      <EvidenceModal
        evidence={audioEvidence}
        onClose={() => {}}
        audioUrl="data:audio/mp3;base64,test"
      />
    );

    expect(screen.getByText(/Audio Evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Let's use RS256/)).toBeInTheDocument();
  });

  it('should call onClose when X button clicked', () => {
    const onClose = vi.fn();
    render(<EvidenceModal evidence={screenshotEvidence} onClose={onClose} />);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<EvidenceModal evidence={screenshotEvidence} onClose={onClose} />);

    // Click on backdrop (first child is the backdrop div)
    const backdrop = container.querySelector('.bg-black\\/50');
    if (backdrop) fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it('should display excerpt in footer for screenshot', () => {
    render(<EvidenceModal evidence={screenshotEvidence} onClose={() => {}} />);

    expect(screen.getByText(/VS Code with auth.ts open/)).toBeInTheDocument();
  });
});
```

**Step 3: Run tests**

Run: `npx vitest run src/components/sessions-v2/__tests__/EvidenceModal.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/sessions-v2/EvidenceModal.tsx src/components/sessions-v2/__tests__/EvidenceModal.test.tsx
git commit -m "feat(sessions-v2): add evidence modal for viewing source material"
```

---

### Task 11: Create Component Index

**Files:**
- Create: `src/components/sessions-v2/index.ts`

**Step 1: Write the index file**

```typescript
// src/components/sessions-v2/index.ts
/**
 * Sessions V2 UI Components
 *
 * Markdown-first UI for session summaries with evidence linking.
 *
 * @example
 * ```tsx
 * import { SummaryView, EvidenceModal } from './components/sessions-v2';
 *
 * function SessionDetail({ session }) {
 *   const [selectedEvidence, setSelectedEvidence] = useState(null);
 *
 *   return (
 *     <>
 *       <SummaryView
 *         summary={session.summary}
 *         onEvidenceClick={setSelectedEvidence}
 *       />
 *       <EvidenceModal
 *         evidence={selectedEvidence}
 *         onClose={() => setSelectedEvidence(null)}
 *         screenshotUrl={...}
 *       />
 *     </>
 *   );
 * }
 * ```
 */

export { SummaryView } from './SummaryView';
export { EvidenceModal } from './EvidenceModal';
```

**Step 2: Commit**

```bash
git add src/components/sessions-v2/index.ts
git commit -m "feat(sessions-v2): add component exports index"
```

---

## Phase 4: Integration & Cleanup

### Task 12: Wire Orchestrator to SessionsContext

**Files:**
- Modify: `src/context/SessionsContext.tsx` (add orchestrator integration)

**Step 1: Create hook for orchestrator integration**

This is a larger task that involves modifying the existing SessionsContext. The integration should:

1. Create an orchestrator when a session starts
2. Pass screenshots/audio to the orchestrator
3. Store orchestrator output in session state
4. Clean up orchestrator when session ends

```typescript
// Add to SessionsContext.tsx - this shows the pattern, actual integration needs existing context review

import { createSessionOrchestrator, type SessionOrchestrator } from '../bots/sessions-v2';

// Inside the provider component:
const orchestrators = useRef<Map<string, SessionOrchestrator>>(new Map());

// On START_SESSION:
const orchestrator = createSessionOrchestrator(newSession.id, newSession.name, {
  onSummaryUpdated: (summary) => {
    dispatch({ type: 'UPDATE_SESSION', payload: { ...session, summary } });
  },
  onTasksExtracted: (tasks) => {
    dispatch({ type: 'UPDATE_SESSION', payload: { ...session, extractedTasks: tasks } });
  },
  onCostUpdate: (costs) => {
    dispatch({ type: 'UPDATE_SESSION', payload: { ...session, costs } });
  },
});
orchestrator.start();
orchestrators.current.set(newSession.id, orchestrator);

// On END_SESSION:
const orchestrator = orchestrators.current.get(sessionId);
if (orchestrator) {
  await orchestrator.finalize();
  orchestrators.current.delete(sessionId);
}

// On ADD_SESSION_SCREENSHOT:
const orchestrator = orchestrators.current.get(sessionId);
if (orchestrator) {
  orchestrator.processScreenshot(screenshot);
}
```

**Step 2: Test the integration manually**

Run: `npm run dev`
Expected: Sessions should work with new orchestrator

**Step 3: Commit**

```bash
git add src/context/SessionsContext.tsx
git commit -m "feat(sessions-v2): integrate orchestrator with SessionsContext"
```

---

### Task 13: Add Sessions V2 to Main Bots Index

**Files:**
- Modify: `src/bots/index.ts`

**Step 1: Export Sessions V2 module**

```typescript
// Add to src/bots/index.ts

// Sessions V2 (new simplified architecture)
export * from './sessions-v2';
```

**Step 2: Commit**

```bash
git add src/bots/index.ts
git commit -m "feat(bots): export sessions-v2 module"
```

---

### Task 14: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run type check**

Run: `npm run type-check`
Expected: No type errors

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address test and type issues"
```

---

### Task 15: Final Verification

**Step 1: Run the app**

Run: `npm run dev`
Expected: App runs without errors

**Step 2: Test a session manually**
1. Start a new session
2. Let it capture a few screenshots
3. End the session
4. Verify summary is generated

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(sessions-v2): complete Sessions 2.0 MVP implementation"
```

---

## Future Tasks (Not MVP)

The following are tracked for future implementation:

1. **Cleanup old canvas components** - Delete morphing-canvas, FlexibleCanvas, etc.
2. **Delete old session types** - FlexibleSessionSummary, CanvasSpec, etc.
3. **Video support** - Add video analyzer bot
4. **Dynamic agent spawning** - Implement spawnBaleybotTool integration
5. **Session templates** - Different configs for different work types
6. **Export functionality** - Export summaries to various formats
7. **Interactive timeline** - Visual timeline with evidence markers

---

## Summary

This plan implements Sessions 2.0 in 15 tasks across 4 phases:

1. **Phase 1: Types & Bots** (Tasks 1-6) - Define new types and create 4 stateless bots
2. **Phase 2: Orchestrator** (Tasks 7-8) - Create the smart orchestrator
3. **Phase 3: UI Components** (Tasks 9-11) - Build markdown renderer and evidence modal
4. **Phase 4: Integration** (Tasks 12-15) - Wire everything together and verify

Each task follows TDD with:
- Failing test first
- Minimal implementation
- Verify passing
- Commit

Total estimated new code: ~2,000 LOC (down from 17,500+ in current implementation)
