/**
 * Ned Service Types
 *
 * Shared types for Ned chat functionality.
 * Extracted from nedService.ts after migration to baleybots.
 */

import type { Task, Note, Session } from '../types';
import type { ToolCall, ToolResult } from './nedTools';

export interface ConversationContext {
  lastSearch: {
    query: string;
    results: {
      tasks: Task[];
      notes: Note[];
    };
    timestamp: string;
    thread_id: string;
    total_found: {
      tasks: number;
      notes: number;
    };
  } | null;

  referencedItems: {
    tasks: Set<string>; // IDs of tasks mentioned/shown
    notes: Set<string>; // IDs of notes mentioned/shown
    topics: Set<string>; // Topic IDs mentioned
  };
}

export interface NedConversation {
  id: string;
  messages: NedMessage[];
  agentThreadId?: string;
  context: ConversationContext;
  createdAt: string;
  lastActive: string;
}

export interface NedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: NedMessageContent[];
  timestamp: string;
}

export type NedMessageContent =
  | { type: 'text'; text: string }
  | { type: 'task-list'; tasks: Task[] }
  | { type: 'note-list'; notes: Note[] }
  | { type: 'session-list'; sessions: Session[] }
  | { type: 'task-update'; taskId: string; taskTitle: string; changes: FieldChange[]; timestamp: string }
  | { type: 'note-update'; noteId: string; noteSummary: string; changes: FieldChange[]; timestamp: string }
  | { type: 'task-created'; task: Task }
  | { type: 'note-created'; note: Note }
  | { type: 'tool-use'; tool: string; status: 'pending' | 'complete'; result?: any }
  | { type: 'thinking'; message: string }
  // API content blocks that must be preserved for conversation history
  | { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
}

// Tool execution callback types
export type ToolExecutor = (tool: ToolCall) => Promise<ToolResult>;
export type PermissionChecker = (toolName: string) => Promise<boolean>;

