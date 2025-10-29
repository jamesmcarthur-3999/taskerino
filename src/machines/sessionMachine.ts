import { setup, assign } from 'xstate';
import type { SessionRecordingConfig, Session, SessionScreenshot, SessionAudioSegment } from '../types';
import * as services from './sessionMachineServices';

/**
 * Recording service state for each recording type
 */
export type RecordingServiceState =
  | 'idle'
  | 'initializing'
  | 'active'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

/**
 * Context for the session state machine
 */
export interface SessionMachineContext {
  sessionId: string | null;
  config: SessionRecordingConfig | null;
  session: Session | null;
  callbacks: {
    onScreenshotCapture?: (screenshot: SessionScreenshot) => Promise<void>;
    onAudioSegment?: (segment: SessionAudioSegment) => void;
  } | null;
  startTime: number | null;
  errors: string[];
  recordingState: {
    screenshots: RecordingServiceState;
    audio: RecordingServiceState;
    video: RecordingServiceState;
  };
}

/**
 * Events that can be sent to the session state machine
 */
export type SessionMachineEvent =
  | {
      type: 'START';
      config: SessionRecordingConfig;
      session: Session;
      callbacks: {
        onScreenshotCapture?: (screenshot: SessionScreenshot) => Promise<void>;
        onAudioSegment?: (segment: SessionAudioSegment) => void;
      };
    }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'END' }
  | { type: 'PERSIST_COMPLETE' }
  | { type: 'RETRY' }
  | { type: 'DISMISS' }
  | { type: 'RESET' }
  | {
      type: 'UPDATE_RECORDING_STATE';
      updates: Partial<SessionMachineContext['recordingState']>
    }
  | {
      type: 'ERROR';
      error: string;
    };

/**
 * Session lifecycle state machine
 *
 * This state machine manages the complete lifecycle of a recording session,
 * from validation through to completion. It ensures that sessions can only
 * transition through valid states and handles errors gracefully.
 *
 * State Flow:
 * idle -> validating -> checking_permissions -> starting -> active
 *                                                           |
 *                                                           v
 *         completed <- ending <- paused/resumed <- active (loop)
 *                         |
 *                         v
 *                      error
 */
export const sessionMachine = setup({
  types: {} as {
    context: SessionMachineContext;
    events: SessionMachineEvent;
    value: 'idle' | 'validating' | 'checking_permissions' | 'starting'
         | 'active' | 'pausing' | 'paused' | 'resuming' | 'ending'
         | 'persisting' | 'completed' | 'error';
  },
  actors: {
    validateConfig: services.validateConfig,
    checkPermissions: services.checkPermissions,
    startRecordingServices: services.startRecordingServices,
    pauseRecordingServices: services.pauseRecordingServices,
    resumeRecordingServices: services.resumeRecordingServices,
    stopRecordingServices: services.stopRecordingServices,
    monitorRecordingHealth: services.monitorRecordingHealth,
  },
}).createMachine({
  id: 'session',
  initial: 'idle',

  context: {
    sessionId: null,
    config: null,
    session: null,
    callbacks: null,
    startTime: null,
    errors: [],
    recordingState: {
      screenshots: 'idle',
      audio: 'idle',
      video: 'idle',
    },
  } as SessionMachineContext,

  states: {
    /**
     * IDLE - Waiting for a session to start
     * Entry point for the state machine
     */
    idle: {
      on: {
        START: {
          target: 'validating',
          actions: assign({
            config: ({ event }) => event.config,
            session: ({ event }) => event.session,
            callbacks: ({ event }) => event.callbacks,
            errors: () => [],
            sessionId: () => null,
            startTime: () => null,
          }),
        },
        RESET: {
          // No-op: already in idle state, just ensure clean context
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
      },
    },

    /**
     * VALIDATING - Validate the session configuration
     * Ensures the config has required fields and valid values
     */
    validating: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
      },
      invoke: {
        src: 'validateConfig',
        input: ({ context }) => ({ config: context.config! }),
        onDone: {
          target: 'checking_permissions',
          actions: assign({
            sessionId: ({ event }) => event.output.sessionId,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            errors: ({ event }) => [String(event.error)],
          }),
        },
      },
    },

    /**
     * CHECKING_PERMISSIONS - Verify required system permissions
     * Checks for screen recording and microphone permissions as needed
     */
    checking_permissions: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
      },
      invoke: {
        src: 'checkPermissions',
        input: ({ context }) => ({
          config: context.config!,
          sessionId: context.sessionId!,
        }),
        onDone: {
          target: 'starting',
        },
        onError: {
          target: 'error',
          actions: assign({
            errors: ({ event }) => ['Missing permissions: ' + String(event.error)],
          }),
        },
      },
    },

    /**
     * STARTING - Initialize and start recording services
     * Starts screenshot, audio, and video recording based on config
     */
    starting: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
        ERROR: {
          target: 'error',
          actions: assign({
            errors: ({ event }) => [event.error],
          }),
        },
      },
      invoke: {
        src: 'startRecordingServices',
        input: ({ context }) => ({
          sessionId: context.sessionId!,
          config: context.config!,
          session: context.session!,
          callbacks: context.callbacks!,
        }),
        onDone: {
          target: 'active',
          actions: assign({
            startTime: () => Date.now(),
            recordingState: ({ event }) => event.output.recordingState,
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            errors: ({ event }) => [String(event.error)],
          }),
        },
      },
    },

    /**
     * ACTIVE - Recording in progress
     * Main operational state where recording happens
     */
    active: {
      on: {
        PAUSE: 'pausing',
        END: 'ending',
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
        ERROR: {
          target: 'error',
          actions: assign({
            errors: ({ event }) => [event.error],
          }),
        },
        UPDATE_RECORDING_STATE: {
          actions: assign({
            recordingState: ({ context, event }) => ({
              ...context.recordingState,
              ...event.updates,
            }),
          }),
        },
      },

      // Continuously monitor recording health while active
      invoke: {
        src: 'monitorRecordingHealth',
        input: ({ context }) => ({
          sessionId: context.sessionId!,
        }),
      },
    },

    /**
     * PAUSING - Pausing all recording services
     * Temporary suspension of recording
     */
    pausing: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
      },
      invoke: {
        src: 'pauseRecordingServices',
        input: ({ context }) => ({
          sessionId: context.sessionId!,
        }),
        onDone: 'paused',
        onError: {
          target: 'error',
          actions: assign({
            errors: ({ event }) => [String(event.error)],
          }),
        },
      },
    },

    /**
     * PAUSED - Recording is paused
     * Recording is suspended but can be resumed
     */
    paused: {
      on: {
        RESUME: 'resuming',
        END: 'ending',
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
      },
    },

    /**
     * RESUMING - Resuming recording services
     * Transitioning back to active state
     */
    resuming: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
      },
      invoke: {
        src: 'resumeRecordingServices',
        input: ({ context }) => ({
          sessionId: context.sessionId!,
          config: context.config!,
          session: context.session!,
          callbacks: context.callbacks!,
        }),
        onDone: 'active',
        onError: {
          target: 'error',
          actions: assign({
            errors: ({ event }) => [String(event.error)],
          }),
        },
      },
    },

    /**
     * ENDING - Stopping all recording services
     * Gracefully shutting down recording
     */
    ending: {
      on: {
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
      },
      invoke: {
        src: 'stopRecordingServices',
        input: ({ context }) => ({
          sessionId: context.sessionId!,
        }),
        onDone: {
          target: 'persisting',
          actions: assign({
            recordingState: () => ({
              screenshots: 'stopped' as const,
              audio: 'stopped' as const,
              video: 'stopped' as const,
            }),
          }),
        },
        onError: {
          target: 'error',
          actions: assign({
            errors: ({ event }) => [String(event.error)],
          }),
        },
      },
    },

    /**
     * PERSISTING - Waiting for storage operations to complete
     * Ensures all data is written before marking session complete
     */
    persisting: {
      on: {
        PERSIST_COMPLETE: {
          target: 'completed',
        },
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
      },
    },

    /**
     * COMPLETED - Session finished successfully
     * Automatically transitions back to idle to allow starting new sessions
     */
    completed: {
      always: {
        target: 'idle',
        actions: assign({
          sessionId: null,
          config: null,
          errors: () => [],
          recordingState: () => ({
            screenshots: 'idle',
            audio: 'idle',
            video: 'idle',
          }),
        }),
      },
    },

    /**
     * ERROR - Something went wrong
     * Can retry or dismiss to go back to idle
     */
    error: {
      on: {
        RETRY: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
        DISMISS: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
        RESET: {
          target: 'idle',
          actions: assign({
            sessionId: null,
            config: null,
            session: null,
            callbacks: null,
            errors: () => [],
            recordingState: () => ({
              screenshots: 'idle',
              audio: 'idle',
              video: 'idle',
            }),
          }),
        },
      },
    },
  },
});
