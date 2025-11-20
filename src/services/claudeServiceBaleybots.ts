import { Baleybot, tool } from '@baleybots/core';
import type { Processable } from '@baleybots/core';
import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import type {
  AIProcessResult,
  Topic,
  Note,
  Task,
  AppState,
  Attachment,
} from '../types';
import { getUnifiedIndexManager } from './storage/UnifiedIndexManager';
import { LearningService } from './learningService';
import { fileStorage } from './fileStorageService';
import { anthropic } from '@baleybots/core/proxy';
import { tauriFetch } from './tauriFetch';

// ============================================================================
// ZOD SCHEMAS - Match AIProcessResult interface exactly with defaults
// ============================================================================

const noteSchema = z.object({
  id: z.string().describe('Temp ID assigned by AI (note-1, note-2, etc.)'),
  action: z.enum(['create', 'update', 'merge', 'skip']).optional().default('create'),
  targetId: z.string().optional(),
  mergeWith: z.array(z.string()).optional(),
  mergeStrategy: z.enum(['append', 'replace']).optional(),
  reasoning: z.string().optional().default('Auto-assigned action'),
  content: z.string(),
  summary: z.string(),
  tags: z.array(z.string()).optional().default([]),
  source: z.enum(['call', 'email', 'thought', 'other']).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  keyPoints: z.array(z.string()).optional().default([]),
});

const taskSchema = z.object({
  id: z.string().describe('Temp ID assigned by AI (task-1, task-2, etc.)'),
  action: z.enum(['create', 'update', 'complete', 'skip']).optional().default('create'),
  targetId: z.string().optional(),
  reasoning: z.string().optional().default('Auto-assigned action'),
  title: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  dueDate: z.string().optional(),
  dueTime: z.string().optional(),
  dueDateReasoning: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  suggestedSubtasks: z.array(z.string()).optional().default([]),
  sourceExcerpt: z.string().optional(),
});

const relationshipSchema = z.object({
  from: z.object({
    type: z.enum(['note', 'task']),
    id: z.string(),
  }),
  to: z.object({
    type: z.enum(['topic', 'company', 'contact', 'note', 'task']),
    id: z.string().optional(),
    name: z.string().optional(),
  }),
  relationType: z.string(),
  metadata: z.object({
    confidence: z.number().optional(),
    reasoning: z.string().optional(),
  }).optional(),
});

const newEntitiesSchema = z.object({
  topics: z.array(z.object({
    name: z.string(),
    type: z.enum(['company', 'person', 'subject', 'project']).default('subject'),
    confidence: z.number().default(0.9),
  })).optional().default([]),
  companies: z.array(z.object({
    name: z.string(),
    confidence: z.number().default(0.9),
  })).optional().default([]),
  contacts: z.array(z.object({
    name: z.string(),
    confidence: z.number().default(0.9),
  })).optional().default([]),
});

const skippedTaskSchema = z.object({
  title: z.string(),
  reason: z.enum(['duplicate', 'unclear', 'not-actionable']),
  existingTaskTitle: z.string().optional(),
  sourceExcerpt: z.string().optional(),
});

// Main output schema - matches AIProcessResult interface exactly
const outputSchema = z.object({
  aiSummary: z.string().optional(),
  notes: z.array(noteSchema),
  tasks: z.array(taskSchema),
  relationships: z.array(relationshipSchema).optional().default([]),
  newEntities: newEntitiesSchema.optional().default({
    topics: [],
    companies: [],
    contacts: [],
  }),
  skippedTasks: z.array(skippedTaskSchema).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  tags: z.array(z.string()).optional().default([]),
  processingSteps: z.array(z.string()).optional(),
  requiresClarification: z.boolean().optional(),
  clarificationMessage: z.string().optional(),
});

// Type inference from schema
export type OutputSchemaType = z.infer<typeof outputSchema>;

// Export schemas for reuse in other services/components
export { outputSchema, noteSchema, taskSchema, relationshipSchema, newEntitiesSchema };

// ============================================================================
// TYPE GUARDS - Runtime validation with type narrowing
// ============================================================================

/**
 * Type guard: Validates and narrows bot result to OutputSchemaType
 */
function isValidBotResult(value: unknown): value is OutputSchemaType {
  const result = outputSchema.safeParse(value);
  if (!result.success) {
    console.error('[ClaudeServiceBaleybots] Bot result validation failed:', result.error.format());
    return false;
  }
  return true;
}

/**
 * Type guard: Validates error is Error instance
 */
function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Parse and validate bot result with helpful error messages
 */
function parseBotResult(value: unknown): OutputSchemaType {
  const result = outputSchema.safeParse(value);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => 
      `${issue.path.join('.')}: ${issue.message}`
    ).join(', ');
    throw new Error(`Invalid bot response structure: ${errors}`);
  }
  return result.data;
}

/**
 * Baleybot-based implementation of ClaudeService.processInput()
 * 
 * This replaces the manual tool loop, JSON parsing, and validation logic
 * with baleybots' automatic agent mode and structured output.
 */
export class ClaudeServiceBaleybots {
  private apiKey: string | null = null;
  // Bot type: Baleybot with Zod outputSchema - type is inferred from outputSchema
  // Using Processable interface for type safety while allowing Baleybot's internal type
  private bot: Processable<string, OutputSchemaType> | null = null;

  async setApiKey(apiKey: string) {
    // Store API key on Tauri side for secure management
    await invoke('set_claude_api_key', { apiKey });
    this.apiKey = apiKey;
    this.bot = null; // Reset bot to recreate with new key
  }

  /**
   * Create the baleybot instance with tools and output schema
   */
  private createBot(
    existingNotes: Note[],
    existingTasks: Task[]
  ) {
    if (this.bot && this.apiKey) {
      return this.bot;
    }

    if (!this.apiKey) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    // Create tool implementations
    const searchNotesTool = tool(
      'search_notes',
      `Search notes using indexed search (UnifiedIndexManager, <100ms for 1000+ notes).

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
      z.object({
        query: z.string().describe('Full-text search query (indexed)'),
        topicId: z.string().optional().describe('Filter by topic ID for focused search'),
        tags: z.array(z.string()).optional().describe('Filter by tags (e.g., ["backend", "urgent"])'),
        dateRange: z.object({
          start: z.string().describe('ISO date (YYYY-MM-DD)'),
          end: z.string().describe('ISO date (YYYY-MM-DD)'),
        }).optional(),
        limit: z.number().default(20).describe('Max results (default: 20)'),
      }),
      async (params) => {
        const startTime = performance.now();
        try {
          const unifiedIndex = await getUnifiedIndexManager();
          const result = await unifiedIndex.unifiedSearch({
            entityTypes: ['notes'],
            query: params.query,
            relatedTo: params.topicId ? {
              entityType: 'topic',
              entityId: params.topicId,
            } : undefined,
            filters: {
              tags: params.tags || undefined,
            },
            timeRange: params.dateRange ? {
              start: params.dateRange.start,
              end: params.dateRange.end,
            } : undefined,
            limit: params.limit || 20,
          });

          const searchTimeMs = performance.now() - startTime;
          const notes = result.results.notes.map((r: any) => {
            const fullNote = existingNotes.find((n: any) => n.id === r.id);
            return {
              id: r.id,
              summary: fullNote?.summary || r.snippet,
              content: fullNote?.content?.substring(0, 200),
              tags: fullNote?.tags,
              createdAt: fullNote?.timestamp || r.metadata?.createdAt,
              status: fullNote?.status || r.metadata?.status,
              relevanceScore: r.score,
            };
          });

          return {
            notes,
            total: result.counts.notes,
            searchTimeMs: Math.round(searchTimeMs),
          };
        } catch (error) {
          console.error('[ClaudeServiceBaleybots] search_notes error:', error);
          return { notes: [], total: 0, error: 'Search failed' };
        }
      }
    );

    const searchTasksTool = tool(
      'search_tasks',
      `Search tasks using indexed search (UnifiedIndexManager, <100ms for 1000+ tasks).

Use when:
- User mentions ongoing work: "working on API docs"
- User wants to complete: "I finished X"
- Checking for existing tasks before creating duplicates

Returns tasks with relevance scores (0-1). Status and priority are returned for filtering.`,
      z.object({
        query: z.string().describe('Search query (indexed full-text)'),
        status: z.array(z.enum(['todo', 'in-progress', 'done'])).optional().describe('Filter by status'),
        priority: z.array(z.enum(['low', 'medium', 'high', 'urgent'])).optional().describe('Filter by priority'),
        dateRange: z.object({
          start: z.string().describe('ISO date (YYYY-MM-DD)'),
          end: z.string().describe('ISO date (YYYY-MM-DD)'),
        }).optional(),
        limit: z.number().default(20).describe('Max results (default: 20)'),
      }),
      async (params) => {
        const startTime = performance.now();
        try {
          const unifiedIndex = await getUnifiedIndexManager();
          const result = await unifiedIndex.unifiedSearch({
            entityTypes: ['tasks'],
            query: params.query,
            filters: {
              status: params.status ? (Array.isArray(params.status) ? params.status : [params.status]) : undefined,
              priority: params.priority ? (Array.isArray(params.priority) ? params.priority : [params.priority]) : undefined,
            },
            timeRange: params.dateRange ? {
              start: params.dateRange.start,
              end: params.dateRange.end,
            } : undefined,
            sortBy: 'date',
            sortOrder: 'desc',
            limit: params.limit || 20,
          });

          const searchTimeMs = performance.now() - startTime;
          const tasks = result.results.tasks.map((r: any) => {
            const fullTask = existingTasks.find((t: any) => t.id === r.id);
            return {
              id: r.id,
              title: fullTask?.title || r.metadata?.title,
              description: fullTask?.description || r.metadata?.description,
              status: fullTask?.status || r.metadata?.status,
              priority: fullTask?.priority || r.metadata?.priority,
              dueDate: fullTask?.dueDate || r.metadata?.dueDate,
              relevanceScore: r.score,
            };
          });

          return {
            tasks,
            total: result.counts.tasks,
            searchTimeMs: Math.round(searchTimeMs),
          };
        } catch (error) {
          console.error('[ClaudeServiceBaleybots] search_tasks error:', error);
          return { tasks: [], total: 0, error: 'Search failed' };
        }
      }
    );

    const findSimilarNotesTool = tool(
      'find_similar_notes',
      `Find notes similar to given content using indexed relevance search.

USE BEFORE creating notes to check for:
- Existing DRAFTS that should be updated (status='draft')
- Similar approved notes that could be merged
- Duplicates from previous captures

Returns results sorted by relevance score (0-1).
PRIORITIZE drafts (status='draft') for updating - prevents duplicate drafts.`,
      z.object({
        summary: z.string().describe('Note summary to match against (required)'),
        content: z.string().optional().describe('Note content to match against (optional)'),
        topicId: z.string().optional().describe('Optional: limit to specific topic'),
        minSimilarity: z.number().default(0.7).describe('Minimum relevance score (0-1, default: 0.7)'),
      }),
      async (params) => {
        const startTime = performance.now();
        try {
          const unifiedIndex = await getUnifiedIndexManager();
          const searchQuery = [params.summary, params.content].filter(Boolean).join(' ');
          const result = await unifiedIndex.unifiedSearch({
            entityTypes: ['notes'],
            query: searchQuery,
            relatedTo: params.topicId ? {
              entityType: 'topic',
              entityId: params.topicId,
            } : undefined,
            limit: 10,
          });

          const searchTimeMs = performance.now() - startTime;
          const matches = result.results.notes
            .filter((r: any) => r.score >= params.minSimilarity)
            .map((r: any) => {
              const fullNote = existingNotes.find((n: any) => n.id === r.id);
              return {
                note: {
                  id: r.id,
                  summary: fullNote?.summary || r.metadata?.summary,
                  content: fullNote?.content?.substring(0, 200) || r.snippet,
                  tags: fullNote?.tags || r.metadata?.tags,
                  status: fullNote?.status || r.metadata?.status,
                },
                similarity: r.score,
              };
            });

          return {
            matches,
            total: matches.length,
            searchTimeMs: Math.round(searchTimeMs),
          };
        } catch (error) {
          console.error('[ClaudeServiceBaleybots] find_similar_notes error:', error);
          return { matches: [], total: 0, error: 'Search failed' };
        }
      }
    );

    const findSimilarTasksTool = tool(
      'find_similar_tasks',
      `Find tasks similar to given title using indexed search.

Use to:
- Detect duplicate tasks before creating
- Find tasks to update or complete
- Check for related work

Returns tasks with relevance scores (0-1). Threshold default: 0.8 (stricter than notes).`,
      z.object({
        title: z.string().describe('Task title to match against (required)'),
        description: z.string().optional().describe('Task description for better matching (optional)'),
        contextNoteId: z.string().optional().describe('Related note ID to narrow search (optional)'),
        minSimilarity: z.number().default(0.8).describe('Minimum relevance score (0-1, default: 0.8)'),
      }),
      async (params) => {
        const startTime = performance.now();
        try {
          const unifiedIndex = await getUnifiedIndexManager();
          const searchQuery = [params.title, params.description].filter(Boolean).join(' ');
          const result = await unifiedIndex.unifiedSearch({
            entityTypes: ['tasks'],
            query: searchQuery,
            relatedTo: params.contextNoteId ? {
              entityType: 'notes',
              entityId: params.contextNoteId,
            } : undefined,
            limit: 10,
          });

          const searchTimeMs = performance.now() - startTime;
          const matches = result.results.tasks
            .filter((r: any) => r.score >= params.minSimilarity)
            .map((r: any) => {
              const fullTask = existingTasks.find((t: any) => t.id === r.id);
              return {
                task: {
                  id: r.id,
                  title: fullTask?.title || r.metadata?.title,
                  description: fullTask?.description || r.metadata?.description,
                  status: fullTask?.status || r.metadata?.status,
                  priority: fullTask?.priority || r.metadata?.priority,
                },
                similarity: r.score,
              };
            });

          return {
            matches,
            total: matches.length,
            searchTimeMs: Math.round(searchTimeMs),
          };
        } catch (error) {
          console.error('[ClaudeServiceBaleybots] find_similar_tasks error:', error);
          return { matches: [], total: 0, error: 'Search failed' };
        }
      }
    );

    // Create baleybot with tools - tools are automatically used when provided
    // Tauri fetch routes all HTTP calls through Tauri backend for secure API key management
    const bot = Baleybot.create({
      name: 'taskerino-capture',
      goal: `You are an intelligent capture assistant for Taskerino. You help users organize their thoughts, notes, and tasks by:
- Detecting topics and entities from unstructured input
- Creating structured notes with semantic HTML formatting
- Extracting actionable tasks with priorities and deadlines
- Maintaining relationships between entities (topics, companies, contacts)
- Avoiding duplicates by searching existing data

**CRITICAL: You MUST ALWAYS return valid JSON matching the output schema, never plain text.**

Tool Usage Guidelines:
- Use search tools strategically when they add value (ongoing work, updates, duplicates)
- Skip tools for simple standalone items (quick thoughts, reminders)
- Always include action field for every note and task (create/update/merge/skip)
- Prioritize updating drafts over creating new notes`,
      tools: {
        search_notes: searchNotesTool,
        search_tasks: searchTasksTool,
        find_similar_notes: findSimilarNotesTool,
        find_similar_tasks: findSimilarTasksTool,
      },
      maxToolIterations: 5,
      outputSchema, // Zod schema - provides full type inference and runtime validation
      model: anthropic('claude-haiku-4-5-20251001', {
        fetch: tauriFetch,
      }),
    });

    this.bot = bot;
    return bot;
  }

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
    if (!this.apiKey) {
      throw new Error('API key not set. Please configure your Claude API key in Settings.');
    }

    // Build dynamic context
    const topicList = existingTopics.map(t => t.name).join(', ') || 'None yet';

    // Helper to get topic ID from note relationships
    const getTopicId = (entity: Note | Task): string | undefined => {
      const topicRel = entity.relationships?.find(r =>
        r.type === 'note-topic' || r.type === 'task-topic'
      );
      return topicRel?.targetId;
    };

    // Get recent notes for context
    const recentNotes = existingNotes
      .slice(-50)
      .map(n => {
        const topicId = getTopicId(n);
        const topic = existingTopics.find(t => t.id === topicId);
        return `[${topic?.name || 'Unknown'}] ${n.summary}`;
      })
      .join('\n');

    // Get recent tasks
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

    // Build dynamic context prompt
    const dynamicContext = `<existing_data>
Topics: ${topicList}

Recent Notes:
${recentNotes || 'No recent notes'}

Existing Tasks (check for duplicates):
${recentTasks}
</existing_data>

<user_input>
${text}
</user_input>`;

    // Handle attachments (images)
    // Note: baleybots may need special handling for vision inputs
    // For now, we'll include attachment info in text
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
`
      : '';

    // Create bot instance
    const bot = this.createBot(existingNotes, existingTasks || []);

    // Build full prompt with context
    const fullPrompt = `${dynamicContext}${attachmentInfo}${learningsSection ? `\n${learningsSection}` : ''}`;

    try {
      // Process with baleybot - result is typed as OutputSchemaType
      const result = await bot.process(fullPrompt);

      // Validate and parse result - Zod ensures all defaults are applied
      const validated = parseBotResult(result);

      // Zod schema matches AIProcessResult exactly with defaults applied
      // Simple type assertion since structure matches (Zod handles the defaults)
      return validated as AIProcessResult;
    } catch (error) {
      console.error('[ClaudeServiceBaleybots] Error processing with baleybot:', error);
      
      // Use type guard for error handling
      const errorMessage = isError(error) 
        ? error.message 
        : 'Unknown error';
      
      throw new Error(`Failed to process: ${errorMessage}`);
    }
  }
}

// Export singleton instance
export const claudeServiceBaleybots = new ClaudeServiceBaleybots();

