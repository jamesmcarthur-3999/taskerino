# Baleybots Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace taskerino's 7 fragmented AI services with unified Baleybots SDK implementations for type-safe, composable, and maintainable AI functionality.

**Architecture:** Create a `src/bots/` directory containing Baleybot definitions with Zod schemas for type-safe outputs. Each bot maps 1:1 to an existing service's functionality. Use `@baleybots/core` for bot definitions, `@baleybots/chat` for conversation management, and `@baleybots/react` for React integration hooks.

**Tech Stack:** @baleybots/core, @baleybots/chat, @baleybots/react, Zod for schemas, existing Tauri commands for API calls

---

## Phase 1: Foundation & Infrastructure

### Task 1: Create Bot Configuration Module

**Files:**
- Create: `src/bots/config.ts`
- Create: `src/bots/index.ts`

**Step 1: Create the config module with API key management**

```typescript
// src/bots/config.ts
import { setDefaultApiKey, anthropic, openai } from '@baleybots/core';
import { invoke } from '@tauri-apps/api/core';

export interface BotConfig {
  claudeApiKey?: string;
  openaiApiKey?: string;
  verbose?: boolean;
}

let isInitialized = false;

/**
 * Initialize Baleybots with API keys from Tauri secure storage
 */
export async function initializeBots(): Promise<void> {
  if (isInitialized) return;

  try {
    const claudeKey = await invoke<string | null>('get_claude_api_key');
    const openaiKey = await invoke<string | null>('get_openai_api_key');

    if (claudeKey) {
      setDefaultApiKey('anthropic', claudeKey);
    }
    if (openaiKey) {
      setDefaultApiKey('openai', openaiKey);
    }

    isInitialized = true;
  } catch (error) {
    console.error('[Baleybots] Failed to initialize:', error);
    throw new Error('Failed to initialize Baleybots - check API key configuration');
  }
}

/**
 * Update API keys at runtime (called from settings)
 */
export async function updateApiKeys(config: BotConfig): Promise<void> {
  if (config.claudeApiKey) {
    setDefaultApiKey('anthropic', config.claudeApiKey);
    await invoke('set_claude_api_key', { apiKey: config.claudeApiKey });
  }
  if (config.openaiApiKey) {
    setDefaultApiKey('openai', config.openaiApiKey);
    await invoke('set_openai_api_key', { apiKey: config.openaiApiKey });
  }
}

/**
 * Check if bots are ready to use
 */
export function isBotsReady(): boolean {
  return isInitialized;
}

// Model configurations
export const MODELS = {
  // Fast model for real-time analysis (screenshots, search)
  FAST: anthropic('claude-haiku-4-5-20251001'),
  // Standard model for comprehensive tasks (summaries, processing)
  STANDARD: anthropic('claude-sonnet-4-5-20250929'),
  // Audio model for transcription and analysis
  AUDIO: openai('gpt-4o-audio-preview'),
} as const;
```

**Step 2: Create the main index export**

```typescript
// src/bots/index.ts
// Configuration
export { initializeBots, updateApiKeys, isBotsReady, MODELS } from './config';
export type { BotConfig } from './config';

// Bots will be added here as we create them
// export { screenshotAnalyzer } from './screenshot-analyzer';
// export { sessionSummarizer } from './session-summarizer';
// export { nedAssistant } from './ned-assistant';
// etc.
```

**Step 3: Verify TypeScript compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/config.ts src/bots/index.ts`
Expected: No errors

**Step 4: Commit**

```bash
git add src/bots/
git commit -m "feat(bots): add Baleybots configuration and initialization

- Add API key management via Tauri secure storage
- Define model configurations (FAST, STANDARD, AUDIO)
- Create initialization flow for bot system

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Create Shared Type Definitions

**Files:**
- Create: `src/bots/types.ts`

**Step 1: Define shared output schemas using Zod**

```typescript
// src/bots/types.ts
import { z } from 'zod';

// ============================================================================
// SCREENSHOT ANALYSIS TYPES
// ============================================================================

export const ProgressIndicatorsSchema = z.object({
  achievements: z.array(z.string()).describe('Completed milestones'),
  blockers: z.array(z.string()).describe('Errors or obstacles encountered'),
  insights: z.array(z.string()).describe('Learnings discovered'),
});

export const ScreenshotAnalysisSchema = z.object({
  summary: z.string().describe('1-2 sentences of what was accomplished'),
  detectedActivity: z.string().describe('Activity type, e.g., "Debugging auth flow"'),
  extractedText: z.string().describe('Important text: URLs, errors, data'),
  keyElements: z.array(z.string()).describe('Key UI elements or actions'),
  suggestedActions: z.array(z.string()).describe('Actionable items'),
  contextDelta: z.string().describe('What changed or progressed since last screenshot'),
  confidence: z.number().min(0).max(1).describe('Confidence based on image clarity'),
  curiosity: z.number().min(0).max(1).describe('Interest score for next screenshot timing'),
  curiosityReason: z.string().describe('Why this curiosity score'),
  progressIndicators: ProgressIndicatorsSchema,
});

export type ScreenshotAnalysis = z.infer<typeof ScreenshotAnalysisSchema>;

// ============================================================================
// SESSION SUMMARY TYPES
// ============================================================================

export const RecommendedTaskSchema = z.object({
  title: z.string(),
  context: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  relatedScreenshotIds: z.array(z.string()),
});

export const KeyInsightSchema = z.object({
  insight: z.string(),
  timestamp: z.string().describe('ISO timestamp'),
  screenshotIds: z.array(z.string()),
});

export const FocusAreaSchema = z.object({
  area: z.string(),
  duration: z.number().describe('Duration in minutes'),
  percentage: z.number(),
});

export const SessionSummarySchema = z.object({
  narrative: z.string().describe('1-2 paragraph story of the session'),
  achievements: z.array(z.string()),
  blockers: z.array(z.string()),
  recommendedTasks: z.array(RecommendedTaskSchema),
  keyInsights: z.array(KeyInsightSchema),
  focusAreas: z.array(FocusAreaSchema),
  category: z.string().describe('Work category'),
  subCategory: z.string().describe('Specific work type'),
  tags: z.array(z.string()).describe('Searchable keywords'),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

// ============================================================================
// AUDIO REVIEW TYPES
// ============================================================================

export const EmotionalMomentSchema = z.object({
  timestamp: z.number().describe('Seconds from start'),
  emotion: z.string(),
  description: z.string(),
});

export const KeyMomentSchema = z.object({
  timestamp: z.number().describe('Seconds from start'),
  type: z.string().describe('Type of moment: breakthrough, blocker, decision'),
  description: z.string(),
  context: z.string(),
  excerpt: z.string().describe('Direct quote from audio'),
});

export const FlowStateSchema = z.object({
  start: z.number(),
  end: z.number(),
  description: z.string(),
});

export const AudioInsightsSchema = z.object({
  narrative: z.string().describe('Overall audio narrative'),
  emotionalJourney: z.array(EmotionalMomentSchema),
  keyMoments: z.array(KeyMomentSchema),
  workPatterns: z.object({
    focusLevel: z.enum(['high', 'medium', 'low']),
    interruptions: z.number(),
    flowStates: z.array(FlowStateSchema),
  }),
  environmentalContext: z.object({
    workSetting: z.string(),
    ambientNoise: z.string(),
    timeOfDay: z.string(),
  }),
});

export type AudioInsights = z.infer<typeof AudioInsightsSchema>;

// ============================================================================
// CAPTURE PROCESSING TYPES
// ============================================================================

export const DetectedTopicSchema = z.object({
  name: z.string(),
  type: z.enum(['company', 'person', 'other']),
  confidence: z.number().min(0).max(1),
  existingTopicId: z.string().optional(),
});

export const ExtractedNoteSchema = z.object({
  topicId: z.string().describe('"new" if creating new topic'),
  topicName: z.string(),
  content: z.string().describe('Markdown content'),
  summary: z.string(),
  sourceText: z.string(),
  isNew: z.boolean(),
  mergedWith: z.string().optional(),
  tags: z.array(z.string()),
  source: z.enum(['call', 'email', 'thought', 'other']),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  keyPoints: z.array(z.string()),
  relatedTopics: z.array(z.string()),
});

export const ExtractedTaskSchema = z.object({
  title: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  dueDate: z.string().optional().describe('YYYY-MM-DD format'),
  dueTime: z.string().optional().describe('HH:MM format'),
  dueDateReasoning: z.string(),
  description: z.string(),
  sourceExcerpt: z.string(),
  tags: z.array(z.string()),
  suggestedSubtasks: z.array(z.string()),
  topicId: z.string().optional(),
});

export const CaptureResultSchema = z.object({
  detectedTopics: z.array(DetectedTopicSchema),
  notes: z.array(ExtractedNoteSchema),
  tasks: z.array(ExtractedTaskSchema),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  keyTopics: z.array(z.string()),
});

export type CaptureResult = z.infer<typeof CaptureResultSchema>;

// ============================================================================
// SEARCH TYPES
// ============================================================================

export const SearchResultSchema = z.object({
  noteIds: z.array(z.string()).describe('IDs of matching notes'),
  taskIds: z.array(z.string()).describe('IDs of matching tasks'),
  summary: z.string().describe('Text summary of results'),
  suggestions: z.array(z.string()).optional().describe('Follow-up search suggestions'),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SessionSearchResultSchema = z.object({
  sessionIds: z.array(z.string()).describe('IDs of matching sessions'),
  summary: z.string().describe('Text summary of results'),
  suggestions: z.array(z.string()).optional(),
});

export type SessionSearchResult = z.infer<typeof SessionSearchResultSchema>;
```

**Step 2: Add Zod as a dependency**

Run: `cd /Users/jamesmcarthur/taskerino && npm install zod`
Expected: zod added to package.json

**Step 3: Verify types compile**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/types.ts`
Expected: No errors

**Step 4: Update index exports**

```typescript
// Add to src/bots/index.ts
export * from './types';
```

**Step 5: Commit**

```bash
git add src/bots/types.ts package.json package-lock.json
git commit -m "feat(bots): add Zod schemas for bot output types

- Screenshot analysis schema with progress indicators
- Session summary schema with tasks and insights
- Audio insights schema with emotional journey
- Capture processing schema for notes/tasks extraction
- Search result schemas

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Core Bot Implementations

### Task 3: Screenshot Analyzer Bot

**Files:**
- Create: `src/bots/screenshot-analyzer.ts`
- Replaces: `src/services/sessionsAgentService.ts` (analyzeScreenshot method)

**Step 1: Create the screenshot analyzer bot**

```typescript
// src/bots/screenshot-analyzer.ts
import { Baleybot, image, combine, text } from '@baleybots/core';
import { MODELS } from './config';
import { ScreenshotAnalysisSchema, type ScreenshotAnalysis } from './types';

// Context window for maintaining screenshot history
const contextWindows = new Map<string, string[]>();
const MAX_CONTEXT_WINDOW = 5;

/**
 * Get context summary for a session
 */
function getContextSummary(sessionId: string): string {
  const context = contextWindows.get(sessionId) || [];
  if (context.length === 0) return 'This is the first screenshot in the session.';
  return `Previous ${context.length} screenshot summaries:\n${context.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
}

/**
 * Update context window with new summary
 */
function updateContext(sessionId: string, summary: string): void {
  const context = contextWindows.get(sessionId) || [];
  context.push(summary);
  if (context.length > MAX_CONTEXT_WINDOW) {
    context.shift();
  }
  contextWindows.set(sessionId, context);
}

/**
 * Clear context for a session (call when session ends)
 */
export function clearScreenshotContext(sessionId: string): void {
  contextWindows.delete(sessionId);
}

/**
 * Screenshot Analyzer Bot
 *
 * Analyzes screenshots during active sessions to detect activity,
 * extract text, and track progress.
 */
export const screenshotAnalyzer = Baleybot.create({
  name: 'screenshot-analyzer',
  goal: `You are a screenshot analysis agent for a productivity app. Analyze screenshots from work sessions to:

1. Detect the current activity (coding, meetings, research, etc.)
2. Extract important visible text (URLs, errors, data)
3. Identify key UI elements and actions being performed
4. Track progress: achievements, blockers, and insights
5. Determine how "curious" you are to see the next screenshot (0-1)

Be concise but thorough. Focus on actionable insights.`,
  model: MODELS.FAST,
  outputSchema: ScreenshotAnalysisSchema,
  verbose: false,
});

/**
 * Analyze a screenshot with session context
 */
export async function analyzeScreenshot(
  screenshotBase64: string,
  sessionId: string,
  sessionName: string,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<ScreenshotAnalysis> {
  const contextSummary = getContextSummary(sessionId);

  const input = combine(
    text(`Session: "${sessionName}"\n\nContext:\n${contextSummary}\n\nAnalyze this screenshot:`),
    image({ data: screenshotBase64, mediaType: mimeType })
  );

  const result = await screenshotAnalyzer.process(input);

  // Update context window with this analysis
  updateContext(sessionId, result.summary);

  return result;
}
```

**Step 2: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/screenshot-analyzer.ts`
Expected: No errors

**Step 3: Update index exports**

```typescript
// Add to src/bots/index.ts
export { screenshotAnalyzer, analyzeScreenshot, clearScreenshotContext } from './screenshot-analyzer';
```

**Step 4: Commit**

```bash
git add src/bots/screenshot-analyzer.ts src/bots/index.ts
git commit -m "feat(bots): add screenshot analyzer bot

- Uses Claude Haiku for fast real-time analysis
- Maintains sliding window context (last 5 screenshots)
- Type-safe output with Zod schema validation
- Replaces sessionsAgentService.analyzeScreenshot

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Session Summarizer Bot

**Files:**
- Create: `src/bots/session-summarizer.ts`
- Replaces: `src/services/sessionsAgentService.ts` (generateSessionSummary method)

**Step 1: Create the session summarizer bot**

```typescript
// src/bots/session-summarizer.ts
import { Baleybot, text } from '@baleybots/core';
import { MODELS } from './config';
import { SessionSummarySchema, type SessionSummary } from './types';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../types';

/**
 * Session Summarizer Bot
 *
 * Generates comprehensive summaries of completed work sessions
 * by analyzing screenshots, audio transcriptions, and metadata.
 */
export const sessionSummarizer = Baleybot.create({
  name: 'session-summarizer',
  goal: `You are a session analysis agent that creates comprehensive summaries of work sessions. Given session data including:
- Session metadata (name, description, duration)
- Screenshot analyses (what was visible/happening)
- Audio transcriptions (what was said)

Generate a detailed summary that:
1. Tells the story of the session (narrative)
2. Lists achievements and blockers
3. Recommends follow-up tasks with priorities
4. Extracts key insights with timestamps
5. Identifies focus areas with time allocation
6. Categorizes the work type
7. Generates searchable tags

Be thorough but organized. Focus on actionable insights.`,
  model: MODELS.STANDARD,
  outputSchema: SessionSummarySchema,
  verbose: false,
});

/**
 * Format session data for the summarizer
 */
function formatSessionContext(
  session: Session,
  screenshots: SessionScreenshot[],
  audioSegments?: SessionAudioSegment[]
): string {
  const parts: string[] = [];

  // Session metadata
  parts.push(`## Session: ${session.name}`);
  if (session.description) {
    parts.push(`Description: ${session.description}`);
  }
  parts.push(`Duration: ${session.startTime} to ${session.endTime || 'ongoing'}`);
  parts.push(`Status: ${session.status}`);
  parts.push('');

  // Screenshots with analyses
  if (screenshots.length > 0) {
    parts.push('## Screenshots Analysis');
    screenshots.forEach((ss, i) => {
      parts.push(`### Screenshot ${i + 1} (${ss.timestamp})`);
      if (ss.aiAnalysis) {
        parts.push(`Activity: ${ss.aiAnalysis.detectedActivity}`);
        parts.push(`Summary: ${ss.aiAnalysis.summary}`);
        if (ss.aiAnalysis.extractedText) {
          parts.push(`Text: ${ss.aiAnalysis.extractedText}`);
        }
        if (ss.aiAnalysis.progressIndicators) {
          const pi = ss.aiAnalysis.progressIndicators;
          if (pi.achievements?.length) parts.push(`Achievements: ${pi.achievements.join(', ')}`);
          if (pi.blockers?.length) parts.push(`Blockers: ${pi.blockers.join(', ')}`);
          if (pi.insights?.length) parts.push(`Insights: ${pi.insights.join(', ')}`);
        }
      }
      parts.push('');
    });
  }

  // Audio transcriptions
  if (audioSegments && audioSegments.length > 0) {
    parts.push('## Audio Transcriptions');
    audioSegments.forEach((seg, i) => {
      parts.push(`### Segment ${i + 1} (${seg.timestamp}, ${seg.duration}s)`);
      parts.push(seg.transcription);
      if (seg.keyPhrases?.length) {
        parts.push(`Key phrases: ${seg.keyPhrases.join(', ')}`);
      }
      parts.push('');
    });
  }

  return parts.join('\n');
}

/**
 * Generate a comprehensive session summary
 */
export async function summarizeSession(
  session: Session,
  screenshots: SessionScreenshot[],
  audioSegments?: SessionAudioSegment[]
): Promise<SessionSummary> {
  const context = formatSessionContext(session, screenshots, audioSegments);

  return sessionSummarizer.process(text(context));
}
```

**Step 2: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/session-summarizer.ts`
Expected: No errors

**Step 3: Update index exports**

```typescript
// Add to src/bots/index.ts
export { sessionSummarizer, summarizeSession } from './session-summarizer';
```

**Step 4: Commit**

```bash
git add src/bots/session-summarizer.ts src/bots/index.ts
git commit -m "feat(bots): add session summarizer bot

- Uses Claude Sonnet for comprehensive analysis
- Processes screenshots, audio, and metadata
- Generates narrative, tasks, insights, and tags
- Replaces sessionsAgentService.generateSessionSummary

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Audio Reviewer Bot

**Files:**
- Create: `src/bots/audio-reviewer.ts`
- Replaces: `src/services/audioReviewService.ts`

**Step 1: Create the audio reviewer bot**

```typescript
// src/bots/audio-reviewer.ts
import { Baleybot, audio, text, combine } from '@baleybots/core';
import { MODELS } from './config';
import { AudioInsightsSchema, type AudioInsights } from './types';

/**
 * Audio Reviewer Bot
 *
 * Analyzes session audio recordings to extract insights,
 * emotional patterns, and key moments.
 */
export const audioReviewer = Baleybot.create({
  name: 'audio-reviewer',
  goal: `You are an audio analysis agent for a productivity app. Given audio from a work session, analyze:

1. Overall narrative - what was the session about?
2. Emotional journey - detect emotional states throughout
3. Key moments - breakthroughs, blockers, decisions
4. Work patterns - focus level, interruptions, flow states
5. Environmental context - work setting, ambient noise, time of day

Provide timestamps in seconds from the start of the audio.
Be thorough in identifying actionable insights.`,
  model: MODELS.AUDIO,
  outputSchema: AudioInsightsSchema,
  verbose: false,
});

// Cost estimation constants
const COST_PER_MINUTE = 0.026; // GPT-4o audio preview pricing

/**
 * Estimate cost for audio review
 */
export function estimateAudioReviewCost(durationSeconds: number): {
  cost: number;
  duration: number;
} {
  const minutes = durationSeconds / 60;
  return {
    cost: minutes * COST_PER_MINUTE,
    duration: durationSeconds,
  };
}

/**
 * Review audio and extract insights
 *
 * @param audioBase64 - Base64 encoded audio (MP3 format recommended)
 * @param sessionName - Name of the session for context
 * @param format - Audio format (default: mp3)
 */
export async function reviewAudio(
  audioBase64: string,
  sessionName: string,
  format: 'mp3' | 'wav' | 'webm' = 'mp3'
): Promise<AudioInsights> {
  const input = combine(
    text(`Session: "${sessionName}"\n\nAnalyze this audio recording:`),
    audio({ data: audioBase64, format })
  );

  return audioReviewer.process(input);
}

/**
 * Review audio in chunks for long sessions (>25 minutes)
 *
 * @param audioChunks - Array of base64 encoded audio chunks
 * @param sessionName - Name of the session
 * @param format - Audio format
 */
export async function reviewAudioChunked(
  audioChunks: string[],
  sessionName: string,
  format: 'mp3' | 'wav' | 'webm' = 'mp3'
): Promise<AudioInsights[]> {
  const results: AudioInsights[] = [];

  for (let i = 0; i < audioChunks.length; i++) {
    const chunkContext = audioChunks.length > 1
      ? `Session: "${sessionName}" (Part ${i + 1}/${audioChunks.length})`
      : `Session: "${sessionName}"`;

    const input = combine(
      text(`${chunkContext}\n\nAnalyze this audio recording:`),
      audio({ data: audioChunks[i], format })
    );

    const result = await audioReviewer.process(input);
    results.push(result);
  }

  return results;
}
```

**Step 2: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/audio-reviewer.ts`
Expected: No errors

**Step 3: Update index exports**

```typescript
// Add to src/bots/index.ts
export {
  audioReviewer,
  reviewAudio,
  reviewAudioChunked,
  estimateAudioReviewCost
} from './audio-reviewer';
```

**Step 4: Commit**

```bash
git add src/bots/audio-reviewer.ts src/bots/index.ts
git commit -m "feat(bots): add audio reviewer bot

- Uses GPT-4o audio preview for analysis
- Extracts emotional journey and key moments
- Supports chunked processing for long sessions
- Cost estimation included
- Replaces audioReviewService

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Capture Processor Bot

**Files:**
- Create: `src/bots/capture-processor.ts`
- Replaces: `src/services/claudeService.ts` (processInput method)

**Step 1: Create the capture processor bot**

```typescript
// src/bots/capture-processor.ts
import { Baleybot, text, image, combine } from '@baleybots/core';
import { MODELS } from './config';
import { CaptureResultSchema, type CaptureResult } from './types';
import type { Topic, Note, Task, Attachment } from '../types';

/**
 * Build system prompt with existing data context
 */
function buildSystemPrompt(
  existingTopics: Topic[],
  existingNotes: Note[],
  existingTasks: Task[],
  systemInstructions?: string
): string {
  const parts: string[] = [];

  parts.push(`You are an intelligent note and task processor for a productivity app.

Your job is to:
1. Detect topics (companies, people, projects) with confidence scores
2. Create or merge notes with appropriate topics
3. Extract tasks with priorities and due dates
4. Understand temporal references (EOD, next week, ASAP)

Topic hierarchy:
- PRIMARY: Companies, organizations
- SECONDARY: People, contacts
- TERTIARY: Projects, features, concepts`);

  if (systemInstructions) {
    parts.push(`\n\nUser's custom instructions:\n${systemInstructions}`);
  }

  // Existing topics for matching
  if (existingTopics.length > 0) {
    const topicList = existingTopics
      .slice(0, 50) // Limit to prevent token overflow
      .map(t => `- ${t.name} (${t.type}, id: ${t.id})`)
      .join('\n');
    parts.push(`\n\nExisting topics (match when confidence > 0.7):\n${topicList}`);
  }

  // Recent notes for deduplication
  if (existingNotes.length > 0) {
    const noteList = existingNotes
      .slice(0, 20)
      .map(n => `- [${n.id}] ${n.summary || n.content.slice(0, 100)}`)
      .join('\n');
    parts.push(`\n\nRecent notes (merge if similar, >30% overlap):\n${noteList}`);
  }

  // Recent tasks for deduplication
  if (existingTasks.length > 0) {
    const taskList = existingTasks
      .filter(t => !t.done)
      .slice(0, 20)
      .map(t => `- [${t.id}] ${t.title}`)
      .join('\n');
    parts.push(`\n\nOpen tasks (skip duplicates):\n${taskList}`);
  }

  return parts.join('\n');
}

/**
 * Capture Processor Bot
 *
 * Processes user input (notes, thoughts, transcripts) to extract
 * topics, notes, and tasks.
 */
export function createCaptureProcessor(
  existingTopics: Topic[],
  existingNotes: Note[],
  existingTasks: Task[],
  systemInstructions?: string
) {
  return Baleybot.create({
    name: 'capture-processor',
    goal: buildSystemPrompt(existingTopics, existingNotes, existingTasks, systemInstructions),
    model: MODELS.STANDARD,
    outputSchema: CaptureResultSchema,
    verbose: false,
  });
}

/**
 * Process captured input (text and optional attachments)
 */
export async function processCapture(
  inputText: string,
  existingTopics: Topic[],
  existingNotes: Note[],
  existingTasks: Task[],
  systemInstructions?: string,
  attachments?: Attachment[]
): Promise<CaptureResult> {
  const processor = createCaptureProcessor(
    existingTopics,
    existingNotes,
    existingTasks,
    systemInstructions
  );

  // Build input with optional images
  if (attachments && attachments.length > 0) {
    const imageAttachments = attachments.filter(a =>
      a.type === 'image' || a.type === 'screenshot'
    );

    if (imageAttachments.length > 0) {
      const parts = [text(inputText)];

      for (const att of imageAttachments) {
        if (att.base64) {
          parts.push(image({
            data: att.base64,
            mediaType: (att.mimeType || 'image/png') as 'image/png' | 'image/jpeg'
          }));
        }
      }

      return processor.process(combine(...parts));
    }
  }

  return processor.process(text(inputText));
}
```

**Step 2: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/capture-processor.ts`
Expected: No errors

**Step 3: Update index exports**

```typescript
// Add to src/bots/index.ts
export { createCaptureProcessor, processCapture } from './capture-processor';
```

**Step 4: Commit**

```bash
git add src/bots/capture-processor.ts src/bots/index.ts
git commit -m "feat(bots): add capture processor bot

- Processes text input with optional images
- Detects topics with confidence scoring
- Extracts notes and tasks
- Context-aware (uses existing data for dedup)
- Replaces claudeService.processInput

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Context Searcher Bot

**Files:**
- Create: `src/bots/context-searcher.ts`
- Replaces: `src/services/contextAgent.ts`

**Step 1: Create the context searcher bot**

```typescript
// src/bots/context-searcher.ts
import { Baleybot, text } from '@baleybots/core';
import { ChatBot, History, MemoryStorage } from '@baleybots/chat';
import { MODELS } from './config';
import { SearchResultSchema, type SearchResult } from './types';
import type { Note, Task, Topic, Company, Contact } from '../types';

// Thread storage for multi-turn conversations
const threadHistories = new Map<string, History>();

/**
 * Get or create history for a thread
 */
function getThreadHistory(threadId: string): History {
  if (!threadHistories.has(threadId)) {
    threadHistories.set(threadId, new History({
      storage: new MemoryStorage(),
      maxMessages: 20,
    }));
  }
  return threadHistories.get(threadId)!;
}

/**
 * Clear a thread's history
 */
export function clearSearchThread(threadId: string): void {
  threadHistories.delete(threadId);
}

/**
 * Create a new search thread ID
 */
export function createSearchThread(): string {
  return `search-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build search context from data
 */
function buildSearchContext(
  notes: Note[],
  tasks: Task[],
  topics: Topic[],
  companies: Company[],
  contacts: Contact[]
): string {
  const parts: string[] = [];

  // Notes
  if (notes.length > 0) {
    parts.push('## Notes');
    notes.forEach(n => {
      const meta = [
        n.timestamp,
        n.source,
        n.sentiment,
        n.tags?.join(', ')
      ].filter(Boolean).join(' | ');
      parts.push(`[${n.id}] ${n.summary || n.content.slice(0, 150)} (${meta})`);
    });
    parts.push('');
  }

  // Tasks
  if (tasks.length > 0) {
    parts.push('## Tasks');
    tasks.forEach(t => {
      const status = t.done ? '✓' : '○';
      const meta = [t.priority, t.dueDate, t.tags?.join(', ')].filter(Boolean).join(' | ');
      parts.push(`${status} [${t.id}] ${t.title} (${meta})`);
    });
    parts.push('');
  }

  // Topics, Companies, Contacts
  if (topics.length > 0) {
    parts.push(`## Topics: ${topics.map(t => t.name).join(', ')}`);
  }
  if (companies.length > 0) {
    parts.push(`## Companies: ${companies.map(c => c.name).join(', ')}`);
  }
  if (contacts.length > 0) {
    parts.push(`## Contacts: ${contacts.map(c => c.name).join(', ')}`);
  }

  return parts.join('\n');
}

/**
 * Context Searcher Bot
 *
 * Searches notes and tasks using natural language queries.
 * Supports multi-turn conversations for refinement.
 */
export const contextSearcher = Baleybot.create({
  name: 'context-searcher',
  goal: `You are a search agent for a productivity app. Given a search query and database of notes/tasks:

1. Find relevant items matching the query
2. Support temporal queries ("last week", "today", "this month")
3. Filter by priority, status, tags, topics
4. Return IDs of matching items
5. Provide a helpful summary of results
6. Suggest follow-up queries if helpful

Return only IDs that exist in the provided data.`,
  model: MODELS.FAST,
  outputSchema: SearchResultSchema,
  verbose: false,
});

/**
 * Search notes and tasks
 */
export async function searchContext(
  query: string,
  notes: Note[],
  tasks: Task[],
  topics: Topic[],
  companies: Company[],
  contacts: Contact[],
  threadId?: string
): Promise<SearchResult & { threadId: string }> {
  const context = buildSearchContext(notes, tasks, topics, companies, contacts);

  const searchPrompt = `## Data\n${context}\n\n## Query\n${query}`;

  // If thread provided, use ChatBot for multi-turn
  if (threadId) {
    const history = getThreadHistory(threadId);
    const chat = ChatBot.forUser(contextSearcher, { historyManager: history });
    const result = await chat.send(searchPrompt);
    return { ...result, threadId };
  }

  // Single-turn search
  const newThreadId = createSearchThread();
  const result = await contextSearcher.process(text(searchPrompt));
  return { ...result, threadId: newThreadId };
}
```

**Step 2: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/context-searcher.ts`
Expected: No errors

**Step 3: Update index exports**

```typescript
// Add to src/bots/index.ts
export {
  contextSearcher,
  searchContext,
  clearSearchThread,
  createSearchThread
} from './context-searcher';
```

**Step 4: Commit**

```bash
git add src/bots/context-searcher.ts src/bots/index.ts
git commit -m "feat(bots): add context searcher bot

- Uses Claude Haiku for fast search
- Multi-turn support via ChatBot
- Searches notes, tasks, topics
- Returns IDs with summaries
- Replaces contextAgent

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 8: Session Searcher Bot

**Files:**
- Create: `src/bots/session-searcher.ts`
- Replaces: `src/services/sessionsQueryAgent.ts`

**Step 1: Create the session searcher bot**

```typescript
// src/bots/session-searcher.ts
import { Baleybot, text } from '@baleybots/core';
import { ChatBot, History, MemoryStorage } from '@baleybots/chat';
import { MODELS } from './config';
import { SessionSearchResultSchema, type SessionSearchResult } from './types';
import type { Session } from '../types';

// Thread storage for multi-turn conversations
const threadHistories = new Map<string, History>();

function getThreadHistory(threadId: string): History {
  if (!threadHistories.has(threadId)) {
    threadHistories.set(threadId, new History({
      storage: new MemoryStorage(),
      maxMessages: 20,
    }));
  }
  return threadHistories.get(threadId)!;
}

export function clearSessionSearchThread(threadId: string): void {
  threadHistories.delete(threadId);
}

export function createSessionSearchThread(): string {
  return `session-search-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build session search context
 */
function buildSessionContext(sessions: Session[]): string {
  const parts: string[] = ['## Sessions'];

  sessions.forEach(s => {
    parts.push(`\n### [${s.id}] ${s.name}`);
    if (s.description) parts.push(`Description: ${s.description}`);
    parts.push(`Time: ${s.startTime} - ${s.endTime || 'ongoing'}`);
    parts.push(`Status: ${s.status}`);
    if (s.tags?.length) parts.push(`Tags: ${s.tags.join(', ')}`);

    // Screenshot summaries
    if (s.screenshots?.length) {
      const activities = s.screenshots
        .filter(ss => ss.aiAnalysis?.detectedActivity)
        .map(ss => ss.aiAnalysis!.detectedActivity)
        .slice(0, 5);
      if (activities.length) {
        parts.push(`Activities: ${activities.join(', ')}`);
      }
    }

    // Audio summaries
    if (s.audioSegments?.length) {
      const phrases = s.audioSegments
        .flatMap(seg => seg.keyPhrases || [])
        .slice(0, 5);
      if (phrases.length) {
        parts.push(`Key phrases: ${phrases.join(', ')}`);
      }
    }
  });

  return parts.join('\n');
}

/**
 * Session Searcher Bot
 *
 * Searches sessions using natural language queries.
 * Searches metadata, screenshot analyses, and audio transcriptions.
 */
export const sessionSearcher = Baleybot.create({
  name: 'session-searcher',
  goal: `You are a session search agent for a productivity app. Given a query and session data:

1. Find sessions matching the query
2. Search across metadata, screenshot activities, and audio
3. Support temporal queries ("yesterday", "last week", "coding sessions")
4. Activity mapping:
   - "coding/programming" → IDE, terminal activities
   - "meetings" → video apps, discussion audio
   - "research" → browser, documentation
5. Return session IDs with summary
6. Suggest refinements

Return only IDs that exist in the provided data.`,
  model: MODELS.FAST,
  outputSchema: SessionSearchResultSchema,
  verbose: false,
});

/**
 * Search sessions
 */
export async function searchSessions(
  query: string,
  sessions: Session[],
  threadId?: string
): Promise<SessionSearchResult & { threadId: string }> {
  const context = buildSessionContext(sessions);
  const searchPrompt = `${context}\n\n## Query\n${query}`;

  if (threadId) {
    const history = getThreadHistory(threadId);
    const chat = ChatBot.forUser(sessionSearcher, { historyManager: history });
    const result = await chat.send(searchPrompt);
    return { ...result, threadId };
  }

  const newThreadId = createSessionSearchThread();
  const result = await sessionSearcher.process(text(searchPrompt));
  return { ...result, threadId: newThreadId };
}
```

**Step 2: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/session-searcher.ts`
Expected: No errors

**Step 3: Update index exports**

```typescript
// Add to src/bots/index.ts
export {
  sessionSearcher,
  searchSessions,
  clearSessionSearchThread,
  createSessionSearchThread
} from './session-searcher';
```

**Step 4: Commit**

```bash
git add src/bots/session-searcher.ts src/bots/index.ts
git commit -m "feat(bots): add session searcher bot

- Uses Claude Haiku for fast search
- Searches metadata, screenshots, audio
- Multi-turn support
- Activity type mapping
- Replaces sessionsQueryAgent

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Ned Assistant (Complex Tool-Using Agent)

### Task 9: Ned Tools Definition

**Files:**
- Create: `src/bots/tools/index.ts`
- Create: `src/bots/tools/query-tools.ts`
- Create: `src/bots/tools/mutation-tools.ts`
- Create: `src/bots/tools/session-tools.ts`

**Step 1: Create query tools (read-only)**

```typescript
// src/bots/tools/query-tools.ts
import { tool } from '@baleybots/core';
import { z } from 'zod';
import { searchContext, createSearchThread } from '../context-searcher';
import { searchSessions, createSessionSearchThread } from '../session-searcher';
import type { Note, Task, Topic, Company, Contact, Session } from '../../types';

// These will be injected at runtime
let appState: {
  notes: Note[];
  tasks: Task[];
  topics: Topic[];
  companies: Company[];
  contacts: Contact[];
  sessions: Session[];
} | null = null;

export function setQueryToolsState(state: typeof appState) {
  appState = state;
}

export const queryContextTool = tool(
  'query_context',
  'Search notes and tasks using natural language. Use for finding information, filtering by date, priority, or topic.',
  z.object({
    query: z.string().describe('Natural language search query'),
    threadId: z.string().optional().describe('Thread ID for multi-turn search'),
  }),
  async ({ query, threadId }) => {
    if (!appState) throw new Error('App state not initialized');

    const result = await searchContext(
      query,
      appState.notes,
      appState.tasks,
      appState.topics,
      appState.companies,
      appState.contacts,
      threadId || createSearchThread()
    );

    // Return full items, not just IDs, for Ned to reference
    return {
      summary: result.summary,
      notes: appState.notes.filter(n => result.noteIds.includes(n.id)),
      tasks: appState.tasks.filter(t => result.taskIds.includes(t.id)),
      suggestions: result.suggestions,
      threadId: result.threadId,
    };
  }
);

export const querySessionsTool = tool(
  'query_sessions',
  'Search work sessions by activity, date, or content. Use for finding past work sessions.',
  z.object({
    query: z.string().describe('Natural language search query'),
    threadId: z.string().optional(),
  }),
  async ({ query, threadId }) => {
    if (!appState) throw new Error('App state not initialized');

    const result = await searchSessions(
      query,
      appState.sessions,
      threadId || createSessionSearchThread()
    );

    return {
      summary: result.summary,
      sessions: appState.sessions.filter(s => result.sessionIds.includes(s.id)),
      suggestions: result.suggestions,
      threadId: result.threadId,
    };
  }
);

export const getCurrentDatetimeTool = tool(
  'get_current_datetime',
  'Get the current date and time. Use when user asks about today, schedules, or due dates.',
  z.object({}),
  async () => {
    const now = new Date();
    return {
      datetime: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
      formatted: now.toLocaleString(),
    };
  }
);

export const getItemDetailsTool = tool(
  'get_item_details',
  'Get full details for a specific task or note by ID.',
  z.object({
    itemType: z.enum(['task', 'note']),
    itemId: z.string(),
  }),
  async ({ itemType, itemId }) => {
    if (!appState) throw new Error('App state not initialized');

    if (itemType === 'task') {
      const task = appState.tasks.find(t => t.id === itemId);
      if (!task) return { error: `Task ${itemId} not found` };
      return { task };
    } else {
      const note = appState.notes.find(n => n.id === itemId);
      if (!note) return { error: `Note ${itemId} not found` };
      return { note };
    }
  }
);

export const queryTools = {
  query_context: queryContextTool,
  query_sessions: querySessionsTool,
  get_current_datetime: getCurrentDatetimeTool,
  get_item_details: getItemDetailsTool,
};
```

**Step 2: Create mutation tools (write operations)**

```typescript
// src/bots/tools/mutation-tools.ts
import { tool } from '@baleybots/core';
import { z } from 'zod';
import type { Task, Note } from '../../types';

// Dispatch function injected at runtime
let dispatch: ((action: { type: string; payload?: unknown }) => void) | null = null;

export function setMutationToolsDispatch(fn: typeof dispatch) {
  dispatch = fn;
}

export const createTaskTool = tool(
  'create_task',
  'Create a new task. Use when user wants to add a todo or action item.',
  z.object({
    title: z.string().describe('Task title'),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    dueDate: z.string().optional().describe('YYYY-MM-DD format'),
    dueTime: z.string().optional().describe('HH:MM format'),
    tags: z.array(z.string()).optional(),
  }),
  async (params) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    const task: Partial<Task> = {
      id: `task-${Date.now()}`,
      title: params.title,
      description: params.description,
      priority: params.priority,
      dueDate: params.dueDate,
      dueTime: params.dueTime,
      tags: params.tags,
      done: false,
      createdAt: new Date().toISOString(),
      createdBy: 'ned',
    };

    dispatch({ type: 'ADD_TASK', payload: task });

    return {
      success: true,
      task,
      message: `Created task: "${params.title}"`,
    };
  }
);

export const updateTaskTool = tool(
  'update_task',
  'Update an existing task. Use when user wants to modify a task.',
  z.object({
    taskId: z.string(),
    updates: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      dueDate: z.string().optional(),
      dueTime: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),
  async ({ taskId, updates }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, ...updates } });

    return {
      success: true,
      taskId,
      updates,
      message: `Updated task ${taskId}`,
    };
  }
);

export const completeTaskTool = tool(
  'complete_task',
  'Mark a task as complete. Use when user says they finished something.',
  z.object({
    taskId: z.string(),
  }),
  async ({ taskId }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'COMPLETE_TASK', payload: taskId });

    return {
      success: true,
      taskId,
      message: `Marked task ${taskId} as complete`,
    };
  }
);

export const deleteTaskTool = tool(
  'delete_task',
  'Delete a task. Use when user wants to remove a task.',
  z.object({
    taskId: z.string(),
  }),
  async ({ taskId }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'DELETE_TASK', payload: taskId });

    return {
      success: true,
      taskId,
      message: `Deleted task ${taskId}`,
    };
  }
);

export const createNoteTool = tool(
  'create_note',
  'Create a new note. Use when user wants to save information.',
  z.object({
    content: z.string().describe('Markdown content'),
    topicId: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  async (params) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    const note: Partial<Note> = {
      id: `note-${Date.now()}`,
      content: params.content,
      topicIds: params.topicId ? [params.topicId] : [],
      tags: params.tags,
      timestamp: new Date().toISOString(),
      source: 'thought',
    };

    dispatch({ type: 'ADD_NOTE', payload: note });

    return {
      success: true,
      note,
      message: 'Created new note',
    };
  }
);

export const updateNoteTool = tool(
  'update_note',
  'Update an existing note.',
  z.object({
    noteId: z.string(),
    content: z.string().describe('New markdown content'),
  }),
  async ({ noteId, content }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'UPDATE_NOTE', payload: { id: noteId, content } });

    return {
      success: true,
      noteId,
      message: `Updated note ${noteId}`,
    };
  }
);

export const deleteNoteTool = tool(
  'delete_note',
  'Delete a note.',
  z.object({
    noteId: z.string(),
  }),
  async ({ noteId }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'DELETE_NOTE', payload: noteId });

    return {
      success: true,
      noteId,
      message: `Deleted note ${noteId}`,
    };
  }
);

export const mutationTools = {
  create_task: createTaskTool,
  update_task: updateTaskTool,
  complete_task: completeTaskTool,
  delete_task: deleteTaskTool,
  create_note: createNoteTool,
  update_note: updateNoteTool,
  delete_note: deleteNoteTool,
};
```

**Step 3: Create session tools**

```typescript
// src/bots/tools/session-tools.ts
import { tool } from '@baleybots/core';
import { z } from 'zod';
import { summarizeSession } from '../session-summarizer';
import type { Session } from '../../types';

let sessions: Session[] = [];

export function setSessionToolsState(sessionList: Session[]) {
  sessions = sessionList;
}

export const getSessionDetailsTool = tool(
  'get_session_details',
  'Get full details for a specific session including screenshots and audio.',
  z.object({
    sessionId: z.string(),
  }),
  async ({ sessionId }) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return { error: `Session ${sessionId} not found` };

    return {
      session: {
        ...session,
        // Summarize screenshots instead of full data
        screenshotCount: session.screenshots?.length || 0,
        audioSegmentCount: session.audioSegments?.length || 0,
        screenshots: session.screenshots?.slice(0, 5).map(ss => ({
          id: ss.id,
          timestamp: ss.timestamp,
          summary: ss.aiAnalysis?.summary,
          activity: ss.aiAnalysis?.detectedActivity,
        })),
      },
    };
  }
);

export const getSessionSummaryTool = tool(
  'get_session_summary',
  'Generate an AI summary of a session. Use when user asks about what they worked on.',
  z.object({
    sessionId: z.string(),
  }),
  async ({ sessionId }) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return { error: `Session ${sessionId} not found` };

    const summary = await summarizeSession(
      session,
      session.screenshots || [],
      session.audioSegments
    );

    return { sessionId, summary };
  }
);

export const getActiveSessionTool = tool(
  'get_active_session',
  'Get the currently active session if one exists.',
  z.object({}),
  async () => {
    const activeSession = sessions.find(s => s.status === 'active');
    if (!activeSession) return { active: false, message: 'No active session' };

    return {
      active: true,
      session: {
        id: activeSession.id,
        name: activeSession.name,
        startTime: activeSession.startTime,
        screenshotCount: activeSession.screenshots?.length || 0,
        duration: Math.round(
          (Date.now() - new Date(activeSession.startTime).getTime()) / 60000
        ),
      },
    };
  }
);

export const sessionTools = {
  get_session_details: getSessionDetailsTool,
  get_session_summary: getSessionSummaryTool,
  get_active_session: getActiveSessionTool,
};
```

**Step 4: Create tools index**

```typescript
// src/bots/tools/index.ts
export { queryTools, setQueryToolsState } from './query-tools';
export { mutationTools, setMutationToolsDispatch } from './mutation-tools';
export { sessionTools, setSessionToolsState } from './session-tools';

import { queryTools } from './query-tools';
import { mutationTools } from './mutation-tools';
import { sessionTools } from './session-tools';

// All tools combined
export const allNedTools = {
  ...queryTools,
  ...mutationTools,
  ...sessionTools,
};

// Read-only tools (no permission needed)
export const readOnlyTools = {
  ...queryTools,
  ...sessionTools,
};

// Write tools (require permission)
export const writeTools = {
  ...mutationTools,
};
```

**Step 5: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/tools/*.ts`
Expected: No errors

**Step 6: Update main index exports**

```typescript
// Add to src/bots/index.ts
export * from './tools';
```

**Step 7: Commit**

```bash
git add src/bots/tools/
git commit -m "feat(bots): add Ned tool definitions

- Query tools: search context, sessions, datetime, item details
- Mutation tools: create/update/delete tasks and notes
- Session tools: details, summary, active session
- Runtime state injection for app integration
- Replaces nedTools.ts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 10: Ned Assistant Bot

**Files:**
- Create: `src/bots/ned-assistant.ts`
- Replaces: `src/services/nedService.ts`

**Step 1: Create the Ned assistant bot**

```typescript
// src/bots/ned-assistant.ts
import { Baleybot, type ProcessOptions, type BaleybotStreamEvent } from '@baleybots/core';
import { ChatBot, History, MemoryStorage } from '@baleybots/chat';
import { MODELS } from './config';
import {
  allNedTools,
  setQueryToolsState,
  setMutationToolsDispatch,
  setSessionToolsState
} from './tools';
import type { Note, Task, Topic, Company, Contact, Session } from '../types';

// Conversation histories per user
const conversationHistories = new Map<string, History>();

function getConversationHistory(conversationId: string): History {
  if (!conversationHistories.has(conversationId)) {
    conversationHistories.set(conversationId, new History({
      storage: new MemoryStorage(),
      maxMessages: 50,
    }));
  }
  return conversationHistories.get(conversationId)!;
}

export function clearConversation(conversationId: string): void {
  conversationHistories.delete(conversationId);
}

export function createConversation(): string {
  return `ned-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Ned's system prompt
 */
const NED_GOAL = `You are Ned, an AI assistant for a productivity app called Taskerino.

Your personality:
- Helpful and efficient
- Concise but thorough
- Proactive about suggesting improvements
- Remember context from the conversation

Your capabilities:
- Search and query notes, tasks, and sessions
- Create, update, and delete tasks
- Create, update, and delete notes
- View session details and summaries
- Track time and dates

Guidelines:
- Always search before claiming you don't know something
- When creating tasks, infer priority from context
- When creating notes, use markdown formatting
- Reference specific items by ID when discussing them
- Ask clarifying questions when the request is ambiguous

You have access to tools - use them to help the user.`;

/**
 * Create Ned assistant bot with tools
 */
export function createNedAssistant() {
  return Baleybot.create({
    name: 'ned',
    goal: NED_GOAL,
    model: MODELS.STANDARD,
    tools: allNedTools,
    maxToolIterations: 10,
    verbose: false,
  });
}

/**
 * Ned Assistant interface
 */
export interface NedConfig {
  notes: Note[];
  tasks: Task[];
  topics: Topic[];
  companies: Company[];
  contacts: Contact[];
  sessions: Session[];
  dispatch: (action: { type: string; payload?: unknown }) => void;
  systemInstructions?: string;
}

/**
 * Initialize Ned with app state
 */
export function initializeNed(config: NedConfig): void {
  // Set state for query tools
  setQueryToolsState({
    notes: config.notes,
    tasks: config.tasks,
    topics: config.topics,
    companies: config.companies,
    contacts: config.contacts,
    sessions: config.sessions,
  });

  // Set dispatch for mutation tools
  setMutationToolsDispatch(config.dispatch);

  // Set sessions for session tools
  setSessionToolsState(config.sessions);
}

/**
 * Stream handler type
 */
export type NedStreamHandler = (event: BaleybotStreamEvent) => void;

/**
 * Send a message to Ned and get streaming response
 */
export async function sendMessageToNed(
  message: string,
  conversationId: string,
  config: NedConfig,
  onStream?: NedStreamHandler
): Promise<string> {
  // Initialize state before each message (data may have changed)
  initializeNed(config);

  const ned = createNedAssistant();
  const history = getConversationHistory(conversationId);
  const chat = ChatBot.forUser(ned, { historyManager: history });

  const options: ProcessOptions = onStream ? {
    onToken: (botName, event) => onStream(event),
  } : undefined;

  const result = await chat.send(message, options);

  // Result is string since no outputSchema
  return result as unknown as string;
}

/**
 * Non-streaming message send
 */
export async function askNed(
  message: string,
  conversationId: string,
  config: NedConfig
): Promise<string> {
  return sendMessageToNed(message, conversationId, config);
}
```

**Step 2: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/ned-assistant.ts`
Expected: No errors

**Step 3: Update index exports**

```typescript
// Add to src/bots/index.ts
export {
  createNedAssistant,
  initializeNed,
  sendMessageToNed,
  askNed,
  createConversation,
  clearConversation,
  type NedConfig,
  type NedStreamHandler,
} from './ned-assistant';
```

**Step 4: Commit**

```bash
git add src/bots/ned-assistant.ts src/bots/index.ts
git commit -m "feat(bots): add Ned assistant bot

- Tool-using conversational AI with 10 tools
- Streaming support for real-time responses
- Multi-turn conversation history
- Runtime state injection
- Replaces nedService

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: React Integration

### Task 11: React Hooks for Bots

**Files:**
- Create: `src/bots/hooks/index.ts`
- Create: `src/bots/hooks/useNed.ts`
- Create: `src/bots/hooks/useBots.ts`

**Step 1: Create useNed hook**

```typescript
// src/bots/hooks/useNed.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  sendMessageToNed,
  createConversation,
  clearConversation,
  type NedConfig,
  type NedStreamHandler
} from '../ned-assistant';
import type { BaleybotStreamEvent } from '@baleybots/core';

export interface NedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: Array<{ name: string; arguments: unknown; result?: unknown }>;
}

export interface UseNedOptions {
  config: Omit<NedConfig, 'dispatch'>;
  dispatch: NedConfig['dispatch'];
  onToolCall?: (toolName: string, args: unknown) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
}

export interface UseNedReturn {
  messages: NedMessage[];
  isLoading: boolean;
  streamingContent: string;
  sendMessage: (message: string) => Promise<void>;
  clearHistory: () => void;
  conversationId: string;
}

export function useNed(options: UseNedOptions): UseNedReturn {
  const [messages, setMessages] = useState<NedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const conversationIdRef = useRef(createConversation());
  const toolCallsRef = useRef<NedMessage['toolCalls']>([]);

  const sendMessage = useCallback(async (message: string) => {
    const userMessage: NedMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent('');
    toolCallsRef.current = [];

    const config: NedConfig = {
      ...options.config,
      dispatch: options.dispatch,
    };

    const handleStream: NedStreamHandler = (event: BaleybotStreamEvent) => {
      switch (event.type) {
        case 'text_delta':
          if ('content' in event) {
            setStreamingContent(prev => prev + event.content);
          }
          break;
        case 'tool_execution_start':
          if ('toolName' in event && 'arguments' in event) {
            options.onToolCall?.(event.toolName, event.arguments);
            toolCallsRef.current?.push({
              name: event.toolName,
              arguments: event.arguments
            });
          }
          break;
        case 'tool_execution_output':
          if ('toolName' in event && 'result' in event) {
            options.onToolResult?.(event.toolName, event.result);
            const existing = toolCallsRef.current?.find(tc => tc.name === event.toolName);
            if (existing) {
              existing.result = event.result;
            }
          }
          break;
      }
    };

    try {
      const response = await sendMessageToNed(
        message,
        conversationIdRef.current,
        config,
        handleStream
      );

      const assistantMessage: NedMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
        toolCalls: toolCallsRef.current?.length ? [...toolCallsRef.current] : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: NedMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
    }
  }, [options]);

  const clearHistory = useCallback(() => {
    clearConversation(conversationIdRef.current);
    conversationIdRef.current = createConversation();
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    clearHistory,
    conversationId: conversationIdRef.current,
  };
}
```

**Step 2: Create useBots hook for initialization**

```typescript
// src/bots/hooks/useBots.ts
import { useEffect, useState, useCallback } from 'react';
import { initializeBots, isBotsReady, updateApiKeys, type BotConfig } from '../config';

export interface UseBotsReturn {
  isReady: boolean;
  isInitializing: boolean;
  error: Error | null;
  updateKeys: (config: BotConfig) => Promise<void>;
  reinitialize: () => Promise<void>;
}

export function useBots(): UseBotsReturn {
  const [isReady, setIsReady] = useState(isBotsReady());
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(async () => {
    if (isBotsReady()) {
      setIsReady(true);
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      await initializeBots();
      setIsReady(true);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to initialize bots'));
      setIsReady(false);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const updateKeys = useCallback(async (config: BotConfig) => {
    await updateApiKeys(config);
  }, []);

  return {
    isReady,
    isInitializing,
    error,
    updateKeys,
    reinitialize: initialize,
  };
}
```

**Step 3: Create hooks index**

```typescript
// src/bots/hooks/index.ts
export { useNed } from './useNed';
export type { UseNedOptions, UseNedReturn, NedMessage } from './useNed';

export { useBots } from './useBots';
export type { UseBotsReturn } from './useBots';
```

**Step 4: Update main index exports**

```typescript
// Add to src/bots/index.ts
export * from './hooks';
```

**Step 5: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/hooks/*.ts`
Expected: No errors

**Step 6: Commit**

```bash
git add src/bots/hooks/
git commit -m "feat(bots): add React hooks for bot integration

- useNed: streaming chat with tool visibility
- useBots: initialization and API key management
- Full TypeScript support

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: Integration & Migration

### Task 12: Create Service Adapters

**Files:**
- Create: `src/bots/adapters/index.ts`
- Create: `src/bots/adapters/sessions-agent-adapter.ts`
- Create: `src/bots/adapters/claude-service-adapter.ts`

**Step 1: Create sessions agent adapter**

```typescript
// src/bots/adapters/sessions-agent-adapter.ts
/**
 * Adapter that provides the same interface as sessionsAgentService
 * but uses Baleybots under the hood.
 *
 * This allows gradual migration without breaking existing code.
 */

import {
  analyzeScreenshot as botAnalyzeScreenshot,
  clearScreenshotContext,
} from '../screenshot-analyzer';
import { summarizeSession as botSummarizeSession } from '../session-summarizer';
import type { Session, SessionScreenshot, SessionAudioSegment } from '../../types';

class SessionsAgentServiceAdapter {
  private hasApiKey = false;

  async setApiKey(apiKey: string): Promise<void> {
    // API key is managed by bots/config.ts now
    // This is kept for interface compatibility
    const { updateApiKeys } = await import('../config');
    await updateApiKeys({ claudeApiKey: apiKey });
    this.hasApiKey = true;
  }

  async analyzeScreenshot(
    screenshot: SessionScreenshot,
    session: Session,
    screenshotBase64: string,
    mimeType?: string
  ): Promise<SessionScreenshot['aiAnalysis']> {
    return botAnalyzeScreenshot(
      screenshotBase64,
      session.id,
      session.name,
      (mimeType as 'image/png' | 'image/jpeg') || 'image/png'
    );
  }

  async generateSessionSummary(
    session: Session,
    screenshots: SessionScreenshot[],
    audioSegments?: SessionAudioSegment[]
  ) {
    const summary = await botSummarizeSession(session, screenshots, audioSegments);

    // Map to expected format
    return {
      ...summary,
      lastUpdated: new Date().toISOString(),
      screenshotCount: screenshots.length,
    };
  }

  clearSessionContext(sessionId: string): void {
    clearScreenshotContext(sessionId);
  }

  getContextWindowSize(): number {
    return 5; // Matches the MAX_CONTEXT_WINDOW in screenshot-analyzer
  }

  async reloadApiKey(): Promise<void> {
    const { initializeBots } = await import('../config');
    await initializeBots();
    this.hasApiKey = true;
  }
}

// Export singleton for drop-in replacement
export const sessionsAgentService = new SessionsAgentServiceAdapter();
```

**Step 2: Create claude service adapter**

```typescript
// src/bots/adapters/claude-service-adapter.ts
/**
 * Adapter that provides the same interface as claudeService
 * but uses Baleybots under the hood.
 */

import { processCapture } from '../capture-processor';
import type { Topic, Note, Task, Attachment } from '../../types';
import type { CaptureResult } from '../types';

class ClaudeServiceAdapter {
  private hasApiKey = false;

  async setApiKey(apiKey: string): Promise<void> {
    const { updateApiKeys } = await import('../config');
    await updateApiKeys({ claudeApiKey: apiKey });
    this.hasApiKey = true;
  }

  async processInput(
    text: string,
    existingTopics: Topic[],
    existingNotes: Note[],
    settings: { systemInstructions?: string },
    _userLearnings?: unknown,
    _learningSettings?: unknown,
    existingTasks?: Task[],
    attachments?: Attachment[],
    _extractTasks?: boolean
  ): Promise<CaptureResult & { processingSteps: string[] }> {
    const result = await processCapture(
      text,
      existingTopics,
      existingNotes,
      existingTasks || [],
      settings.systemInstructions,
      attachments
    );

    // Add processing steps for UI compatibility
    return {
      ...result,
      processingSteps: [
        'Analyzing input...',
        'Detecting topics...',
        'Extracting notes...',
        'Extracting tasks...',
        'Complete!',
      ],
    };
  }
}

export const claudeService = new ClaudeServiceAdapter();
```

**Step 3: Create adapters index**

```typescript
// src/bots/adapters/index.ts
export { sessionsAgentService } from './sessions-agent-adapter';
export { claudeService } from './claude-service-adapter';
```

**Step 4: Update main index exports**

```typescript
// Add to src/bots/index.ts
export * from './adapters';
```

**Step 5: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit src/bots/adapters/*.ts`
Expected: No errors

**Step 6: Commit**

```bash
git add src/bots/adapters/
git commit -m "feat(bots): add service adapters for gradual migration

- sessionsAgentService adapter (drop-in replacement)
- claudeService adapter (drop-in replacement)
- Same interface, Baleybots implementation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 13: Update App Initialization

**Files:**
- Modify: `src/App.tsx` (add bot initialization)

**Step 1: Add bot initialization to App.tsx**

Find the App component initialization and add:

```typescript
// Add import at top of file
import { useBots } from './bots/hooks';

// Inside App component, add:
const { isReady: botsReady, error: botsError } = useBots();

// Add early return if bots failed to initialize
if (botsError) {
  console.error('[App] Bots initialization failed:', botsError);
  // Could show error UI here
}
```

**Step 2: Verify compilation**

Run: `cd /Users/jamesmcarthur/taskerino && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): initialize Baleybots on app startup

- Add useBots hook for initialization
- Log errors if initialization fails

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task 14: Final Verification & Documentation

**Files:**
- Modify: `src/bots/index.ts` (final cleanup)
- Create: `src/bots/README.md`

**Step 1: Final index.ts cleanup**

```typescript
// src/bots/index.ts
/**
 * Baleybots Integration for Taskerino
 *
 * This module provides unified AI functionality using the Baleybots SDK.
 * It replaces the previous fragmented AI services with type-safe,
 * composable bot implementations.
 *
 * @example
 * ```typescript
 * import { initializeBots, useNed, processCapture } from './bots';
 *
 * // Initialize on app startup
 * await initializeBots();
 *
 * // Use Ned assistant
 * const { messages, sendMessage } = useNed({ config, dispatch });
 * await sendMessage('Create a task for tomorrow');
 *
 * // Process user input
 * const result = await processCapture(text, topics, notes, tasks);
 * ```
 */

// Configuration
export { initializeBots, updateApiKeys, isBotsReady, MODELS } from './config';
export type { BotConfig } from './config';

// Type definitions
export * from './types';

// Core bots
export { screenshotAnalyzer, analyzeScreenshot, clearScreenshotContext } from './screenshot-analyzer';
export { sessionSummarizer, summarizeSession } from './session-summarizer';
export { audioReviewer, reviewAudio, reviewAudioChunked, estimateAudioReviewCost } from './audio-reviewer';
export { createCaptureProcessor, processCapture } from './capture-processor';
export { contextSearcher, searchContext, clearSearchThread, createSearchThread } from './context-searcher';
export { sessionSearcher, searchSessions, clearSessionSearchThread, createSessionSearchThread } from './session-searcher';

// Ned assistant
export {
  createNedAssistant,
  initializeNed,
  sendMessageToNed,
  askNed,
  createConversation,
  clearConversation,
} from './ned-assistant';
export type { NedConfig, NedStreamHandler } from './ned-assistant';

// Tools
export * from './tools';

// React hooks
export * from './hooks';

// Adapters (for migration)
export * from './adapters';
```

**Step 2: Create README**

```markdown
<!-- src/bots/README.md -->
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
```

**Step 3: Run full type check**

Run: `cd /Users/jamesmcarthur/taskerino && npm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add src/bots/
git commit -m "docs(bots): finalize Baleybots integration

- Complete index.ts with full exports
- Add comprehensive README
- Migration guide included

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

This plan creates a complete Baleybots integration layer with:

- **7 specialized bots** replacing the fragmented services
- **Type-safe outputs** using Zod schemas
- **16 tools** for Ned assistant
- **React hooks** for easy integration
- **Drop-in adapters** for gradual migration
- **Comprehensive documentation**

Total: 14 tasks across 5 phases

**Phase 1 (Foundation):** Tasks 1-2 - Config, types
**Phase 2 (Core Bots):** Tasks 3-8 - All bot implementations
**Phase 3 (Ned):** Tasks 9-10 - Tools and assistant
**Phase 4 (React):** Task 11 - Hooks
**Phase 5 (Integration):** Tasks 12-14 - Adapters, app init, docs
