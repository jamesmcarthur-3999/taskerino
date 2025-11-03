import type { Task, Note, Topic } from '../types';
import { EntityType } from '../types/relationships';

/**
 * Get all tasks linked to a specific note
 */
export function getTasksByNoteId(noteId: string, tasks: Task[]): Task[] {
  return tasks.filter(task =>
    task.relationships.some(rel =>
      rel.targetType === EntityType.NOTE && rel.targetId === noteId
    )
  );
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
  if (!task) return undefined;

  const noteRel = task.relationships.find(rel => rel.targetType === EntityType.NOTE);
  if (!noteRel) return undefined;

  return notes.find(n => n.id === noteRel.targetId);
}

/**
 * Get other tasks that came from the same note (related tasks)
 */
export function getRelatedTasks(taskId: string, tasks: Task[]): Task[] {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return [];

  const noteRel = task.relationships.find(rel => rel.targetType === EntityType.NOTE);
  if (!noteRel) return [];

  // Find other tasks from the same note
  return tasks.filter(t =>
    t.id !== taskId &&
    t.relationships.some(rel =>
      rel.targetType === EntityType.NOTE && rel.targetId === noteRel.targetId
    )
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
  if (!task) return undefined;

  const topicRel = task.relationships.find(rel => rel.targetType === EntityType.TOPIC);
  if (!topicRel) return undefined;

  return topics.find(t => t.id === topicRel.targetId);
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
  if (!note) return undefined;

  const topicRel = note.relationships.find(rel => rel.targetType === EntityType.TOPIC);
  if (!topicRel) return undefined;

  return topics.find(t => t.id === topicRel.targetId);
}

/**
 * Get all notes in a topic
 */
export function getNotesByTopicId(topicId: string, notes: Note[]): Note[] {
  return notes.filter(note =>
    note.relationships.some(rel =>
      rel.targetType === EntityType.TOPIC && rel.targetId === topicId
    )
  );
}

/**
 * Get all tasks in a topic
 */
export function getTasksByTopicId(topicId: string, tasks: Task[]): Task[] {
  return tasks.filter(task =>
    task.relationships.some(rel =>
      rel.targetType === EntityType.TOPIC && rel.targetId === topicId
    )
  );
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
  const noteRel = task.relationships.find(rel => rel.targetType === EntityType.NOTE);
  if (noteRel) {
    const linkedNote = notes.find(n => n.id === noteRel.targetId);
    if (linkedNote) relatedNotes.push(linkedNote);
  }

  // Add other notes from the same topic
  const topicRel = task.relationships.find(rel => rel.targetType === EntityType.TOPIC);
  if (topicRel) {
    const topicNotes = notes.filter(n =>
      n.relationships.some(rel =>
        rel.targetType === EntityType.TOPIC && rel.targetId === topicRel.targetId
      ) && n.id !== noteRel?.targetId
    );
    relatedNotes.push(...topicNotes);
  }

  return relatedNotes;
}
