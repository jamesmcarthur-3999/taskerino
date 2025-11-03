import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, PlayCircle, StopCircle } from 'lucide-react';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useRecording } from '../context/RecordingContext';
import { useSessionMachine } from '../hooks/useSessionMachine';
import { useUI } from '../context/UIContext';
import { useTheme } from '../context/ThemeContext';
import { getModalClasses, getModalHeaderClasses } from '../design-system/theme';
import { Button } from './Button';
import {
  modalBackdropVariants,
  modalFormVariants,
} from '../animations/variants';
import type { Session } from '../types';

interface SessionRecoveryModalProps {
  session: Session | null;
  onClose: () => void;
}

export function SessionRecoveryModal({ session, onClose }: SessionRecoveryModalProps) {
  const { restoreSession, endSession } = useActiveSession();
  const { resetAll } = useRecording();
  const { reset } = useSessionMachine();
  const { addNotification } = useUI();
  const { colorScheme, glassStrength } = useTheme();

  if (!session) return null;

  /**
   * Handle dismissal (backdrop click or user cancellation)
   * CRITICAL: Must reset ALL state to prevent "session already in progress" error
   */
  const handleDismiss = () => {
    console.log('[SessionRecoveryModal] Dismissing recovery modal - resetting all state');

    // Reset XState machine to idle
    reset();

    // Reset RecordingContext services to idle
    resetAll();

    // Close modal
    onClose();

    addNotification({
      type: 'info',
      title: 'Recovery Dismissed',
      message: 'Orphaned session was discarded. You can start a new session.',
    });
  };

  const handleResume = async () => {
    try {
      await restoreSession(session);
      addNotification({
        type: 'success',
        title: 'Session Restored',
        message: `Restored session "${session.name}". Recordings were not resumed automatically.`,
      });
      onClose();
    } catch (error) {
      console.error('[SessionRecoveryModal] Failed to restore session:', error);
      addNotification({
        type: 'error',
        title: 'Restore Failed',
        message: error instanceof Error ? error.message : 'Failed to restore session',
      });
    }
  };

  const handleEnd = async () => {
    console.log('[SessionRecoveryModal] handleEnd called');
    console.log('[SessionRecoveryModal] Session data:', {
      id: session.id,
      name: session.name,
      status: session.status,
      startTime: session.startTime,
    });

    try {
      console.log('[SessionRecoveryModal] Calling endSession...');
      await endSession();
      console.log('[SessionRecoveryModal] endSession completed');

      // After ending session, ensure state is reset
      // endSession() should handle this, but be defensive
      reset();
      resetAll();

      addNotification({
        type: 'success',
        title: 'Session Ended',
        message: `Session "${session.name}" has been ended and saved.`,
      });
      onClose();
    } catch (error) {
      console.error('[SessionRecoveryModal] Failed to end session:', error);

      // Even on error, try to reset state
      reset();
      resetAll();

      addNotification({
        type: 'error',
        title: 'End Session Failed',
        message: error instanceof Error ? error.message : 'Failed to end session',
      });
    }
  };

  const duration = session.startTime
    ? Math.floor((new Date().getTime() - new Date(session.startTime).getTime()) / 60000)
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        initial="hidden"
        animate="visible"
        exit="hidden"
        variants={modalBackdropVariants}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleDismiss}
        />

        {/* Modal */}
        <motion.div
          className={`${getModalClasses(colorScheme, glassStrength).content} relative`}
          variants={modalFormVariants}
          style={{ maxWidth: '500px', width: '100%' }}
        >
          {/* Header */}
          <div className={getModalHeaderClasses(colorScheme)}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl font-semibold">Active Session Detected</h2>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <p className="text-gray-300">
              An active recording session was detected. This may have been interrupted by a hot reload,
              crash, or improper shutdown.
            </p>

            <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Session:</span>
                <span className="text-white font-medium">{session.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Started:</span>
                <span className="text-white">
                  {new Date(session.startTime || '').toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Duration:</span>
                <span className="text-white">{duration} minutes</span>
              </div>
              {session.screenshots && session.screenshots.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Screenshots:</span>
                  <span className="text-white">{session.screenshots.length}</span>
                </div>
              )}
              {session.audioSegments && session.audioSegments.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Audio Segments:</span>
                  <span className="text-white">{session.audioSegments.length}</span>
                </div>
              )}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                <strong>Resume:</strong> Restore the session to the UI (recordings will not restart automatically).
              </p>
              <p className="text-sm text-blue-300 mt-2">
                <strong>End Session:</strong> Mark the session as completed and save all recorded data.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 pt-0">
            <Button
              onClick={handleEnd}
              variant="secondary"
              className="flex-1 flex items-center justify-center gap-2"
            >
              <StopCircle className="w-4 h-4" />
              End Session
            </Button>
            <Button
              onClick={handleResume}
              variant="primary"
              className="flex-1 flex items-center justify-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              Resume
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
