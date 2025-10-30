import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { pauseRecordingServices, resumeRecordingServices } from '../sessionMachineServices';
import { screenshotCaptureService } from '../../services/screenshotCaptureService';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';

// Mock all services
vi.mock('../../services/screenshotCaptureService', () => ({
  screenshotCaptureService: {
    pauseCapture: vi.fn(),
    resumeCapture: vi.fn(),
  },
}));

vi.mock('../../services/audioRecordingService', () => ({
  audioRecordingService: {
    pauseRecording: vi.fn(),
    resumeRecording: vi.fn(),
  },
}));

vi.mock('../../services/videoRecordingService', () => ({
  videoRecordingService: {
    // Video pause/resume not currently supported
  },
}));

describe('pauseRecordingServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations (all succeed)
    (screenshotCaptureService.pauseCapture as any).mockReturnValue(undefined);
    (audioRecordingService.pauseRecording as any).mockResolvedValue(undefined);
    // Video pause not supported - no mock needed
  });

  it('should pause all services successfully', async () => {
    // Create and start the actor
    const actor = createActor(pauseRecordingServices, {
      input: { sessionId: 'test-session' }
    });

    actor.start();

    // Wait for completion
    const snapshot = await new Promise((resolve, reject) => {
      actor.subscribe({
        complete: () => resolve(actor.getSnapshot()),
        error: reject
      });
    });

    expect(screenshotCaptureService.pauseCapture).toHaveBeenCalledOnce();
    expect(audioRecordingService.pauseRecording).toHaveBeenCalledOnce();
    // Video pause not supported - no call expected
    expect(snapshot.output).toEqual({});
  });

  it('should throw error if any service fails to pause', async () => {
    (audioRecordingService.pauseRecording as any).mockRejectedValue(
      new Error('Audio pause failed')
    );

    // Create and start the actor
    const actor = createActor(pauseRecordingServices, {
      input: { sessionId: 'test-session' }
    });

    actor.start();

    // Wait for error
    await expect(
      new Promise((resolve, reject) => {
        actor.subscribe({
          complete: () => resolve(actor.getSnapshot()),
          error: reject
        });
      })
    ).rejects.toThrow('Failed to pause services');
  });
});

describe('resumeRecordingServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations (all succeed)
    (screenshotCaptureService.resumeCapture as any).mockReturnValue(undefined);
    (audioRecordingService.resumeRecording as any).mockResolvedValue(undefined);
    // Video resume not supported - no mock needed
  });

  it('should resume all services successfully', async () => {
    // Create and start the actor
    const actor = createActor(resumeRecordingServices, {
      input: { sessionId: 'test-session' }
    });

    actor.start();

    // Wait for completion
    const snapshot = await new Promise((resolve, reject) => {
      actor.subscribe({
        complete: () => resolve(actor.getSnapshot()),
        error: reject
      });
    });

    // Note: Resume is delegated to RecordingContext which has session/callback refs
    // Service layer just logs that resume will be handled
    expect(snapshot.output).toEqual({});
  });

  it('should not throw errors since resume is delegated', async () => {
    // Create and start the actor
    const actor = createActor(resumeRecordingServices, {
      input: { sessionId: 'test-session' }
    });

    actor.start();

    // Wait for completion - should not throw
    const snapshot = await new Promise((resolve, reject) => {
      actor.subscribe({
        complete: () => resolve(actor.getSnapshot()),
        error: reject
      });
    });

    // Resume is delegated to RecordingContext, so no errors thrown here
    expect(snapshot.output).toEqual({});
  });
});
