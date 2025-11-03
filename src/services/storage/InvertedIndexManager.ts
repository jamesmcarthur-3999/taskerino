/**
 * InvertedIndexManager - Fast search for sessions using inverted indexes
 *
 * Provides O(log n) search time instead of O(n) linear scan.
 * Builds and maintains 4 index types:
 * - by-topic.json: topic-id → [session-ids]
 * - by-date.json: date-key → [session-ids]
 * - by-tag.json: tag → [session-ids]
 * - full-text.json: word → [session-ids]
 *
 * Target: <100ms search time for 1000+ sessions
 *
 * @see /docs/sessions-rewrite/PHASE_4_KICKOFF.md (lines 186-215)
 */

import type { StorageAdapter } from './StorageAdapter';
import type { SessionMetadata } from './ChunkedSessionStorage';
import type { Session } from '../../types';
import { debug } from "../../utils/debug";

// ============================================================================
// Types
// ============================================================================

/**
 * Search query with support for complex filters
 */
export interface SearchQuery {
  /** Full-text search (searches name, description, summary) */
  text?: string;

  /** Filter by topic IDs */
  topicIds?: string[];

  /** Filter by tags */
  tags?: string[];

  /** Filter by date range */
  dateRange?: {
    start: number; // Unix timestamp
    end: number;   // Unix timestamp
  };

  /** Filter by session status */
  status?: Array<'active' | 'paused' | 'completed' | 'interrupted'>;

  /** Filter by category */
  category?: string;

  /** Filter by sub-category */
  subCategory?: string;

  /** Combine filters with AND or OR (default: AND) */
  operator?: 'AND' | 'OR';
}

/**
 * Search result with metadata
 */
export interface SearchResult {
  /** Matching session IDs */
  sessionIds: string[];

  /** Number of results */
  count: number;

  /** Search time in milliseconds */
  took: number;

  /** Index stats used for search */
  indexesUsed: string[];
}

/**
 * Index statistics
 */
export interface IndexStats {
  /** Topic index stats */
  topicIndex: {
    topics: number;       // Number of unique topics
    entries: number;      // Total session entries
    size: number;         // Estimated size in bytes
  };

  /** Date index stats */
  dateIndex: {
    dates: number;        // Number of unique date keys
    entries: number;      // Total session entries
    size: number;         // Estimated size in bytes
  };

  /** Tag index stats */
  tagIndex: {
    tags: number;         // Number of unique tags
    entries: number;      // Total session entries
    size: number;         // Estimated size in bytes
  };

  /** Full-text index stats */
  fullTextIndex: {
    words: number;        // Number of unique words
    entries: number;      // Total session entries
    size: number;         // Estimated size in bytes
  };

  /** Category index stats */
  categoryIndex: {
    categories: number;   // Number of unique categories
    entries: number;      // Total session entries
    size: number;         // Estimated size in bytes
  };

  /** Sub-category index stats */
  subCategoryIndex: {
    subCategories: number; // Number of unique sub-categories
    entries: number;       // Total session entries
    size: number;          // Estimated size in bytes
  };

  /** Status index stats */
  statusIndex: {
    statuses: number;     // Number of unique statuses
    entries: number;      // Total session entries
    size: number;         // Estimated size in bytes
  };

  /** When indexes were last built */
  lastBuilt: number;

  /** When indexes were last optimized */
  lastOptimized: number;

  /** Index version */
  version: number;
}

/**
 * Index integrity check result
 */
export interface IntegrityCheckResult {
  /** Whether indexes are valid */
  valid: boolean;

  /** List of errors found */
  errors: string[];

  /** List of warnings */
  warnings: string[];

  /** Number of sessions checked */
  sessionsChecked: number;
}

// ============================================================================
// Index Data Structures
// ============================================================================

/**
 * Topic index: topic-id → [session-ids]
 */
type TopicIndex = Record<string, string[]>;

/**
 * Date index: YYYY-MM → [session-ids]
 */
type DateIndex = Record<string, string[]>;

/**
 * Tag index: tag → [session-ids]
 */
type TagIndex = Record<string, string[]>;

/**
 * Full-text index: word → [session-ids]
 */
type FullTextIndex = Record<string, string[]>;

/**
 * Category index: category → [session-ids]
 */
type CategoryIndex = Record<string, string[]>;

/**
 * Sub-category index: sub-category → [session-ids]
 */
type SubCategoryIndex = Record<string, string[]>;

/**
 * Status index: status → [session-ids]
 */
type StatusIndex = Record<string, string[]>;

/**
 * Index metadata stored with each index
 */
interface IndexMetadata {
  lastBuilt: number;
  lastOptimized: number;
  version: number;
  sessionCount: number;
}

/**
 * All indexes container
 */
interface Indexes {
  topicIndex: TopicIndex;
  dateIndex: DateIndex;
  tagIndex: TagIndex;
  fullTextIndex: FullTextIndex;
  categoryIndex: CategoryIndex;
  subCategoryIndex: SubCategoryIndex;
  statusIndex: StatusIndex;
  metadata: IndexMetadata;
}

// ============================================================================
// InvertedIndexManager
// ============================================================================

export class InvertedIndexManager {
  private storage: StorageAdapter;
  private indexes: Indexes | null = null;
  private readonly INDEX_VERSION = 1;
  private readonly INDEX_PREFIX = 'session-indexes';

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  // ============================================================================
  // Index Building
  // ============================================================================

  /**
   * Build all indexes from scratch
   * Loads all session metadata and creates inverted indexes
   */
  async buildIndexes(sessions: SessionMetadata[]): Promise<void> {
    console.log(`[InvertedIndexManager] Building indexes for ${sessions.length} sessions...`);
    const start = performance.now();

    // Initialize empty indexes
    const indexes: Indexes = {
      topicIndex: {},
      dateIndex: {},
      tagIndex: {},
      fullTextIndex: {},
      categoryIndex: {},
      subCategoryIndex: {},
      statusIndex: {},
      metadata: {
        lastBuilt: Date.now(),
        lastOptimized: Date.now(),
        version: this.INDEX_VERSION,
        sessionCount: sessions.length,
      },
    };

    // Build indexes for each session
    for (const session of sessions) {
      this.indexSession(session, indexes);
    }

    // Save indexes to storage
    await this.saveIndexes(indexes);
    this.indexes = indexes;

    const took = performance.now() - start;
    console.log(`[InvertedIndexManager] Built indexes in ${took.toFixed(2)}ms`);
  }

  /**
   * Rebuild all indexes (same as buildIndexes but clears existing first)
   */
  async rebuildIndexes(sessions: SessionMetadata[]): Promise<void> {
    console.log('[InvertedIndexManager] Rebuilding all indexes...');
    await this.clearIndexes();
    await this.buildIndexes(sessions);
  }

  /**
   * Index a single session into the provided indexes
   */
  private indexSession(session: SessionMetadata, indexes: Indexes): void {
    const { id } = session;

    // Index by topics (from summary)
    if (session.hasSummary) {
      // Topics will be loaded from summary when needed
      // For now, we'll use extractedNoteIds as a proxy
      // TODO: Extract topics from summary once loaded
    }

    // Index by date (YYYY-MM format for month-level grouping)
    const dateKey = this.getDateKey(session.startTime);
    this.addToIndex(indexes.dateIndex, dateKey, id);

    // Index by tags
    for (const tag of session.tags) {
      const normalizedTag = this.normalizeTag(tag);
      this.addToIndex(indexes.tagIndex, normalizedTag, id);
    }

    // Index by category
    if (session.category) {
      this.addToIndex(indexes.categoryIndex, session.category.toLowerCase(), id);
    }

    // Index by sub-category
    if (session.subCategory) {
      this.addToIndex(indexes.subCategoryIndex, session.subCategory.toLowerCase(), id);
    }

    // Index by status
    this.addToIndex(indexes.statusIndex, session.status, id);

    // Full-text index (name + description)
    const text = `${session.name} ${session.description}`.toLowerCase();
    const words = this.tokenize(text);
    for (const word of words) {
      this.addToIndex(indexes.fullTextIndex, word, id);
    }
  }

  /**
   * Add a session ID to an index entry
   */
  private addToIndex(index: Record<string, string[]>, key: string, sessionId: string): void {
    if (!index[key]) {
      index[key] = [];
    }
    if (!index[key].includes(sessionId)) {
      index[key].push(sessionId);
    }
  }

  /**
   * Remove a session ID from an index entry
   */
  private removeFromIndex(index: Record<string, string[]>, key: string, sessionId: string): void {
    if (index[key]) {
      index[key] = index[key].filter(id => id !== sessionId);
      if (index[key].length === 0) {
        delete index[key];
      }
    }
  }

  // ============================================================================
  // Incremental Updates
  // ============================================================================

  /**
   * Update indexes when a session is added or modified
   */
  async updateIndexes(session: SessionMetadata): Promise<void> {
    await this.ensureIndexesLoaded();
    if (!this.indexes) {
      throw new Error('Indexes not loaded');
    }

    // Remove old entries first (in case session was modified)
    await this.deleteFromIndexes(session.id);

    // Add new entries
    this.indexSession(session, this.indexes);

    // Update metadata
    this.indexes.metadata.sessionCount = await this.getSessionCount();
    this.indexes.metadata.lastBuilt = Date.now();

    // Save updated indexes
    await this.saveIndexes(this.indexes);
  }

  /**
   * Remove a session from all indexes
   */
  async deleteFromIndexes(sessionId: string): Promise<void> {
    await this.ensureIndexesLoaded();
    if (!this.indexes) {
      throw new Error('Indexes not loaded');
    }

    // Remove from all indexes
    this.removeSessionFromIndex(this.indexes.topicIndex, sessionId);
    this.removeSessionFromIndex(this.indexes.dateIndex, sessionId);
    this.removeSessionFromIndex(this.indexes.tagIndex, sessionId);
    this.removeSessionFromIndex(this.indexes.fullTextIndex, sessionId);
    this.removeSessionFromIndex(this.indexes.categoryIndex, sessionId);
    this.removeSessionFromIndex(this.indexes.subCategoryIndex, sessionId);
    this.removeSessionFromIndex(this.indexes.statusIndex, sessionId);

    // Update metadata
    this.indexes.metadata.sessionCount = await this.getSessionCount();

    // Save updated indexes
    await this.saveIndexes(this.indexes);
  }

  /**
   * Remove a session from all entries in an index
   */
  private removeSessionFromIndex(index: Record<string, string[]>, sessionId: string): void {
    for (const key in index) {
      this.removeFromIndex(index, key, sessionId);
    }
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search sessions using complex query
   * Target: <100ms for 1000+ sessions
   */
  async search(query: SearchQuery): Promise<SearchResult> {
    const start = performance.now();
    await this.ensureIndexesLoaded();

    if (!this.indexes) {
      throw new Error('Indexes not loaded');
    }

    const indexesUsed: string[] = [];
    const resultSets: Set<string>[] = [];

    // Full-text search
    if (query.text) {
      const words = this.tokenize(query.text.toLowerCase());
      const textResults = new Set<string>();

      for (const word of words) {
        const sessionIds = this.indexes.fullTextIndex[word] || [];
        sessionIds.forEach(id => textResults.add(id));
      }

      resultSets.push(textResults);
      indexesUsed.push('full-text');
    }

    // Topic filter
    if (query.topicIds && query.topicIds.length > 0) {
      const topicResults = new Set<string>();

      for (const topicId of query.topicIds) {
        const sessionIds = this.indexes.topicIndex[topicId] || [];
        sessionIds.forEach(id => topicResults.add(id));
      }

      resultSets.push(topicResults);
      indexesUsed.push('topic');
    }

    // Tag filter
    if (query.tags && query.tags.length > 0) {
      const tagResults = new Set<string>();

      for (const tag of query.tags) {
        const normalizedTag = this.normalizeTag(tag);
        const sessionIds = this.indexes.tagIndex[normalizedTag] || [];
        sessionIds.forEach(id => tagResults.add(id));
      }

      resultSets.push(tagResults);
      indexesUsed.push('tag');
    }

    // Date range filter
    if (query.dateRange) {
      const dateResults = new Set<string>();
      const { start: startTime, end: endTime } = query.dateRange;

      // Get all date keys in range
      const dateKeys = this.getDateKeysInRange(startTime, endTime);

      for (const dateKey of dateKeys) {
        const sessionIds = this.indexes.dateIndex[dateKey] || [];
        sessionIds.forEach(id => dateResults.add(id));
      }

      resultSets.push(dateResults);
      indexesUsed.push('date');
    }

    // Category filter
    if (query.category) {
      const categoryResults = new Set<string>(
        this.indexes.categoryIndex[query.category.toLowerCase()] || []
      );
      resultSets.push(categoryResults);
      indexesUsed.push('category');
    }

    // Sub-category filter
    if (query.subCategory) {
      const subCategoryResults = new Set<string>(
        this.indexes.subCategoryIndex[query.subCategory.toLowerCase()] || []
      );
      resultSets.push(subCategoryResults);
      indexesUsed.push('sub-category');
    }

    // Status filter
    if (query.status && query.status.length > 0) {
      const statusResults = new Set<string>();

      for (const status of query.status) {
        const sessionIds = this.indexes.statusIndex[status] || [];
        sessionIds.forEach(id => statusResults.add(id));
      }

      resultSets.push(statusResults);
      indexesUsed.push('status');
    }

    // Combine result sets using AND or OR
    let finalResults: Set<string>;

    if (resultSets.length === 0) {
      // No filters - return all sessions
      finalResults = new Set<string>();
    } else if (query.operator === 'OR') {
      // OR: Union of all sets
      finalResults = this.unionSets(resultSets);
    } else {
      // AND: Intersection of all sets (default)
      finalResults = this.intersectSets(resultSets);
    }

    const took = performance.now() - start;
    const sessionIds = Array.from(finalResults);

    return {
      sessionIds,
      count: sessionIds.length,
      took,
      indexesUsed,
    };
  }

  /**
   * Search by text only (convenience method)
   */
  async searchText(text: string): Promise<string[]> {
    const result = await this.search({ text });
    return result.sessionIds;
  }

  /**
   * Search by topic only (convenience method)
   */
  async searchByTopic(topicId: string): Promise<string[]> {
    const result = await this.search({ topicIds: [topicId] });
    return result.sessionIds;
  }

  /**
   * Search by tag only (convenience method)
   */
  async searchByTag(tag: string): Promise<string[]> {
    const result = await this.search({ tags: [tag] });
    return result.sessionIds;
  }

  /**
   * Search by date range only (convenience method)
   */
  async searchByDateRange(start: number, end: number): Promise<string[]> {
    const result = await this.search({ dateRange: { start, end } });
    return result.sessionIds;
  }

  /**
   * Search by category only (convenience method)
   */
  async searchByCategory(category: string): Promise<string[]> {
    const result = await this.search({ category });
    return result.sessionIds;
  }

  /**
   * Search by status only (convenience method)
   */
  async searchByStatus(status: Session['status'][]): Promise<string[]> {
    const result = await this.search({ status });
    return result.sessionIds;
  }

  // ============================================================================
  // Index Management
  // ============================================================================

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<IndexStats> {
    await this.ensureIndexesLoaded();

    if (!this.indexes) {
      throw new Error('Indexes not loaded');
    }

    return {
      topicIndex: {
        topics: Object.keys(this.indexes.topicIndex).length,
        entries: this.countEntries(this.indexes.topicIndex),
        size: this.estimateSize(this.indexes.topicIndex),
      },
      dateIndex: {
        dates: Object.keys(this.indexes.dateIndex).length,
        entries: this.countEntries(this.indexes.dateIndex),
        size: this.estimateSize(this.indexes.dateIndex),
      },
      tagIndex: {
        tags: Object.keys(this.indexes.tagIndex).length,
        entries: this.countEntries(this.indexes.tagIndex),
        size: this.estimateSize(this.indexes.tagIndex),
      },
      fullTextIndex: {
        words: Object.keys(this.indexes.fullTextIndex).length,
        entries: this.countEntries(this.indexes.fullTextIndex),
        size: this.estimateSize(this.indexes.fullTextIndex),
      },
      categoryIndex: {
        categories: Object.keys(this.indexes.categoryIndex).length,
        entries: this.countEntries(this.indexes.categoryIndex),
        size: this.estimateSize(this.indexes.categoryIndex),
      },
      subCategoryIndex: {
        subCategories: Object.keys(this.indexes.subCategoryIndex).length,
        entries: this.countEntries(this.indexes.subCategoryIndex),
        size: this.estimateSize(this.indexes.subCategoryIndex),
      },
      statusIndex: {
        statuses: Object.keys(this.indexes.statusIndex).length,
        entries: this.countEntries(this.indexes.statusIndex),
        size: this.estimateSize(this.indexes.statusIndex),
      },
      lastBuilt: this.indexes.metadata.lastBuilt,
      lastOptimized: this.indexes.metadata.lastOptimized,
      version: this.indexes.metadata.version,
    };
  }

  /**
   * Verify index integrity
   */
  async verifyIntegrity(sessions: SessionMetadata[]): Promise<IntegrityCheckResult> {
    await this.ensureIndexesLoaded();

    if (!this.indexes) {
      return {
        valid: false,
        errors: ['Indexes not loaded'],
        warnings: [],
        sessionsChecked: 0,
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let sessionsChecked = 0;

    // Check that all sessions are in indexes
    for (const session of sessions) {
      sessionsChecked++;

      // Check date index
      const dateKey = this.getDateKey(session.startTime);
      if (!this.indexes.dateIndex[dateKey]?.includes(session.id)) {
        errors.push(`Session ${session.id} missing from date index (${dateKey})`);
      }

      // Check status index
      if (!this.indexes.statusIndex[session.status]?.includes(session.id)) {
        errors.push(`Session ${session.id} missing from status index (${session.status})`);
      }

      // Check tags
      for (const tag of session.tags) {
        const normalizedTag = this.normalizeTag(tag);
        if (!this.indexes.tagIndex[normalizedTag]?.includes(session.id)) {
          warnings.push(`Session ${session.id} missing from tag index (${tag})`);
        }
      }
    }

    // Check for orphaned entries (session IDs in indexes but not in sessions)
    const sessionIds = new Set(sessions.map(s => s.id));
    const allIndexedIds = new Set<string>();

    for (const index of [
      this.indexes.dateIndex,
      this.indexes.statusIndex,
      this.indexes.tagIndex,
      this.indexes.topicIndex,
      this.indexes.fullTextIndex,
      this.indexes.categoryIndex,
      this.indexes.subCategoryIndex,
    ]) {
      for (const key in index) {
        for (const id of index[key]) {
          if (!sessionIds.has(id)) {
            errors.push(`Orphaned session ID ${id} in index`);
          }
          allIndexedIds.add(id);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sessionsChecked,
    };
  }

  /**
   * Optimize indexes (remove duplicates, compact)
   */
  async optimizeIndexes(): Promise<void> {
    await this.ensureIndexesLoaded();

    if (!this.indexes) {
      throw new Error('Indexes not loaded');
    }

    console.log('[InvertedIndexManager] Optimizing indexes...');
    const start = performance.now();

    // Remove duplicates from all indexes
    this.optimizeIndex(this.indexes.topicIndex);
    this.optimizeIndex(this.indexes.dateIndex);
    this.optimizeIndex(this.indexes.tagIndex);
    this.optimizeIndex(this.indexes.fullTextIndex);
    this.optimizeIndex(this.indexes.categoryIndex);
    this.optimizeIndex(this.indexes.subCategoryIndex);
    this.optimizeIndex(this.indexes.statusIndex);

    // Update metadata
    this.indexes.metadata.lastOptimized = Date.now();

    // Save optimized indexes
    await this.saveIndexes(this.indexes);

    const took = performance.now() - start;
    console.log(`[InvertedIndexManager] Optimized indexes in ${took.toFixed(2)}ms`);
  }

  /**
   * Optimize a single index (remove duplicates)
   */
  private optimizeIndex(index: Record<string, string[]>): void {
    for (const key in index) {
      // Remove duplicates
      index[key] = [...new Set(index[key])];

      // Remove empty entries
      if (index[key].length === 0) {
        delete index[key];
      }
    }
  }

  /**
   * Clear all indexes
   */
  async clearIndexes(): Promise<void> {
    console.log('[InvertedIndexManager] Clearing all indexes...');

    try {
      await this.storage.delete(`${this.INDEX_PREFIX}`);
      this.indexes = null;
    } catch (error) {
      console.error('[InvertedIndexManager] Failed to clear indexes:', error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Ensure indexes are loaded into memory
   */
  private async ensureIndexesLoaded(): Promise<void> {
    if (this.indexes) {
      return;
    }

    try {
      const loaded = await this.storage.load<Indexes>(this.INDEX_PREFIX);

      if (loaded && this.isValidIndexes(loaded)) {
        this.indexes = loaded;
        console.log('[InvertedIndexManager] Indexes loaded from storage');
      } else {
        console.log('[InvertedIndexManager] No valid indexes found, will need to build');
        this.indexes = null;
      }
    } catch (error) {
      console.error('[InvertedIndexManager] Failed to load indexes:', error);
      this.indexes = null;
    }
  }

  /**
   * Validate indexes structure
   */
  private isValidIndexes(indexes: any): indexes is Indexes {
    return (
      indexes &&
      typeof indexes === 'object' &&
      typeof indexes.topicIndex === 'object' &&
      typeof indexes.dateIndex === 'object' &&
      typeof indexes.tagIndex === 'object' &&
      typeof indexes.fullTextIndex === 'object' &&
      typeof indexes.categoryIndex === 'object' &&
      typeof indexes.subCategoryIndex === 'object' &&
      typeof indexes.statusIndex === 'object' &&
      typeof indexes.metadata === 'object' &&
      typeof indexes.metadata.version === 'number'
    );
  }

  /**
   * Save indexes to storage
   */
  private async saveIndexes(indexes: Indexes): Promise<void> {
    await this.storage.save(this.INDEX_PREFIX, indexes);
  }

  /**
   * Get date key for indexing (YYYY-MM format)
   */
  private getDateKey(timestamp: string | number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Get all date keys in a range
   */
  private getDateKeysInRange(start: number, end: number): string[] {
    const keys: string[] = [];
    const startDate = new Date(start);
    const endDate = new Date(end);

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= endMonth) {
      keys.push(this.getDateKey(current.getTime()));
      current.setMonth(current.getMonth() + 1);
    }

    return keys;
  }

  /**
   * Normalize a tag for indexing (lowercase, trim)
   */
  private normalizeTag(tag: string): string {
    return tag.toLowerCase().trim();
  }

  /**
   * Tokenize text for full-text search
   * Simple whitespace + punctuation splitting
   */
  private tokenize(text: string): string[] {
    // Remove punctuation and split by whitespace
    const cleaned = text.replace(/[^\w\s]/g, ' ');
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);

    // Remove common stop words
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);

    return words.filter(w => !stopWords.has(w) && w.length >= 2);
  }

  /**
   * Intersect multiple sets (AND operation)
   */
  private intersectSets(sets: Set<string>[]): Set<string> {
    if (sets.length === 0) {
      return new Set();
    }

    // Start with first set
    let result = new Set(sets[0]);

    // Intersect with remaining sets
    for (let i = 1; i < sets.length; i++) {
      const intersection = new Set<string>();
      for (const item of result) {
        if (sets[i].has(item)) {
          intersection.add(item);
        }
      }
      result = intersection;
    }

    return result;
  }

  /**
   * Union multiple sets (OR operation)
   */
  private unionSets(sets: Set<string>[]): Set<string> {
    const result = new Set<string>();

    for (const set of sets) {
      for (const item of set) {
        result.add(item);
      }
    }

    return result;
  }

  /**
   * Count total entries in an index
   */
  private countEntries(index: Record<string, string[]>): number {
    let count = 0;
    for (const key in index) {
      count += index[key].length;
    }
    return count;
  }

  /**
   * Estimate size of an index in bytes
   */
  private estimateSize(index: Record<string, string[]>): number {
    return JSON.stringify(index).length;
  }

  /**
   * Get session count from storage
   */
  private async getSessionCount(): Promise<number> {
    try {
      const sessionIndex = await this.storage.load<string[]>('session-index');
      return sessionIndex?.length || 0;
    } catch {
      return 0;
    }
  }
}

/**
 * Get singleton instance (for convenience)
 */
let instance: InvertedIndexManager | null = null;

export async function getInvertedIndexManager(): Promise<InvertedIndexManager> {
  if (instance) {
    return instance;
  }

  const { getStorage } = await import('./index');
  const storage = await getStorage();
  instance = new InvertedIndexManager(storage);
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetInvertedIndexManager(): void {
  instance = null;
}
