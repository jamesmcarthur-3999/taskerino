/**
 * Hook for managing the delightful session ending experience
 *
 * Coordinates:
 * - Button loading states
 * - Notifications
 * - Auto-navigation to detail view
 * - Enrichment progress tracking
 */

import { useState, useCallback, useEffect } from 'react';
import { useSessions } from '../context/SessionsContext';
import { useUI } from '../context/UIContext';
import type { Session } from '../types';

interface SessionEndingState {
  isEnding: boolean;
  completedSessionId: string | null;
  shouldAutoNavigate: boolean;
}

export function useSessionEnding() {
  const { sessions, endSession } = useSessions();
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
      // Step 2: Show "ending" notification
      addNotification({
        type: 'info',
        title: 'Ending Session',
        message: 'Saving your work...',
      });

      // Step 3: Start the actual save operation
      const savePromise = Promise.resolve(endSession(sessionId));

      // Enforce minimum display time of 1000ms for "Saving..." state
      // This ensures users can actually see the loading state and feel the intentionality
      const minDisplayTime = new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for both to complete
      await Promise.all([savePromise, minDisplayTime]);

      // Step 4: Success notification
      addNotification({
        type: 'success',
        title: 'Session Complete',
        message: 'Your session has been saved successfully. Opening summary...',
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
