/**
 * EnrichmentPanel - Expandable Panel for Enrichment Queue Management
 *
 * Full-featured UI panel for displaying and managing all enrichment jobs.
 * Expands from TopNavigation to show job list with real-time progress updates.
 *
 * Features:
 * - Expandable panel with glassmorphism design
 * - Job list grouped by status (processing → pending → completed → failed)
 * - Real-time progress bars with smooth animations
 * - Job actions: cancel (pending/processing), retry (failed), view session
 * - Auto-refresh every 2 seconds with event subscription
 * - Responsive design with fixed max height and scroll
 *
 * Usage:
 * ```tsx
 * import { EnrichmentPanel } from './EnrichmentPanel';
 *
 * <EnrichmentPanel onClose={() => setExpanded(false)} />
 * ```
 *
 * Integration:
 * - Triggered by EnrichmentStatusIndicator (Task 9)
 * - Uses BackgroundEnrichmentManager API (Task 2)
 * - Subscribes to PersistentEnrichmentQueue events (Task 1)
 *
 * @see docs/sessions-rewrite/BACKGROUND_ENRICHMENT_PLAN.md - Task 10 specification
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBackgroundEnrichmentManager } from '../../services/enrichment/BackgroundEnrichmentManager';
import type {
  EnrichmentJob,
  QueueStatus,
  JobStatus,
} from '../../services/enrichment/PersistentEnrichmentQueue';
import { getGlassClasses, getRadiusClass, SHADOWS } from '../../design-system/theme';
import { formatDistanceToNow } from 'date-fns';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface EnrichmentPanelProps {
  /** Callback when user closes panel */
  onClose: () => void;
}

interface GroupedJobs {
  processing: EnrichmentJob[];
  pending: EnrichmentJob[];
  completed: EnrichmentJob[];
  failed: EnrichmentJob[];
}

// ============================================================================
// JobItem Component
// ============================================================================

interface JobItemProps {
  job: EnrichmentJob;
  onCancel: (jobId: string, sessionId: string) => void;
  onRetry: (sessionId: string) => void;
  onView: (sessionId: string) => void;
}

const JobItem: React.FC<JobItemProps> = ({ job, onCancel, onRetry, onView }) => {
  const formatStage = (stage?: string): string => {
    if (!stage) return 'Waiting...';

    const stageMap: Record<string, string> = {
      audio: 'Audio Review',
      video: 'Video Chaptering',
      summary: 'Summary Generation',
      canvas: 'Canvas Creation',
    };

    return stageMap[stage] || stage;
  };

  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case 'processing':
        return 'text-blue-600 dark:text-blue-400';
      case 'pending':
        return 'text-orange-600 dark:text-orange-400';
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      case 'cancelled':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getProgressBarColor = (status: JobStatus): string => {
    switch (status) {
      case 'processing':
        return 'bg-gradient-to-r from-blue-500 to-blue-600';
      case 'completed':
        return 'bg-gradient-to-r from-green-500 to-green-600';
      case 'failed':
        return 'bg-gradient-to-r from-red-500 to-red-600';
      default:
        return 'bg-gradient-to-r from-gray-400 to-gray-500';
    }
  };

  const getStatusIcon = (status: JobStatus): React.ReactNode => {
    switch (status) {
      case 'processing':
        return (
          <div className="w-4 h-4">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          </div>
        );
      case 'pending':
        return (
          <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'cancelled':
        return (
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    try {
      return formatDistanceToNow(timestamp, { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`p-4 ${getGlassClasses('subtle')} ${getRadiusClass('element')} border border-white/10 dark:border-gray-700/50`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center space-x-2 mb-1">
            {getStatusIcon(job.status)}
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {job.sessionName}
            </h4>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className={`font-medium ${getStatusColor(job.status)}`}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </span>
            {job.completedAt && (
              <span className="text-gray-500 dark:text-gray-400">
                {formatTimeAgo(job.completedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Priority Badge */}
        {job.priority === 'high' && job.status !== 'completed' && job.status !== 'cancelled' && (
          <div className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded">
            High
          </div>
        )}
      </div>

      {/* Stage */}
      {(job.status === 'processing' || job.status === 'pending') && (
        <div className="mb-3">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            {formatStage(job.stage)}
          </p>
        </div>
      )}

      {/* Progress Bar */}
      {(job.status === 'processing' || job.status === 'completed') && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span className="font-medium">{Math.round(job.progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-full ${getProgressBarColor(job.status)}`}
              initial={{ width: 0 }}
              animate={{ width: `${job.progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {job.status === 'failed' && job.error && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-700 dark:text-red-400">
            {job.error}
          </p>
          {job.attempts > 0 && (
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">
              Retried {job.attempts} time{job.attempts > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-2">
        {(job.status === 'pending' || job.status === 'processing') && (
          <button
            onClick={() => onCancel(job.id, job.sessionId)}
            disabled={job.status === 'processing'}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              job.status === 'processing'
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
            }`}
          >
            Cancel
          </button>
        )}

        {job.status === 'failed' && (
          <button
            onClick={() => onRetry(job.sessionId)}
            className="px-3 py-1.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
          >
            Retry
          </button>
        )}

        <button
          onClick={() => onView(job.sessionId)}
          className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          View Session
        </button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// EnrichmentPanel Component
// ============================================================================

export const EnrichmentPanel: React.FC<EnrichmentPanelProps> = ({ onClose }) => {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ========================================
  // Data Fetching - MEMORY LEAK FIX
  // ========================================
  // FIX: Use refresh counter pattern to avoid fetchData dependency in event listeners
  // This prevents both interval accumulation AND listener accumulation

  const [refreshCounter, setRefreshCounter] = useState(0);

  // Fetch data when refreshCounter changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const manager = getBackgroundEnrichmentManager();
        const queue = manager.getQueue();

        if (!queue) {
          throw new Error('Queue not initialized');
        }

        // Get all jobs
        const allJobs = await queue.getAllJobs();
        setJobs(allJobs);

        // Get queue status
        const queueStatus = await manager.getQueueStatus();
        setStatus(queueStatus);

        setError(null);
      } catch (err) {
        console.error('[EnrichmentPanel] Failed to fetch data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load enrichment queue');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [refreshCounter]); // Fetch when counter changes

  // Auto-refresh every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshCounter(c => c + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []); // Stable - no dependencies

  // Subscribe to queue events
  useEffect(() => {
    const manager = getBackgroundEnrichmentManager();
    const queue = manager.getQueue();

    if (!queue) {
      return;
    }

    // Event handlers that trigger refresh via counter
    const handleJobUpdate = () => {
      setRefreshCounter(c => c + 1); // Trigger refresh without fetchData dependency
    };

    // Subscribe to all events
    queue.on('job-enqueued', handleJobUpdate);
    queue.on('job-started', handleJobUpdate);
    queue.on('job-progress', handleJobUpdate);
    queue.on('job-completed', handleJobUpdate);
    queue.on('job-failed', handleJobUpdate);
    queue.on('job-cancelled', handleJobUpdate);
    queue.on('job-retry', handleJobUpdate);

    // Cleanup
    return () => {
      queue.off('job-enqueued', handleJobUpdate);
      queue.off('job-started', handleJobUpdate);
      queue.off('job-progress', handleJobUpdate);
      queue.off('job-completed', handleJobUpdate);
      queue.off('job-failed', handleJobUpdate);
      queue.off('job-cancelled', handleJobUpdate);
      queue.off('job-retry', handleJobUpdate);
    };
  }, []); // Stable - no dependencies, prevents listener accumulation

  // ========================================
  // Job Actions
  // ========================================

  const handleCancel = useCallback(async (jobId: string, sessionId: string) => {
    try {
      const manager = getBackgroundEnrichmentManager();
      await manager.cancelEnrichment(sessionId);

      // Refresh data via counter (consistent with event handlers)
      setRefreshCounter(c => c + 1);
    } catch (err) {
      console.error('[EnrichmentPanel] Failed to cancel job:', err);
      alert('Failed to cancel job: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, []);

  const handleRetry = useCallback(async (sessionId: string) => {
    try {
      const manager = getBackgroundEnrichmentManager();
      await manager.retryEnrichment(sessionId);

      // Refresh data via counter (consistent with event handlers)
      setRefreshCounter(c => c + 1);
    } catch (err) {
      console.error('[EnrichmentPanel] Failed to retry job:', err);
      alert('Failed to retry job: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, []);

  const handleView = useCallback((sessionId: string) => {
    // Navigate to session (implementation depends on routing setup)
    // For now, we'll close the panel and let parent handle navigation
    onClose();

    // Emit custom event that SessionsZone can listen for
    window.dispatchEvent(new CustomEvent('view-session', { detail: { sessionId } }));
  }, [onClose]);

  // ========================================
  // Job Grouping
  // ========================================

  const groupedJobs = React.useMemo((): GroupedJobs => {
    return {
      processing: jobs.filter(j => j.status === 'processing'),
      pending: jobs.filter(j => j.status === 'pending'),
      completed: jobs.filter(j => j.status === 'completed'),
      failed: jobs.filter(j => j.status === 'failed'),
    };
  }, [jobs]);

  // ========================================
  // Render
  // ========================================

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className={`absolute top-full right-0 mt-2 w-96 max-h-[600px] overflow-hidden ${getGlassClasses('strong')} ${getRadiusClass('panel')} ${SHADOWS.elevated} border border-white/20 dark:border-gray-700 z-[100]`}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 px-6 py-4 bg-gradient-to-r from-purple-500/10 to-blue-600/10 dark:from-purple-500/20 dark:to-blue-600/20 border-b border-white/10 dark:border-gray-700/50 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Enrichment Queue
            </h3>
            {status && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {status.processing} active, {status.pending} pending, {status.completed} completed
                {status.failed > 0 && `, ${status.failed} failed`}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="px-6 py-8 text-center">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm text-gray-600 dark:text-gray-400">No enrichment jobs</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Processing Jobs */}
            {groupedJobs.processing.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">
                  Processing ({groupedJobs.processing.length})
                </h4>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {groupedJobs.processing.map(job => (
                      <JobItem
                        key={job.id}
                        job={job}
                        onCancel={handleCancel}
                        onRetry={handleRetry}
                        onView={handleView}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Pending Jobs */}
            {groupedJobs.pending.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">
                  Pending ({groupedJobs.pending.length})
                </h4>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {groupedJobs.pending.map(job => (
                      <JobItem
                        key={job.id}
                        job={job}
                        onCancel={handleCancel}
                        onRetry={handleRetry}
                        onView={handleView}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Failed Jobs */}
            {groupedJobs.failed.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">
                  Failed ({groupedJobs.failed.length})
                </h4>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {groupedJobs.failed.map(job => (
                      <JobItem
                        key={job.id}
                        job={job}
                        onCancel={handleCancel}
                        onRetry={handleRetry}
                        onView={handleView}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Completed Jobs (collapsed by default, show recent 3) */}
            {groupedJobs.completed.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2 px-2">
                  Recently Completed ({groupedJobs.completed.length})
                </h4>
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {groupedJobs.completed.slice(0, 3).map(job => (
                      <JobItem
                        key={job.id}
                        job={job}
                        onCancel={handleCancel}
                        onRetry={handleRetry}
                        onView={handleView}
                      />
                    ))}
                  </AnimatePresence>
                </div>
                {groupedJobs.completed.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    +{groupedJobs.completed.length - 3} more completed
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default EnrichmentPanel;
