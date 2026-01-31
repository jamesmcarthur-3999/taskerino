// src/bots/tools/mutation-tools.ts
import { tool } from '@baleybots/core';
import { z } from 'zod';
import type { Task, Note } from '../../types';

// Dispatch function injected at runtime
let dispatch: ((action: { type: string; payload?: unknown }) => void) | null = null;

export function setMutationToolsDispatch(fn: typeof dispatch) {
  dispatch = fn;
}

export const createTaskTool = tool(
  'create_task',
  'Create a new task. Use when user wants to add a todo or action item.',
  z.object({
    title: z.string().describe('Task title'),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    dueDate: z.string().optional().describe('YYYY-MM-DD format'),
    dueTime: z.string().optional().describe('HH:MM format'),
    tags: z.array(z.string()).optional(),
  }),
  async (params) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    const task: Partial<Task> = {
      id: `task-${Date.now()}`,
      title: params.title,
      description: params.description,
      priority: params.priority,
      dueDate: params.dueDate,
      dueTime: params.dueTime,
      tags: params.tags,
      done: false,
      createdAt: new Date().toISOString(),
      createdBy: 'ned',
    };

    dispatch({ type: 'ADD_TASK', payload: task });

    return {
      success: true,
      task,
      message: `Created task: "${params.title}"`,
    };
  }
);

export const updateTaskTool = tool(
  'update_task',
  'Update an existing task. Use when user wants to modify a task.',
  z.object({
    taskId: z.string(),
    updates: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      dueDate: z.string().optional(),
      dueTime: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),
  async ({ taskId, updates }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, ...updates } });

    return {
      success: true,
      taskId,
      updates,
      message: `Updated task ${taskId}`,
    };
  }
);

export const completeTaskTool = tool(
  'complete_task',
  'Mark a task as complete. Use when user says they finished something.',
  z.object({
    taskId: z.string(),
  }),
  async ({ taskId }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'COMPLETE_TASK', payload: taskId });

    return {
      success: true,
      taskId,
      message: `Marked task ${taskId} as complete`,
    };
  }
);

export const deleteTaskTool = tool(
  'delete_task',
  'Delete a task. Use when user wants to remove a task.',
  z.object({
    taskId: z.string(),
  }),
  async ({ taskId }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'DELETE_TASK', payload: taskId });

    return {
      success: true,
      taskId,
      message: `Deleted task ${taskId}`,
    };
  }
);

export const createNoteTool = tool(
  'create_note',
  'Create a new note. Use when user wants to save information.',
  z.object({
    content: z.string().describe('Markdown content'),
    topicId: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  async (params) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    const note: Partial<Note> = {
      id: `note-${Date.now()}`,
      content: params.content,
      topicIds: params.topicId ? [params.topicId] : [],
      tags: params.tags,
      timestamp: new Date().toISOString(),
      source: 'thought',
    };

    dispatch({ type: 'ADD_NOTE', payload: note });

    return {
      success: true,
      note,
      message: 'Created new note',
    };
  }
);

export const updateNoteTool = tool(
  'update_note',
  'Update an existing note.',
  z.object({
    noteId: z.string(),
    content: z.string().describe('New markdown content'),
  }),
  async ({ noteId, content }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'UPDATE_NOTE', payload: { id: noteId, content } });

    return {
      success: true,
      noteId,
      message: `Updated note ${noteId}`,
    };
  }
);

export const deleteNoteTool = tool(
  'delete_note',
  'Delete a note.',
  z.object({
    noteId: z.string(),
  }),
  async ({ noteId }) => {
    if (!dispatch) throw new Error('Dispatch not initialized');

    dispatch({ type: 'DELETE_NOTE', payload: noteId });

    return {
      success: true,
      noteId,
      message: `Deleted note ${noteId}`,
    };
  }
);

export const mutationTools = {
  create_task: createTaskTool,
  update_task: updateTaskTool,
  complete_task: completeTaskTool,
  delete_task: deleteTaskTool,
  create_note: createNoteTool,
  update_note: updateNoteTool,
  delete_note: deleteNoteTool,
};
