/**
 * Chapter Utilities
 *
 * Optimized algorithms for chapter operations using binary search.
 *
 * Performance Characteristics:
 * - findChapterForTime: O(log m) where m = number of chapters
 * - groupItemsByChapter: O(n log m) where n = items, m = chapters
 *
 * Assumptions:
 * - Chapters are sorted by startTime (required for binary search)
 * - Chapters do not overlap (maintained by chaptering algorithm)
 * - Time ranges are [startTime, endTime) (inclusive start, exclusive end)
 */

import type { VideoChapter } from '../types';

/**
 * Find the chapter containing the given time using binary search.
 * Assumes chapters are sorted by startTime.
 *
 * Time Complexity: O(log m) where m = number of chapters
 * Space Complexity: O(1)
 *
 * @param time - The time to search for (in seconds)
 * @param chapters - Sorted array of chapters (by startTime)
 * @returns The chapter containing the time, or null if not found
 *
 * @example
 * ```typescript
 * const chapters = [
 *   { id: '1', startTime: 0, endTime: 10, ... },
 *   { id: '2', startTime: 10, endTime: 30, ... },
 *   { id: '3', startTime: 30, endTime: 40, ... },
 * ];
 *
 * findChapterForTime(5, chapters);   // Returns chapter 1
 * findChapterForTime(15, chapters);  // Returns chapter 2
 * findChapterForTime(50, chapters);  // Returns null (outside all chapters)
 * ```
 */
export function findChapterForTime(
  time: number,
  chapters: VideoChapter[]
): VideoChapter | null {
  // Edge case: empty chapters array
  if (chapters.length === 0) {
    return null;
  }

  // Edge case: time before first chapter
  if (time < chapters[0].startTime) {
    return null;
  }

  // Edge case: time after last chapter
  const lastChapter = chapters[chapters.length - 1];
  if (time >= lastChapter.endTime) {
    return null;
  }

  // Binary search for the chapter containing the time
  let left = 0;
  let right = chapters.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const chapter = chapters[mid];

    // Check if time is in this chapter
    // Time ranges are [startTime, endTime) - inclusive start, exclusive end
    if (time >= chapter.startTime && time < chapter.endTime) {
      // Found the chapter
      return chapter;
    } else if (time < chapter.startTime) {
      // Search left half (earlier chapters)
      right = mid - 1;
    } else {
      // time >= chapter.endTime
      // Search right half (later chapters)
      left = mid + 1;
    }
  }

  // Time not found in any chapter (falls between chapters)
  return null;
}

/**
 * Group timeline items by chapter using binary search.
 *
 * Time Complexity: O(n log m) where n = items, m = chapters
 *   - Before: O(n*m) with linear search (chapters.find)
 *   - After: O(n log m) with binary search (findChapterForTime)
 *   - Speedup: ~5-10x for typical session sizes (100 items, 20 chapters)
 *
 * Space Complexity: O(n) for the output map
 *
 * @param items - Timeline items to group (must have timestamp field)
 * @param chapters - Sorted array of chapters (by startTime)
 * @param sessionStartTime - Session start time for timestamp conversion
 * @returns Map of chapter ID to items in that chapter
 *
 * @example
 * ```typescript
 * const items = [
 *   { id: '1', timestamp: new Date('2025-01-01T00:00:05Z') },
 *   { id: '2', timestamp: new Date('2025-01-01T00:00:15Z') },
 * ];
 * const chapters = [
 *   { id: 'ch1', startTime: 0, endTime: 10, ... },
 *   { id: 'ch2', startTime: 10, endTime: 30, ... },
 * ];
 * const sessionStart = new Date('2025-01-01T00:00:00Z');
 *
 * const grouped = groupItemsByChapter(items, chapters, sessionStart);
 * // grouped.get('ch1') => [item1]
 * // grouped.get('ch2') => [item2]
 * ```
 */
export function groupItemsByChapter<T extends { timestamp: Date | string }>(
  items: T[],
  chapters: VideoChapter[],
  sessionStartTime: Date | string
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  // Initialize map with chapter IDs
  chapters.forEach((chapter) => {
    grouped.set(chapter.id, []);
  });

  // Add "uncategorized" for items not in any chapter
  grouped.set('uncategorized', []);

  // Convert session start time to timestamp
  const sessionStart =
    typeof sessionStartTime === 'string'
      ? new Date(sessionStartTime).getTime()
      : sessionStartTime.getTime();

  // Group items using binary search (O(n log m) instead of O(n*m))
  items.forEach((item) => {
    // Convert item timestamp to seconds from session start
    const itemTimestamp =
      typeof item.timestamp === 'string'
        ? new Date(item.timestamp).getTime()
        : item.timestamp.getTime();

    const time = (itemTimestamp - sessionStart) / 1000;

    // Find chapter using binary search (O(log m))
    const chapter = findChapterForTime(time, chapters);

    if (chapter) {
      grouped.get(chapter.id)!.push(item);
    } else {
      grouped.get('uncategorized')!.push(item);
    }
  });

  return grouped;
}

/**
 * Sort chapters by startTime (required for binary search).
 * Creates a new sorted array without modifying the original.
 *
 * Time Complexity: O(m log m) where m = number of chapters
 * Space Complexity: O(m) for the sorted copy
 *
 * @param chapters - Chapters to sort
 * @returns New array sorted by startTime (ascending)
 *
 * @example
 * ```typescript
 * const chapters = [
 *   { id: '2', startTime: 10, endTime: 30, ... },
 *   { id: '1', startTime: 0, endTime: 10, ... },
 *   { id: '3', startTime: 30, endTime: 40, ... },
 * ];
 *
 * const sorted = sortChaptersByTime(chapters);
 * // sorted[0].id === '1' (startTime: 0)
 * // sorted[1].id === '2' (startTime: 10)
 * // sorted[2].id === '3' (startTime: 30)
 * ```
 */
export function sortChaptersByTime(chapters: VideoChapter[]): VideoChapter[] {
  return [...chapters].sort((a, b) => a.startTime - b.startTime);
}

/**
 * Validate that chapters are sorted by startTime.
 * Used for runtime validation in development/testing.
 *
 * Time Complexity: O(m) where m = number of chapters
 * Space Complexity: O(1)
 *
 * @param chapters - Chapters to validate
 * @returns True if sorted, false otherwise
 *
 * @example
 * ```typescript
 * const chapters = [
 *   { id: '1', startTime: 0, endTime: 10, ... },
 *   { id: '2', startTime: 10, endTime: 30, ... },
 * ];
 *
 * isChaptersSorted(chapters);  // true
 *
 * const unsorted = [chapters[1], chapters[0]];
 * isChaptersSorted(unsorted);  // false
 * ```
 */
export function isChaptersSorted(chapters: VideoChapter[]): boolean {
  for (let i = 1; i < chapters.length; i++) {
    if (chapters[i].startTime < chapters[i - 1].startTime) {
      return false;
    }
  }
  return true;
}

/**
 * Validate that chapters do not overlap.
 * Used for runtime validation in development/testing.
 *
 * Time Complexity: O(m) where m = number of chapters
 * Space Complexity: O(1)
 *
 * @param chapters - Sorted chapters to validate
 * @returns True if no overlaps, false otherwise
 *
 * @example
 * ```typescript
 * const chapters = [
 *   { id: '1', startTime: 0, endTime: 10, ... },
 *   { id: '2', startTime: 10, endTime: 30, ... },  // OK: endTime[0] == startTime[1]
 * ];
 *
 * isChaptersNonOverlapping(chapters);  // true
 *
 * const overlapping = [
 *   { id: '1', startTime: 0, endTime: 15, ... },
 *   { id: '2', startTime: 10, endTime: 30, ... },  // BAD: overlap 10-15
 * ];
 *
 * isChaptersNonOverlapping(overlapping);  // false
 * ```
 */
export function isChaptersNonOverlapping(chapters: VideoChapter[]): boolean {
  for (let i = 1; i < chapters.length; i++) {
    // Chapters should not overlap: endTime[i-1] <= startTime[i]
    if (chapters[i - 1].endTime > chapters[i].startTime) {
      return false;
    }
  }
  return true;
}
