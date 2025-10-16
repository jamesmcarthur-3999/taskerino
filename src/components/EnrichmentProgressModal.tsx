/**
 * Enrichment Progress Modal
 *
 * Full-screen modal displaying real-time progress for comprehensive session enrichment.
 * Shows dual progress for audio + video processing with detailed stage tracking.
 *
 * Features:
 * - Real-time progress updates via sessionEnrichmentService callbacks
 * - Dual progress bars (video + audio) with overall progress calculation
 * - Stage-specific messages and status indicators
 * - Time elapsed and estimated remaining
 * - Cancel with confirmation dialog
 * - Partial failure handling (shows what succeeded/failed)
 * - Success state with summary
 * - Error state with recovery options
 * - Keyboard support (ESC to trigger cancel)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  AlertTriangle,
  Film,
  Mic,
  FileText,
  Clock,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getModalClasses } from '../design-system/theme';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import {
  sessionEnrichmentService,
  type EnrichmentProgress,
  type EnrichmentResult,
} from '../services/sessionEnrichmentService';
import type { Session } from '../types';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface EnrichmentProgressModalProps {
  isOpen: boolean;
  session: Session;
  onComplete: (result: EnrichmentResult) => void;
  onError: (error: any) => void;
  onCancel: () => void;
}

interface StageProgress {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;
  message?: string;
}

// ============================================================================
// Component
// ============================================================================

export function EnrichmentProgressModal({
  isOpen,
  session,
  onComplete,
  onError,
  onCancel,
}: EnrichmentProgressModalProps) {
  const { colorScheme, glassStrength } = useTheme();

  // Progress tracking
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<EnrichmentProgress['stage']>('validating');
  const [stageMessage, setStageMessage] = useState('Initializing enrichment...');

  // Stage-specific progress
  const [audioProgress, setAudioProgress] = useState<StageProgress>({
    status: 'pending',
    progress: 0,
  });
  const [videoProgress, setVideoProgress] = useState<StageProgress>({
    status: 'pending',
    progress: 0,
  });
  const [summaryProgress, setSummaryProgress] = useState<StageProgress>({
    status: 'pending',
    progress: 0,
  });

  // Time tracking
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedRemaining, setEstimatedRemaining] = useState<number | null>(null);

  // State management
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<EnrichmentResult | null>(null);

  // Cancel confirmation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const enrichmentPromiseRef = useRef<Promise<EnrichmentResult> | null>(null);

  // Timer for elapsed time
  useEffect(() => {
    if (!isProcessing || !startTime) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedTime(elapsed);

      // Estimate remaining time based on progress
      if (overallProgress > 0 && overallProgress < 100) {
        const estimatedTotal = (elapsed / overallProgress) * 100;
        const remaining = Math.max(0, estimatedTotal - elapsed);
        setEstimatedRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, startTime, overallProgress]);

  // Start enrichment when modal opens
  useEffect(() => {
    if (isOpen && !isProcessing && !isComplete && !hasError) {
      startEnrichment();
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && isProcessing && !isCancelling) {
        setShowCancelConfirm(true);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isProcessing, isCancelling]);

  // ============================================================================
  // Enrichment Logic
  // ============================================================================

  const startEnrichment = async () => {
    setIsProcessing(true);
    setStartTime(Date.now());
    abortControllerRef.current = new AbortController();

    try {
      const enrichmentPromise = sessionEnrichmentService.enrichSession(session, {
        includeAudio: true,
        includeVideo: true,
        includeSummary: true,
        onProgress: handleProgress,
      });

      enrichmentPromiseRef.current = enrichmentPromise;
      const enrichmentResult = await enrichmentPromise;

      // Check if cancelled during processing
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setResult(enrichmentResult);
      setIsComplete(true);
      setIsProcessing(false);
      onComplete(enrichmentResult);
    } catch (error: any) {
      // Check if cancelled during processing
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      console.error('Enrichment failed:', error);
      setHasError(true);
      setErrorMessage(error.message || 'Unknown error occurred');
      setIsProcessing(false);
      onError(error);
    }
  };

  const handleProgress = (progress: EnrichmentProgress) => {
    setCurrentStage(progress.stage);
    setStageMessage(progress.message);
    setOverallProgress(progress.progress);

    // Update stage-specific progress
    if (progress.stages?.audio) {
      setAudioProgress({
        status: progress.stages.audio.status === 'processing' ? 'running' : progress.stages.audio.status,
        progress: progress.stages.audio.progress,
      });
    }

    if (progress.stages?.video) {
      setVideoProgress({
        status: progress.stages.video.status === 'processing' ? 'running' : progress.stages.video.status,
        progress: progress.stages.video.progress,
      });
    }

    if (progress.stages?.summary) {
      setSummaryProgress({
        status: progress.stages.summary.status === 'processing' ? 'running' : progress.stages.summary.status,
        progress: progress.stages.summary.progress,
      });
    }

    // Map overall stage to individual progress
    switch (progress.stage) {
      case 'audio':
        if (audioProgress.status === 'pending') {
          setAudioProgress({ status: 'running', progress: 0 });
        }
        break;
      case 'video':
        if (videoProgress.status === 'pending') {
          setVideoProgress({ status: 'running', progress: 0 });
        }
        // Mark audio as completed if we're moving to video
        if (audioProgress.status === 'running') {
          setAudioProgress({ status: 'completed', progress: 100 });
        }
        break;
      case 'summary':
        if (summaryProgress.status === 'pending') {
          setSummaryProgress({ status: 'running', progress: 0 });
        }
        // Mark video as completed if we're moving to summary
        if (videoProgress.status === 'running') {
          setVideoProgress({ status: 'completed', progress: 100 });
        }
        break;
      case 'complete':
        setAudioProgress({ status: 'completed', progress: 100 });
        setVideoProgress({ status: 'completed', progress: 100 });
        setSummaryProgress({ status: 'completed', progress: 100 });
        break;
      case 'error':
        // Mark running stages as failed
        if (audioProgress.status === 'running') {
          setAudioProgress({ ...audioProgress, status: 'failed' });
        }
        if (videoProgress.status === 'running') {
          setVideoProgress({ ...videoProgress, status: 'failed' });
        }
        if (summaryProgress.status === 'running') {
          setSummaryProgress({ ...summaryProgress, status: 'failed' });
        }
        break;
    }
  };

  const handleCancelConfirm = async () => {
    setShowCancelConfirm(false);
    setIsCancelling(true);

    try {
      // Signal abort
      abortControllerRef.current?.abort();

      // Call service cancel method
      await sessionEnrichmentService.cancelEnrichment(session.id);

      // Clean up state
      setIsProcessing(false);
      onCancel();
    } catch (error) {
      console.error('Cancel failed:', error);
      // Still close the modal even if cancel fails
      setIsProcessing(false);
      onCancel();
    }
  };

  // ============================================================================
  // Utility Functions
  // ============================================================================

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getStageIcon = (status: StageProgress['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5" />;
      case 'failed':
        return <XCircle className="w-5 h-5" />;
      case 'skipped':
        return <Circle className="w-5 h-5 text-gray-400" />;
      case 'pending':
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStageColor = (status: StageProgress['status']) => {
    switch (status) {
      case 'running':
        return 'text-blue-600 bg-blue-100 border-blue-300';
      case 'completed':
        return 'text-green-600 bg-green-100 border-green-300';
      case 'failed':
        return 'text-red-600 bg-red-100 border-red-300';
      case 'skipped':
        return 'text-gray-400 bg-gray-100 border-gray-300';
      case 'pending':
      default:
        return 'text-gray-400 bg-gray-100 border-gray-200';
    }
  };

  const getStageLabel = (status: StageProgress['status']) => {
    switch (status) {
      case 'running':
        return 'RUNNING';
      case 'completed':
        return 'COMPLETE';
      case 'failed':
        return 'FAILED';
      case 'skipped':
        return 'SKIPPED';
      case 'pending':
      default:
        return 'PENDING';
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (!isOpen) return null;

  const modalClasses = getModalClasses(colorScheme, glassStrength);

  return (
    <>
      <div className={modalClasses.overlay}>
        <div
          className={`${modalClasses.content} max-w-2xl w-full`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b-2 border-white/30 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-t-[32px]">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1">
                  {isComplete
                    ? 'Enrichment Complete!'
                    : hasError
                    ? 'Enrichment Failed'
                    : 'Enriching Session'}
                </h2>
                <p className="text-sm text-gray-600 line-clamp-1">
                  {session.name}
                </p>
              </div>
              {(isComplete || hasError) && (
                <Button
                  onClick={onCancel}
                  variant="ghost"
                  size="sm"
                  className="rounded-xl p-2 ml-4"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Overall Progress */}
            {!hasError && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Overall Progress
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    {Math.round(overallProgress)}%
                  </span>
                </div>
                <div className="h-3 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
                  <div
                    className="h-full rounded-full transition-all duration-500 shadow-sm bg-gradient-to-r from-blue-500 to-purple-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">{stageMessage}</p>
              </div>
            )}

            {/* Stage Progress */}
            {!hasError && !isComplete && (
              <div className="space-y-4">
                {/* Video Chaptering */}
                <div className="bg-white/40 backdrop-blur-sm rounded-[20px] p-4 border border-white/60 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${getStageColor(videoProgress.status)}`}>
                        {getStageIcon(videoProgress.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Film className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-900">
                          Video Chaptering
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${getStageColor(videoProgress.status)}`}>
                      {getStageLabel(videoProgress.status)}
                    </span>
                  </div>
                  {videoProgress.status === 'running' && (
                    <>
                      <p className="text-xs text-gray-600 mb-2 ml-11">
                        Detecting chapter boundaries...
                      </p>
                      <div className="ml-11 h-2 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
                        <div
                          className="h-full rounded-full transition-all duration-500 shadow-sm bg-gradient-to-r from-blue-500 to-blue-600"
                          style={{ width: `${videoProgress.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1 ml-11">
                        {Math.round(videoProgress.progress)}%
                      </p>
                    </>
                  )}
                </div>

                {/* Audio Analysis */}
                <div className="bg-white/40 backdrop-blur-sm rounded-[20px] p-4 border border-white/60 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${getStageColor(audioProgress.status)}`}>
                        {getStageIcon(audioProgress.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-semibold text-gray-900">
                          Audio Analysis
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${getStageColor(audioProgress.status)}`}>
                      {getStageLabel(audioProgress.status)}
                    </span>
                  </div>
                  {audioProgress.status === 'running' && (
                    <>
                      <p className="text-xs text-gray-600 mb-2 ml-11">
                        Listening to your session...
                      </p>
                      <div className="ml-11 h-2 bg-gradient-to-r from-gray-100 to-gray-50 rounded-full overflow-hidden shadow-inner border border-gray-200/50">
                        <div
                          className="h-full rounded-full transition-all duration-500 shadow-sm bg-gradient-to-r from-purple-500 to-purple-600"
                          style={{ width: `${audioProgress.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1 ml-11">
                        {Math.round(audioProgress.progress)}%
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Success Summary */}
            {isComplete && result && (
              <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-[20px] p-6 border border-green-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="text-lg font-bold text-green-900">
                      Enrichment Successful!
                    </h3>
                    <p className="text-sm text-green-700">
                      Your session has been enhanced with AI insights
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {result.audio?.completed && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Audio analysis complete
                      </span>
                      <span className="text-gray-600">${result.audio.cost.toFixed(1)}</span>
                    </div>
                  )}
                  {result.video?.completed && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Video chapters generated
                      </span>
                      <span className="text-gray-600">${result.video.cost.toFixed(1)}</span>
                    </div>
                  )}
                  {result.summary?.completed && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Summary regenerated
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-green-200/50 flex items-center justify-between">
                  <span className="text-sm font-semibold text-green-900">Total Cost</span>
                  <span className="text-lg font-bold text-green-900">${result.totalCost.toFixed(1)}</span>
                </div>

                {result.warnings.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {result.warnings.map((warning, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-yellow-700">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{warning}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {hasError && (
              <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-[20px] p-6 border border-red-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <XCircle className="w-8 h-8 text-red-600" />
                  <div>
                    <h3 className="text-lg font-bold text-red-900">
                      Enrichment Failed
                    </h3>
                    <p className="text-sm text-red-700">
                      {errorMessage || 'An error occurred during enrichment'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    You can try again or check the session for partial results.
                  </p>
                </div>
              </div>
            )}

            {/* Time Information */}
            {isProcessing && (
              <div className="flex items-center justify-between text-sm text-gray-600 bg-white/20 backdrop-blur-sm rounded-[16px] p-4 border border-white/60">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Time Elapsed: {formatTime(elapsedTime)}</span>
                </div>
                {estimatedRemaining !== null && overallProgress > 10 && (
                  <span>Estimated Remaining: {formatTime(estimatedRemaining)}</span>
                )}
              </div>
            )}

            {/* Info Note */}
            {isProcessing && (
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-[16px] p-4 border border-blue-200/50">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <span className="font-semibold">What's happening:</span> We're using AI to analyze your session audio and video, generating chapters, transcripts, and insights. This usually takes 2-5 minutes.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t-2 border-white/30 bg-white/40 backdrop-blur-xl rounded-b-[32px]">
            {isProcessing && !isCancelling && (
              <div className="flex items-center justify-center">
                <Button
                  onClick={() => setShowCancelConfirm(true)}
                  variant="secondary"
                  size="md"
                  className="rounded-xl"
                  disabled={currentStage === 'summary'} // Disable during critical summary operation
                >
                  Cancel Enrichment
                </Button>
              </div>
            )}

            {isCancelling && (
              <p className="text-sm text-gray-600 text-center">
                Cancelling enrichment...
              </p>
            )}

            {isComplete && (
              <div className="flex items-center justify-center">
                <Button
                  onClick={onCancel}
                  variant="primary"
                  size="md"
                  className="rounded-xl"
                >
                  Close
                </Button>
              </div>
            )}

            {hasError && (
              <div className="flex items-center justify-center gap-3">
                <Button
                  onClick={onCancel}
                  variant="secondary"
                  size="md"
                  className="rounded-xl"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    // Reset state and retry
                    setHasError(false);
                    setErrorMessage(null);
                    setIsComplete(false);
                    setOverallProgress(0);
                    setAudioProgress({ status: 'pending', progress: 0 });
                    setVideoProgress({ status: 'pending', progress: 0 });
                    setSummaryProgress({ status: 'pending', progress: 0 });
                    startEnrichment();
                  }}
                  variant="primary"
                  size="md"
                  className="rounded-xl"
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelConfirm}
        title="Cancel Enrichment?"
        message="Are you sure you want to cancel? All progress will be lost and you'll need to start over."
        confirmLabel="Yes, Cancel"
        cancelLabel="Continue Processing"
        variant="warning"
      />
    </>
  );
}
