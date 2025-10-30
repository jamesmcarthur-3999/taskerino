# Ned Video Analysis Tool Integration Guide

## Overview

This document explains how to integrate the **Video Analysis Agent** into Ned's tool system. The video analysis agent allows Ned to analyze video recordings and answer user questions about specific moments in their work sessions.

---

## Architecture

**Key Principle**: Ned does NOT directly analyze video frames. Instead, Ned delegates to a **separate Video Analysis Agent** (another Claude 3.5 Sonnet instance).

**Benefits**:
- Preserves Ned's context (doesn't fill up with images)
- Minimal delay (2-5 seconds)
- User sees what frames were analyzed (transparency)
- Agent can look at many frames over longer periods

---

## Tool Definition for Ned

Add this tool to Ned's available tools:

```typescript
{
  name: 'analyze_session_video',
  description: 'Analyze video frames from a session to answer questions about what the user was working on at specific times. Use this when the user asks about their screen/work at a particular time, or wants to know what happened during a time range.',
  parameters: {
    type: 'object',
    properties: {
      sessionId: {
        type: 'string',
        description: 'The ID of the session to analyze'
      },
      timeRange: {
        type: 'object',
        properties: {
          start: {
            type: 'number',
            description: 'Start time in seconds from session start'
          },
          end: {
            type: 'number',
            description: 'End time in seconds from session start'
          }
        },
        required: ['start', 'end'],
        description: 'The time range to analyze (in seconds from session start)'
      },
      question: {
        type: 'string',
        description: 'The specific question the user wants answered about this moment/period'
      },
      samplingStrategy: {
        type: 'string',
        enum: ['dense', 'sparse', 'smart'],
        description: 'How densely to sample frames: dense (every 2s), sparse (every 10s), smart (adaptive based on activity). Default: smart'
      }
    },
    required: ['sessionId', 'timeRange', 'question']
  }
}
```

---

## Tool Implementation

When Ned invokes this tool, call the video analysis agent:

```typescript
import { videoAnalysisAgent } from '../services/videoAnalysisAgent';
import type { VideoAnalysisRequest, VideoAnalysisResult } from '../services/videoAnalysisAgent';

async function handleAnalyzeSessionVideo(params: {
  sessionId: string;
  timeRange: { start: number; end: number };
  question: string;
  samplingStrategy?: 'dense' | 'sparse' | 'smart';
}): Promise<VideoAnalysisResult> {

  const request: VideoAnalysisRequest = {
    sessionId: params.sessionId,
    timeRange: params.timeRange,
    question: params.question,
    samplingStrategy: params.samplingStrategy || 'smart'
  };

  try {
    const result = await videoAnalysisAgent.analyzeVideoMoment(request);

    // Result contains:
    // - answer: string (text description)
    // - analyzedFrames: VideoFrame[] (frames that were analyzed)
    // - confidence: number (0-1)
    // - timeRange: { start: number, end: number }

    return result;

  } catch (error) {
    console.error('Video analysis failed:', error);
    throw new Error(`Failed to analyze video: ${error.message}`);
  }
}
```

---

## Example Usage Scenarios

### Scenario 1: User Asks About a Specific Time

**User**: "What was I working on at 2:30 in my last coding session?"

**Ned's Internal Reasoning**:
1. User is asking about a specific time in a session
2. Need to find the most recent coding session
3. Convert "2:30" to seconds (150 seconds)
4. Create a 10-second window around that time (145-155 seconds)
5. Invoke video analysis tool

**Ned Invokes Tool**:
```typescript
{
  sessionId: 'session-abc-123',
  timeRange: { start: 145, end: 155 },
  question: 'What was the user working on?',
  samplingStrategy: 'smart'
}
```

**Agent Returns**:
```typescript
{
  answer: "You were debugging a login authentication issue in React. The screen shows VS Code with the LoginForm.tsx file open, and you were adding error handling for failed login attempts. The terminal shows npm test running with a few failing tests.",
  analyzedFrames: [
    { timestamp: 145, dataUri: 'data:image/png;base64,...', width: 320, height: 180 },
    { timestamp: 148, dataUri: 'data:image/png;base64,...', width: 320, height: 180 },
    { timestamp: 150, dataUri: 'data:image/png;base64,...', width: 320, height: 180 },
    { timestamp: 153, dataUri: 'data:image/png;base64,...', width: 320, height: 180 },
    { timestamp: 155, dataUri: 'data:image/png;base64,...', width: 320, height: 180 }
  ],
  confidence: 0.85,
  timeRange: { start: 145, end: 155 }
}
```

**Ned's Response to User**:
"At 2:30 in your last coding session, you were debugging a login authentication issue in React. You had VS Code open with LoginForm.tsx and were adding error handling for failed login attempts. The terminal showed npm test running with a few failing tests."

[Below this, Ned's UI displays the VideoAnalysisDisplay component showing the 5 analyzed frames in filmstrip mode]

---

### Scenario 2: User Asks About a Range

**User**: "What did I accomplish between 1:00 and 3:00 in my morning session?"

**Ned Invokes Tool**:
```typescript
{
  sessionId: 'session-morning-xyz',
  timeRange: { start: 60, end: 180 },
  question: 'What did the user accomplish during this time?',
  samplingStrategy: 'sparse' // Longer range, use sparse sampling
}
```

**Agent Returns**:
Comprehensive answer based on 12+ frames sampled across 2 minutes.

---

### Scenario 3: User Asks to Find a Moment

**User**: "When did I fix the database connection bug?"

**Ned's Approach**:
1. Search through session audio transcripts and screenshots for mentions of "database connection"
2. Find relevant time: ~580 seconds into session
3. Invoke video analysis for that window

**Ned Invokes Tool**:
```typescript
{
  sessionId: 'session-xyz',
  timeRange: { start: 575, end: 595 },
  question: 'Was the user fixing a database connection bug?',
  samplingStrategy: 'dense' // Short critical moment, use dense sampling
}
```

---

## Displaying Results in Ned's UI

Use the `VideoAnalysisDisplay` component to show analyzed frames:

```typescript
import { VideoAnalysisDisplay } from './VideoAnalysisDisplay';

// In Ned's message rendering component:
{message.type === 'assistant' && message.videoAnalysis && (
  <div>
    {/* Text answer */}
    <p>{message.videoAnalysis.answer}</p>

    {/* Visual proof - analyzed frames */}
    <VideoAnalysisDisplay
      frames={message.videoAnalysis.analyzedFrames}
      timeRange={message.videoAnalysis.timeRange}
    />
  </div>
)}
```

This renders the frames in a filmstrip or grid view with timestamps, giving users visual confirmation of what the AI analyzed.

---

## Sampling Strategies

### Dense (Every 2 seconds)
- **Use when**: Short critical moments, detailed debugging
- **Frame count**: ~5 frames per 10 seconds
- **Good for**: "What error message appeared at 1:23?"

### Sparse (Every 10 seconds)
- **Use when**: Long time ranges, broad overviews
- **Frame count**: ~1 frame per 10 seconds
- **Good for**: "What did I do between 1:00 and 5:00?"

### Smart (Adaptive)
- **Use when**: Default choice, balanced analysis
- **Samples at**:
  - Screenshot timestamps (activity detected)
  - Audio segment starts (user speaking)
  - Context item timestamps (user added notes)
  - 5-second intervals to fill gaps
- **Good for**: Most queries

---

## Error Handling

```typescript
try {
  const result = await videoAnalysisAgent.analyzeVideoMoment(request);
  // Use result
} catch (error) {
  if (error.message.includes('Session has no video recording')) {
    return "I can't analyze video for this session because it doesn't have a video recording. Only sessions recorded after [date] have video.";
  }

  if (error.message.includes('Video file not found')) {
    return "I found the session but the video file seems to be missing. It may have been deleted or moved.";
  }

  // Generic error
  return `I encountered an error analyzing the video: ${error.message}`;
}
```

---

## Response Format

Always structure Ned's response as:

1. **Direct answer** (2-4 sentences addressing the question)
2. **Visual proof** (VideoAnalysisDisplay component showing analyzed frames)
3. **Optional timestamp link** (if helpful, link to exact moment in video player)

Example:
```
At 2:30 in your coding session, you were implementing the user authentication flow.
You had VS Code open with LoginForm.tsx, and were connecting the form submission to
the backend API. The browser dev tools were open showing a 401 error that you were debugging.

[VideoAnalysisDisplay component here showing 5 frames]

You can review this moment in detail at 2:30 in the session video.
```

---

## Configuration Requirements

### Environment Variables
```bash
# Required for video analysis agent
ANTHROPIC_API_KEY=your_api_key_here
```

### Dependencies
Already installed in package.json:
- `@anthropic-ai/sdk` - v0.65.0

---

## Testing the Integration

### Test Case 1: Basic Query
```typescript
const result = await videoAnalysisAgent.analyzeVideoMoment({
  sessionId: 'test-session',
  timeRange: { start: 60, end: 70 },
  question: 'What application was visible?',
  samplingStrategy: 'smart'
});

console.log('Answer:', result.answer);
console.log('Analyzed frames:', result.analyzedFrames.length);
```

### Test Case 2: Long Range
```typescript
const result = await videoAnalysisAgent.analyzeVideoMoment({
  sessionId: 'test-session',
  timeRange: { start: 0, end: 300 }, // First 5 minutes
  question: 'What did the user accomplish?',
  samplingStrategy: 'sparse'
});
```

---

## Performance Considerations

### Frame Extraction Speed
- Each frame takes ~50-100ms to extract
- Smart strategy typically extracts 6-12 frames per 60 seconds
- Total extraction time: Usually under 1 second

### Claude API Call
- Sending 10 frames + prompt: ~2-3 seconds
- Sending 30 frames + prompt: ~4-6 seconds

### Total Latency
- Typical query (10 frames): **3-4 seconds**
- Long range query (30 frames): **5-7 seconds**

---

## Future Enhancements

### 1. Caching
Cache frame extractions for frequently queried time ranges.

### 2. Batch Analysis
Allow Ned to analyze multiple time ranges in one agent call.

### 3. Video Scrubbing
Return specific timestamps where key events occurred so Ned can link directly to them.

### 4. Confidence Thresholds
If confidence < 0.6, suggest the user review the video themselves.

---

## Complete Integration Checklist

- [ ] Add `analyze_session_video` tool to Ned's tool registry
- [ ] Implement tool handler that calls `videoAnalysisAgent.analyzeVideoMoment()`
- [ ] Add `VideoAnalysisDisplay` component to Ned's message renderer
- [ ] Update Ned's message types to include `videoAnalysis` field
- [ ] Set `ANTHROPIC_API_KEY` environment variable
- [ ] Test with sample queries
- [ ] Add error handling for common failure cases
- [ ] Document for users how to ask video-related questions

---

## Example Ned System Prompt Addition

Add this to Ned's system prompt:

```
You have access to a video analysis tool that can examine screen recordings from the user's work sessions.

When the user asks about:
- What they were working on at a specific time
- What happened during a time range
- Visual details from their screen
- Finding when something specific occurred

Use the 'analyze_session_video' tool to get accurate information from the actual screen recording.

The tool returns both a text description AND the actual frames that were analyzed.
Always include the visual proof (frames) in your response so the user can verify the analysis.

Be specific with timestamps and use the smart sampling strategy unless the user
specifically needs very detailed frame-by-frame analysis (dense) or a broad overview (sparse).
```

---

## Summary

The video analysis integration gives Ned the ability to:
1. Answer "what was I working on at X time?" questions accurately
2. Find specific moments in recordings
3. Provide visual proof of analysis
4. Maintain clean context (agent handles images, Ned only gets text)

Total implementation time: ~30 minutes once the agent is built.
