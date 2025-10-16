# Option B: Intelligence Features - Implementation Plan

## Overview
Add AI-powered features to make video recordings intelligent and queryable:
- **Phase 2**: Intelligent video chunking by topic
- **Phase 4**: Ned video analysis integration

**Prerequisites**: Option A MVP must be complete and working

---

## Phase 2: Intelligent Video Chunking

### Goal
Automatically break videos into topic-aligned chunks (30s-5min) using AI analysis

### Architecture

```
┌─────────────────┐
│  Stop Session   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Full Video     │
│  Saved to Disk  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Background:    │
│  Analyze        │
│  Transcript +   │
│  Screenshots    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI Proposes    │
│  Chunk          │
│  Boundaries     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FFmpeg Splits  │
│  Video File     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Store Chunks   │
│  + Metadata     │
└─────────────────┘
```

### Step 1: FFmpeg Integration (Backend)

**New File**: `src-tauri/src/video_processing.rs`

```rust
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;

/// Split video into chunks at specified timestamps
#[tauri::command]
pub async fn split_video(
    input_path: String,
    output_dir: String,
    chunks: Vec<VideoChunk>
) -> Result<Vec<String>, String> {
    // Chunks format: [{ start: 0.0, end: 30.5, name: "chunk_001.mp4" }, ...]

    let mut output_paths = Vec::new();

    for (i, chunk) in chunks.iter().enumerate() {
        let output_path = Path::new(&output_dir).join(&chunk.name);

        // Use FFmpeg to extract chunk
        let status = Command::new("ffmpeg")
            .args(&[
                "-i", &input_path,
                "-ss", &chunk.start.to_string(),  // Start time
                "-to", &chunk.end.to_string(),    // End time
                "-c", "copy",                      // Copy codec (fast, no re-encode)
                "-avoid_negative_ts", "1",
                output_path.to_str().unwrap()
            ])
            .status()
            .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

        if !status.success() {
            return Err(format!("FFmpeg failed for chunk {}", i));
        }

        output_paths.push(output_path.to_string_lossy().to_string());
    }

    Ok(output_paths)
}

/// Extract single frame from video at timestamp
#[tauri::command]
pub async fn extract_video_frame(
    video_path: String,
    timestamp: f64
) -> Result<String, String> {
    // For Option B Phase 4 (video analysis)
    // Generate temp filename
    let temp_path = std::env::temp_dir()
        .join(format!("taskerino_frame_{}.png", timestamp));

    let status = Command::new("ffmpeg")
        .args(&[
            "-ss", &timestamp.to_string(),
            "-i", &video_path,
            "-vframes", "1",
            "-q:v", "2",
            temp_path.to_str().unwrap()
        ])
        .status()
        .map_err(|e| format!("Failed to extract frame: {}", e))?;

    if !status.success() {
        return Err("FFmpeg frame extraction failed".to_string());
    }

    // Read and convert to base64
    let image_data = std::fs::read(&temp_path)
        .map_err(|e| format!("Failed to read frame: {}", e))?;

    let base64_data = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &image_data
    );

    // Cleanup
    let _ = std::fs::remove_file(&temp_path);

    Ok(format!("data:image/png;base64,{}", base64_data))
}

#[derive(Debug, serde::Deserialize)]
pub struct VideoChunk {
    pub start: f64,
    pub end: f64,
    pub name: String,
}
```

**Register Commands** in `lib.rs`:
```rust
mod video_processing;

// In invoke_handler:
video_processing::split_video,
video_processing::extract_video_frame,
```

### Step 2: Chunking Agent (Frontend)

**New File**: `src/utils/videoChunkingAgent.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { Session, SessionAudioSegment, SessionScreenshot } from '../types';

interface ProposedChunk {
  startTime: number;  // seconds from session start
  endTime: number;
  topic: string;
  description: string;
  relatedScreenshotIds: string[];
  relatedAudioSegmentIds: string[];
}

/**
 * Analyze session data and propose video chunk boundaries
 */
export async function proposeVideoChunks(session: Session): Promise<ProposedChunk[]> {
  const claude = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  // Build context from session data
  const context = buildSessionContext(session);

  const response = await claude.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Analyze this work session and propose video chunk boundaries.

Session Data:
${context}

Requirements:
- Chunks should be 30 seconds to 5 minutes long
- Each chunk should represent a cohesive topic or activity
- Don't cut mid-activity (e.g., don't split a debug session)
- Align boundaries with natural transitions (app switches, breaks, topic changes)
- Provide a clear topic name and description for each chunk

Return JSON array of chunks:
[{
  "startTime": 0,
  "endTime": 120,
  "topic": "Authentication Implementation",
  "description": "Implemented JWT authentication with login endpoint",
  "relatedScreenshotIds": ["screenshot-1", "screenshot-2"],
  "relatedAudioSegmentIds": ["audio-1"]
}]`
    }]
  });

  // Parse Claude's response
  const chunks = parseChunkProposals(response.content[0].text);

  return chunks;
}

/**
 * Build session context for Claude analysis
 */
function buildSessionContext(session: Session): string {
  const parts: string[] = [];

  // Session metadata
  parts.push(`Duration: ${formatDuration(session.duration)}`);
  parts.push(`Started: ${new Date(session.startTime).toLocaleString()}`);

  // Audio transcripts (chronological)
  if (session.audioSegments && session.audioSegments.length > 0) {
    parts.push('\n## Audio Transcripts:');
    session.audioSegments
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .forEach(segment => {
        const relativeTime = getRelativeTime(session.startTime, segment.timestamp);
        parts.push(`[${formatTime(relativeTime)}] ${segment.transcription || segment.description}`);
      });
  }

  // Screenshot summaries (if available)
  if (session.screenshots && session.screenshots.length > 0) {
    parts.push('\n## Screenshots:');
    session.screenshots
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .forEach(screenshot => {
        const relativeTime = getRelativeTime(session.startTime, screenshot.timestamp);
        if (screenshot.context) {
          parts.push(`[${formatTime(relativeTime)}] ${screenshot.context}`);
        }
      });
  }

  return parts.join('\n');
}

/**
 * Parse Claude's chunk proposals
 */
function parseChunkProposals(text: string): ProposedChunk[] {
  // Extract JSON from Claude's response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse chunk proposals from Claude');
  }

  const chunks = JSON.parse(jsonMatch[0]);
  return chunks;
}

// Helper functions
function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getRelativeTime(sessionStart: string, timestamp: string): number {
  return (new Date(timestamp).getTime() - new Date(sessionStart).getTime()) / 1000;
}
```

### Step 3: Post-Session Processing

**Modify**: `src/components/SessionsZone.tsx`

```typescript
import { proposeVideoChunks } from '../utils/videoChunkingAgent';
import { invoke } from '@tauri-apps/api/core';

// After session ends and video is saved:
const handleStopSession = async () => {
  // ... existing stop logic ...

  // If video was recorded, trigger chunking
  if (completedSession.video) {
    try {
      // Show processing toast
      showToast({
        type: 'info',
        message: 'Processing video...',
        duration: null  // Persistent
      });

      // Run chunking in background
      chunkSessionVideo(completedSession);
    } catch (error) {
      console.error('Failed to start video chunking:', error);
    }
  }
};

/**
 * Chunk session video in background
 */
async function chunkSessionVideo(session: Session) {
  try {
    // Step 1: Propose chunks using AI
    const proposedChunks = await proposeVideoChunks(session);

    console.log(`📹 Proposed ${proposedChunks.length} video chunks`);

    // Step 2: Split video using FFmpeg
    const videoPath = session.video!.fullVideoPath;
    const outputDir = await path.join(
      await path.appDataDir(),
      'videos',
      `chunks_${session.id}`
    );

    await invoke('split_video', {
      inputPath: videoPath,
      outputDir,
      chunks: proposedChunks.map((chunk, i) => ({
        start: chunk.startTime,
        end: chunk.endTime,
        name: `chunk_${i.toString().padStart(3, '0')}.mp4`
      }))
    });

    // Step 3: Create SessionVideoChunk entities
    const chunks = proposedChunks.map((proposal, i) => ({
      id: generateId(),
      videoId: session.video!.id,
      attachmentId: `chunk-${session.id}-${i}`,  // Store chunk file
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      topic: proposal.topic,
      description: proposal.description,
      transcriptExcerpt: '', // Extract from audio segments
      relatedScreenshotIds: proposal.relatedScreenshotIds,
      relatedAudioSegmentIds: proposal.relatedAudioSegmentIds
    }));

    // Step 4: Update session with chunks
    dispatch({
      type: 'UPDATE_SESSION',
      payload: {
        ...session,
        video: {
          ...session.video!,
          chunks,
          chunkingStatus: 'complete',
          processedAt: new Date().toISOString()
        }
      }
    });

    showToast({
      type: 'success',
      message: `Video processed: ${chunks.length} topics identified`,
      duration: 5000
    });

  } catch (error) {
    console.error('Failed to chunk video:', error);
    showToast({
      type: 'error',
      message: 'Failed to process video',
      duration: 5000
    });
  }
}
```

### Step 4: Chunk Selector UI

**New File**: `src/components/VideoChunkSelector.tsx`

```typescript
import React from 'react';
import { Clock } from 'lucide-react';
import type { SessionVideoChunk } from '../types';

interface VideoChunkSelectorProps {
  chunks: SessionVideoChunk[];
  currentTime: number;
  onChunkSelect: (chunk: SessionVideoChunk) => void;
}

export function VideoChunkSelector({ chunks, currentTime, onChunkSelect }: VideoChunkSelectorProps) {
  // Find current chunk based on playback time
  const currentChunk = chunks.find(
    chunk => currentTime >= chunk.startTime && currentTime <= chunk.endTime
  );

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-white/60 p-4">
      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Clock size={16} />
        Topics ({chunks.length})
      </h4>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {chunks.map(chunk => {
          const isActive = currentChunk?.id === chunk.id;

          return (
            <button
              key={chunk.id}
              onClick={() => onChunkSelect(chunk)}
              className={cn(
                'w-full text-left p-3 rounded-lg transition-all',
                isActive
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                  : 'bg-white/70 hover:bg-white text-gray-900'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">{chunk.topic}</div>
                  <div className={cn(
                    'text-xs mt-1',
                    isActive ? 'text-white/90' : 'text-gray-600'
                  )}>
                    {chunk.description}
                  </div>
                </div>
                <div className={cn(
                  'text-xs whitespace-nowrap',
                  isActive ? 'text-white/80' : 'text-gray-500'
                )}>
                  {formatDuration(chunk.endTime - chunk.startTime)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

### Step 5: Integration

**Update**: `src/components/SessionReview.tsx`

```typescript
import { VideoChunkSelector } from './VideoChunkSelector';

// When rendering video mode:
{mediaMode === 'video' && session.video && (
  <div className="space-y-4">
    <VideoPlayer
      videoUrl={videoUrl}
      onTimeUpdate={setCurrentTime}
    />

    {/* Show chunk selector if chunks available */}
    {session.video.chunks && session.video.chunks.length > 0 && (
      <VideoChunkSelector
        chunks={session.video.chunks}
        currentTime={currentTime}
        onChunkSelect={(chunk) => {
          // Seek video to chunk start time
          seekVideo(chunk.startTime);
        }}
      />
    )}
  </div>
)}
```

---

## Phase 4: Ned Video Analysis Integration

### Goal
Allow Ned to analyze video recordings on-demand to answer user questions

### Architecture

```
User: "Ned, what did I do at 2pm yesterday?"
         │
         ▼
┌─────────────────┐
│  Ned searches   │
│  sessions       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Finds relevant │
│  video chunk    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Invokes        │
│  analyze_video  │
│  tool           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Extract frames │
│  @ adaptive FPS │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Send frames +  │
│  transcript to  │
│  Claude         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return text    │
│  summary to Ned │
└─────────────────┘
```

### Step 1: Video Review Agent

**New File**: `src/services/videoReviewAgent.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { invoke } from '@tauri-apps/api/core';
import type { Session } from '../types';

type DetailLevel = 'quick' | 'standard' | 'detailed';

const FPS_CONFIG = {
  quick: 0.15,     // 1 frame per 6.67 seconds
  standard: 0.5,   // 1 frame per 2 seconds
  detailed: 1.5    // 1.5 frames per second
};

const MAX_FRAMES = 120;  // Cost control

interface AnalysisResult {
  summary: string;
  timestamp: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Analyze video segment to answer a specific question
 */
export async function analyzeVideo(
  session: Session,
  startTime: number,
  endTime: number,
  query: string,
  detailLevel: DetailLevel = 'standard'
): Promise<AnalysisResult> {
  const claude = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  // Calculate sampling rate
  const duration = endTime - startTime;
  const fps = FPS_CONFIG[detailLevel];
  let frameCount = Math.floor(duration * fps);

  // Cap at MAX_FRAMES
  if (frameCount > MAX_FRAMES) {
    frameCount = MAX_FRAMES;
  }

  console.log(`📹 Analyzing video: ${duration}s at ${fps}fps = ${frameCount} frames`);

  // Extract frames
  const frames: string[] = [];
  const frameInterval = duration / frameCount;

  for (let i = 0; i < frameCount; i++) {
    const timestamp = startTime + (i * frameInterval);

    try {
      const frameBase64 = await invoke<string>('extract_video_frame', {
        videoPath: session.video!.fullVideoPath,
        timestamp
      });

      frames.push(frameBase64);
    } catch (error) {
      console.error(`Failed to extract frame at ${timestamp}s:`, error);
    }
  }

  console.log(`✅ Extracted ${frames.length} frames`);

  // Get transcript excerpt for this time range
  const transcriptExcerpt = getTranscriptExcerpt(session, startTime, endTime);

  // Analyze with Claude
  const response = await claude.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this video segment to answer: "${query}"

Time Range: ${formatTime(startTime)} - ${formatTime(endTime)}

${transcriptExcerpt ? `Transcript:\n${transcriptExcerpt}\n\n` : ''}

Answer the question based on what you see in the video frames and transcript.
Be specific about:
- What actions were taken
- What was visible on screen
- When things happened (relative timestamps)
- Any code, UI, or content that's relevant

Format as a clear, chronological narrative.`
        },
        ...frames.map(frame => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: 'image/png' as const,
            data: frame.replace(/^data:image\/png;base64,/, '')
          }
        }))
      ]
    }]
  });

  return {
    summary: response.content[0].text,
    timestamp: Date.now(),
    confidence: 'high'  // Could be determined by Claude's response
  };
}

/**
 * Get transcript excerpt for time range
 */
function getTranscriptExcerpt(session: Session, startTime: number, endTime: number): string {
  if (!session.audioSegments) return '';

  const sessionStart = new Date(session.startTime).getTime();

  const relevantSegments = session.audioSegments.filter(segment => {
    const segmentTime = (new Date(segment.timestamp).getTime() - sessionStart) / 1000;
    return segmentTime >= startTime && segmentTime <= endTime;
  });

  return relevantSegments
    .map(segment => `[${segment.timestamp}] ${segment.transcription || segment.description}`)
    .join('\n');
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

### Step 2: Ned Integration

**Modify**: `src/services/sessionsAgentService.ts`

Add new tool for Ned:

```typescript
import { analyzeVideo } from './videoReviewAgent';

// In tools array:
{
  name: 'analyze_session_video',
  description: `Analyze video recording from a session to answer questions about what happened.

Use this when:
- User asks "what did I do" during a specific time
- User wants to know specific implementation details from video
- User needs to see what was on screen at a specific time

Input:
- session_id: The session to analyze
- start_time: Start time in seconds (relative to session start)
- end_time: End time in seconds (relative to session start)
- query: Specific question to answer about the video
- detail_level: "quick" | "standard" | "detailed" (defaults to "standard")

Output: Text summary of what happened in the video, with specific details`,
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      start_time: { type: 'number' },
      end_time: { type: 'number' },
      query: { type: 'string' },
      detail_level: { type: 'string', enum: ['quick', 'standard', 'detailed'] }
    },
    required: ['session_id', 'query']
  }
}

// In tool execution:
case 'analyze_session_video': {
  const { session_id, start_time, end_time, query, detail_level } = toolInput;

  const session = sessions.find(s => s.id === session_id);
  if (!session || !session.video) {
    return {
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: 'Session not found or has no video recording'
    };
  }

  // Default to full video if times not specified
  const start = start_time ?? 0;
  const end = end_time ?? session.video.duration;

  const result = await analyzeVideo(
    session,
    start,
    end,
    query,
    detail_level ?? 'standard'
  );

  return {
    type: 'tool_result',
    tool_use_id: toolUse.id,
    content: result.summary
  };
}
```

---

## Implementation Timeline

### Phase 2: Chunking (4-5 days)
**Day 1**: FFmpeg integration + Rust commands
**Day 2**: Chunking agent (Claude integration)
**Day 3**: Post-session processing flow
**Day 4**: VideoChunkSelector UI
**Day 5**: Testing & refinement

### Phase 4: Video Analysis (3-4 days)
**Day 6**: Video review agent (frame extraction)
**Day 7**: Ned tool integration
**Day 8**: Testing with various queries
**Day 9**: Performance optimization & caching

**Total: 7-9 days**

---

## Cost Estimates

### Per Session Chunking
- 1 hour session with 50 audio segments
- Claude 3.5 Sonnet analysis: ~$0.05
- FFmpeg processing: Free (local)

### Per Video Query (Standard Detail)
- 60 frames at 720p
- Claude 3.5 Sonnet with vision: ~$0.22
- Typical user: 3-5 queries/day = $0.66-$1.10/day

### Monthly Cost (Active User)
- 20 sessions/month: $1.00 (chunking)
- 100 video queries/month: $22.00 (analysis)
- **Total: ~$23/month**

Much cheaper than auto-processing everything!

---

## Success Criteria

### Phase 2 (Chunking)
- [ ] Videos automatically chunked after session ends
- [ ] Chunks align with topic boundaries (verified manually)
- [ ] Chunk selector shows all topics with descriptions
- [ ] Clicking chunk seeks video to correct timestamp
- [ ] Chunking completes within 30 seconds for 1-hour video

### Phase 4 (Ned Analysis)
- [ ] Ned can answer "what did I do at X time"
- [ ] Ned provides specific implementation details from video
- [ ] Ned can describe what was on screen
- [ ] Analysis is chronological and accurate
- [ ] Response time < 15 seconds for standard detail query

---

## User Flows

### Chunking Flow
```
1. User stops session
2. Toast: "Processing video..."
3. (Background) AI analyzes transcript + screenshots
4. (Background) FFmpeg splits video into chunks
5. (30-60s later) Toast: "Video processed: 8 topics identified"
6. User opens Review tab
7. Chunk selector shows 8 topics with descriptions
8. User clicks "Authentication Implementation"
9. Video seeks to that topic
```

### Ned Query Flow
```
User: "Ned, how did I implement login yesterday at 2pm?"

Ned: [Searches sessions, finds session at 2pm]
     [Identifies relevant time range: 2:00-2:15pm]
     [Invokes analyze_session_video tool]
     [Video agent extracts 45 frames]
     [Claude analyzes frames + transcript]

Ned: "At 2:05pm you opened auth.ts and created the loginUser function.
     At 2:08pm you added JWT token generation using jsonwebtoken library.
     At 2:12pm you tested the endpoint in Postman and got a successful 200 response.
     The function takes email/password, validates against the database,
     and returns { token, user } on success."

User: "What error did I get when testing?"

Ned: [Invokes tool with narrower range: 2:12-2:15pm, detail: detailed]

Ned: "At 2:12:30 you got a CORS error. The console showed:
     'Access-Control-Allow-Origin header missing'
     At 2:13 you added cors middleware with origin: 'http://localhost:3000'
     After restart, the request succeeded at 2:14."
```

---

## Next Steps

1. ✅ **Complete Option A MVP** (video playback working)
2. **Decision Point**: Validate with users before investing in chunking
3. **Implement Phase 2** if users want topic-based navigation
4. **Implement Phase 4** if users ask Ned about video content

The beauty of this architecture: Each phase adds value independently!
