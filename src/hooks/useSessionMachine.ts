import { useMachine } from '@xstate/react';
import { sessionMachine } from '../machines/sessionMachine';
import type { SessionRecordingConfig } from '../types';
import type { SessionMachineContext, SessionMachineEvent } from '../machines/sessionMachine';

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
    isIdle: state.matches('idle'),

    /**
     * True if the machine is validating configuration
     */
    isValidating: state.matches('validating'),

    /**
     * True if the machine is checking permissions
     */
    isCheckingPermissions: state.matches('checking_permissions'),

    /**
     * True if the machine is starting recording services
     */
    isStarting: state.matches('starting'),

    /**
     * True if the session is actively recording
     */
    isActive: state.matches('active'),

    /**
     * True if the machine is pausing recording services
     */
    isPausing: state.matches('pausing'),

    /**
     * True if the session is paused
     */
    isPaused: state.matches('paused'),

    /**
     * True if the machine is resuming recording services
     */
    isResuming: state.matches('resuming'),

    /**
     * True if the machine is ending the session
     */
    isEnding: state.matches('ending'),

    /**
     * True if the session has completed successfully
     */
    isCompleted: state.matches('completed'),

    /**
     * True if the machine is in an error state
     */
    isError: state.matches('error'),

    /**
     * True if the machine is in any transitional state
     * (validating, checking permissions, starting, pausing, resuming, ending)
     */
    isTransitioning:
      state.matches('validating') ||
      state.matches('checking_permissions') ||
      state.matches('starting') ||
      state.matches('pausing') ||
      state.matches('resuming') ||
      state.matches('ending'),

    // =========================================================================
    // Action Methods
    // =========================================================================

    /**
     * Start a new recording session
     *
     * @param config - Session recording configuration
     */
    startSession: (config: SessionRecordingConfig) => {
      send({ type: 'START', config });
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
     * Update the recording state for individual services
     *
     * @param updates - Partial recording state to update
     */
    updateRecordingState: (
      updates: Partial<SessionMachineContext['recordingState']>
    ) => {
      send({ type: 'UPDATE_RECORDING_STATE', updates });
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
