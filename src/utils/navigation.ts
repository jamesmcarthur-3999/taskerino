import type { Task, Note, Topic } from '../types';

/**
 * Get all tasks linked to a specific note
 */
export function getTasksByNoteId(noteId: string, tasks: Task[]): Task[] {
  return tasks.filter(task => task.noteId === noteId);
}

/**
 * Get the note that created a specific task
 */
export function getNoteByTaskId(
  taskId: string,
  tasks: Task[],
  notes: Note[]
): Note | undefined {
  const task = tasks.find(t => t.id === taskId);
  if (!task?.noteId) return undefined;
  return notes.find(n => n.id === task.noteId);
}

/**
 * Get other tasks that came from the same note (related tasks)
 */
export function getRelatedTasks(taskId: string, tasks: Task[]): Task[] {
  const task = tasks.find(t => t.id === taskId);
  if (!task?.noteId) return [];

  // Find other tasks from the same note
  return tasks.filter(t =>
    t.noteId === task.noteId && t.id !== taskId
  );
}

/**
 * Get the topic associated with a task
 */
export function getTopicByTaskId(
  taskId: string,
  tasks: Task[],
  topics: Topic[]
): Topic | undefined {
  const task = tasks.find(t => t.id === taskId);
  if (!task?.topicId) return undefined;
  return topics.find(t => t.id === task.topicId);
}

/**
 * Get the topic associated with a note
 */
export function getTopicByNoteId(
  noteId: string,
  notes: Note[],
  topics: Topic[]
): Topic | undefined {
  const note = notes.find(n => n.id === noteId);
  if (!note?.topicId) return undefined;
  return topics.find(t => t.id === note.topicId);
}

/**
 * Get all notes in a topic
 */
export function getNotesByTopicId(topicId: string, notes: Note[]): Note[] {
  return notes.filter(note => note.topicId === topicId);
}

/**
 * Get all tasks in a topic
 */
export function getTasksByTopicId(topicId: string, tasks: Task[]): Task[] {
  return tasks.filter(task => task.topicId === topicId);
}

/**
 * Get notes related to a task (through topic or direct link)
 */
export function getRelatedNotes(
  taskId: string,
  tasks: Task[],
  notes: Note[]
): Note[] {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return [];

  const relatedNotes: Note[] = [];

  // Add the directly linked note
  if (task.noteId) {
    const linkedNote = notes.find(n => n.id === task.noteId);
    if (linkedNote) relatedNotes.push(linkedNote);
  }

  // Add other notes from the same topic
  if (task.topicId) {
    const topicNotes = notes.filter(n =>
      n.topicId === task.topicId && n.id !== task.noteId
    );
    relatedNotes.push(...topicNotes);
  }

  return relatedNotes;
}
