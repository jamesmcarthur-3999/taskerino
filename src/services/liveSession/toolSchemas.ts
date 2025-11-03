/**
 * Tool Schemas for Live Session Intelligence
 *
 * Defines JSON schemas for all tools available to external AI services.
 * These tools provide access to session data, entity search, and task/note creation.
 *
 * Usage:
 * ```typescript
 * import { LIVE_SESSION_TOOLS } from './toolSchemas';
 *
 * // Pass to your AI service
 * const response = await yourAI.chat({
 *   messages: [...],
 *   tools: LIVE_SESSION_TOOLS
 * });
 * ```
 */

/**
 * Tool definition schema (compatible with Claude, OpenAI, etc.)
 */
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * All available live session tools
 *
 * These tools can be executed via LiveSessionToolExecutor
 */
export const LIVE_SESSION_TOOLS: ToolSchema[] = [
  // =========================================================================
  // ENTITY SEARCH TOOLS
  // =========================================================================

  {
    name: 'universal_search',
    description: 'Search across all entities (sessions, notes, tasks) with relationship awareness. Supports full-text search, filters, and cross-entity queries.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Full-text search query (searches across all indexed fields)'
        },
        entityTypes: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['sessions', 'notes', 'tasks']
          },
          description: 'Entity types to search (default: all)'
        },
        relatedTo: {
          type: 'object',
          properties: {
            entityType: {
              type: 'string',
              enum: ['session', 'note', 'task', 'topic', 'company', 'contact'],
              description: 'Entity type to find relationships from'
            },
            entityId: {
              type: 'string',
              description: 'Entity ID to find relationships from'
            },
            maxHops: {
              type: 'number',
              description: 'Maximum relationship hops (default: 1)',
              default: 1
            },
            relationshipType: {
              type: 'string',
              description: 'Optional: filter by relationship type'
            }
          },
          required: ['entityType', 'entityId'],
          description: 'Find entities related to a specific entity'
        },
        timeRange: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
              description: 'ISO 8601 start date/time'
            },
            end: {
              type: 'string',
              description: 'ISO 8601 end date/time'
            }
          },
          description: 'Filter by time range'
        },
        filters: {
          type: 'object',
          properties: {
            // Task filters
            status: {
              type: 'string',
              description: 'Task status filter (e.g., "in_progress", "completed")'
            },
            priority: {
              type: 'string',
              description: 'Task priority filter (e.g., "high", "urgent")'
            },
            completed: {
              type: 'boolean',
              description: 'Filter tasks by completion status'
            },
            // Note filters
            sourceType: {
              type: 'string',
              description: 'Note source type filter'
            },
            // Session filters
            category: {
              type: 'string',
              description: 'Session category filter'
            },
            subCategory: {
              type: 'string',
              description: 'Session sub-category filter'
            },
            hasAudio: {
              type: 'boolean',
              description: 'Filter sessions with audio'
            },
            hasVideo: {
              type: 'boolean',
              description: 'Filter sessions with video'
            },
            // Cross-entity filters
            topicIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by topic IDs'
            },
            companyIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by company IDs'
            },
            contactIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by contact IDs'
            }
          },
          description: 'Entity-specific filters'
        },
        sortBy: {
          type: 'string',
          enum: ['relevance', 'date', 'priority', 'status'],
          description: 'Sort field (default: relevance)',
          default: 'relevance'
        },
        sortOrder: {
          type: 'string',
          enum: ['asc', 'desc'],
          description: 'Sort order (default: desc)',
          default: 'desc'
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 50)',
          default: 50
        },
        offset: {
          type: 'number',
          description: 'Result offset for pagination (default: 0)',
          default: 0
        },
        operator: {
          type: 'string',
          enum: ['AND', 'OR'],
          description: 'Combine filters with AND or OR (default: AND)',
          default: 'AND'
        }
      },
      required: []
    }
  },

  // =========================================================================
  // SESSION QUERY TOOLS
  // =========================================================================

  {
    name: 'search_session_screenshots',
    description: 'Search screenshots in the active session by activity, text, UI elements, or progress indicators.',
    input_schema: {
      type: 'object',
      properties: {
        activity: {
          type: 'string',
          description: 'Filter by detected activity type (e.g., "coding", "email-writing")'
        },
        text: {
          type: 'string',
          description: 'Search in OCR extracted text and AI summary'
        },
        elements: {
          type: 'array',
          items: { type: 'string' },
          description: 'Search for specific UI elements (e.g., ["Gmail", "VS Code"])'
        },
        hasAchievements: {
          type: 'boolean',
          description: 'Filter screenshots with achievements'
        },
        hasBlockers: {
          type: 'boolean',
          description: 'Filter screenshots with blockers'
        },
        minCuriosity: {
          type: 'number',
          description: 'Minimum curiosity score (0-1) for adaptive scheduling'
        },
        since: {
          type: 'string',
          description: 'ISO 8601 timestamp - only screenshots after this time'
        },
        until: {
          type: 'string',
          description: 'ISO 8601 timestamp - only screenshots before this time'
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)',
          default: 50
        }
      },
      required: []
    }
  },

  {
    name: 'search_session_audio',
    description: 'Search audio segments in the active session by transcription, phrases, sentiment, or flags.',
    input_schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Search in transcription text'
        },
        phrases: {
          type: 'array',
          items: { type: 'string' },
          description: 'Search for specific key phrases'
        },
        sentiment: {
          type: 'string',
          enum: ['positive', 'neutral', 'negative'],
          description: 'Filter by detected sentiment'
        },
        containsTask: {
          type: 'boolean',
          description: 'Filter audio segments that contain action items'
        },
        containsBlocker: {
          type: 'boolean',
          description: 'Filter audio segments that mention blockers'
        },
        since: {
          type: 'string',
          description: 'ISO 8601 timestamp - only audio after this time'
        },
        until: {
          type: 'string',
          description: 'ISO 8601 timestamp - only audio before this time'
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 50)',
          default: 50
        }
      },
      required: []
    }
  },

  {
    name: 'get_progress_indicators',
    description: 'Get aggregated progress indicators (achievements, blockers, insights) from the active session.',
    input_schema: {
      type: 'object',
      properties: {
        since: {
          type: 'string',
          description: 'ISO 8601 timestamp - only include progress since this time'
        }
      },
      required: []
    }
  },

  {
    name: 'get_recent_activity',
    description: 'Get recent activity timeline (screenshots and audio) from the active session.',
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum timeline items to return (default: 20)',
          default: 20
        }
      },
      required: []
    }
  },

  // =========================================================================
  // TASK/NOTE CREATION TOOLS
  // =========================================================================

  {
    name: 'create_task',
    description: 'Create a new task with full metadata (title, description, priority, due date, tags, relationships).',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Task title (required)'
        },
        description: {
          type: 'string',
          description: 'Task description with context'
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Task priority (default: medium)',
          default: 'medium'
        },
        dueDate: {
          type: 'string',
          description: 'Due date (YYYY-MM-DD format)'
        },
        dueTime: {
          type: 'string',
          description: 'Due time (HH:MM format in 24-hour time)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task tags for categorization'
        },
        topicId: {
          type: 'string',
          description: 'Related topic ID (use universal_search to find topics)'
        },
        noteId: {
          type: 'string',
          description: 'Related note ID'
        },
        sessionId: {
          type: 'string',
          description: 'Source session ID (automatically set for active session)'
        }
      },
      required: ['title']
    }
  },

  {
    name: 'create_note',
    description: 'Create a new note with full metadata (content, topic, tags, companies, contacts, attachments).',
    input_schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Note content in markdown format (required)'
        },
        topicId: {
          type: 'string',
          description: 'Related topic ID (use universal_search to find topics)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Note tags'
        },
        companyIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Related company IDs'
        },
        contactIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Related contact IDs'
        },
        sessionId: {
          type: 'string',
          description: 'Source session ID (automatically set for active session)'
        }
      },
      required: ['content']
    }
  },

  // =========================================================================
  // USER INTERACTION TOOLS
  // =========================================================================

  {
    name: 'ask_user_question',
    description: 'Ask the user a clarifying question during the session. Returns after user responds or times out.',
    input_schema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user (required)'
        },
        context: {
          type: 'string',
          description: 'Context for why this question is being asked'
        },
        suggestedAnswers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional quick-reply button options (max 4)'
        },
        timeoutSeconds: {
          type: 'number',
          description: 'Timeout in seconds (default: 30)',
          default: 30
        }
      },
      required: ['question']
    }
  }
];

/**
 * Get tool by name
 */
export function getToolSchema(name: string): ToolSchema | undefined {
  return LIVE_SESSION_TOOLS.find(tool => tool.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(): string[] {
  return LIVE_SESSION_TOOLS.map(tool => tool.name);
}
