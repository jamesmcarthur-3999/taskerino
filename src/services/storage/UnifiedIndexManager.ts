/**
 * UnifiedIndexManager - Unified search across sessions, notes, and tasks
 *
 * Extends InvertedIndexManager to provide:
 * - O(log n) search for sessions (existing)
 * - O(log n) search for notes (NEW)
 * - O(log n) search for tasks (NEW)
 * - Relationship-aware queries via RelationshipIndex
 * - Single unified API for all AI tools
 *
 * Target: <100ms search time for 1000+ entities per type
 *
 * @see /docs/UNIFIED_INDEX_MANAGER_DESIGN.md
 */

import type { StorageAdapter } from './StorageAdapter';
import type { SessionMetadata } from './ChunkedSessionStorage';
import type { Note, Task } from '../../types';
import type { Relationship } from '../../types/relationships';
import { InvertedIndexManager, type SearchQuery, type SearchResult } from './InvertedIndexManager';
import { RelationshipIndex } from './relationshipIndex';

// ============================================================================
// Types
// ============================================================================

/**
 * Entity types supported by unified search
 */
export type EntityType = 'sessions' | 'notes' | 'tasks';

/**
 * Metadata entity types (relationship anchors, not directly searchable)
 */
export type MetadataEntityType = 'topic' | 'company' | 'contact';

/**
 * Unified search query with relationship awareness
 */
export interface UnifiedSearchQuery {
  /** Full-text search (searches across all indexed fields) */
  query?: string;

  /** Entity types to search (default: all) */
  entityTypes?: EntityType[];

  /** Relationship-based filtering */
  relatedTo?: {
    entityType: EntityType | MetadataEntityType;
    entityId: string;
    maxHops?: number; // Default: 1 (direct relationships only)
    relationshipType?: string; // Optional: filter by relationship type
  };

  /** Time range filtering */
  timeRange?: {
    start?: string | Date;
    end?: string | Date;
  };

  /** Entity-specific filters (flexible JSON) */
  filters?: {
    // Task filters
    status?: string | string[];
    priority?: string | string[];
    completed?: boolean;

    // Note filters
    sourceType?: string | string[];

    // Session filters
    category?: string;
    subCategory?: string;
    hasAudio?: boolean;
    hasVideo?: boolean;

    // Topic/Company/Contact filters (applied via relationships)
    topicIds?: string[];
    companyIds?: string[];
    contactIds?: string[];

    // Any custom field
    [key: string]: any;
  };

  /** Sorting */
  sortBy?: 'relevance' | 'date' | 'priority' | 'status' | string;
  sortOrder?: 'asc' | 'desc';

  /** Pagination */
  limit?: number;
  offset?: number;

  /** Combine filters with AND or OR (default: AND) */
  operator?: 'AND' | 'OR';
}

/**
 * Individual search result item
 */
export interface SearchResultItem {
  id: string;
  entityType: EntityType;
  score: number; // Relevance score (0-1)
  snippet?: string; // Text snippet with highlights
  metadata: Record<string, any>; // Entity-specific fields
}

/**
 * Unified search result
 */
export interface UnifiedSearchResult {
  /** Results grouped by entity type */
  results: {
    sessions: SearchResultItem[];
    notes: SearchResultItem[];
    tasks: SearchResultItem[];
  };

  /** Total count per entity type */
  counts: {
    sessions: number;
    notes: number;
    tasks: number;
    total: number;
  };

  /** Search metadata */
  took: number; // milliseconds
  indexesUsed: string[];
  query: UnifiedSearchQuery;
}

/**
 * Unified index statistics
 */
export interface UnifiedIndexStats {
  sessions: {
    count: number;
    indexes: string[];
  };
  notes: {
    count: number;
    indexes: string[];
  };
  tasks: {
    count: number;
    indexes: string[];
  };
  relationships: {
    count: number;
  };
  lastBuilt: number;
  version: number;
}

// ============================================================================
// Index Data Structures
// ============================================================================

/**
 * Notes index structure
 */
interface NotesIndex {
  fullText: Record<string, string[]>;      // word → note-ids
  byTopic: Record<string, string[]>;       // topic-id → note-ids
  byDate: Record<string, string[]>;        // YYYY-MM → note-ids
  bySourceType: Record<string, string[]>;  // source-type → note-ids
  byCompany: Record<string, string[]>;     // company-id → note-ids
  byContact: Record<string, string[]>;     // contact-id → note-ids
  bySession: Record<string, string[]>;     // session-id → note-ids
}

/**
 * Tasks index structure
 */
interface TasksIndex {
  fullText: Record<string, string[]>;      // word → task-ids
  byStatus: Record<string, string[]>;      // status → task-ids
  byPriority: Record<string, string[]>;    // priority → task-ids
  byDate: Record<string, string[]>;        // YYYY-MM → task-ids
  byTopic: Record<string, string[]>;       // topic-id → task-ids
  byNote: Record<string, string[]>;        // note-id → task-ids
  bySession: Record<string, string[]>;     // session-id → task-ids
  byCompleted: Record<'true' | 'false', string[]>; // completed → task-ids
}

/**
 * All unified indexes container
 */
interface UnifiedIndexes {
  notes: NotesIndex;
  tasks: TasksIndex;
  metadata: {
    lastBuilt: number;
    version: number;
    entityCounts: {
      sessions: number;
      notes: number;
      tasks: number;
    };
  };
}

// ============================================================================
// UnifiedIndexManager
// ============================================================================

export class UnifiedIndexManager extends InvertedIndexManager {
  private notesIndex: NotesIndex | null = null;
  private tasksIndex: TasksIndex | null = null;
  private relationshipIndex: RelationshipIndex;
  private unifiedMetadata: UnifiedIndexes['metadata'] | null = null;
  private readonly UNIFIED_INDEX_VERSION = 1;

  constructor(storage: StorageAdapter, relationships: Relationship[] = []) {
    super(storage);
    this.relationshipIndex = new RelationshipIndex(relationships);
  }

  // ============================================================================
  // Unified Search API
  // ============================================================================

  /**
   * Search across all entity types with relationship awareness
   *
   * @example
   * // Find all entities related to a topic
   * const result = await manager.search({
   *   query: 'authentication bug',
   *   entityTypes: ['sessions', 'notes', 'tasks'],
   *   relatedTo: { entityType: 'topic', entityId: 'topic-123' }
   * });
   *
   * @example
   * // Find tasks in session
   * const result = await manager.search({
   *   entityTypes: ['tasks'],
   *   relatedTo: { entityType: 'session', entityId: 'session-abc' },
   *   filters: { status: 'in_progress' }
   * });
   */
  async unifiedSearch(query: UnifiedSearchQuery): Promise<UnifiedSearchResult> {
    const start = performance.now();
    const entityTypes = query.entityTypes || ['sessions', 'notes', 'tasks'];
    const indexesUsed: string[] = [];

    // Initialize result containers
    const sessionIds = new Set<string>();
    const noteIds = new Set<string>();
    const taskIds = new Set<string>();

    // Phase 1: Relationship filtering (if relatedTo provided)
    let relationshipFiltered = false;
    if (query.relatedTo) {
      const relatedEntities = await this.findRelatedEntities(
        query.relatedTo.entityId,
        query.relatedTo.entityType,
        query.relatedTo.maxHops || 1,
        query.relatedTo.relationshipType
      );

      if (entityTypes.includes('sessions')) {
        relatedEntities.sessions.forEach(id => sessionIds.add(id));
      }
      if (entityTypes.includes('notes')) {
        relatedEntities.notes.forEach(id => noteIds.add(id));
      }
      if (entityTypes.includes('tasks')) {
        relatedEntities.tasks.forEach(id => taskIds.add(id));
      }

      relationshipFiltered = true;
      indexesUsed.push('relationships');
    }

    // Phase 2: Full-text search (if query provided)
    if (query.query) {
      const textResults = await this.searchFullText(query.query, entityTypes);

      if (entityTypes.includes('sessions')) {
        const ids = textResults.sessions;
        if (relationshipFiltered) {
          // Intersect with relationship filter (keep only IDs in both sets)
          const filtered = new Set<string>();
          ids.forEach(id => {
            if (sessionIds.has(id)) {
              filtered.add(id);
            }
          });
          sessionIds.clear();
          filtered.forEach(id => sessionIds.add(id));
        } else {
          ids.forEach(id => sessionIds.add(id));
        }
      }

      if (entityTypes.includes('notes')) {
        const ids = textResults.notes;
        if (relationshipFiltered) {
          const filtered = new Set<string>();
          ids.forEach(id => {
            if (noteIds.has(id)) {
              filtered.add(id);
            }
          });
          noteIds.clear();
          filtered.forEach(id => noteIds.add(id));
        } else {
          ids.forEach(id => noteIds.add(id));
        }
      }

      if (entityTypes.includes('tasks')) {
        const ids = textResults.tasks;
        if (relationshipFiltered) {
          const filtered = new Set<string>();
          ids.forEach(id => {
            if (taskIds.has(id)) {
              filtered.add(id);
            }
          });
          taskIds.clear();
          filtered.forEach(id => taskIds.add(id));
        } else {
          ids.forEach(id => taskIds.add(id));
        }
      }

      indexesUsed.push('fullText');
    }

    // Phase 3: Apply additional filters
    if (query.filters) {
      const filtered = await this.applyFilters(
        { sessions: sessionIds, notes: noteIds, tasks: taskIds },
        query.filters,
        entityTypes
      );

      sessionIds.clear();
      noteIds.clear();
      taskIds.clear();

      filtered.sessions.forEach(id => sessionIds.add(id));
      filtered.notes.forEach(id => noteIds.add(id));
      filtered.tasks.forEach(id => taskIds.add(id));
    }

    // Phase 4: Convert to SearchResultItems
    const results: UnifiedSearchResult['results'] = {
      sessions: Array.from(sessionIds).map(id => ({
        id,
        entityType: 'sessions' as const,
        score: 1.0, // TODO: Implement relevance scoring
        metadata: {}
      })),
      notes: Array.from(noteIds).map(id => ({
        id,
        entityType: 'notes' as const,
        score: 1.0,
        metadata: {}
      })),
      tasks: Array.from(taskIds).map(id => ({
        id,
        entityType: 'tasks' as const,
        score: 1.0,
        metadata: {}
      }))
    };

    // Phase 5: Sort and paginate
    // TODO: Implement sorting based on query.sortBy
    // TODO: Implement pagination based on query.limit/offset

    const took = performance.now() - start;

    return {
      results,
      counts: {
        sessions: results.sessions.length,
        notes: results.notes.length,
        tasks: results.tasks.length,
        total: results.sessions.length + results.notes.length + results.tasks.length
      },
      took,
      indexesUsed,
      query
    };
  }

  // ============================================================================
  // Relationship Queries
  // ============================================================================

  /**
   * Find all entities related to a given entity
   * Uses RelationshipIndex for O(1) lookups
   */
  private async findRelatedEntities(
    entityId: string,
    entityType: EntityType | MetadataEntityType,
    maxHops: number,
    relationshipType?: string
  ): Promise<{ sessions: Set<string>; notes: Set<string>; tasks: Set<string> }> {
    const sessions = new Set<string>();
    const notes = new Set<string>();
    const tasks = new Set<string>();

    const visited = new Set<string>([entityId]);
    const queue: Array<{ id: string; type: string; hop: number }> = [
      { id: entityId, type: entityType, hop: 0 }
    ];

    while (queue.length > 0) {
      const { id, type, hop } = queue.shift()!;

      if (hop >= maxHops) continue;

      // Get direct relationships from RelationshipIndex (O(1))
      const relationships = this.relationshipIndex.getByEntity(id);

      for (const rel of relationships) {
        // Filter by relationship type if specified
        if (relationshipType && rel.type !== relationshipType) {
          continue;
        }

        // Determine target entity
        const isSource = rel.sourceId === id;
        const targetId = isSource ? rel.targetId : rel.sourceId;
        const targetType = isSource ? rel.targetType : rel.sourceType;

        if (visited.has(targetId)) continue;
        visited.add(targetId);

        // Add to appropriate result set
        if (targetType === 'session') {
          sessions.add(targetId);
        } else if (targetType === 'note') {
          notes.add(targetId);
        } else if (targetType === 'task') {
          tasks.add(targetId);
        }

        // Continue traversal for next hop
        if (hop + 1 < maxHops) {
          queue.push({ id: targetId, type: targetType, hop: hop + 1 });
        }
      }
    }

    return { sessions, notes, tasks };
  }

  // ============================================================================
  // Full-Text Search
  // ============================================================================

  /**
   * Search full-text indexes across entity types
   */
  private async searchFullText(
    query: string,
    entityTypes: EntityType[]
  ): Promise<{ sessions: Set<string>; notes: Set<string>; tasks: Set<string> }> {
    const words = this.tokenize(query);
    const sessions = new Set<string>();
    const notes = new Set<string>();
    const tasks = new Set<string>();

    // Search sessions (use parent class method)
    if (entityTypes.includes('sessions')) {
      const result = await super.search({ text: query, operator: 'AND' });
      result.sessionIds.forEach(id => sessions.add(id));
    }

    // Search notes
    if (entityTypes.includes('notes') && this.notesIndex) {
      const noteMatches = this.searchIndexByWords(this.notesIndex.fullText, words);
      noteMatches.forEach(id => notes.add(id));
    }

    // Search tasks
    if (entityTypes.includes('tasks') && this.tasksIndex) {
      const taskMatches = this.searchIndexByWords(this.tasksIndex.fullText, words);
      taskMatches.forEach(id => tasks.add(id));
    }

    return { sessions, notes, tasks };
  }

  /**
   * Search index by words with AND operator
   */
  private searchIndexByWords(index: Record<string, string[]>, words: string[]): Set<string> {
    if (words.length === 0) return new Set();

    // Get IDs for first word
    const firstWord = words[0];
    const result = new Set<string>(index[firstWord] || []);

    // Intersect with IDs for remaining words (AND operator)
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const wordIds = new Set(index[word] || []);

      // Keep only IDs that appear in both sets
      for (const id of result) {
        if (!wordIds.has(id)) {
          result.delete(id);
        }
      }
    }

    return result;
  }

  // ============================================================================
  // Filter Application
  // ============================================================================

  /**
   * Apply entity-specific filters
   */
  private async applyFilters(
    results: { sessions: Set<string>; notes: Set<string>; tasks: Set<string> },
    filters: NonNullable<UnifiedSearchQuery['filters']>,
    entityTypes: EntityType[]
  ): Promise<{ sessions: Set<string>; notes: Set<string>; tasks: Set<string> }> {
    const filtered = {
      sessions: new Set(results.sessions),
      notes: new Set(results.notes),
      tasks: new Set(results.tasks)
    };

    // Apply task filters
    if (entityTypes.includes('tasks') && this.tasksIndex) {
      if (filters.status) {
        filtered.tasks = this.applyTaskStatusFilter(filtered.tasks, filters.status);
      }
      if (filters.priority) {
        filtered.tasks = this.applyTaskPriorityFilter(filtered.tasks, filters.priority);
      }
      if (filters.completed !== undefined) {
        filtered.tasks = this.applyTaskCompletedFilter(filtered.tasks, filters.completed);
      }
    }

    // Apply topic filters (works across all entity types)
    if (filters.topicIds && filters.topicIds.length > 0) {
      filtered.sessions = this.applyTopicFilter(filtered.sessions, filters.topicIds, 'sessions');
      filtered.notes = this.applyTopicFilter(filtered.notes, filters.topicIds, 'notes');
      filtered.tasks = this.applyTopicFilter(filtered.tasks, filters.topicIds, 'tasks');
    }

    // Apply company filters (notes only)
    if (filters.companyIds && filters.companyIds.length > 0) {
      filtered.notes = this.applyCompanyFilter(filtered.notes, filters.companyIds);
    }

    // Apply contact filters (notes only)
    if (filters.contactIds && filters.contactIds.length > 0) {
      filtered.notes = this.applyContactFilter(filtered.notes, filters.contactIds);
    }

    return filtered;
  }

  private applyTaskStatusFilter(taskIds: Set<string>, status: string | string[]): Set<string> {
    if (!this.tasksIndex) return taskIds;

    const statuses = Array.isArray(status) ? status : [status];
    const matchingIds = new Set<string>();

    for (const s of statuses) {
      const ids = this.tasksIndex.byStatus[s] || [];
      ids.forEach(id => {
        // If no pre-filter, add all matching; otherwise intersect
        if (taskIds.size === 0 || taskIds.has(id)) {
          matchingIds.add(id);
        }
      });
    }

    return matchingIds;
  }

  private applyTaskPriorityFilter(taskIds: Set<string>, priority: string | string[]): Set<string> {
    if (!this.tasksIndex) return taskIds;

    const priorities = Array.isArray(priority) ? priority : [priority];
    const matchingIds = new Set<string>();

    for (const p of priorities) {
      const ids = this.tasksIndex.byPriority[p] || [];
      ids.forEach(id => {
        // If no pre-filter, add all matching; otherwise intersect
        if (taskIds.size === 0 || taskIds.has(id)) {
          matchingIds.add(id);
        }
      });
    }

    return matchingIds;
  }

  private applyTaskCompletedFilter(taskIds: Set<string>, completed: boolean): Set<string> {
    if (!this.tasksIndex) return taskIds;

    const key = String(completed) as 'true' | 'false';
    const ids = this.tasksIndex.byCompleted[key] || [];
    const matchingIds = new Set<string>();

    ids.forEach(id => {
      // If no pre-filter, add all matching; otherwise intersect
      if (taskIds.size === 0 || taskIds.has(id)) {
        matchingIds.add(id);
      }
    });

    return matchingIds;
  }

  private applyTopicFilter(entityIds: Set<string>, topicIds: string[], entityType: EntityType): Set<string> {
    const matchingIds = new Set<string>();

    for (const topicId of topicIds) {
      let ids: string[] = [];

      if (entityType === 'notes' && this.notesIndex) {
        ids = this.notesIndex.byTopic[topicId] || [];
      } else if (entityType === 'tasks' && this.tasksIndex) {
        ids = this.tasksIndex.byTopic[topicId] || [];
      }
      // Sessions use parent class - would need to expose indexes

      ids.forEach(id => {
        // If no pre-filter, add all matching; otherwise intersect
        if (entityIds.size === 0 || entityIds.has(id)) {
          matchingIds.add(id);
        }
      });
    }

    return matchingIds;
  }

  private applyCompanyFilter(noteIds: Set<string>, companyIds: string[]): Set<string> {
    if (!this.notesIndex) return noteIds;

    const matchingIds = new Set<string>();

    for (const companyId of companyIds) {
      const ids = this.notesIndex.byCompany[companyId] || [];
      ids.forEach(id => {
        if (noteIds.has(id)) {
          matchingIds.add(id);
        }
      });
    }

    return matchingIds.size > 0 ? matchingIds : noteIds;
  }

  private applyContactFilter(noteIds: Set<string>, contactIds: string[]): Set<string> {
    if (!this.notesIndex) return noteIds;

    const matchingIds = new Set<string>();

    for (const contactId of contactIds) {
      const ids = this.notesIndex.byContact[contactId] || [];
      ids.forEach(id => {
        if (noteIds.has(id)) {
          matchingIds.add(id);
        }
      });
    }

    return matchingIds.size > 0 ? matchingIds : noteIds;
  }

  // ============================================================================
  // Index Building - Notes
  // ============================================================================

  /**
   * Build notes indexes from scratch
   */
  async buildNotesIndexes(notes: Note[]): Promise<void> {
    console.log(`[UnifiedIndexManager] Building notes indexes for ${notes.length} notes...`);
    const start = performance.now();

    // Initialize empty indexes
    const notesIndex: NotesIndex = {
      fullText: {},
      byTopic: {},
      byDate: {},
      bySourceType: {},
      byCompany: {},
      byContact: {},
      bySession: {}
    };

    // Build indexes for each note
    for (const note of notes) {
      this.indexNote(note, notesIndex);
    }

    // Save indexes to storage
    await this.storage.save('note-indexes', notesIndex);
    this.notesIndex = notesIndex;

    const took = performance.now() - start;
    console.log(`[UnifiedIndexManager] Built notes indexes in ${took.toFixed(2)}ms`);
  }

  /**
   * Index a single note
   */
  private indexNote(note: Note, index: NotesIndex): void {
    const { id, content, summary } = note;

    // Full-text index (content + summary)
    const text = `${content} ${summary || ''}`;
    const words = this.tokenize(text);
    for (const word of words) {
      this.addToUnifiedIndex(index.fullText, word, id);
    }

    // Date index (YYYY-MM format)
    const dateKey = this.getDateKey(note.timestamp);
    this.addToUnifiedIndex(index.byDate, dateKey, id);

    // Extract metadata from relationships
    for (const rel of note.relationships || []) {
      const isSource = rel.sourceId === id;
      const targetId = isSource ? rel.targetId : rel.sourceId;
      const targetType = isSource ? rel.targetType : rel.sourceType;

      // Index by topic
      if (targetType === 'topic') {
        this.addToUnifiedIndex(index.byTopic, targetId, id);
      }
      // Index by company
      else if (targetType === 'company') {
        this.addToUnifiedIndex(index.byCompany, targetId, id);
      }
      // Index by contact
      else if (targetType === 'contact') {
        this.addToUnifiedIndex(index.byContact, targetId, id);
      }
      // Index by session
      else if (targetType === 'session') {
        this.addToUnifiedIndex(index.bySession, targetId, id);
      }
    }

    // Note: sourceType property removed from Note type
  }

  /**
   * Update single note in index
   */
  async updateNote(note: Note): Promise<void> {
    if (!this.notesIndex) {
      await this.loadNotesIndexes();
    }

    if (!this.notesIndex) {
      throw new Error('Notes indexes not initialized');
    }

    // Remove old entries (if exists)
    await this.removeNoteFromIndex(note.id);

    // Add new entries
    this.indexNote(note, this.notesIndex);

    // Save updated index
    await this.storage.save('note-indexes', this.notesIndex);
  }

  /**
   * Remove note from index
   */
  async removeNote(noteId: string): Promise<void> {
    if (!this.notesIndex) {
      await this.loadNotesIndexes();
    }

    if (!this.notesIndex) return;

    await this.removeNoteFromIndex(noteId);
    await this.storage.save('note-indexes', this.notesIndex);
  }

  private async removeNoteFromIndex(noteId: string): Promise<void> {
    if (!this.notesIndex) return;

    // Remove from all indexes
    this.removeFromAllIndexes(this.notesIndex.fullText, noteId);
    this.removeFromAllIndexes(this.notesIndex.byTopic, noteId);
    this.removeFromAllIndexes(this.notesIndex.byDate, noteId);
    this.removeFromAllIndexes(this.notesIndex.bySourceType, noteId);
    this.removeFromAllIndexes(this.notesIndex.byCompany, noteId);
    this.removeFromAllIndexes(this.notesIndex.byContact, noteId);
    this.removeFromAllIndexes(this.notesIndex.bySession, noteId);
  }

  // ============================================================================
  // Index Building - Tasks
  // ============================================================================

  /**
   * Build tasks indexes from scratch
   */
  async buildTasksIndexes(tasks: Task[]): Promise<void> {
    console.log(`[UnifiedIndexManager] Building tasks indexes for ${tasks.length} tasks...`);
    const start = performance.now();

    // Initialize empty indexes
    const tasksIndex: TasksIndex = {
      fullText: {},
      byStatus: {},
      byPriority: {},
      byDate: {},
      byTopic: {},
      byNote: {},
      bySession: {},
      byCompleted: { true: [], false: [] }
    };

    // Build indexes for each task
    for (const task of tasks) {
      this.indexTask(task, tasksIndex);
    }

    // Save indexes to storage
    await this.storage.save('task-indexes', tasksIndex);
    this.tasksIndex = tasksIndex;

    const took = performance.now() - start;
    console.log(`[UnifiedIndexManager] Built tasks indexes in ${took.toFixed(2)}ms`);
  }

  /**
   * Index a single task
   */
  private indexTask(task: Task, index: TasksIndex): void {
    const { id, title, description, status, priority } = task;

    // Full-text index (title + description)
    const text = `${title} ${description || ''}`;
    const words = this.tokenize(text);
    for (const word of words) {
      this.addToUnifiedIndex(index.fullText, word, id);
    }

    // Status index
    this.addToUnifiedIndex(index.byStatus, status, id);

    // Priority index
    if (priority) {
      this.addToUnifiedIndex(index.byPriority, priority, id);
    }

    // Note: completed property removed from Task type
    // Tasks are now marked complete via status field

    // Date index (YYYY-MM format)
    const dateKey = this.getDateKey(task.createdAt);
    this.addToUnifiedIndex(index.byDate, dateKey, id);

    // Extract metadata from relationships
    for (const rel of task.relationships || []) {
      const isSource = rel.sourceId === id;
      const targetId = isSource ? rel.targetId : rel.sourceId;
      const targetType = isSource ? rel.targetType : rel.sourceType;

      // Index by topic
      if (targetType === 'topic') {
        this.addToUnifiedIndex(index.byTopic, targetId, id);
      }
      // Index by note
      else if (targetType === 'note') {
        this.addToUnifiedIndex(index.byNote, targetId, id);
      }
      // Index by session
      else if (targetType === 'session') {
        this.addToUnifiedIndex(index.bySession, targetId, id);
      }
    }
  }

  /**
   * Update single task in index
   */
  async updateTask(task: Task): Promise<void> {
    if (!this.tasksIndex) {
      await this.loadTasksIndexes();
    }

    if (!this.tasksIndex) {
      throw new Error('Tasks indexes not initialized');
    }

    // Remove old entries (if exists)
    await this.removeTaskFromIndex(task.id);

    // Add new entries
    this.indexTask(task, this.tasksIndex);

    // Save updated index
    await this.storage.save('task-indexes', this.tasksIndex);
  }

  /**
   * Remove task from index
   */
  async removeTask(taskId: string): Promise<void> {
    if (!this.tasksIndex) {
      await this.loadTasksIndexes();
    }

    if (!this.tasksIndex) return;

    await this.removeTaskFromIndex(taskId);
    await this.storage.save('task-indexes', this.tasksIndex);
  }

  private async removeTaskFromIndex(taskId: string): Promise<void> {
    if (!this.tasksIndex) return;

    // Remove from all indexes
    this.removeFromAllIndexes(this.tasksIndex.fullText, taskId);
    this.removeFromAllIndexes(this.tasksIndex.byStatus, taskId);
    this.removeFromAllIndexes(this.tasksIndex.byPriority, taskId);
    this.removeFromAllIndexes(this.tasksIndex.byDate, taskId);
    this.removeFromAllIndexes(this.tasksIndex.byTopic, taskId);
    this.removeFromAllIndexes(this.tasksIndex.byNote, taskId);
    this.removeFromAllIndexes(this.tasksIndex.bySession, taskId);
    this.removeFromAllIndexes(this.tasksIndex.byCompleted, taskId);
  }

  // ============================================================================
  // Relationship Management
  // ============================================================================

  /**
   * Update relationship in index
   */
  async updateRelationship(relationship: Relationship): Promise<void> {
    this.relationshipIndex.add(relationship);
  }

  /**
   * Remove relationship from index
   */
  async removeRelationship(relationshipId: string): Promise<void> {
    this.relationshipIndex.remove(relationshipId);
  }

  /**
   * Rebuild relationship index
   */
  async rebuildRelationshipIndex(relationships: Relationship[]): Promise<void> {
    console.log(`[UnifiedIndexManager] Rebuilding relationship index with ${relationships.length} relationships...`);
    this.relationshipIndex = new RelationshipIndex(relationships);
  }

  // ============================================================================
  // Index Loading
  // ============================================================================

  /**
   * Load notes indexes from storage
   */
  private async loadNotesIndexes(): Promise<void> {
    const notesIndex = await this.storage.load<NotesIndex>('note-indexes');
    if (notesIndex) {
      this.notesIndex = notesIndex;
    }
  }

  /**
   * Load tasks indexes from storage
   */
  private async loadTasksIndexes(): Promise<void> {
    const tasksIndex = await this.storage.load<TasksIndex>('task-indexes');
    if (tasksIndex) {
      this.tasksIndex = tasksIndex;
    }
  }

  /**
   * Load all unified indexes
   */
  async loadAllIndexes(): Promise<void> {
    await Promise.all([
      this.loadNotesIndexes(),
      this.loadTasksIndexes()
    ]);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Tokenize text into searchable words
   * (Inherited from InvertedIndexManager)
   */

  /**
   * Get date key in YYYY-MM format
   * (Inherited from InvertedIndexManager)
   */

  /**
   * Add entity ID to index
   */
  private addToUnifiedIndex(index: Record<string, string[]>, key: string, entityId: string): void {
    if (!index[key]) {
      index[key] = [];
    }
    if (!index[key].includes(entityId)) {
      index[key].push(entityId);
    }
  }

  /**
   * Remove entity ID from all keys in an index
   */
  private removeFromAllIndexes(index: Record<string, string[]>, entityId: string): void {
    for (const key in index) {
      index[key] = index[key].filter(id => id !== entityId);
      if (index[key].length === 0) {
        delete index[key];
      }
    }
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get unified index statistics
   */
  async getUnifiedStats(): Promise<UnifiedIndexStats> {
    return {
      sessions: {
        count: 0, // Sessions handled by parent class
        indexes: ['fullText', 'byTopic', 'byDate', 'byTag', 'byCategory', 'bySubCategory', 'byStatus']
      },
      notes: {
        count: this.notesIndex ? this.countIndexEntries(this.notesIndex.fullText) : 0,
        indexes: ['fullText', 'byTopic', 'byDate', 'bySourceType', 'byCompany', 'byContact', 'bySession']
      },
      tasks: {
        count: this.tasksIndex ? this.countIndexEntries(this.tasksIndex.fullText) : 0,
        indexes: ['fullText', 'byStatus', 'byPriority', 'byDate', 'byTopic', 'byNote', 'bySession', 'byCompleted']
      },
      relationships: {
        count: this.relationshipIndex.getStats().totalRelationships
      },
      lastBuilt: Date.now(),
      version: this.UNIFIED_INDEX_VERSION
    };
  }

  /**
   * Count unique entity IDs in an index
   */
  private countIndexEntries(index: Record<string, string[]>): number {
    const uniqueIds = new Set<string>();
    for (const key in index) {
      index[key].forEach(id => uniqueIds.add(id));
    }
    return uniqueIds.size;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: UnifiedIndexManager | null = null;

/**
 * Get singleton UnifiedIndexManager instance
 */
export async function getUnifiedIndexManager(): Promise<UnifiedIndexManager> {
  if (instance) {
    return instance;
  }

  const { getStorage } = await import('./index');
  const { relationshipManager } = await import('../relationshipManager');

  const storage = await getStorage();
  // Get all relationships (empty array if none exist yet)
  const relationships: Relationship[] = [];

  instance = new UnifiedIndexManager(storage, relationships);

  // Load existing indexes
  await instance.loadAllIndexes();

  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetUnifiedIndexManager(): void {
  instance = null;
}
