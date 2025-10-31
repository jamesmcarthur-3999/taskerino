/**
 * GraphSearch - Graph-first search using relationship traversal
 *
 * Leverages RelationshipManager to pre-filter notes and tasks before
 * sending to LLM, dramatically reducing cost and latency.
 *
 * @module services/contextAgent/GraphSearch
 * @since 2.1.0
 */

import type { Note, Task, Company, Contact, Topic } from '../../types';
import type { Relationship, EntityType } from '../../types/relationships';
import { relationshipManager } from '../relationshipManager';
import type { QueryAnalysis, ExtractedEntity } from './QueryAnalyzer';

/**
 * Search result with metadata
 */
export interface SearchResult {
  notes: Note[];
  tasks: Task[];
  metadata: SearchMetadata;
}

/**
 * Search metadata for debugging and optimization
 */
export interface SearchMetadata {
  totalScanned: number;      // Total items in database
  graphFiltered: number;      // After graph traversal
  dateFiltered?: number;      // After date filter
  statusFiltered?: number;    // After status filter
  priorityFiltered?: number;  // After priority filter
  finalResults: number;       // Final result count
  queryTime: string;          // Query execution time
  strategy: 'graph' | 'local_filter' | 'full_scan';
}

/**
 * Query filters extracted from analysis
 */
export interface QueryFilters {
  dateStart?: string;
  dateEnd?: string;
  statuses?: Array<'todo' | 'in-progress' | 'done' | 'blocked'>;
  priorities?: Array<'low' | 'medium' | 'high'>;
  tags?: string[];
  requireTasks?: boolean;
  requireNotes?: boolean;
}

/**
 * GraphSearch - Performant graph-based search
 *
 * @example
 * ```typescript
 * const graphSearch = new GraphSearch();
 * await graphSearch.init();
 *
 * const result = await graphSearch.searchByQuery(
 *   queryAnalysis,
 *   notes,
 *   tasks,
 *   companies,
 *   contacts,
 *   topics
 * );
 *
 * console.log(`Found ${result.notes.length} notes in ${result.metadata.queryTime}`);
 * console.log(`Strategy: ${result.metadata.strategy}`);
 * ```
 */
export class GraphSearch {
  private initialized = false;

  /**
   * Initialize graph search (ensures RelationshipManager is ready)
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await relationshipManager.init();
    this.initialized = true;
  }

  /**
   * Ensure initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('GraphSearch not initialized. Call init() first.');
    }
  }

  /**
   * Search using query analysis
   */
  async searchByQuery(
    analysis: QueryAnalysis,
    notes: Note[],
    tasks: Task[],
    companies: Company[],
    contacts: Contact[],
    topics: Topic[]
  ): Promise<SearchResult> {
    this.ensureInitialized();

    const startTime = performance.now();

    // Choose strategy based on query pattern
    let result: SearchResult;

    if (analysis.entities.length > 0) {
      // Graph-first search (fastest)
      result = await this.entitySearch(
        analysis.entities,
        notes,
        tasks,
        this.analysisToFilters(analysis)
      );
    } else if (analysis.dateFilter || analysis.statusFilter || analysis.priorityFilter) {
      // Local filtering (no graph needed)
      result = this.localFilterSearch(
        notes,
        tasks,
        this.analysisToFilters(analysis)
      );
    } else {
      // Full scan (fallback)
      result = this.fullScanSearch(notes, tasks, this.analysisToFilters(analysis));
    }

    const endTime = performance.now();
    result.metadata.queryTime = `${(endTime - startTime).toFixed(1)}ms`;

    return result;
  }

  /**
   * Search by entity using graph traversal
   */
  private async entitySearch(
    entities: ExtractedEntity[],
    allNotes: Note[],
    allTasks: Task[],
    filters: QueryFilters
  ): Promise<SearchResult> {
    const totalScanned = allNotes.length + allTasks.length;

    // Get all relationships for these entities
    const relationships = await this.getRelevantRelationships(entities);

    // Extract connected notes and tasks
    let candidateNotes = this.getConnectedNotes(relationships, allNotes);
    let candidateTasks = this.getConnectedTasks(relationships, allTasks);

    const graphFiltered = candidateNotes.length + candidateTasks.length;

    // Apply additional filters
    const filtered = this.applyFilters(candidateNotes, candidateTasks, filters);

    return {
      notes: filtered.notes,
      tasks: filtered.tasks,
      metadata: {
        totalScanned,
        graphFiltered,
        dateFiltered: filters.dateStart || filters.dateEnd ? filtered.notes.length + filtered.tasks.length : undefined,
        statusFiltered: filters.statuses ? filtered.tasks.length : undefined,
        priorityFiltered: filters.priorities ? filtered.tasks.length : undefined,
        finalResults: filtered.notes.length + filtered.tasks.length,
        queryTime: '0ms', // Will be updated by caller
        strategy: 'graph',
      },
    };
  }

  /**
   * Search using local filters only (no graph traversal)
   */
  private localFilterSearch(
    allNotes: Note[],
    allTasks: Task[],
    filters: QueryFilters
  ): SearchResult {
    const totalScanned = allNotes.length + allTasks.length;

    const filtered = this.applyFilters(allNotes, allTasks, filters);

    return {
      notes: filtered.notes,
      tasks: filtered.tasks,
      metadata: {
        totalScanned,
        graphFiltered: totalScanned,
        finalResults: filtered.notes.length + filtered.tasks.length,
        queryTime: '0ms',
        strategy: 'local_filter',
      },
    };
  }

  /**
   * Full scan search (no optimization)
   */
  private fullScanSearch(
    allNotes: Note[],
    allTasks: Task[],
    filters: QueryFilters
  ): SearchResult {
    const totalScanned = allNotes.length + allTasks.length;

    const filtered = this.applyFilters(allNotes, allTasks, filters);

    return {
      notes: filtered.notes,
      tasks: filtered.tasks,
      metadata: {
        totalScanned,
        graphFiltered: totalScanned,
        finalResults: filtered.notes.length + filtered.tasks.length,
        queryTime: '0ms',
        strategy: 'full_scan',
      },
    };
  }

  /**
   * Get all relationships connected to entities
   */
  private async getRelevantRelationships(
    entities: ExtractedEntity[]
  ): Promise<Relationship[]> {
    const allRelationships: Relationship[] = [];

    for (const entity of entities) {
      // Get all relationships for this entity (O(1) lookup via index!)
      const rels = relationshipManager.getRelationships({
        entityId: entity.id,
        entityType: entity.type,
      });

      allRelationships.push(...rels);
    }

    // Deduplicate
    const uniqueRels = new Map<string, Relationship>();
    allRelationships.forEach(r => uniqueRels.set(r.id, r));

    return Array.from(uniqueRels.values());
  }

  /**
   * Extract notes connected via relationships
   */
  private getConnectedNotes(
    relationships: Relationship[],
    allNotes: Note[]
  ): Note[] {
    const noteIds = new Set<string>();

    relationships.forEach(rel => {
      // If target is a note, include it
      if (rel.targetType === 'note') {
        noteIds.add(rel.targetId);
      }
      // If source is a note, include it
      if (rel.sourceType === 'note') {
        noteIds.add(rel.sourceId);
      }
    });

    // Look up full Note objects
    return allNotes.filter(n => noteIds.has(n.id));
  }

  /**
   * Extract tasks connected via relationships
   */
  private getConnectedTasks(
    relationships: Relationship[],
    allTasks: Task[]
  ): Task[] {
    const taskIds = new Set<string>();

    relationships.forEach(rel => {
      // If target is a task, include it
      if (rel.targetType === 'task') {
        taskIds.add(rel.targetId);
      }
      // If source is a task, include it
      if (rel.sourceType === 'task') {
        taskIds.add(rel.sourceId);
      }
    });

    // Look up full Task objects
    return allTasks.filter(t => taskIds.has(t.id));
  }

  /**
   * Apply filters to notes and tasks
   */
  private applyFilters(
    notes: Note[],
    tasks: Task[],
    filters: QueryFilters
  ): { notes: Note[]; tasks: Task[] } {
    let filteredNotes = [...notes];
    let filteredTasks = [...tasks];

    // Date filter
    if (filters.dateStart || filters.dateEnd) {
      if (filters.dateStart) {
        filteredNotes = filteredNotes.filter(n => n.timestamp >= filters.dateStart!);
      }
      if (filters.dateEnd) {
        // Add one day to include the end date
        const endDatePlusOne = new Date(filters.dateEnd);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        const endDateStr = endDatePlusOne.toISOString().split('T')[0];
        filteredNotes = filteredNotes.filter(n => n.timestamp < endDateStr);
      }

      // Filter tasks by createdAt
      if (filters.dateStart) {
        filteredTasks = filteredTasks.filter(t => t.createdAt >= filters.dateStart!);
      }
      if (filters.dateEnd) {
        const endDatePlusOne = new Date(filters.dateEnd);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        const endDateStr = endDatePlusOne.toISOString().split('T')[0];
        filteredTasks = filteredTasks.filter(t => t.createdAt < endDateStr);
      }
    }

    // Status filter (tasks only)
    if (filters.statuses && filters.statuses.length > 0) {
      filteredTasks = filteredTasks.filter(t => filters.statuses!.includes(t.status));
    }

    // Priority filter (tasks only)
    if (filters.priorities && filters.priorities.length > 0) {
      filteredTasks = filteredTasks.filter(t => filters.priorities!.includes(t.priority));
    }

    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      filteredNotes = filteredNotes.filter(n =>
        n.tags.some(tag => filters.tags!.includes(tag))
      );
      filteredTasks = filteredTasks.filter(t =>
        t.tags?.some(tag => filters.tags!.includes(tag))
      );
    }

    // Result type requirements
    if (filters.requireNotes && !filters.requireTasks) {
      filteredTasks = [];
    }
    if (filters.requireTasks && !filters.requireNotes) {
      filteredNotes = [];
    }

    return {
      notes: filteredNotes,
      tasks: filteredTasks,
    };
  }

  /**
   * Convert QueryAnalysis to QueryFilters
   */
  private analysisToFilters(analysis: QueryAnalysis): QueryFilters {
    return {
      dateStart: analysis.dateFilter?.startDate,
      dateEnd: analysis.dateFilter?.endDate,
      statuses: analysis.statusFilter,
      priorities: analysis.priorityFilter,
      tags: analysis.tags.length > 0 ? analysis.tags : undefined,
      requireTasks: analysis.requireTasks,
      requireNotes: analysis.requireNotes,
    };
  }
}


