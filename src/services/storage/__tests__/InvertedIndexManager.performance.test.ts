/**
 * InvertedIndexManager Performance Tests
 *
 * Comprehensive performance benchmarks with different dataset sizes
 * Target: <100ms search time for 1000+ sessions
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
// Test Data Factory
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
      name: `Session ${i}: ${['Bug fix', 'Feature', 'Meeting', 'Research'][i % 4]}`,
      description: `Description for session ${i} with keyword-${i % 10} and topic-${i % 5}`,
      startTime: new Date(2024, month - 1, (i % 28) + 1).toISOString(),
      status,
      tags: [`tag-${i % 5}`, `category-${i % 3}`, `priority-${i % 4}`],
      category: `Category ${i % 4}`,
      subCategory: `SubCategory ${i % 6}`,
    }));
  }

  return sessions;
}

// ============================================================================
// Performance Test Suite
// ============================================================================

describe('InvertedIndexManager - Performance Benchmarks', () => {
  let storage: MockStorageAdapter;
  let manager: InvertedIndexManager;

  beforeEach(() => {
    resetInvertedIndexManager();
    storage = new MockStorageAdapter();
    manager = new InvertedIndexManager(storage as any);
  });

  // ==========================================================================
  // Build Performance Tests
  // ==========================================================================

  describe('Build Performance', () => {
    it('should build indexes for 100 sessions in <1s', async () => {
      const sessions = createManySessions(100);

      const start = performance.now();
      await manager.buildIndexes(sessions);
      const took = performance.now() - start;

      console.log(`Build 100 sessions: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(1000);

      const stats = await manager.getIndexStats();
      expect(stats.dateIndex.dates).toBeGreaterThan(0);
      expect(stats.tagIndex.tags).toBeGreaterThan(0);
    });

    it('should build indexes for 500 sessions in <3s', async () => {
      const sessions = createManySessions(500);

      const start = performance.now();
      await manager.buildIndexes(sessions);
      const took = performance.now() - start;

      console.log(`Build 500 sessions: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(3000);

      const stats = await manager.getIndexStats();
      console.log('Index stats for 500 sessions:', {
        dates: stats.dateIndex.dates,
        tags: stats.tagIndex.tags,
        words: stats.fullTextIndex.words,
        categories: stats.categoryIndex.categories,
      });
    });

    it('should build indexes for 1000 sessions in <5s', async () => {
      const sessions = createManySessions(1000);

      const start = performance.now();
      await manager.buildIndexes(sessions);
      const took = performance.now() - start;

      console.log(`Build 1000 sessions: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(5000);

      const stats = await manager.getIndexStats();
      console.log('Index stats for 1000 sessions:', {
        dates: stats.dateIndex.dates,
        tags: stats.tagIndex.tags,
        words: stats.fullTextIndex.words,
        categories: stats.categoryIndex.categories,
        dateIndexSize: (stats.dateIndex.size / 1024).toFixed(2) + ' KB',
        tagIndexSize: (stats.tagIndex.size / 1024).toFixed(2) + ' KB',
        fullTextIndexSize: (stats.fullTextIndex.size / 1024).toFixed(2) + ' KB',
      });
    });
  });

  // ==========================================================================
  // Update Performance Tests
  // ==========================================================================

  describe('Update Performance', () => {
    it('should update single session index in <10ms', async () => {
      const sessions = createManySessions(100);
      await manager.buildIndexes(sessions);

      const newSession = createMockSession({
        id: 'new-session',
        tags: ['new-tag'],
      });

      const start = performance.now();
      await manager.updateIndexes(newSession);
      const took = performance.now() - start;

      console.log(`Update single session: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(10);
    });

    it('should handle 10 updates in <100ms', async () => {
      const sessions = createManySessions(100);
      await manager.buildIndexes(sessions);

      const start = performance.now();

      for (let i = 0; i < 10; i++) {
        const newSession = createMockSession({
          id: `update-${i}`,
          tags: [`tag-${i}`],
        });
        await manager.updateIndexes(newSession);
      }

      const took = performance.now() - start;

      console.log(`10 updates: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(100);
    });
  });

  // ==========================================================================
  // Search Performance Tests (100 sessions)
  // ==========================================================================

  describe('Search Performance - 100 Sessions', () => {
    beforeEach(async () => {
      const sessions = createManySessions(100);
      await manager.buildIndexes(sessions);
    });

    it('should search by text in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({ text: 'bug' });
      const took = performance.now() - start;

      console.log(`Text search (100 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should search by tag in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({ tags: ['tag-0'] });
      const took = performance.now() - start;

      console.log(`Tag search (100 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should search by date range in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({
        dateRange: {
          start: new Date('2024-01-01').getTime(),
          end: new Date('2024-03-31').getTime(),
        },
      });
      const took = performance.now() - start;

      console.log(`Date search (100 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should perform complex query in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({
        text: 'session',
        tags: ['tag-0'],
        category: 'Category 0',
        status: ['completed'],
        operator: 'AND',
      });
      const took = performance.now() - start;

      console.log(`Complex query (100 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });
  });

  // ==========================================================================
  // Search Performance Tests (500 sessions)
  // ==========================================================================

  describe('Search Performance - 500 Sessions', () => {
    beforeEach(async () => {
      const sessions = createManySessions(500);
      await manager.buildIndexes(sessions);
    });

    it('should search by text in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({ text: 'feature' });
      const took = performance.now() - start;

      console.log(`Text search (500 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should search by tag in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({ tags: ['tag-1'] });
      const took = performance.now() - start;

      console.log(`Tag search (500 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should search by category in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({ category: 'Category 1' });
      const took = performance.now() - start;

      console.log(`Category search (500 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should perform complex query in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({
        text: 'keyword',
        tags: ['tag-2'],
        category: 'Category 2',
        status: ['completed', 'interrupted'],
        operator: 'AND',
      });
      const took = performance.now() - start;

      console.log(`Complex query (500 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });
  });

  // ==========================================================================
  // Search Performance Tests (1000 sessions)
  // ==========================================================================

  describe('Search Performance - 1000 Sessions', () => {
    beforeEach(async () => {
      const sessions = createManySessions(1000);
      await manager.buildIndexes(sessions);
    });

    it('should search by text in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({ text: 'meeting' });
      const took = performance.now() - start;

      console.log(`Text search (1000 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should search by tag in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({ tags: ['tag-3'] });
      const took = performance.now() - start;

      console.log(`Tag search (1000 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should search by date range in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({
        dateRange: {
          start: new Date('2024-06-01').getTime(),
          end: new Date('2024-09-30').getTime(),
        },
      });
      const took = performance.now() - start;

      console.log(`Date search (1000 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should search by status in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({
        status: ['completed'],
      });
      const took = performance.now() - start;

      console.log(`Status search (1000 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should perform complex query with 4 filters in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({
        text: 'keyword',
        tags: ['tag-4'],
        category: 'Category 3',
        status: ['completed'],
        operator: 'AND',
      });
      const took = performance.now() - start;

      console.log(`Complex 4-filter query (1000 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });

    it('should perform OR query in <100ms', async () => {
      const start = performance.now();
      const result = await manager.search({
        tags: ['tag-0', 'tag-1', 'tag-2'],
        operator: 'OR',
      });
      const took = performance.now() - start;

      console.log(`OR query (1000 sessions): ${took.toFixed(2)}ms, ${result.count} results`);
      expect(took).toBeLessThan(100);
    });
  });

  // ==========================================================================
  // Concurrent Search Performance
  // ==========================================================================

  describe('Concurrent Search Performance', () => {
    it('should handle 10 concurrent searches in <500ms', async () => {
      const sessions = createManySessions(1000);
      await manager.buildIndexes(sessions);

      const start = performance.now();

      const searches = [
        manager.search({ text: 'bug' }),
        manager.search({ tags: ['tag-0'] }),
        manager.search({ category: 'Category 0' }),
        manager.search({ status: ['completed'] }),
        manager.search({ text: 'feature', tags: ['tag-1'], operator: 'AND' }),
        manager.search({ text: 'meeting' }),
        manager.search({ tags: ['tag-2', 'tag-3'], operator: 'OR' }),
        manager.search({ category: 'Category 1', status: ['active'], operator: 'AND' }),
        manager.search({ text: 'research' }),
        manager.search({ dateRange: { start: new Date('2024-01-01').getTime(), end: new Date('2024-12-31').getTime() } }),
      ];

      const results = await Promise.all(searches);
      const took = performance.now() - start;

      console.log(`10 concurrent searches (1000 sessions): ${took.toFixed(2)}ms`);
      console.log('Results:', results.map(r => r.count));
      expect(took).toBeLessThan(500);
    });

    it('should handle 20 concurrent searches in <1s', async () => {
      const sessions = createManySessions(500);
      await manager.buildIndexes(sessions);

      const start = performance.now();

      const searches = Array.from({ length: 20 }, (_, i) =>
        manager.search({
          text: `keyword-${i % 10}`,
          tags: [`tag-${i % 5}`],
          operator: 'AND',
        })
      );

      await Promise.all(searches);
      const took = performance.now() - start;

      console.log(`20 concurrent searches (500 sessions): ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(1000);
    });
  });

  // ==========================================================================
  // Optimization Performance
  // ==========================================================================

  describe('Optimization Performance', () => {
    it('should optimize 1000-session indexes in <500ms', async () => {
      const sessions = createManySessions(1000);
      await manager.buildIndexes(sessions);

      const start = performance.now();
      await manager.optimizeIndexes();
      const took = performance.now() - start;

      console.log(`Optimize 1000 sessions: ${took.toFixed(2)}ms`);
      expect(took).toBeLessThan(500);
    });
  });

  // ==========================================================================
  // Scalability Tests
  // ==========================================================================

  describe('Scalability', () => {
    it('should scale linearly with dataset size', async () => {
      const sizes = [100, 500, 1000];
      const times: number[] = [];

      for (const size of sizes) {
        const sessions = createManySessions(size);
        await manager.buildIndexes(sessions);

        const start = performance.now();
        await manager.search({ text: 'session' });
        const took = performance.now() - start;

        times.push(took);
        console.log(`Search time for ${size} sessions: ${took.toFixed(2)}ms`);

        // Reset for next iteration
        await manager.clearIndexes();
      }

      // All should be under 100ms
      expect(times.every(t => t < 100)).toBe(true);
    });
  });
});
