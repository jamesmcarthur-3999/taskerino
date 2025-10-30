import { describe, it, expect, beforeEach } from 'vitest';
import { createActor, waitFor } from 'xstate';
import { sessionMachine } from '../sessionMachine';
import type { SessionRecordingConfig } from '../../types';

describe('sessionMachine', () => {
  let actor: ReturnType<typeof createActor>;

  // Sample valid config
  const validConfig: SessionRecordingConfig = {
    name: 'Test Session',
    description: 'Testing the state machine',
    screenshotsEnabled: true,
    audioConfig: {
      enabled: true,
      sourceType: 'microphone',
    },
  };

  beforeEach(() => {
    // Create a fresh actor before each test
    actor = createActor(sessionMachine);
  });

  describe('Initial State', () => {
    it('should start in idle state', () => {
      actor.start();

      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('should have null sessionId initially', () => {
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.sessionId).toBeNull();
    });

    it('should have empty errors array initially', () => {
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.errors).toEqual([]);
    });

    it('should have all recording services in idle state', () => {
      actor.start();

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.recordingState).toEqual({
        screenshots: 'idle',
        audio: 'idle',
        video: 'idle',
      });
    });
  });

  describe('START Event', () => {
    it('should transition from idle to validating on START', () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      const snapshot = actor.getSnapshot();
      // Should be in validating or beyond (may transition quickly)
      expect(['validating', 'checking_permissions', 'starting', 'active']).toContain(
        snapshot.value
      );
    });

    it('should store config in context on START', () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.config).toEqual(validConfig);
    });

    it('should clear errors on START', () => {
      actor.start();

      // Manually set errors (for testing purposes)
      actor.send({ type: 'START', config: validConfig });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.errors).toEqual([]);
    });
  });

  describe('Validation', () => {
    it('should generate a sessionId during validation', async () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      // Wait for validation to complete
      await waitFor(actor, (state) => state.value !== 'validating', {
        timeout: 1000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.sessionId).toBeTruthy();
      expect(typeof snapshot.context.sessionId).toBe('string');
    });

    it('should reject config without name', async () => {
      actor.start();

      const invalidConfig = { ...validConfig, name: '' };
      actor.send({ type: 'START', config: invalidConfig });

      // Wait for error state
      await waitFor(actor, (state) => state.value === 'error', {
        timeout: 1000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('error');
      expect(snapshot.context.errors.length).toBeGreaterThan(0);
      expect(snapshot.context.errors[0]).toContain('name');
    });

    it('should reject config with no recording types enabled', async () => {
      actor.start();

      const invalidConfig: SessionRecordingConfig = {
        name: 'Test',
        screenshotsEnabled: false,
      };

      actor.send({ type: 'START', config: invalidConfig });

      // Wait for error state
      await waitFor(actor, (state) => state.value === 'error', {
        timeout: 1000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('error');
      expect(snapshot.context.errors[0]).toContain('At least one recording type');
    });

    it('should accept valid audio configuration', async () => {
      actor.start();

      const configWithAudio: SessionRecordingConfig = {
        name: 'Test',
        screenshotsEnabled: false,
        audioConfig: {
          enabled: true,
          sourceType: 'microphone',
          micVolume: 0.8,
          balance: 50,
        },
      };

      actor.send({ type: 'START', config: configWithAudio });

      // Should pass validation
      await waitFor(
        actor,
        (state) => state.value !== 'validating' && state.value !== 'idle',
        {
          timeout: 1000,
        }
      );

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).not.toBe('error');
    });
  });

  describe('State Transitions', () => {
    it('should transition through the happy path: idle -> validating -> checking_permissions -> starting -> active', async () => {
      actor.start();

      const states: string[] = [];

      // Capture initial state
      states.push(actor.getSnapshot().value as string);

      // Subscribe to state changes
      actor.subscribe((state) => {
        states.push(state.value as string);
      });

      actor.send({ type: 'START', config: validConfig });

      // Wait for active state
      await waitFor(actor, (state) => state.value === 'active', {
        timeout: 2000,
      });

      // Verify the state progression
      expect(states).toContain('idle');
      expect(states).toContain('validating');
      expect(states).toContain('checking_permissions');
      expect(states).toContain('starting');
      expect(states).toContain('active');
    });

    it('should transition from active to pausing on PAUSE', async () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      // Wait for active state
      await waitFor(actor, (state) => state.value === 'active', {
        timeout: 2000,
      });

      actor.send({ type: 'PAUSE' });

      // Should transition to pausing or paused
      const snapshot = actor.getSnapshot();
      expect(['pausing', 'paused']).toContain(snapshot.value);
    });

    it('should transition from paused to resuming on RESUME', async () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      // Wait for active state
      await waitFor(actor, (state) => state.value === 'active', {
        timeout: 2000,
      });

      actor.send({ type: 'PAUSE' });

      // Wait for paused state
      await waitFor(actor, (state) => state.value === 'paused', {
        timeout: 2000,
      });

      actor.send({ type: 'RESUME' });

      // Should transition to resuming or active
      const snapshot = actor.getSnapshot();
      expect(['resuming', 'active']).toContain(snapshot.value);
    });

    it('should transition from active to ending on END', async () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      // Wait for active state
      await waitFor(actor, (state) => state.value === 'active', {
        timeout: 2000,
      });

      actor.send({ type: 'END' });

      // Should transition to ending or completed
      const snapshot = actor.getSnapshot();
      expect(['ending', 'completed']).toContain(snapshot.value);
    });

    it('should transition to completed state and set recording states to stopped', async () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      // Wait for active state
      await waitFor(actor, (state) => state.value === 'active', {
        timeout: 2000,
      });

      actor.send({ type: 'END' });

      // Wait for completed state
      await waitFor(actor, (state) => state.value === 'completed', {
        timeout: 2000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('completed');
      expect(snapshot.context.recordingState.screenshots).toBe('stopped');
      expect(snapshot.context.recordingState.audio).toBe('stopped');
      expect(snapshot.context.recordingState.video).toBe('stopped');
    });
  });

  describe('Error Handling', () => {
    it('should transition from error to idle on RETRY', async () => {
      actor.start();

      // Trigger an error with invalid config
      actor.send({ type: 'START', config: { ...validConfig, name: '' } });

      // Wait for error state
      await waitFor(actor, (state) => state.value === 'error', {
        timeout: 1000,
      });

      actor.send({ type: 'RETRY' });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('idle');
    });

    it('should transition from error to idle on DISMISS', async () => {
      actor.start();

      // Trigger an error with invalid config
      actor.send({ type: 'START', config: { ...validConfig, name: '' } });

      // Wait for error state
      await waitFor(actor, (state) => state.value === 'error', {
        timeout: 1000,
      });

      actor.send({ type: 'DISMISS' });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('idle');
    });
  });

  describe('Context Updates', () => {
    it('should update recording state on UPDATE_RECORDING_STATE event', async () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      // Wait for active state
      await waitFor(actor, (state) => state.value === 'active', {
        timeout: 2000,
      });

      actor.send({
        type: 'UPDATE_RECORDING_STATE',
        updates: { screenshots: 'error' },
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.recordingState.screenshots).toBe('error');
      // Other states should remain unchanged
      expect(snapshot.context.recordingState.audio).toBe('active');
    });

    it('should set startTime when entering active state', async () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      // Wait for active state
      await waitFor(actor, (state) => state.value === 'active', {
        timeout: 2000,
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.context.startTime).toBeTruthy();
      expect(typeof snapshot.context.startTime).toBe('number');
    });
  });

  describe('Terminal State', () => {
    it('should not allow transitions from completed state', async () => {
      actor.start();

      actor.send({ type: 'START', config: validConfig });

      // Wait for active state
      await waitFor(actor, (state) => state.value === 'active', {
        timeout: 2000,
      });

      actor.send({ type: 'END' });

      // Wait for completed state
      await waitFor(actor, (state) => state.value === 'completed', {
        timeout: 2000,
      });

      // Try to send events - they should be ignored
      actor.send({ type: 'PAUSE' });
      actor.send({ type: 'RESUME' });

      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toBe('completed');
    });
  });
});
