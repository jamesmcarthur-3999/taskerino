/**
 * SessionProcessingScreen - Full-screen processing modal for media optimization
 *
 * Displays real-time progress during media processing (audio concatenation + video/audio merge).
 * Shows stage indicators, progress bars, and auto-navigates when complete.
 *
 * **Stages**:
 * 1. Concatenating Audio - Combine audio segments into single MP3 (~5s)
 * 2. Merging Video - Merge video + audio into optimized MP4 (~30s)
 * 3. Complete - Processing finished, ready to view
 *
 * **Features**:
 * - Real-time progress updates via eventBus
 * - Smooth animations with framer-motion
 * - Auto-navigate after 2 seconds (or manual navigation)
 * - Non-blocking (user can navigate away)
 * - Background processing disclaimer
 *
 * **Event Subscription**:
 * Subscribes to:
 * - `media-processing-progress` - Update progress/stage
 * - `media-processing-complete` - Mark complete, trigger navigation
 * - `media-processing-error` - Show error state
 *
 * **Navigation**:
 * - Auto-navigates to session detail (/sessions tab, active session) after 2s
 * - User can click "View Session" to navigate immediately
 * - User can close/navigate away (processing continues in background)
 *
 * @example
 * ```typescript
 * // In ActiveSessionContext.endSession():
 * navigate('/sessions/processing', { state: { sessionId: session.id } });
 * ```
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Loader2, Music, Film, Sparkles, Info } from 'lucide-react';
import { eventBus } from '../../utils/eventBus';
import type { MediaProcessingProgressEvent, MediaProcessingCompleteEvent, MediaProcessingErrorEvent } from '../../utils/eventBus';
import { useUI } from '../../context/UIContext';
import { getGlassClasses, SHADOWS, RADIUS, DURATION, EASING } from '../../design-system/theme';

// ============================================================================
// Types
// ============================================================================

export interface SessionProcessingScreenProps {
  /**
   * Session ID from route state or context
   * If not provided, will try to get from UIContext or URL
   */
  sessionId?: string;
}

type ProcessingStage = 'concatenating' | 'merging' | 'complete' | 'error';

interface StageInfo {
  stage: ProcessingStage;
  label: string;
  icon: typeof Music;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const STAGE_INFO: Record<ProcessingStage, StageInfo> = {
  concatenating: {
    stage: 'concatenating',
    label: 'Combining Audio',
    icon: Music,
    description: 'Merging audio segments into single file...',
  },
  merging: {
    stage: 'merging',
    label: 'Optimizing Video',
    icon: Film,
    description: 'Creating optimized video with audio...',
  },
  complete: {
    stage: 'complete',
    label: 'Complete!',
    icon: Sparkles,
    description: 'Your session is ready to view',
  },
  error: {
    stage: 'error',
    label: 'Processing Error',
    icon: Info,
    description: 'An error occurred during processing',
  },
};

// ============================================================================
// Component
// ============================================================================

export function SessionProcessingScreen({ sessionId: propSessionId }: SessionProcessingScreenProps) {
  const { dispatch: uiDispatch } = useUI();

  // State
  const [sessionId, setSessionId] = useState<string | undefined>(propSessionId);
  const [stage, setStage] = useState<ProcessingStage>('concatenating');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [canNavigate, setCanNavigate] = useState(false);

  // Refs
  const autoNavigateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // Event Subscription
  // ============================================================================

  useEffect(() => {
    if (!sessionId) {
      // If no sessionId provided, try to get from route state or context
      // For now, just log a warning
      console.warn('[SessionProcessingScreen] No sessionId provided');
      return;
    }

    // Subscribe to media processing events
    const unsubscribeProgress = eventBus.on('media-processing-progress', (event: MediaProcessingProgressEvent) => {
      if (event.sessionId !== sessionId) return;

      setStage(event.stage);
      setProgress(event.progress);
      setMessage(event.message);
    });

    const unsubscribeComplete = eventBus.on('media-processing-complete', (event: MediaProcessingCompleteEvent) => {
      if (event.sessionId !== sessionId) return;

      setStage('complete');
      setProgress(100);
      setCanNavigate(true);
    });

    const unsubscribeError = eventBus.on('media-processing-error', (event: MediaProcessingErrorEvent) => {
      if (event.sessionId !== sessionId) return;

      setStage('error');
      setError(event.error);
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, [sessionId]);

  // ============================================================================
  // Auto-Navigation
  // ============================================================================

  useEffect(() => {
    if (stage === 'complete' && canNavigate) {
      // Wait 2 seconds, then navigate to sessions zone
      autoNavigateTimeoutRef.current = setTimeout(() => {
        handleNavigate();
      }, 2000);

      return () => {
        if (autoNavigateTimeoutRef.current) {
          clearTimeout(autoNavigateTimeoutRef.current);
        }
      };
    }
  }, [stage, canNavigate]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleNavigate = () => {
    // Clear timeout if user clicks manually
    if (autoNavigateTimeoutRef.current) {
      clearTimeout(autoNavigateTimeoutRef.current);
    }

    // Navigate to sessions zone
    uiDispatch({ type: 'SET_ACTIVE_TAB', payload: 'sessions' });
    // Note: The active session ID will be set in the SessionsZone
    // which will display the session detail view
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const currentStageInfo = STAGE_INFO[stage];

  const renderStageIndicator = (stageKey: 'concatenating' | 'merging' | 'complete') => {
    const stageData = STAGE_INFO[stageKey];
    const Icon = stageData.icon;

    const isComplete = (
      stageKey === 'concatenating' && (stage === 'merging' || stage === 'complete') ||
      stageKey === 'merging' && stage === 'complete' ||
      stageKey === 'complete' && stage === 'complete'
    );

    const isCurrent = stage === stageKey;

    return (
      <motion.div
        key={stageKey}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: DURATION.moderate / 1000, ease: EASING.smooth }}
        className="flex items-center gap-4"
      >
        {/* Stage Icon */}
        <div
          className={`
            relative flex items-center justify-center
            w-12 h-12 rounded-full
            ${isComplete ? 'bg-gradient-to-r from-green-500 to-emerald-500' : ''}
            ${isCurrent ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : ''}
            ${!isComplete && !isCurrent ? 'bg-white/20' : ''}
            backdrop-blur-xl border-2
            ${isComplete ? 'border-green-300' : ''}
            ${isCurrent ? 'border-blue-300' : ''}
            ${!isComplete && !isCurrent ? 'border-white/40' : ''}
            transition-all duration-300
          `}
        >
          {isComplete ? (
            <CheckCircle size={24} className="text-white" />
          ) : isCurrent ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 size={24} className="text-white" />
            </motion.div>
          ) : (
            <Icon size={24} className="text-gray-400" />
          )}
        </div>

        {/* Stage Label */}
        <div className="flex-1">
          <h3
            className={`
              text-lg font-semibold
              ${isComplete || isCurrent ? 'text-white' : 'text-white/60'}
              transition-colors duration-300
            `}
          >
            {stageData.label}
          </h3>
          <p
            className={`
              text-sm
              ${isCurrent ? 'text-white/80' : 'text-white/50'}
              transition-colors duration-300
            `}
          >
            {stageData.description}
          </p>
        </div>
      </motion.div>
    );
  };

  const renderProgressBar = () => {
    if (stage === 'complete' || stage === 'error') {
      return null;
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.moderate / 1000, delay: 0.2 }}
        className="w-full"
      >
        {/* Progress Bar Container */}
        <div className="relative w-full h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
          {/* Progress Fill */}
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{
              type: 'spring',
              stiffness: 100,
              damping: 20,
            }}
          />

          {/* Shimmer Effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{
              x: ['-100%', '200%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </div>

        {/* Progress Percentage */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-white/80">
            {message || `${Math.round(progress)}%`}
          </span>
          {stage === 'merging' && (
            <span className="text-xs text-white/60">
              ~{Math.round((100 - progress) / 3)} seconds remaining
            </span>
          )}
        </div>
      </motion.div>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-900/95 via-purple-900/95 to-indigo-900/95 backdrop-blur-xl">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
      </div>

      {/* Content Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: DURATION.moderate / 1000, ease: EASING.smooth }}
        className={`
          relative z-10
          w-full max-w-2xl mx-4
          ${getGlassClasses('strong')}
          rounded-[${RADIUS.modal}px]
          ${SHADOWS.modal}
          p-8
          space-y-8
        `}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="inline-block"
          >
            <Sparkles size={48} className="text-cyan-400" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white">
            {stage === 'error' ? 'Processing Error' : 'Processing Your Session'}
          </h1>
          <p className="text-white/70">
            {stage === 'error'
              ? 'Something went wrong during processing'
              : 'Optimizing media for instant playback'}
          </p>
        </div>

        {/* Error State */}
        <AnimatePresence>
          {stage === 'error' && error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-red-500/20 border-2 border-red-400/60 rounded-2xl backdrop-blur-lg"
            >
              <p className="text-red-100 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage Indicators */}
        {stage !== 'error' && (
          <div className="space-y-6">
            {renderStageIndicator('concatenating')}
            {renderStageIndicator('merging')}
            {renderStageIndicator('complete')}
          </div>
        )}

        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-400/30 rounded-2xl backdrop-blur-lg"
        >
          <Info size={20} className="text-blue-300 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-100">
            <p className="font-semibold mb-1">You can close this page</p>
            <p className="text-blue-200/80">
              Processing will continue in the background. You'll be notified when it's complete.
            </p>
          </div>
        </motion.div>

        {/* Action Button */}
        <AnimatePresence>
          {(canNavigate || stage === 'error') && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={handleNavigate}
              className={`
                w-full
                px-6 py-4
                rounded-[${RADIUS.field}px]
                font-semibold text-white
                ${stage === 'error'
                  ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
                }
                ${SHADOWS.button}
                transition-all duration-300
                hover:scale-105 active:scale-95
              `}
            >
              {stage === 'error' ? 'Back to Sessions' : 'View Session'}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
