/**
 * InvertedIndexManager Tests
 *
 * Comprehensive test suite for inverted index manager
 * Target: 80%+ coverage, all edge cases, <100ms search times
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvertedIndexManager, resetInvertedIndexManager } from '../InvertedIndexManager';
import type { SessionMetadata } from '../ChunkedSessionStorage';
import type { StorageAdapter } from '../StorageAdapter';

// ============================================================================
// Mock Storage Adapter
// ============================================================================

class MockStorageAdapter implements Partial<StorageAdapter> {
  private store = new Map<string, any>();

  async init(): Promise<void> {}

  async save<T>(key: string, data: T): Promise<void> {
    this.store.set(key, JSON.parse(JSON.stringify(data)));
  }

  async load<T>(key: string): Promise<T | null> {
    const data = this.store.get(key);
    return data ? JSON.parse(JSON.stringify(data)) : null;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// ============================================================================
// Test Data Factories
// ============================================================================

function createMockSession(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  const id = overrides.id || `session-${Math.random().toString(36).substr(2, 9)}`;

  return {
    id,
    name: 'Test Session',
    description: 'A test session description',
    status: 'completed',
    startTime: new Date('2024-01-15T10:00:00Z').toISOString(),
    endTime: new Date('2024-01-15T12:00:00Z').toISOString(),
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'off',
    audioRecording: false,
    extractedTaskIds: [],
    extractedNoteIds: [],
    chunks: {
      screenshots: { count: 0, chunkCount: 0, chunkSize: 20 },
      audioSegments: { count: 0, chunkCount: 0, chunkSize: 100 },
      videoChunks: { count: 0, chunkCount: 0, chunkSize: 100 },
    },
    tags: [],
    hasSummary: false,
    hasAudioInsights: false,
    hasCanvasSpec: false,
    hasTranscription: false,
    hasVideo: false,
    hasFullAudio: false,
    audioReviewCompleted: false,
    storageVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createManySessions(count: number): SessionMetadata[] {
  const sessions: SessionMetadata[] = [];

  for (let i = 0; i < count; i++) {
    const month = (i % 12) + 1;
    const status = (['completed', 'interrupted', 'active', 'paused'] as const)[i % 4];

    sessions.push(createMockSession({
      id: `session-${i}`,
      name: `Session ${i}`,
      description: `Description for session ${i} with keyword-${i % 10}`,
      startTime: new Date(2024, month - 1, 15).toISOString(),
      status,
      tags: [`tag-${i % 5}`, `category-${i % 3}`],
      category: `Category ${i % 4}`,
      subCategory: `SubCategory ${i % 6}`,
    }));
  }

  return sessions;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('InvertedIndexManager', () => {
  let storage: MockStorageAdapter;
  let manager: InvertedIndexManager;

  beforeEach(() => {
    resetInvertedIndexManager();
    storage = new MockStorageAdapter();
    manager = new InvertedIndexManager(storage as any);
  });

  // ==========================================================================
  // Index Building Tests
  // ==========================================================================

  describe('Index Building', () => {
    it('should build all indexes from empty sessions', async () => {
      await manager.buildIndexes([]);

      const stats = await manager.getIndexStats();
      expect(stats.dateIndex.dates).toBe(0);
      expect(stats.tagIndex.tags).toBe(0);
      expect(stats.fullTextIndex.words).toBe(0);
      expect(stats.statusIndex.statuses).toBe(0);
    });

    it('should build topic index from sessions', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          extractedNoteIds: ['note-1', 'note-2'],
        }),
        createMockSession({
          id: 'session-2',
          extractedNoteIds: ['note-1'],
        }),
      ];

      await manager.buildIndexes(sessions);

      const stats = await manager.getIndexStats();
      expect(stats).toBeDefined();
    });

    it('should build date index from sessions', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          startTime: new Date('2024-01-15T10:00:00Z').toISOString(),
        }),
        createMockSession({
          id: 'session-2',
          startTime: new Date('2024-02-20T10:00:00Z').toISOString(),
        }),
        createMockSession({
          id: 'session-3',
          startTime: new Date('2024-01-25T10:00:00Z').toISOString(),
        }),
      ];

      await manager.buildIndexes(sessions);

      // Search by date range (all of January 2024)
      const januaryResults = await manager.searchByDateRange(
        new Date('2024-01-01').getTime(),
        new Date('2024-01-31').getTime()
      );

      expect(januaryResults).toContain('session-1');
      expect(januaryResults).toContain('session-3');
      expect(januaryResults).not.toContain('session-2');
    });

    it('should build tag index from sessions', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          tags: ['coding', 'typescript'],
        }),
        createMockSession({
          id: 'session-2',
          tags: ['coding', 'rust'],
        }),
        createMockSession({
          id: 'session-3',
          tags: ['design', 'ui'],
        }),
      ];

      await manager.buildIndexes(sessions);

      const codingResults = await manager.searchByTag('coding');
      expect(codingResults).toContain('session-1');
      expect(codingResults).toContain('session-2');
      expect(codingResults).not.toContain('session-3');

      const designResults = await manager.searchByTag('design');
      expect(designResults).toContain('session-3');
      expect(designResults).not.toContain('session-1');
    });

    it('should build full-text index from sessions', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          name: 'Fix authentication bug',
          description: 'Working on OAuth login issue',
        }),
        createMockSession({
          id: 'session-2',
          name: 'Add new feature',
          description: 'Implementing user profile page',
        }),
        createMockSession({
          id: 'session-3',
          name: 'Fix database bug',
          description: 'Query optimization work',
        }),
      ];

      await manager.buildIndexes(sessions);

      const bugResults = await manager.searchText('bug');
      expect(bugResults).toContain('session-1');
      expect(bugResults).toContain('session-3');
      expect(bugResults).not.toContain('session-2');

      const featureResults = await manager.searchText('feature');
      expect(featureResults).toContain('session-2');
      expect(featureResults).not.toContain('session-1');
    });

    it('should handle sessions with no topics', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          extractedNoteIds: [],
        }),
      ];

      await manager.buildIndexes(sessions);
      const stats = await manager.getIndexStats();
      expect(stats).toBeDefined();
    });

    it('should handle sessions with no tags', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          tags: [],
        }),
      ];

      await manager.buildIndexes(sessions);
      const stats = await manager.getIndexStats();
      expect(stats.tagIndex.tags).toBe(0);
    });

    it('should handle sessions with empty descriptions', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          name: 'Test',
          description: '',
        }),
      ];

      await manager.buildIndexes(sessions);
      const results = await manager.searchText('test');
      expect(results).toContain('session-1');
    });

    it('should handle large datasets (1000+ sessions)', async () => {
      const sessions = createManySessions(1000);

      const start = performance.now();
      await manager.buildIndexes(sessions);
      const buildTime = performance.now() - start;

      console.log(`Build time for 1000 sessions: ${buildTime.toFixed(2)}ms`);
      expect(buildTime).toBeLessThan(5000); // <5s build time

      const stats = await manager.getIndexStats();
      expect(stats.dateIndex.dates).toBeGreaterThan(0);
      expect(stats.tagIndex.tags).toBeGreaterThan(0);
      expect(stats.fullTextIndex.words).toBeGreaterThan(0);
    });

    it('should build category index from sessions', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          category: 'Deep Work',
        }),
        createMockSession({
          id: 'session-2',
          category: 'Meetings',
        }),
        createMockSession({
          id: 'session-3',
          category: 'Deep Work',
        }),
      ];

      await manager.buildIndexes(sessions);

      const deepWorkResults = await manager.searchByCategory('Deep Work');
      expect(deepWorkResults).toContain('session-1');
      expect(deepWorkResults).toContain('session-3');
      expect(deepWorkResults).not.toContain('session-2');
    });

    it('should build status index from sessions', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', status: 'completed' }),
        createMockSession({ id: 'session-2', status: 'interrupted' }),
        createMockSession({ id: 'session-3', status: 'completed' }),
      ];

      await manager.buildIndexes(sessions);

      const completedResults = await manager.searchByStatus(['completed']);
      expect(completedResults).toContain('session-1');
      expect(completedResults).toContain('session-3');
      expect(completedResults).not.toContain('session-2');
    });
  });

  // ==========================================================================
  // Incremental Update Tests
  // ==========================================================================

  describe('Incremental Updates', () => {
    it('should update indexes when session added', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', tags: ['coding'] }),
      ];

      await manager.buildIndexes(sessions);

      // Add new session
      const newSession = createMockSession({ id: 'session-2', tags: ['coding', 'new'] });
      await manager.updateIndexes(newSession);

      const results = await manager.searchByTag('new');
      expect(results).toContain('session-2');
    });

    it('should update indexes when session modified', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', tags: ['old'] }),
      ];

      await manager.buildIndexes(sessions);

      // Update session with new tags
      const updated = createMockSession({ id: 'session-1', tags: ['new'] });
      await manager.updateIndexes(updated);

      const oldResults = await manager.searchByTag('old');
      expect(oldResults).not.toContain('session-1');

      const newResults = await manager.searchByTag('new');
      expect(newResults).toContain('session-1');
    });

    it('should remove session from indexes when deleted', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', tags: ['coding'] }),
        createMockSession({ id: 'session-2', tags: ['coding'] }),
      ];

      await manager.buildIndexes(sessions);

      // Delete session
      await manager.deleteFromIndexes('session-1');

      const results = await manager.searchByTag('coding');
      expect(results).not.toContain('session-1');
      expect(results).toContain('session-2');
    });

    it('should handle concurrent updates', async () => {
      const sessions = [createMockSession({ id: 'session-1' })];
      await manager.buildIndexes(sessions);

      // Simulate concurrent updates
      const updates = [
        manager.updateIndexes(createMockSession({ id: 'session-2', tags: ['a'] })),
        manager.updateIndexes(createMockSession({ id: 'session-3', tags: ['b'] })),
        manager.updateIndexes(createMockSession({ id: 'session-4', tags: ['c'] })),
      ];

      await Promise.all(updates);

      const results = await manager.searchByTag('a');
      expect(results).toContain('session-2');
    });
  });

  // ==========================================================================
  // Search Operation Tests
  // ==========================================================================

  describe('Search Operations', () => {
    beforeEach(async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          name: 'Fix bug in authentication',
          description: 'OAuth login issue',
          tags: ['coding', 'bug'],
          category: 'Deep Work',
          status: 'completed',
          startTime: new Date('2024-01-15').toISOString(),
        }),
        createMockSession({
          id: 'session-2',
          name: 'Add user profile feature',
          description: 'Implementing new feature',
          tags: ['coding', 'feature'],
          category: 'Deep Work',
          status: 'completed',
          startTime: new Date('2024-02-10').toISOString(),
        }),
        createMockSession({
          id: 'session-3',
          name: 'Client meeting',
          description: 'Discussing project roadmap',
          tags: ['meeting', 'planning'],
          category: 'Meetings',
          status: 'completed',
          startTime: new Date('2024-01-20').toISOString(),
        }),
      ];

      await manager.buildIndexes(sessions);
    });

    it('should search by topic', async () => {
      const start = performance.now();
      const results = await manager.searchByTopic('topic-1');
      const took = performance.now() - start;

      console.log(`Topic search took ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
    });

    it('should search by date range', async () => {
      const start = performance.now();
      const results = await manager.searchByDateRange(
        new Date('2024-01-01').getTime(),
        new Date('2024-01-31').getTime()
      );
      const took = performance.now() - start;

      console.log(`Date search took ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
      expect(results).toContain('session-1');
      expect(results).toContain('session-3');
      expect(results).not.toContain('session-2');
    });

    it('should search by tag', async () => {
      const start = performance.now();
      const results = await manager.searchByTag('coding');
      const took = performance.now() - start;

      console.log(`Tag search took ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
      expect(results).toContain('session-1');
      expect(results).toContain('session-2');
      expect(results).not.toContain('session-3');
    });

    it('should perform full-text search', async () => {
      const start = performance.now();
      const results = await manager.searchText('bug');
      const took = performance.now() - start;

      console.log(`Full-text search took ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
      expect(results).toContain('session-1');
      expect(results).not.toContain('session-2');
    });

    it('should combine filters with AND operator', async () => {
      const result = await manager.search({
        tags: ['coding'],
        category: 'Deep Work',
        operator: 'AND',
      });

      expect(result.sessionIds).toContain('session-1');
      expect(result.sessionIds).toContain('session-2');
      expect(result.sessionIds).not.toContain('session-3');
      expect(result.took).toBeLessThan(100);
    });

    it('should combine filters with OR operator', async () => {
      const result = await manager.search({
        tags: ['meeting'],
        category: 'Deep Work',
        operator: 'OR',
      });

      expect(result.sessionIds).toContain('session-1');
      expect(result.sessionIds).toContain('session-2');
      expect(result.sessionIds).toContain('session-3');
    });

    it('should handle no results gracefully', async () => {
      const results = await manager.searchByTag('nonexistent');
      expect(results).toEqual([]);
    });

    it('should handle invalid queries gracefully', async () => {
      const result = await manager.search({});
      expect(result.sessionIds).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should search by category', async () => {
      const results = await manager.searchByCategory('Deep Work');
      expect(results).toContain('session-1');
      expect(results).toContain('session-2');
      expect(results).not.toContain('session-3');
    });

    it('should search by status', async () => {
      const results = await manager.searchByStatus(['completed']);
      expect(results).toContain('session-1');
      expect(results).toContain('session-2');
      expect(results).toContain('session-3');
    });

    it('should handle complex multi-filter query', async () => {
      const start = performance.now();
      const result = await manager.search({
        text: 'feature',
        tags: ['coding'],
        category: 'Deep Work',
        status: ['completed'],
        operator: 'AND',
      });
      const took = performance.now() - start;

      console.log(`Complex query took ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
      expect(result.sessionIds).toContain('session-2');
      expect(result.sessionIds).not.toContain('session-1');
      expect(result.sessionIds).not.toContain('session-3');
    });
  });

  // ==========================================================================
  // Query Performance Tests
  // ==========================================================================

  describe('Query Performance', () => {
    it('should search 100 sessions in <100ms', async () => {
      const sessions = createManySessions(100);
      await manager.buildIndexes(sessions);

      const start = performance.now();
      await manager.search({ text: 'session' });
      const took = performance.now() - start;

      console.log(`Search 100 sessions: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
    });

    it('should search 500 sessions in <100ms', async () => {
      const sessions = createManySessions(500);
      await manager.buildIndexes(sessions);

      const start = performance.now();
      await manager.search({ text: 'keyword' });
      const took = performance.now() - start;

      console.log(`Search 500 sessions: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
    });

    it('should search 1000 sessions in <100ms', async () => {
      const sessions = createManySessions(1000);
      await manager.buildIndexes(sessions);

      const start = performance.now();
      await manager.search({ text: 'description' });
      const took = performance.now() - start;

      console.log(`Search 1000 sessions: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
    });

    it('should handle complex multi-filter query in <100ms', async () => {
      const sessions = createManySessions(1000);
      await manager.buildIndexes(sessions);

      const start = performance.now();
      await manager.search({
        text: 'keyword',
        tags: ['tag-0'],
        category: 'Category 0',
        status: ['completed'],
        operator: 'AND',
      });
      const took = performance.now() - start;

      console.log(`Complex query on 1000 sessions: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
    });

    it('should handle 10 concurrent searches in <500ms', async () => {
      const sessions = createManySessions(500);
      await manager.buildIndexes(sessions);

      const start = performance.now();

      const searches = Array.from({ length: 10 }, (_, i) =>
        manager.search({ text: `keyword-${i}` })
      );

      await Promise.all(searches);
      const took = performance.now() - start;

      console.log(`10 concurrent searches: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(500);
    });
  });

  // ==========================================================================
  // Index Integrity Tests
  // ==========================================================================

  describe('Index Integrity', () => {
    it('should verify index integrity', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', tags: ['coding'] }),
        createMockSession({ id: 'session-2', tags: ['design'] }),
      ];

      await manager.buildIndexes(sessions);

      const result = await manager.verifyIntegrity(sessions);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sessionsChecked).toBe(2);
    });

    it('should detect corrupted indexes (missing entries)', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', tags: ['coding'] }),
      ];

      await manager.buildIndexes(sessions);

      // Add session to sessions but not to indexes
      const newSessions = [
        ...sessions,
        createMockSession({ id: 'session-2', tags: ['design'] }),
      ];

      const result = await manager.verifyIntegrity(newSessions);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect orphaned index entries', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', tags: ['coding'] }),
        createMockSession({ id: 'session-2', tags: ['design'] }),
      ];

      await manager.buildIndexes(sessions);

      // Remove session-2 from sessions but leave in indexes
      const reducedSessions = sessions.filter(s => s.id !== 'session-2');

      const result = await manager.verifyIntegrity(reducedSessions);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Orphaned'))).toBe(true);
    });

    it('should rebuild corrupted indexes automatically', async () => {
      const sessions = createManySessions(100);

      // Intentionally corrupt indexes
      await manager.buildIndexes([sessions[0]]);

      // Rebuild with all sessions
      await manager.rebuildIndexes(sessions);

      const result = await manager.verifyIntegrity(sessions);
      expect(result.valid).toBe(true);
    });
  });

  // ==========================================================================
  // Index Optimization Tests
  // ==========================================================================

  describe('Index Optimization', () => {
    it('should compact indexes', async () => {
      const sessions = createManySessions(100);
      await manager.buildIndexes(sessions);

      await manager.optimizeIndexes();

      const stats = await manager.getIndexStats();
      expect(stats.lastOptimized).toBeGreaterThan(stats.lastBuilt - 1000);
    });

    it('should remove duplicate entries', async () => {
      const sessions = [
        createMockSession({ id: 'session-1', tags: ['coding'] }),
      ];

      await manager.buildIndexes(sessions);

      // Force duplicate by manually updating
      await manager.updateIndexes(sessions[0]);
      await manager.updateIndexes(sessions[0]);

      await manager.optimizeIndexes();

      const results = await manager.searchByTag('coding');
      expect(results.filter(id => id === 'session-1')).toHaveLength(1);
    });

    it('should calculate index stats', async () => {
      const sessions = createManySessions(100);
      await manager.buildIndexes(sessions);

      const stats = await manager.getIndexStats();

      expect(stats.dateIndex.dates).toBeGreaterThan(0);
      expect(stats.tagIndex.tags).toBeGreaterThan(0);
      expect(stats.fullTextIndex.words).toBeGreaterThan(0);
      expect(stats.statusIndex.statuses).toBeGreaterThan(0);
      expect(stats.categoryIndex.categories).toBeGreaterThan(0);
      expect(stats.dateIndex.size).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle sessions with special characters in names', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          name: 'Fix bug: "Cannot read property \'foo\' of undefined"',
          description: 'Working on @user/package-name issue #123',
        }),
      ];

      await manager.buildIndexes(sessions);

      const results = await manager.searchText('bug');
      expect(results).toContain('session-1');
    });

    it('should handle very long queries', async () => {
      const sessions = createManySessions(100);
      await manager.buildIndexes(sessions);

      const longQuery = 'session description keyword test bug feature issue problem solution ' +
        'code implementation design architecture pattern practice methodology approach';

      const start = performance.now();
      await manager.searchText(longQuery);
      const took = performance.now() - start;

      expect(took).toBeLessThan(100);
    });

    it('should handle case-insensitive searches', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          name: 'Fix Authentication Bug',
          tags: ['Coding', 'BUG'],
        }),
      ];

      await manager.buildIndexes(sessions);

      const textResults = await manager.searchText('authentication');
      expect(textResults).toContain('session-1');

      const tagResults = await manager.searchByTag('bug');
      expect(tagResults).toContain('session-1');
    });

    it('should handle sessions with many tags', async () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag-${i}`);

      const sessions = [
        createMockSession({ id: 'session-1', tags: manyTags }),
      ];

      await manager.buildIndexes(sessions);

      const results = await manager.searchByTag('tag-25');
      expect(results).toContain('session-1');
    });

    it('should handle date range spanning multiple years', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          startTime: new Date('2023-12-15').toISOString(),
        }),
        createMockSession({
          id: 'session-2',
          startTime: new Date('2024-01-15').toISOString(),
        }),
        createMockSession({
          id: 'session-3',
          startTime: new Date('2024-02-15').toISOString(),
        }),
      ];

      await manager.buildIndexes(sessions);

      const results = await manager.searchByDateRange(
        new Date('2023-12-01').getTime(),
        new Date('2024-01-31').getTime()
      );

      expect(results).toContain('session-1');
      expect(results).toContain('session-2');
      expect(results).not.toContain('session-3');
    });

    it('should handle empty string searches', async () => {
      const sessions = createManySessions(10);
      await manager.buildIndexes(sessions);

      const results = await manager.searchText('');
      expect(results).toEqual([]);
    });

    it('should handle searches with only stop words', async () => {
      const sessions = [
        createMockSession({
          id: 'session-1',
          name: 'The and or but in on',
        }),
      ];

      await manager.buildIndexes(sessions);

      const results = await manager.searchText('the and or but');
      expect(results).toEqual([]);
    });
  });

  // ==========================================================================
  // Clear Indexes Tests
  // ==========================================================================

  describe('Clear Indexes', () => {
    it('should clear all indexes', async () => {
      const sessions = createManySessions(50);
      await manager.buildIndexes(sessions);

      await manager.clearIndexes();

      // Indexes should be cleared
      await expect(manager.getIndexStats()).rejects.toThrow('Indexes not loaded');
    });

    it('should rebuild indexes after clearing', async () => {
      const sessions = createManySessions(50);
      await manager.buildIndexes(sessions);
      await manager.clearIndexes();

      await manager.buildIndexes(sessions);

      const stats = await manager.getIndexStats();
      expect(stats.dateIndex.dates).toBeGreaterThan(0);
    });
  });
});
