/**
 * Chapter Utils Performance Tests
 *
 * Benchmarks to verify O(log m) performance characteristics.
 *
 * Performance Targets:
 * - Binary search: <1ms for 50 chapters
 * - Grouping: <10ms for 100 items × 20 chapters
 * - Speedup: 5-10x faster than linear search
 * - Scalability: <50ms for 500 items × 100 chapters
 *
 * Total: 8 performance tests
 */

import { describe, it, expect } from 'vitest';
import {
  findChapterForTime,
  groupItemsByChapter,
  sortChaptersByTime,
} from '../chapterUtils';
import type { VideoChapter } from '../../types';

// Test data generators
function generateChapters(count: number): VideoChapter[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `chapter-${i}`,
    sessionId: 'test-session',
    title: `Chapter ${i}`,
    startTime: i * 10,
    endTime: (i + 1) * 10,
    createdAt: new Date().toISOString(),
  }));
}

function generateItems(count: number, sessionStart: Date) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    timestamp: new Date(sessionStart.getTime() + i * 1000),
  }));
}

// Linear search implementation (for comparison)
function findChapterLinear(
  time: number,
  chapters: VideoChapter[]
): VideoChapter | null {
  return chapters.find((c) => time >= c.startTime && time < c.endTime) || null;
}

describe('chapterUtils - Performance', () => {
  const sessionStart = new Date('2025-01-01T00:00:00Z');

  describe('Binary Search Performance', () => {
    it('should find chapter in <1ms with 50 chapters', () => {
      const chapters = generateChapters(50);

      const start = performance.now();
      findChapterForTime(250, chapters); // Middle of dataset
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('should find chapter in <1ms with 100 chapters', () => {
      const chapters = generateChapters(100);

      const start = performance.now();
      findChapterForTime(500, chapters); // Middle of dataset
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('should scale logarithmically (O(log m))', () => {
      // Test with increasing chapter counts
      const sizes = [10, 50, 100, 200];
      const durations: number[] = [];

      sizes.forEach((size) => {
        const chapters = generateChapters(size);
        const iterations = 100;

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
          findChapterForTime((size / 2) * 10, chapters);
        }
        const duration = (performance.now() - start) / iterations;
        durations.push(duration);
      });

      // Verify logarithmic scaling: doubling size should NOT double time
      // 200 chapters should take <2x time of 100 chapters (log(200)/log(100) ≈ 1.15)
      const ratio = durations[3] / durations[2]; // 200 vs 100
      expect(ratio).toBeLessThan(2); // Should be ~1.15, definitely <2
    });
  });

  describe('Grouping Performance', () => {
    it('should group 100 items × 20 chapters in <10ms', () => {
      const chapters = generateChapters(20);
      const items = generateItems(100, sessionStart);

      const start = performance.now();
      groupItemsByChapter(items, chapters, sessionStart);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should group 200 items × 50 chapters in <20ms', () => {
      const chapters = generateChapters(50);
      const items = generateItems(200, sessionStart);

      const start = performance.now();
      groupItemsByChapter(items, chapters, sessionStart);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20);
    });

    it('should handle large datasets: 500 items × 100 chapters in <50ms', () => {
      const chapters = generateChapters(100);
      const items = generateItems(500, sessionStart);

      const start = performance.now();
      groupItemsByChapter(items, chapters, sessionStart);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('Binary vs Linear Search Comparison', () => {
    it('should be faster than linear search (50 chapters, 200 items)', () => {
      const chapters = generateChapters(50);
      const items = generateItems(200, sessionStart);

      // Run multiple iterations for more stable results
      const iterations = 10;
      let linearTotal = 0;
      let binaryTotal = 0;

      for (let i = 0; i < iterations; i++) {
        // Linear search (O(n*m))
        const linearStart = performance.now();
        items.forEach((item) => {
          const time =
            (item.timestamp.getTime() - sessionStart.getTime()) / 1000;
          findChapterLinear(time, chapters);
        });
        linearTotal += performance.now() - linearStart;

        // Binary search (O(n log m))
        const binaryStart = performance.now();
        groupItemsByChapter(items, chapters, sessionStart);
        binaryTotal += performance.now() - binaryStart;
      }

      const linearDuration = linearTotal / iterations;
      const binaryDuration = binaryTotal / iterations;
      const speedup = linearDuration / binaryDuration;

      // Verify binary search is faster (speedup > 1)
      expect(speedup).toBeGreaterThan(1);
      expect(binaryDuration).toBeLessThan(linearDuration);

      // Log speedup for verification report
      console.log(`Speedup (50 chapters, 200 items): ${speedup.toFixed(2)}x`);
    });

    it('should scale better than linear search with larger datasets (100 chapters, 500 items)', () => {
      const chapters = generateChapters(100);
      const items = generateItems(500, sessionStart);

      // Run multiple iterations
      const iterations = 10;
      let linearTotal = 0;
      let binaryTotal = 0;

      for (let i = 0; i < iterations; i++) {
        // Linear search
        const linearStart = performance.now();
        items.forEach((item) => {
          const time =
            (item.timestamp.getTime() - sessionStart.getTime()) / 1000;
          findChapterLinear(time, chapters);
        });
        linearTotal += performance.now() - linearStart;

        // Binary search
        const binaryStart = performance.now();
        groupItemsByChapter(items, chapters, sessionStart);
        binaryTotal += performance.now() - binaryStart;
      }

      const linearDuration = linearTotal / iterations;
      const binaryDuration = binaryTotal / iterations;
      const speedup = linearDuration / binaryDuration;

      // Speedup should be better with larger datasets
      expect(speedup).toBeGreaterThan(1);
      expect(binaryDuration).toBeLessThan(50); // Still fast
      expect(binaryDuration).toBeLessThan(linearDuration);

      // Log speedup for verification report
      console.log(
        `Speedup (100 chapters, 500 items): ${speedup.toFixed(2)}x`
      );
    });
  });

  describe('Sorting Performance', () => {
    it('should sort 100 chapters in <5ms', () => {
      // Generate unsorted chapters
      const chapters = generateChapters(100).reverse();

      const start = performance.now();
      sortChaptersByTime(chapters);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });

    it('should sort 500 chapters in <20ms', () => {
      // Generate unsorted chapters
      const chapters = generateChapters(500).sort(() => Math.random() - 0.5);

      const start = performance.now();
      sortChaptersByTime(chapters);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical session (100 items, 20 chapters) in <10ms', () => {
      const chapters = generateChapters(20);
      const items = generateItems(100, sessionStart);

      const start = performance.now();

      // Simulate ReviewTimeline.tsx workflow
      const sortedChapters = sortChaptersByTime(chapters);
      const grouped = groupItemsByChapter(items, sortedChapters, sessionStart);
      const currentChapter = findChapterForTime(150, sortedChapters);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      expect(grouped.size).toBeGreaterThan(0);
      expect(currentChapter).not.toBeNull();
    });

    it('should handle large session (500 items, 50 chapters) in <30ms', () => {
      const chapters = generateChapters(50);
      const items = generateItems(500, sessionStart);

      const start = performance.now();

      // Full workflow
      const sortedChapters = sortChaptersByTime(chapters);
      const grouped = groupItemsByChapter(items, sortedChapters, sessionStart);
      const currentChapter = findChapterForTime(250, sortedChapters);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(30);
      expect(grouped.size).toBeGreaterThan(0);
      expect(currentChapter).not.toBeNull();
    });

    it('should handle extreme session (1000 items, 100 chapters) in <100ms', () => {
      const chapters = generateChapters(100);
      const items = generateItems(1000, sessionStart);

      const start = performance.now();

      // Full workflow
      const sortedChapters = sortChaptersByTime(chapters);
      const grouped = groupItemsByChapter(items, sortedChapters, sessionStart);
      const currentChapter = findChapterForTime(500, sortedChapters);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      expect(grouped.size).toBeGreaterThan(0);
      expect(currentChapter).not.toBeNull();
    });
  });

  describe('Performance Regression Detection', () => {
    it('should complete benchmark suite in <500ms total', () => {
      const start = performance.now();

      // Run multiple scenarios
      const scenarios = [
        { chapters: 20, items: 100 },
        { chapters: 50, items: 200 },
        { chapters: 100, items: 500 },
      ];

      scenarios.forEach(({ chapters: chaptersCount, items: itemsCount }) => {
        const chapters = generateChapters(chaptersCount);
        const items = generateItems(itemsCount, sessionStart);

        sortChaptersByTime(chapters);
        groupItemsByChapter(items, chapters, sessionStart);
        findChapterForTime((chaptersCount / 2) * 10, chapters);
      });

      const totalDuration = performance.now() - start;

      expect(totalDuration).toBeLessThan(500);
    });
  });
});
