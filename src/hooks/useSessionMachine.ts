import { useMachine } from '@xstate/react';
import { sessionMachine } from '../machines/sessionMachine';
import type { SessionRecordingConfig } from '../types';
import type { SessionMachineContext, SessionMachineEvent } from '../machines/sessionMachine';

/**
 * Session state value type
 * Explicitly defined to work around XState v5 type inference issues
 */
type SessionStateValue =
  | 'idle'
  | 'validating'
  | 'checking_permissions'
  | 'starting'
  | 'active'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'ending'
  | 'completed'
  | 'error';

/**
 * React hook for the session state machine
 *
 * Provides a clean, type-safe API for managing session recording lifecycle.
 * Wraps the XState machine and provides convenience methods and state checks.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     isIdle,
 *     isActive,
 *     startSession,
 *     endSession,
 *     context,
 *   } = useSessionMachine();
 *
 *   const handleStart = () => {
 *     startSession({
 *       name: 'My Session',
 *       screenshotsEnabled: true,
 *       audioConfig: {
 *         enabled: true,
 *         sourceType: 'microphone',
 *       },
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       {isIdle && <button onClick={handleStart}>Start Session</button>}
 *       {isActive && <button onClick={endSession}>End Session</button>}
 *       <p>Session ID: {context.sessionId}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSessionMachine() {
  const [state, send] = useMachine(sessionMachine);

  // Type assertion helper for state.matches()
  const matches = (stateValue: SessionStateValue): boolean => {
    return state.matches(stateValue);
  };

  return {
    // =========================================================================
    // Current State Information
    // =========================================================================

    /**
     * Current state value (e.g., 'idle', 'active', 'paused')
     */
    currentState: state.value,

    /**
     * Full context object containing session data
     */
    context: state.context as SessionMachineContext,

    // =========================================================================
    // State Check Helpers
    // =========================================================================

    /**
     * True if the machine is in the idle state (no session active)
     */
    isIdle: matches('idle'),

    /**
     * True if the machine is validating configuration
     */
    isValidating: matches('validating'),

    /**
     * True if the machine is checking permissions
     */
    isCheckingPermissions: matches('checking_permissions'),

    /**
     * True if the machine is starting recording services
     */
    isStarting: matches('starting'),

    /**
     * True if the session is actively recording
     */
    isActive: matches('active'),

    /**
     * True if the machine is pausing recording services
     */
    isPausing: matches('pausing'),

    /**
     * True if the session is paused
     */
    isPaused: matches('paused'),

    /**
     * True if the machine is resuming recording services
     */
    isResuming: matches('resuming'),

    /**
     * True if the machine is ending the session
     */
    isEnding: matches('ending'),

    /**
     * True if the session has completed successfully
     */
    isCompleted: matches('completed'),

    /**
     * True if the machine is in an error state
     */
    isError: matches('error'),

    /**
     * True if the machine is in any transitional state
     * (validating, checking permissions, starting, pausing, resuming, ending)
     */
    isTransitioning:
      matches('validating') ||
      matches('checking_permissions') ||
      matches('starting') ||
      matches('pausing') ||
      matches('resuming') ||
      matches('ending'),

    // =========================================================================
    // Action Methods
    // =========================================================================

    /**
     * Start a new recording session
     *
     * @param config - Session recording configuration
     */
    startSession: (config: SessionRecordingConfig) => {
      // Generate session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create minimal session object with all required fields
      const session: import('../types').Session = {
        id: sessionId,
        name: config.name || 'Untitled Session',
        description: config.description || '',
        status: 'active',
        startTime: new Date().toISOString(),
        screenshotInterval: 2,
        autoAnalysis: false,
        enableScreenshots: config.screenshotsEnabled,
        audioMode: config.audioConfig?.enabled ? 'transcription' : 'off',
        audioRecording: config.audioConfig?.enabled || false,
        screenshots: [],
        relationships: [], // Required by Session interface
        audioReviewCompleted: false,
        tags: [],
      };

      // Create callbacks (can be undefined, the machine handles optionality)
      const callbacks = {
        onScreenshotCapture: undefined,
        onAudioSegment: undefined,
      };

      send({ type: 'START', config, session, callbacks });
    },

    /**
     * Pause the current recording session
     */
    pauseSession: () => {
      send({ type: 'PAUSE' });
    },

    /**
     * Resume a paused recording session
     */
    resumeSession: () => {
      send({ type: 'RESUME' });
    },

    /**
     * End the current recording session
     */
    endSession: () => {
      send({ type: 'END' });
    },

    /**
     * Retry after an error (returns to idle state)
     */
    retrySession: () => {
      send({ type: 'RETRY' });
    },

    /**
     * Dismiss an error and return to idle state
     */
    dismissError: () => {
      send({ type: 'DISMISS' });
    },

    /**
     * Force reset the machine to idle state from ANY state
     * Used for recovery from stuck states or cleanup after errors
     *
     * CRITICAL: This is a forceful reset that clears ALL state and transitions
     * to idle regardless of current state. Use this when:
     * - Recovery modal is dismissed
     * - Machine is stuck in a bad state
     * - Need to completely reset session lifecycle
     */
    reset: () => {
      send({ type: 'RESET' });
    },

    /**
     * Update the recording state for individual services
     *
     * @param updates - Partial recording state to update
     */
    updateRecordingState: (
      updates: Partial<SessionMachineContext['recordingState']>
    ) => {
      send({ type: 'UPDATE_RECORDING_STATE', updates });
    },

    /**
     * Report an error from a recording service
     * Transitions the machine to error state
     *
     * @param error - Error message
     */
    reportError: (error: string) => {
      send({ type: 'ERROR', error });
    },

    // =========================================================================
    // Advanced Access
    // =========================================================================

    /**
     * Raw XState state object (for advanced use cases)
     */
    state,

    /**
     * Raw send function (for advanced use cases)
     */
    send,

    /**
     * Whether the machine can transition to a specific state
     *
     * @param event - Event to check
     */
    canSend: (event: SessionMachineEvent) => {
      return state.can(event);
    },
  };
}

/**
 * Type export for the hook's return value
 */
export type UseSessionMachineReturn = ReturnType<typeof useSessionMachine>;
