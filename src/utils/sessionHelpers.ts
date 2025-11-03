/**
 * @file sessionHelpers.ts - Session grouping and statistics utilities
 *
 * @overview
 * Provides helper functions for organizing sessions by date ranges and calculating
 * aggregate statistics across sessions.
 */

import type { Session } from '../types';

/**
 * Groups sessions by date ranges for display organization
 *
 * @param sessions - Array of sessions to group
 * @returns Object with sessions grouped by: today, yesterday, thisWeek, earlier
 *
 * @example
 * ```typescript
 * const grouped = groupSessionsByDate(allSessions);
 * console.log(`Today: ${grouped.today.length} sessions`);
 * console.log(`This week: ${grouped.thisWeek.length} sessions`);
 * ```
 *
 * @date_ranges
 * - **today**: Sessions from today (00:00:00 to now)
 * - **yesterday**: Sessions from yesterday (24h period)
 * - **thisWeek**: Sessions from last 7 days (excluding today and yesterday)
 * - **earlier**: Sessions older than 7 days
 *
 * @use_case
 * Used in SessionsZone to organize session list by date for better UX
 */
export function groupSessionsByDate(sessions: Session[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    today: sessions.filter(s => new Date(s.startTime) >= todayStart),
    yesterday: sessions.filter(s => {
      const date = new Date(s.startTime);
      return date >= yesterdayStart && date < todayStart;
    }),
    thisWeek: sessions.filter(s => {
      const date = new Date(s.startTime);
      return date >= weekStart && date < yesterdayStart;
    }),
    earlier: sessions.filter(s => new Date(s.startTime) < weekStart),
  };
}

/**
 * Calculates aggregate statistics across all sessions
 *
 * @param sessions - Array of sessions to analyze
 * @returns Object with totals: sessions, minutes, tasks, screenshots
 *
 * @example
 * ```typescript
 * const stats = calculateTotalStats(allSessions);
 * console.log(`Total time: ${stats.totalMinutes} minutes`);
 * console.log(`Total tasks: ${stats.totalTasks}`);
 * console.log(`Total screenshots: ${stats.totalScreenshots}`);
 * ```
 *
 * @use_case
 * - Dashboard summary cards
 * - Session zone header statistics
 * - Analytics and insights
 */
export function calculateTotalStats(sessions: Session[]) {
  return {
    totalSessions: sessions.length,
    totalMinutes: sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0),
    // totalTasks removed - now tracked via task.relationships
    totalScreenshots: sessions.reduce((sum, s) => sum + (s.screenshots?.length || 0), 0),
  };
}
