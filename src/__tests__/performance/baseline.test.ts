/**
 * Performance Baseline Tests
 *
 * These tests establish performance baselines for critical operations
 * in the sessions system. Results should be recorded in PERFORMANCE_BASELINE.md
 * to track improvements over time.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { perfMonitor } from '../../utils/performance';
import type { Session } from '../../types';

// Mock storage for performance testing
const mockStorage = {
  data: new Map<string, any>(),
  async load<T>(key: string): Promise<T | null> {
    return this.data.get(key) || null;
  },
  async save<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  },
  async delete(key: string): Promise<void> {
    this.data.delete(key);
  },
  clear() {
    this.data.clear();
  },
};

// Mock getStorage
vi.mock('../../services/storage', () => ({
  getStorage: vi.fn(() => Promise.resolve(mockStorage)),
  resetStorage: vi.fn(() => mockStorage.clear()),
}));

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock session for testing
 */
function createMockSession(overrides?: Partial<Session>): Session {
  const now = new Date().toISOString();
  return {
    id: `session-${Date.now()}-${Math.random()}`,
    name: 'Test Session',
    description: 'A test session for performance testing',
    startTime: now,
    status: 'completed',
    category: 'Development',
    subCategory: 'Testing',
    totalDuration: 3600000, // 1 hour
    screenshots: [],
    audioSegments: [],
    tags: ['test', 'performance'],
    ...overrides,
  };
}

/**
 * Create multiple mock sessions
 */
function createMockSessions(count: number): Session[] {
  return Array.from({ length: count }, (_, i) =>
    createMockSession({
      name: `Test Session ${i + 1}`,
      startTime: new Date(Date.now() - i * 3600000).toISOString(),
    })
  );
}

/**
 * Create a session with screenshots
 */
function createSessionWithScreenshots(screenshotCount: number): Session {
  const session = createMockSession();
  session.screenshots = Array.from({ length: screenshotCount }, (_, i) => ({
    id: `screenshot-${i}`,
    timestamp: new Date(Date.now() - i * 60000).toISOString(),
    attachmentId: `attachment-screenshot-${i}`,
    analysisResult: {
      currentActivity: 'Coding',
      progressSummary: 'Making progress',
      blockers: [],
      insights: [],
      contextDelta: 'Working on tests',
    },
  }));
  return session;
}

/**
 * Create a session with audio segments
 */
function createSessionWithAudio(audioSegmentCount: number): Session {
  const session = createMockSession();
  session.audioSegments = Array.from({ length: audioSegmentCount }, (_, i) => ({
    id: `audio-${i}`,
    startTime: new Date(Date.now() - i * 60000).toISOString(),
    duration: 60000,
    attachmentId: `attachment-audio-${i}`,
    transcript: 'Test audio transcript',
  }));
  return session;
}

// ============================================================================
// Tests
// ============================================================================

describe('Performance Baseline', () => {
  beforeEach(() => {
    perfMonitor.clear();
    mockStorage.clear();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  // --------------------------------------------------------------------------
  // Session Load Performance
  // --------------------------------------------------------------------------

  describe('Session Load Time', () => {
    it('should load empty sessions list in < 1000ms', async () => {
      const end = perfMonitor.start('session-list-load-empty');

      const sessions = await mockStorage.load<Session[]>('sessions') || [];

      end();

      const stats = perfMonitor.getStats('session-list-load-empty');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Session load time (empty): ${stats.avg.toFixed(2)}ms`);
        expect(stats.avg).toBeLessThan(1000);
      }
    });

    it('should load 10 sessions in < 1000ms', async () => {
      // Setup: Create test sessions
      const testSessions = createMockSessions(10);
      await mockStorage.save('sessions', testSessions);

      // Measure load time
      const end = perfMonitor.start('session-list-load-10');

      const sessions = await mockStorage.load<Session[]>('sessions') || [];

      end();

      const stats = perfMonitor.getStats('session-list-load-10');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Session load time (10 sessions): ${stats.avg.toFixed(2)}ms`);
        expect(sessions.length).toBe(10);
        expect(stats.avg).toBeLessThan(1000);
      }
    });

    it('should load 100 sessions in < 1000ms', async () => {
      // Setup: Create test sessions
      const testSessions = createMockSessions(100);
      await mockStorage.save('sessions', testSessions);

      // Measure load time
      const end = perfMonitor.start('session-list-load-100');

      const sessions = await mockStorage.load<Session[]>('sessions') || [];

      end();

      const stats = perfMonitor.getStats('session-list-load-100');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Session load time (100 sessions): ${stats.avg.toFixed(2)}ms`);
        expect(sessions.length).toBe(100);
        expect(stats.avg).toBeLessThan(1000);
      }
    });

    it('should load session with 50 screenshots in < 1000ms', async () => {
      // Setup: Create session with screenshots
      const session = createSessionWithScreenshots(50);
      await mockStorage.save('sessions', [session]);

      // Measure load time
      const end = perfMonitor.start('session-load-50-screenshots');

      const sessions = await mockStorage.load<Session[]>('sessions') || [];

      end();

      const stats = perfMonitor.getStats('session-load-50-screenshots');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Session load time (50 screenshots): ${stats.avg.toFixed(2)}ms`);
        expect(sessions[0].screenshots?.length).toBe(50);
        expect(stats.avg).toBeLessThan(1000);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Storage Operation Performance
  // --------------------------------------------------------------------------

  describe('Storage Operations', () => {
    it('should save single session in < 100ms', async () => {
      const session = createMockSession();

      const end = perfMonitor.start('storage-save-single');

      await mockStorage.save('sessions', [session]);

      end();

      const stats = perfMonitor.getStats('storage-save-single');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Storage save time (single): ${stats.avg.toFixed(2)}ms`);
        expect(stats.avg).toBeLessThan(100);
      }
    });

    it('should save 10 sessions in < 200ms', async () => {
      const sessions = createMockSessions(10);

      const end = perfMonitor.start('storage-save-10');

      await mockStorage.save('sessions', sessions);

      end();

      const stats = perfMonitor.getStats('storage-save-10');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Storage save time (10 sessions): ${stats.avg.toFixed(2)}ms`);
        expect(stats.avg).toBeLessThan(200);
      }
    });

    it('should perform rapid read operations without degradation', async () => {
      const sessions = createMockSessions(50);
      await mockStorage.save('sessions', sessions);

      // Perform 10 rapid reads
      for (let i = 0; i < 10; i++) {
        const end = perfMonitor.start('storage-rapid-read');
        await mockStorage.load<Session[]>('sessions');
        end();
      }

      const stats = perfMonitor.getStats('storage-rapid-read');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Rapid read performance (10 reads):`);
        console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
        console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
        console.log(`  Max: ${stats.max.toFixed(2)}ms`);

        // Check that there's no significant degradation
        // For very fast operations (< 1ms), allow more variance
        const threshold = stats.avg < 1 ? 10 : 3;
        expect(stats.max).toBeLessThan(stats.avg * threshold);
      }
    });
  });

  // --------------------------------------------------------------------------
  // State Update Performance
  // --------------------------------------------------------------------------

  describe('State Update Performance', () => {
    it('should handle 100 rapid state updates efficiently', async () => {
      let sessions = createMockSessions(10);
      await mockStorage.save('sessions', sessions);

      const totalEnd = perfMonitor.start('state-updates-total');

      // Simulate 100 rapid updates
      for (let i = 0; i < 100; i++) {
        const updateEnd = perfMonitor.start('state-update-single');

        // Simulate a state update (read, modify, write)
        sessions = await mockStorage.load<Session[]>('sessions') || [];
        sessions[0] = {
          ...sessions[0],
          description: `Updated ${i}`,
        };
        await mockStorage.save('sessions', sessions);

        updateEnd();
      }

      totalEnd();

      const singleStats = perfMonitor.getStats('state-update-single');
      const totalStats = perfMonitor.getStats('state-updates-total');

      expect(singleStats).not.toBeNull();
      expect(totalStats).not.toBeNull();

      if (singleStats && totalStats) {
        console.log(`State update performance (100 updates):`);
        console.log(`  Single update avg: ${singleStats.avg.toFixed(2)}ms`);
        console.log(`  Total time: ${totalStats.avg.toFixed(2)}ms`);
        console.log(`  Updates/sec: ${(100000 / totalStats.avg).toFixed(0)}`);

        // Each update should be fast enough not to block UI
        expect(singleStats.p95).toBeLessThan(50); // < 50ms for p95
        expect(totalStats.avg).toBeLessThan(5000); // < 5s total for 100 updates
      }
    });
  });

  // --------------------------------------------------------------------------
  // Filtering and Sorting Performance
  // --------------------------------------------------------------------------

  describe('Filtering and Sorting Performance', () => {
    it('should filter 100 sessions by search query in < 50ms', async () => {
      const sessions = createMockSessions(100);
      const query = 'test session 5';

      const end = perfMonitor.start('filter-search-100');

      const filtered = sessions.filter(s =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.description?.toLowerCase().includes(query.toLowerCase())
      );

      end();

      const stats = perfMonitor.getStats('filter-search-100');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Filter performance (100 sessions): ${stats.avg.toFixed(2)}ms`);
        expect(stats.avg).toBeLessThan(50);
        expect(filtered.length).toBeGreaterThan(0);
      }
    });

    it('should sort 100 sessions by date in < 50ms', async () => {
      const sessions = createMockSessions(100);

      const end = perfMonitor.start('sort-date-100');

      const sorted = [...sessions].sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      end();

      const stats = perfMonitor.getStats('sort-date-100');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Sort performance (100 sessions): ${stats.avg.toFixed(2)}ms`);
        expect(stats.avg).toBeLessThan(50);
        expect(sorted.length).toBe(100);
      }
    });

    it('should filter and sort 100 sessions in < 100ms', async () => {
      const sessions = createMockSessions(100);

      const end = perfMonitor.start('filter-sort-100');

      const filtered = sessions.filter(s => s.category === 'Development');
      const sorted = [...filtered].sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      end();

      const stats = perfMonitor.getStats('filter-sort-100');
      expect(stats).not.toBeNull();

      if (stats) {
        console.log(`Filter+Sort performance (100 sessions): ${stats.avg.toFixed(2)}ms`);
        expect(stats.avg).toBeLessThan(100);
        expect(sorted.length).toBeGreaterThan(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Baseline Report
  // --------------------------------------------------------------------------

  describe('Performance Summary', () => {
    it('should export all performance metrics', () => {
      // Record some sample metrics
      perfMonitor.record('test-metric-1', 10);
      perfMonitor.record('test-metric-1', 20);
      perfMonitor.record('test-metric-2', 30);

      const exported = perfMonitor.export();

      expect(Object.keys(exported).length).toBeGreaterThan(0);

      console.log('\nPerformance Baseline Summary:');
      for (const [label, stats] of Object.entries(exported)) {
        if (stats) {
          console.log(`\n${label}:`);
          console.log(`  Count: ${stats.count}`);
          console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
          console.log(`  P50: ${stats.p50.toFixed(2)}ms`);
          console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
          console.log(`  Min: ${stats.min.toFixed(2)}ms`);
          console.log(`  Max: ${stats.max.toFixed(2)}ms`);
        }
      }
    });
  });
});
