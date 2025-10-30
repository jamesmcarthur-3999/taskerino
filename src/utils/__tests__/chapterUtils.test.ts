/**
 * Chapter Utils Tests
 *
 * Comprehensive test suite for binary search-based chapter operations.
 *
 * Test Coverage:
 * - findChapterForTime: 10 tests (edge cases, binary search correctness)
 * - groupItemsByChapter: 6 tests (grouping, empty cases, uncategorized)
 * - Helper functions: 4 tests (sorting, validation)
 *
 * Total: 20 tests
 */

import { describe, it, expect } from 'vitest';
import {
  findChapterForTime,
  groupItemsByChapter,
  sortChaptersByTime,
  isChaptersSorted,
  isChaptersNonOverlapping,
} from '../chapterUtils';
import type { VideoChapter } from '../../types';

// Test data generators
function createChapter(
  id: string,
  startTime: number,
  endTime: number,
  title = `Chapter ${id}`
): VideoChapter {
  return {
    id,
    sessionId: 'test-session',
    startTime,
    endTime,
    title,
    createdAt: new Date().toISOString(),
  };
}

function createItem(id: string, timestampSeconds: number) {
  const baseTime = new Date('2025-01-01T00:00:00Z');
  return {
    id,
    timestamp: new Date(baseTime.getTime() + timestampSeconds * 1000),
  };
}

describe('chapterUtils - Binary Search', () => {
  // Standard test chapters (sorted by startTime)
  const chapters: VideoChapter[] = [
    createChapter('1', 0, 10, 'Intro'),
    createChapter('2', 10, 30, 'Main'),
    createChapter('3', 30, 40, 'Conclusion'),
  ];

  describe('findChapterForTime', () => {
    it('should find correct chapter using binary search', () => {
      // Test middle of each chapter
      expect(findChapterForTime(5, chapters)?.id).toBe('1');
      expect(findChapterForTime(20, chapters)?.id).toBe('2');
      expect(findChapterForTime(35, chapters)?.id).toBe('3');
    });

    it('should find chapter at exact start time (inclusive)', () => {
      expect(findChapterForTime(0, chapters)?.id).toBe('1');
      expect(findChapterForTime(10, chapters)?.id).toBe('2');
      expect(findChapterForTime(30, chapters)?.id).toBe('3');
    });

    it('should NOT find chapter at exact end time (exclusive)', () => {
      // End time is exclusive (time range is [startTime, endTime))
      expect(findChapterForTime(10, chapters)?.id).toBe('2'); // Not chapter 1
      expect(findChapterForTime(30, chapters)?.id).toBe('3'); // Not chapter 2
      expect(findChapterForTime(40, chapters)).toBeNull(); // Not chapter 3
    });

    it('should return null for time before first chapter', () => {
      expect(findChapterForTime(-5, chapters)).toBeNull();
      expect(findChapterForTime(-0.1, chapters)).toBeNull();
    });

    it('should return null for time after last chapter', () => {
      expect(findChapterForTime(40, chapters)).toBeNull();
      expect(findChapterForTime(50, chapters)).toBeNull();
      expect(findChapterForTime(100, chapters)).toBeNull();
    });

    it('should handle empty chapters array', () => {
      expect(findChapterForTime(10, [])).toBeNull();
      expect(findChapterForTime(0, [])).toBeNull();
    });

    it('should handle single chapter', () => {
      const singleChapter = [createChapter('1', 0, 10)];
      expect(findChapterForTime(5, singleChapter)?.id).toBe('1');
      expect(findChapterForTime(0, singleChapter)?.id).toBe('1');
      expect(findChapterForTime(10, singleChapter)).toBeNull(); // End is exclusive
      expect(findChapterForTime(-1, singleChapter)).toBeNull();
    });

    it('should handle large number of chapters (50+)', () => {
      // Generate 50 chapters (0-10, 10-20, ..., 490-500)
      const manyChapters = Array.from({ length: 50 }, (_, i) =>
        createChapter(`ch-${i}`, i * 10, (i + 1) * 10)
      );

      // Test finding chapters in various positions
      expect(findChapterForTime(5, manyChapters)?.id).toBe('ch-0'); // First
      expect(findChapterForTime(245, manyChapters)?.id).toBe('ch-24'); // Middle
      expect(findChapterForTime(495, manyChapters)?.id).toBe('ch-49'); // Last
    });

    it('should handle chapters with gaps', () => {
      const gappedChapters = [
        createChapter('1', 0, 10),
        createChapter('2', 20, 30), // Gap: 10-20
        createChapter('3', 40, 50), // Gap: 30-40
      ];

      // In chapters
      expect(findChapterForTime(5, gappedChapters)?.id).toBe('1');
      expect(findChapterForTime(25, gappedChapters)?.id).toBe('2');
      expect(findChapterForTime(45, gappedChapters)?.id).toBe('3');

      // In gaps
      expect(findChapterForTime(15, gappedChapters)).toBeNull();
      expect(findChapterForTime(35, gappedChapters)).toBeNull();
    });

    it('should handle fractional times (sub-second precision)', () => {
      expect(findChapterForTime(5.5, chapters)?.id).toBe('1');
      expect(findChapterForTime(9.999, chapters)?.id).toBe('1');
      expect(findChapterForTime(10.001, chapters)?.id).toBe('2');
      expect(findChapterForTime(29.999, chapters)?.id).toBe('2');
    });
  });

  describe('groupItemsByChapter', () => {
    const sessionStart = new Date('2025-01-01T00:00:00Z');

    it('should assign items to correct chapters', () => {
      const items = [
        createItem('1', 5), // Chapter 1 (0-10)
        createItem('2', 15), // Chapter 2 (10-30)
        createItem('3', 35), // Chapter 3 (30-40)
      ];

      const grouped = groupItemsByChapter(items, chapters, sessionStart);

      expect(grouped.get('1')).toHaveLength(1);
      expect(grouped.get('1')?.[0].id).toBe('1');

      expect(grouped.get('2')).toHaveLength(1);
      expect(grouped.get('2')?.[0].id).toBe('2');

      expect(grouped.get('3')).toHaveLength(1);
      expect(grouped.get('3')?.[0].id).toBe('3');
    });

    it('should handle items outside chapters (uncategorized)', () => {
      const items = [
        createItem('1', -5), // Before all chapters
        createItem('2', 5), // Chapter 1
        createItem('3', 50), // After all chapters
      ];

      const grouped = groupItemsByChapter(items, chapters, sessionStart);

      expect(grouped.get('uncategorized')).toHaveLength(2);
      expect(grouped.get('uncategorized')).toContainEqual(
        expect.objectContaining({ id: '1' })
      );
      expect(grouped.get('uncategorized')).toContainEqual(
        expect.objectContaining({ id: '3' })
      );

      expect(grouped.get('1')).toHaveLength(1);
      expect(grouped.get('1')?.[0].id).toBe('2');
    });

    it('should handle empty items array', () => {
      const grouped = groupItemsByChapter([], chapters, sessionStart);

      chapters.forEach((chapter) => {
        expect(grouped.get(chapter.id)).toEqual([]);
      });
      expect(grouped.get('uncategorized')).toEqual([]);
    });

    it('should handle empty chapters array', () => {
      const items = [createItem('1', 5), createItem('2', 15)];
      const grouped = groupItemsByChapter(items, [], sessionStart);

      expect(grouped.get('uncategorized')).toHaveLength(2);
      expect(grouped.size).toBe(1); // Only 'uncategorized'
    });

    it('should initialize all chapter groups even if empty', () => {
      const items = [createItem('1', 5)]; // Only in chapter 1

      const grouped = groupItemsByChapter(items, chapters, sessionStart);

      // All chapters should have groups
      expect(grouped.has('1')).toBe(true);
      expect(grouped.has('2')).toBe(true);
      expect(grouped.has('3')).toBe(true);
      expect(grouped.has('uncategorized')).toBe(true);

      // Only chapter 1 has items
      expect(grouped.get('1')).toHaveLength(1);
      expect(grouped.get('2')).toHaveLength(0);
      expect(grouped.get('3')).toHaveLength(0);
      expect(grouped.get('uncategorized')).toHaveLength(0);
    });

    it('should handle string timestamps', () => {
      const items = [
        { id: '1', timestamp: '2025-01-01T00:00:05Z' }, // 5 seconds
        { id: '2', timestamp: '2025-01-01T00:00:15Z' }, // 15 seconds
      ];

      const grouped = groupItemsByChapter(
        items,
        chapters,
        '2025-01-01T00:00:00Z'
      );

      expect(grouped.get('1')?.[0].id).toBe('1');
      expect(grouped.get('2')?.[0].id).toBe('2');
    });

    it('should handle many items efficiently', () => {
      // Generate 100 items distributed across 3 chapters
      const items = Array.from({ length: 100 }, (_, i) => {
        const time = (i / 100) * 40; // 0-40 seconds
        return createItem(`item-${i}`, time);
      });

      const grouped = groupItemsByChapter(items, chapters, sessionStart);

      // Verify all items are grouped
      const totalItems = Array.from(grouped.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      );
      expect(totalItems).toBe(100);

      // Verify distribution (approximate)
      expect(grouped.get('1')!.length).toBeGreaterThan(0); // 0-10 seconds
      expect(grouped.get('2')!.length).toBeGreaterThan(0); // 10-30 seconds
      expect(grouped.get('3')!.length).toBeGreaterThan(0); // 30-40 seconds
    });
  });

  describe('sortChaptersByTime', () => {
    it('should sort chapters by startTime', () => {
      const unsorted = [
        createChapter('2', 10, 30),
        createChapter('1', 0, 10),
        createChapter('3', 30, 40),
      ];

      const sorted = sortChaptersByTime(unsorted);

      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('3');
    });

    it('should not modify original array', () => {
      const original = [
        createChapter('2', 10, 30),
        createChapter('1', 0, 10),
      ];
      const originalFirstId = original[0].id;

      const sorted = sortChaptersByTime(original);

      expect(original[0].id).toBe(originalFirstId); // Original unchanged
      expect(sorted[0].id).toBe('1'); // Sorted is different
    });

    it('should handle already sorted chapters', () => {
      const alreadySorted = [
        createChapter('1', 0, 10),
        createChapter('2', 10, 30),
        createChapter('3', 30, 40),
      ];

      const sorted = sortChaptersByTime(alreadySorted);

      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('3');
    });

    it('should handle empty array', () => {
      const sorted = sortChaptersByTime([]);
      expect(sorted).toEqual([]);
    });
  });

  describe('isChaptersSorted', () => {
    it('should return true for sorted chapters', () => {
      const sorted = [
        createChapter('1', 0, 10),
        createChapter('2', 10, 30),
        createChapter('3', 30, 40),
      ];

      expect(isChaptersSorted(sorted)).toBe(true);
    });

    it('should return false for unsorted chapters', () => {
      const unsorted = [
        createChapter('2', 10, 30),
        createChapter('1', 0, 10),
        createChapter('3', 30, 40),
      ];

      expect(isChaptersSorted(unsorted)).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(isChaptersSorted([])).toBe(true);
    });

    it('should return true for single chapter', () => {
      expect(isChaptersSorted([createChapter('1', 0, 10)])).toBe(true);
    });
  });

  describe('isChaptersNonOverlapping', () => {
    it('should return true for non-overlapping chapters', () => {
      const nonOverlapping = [
        createChapter('1', 0, 10),
        createChapter('2', 10, 30), // Starts exactly when chapter 1 ends
        createChapter('3', 30, 40),
      ];

      expect(isChaptersNonOverlapping(nonOverlapping)).toBe(true);
    });

    it('should return false for overlapping chapters', () => {
      const overlapping = [
        createChapter('1', 0, 15),
        createChapter('2', 10, 30), // Overlaps with chapter 1 (10-15)
        createChapter('3', 30, 40),
      ];

      expect(isChaptersNonOverlapping(overlapping)).toBe(false);
    });

    it('should return true for chapters with gaps', () => {
      const withGaps = [
        createChapter('1', 0, 10),
        createChapter('2', 20, 30), // Gap: 10-20
        createChapter('3', 40, 50), // Gap: 30-40
      ];

      expect(isChaptersNonOverlapping(withGaps)).toBe(true);
    });

    it('should return true for empty array', () => {
      expect(isChaptersNonOverlapping([])).toBe(true);
    });

    it('should return true for single chapter', () => {
      expect(isChaptersNonOverlapping([createChapter('1', 0, 10)])).toBe(
        true
      );
    });
  });
});
