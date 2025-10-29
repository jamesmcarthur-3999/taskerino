/**
 * BatchEnrichmentProgress - Simple Progress UI for Batch Enrichment
 *
 * CRITICAL: NO COST INDICATORS
 * - Shows progress bar and status
 * - Displays sessions in queue and completing
 * - NO cost information (to prevent user anxiety)
 * - Simple ETA ("~2 minutes remaining")
 * - Clear success/error messages
 *
 * Design Philosophy:
 * Users should see enrichment progress without worrying about costs.
 * All cost tracking is backend-only for optimization purposes.
 *
 * Usage:
 * ```tsx
 * <BatchEnrichmentProgress
 *   queue={parallelEnrichmentQueue}
 *   onComplete={() => console.log('Batch complete')}
 * />
 * ```
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.5 UI requirements
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { ParallelEnrichmentQueue, EnrichmentJob, QueueStatus } from '../../services/enrichment/ParallelEnrichmentQueue';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface BatchEnrichmentProgressProps {
  /** Queue instance to monitor */
  queue: ParallelEnrichmentQueue;

  /** Callback when batch completes */
  onComplete?: () => void;

  /** Callback when user cancels */
  onCancel?: () => void;

  /** Show close button */
  showClose?: boolean;
}

// ============================================================================
// BatchEnrichmentProgress Component
// ============================================================================

export const BatchEnrichmentProgress: React.FC<BatchEnrichmentProgressProps> = ({
  queue,
  onComplete,
  onCancel,
  showClose = false,
}) => {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [currentJobs, setCurrentJobs] = useState<EnrichmentJob[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [startTime] = useState(Date.now());
  const [isComplete, setIsComplete] = useState(false);

  // ========================================
  // Queue Status Polling
  // ========================================

  useEffect(() => {
    let mounted = true;

    // Initial status
    const initialStatus = queue.getQueueStatus();
    setTotalJobs(
      initialStatus.pending +
        initialStatus.processing +
        initialStatus.completed +
        initialStatus.failed
    );

    // Poll queue status every 500ms
    const interval = setInterval(() => {
      if (!mounted) return;

      const currentStatus = queue.getQueueStatus();
      setStatus(currentStatus);
      setCompletedCount(currentStatus.completed);
      setFailedCount(currentStatus.failed);

      // Check if complete
      if (currentStatus.pending === 0 && currentStatus.processing === 0) {
        setIsComplete(true);
        clearInterval(interval);

        // Call completion callback after a brief delay
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, 1000);
      }
    }, 500);

    // Listen to job events
    const handleProgress = (job: EnrichmentJob) => {
      setCurrentJobs((prev) => {
        const index = prev.findIndex((j) => j.id === job.id);
        if (index === -1) {
          return [...prev, job];
        }
        const updated = [...prev];
        updated[index] = job;
        return updated;
      });
    };

    const handleCompleted = (job: EnrichmentJob) => {
      setCurrentJobs((prev) => prev.filter((j) => j.id !== job.id));
    };

    const handleFailed = (job: EnrichmentJob) => {
      setCurrentJobs((prev) => prev.filter((j) => j.id !== job.id));
    };

    queue.on('progress', handleProgress);
    queue.on('completed', handleCompleted);
    queue.on('failed', handleFailed);

    return () => {
      mounted = false;
      clearInterval(interval);
      queue.off('progress', handleProgress);
      queue.off('completed', handleCompleted);
      queue.off('failed', handleFailed);
    };
  }, [queue, onComplete]);

  // ========================================
  // Calculations
  // ========================================

  const overallProgress = totalJobs > 0 ? ((completedCount + failedCount) / totalJobs) * 100 : 0;

  const estimatedTimeRemaining = (): string => {
    if (!status || status.avgProcessingTime === 0) {
      return 'Calculating...';
    }

    const remaining = status.pending + status.processing;
    const avgTimePerJob = status.avgProcessingTime;
    const estimatedMs = (remaining / status.maxConcurrency) * avgTimePerJob;

    if (estimatedMs < 60000) {
      return `~${Math.ceil(estimatedMs / 1000)} seconds remaining`;
    }
    return `~${Math.ceil(estimatedMs / 60000)} minutes remaining`;
  };

  const elapsedTime = (): string => {
    const elapsed = Date.now() - startTime;
    if (elapsed < 60000) {
      return `${Math.floor(elapsed / 1000)}s`;
    }
    return `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
  };

  // ========================================
  // Render
  // ========================================

  if (!status) {
    return null;
  }

  return (
    <div className="fixed top-20 right-6 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isComplete ? 'Enrichment Complete!' : 'Enriching Sessions'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {isComplete
                ? `${completedCount} sessions enriched successfully`
                : `Processing ${status.processing} of ${totalJobs} sessions`}
            </p>
          </div>

          {showClose && (
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-700 dark:text-gray-300">{Math.round(overallProgress)}%</span>
          <span className="text-gray-500 dark:text-gray-400">{elapsedTime()}</span>
        </div>

        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {!isComplete && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{estimatedTimeRemaining()}</p>
        )}
      </div>

      {/* Status Summary */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedCount}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{status.processing}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Processing</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{status.pending}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">Pending</p>
          </div>
        </div>
      </div>

      {/* Currently Processing Sessions */}
      {!isComplete && currentJobs.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
            Currently Processing
          </p>
          <div className="space-y-2">
            {currentJobs.map((job) => (
              <div key={job.id} className="flex items-center space-x-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{job.session.name}</p>
                  {job.stage && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{job.stage}</p>
                  )}
                </div>
                <div className="flex-shrink-0 w-12 text-right">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{job.progress}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Summary (if any failures) */}
      {failedCount > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            {failedCount} {failedCount === 1 ? 'session' : 'sessions'} could not be enriched. Check logs for details.
          </p>
        </div>
      )}

      {/* Success Message */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 py-4 border-t border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm font-medium">All sessions enriched successfully!</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default BatchEnrichmentProgress;
