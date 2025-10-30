import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { checkPermissions } from '../sessionMachineServices';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core');

/**
 * Helper function to invoke a fromPromise service directly in tests
 */
async function invokePermissionsService(config: any, sessionId: string) {
  const actor = createActor(checkPermissions, {
    input: { config, sessionId }
  });

  return new Promise((resolve, reject) => {
    actor.subscribe({
      next: (snapshot) => {
        if (snapshot.status === 'done') {
          resolve(snapshot.output);
        } else if (snapshot.status === 'error') {
          reject(snapshot.error);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
    actor.start();
  });
}

describe('checkPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check screen permission when screenshots enabled', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true); // screen permission

    const result = await invokePermissionsService(
      { screenshotsEnabled: true, name: 'Test' },
      'test-id'
    );

    expect(invoke).toHaveBeenCalledWith('check_screen_recording_permission');
    expect(result).toEqual({ permissions: 'granted' });
  });

  it('should check mic permission when audio enabled', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true); // mic permission

    const result = await invokePermissionsService(
      {
        screenshotsEnabled: false,
        audioConfig: { enabled: true, sourceType: 'microphone' },
        name: 'Test'
      },
      'test-id'
    );

    expect(invoke).toHaveBeenCalledWith('check_microphone_permission');
    expect(result).toEqual({ permissions: 'granted' });
  });

  it('should check both permissions when video with audio', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(true) // screen
      .mockResolvedValueOnce(true); // mic

    const result = await invokePermissionsService(
      {
        videoConfig: {
          enabled: true,
          sourceType: 'display',
          includeSystemAudio: true
        },
        name: 'Test'
      },
      'test-id'
    );

    expect(invoke).toHaveBeenNthCalledWith(1, 'check_screen_recording_permission');
    expect(invoke).toHaveBeenNthCalledWith(2, 'check_microphone_permission');
    expect(result).toEqual({ permissions: 'granted' });
  });

  it('should throw error when screen permission denied', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(false); // screen denied

    await expect(invokePermissionsService(
      { screenshotsEnabled: true, name: 'Test' },
      'test-id'
    )).rejects.toThrow('screen recording');
  });

  it('should throw error when mic permission denied', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(false); // mic denied

    await expect(invokePermissionsService(
      {
        audioConfig: { enabled: true, sourceType: 'microphone' },
        name: 'Test'
      },
      'test-id'
    )).rejects.toThrow('microphone');
  });

  it('should handle permission check errors gracefully', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Tauri error'));

    await expect(invokePermissionsService(
      { screenshotsEnabled: true, name: 'Test' },
      'test-id'
    )).rejects.toThrow('screen recording'); // Should treat error as denied
  });

  it('should check screen permission when video enabled', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true); // screen permission

    const result = await invokePermissionsService(
      {
        videoConfig: {
          enabled: true,
          sourceType: 'display'
        },
        name: 'Test'
      },
      'test-id'
    );

    expect(invoke).toHaveBeenCalledWith('check_screen_recording_permission');
    expect(result).toEqual({ permissions: 'granted' });
  });

  it('should check mic permission when video with system audio', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(true) // screen
      .mockResolvedValueOnce(true); // mic

    const result = await invokePermissionsService(
      {
        videoConfig: {
          enabled: true,
          sourceType: 'display',
          includeSystemAudio: true
        },
        name: 'Test'
      },
      'test-id'
    );

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(1, 'check_screen_recording_permission');
    expect(invoke).toHaveBeenNthCalledWith(2, 'check_microphone_permission');
    expect(result).toEqual({ permissions: 'granted' });
  });

  it('should not check any permissions when nothing enabled', async () => {
    const result = await invokePermissionsService(
      {
        screenshotsEnabled: false,
        name: 'Test'
      },
      'test-id'
    );

    expect(invoke).not.toHaveBeenCalled();
    expect(result).toEqual({ permissions: 'granted' });
  });

  it('should throw error with both permissions when both denied', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(false) // screen denied
      .mockResolvedValueOnce(false); // mic denied

    await expect(invokePermissionsService(
      {
        screenshotsEnabled: true,
        audioConfig: { enabled: true, sourceType: 'microphone' },
        name: 'Test'
      },
      'test-id'
    )).rejects.toThrow(/screen recording.*microphone/);
  });
});
