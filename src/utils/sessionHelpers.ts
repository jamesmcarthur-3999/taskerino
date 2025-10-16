import type { Session } from '../types';

/**
 * Helper function to group sessions by date ranges
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
 * Helper function to calculate total stats across all sessions
 */
export function calculateTotalStats(sessions: Session[]) {
  return {
    totalSessions: sessions.length,
    totalMinutes: sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0),
    totalTasks: sessions.reduce((sum, s) => sum + (s.extractedTaskIds?.length || 0), 0),
    totalScreenshots: sessions.reduce((sum, s) => sum + (s.screenshots?.length || 0), 0),
  };
}
