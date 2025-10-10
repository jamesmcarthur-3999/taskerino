import type { Topic, Note, Task } from '../types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Topic helpers
export function createTopic(
  name: string
): Topic {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name,
    createdAt: now,
    lastUpdated: now,
    noteCount: 0,
  };
}

// Note helpers
export function createNote(
  topicId: string,
  content: string,
  summary: string,
  options?: Partial<Omit<Note, 'id' | 'topicId' | 'content' | 'summary'>>
): Note {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    topicId,
    content,
    summary,
    sourceText: options?.sourceText, // Original input text for validation
    timestamp: options?.timestamp || now,
    lastUpdated: options?.lastUpdated || now,
    source: options?.source || 'thought',
    tags: options?.tags || [],
    parentNoteId: options?.parentNoteId,
    updates: options?.updates || [],
    metadata: options?.metadata,
  };
}

// Task helpers
export function createTask(
  title: string,
  options?: Partial<Omit<Task, 'id' | 'title' | 'createdAt' | 'createdBy'>>
): Task {
  const now = new Date().toISOString();

  // Determine default status based on done flag or explicit status
  const status = options?.status || (options?.done ? 'done' : 'todo');

  // Determine creation source
  const createdBy = options?.noteId ? 'ai' : 'manual';

  return {
    id: generateId(),
    title,
    done: options?.done || false,
    priority: options?.priority || 'medium',
    topicId: options?.topicId,
    noteId: options?.noteId,
    dueDate: options?.dueDate,
    createdAt: now,
    completedAt: options?.completedAt,

    // Phase 1 fields
    description: options?.description,
    status,
    subtasks: options?.subtasks || [],
    tags: options?.tags || [],
    createdBy,
    aiContext: options?.aiContext,
  };
}

// Topic matching helpers
export function findMatchingTopic(
  name: string,
  existingTopics: Topic[]
): Topic | undefined {
  const nameLower = name.toLowerCase().trim();

  // Exact match
  const exactMatch = existingTopics.find(
    t => t.name.toLowerCase() === nameLower
  );
  if (exactMatch) return exactMatch;

  // Fuzzy match (contains or is contained)
  return existingTopics.find(t => {
    const topicNameLower = t.name.toLowerCase();
    return (
      topicNameLower.includes(nameLower) ||
      nameLower.includes(topicNameLower)
    );
  });
}

export function calculateMatchConfidence(
  detectedName: string,
  topic: Topic
): number {
  const detectedLower = detectedName.toLowerCase().trim();
  const topicLower = topic.name.toLowerCase().trim();

  // Exact match
  if (detectedLower === topicLower) return 1.0;

  // One contains the other
  if (topicLower.includes(detectedLower) || detectedLower.includes(topicLower)) {
    const shorter = Math.min(detectedLower.length, topicLower.length);
    const longer = Math.max(detectedLower.length, topicLower.length);
    return shorter / longer; // 0.5 to 1.0 range
  }

  // Word overlap
  const detectedWords = new Set(detectedLower.split(/\s+/));
  const topicWords = new Set(topicLower.split(/\s+/));
  const intersection = new Set(
    [...detectedWords].filter(w => topicWords.has(w))
  );
  const union = new Set([...detectedWords, ...topicWords]);

  return intersection.size / union.size; // Jaccard similarity
}

// Note similarity helpers
export function findSimilarNotes(
  content: string,
  topicId: string,
  existingNotes: Note[],
  dayThreshold = 7
): Note[] {
  const now = Date.now();
  const threshold = dayThreshold * 24 * 60 * 60 * 1000; // Convert days to ms

  const topicNotes = existingNotes.filter(
    note =>
      note.topicId === topicId &&
      now - new Date(note.timestamp).getTime() < threshold
  );

  // Simple keyword matching (could be enhanced with embeddings)
  const contentWords = new Set(
    content
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3)
  );

  return topicNotes
    .map(note => {
      const noteWords = new Set(
        note.content
          .toLowerCase()
          .split(/\W+/)
          .filter(w => w.length > 3)
      );

      const intersection = new Set(
        [...contentWords].filter(w => noteWords.has(w))
      );
      const similarity = intersection.size / Math.max(contentWords.size, noteWords.size);

      return { note, similarity };
    })
    .filter(({ similarity }) => similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .map(({ note }) => note);
}

// Sorting and filtering
export function sortTopics(
  topics: Topic[],
  sortBy: 'name' | 'recent' | 'noteCount' = 'recent'
): Topic[] {
  return [...topics].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'noteCount':
        return b.noteCount - a.noteCount;
      case 'recent':
      default:
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    }
  });
}

export function sortNotes(
  notes: Note[],
  sortBy: 'recent' | 'oldest' = 'recent'
): Note[] {
  return [...notes].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return sortBy === 'recent' ? timeB - timeA : timeA - timeB;
  });
}

export function filterNotesByTopic(notes: Note[], topicId: string): Note[] {
  return notes.filter(note => note.topicId === topicId);
}

export function filterTasksByTopic(tasks: Task[], topicId: string): Task[] {
  return tasks.filter(task => task.topicId === topicId);
}

// Formatting helpers
export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 4) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;

  return new Date(timestamp).toLocaleDateString();
}

export function truncateText(text: string, maxLength: number): string {
  // Strip HTML tags and markdown for clean preview
  let cleaned = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/#{1,6}\s+/g, '') // Remove markdown headers
    .replace(/\*\*/g, '') // Remove bold markers
    .replace(/\*/g, '') // Remove italic markers
    .replace(/^\s*[-*]\s+/gm, '') // Remove bullet points
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength).trim() + '...';
}

// Extract hashtags from text
export function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[\w-]+/g;
  const matches = text.match(hashtagRegex);
  if (!matches) return [];

  // Remove # and convert to lowercase, remove duplicates
  return [...new Set(matches.map(tag => tag.slice(1).toLowerCase()))];
}

// Combine and deduplicate tags
export function combineTags(...tagArrays: (string[] | undefined)[]): string[] {
  const allTags = tagArrays
    .filter(arr => arr !== undefined)
    .flat()
    .map(tag => tag.toLowerCase().replace(/^#/, ''));

  return [...new Set(allTags)];
}

// Get time-based greeting
export function getTimeBasedGreeting(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();

  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// Generate a succinct title from summary (first 5-6 words or up to 50 chars)
export function generateNoteTitle(summary: string): string {
  // Remove common prefixes
  let text = summary
    .replace(/^(Note about|Summary of|Call with|Meeting with|Discussion about)\s+/i, '')
    .trim();

  // Take first 6 words or 50 characters, whichever is shorter
  const words = text.split(/\s+/);
  if (words.length <= 6) return text;

  let title = words.slice(0, 6).join(' ');
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  } else {
    title += '...';
  }

  return title;
}

// Task filtering and sorting helpers
export function filterTasksByStatus(
  tasks: Task[],
  status: Task['status']
): Task[] {
  return tasks.filter(task => task.status === status);
}

export function filterTasksByPriority(
  tasks: Task[],
  priority: Task['priority']
): Task[] {
  return tasks.filter(task => task.priority === priority);
}

export function filterTasksByTags(
  tasks: Task[],
  tags: string[]
): Task[] {
  if (tags.length === 0) return tasks;
  return tasks.filter(task =>
    tags.every(tag =>
      task.tags?.some(t => t.toLowerCase() === tag.toLowerCase())
    )
  );
}

export function sortTasks(
  tasks: Task[],
  sortBy: 'dueDate' | 'priority' | 'created' | 'title' = 'dueDate'
): Task[] {
  return [...tasks].sort((a, b) => {
    switch (sortBy) {
      case 'dueDate':
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

      case 'priority':
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];

      case 'created':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

      case 'title':
        return a.title.localeCompare(b.title);

      default:
        return 0;
    }
  });
}

export function getTaskProgress(task: Task): number {
  if (!task.subtasks || task.subtasks.length === 0) {
    return task.done ? 100 : 0;
  }

  const completed = task.subtasks.filter(st => st.done).length;
  return Math.round((completed / task.subtasks.length) * 100);
}

export function isTaskOverdue(task: Task): boolean {
  if (!task.dueDate || task.done) return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

export function isTaskDueToday(task: Task): boolean {
  if (!task.dueDate) return false;
  const today = new Date();
  const due = new Date(task.dueDate);
  return (
    today.getFullYear() === due.getFullYear() &&
    today.getMonth() === due.getMonth() &&
    today.getDate() === due.getDate()
  );
}

export function isTaskDueSoon(task: Task, daysThreshold = 7): boolean {
  if (!task.dueDate || task.done) return false;
  const now = Date.now();
  const due = new Date(task.dueDate).getTime();
  const threshold = daysThreshold * 24 * 60 * 60 * 1000;
  return due > now && due - now < threshold;
}

// Format note content - handles both plain text and HTML
export function formatNoteContent(content: string): string {
  // If content already looks like HTML (has tags or entities), return as-is
  if (content.includes('<p>') || content.includes('<div>') || content.includes('<br') || content.includes('&amp;') || content.includes('&lt;') || content.includes('&gt;')) {
    return content;
  }

  // Convert plain text with markdown-style formatting to HTML
  let formatted = content;

  // Escape any existing HTML tags first
  formatted = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers: ### Header -> <h3>Header</h3>
  formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-gray-900 mt-6 mb-3">$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-4">$1</h2>');
  formatted = formatted.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h1>');

  // Bold: **text**
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>');

  // Italic: *text* (but not part of **)
  formatted = formatted.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em class="italic">$1</em>');

  // Lists: bullet points (- or *) and numbered lists (1. 2. 3.)
  const lines = formatted.split('\n');
  const processedLines: string[] = [];
  let inBulletList = false;
  let inNumberedList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBullet = /^[-*]\s+(.+)$/.test(line);
    const isNumbered = /^\d+\.\s+(.+)$/.test(line);

    if (isBullet) {
      if (inNumberedList) {
        processedLines.push('</ol>');
        inNumberedList = false;
      }
      if (!inBulletList) {
        processedLines.push('<ul class="list-disc pl-6 space-y-2 my-4">');
        inBulletList = true;
      }
      const content = line.replace(/^[-*]\s+(.+)$/, '$1');
      processedLines.push(`<li class="text-gray-700 leading-relaxed">${content}</li>`);
    } else if (isNumbered) {
      if (inBulletList) {
        processedLines.push('</ul>');
        inBulletList = false;
      }
      if (!inNumberedList) {
        processedLines.push('<ol class="list-decimal pl-6 space-y-2 my-4">');
        inNumberedList = true;
      }
      const content = line.replace(/^\d+\.\s+(.+)$/, '$1');
      processedLines.push(`<li class="text-gray-700 leading-relaxed">${content}</li>`);
    } else {
      if (inBulletList) {
        processedLines.push('</ul>');
        inBulletList = false;
      }
      if (inNumberedList) {
        processedLines.push('</ol>');
        inNumberedList = false;
      }
      processedLines.push(line);
    }
  }

  if (inBulletList) {
    processedLines.push('</ul>');
  }
  if (inNumberedList) {
    processedLines.push('</ol>');
  }

  formatted = processedLines.join('\n');

  // Paragraphs: double line break = new paragraph
  formatted = formatted
    .split('\n\n')
    .map(para => {
      // Don't wrap if it's already a block element
      if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol') || para.trim() === '') {
        return para;
      }
      return `<p class="text-gray-700 leading-relaxed mb-4">${para}</p>`;
    })
    .join('\n');

  // Single line breaks within paragraphs
  formatted = formatted.replace(/\n(?!<)/g, '<br>');

  return formatted;
}

/**
 * Deduplicate tasks by comparing titles and due dates
 * Returns tasks that don't already exist in the provided list
 */
export function deduplicateTasks(newTasks: Task[], existingTasks: Task[]): Task[] {
  return newTasks.filter(newTask => {
    // Check if a similar task already exists
    const isDuplicate = existingTasks.some(existing => {
      // Exact title match
      const titleMatch = existing.title.toLowerCase().trim() === newTask.title.toLowerCase().trim();

      // Same due date (if both have one)
      const dueDateMatch = newTask.dueDate && existing.dueDate
        ? existing.dueDate === newTask.dueDate
        : !newTask.dueDate && !existing.dueDate;

      // Same topic (if both have one)
      const topicMatch = newTask.topicId && existing.topicId
        ? existing.topicId === newTask.topicId
        : true;

      // Same priority
      const priorityMatch = existing.priority === newTask.priority;

      // Consider it a duplicate if title matches AND (due date matches OR priority+topic match)
      return titleMatch && (dueDateMatch || (priorityMatch && topicMatch));
    });

    return !isDuplicate;
  });
}

/**
 * Find similar tasks that might be duplicates
 * Returns existing tasks that are similar to the new task
 */
export function findSimilarTasks(task: Task, existingTasks: Task[], threshold: number = 0.7): Task[] {
  const taskTitleWords = task.title.toLowerCase().split(/\s+/);

  return existingTasks
    .map(existing => {
      const existingWords = existing.title.toLowerCase().split(/\s+/);
      const commonWords = taskTitleWords.filter(word => existingWords.includes(word)).length;
      const similarity = commonWords / Math.max(taskTitleWords.length, existingWords.length);

      return { task: existing, similarity };
    })
    .filter(({ similarity }) => similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .map(({ task }) => task);
}