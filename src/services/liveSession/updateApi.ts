/**
 * Live Session Update API
 *
 * Functions for external AI to update session summaries and create
 * tasks/notes from suggestions.
 *
 * Usage:
 * ```typescript
 * import { updateLiveSessionSummary, createTaskFromSuggestion } from './updateApi';
 *
 * // Update summary
 * await updateLiveSessionSummary(sessionId, {
 *   currentFocus: "Writing customer email",
 *   progressToday: ["Fixed auth bug"],
 *   momentum: "high"
 * });
 *
 * // Create task from AI suggestion
 * await createTaskFromSuggestion({
 *   title: "Fix authentication timeout",
 *   description: "...",
 *   priority: "high"
 * });
 * ```
 */

import { getChunkedStorage } from '../storage/ChunkedSessionStorage';
import { LiveSessionEventEmitter } from './events';
import type { TaskSuggestion, NoteSuggestion } from './toolExecutor';
import type { Task, Note } from '../../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Live snapshot update (subset of SessionSummary.liveSnapshot)
 */
export interface LiveSnapshotUpdate {
  currentFocus?: string;
  progressToday?: string[];
  momentum?: 'high' | 'medium' | 'low';
}

/**
 * Summary update (broader than liveSnapshot)
 */
export interface SummaryUpdate extends LiveSnapshotUpdate {
  achievements?: string[];
  blockers?: string[];
  suggestedTasks?: TaskSuggestion[];
  suggestedNotes?: NoteSuggestion[];
}

// ============================================================================
// Summary Update API
// ============================================================================

/**
 * Update live session summary
 *
 * Updates the session's live summary (summary.liveSnapshot) with new data from AI.
 * Uses PersistenceQueue for zero-blocking writes.
 *
 * @param sessionId - Session ID to update
 * @param updates - Summary updates
 * @param updatedBy - Who updated (default: 'ai')
 *
 * @example
 * ```typescript
 * await updateLiveSessionSummary(sessionId, {
 *   currentFocus: "Writing customer email about API integration",
 *   progressToday: ["Fixed authentication bug", "Deployed to staging"],
 *   momentum: "high",
 *   blockers: ["Waiting on API key from customer"]
 * });
 * ```
 */
export async function updateLiveSessionSummary(
  sessionId: string,
  updates: SummaryUpdate,
  updatedBy: 'ai' | 'user' = 'ai'
): Promise<void> {
  const storage = await getChunkedStorage();

  // Load current session
  const session = await storage.loadFullSession(sessionId);

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Initialize summary if doesn't exist
  if (!session.summary) {
    session.summary = {
      narrative: '',
      achievements: [],
      blockers: [],
      recommendedTasks: [],
      keyInsights: [],
      focusAreas: [],
      lastUpdated: new Date().toISOString(),
      screenshotCount: session.screenshots?.length || 0
    };
  }

  // Initialize liveSnapshot if doesn't exist
  if (!session.summary.liveSnapshot) {
    session.summary.liveSnapshot = {
      currentFocus: '',
      progressToday: [],
      momentum: 'medium'
    };
  }

  // Apply updates to liveSnapshot
  if (updates.currentFocus !== undefined) {
    session.summary.liveSnapshot.currentFocus = updates.currentFocus;
  }
  if (updates.progressToday !== undefined) {
    session.summary.liveSnapshot.progressToday = updates.progressToday;
  }
  if (updates.momentum !== undefined) {
    session.summary.liveSnapshot.momentum = updates.momentum;
  }

  // Apply updates to main summary
  if (updates.achievements !== undefined) {
    session.summary.achievements = updates.achievements;
  }
  if (updates.blockers !== undefined) {
    session.summary.blockers = updates.blockers;
  }
  if (updates.suggestedTasks !== undefined) {
    session.summary.recommendedTasks = updates.suggestedTasks.map(task => ({
      title: task.title,
      priority: task.priority || 'medium',
      context: task.context || '',
      relatedScreenshotIds: []
    }));
  }

  // Update timestamp
  session.summary.lastUpdated = new Date().toISOString();

  // Save summary (via PersistenceQueue - zero blocking)
  await storage.saveSummary(sessionId, session.summary);

  // Emit event for UI updates
  LiveSessionEventEmitter.emitSummaryUpdated(sessionId, session.summary, updatedBy);

  console.log(`[LiveSession] Summary updated for session ${sessionId} by ${updatedBy}`);
}

/**
 * Append to progress indicators
 *
 * Adds achievements, blockers, or insights without replacing existing ones.
 * Useful for incremental updates.
 *
 * @param sessionId - Session ID
 * @param type - Type of progress indicator
 * @param items - Items to add
 *
 * @example
 * ```typescript
 * await appendProgressIndicators(sessionId, 'achievements', [
 *   "Completed login flow",
 *   "Fixed API timeout bug"
 * ]);
 * ```
 */
export async function appendProgressIndicators(
  sessionId: string,
  type: 'achievements' | 'blockers' | 'insights',
  items: string[]
): Promise<void> {
  const storage = await getChunkedStorage();
  const session = await storage.loadFullSession(sessionId);

  if (!session || !session.summary) {
    throw new Error(`Session or summary not found: ${sessionId}`);
  }

  // Get existing array
  const existingArray = type === 'insights'
    ? (session.summary.keyInsights || [])
    : (session.summary[type] || []);

  // Add new items (deduplication)
  const existing = new Set(existingArray);
  const newItems = items.filter(item => !existing.has(item));

  // Update the appropriate field
  if (type === 'achievements') {
    session.summary.achievements = [...existingArray, ...newItems];
  } else if (type === 'blockers') {
    session.summary.blockers = [...existingArray, ...newItems];
  } else if (type === 'insights') {
    session.summary.keyInsights = [...existingArray, ...newItems];
  }

  // Update timestamp
  session.summary.lastUpdated = new Date().toISOString();

  // Save
  await storage.saveSummary(sessionId, session.summary);

  console.log(`[LiveSession] Appended ${items.length} ${type} to session ${sessionId}`);
}

// ============================================================================
// Suggestion Creation API
// ============================================================================

/**
 * Create task from AI suggestion
 *
 * Converts an AI-generated task suggestion into an actual task in the system.
 * Automatically links to the session.
 *
 * @param suggestion - Task suggestion from AI
 * @param sessionId - Session ID (optional, uses suggestion.sessionId if available)
 * @returns Created task
 *
 * @example
 * ```typescript
 * const task = await createTaskFromSuggestion({
 *   title: "Fix authentication timeout",
 *   description: "User reported 30s timeout during login",
 *   priority: "high",
 *   tags: ["backend", "urgent"],
 *   topicId: "topic-auth-123",
 *   context: "Detected blocker in screenshot at 14:32"
 * });
 * ```
 */
export async function createTaskFromSuggestion(
  suggestion: TaskSuggestion,
  sessionId?: string
): Promise<Task> {
  // Lazy import to avoid circular dependencies
  const { EntityService } = await import('../EntityService');
  const entityService = new EntityService();

  const taskInput = {
    title: suggestion.title,
    description: suggestion.description || suggestion.context || '',
    priority: suggestion.priority || 'medium',
    status: 'todo',
    completed: false,
    dueDate: suggestion.dueDate,
    dueTime: suggestion.dueTime,
    tags: suggestion.tags || [],
    topicId: suggestion.topicId,
    noteId: suggestion.noteId,
    sourceSessionId: sessionId
  };

  const task = await entityService.createTask(taskInput);

  console.log(`[LiveSession] Created task from suggestion: ${task.title} (${task.id})`);

  return task;
}

/**
 * Create note from AI suggestion
 *
 * Converts an AI-generated note suggestion into an actual note in the system.
 * Automatically links to the session.
 *
 * @param suggestion - Note suggestion from AI
 * @param sessionId - Session ID (optional)
 * @returns Created note
 *
 * @example
 * ```typescript
 * const note = await createNoteFromSuggestion({
 *   content: "## Meeting Notes\n\nDiscussed API integration strategy...",
 *   topicId: "topic-api-123",
 *   tags: ["meeting", "planning"],
 *   context: "Detected from conversation in audio"
 * });
 * ```
 */
export async function createNoteFromSuggestion(
  suggestion: NoteSuggestion,
  sessionId?: string
): Promise<Note> {
  // Lazy import to avoid circular dependencies
  const { EntityService } = await import('../EntityService');
  const entityService = new EntityService();

  const noteInput = {
    content: suggestion.content,
    topicId: suggestion.topicId,
    tags: suggestion.tags || [],
    companyIds: suggestion.companyIds || [],
    contactIds: suggestion.contactIds || [],
    sourceSessionId: sessionId
  };

  const note = await entityService.createNote(noteInput);

  console.log(`[LiveSession] Created note from suggestion: ${note.id}`);

  return note;
}

/**
 * Batch create tasks from suggestions
 *
 * Creates multiple tasks at once. More efficient than individual calls.
 *
 * @param suggestions - Array of task suggestions
 * @param sessionId - Session ID
 * @returns Created tasks
 *
 * @example
 * ```typescript
 * const tasks = await batchCreateTasksFromSuggestions([
 *   { title: "Fix bug 1", priority: "high" },
 *   { title: "Fix bug 2", priority: "medium" }
 * ], sessionId);
 * ```
 */
export async function batchCreateTasksFromSuggestions(
  suggestions: TaskSuggestion[],
  sessionId?: string
): Promise<Task[]> {
  const tasks: Task[] = [];

  for (const suggestion of suggestions) {
    try {
      const task = await createTaskFromSuggestion(suggestion, sessionId);
      tasks.push(task);
    } catch (error) {
      console.error(`[LiveSession] Failed to create task from suggestion:`, error);
      // Continue with next suggestion
    }
  }

  console.log(`[LiveSession] Created ${tasks.length}/${suggestions.length} tasks from suggestions`);

  return tasks;
}

/**
 * Batch create notes from suggestions
 *
 * Creates multiple notes at once. More efficient than individual calls.
 *
 * @param suggestions - Array of note suggestions
 * @param sessionId - Session ID
 * @returns Created notes
 */
export async function batchCreateNotesFromSuggestions(
  suggestions: NoteSuggestion[],
  sessionId?: string
): Promise<Note[]> {
  const notes: Note[] = [];

  for (const suggestion of suggestions) {
    try {
      const note = await createNoteFromSuggestion(suggestion, sessionId);
      notes.push(note);
    } catch (error) {
      console.error(`[LiveSession] Failed to create note from suggestion:`, error);
      // Continue with next suggestion
    }
  }

  console.log(`[LiveSession] Created ${notes.length}/${suggestions.length} notes from suggestions`);

  return notes;
}
