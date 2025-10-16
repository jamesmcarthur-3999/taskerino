/**
 * Hook for managing the delightful session starting experience
 *
 * Coordinates:
 * - 3-second countdown animation (3 → 2 → 1 → Recording!)
 * - Button loading states
 * - Session creation
 * - Auto-navigation to active session view
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSessions } from '../context/SessionsContext';
import { useUI } from '../context/UIContext';
import type { Session } from '../types';

interface SessionStartingState {
  isStarting: boolean;
  countdown: number | null;
  startedSessionId: string | null;
  shouldAutoScroll: boolean;
}

export function useSessionStarting() {
  const { startSession, activeSessionId } = useSessions();
  const { addNotification } = useUI();
  const [state, setState] = useState<SessionStartingState>({
    isStarting: false,
    countdown: null,
    startedSessionId: null,
    shouldAutoScroll: false,
  });

  // Ref to track when we're waiting for a new session to be created
  const waitingForSessionRef = useRef<boolean>(false);
  const previousActiveSessionIdRef = useRef<string | undefined>(activeSessionId);

  // Effect to detect when a new session is created and trigger auto-scroll
  useEffect(() => {
    console.log('🔍 [Session Starting Hook] useEffect fired:', {
      waitingForSession: waitingForSessionRef.current,
      activeSessionId,
      previousActiveSessionId: previousActiveSessionIdRef.current,
      changed: activeSessionId !== previousActiveSessionIdRef.current
    });

    // Check if we're waiting for a session and the activeSessionId changed
    if (waitingForSessionRef.current && activeSessionId && activeSessionId !== previousActiveSessionIdRef.current) {
      console.log('🎯 [Session Starting] New session detected:', activeSessionId);

      // Clear the waiting flag
      waitingForSessionRef.current = false;

      // Trigger auto-scroll with the new session ID
      setState(prev => {
        console.log('🎯 [Session Starting] Setting shouldAutoScroll=true, startedSessionId:', activeSessionId);
        return {
          ...prev,
          startedSessionId: activeSessionId,
          shouldAutoScroll: true,
          isStarting: false,
        };
      });
    }

    // Update previous ref
    previousActiveSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  /**
   * Start a session with delightful countdown UX flow:
   * 1. Show countdown: 3 → 2 → 1
   * 2. Create the session
   * 3. Show "Recording!" state briefly
   * 4. Flag for auto-scroll to active session
   * 5. Return the new session ID
   *
   * PACING: Matches the 3-second delay before first screenshot
   */
  const handleStartSession = useCallback(
    async (
      sessionData: Omit<
        Session,
        'id' | 'startTime' | 'screenshots' | 'extractedTaskIds' | 'extractedNoteIds'
      >
    ): Promise<string> => {
      console.log('🎬 [Session Starting] Starting countdown for new session:', sessionData.name);

      // Step 1: Set starting state
      setState({
        isStarting: true,
        countdown: null,
        startedSessionId: null,
        shouldAutoScroll: false,
      });

      try {
        // Step 2: Countdown sequence - 3 → 2 → 1
        for (let i = 3; i > 0; i--) {
          setState(prev => ({
            ...prev,
            countdown: i,
          }));
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Step 3: Show "Recording!" state (countdown = 0)
        setState(prev => ({
          ...prev,
          countdown: 0,
        }));

        // Step 4: Create the session
        console.log('🎬 [Session Starting] Creating session...');

        // Set the waiting flag BEFORE creating the session
        // This tells the useEffect to watch for the new activeSessionId
        waitingForSessionRef.current = true;

        startSession(sessionData);

        console.log('✅ [Session Starting] Session creation dispatched, waiting for activeSessionId update...');

        // Step 5: Hold "Recording!" state briefly
        // The useEffect will detect the new session and trigger auto-scroll
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 6: Success notification
        addNotification({
          type: 'success',
          title: 'Session Started',
          message: `"${sessionData.name}" is now recording`,
        });

        // Step 7: Clear countdown (auto-scroll will be handled by useEffect)
        setState(prev => ({
          ...prev,
          countdown: null,
        }));

        console.log('✅ [Session Starting] Countdown complete, navigation will trigger automatically');

        // Return the active session ID (will be updated by the time this returns)
        return activeSessionId || '';
      } catch (error) {
        console.error('❌ [Session Starting] Failed to start session:', error);

        // Clear the waiting flag on error
        waitingForSessionRef.current = false;

        addNotification({
          type: 'error',
          title: 'Session Start Failed',
          message: error instanceof Error ? error.message : 'Failed to start session',
        });

        setState({
          isStarting: false,
          countdown: null,
          startedSessionId: null,
          shouldAutoScroll: false,
        });

        throw error;
      }
    },
    [startSession, activeSessionId, addNotification]
  );

  /**
   * Reset auto-scroll flag after it's been consumed
   */
  const clearAutoScroll = useCallback(() => {
    setState(prev => ({
      ...prev,
      shouldAutoScroll: false,
      startedSessionId: null,
    }));
  }, []);

  /**
   * Check if a session was just started (useful for animations)
   */
  const isSessionNewlyStarted = useCallback(
    (sessionId: string): boolean => {
      return state.startedSessionId === sessionId;
    },
    [state.startedSessionId]
  );

  return {
    isStarting: state.isStarting,
    countdown: state.countdown,
    startedSessionId: state.startedSessionId,
    shouldAutoScroll: state.shouldAutoScroll,
    handleStartSession,
    clearAutoScroll,
    isSessionNewlyStarted,
  };
}
