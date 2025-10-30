/**
 * State Machine + Context Integration Tests
 *
 * Tests that verify the sessionMachine integrates correctly with contexts:
 * - State machine transitions trigger context updates
 * - Context changes sync with state machine state
 * - Recording services start/stop based on state machine transitions
 * - Error handling across machine and contexts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { createActor, fromPromise } from 'xstate';
import { sessionMachine } from '../sessionMachine';
import type { SessionRecordingConfig } from '../../types';

// ============================================================================
// Mocks
// ============================================================================

// Mock services
const mockValidateConfig = vi.fn(() => {
  return Promise.resolve({ sessionId: 'test-session-' + Date.now() });
});

const mockCheckPermissions = vi.fn(() => Promise.resolve());

const mockStartRecordingServices = vi.fn(() =>
  Promise.resolve({
    recordingState: {
      screenshots: 'active' as const,
      audio: 'active' as const,
      video: 'idle' as const,
    },
  })
);

const mockPauseRecordingServices = vi.fn(() => Promise.resolve());
const mockResumeRecordingServices = vi.fn(() => Promise.resolve());
const mockStopRecordingServices = vi.fn(() => Promise.resolve());
const mockMonitorRecordingHealth = vi.fn(() => Promise.resolve());

// Mock the service implementations - must return fromPromise actors for XState v5
vi.mock('../sessionMachineServices', () => ({
  validateConfig: fromPromise(({ input }: { input: { config: SessionRecordingConfig } }) => mockValidateConfig(input)),
  checkPermissions: fromPromise(() => mockCheckPermissions()),
  startRecordingServices: fromPromise(() => mockStartRecordingServices()),
  pauseRecordingServices: fromPromise(() => mockPauseRecordingServices()),
  resumeRecordingServices: fromPromise(() => mockResumeRecordingServices()),
  stopRecordingServices: fromPromise(() => mockStopRecordingServices()),
  monitorRecordingHealth: fromPromise(() => mockMonitorRecordingHealth()),
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createTestConfig(): SessionRecordingConfig {
  return {
    sessionId: 'test-session',
    name: 'Test Session',
    description: 'Test session for integration tests',
    screenshotConfig: {
      enabled: true,
      interval: 30,
    },
    audioConfig: {
      enabled: true,
      sampleRate: 44100,
      channels: 1,
    },
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('State Machine + Context Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('State Machine Lifecycle', () => {
    it('should complete full state transition flow', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      const states: string[] = [];
      actor.subscribe((state) => {
        states.push(state.value as string);
      });

      actor.start();
      expect(states).toContain('idle');

      // Start session
      actor.send({ type: 'START', config });

      // Wait for validation → permissions → starting → active
      await waitFor(
        () => {
          expect(states).toContain('active');
        },
        { timeout: 2000 }
      );

      // Verify service calls
      expect(mockValidateConfig).toHaveBeenCalledWith({ config });
      expect(mockCheckPermissions).toHaveBeenCalled();
      expect(mockStartRecordingServices).toHaveBeenCalled();

      // Verify state progression (removing duplicates as the subscriber can capture same state multiple times)
      const uniqueStates = Array.from(new Set(states));
      expect(uniqueStates).toEqual(['idle', 'validating', 'checking_permissions', 'starting', 'active']);

      actor.stop();
    });

    it('should handle pause and resume transitions', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();
      actor.send({ type: 'START', config });

      // Wait for active state
      await waitFor(
        () => {
          expect(actor.getSnapshot().value).toBe('active');
        },
        { timeout: 2000 }
      );

      // Pause
      actor.send({ type: 'PAUSE' });

      await waitFor(
        () => {
          expect(actor.getSnapshot().value).toBe('paused');
        },
        { timeout: 1000 }
      );

      expect(mockPauseRecordingServices).toHaveBeenCalled();

      // Resume
      actor.send({ type: 'RESUME' });

      await waitFor(
        () => {
          expect(actor.getSnapshot().value).toBe('active');
        },
        { timeout: 1000 }
      );

      expect(mockResumeRecordingServices).toHaveBeenCalled();

      actor.stop();
    });

    it('should handle end transition from active', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      // End session
      actor.send({ type: 'END' });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('completed');
      });

      expect(mockStopRecordingServices).toHaveBeenCalled();

      // Verify recording state is stopped
      const finalSnapshot = actor.getSnapshot();
      expect(finalSnapshot.context.recordingState.screenshots).toBe('stopped');
      expect(finalSnapshot.context.recordingState.audio).toBe('stopped');
      expect(finalSnapshot.context.recordingState.video).toBe('stopped');

      actor.stop();
    });

    it('should handle end transition from paused', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      // Pause then end
      actor.send({ type: 'PAUSE' });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('paused');
      });

      actor.send({ type: 'END' });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('completed');
      });

      expect(mockStopRecordingServices).toHaveBeenCalled();

      actor.stop();
    });
  });

  describe('Error Handling', () => {
    it('should transition to error state on validation failure', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      // Mock validation to fail
      mockValidateConfig.mockRejectedValueOnce(new Error('Invalid configuration'));

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('error');
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.errors).toContain('Error: Invalid configuration');

      actor.stop();
    });

    it('should transition to error state on permission check failure', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      mockCheckPermissions.mockRejectedValueOnce(new Error('Permission denied'));

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('error');
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.errors[0]).toContain('Missing permissions');

      actor.stop();
    });

    it('should transition to error state on service start failure', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      mockStartRecordingServices.mockRejectedValueOnce(new Error('Failed to start recording'));

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('error');
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.errors).toContain('Error: Failed to start recording');

      actor.stop();
    });

    it('should allow retry from error state', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      mockValidateConfig.mockRejectedValueOnce(new Error('Temporary error'));

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('error');
      });

      // Reset mock to succeed
      mockValidateConfig.mockResolvedValueOnce({ sessionId: 'retry-session' });

      // Retry
      actor.send({ type: 'RETRY' });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      // Try again (should succeed)
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      actor.stop();
    });

    it('should allow dismiss from error state', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      mockValidateConfig.mockRejectedValueOnce(new Error('Error'));

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('error');
      });

      // Dismiss
      actor.send({ type: 'DISMISS' });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      actor.stop();
    });
  });

  describe('Context Updates', () => {
    it('should update context with session ID after validation', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      const sessionId = 'validated-session-123';
      mockValidateConfig.mockResolvedValueOnce({ sessionId });

      actor.start();

      const initialSnapshot = actor.getSnapshot();
      expect(initialSnapshot.context.sessionId).toBeNull();

      actor.send({ type: 'START', config });

      await waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.sessionId).toBe(sessionId);
      });

      actor.stop();
    });

    it('should update context with recording state after starting', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      mockStartRecordingServices.mockResolvedValueOnce({
        recordingState: {
          screenshots: 'active' as const,
          audio: 'active' as const,
          video: 'active' as const,
        },
      });

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.recordingState.screenshots).toBe('active');
        expect(snapshot.context.recordingState.audio).toBe('active');
        expect(snapshot.context.recordingState.video).toBe('active');
      });

      actor.stop();
    });

    it('should update recording state dynamically while active', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      // Update recording state
      actor.send({
        type: 'UPDATE_RECORDING_STATE',
        updates: {
          screenshots: 'error',
        },
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.recordingState.screenshots).toBe('error');
      expect(snapshot.context.recordingState.audio).toBe('active'); // unchanged

      actor.stop();
    });

    it('should preserve start time throughout session', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      const startTime = actor.getSnapshot().context.startTime;
      expect(startTime).toBeDefined();

      // Pause and resume
      actor.send({ type: 'PAUSE' });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('paused');
      });

      expect(actor.getSnapshot().context.startTime).toBe(startTime);

      actor.send({ type: 'RESUME' });
      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      expect(actor.getSnapshot().context.startTime).toBe(startTime);

      actor.stop();
    });

    it('should clear errors on successful retry', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      mockValidateConfig.mockRejectedValueOnce(new Error('First error'));

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('error');
      });

      expect(actor.getSnapshot().context.errors).toHaveLength(1);

      // Retry
      mockValidateConfig.mockResolvedValueOnce({ sessionId: 'retry-session' });
      actor.send({ type: 'RETRY' });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('idle');
      });

      // Errors should be cleared on new START
      actor.send({ type: 'START', config });

      await waitFor(() => {
        const snapshot = actor.getSnapshot();
        expect(snapshot.context.errors).toHaveLength(0);
      });

      actor.stop();
    });
  });

  describe('Service Integration', () => {
    it('should invoke recording health monitoring while active', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      // monitorRecordingHealth should be invoked as a background service
      // Note: This is invoked by the machine, not directly called
      await waitFor(() => {
        expect(mockMonitorRecordingHealth).toHaveBeenCalled();
      });

      actor.stop();
    });

    it('should not invoke health monitoring when paused', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      const callCountActive = mockMonitorRecordingHealth.mock.calls.length;

      // Pause
      actor.send({ type: 'PAUSE' });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('paused');
      });

      // Wait a bit to ensure no new calls
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Call count should not increase while paused
      expect(mockMonitorRecordingHealth.mock.calls.length).toBe(callCountActive);

      actor.stop();
    });

    it('should call all services in correct order', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      const callOrder: string[] = [];

      mockValidateConfig.mockImplementation(() => {
        callOrder.push('validate');
        return Promise.resolve({ sessionId: 'test-session' });
      });

      mockCheckPermissions.mockImplementation(() => {
        callOrder.push('permissions');
        return Promise.resolve();
      });

      mockStartRecordingServices.mockImplementation(() => {
        callOrder.push('start');
        return Promise.resolve({
          recordingState: {
            screenshots: 'active' as const,
            audio: 'active' as const,
            video: 'idle' as const,
          },
        });
      });

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      expect(callOrder).toEqual(['validate', 'permissions', 'start']);

      actor.stop();
    });
  });

  describe('Edge Cases', () => {
    it('should ignore invalid events in current state', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();

      // Try to pause while idle (invalid)
      actor.send({ type: 'PAUSE' });

      expect(actor.getSnapshot().value).toBe('idle');

      // Try to end while idle (invalid)
      actor.send({ type: 'END' });

      expect(actor.getSnapshot().value).toBe('idle');

      actor.stop();
    });

    it('should handle rapid state transitions', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      // Rapidly pause and resume
      actor.send({ type: 'PAUSE' });
      actor.send({ type: 'RESUME' });

      // Should eventually stabilize
      await waitFor(
        () => {
          const value = actor.getSnapshot().value;
          expect(value === 'active' || value === 'paused').toBe(true);
        },
        { timeout: 2000 }
      );

      actor.stop();
    });

    it('should handle completion as final state', async () => {
      const config = createTestConfig();
      const actor = createActor(sessionMachine);

      actor.start();
      actor.send({ type: 'START', config });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('active');
      });

      actor.send({ type: 'END' });

      await waitFor(() => {
        expect(actor.getSnapshot().value).toBe('completed');
      });

      // Try to send events (should be ignored - final state)
      actor.send({ type: 'START', config });
      actor.send({ type: 'PAUSE' });
      actor.send({ type: 'RESUME' });

      expect(actor.getSnapshot().value).toBe('completed');

      actor.stop();
    });
  });
});
