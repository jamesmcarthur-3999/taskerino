# AI Data Contracts - TypeScript Reference

**Last Updated**: November 2025

This document defines all TypeScript interfaces and types for AI agent integration with Live Session Intelligence.

---

## Table of Contents

1. [Event Types](#event-types)
2. [Context Types](#context-types)
3. [Suggestion Types](#suggestion-types)
4. [Summary Types](#summary-types)
5. [Tool Types](#tool-types)
6. [Complete Type Index](#complete-type-index)

---

## Event Types

### LiveSessionEvent (Union Type)

```typescript
type LiveSessionEvent =
  | ScreenshotAnalyzedEvent
  | AudioProcessedEvent
  | ContextChangedEvent
  | SummaryRequestedEvent
  | UserQuestionAnsweredEvent
  | SummaryUpdatedEvent;
```

### ScreenshotAnalyzedEvent

```typescript
interface ScreenshotAnalyzedEvent {
  type: 'screenshot-analyzed';
  sessionId: string;
  screenshot: SessionScreenshot;
  timestamp: string; // ISO 8601
}

interface SessionScreenshot {
  id: string;
  sessionId: string;
  timestamp: string;
  attachmentId: string;
  aiAnalysis?: {
    summary: string;
    detectedActivity: string;
    curiosity: number; // 0-1
    progressIndicators?: {
      achievements?: string[];
      blockers?: string[];
      insights?: string[];
    };
  };
  analysisStatus: 'pending' | 'processing' | 'complete' | 'failed';
}
```

### AudioProcessedEvent

```typescript
interface AudioProcessedEvent {
  type: 'audio-processed';
  sessionId: string;
  audioSegment: SessionAudioSegment;
  timestamp: string;
}

interface SessionAudioSegment {
  id: string;
  sessionId: string;
  timestamp: string;
  duration: number; // seconds
  transcription: string;
  attachmentId: string;
}
```

### ContextChangedEvent

```typescript
interface ContextChangedEvent {
  type: 'context-changed';
  sessionId: string;
  changeType: 'activity-switch' | 'blocker-detected' | 'achievement-detected' | 'focus-change';
  previousContext?: any;
  newContext?: any;
  timestamp: string;
  metadata?: Record<string, any>;
}
```

### SummaryRequestedEvent

```typescript
interface SummaryRequestedEvent {
  type: 'summary-requested';
  sessionId: string;
  reason: 'user' | 'system';
  timestamp: string;
}
```

### UserQuestionAnsweredEvent

```typescript
interface UserQuestionAnsweredEvent {
  type: 'user-question-answered';
  sessionId: string;
  questionId: string;
  question: string;
  answer: string | null; // null = timeout
  timestamp: string;
}
```

### SummaryUpdatedEvent

```typescript
interface SummaryUpdatedEvent {
  type: 'summary-updated';
  sessionId: string;
  summary: SessionSummary;
  updatedBy: 'ai' | 'user';
  timestamp: string;
}
```

---

## Context Types

### SummaryContext (2-5 KB)

```typescript
interface SummaryContext {
  session: {
    id: string;
    name: string;
    status: 'active' | 'paused' | 'completed';
    startTime: string;
    duration: number; // seconds
  };
  currentSummary: SessionSummary;
  recentScreenshots: SessionScreenshot[]; // Last 10
  recentAudio: SessionAudioSegment[]; // Last 10
  progressIndicators: {
    achievements: string[];
    blockers: string[];
    insights: string[];
  };
}
```

### FullContext (50-200 KB)

```typescript
interface FullContext {
  session: Session; // Complete session object
  summary: SessionSummary;
  allScreenshots: SessionScreenshot[];
  allAudio: SessionAudioSegment[];
  relatedNotes: Note[];
  relatedTasks: Task[];
  topics: Topic[];
  companies: Company[];
  contacts: Contact[];
}
```

### DeltaContext (1-10 KB)

```typescript
interface DeltaContext {
  newScreenshots: SessionScreenshot[];
  newAudio: SessionAudioSegment[];
  since: string; // ISO 8601 timestamp
  changeCount: number;
}
```

---

## Suggestion Types

### TaskSuggestion

```typescript
interface TaskSuggestion {
  title: string; // REQUIRED
  description?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  context: string; // REQUIRED - Why suggest this
  confidence?: number; // 0-1
  relevance?: number; // 0-1
  tags?: string[];
  topicId?: string;
  noteId?: string;
  dueDate?: string; // ISO 8601 date
  dueTime?: string; // 24h format (e.g., "14:30")
}
```

**Example**:
```typescript
const taskSuggestion: TaskSuggestion = {
  title: "Fix authentication timeout",
  description: "User reported 30s timeout during login",
  priority: "high",
  context: "Detected blocker in screenshot at 14:32",
  confidence: 0.85,
  relevance: 0.90,
  tags: ["backend", "urgent"],
  topicId: "topic-auth-123"
};
```

### NoteSuggestion

```typescript
interface NoteSuggestion {
  content: string; // REQUIRED - Markdown supported
  context: string; // REQUIRED - Why suggest this
  confidence?: number; // 0-1
  relevance?: number; // 0-1
  tags?: string[];
  topicIds?: string[];
  companyIds?: string[];
  contactIds?: string[];
}
```

**Example**:
```typescript
const noteSuggestion: NoteSuggestion = {
  content: "## Meeting Notes\n\nDiscussed OAuth implementation strategy...",
  context: "Detected conversation about OAuth in audio",
  confidence: 0.80,
  relevance: 0.85,
  tags: ["meeting", "authentication"],
  topicIds: ["topic-auth-123"]
};
```

---

## Summary Types

### SessionSummary (Extended)

```typescript
interface SessionSummary {
  // Core fields (always present)
  narrative: string;
  achievements: string[];
  blockers: string[];
  lastUpdated: string;
  screenshotCount: number;

  // Live snapshot (active sessions only)
  liveSnapshot?: {
    currentFocus: string;
    progressToday: string[];
    momentum: 'high' | 'medium' | 'low';
  };

  // AI suggestions (optional)
  suggestedTasks?: TaskSuggestion[];
  suggestedNotes?: NoteSuggestion[];

  // Interactive prompt (optional)
  interactivePrompt?: {
    questionId: string;
    question: string;
    context?: string;
    suggestedAnswers?: string[]; // 2-4 quick replies
    timeoutSeconds: number; // 15-20 typical
    timestamp: string;
  };

  // Focus recommendation (optional)
  focusRecommendation?: {
    message: string;
    severity: 'info' | 'warning';
    suggestedFocusMode?: string;
  };

  // Active focus mode (optional)
  focusMode?: {
    type: 'preset' | 'custom';
    preset?: 'all' | 'coding' | 'debugging' | 'meetings' | 'documentation';
    activities?: string[];
    keywords?: string[];
    minCuriosity?: number;
  };

  // Dismissed suggestions (optional)
  dismissedSuggestions?: Array<{
    id: string;
    type: 'task' | 'note';
    timestamp: string;
    reason?: string;
  }>;

  // Enhanced fields (optional)
  achievementsEnhanced?: Array<{
    id: string;
    text: string;
    timestamp: string;
    importance?: 'minor' | 'moderate' | 'major' | 'critical';
    category?: string;
  }>;

  blockersEnhanced?: Array<{
    id: string;
    text: string;
    timestamp: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    status?: 'unresolved' | 'resolved' | 'workaround';
    resolvedAt?: string;
    resolution?: string;
  }>;
}
```

### LiveSnapshotUpdate

```typescript
interface LiveSnapshotUpdate {
  currentFocus?: string;
  progressToday?: string[];
  momentum?: 'high' | 'medium' | 'low';
}
```

### SummaryUpdate

```typescript
interface SummaryUpdate extends LiveSnapshotUpdate {
  achievements?: string[];
  blockers?: string[];
  suggestedTasks?: TaskSuggestion[];
  suggestedNotes?: NoteSuggestion[];
}
```

---

## Tool Types

### ToolSchema

```typescript
interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
```

### ToolCall

```typescript
interface ToolCall {
  id: string; // Unique ID for this call
  name: string; // Tool name
  input: Record<string, any>; // Tool parameters
}
```

### ToolResult

```typescript
interface ToolResult {
  tool_use_id: string; // Matches ToolCall.id
  content: string; // JSON-serialized result
  is_error?: boolean;
}
```

### UniversalSearchInput

```typescript
interface UniversalSearchInput {
  query?: string; // Full-text search
  entityTypes?: ('sessions' | 'notes' | 'tasks')[];
  relatedTo?: {
    entityType: 'topic' | 'company' | 'contact';
    entityId: string;
  };
  filters?: {
    status?: string;
    priority?: string;
    dateRange?: { start: string; end: string };
    tags?: string[];
  };
  sortBy?: 'relevance' | 'date' | 'priority';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}
```

### CreateTaskInput

```typescript
interface CreateTaskInput {
  title: string; // REQUIRED
  description?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  status?: 'todo' | 'in_progress' | 'done';
  dueDate?: string;
  dueTime?: string;
  tags?: string[];
  topicId?: string;
  noteId?: string;
  sourceSessionId?: string;
}
```

### CreateNoteInput

```typescript
interface CreateNoteInput {
  content: string; // REQUIRED - Markdown
  topicId?: string;
  tags?: string[];
  companyIds?: string[];
  contactIds?: string[];
  sourceSessionId?: string;
}
```

---

## Complete Type Index

### Core Types

```typescript
// Session
Session
SessionSummary
SessionScreenshot
SessionAudioSegment
SessionVideo

// Entities
Note
Task
Topic
Company
Contact

// Relationships
Relationship
```

### Live Session Types

```typescript
// Events
LiveSessionEvent
ScreenshotAnalyzedEvent
AudioProcessedEvent
ContextChangedEvent
SummaryRequestedEvent
UserQuestionAnsweredEvent
SummaryUpdatedEvent

// Context
SummaryContext
FullContext
DeltaContext
SmartContextResult

// Suggestions
TaskSuggestion
NoteSuggestion

// Updates
LiveSnapshotUpdate
SummaryUpdate

// Tools
ToolSchema
ToolCall
ToolResult
LiveSessionToolRegistry
```

---

## Validation Rules

### TaskSuggestion Validation

```typescript
function validateTaskSuggestion(suggestion: TaskSuggestion): string[] {
  const errors: string[] = [];

  if (!suggestion.title || suggestion.title.trim().length === 0) {
    errors.push('title is required');
  }

  if (!suggestion.context || suggestion.context.trim().length === 0) {
    errors.push('context is required');
  }

  if (suggestion.confidence !== undefined) {
    if (suggestion.confidence < 0 || suggestion.confidence > 1) {
      errors.push('confidence must be 0-1');
    }
  }

  if (suggestion.relevance !== undefined) {
    if (suggestion.relevance < 0 || suggestion.relevance > 1) {
      errors.push('relevance must be 0-1');
    }
  }

  if (suggestion.priority !== undefined) {
    const validPriorities = ['urgent', 'high', 'medium', 'low'];
    if (!validPriorities.includes(suggestion.priority)) {
      errors.push('priority must be urgent, high, medium, or low');
    }
  }

  return errors;
}
```

### NoteSuggestion Validation

```typescript
function validateNoteSuggestion(suggestion: NoteSuggestion): string[] {
  const errors: string[] = [];

  if (!suggestion.content || suggestion.content.trim().length === 0) {
    errors.push('content is required');
  }

  if (!suggestion.context || suggestion.context.trim().length === 0) {
    errors.push('context is required');
  }

  if (suggestion.confidence !== undefined) {
    if (suggestion.confidence < 0 || suggestion.confidence > 1) {
      errors.push('confidence must be 0-1');
    }
  }

  if (suggestion.relevance !== undefined) {
    if (suggestion.relevance < 0 || suggestion.relevance > 1) {
      errors.push('relevance must be 0-1');
    }
  }

  return errors;
}
```

---

## Example Payloads

### Complete Summary Update

```json
{
  "currentFocus": "Debugging authentication flow",
  "progressToday": [
    "Fixed login timeout",
    "Added OAuth support",
    "Deployed to staging"
  ],
  "momentum": "high",
  "suggestedTasks": [
    {
      "title": "Add unit tests for OAuth",
      "priority": "medium",
      "context": "Test coverage gap detected",
      "confidence": 0.75,
      "relevance": 0.80,
      "tags": ["testing", "auth"]
    }
  ],
  "suggestedNotes": [
    {
      "content": "## OAuth Implementation\n\nSuccessfully integrated...",
      "context": "Detected OAuth work in screenshots",
      "confidence": 0.85,
      "tags": ["authentication"]
    }
  ]
}
```

### Screenshot Analyzed Event

```json
{
  "type": "screenshot-analyzed",
  "sessionId": "session-123",
  "screenshot": {
    "id": "screenshot-456",
    "sessionId": "session-123",
    "timestamp": "2025-11-02T14:32:00Z",
    "attachmentId": "att-789",
    "aiAnalysis": {
      "summary": "VS Code with authentication code",
      "detectedActivity": "coding",
      "curiosity": 0.85,
      "progressIndicators": {
        "achievements": ["Fixed timeout bug"],
        "blockers": [],
        "insights": ["User prefers OAuth over basic auth"]
      }
    },
    "analysisStatus": "complete"
  },
  "timestamp": "2025-11-02T14:32:05Z"
}
```

---

## Import Paths

```typescript
// Event types
import type {
  LiveSessionEvent,
  ScreenshotAnalyzedEvent,
  AudioProcessedEvent
} from '@/services/liveSession/events';

// Suggestion types
import type {
  TaskSuggestion,
  NoteSuggestion
} from '@/services/liveSession/toolExecutor';

// Context types
import type {
  SummaryContext,
  FullContext,
  DeltaContext
} from '@/services/liveSession/contextBuilder';

// Update types
import type {
  SummaryUpdate,
  LiveSnapshotUpdate
} from '@/services/liveSession/updateApi';

// Core types
import type {
  Session,
  SessionSummary,
  SessionScreenshot,
  SessionAudioSegment
} from '@/types';
```

---

## Type Guards

```typescript
// Check if event is screenshot-analyzed
function isScreenshotAnalyzed(event: LiveSessionEvent): event is ScreenshotAnalyzedEvent {
  return event.type === 'screenshot-analyzed';
}

// Check if suggestion is valid
function isValidTaskSuggestion(suggestion: any): suggestion is TaskSuggestion {
  return (
    typeof suggestion === 'object' &&
    typeof suggestion.title === 'string' &&
    typeof suggestion.context === 'string'
  );
}

// Usage
if (isScreenshotAnalyzed(event)) {
  console.log('Screenshot:', event.screenshot.id);
}
```

---

## Next Steps

- **Implementation**: See [AI_AGENT_INTEGRATION_GUIDE.md](./AI_AGENT_INTEGRATION_GUIDE.md)
- **Events**: See [AI_EVENT_REFERENCE.md](./AI_EVENT_REFERENCE.md)
- **Examples**: See [AI_TOOL_COOKBOOK.md](./AI_TOOL_COOKBOOK.md)
