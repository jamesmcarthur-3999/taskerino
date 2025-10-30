import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createActor } from 'xstate';
import { stopRecordingServices } from '../sessionMachineServices';
import { screenshotCaptureService } from '../../services/screenshotCaptureService';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';
import { getPersistenceQueue } from '../../services/storage/PersistenceQueue';

// Mock all services
vi.mock('../../services/screenshotCaptureService', () => ({
  screenshotCaptureService: {
    stopCapture: vi.fn(),
  },
}));

vi.mock('../../services/audioRecordingService', () => ({
  audioRecordingService: {
    stopRecording: vi.fn(),
  },
}));

vi.mock('../../services/videoRecordingService', () => ({
  videoRecordingService: {
    stopRecording: vi.fn(),
  },
}));

vi.mock('../../services/storage/PersistenceQueue', () => ({
  getPersistenceQueue: vi.fn(),
}));

describe('stopRecordingServices', () => {
  const mockSessionId = 'test-session-123';

  // Helper to invoke the service and wait for completion
  async function invokeStopService(sessionId: string) {
    return new Promise((resolve, reject) => {
      const actor = createActor(stopRecordingServices, {
        input: { sessionId },
      });

      actor.subscribe({
        complete: () => {
          resolve(actor.getSnapshot().output);
        },
        error: (error) => {
          reject(error);
        },
      });

      actor.start();
    });
  }

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Default mock implementation for persistence queue
    const mockQueue = {
      flush: vi.fn().mockResolvedValue(undefined),
    };
    (getPersistenceQueue as any).mockReturnValue(mockQueue);

    // Default mock implementations for services (all succeed)
    (screenshotCaptureService.stopCapture as any).mockResolvedValue(undefined);
    (audioRecordingService.stopRecording as any).mockResolvedValue(undefined);
    (videoRecordingService.stopRecording as any).mockResolvedValue(undefined);
  });

  it('should stop all services successfully', async () => {
    // Execute the service
    const result = await invokeStopService(mockSessionId);

    // Verify all services were called
    expect(screenshotCaptureService.stopCapture).toHaveBeenCalledOnce();
    expect(audioRecordingService.stopRecording).toHaveBeenCalledOnce();
    expect(videoRecordingService.stopRecording).toHaveBeenCalledOnce();

    // Verify persistence queue flush was called
    const queue = getPersistenceQueue();
    expect(queue.flush).toHaveBeenCalledOnce();

    // Verify result
    expect(result).toEqual({});
  });

  it('should continue stopping other services if one fails', async () => {
    // Mock screenshot service to fail
    const screenshotError = new Error('Screenshot service error');
    (screenshotCaptureService.stopCapture as any).mockRejectedValue(screenshotError);

    // Execute the service
    const result = await invokeStopService(mockSessionId);

    // Verify all services were still called despite screenshot failure
    expect(screenshotCaptureService.stopCapture).toHaveBeenCalledOnce();
    expect(audioRecordingService.stopRecording).toHaveBeenCalledOnce();
    expect(videoRecordingService.stopRecording).toHaveBeenCalledOnce();

    // Verify persistence queue flush was still called
    const queue = getPersistenceQueue();
    expect(queue.flush).toHaveBeenCalledOnce();

    // Verify result (should not throw)
    expect(result).toEqual({});
  });

  it('should flush storage after stopping services', async () => {
    const callOrder: string[] = [];

    // Track call order
    (screenshotCaptureService.stopCapture as any).mockImplementation(async () => {
      callOrder.push('screenshot');
    });
    (audioRecordingService.stopRecording as any).mockImplementation(async () => {
      callOrder.push('audio');
    });
    (videoRecordingService.stopRecording as any).mockImplementation(async () => {
      callOrder.push('video');
    });

    const mockQueue = {
      flush: vi.fn().mockImplementation(async () => {
        callOrder.push('storage');
      }),
    };
    (getPersistenceQueue as any).mockReturnValue(mockQueue);

    // Execute the service
    await invokeStopService(mockSessionId);

    // Verify call order: all services before storage
    expect(callOrder).toEqual(['screenshot', 'audio', 'video', 'storage']);
  });

  it('should not throw even if all services fail', async () => {
    // Mock all services to fail
    (screenshotCaptureService.stopCapture as any).mockRejectedValue(
      new Error('Screenshot error')
    );
    (audioRecordingService.stopRecording as any).mockRejectedValue(new Error('Audio error'));
    (videoRecordingService.stopRecording as any).mockRejectedValue(new Error('Video error'));

    const mockQueue = {
      flush: vi.fn().mockRejectedValue(new Error('Storage error')),
    };
    (getPersistenceQueue as any).mockReturnValue(mockQueue);

    // Execute the service - should not throw
    const result = await invokeStopService(mockSessionId);

    // Verify all services were called despite failures
    expect(screenshotCaptureService.stopCapture).toHaveBeenCalledOnce();
    expect(audioRecordingService.stopRecording).toHaveBeenCalledOnce();
    expect(videoRecordingService.stopRecording).toHaveBeenCalledOnce();
    expect(mockQueue.flush).toHaveBeenCalledOnce();

    // Verify result (should resolve, not reject)
    expect(result).toEqual({});
  });
});
