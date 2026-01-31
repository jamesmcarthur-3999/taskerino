// src/bots/tools/query-tools.ts
import { tool } from '@baleybots/core';
import { z } from 'zod';
import { searchContext, createSearchThread } from '../context-searcher';
import { searchSessions, createSessionSearchThread } from '../session-searcher';
import type { Note, Task, Topic, Company, Contact, Session } from '../../types';

// These will be injected at runtime
let appState: {
  notes: Note[];
  tasks: Task[];
  topics: Topic[];
  companies: Company[];
  contacts: Contact[];
  sessions: Session[];
} | null = null;

export function setQueryToolsState(state: typeof appState) {
  appState = state;
}

export const queryContextTool = tool(
  'query_context',
  'Search notes and tasks using natural language. Use for finding information, filtering by date, priority, or topic.',
  z.object({
    query: z.string().describe('Natural language search query'),
    threadId: z.string().optional().describe('Thread ID for multi-turn search'),
  }),
  async ({ query, threadId }) => {
    if (!appState) throw new Error('App state not initialized');

    const result = await searchContext(
      query,
      appState.notes,
      appState.tasks,
      appState.topics,
      appState.companies,
      appState.contacts,
      threadId || createSearchThread()
    );

    // Return full items, not just IDs, for Ned to reference
    return {
      summary: result.summary,
      notes: appState.notes.filter(n => result.noteIds.includes(n.id)),
      tasks: appState.tasks.filter(t => result.taskIds.includes(t.id)),
      suggestions: result.suggestions,
      threadId: result.threadId,
    };
  }
);

export const querySessionsTool = tool(
  'query_sessions',
  'Search work sessions by activity, date, or content. Use for finding past work sessions.',
  z.object({
    query: z.string().describe('Natural language search query'),
    threadId: z.string().optional(),
  }),
  async ({ query, threadId }) => {
    if (!appState) throw new Error('App state not initialized');

    const result = await searchSessions(
      query,
      appState.sessions,
      threadId || createSessionSearchThread()
    );

    return {
      summary: result.summary,
      sessions: appState.sessions.filter(s => result.sessionIds.includes(s.id)),
      suggestions: result.suggestions,
      threadId: result.threadId,
    };
  }
);

export const getCurrentDatetimeTool = tool(
  'get_current_datetime',
  'Get the current date and time. Use when user asks about today, schedules, or due dates.',
  z.object({}),
  async () => {
    const now = new Date();
    return {
      datetime: now.toISOString(),
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
      formatted: now.toLocaleString(),
    };
  }
);

export const getItemDetailsTool = tool(
  'get_item_details',
  'Get full details for a specific task or note by ID.',
  z.object({
    itemType: z.enum(['task', 'note']),
    itemId: z.string(),
  }),
  async ({ itemType, itemId }) => {
    if (!appState) throw new Error('App state not initialized');

    if (itemType === 'task') {
      const task = appState.tasks.find(t => t.id === itemId);
      if (!task) return { error: `Task ${itemId} not found` };
      return { task };
    } else {
      const note = appState.notes.find(n => n.id === itemId);
      if (!note) return { error: `Note ${itemId} not found` };
      return { note };
    }
  }
);

export const queryTools = {
  query_context: queryContextTool,
  query_sessions: querySessionsTool,
  get_current_datetime: getCurrentDatetimeTool,
  get_item_details: getItemDetailsTool,
};
