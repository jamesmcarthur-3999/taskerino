/**
 * QueueMonitor - Development UI for monitoring PersistenceQueue
 *
 * Shows real-time statistics about the background persistence queue.
 * Only visible in development mode.
 *
 * @example
 * ```typescript
 * // In App.tsx or MainApp
 * import { QueueMonitor } from './components/dev/QueueMonitor';
 *
 * return (
 *   <>
 *     <YourApp />
 *     <QueueMonitor />
 *   </>
 * );
 * ```
 */

import React, { useState, useEffect } from 'react';
import { getPersistenceQueue } from '@/services/storage/PersistenceQueue';
import type { QueueStats } from '@/services/storage/PersistenceQueue';

export function QueueMonitor() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const queue = getPersistenceQueue();

    // Initial stats
    setStats(queue.getStats());

    // Update stats every second
    const interval = setInterval(() => {
      setStats(queue.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Only show in development
  if (import.meta.env.PROD) return null;
  if (!stats) return null;

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 bg-black/80 text-white px-3 py-2 rounded text-xs font-mono cursor-pointer hover:bg-black/90 transition-colors"
      >
        Queue: {stats.pending}
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded text-xs font-mono shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold">Storage Queue</div>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          −
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Pending:</span>
          <span className={stats.pending > 0 ? 'text-yellow-400' : 'text-green-400'}>
            {stats.pending}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Processing:</span>
          <span className={stats.processing > 0 ? 'text-cyan-400' : 'text-gray-400'}>
            {stats.processing}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Completed:</span>
          <span className="text-green-400">{stats.completed}</span>
        </div>

        <div className="flex justify-between">
          <span>Failed:</span>
          <span className={stats.failed > 0 ? 'text-red-400' : 'text-gray-400'}>
            {stats.failed}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/20">
        <div className="text-gray-400 mb-1">By Priority</div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Critical:</span>
            <span className={stats.byPriority.critical > 0 ? 'text-red-400' : 'text-gray-400'}>
              {stats.byPriority.critical}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Normal:</span>
            <span className={stats.byPriority.normal > 0 ? 'text-yellow-400' : 'text-gray-400'}>
              {stats.byPriority.normal}
            </span>
          </div>

          <div className="flex justify-between">
            <span>Low:</span>
            <span className={stats.byPriority.low > 0 ? 'text-blue-400' : 'text-gray-400'}>
              {stats.byPriority.low}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
