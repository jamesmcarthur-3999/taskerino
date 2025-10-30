# Taskerino AI Agents Comprehensive Review

**Date:** 2025-10-13
**Scope:** All AI services in the Taskerino codebase
**Total Agents Analyzed:** 7 services

---

## Executive Summary

### Agents Analyzed
1. **SessionsAgentService** - Background AI analyzing screenshots during sessions
2. **AudioReviewService** - One-time comprehensive audio review (GPT-4o)
3. **NedService** - Main AI assistant with tool calling (Claude Sonnet 4)
4. **ContextAgent** - Search/filter agent for notes and tasks (Claude Haiku)
5. **SessionsQueryAgent** - Search agent for sessions (Claude Haiku)
6. **ClaudeService** - Input processing and note extraction (Claude Sonnet 4.5)
7. **OpenAIService** - Audio transcription and analysis (Whisper + GPT-4o-audio)

### Key Findings

**Redundancy Score:** 🟡 Medium (2/5)
- ContextAgent and SessionsQueryAgent have nearly identical architectures with different data sources
- Both use threading, JSON response format, quality-over-quantity filtering
- Could benefit from a unified base agent class

**Prompt Quality Score:** 🟢 Good (4/5)
- ClaudeService has exceptionally detailed prompts (900+ lines)
- SessionsAgentService prompts are well-structured with clear examples
- OpenAIService GPT-4o prompt is comprehensive and well-formatted
- NedService system prompt is TOO SIMPLE for its responsibilities
- ContextAgent and SessionsQueryAgent have strong prompts but could be more consistent

**Critical Issues Identified:** 3 High Priority, 5 Medium Priority, 4 Low Priority

### Top 3 Priorities

1. **HIGH - NedService System Prompt Under-Developed**
   - Main user-facing AI has minimal guidance (14 lines vs 900+ in ClaudeService)
   - Missing tool usage examples, error handling guidelines, persona details
   - Could lead to inconsistent behavior and poor UX

2. **HIGH - Query Agent Architectural Duplication**
   - ContextAgent and SessionsQueryAgent are 95% identical in structure
   - Same threading mechanism, same response format, same quality controls
   - Maintenance burden and inconsistency risk

3. **MEDIUM - Whisper Speaker Identification Missing**
   - Audio transcription doesn't clarify that Whisper cannot identify speakers
   - Could mislead users about multi-speaker scenarios
   - Needs explicit constraint documentation in prompts and UI

---

## Section 1: Redundancy Analysis

### 🔴 HIGH REDUNDANCY: ContextAgent vs SessionsQueryAgent

**Overlap Percentage:** ~85%

**Identical Components:**
1. **Architecture**
   - Thread-based conversation storage (`Map<string, AgentThread>`)
   - Same `createThread()` implementation
   - Same `clearThread()` and `getThreadMessageCount()` methods
   - Both use Claude Haiku with identical API patterns

2. **System Prompts**
   - Both enforce JSON response format with same structure
   - Both use "Quality Over Quantity" philosophy (identical wording)
   - Both use identical ranking priority lists
   - Both have identical result limit guidelines (3-10 for focused, 10-15 for broad, max 20)

3. **Data Context Building**
   - Both build context strings with current date/time
   - Both provide full data sets to AI (all notes/tasks vs all sessions)
   - Similar formatting and structure

4. **Response Parsing**
   - Identical JSON extraction pattern: `match(/```json\n([\s\S]*?)\n```/)`
   - Same fallback behavior on parse failure
   - Same error handling

**Code Evidence:**

**ContextAgent (contextAgent.ts:140-181):**
```typescript
**CRITICAL: Quality Over Quantity**

Your goal is to return the MOST RELEVANT results, not the most results:

✅ GOOD:
- User asks "tasks about NVIDIA" → Return 3-5 most relevant/recent NVIDIA tasks
- User asks "notes from last week" → Return most important notes from last week
- Focus on relevance, recency, and importance (high priority tasks, detailed notes)

❌ BAD:
- Returning 50+ loosely related items
- Including tangentially related content
- Overwhelming the user with quantity

**Ranking Priority:**
1. Exact keyword matches in title/content
2. Recent items (this week > last week > older)
3. High priority tasks, important notes
4. Items with rich metadata (descriptions, tags, relationships)
5. Items linked to active topics/companies

**Result Limits:**
- For focused queries: Return 3-10 most relevant items
- For broad queries: Return 10-15 most representative items
- Never return more than 20 items unless explicitly asked
```

**SessionsQueryAgent (sessionsQueryAgent.ts:169-196):**
```typescript
**CRITICAL: Quality Over Quantity**

Your goal is to return the MOST RELEVANT sessions, not all matching sessions:

✅ GOOD:
- User asks "sessions where I worked on authentication" → Return 3-5 most relevant sessions with auth-related activities
- User asks "long sessions from last week" → Return sessions >1 hour from last week
- Focus on relevance, recency, and quality

❌ BAD:
- Returning 50+ loosely related sessions
- Including tangentially related content
- Overwhelming with quantity

**Ranking Priority:**
1. Exact matches in session name/description
2. Activity matches from screenshot analyses OR audio transcriptions (what user actually did/said)
3. Recent sessions (today > this week > last week > older)
4. Longer sessions with more screenshots/audio segments (more substance)
5. Sessions with extracted tasks/notes (productive sessions)
6. Audio-only sessions are EQUALLY important as screenshot-based sessions
7. Active/paused sessions over completed ones (when not specified)

**Result Limits:**
- For focused queries: Return 3-8 most relevant sessions
- For broad queries: Return 8-15 most representative sessions
- Never return more than 20 sessions unless explicitly asked
```

**Difference:** Only the data domain (notes/tasks vs sessions) and minor ranking criteria variations.

### Recommendation: Consolidate or Abstract

**Option A: Create Base Agent Class**
```typescript
abstract class BaseSearchAgent {
  protected client: Anthropic | null = null;
  protected threads: Map<string, AgentThread> = new Map();

  abstract buildSystemPrompt(): string;
  abstract buildDataContext(...args: any[]): string;
  abstract parseResponse(responseText: string, ...args: any[]): any;

  // Shared threading logic
  createThread(): string { /* ... */ }
  clearThread(threadId: string) { /* ... */ }

  // Shared search logic
  async search(query: string, threadId?: string): Promise<any> {
    // Common implementation
  }
}

class ContextAgent extends BaseSearchAgent { /* ... */ }
class SessionsQueryAgent extends BaseSearchAgent { /* ... */ }
```

**Option B: Merge into Single Agent**
```typescript
class UnifiedSearchAgent {
  async search(
    query: string,
    searchType: 'notes_tasks' | 'sessions',
    data: NotesTasksData | SessionsData,
    threadId?: string
  ): Promise<SearchResult>
}
```

**Priority:** HIGH - Reduces maintenance burden and ensures consistency

---

### 🟡 MEDIUM REDUNDANCY: Screenshot Analysis vs Audio Analysis

**Overlap:** Both SessionsAgentService and AudioReviewService perform session summarization

**SessionsAgentService.generateSessionSummary()** (lines 189-351):
- Analyzes screenshots + audio segments
- Creates timeline of activities
- Extracts tasks and notes
- Generates time breakdown

**AudioReviewService.reviewSession()** (lines 57-177):
- Focuses on audio-only comprehensive review
- Uses GPT-4o-audio-preview for deep analysis
- Extracts emotional journey, key moments, work patterns

**Key Differences:**
- SessionsAgentService: Multi-modal (screenshots + audio), Claude-based
- AudioReviewService: Audio-only, GPT-4o-based, one-time comprehensive

**Recommendation:** Keep separate - different use cases
- SessionsAgent: Real-time, incremental, screenshot-focused
- AudioReview: Post-session, deep-dive, audio-focused

**Priority:** LOW - Acceptable separation of concerns

---

### 🟢 LOW REDUNDANCY: ClaudeService vs NedService

Both use Claude, but serve very different purposes:
- **ClaudeService:** Input processing, topic detection, note extraction (batch processing)
- **NedService:** Conversational AI with tool calling (interactive)

No consolidation needed.

---

## Section 2: Prompt Quality Review

### Agent 1: ClaudeService
**File:** `src/services/claudeService.ts`
**Model:** Claude Sonnet 4.5
**Sophistication Level:** ⭐⭐⭐⭐⭐ (5/5)

#### Strengths
1. **Exceptional Detail:** 900+ line prompt with comprehensive instructions
2. **Clear Structure:** Divided into critical rules, analysis instructions, examples
3. **Validation Checklist:** Explicit verification steps before returning JSON
4. **Rich Examples:** Multiple task extraction examples with expected output
5. **Temporal Intelligence:** Detailed date inference with current date/time context
6. **Error Prevention:** "Common Mistakes to Avoid" section with ❌✅ comparisons
7. **Learning System Integration:** Incorporates user-specific learnings dynamically
8. **Image Analysis Support:** Detailed instructions for handling image attachments

#### Weaknesses
1. **Too Prescriptive:** May be over-constraining the model
2. **Repetitive:** Some instructions repeated multiple times (e.g., sourceExcerpt requirements)
3. **Maintenance Burden:** Such a large prompt is harder to update and test

#### Current Prompt Quality (lines 131-407):
```typescript
const prompt = `${settings.systemInstructions}
${learningsSection}

**CRITICAL RULES:**
1. TOPIC HIERARCHY: Always associate content in this order:
   - PRIMARY: Customer/Company (most important)
   - SECONDARY: People mentioned in the conversation
   - TERTIARY: Features, products, or technologies discussed

2. NOTE CONSOLIDATION:
   - For call transcripts or long inputs: Create ONE comprehensive note for the primary customer
   - For quick notes: Create one focused note
   - NEVER create multiple notes from a single input unless it discusses completely separate customers

3. UPDATE vs CREATE:
   - If recent notes exist for the same customer/topic, consider updating rather than creating new
   - Look for notes from the same day or recent conversation threads

**Existing Topics:** ${topicList}
**Recent Notes (for context):** ${recentNotes || 'No recent notes'}
**Existing Tasks (do NOT create duplicates):** ${recentTasks}

**⚠️ IMPORTANT - Duplicate Detection & Reporting:**
Before creating any task, check if it already exists in the list above.
[... 200+ more lines of detailed instructions ...]

**⚠️ VALIDATION CHECKLIST - REVIEW BEFORE RETURNING JSON ⚠️**
For EVERY task in your response, verify:
✓ description is NOT null, NOT empty, has actual content (1-2 sentences minimum)
✓ sourceExcerpt is NOT null, NOT empty, contains exact quote from user input
✓ If dueDate exists → dueTime MUST exist (18:00 for EOD, 09:00 for morning, etc.)
[...]
```

#### Specific Improvements Needed
None - this is the gold standard. Could potentially be slightly more concise.

---

### Agent 2: SessionsAgentService
**File:** `src/services/sessionsAgentService.ts`
**Model:** Claude Sonnet 4.5
**Sophistication Level:** ⭐⭐⭐⭐ (4/5)

#### Strengths
1. **Well-Structured:** Clear sections for screenshot analysis and session summary
2. **Context-Aware:** Provides recent activity context with sliding window
3. **Audio Integration:** Explicitly mentions Whisper limitations (no speaker ID)
4. **JSON Examples:** Shows expected output format with examples
5. **Progress Tracking:** Focuses on achievements, blockers, context changes

#### Weaknesses
1. **Missing Output Validation:** No checklist like ClaudeService
2. **No Error Handling Guidance:** Doesn't tell AI what to do if image is unclear
3. **Limited Examples:** Could use more diverse examples (different activity types)
4. **Confidence Score Ambiguity:** confidence field mentioned but not well-defined

#### Screenshot Analysis Prompt (lines 483-536):
```typescript
return `You are analyzing a screenshot from a work session titled "${session.name}".

${sessionContext}

**Your Task:**
Analyze this screenshot and extract details that will help synthesize a comprehensive session summary. Focus on:

1. **Current Activity**: What is the user doing right now?
2. **Progress Indicators**: Signs of completion, achievements, or milestones
3. **Blockers & Issues**: Problems, errors, or obstacles encountered
4. **Context & Transitions**: How this relates to previous activity, any shifts in focus
5. **Actionable Items**: Tasks, follow-ups, or TODOs that should be extracted
6. **Key Insights**: Important discoveries, learnings, or observations

**Analysis Guidelines for Session Synthesis:**
- **Identify achievements**: Completed work, fixed issues, successful implementations
- **Spot blockers**: Errors, waiting states, missing information, stuck points
- **Track context changes**: When user switches tasks, tools, or focus areas
- **Extract valuable text**: Names, URLs, error messages, important data
- **Suggest actionable tasks**: Clear, specific actions that should be tracked
- **Note insights**: Important learnings or observations worth capturing

Return ONLY valid JSON (no markdown):
{
  "summary": "Brief 1-2 sentence summary focusing on what's accomplished or attempted",
  "detectedActivity": "Specific activity (e.g., 'Debugging authentication flow', 'Writing customer email')",
  "extractedText": "Important text like error messages, URLs, names, data points",
  "keyElements": [...],
  "suggestedActions": [...],
  "contextDelta": "What changed or progressed",
  "confidence": 0.9,
  "progressIndicators": {
    "achievements": [...],
    "blockers": [...],
    "insights": [...]
  }
}
```

#### Session Summary Prompt (lines 257-318):
**EXCELLENT:** Handles audio + screenshots, mentions Whisper limitations, provides clear task structure.

**Critical Feature - Whisper Context:**
```typescript
**Important Context:**
- Audio transcripts come from Whisper, which does NOT identify different speakers - all speech appears in one continuous stream
- Audio may not always match on-screen activity (e.g., discussing future plans while working on current tasks, or participating in calls about unrelated projects)
- Background noise and irrelevant conversations may appear in transcripts - use your judgment to filter these out
```

#### Specific Improvements Needed
1. Add output validation checklist (like ClaudeService)
2. Define confidence score scale (0.0-1.0 mapping to image clarity)
3. Add examples for different activity types (coding, email, research, design)
4. Add error handling: "If screenshot is unclear or corrupted, set confidence to 0.3 and note issue"

---

### Agent 3: NedService
**File:** `src/services/nedService.ts`
**Model:** Claude Sonnet 4
**Sophistication Level:** ⭐⭐ (2/5)

#### Strengths
1. **Context Window Awareness:** Explains large context reduces need for repeated searches
2. **Formatting Tips:** Mentions auto-collapse for lists, code blocks for copyable text
3. **Concise Goal:** "Keep responses under 3 sentences when possible"

#### Weaknesses
1. **TOO SIMPLE:** Only 14 lines of actual instructions (lines 408-436)
2. **No Tool Usage Examples:** Doesn't show how/when to use tools effectively
3. **No Personality:** Generic "helpful AI assistant" with no character
4. **No Error Handling:** Doesn't guide AI on handling failed tool calls
5. **No Multi-Turn Guidance:** Doesn't explain conversation flow management
6. **Missing UX Guidelines:** No guidance on formatting, tone, or user engagement

#### Current System Prompt (lines 402-437):
```typescript
return `You are Ned, a helpful AI assistant for Taskerino.

**Context:** Today is ${currentDate}, time is ${currentTime}. User: ${userName}.

**Your Role:**
Help users find and manage their tasks, notes, and work sessions. Be concise but friendly.

**IMPORTANT - Large Context Window:**
When you use search tools (query_context_agent, query_sessions), you receive FULL data with all details. This means:

✅ After searching once, you have all the data for follow-up questions
- User: "Show me NVIDIA tasks" → You get full task details
- User: "Which are high priority?" → Just filter what you already have, don't search again

❌ Don't search again for:
- Filtering ("just the high priority ones")
- Sorting ("which is most urgent?")
- Details ("tell me about that task")

Only search when you need NEW information about a different topic.

**Formatting Tips:**
- Keep responses under 3 sentences when possible
- Use code blocks (\`\`\`) for copyable text (emails, Slack messages, etc.)
- Lists with 3+ items will auto-collapse with "Show more"

${appState.aiSettings.systemInstructions || ''}

Use your tools wisely - you have a large context window, so use it!`;
```

#### Critical Issues
1. **No Tool Examples:** Compare to ClaudeService's 900-line prompt with examples
2. **No Persona Development:** "Helpful AI assistant" is generic
3. **No Error Recovery:** What if tool fails? What if user is confused?
4. **No Proactive Behavior:** Should it suggest related items? Offer help?

#### Specific Improvements Needed

**PROPOSED NEW SYSTEM PROMPT:**

```typescript
return `You are Ned, Taskerino's AI assistant. You help users organize their work, find information, and get things done.

**Current Context:**
- Date: ${currentDate} ${currentTime}
- User: ${userName}
- Available data: ${appState.notes.length} notes, ${appState.tasks.length} tasks, ${appState.sessions.length} sessions

**Your Personality:**
- **Proactive:** Offer helpful suggestions and connections
- **Efficient:** Be concise (2-3 sentences ideal), but thorough when needed
- **Context-Aware:** Remember what you've already searched and shown
- **Friendly:** Professional but approachable, use user's name occasionally

**TOOL USAGE STRATEGY:**

1. **Search Tools (query_context_agent, query_sessions)**
   - Use when: User asks about new topic or needs fresh data
   - You get FULL data back (all fields, relationships, content)
   - After one search, you have everything needed for follow-ups

   **Example Flow:**
   User: "Show me NVIDIA tasks"
   → Use query_context_agent("NVIDIA tasks")
   → You now have: all NVIDIA tasks with titles, priorities, due dates, descriptions, tags

   User: "Which are high priority?"
   → DON'T search again! Filter the data you already have
   → Response: "You have 3 high priority NVIDIA tasks: [list them]"

   ❌ DON'T search again for: filtering, sorting, details about items you already have
   ✅ DO search again for: new topics, different time periods, unrelated queries

2. **Write Tools (create_task, update_task, etc.)**
   - These require user permission - explain what you're about to do
   - Be specific: "I'll create a high priority task 'Follow up with NVIDIA' due Friday"
   - If permission denied, ask how they'd like to proceed

3. **Session Tools (query_sessions, get_session_details)**
   - Sessions contain screenshots + audio + AI analysis
   - Use get_screenshot_image ONLY when absolutely necessary (expensive!)
   - Trust existing AI analysis in session data first

**FORMATTING GUIDELINES:**

- **Concise Responses:** Default to 2-3 sentences. Expand only when user needs detail.
- **Structured Lists:** Use markdown lists for 3+ items (they auto-collapse)
- **Code Blocks:** Use \`\`\` for copyable text (emails, code, commands, Slack messages)
- **Bold Key Info:** Use **bold** for important names, dates, priorities
- **Action Items:** End responses with a question or suggestion when appropriate

**ERROR HANDLING:**

- If search returns no results: "I couldn't find any [items]. Would you like to search for [related suggestion]?"
- If tool fails: "I encountered an issue with [tool]. Let me try [alternative approach]."
- If user query is ambiguous: "Just to clarify - are you asking about [option A] or [option B]?"

**PROACTIVE ASSISTANCE:**

- Suggest related items: "I also noticed 2 other NVIDIA tasks from last month. Want to see those?"
- Offer follow-up actions: "Would you like me to update the priority or reschedule?"
- Connect information: "This task relates to your session from Tuesday where you worked on authentication."

**CONVERSATION MEMORY:**

- Remember what you've shown in THIS conversation
- Track tool calls and their results
- Don't ask for the same information twice
- Build context across messages

**USER PREFERENCES:**

${appState.aiSettings.systemInstructions || '(No custom instructions set)'}

**YOUR GOAL:** Make the user more productive by finding information quickly, suggesting useful actions, and reducing friction. Be the assistant they want to talk to.`;
```

**Impact:** This would transform Ned from a basic search interface to an intelligent, proactive assistant.

**Priority:** 🔴 HIGH

---

### Agent 4: ContextAgent
**File:** `src/services/contextAgent.ts`
**Model:** Claude Haiku
**Sophistication Level:** ⭐⭐⭐⭐ (4/5)

#### Strengths
1. **Quality-Over-Quantity Focus:** Explicitly prioritizes relevance
2. **Clear JSON Format:** Well-defined response structure
3. **Result Limits:** Specific guidance (3-10, 10-15, max 20)
4. **Date Intelligence:** Smart about temporal queries
5. **Ambiguity Handling:** Asks clarifying questions when needed

#### Weaknesses
1. **No Examples:** Missing examples of good vs bad searches
2. **No Edge Cases:** Doesn't handle empty data sets, corrupted data
3. **Limited Metadata Guidance:** Doesn't fully leverage sentiment, source, relationships

#### System Prompt (lines 119-182):
```typescript
return `You are a Context Agent for Taskerino. Your job is to search and filter notes and tasks based on user queries.

You have access to:
- Notes: Can contain text, tags, dates, linked to companies/contacts/topics
- Tasks: Have titles, priorities, due dates, statuses, tags
- Companies, Contacts, Topics: Organizational entities

Your responses must be in this JSON format:
\`\`\`json
{
  "note_ids": ["note_123", "note_456"],
  "task_ids": ["task_789"],
  "summary": "Found 2 notes about NVIDIA Q4 earnings and 1 related task",
  "suggestions": ["Want to see notes from Q3 as well?"]
}
\`\`\`

Search Strategy:
1. **Keyword matching**: Search in content, titles, tags
2. **Date filtering**: Use metadata for date ranges
3. **Entity linking**: Filter by companies, contacts, topics
4. **Metadata use**: Priority, status, source, sentiment
5. **Relationship awareness**: Tasks link to notes via context field

**CRITICAL: Quality Over Quantity**
[...excellent quality guidelines...]

Remember: Better to return 5 perfect matches than 50 mediocre ones.`;
```

#### Specific Improvements Needed
1. Add search examples:
   ```typescript
   **EXAMPLES:**

   Query: "urgent tasks for NVIDIA"
   Good Response: Return 2-3 urgent/high priority tasks specifically mentioning NVIDIA
   Bad Response: Return 30 tasks that vaguely relate to NVIDIA or technology

   Query: "notes from last week about pricing"
   Good Response: Return 3-5 notes from last 7 days with "pricing" or "cost" in content
   Bad Response: Return every note from last week
   ```

2. Add edge case handling:
   ```typescript
   **EDGE CASES:**
   - Empty results: Suggest related searches or broader terms
   - Too many matches (>20): Ask user to narrow down (time range, priority, etc.)
   - Ambiguous query: Request clarification before searching
   ```

**Priority:** MEDIUM

---

### Agent 5: SessionsQueryAgent
**File:** `src/services/sessionsQueryAgent.ts`
**Model:** Claude Haiku
**Sophistication Level:** ⭐⭐⭐⭐ (4/5)

#### Strengths
1. **Audio-First Awareness:** Explicitly values audio-only sessions
2. **Activity Understanding:** Maps user intent to activities (coding → IDE, meetings → audio)
3. **Quality-Over-Quantity:** Same strong filtering as ContextAgent
4. **Temporal Intelligence:** Good date/time understanding

#### Weaknesses
1. **Duplicate Content:** 85% identical to ContextAgent
2. **No Audio-Specific Examples:** Doesn't show how to search audio transcriptions
3. **No Duration Queries:** Doesn't explicitly handle "long sessions" or "short sessions"

#### System Prompt (lines 140-223):
```typescript
return `You are a Sessions Query Agent for Taskerino. Your job is to search and filter work sessions based on user queries.

You have access to:
- Sessions: Work tracking sessions with metadata, screenshots, audio recordings, and AI analysis
- Screenshot Analyses: AI-generated summaries of what the user was doing (visual activities)
- Audio Transcriptions: Speech-to-text of what the user said during sessions, with key phrases and metadata
- Extracted Tasks/Notes: Items created from session activity
- Temporal Data: Start/end times, durations, relative dates

[...same quality guidelines as ContextAgent...]

**Activity Understanding:**
Understand what activities mean:
- "coding" / "programming" → Look for IDE, terminal, code editors in screenshot analyses
- "email" → Email client activity
- "research" → Browser, reading, documentation
- "meetings" → Video call apps, calendar, OR audio transcriptions of conversations
- "design" → Design tools, mockups, prototyping
- "discussion" / "conversation" → Audio transcriptions are the PRIMARY source
- "brainstorming" → Look for audio transcriptions with key phrases and ideas

Remember: Better to return 5 perfect matches than 50 mediocre ones.`;
```

#### Specific Improvements Needed
1. Add audio-specific search examples
2. Add duration handling: "long sessions (>1 hour)", "quick sessions (<15 min)"
3. Consolidate with ContextAgent using base class

**Priority:** MEDIUM (part of larger consolidation)

---

### Agent 6: AudioReviewService
**File:** `src/services/audioReviewService.ts`
**Model:** GPT-4o-audio-preview
**Sophistication Level:** N/A (orchestration service)

This service doesn't define prompts - it delegates to OpenAIService.

---

### Agent 7: OpenAIService
**File:** `src/services/openaiService.ts`
**Model:** Whisper-1 (transcription) + GPT-4o-audio-preview (analysis)
**Sophistication Level:** ⭐⭐⭐⭐ (4/5)

#### Strengths
1. **Comprehensive Audio Analysis:** Well-structured JSON output with rich fields
2. **Clear Guidelines:** Explains emotional journey, key moments, flow states
3. **Timestamp Precision:** All timestamps in seconds from session start
4. **Environmental Context:** Captures ambient noise, work setting, time of day

#### Weaknesses
1. **No Speaker Identification Note:** Doesn't mention Whisper's limitation
2. **No Audio Quality Handling:** What if audio is corrupted, too quiet, or garbled?
3. **Limited Examples:** Could show example keyMoments and emotionalJourney entries
4. **No Fallback Behavior:** What if transcription is empty?

#### GPT-4o Analysis Prompt (lines 151-214):
```typescript
const prompt = `You are analyzing a work session recording to help the user understand their productivity patterns and work experience.

**Session Context:**
- Name: "${context.sessionName}"
- Description: "${context.sessionDescription}"
- Duration: ${durationMinutes}m ${durationSeconds}s
- Screenshots captured: ${context.screenshotCount}
- Audio clips: ${context.segmentCount}

**Your Task:**
Provide a comprehensive analysis of this session's audio. Output your response as valid JSON with the following structure:

{
  "transcription": "Complete, clean transcription of all speech in the audio. If speech is unclear or inaudible, note it. If there's no speech, write 'No clear speech detected.'",
  "insights": {
    "narrative": "A 2-3 sentence story describing what happened during this session from an audio perspective. What was the user working on? How did it progress?",
    "emotionalJourney": [...],
    "keyMoments": [...],
    "workPatterns": {...},
    "environmentalContext": {...}
  }
}

**Guidelines:**
1. **emotionalJourney**: Track significant emotional/tone shifts (e.g., focused → frustrated → relieved). Include timestamps in seconds from session start.
2. **keyMoments types**:
   - "achievement": Completed something, solved a problem, breakthrough
   - "blocker": Hit an obstacle, error, confusion
   - "decision": Changed approach, made a choice
   - "insight": Learned something, had a realization
3. **focusLevel**: "high" (deep focus), "medium" (working but distracted), "low" (frequent interruptions)
4. **interruptions**: Count of significant breaks in concentration
5. **flowStates**: Periods of uninterrupted deep work with start/end timestamps
6. **Timestamps**: All timestamps should be in SECONDS from the session start

Respond ONLY with valid JSON. Do not include any markdown formatting or explanation outside the JSON.`;
```

#### Specific Improvements Needed
1. **Add Whisper Limitation Note:**
   ```typescript
   **IMPORTANT - Audio Limitations:**
   - This audio was transcribed with Whisper, which does NOT distinguish between different speakers
   - All speech appears in one continuous stream - use context and content to infer speakers
   - Background noise and overlapping speech may affect transcription quality
   - If transcription seems disjointed or nonsensical, note this in the narrative
   ```

2. **Add Audio Quality Handling:**
   ```typescript
   **Audio Quality Issues:**
   - If audio is very quiet, garbled, or corrupted: Set transcription to "Audio quality too low for reliable transcription" and note in environmentalContext.ambientNoise
   - If mostly silence: Note "Mostly silent session" in narrative and describe any environmental sounds
   - If background noise dominates: Focus on environmental description rather than forcing transcription
   ```

3. **Add Examples:**
   ```typescript
   **Example emotionalJourney Entry:**
   {
     "timestamp": 120,
     "emotion": "frustrated",
     "description": "User's tone shifted from focused to frustrated after encountering an error. Multiple sighs and 'This doesn't make sense' comments."
   }

   **Example keyMoments Entry:**
   {
     "timestamp": 450,
     "type": "achievement",
     "description": "Successfully resolved authentication bug",
     "context": "After 10 minutes of debugging, user exclaimed 'Got it!' and tests passed",
     "excerpt": "Finally figured it out! The token wasn't being passed correctly in the header."
   }
   ```

**Priority:** MEDIUM

---

## Section 3: Specific Recommendations

### HIGH PRIORITY

#### 1. Enhance NedService System Prompt
**Issue:** Main user-facing AI has minimal guidance (14 lines)
**Impact:** Inconsistent behavior, poor UX, missed opportunities for proactive assistance
**Current State:** Lines 402-437 in nedService.ts
**Proposed Solution:** Expand to 150-200 line prompt with:
- Tool usage examples and workflows
- Error handling guidelines
- Personality and tone guidance
- Proactive assistance strategies
- Conversation memory management

**Expected Improvement:**
- More consistent, helpful responses
- Better tool usage (fewer redundant searches)
- Improved error recovery
- More engaging user experience

**Implementation:**
See detailed proposed prompt in Section 2, Agent 3 above.

---

#### 2. Consolidate Query Agents
**Issue:** ContextAgent and SessionsQueryAgent are 85% identical
**Impact:** Maintenance burden, inconsistency risk, code duplication
**Current State:**
- contextAgent.ts: 294 lines
- sessionsQueryAgent.ts: 429 lines
- Shared logic: ~250 lines

**Proposed Solution:**

**Option A: Base Class (Recommended)**
```typescript
// File: src/services/baseSearchAgent.ts

import Anthropic from '@anthropic-ai/sdk';

export interface SearchConfig {
  modelId: string;
  maxTokens: number;
  systemPromptTemplate: () => string;
}

export abstract class BaseSearchAgent<TData, TResult> {
  protected client: Anthropic | null = null;
  protected threads: Map<string, AgentThread> = new Map();
  protected config: SearchConfig;

  constructor(config: SearchConfig, apiKey?: string) {
    this.config = config;
    if (apiKey) {
      this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    } else {
      this.loadApiKeyFromStorage();
    }
  }

  private loadApiKeyFromStorage() {
    try {
      const savedKey = localStorage.getItem('claude-api-key');
      if (savedKey && savedKey.trim()) {
        this.client = new Anthropic({
          apiKey: savedKey.trim(),
          dangerouslyAllowBrowser: true
        });
      }
    } catch (error) {
      console.error('Failed to load API key from storage:', error);
    }
  }

  setApiKey(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  createThread(): string {
    const threadId = `${this.getAgentName()}_thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.threads.set(threadId, {
      id: threadId,
      messages: [],
      createdAt: new Date().toISOString(),
    });
    return threadId;
  }

  clearThread(threadId: string) {
    this.threads.delete(threadId);
  }

  getThreadMessageCount(threadId: string): number {
    return this.threads.get(threadId)?.messages.length || 0;
  }

  async search(query: string, data: TData, threadId?: string): Promise<TResult> {
    if (!this.client) {
      throw new Error(`${this.getAgentName()}: API key not set`);
    }

    const actualThreadId = threadId || this.createThread();
    const thread = this.threads.get(actualThreadId);

    if (!thread) {
      throw new Error('Thread not found');
    }

    const systemPrompt = this.buildSystemPrompt();
    const dataContext = this.buildDataContext(data);

    thread.messages.push({
      role: 'user',
      content: `${thread.messages.length === 0 ? dataContext + '\n\n' : ''}${query}`,
    });

    try {
      const response = await this.client.messages.create({
        model: this.config.modelId,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: thread.messages,
      });

      const content = response.content[0];
      const responseText = content.type === 'text' ? content.text : '';

      thread.messages.push({
        role: 'assistant',
        content: responseText,
      });

      const result = this.parseResponse(responseText, data);

      return {
        ...result,
        thread_id: actualThreadId,
      };
    } catch (error) {
      console.error(`${this.getAgentName()} error:`, error);
      throw error;
    }
  }

  // Abstract methods to be implemented by subclasses
  protected abstract getAgentName(): string;
  protected abstract buildSystemPrompt(): string;
  protected abstract buildDataContext(data: TData): string;
  protected abstract parseResponse(responseText: string, data: TData): Omit<TResult, 'thread_id'>;
}
```

**Then update ContextAgent:**
```typescript
// File: src/services/contextAgent.ts

import { BaseSearchAgent } from './baseSearchAgent';
import type { Note, Task, Company, Contact, Topic } from '../types';
import type { ContextAgentResult } from './nedTools';

interface ContextData {
  notes: Note[];
  tasks: Task[];
  companies: Company[];
  contacts: Contact[];
  topics: Topic[];
}

export class ContextAgentService extends BaseSearchAgent<ContextData, ContextAgentResult> {
  constructor(apiKey?: string) {
    super({
      modelId: 'claude-3-5-haiku-20241022',
      maxTokens: 4096,
      systemPromptTemplate: () => this.buildSystemPrompt(),
    }, apiKey);
  }

  protected getAgentName(): string {
    return 'Context Agent';
  }

  protected buildSystemPrompt(): string {
    // Existing system prompt logic
    return `You are a Context Agent for Taskerino...`;
  }

  protected buildDataContext(data: ContextData): string {
    // Existing data context logic
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    // ...
  }

  protected parseResponse(
    responseText: string,
    data: ContextData
  ): Omit<ContextAgentResult, 'thread_id'> {
    // Existing parse logic
    try {
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
      // ...
    }
  }

  // Public API remains the same
  async search(
    query: string,
    notes: Note[],
    tasks: Task[],
    companies: Company[],
    contacts: Contact[],
    topics: Topic[],
    threadId?: string
  ): Promise<ContextAgentResult> {
    return super.search(query, { notes, tasks, companies, contacts, topics }, threadId);
  }
}
```

**Same pattern for SessionsQueryAgent.**

**Benefits:**
- Eliminates ~200 lines of duplicate code
- Ensures consistency in threading, parsing, error handling
- Makes it easy to add new search agents
- Centralizes API key management

**Priority:** HIGH

---

#### 3. Add Whisper Speaker Identification Constraints
**Issue:** Users may not know Whisper can't identify speakers
**Impact:** Confusion in multi-speaker scenarios, misattributed speech
**Current State:**
- SessionsAgentService mentions it (line 272-274)
- OpenAIService does NOT mention it
- No UI warning or documentation

**Proposed Solution:**

**1. Update OpenAIService prompt (lines 151-214):**
```typescript
const prompt = `You are analyzing a work session recording to help the user understand their productivity patterns and work experience.

**Session Context:**
- Name: "${context.sessionName}"
- Description: "${context.sessionDescription}"
- Duration: ${durationMinutes}m ${durationSeconds}s
- Screenshots captured: ${context.screenshotCount}
- Audio clips: ${context.segmentCount}

**CRITICAL - Audio Transcription Constraints:**
- This audio was transcribed using OpenAI Whisper, which does NOT distinguish between different speakers
- All speech appears in one continuous transcription stream
- If multiple people are speaking, you must infer speakers from context, tone, and content
- Speaker changes are NOT marked - use your judgment to identify when different people talk
- Overlapping speech or crosstalk may result in garbled transcription

**Your Task:**
Provide a comprehensive analysis of this session's audio...
```

**2. Add UI warning in session recording interface:**
```typescript
// In recording UI component:
<Alert variant="info">
  Audio transcription uses Whisper AI, which transcribes all speech but does not identify different speakers.
  In multi-person conversations, all speech will appear as one continuous stream.
</Alert>
```

**3. Add to documentation/help:**
```markdown
## Audio Recording Limitations

### Speaker Identification
Taskerino uses OpenAI Whisper for audio transcription, which provides accurate speech-to-text but **does not identify individual speakers**. In recordings with multiple people:
- All speech appears in one continuous transcript
- Use AI analysis to infer speakers from context and content
- Consider noting speaker names in session descriptions for clarity
```

**Expected Improvement:**
- Users understand the limitation upfront
- Less confusion about multi-speaker scenarios
- Better expectation management

**Priority:** HIGH

---

### MEDIUM PRIORITY

#### 4. Add Validation Checklist to SessionsAgentService
**Issue:** Screenshot analysis prompt lacks output validation
**Impact:** Occasional missing fields or malformed responses
**Current State:** Lines 483-536 (no validation checklist)

**Proposed Solution:**
Add to end of screenshot analysis prompt:
```typescript
**⚠️ VALIDATION CHECKLIST - REVIEW BEFORE RETURNING JSON ⚠️**
✓ summary is NOT empty (1-2 sentences minimum)
✓ detectedActivity is specific (not "Working" or "Using computer")
✓ keyElements has 2-5 concrete items (not generic descriptions)
✓ confidence is 0.0-1.0 (0.8+ for clear images, 0.3-0.7 for unclear, <0.3 for corrupted)
✓ progressIndicators has at least one of: achievements, blockers, or insights
✓ contextDelta describes what changed since last screenshot

**COMMON MISTAKES TO AVOID:**
❌ Generic detectedActivity: "Working on computer" → WRONG
✅ Specific detectedActivity: "Debugging authentication flow in VS Code" → CORRECT
❌ Empty keyElements array → WRONG
✅ 3-4 specific keyElements: ["VS Code showing auth.ts", "Terminal with npm run dev", "Browser with login page"] → CORRECT
❌ confidence: 1.0 for blurry image → WRONG
✅ confidence: 0.4 for blurry image with note in summary → CORRECT
```

**Priority:** MEDIUM

---

#### 5. Add Search Examples to ContextAgent and SessionsQueryAgent
**Issue:** Agents lack concrete examples of good vs bad searches
**Impact:** Occasionally returns too many or too few results

**Proposed Solution:**
Add to both system prompts:
```typescript
**SEARCH EXAMPLES:**

Example 1: Focused Query
User asks: "urgent tasks for NVIDIA"
✅ GOOD: Return 2-3 tasks with priority=urgent OR priority=high that mention "NVIDIA" in title/description
❌ BAD: Return 30 tasks that vaguely relate to NVIDIA or have any priority level

Example 2: Temporal Query
User asks: "notes from last week about pricing"
✅ GOOD: Return 3-5 notes from last 7 days containing "pricing", "cost", "price", or "$" symbols
❌ BAD: Return every note from last week regardless of content

Example 3: Ambiguous Query
User asks: "tasks for John"
✅ GOOD: Ask "Which John? I found John Doe (Acme Corp) and John Smith (TechCo). Or did you mean tasks FROM John?"
❌ BAD: Return all tasks related to anyone named John without clarification

Example 4: Empty Results
User asks: "tasks about blockchain"
✅ GOOD: "I couldn't find any tasks about blockchain. Would you like to see tasks tagged with 'technology' or 'innovation'?"
❌ BAD: Return empty result with no suggestions
```

**Priority:** MEDIUM

---

#### 6. Add Audio Quality Handling to OpenAIService
**Issue:** No guidance on handling poor audio quality
**Impact:** Confusing results when audio is corrupted, too quiet, or garbled

**Proposed Solution:**
Add to GPT-4o prompt (after line 200):
```typescript
**Audio Quality Guidelines:**

1. **High Quality Audio** (clear speech, low background noise):
   - Provide detailed transcription
   - Track emotional nuances
   - Identify specific moments with exact excerpts

2. **Medium Quality Audio** (some noise, occasional unclear words):
   - Transcribe what's clear, note unclear sections: "[inaudible 0:45-0:52]"
   - Focus on overall narrative and tone
   - Note audio quality in environmentalContext.ambientNoise

3. **Low Quality Audio** (very noisy, garbled, or mostly inaudible):
   - Set transcription to: "Audio quality too low for reliable transcription. [Describe what you can hear: e.g., 'Muffled speech with heavy keyboard sounds']"
   - Still analyze environmental sounds and work intensity
   - Set workPatterns.focusLevel based on environmental cues
   - Note in narrative: "Audio quality limited analysis - relying on environmental sounds"

4. **Silent or Mostly Silent Audio**:
   - Set transcription to: "No clear speech detected in this session."
   - Describe environmental sounds: keyboard typing, mouse clicks, music, etc.
   - Note in narrative: "Silent working session - user appeared focused on task without verbal communication"

**Fallback Strategy:**
If you cannot extract meaningful insights due to audio issues, return minimal structure:
{
  "transcription": "Audio quality insufficient for transcription",
  "insights": {
    "narrative": "Unable to analyze due to audio quality issues.",
    "emotionalJourney": [],
    "keyMoments": [],
    "workPatterns": { "focusLevel": "unknown", "interruptions": 0, "flowStates": [] },
    "environmentalContext": {
      "ambientNoise": "Audio corrupted or extremely noisy - unable to assess",
      "workSetting": "Unknown",
      "timeOfDay": "Unknown"
    }
  }
}
```

**Priority:** MEDIUM

---

#### 7. Improve ClaudeService Conciseness
**Issue:** 900-line prompt may be over-constraining and hard to maintain
**Impact:** Slower to update, may limit model creativity

**Proposed Solution:**
Consolidate repetitive sections:
- Merge duplicate instructions (sourceExcerpt mentioned 4 times)
- Move examples to separate reference document
- Use more concise formatting

**Example Consolidation:**
```typescript
**TASK REQUIREMENTS (ALL FIELDS MANDATORY):**
Every task must include:
1. title - Clear, actionable (e.g., "Send proposal to Acme Corp")
2. description - 1-2 sentence context (NEVER empty)
3. sourceExcerpt - Exact quote from user input (NEVER empty)
4. dueDate + dueTime - Both required if deadline exists (see temporal context below)
5. dueDateReasoning - Explain date choice
6. tags - 2-4 relevant tags
7. priority - high/medium/low based on urgency
8. suggestedSubtasks - If multi-step, break into 2-5 subtasks

**VALIDATION:** Before returning JSON, verify:
- NO empty/null descriptions or sourceExcerpts
- dueDate always paired with dueTime
- Specific, actionable titles
```

Target: Reduce from 900 lines to 600 lines while maintaining quality.

**Priority:** LOW (works well currently)

---

### LOW PRIORITY

#### 8. Add Confidence Score Definition to SessionsAgentService
**Issue:** confidence field not well-defined
**Impact:** Inconsistent confidence values

**Proposed Solution:**
```typescript
**Confidence Score Scale:**
- 0.9-1.0: Crystal clear screenshot, all elements easily identifiable
- 0.7-0.9: Clear screenshot, most elements visible, minor blur/obstruction
- 0.5-0.7: Readable but some elements unclear, partial obstruction, or low resolution
- 0.3-0.5: Significant issues (heavy blur, poor lighting, mostly obscured), but some activity detectable
- 0.0-0.3: Corrupted, completely black, or impossible to interpret
```

**Priority:** LOW

---

#### 9. Add Tool Usage Telemetry to NedService
**Issue:** No visibility into which tools are used most/least
**Impact:** Can't optimize tool design or pricing

**Proposed Solution:**
```typescript
// Add to NedService
private toolUsageStats: Map<string, number> = new Map();

// In tool execution:
this.toolUsageStats.set(toolName, (this.toolUsageStats.get(toolName) || 0) + 1);

// Export method:
getToolUsageStats(): Record<string, number> {
  return Object.fromEntries(this.toolUsageStats);
}
```

**Priority:** LOW (nice-to-have)

---

#### 10. Add Conversation Export for NedService
**Issue:** Users can't save or review past Ned conversations
**Impact:** Lost context, can't reference past insights

**Proposed Solution:**
```typescript
exportConversation(conversationId: string): {
  id: string;
  messages: NedMessage[];
  exportedAt: string;
} {
  const conv = this.conversations.get(conversationId);
  if (!conv) throw new Error('Conversation not found');

  return {
    id: conv.id,
    messages: conv.messages,
    exportedAt: new Date().toISOString(),
  };
}
```

**Priority:** LOW (feature request)

---

## Section 4: Quick Wins

Changes that can be made immediately with high impact:

### 1. Add Whisper Limitation Warning (15 minutes)
**File:** `src/services/openaiService.ts` line 151
**Action:** Add 5 lines to prompt explaining Whisper doesn't identify speakers
**Impact:** Immediate clarity for users, prevents confusion

```typescript
**CRITICAL - Audio Transcription Constraints:**
- This audio was transcribed using OpenAI Whisper, which does NOT distinguish between different speakers
- All speech appears in one continuous transcription stream
- If multiple people are speaking, infer speakers from context and content
- Speaker changes are NOT marked - use judgment to identify different speakers
```

---

### 2. Add NedService Tool Examples (30 minutes)
**File:** `src/services/nedService.ts` lines 408-437
**Action:** Expand system prompt with 3 tool usage examples
**Impact:** Better tool usage, fewer redundant searches

```typescript
**TOOL USAGE EXAMPLES:**

Example 1: Efficient Search
User: "Show me NVIDIA tasks"
→ query_context_agent("NVIDIA tasks")
→ [Get full task list with all details]

User: "Which are high priority?"
→ DON'T search again! Filter existing results
→ "You have 3 high priority NVIDIA tasks: [list]"

Example 2: Write Tool Permission
User: "Create a task to follow up with Sarah"
→ "I'll create a task: 'Follow up with Sarah' (high priority, due Friday). Is that correct?"
→ [Wait for permission]
→ create_task(...)

Example 3: Session Query
User: "When did I last work on authentication?"
→ query_sessions("work on authentication")
→ "Your most recent authentication work was Tuesday in a 2-hour session where you debugged login flow."
```

---

### 3. Add Validation Checklist to SessionsAgent (20 minutes)
**File:** `src/services/sessionsAgentService.ts` line 536
**Action:** Add 10-line validation checklist before JSON return
**Impact:** Fewer malformed responses, better data quality

```typescript
**⚠️ VALIDATION CHECKLIST:**
✓ summary is NOT empty (1-2 sentences)
✓ detectedActivity is specific
✓ keyElements has 2-5 items
✓ confidence is 0.0-1.0
✓ progressIndicators has content
```

---

### 4. Add Search Examples to ContextAgent (20 minutes)
**File:** `src/services/contextAgent.ts` line 182
**Action:** Add 4 search examples (good vs bad)
**Impact:** More consistent search quality

See Section 3, Recommendation #5 for examples.

---

## Summary Statistics

### Agents by Model
- **Claude Sonnet 4.5:** SessionsAgentService, ClaudeService (2)
- **Claude Sonnet 4:** NedService (1)
- **Claude Haiku:** ContextAgent, SessionsQueryAgent (2)
- **GPT-4o-audio-preview:** OpenAIService (1)
- **Whisper-1:** OpenAIService (1)

### Prompt Sophistication Distribution
- ⭐⭐⭐⭐⭐ (5/5): ClaudeService
- ⭐⭐⭐⭐ (4/5): SessionsAgentService, ContextAgent, SessionsQueryAgent, OpenAIService
- ⭐⭐ (2/5): NedService
- N/A: AudioReviewService (orchestration only)

### Total Lines of Prompts
- ClaudeService: ~900 lines
- SessionsAgentService: ~200 lines
- OpenAIService: ~100 lines
- ContextAgent: ~80 lines
- SessionsQueryAgent: ~90 lines
- NedService: ~14 lines (!!!)
- **Total:** ~1,384 lines

### Recommendations by Priority
- **HIGH:** 3 items (Ned enhancement, agent consolidation, Whisper constraints)
- **MEDIUM:** 4 items (validation, examples, audio quality, conciseness)
- **LOW:** 3 items (confidence definition, telemetry, export)
- **Quick Wins:** 4 items (can be done in <2 hours total)

---

## Conclusion

The Taskerino AI agent architecture is **generally well-designed** with high-quality prompts in most services. The major issues are:

1. **NedService is under-developed** for being the main user-facing agent
2. **Query agents have significant duplication** that should be consolidated
3. **Some edge cases and constraints** (Whisper limitations, audio quality) need explicit documentation

The **ClaudeService prompt is exceptional** and should be used as a template for other agents. Quick wins can deliver immediate improvements in under 2 hours of work.

**Recommended Action Plan:**
1. Week 1: Implement quick wins (4 items, <2 hours)
2. Week 2: Enhance NedService system prompt (HIGH priority)
3. Week 3: Consolidate query agents with base class (HIGH priority)
4. Week 4: Add Whisper constraints and audio quality handling (HIGH/MEDIUM priority)
5. Month 2: Address remaining medium and low priority items

This will result in a more consistent, maintainable, and user-friendly AI experience across Taskerino.
