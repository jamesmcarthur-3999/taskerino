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

  // ==================== SESSION TOOLS ====================

  query_sessions: {
    name: 'query_sessions',
    description: 'Search for work sessions using an AI agent that understands semantic queries. The agent can search by session content, activities detected in screenshots, dates, duration, and more. Supports multi-turn conversations for refining results. Use this when you need to find sessions based on what the user was actually doing (e.g., "sessions where I worked on authentication", "long coding sessions from last week").',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query. Be specific about what you\'re looking for (e.g., "sessions where I worked on the dashboard", "coding sessions from yesterday", "sessions about customer feedback")',
        },
        agent_thread_id: {
          type: 'string',
          description: 'Optional: Thread ID for continuing a previous search conversation with the agent. Use this to refine or follow up on previous session searches.',
        },
      },
  },

  get_session_details: {
    name: 'get_session_details',
    description: 'Get complete details for a specific session including all screenshots, AI analysis, extracted tasks, and notes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'ID of the session to fetch',
        },
      },
      required: ['session_id'],
    },
  },

  get_session_summary: {
    name: 'get_session_summary',
    description: 'Generate an AI-powered summary of a session including key activities, time breakdown, and extracted insights. This runs AI analysis on the session screenshots.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'ID of the session to summarize',
        },
      },
      required: ['session_id'],
    },
  },

  get_active_session: {
    name: 'get_active_session',
    description: 'Get the currently active session (if any) with real-time status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },

  get_screenshot_image: {
    name: 'get_screenshot_image',
    description: 'Load and view a specific screenshot image for visual analysis. **EXPENSIVE - ONLY USE WHEN NECESSARY!** Use this ONLY when: (1) User explicitly asks to see a specific screenshot, (2) The existing AI analysis is insufficient to answer the question, (3) You need to verify specific visual details. DO NOT use this for general session review - the AI analysis already contains the key information.',
    input_schema: {
      type: 'object' as const,
      properties: {
        screenshot_id: {
          type: 'string',
          description: 'ID of the screenshot to load and view',
        },
        reason: {
          type: 'string',
          description: 'Brief explanation of why you need to view this screenshot (helps track usage)',
        },
      },
      required: ['screenshot_id', 'reason'],
    },
  },

  // ==================== DATA GATHERING TOOLS ====================

  get_audio_data: {
    name: 'get_audio_data',
    description: 'Retrieve audio data from a session in multiple modes: (1) segment - load specific audio segment by ID, (2) time_range - extract audio for a time range, (3) full_session - get complete session audio. Returns base64-encoded audio data and waveform.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mode: {
          type: 'string',
          enum: ['segment', 'time_range', 'full_session'],
          description: 'Audio retrieval mode',
        },
        session_id: {
          type: 'string',
          description: 'ID of the session to load audio from',
        },
        segment_id: {
          type: 'string',
          description: 'Audio segment ID (required for segment mode)',
        },
        start_time: {
          type: 'number',
          description: 'Start time in seconds (required for time_range mode)',
        },
        end_time: {
          type: 'number',
          description: 'End time in seconds (required for time_range mode)',
        },
        format: {
          type: 'string',
          enum: ['wav', 'mp3'],
          description: 'Audio format (default: wav)',
        },
      },
      required: ['mode', 'session_id'],
    },
  },

  get_video_data: {
    name: 'get_video_data',
    description: 'Retrieve video data from a session: (1) frames_at_timestamps - extract frames at specific timestamps, (2) frames_by_interval - extract frames at regular intervals, (3) metadata - get video file metadata. Returns base64-encoded PNG frames.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mode: {
          type: 'string',
          enum: ['frames_at_timestamps', 'frames_by_interval', 'metadata'],
          description: 'Video retrieval mode',
        },
        session_id: {
          type: 'string',
          description: 'ID of the session to load video from',
        },
        timestamps: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of timestamps in seconds (for frames_at_timestamps mode)',
        },
        interval_seconds: {
          type: 'number',
          description: 'Interval in seconds between frames (for frames_by_interval mode)',
        },
        max_frames: {
          type: 'number',
          description: 'Maximum number of frames to extract (default: 50, max: 100)',
        },
      },
      required: ['mode', 'session_id'],
    },
  },

  get_transcript: {
    name: 'get_transcript',
    description: 'Retrieve transcript data from a session: (1) segments - get audio segments with transcriptions (filterable by time/quality), (2) full_transcript - get complete transcript in various formats (plain, srt, vtt, json). Use this to analyze what was said during a session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mode: {
          type: 'string',
          enum: ['segments', 'full_transcript'],
          description: 'Transcript retrieval mode',
        },
        session_id: {
          type: 'string',
          description: 'ID of the session to load transcript from',
        },
        start_time: {
          type: 'number',
          description: 'Filter segments starting from this time (seconds)',
        },
        end_time: {
          type: 'number',
          description: 'Filter segments ending at this time (seconds)',
        },
        quality_filter: {
          type: 'string',
          enum: ['all', 'draft', 'final'],
          description: 'Filter segments by transcription quality (segments mode only)',
        },
        format: {
          type: 'string',
          enum: ['plain', 'srt', 'vtt', 'json'],
          description: 'Output format for full_transcript mode (default: plain)',
        },
        quality: {
          type: 'string',
          enum: ['draft', 'final', 'best'],
          description: 'Transcript quality preference (full_transcript mode): draft, final, or best (default: best)',
        },
      },
      required: ['mode', 'session_id'],
    },
  },

  get_session_timeline: {
    name: 'get_session_timeline',
    description: 'Build a chronological timeline of session events including screenshots with AI analysis, audio segments with transcriptions, achievements detected by AI, and blockers. Use this to understand the flow and progression of a work session.',
    input_schema: {
      type: 'object' as const,
      properties: {
        session_id: {
          type: 'string',
          description: 'ID of the session to build timeline for',
        },
        include_screenshots: {
          type: 'boolean',
          description: 'Include screenshots in timeline (default: true)',
        },
        include_audio: {
          type: 'boolean',
          description: 'Include audio segments in timeline (default: true)',
        },
        include_achievements: {
          type: 'boolean',
          description: 'Include detected achievements in timeline (default: false)',
        },
        include_blockers: {
          type: 'boolean',
          description: 'Include detected blockers in timeline (default: false)',
        },
        start_time: {
          type: 'number',
          description: 'Filter timeline from this time (seconds)',
        },
        end_time: {
          type: 'number',
          description: 'Filter timeline until this time (seconds)',
        },
      },
      required: ['session_id'],
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
    description: 'Create a new note. Requires user permission. IMPORTANT: Use plain markdown formatting (not HTML). Use # for headers, ** for bold, * for bullets, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string',
          description: 'Note content in plain markdown format (NOT HTML). Use markdown syntax: # for headers, ** for bold, - for bullets, etc.',
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
    description: 'Update an existing note. Requires user permission. IMPORTANT: Use plain markdown formatting (not HTML). Use # for headers, ** for bold, * for bullets, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        note_id: {
          type: 'string',
          description: 'ID of the note to update',
        },
        content: {
          type: 'string',
          description: 'New content for the note in plain markdown format (NOT HTML)',
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
    cache_control: { type: 'ephemeral' },
  },
  },
};

// ============================================================================
// TOOL CATEGORIES
// ============================================================================

export const READ_TOOLS = [
    'get_current_datetime',
  'get_user_context',
  'recall_memory',
  'get_item_details',
  'query_sessions',
  'get_session_details',
  'get_session_summary',
  'get_active_session',
  'get_screenshot_image',
  'get_audio_data',
  'get_video_data',
  'get_transcript',
  'get_session_timeline',
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
  full_sessions?: any[]; // Session type - using any[] to avoid circular import
  // Change tracking for UI notifications
  operation?: 'create' | 'update' | 'delete';
  item_type?: 'task' | 'note';
  item?: Task | Note;
  changes?: Array<{
    field: string;
    label: string;
    oldValue: any;
    newValue: any;
  }>;
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
  // Read tools
  get_audio_data: 'Retrieve audio data from sessions',
  get_video_data: 'Extract video frames from sessions',
  get_transcript: 'Get session transcripts',
  get_session_timeline: 'Build chronological session timelines',
  // Write tools
  create_task: 'Create new tasks',
  update_task: 'Modify existing tasks',
  complete_task: 'Mark tasks as complete',
  delete_task: 'Delete tasks',
  create_note: 'Create new notes',
  update_note: 'Modify existing notes',
  delete_note: 'Delete notes',
  record_memory: 'Save memories about preferences and context',
};
