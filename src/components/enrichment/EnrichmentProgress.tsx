/**
 * EnrichmentProgress - Real-time Progress UI for Session Enrichment (NO COST UI)
 *
 * Production-grade progress UI component that displays real-time enrichment progress
 * WITHOUT showing cost information to users.
 *
 * CRITICAL: NO COST INDICATORS
 * - Shows stage-by-stage progress (Audio → Video → Summary → Canvas)
 * - Displays simple ETA ("~5 minutes remaining")
 * - Clear, friendly status messages ("Analyzing audio...")
 * - NO cost information (prevents user anxiety)
 * - NO cost-based ETA ("5 more sessions = $2.00")
 *
 * Features:
 * - Real-time progress updates (<1s latency)
 * - Per-session detailed progress
 * - Batch progress summary
 * - Stage-by-stage visualization
 * - Simple time-based ETA
 * - User-friendly error messages (NO COST)
 *
 * Usage:
 * ```tsx
 * import { EnrichmentProgress } from './EnrichmentProgress';
 * import { getProgressTrackingService } from '@/services/enrichment/ProgressTrackingService';
 *
 * const progressService = getProgressTrackingService();
 *
 * <EnrichmentProgress
 *   sessionId={session.id}
 *   progressService={progressService}
 *   onComplete={() => console.log('Done!')}
 * />
 * ```
 *
 * @see docs/sessions-rewrite/PHASE_5_KICKOFF.md - Task 5.7 specification
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  ProgressTrackingService,
  EnrichmentProgress as Progress,
  BatchProgress,
  StageProgress,
} from '../../services/enrichment/ProgressTrackingService';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface EnrichmentProgressProps {
  /** Session ID to track (single session mode) */
  sessionId?: string;

  /** Progress tracking service */
  progressService: ProgressTrackingService;

  /** Show batch progress (if tracking multiple sessions) */
  showBatch?: boolean;

  /** Callback when enrichment completes */
  onComplete?: () => void;

  /** Callback when user closes */
  onClose?: () => void;

  /** Show close button */
  showClose?: boolean;

  /** Position (top-right by default) */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

// ============================================================================
// EnrichmentProgress Component
// ============================================================================

export const EnrichmentProgress: React.FC<EnrichmentProgressProps> = ({
  sessionId,
  progressService,
  showBatch = false,
  onComplete,
  onClose,
  showClose = true,
  position = 'top-right',
}) => {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // ========================================
  // Position Classes
  // ========================================

  const positionClasses = {
    'top-right': 'top-20 right-6',
    'top-left': 'top-20 left-6',
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
  };

  // ========================================
  // Progress Updates
  // ========================================

  useEffect(() => {
    let mounted = true;

    // Listen for progress updates
    const handleProgress = (sid: string, p: Progress) => {
      if (!mounted) return;
      if (sessionId && sid !== sessionId) return; // Only track specific session

      setProgress(p);

      // Check if complete
      if (p.stage === 'complete') {
        setIsComplete(true);
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, 2000);
      }
    };

    const handleBatchUpdate = (batch: BatchProgress) => {
      if (!mounted) return;
      setBatchProgress(batch);

      // Check if batch complete
      if (batch.pending === 0 && batch.processing === 0) {
        setIsComplete(true);
        setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
        }, 2000);
      }
    };

    progressService.on('progress', handleProgress);
    progressService.on('batch-update', handleBatchUpdate);

    // Initial load
    if (sessionId) {
      const initialProgress = progressService.getProgress(sessionId);
      if (initialProgress) {
        setProgress(initialProgress);
      }
    }

    if (showBatch) {
      const initialBatch = progressService.getBatchProgress();
      if (initialBatch) {
        setBatchProgress(initialBatch);
      }
    }

    return () => {
      mounted = false;
      progressService.off('progress', handleProgress);
      progressService.off('batch-update', handleBatchUpdate);
    };
  }, [sessionId, showBatch, progressService, onComplete]);

  // ========================================
  // Render Helpers
  // ========================================

  const renderStageIcon = (stage: StageProgress): React.ReactNode => {
    if (stage.status === 'completed') {
      return (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }

    if (stage.status === 'failed') {
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }

    if (stage.status === 'processing') {
      return (
        <div className="w-5 h-5">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (stage.status === 'skipped') {
      return (
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      );
    }

    // Pending
    return (
      <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
    );
  };

  const formatETA = (eta: number | null | undefined): string => {
    if (!eta || eta <= 0) {
      return 'Calculating...';
    }

    const minutes = Math.ceil(eta / 60000);
    if (minutes < 1) {
      return '~1 minute remaining';
    }
    return `~${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
  };

  const formatElapsedTime = (startTime: number): string => {
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes < 1) {
      return `${seconds}s`;
    }
    return `${minutes}m ${seconds % 60}s`;
  };

  // ========================================
  // Render
  // ========================================

  // Don't render if no progress to show
  if (!progress && !batchProgress) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ duration: 0.2 }}
        className={`fixed ${positionClasses[position]} w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden`}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-500/10 to-purple-600/10 dark:from-blue-500/20 dark:to-purple-600/20 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                {isComplete ? (
                  <>
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Enrichment Complete!</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    </div>
                    <span>Enriching Session</span>
                  </>
                )}
              </h3>
              {progress && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {progress.message}
                </p>
              )}
            </div>

            {showClose && (
              <button
                onClick={onClose}
                className="ml-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Single Session Progress */}
        {progress && !showBatch && (
          <div className="px-6 py-4 space-y-4">
            {/* Overall Progress Bar */}
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{Math.round(progress.progress)}%</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  {formatElapsedTime(progress.startTime)}
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {!isComplete && progress.estimatedCompletion !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {formatETA(progress.estimatedCompletion)}
                </p>
              )}
            </div>

            {/* Stage Progress */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Stages
              </p>

              {/* Audio */}
              <div className="flex items-center space-x-3">
                {renderStageIcon(progress.stages.audio)}
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">Audio Analysis</p>
                  {progress.stages.audio.status === 'processing' && (
                    <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <motion.div
                        className="h-full bg-blue-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.stages.audio.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>
                {progress.stages.audio.status === 'processing' && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {progress.stages.audio.progress}%
                  </span>
                )}
              </div>

              {/* Video */}
              <div className="flex items-center space-x-3">
                {renderStageIcon(progress.stages.video)}
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">Video Analysis</p>
                  {progress.stages.video.status === 'processing' && (
                    <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <motion.div
                        className="h-full bg-purple-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.stages.video.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>
                {progress.stages.video.status === 'processing' && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {progress.stages.video.progress}%
                  </span>
                )}
              </div>

              {/* Summary */}
              <div className="flex items-center space-x-3">
                {renderStageIcon(progress.stages.summary)}
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">Summary Generation</p>
                  {progress.stages.summary.status === 'processing' && (
                    <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <motion.div
                        className="h-full bg-green-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.stages.summary.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>
                {progress.stages.summary.status === 'processing' && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {progress.stages.summary.progress}%
                  </span>
                )}
              </div>

              {/* Canvas */}
              <div className="flex items-center space-x-3">
                {renderStageIcon(progress.stages.canvas)}
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">Canvas Generation</p>
                  {progress.stages.canvas.status === 'processing' && (
                    <div className="mt-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <motion.div
                        className="h-full bg-orange-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.stages.canvas.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  )}
                </div>
                {progress.stages.canvas.status === 'processing' && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {progress.stages.canvas.progress}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Batch Progress */}
        {batchProgress && showBatch && (
          <div className="px-6 py-4 space-y-4">
            {/* Overall Progress Bar */}
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {Math.round(batchProgress.progress)}%
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-xs">
                  {formatElapsedTime(batchProgress.startTime)}
                </span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${batchProgress.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {!isComplete && batchProgress.estimatedTimeRemaining !== undefined && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {formatETA(batchProgress.estimatedTimeRemaining)}
                </p>
              )}
            </div>

            {/* Batch Stats */}
            <div className="grid grid-cols-4 gap-3 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{batchProgress.completed}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Complete</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{batchProgress.processing}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Processing</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{batchProgress.pending}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{batchProgress.failed}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Failed</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300 text-center pt-2">
              {batchProgress.message}
            </p>
          </div>
        )}

        {/* Success Footer (if complete) */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-6 py-4 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800"
          >
            <div className="flex items-center justify-center space-x-2 text-green-700 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm font-medium">
                {showBatch && batchProgress
                  ? `${batchProgress.completed} sessions enriched!`
                  : 'Session enriched successfully!'}
              </p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default EnrichmentProgress;
