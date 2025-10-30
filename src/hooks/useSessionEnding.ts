/**
 * @file useSessionEnding.ts - Session end flow with graceful UX
 *
 * @overview
 * Manages the complete session ending experience with intentional pacing to ensure
 * users see loading states and feel the weight of the operation. Coordinates session
 * persistence, notifications, and auto-navigation to the detail view.
 *
 * @responsibilities
 * - **Loading States**: Shows "Saving..." state with minimum 1-second display time
 * - **Session Persistence**: Triggers session end action via context
 * - **Notifications**: Shows "Ending Session" → "Session Complete" progression
 * - **Auto-Navigation**: Flags for navigation to session detail/summary view
 * - **Error Handling**: Shows error notifications and resets state
 *
 * @ux_flow
 * 1. User clicks "End Session" button
 * 2. Hook shows "Ending Session / Saving..." notification
 * 3. Session end action dispatched to context
 * 4. Minimum 1-second "Saving..." display enforced (intentional pacing)
 * 5. "Session Complete" notification shown
 * 6. Auto-navigation flag set for SessionsZone to consume
 * 7. SessionsZone navigates to session detail view
 *
 * @timing
 * Enforces minimum 1000ms display time for "Saving..." state to ensure users
 * can see the loading indicator. This prevents jarring instant transitions and
 * makes the save operation feel substantial and reliable.
 *
 * @usage
 * ```typescript
 * function EndSessionButton({ sessionId }: { sessionId: string }) {
 *   const { isEnding, handleEndSession } = useSessionEnding();
 *
 *   return (
 *     <button
 *       onClick={() => handleEndSession(sessionId)}
 *       disabled={isEnding}
 *     >
 *       {isEnding ? 'Saving...' : 'End Session'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @side_effects
 * - Updates SessionsContext via endSession()
 * - Shows UI notifications via useUI()
 * - Triggers auto-navigation in SessionsZone
 * - May trigger enrichment pipeline if auto-enrich is enabled
 *
 * @enrichment
 * After session ends, the enrichment pipeline may automatically run if:
 * - session.enrichmentConfig.autoEnrichOnComplete is true
 * - Session has screenshots or audio to process
 * - Cost threshold not exceeded
 *
 * @migration_status
 * ✅ MIGRATED to Phase 1 contexts (October 2025)
 * - Now uses useActiveSession().endSession() and useSessionList().sessions
 * - No longer uses deprecated SessionsContext
 *
 * @see {@link ../context/ActiveSessionContext.tsx} - Phase 1 active session management
 * @see {@link ../context/SessionListContext.tsx} - Phase 1 session list management
 * @see {@link ../context/EnrichmentContext.tsx} - Enrichment pipeline management
 * @see {@link ../components/SessionsZone.tsx} - Consumes auto-navigation flag
 */

import { useState, useCallback, useEffect } from 'react';
import { useSessionList } from '../context/SessionListContext';
import { useActiveSession } from '../context/ActiveSessionContext';
import { useUI } from '../context/UIContext';
import type { Session } from '../types';

interface SessionEndingState {
  isEnding: boolean;
  completedSessionId: string | null;
  shouldAutoNavigate: boolean;
}

export function useSessionEnding() {
  const { sessions } = useSessionList();
  const { endSession } = useActiveSession();
  const { addNotification } = useUI();
  const [state, setState] = useState<SessionEndingState>({
    isEnding: false,
    completedSessionId: null,
    shouldAutoNavigate: false,
  });

  /**
   * End a session with delightful UX flow:
   * 1. Show loading state on button
   * 2. Mark session as completed
   * 3. Show success notification
   * 4. Flag for auto-navigation
   * 5. Return the completed session ID
   *
   * PACING: Intentionally slowed down to let users see the animations
   */
  const handleEndSession = useCallback(async (sessionId: string): Promise<string> => {
    console.log('🎬 [Session Ending] Starting graceful session end flow for:', sessionId);

    // Step 1: Set loading state
    setState({
      isEnding: true,
      completedSessionId: null,
      shouldAutoNavigate: false,
    });

    try {
      // Step 2: Phase 1 notification - Stopping recordings
      addNotification({
        type: 'info',
        title: 'Ending Session',
        message: 'Stopping recordings...',
        autoDismiss: false, // Keep visible until we update it
      });

      // Step 3: Start the actual save operation
      const savePromise = endSession();

      // Step 3.5: After 800ms, update notification to Phase 2 - Saving
      // (500ms video stop + 300ms audio grace = 800ms typical recording stop time)
      const updateNotification = new Promise(resolve => {
        setTimeout(() => {
          addNotification({
            type: 'info',
            title: 'Ending Session',
            message: 'Saving your work...',
            autoDismiss: false, // Keep visible until complete
          });
          resolve(undefined);
        }, 800);
      });

      // Enforce minimum total display time of 1000ms
      const minDisplayTime = new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for all to complete (save, notification update, and min display time)
      await Promise.all([savePromise, updateNotification, minDisplayTime]);

      // Step 4: Success notification (Phase 3)
      addNotification({
        type: 'success',
        title: 'Session Complete',
        message: 'Your session has been saved successfully.',
      });

      // Step 5: Flag for auto-navigation and mark as completed
      setState({
        isEnding: false,
        completedSessionId: sessionId,
        shouldAutoNavigate: true,
      });

      console.log('✅ [Session Ending] Session ended successfully:', sessionId);

      return sessionId;
    } catch (error) {
      console.error('❌ [Session Ending] Failed to end session:', error);

      // RACE CONDITION FIX: Proper error propagation (no swallowing)
      addNotification({
        type: 'error',
        title: 'Session End Failed',
        message: error instanceof Error ? error.message : 'Failed to end session',
      });

      setState({
        isEnding: false,
        completedSessionId: null,
        shouldAutoNavigate: false,
      });

      // Rethrow to bubble error up to caller (critical for error handling)
      throw error;
    }
  }, [endSession, addNotification]);

  /**
   * Reset navigation flag after it's been consumed
   */
  const clearAutoNavigation = useCallback(() => {
    setState(prev => ({
      ...prev,
      shouldAutoNavigate: false,
      completedSessionId: null,
    }));
  }, []);

  /**
   * Check if a session was just completed (useful for animations)
   */
  const isSessionNewlyCompleted = useCallback((sessionId: string): boolean => {
    return state.completedSessionId === sessionId;
  }, [state.completedSessionId]);

  return {
    isEnding: state.isEnding,
    completedSessionId: state.completedSessionId,
    shouldAutoNavigate: state.shouldAutoNavigate,
    handleEndSession,
    clearAutoNavigation,
    isSessionNewlyCompleted,
  };
}
