# Taskerino AI Architecture Map
**Complete Analysis of All AI Agents, Services, and Processes**

Generated: 2025-10-13

---

## Executive Summary

Taskerino employs **9 distinct AI agents/services** powered by **2 AI providers** (Anthropic Claude & OpenAI) with a total codebase of **~9,000 lines** of AI-related service code. The system uses **5 different AI models** ranging from lightweight (Haiku) to powerful (Sonnet 4.5, GPT-4o-audio).

### Key Capabilities
- **Intelligent Note Processing**: Automatically detects topics, extracts tasks, merges similar content
- **Work Session Tracking**: Real-time screenshot analysis and comprehensive audio review
- **Conversational AI Assistant**: Tool-using agent (Ned) with memory and permissions system
- **Smart Search**: Semantic search across notes, tasks, and sessions using dedicated AI agents
- **Audio Intelligence**: Real-time transcription AND post-session comprehensive audio analysis

### Cost Considerations
- **Real-time operations**: ~$0.006/min (Whisper), ~$0.10-0.15/request (Claude Sonnet/Haiku)
- **Post-session analysis**: ~$0.026/min (GPT-4o-audio), up to $0.62 for 24min session
- **Screenshot analysis**: ~$0.10-0.15/screenshot (Claude Sonnet 4.5 with vision)

---

## Table of Contents
1. [AI Service Inventory](#ai-service-inventory)
2. [Detailed Service Breakdown](#detailed-service-breakdown)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Integration Points](#integration-points)
5. [Configuration & API Keys](#configuration--api-keys)
6. [Key Findings & Concerns](#key-findings--concerns)

---

## AI Service Inventory

| # | Service Name | AI Provider | Model(s) | LOC | Purpose | Trigger |
|---|-------------|-------------|----------|-----|---------|---------|
| 1 | **ClaudeService** | Anthropic | Sonnet 4.5 | 898 | Note processing, topic detection, task extraction | User input capture |
| 2 | **OpenAIService** | OpenAI | Whisper-1, GPT-4o-audio | 448 | Audio transcription & comprehensive analysis | Real-time + post-session |
| 3 | **SessionsAgentService** | Anthropic | Sonnet 4.5 | 717 | Screenshot analysis during sessions | Auto (every N min) |
| 4 | **NedService** | Anthropic | Sonnet 4 | 468 | Conversational AI assistant | User chat |
| 5 | **ContextAgent** | Anthropic | Haiku 3.5 | 293 | Search notes/tasks for Ned | Ned tool call |
| 6 | **SessionsQueryAgent** | Anthropic | Haiku 3.5 | 428 | Search sessions for Ned | Ned tool call |
| 7 | **AudioReviewService** | OpenAI | GPT-4o-audio | 439 | One-time comprehensive audio review | First session view |
| 8 | **BackgroundProcessor** | Claude | Sonnet 4.5 | 236 | Queue manager for ClaudeService | Async processing |
| 9 | **LearningService** | None | N/A (Logic) | 583 | User preference learning system | Note/task feedback |

**Supporting Services** (no AI models, but AI-related):
- NedToolExecutor (1002 LOC) - Tool execution for Ned
- NedTools (434 LOC) - Tool definitions for Ned
- NedMemory (238 LOC) - Memory system for Ned
- Audio processing services (1390 LOC combined)

**Total AI Service Code**: ~8,946 lines

---

## Detailed Service Breakdown

### 1. ClaudeService
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/claudeService.ts`

**Model**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)

**Purpose**: Primary AI workhorse for processing user input into structured data

**Capabilities**:
- Topic detection (companies, people, other categories)
- Note creation with auto-summarization
- Task extraction with due date inference
- Multi-modal support (text + images via vision API)
- Duplicate task detection
- Note merging logic
- Learning system integration

**Input**:
- User text input
- Existing topics, notes, tasks (for context)
- AI settings (system instructions)
- User learnings (personalization)
- Attachments (images, screenshots)

**Output** (`AIProcessResult`):
```typescript
{
  detectedTopics: [{name, type, confidence, existingTopicId}],
  notes: [{topicId, content, summary, tags, sentiment, keyPoints}],
  tasks: [{title, priority, dueDate, dueTime, description, tags, subtasks}],
  skippedTasks: [{title, reason, existingTaskTitle}], // Duplicates
  sentiment: 'positive' | 'neutral' | 'negative',
  keyTopics: string[]
}
```

**Triggered By**:
- User submits text in Capture Zone
- User adds attachments (images analyzed via vision)
- Background processor picks up job from queue

**Used By**:
- `/src/components/CaptureZone.tsx`
- `/src/services/backgroundProcessor.ts`

**Key Features**:
- **Vision Support**: Analyzes images/screenshots, extracts text (OCR), identifies visual elements
- **Context-Aware**: Uses recent notes/tasks to avoid duplicates and improve categorization
- **Date Intelligence**: Infers due dates from phrases like "EOD", "next Friday", "in 2 weeks"
- **Learning Integration**: Applies user preference patterns to improve accuracy over time

**API Call Pattern**:
```typescript
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: prompt },
      { type: 'image', source: { type: 'base64', media_type, data } }
    ]
  }]
});
```

**Cost Estimate**: ~$0.10-0.15 per request (varies with input length + images)

---

### 2. OpenAIService
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/openAIService.ts`

**Models**:
- **Whisper-1** (real-time transcription)
- **GPT-4o-audio-preview** (comprehensive audio analysis)

**Purpose**: Dual-mode audio intelligence

#### Mode 1: Real-Time Transcription (Whisper-1)
**Triggered**: Every audio segment during active session

**Input**: Base64 WAV audio (any sample rate)

**Output**: Plain text transcription

**Cost**: $0.006/minute (~$0.36/hour)

**Method**: `transcribeAudio(audioBase64: string): Promise<string>`

**Used During**: Live session recording for quick speech-to-text

#### Mode 2: Comprehensive Audio Analysis (GPT-4o-audio-preview)
**Triggered**: First time user views completed session summary

**Input**:
- Downsampled 8kHz WAV audio (for size reduction)
- Session context (name, description, duration, screenshot count)

**Output** (`AudioInsights`):
```typescript
{
  transcription: string, // Full transcript (cleaner than Whisper)
  insights: {
    narrative: string, // Story of the session
    emotionalJourney: [{ timestamp, emotion, description }],
    keyMoments: [{ timestamp, type, description, context, excerpt }],
    workPatterns: {
      focusLevel: 'high' | 'medium' | 'low',
      interruptions: number,
      flowStates: [{ start, end, description }]
    },
    environmentalContext: {
      ambientNoise: string,
      workSetting: string,
      timeOfDay: string
    }
  }
}
```

**Cost**: $0.026/minute (~$1.56/hour, max 25 minutes per call)

**Method**: `analyzeFullAudio(audioBase64, context): Promise<{transcription, insights}>`

**Key Features**:
- **Chunking Support**: Automatically splits audio >24 minutes into 15-min chunks
- **Emotional Intelligence**: Tracks user's emotional state throughout session
- **Productivity Insights**: Identifies flow states, interruptions, blockers
- **Environmental Awareness**: Understands ambient noise, work setting cues

**API Call Pattern**:
```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o-audio-preview',
  modalities: ['text'],
  messages: [{
    role: 'user',
    content: [
      {
        type: 'input_audio',
        input_audio: { data: base64Data, format: 'wav' }
      },
      { type: 'text', text: comprehensivePrompt }
    ]
  }]
});
```

**Used By**:
- `/src/services/audioReviewService.ts`
- `/src/components/AudioReviewProgressModal.tsx`

---

### 3. SessionsAgentService
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/sessionsAgentService.ts`

**Model**: Claude Sonnet 4.5 (with vision)

**Purpose**: Real-time screenshot analysis during work sessions

**Triggered**:
- Automatically every N minutes during active session (default: 2 min)
- User manually captures screenshot

**Input**:
- Screenshot image (base64 JPEG/PNG)
- Session context (name, description, duration)
- Previous screenshots (sliding window of last 5)
- Previous summaries (for context continuity)

**Output** (`SessionScreenshot.aiAnalysis`):
```typescript
{
  summary: string, // What's happening in this screenshot
  detectedActivity: string, // e.g., "writing-email", "coding-python"
  extractedText: string, // OCR results
  keyElements: string[], // ["Gmail", "Draft to customer", "pricing spreadsheet"]
  suggestedActions: string[], // Tasks the agent noticed
  contextDelta: string, // What changed since last screenshot
  confidence: number,
  progressIndicators: {
    achievements: string[], // Completed items
    blockers: string[], // Issues encountered
    insights: string[] // Important learnings
  }
}
```

**Key Features**:
- **Context Window**: Maintains memory of last 5 screenshots for continuity
- **Progress Tracking**: Identifies achievements, blockers, and insights
- **Activity Detection**: Categorizes work type (email, coding, research, etc.)
- **Smart OCR**: Extracts meaningful text from screenshots

**Methods**:
1. `analyzeScreenshot(screenshot, session, base64, mimeType)` - Analyze single screenshot
2. `generateSessionSummary(session, screenshots, audioSegments)` - Create overall summary
3. `generateSessionMetadata(session, screenshots, audioSegments)` - Update session title/description

**API Call Pattern**:
```typescript
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 2048,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type, data } },
      { type: 'text', text: analysisPrompt }
    ]
  }]
});
```

**Cost Estimate**: ~$0.10-0.15 per screenshot

**Used By**:
- `/src/components/SessionsZone.tsx`
- `/src/components/ActiveSessionIndicator.tsx`
- `/src/components/SessionDetailView.tsx`

---

### 4. NedService (AI Assistant)
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/nedService.ts`

**Model**: Claude Sonnet 4 (`claude-sonnet-4-20250514`)

**Purpose**: Conversational AI assistant with tool-use capabilities

**Triggered**: User sends message in Ned chat interface

**Capabilities**:
- Multi-turn conversations with context
- Tool calling (17 tools available)
- Streaming responses
- Permission system for write operations
- Memory integration

**Input**:
- User message
- Conversation history
- Full app state (for tool execution)
- System instructions

**Output**: Streaming text + tool calls + tool results

**Tools Available** (17 total):
- **Read Tools** (10): query_context_agent, get_current_datetime, get_user_context, recall_memory, get_item_details, query_sessions, get_session_details, get_session_summary, get_active_session, get_screenshot_image
- **Write Tools** (7): create_task, update_task, complete_task, delete_task, create_note, update_note, delete_note, record_memory

**Architecture**:
```
User Input → NedService → Claude Sonnet 4 → [Text + Tool Calls]
                ↓                                      ↓
         Tool Executor ← Permission Check ← Tool Calls
                ↓
         Tool Results → Claude Sonnet 4 → Continue/Complete
```

**Key Features**:
- **Multi-Turn Tool Calling**: Can use multiple tools sequentially until task complete
- **Large Context Window**: Gets full data from searches, can answer follow-ups without re-searching
- **Permission System**: Write operations require user approval (forever/session/ask)
- **Memory System**: Remembers user preferences and past interactions

**API Call Pattern** (streaming with tools):
```typescript
const stream = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 8192,
  system: systemPrompt,
  messages: conversationHistory,
  tools: toolDefinitions,
  stream: true
});
```

**Cost Estimate**: ~$0.15-0.30 per conversation turn (varies with tool usage)

**Used By**:
- `/src/components/ned/NedChat.tsx`
- `/src/components/ned/NedSettings.tsx`

---

### 5. ContextAgent (Search Agent)
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/contextAgent.ts`

**Model**: Claude Haiku 3.5 (`claude-3-5-haiku-20241022`)

**Purpose**: Semantic search for notes and tasks (works behind scenes for Ned)

**Triggered**: Ned calls `query_context_agent` tool

**Input**:
- Search query (natural language)
- All notes, tasks, companies, contacts, topics
- Optional thread ID (for multi-turn refinement)

**Output** (`ContextAgentResult`):
```typescript
{
  notes: Note[], // Matching notes
  tasks: Task[], // Matching tasks
  summary: string, // AI-generated summary of results
  suggestions: string[], // Follow-up questions
  thread_id: string // For continuing conversation
}
```

**Key Features**:
- **Quality Over Quantity**: Returns 3-10 most relevant results (not all matches)
- **Thread Support**: Multi-turn conversations to refine search
- **Metadata-Aware**: Searches by keywords, dates, tags, entities, relationships
- **Smart Ranking**: Prioritizes exact matches, recent items, high-priority tasks

**Search Strategy**:
1. Keyword matching in content, titles, tags
2. Date filtering using metadata
3. Entity linking (companies, contacts, topics)
4. Relationship awareness (tasks → notes, notes → topics)
5. Rank by relevance, recency, importance

**System Prompt Highlights**:
- "Return 3-10 MOST RELEVANT items, not 50 loosely related"
- "Better to return 5 perfect matches than 50 mediocre ones"
- Understands relative dates ("this week", "Q4", "next Monday")

**Cost Estimate**: ~$0.01-0.02 per search (Haiku is very affordable)

**Used By**: NedToolExecutor → Ned

---

### 6. SessionsQueryAgent
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/sessionsQueryAgent.ts`

**Model**: Claude Haiku 3.5 (`claude-3-5-haiku-20241022`)

**Purpose**: Semantic search for work sessions (works behind scenes for Ned)

**Triggered**: Ned calls `query_sessions` tool

**Input**:
- Search query (natural language)
- All sessions with metadata
- Optional thread ID (for multi-turn refinement)

**Output** (`SessionsQueryResult`):
```typescript
{
  sessions: Session[], // Matching sessions
  summary: string, // AI-generated summary
  suggestions: string[], // Follow-up questions
  thread_id: string
}
```

**Key Features**:
- **Activity-Aware**: Searches through screenshot analyses and audio transcripts
- **Temporal Intelligence**: Understands "yesterday", "last week", "this month"
- **Audio-First**: Treats audio-only sessions equally to screenshot-based sessions
- **Quality Focus**: Returns 3-8 most relevant sessions

**Search Capabilities**:
- Session name/description keywords
- Screenshot content (via AI analysis)
- Audio transcriptions (what user said)
- Activity types (coding, email, research)
- Duration filtering (short vs long sessions)
- Status filtering (active, paused, completed)

**Data Context Built**:
```
For each session:
- Name, description, tags, status
- Duration, timestamps
- Screenshot count + detected activities
- Audio segment count + transcription previews
- Key phrases from audio
- Detected tasks/blockers in audio
```

**Cost Estimate**: ~$0.01-0.02 per search

**Used By**: NedToolExecutor → Ned

---

### 7. AudioReviewService
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/audioReviewService.ts`

**Model**: GPT-4o-audio-preview (via OpenAIService)

**Purpose**: One-time comprehensive post-session audio analysis

**Triggered**:
- First time user opens session summary page
- Only if session has audio segments AND not yet reviewed

**Flow**:
```
Session Complete → User Opens Summary → Check needsReview()
                                               ↓ YES
                                    AudioReviewService
                                               ↓
                                    1. Concatenate all audio segments
                                    2. Downsample to 8kHz (size reduction)
                                    3. Check constraints (20MB, 25min)
                                    4. Send to GPT-4o-audio-preview
                                    5. Parse comprehensive analysis
                                    6. Save to session (audioReviewCompleted = true)
                                    7. NEVER runs again for this session
```

**Constraints**:
- Max file size: 20MB (uses 18MB with buffer)
- Max duration: 25 minutes (uses 24min with buffer)
- If exceeded: Automatic chunking into 15-min segments

**Output**: Saved to session as:
- `fullTranscription: string` - Complete clean transcript
- `audioInsights: AudioInsights` - Comprehensive analysis object
- `fullAudioAttachmentId: string` - Concatenated audio file
- `audioReviewCompleted: boolean` - True (prevents re-processing)

**Chunking Strategy** (for large sessions):
1. Split audio into 15-min chunks
2. Process each chunk separately
3. Merge results programmatically:
   - Concatenate transcriptions
   - Adjust timestamps for emotional journey, key moments, flow states
   - Calculate average focus level
   - Sum interruptions
   - Use first chunk's environmental context

**Progress Stages**:
1. Preparing (10%)
2. Concatenating (30%)
3. Analyzing (50-90%)
4. Parsing (90%)
5. Complete (100%)

**Cost Estimate**:
- 5 min session: ~$0.13
- 15 min session: ~$0.39
- 24 min session: ~$0.62

**Used By**:
- `/src/components/AudioReviewProgressModal.tsx`
- `/src/components/SessionDetailView.tsx`

---

### 8. BackgroundProcessor
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/backgroundProcessor.ts`

**Model**: None (uses ClaudeService)

**Purpose**: Queue management for async AI processing

**Architecture**:
```
User Input → addJob() → Queue (in-memory)
                             ↓
                      Processing Loop (500ms interval)
                             ↓
                      processNext() → ClaudeService.processInput()
                             ↓
                      Progress Callbacks → UI Updates
                             ↓
                      Complete/Error Callbacks
```

**Job Lifecycle**:
1. **Queued**: Job added to queue
2. **Processing**: ClaudeService working on it
3. **Complete**: Result ready
4. **Error**: Failed (error message available)

**Features**:
- **Queue Management**: FIFO processing, one job at a time
- **Progress Tracking**: Real-time progress updates (0-100%)
- **Step Visibility**: Shows current AI processing step
- **Callbacks**: onProgress, onComplete, onError
- **Persistence**: Jobs stored in-memory (cleared on refresh)

**Used By**:
- `/src/components/CaptureZone.tsx`

**Why Needed**:
- Prevents UI blocking during AI processing
- Provides visual feedback (progress bar, status messages)
- Allows user to continue working while AI processes

---

### 9. LearningService
**File**: `/Users/jamesmcarthur/Documents/taskerino/src/services/learningService.ts`

**Model**: None (pure logic, no AI API calls)

**Purpose**: User preference learning and pattern reinforcement

**How It Works**:
1. **Observation**: AI makes decisions (task priority, due date, tags)
2. **User Feedback**: User confirms, modifies, or rejects
3. **Learning**: System adjusts pattern strength based on feedback
4. **Application**: ClaudeService uses learnings in future prompts

**Learning Categories**:
- `task-creation` - How to create tasks
- `task-timing` - Due date inference patterns
- `task-priority` - Priority assignment rules
- `topic-detection` - Topic matching preferences
- `note-merging` - When to merge notes
- `tagging` - Tag patterns
- `formatting` - Content formatting preferences

**Strength Levels** (0-100 points):
- **0-10**: Deprecated (ignored)
- **10-50**: Observation (shown as suggestion)
- **50-80**: Active Pattern (followed unless contradicted)
- **80-100**: Strong Rule (strictly followed)

**Point System**:
- Confirmation: +10 points
- Rejection: -20 points
- Application: +1 point (when AI uses it)
- Flag: 1.5x multiplier (user-flagged for faster promotion)
- Time Decay: -0.5 points/day after 30 days

**Integration with ClaudeService**:
```typescript
// LearningService formats applicable learnings
const applicableLearnings = learningService.getApplicableLearnings();
const formattedLearnings = learningService.formatForPrompt(applicableLearnings);

// ClaudeService includes in system prompt
const prompt = `
${systemInstructions}

**USER-SPECIFIC LEARNINGS:**
${formattedLearnings}

✅ RULE (80%+): Must follow strictly
📊 PATTERN (50-80%): Should follow unless context contradicts
🔬 OBSERVATION (<50%): Consider as suggestion

When creating tasks, due dates, priorities, check learnings first.
`;
```

**Used By**:
- ClaudeService (reads learnings)
- `/src/components/LearningDashboard.tsx` (manage learnings)

---

## Data Flow Diagrams

### Flow 1: Note Capture with AI Processing

```
┌──────────────┐
│ User Types   │
│ in Capture   │
│ Zone         │
└──────┬───────┘
       │
       ├─ Optional: Attach images/screenshots
       │
       ▼
┌──────────────────────────────────────────┐
│ Background Processor                     │
│ - Creates job                            │
│ - Queues for processing                  │
│ - Shows progress bar                     │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ ClaudeService.processInput()             │
│                                          │
│ Inputs:                                  │
│ - User text                              │
│ - Existing topics/notes/tasks            │
│ - AI settings                            │
│ - User learnings (preferences)           │
│ - Attachments (if any)                   │
│                                          │
│ AI Model: Claude Sonnet 4.5              │
│ Vision: YES (if images attached)         │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ AI Analysis                              │
│ 1. Detect topics (company/person/other) │
│ 2. Match to existing or create new      │
│ 3. Generate note summary + content      │
│ 4. Extract tasks with due dates         │
│ 5. Check for duplicate tasks            │
│ 6. Apply user learnings                 │
│ 7. Analyze images (if attached)         │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ AIProcessResult                          │
│ {                                        │
│   detectedTopics: [...],                 │
│   notes: [...],                          │
│   tasks: [...],                          │
│   skippedTasks: [...],                   │
│   sentiment: 'positive',                 │
│   keyTopics: [...]                       │
│ }                                        │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ App State Update (via reducer)           │
│ - Create/update topics                   │
│ - Add notes                              │
│ - Add tasks                              │
│ - Update UI                              │
└──────────────────────────────────────────┘
```

### Flow 2: Work Session with Screenshot Analysis

```
┌──────────────┐
│ User Starts  │
│ Session      │
└──────┬───────┘
       │
       ▼
┌────────────────────────────────────────────────┐
│ Active Session                                 │
│ - Timer starts                                 │
│ - Screenshot interval: 2 min (configurable)    │
│ - Audio mode: off/transcription (configurable) │
└────────┬───────────────────────────────────────┘
         │
         ├──────────────────┬──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐ ┌───────────────┐ ┌────────────────┐
│ Screenshot     │ │ Audio         │ │ User Actions   │
│ Timer Fires    │ │ Recording     │ │ (manual snap,  │
│ (every 2 min)  │ │ (if enabled)  │ │ add comment)   │
└────┬───────────┘ └───┬───────────┘ └────┬───────────┘
     │                 │                  │
     ▼                 ▼                  │
┌──────────────┐ ┌──────────────────┐   │
│ Capture      │ │ Record Audio     │   │
│ Screenshot   │ │ Segment          │   │
└────┬─────────┘ └───┬──────────────┘   │
     │               │                  │
     ▼               ▼                  │
┌──────────────────────────────────────────────┐
│ SessionsAgentService.analyzeScreenshot()     │
│                                              │
│ Inputs:                                      │
│ - Screenshot image (base64)                  │
│ - Session context (name, description)        │
│ - Recent screenshots (last 5)                │
│ - Previous summaries                         │
│                                              │
│ AI Model: Claude Sonnet 4.5 (vision)        │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Screenshot AI Analysis                       │
│ {                                            │
│   summary: "User editing email draft",       │
│   detectedActivity: "email-writing",         │
│   extractedText: "To: customer@...",         │
│   keyElements: ["Gmail", "Draft"],           │
│   suggestedActions: ["Send email"],          │
│   contextDelta: "Started new email",         │
│   progressIndicators: {                      │
│     achievements: [],                        │
│     blockers: [],                            │
│     insights: []                             │
│   }                                          │
│ }                                            │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Save to Session                              │
│ - Screenshot with analysis                   │
│ - Update session summary (if 5+ screenshots) │
│ - Update metadata (title/description)        │
└──────────────────────────────────────────────┘

Meanwhile (if audio enabled):
┌──────────────────────────────────────────────┐
│ OpenAIService.transcribeAudio()              │
│ - Model: Whisper-1                           │
│ - Output: Real-time transcription           │
│ - Saved as SessionAudioSegment              │
└──────────────────────────────────────────────┘
```

### Flow 3: Post-Session Audio Review

```
┌──────────────┐
│ Session      │
│ Completed    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ User Opens Session Summary Page              │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Check: audioReviewService.needsReview()?     │
│ - Has audio segments?                        │
│ - Not yet reviewed?                          │
└────┬─────────────────────────────────────────┘
     │ YES
     ▼
┌──────────────────────────────────────────────┐
│ AudioReviewService.reviewSession()           │
│                                              │
│ Step 1: Concatenate all audio segments      │
│ Step 2: Downsample to 8kHz (size reduction) │
│ Step 3: Check constraints (20MB, 25min)     │
│ Step 4: Chunk if needed (15min chunks)      │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ OpenAIService.analyzeFullAudio()             │
│                                              │
│ Inputs:                                      │
│ - Concatenated audio (8kHz WAV)             │
│ - Session context (name, desc, duration)    │
│                                              │
│ AI Model: GPT-4o-audio-preview              │
│ Max: 25 minutes, 20MB                       │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Comprehensive Audio Analysis                 │
│ {                                            │
│   transcription: "Full clean transcript",    │
│   insights: {                                │
│     narrative: "User debugged auth flow...", │
│     emotionalJourney: [{                     │
│       timestamp: 120,                        │
│       emotion: "frustrated",                 │
│       description: "Stuck on CORS error"     │
│     }],                                      │
│     keyMoments: [{                           │
│       timestamp: 480,                        │
│       type: "achievement",                   │
│       description: "Fixed auth bug",         │
│       excerpt: "Yes! That worked!"           │
│     }],                                      │
│     workPatterns: {                          │
│       focusLevel: "high",                    │
│       interruptions: 2,                      │
│       flowStates: [...]                      │
│     },                                       │
│     environmentalContext: {...}              │
│   }                                          │
│ }                                            │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Save to Session (ONE TIME ONLY)             │
│ - fullTranscription                          │
│ - audioInsights                              │
│ - fullAudioAttachmentId                      │
│ - audioReviewCompleted = true                │
│                                              │
│ ⚠️ NEVER re-processed for this session      │
└──────────────────────────────────────────────┘
```

### Flow 4: Ned AI Assistant Conversation

```
┌──────────────┐
│ User Opens   │
│ Ned Chat     │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ User: "Show me tasks about NVIDIA"           │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ NedService.sendMessage()                     │
│ - Build conversation history                 │
│ - Include system prompt                      │
│ - Add 17 tool definitions                    │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Claude Sonnet 4 (streaming)                  │
│ - Analyzes user query                        │
│ - Decides to use query_context_agent tool    │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Tool Call: query_context_agent               │
│ {                                            │
│   query: "tasks about NVIDIA",               │
│   agent_thread_id: null                      │
│ }                                            │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ NedToolExecutor.execute()                    │
│ - Route to queryContextAgent()               │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ ContextAgent.search()                        │
│ - Model: Claude Haiku 3.5                   │
│ - Search all tasks/notes                     │
│ - Filter by keyword "NVIDIA"                 │
│ - Rank by relevance                          │
│ - Return top 5-10 results                    │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Tool Result                                  │
│ {                                            │
│   summary: "Found 3 NVIDIA tasks",           │
│   tasks: [                                   │
│     {id, title, priority, dueDate, ...},     │
│     ...                                      │
│   ],                                         │
│   notes: [...],                              │
│   suggestions: ["Show NVIDIA notes?"]        │
│ }                                            │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Back to Claude Sonnet 4                      │
│ - Receives tool result                       │
│ - Formats response for user                  │
│ - Streams text: "I found 3 NVIDIA tasks..."  │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ User Sees Response                           │
│ - Streaming text                             │
│ - Task cards (interactive)                   │
└──────────────────────────────────────────────┘

Follow-Up:
┌──────────────────────────────────────────────┐
│ User: "Which are high priority?"             │
└────┬─────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│ Claude Sonnet 4                              │
│ - Already has full task data in context     │
│ - NO NEW TOOL CALL NEEDED                   │
│ - Filters tasks by priority="high"          │
│ - Responds immediately                       │
└──────────────────────────────────────────────┘
```

---

## Integration Points

### UI Components → AI Services

| Component | Services Used | Purpose |
|-----------|--------------|---------|
| **CaptureZone** | BackgroundProcessor → ClaudeService | Process user input into notes/tasks |
| **SessionsZone** | SessionsAgentService | Analyze screenshots during active session |
| **ActiveSessionIndicator** | SessionsAgentService | Show real-time session status |
| **SessionDetailView** | AudioReviewService, SessionsAgentService | Comprehensive session summary |
| **NedChat** | NedService → [ContextAgent, SessionsQueryAgent, NedToolExecutor] | AI assistant chat |
| **NedSettings** | NedService, NedMemory | Configure Ned permissions & memory |
| **AudioReviewProgressModal** | AudioReviewService | Show progress during audio review |
| **LearningDashboard** | LearningService | Manage user preference learnings |
| **ProfileZone** | ClaudeService, OpenAIService | API key configuration |

### Service → Service Dependencies

```
NedService
├─ calls → ContextAgent (search notes/tasks)
├─ calls → SessionsQueryAgent (search sessions)
├─ calls → NedToolExecutor
│  ├─ uses → ContextAgent
│  ├─ uses → SessionsQueryAgent
│  ├─ uses → SessionsAgentService (summary generation)
│  ├─ uses → NedMemory (recall/record)
│  └─ uses → AttachmentStorage (screenshot loading)
└─ uses → NedMemory (context formatting)

ClaudeService
├─ uses → LearningService (get applicable learnings)
└─ uses → FileStorage (read attachments)

AudioReviewService
├─ calls → AudioConcatenationService (merge audio)
├─ calls → AudioStorageService (save full audio)
└─ calls → OpenAIService (GPT-4o-audio analysis)

BackgroundProcessor
└─ calls → ClaudeService (process input)

SessionsAgentService
└─ standalone (no service dependencies)

OpenAIService
└─ standalone (no service dependencies)

ContextAgent
└─ standalone (no service dependencies)

SessionsQueryAgent
└─ standalone (no service dependencies)

LearningService
└─ standalone (no service dependencies)

NedMemory
└─ standalone (no service dependencies)
```

### State Management Integration

All AI services integrate with React state via:
1. **App.tsx**: Main state container (`AppState`)
2. **useReducer**: State updates via actions
3. **Callbacks**: Services receive dispatch function

Example:
```typescript
// In App.tsx
const [state, dispatch] = useReducer(appReducer, initialState);

// Pass to component
<CaptureZone
  onProcessed={(result) => {
    // Handle AIProcessResult
    result.detectedTopics.forEach(topic => {
      dispatch({ type: 'ADD_TOPIC', payload: topic });
    });
    result.notes.forEach(note => {
      dispatch({ type: 'ADD_NOTE', payload: note });
    });
    result.tasks.forEach(task => {
      dispatch({ type: 'ADD_TASK', payload: task });
    });
  }}
/>
```

---

## Configuration & API Keys

### API Key Storage

**Location**: `localStorage`

**Keys**:
- `claude-api-key` - Anthropic API key (used by all Claude services)
- `openai-api-key` - OpenAI API key (used by audio services)

**Access Pattern**:
```typescript
// All services auto-load on initialization
constructor() {
  this.loadApiKeyFromStorage();
}

private loadApiKeyFromStorage() {
  const savedKey = localStorage.getItem('claude-api-key');
  if (savedKey) {
    this.client = new Anthropic({
      apiKey: savedKey,
      dangerouslyAllowBrowser: true
    });
  }
}
```

### Service Initialization

All services use singleton pattern:
```typescript
// Export singleton instance
export const claudeService = new ClaudeService();
export const openAIService = new OpenAIService();
export const nedService = new NedService();
// ... etc
```

### Configuration UI

**Location**: `/src/components/ProfileZone.tsx`

**Features**:
- API key input fields (password type, masked)
- Key validation (check format)
- Save to localStorage
- Success/error notifications

**First-Time Setup**: `/src/components/FirstTimeSetup.tsx`

### AI Settings

**Location**: `AppState.aiSettings`

```typescript
interface AISettings {
  systemInstructions: string;  // Custom instructions for Claude
  autoMergeNotes: boolean;      // Auto-merge similar notes
  autoExtractTasks: boolean;    // Auto-extract tasks from notes
}
```

**Customization**:
- System instructions: Custom prompts appended to all ClaudeService calls
- Auto-merge: Controls note consolidation behavior
- Auto-extract: Toggle task extraction

### Learning Settings

**Location**: `AppState.learningSettings`

```typescript
interface LearningSettings {
  enabled: boolean;
  confirmationPoints: number;    // Default: 10
  rejectionPenalty: number;      // Default: 20
  applicationBonus: number;      // Default: 1
  flagMultiplier: number;        // Default: 1.5
  timeDecayDays: number;         // Default: 30
  timeDecayRate: number;         // Default: 0.5
  thresholds: {
    deprecated: number;          // Default: 10
    active: number;              // Default: 50
    rule: number;                // Default: 80
  }
}
```

**Optimization**: ClaudeService can suggest parameter adjustments based on learning effectiveness

### Ned Settings

**Location**: `AppState.nedSettings`

```typescript
interface NedSettings {
  chattiness: 'concise' | 'balanced' | 'detailed';
  showThinking: boolean;           // Show tool thinking process
  permissions: NedPermission[];    // Forever permissions
  sessionPermissions: NedPermission[]; // Session permissions (cleared on restart)
  tokenUsage: {
    total: number;
    thisMonth: number;
    estimatedCost: number;
  }
}

interface NedPermission {
  toolName: string;
  level: 'forever' | 'session' | 'always-ask';
  grantedAt: string;
}
```

---

## Key Findings & Concerns

### ✅ Strengths

1. **Well-Architected AI Integration**
   - Clear separation of concerns (ClaudeService for notes, OpenAIService for audio)
   - Singleton pattern prevents multiple API clients
   - Service layer abstraction makes AI swappable

2. **Cost-Conscious Design**
   - One-time audio review (never re-processed)
   - Lightweight Haiku for search operations
   - Chunking strategy for large audio files

3. **User-Centric Features**
   - Learning system adapts to user preferences
   - Permission system for AI write operations
   - Memory system for personalized interactions

4. **Comprehensive AI Capabilities**
   - Multi-modal processing (text, images, audio)
   - Real-time + post-session analysis
   - Tool-using conversational AI
   - Semantic search

### ⚠️ Concerns & Recommendations

#### 1. **API Key Security** 🔴 HIGH PRIORITY
**Issue**: API keys stored in `localStorage` (plain text)

**Risk**:
- XSS attacks could steal keys
- Keys visible in browser dev tools
- No encryption

**Recommendation**:
- Move to Tauri secure storage
- Implement key encryption
- Add key rotation mechanism
- Consider proxy server for API calls

**Code Location**: All services load keys from localStorage

#### 2. **Error Handling Inconsistency** 🟡 MEDIUM
**Issue**: Error handling varies across services

**Examples**:
- Some services throw errors
- Some return error objects
- UI error handling not centralized

**Recommendation**:
- Standardize error response format
- Add retry logic for transient failures
- Implement circuit breaker pattern
- Add error telemetry

#### 3. **Cost Tracking Gaps** 🟡 MEDIUM
**Issue**: No comprehensive cost tracking across all AI operations

**Missing**:
- Screenshot analysis cost (multiple calls during session)
- Search operation costs (Ned conversations)
- Monthly/weekly spending reports

**Recommendation**:
- Add cost tracking to all AI service calls
- Create cost dashboard
- Set budget alerts
- Implement usage quotas

**Code Location**: Only basic tracking in `nedSettings.tokenUsage`

#### 4. **Service Redundancy** 🟡 MEDIUM
**Issue**: Multiple agents with overlapping capabilities

**Examples**:
- ContextAgent + SessionsQueryAgent (similar code)
- ClaudeService.queryAssistant + NedService (both conversational)

**Recommendation**:
- Consider unified search agent with mode parameter
- Evaluate if queryAssistant is still needed (Ned replaces it)
- Extract common search logic into base class

**Code Location**:
- `/src/services/contextAgent.ts` (293 LOC)
- `/src/services/sessionsQueryAgent.ts` (428 LOC)

#### 5. **Missing Rate Limiting** 🟡 MEDIUM
**Issue**: No rate limiting or throttling for AI calls

**Risk**:
- Screenshot interval allows unlimited API calls
- User could spam Ned conversations
- Could hit API rate limits unexpectedly

**Recommendation**:
- Add rate limiter service
- Implement request queuing
- Add cooldown periods for expensive operations
- Show rate limit warnings to user

#### 6. **Testing Coverage** 🟢 LOW PRIORITY
**Issue**: No visible AI service tests

**Recommendation**:
- Add unit tests with mocked AI responses
- Integration tests for data flows
- Cost simulation tests
- Error scenario tests

#### 7. **Documentation Gaps** 🟢 LOW PRIORITY
**Issue**: Limited inline documentation for complex AI prompts

**Recommendation**:
- Document prompt engineering decisions
- Add examples of expected outputs
- Explain confidence thresholds
- Document chunking strategies

#### 8. **Performance Optimization Opportunities** 🟢 LOW PRIORITY
**Observations**:
- Context window maintenance (last 5 screenshots) is efficient
- Audio downsampling (8kHz) reduces costs effectively
- Learning system uses in-memory computation (fast)

**Potential Improvements**:
- Cache Claude responses for identical inputs
- Implement request deduplication
- Add progressive loading for large sessions

#### 9. **Scalability Considerations** 🟢 LOW PRIORITY
**Current State**: Single-user app, local storage

**If Scaling**:
- API keys need server-side management
- Sessions/notes need database storage
- AI operations need job queue (e.g., Redis)
- Cost tracking needs analytics backend

### Priority Action Items

**Immediate** (Next Sprint):
1. Implement secure API key storage (Tauri secure storage)
2. Add comprehensive error handling
3. Implement basic cost tracking dashboard

**Short-Term** (Next Month):
1. Add rate limiting for AI operations
2. Consolidate search agent logic
3. Add retry logic and circuit breakers

**Long-Term** (Future):
1. Implement AI response caching
2. Add comprehensive testing
3. Evaluate advanced prompt optimization

---

## ASCII Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TASKERINO AI ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                            USER INTERFACE LAYER                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ CaptureZone  │  │SessionsZone  │  │   NedChat    │  │ Learning  │  │
│  │              │  │              │  │              │  │Dashboard  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         │                 │                 │                │        │
└─────────┼─────────────────┼─────────────────┼────────────────┼────────┘
          │                 │                 │                │
          │                 │                 │                │
┌─────────▼─────────────────▼─────────────────▼────────────────▼────────┐
│                        SERVICE ORCHESTRATION                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────┐                                              │
│  │ BackgroundProcessor │                                              │
│  │  - Queue Manager    │                                              │
│  │  - Progress Track   │                                              │
│  └──────────┬──────────┘                                              │
│             │                                                          │
└─────────────┼──────────────────────────────────────────────────────────┘
              │
              │
┌─────────────▼──────────────────────────────────────────────────────────┐
│                          AI SERVICE LAYER                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    PRIMARY AI SERVICES                       │     │
│  ├─────────────────────────────────────────────────────────────┤     │
│  │                                                             │     │
│  │  ┌──────────────────┐        ┌──────────────────┐          │     │
│  │  │ ClaudeService    │        │ OpenAIService    │          │     │
│  │  │ Sonnet 4.5       │        │ Whisper-1        │          │     │
│  │  │                  │        │ GPT-4o-audio     │          │     │
│  │  │ • Note Process   │        │                  │          │     │
│  │  │ • Topic Detect   │        │ • Real-time      │          │     │
│  │  │ • Task Extract   │        │   Transcription  │          │     │
│  │  │ • Vision OCR     │        │ • Comprehensive  │          │     │
│  │  │                  │        │   Audio Analysis │          │     │
│  │  └────────┬─────────┘        └────────┬─────────┘          │     │
│  │           │                           │                    │     │
│  └───────────┼───────────────────────────┼────────────────────┘     │
│              │                           │                          │
│  ┌───────────▼───────────────────────────▼────────────────────┐     │
│  │              SESSIONS & ASSISTANT SERVICES               │     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │                                                          │     │
│  │  ┌─────────────────────┐    ┌───────────────────────┐   │     │
│  │  │SessionsAgentService │    │    NedService         │   │     │
│  │  │   Sonnet 4.5        │    │    Sonnet 4           │   │     │
│  │  │                     │    │                       │   │     │
│  │  │ • Screenshot        │    │ • Conversational AI   │   │     │
│  │  │   Analysis          │    │ • Tool Calling        │   │     │
│  │  │ • Activity Detect   │    │ • 17 Tools            │   │     │
│  │  │ • Progress Track    │    │ • Streaming           │   │     │
│  │  │ • Summary Gen       │    │                       │   │     │
│  │  └──────────┬──────────┘    └───────────┬───────────┘   │     │
│  │             │                           │               │     │
│  │             │                           │               │     │
│  │             │         ┌─────────────────▼──────┐        │     │
│  │             │         │  NedToolExecutor       │        │     │
│  │             │         │  • Route tools         │        │     │
│  │             │         │  • Permission check    │        │     │
│  │             │         │  • State updates       │        │     │
│  │             │         └─────────┬──────────────┘        │     │
│  │             │                   │                       │     │
│  └─────────────┼───────────────────┼───────────────────────┘     │
│                │                   │                             │
│  ┌─────────────▼───────────────────▼───────────────────────┐     │
│  │            SPECIALIZED AI AGENTS                       │     │
│  ├────────────────────────────────────────────────────────┤     │
│  │                                                        │     │
│  │  ┌──────────────────┐    ┌────────────────────────┐   │     │
│  │  │ ContextAgent     │    │ SessionsQueryAgent     │   │     │
│  │  │   Haiku 3.5      │    │   Haiku 3.5            │   │     │
│  │  │                  │    │                        │   │     │
│  │  │ • Search Notes   │    │ • Search Sessions      │   │     │
│  │  │ • Search Tasks   │    │ • Semantic Search      │   │     │
│  │  │ • Smart Ranking  │    │ • Activity-Aware       │   │     │
│  │  └──────────────────┘    └────────────────────────┘   │     │
│  │                                                        │     │
│  │  ┌──────────────────┐    ┌────────────────────────┐   │     │
│  │  │AudioReviewService│    │    NedMemory           │   │     │
│  │  │  GPT-4o-audio    │    │    (Logic, no AI)      │   │     │
│  │  │                  │    │                        │   │     │
│  │  │ • One-Time       │    │ • Preference Storage   │   │     │
│  │  │   Review         │    │ • Context Recall       │   │     │
│  │  │ • Chunking       │    │ • Relevance Scoring    │   │     │
│  │  │ • Concatenation  │    │                        │   │     │
│  │  └──────────────────┘    └────────────────────────┘   │     │
│  │                                                        │     │
│  │  ┌──────────────────────────────────────────────────┐ │     │
│  │  │       LearningService (Logic, no AI)            │ │     │
│  │  │                                                  │ │     │
│  │  │ • Pattern Recognition                           │ │     │
│  │  │ • Strength Calculation                          │ │     │
│  │  │ • Feedback Processing                           │ │     │
│  │  └──────────────────────────────────────────────────┘ │     │
│  │                                                        │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     AI PROVIDER LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐         ┌──────────────────────┐     │
│  │  Anthropic Claude    │         │    OpenAI API        │     │
│  ├──────────────────────┤         ├──────────────────────┤     │
│  │                      │         │                      │     │
│  │ • Sonnet 4.5         │         │ • Whisper-1          │     │
│  │   (Vision)           │         │   (Transcription)    │     │
│  │ • Sonnet 4           │         │                      │     │
│  │   (Tool Use)         │         │ • GPT-4o-audio       │     │
│  │ • Haiku 3.5          │         │   (Comprehensive)    │     │
│  │   (Fast Search)      │         │                      │     │
│  │                      │         │                      │     │
│  └──────────────────────┘         └──────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     STORAGE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │  localStorage  │  │ Tauri File     │  │ App State        │  │
│  │                │  │ System         │  │ (React)          │  │
│  │ • API Keys     │  │                │  │                  │  │
│  │ • Settings     │  │ • Screenshots  │  │ • Notes/Tasks    │  │
│  │ • Memories     │  │ • Audio Files  │  │ • Sessions       │  │
│  │ • Learnings    │  │ • Attachments  │  │ • UI State       │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

KEY:
────  Data Flow
═══   AI Processing
┌─┐   Component/Service
```

---

## Model Usage Summary

| Model | Provider | Use Cases | Cost | Frequency |
|-------|----------|-----------|------|-----------|
| **Claude Sonnet 4.5** | Anthropic | Note processing, screenshot analysis, vision | ~$0.10-0.15/call | High (every capture, every screenshot) |
| **Claude Sonnet 4** | Anthropic | Ned conversational AI, tool-using | ~$0.15-0.30/conversation | Medium (user-initiated) |
| **Claude Haiku 3.5** | Anthropic | Search (notes/tasks/sessions) | ~$0.01-0.02/search | Medium (Ned searches) |
| **Whisper-1** | OpenAI | Real-time audio transcription | $0.006/min | High (if audio enabled) |
| **GPT-4o-audio** | OpenAI | Comprehensive audio analysis | $0.026/min | Low (once per session) |

**Total Models**: 5

---

## File Reference Index

### Core AI Services
- `/Users/jamesmcarthur/Documents/taskerino/src/services/claudeService.ts` (898 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/openAIService.ts` (448 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/sessionsAgentService.ts` (717 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/nedService.ts` (468 LOC)

### Specialized Agents
- `/Users/jamesmcarthur/Documents/taskerino/src/services/contextAgent.ts` (293 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/sessionsQueryAgent.ts` (428 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/audioReviewService.ts` (439 LOC)

### Support Services
- `/Users/jamesmcarthur/Documents/taskerino/src/services/nedToolExecutor.ts` (1002 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/nedTools.ts` (434 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/nedMemory.ts` (238 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/learningService.ts` (583 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/backgroundProcessor.ts` (236 LOC)

### Audio Processing (Supporting)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/audioRecordingService.ts` (209 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/audioConcatenationService.ts` (468 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/audioCompressionService.ts` (262 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/audioStorageService.ts` (350 LOC)
- `/Users/jamesmcarthur/Documents/taskerino/src/services/audioExportService.ts` (371 LOC)

### UI Integration (Selected)
- `/Users/jamesmcarthur/Documents/taskerino/src/components/CaptureZone.tsx`
- `/Users/jamesmcarthur/Documents/taskerino/src/components/SessionsZone.tsx`
- `/Users/jamesmcarthur/Documents/taskerino/src/components/ned/NedChat.tsx`
- `/Users/jamesmcarthur/Documents/taskerino/src/components/LearningDashboard.tsx`
- `/Users/jamesmcarthur/Documents/taskerino/src/components/ProfileZone.tsx`

### Type Definitions
- `/Users/jamesmcarthur/Documents/taskerino/src/types.ts`

---

## Conclusion

Taskerino has a **sophisticated and well-architected AI system** with 9 distinct services powered by 5 AI models. The architecture demonstrates:

✅ **Strong Points**:
- Clear separation of concerns
- Cost-conscious design (chunking, one-time reviews, lightweight models)
- User-centric features (learning, permissions, memory)
- Comprehensive capabilities (vision, audio, conversation, search)

⚠️ **Areas for Improvement**:
- API key security (move to Tauri secure storage)
- Error handling standardization
- Cost tracking and monitoring
- Rate limiting implementation
- Service consolidation opportunities

The system is **production-ready** for single-user use but requires **security hardening** (especially API key management) before broader deployment. The total AI service codebase (~9,000 lines) is manageable and well-structured.

**Next Steps**: Prioritize security improvements (API key storage) and implement comprehensive cost tracking for better user visibility.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-13
**Total Analysis Time**: Comprehensive codebase review
**Services Analyzed**: 9 AI services + 5 audio support services
**Total LOC**: ~8,946 lines (AI services only)
