# Session State Machine Example

**Last Updated**: October 26, 2025

## Purpose

This example demonstrates how to use the XState v5 session state machine to manage session lifecycle with type-safe state transitions, validation, and permission checks. The state machine ensures impossible states are prevented at compile time.

## Use Case

Use the session state machine when you need to:
- Start, pause, resume, or end recording sessions
- Manage screenshot, audio, and video recording services
- Handle state validation and permission checks
- Implement reliable session lifecycle management
- Display session state in the UI with loading/error states
- Ensure type-safe state transitions

## Example Code

```typescript
import React from 'react';
import { useSessionMachine } from '../hooks/useSessionMachine';

/**
 * Example component demonstrating the Session State Machine
 *
 * This component shows how to use the useSessionMachine hook to manage
 * a recording session's lifecycle. It demonstrates:
 * - Starting a session with configuration
 * - Pausing and resuming
 * - Ending a session
 * - Error handling
 * - State inspection
 *
 * Usage:
 * Import this component into your app to test the state machine.
 * ```tsx
 * import { SessionMachineExample } from './machines/sessionMachine.example';
 *
 * function App() {
 *   return <SessionMachineExample />;
 * }
 * ```
 */
export function SessionMachineExample() {
  const {
    // State checks
    currentState,
    isIdle,
    isActive,
    isPaused,
    isError,
    isTransitioning,
    context,

    // Actions
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    retrySession,
  } = useSessionMachine();

  const handleStartSession = () => {
    startSession({
      name: 'Test Session',
      description: 'Testing the state machine',
      screenshotsEnabled: true,
      audioConfig: {
        enabled: true,
        sourceType: 'microphone',
      },
      videoConfig: {
        enabled: false,
        sourceType: 'display',
      },
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Session State Machine Demo</h1>

      {/* Current State Display */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Current State</h2>

        <div className="space-y-2">
          <p className="text-lg">
            <span className="font-medium">State:</span>{' '}
            <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-sm">
              {String(currentState)}
            </span>
          </p>

          {context.sessionId && (
            <p>
              <span className="font-medium">Session ID:</span>{' '}
              <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-sm">
                {context.sessionId}
              </code>
            </p>
          )}

          {context.startTime && (
            <p>
              <span className="font-medium">Started:</span>{' '}
              {new Date(context.startTime).toLocaleTimeString()}
            </p>
          )}

          {context.errors.length > 0 && (
            <div className="mt-4">
              <p className="font-medium text-red-600 dark:text-red-400">Errors:</p>
              <ul className="list-disc list-inside text-red-600 dark:text-red-400 text-sm">
                {context.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Recording State Display */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Recording Services</h2>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="font-medium mb-2">Screenshots</p>
            <StateIndicator state={context.recordingState.screenshots} />
          </div>

          <div>
            <p className="font-medium mb-2">Audio</p>
            <StateIndicator state={context.recordingState.audio} />
          </div>

          <div>
            <p className="font-medium mb-2">Video</p>
            <StateIndicator state={context.recordingState.video} />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>

        <div className="flex flex-wrap gap-3">
          {isIdle && (
            <button
              onClick={handleStartSession}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              Start Session
            </button>
          )}

          {isTransitioning && (
            <div className="px-6 py-3 bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Processing...
            </div>
          )}

          {isActive && (
            <>
              <button
                onClick={pauseSession}
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
              >
                Pause
              </button>
              <button
                onClick={endSession}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                End Session
              </button>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={resumeSession}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Resume
              </button>
              <button
                onClick={endSession}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                End Session
              </button>
            </>
          )}

          {isError && (
            <button
              onClick={retrySession}
              className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Configuration Display */}
      {context.config && (
        <div className="mt-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Session Configuration</h2>
          <pre className="bg-gray-200 dark:bg-gray-900 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(context.config, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/**
 * Helper component to display recording service state with color coding
 */
function StateIndicator({ state }: { state: string }) {
  const colors: Record<string, string> = {
    idle: 'bg-gray-400',
    initializing: 'bg-blue-400',
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    stopping: 'bg-orange-500',
    stopped: 'bg-gray-600',
    error: 'bg-red-500',
  };

  const bgColor = colors[state] || 'bg-gray-400';

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${bgColor}`} />
      <span className="text-sm capitalize">{state}</span>
    </div>
  );
}
```

## Key Points

- **Type-Safe State Machine**: Uses XState v5 for compile-time state safety
- **Impossible States Prevention**: Invalid state transitions are prevented at compile time
- **Comprehensive State Management**: Handles idle, validating, checking permissions, starting, active, pausing, paused, resuming, ending, completed, and error states
- **Recording Service Coordination**: Manages screenshots, audio, and video recording services
- **Permission Guards**: Validates device permissions before starting recordings
- **Context Preservation**: Maintains session ID, config, start time, and errors across transitions
- **Error Recovery**: Provides retry mechanism for failed state transitions
- **Visual State Inspection**: Built-in state diagram for XState inspector
- **21 Comprehensive Tests**: All state transitions and guards are thoroughly tested

## State Diagram

```
idle → validating → checking_permissions → starting → active
                                                      ↓
                                              pausing → paused → resuming → active
                                                      ↓
                                                   ending → completed
                                                      ↓
                                                    error → (retry) → idle
```

## Related Documentation

- Main State Machine: `/src/machines/sessionMachine.ts`
- Hook: `/src/hooks/useSessionMachine.ts`
- State Machine Tests: `/src/machines/sessionMachine.test.ts`
- Recording Context: `/src/context/RecordingContext.tsx`
- Active Session Context: `/src/context/ActiveSessionContext.tsx`
