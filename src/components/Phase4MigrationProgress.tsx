/**
 * Phase4MigrationProgress - UI component for Phase 4 migration progress
 *
 * Displays real-time migration progress with:
 * - Step-by-step progress indicators
 * - Current operation status
 * - Pause/resume/cancel controls
 * - Statistics (time elapsed, ETA, data migrated)
 * - Error and warning messages
 *
 * Usage:
 * ```tsx
 * import { Phase4MigrationProgress } from './components/Phase4MigrationProgress';
 *
 * function MigrationDialog() {
 *   const [open, setOpen] = useState(true);
 *
 *   return (
 *     <Phase4MigrationProgress
 *       open={open}
 *       onClose={() => setOpen(false)}
 *     />
 *   );
 * }
 * ```
 */

import React, { useState, useEffect } from 'react';
import { getBackgroundMigrationService } from '../services/BackgroundMigrationService';
import type { MigrationProgress as Progress, MigrationState } from '../services/BackgroundMigrationService';

// ============================================================================
// Types
// ============================================================================

export interface Phase4MigrationProgressProps {
  /** Dialog open state */
  open: boolean;

  /** Close dialog callback */
  onClose: () => void;

  /** Auto-close when complete */
  autoClose?: boolean;

  /** Show verbose details */
  verbose?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function Phase4MigrationProgress({
  open,
  onClose,
  autoClose = false,
  verbose = false,
}: Phase4MigrationProgressProps) {
  const [state, setState] = useState<MigrationState | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  const migrationService = getBackgroundMigrationService();

  // Subscribe to migration events
  useEffect(() => {
    if (!open) return;

    // Get initial state
    setState(migrationService.getState());
    setProgress(migrationService.getProgress());

    // Subscribe to events
    const handleProgress = (data: { progress: Progress; state: MigrationState }) => {
      setProgress(data.progress);
      setState(data.state);
    };

    const handleComplete = (completedState: MigrationState) => {
      setState(completedState);
      if (autoClose) {
        setTimeout(() => onClose(), 2000);
      }
    };

    const handleError = (data: { error: Error; state: MigrationState }) => {
      setState(data.state);
    };

    migrationService.on('progress', handleProgress);
    migrationService.on('complete', handleComplete);
    migrationService.on('error', handleError);

    // Cleanup
    return () => {
      migrationService.off('progress', handleProgress);
      migrationService.off('complete', handleComplete);
      migrationService.off('error', handleError);
    };
  }, [open, migrationService, onClose, autoClose]);

  // Handle controls
  const handlePause = () => {
    migrationService.pause('user');
  };

  const handleResume = () => {
    migrationService.resume();
  };

  const handleCancel = () => {
    migrationService.cancel();
    onClose();
  };

  if (!open || !state) {
    return null;
  }

  const isRunning = state.status === 'running';
  const isPaused = state.status === 'paused';
  const isComplete = state.status === 'complete';
  const isError = state.status === 'error';
  const isCancelled = state.status === 'cancelled';

  const percentage = progress?.percentage ?? 0;
  const timeElapsed = state.startedAt ? Date.now() - state.startedAt : 0;
  const timeRemaining = progress?.estimatedTimeRemaining ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-white dark:bg-neutral-900 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Phase 4 Storage Migration
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {isComplete
              ? 'Migration complete!'
              : isCancelled
              ? 'Migration cancelled'
              : isError
              ? 'Migration error'
              : 'Upgrading to Phase 4 storage format...'}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                Overall Progress
              </span>
              <span className="text-neutral-600 dark:text-neutral-400">
                {percentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Step Progress */}
          {progress && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {['Chunked', 'CA Storage', 'Indexes', 'Compression'].map((name, i) => (
                  <div
                    key={name}
                    className={`
                      px-3 py-2 rounded-lg text-center text-sm font-medium transition-all
                      ${
                        i + 1 < progress.step
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                          : i + 1 === progress.step
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                      }
                    `}
                  >
                    {i + 1 < progress.step && '✓ '}
                    {name}
                  </div>
                ))}
              </div>

              {/* Current Step Details */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900 dark:text-white">
                    Step {progress.step}/{progress.totalSteps}: {progress.stepName}
                  </span>
                  {isPaused && (
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs font-medium rounded">
                      PAUSED
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {progress.status}
                </p>
                {progress.current > 0 && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">
                    {progress.current} / {progress.total}
                  </p>
                )}

                {/* Step-specific data */}
                {verbose && progress.stepData && (
                  <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700 text-xs space-y-1">
                    {progress.stepData.dedupCount !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-neutral-400">
                          Deduplicated:
                        </span>
                        <span className="text-neutral-900 dark:text-white font-medium">
                          {progress.stepData.dedupCount}
                        </span>
                      </div>
                    )}
                    {progress.stepData.savedBytes !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-neutral-600 dark:text-neutral-400">
                          Saved:
                        </span>
                        <span className="text-neutral-900 dark:text-white font-medium">
                          {(progress.stepData.savedBytes / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">Time Elapsed</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                {formatDuration(timeElapsed)}
              </p>
            </div>
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">Estimated Remaining</p>
              <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                {timeRemaining > 0 ? formatDuration(timeRemaining) : '--'}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {isError && state.error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Migration Error
              </p>
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">
                {state.error.message}
              </p>
            </div>
          )}

          {/* Success Message */}
          {isComplete && state.result && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-2">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                Migration Complete!
              </p>
              <div className="text-xs space-y-1 text-neutral-600 dark:text-neutral-400">
                {state.result.chunkedResult && (
                  <div>
                    Chunked: {state.result.chunkedResult.migratedCount} sessions migrated
                  </div>
                )}
                {state.result.caResult && (
                  <div>
                    CA Storage: {state.result.caResult.migratedAttachments} attachments,{' '}
                    {state.result.caResult.deduplicatedAttachments} deduplicated
                  </div>
                )}
                {state.result.indexResult && (
                  <div>Indexes: {state.result.indexResult.indexesBuilt.length} built</div>
                )}
                {state.result.compressionResult && (
                  <div>
                    Compression: {state.result.compressionResult.compressedSessions} sessions
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRunning && (
              <button
                onClick={handlePause}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Pause
              </button>
            )}
            {isPaused && (
              <button
                onClick={handleResume}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Resume
              </button>
            )}
            {!isComplete && !isCancelled && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isComplete && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            )}
            {(isError || isCancelled) && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-neutral-900 dark:text-white text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
