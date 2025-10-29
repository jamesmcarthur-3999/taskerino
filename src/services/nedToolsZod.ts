/**
 * Ned Tools - Zod Schema Definitions
 * 
 * Type-safe tool definitions for @baleybots/react using Zod
 */

import { z } from 'zod';

// ============================================================================
// READ TOOLS (No Permission Required)
// ============================================================================

export const queryContextAgentTool = {
  name: 'query_context_agent',
  description: 'Search for notes and tasks using the Context Agent. Use this to find information the user is asking about. The agent can search by keywords, dates, tags, companies, contacts, and other metadata.',
  schema: z.object({
    query: z.string().describe('Your search query to the Context Agent. Be specific about what you\'re looking for (e.g., "notes about NVIDIA from Q4 2024" or "high priority tasks due next week")'),
    agent_thread_id: z.string().optional().describe('Optional: Thread ID for continuing a previous conversation with the agent'),
  }),
};

export const getCurrentDatetimeTool = {
  name: 'get_current_datetime',
  description: 'Get the current date and time. Use this when you need to know "today", "this week", "next month", etc.',
  schema: z.object({}),
};

export const getUserContextTool = {
  name: 'get_user_context',
  description: 'Get the current app context (active filters, current view, selected items, etc.)',
  schema: z.object({}),
};

export const recallMemoryTool = {
  name: 'recall_memory',
  description: 'Retrieve relevant memories about user preferences and past interactions. Use this to personalize responses.',
  schema: z.object({
    context: z.string().describe('Context to search memories for (e.g., "task organization preferences" or "NVIDIA project context")'),
  }),
};

export const getItemDetailsTool = {
  name: 'get_item_details',
  description: 'Get complete details for a specific task or note by ID. Use this when the user asks about a specific item.',
  schema: z.object({
    item_type: z.enum(['task', 'note']).describe('Type of item to fetch'),
    item_id: z.string().describe('ID of the task or note'),
  }),
};

// ============================================================================
// SESSION TOOLS
// ============================================================================

export const querySessionsTool = {
  name: 'query_sessions',
  description: 'Search for work sessions using an AI agent. Use this when you need to find sessions based on what the user was doing.',
  schema: z.object({
    query: z.string().describe('Your search query about sessions (e.g., "sessions where I worked on authentication")'),
    agent_thread_id: z.string().optional().describe('Optional: Thread ID for continuing a conversation'),
  }),
};

export const getSessionDetailsTool = {
  name: 'get_session_details',
  description: 'Get complete details for a specific session by ID.',
  schema: z.object({
    session_id: z.string().describe('ID of the session'),
  }),
};

export const getSessionSummaryTool = {
  name: 'get_session_summary',
  description: 'Get AI-generated summary of a session including activities, screenshots, and insights.',
  schema: z.object({
    session_id: z.string().describe('ID of the session'),
  }),
};

export const getActiveSessionTool = {
  name: 'get_active_session',
  description: 'Get the currently active work session if one is running.',
  schema: z.object({}),
};

export const getScreenshotImageTool = {
  name: 'get_screenshot_image',
  description: 'Get a specific screenshot image from a session as base64.',
  schema: z.object({
    session_id: z.string().describe('ID of the session'),
    screenshot_id: z.string().describe('ID of the screenshot'),
  }),
};

// ============================================================================
// WRITE TOOLS (Requires Permission)
// ============================================================================

export const createTaskTool = {
  name: 'create_task',
  description: 'Create a new task.',
  schema: z.object({
    title: z.string().describe('Task title'),
    description: z.string().optional().describe('Task description'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority'),
    dueDate: z.string().optional().describe('Due date (ISO format)'),
    tags: z.array(z.string()).optional().describe('Task tags'),
    companyIds: z.array(z.string()).optional().describe('Related company IDs'),
    contactIds: z.array(z.string()).optional().describe('Related contact IDs'),
  }),
};

export const updateTaskTool = {
  name: 'update_task',
  description: 'Update an existing task.',
  schema: z.object({
    task_id: z.string().describe('ID of the task to update'),
    title: z.string().optional().describe('New task title'),
    description: z.string().optional().describe('New task description'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority'),
    dueDate: z.string().optional().describe('New due date (ISO format)'),
    tags: z.array(z.string()).optional().describe('New tags'),
  }),
};

export const completeTaskTool = {
  name: 'complete_task',
  description: 'Mark a task as complete.',
  schema: z.object({
    task_id: z.string().describe('ID of the task to complete'),
  }),
};

export const deleteTaskTool = {
  name: 'delete_task',
  description: 'Delete a task.',
  schema: z.object({
    task_id: z.string().describe('ID of the task to delete'),
  }),
};

export const createNoteTool = {
  name: 'create_note',
  description: 'Create a new note.',
  schema: z.object({
    summary: z.string().describe('Brief summary of the note'),
    content: z.string().describe('Full note content'),
    source: z.string().optional().describe('Source type (e.g., "meeting", "research")'),
    tags: z.array(z.string()).optional().describe('Note tags'),
    companyIds: z.array(z.string()).optional().describe('Related company IDs'),
    contactIds: z.array(z.string()).optional().describe('Related contact IDs'),
  }),
};

export const updateNoteTool = {
  name: 'update_note',
  description: 'Update an existing note.',
  schema: z.object({
    note_id: z.string().describe('ID of the note to update'),
    summary: z.string().optional().describe('New summary'),
    content: z.string().optional().describe('New content'),
    tags: z.array(z.string()).optional().describe('New tags'),
  }),
};

export const deleteNoteTool = {
  name: 'delete_note',
  description: 'Delete a note.',
  schema: z.object({
    note_id: z.string().describe('ID of the note to delete'),
  }),
};

export const recordMemoryTool = {
  name: 'record_memory',
  description: 'Record a memory about user preferences or context for future reference.',
  schema: z.object({
    type: z.enum(['preference', 'outcome', 'context_note']).describe('Type of memory'),
    content: z.string().describe('Memory content'),
    keywords: z.array(z.string()).describe('Keywords for retrieval'),
  }),
};

// ============================================================================
// TOOL COLLECTIONS
// ============================================================================

export const READ_TOOL_NAMES = [
  'query_context_agent',
  'get_current_datetime',
  'get_user_context',
  'recall_memory',
  'get_item_details',
  'query_sessions',
  'get_session_details',
  'get_session_summary',
  'get_active_session',
  'get_screenshot_image',
];

export const WRITE_TOOL_NAMES = [
  'create_task',
  'update_task',
  'complete_task',
  'delete_task',
  'create_note',
  'update_note',
  'delete_note',
  'record_memory',
];

/**
 * Get all Ned tools as Zod-based tool definitions
 */
export function getAllNedTools() {
  return {
    query_context_agent: queryContextAgentTool,
    get_current_datetime: getCurrentDatetimeTool,
    get_user_context: getUserContextTool,
    recall_memory: recallMemoryTool,
    get_item_details: getItemDetailsTool,
    query_sessions: querySessionsTool,
    get_session_details: getSessionDetailsTool,
    get_session_summary: getSessionSummaryTool,
    get_active_session: getActiveSessionTool,
    get_screenshot_image: getScreenshotImageTool,
    create_task: createTaskTool,
    update_task: updateTaskTool,
    complete_task: completeTaskTool,
    delete_task: deleteTaskTool,
    create_note: createNoteTool,
    update_note: updateNoteTool,
    delete_note: deleteNoteTool,
    record_memory: recordMemoryTool,
  };
}

/**
 * Get only read tools (no permission required)
 */
export function getReadOnlyTools() {
  return {
    query_context_agent: queryContextAgentTool,
    get_current_datetime: getCurrentDatetimeTool,
    get_user_context: getUserContextTool,
    recall_memory: recallMemoryTool,
    get_item_details: getItemDetailsTool,
    query_sessions: querySessionsTool,
    get_session_details: getSessionDetailsTool,
    get_session_summary: getSessionSummaryTool,
    get_active_session: getActiveSessionTool,
    get_screenshot_image: getScreenshotImageTool,
  };
}

/**
 * Check if a tool requires permission
 */
export function toolRequiresPermission(toolName: string): boolean {
  return WRITE_TOOL_NAMES.includes(toolName);
}

