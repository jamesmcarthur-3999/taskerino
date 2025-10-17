import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { groupSessionsByDate, calculateTotalStats } from '../sessionHelpers';
import type { Session } from '../../types';

// Mock session data helper
function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'mock-session',
    name: 'Mock Session',
    description: 'Test session description',
    startTime: new Date().toISOString(),
    status: 'completed',
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'off',
    audioRecording: false,
    audioReviewCompleted: false,
    totalDuration: 60,
    screenshots: [],
    audioSegments: [],
    extractedTaskIds: [],
    extractedNoteIds: [],
    tags: [],
    ...overrides,
  } as Session;
}

describe('sessionHelpers', () => {
  describe('groupSessionsByDate', () => {
    beforeEach(() => {
      // Fix the current time for consistent test results
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T15:30:00Z')); // Monday, January 15, 2024, 3:30 PM UTC
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return empty groups for empty array', () => {
      const result = groupSessionsByDate([]);
      expect(result.today).toEqual([]);
      expect(result.yesterday).toEqual([]);
      expect(result.thisWeek).toEqual([]);
      expect(result.earlier).toEqual([]);
    });

    it('should group today sessions correctly', () => {
      const todayMorning = new Date('2024-01-15T09:00:00Z');
      const todayAfternoon = new Date('2024-01-15T14:00:00Z');

      const session1 = createMockSession({
        id: 'today-1',
        name: 'Morning Session',
        startTime: todayMorning.toISOString(),
      });

      const session2 = createMockSession({
        id: 'today-2',
        name: 'Afternoon Session',
        startTime: todayAfternoon.toISOString(),
      });

      const result = groupSessionsByDate([session1, session2]);
      expect(result.today).toHaveLength(2);
      expect(result.today).toContain(session1);
      expect(result.today).toContain(session2);
      expect(result.yesterday).toHaveLength(0);
      expect(result.thisWeek).toHaveLength(0);
      expect(result.earlier).toHaveLength(0);
    });

    it('should group yesterday sessions correctly', () => {
      const yesterdayMorning = new Date('2024-01-14T09:00:00Z');
      const yesterdayEvening = new Date('2024-01-14T20:00:00Z');

      const session1 = createMockSession({
        id: 'yesterday-1',
        name: 'Yesterday Morning',
        startTime: yesterdayMorning.toISOString(),
      });

      const session2 = createMockSession({
        id: 'yesterday-2',
        name: 'Yesterday Evening',
        startTime: yesterdayEvening.toISOString(),
      });

      const result = groupSessionsByDate([session1, session2]);
      expect(result.today).toHaveLength(0);
      expect(result.yesterday).toHaveLength(2);
      expect(result.yesterday).toContain(session1);
      expect(result.yesterday).toContain(session2);
      expect(result.thisWeek).toHaveLength(0);
      expect(result.earlier).toHaveLength(0);
    });

    it('should group this week sessions correctly', () => {
      const threeDaysAgo = new Date('2024-01-12T10:00:00Z'); // Friday
      const fiveDaysAgo = new Date('2024-01-10T14:00:00Z'); // Wednesday

      const session1 = createMockSession({
        id: 'week-1',
        name: 'Three Days Ago',
        startTime: threeDaysAgo.toISOString(),
      });

      const session2 = createMockSession({
        id: 'week-2',
        name: 'Five Days Ago',
        startTime: fiveDaysAgo.toISOString(),
      });

      const result = groupSessionsByDate([session1, session2]);
      expect(result.today).toHaveLength(0);
      expect(result.yesterday).toHaveLength(0);
      expect(result.thisWeek).toHaveLength(2);
      expect(result.thisWeek).toContain(session1);
      expect(result.thisWeek).toContain(session2);
      expect(result.earlier).toHaveLength(0);
    });

    it('should group earlier sessions correctly', () => {
      const eightDaysAgo = new Date('2024-01-07T10:00:00Z');
      const thirtyDaysAgo = new Date('2023-12-16T14:00:00Z');

      const session1 = createMockSession({
        id: 'earlier-1',
        name: 'Eight Days Ago',
        startTime: eightDaysAgo.toISOString(),
      });

      const session2 = createMockSession({
        id: 'earlier-2',
        name: 'Thirty Days Ago',
        startTime: thirtyDaysAgo.toISOString(),
      });

      const result = groupSessionsByDate([session1, session2]);
      expect(result.today).toHaveLength(0);
      expect(result.yesterday).toHaveLength(0);
      expect(result.thisWeek).toHaveLength(0);
      expect(result.earlier).toHaveLength(2);
      expect(result.earlier).toContain(session1);
      expect(result.earlier).toContain(session2);
    });

    it('should group mixed sessions across all time ranges', () => {
      const todaySession = createMockSession({
        id: 'today',
        name: 'Today Session',
        startTime: new Date('2024-01-15T12:00:00Z').toISOString(),
      });

      const yesterdaySession = createMockSession({
        id: 'yesterday',
        name: 'Yesterday Session',
        startTime: new Date('2024-01-14T12:00:00Z').toISOString(),
      });

      const thisWeekSession = createMockSession({
        id: 'thisWeek',
        name: 'This Week Session',
        startTime: new Date('2024-01-11T12:00:00Z').toISOString(),
      });

      const earlierSession = createMockSession({
        id: 'earlier',
        name: 'Earlier Session',
        startTime: new Date('2024-01-05T12:00:00Z').toISOString(),
      });

      const result = groupSessionsByDate([todaySession, yesterdaySession, thisWeekSession, earlierSession]);

      expect(result.today).toHaveLength(1);
      expect(result.today[0].id).toBe('today');

      expect(result.yesterday).toHaveLength(1);
      expect(result.yesterday[0].id).toBe('yesterday');

      expect(result.thisWeek).toHaveLength(1);
      expect(result.thisWeek[0].id).toBe('thisWeek');

      expect(result.earlier).toHaveLength(1);
      expect(result.earlier[0].id).toBe('earlier');
    });

    it('should handle midnight boundary - session at 23:59 is today', () => {
      const justBeforeMidnight = new Date('2024-01-15T23:59:59Z');

      const session = createMockSession({
        id: 'late-night',
        name: 'Late Night Session',
        startTime: justBeforeMidnight.toISOString(),
      });

      const result = groupSessionsByDate([session]);
      expect(result.today).toHaveLength(1);
      expect(result.yesterday).toHaveLength(0);
    });

    it('should handle midnight boundary - session at 00:00 yesterday is yesterday', () => {
      // Current time is 2024-01-15T15:30:00Z (2024-01-15T07:30:00 local PST)
      // Yesterday in local time starts at 2024-01-14T00:00:00 PST = 2024-01-14T08:00:00Z
      const yesterdayMidnight = new Date('2024-01-14T08:00:00Z');

      const session = createMockSession({
        id: 'midnight',
        name: 'Midnight Session',
        startTime: yesterdayMidnight.toISOString(),
      });

      const result = groupSessionsByDate([session]);
      expect(result.today).toHaveLength(0);
      expect(result.yesterday).toHaveLength(1);
    });

    it('should handle exactly at today boundary (00:00:00)', () => {
      // Current time is 2024-01-15T15:30:00Z (2024-01-15T07:30:00 local PST)
      // Today in local time starts at 2024-01-15T00:00:00 PST = 2024-01-15T08:00:00Z
      const todayMidnight = new Date('2024-01-15T08:00:00Z');

      const session = createMockSession({
        id: 'boundary-today',
        name: 'Boundary Session',
        startTime: todayMidnight.toISOString(),
      });

      const result = groupSessionsByDate([session]);
      expect(result.today).toHaveLength(1);
      expect(result.yesterday).toHaveLength(0);
    });

    it('should handle exactly at yesterday boundary (24 hours ago)', () => {
      // Current time is 2024-01-15T15:30:00Z (2024-01-15T07:30:00 local PST)
      // Yesterday in local time starts at 2024-01-14T00:00:00 PST = 2024-01-14T08:00:00Z
      const yesterdayBoundary = new Date('2024-01-14T08:00:00Z');

      const session = createMockSession({
        id: 'boundary-yesterday',
        name: 'Yesterday Boundary',
        startTime: yesterdayBoundary.toISOString(),
      });

      const result = groupSessionsByDate([session]);
      expect(result.today).toHaveLength(0);
      expect(result.yesterday).toHaveLength(1);
      expect(result.thisWeek).toHaveLength(0);
    });

    it('should handle exactly at week boundary (7 days ago)', () => {
      // Current time is 2024-01-15T15:30:00Z (2024-01-15T07:30:00 local PST)
      // Week boundary (7 days ago) in local time: 2024-01-08T00:00:00 PST = 2024-01-08T08:00:00Z
      const weekBoundary = new Date('2024-01-08T08:00:00Z');

      const session = createMockSession({
        id: 'boundary-week',
        name: 'Week Boundary',
        startTime: weekBoundary.toISOString(),
      });

      const result = groupSessionsByDate([session]);
      expect(result.today).toHaveLength(0);
      expect(result.yesterday).toHaveLength(0);
      expect(result.thisWeek).toHaveLength(1);
      expect(result.earlier).toHaveLength(0);
    });

    it('should handle exactly one millisecond before week boundary', () => {
      // Current time is 2024-01-15T15:30:00Z (2024-01-15T07:30:00 local PST)
      // Week boundary is 2024-01-08T00:00:00 PST = 2024-01-08T08:00:00Z
      // One millisecond after the boundary (still in thisWeek)
      const justAfterWeekBoundary = new Date('2024-01-08T08:00:00.001Z');

      const session = createMockSession({
        id: 'just-after-week',
        name: 'Just After Week Boundary',
        startTime: justAfterWeekBoundary.toISOString(),
      });

      const result = groupSessionsByDate([session]);
      expect(result.thisWeek).toHaveLength(1);
      expect(result.earlier).toHaveLength(0);
    });

    it('should handle exactly one millisecond after week boundary', () => {
      const justAfterWeekBoundary = new Date('2024-01-07T23:59:59.999Z');

      const session = createMockSession({
        id: 'just-after-week',
        name: 'Just After Week Boundary',
        startTime: justAfterWeekBoundary.toISOString(),
      });

      const result = groupSessionsByDate([session]);
      expect(result.thisWeek).toHaveLength(0);
      expect(result.earlier).toHaveLength(1);
    });

    it('should preserve all session properties when grouping', () => {
      const session = createMockSession({
        id: 'preserve-test',
        name: 'Test Session',
        description: 'Test Description',
        startTime: new Date('2024-01-15T12:00:00Z').toISOString(),
        totalDuration: 120,
        tags: ['test', 'important'],
      });

      const result = groupSessionsByDate([session]);
      const groupedSession = result.today[0];

      expect(groupedSession.id).toBe('preserve-test');
      expect(groupedSession.name).toBe('Test Session');
      expect(groupedSession.description).toBe('Test Description');
      expect(groupedSession.totalDuration).toBe(120);
      expect(groupedSession.tags).toEqual(['test', 'important']);
    });

    it('should handle sessions with different timezones correctly', () => {
      // All dates are compared using UTC timestamps, so timezone shouldn't matter
      const sessionUTC = createMockSession({
        id: 'utc',
        startTime: '2024-01-15T12:00:00Z',
      });

      const sessionPST = createMockSession({
        id: 'pst',
        startTime: '2024-01-15T12:00:00-08:00', // Same moment in time, different timezone
      });

      const result = groupSessionsByDate([sessionUTC, sessionPST]);
      // Both should be in today if within today's range
      expect(result.today.length).toBeGreaterThan(0);
    });

    it('should maintain order of sessions within groups', () => {
      const session1 = createMockSession({
        id: 'today-1',
        startTime: new Date('2024-01-15T09:00:00Z').toISOString(),
      });

      const session2 = createMockSession({
        id: 'today-2',
        startTime: new Date('2024-01-15T12:00:00Z').toISOString(),
      });

      const session3 = createMockSession({
        id: 'today-3',
        startTime: new Date('2024-01-15T15:00:00Z').toISOString(),
      });

      const result = groupSessionsByDate([session1, session2, session3]);
      expect(result.today[0].id).toBe('today-1');
      expect(result.today[1].id).toBe('today-2');
      expect(result.today[2].id).toBe('today-3');
    });
  });

  describe('calculateTotalStats', () => {
    it('should return zero stats for empty array', () => {
      const result = calculateTotalStats([]);
      expect(result.totalSessions).toBe(0);
      expect(result.totalMinutes).toBe(0);
      expect(result.totalTasks).toBe(0);
      expect(result.totalScreenshots).toBe(0);
    });

    it('should calculate stats for single session', () => {
      const session = createMockSession({
        totalDuration: 60,
        extractedTaskIds: ['task-1', 'task-2'],
        screenshots: [
          { id: 'ss-1', sessionId: 'test', timestamp: '2024-01-15T12:00:00Z', attachmentId: 'att-1', analysisStatus: 'complete' },
          { id: 'ss-2', sessionId: 'test', timestamp: '2024-01-15T12:05:00Z', attachmentId: 'att-2', analysisStatus: 'complete' },
        ],
      });

      const result = calculateTotalStats([session]);
      expect(result.totalSessions).toBe(1);
      expect(result.totalMinutes).toBe(60);
      expect(result.totalTasks).toBe(2);
      expect(result.totalScreenshots).toBe(2);
    });

    it('should calculate stats for multiple sessions', () => {
      const session1 = createMockSession({
        id: 'session-1',
        totalDuration: 60,
        extractedTaskIds: ['task-1', 'task-2'],
        screenshots: [
          { id: 'ss-1', sessionId: 'session-1', timestamp: '2024-01-15T12:00:00Z', attachmentId: 'att-1', analysisStatus: 'complete' },
        ],
      });

      const session2 = createMockSession({
        id: 'session-2',
        totalDuration: 90,
        extractedTaskIds: ['task-3', 'task-4', 'task-5'],
        screenshots: [
          { id: 'ss-2', sessionId: 'session-2', timestamp: '2024-01-15T13:00:00Z', attachmentId: 'att-2', analysisStatus: 'complete' },
          { id: 'ss-3', sessionId: 'session-2', timestamp: '2024-01-15T13:05:00Z', attachmentId: 'att-3', analysisStatus: 'complete' },
        ],
      });

      const session3 = createMockSession({
        id: 'session-3',
        totalDuration: 45,
        extractedTaskIds: ['task-6'],
        screenshots: [
          { id: 'ss-4', sessionId: 'session-3', timestamp: '2024-01-15T14:00:00Z', attachmentId: 'att-4', analysisStatus: 'complete' },
          { id: 'ss-5', sessionId: 'session-3', timestamp: '2024-01-15T14:05:00Z', attachmentId: 'att-5', analysisStatus: 'complete' },
          { id: 'ss-6', sessionId: 'session-3', timestamp: '2024-01-15T14:10:00Z', attachmentId: 'att-6', analysisStatus: 'complete' },
        ],
      });

      const result = calculateTotalStats([session1, session2, session3]);
      expect(result.totalSessions).toBe(3);
      expect(result.totalMinutes).toBe(195); // 60 + 90 + 45
      expect(result.totalTasks).toBe(6); // 2 + 3 + 1
      expect(result.totalScreenshots).toBe(6); // 1 + 2 + 3
    });

    it('should handle sessions with missing totalDuration field', () => {
      const session1 = createMockSession({
        totalDuration: 60,
      });

      const session2 = createMockSession({
        totalDuration: undefined,
      });

      const session3 = createMockSession({
        totalDuration: 45,
      });

      const result = calculateTotalStats([session1, session2, session3]);
      expect(result.totalSessions).toBe(3);
      expect(result.totalMinutes).toBe(105); // 60 + 0 + 45
    });

    it('should handle sessions with missing extractedTaskIds field', () => {
      const session1 = createMockSession({
        extractedTaskIds: ['task-1', 'task-2'],
      });

      const session2 = createMockSession({
        extractedTaskIds: undefined,
      });

      const session3 = createMockSession({
        extractedTaskIds: ['task-3'],
      });

      const result = calculateTotalStats([session1, session2, session3]);
      expect(result.totalSessions).toBe(3);
      expect(result.totalTasks).toBe(3); // 2 + 0 + 1
    });

    it('should handle sessions with missing screenshots field', () => {
      const session1 = createMockSession({
        screenshots: [
          { id: 'ss-1', sessionId: 'test', timestamp: '2024-01-15T12:00:00Z', attachmentId: 'att-1', analysisStatus: 'complete' },
        ],
      });

      const session2 = createMockSession({
        screenshots: undefined,
      });

      const session3 = createMockSession({
        screenshots: [
          { id: 'ss-2', sessionId: 'test', timestamp: '2024-01-15T13:00:00Z', attachmentId: 'att-2', analysisStatus: 'complete' },
          { id: 'ss-3', sessionId: 'test', timestamp: '2024-01-15T13:05:00Z', attachmentId: 'att-3', analysisStatus: 'complete' },
        ],
      });

      const result = calculateTotalStats([session1, session2, session3]);
      expect(result.totalSessions).toBe(3);
      expect(result.totalScreenshots).toBe(3); // 1 + 0 + 2
    });

    it('should handle sessions with all optional fields missing', () => {
      const session = createMockSession({
        totalDuration: undefined,
        extractedTaskIds: undefined,
        screenshots: undefined,
      });

      const result = calculateTotalStats([session]);
      expect(result.totalSessions).toBe(1);
      expect(result.totalMinutes).toBe(0);
      expect(result.totalTasks).toBe(0);
      expect(result.totalScreenshots).toBe(0);
    });

    it('should handle sessions with empty arrays', () => {
      const session = createMockSession({
        totalDuration: 60,
        extractedTaskIds: [],
        screenshots: [],
      });

      const result = calculateTotalStats([session]);
      expect(result.totalSessions).toBe(1);
      expect(result.totalMinutes).toBe(60);
      expect(result.totalTasks).toBe(0);
      expect(result.totalScreenshots).toBe(0);
    });

    it('should calculate correct totals with large numbers', () => {
      const sessions = Array.from({ length: 100 }, (_, i) =>
        createMockSession({
          id: `session-${i}`,
          totalDuration: 30,
          extractedTaskIds: ['task-1', 'task-2', 'task-3'],
          screenshots: [
            { id: `ss-${i}-1`, sessionId: `session-${i}`, timestamp: '2024-01-15T12:00:00Z', attachmentId: `att-${i}-1`, analysisStatus: 'complete' },
            { id: `ss-${i}-2`, sessionId: `session-${i}`, timestamp: '2024-01-15T12:05:00Z', attachmentId: `att-${i}-2`, analysisStatus: 'complete' },
          ],
        })
      );

      const result = calculateTotalStats(sessions);
      expect(result.totalSessions).toBe(100);
      expect(result.totalMinutes).toBe(3000); // 100 * 30
      expect(result.totalTasks).toBe(300); // 100 * 3
      expect(result.totalScreenshots).toBe(200); // 100 * 2
    });

    it('should handle mixed valid and invalid data gracefully', () => {
      const session1 = createMockSession({
        totalDuration: 60,
        extractedTaskIds: ['task-1'],
        screenshots: [
          { id: 'ss-1', sessionId: 'test', timestamp: '2024-01-15T12:00:00Z', attachmentId: 'att-1', analysisStatus: 'complete' },
        ],
      });

      const session2 = createMockSession({
        totalDuration: undefined,
        extractedTaskIds: undefined,
        screenshots: undefined,
      });

      const session3 = createMockSession({
        totalDuration: 45,
        extractedTaskIds: [],
        screenshots: [],
      });

      const result = calculateTotalStats([session1, session2, session3]);
      expect(result.totalSessions).toBe(3);
      expect(result.totalMinutes).toBe(105); // 60 + 0 + 45
      expect(result.totalTasks).toBe(1); // 1 + 0 + 0
      expect(result.totalScreenshots).toBe(1); // 1 + 0 + 0
    });

    it('should return correct structure with all required fields', () => {
      const result = calculateTotalStats([]);
      expect(result).toHaveProperty('totalSessions');
      expect(result).toHaveProperty('totalMinutes');
      expect(result).toHaveProperty('totalTasks');
      expect(result).toHaveProperty('totalScreenshots');
      expect(Object.keys(result)).toHaveLength(4);
    });

    it('should handle sessions with zero values', () => {
      const session = createMockSession({
        totalDuration: 0,
        extractedTaskIds: [],
        screenshots: [],
      });

      const result = calculateTotalStats([session]);
      expect(result.totalSessions).toBe(1);
      expect(result.totalMinutes).toBe(0);
      expect(result.totalTasks).toBe(0);
      expect(result.totalScreenshots).toBe(0);
    });

    it('should handle decimal duration values correctly', () => {
      const session1 = createMockSession({
        totalDuration: 45.5,
      });

      const session2 = createMockSession({
        totalDuration: 30.7,
      });

      const result = calculateTotalStats([session1, session2]);
      expect(result.totalMinutes).toBeCloseTo(76.2, 2); // 45.5 + 30.7
    });
  });
});
