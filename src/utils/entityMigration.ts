/**
 * Entity Migration Utilities
 *
 * Ensures all entities loaded from storage have required fields
 * (backward compatibility with data before relationships migration)
 */

import type { Note, Task, Session } from '../types';

/**
 * Normalize a note to ensure it has relationships array
 */
export function normalizeNote(note: any): Note {
  return {
    ...note,
    relationships: note.relationships || [],
  };
}

/**
 * Normalize a task to ensure it has relationships array
 */
export function normalizeTask(task: any): Task {
  return {
    ...task,
    relationships: task.relationships || [],
  };
}

/**
 * Normalize a session to ensure it has relationships array
 */
export function normalizeSession(session: any): Session {
  return {
    ...session,
    relationships: session.relationships || [],
  };
}

/**
 * Normalize an array of entities
 */
export function normalizeNotes(notes: any[]): Note[] {
  return notes.map(normalizeNote);
}

export function normalizeTasks(tasks: any[]): Task[] {
  return tasks.map(normalizeTask);
}

export function normalizeSessions(sessions: any[]): Session[] {
  return sessions.map(normalizeSession);
}
