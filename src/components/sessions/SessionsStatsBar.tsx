import React, { useMemo, forwardRef } from 'react';
import type { Session } from '../../types';

interface SessionsStatsBarProps {
  sessions: Session[];
}

export const SessionsStatsBar = forwardRef<HTMLDivElement, SessionsStatsBarProps>(
  function SessionsStatsBar({ sessions }, ref) {
    const stats = useMemo(() => {
      return {
        totalSessions: sessions.length,
        totalMinutes: sessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0),
        totalScreenshots: sessions.reduce((sum, s) => sum + (s.screenshots?.length || 0), 0),
        // totalTasks removed - now tracked via task.relationships
      };
    }, [sessions]);

    if (sessions.length === 0) return null;

    return (
      <div ref={ref} className="px-4 py-2 bg-white/40 backdrop-blur-sm rounded-[9999px] border border-white/60">
        <span className="text-sm font-semibold text-gray-700">
          {stats.totalSessions} sessions • {Math.floor(stats.totalMinutes / 60)}h tracked
        </span>
      </div>
    );
  }
);
