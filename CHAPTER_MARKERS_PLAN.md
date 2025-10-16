# Option 1: Chapter Markers - Detailed Implementation Plan

## Overview
Add AI-powered chapter markers to video recordings that segment sessions into meaningful topics without splitting the video file. Include frame extraction capability for AI agents to analyze specific moments in detail.

**Key Goals:**
1. ✅ No file splitting (single MP4 stays intact)
2. ✅ AI agents can grab frames at any timestamp
3. ✅ YouTube-style chapter navigation in video player
4. ✅ Timeline groups items by chapters
5. ✅ Minimal complexity, fast implementation

---

## Architecture

### 1. Data Model

**Add to `src/types/index.ts`:**

```typescript
/**
 * Video chapter marker
 * Represents a semantic segment of a session video
 */
export interface VideoChapter {
  id: string;
  sessionId: string;
  startTime: number; // Seconds from session start
  endTime: number; // Seconds from session start
  title: string; // e.g., "Setting Up Development Environment"
  summary?: string; // AI-generated summary
  keyTopics?: string[]; // ["git", "npm install", "VS Code setup"]
  thumbnail?: string; // Base64 data URI from first frame
  confidence?: number; // 0-1, how confident AI is about this boundary
  createdAt: string;
}

/**
 * Update SessionVideo to include chapters
 */
export interface SessionVideo {
  // ... existing fields ...
  chapters?: VideoChapter[]; // AI-detected chapter markers
}
```

---

## Implementation

### Phase 1: Frame Extraction Service (Foundation)

**File: `src/services/videoFrameExtractor.ts`**

This service allows AI agents to grab frames from video at any timestamp.

```typescript
/**
 * VideoFrameExtractor
 *
 * Extracts individual frames from video recordings for AI analysis.
 * Uses the existing Swift thumbnail generation infrastructure.
 */

import { invoke } from '@tauri-apps/api/core';

export interface VideoFrame {
  timestamp: number; // Seconds from session start
  dataUri: string; // Base64 PNG data URI
  width: number;
  height: number;
}

class VideoFrameExtractor {
  /**
   * Extract a single frame from video at specified timestamp
   *
   * @param videoPath - Absolute path to video file
   * @param timestamp - Time in seconds from session start
   * @returns Frame as base64 data URI
   */
  async extractFrame(
    videoPath: string,
    timestamp: number
  ): Promise<VideoFrame> {
    console.log(`🎬 [FRAME EXTRACTOR] Extracting frame at ${timestamp}s from ${videoPath}`);

    try {
      // Use existing Swift thumbnail generation
      const dataUri = await invoke<string>('generate_video_thumbnail', {
        videoPath,
        time: timestamp
      });

      return {
        timestamp,
        dataUri,
        width: 320, // Our current thumbnail size
        height: 180
      };
    } catch (error) {
      console.error('❌ [FRAME EXTRACTOR] Failed to extract frame:', error);
      throw new Error(`Failed to extract frame at ${timestamp}s: ${error}`);
    }
  }

  /**
   * Extract multiple frames from video
   *
   * @param videoPath - Absolute path to video file
   * @param timestamps - Array of timestamps in seconds
   * @returns Array of frames
   */
  async extractFrames(
    videoPath: string,
    timestamps: number[]
  ): Promise<VideoFrame[]> {
    console.log(`🎬 [FRAME EXTRACTOR] Extracting ${timestamps.length} frames`);

    const frames: VideoFrame[] = [];

    for (const timestamp of timestamps) {
      try {
        const frame = await this.extractFrame(videoPath, timestamp);
        frames.push(frame);
      } catch (error) {
        console.warn(`⚠️ [FRAME EXTRACTOR] Skipping frame at ${timestamp}s:`, error);
      }
    }

    return frames;
  }

  /**
   * Extract frames at regular intervals (useful for AI analysis)
   *
   * @param videoPath - Absolute path to video file
   * @param duration - Video duration in seconds
   * @param intervalSeconds - Interval between frames (default: 30s)
   * @returns Array of frames
   */
  async extractFramesAtInterval(
    videoPath: string,
    duration: number,
    intervalSeconds: number = 30
  ): Promise<VideoFrame[]> {
    const timestamps: number[] = [];

    // Generate timestamps at intervals
    for (let t = 0; t < duration; t += intervalSeconds) {
      timestamps.push(t);
    }

    // Always include last frame
    if (timestamps[timestamps.length - 1] !== duration) {
      timestamps.push(duration - 1); // 1 second before end
    }

    console.log(`🎬 [FRAME EXTRACTOR] Extracting frames at ${intervalSeconds}s intervals (${timestamps.length} frames)`);

    return this.extractFrames(videoPath, timestamps);
  }
}

export const videoFrameExtractor = new VideoFrameExtractor();
```

**Usage Example for AI Agents:**
```typescript
// AI agent wants to analyze what happened around timestamp 125s
const frame = await videoFrameExtractor.extractFrame(videoPath, 125);
// Send frame.dataUri to Claude for analysis

// Or get context by sampling nearby frames
const contextFrames = await videoFrameExtractor.extractFrames(videoPath, [120, 125, 130]);
// Send all frames to Claude to understand the transition
```

---

### Phase 2: AI Chapter Detection Service

**File: `src/services/videoChapteringService.ts`**

This service analyzes the session timeline and proposes chapter boundaries.

```typescript
/**
 * VideoChapteringService
 *
 * Analyzes session timeline data to detect chapter boundaries.
 * Uses AI to understand topic transitions and segment the session.
 */

import type { Session, VideoChapter, SessionScreenshot, SessionAudioSegment } from '../types';
import { videoFrameExtractor } from './videoFrameExtractor';

interface ChapterProposal {
  startTime: number;
  endTime: number;
  title: string;
  summary: string;
  keyTopics: string[];
  confidence: number;
  reasoning: string; // Why this is a chapter boundary
}

class VideoChapteringService {
  /**
   * Analyze session and propose chapter boundaries
   *
   * Strategy:
   * 1. Collect timeline data (screenshots with AI analysis, audio transcripts)
   * 2. Sample video frames at intervals
   * 3. Send to Claude for chapter boundary detection
   * 4. Return proposed chapters
   */
  async proposeChapters(session: Session): Promise<ChapterProposal[]> {
    console.log(`📖 [CHAPTERING] Analyzing session ${session.id} for chapters`);

    if (!session.video?.fullVideoAttachmentId) {
      throw new Error('Session has no video recording');
    }

    // Get video attachment for file path
    const videoAttachment = await this.getVideoAttachment(session.video.fullVideoAttachmentId);
    if (!videoAttachment?.path) {
      throw new Error('Video file path not found');
    }

    // 1. Collect timeline data
    const timelineData = this.buildTimelineData(session);

    // 2. Sample video frames (every 30 seconds)
    const duration = videoAttachment.duration || 0;
    const frames = await videoFrameExtractor.extractFramesAtInterval(
      videoAttachment.path,
      duration,
      30 // Sample every 30 seconds
    );

    // 3. Build Claude prompt
    const prompt = this.buildChapterAnalysisPrompt(session, timelineData, frames);

    // 4. Call Claude API
    const chapters = await this.callClaudeForChapters(prompt);

    console.log(`✅ [CHAPTERING] Proposed ${chapters.length} chapters`);
    return chapters;
  }

  /**
   * Build timeline data summary for Claude
   */
  private buildTimelineData(session: Session): string {
    const sessionStart = new Date(session.startTime).getTime();

    let timeline = `Session: ${session.title}\n`;
    timeline += `Duration: ${this.formatDuration((session.endTime ? new Date(session.endTime).getTime() : Date.now()) - sessionStart)}\n\n`;
    timeline += `Timeline Items:\n\n`;

    // Add screenshots with AI analysis
    const screenshots = (session.screenshots || []).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    screenshots.forEach(screenshot => {
      const offsetSeconds = (new Date(screenshot.timestamp).getTime() - sessionStart) / 1000;
      timeline += `[${this.formatTime(offsetSeconds)}] Screenshot\n`;

      if (screenshot.aiAnalysis?.detectedActivity) {
        timeline += `  Activity: ${screenshot.aiAnalysis.detectedActivity}\n`;
      }
      if (screenshot.aiAnalysis?.summary) {
        timeline += `  Summary: ${screenshot.aiAnalysis.summary}\n`;
      }
      timeline += `\n`;
    });

    // Add audio segments with transcripts
    const audioSegments = (session.audioSegments || []).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    audioSegments.forEach(segment => {
      const offsetSeconds = (new Date(segment.timestamp).getTime() - sessionStart) / 1000;
      timeline += `[${this.formatTime(offsetSeconds)}] Audio\n`;

      if (segment.transcript) {
        timeline += `  Transcript: "${segment.transcript}"\n`;
      }
      timeline += `\n`;
    });

    // Add context items (user notes)
    const contextItems = (session.contextItems || []).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    contextItems.forEach(item => {
      const offsetSeconds = (new Date(item.timestamp).getTime() - sessionStart) / 1000;
      timeline += `[${this.formatTime(offsetSeconds)}] User Note\n`;
      timeline += `  Content: "${item.content}"\n\n`;
    });

    return timeline;
  }

  /**
   * Build Claude prompt for chapter analysis
   */
  private buildChapterAnalysisPrompt(
    session: Session,
    timelineData: string,
    frames: VideoFrame[]
  ): string {
    return `You are analyzing a work session recording to detect natural chapter boundaries.

${timelineData}

Video Frames (sampled every 30 seconds):
${frames.map(f => `[${this.formatTime(f.timestamp)}] Frame attached`).join('\n')}

Please analyze this session and propose chapter markers. A chapter should represent a distinct phase or topic in the work session.

Look for:
- Major topic transitions (e.g., switching from coding to documentation)
- Activity changes (e.g., debugging → implementation → testing)
- User notes that signal new sections
- Visual changes in the screen (different apps, different files)

Return your analysis as a JSON array of chapters:

[
  {
    "startTime": 0,
    "endTime": 120,
    "title": "Setting Up Development Environment",
    "summary": "Installing dependencies and configuring VS Code",
    "keyTopics": ["npm install", "VS Code", "git"],
    "confidence": 0.9,
    "reasoning": "Clear transition from setup commands to actual coding at 2:00"
  },
  ...
]

Guidelines:
- Minimum chapter length: 60 seconds (1 minute)
- Maximum chapters: 10 (keep it manageable)
- Use clear, descriptive titles (5-7 words)
- Confidence: 0-1 (how sure you are this is a real boundary)
- Only create chapters where there's a meaningful transition

Return ONLY the JSON array, no other text.`;
  }

  /**
   * Call Claude API for chapter analysis
   *
   * TODO: Implement actual Claude API call
   * For now, return mock data
   */
  private async callClaudeForChapters(prompt: string): Promise<ChapterProposal[]> {
    // TODO: Implement Claude API integration
    // This would use the Anthropic SDK to call Claude with the prompt + frames

    console.log('📝 [CHAPTERING] Sending to Claude for analysis...');
    console.log('Prompt length:', prompt.length);

    // Mock response for now
    return [
      {
        startTime: 0,
        endTime: 120,
        title: 'Setting Up Development Environment',
        summary: 'Installing dependencies and configuring VS Code',
        keyTopics: ['npm install', 'VS Code', 'git'],
        confidence: 0.9,
        reasoning: 'Clear transition from setup commands to actual coding at 2:00'
      },
      {
        startTime: 120,
        endTime: 300,
        title: 'Implementing User Authentication',
        summary: 'Writing login and signup functionality',
        keyTopics: ['authentication', 'React', 'forms'],
        confidence: 0.85,
        reasoning: 'Focused coding session on auth components'
      }
    ];
  }

  /**
   * Save approved chapters to session
   */
  async saveChapters(sessionId: string, chapters: ChapterProposal[]): Promise<VideoChapter[]> {
    const videoChapters: VideoChapter[] = chapters.map(proposal => ({
      id: `chapter-${sessionId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      sessionId,
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      title: proposal.title,
      summary: proposal.summary,
      keyTopics: proposal.keyTopics,
      confidence: proposal.confidence,
      createdAt: new Date().toISOString()
    }));

    // TODO: Update session.video.chapters in database
    console.log(`✅ [CHAPTERING] Saved ${videoChapters.length} chapters`);

    return videoChapters;
  }

  // Helper methods
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    return this.formatTime(seconds);
  }

  private async getVideoAttachment(attachmentId: string) {
    // TODO: Import from attachmentStorage
    return null;
  }
}

export const videoChapteringService = new VideoChapteringService();
```

---

### Phase 3: UI Components

#### 3A. Chapter Chips in Video Player

**Update `src/components/VideoPlayer.tsx`:**

Add chapter markers below the video player, similar to YouTube.

```typescript
// Add to VideoPlayer component

interface ChapterChipProps {
  chapter: VideoChapter;
  isActive: boolean;
  onClick: () => void;
}

function ChapterChip({ chapter, isActive, onClick }: ChapterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        isActive
          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
          : 'bg-white/60 text-gray-700 hover:bg-white/80 border border-gray-200'
      }`}
    >
      {chapter.title}
    </button>
  );
}

// Add chapter navigation bar
{session.video?.chapters && session.video.chapters.length > 0 && (
  <div className="mt-4 flex flex-wrap gap-2">
    {session.video.chapters.map(chapter => {
      const isActive =
        currentTime >= chapter.startTime &&
        currentTime < chapter.endTime;

      return (
        <ChapterChip
          key={chapter.id}
          chapter={chapter}
          isActive={isActive}
          onClick={() => handleSeek(chapter.startTime)}
        />
      );
    })}
  </div>
)}
```

#### 3B. Chapter Grouping in Timeline

**Update `src/components/ReviewTimeline.tsx`:**

Group timeline items by chapters with collapsible sections.

```typescript
// Add chapter grouping logic

function groupItemsByChapter(
  items: TimelineItem[],
  chapters: VideoChapter[],
  sessionStart: Date
): Map<VideoChapter | null, TimelineItem[]> {
  const groups = new Map<VideoChapter | null, TimelineItem[]>();

  // Initialize groups for each chapter
  chapters.forEach(chapter => groups.set(chapter, []));

  // Group for items before first chapter or with no chapters
  groups.set(null, []);

  items.forEach(item => {
    const itemTime = (new Date(item.data.timestamp).getTime() - sessionStart.getTime()) / 1000;

    // Find which chapter this item belongs to
    const chapter = chapters.find(
      c => itemTime >= c.startTime && itemTime < c.endTime
    );

    const group = groups.get(chapter || null) || [];
    group.push(item);
    groups.set(chapter || null, group);
  });

  return groups;
}

// Render grouped timeline
{session.video?.chapters && session.video.chapters.length > 0 ? (
  // Grouped by chapters
  Array.from(groupedItems.entries()).map(([chapter, items]) => {
    if (items.length === 0) return null;

    return (
      <div key={chapter?.id || 'uncategorized'} className="mb-6">
        {/* Chapter header */}
        {chapter && (
          <div className="sticky top-0 bg-white/80 backdrop-blur-md rounded-xl px-4 py-2 mb-3 border border-gray-200/60 shadow-sm z-10">
            <h5 className="text-sm font-bold text-gray-900">{chapter.title}</h5>
            {chapter.summary && (
              <p className="text-xs text-gray-600 mt-0.5">{chapter.summary}</p>
            )}
          </div>
        )}

        {/* Timeline items in this chapter */}
        <div className="space-y-3">
          {items.map((item, index) => (
            // ... render items as before ...
          ))}
        </div>
      </div>
    );
  })
) : (
  // No chapters - render flat timeline (existing code)
  sortedTimelineItems.map(item => /* ... */)
)}
```

#### 3C. Chapter Generation UI

**New Component: `src/components/ChapterGenerator.tsx`**

UI for generating and editing chapters.

```typescript
/**
 * ChapterGenerator
 *
 * UI for generating AI chapter markers for session videos.
 * Shows proposed chapters and allows editing before saving.
 */

import { useState } from 'react';
import { Sparkles, Check, X, Edit3 } from 'lucide-react';
import type { Session } from '../types';
import { videoChapteringService } from '../services/videoChapteringService';

interface ChapterGeneratorProps {
  session: Session;
  onChaptersSaved: () => void;
}

export function ChapterGenerator({ session, onChaptersSaved }: ChapterGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposals, setProposals] = useState<ChapterProposal[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const chapters = await videoChapteringService.proposeChapters(session);
      setProposals(chapters);
    } catch (error) {
      console.error('Failed to generate chapters:', error);
      // Show error notification
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    try {
      await videoChapteringService.saveChapters(session.id, proposals);
      onChaptersSaved();
      setProposals([]);
    } catch (error) {
      console.error('Failed to save chapters:', error);
    }
  };

  return (
    <div className="bg-white/40 backdrop-blur-xl rounded-[24px] border-2 border-white/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Sparkles size={16} className="text-cyan-500" />
            AI Chapter Markers
          </h4>
          <p className="text-xs text-gray-600 mt-1">
            Automatically detect topic transitions in your session
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50"
        >
          {isGenerating ? 'Analyzing...' : 'Generate Chapters'}
        </button>
      </div>

      {/* Proposed chapters */}
      {proposals.length > 0 && (
        <div className="space-y-3 mt-4">
          {proposals.map((proposal, index) => (
            <div
              key={index}
              className="bg-white/60 rounded-xl border border-gray-200/60 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">
                      {formatTime(proposal.startTime)} - {formatTime(proposal.endTime)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      proposal.confidence >= 0.8
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {Math.round(proposal.confidence * 100)}% confident
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-gray-900 mt-1">
                    {proposal.title}
                  </h5>
                  <p className="text-xs text-gray-600 mt-1">{proposal.summary}</p>
                  {proposal.keyTopics && proposal.keyTopics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {proposal.keyTopics.map(topic => (
                        <span
                          key={topic}
                          className="text-xs px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded-full"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setEditingId(editingId === String(index) ? null : String(index))}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Check size={16} />
              Save Chapters
            </button>
            <button
              onClick={() => setProposals([])}
              className="px-4 py-2 bg-white/60 text-gray-700 rounded-xl font-semibold text-sm hover:bg-white/80 transition-all flex items-center gap-2"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

---

## Implementation Steps

### Step 1: Frame Extraction (30 min)
1. ✅ **Already done!** We have `generate_video_thumbnail` Swift function
2. Create `src/services/videoFrameExtractor.ts`
3. Test extracting frames at various timestamps
4. Verify base64 data URIs work correctly

### Step 2: Chapter Data Model (15 min)
1. Add `VideoChapter` interface to `src/types/index.ts`
2. Add `chapters?: VideoChapter[]` to `SessionVideo` interface
3. Update database schema if needed

### Step 3: AI Chapter Detection (1-2 hours)
1. Create `src/services/videoChapteringService.ts`
2. Implement `buildTimelineData()` to summarize session
3. Implement `proposeChapters()` to call Claude API
4. Test with real session data

### Step 4: Video Player UI (30 min)
1. Update `VideoPlayer.tsx` to show chapter chips
2. Add click handlers to seek to chapter start
3. Highlight active chapter based on `currentTime`
4. Test navigation and visual feedback

### Step 5: Timeline UI (1 hour)
1. Update `ReviewTimeline.tsx` to group items by chapters
2. Add collapsible chapter headers
3. Auto-scroll to active chapter
4. Test with multi-chapter sessions

### Step 6: Chapter Generator UI (1 hour)
1. Create `ChapterGenerator.tsx` component
2. Add to `SessionReview.tsx` (show when video exists)
3. Implement proposal editing UI
4. Add save/cancel actions

### Step 7: Integration & Polish (1 hour)
1. Connect all pieces together
2. Handle edge cases (no chapters, single chapter, etc.)
3. Add loading states and error handling
4. Test end-to-end workflow

**Total Estimated Time: 5-6 hours**

---

## Future Enhancements (Post-MVP)

### 1. Claude API Integration
Replace mock `callClaudeForChapters()` with real Anthropic API call:
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const message = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      ...frames.map(f => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: f.dataUri.split(',')[1] // Remove data:image/png;base64, prefix
        }
      }))
    ]
  }]
});
```

### 2. Manual Chapter Editing
- UI to manually add/edit/delete chapters
- Drag to adjust chapter boundaries
- Merge/split chapters

### 3. Chapter Export
- Export chapters as JSON for external tools
- Generate markdown summary with chapter links
- Create shareable chapter index

### 4. Smart Frame Sampling
- Instead of fixed 30s intervals, sample frames at:
  - Screenshot timestamps (we know something changed)
  - Audio segment starts (user started speaking)
  - Context item timestamps (user added a note)
- More efficient and contextually relevant

### 5. Chapter Templates
- Learn from user's past sessions
- Suggest common chapter patterns
- Auto-apply to similar sessions

---

## AI Agent Integration

### Architecture: Video Analysis Agent (Separate from Ned)

**Key Principle:** Ned should NOT directly analyze video frames. Instead, Ned delegates to a separate **Video Analysis Agent** (another Claude 3.5 Sonnet instance).

**Why this architecture?**
1. **Preserves Ned's context** - Doesn't fill up with images
2. **Minimal delay** - Agent runs quickly and returns summary
3. **Transparency** - User sees what frames were analyzed
4. **Flexibility** - Agent can look at many frames over longer time periods

---

### Phase 4: Video Analysis Agent

**File: `src/services/videoAnalysisAgent.ts`**

This service provides a video analysis tool for Ned. Ned invokes this agent when the user asks questions about specific moments in a session.

```typescript
/**
 * VideoAnalysisAgent
 *
 * Separate Claude agent that analyzes video frames for Ned.
 * Ned invokes this agent when users ask about specific moments.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Session, VideoFrame } from '../types';
import { videoFrameExtractor } from './videoFrameExtractor';
import { attachmentStorage } from './attachmentStorage';

export interface VideoAnalysisRequest {
  sessionId: string;
  timeRange: {
    start: number; // Seconds from session start
    end: number; // Seconds from session start
  };
  question: string; // What the user wants to know
  samplingStrategy?: 'dense' | 'sparse' | 'smart'; // How many frames to extract
}

export interface VideoAnalysisResult {
  answer: string; // Text description answering the question
  analyzedFrames: VideoFrame[]; // Frames that were analyzed (for UI display)
  confidence: number; // 0-1, how confident the agent is
  timeRange: { start: number; end: number }; // Actual time range analyzed
}

class VideoAnalysisAgent {
  private anthropic: Anthropic;

  constructor() {
    // TODO: Get API key from environment/settings
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
  }

  /**
   * Analyze a specific moment in a session video
   *
   * This is the main entry point for Ned. Ned calls this when:
   * - User asks "What was I working on at 2:35?"
   * - User asks "Show me when I debugged the login issue"
   * - User asks "What happened between 1:00 and 3:00?"
   */
  async analyzeVideoMoment(
    request: VideoAnalysisRequest
  ): Promise<VideoAnalysisResult> {
    console.log(`🎬 [VIDEO AGENT] Analyzing ${request.timeRange.start}s - ${request.timeRange.end}s`);

    // 1. Get session data
    const session = await this.getSession(request.sessionId);
    if (!session.video?.fullVideoAttachmentId) {
      throw new Error('Session has no video recording');
    }

    // 2. Get video path
    const videoAttachment = await attachmentStorage.getAttachment(
      session.video.fullVideoAttachmentId
    );
    if (!videoAttachment?.path) {
      throw new Error('Video file not found');
    }

    // 3. Determine sampling strategy
    const timestamps = this.generateTimestamps(
      request.timeRange,
      request.samplingStrategy || 'smart',
      session
    );

    console.log(`🎬 [VIDEO AGENT] Extracting ${timestamps.length} frames`);

    // 4. Extract frames
    const frames = await videoFrameExtractor.extractFrames(
      videoAttachment.path,
      timestamps
    );

    // 5. Get timeline context
    const context = this.buildTimelineContext(session, request.timeRange);

    // 6. Build prompt for Claude
    const prompt = this.buildAnalysisPrompt(
      request.question,
      context,
      request.timeRange
    );

    // 7. Call Claude with frames
    const answer = await this.callClaude(prompt, frames);

    console.log(`✅ [VIDEO AGENT] Analysis complete`);

    return {
      answer,
      analyzedFrames: frames,
      confidence: 0.8, // TODO: Extract from Claude response
      timeRange: request.timeRange
    };
  }

  /**
   * Generate timestamps based on sampling strategy
   */
  private generateTimestamps(
    timeRange: { start: number; end: number },
    strategy: 'dense' | 'sparse' | 'smart',
    session: Session
  ): number[] {
    const duration = timeRange.end - timeRange.start;
    const timestamps: number[] = [];

    switch (strategy) {
      case 'dense':
        // Every 2 seconds (good for detailed analysis)
        for (let t = timeRange.start; t <= timeRange.end; t += 2) {
          timestamps.push(t);
        }
        break;

      case 'sparse':
        // Every 10 seconds (good for broad overview)
        for (let t = timeRange.start; t <= timeRange.end; t += 10) {
          timestamps.push(t);
        }
        break;

      case 'smart':
        // Sample at screenshot timestamps + audio timestamps + regular intervals
        const sessionStart = new Date(session.startTime).getTime();

        // Add screenshot timestamps
        session.screenshots?.forEach(screenshot => {
          const offset = (new Date(screenshot.timestamp).getTime() - sessionStart) / 1000;
          if (offset >= timeRange.start && offset <= timeRange.end) {
            timestamps.push(offset);
          }
        });

        // Add audio segment timestamps
        session.audioSegments?.forEach(segment => {
          const offset = (new Date(segment.timestamp).getTime() - sessionStart) / 1000;
          if (offset >= timeRange.start && offset <= timeRange.end) {
            timestamps.push(offset);
          }
        });

        // Fill gaps with regular intervals (every 5 seconds)
        for (let t = timeRange.start; t <= timeRange.end; t += 5) {
          if (!timestamps.find(ts => Math.abs(ts - t) < 2)) {
            timestamps.push(t);
          }
        }

        // Sort and deduplicate
        timestamps.sort((a, b) => a - b);
        break;
    }

    // Always include start and end
    if (!timestamps.includes(timeRange.start)) {
      timestamps.unshift(timeRange.start);
    }
    if (!timestamps.includes(timeRange.end)) {
      timestamps.push(timeRange.end);
    }

    return timestamps;
  }

  /**
   * Build timeline context (screenshots, audio, notes)
   */
  private buildTimelineContext(
    session: Session,
    timeRange: { start: number; end: number }
  ): string {
    const sessionStart = new Date(session.startTime).getTime();
    let context = '';

    // Screenshots
    const screenshots = session.screenshots?.filter(s => {
      const offset = (new Date(s.timestamp).getTime() - sessionStart) / 1000;
      return offset >= timeRange.start && offset <= timeRange.end;
    }) || [];

    if (screenshots.length > 0) {
      context += 'Screenshots:\n';
      screenshots.forEach(s => {
        const offset = (new Date(s.timestamp).getTime() - sessionStart) / 1000;
        context += `[${this.formatTime(offset)}] ${s.aiAnalysis?.detectedActivity || 'Activity'}\n`;
        if (s.aiAnalysis?.summary) {
          context += `  ${s.aiAnalysis.summary}\n`;
        }
      });
      context += '\n';
    }

    // Audio
    const audio = session.audioSegments?.filter(a => {
      const offset = (new Date(a.timestamp).getTime() - sessionStart) / 1000;
      return offset >= timeRange.start && offset <= timeRange.end;
    }) || [];

    if (audio.length > 0) {
      context += 'Audio Transcripts:\n';
      audio.forEach(a => {
        const offset = (new Date(a.timestamp).getTime() - sessionStart) / 1000;
        context += `[${this.formatTime(offset)}] "${a.transcript}"\n`;
      });
      context += '\n';
    }

    // User notes
    const notes = session.contextItems?.filter(n => {
      const offset = (new Date(n.timestamp).getTime() - sessionStart) / 1000;
      return offset >= timeRange.start && offset <= timeRange.end;
    }) || [];

    if (notes.length > 0) {
      context += 'User Notes:\n';
      notes.forEach(n => {
        const offset = (new Date(n.timestamp).getTime() - sessionStart) / 1000;
        context += `[${this.formatTime(offset)}] "${n.content}"\n`;
      });
      context += '\n';
    }

    return context;
  }

  /**
   * Build Claude prompt
   */
  private buildAnalysisPrompt(
    question: string,
    context: string,
    timeRange: { start: number; end: number }
  ): string {
    return `You are analyzing a work session video recording to answer the user's question.

User's Question: "${question}"

Time Range: ${this.formatTime(timeRange.start)} - ${this.formatTime(timeRange.end)}

Timeline Context:
${context}

I've attached video frames from this time range. Please analyze them to answer the user's question.

Focus on:
- What the user was working on (code, documentation, design, etc.)
- What applications/tools were visible
- What specific actions or changes occurred
- Any problems or successes visible in the UI

Provide a clear, concise answer (2-4 sentences) that directly addresses the question.`;
  }

  /**
   * Call Claude API with frames
   */
  private async callClaude(prompt: string, frames: VideoFrame[]): Promise<string> {
    console.log(`🤖 [VIDEO AGENT] Calling Claude with ${frames.length} frames`);

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...frames.map(frame => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: 'image/png' as const,
                data: frame.dataUri.split(',')[1] // Remove data:image/png;base64, prefix
              }
            }))
          ]
        }]
      });

      const textContent = message.content.find(c => c.type === 'text');
      return textContent && 'text' in textContent ? textContent.text : 'No response';
    } catch (error) {
      console.error('❌ [VIDEO AGENT] Claude API error:', error);
      throw error;
    }
  }

  // Helper methods
  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private async getSession(sessionId: string): Promise<Session> {
    // TODO: Import from session storage
    throw new Error('Not implemented');
  }
}

export const videoAnalysisAgent = new VideoAnalysisAgent();
```

---

### Phase 5: Ned Integration

**How Ned Uses the Video Analysis Agent:**

When the user asks Ned a question about a session video, Ned:
1. Recognizes this needs video analysis
2. Determines the relevant time range
3. Invokes the video analysis agent
4. Receives back: text answer + analyzed frames
5. Shows the answer to the user
6. Displays the analyzed frames in UI (see below)

**Example Ned Tool Definition:**

```typescript
{
  name: 'analyze_session_video',
  description: 'Analyze video frames from a session to answer questions about what the user was working on',
  parameters: {
    sessionId: 'string',
    timeRange: { start: 'number', end: 'number' },
    question: 'string',
    samplingStrategy: '"dense" | "sparse" | "smart"'
  }
}
```

**Example Ned Usage:**

```
User: "What was I working on around 2:30 in my last coding session?"

Ned (internal reasoning): User is asking about a specific time in a video session. I need to:
1. Find the most recent coding session
2. Invoke video analysis agent for time range 2:25-2:35
3. Return the answer + show frames

Ned: [Invokes video analysis agent]

Agent returns:
{
  answer: "You were debugging a login authentication issue in React. The screen shows VS Code with the LoginForm.tsx file open, and you were adding error handling for failed login attempts. The terminal shows npm test running with a few failing tests.",
  analyzedFrames: [/* 6 frames */],
  confidence: 0.85
}

Ned: "At 2:30 in your last coding session, you were debugging a login authentication issue in React. You had VS Code open with LoginForm.tsx and were adding error handling for failed login attempts. The terminal showed npm test running with a few failing tests."

[Below this, Ned's UI shows a film reel of the 6 analyzed frames]
```

---

### Phase 6: UI for Displaying Analyzed Frames

**File: `src/components/VideoAnalysisDisplay.tsx`**

Display analyzed frames in Ned's chat interface as visual proof.

```typescript
/**
 * VideoAnalysisDisplay
 *
 * Shows analyzed video frames in a compact, visually appealing format.
 * Options: Film reel, GIF, grid, or filmstrip.
 */

import React, { useState } from 'react';
import { Film, Grid, List } from 'lucide-react';
import type { VideoFrame } from '../types';

interface VideoAnalysisDisplayProps {
  frames: VideoFrame[];
  timeRange: { start: number; end: number };
}

export function VideoAnalysisDisplay({ frames, timeRange }: VideoAnalysisDisplayProps) {
  const [displayMode, setDisplayMode] = useState<'filmstrip' | 'grid' | 'gif'>('filmstrip');

  if (frames.length === 0) return null;

  return (
    <div className="bg-gray-50/80 backdrop-blur-sm rounded-xl border border-gray-200/60 p-4 mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Film size={14} className="text-gray-500" />
          <span className="text-xs font-semibold text-gray-700">
            Analyzed Frames ({frames.length})
          </span>
          <span className="text-xs text-gray-500">
            {formatTime(timeRange.start)} - {formatTime(timeRange.end)}
          </span>
        </div>

        {/* Display mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setDisplayMode('filmstrip')}
            className={`p-1.5 rounded ${
              displayMode === 'filmstrip' ? 'bg-cyan-100 text-cyan-600' : 'text-gray-400'
            }`}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setDisplayMode('grid')}
            className={`p-1.5 rounded ${
              displayMode === 'grid' ? 'bg-cyan-100 text-cyan-600' : 'text-gray-400'
            }`}
          >
            <Grid size={14} />
          </button>
        </div>
      </div>

      {/* Filmstrip Mode */}
      {displayMode === 'filmstrip' && (
        <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          {frames.map((frame, i) => (
            <div key={i} className="flex-shrink-0">
              <div className="relative group">
                <img
                  src={frame.dataUri}
                  alt={`Frame at ${formatTime(frame.timestamp)}`}
                  className="w-32 h-18 object-cover rounded border border-gray-300 shadow-sm hover:shadow-md transition-shadow"
                />
                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {formatTime(frame.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid Mode */}
      {displayMode === 'grid' && (
        <div className="grid grid-cols-3 gap-2">
          {frames.map((frame, i) => (
            <div key={i} className="relative group">
              <img
                src={frame.dataUri}
                alt={`Frame at ${formatTime(frame.timestamp)}`}
                className="w-full h-auto object-cover rounded border border-gray-300 shadow-sm hover:shadow-md transition-shadow"
              />
              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                {formatTime(frame.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

**Usage in Ned's Chat UI:**

```typescript
// In Ned's message rendering component
{message.videoAnalysis && (
  <VideoAnalysisDisplay
    frames={message.videoAnalysis.analyzedFrames}
    timeRange={message.videoAnalysis.timeRange}
  />
)}
```

---

### Benefits of This Architecture

1. **Context Preservation**: Ned's context stays clean (only gets text, not images)
2. **Transparency**: User sees exactly what frames were analyzed
3. **Flexibility**: Agent can look at 3 frames or 50 frames depending on the question
4. **Performance**: Minimal delay (~2-5 seconds for analysis)
5. **Reusability**: Same agent works for chapter detection, moment analysis, and debugging help
6. **User Trust**: Showing frames builds confidence in AI's answer

This gives Ned full visual + textual context for any moment in a session!

---

## Success Criteria

- [ ] Can extract frames from video at any timestamp
- [ ] AI can analyze timeline and propose chapter boundaries
- [ ] Chapters appear as clickable chips in video player
- [ ] Timeline groups items by chapters
- [ ] Can navigate video by clicking chapters
- [ ] Active chapter highlights based on playback position
- [ ] Ned (AI agent) can request and analyze frames from video
- [ ] No video file splitting (single MP4 remains intact)
- [ ] Fast implementation (~6 hours total)

---

## Why This Approach Wins

1. **Simple**: No FFmpeg, no file splitting, no complex storage
2. **Flexible**: Chapters are just metadata, easy to edit/regenerate
3. **AI-Ready**: Frame extraction works for any AI agent
4. **User-Friendly**: YouTube-style navigation is familiar
5. **Fast**: Reuses existing Swift thumbnail infrastructure
6. **Maintainable**: Clean separation of concerns

**We already have 90% of the infrastructure we need!** Just need to:
- Wrap existing frame extraction in a service
- Build AI analysis prompt
- Add UI components for chapter navigation

Let's build it! 🚀
