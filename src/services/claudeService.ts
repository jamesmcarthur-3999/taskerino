import { invoke } from '@tauri-apps/api/core';
import type {
  AIProcessResult,
  AIQueryResponse,
  Topic,
  Note,
  Task,
  AppState,
  Attachment,
} from '../types';
import type {
  CaptureResult,
  ConversationContext,
  RefinementRequest,
  RefinementResponse,
  RefinementError,
} from '../types/captureProcessing';
import type {
  ClaudeChatResponse,
  ClaudeMessage,
  ClaudeContentBlock,
  ClaudeImageSource,
} from '../types/tauri-ai-commands';
import {
  findMatchingTopic,
  calculateMatchConfidence,
  findSimilarNotes,
} from '../utils/helpers';
import { LearningService } from './learningService';
import { fileStorage } from './fileStorageService';
import { getUnifiedIndexManager } from './storage/UnifiedIndexManager';
import { debug } from "../utils/debug";

export class ClaudeService {
  private hasApiKey: boolean = false;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    } else {
      // Auto-load API key from storage if available
      this.loadApiKeyFromStorage();
    }
  }

  private async loadApiKeyFromStorage() {
    try {
      const savedKey = await invoke<string | null>('get_claude_api_key');
      if (savedKey) {
        this.hasApiKey = true;
        debug.log(debug.log(console.log('✅ Loaded API key from storage')));
      }
    } catch (error) {
      console.error('Failed to load API key from storage:', error);
    }
  }

  async setApiKey(apiKey: string) {
    try {
      await invoke('set_claude_api_key', { apiKey });
      this.hasApiKey = true;
    } catch (error) {
      console.error('Failed to set API key:', error);
      throw error;
    }
  }

  /**
   * Execute a tool call during capture processing
   * This is a simplified version for the 4 search tools used in capture
   */
  private async executeToolForCapture(
    toolCall: any,
    existingNotes: Note[],
    existingTasks: Task[]
  ): Promise<any> {
    const { name, input } = toolCall;
    const startTime = performance.now();

    switch (name) {
      case 'search_notes': {
        const { query, topicId, tags, dateRange, limit = 20 } = input;

        try {
          const unifiedIndex = await getUnifiedIndexManager();

          const result = await unifiedIndex.search({
            entityTypes: ['notes'],
            query: query,
            relatedTo: topicId ? {
              entityType: 'topic',
              entityId: topicId
            } : undefined,
            filters: {
              tags: tags || undefined,
            },
            timeRange: dateRange ? {
              start: dateRange.start, // Already ISO string from tool input
              end: dateRange.end
            } : undefined,
            limit: limit
          });

          const searchTimeMs = performance.now() - startTime;

          // Map results to note format expected by AI
          const notes = result.results.notes.map((r: any) => {
            // Find full note object from existingNotes
            const fullNote = existingNotes.find((n: any) => n.id === r.id);
            return {
              id: r.id,
              summary: fullNote?.summary || r.snippet,
              content: fullNote?.content?.substring(0, 200),
              tags: fullNote?.tags,
              createdAt: fullNote?.timestamp || r.metadata?.createdAt,
              status: fullNote?.status || r.metadata?.status, // Include status so AI can see drafts
              relevanceScore: r.score
            };
          });

          return {
            notes,
            total: result.counts.notes,
            searchTimeMs: Math.round(searchTimeMs)
          };
        } catch (error) {
          console.error('[ClaudeService] UnifiedIndexManager search_notes error:', error);
          // Fallback to empty results
          return { notes: [], total: 0, error: 'Search failed' };
        }
      }

      case 'search_tasks': {
        const { query, status, priority, dateRange, limit = 20 } = input;

        try {
          const unifiedIndex = await getUnifiedIndexManager();

          const result = await unifiedIndex.search({
            entityTypes: ['tasks'],
            query: query,
            filters: {
              status: status ? (Array.isArray(status) ? status : [status]) : undefined,
              priority: priority ? (Array.isArray(priority) ? priority : [priority]) : undefined,
            },
            timeRange: dateRange ? {
              start: dateRange.start, // Already ISO string from tool input
              end: dateRange.end
            } : undefined,
            sortBy: 'date',
            sortOrder: 'desc',
            limit: limit
          });

          const searchTimeMs = performance.now() - startTime;

          // Map results to task format expected by AI
          const tasks = result.results.tasks.map((r: any) => {
            const fullTask = existingTasks.find((t: any) => t.id === r.id);
            return {
              id: r.id,
              title: fullTask?.title || r.metadata?.title,
              description: fullTask?.description || r.metadata?.description,
              status: fullTask?.status || r.metadata?.status,
              priority: fullTask?.priority || r.metadata?.priority,
              dueDate: fullTask?.dueDate || r.metadata?.dueDate,
              relevanceScore: r.score
            };
          });

          return {
            tasks,
            total: result.counts.tasks,
            searchTimeMs: Math.round(searchTimeMs)
          };
        } catch (error) {
          console.error('[ClaudeService] UnifiedIndexManager search_tasks error:', error);
          return { tasks: [], total: 0, error: 'Search failed' };
        }
      }

      case 'find_similar_notes': {
        const { summary, content, topicId, minSimilarity = 0.7 } = input;

        try {
          const unifiedIndex = await getUnifiedIndexManager();

          // Combine summary and content for search query
          const searchQuery = [summary, content].filter(Boolean).join(' ');

          const result = await unifiedIndex.search({
            entityTypes: ['notes'],
            query: searchQuery,
            relatedTo: topicId ? {
              entityType: 'topic',
              entityId: topicId
            } : undefined,
            limit: 10
          });

          const searchTimeMs = performance.now() - startTime;

          // Filter by minimum similarity (UnifiedIndexManager score)
          const matches = result.results.notes
            .filter((r: any) => r.score >= minSimilarity)
            .map((r: any) => {
              const fullNote = existingNotes.find((n: any) => n.id === r.id);
              return {
                note: {
                  id: r.id,
                  summary: fullNote?.summary || r.metadata?.summary,
                  content: fullNote?.content?.substring(0, 200) || r.snippet,
                  tags: fullNote?.tags || r.metadata?.tags,
                  status: fullNote?.status || r.metadata?.status, // Include status to prioritize drafts
                },
                similarity: r.score
              };
            });

          return {
            matches,
            total: matches.length,
            searchTimeMs: Math.round(searchTimeMs)
          };
        } catch (error) {
          console.error('[ClaudeService] UnifiedIndexManager find_similar_notes error:', error);
          return { matches: [], total: 0, error: 'Search failed' };
        }
      }

      case 'find_similar_tasks': {
        const { title, description, contextNoteId, minSimilarity = 0.8 } = input;

        try {
          const unifiedIndex = await getUnifiedIndexManager();

          // Combine title and description for search
          const searchQuery = [title, description].filter(Boolean).join(' ');

          const result = await unifiedIndex.search({
            entityTypes: ['tasks'],
            query: searchQuery,
            relatedTo: contextNoteId ? {
              entityType: 'notes', // Plural form for entityType
              entityId: contextNoteId
            } : undefined,
            limit: 10
          });

          const searchTimeMs = performance.now() - startTime;

          // Filter by minimum similarity
          const matches = result.results.tasks
            .filter((r: any) => r.score >= minSimilarity)
            .map((r: any) => {
              const fullTask = existingTasks.find((t: any) => t.id === r.id);
              return {
                task: {
                  id: r.id,
                  title: fullTask?.title || r.metadata?.title,
                  description: fullTask?.description || r.metadata?.description,
                  status: fullTask?.status || r.metadata?.status,
                  priority: fullTask?.priority || r.metadata?.priority
                },
                similarity: r.score
              };
            });

          return {
            matches,
            total: matches.length,
            searchTimeMs: Math.round(searchTimeMs)
          };
        } catch (error) {
          console.error('[ClaudeService] UnifiedIndexManager find_similar_tasks error:', error);
          return { matches: [], total: 0, error: 'Search failed' };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  /**
   * Calculate simple word-overlap similarity between two texts
   * Returns a value between 0 and 1
   */
  /**
   * Main processing function: Analyzes text, detects topics, creates/merges notes, extracts tasks
   */
  async processInput(
    text: string,
    existingTopics: Topic[],
    existingNotes: Note[],
    settings: AppState['aiSettings'],
    userLearnings?: AppState['learnings'],
    learningSettings?: AppState['learningSettings'],
    existingTasks?: Task[],
    attachments?: Attachment[],
    extractTasks: boolean = true
  ): Promise<AIProcessResult> {
    if (!this.hasApiKey) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    const processingSteps: string[] = [];

    // Step 1: Analyze text with AI
    processingSteps.push('Analyzing text...');

    const topicList = existingTopics.map(t => t.name).join(', ') || 'None yet';

    // Helper to get topic ID from note relationships
    const getTopicId = (entity: Note | Task): string | undefined => {
      const topicRel = entity.relationships.find(r =>
        r.type === 'note-topic' || r.type === 'task-topic'
      );
      return topicRel?.targetId;
    };

    // Get recent notes for context (last 50 notes for better duplicate detection)
    const recentNotes = existingNotes
      .slice(-50)
      .map(n => {
        const topicId = getTopicId(n);
        const topic = existingTopics.find(t => t.id === topicId);
        return `[${topic?.name || 'Unknown'}] ${n.summary}`;
      })
      .join('\n');

    // Get recent tasks to avoid duplicates (last 20 tasks)
    const recentTasks = existingTasks
      ?.slice(-20)
      .map(t => `- "${t.title}" (${t.priority}, ${t.dueDate ? `due ${t.dueDate}` : 'no due date'})`)
      .join('\n') || 'None yet';

    // Get applicable learnings
    let learningsSection = '';
    if (userLearnings && learningSettings && learningSettings.enabled) {
      const learningService = new LearningService(userLearnings, learningSettings);
      const applicableLearnings = learningService.getApplicableLearnings();

      if (applicableLearnings.length > 0) {
        learningsSection = `

**USER-SPECIFIC LEARNINGS:**
${learningService.formatForPrompt(applicableLearnings)}

**How to apply learnings:**
- ✅ RULE (${learningSettings.thresholds.rule}%+): Must follow strictly - these are established user preferences
- 📊 PATTERN (${learningSettings.thresholds.active}-${learningSettings.thresholds.rule - 1}%): Should follow unless context clearly contradicts
- 🔬 OBSERVATION (<${learningSettings.thresholds.active}%): Consider as suggestion, use judgment
- [USER-FLAGGED]: User explicitly wants this learned faster - prioritize

When creating tasks, due dates, priorities, and tags, check learnings first.
`;
      }
    }

    const attachmentInfo = attachments && attachments.length > 0
      ? `\n\n**Attachments (${attachments.length}):**
${attachments.map(a => `- ${a.name} (${a.type}, ${a.mimeType})`).join('\n')}

**IMPORTANT - Image Analysis:**
If images are attached, analyze them carefully:
1. Extract any visible text (OCR)
2. Identify key visual elements (diagrams, charts, UI elements, etc.)
3. Describe what the image shows in context of the text
4. Extract any actionable items or important information from the images
5. Incorporate image insights into your topic detection and task extraction

Images may contain:
- Screenshots of applications, dashboards, or UIs
- Diagrams or flowcharts explaining systems
- Handwritten or printed notes
- Charts, graphs, or data visualizations
- Product mockups or designs
`
      : '';

    const prompt = `<!-- SECTION 1: ROLE & CAPABILITIES -->
<role>
You are an intelligent capture assistant for Taskerino. You help users organize their thoughts, notes, and tasks by:
- Detecting topics and entities from unstructured input
- Creating structured notes with semantic HTML formatting
- Extracting actionable tasks with priorities and deadlines
- Maintaining relationships between entities (topics, companies, contacts)
- Avoiding duplicates by searching existing data
</role>

<capabilities>
You have access to indexed search tools (UnifiedIndexManager):
- search_notes: Find existing notes (<100ms, searches 1000+ notes)
- search_tasks: Find existing tasks (<100ms)
- find_similar_notes: Check for duplicates before creating
- create_topic: Create new topics when needed

Search tools return relevance scores - use them to make smart decisions.
</capabilities>

<constraints>
CRITICAL - These are non-negotiable:
- Always return valid JSON (never plain text, never markdown)
- Include "action" field for EVERY note and task (create/update/merge)
- Use semantic HTML for note content (h2, p, ul, li tags)
- Check existing data before creating duplicates
- Prioritize updating drafts over creating new notes
</constraints>

<!-- SECTION 2: CONTEXT -->
${learningsSection}

<!-- SECTION 3: INSTRUCTIONS -->
<tool_decision_tree>
BEFORE responding, follow this decision process:

1. Is this a simple standalone item? (e.g., "buy milk", "call dentist")
   → NO TOOLS - Create directly with action="create"

2. Does user mention existing work? (e.g., "working on API docs", "I finished X")
   → YES - Use search_tasks to find context
   → If found: action="update" with targetId
   → If not found: action="create"

3. Is this content about a recurring topic/project/meeting?
   → YES - Use find_similar_notes to check for existing notes
   → Prioritize DRAFT notes (status='draft') for merging
   → If similar draft found: action="update" or action="merge"
   → If no match: action="create"

4. Does user explicitly say "update X" or "continue Y"?
   → YES - MUST use search tools to find X or Y
   → Return error if not found

DEFAULT: For quick thoughts with no context, create directly (no tools).

IMPORTANT: Search tools are FAST (<100ms). Don't hesitate to search when unsure.
</tool_decision_tree>

<draft_notes_priority>
Draft notes (status='draft') are work-in-progress that need consolidation:
- Created when users review AI suggestions but don't approve yet
- Indicate ongoing work that should be updated, not duplicated
- ALWAYS prefer action="update" or action="merge" for existing drafts

When find_similar_notes returns drafts:
1. Check relevance score (>0.7 = strong match)
2. If strong match: action="update" with targetId
3. If partial match: action="merge" with mergeWith array
4. Only create new if no draft matches (score <0.5)

This prevents duplicate drafts when user captures similar content multiple times.
</draft_notes_priority>

<action_requirements>
CRITICAL: Every note and task MUST have an "action" field:

- action="create": New entity, no existing match
- action="update": Updating existing entity (requires targetId)
- action="merge": Combining multiple entities (requires mergeWith array)

NEVER omit the action field - responses without action are invalid.
</action_requirements>

<examples>
<example type="simple_task_no_tools">
<input>buy milk</input>
<thinking>Simple standalone task, no context, no search needed</thinking>
<output>
{
  "tasks": [{
    "id": "task-1",
    "action": "create",
    "reasoning": "Simple new task with no existing context",
    "title": "Buy milk",
    "priority": "low"
  }],
  "aiSummary": "I added 'Buy milk' to your tasks."
}
</output>
</example>

<example type="update_existing_draft">
<input>Meeting with Acme Corp - discussed Q4 pricing, they're interested in enterprise plan</input>
<thinking>
This mentions a company and sounds like ongoing discussions.
Should search for similar notes first - might be a draft from previous meeting.
</thinking>
<tool_call>
{
  "name": "find_similar_notes",
  "input": {
    "summary": "Acme Corp meeting pricing",
    "content": "Q4 pricing enterprise plan",
    "minSimilarity": 0.7
  }
}
</tool_call>
<tool_result>
{
  "matches": [
    {
      "note": {
        "id": "note-789",
        "summary": "Initial Acme Corp call - pricing discussion",
        "status": "draft"
      },
      "similarity": 0.85
    }
  ]
}
</tool_result>
<thinking>
Found existing DRAFT note about Acme pricing with high relevance (0.85).
Should UPDATE the draft instead of creating duplicate.
</thinking>
<output>
{
  "notes": [{
    "id": "note-1",
    "action": "update",
    "targetId": "note-789",
    "reasoning": "Updating existing draft note about Acme Corp pricing - prevents duplicate",
    "content": "<h2>Acme Corp - Q4 Pricing Discussion</h2><p>Follow-up meeting to discuss Q4 pricing strategy. Key points:</p><ul><li>Strong interest in enterprise plan</li><li>Reviewing custom pricing for Q4 rollout</li></ul>",
    "summary": "Follow-up with Acme Corp on Q4 enterprise pricing",
    "source": "meeting"
  }],
  "aiSummary": "I updated your existing Acme Corp draft note with the latest pricing discussion."
}
</output>
</example>

<example type="bad_over_tooling">
<input>reminder: call dentist</input>
<thinking>DON'T search for "dentist" - this is clearly a new reminder</thinking>
<bad_output>
{
  "toolCalls": [{"name": "search_tasks", "input": {"query": "dentist"}}]
}
</bad_output>
<why_bad>Adds 100ms latency for no benefit. Simple reminders should be created directly.</why_bad>
<correct_output>
{
  "tasks": [{
    "id": "task-1",
    "action": "create",
    "reasoning": "New reminder",
    "title": "Call dentist",
    "priority": "medium"
  }]
}
</correct_output>
</example>
</examples>

<response_schema>
CRITICAL: Your response MUST include action field for every note and task:

{
  "notes": [{
    "id": "note-1",
    "action": "create" | "update" | "merge" | "skip",  // REQUIRED
    "targetId": "existing-note-id",  // If update/merge
    "mergeWith": ["note-id-2", "note-id-3"],  // If merge
    "mergeStrategy": "append" | "replace",  // If merge
    "reasoning": "Brief explanation of why you chose this action",  // REQUIRED
    "content": "...",
    "summary": "..."
  }],
  "tasks": [{
    "id": "task-1",
    "action": "create" | "update" | "complete" | "skip",  // REQUIRED
    "targetId": "existing-task-id",  // If update/complete
    "reasoning": "Brief explanation",  // REQUIRED
    "title": "...",
    "priority": "..."
  }]
}
</response_schema>

<your_tools>
You have these tools to capture and organize information:

1. **Create Notes** - For information worth preserving (ideas, context, reference material, documentation)
   - Rich HTML content with semantic structure
   - Can associate with topics for organization
   - Add tags for discoverability

2. **Create Tasks** - For work that needs to be done (action items, to-dos, follow-ups)
   - Title and description
   - Optional: priority, due date, subtasks
   - Can link to topics and add tags

3. **Attach Metadata** - To enrich notes and tasks with context
   - Topics (companies, people, projects, subjects)
   - Tags (flexible categorization)
   - Contacts and companies (entities)
   - Source type and sentiment

You decide which tools to use based on the user's input. Use what makes sense:
- Just a note (reference, documentation, ideas)
- Just tasks (action items, to-dos)
- Both (meeting notes with follow-ups)
- Neither (if input is unclear or requests something else)
</your_tools>

<existing_data>
Topics: ${topicList}

Recent Notes:
${recentNotes || 'No recent notes'}

Existing Tasks (check for duplicates):
${recentTasks}
</existing_data>

<user_input>
${text}
</user_input>
${attachmentInfo}

<guidelines>
- Check existing data to avoid duplicates
- Match existing topics when relevant (fuzzy matching is OK)
- Use HTML for note content (no markdown): <h2>, <p>, <ul><li>, <ol><li>, <strong>
- For tasks with deadlines, infer dates from temporal context below
- Be honest: if something shouldn't be a task, don't force it
- If input is vague or conversational, capture what's clear and skip what isn't

**Entity Creation Rules:**
- **Companies**: Create in newEntities.companies for organizations/businesses mentioned (e.g., "Acme Corp", "Google", "StartupXYZ")
- **Contacts**: Create in newEntities.contacts for people mentioned (e.g., "Sarah", "John from sales", "the CEO")
- **Topics**: Create in newEntities.topics ONLY for subjects/projects/themes (e.g., "API Development", "Q4 Planning", "Marketing Strategy")
  - Do NOT create topics for people or companies - use contacts/companies instead
  - Topics should be concepts, not entities
</guidelines>

<temporal_context>
${(() => {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return `${dayOfWeek}, ${monthDay} at ${currentTime}
ISO Date: ${now.toISOString().split('T')[0]}`;
})()}

Date Inference Examples:
- "EOD today" → ${new Date().toISOString().split('T')[0]} at 18:00
- "tomorrow morning" → ${new Date(Date.now() + 86400000).toISOString().split('T')[0]} at 09:00
- "by Friday" → Next Friday at 18:00
- "next week" → Next Monday at 09:00
- No deadline mentioned → Leave dueDate/dueTime null
</temporal_context>

<ai_summary_instructions>
Write a conversational 2-3 sentence summary explaining your decisions:
1. What you created (tasks, notes, or both) and why
2. Key decisions you made (priority, organization, what you skipped)
3. How you interpreted the user's input

**If anything was unclear or ambiguous**, ask the user a friendly question to help you refine it. They can answer using the "Request Changes" button.

Examples WITHOUT questions (everything was clear):
- "I created 2 tasks from your message since you mentioned specific follow-ups with Sarah. I left the deadlines open since you didn't specify timing."
- "I captured this as a single note under the Product Ideas topic because it's more brainstorming than actionable work. I added tags for the features mentioned so you can find it later."
- "I saved this as a research note without creating tasks since you're collecting information rather than planning work. I linked it to the AI topic you've been exploring."

Examples WITH questions (something was unclear):
- "I created a note about the product feedback from the call. Should I also create a follow-up task to address the concerns, or is this just for reference?"
- "I captured the meeting discussion as a note and created 2 tasks for the action items. I wasn't sure about the priority for the API review - is that urgent or can it wait until next sprint?"
- "I saved this as a task to 'Schedule team meeting.' Did you want me to break this into subtasks for the agenda items you mentioned, or keep it simple?"
- "I created a note with your story idea. I wasn't sure if 'detective' should be a topic - do you want to organize creative writing by genre like this?"

Ask questions when genuinely unsure, not for every detail. Be specific and offer context for why you're asking.
</ai_summary_instructions>

<examples>
Example 1 - Meeting with tasks:
Input: "Met with Sarah about pricing. Need to send proposal by Friday, follow up next week on pricing model. She mentioned concerns about enterprise tier."
Output: {
  "aiSummary": "I created a note capturing the pricing discussion and Sarah's concerns, plus 2 tasks for your follow-ups. The proposal is high priority with a Friday deadline since you specified that timing.",
  "notes": [{
    "id": "note-1",
    "content": "<h2>Meeting with Sarah - Pricing Discussion</h2><p>Sarah raised concerns about the enterprise tier pricing model.</p>",
    "summary": "Pricing discussion with Sarah",
    "tags": ["pricing", "enterprise"],
    "source": "other"
  }],
  "tasks": [
    {
      "id": "task-1",
      "title": "Send pricing proposal to Sarah",
      "description": "Send proposal by end of Friday.",
      "priority": "high",
      "dueDate": "[next-friday]",
      "dueTime": "18:00",
      "tags": ["proposal", "pricing"]
    },
    {
      "id": "task-2",
      "title": "Follow up with Sarah on pricing model",
      "description": "Follow up next week to discuss pricing model concerns.",
      "priority": "medium",
      "dueDate": null,
      "tags": ["follow-up", "pricing"]
    }
  ],
  "relationships": [
    {
      "from": { "type": "note", "id": "note-1" },
      "to": { "type": "contact", "name": "Sarah" },
      "relationType": "note-contact",
      "metadata": { "confidence": 0.95, "reasoning": "Note is about meeting with Sarah" }
    },
    {
      "from": { "type": "note", "id": "note-1" },
      "to": { "type": "topic", "name": "Pricing Strategy" },
      "relationType": "note-topic",
      "metadata": { "confidence": 0.9 }
    },
    {
      "from": { "type": "task", "id": "task-1" },
      "to": { "type": "contact", "name": "Sarah" },
      "relationType": "task-contact",
      "metadata": { "confidence": 0.95 }
    },
    {
      "from": { "type": "task", "id": "task-1" },
      "to": { "type": "note", "id": "note-1" },
      "relationType": "task-note",
      "metadata": { "confidence": 0.9, "reasoning": "Task is follow-up from this meeting note" }
    },
    {
      "from": { "type": "task", "id": "task-2" },
      "to": { "type": "contact", "name": "Sarah" },
      "relationType": "task-contact",
      "metadata": { "confidence": 0.95 }
    }
  ],
  "newEntities": {
    "topics": [{ "name": "Pricing Strategy", "type": "subject", "confidence": 0.9 }],
    "companies": [],
    "contacts": [{ "name": "Sarah", "confidence": 0.95 }]
  }
}

Example 2 - Research note only:
Input: "Interesting article on transformer architecture improvements. Multi-head attention can be optimized using sparse patterns. Could reduce compute by 40%. Link: example.com/article"
Output: {
  "aiSummary": "I saved this as a research note under Machine Learning since it's technical information worth referencing later. I didn't create tasks since you're collecting insights, not planning work.",
  "notes": [{
    "id": "note-1",
    "content": "<h2>Transformer Architecture Optimization</h2><p>Multi-head attention can be optimized using sparse patterns, potentially reducing compute by 40%.</p><p>Source: <a href='example.com/article'>example.com/article</a></p>",
    "summary": "Transformer optimization techniques",
    "tags": ["transformers", "optimization", "research"],
    "source": "other"
  }],
  "tasks": [],
  "relationships": [
    {
      "from": { "type": "note", "id": "note-1" },
      "to": { "type": "topic", "name": "Machine Learning" },
      "relationType": "note-topic",
      "metadata": { "confidence": 0.9 }
    }
  ],
  "newEntities": {
    "topics": [{ "name": "Machine Learning", "type": "subject", "confidence": 0.9 }],
    "companies": [],
    "contacts": []
  }
}

Example 3 - Personal task only:
Input: "Need to book dentist appointment, been putting it off"
Output: {
  "aiSummary": "I created a simple task for booking your dentist appointment. No deadline specified so I left it flexible.",
  "notes": [],
  "tasks": [{
    "id": "task-1",
    "title": "Book dentist appointment",
    "description": "Schedule dentist appointment.",
    "priority": "medium",
    "dueDate": null,
    "tags": ["health", "personal"]
  }],
  "relationships": [],
  "newEntities": {
    "topics": [],
    "companies": [],
    "contacts": []
  }
}

Example 4 - Creative note only:
Input: "Story idea: detective who can see last 60 seconds of anyone's life by touching objects they owned. Set in 1920s Paris. Protagonist is haunted by what she sees."
Output: {
  "aiSummary": "I captured your story idea as a creative note. I added tags for the genre and setting so you can find it when working on similar ideas.",
  "notes": [{
    "id": "note-1",
    "content": "<h2>Story Idea: Last 60 Seconds Detective</h2><p>A detective with the ability to see the last 60 seconds of anyone's life by touching objects they owned.</p><h2>Setting</h2><p>1920s Paris</p><h2>Character</h2><p>Protagonist is haunted by what she sees through her ability.</p>",
    "summary": "Detective story idea - psychic touch ability",
    "tags": ["story-idea", "detective", "1920s", "paranormal"],
    "source": "thought"
  }],
  "tasks": [],
  "relationships": [],
  "newEntities": {
    "topics": [],
    "companies": [],
    "contacts": []
  }
}
</examples>

<output_schema>
Return JSON with these fields:
{
  "aiSummary": "Your conversational explanation (required)",
  "notes": [
    {
      "id": "note-1",  // Assign temp ID (note-1, note-2, etc.)
      "content": "Semantic HTML content (h2, p, ul/ol, strong)",
      "summary": "One-line summary",
      "tags": ["tag1", "tag2"],
      "source": "call" | "email" | "thought" | "other",
      "sentiment": "positive" | "neutral" | "negative",
      "keyPoints": ["Point 1", "Point 2"]
    }
  ],
  "tasks": [
    {
      "id": "task-1",  // Assign temp ID (task-1, task-2, etc.)
      "title": "Clear, actionable title",
      "description": "1-2 sentence description",
      "sourceExcerpt": "Exact quote from input",
      "priority": "high" | "medium" | "low",
      "dueDate": "YYYY-MM-DD or null",
      "dueTime": "HH:MM or null",
      "dueDateReasoning": "Why this date/time",
      "tags": ["tag1", "tag2"],
      "suggestedSubtasks": ["Subtask 1"] or []
    }
  ],
  "relationships": [
    {
      "from": { "type": "note" | "task", "id": "note-1" },  // Use temp ID from notes/tasks
      "to": {
        "type": "topic" | "company" | "contact" | "note" | "task",
        "id": "existing-id" OR "name": "EntityName"  // ID if existing, name if new
      },
      "relationType": "note-topic" | "note-company" | "note-contact" | "task-topic" | "task-note" | etc.,
      "metadata": {
        "confidence": 0.0-1.0,  // How confident are you in this relationship?
        "reasoning": "Why you created this link"  // Optional, for complex relationships
      }
    }
  ],
  "newEntities": {
    "topics": [
      {
        "name": "Topic Name",
        "type": "company" | "person" | "subject" | "project",
        "confidence": 0.0-1.0
      }
    ],
    "companies": [
      {
        "name": "Company Name",
        "confidence": 0.0-1.0
      }
    ],
    "contacts": [
      {
        "name": "Contact Name",
        "confidence": 0.0-1.0
      }
    ]
  },
  "skippedTasks": [
    {
      "title": "Task title",
      "reason": "duplicate" | "unclear" | "not-actionable",
      "existingTaskTitle": "If duplicate",
      "sourceExcerpt": "Quote from input"
    }
  ],
  "tags": ["tag1", "tag2"],
  "sentiment": "positive" | "neutral" | "negative"
}

Notes:
- Assign temp IDs to notes/tasks (note-1, note-2, task-1, task-2, etc.)
- Use relationships array to explicitly link entities
- Link notes/tasks to existing topics by ID, or to new topics by name
- You can create any relationship type: note-topic, task-note, note-company, etc.
- newEntities specifies topics/companies/contacts to create
- notes/tasks/relationships arrays can all be empty if not needed
</output_schema>

Return valid JSON only (no markdown).`;

    try {
      // Build content array with prompt caching enabled
      // Split prompt into cacheable static instructions and dynamic user input
      const staticInstructions = `<system_instructions>
You help users capture information by deciding how to best organize it using the tools available to you.

**CRITICAL: You MUST ALWAYS return valid JSON, never plain text.**

If you encounter problematic content (slurs, offensive language, policy violations):
- Process what you CAN process
- Explain any omissions or concerns in the aiSummary field
- Still return proper JSON with notes/tasks arrays (can be empty if nothing to capture)
- Do NOT return plain text explanations - use aiSummary for that

</system_instructions>
${learningsSection}

<tool_usage_guidelines>
You have search tools available to help provide intelligent suggestions.

<when_to_use_tools>
Use search tools strategically when they add value:

1. **For ongoing work or discussions**:
   - User mentions existing projects/topics ("working on API docs")
   - Meeting notes or follow-up discussions
   - Use find_similar_notes or search_tasks to check for context

2. **For completion/update requests**:
   - User says "I finished X" or "update the status"
   - Search for that specific task/note to update it

3. **For complex or duplicate-prone content**:
   - Long notes about recurring topics
   - Tasks that might overlap with existing work
   - Check similarity to suggest merge/update

<when_NOT_to_use_tools>
Skip tool calls for:
- Simple standalone tasks ("buy milk", "call dentist")
- Quick thoughts or reminders with no context
- First-time mentions of new topics
</when_NOT_to_use_tools>
</when_to_use_tools>

<tool_decision_process>
Before calling any tool, think:
1. Does this input reference existing work or context?
2. Is this likely a duplicate or update to something existing?
3. Would searching add value or just add latency?

If the answer is NO to all three, proceed directly with action="create".
</tool_decision_process>

<action_requirements>
REQUIRED: Include action field for every note and task:
- action="create" - New entity (most common for simple inputs)
- action="update" - Modify existing (include targetId)
- action="merge" - Combine entities (include targetId + mergeWith)
- action="skip" - Duplicate detected, not worth creating
- Always include reasoning field
</action_requirements>

<examples>
<example type="simple_task">
Input: "buy milk"
Thought: Simple standalone task, no context needed
Output: { tasks: [{ id: "task-1", action: "create", reasoning: "Simple new task", title: "buy milk", priority: "low" }] }
</example>

<example type="context_search">
Input: "working on API documentation"
Thought: Ongoing work - should search for existing context
Step 1: Call search_tasks({ query: "API documentation" })
Step 2: Found task-123 with status "in-progress"
Output: { tasks: [{ id: "task-1", action: "update", targetId: "task-123", reasoning: "Updating existing API docs task" }] }
</example>
</examples>
</tool_usage_guidelines>

<response_schema>
CRITICAL: Your response MUST include action field for every note and task:

{
  "notes": [{
    "id": "note-1",
    "action": "create" | "update" | "merge" | "skip",  // REQUIRED
    "targetId": "existing-note-id",  // If update/merge
    "mergeWith": ["note-id-2", "note-id-3"],  // If merge
    "mergeStrategy": "append" | "replace",  // If merge
    "reasoning": "Brief explanation of why you chose this action",  // REQUIRED
    "content": "...",
    "summary": "..."
  }],
  "tasks": [{
    "id": "task-1",
    "action": "create" | "update" | "complete" | "skip",  // REQUIRED
    "targetId": "existing-task-id",  // If update/complete
    "reasoning": "Brief explanation",  // REQUIRED
    "title": "...",
    "priority": "..."
  }]
}
</response_schema>

<your_tools>
You have these tools to capture and organize information:

1. **Create Notes** - For information worth preserving (ideas, context, reference material, documentation)
   - Rich HTML content with semantic structure
   - Can associate with topics for organization
   - Add tags for discoverability

2. **Create Tasks** - For work that needs to be done (action items, to-dos, follow-ups)
   - Title and description
   - Optional: priority, due date, subtasks
   - Can link to topics and add tags

3. **Attach Metadata** - To enrich notes and tasks with context
   - Topics (companies, people, projects, subjects)
   - Tags (flexible categorization)
   - Contacts and companies (entities)
   - Source type and sentiment

You decide which tools to use based on the user's input. Use what makes sense:
- Just a note (reference, documentation, ideas)
- Just tasks (action items, to-dos)
- Both (meeting notes with follow-ups)
- Neither (if input is unclear or requests something else)
</your_tools>

<guidelines>
- Check existing data to avoid duplicates
- Match existing topics when relevant (fuzzy matching is OK)
- Use HTML for note content (no markdown): <h2>, <p>, <ul><li>, <ol><li>, <strong>
- For tasks with deadlines, infer dates from temporal context below
- Be honest: if something shouldn't be a task, don't force it
- If input is vague or conversational, capture what's clear and skip what isn't

**Entity Creation Rules:**
- **Companies**: Create in newEntities.companies for organizations/businesses mentioned (e.g., "Acme Corp", "Google", "StartupXYZ")
- **Contacts**: Create in newEntities.contacts for people mentioned (e.g., "Sarah", "John from sales", "the CEO")
- **Topics**: Create in newEntities.topics ONLY for subjects/projects/themes (e.g., "API Development", "Q4 Planning", "Marketing Strategy")
  - Do NOT create topics for people or companies - use contacts/companies instead
  - Topics should be concepts, not entities
</guidelines>

<temporal_context>
${(() => {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return `${dayOfWeek}, ${monthDay} at ${currentTime}
ISO Date: ${now.toISOString().split('T')[0]}`;
})()}

Date Inference Examples:
- "EOD today" → ${new Date().toISOString().split('T')[0]} at 18:00
- "tomorrow morning" → ${new Date(Date.now() + 86400000).toISOString().split('T')[0]} at 09:00
- "by Friday" → Next Friday at 18:00
- "next week" → Next Monday at 09:00
- No deadline mentioned → Leave dueDate/dueTime null
</temporal_context>

<ai_summary_instructions>
Write a conversational 2-3 sentence summary explaining your decisions:
1. What you created (tasks, notes, or both) and why
2. Key decisions you made (priority, organization, what you skipped)
3. How you interpreted the user's input

**If anything was unclear or ambiguous**, ask the user a friendly question to help you refine it. They can answer using the "Request Changes" button.

Examples WITHOUT questions (everything was clear):
- "I created 2 tasks from your message since you mentioned specific follow-ups with Sarah. I left the deadlines open since you didn't specify timing."
- "I captured this as a single note under the Product Ideas topic because it's more brainstorming than actionable work. I added tags for the features mentioned so you can find it later."
- "I saved this as a research note without creating tasks since you're collecting information rather than planning work. I linked it to the AI topic you've been exploring."

Examples WITH questions (something was unclear):
- "I created a note about the product feedback from the call. Should I also create a follow-up task to address the concerns, or is this just for reference?"
- "I captured the meeting discussion as a note and created 2 tasks for the action items. I wasn't sure about the priority for the API review - is that urgent or can it wait until next sprint?"
- "I saved this as a task to 'Schedule team meeting.' Did you want me to break this into subtasks for the agenda items you mentioned, or keep it simple?"
- "I created a note with your story idea. I wasn't sure if 'detective' should be a topic - do you want to organize creative writing by genre like this?"

Ask questions when genuinely unsure, not for every detail. Be specific and offer context for why you're asking.
</ai_summary_instructions>

<examples>
Example 1 - Meeting with tasks:
Input: "Met with Sarah about pricing. Need to send proposal by Friday, follow up next week on pricing model. She mentioned concerns about enterprise tier."
Output: {
  "aiSummary": "I created a note capturing the pricing discussion and Sarah's concerns, plus 2 tasks for your follow-ups. The proposal is high priority with a Friday deadline since you specified that timing.",
  "notes": [{
    "id": "note-1",
    "content": "<h2>Meeting with Sarah - Pricing Discussion</h2><p>Sarah raised concerns about the enterprise tier pricing model.</p>",
    "summary": "Pricing discussion with Sarah",
    "tags": ["pricing", "enterprise"],
    "source": "other"
  }],
  "tasks": [
    {
      "id": "task-1",
      "title": "Send pricing proposal to Sarah",
      "description": "Send proposal by end of Friday.",
      "priority": "high",
      "dueDate": "[next-friday]",
      "dueTime": "18:00",
      "tags": ["proposal", "pricing"]
    },
    {
      "id": "task-2",
      "title": "Follow up with Sarah on pricing model",
      "description": "Follow up next week to discuss pricing model concerns.",
      "priority": "medium",
      "dueDate": null,
      "tags": ["follow-up", "pricing"]
    }
  ],
  "relationships": [
    {
      "from": { "type": "note", "id": "note-1" },
      "to": { "type": "contact", "name": "Sarah" },
      "relationType": "note-contact",
      "metadata": { "confidence": 0.95, "reasoning": "Note is about meeting with Sarah" }
    },
    {
      "from": { "type": "note", "id": "note-1" },
      "to": { "type": "topic", "name": "Pricing Strategy" },
      "relationType": "note-topic",
      "metadata": { "confidence": 0.9 }
    },
    {
      "from": { "type": "task", "id": "task-1" },
      "to": { "type": "contact", "name": "Sarah" },
      "relationType": "task-contact",
      "metadata": { "confidence": 0.95 }
    },
    {
      "from": { "type": "task", "id": "task-1" },
      "to": { "type": "note", "id": "note-1" },
      "relationType": "task-note",
      "metadata": { "confidence": 0.9, "reasoning": "Task is follow-up from this meeting note" }
    },
    {
      "from": { "type": "task", "id": "task-2" },
      "to": { "type": "contact", "name": "Sarah" },
      "relationType": "task-contact",
      "metadata": { "confidence": 0.95 }
    }
  ],
  "newEntities": {
    "topics": [{ "name": "Pricing Strategy", "type": "subject", "confidence": 0.9 }],
    "companies": [],
    "contacts": [{ "name": "Sarah", "confidence": 0.95 }]
  }
}

Example 2 - Research note only:
Input: "Interesting article on transformer architecture improvements. Multi-head attention can be optimized using sparse patterns. Could reduce compute by 40%. Link: example.com/article"
Output: {
  "aiSummary": "I saved this as a research note under Machine Learning since it's technical information worth referencing later. I didn't create tasks since you're collecting insights, not planning work.",
  "notes": [{
    "id": "note-1",
    "content": "<h2>Transformer Architecture Optimization</h2><p>Multi-head attention can be optimized using sparse patterns, potentially reducing compute by 40%.</p><p>Source: <a href='example.com/article'>example.com/article</a></p>",
    "summary": "Transformer optimization techniques",
    "tags": ["transformers", "optimization", "research"],
    "source": "other"
  }],
  "tasks": [],
  "relationships": [
    {
      "from": { "type": "note", "id": "note-1" },
      "to": { "type": "topic", "name": "Machine Learning" },
      "relationType": "note-topic",
      "metadata": { "confidence": 0.9 }
    }
  ],
  "newEntities": {
    "topics": [{ "name": "Machine Learning", "type": "subject", "confidence": 0.9 }],
    "companies": [],
    "contacts": []
  }
}

Example 3 - Personal task only:
Input: "Need to book dentist appointment, been putting it off"
Output: {
  "aiSummary": "I created a simple task for booking your dentist appointment. No deadline specified so I left it flexible.",
  "notes": [],
  "tasks": [{
    "id": "task-1",
    "title": "Book dentist appointment",
    "description": "Schedule dentist appointment.",
    "priority": "medium",
    "dueDate": null,
    "tags": ["health", "personal"]
  }],
  "relationships": [],
  "newEntities": {
    "topics": [],
    "companies": [],
    "contacts": []
  }
}

Example 4 - Creative note only:
Input: "Story idea: detective who can see last 60 seconds of anyone's life by touching objects they owned. Set in 1920s Paris. Protagonist is haunted by what she sees."
Output: {
  "aiSummary": "I captured your story idea as a creative note. I added tags for the genre and setting so you can find it when working on similar ideas.",
  "notes": [{
    "id": "note-1",
    "content": "<h2>Story Idea: Last 60 Seconds Detective</h2><p>A detective with the ability to see the last 60 seconds of anyone's life by touching objects they owned.</p><h2>Setting</h2><p>1920s Paris</p><h2>Character</h2><p>Protagonist is haunted by what she sees through her ability.</p>",
    "summary": "Detective story idea - psychic touch ability",
    "tags": ["story-idea", "detective", "1920s", "paranormal"],
    "source": "thought"
  }],
  "tasks": [],
  "relationships": [],
  "newEntities": {
    "topics": [],
    "companies": [],
    "contacts": []
  }
}
</examples>

<output_schema>
Return JSON with these fields:
{
  "aiSummary": "Your conversational explanation (required)",
  "notes": [
    {
      "id": "note-1",  // Assign temp ID (note-1, note-2, etc.)
      "content": "Semantic HTML content (h2, p, ul/ol, strong)",
      "summary": "One-line summary",
      "tags": ["tag1", "tag2"],
      "source": "call" | "email" | "thought" | "other",
      "sentiment": "positive" | "neutral" | "negative",
      "keyPoints": ["Point 1", "Point 2"]
    }
  ],
  "tasks": [
    {
      "id": "task-1",  // Assign temp ID (task-1, task-2, etc.)
      "title": "Clear, actionable title",
      "description": "1-2 sentence description",
      "sourceExcerpt": "Exact quote from input",
      "priority": "high" | "medium" | "low",
      "dueDate": "YYYY-MM-DD or null",
      "dueTime": "HH:MM or null",
      "dueDateReasoning": "Why this date/time",
      "tags": ["tag1", "tag2"],
      "suggestedSubtasks": ["Subtask 1"] or []
    }
  ],
  "relationships": [
    {
      "from": { "type": "note" | "task", "id": "note-1" },  // Use temp ID from notes/tasks
      "to": {
        "type": "topic" | "company" | "contact" | "note" | "task",
        "id": "existing-id" OR "name": "EntityName"  // ID if existing, name if new
      },
      "relationType": "note-topic" | "note-company" | "note-contact" | "task-topic" | "task-note" | etc.,
      "metadata": {
        "confidence": 0.0-1.0,  // How confident are you in this relationship?
        "reasoning": "Why you created this link"  // Optional, for complex relationships
      }
    }
  ],
  "newEntities": {
    "topics": [
      {
        "name": "Topic Name",
        "type": "company" | "person" | "subject" | "project",
        "confidence": 0.0-1.0
      }
    ],
    "companies": [
      {
        "name": "Company Name",
        "confidence": 0.0-1.0
      }
    ],
    "contacts": [
      {
        "name": "Contact Name",
        "confidence": 0.0-1.0
      }
    ]
  },
  "skippedTasks": [
    {
      "title": "Task title",
      "reason": "duplicate" | "unclear" | "not-actionable",
      "existingTaskTitle": "If duplicate",
      "sourceExcerpt": "Quote from input"
    }
  ],
  "tags": ["tag1", "tag2"],
  "sentiment": "positive" | "neutral" | "negative"
}

Notes:
- Assign temp IDs to notes/tasks (note-1, note-2, task-1, task-2, etc.)
- Use relationships array to explicitly link entities
- Link notes/tasks to existing topics by ID, or to new topics by name
- You can create any relationship type: note-topic, task-note, note-company, etc.
- newEntities specifies topics/companies/contacts to create
- notes/tasks/relationships arrays can all be empty if not needed
</output_schema>

Return valid JSON only (no markdown).`;

      const dynamicContext = `
<existing_data>
Topics: ${topicList}

Recent Notes:
${recentNotes || 'No recent notes'}

Existing Tasks (check for duplicates):
${recentTasks}
</existing_data>

<user_input>
${text}
</user_input>
${attachmentInfo}`;

      // Build content blocks with prompt caching
      // Cache the static instructions (system rules, schema, examples)
      // Keep dynamic data (user input, existing data) uncached
      const contentBlocks: ClaudeContentBlock[] = [
        {
          type: 'text',
          text: staticInstructions,
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: dynamicContext
        }
      ];

      // Add image attachments to content blocks
      if (attachments && attachments.length > 0) {
        console.log('🖼️ Processing', attachments.length, 'attachments for Claude API');
        for (const attachment of attachments) {
          console.log('📎 Processing attachment:', {
            id: attachment.id,
            type: attachment.type,
            name: attachment.name,
            hasThumbnail: !!attachment.thumbnail,
            hasPath: !!attachment.path,
          });

          if (attachment.type === 'image' || attachment.type === 'screenshot') {
            try {
              let base64Data: string;

              // Get base64 from thumbnail or read from file
              if (attachment.thumbnail && attachment.thumbnail.startsWith('data:image')) {
                console.log('✅ Using thumbnail data for', attachment.name);
                // Extract base64 from data URL
                base64Data = attachment.thumbnail.split(',')[1];
              } else if (attachment.path) {
                console.log('📄 Reading from file path:', attachment.path);
                // Read file and convert to base64
                const fileData = await fileStorage.readAttachment(attachment.path);
                base64Data = fileStorage.uint8ArrayToBase64(fileData);
                console.log('✅ Read', fileData.length, 'bytes from file');
              } else {
                console.warn('⚠️ Skipping attachment - no thumbnail or path:', attachment.name);
                continue; // Skip if no data available
              }

              // Determine media type
              const mediaType = attachment.mimeType.startsWith('image/')
                ? attachment.mimeType
                : 'image/png';

              console.log('✅ Adding image to Claude API request:', {
                name: attachment.name,
                mediaType,
                base64Length: base64Data.length,
              });

              const imageSource: ClaudeImageSource = {
                type: 'base64',
                mediaType: mediaType,
                data: base64Data,
              };

              contentBlocks.push({
                type: 'image',
                source: imageSource,
              });
            } catch (error) {
              console.error('❌ Failed to load image attachment:', error);
              // Continue processing without this image
            }
          }
        }
        console.log('✅ Total content blocks to send to Claude:', contentBlocks.length, '(2 text blocks +', contentBlocks.length - 2, 'images)');
      }

      // Build messages array
      const messages: ClaudeMessage[] = [
        { role: 'user', content: contentBlocks }
      ];

      // Define tools for Claude
      const tools = [
        {
          name: "search_notes",
          description: `Search notes using indexed search (UnifiedIndexManager, <100ms for 1000+ notes).

WHEN TO USE:
- User mentions existing work: "working on API docs"
- User wants to update: "I finished X"
- Complex content about recurring topics
- Checking for duplicates before creating

WHEN NOT TO USE:
- Simple standalone notes: "reminder: call dentist"
- First-time mentions: "new idea for campaign"
- Quick thoughts with no context

Returns notes with relevance scores (0-1) and status field (check for status='draft' to prioritize).
Scores >0.7 indicate strong matches.`,
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Full-text search query (indexed)" },
              topicId: { type: "string", description: "Filter by topic ID for focused search" },
              tags: { type: "array", items: { type: "string" }, description: "Filter by tags (e.g., ['backend', 'urgent'])" },
              dateRange: {
                type: "object",
                properties: {
                  start: { type: "string", format: "date", description: "ISO date (YYYY-MM-DD)" },
                  end: { type: "string", format: "date", description: "ISO date (YYYY-MM-DD)" }
                },
                required: ["start", "end"]
              },
              limit: { type: "number", default: 20, description: "Max results (default: 20)" }
            }
          }
        },
        {
          name: "search_tasks",
          description: `Search tasks using indexed search (UnifiedIndexManager, <100ms for 1000+ tasks).

Use when:
- User mentions ongoing work: "working on API docs"
- User wants to complete: "I finished X"
- Checking for existing tasks before creating duplicates

Returns tasks with relevance scores (0-1). Status and priority are returned for filtering.`,
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query (indexed full-text)" },
              status: { type: "array", items: { enum: ["todo", "in-progress", "done"] }, description: "Filter by status" },
              priority: { type: "array", items: { enum: ["low", "medium", "high", "urgent"] }, description: "Filter by priority" },
              dateRange: {
                type: "object",
                properties: {
                  start: { type: "string", format: "date", description: "ISO date (YYYY-MM-DD)" },
                  end: { type: "string", format: "date", description: "ISO date (YYYY-MM-DD)" }
                },
                required: ["start", "end"]
              },
              limit: { type: "number", default: 20, description: "Max results (default: 20)" }
            }
          }
        },
        {
          name: "find_similar_notes",
          description: `Find notes similar to given content using indexed relevance search.

USE BEFORE creating notes to check for:
- Existing DRAFTS that should be updated (status='draft')
- Similar approved notes that could be merged
- Duplicates from previous captures

Returns results sorted by relevance score (0-1).
PRIORITIZE drafts (status='draft') for updating - prevents duplicate drafts.`,
          inputSchema: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Note summary to match against (required)" },
              content: { type: "string", description: "Note content to match against (optional)" },
              topicId: { type: "string", description: "Optional: limit to specific topic" },
              minSimilarity: { type: "number", default: 0.7, description: "Minimum relevance score (0-1, default: 0.7)" }
            },
            required: ["summary"]
          }
        },
        {
          name: "find_similar_tasks",
          description: `Find tasks similar to given title using indexed search.

Use to:
- Detect duplicate tasks before creating
- Find tasks to update or complete
- Check for related work

Returns tasks with relevance scores (0-1). Threshold default: 0.8 (stricter than notes).`,
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Task title to match against (required)" },
              description: { type: "string", description: "Task description for better matching (optional)" },
              contextNoteId: { type: "string", description: "Related note ID to narrow search (optional)" },
              minSimilarity: { type: "number", default: 0.8, description: "Minimum relevance score (0-1, default: 0.8)" }
            },
            required: ["title"]
          }
        }
      ];

      // Tool execution loop - continue until AI returns final answer
      let response = await invoke<ClaudeChatResponse>('claude_chat_completion_vision', {
        model: 'claude-haiku-4-5-20251001', // Claude Haiku 4.5 - Fast, cost-effective
        maxTokens: 64000, // Claude Haiku 4.5 max output limit
        messages,
        system: undefined,
        temperature: undefined,
        tools,
      });

      // Tool execution loop
      const maxToolIterations = 5; // Prevent infinite loops
      let toolIterations = 0;

      while (response.stopReason === 'tool_use' && toolIterations < maxToolIterations) {
        toolIterations++;

        const toolCalls = response.content.filter((c: any) => c.type === 'tool_use');
        console.log(`[claudeService] Tool iteration ${toolIterations}: Claude used ${toolCalls.length} tools`);

        // Execute all tools and collect results
        const toolResults: any[] = [];

        for (const toolCall of toolCalls) {
          console.log(`[claudeService] Executing tool: ${toolCall.name}`, toolCall.input);

          try {
            const result = await this.executeToolForCapture(toolCall, existingNotes, existingTasks || []);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: JSON.stringify(result)
            });
            console.log(`[claudeService] Tool ${toolCall.name} succeeded`);
          } catch (error) {
            console.error(`[claudeService] Tool ${toolCall.name} failed:`, error);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' }),
              is_error: true
            });
          }
        }

        // Add assistant's message with tool calls
        messages.push({
          role: 'assistant',
          content: response.content
        });

        // Add user message with tool results
        messages.push({
          role: 'user',
          content: toolResults
        });

        // Continue conversation with tool results
        console.log(`[claudeService] Sending tool results back to Claude...`);
        response = await invoke<ClaudeChatResponse>('claude_chat_completion_vision', {
          model: 'claude-haiku-4-5-20251001',
          maxTokens: 64000,
          messages,
          system: undefined,
          temperature: undefined,
          tools,
        });
      }

      if (toolIterations >= maxToolIterations) {
        console.warn('[claudeService] Reached max tool iterations, proceeding with last response');
      }

      // Extract text from response (may have mixed content with tool_use blocks)
      let textContent = '';
      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text;
        }
      }

      if (!textContent) {
        console.error('[claudeService] No text content in final response:', response.content);
        throw new Error('Claude did not return a valid response. Please try again.');
      }

      const responseText = textContent.trim();
      let jsonText = responseText;

      // Try multiple extraction strategies for JSON from Claude's response
      // Strategy 1: Extract from markdown code blocks (```json or ```)
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }
      // Strategy 2: If no code blocks, try to find JSON object/array directly
      else if (!responseText.startsWith('{') && !responseText.startsWith('[')) {
        const objectMatch = responseText.match(/(\{[\s\S]*\})/);
        const arrayMatch = responseText.match(/(\[[\s\S]*\])/);
        if (objectMatch) {
          jsonText = objectMatch[1];
        } else if (arrayMatch) {
          jsonText = arrayMatch[1];
        }
      }

      let aiResponse;
      try {
        aiResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse Claude response as JSON');
        console.error('Parse error:', parseError);
        console.error('Attempted to parse:', jsonText.substring(0, 500));
        console.error('Full response (first 1000 chars):', responseText.substring(0, 1000));

        throw new Error(
          `Failed to parse AI response as JSON. Claude was instructed to always return JSON but returned text. ` +
          `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. ` +
          `Response preview: ${responseText.substring(0, 200)}...`
        );
      }

      // Validate that AI included action fields
      if (aiResponse.notes && aiResponse.notes.length > 0) {
        aiResponse.notes.forEach((note: any, idx: number) => {
          if (!note.action) {
            console.warn(`[claudeService] Note ${idx} missing action field, defaulting to 'create'`);
            note.action = 'create';
          }
          if (!note.reasoning) {
            console.warn(`[claudeService] Note ${idx} missing reasoning field`);
          }
        });
      }

      if (aiResponse.tasks && aiResponse.tasks.length > 0) {
        aiResponse.tasks.forEach((task: any, idx: number) => {
          if (!task.action) {
            console.warn(`[claudeService] Task ${idx} missing action field, defaulting to 'create'`);
            task.action = 'create';
          }
          if (!task.reasoning) {
            console.warn(`[claudeService] Task ${idx} missing reasoning field`);
          }
        });
      }

      // DEBUG: Log full AI response for analysis
      console.group('🤖 AI Response Analysis');
      console.log('Input length:', text.length, 'characters');
      console.log('Input type:', aiResponse.inputType || 'unknown');
      console.log('Primary topic:', aiResponse.primaryTopic?.name || 'None');
      console.log('Secondary topics:', aiResponse.secondaryTopics?.length || 0);
      console.log('Note strategy:', aiResponse.noteStrategy?.action || 'create');
      console.log('Overall sentiment:', aiResponse.sentiment || 'unknown');
      console.log('Overall tags:', aiResponse.tags?.join(', ') || 'none');

      // Log first note from notes array (Claude returns "notes" plural)
      if (aiResponse.notes && aiResponse.notes.length > 0) {
        const firstNote = aiResponse.notes[0];
        console.group('📝 Note Details:');
        console.log({
          hasSummary: !!firstNote.summary,
          summaryLength: firstNote.summary?.length || 0,
          hasContent: !!firstNote.content,
          contentLength: firstNote.content?.length || 0,
          hasTags: !!firstNote.tags,
          tagsCount: firstNote.tags?.length || 0,
          tags: firstNote.tags?.join(', ') || 'none',
          source: firstNote.source || 'not set',
          sentiment: firstNote.sentiment || 'not set',
          hasKeyPoints: !!firstNote.keyPoints,
          keyPointsCount: firstNote.keyPoints?.length || 0,
          hasRelatedTopics: !!firstNote.relatedTopics,
          relatedTopicsCount: firstNote.relatedTopics?.length || 0,
        });
        console.groupEnd();
      }

      console.log('Tasks extracted:', aiResponse.tasks?.length || 0);
      if (aiResponse.tasks && aiResponse.tasks.length > 0) {
        console.group('📋 Task Details:');
        aiResponse.tasks.forEach((task: any, i: number) => {
          console.log(`\nTask ${i + 1}:`, {
            title: task.title,
            priority: task.priority,
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            hasDescription: !!task.description,
            descriptionLength: task.description?.length || 0,
            hasSourceExcerpt: !!task.sourceExcerpt,
            hasTags: task.tags?.length > 0,
            tagsCount: task.tags?.length || 0,
            hasSubtasks: task.suggestedSubtasks?.length > 0,
            subtasksCount: task.suggestedSubtasks?.length || 0,
            hasDueDateReasoning: !!task.dueDateReasoning,
          });
        });
        console.groupEnd();
      }

      console.log('Skipped tasks:', aiResponse.skippedTasks?.length || 0);
      if (aiResponse.skippedTasks && aiResponse.skippedTasks.length > 0) {
        console.group('⏭️ Skipped Tasks (Duplicates):');
        aiResponse.skippedTasks.forEach((skipped: any, i: number) => {
          console.log(`\nSkipped ${i + 1}:`, {
            title: skipped.title,
            reason: skipped.reason,
            existingTaskTitle: skipped.existingTaskTitle,
            sourceExcerpt: skipped.sourceExcerpt,
          });
        });
        console.groupEnd();
      }
      console.groupEnd();

      // Step 2: Process PRIMARY topic first (most important)
      processingSteps.push('Identifying primary topic...');

      const topicResults = [];
      let primaryTopicResult = null;

      if (aiResponse.primaryTopic) {
        const primary = aiResponse.primaryTopic;
        const matchedTopic = findMatchingTopic(primary.name, existingTopics);

        if (matchedTopic) {
          const confidence = calculateMatchConfidence(primary.name, matchedTopic);
          primaryTopicResult = {
            name: matchedTopic.name,
            type: primary.type || 'company',
            confidence,
            existingTopicId: matchedTopic.id,
          };
        } else {
          // New primary topic
          primaryTopicResult = {
            name: primary.name,
            type: primary.type || 'company',
            confidence: 1.0,
          };
        }

        topicResults.push(primaryTopicResult);
      }

      // Step 3: Process SECONDARY topics (people, features, etc.)
      processingSteps.push('Detecting related topics...');

      if (aiResponse.secondaryTopics) {
        for (const secondary of aiResponse.secondaryTopics) {
          const matchedTopic = findMatchingTopic(secondary.name, existingTopics);

          if (matchedTopic) {
            topicResults.push({
              name: matchedTopic.name,
              type: secondary.type || 'other',
              confidence: calculateMatchConfidence(secondary.name, matchedTopic),
              existingTopicId: matchedTopic.id,
            });
          } else {
            // Create secondary topic
            topicResults.push({
              name: secondary.name,
              type: secondary.type || 'other',
              confidence: 1.0,
            });
          }
        }
      }

      // Step 4: Create ONE note for the primary topic
      processingSteps.push('Creating note...');

      const noteResults = [];

      // Parse notes array (Claude returns "notes" plural, not "note" singular)
      // Notes are independent of topics - we parse them even if no topic detected
      if (aiResponse.notes && aiResponse.notes.length > 0) {
        const firstNote = aiResponse.notes[0]; // Get first note from array
        const topicId = primaryTopicResult?.existingTopicId || 'new';
        const topicName = primaryTopicResult?.name || 'General Notes';
        let mergedWith: string | undefined;
        let isNew = true;

        // Check if we should update an existing note
        if (aiResponse.noteStrategy?.action === 'update' && aiResponse.noteStrategy.updateNoteId) {
          mergedWith = aiResponse.noteStrategy.updateNoteId;
          isNew = false;
        } else if (settings.autoMergeNotes && primaryTopicResult?.existingTopicId) {
          // Or check similarity with recent notes
          const similarNotes = findSimilarNotes(
            firstNote.content,
            primaryTopicResult.existingTopicId,
            existingNotes,
            1 // last 1 day for call transcripts
          );

          if (similarNotes.length > 0) {
            mergedWith = similarNotes[0].id;
            isNew = false;
          }
        }

        noteResults.push({
          topicId,
          topicName,
          content: firstNote.content,
          summary: firstNote.summary,
          sourceText: text, // Store original input for validation
          isNew,
          mergedWith,
          tags: firstNote.tags || aiResponse.tags || [],
          source: (firstNote.source || (aiResponse.inputType === 'call_transcript' ? 'call' : aiResponse.inputType === 'meeting_note' ? 'call' : 'thought')) as 'call' | 'email' | 'thought' | 'other' | undefined,
          sentiment: (firstNote.sentiment || aiResponse.sentiment) as 'positive' | 'neutral' | 'negative' | undefined,
          keyPoints: firstNote.keyPoints || [],
          relatedTopics: firstNote.relatedTopics || aiResponse.secondaryTopics?.map((t: any) => t.name) || [],
        });
      } else {
        // Log warning if Claude didn't return notes array
        console.warn('[claudeService] No notes array in AI response. Claude may not be following prompt format.');
        console.warn('[claudeService] Response structure:', {
          hasNote: !!aiResponse.note,
          hasNotes: !!aiResponse.notes,
          notesLength: aiResponse.notes?.length,
        });
      }

      // Fallback: Only if Claude returns NEITHER topics NOR notes
      // (If Claude returns notes but no topic, we already parsed the notes above with topicName='General Notes')
      if (topicResults.length === 0 && noteResults.length === 0) {
        console.warn('[claudeService] Claude returned no topics and no notes. Using fallback with raw text.');

        topicResults.push({
          name: 'General Notes',
          type: 'other' as const,
          confidence: 1.0,
        });

        noteResults.push({
          topicId: 'new',
          topicName: 'General Notes',
          content: text,
          summary: 'Note added',
          sourceText: text, // Store original input
          isNew: true,
          tags: aiResponse.tags || [],
          source: 'thought' as const,
          sentiment: (aiResponse.sentiment || 'neutral') as 'positive' | 'neutral' | 'negative',
          keyPoints: [],
          relatedTopics: [],
        });
      }

      // Step 5: Extract tasks (all linked to primary topic)
      processingSteps.push('Extracting tasks...');

      const taskResults = extractTasks
        ? aiResponse.tasks?.map((task: any) => ({
            title: task.title,
            priority: task.priority || 'medium',
            dueDate: task.dueDate,
            dueTime: task.dueTime,
            dueDateReasoning: task.dueDateReasoning,
            description: task.description,
            sourceExcerpt: task.sourceExcerpt,
            tags: task.tags || [],
            suggestedSubtasks: task.suggestedSubtasks || [],
            topicId: primaryTopicResult?.existingTopicId, // Link to primary topic
            noteId: undefined, // Will be set when saving
          })) || []
        : [];

      // Extract skipped/duplicate tasks
      const skippedTasks = aiResponse.skippedTasks?.map((skipped: any) => ({
        title: skipped.title,
        reason: skipped.reason || 'duplicate',
        existingTaskTitle: skipped.existingTaskTitle,
        sourceExcerpt: skipped.sourceExcerpt,
      })) || [];

      processingSteps.push('Done!');

      // Transform notes to new format with temp IDs
      const notesWithIds = (aiResponse.notes || []).map((note: any, index: number) => ({
        id: note.id || `note-${index + 1}`,
        content: note.content,
        summary: note.summary,
        tags: note.tags || [],
        source: note.source as 'call' | 'email' | 'thought' | 'other' | undefined,
        sentiment: note.sentiment as 'positive' | 'neutral' | 'negative' | undefined,
        keyPoints: note.keyPoints || [],
        relationships: [], // Initialize relationships array to prevent undefined errors
      }));

      // Transform tasks to new format with temp IDs
      const tasksWithIds = (aiResponse.tasks || []).map((task: any, index: number) => ({
        id: task.id || `task-${index + 1}`,
        title: task.title,
        priority: task.priority || 'medium',
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        dueDateReasoning: task.dueDateReasoning,
        description: task.description,
        tags: task.tags || [],
        suggestedSubtasks: task.suggestedSubtasks || [],
        sourceExcerpt: task.sourceExcerpt,
        relationships: [], // Initialize relationships array to prevent undefined errors
      }));

      // Return NEW format matching AIProcessResult interface
      return {
        aiSummary: aiResponse.aiSummary,
        notes: notesWithIds,
        tasks: tasksWithIds,
        relationships: aiResponse.relationships || [],
        newEntities: {
          topics: (aiResponse.newEntities?.topics || []).map((t: any) => ({
            name: t.name,
            type: t.type || 'subject',
            confidence: t.confidence || 0.9,
          })),
          companies: (aiResponse.newEntities?.companies || []).map((c: any) => ({
            name: c.name,
            confidence: c.confidence || 0.9,
          })),
          contacts: (aiResponse.newEntities?.contacts || []).map((c: any) => ({
            name: c.name,
            confidence: c.confidence || 0.9,
          })),
        },
        skippedTasks: skippedTasks.length > 0 ? skippedTasks : undefined,
        sentiment: aiResponse.sentiment,
        tags: aiResponse.tags || [],
      };
    } catch (error) {
      console.error('Error processing with Claude:', error);
      throw new Error(
        `Failed to process: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Query assistant: Ask questions about notes and topics
   */
  async queryAssistant(
    question: string,
    topics: Topic[],
    notes: Note[],
    tasks: Task[],
    settings: AppState['aiSettings']
  ): Promise<AIQueryResponse> {
    if (!this.hasApiKey) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    // Helper to check if entity has relationship with topic
    const hasTopicRelationship = (entity: Note | Task, topicId: string): boolean => {
      return entity.relationships.some(r =>
        (r.type === 'note-topic' || r.type === 'task-topic') && r.targetId === topicId
      );
    };

    // Build context from all data
    const context = topics.map(topic => {
      const topicNotes = notes.filter(n => hasTopicRelationship(n, topic.id)).slice(0, 5);
      const topicTasks = tasks.filter(t => hasTopicRelationship(t, topic.id));

      return `
**${topic.name}** (${topic.noteCount} notes)

Recent Notes:
${topicNotes.map(n => `- [${new Date(n.timestamp).toLocaleDateString()}] ${n.summary}`).join('\n') || 'None'}

Open Tasks:
${topicTasks.filter(t => !t.done).map(t => `- ${t.title} (${t.priority})`).join('\n') || 'None'}
`;
    }).join('\n---\n');

    // Split into cacheable static instructions and dynamic data
    const staticQueryInstructions = `${settings.systemInstructions}

Provide a helpful, specific answer using the information above. Include which topics you're referencing and suggest follow-up questions if relevant.

Return ONLY valid JSON (no markdown):
{
  "answer": "Your detailed answer here",
  "sources": [
    {
      "type": "note",
      "id": "note-id",
      "excerpt": "relevant excerpt",
      "topicName": "Acme Corp"
    }
  ],
  "relatedTopics": ["topic-id-1", "topic-id-2"],
  "suggestedFollowUps": ["What about pricing?", "Any recent updates?"]
}`;

    const dynamicQueryContext = `
**Knowledge Base:**
${context}

**Question:** ${question}`;

    try {
      // Use content blocks with prompt caching
      const contentBlocks: ClaudeContentBlock[] = [
        {
          type: 'text',
          text: staticQueryInstructions,
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: dynamicQueryContext
        }
      ];

      const messages: ClaudeMessage[] = [
        { role: 'user', content: contentBlocks }
      ];

      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-haiku-4-5-20251001', // Claude Haiku 4.5 - Fast, cost-effective
          maxTokens: 64000, // Claude Haiku 4.5 max output limit
          messages,
          system: undefined,
          temperature: undefined,
        }
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;

      // Try multiple extraction strategies for JSON
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      } else if (!responseText.startsWith('{') && !responseText.startsWith('[')) {
        const objectMatch = responseText.match(/(\{[\s\S]*\})/);
        const arrayMatch = responseText.match(/(\[[\s\S]*\])/);
        if (objectMatch) {
          jsonText = objectMatch[1];
        } else if (arrayMatch) {
          jsonText = arrayMatch[1];
        }
      }

      let result;
      try {
        result = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse query response as JSON');
        console.error('Parse error:', parseError);
        console.error('Response preview:', responseText.substring(0, 500));
        throw new Error(
          `Failed to parse query response. ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        );
      }

      return {
        answer: result.answer || 'I could not find an answer to that question.',
        sources: result.sources || [],
        relatedTopics: result.relatedTopics || [],
        suggestedFollowUps: result.suggestedFollowUps || [],
      };
    } catch (error) {
      console.error('Error querying with Claude:', error);
      throw new Error(
        `Failed to process query: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * AI-driven parameter optimization: Analyzes learning effectiveness and suggests adjustments
   */
  async optimizeLearningParameters(
    optimizationContext: string
  ): Promise<{
    shouldOptimize: boolean;
    reasoning: string;
    suggestedSettings?: Partial<AppState['learningSettings']>;
  }> {
    if (!this.hasApiKey) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    // Split into cacheable static instructions and dynamic data
    const staticOptimizationInstructions = `**Your Task:**
Analyze the learning system performance and determine if parameter adjustments are needed.

**Decision Criteria:**
1. If accuracy is >80% and promotion rate is healthy (20-40%), system is working well - no changes needed
2. If accuracy is low (<60%), parameters may need adjustment
3. If promotion rate is too low (<10%), learnings may be too hard to promote
4. If promotion rate is too high (>60%), thresholds may be too lenient
5. If degradation rate is high (>30%), rejection penalty may be too harsh

**Output Format:**
Return ONLY valid JSON (no markdown):
{
  "shouldOptimize": true/false,
  "reasoning": "Explain why optimization is/isn't needed based on metrics",
  "suggestedSettings": {
    "confirmationPoints": 10,
    "rejectionPenalty": 20,
    "applicationBonus": 1,
    "flagMultiplier": 1.5,
    "timeDecayDays": 30,
    "timeDecayRate": 0.5,
    "thresholds": {
      "deprecated": 10,
      "active": 50,
      "rule": 80
    }
  }
}

Only include "suggestedSettings" if shouldOptimize is true. Make conservative adjustments (5-10% changes at most).`;

    try {
      // Use content blocks with prompt caching
      const contentBlocks: ClaudeContentBlock[] = [
        {
          type: 'text',
          text: staticOptimizationInstructions,
          cache_control: { type: 'ephemeral' }
        },
        {
          type: 'text',
          text: optimizationContext
        }
      ];

      const messages: ClaudeMessage[] = [
        { role: 'user', content: contentBlocks }
      ];

      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-haiku-4-5-20251001', // Claude Haiku 4.5 - Fast, cost-effective
          maxTokens: 64000, // Claude Haiku 4.5 max output limit
          messages,
          system: undefined,
          temperature: undefined,
        }
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      const responseText = content.text.trim();
      let jsonText = responseText;

      // Try multiple extraction strategies for JSON
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      } else if (!responseText.startsWith('{') && !responseText.startsWith('[')) {
        const objectMatch = responseText.match(/(\{[\s\S]*\})/);
        const arrayMatch = responseText.match(/(\[[\s\S]*\])/);
        if (objectMatch) {
          jsonText = objectMatch[1];
        } else if (arrayMatch) {
          jsonText = arrayMatch[1];
        }
      }

      let result;
      try {
        result = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse optimization response as JSON');
        console.error('Parse error:', parseError);
        console.error('Response preview:', responseText.substring(0, 500));
        throw parseError;
      }

      return result;
    } catch (error) {
      console.error('Error optimizing parameters with Claude:', error);
      return {
        shouldOptimize: false,
        reasoning: 'Failed to analyze: ' + (error instanceof Error ? error.message : 'Unknown error'),
      };
    }
  }

  /**
   * Refine existing capture results based on user feedback
   * Uses conversation history to maintain context across refinements
   */
  async refineCapture(
    request: RefinementRequest,
    notesContext?: { updateNote: (note: Note) => void; state: { notes: Note[] } }
  ): Promise<RefinementResponse> {
    if (!this.hasApiKey) {
      return {
        success: false,
        error: 'API key not set. Please configure your Claude API key in Settings.',
      };
    }

    const { userMessage, currentResult } = request;
    const context = currentResult.conversationContext;

    // Check iteration limit
    if (context.iterationCount >= 10) {
      return {
        success: false,
        error: 'Maximum refinement iterations reached (10). Please save or cancel.',
      };
    }

    try {
      // Build refinement prompt
      const refinementPrompt = `You are refining a previous capture based on user feedback.

<context>
Original Input: ${context.originalCapture}

Your Previous Output:
${JSON.stringify({
  aiSummary: currentResult.aiSummary,
  notes: currentResult.notes,
  tasks: currentResult.tasks,
}, null, 2)}

Conversation History:
${context.messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 500)}`).join('\n')}
</context>

<user_feedback>
${userMessage}
</user_feedback>

<instructions>
The user is asking you to adjust your previous capture. Listen to their feedback and update accordingly:

1. Understand what they want changed (add, remove, modify, reorganize)
2. Make those changes to the notes and/or tasks
3. Keep everything else consistent unless they ask you to change it
4. Explain what you changed and why

Remember: You're using tools (notes, tasks, metadata). Adjust based on what makes sense given their feedback.
</instructions>

<ai_summary_instructions>
Write a 2-3 sentence summary explaining what you CHANGED:
1. What you modified (added tasks, removed notes, changed priorities, etc.)
2. WHY you made those changes based on their feedback
3. Key improvements or adjustments

Examples:
- "I updated the task priorities based on your feedback. The proposal is now high priority since you mentioned the tight deadline, and I dropped the research task to low priority."
- "I consolidated the 3 meeting tasks into one comprehensive task with subtasks, like you asked. This keeps your list cleaner while still tracking everything."
- "I expanded the note with the technical details you provided and added the #architecture tag. I also created that API review task you said was missing."

Be specific - explain what changed and why.
</ai_summary_instructions>

<output_schema>
Return the FULL updated result in this format:
{
  "aiSummary": "Explanation of changes",
  "detectedTopics": ${JSON.stringify(currentResult.detectedTopics || [])},
  "notes": [
    {
      "content": "...",
      "summary": "...",
      "topicAssociation": "...",
      "tags": [],
      "source": "...",
      "sentiment": "...",
      "keyPoints": [],
      "relatedTopics": []
    }
  ],
  "tasks": [
    {
      "title": "",
      "description": "",
      "sourceExcerpt": "",
      "priority": "high" | "medium" | "low",
      "dueDate": "YYYY-MM-DD or null",
      "dueTime": "HH:MM or null",
      "dueDateReasoning": "",
      "tags": [],
      "suggestedSubtasks": [],
      "relatedTo": ""
    }
  ],
  "tags": [],
  "sentiment": "..."
}
</output_schema>

Return valid JSON only (no markdown).`;

      // Build message with conversation history
      const messages: ClaudeMessage[] = [
        { role: 'user', content: refinementPrompt }
      ];

      const response = await invoke<ClaudeChatResponse>('claude_chat_completion', {
        request: {
          model: 'claude-haiku-4-5-20251001', // Claude Haiku 4.5 - Fast refinements
          maxTokens: 64000,
          messages,
          system: undefined,
          temperature: undefined,
        }
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return {
          success: false,
          error: 'Unexpected response format from Claude',
        };
      }

      const responseText = content.text.trim();
      let jsonText = responseText;

      // Extract JSON from response
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      } else if (!responseText.startsWith('{') && !responseText.startsWith('[')) {
        const objectMatch = responseText.match(/(\{[\s\S]*\})/);
        if (objectMatch) {
          jsonText = objectMatch[1];
        }
      }

      let aiResponse;
      try {
        aiResponse = JSON.parse(jsonText);
      } catch (parseError) {
        console.error('Failed to parse refinement response');
        return {
          success: false,
          error: 'Failed to parse AI response. Please try again.',
        };
      }

      // Build updated result with new conversation context
      const updatedNotes = aiResponse.notes && aiResponse.notes.length > 0 ? [{
        topicId: aiResponse.primaryTopic?.name || 'General',
        topicName: aiResponse.primaryTopic?.name || 'General',
        content: aiResponse.notes[0].content,
        summary: aiResponse.notes[0].summary,
        sourceText: context.originalCapture,
        isNew: true,
        tags: aiResponse.notes[0].tags || [],
        source: aiResponse.notes[0].source || 'thought',
        sentiment: aiResponse.notes[0].sentiment || 'neutral',
        keyPoints: aiResponse.notes[0].keyPoints || [],
        relatedTopics: aiResponse.notes[0].relatedTopics || [],
      }] : currentResult.notes;

      console.log('🤖 Refinement response - updated note content length:', updatedNotes?.[0]?.content?.length);
      console.log('🤖 Refinement response - aiSummary:', aiResponse.aiSummary);

      // Update notes in NotesContext so UI sees the changes
      if (notesContext && currentResult.createdNoteIds && currentResult.createdNoteIds.length > 0 && updatedNotes.length > 0) {
        currentResult.createdNoteIds.forEach((noteId, index) => {
          const updatedAINote = updatedNotes[index];
          if (!updatedAINote) return;

          const existingNote = notesContext.state.notes.find(n => n.id === noteId);
          if (existingNote) {
            console.log(`📝 Updating note ${noteId} with refined content (length: ${updatedAINote.content?.length})`);
            notesContext.updateNote({
              ...existingNote,
              content: updatedAINote.content,
              summary: updatedAINote.summary,
              tags: updatedAINote.tags || existingNote.tags,
              metadata: {
                ...existingNote.metadata,
                sentiment: updatedAINote.sentiment,
                keyPoints: updatedAINote.keyPoints,
              },
              lastUpdated: new Date().toISOString(),
            });
          }
        });
      }

      const updatedResult: CaptureResult = {
        ...currentResult,
        aiSummary: aiResponse.aiSummary || 'I\'ve updated the capture based on your request.',
        notes: updatedNotes,
        tasks: aiResponse.tasks || currentResult.tasks,
        detectedTopics: currentResult.detectedTopics, // Keep existing topics
        conversationContext: {
          ...context,
          messages: [
            ...context.messages,
            { role: 'user', content: userMessage },
            { role: 'assistant', content: JSON.stringify(aiResponse) },
          ],
          iterationCount: context.iterationCount + 1,
        },
        processingSteps: ['Refined based on user feedback'],
        processingTimeMs: 0, // Not tracked for refinements
      };

      return {
        success: true,
        updatedResult,
      };
    } catch (error) {
      console.error('Error refining capture:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during refinement',
      };
    }
  }
}

export const claudeService = new ClaudeService();
