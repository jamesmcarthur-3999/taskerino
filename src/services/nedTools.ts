/**
 * Ned Tool Definitions
 *
 * Tools that Ned can use to interact with the app.
 * Split into Read (no permission) and Write (requires permission) operations.
 */

import type { Task, Note } from '../types';

// ============================================================================
// TOOL SCHEMAS (for Claude API)
// ============================================================================

export const NED_TOOLS = {
  // ==================== READ TOOLS (No Permission Required) ====================

  query_context_agent: {
    name: 'query_context_agent',
    description: 'Search for notes and tasks using the Context Agent. Use this to find information the user is asking about. The agent can search by keywords, dates, tags, companies, contacts, and other metadata. You can have multi-turn conversations with the agent to refine results.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Your search query to the Context Agent. Be specific about what you\'re looking for (e.g., "notes about NVIDIA from Q4 2024" or "high priority tasks due next week")',
        },
        agent_thread_id: {
          type: 'string',
          description: 'Optional: Thread ID for continuing a previous conversation with the agent. Use this to refine or follow up on previous searches.',
        },
      },
      required: ['query'],
    },
  },

  get_current_datetime: {
    name: 'get_current_datetime',
    description: 'Get the current date and time. Use this when you need to know "today", "this week", "next month", etc.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  get_user_context: {
    name: 'get_user_context',
    description: 'Get the current app context (active filters, current view, selected items, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  recall_memory: {
    name: 'recall_memory',
    description: 'Retrieve relevant memories about user preferences and past interactions. Use this to personalize responses.',
    input_schema: {
      type: 'object' as const,
      properties: {
        context: {
          type: 'string',
          description: 'Context to search memories for (e.g., "task organization preferences" or "NVIDIA project context")',
        },
      },
      required: ['context'],
    },
  },

  get_item_details: {
    name: 'get_item_details',
    description: 'Get complete details for a specific task or note by ID. Use this when the user asks about a specific item ("tell me about that note", "what\'s in the NVIDIA task") or when you need full context including relationships (linked notes for tasks, source content for notes, etc.). This gives you EVERYTHING about the item.',
    input_schema: {
      type: 'object' as const,
      properties: {
        item_type: {
          type: 'string',
          enum: ['task', 'note'],
          description: 'Type of item to fetch',
        },
        item_id: {
          type: 'string',
          description: 'ID of the task or note',
        },
      },
      required: ['item_type', 'item_id'],
    },
  },

  // ==================== WRITE TOOLS (Permission Required) ====================

  create_task: {
    name: 'create_task',
    description: 'Create a new task. Requires user permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Task title',
        },
        description: {
          type: 'string',
          description: 'Task description (optional)',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Task priority',
        },
        due_date: {
          type: 'string',
          description: 'Due date in ISO format (optional)',
        },
        due_time: {
          type: 'string',
          description: 'Due time in 24h format like "14:30" (optional)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for the task (optional)',
        },
      },
      required: ['title', 'priority'],
    },
  },

  update_task: {
    name: 'update_task',
    description: 'Update an existing task. Requires user permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'ID of the task to update',
        },
        updates: {
          type: 'object',
          description: 'Fields to update (title, description, priority, due_date, due_time, status)',
        },
      },
      required: ['task_id', 'updates'],
    },
  },

  complete_task: {
    name: 'complete_task',
    description: 'Mark a task as complete. Requires user permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'ID of the task to complete',
        },
      },
      required: ['task_id'],
    },
  },

  delete_task: {
    name: 'delete_task',
    description: 'Delete a task. Requires user permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'ID of the task to delete',
        },
      },
      required: ['task_id'],
    },
  },

  create_note: {
    name: 'create_note',
    description: 'Create a new note. Requires user permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string',
          description: 'Note content (markdown)',
        },
        topic_id: {
          type: 'string',
          description: 'Topic/Company/Contact ID to associate with (optional)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for the note (optional)',
        },
      },
      required: ['content'],
    },
  },

  update_note: {
    name: 'update_note',
    description: 'Update an existing note. Requires user permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        note_id: {
          type: 'string',
          description: 'ID of the note to update',
        },
        content: {
          type: 'string',
          description: 'New content for the note',
        },
      },
      required: ['note_id', 'content'],
    },
  },

  delete_note: {
    name: 'delete_note',
    description: 'Delete a note. Requires user permission.',
    input_schema: {
      type: 'object' as const,
      properties: {
        note_id: {
          type: 'string',
          description: 'ID of the note to delete',
        },
      },
      required: ['note_id'],
    },
  },

  record_memory: {
    name: 'record_memory',
    description: 'Store important context or user preference as a memory. Use this to remember things for future conversations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        memory_type: {
          type: 'string',
          enum: ['user_preference', 'interaction_outcome', 'context_note'],
          description: 'Type of memory to store',
        },
        content: {
          type: 'string',
          description: 'The memory to store',
        },
      },
      required: ['memory_type', 'content'],
    },
  },
};

// ============================================================================
// TOOL CATEGORIES
// ============================================================================

export const READ_TOOLS = [
  'query_context_agent',
  'get_current_datetime',
  'get_user_context',
  'recall_memory',
  'get_item_details',
];

export const WRITE_TOOLS = [
  'create_task',
  'update_task',
  'complete_task',
  'delete_task',
  'create_note',
  'update_note',
  'delete_note',
  'record_memory',
];

// ============================================================================
// TYPES
// ============================================================================

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string | Record<string, any>;
  is_error?: boolean;
  // UI-only data (not sent to Claude)
  full_notes?: Note[];
  full_tasks?: Task[];
}

// Context Agent Response
export interface ContextAgentResult {
  notes: Note[];
  tasks: Task[];
  summary: string;
  suggestions?: string[];
  thread_id: string;
}

// Memory
export interface NedMemory {
  id: string;
  type: 'user_preference' | 'interaction_outcome' | 'context_note';
  content: string;
  createdAt: string;
  relevanceScore: number;
}

// Permission
export interface ToolPermission {
  toolName: string;
  level: 'forever' | 'session' | 'always-ask';
  grantedAt: string;
}

// ============================================================================
// TOOL DESCRIPTIONS (for UI display)
// ============================================================================

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  create_task: 'Create new tasks',
  update_task: 'Modify existing tasks',
  complete_task: 'Mark tasks as complete',
  delete_task: 'Delete tasks',
  create_note: 'Create new notes',
  update_note: 'Modify existing notes',
  delete_note: 'Delete notes',
  record_memory: 'Save memories about preferences and context',
};
