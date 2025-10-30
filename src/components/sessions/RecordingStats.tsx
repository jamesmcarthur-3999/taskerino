/**
 * RecordingStats Component
 *
 * Displays real-time video recording statistics including:
 * - Frames processed
 * - Frames dropped
 * - Recording status indicator
 * - Performance warnings
 *
 * Updates every second via polling.
 *
 * Task 2.10 - Phase 2
 */

import React, { useEffect, useState } from 'react';
import { Video, AlertCircle } from 'lucide-react';
import { videoRecordingService } from '../../services/videoRecordingService';
import type { RecordingStats as RecordingStatsType } from '../../services/videoRecordingService';
import { useRecording } from '../../context/RecordingContext';

export function RecordingStats() {
  const { recordingState } = useRecording();
  const [stats, setStats] = useState<RecordingStatsType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Early return inside useEffect is fine
    if (recordingState.video !== 'active') {
      return;
    }

    // Poll stats every second
    const interval = setInterval(async () => {
      try {
        const currentStats = await videoRecordingService.getStats();
        setStats(currentStats);
        setError(null);
      } catch (err) {
        console.error('Failed to get recording stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    }, 1000);

    // Initial fetch
    (async () => {
      try {
        const currentStats = await videoRecordingService.getStats();
        setStats(currentStats);
        setError(null);
      } catch (err) {
        console.error('Failed to get recording stats:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    })();

    return () => clearInterval(interval);
  }, [recordingState.video]);

  // Early return AFTER all hooks
  if (recordingState.video !== 'active' || !stats || !stats.isRecording) {
    return null;
  }

  // Calculate drop rate
  const dropRate = stats.framesProcessed > 0
    ? (stats.framesDropped / stats.framesProcessed) * 100
    : 0;

  // Determine status
  const isHealthy = dropRate < 1; // Less than 1% drop rate is healthy
  const isWarning = dropRate >= 1 && dropRate < 5; // 1-5% is concerning
  const isCritical = dropRate >= 5; // 5%+ is critical

  return (
    <div className="flex items-center gap-3 bg-white/40 backdrop-blur-md rounded-lg border border-white/50 px-4 py-2 shadow-sm">
      {/* Recording Indicator */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Video className="w-5 h-5 text-red-500" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        </div>
        <span className="text-sm font-semibold text-gray-900">Recording</span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-300" />

      {/* Stats */}
      <div className="flex items-center gap-4">
        {/* Frames Processed */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500">Frames</span>
          <span className="text-sm font-mono font-medium text-gray-900">
            {stats.framesProcessed.toLocaleString()}
          </span>
        </div>

        {/* Frames Dropped */}
        {stats.framesDropped > 0 && (
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Dropped</span>
            <span
              className={`text-sm font-mono font-medium ${
                isCritical
                  ? 'text-red-600'
                  : isWarning
                  ? 'text-yellow-600'
                  : 'text-gray-900'
              }`}
            >
              {stats.framesDropped.toLocaleString()}
            </span>
          </div>
        )}

        {/* Drop Rate */}
        {stats.framesDropped > 0 && (
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">Drop Rate</span>
            <span
              className={`text-sm font-mono font-medium ${
                isCritical
                  ? 'text-red-600'
                  : isWarning
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}
            >
              {dropRate.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Warning Icon for High Drop Rate */}
      {(isWarning || isCritical) && (
        <>
          <div className="w-px h-6 bg-gray-300" />
          <div className="flex items-center gap-2">
            <AlertCircle
              className={`w-4 h-4 ${
                isCritical ? 'text-red-500' : 'text-yellow-500'
              }`}
            />
            <span
              className={`text-xs font-medium ${
                isCritical ? 'text-red-600' : 'text-yellow-600'
              }`}
            >
              {isCritical
                ? 'Reduce quality or sources'
                : 'Performance degraded'}
            </span>
          </div>
        </>
      )}

      {/* Error Display */}
      {error && (
        <>
          <div className="w-px h-6 bg-gray-300" />
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-red-600">Stats unavailable</span>
          </div>
        </>
      )}
    </div>
  );
}
