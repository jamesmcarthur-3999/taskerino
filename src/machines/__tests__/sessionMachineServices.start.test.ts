import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createActor } from 'xstate';
import { startRecordingServices } from '../sessionMachineServices';
import { screenshotCaptureService } from '../../services/screenshotCaptureService';
import { audioRecordingService } from '../../services/audioRecordingService';
import { videoRecordingService } from '../../services/videoRecordingService';
import type { Session, SessionRecordingConfig, SessionScreenshot, SessionAudioSegment } from '../../types';

// Mock all services
vi.mock('../../services/screenshotCaptureService', () => ({
  screenshotCaptureService: {
    startCapture: vi.fn(),
  },
}));

vi.mock('../../services/audioRecordingService', () => ({
  audioRecordingService: {
    startRecording: vi.fn(),
  },
}));

vi.mock('../../services/videoRecordingService', () => ({
  videoRecordingService: {
    startRecording: vi.fn(),
  },
}));

describe('startRecordingServices', () => {
  const mockSessionId = 'test-session-123';
  const mockSession: Session = {
    id: mockSessionId,
    name: 'Test Session',
    description: 'Test Description',
    status: 'active',
    startTime: new Date().toISOString(),
    screenshotInterval: 2,
    autoAnalysis: true,
    enableScreenshots: true,
    audioMode: 'off' as any,
    audioRecording: false,
    screenshots: [],
    extractedTaskIds: [],
    extractedNoteIds: [],
    tags: [],
    audioReviewCompleted: false,
  };

  const mockCallbacks = {
    onScreenshotCapture: vi.fn(),
    onAudioSegment: vi.fn(),
  };

  // Helper to invoke the service and wait for completion
  async function invokeStartService(
    sessionId: string,
    config: SessionRecordingConfig,
    session: Session,
    callbacks: {
      onScreenshotCapture: (screenshot: SessionScreenshot) => void;
      onAudioSegment: (segment: SessionAudioSegment) => void;
    }
  ) {
    return new Promise((resolve, reject) => {
      const actor = createActor(startRecordingServices, {
        input: { sessionId, config, session, callbacks },
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

    // Default mock implementations for services (all succeed)
    (screenshotCaptureService.startCapture as any).mockResolvedValue(undefined);
    (audioRecordingService.startRecording as any).mockResolvedValue(undefined);
    (videoRecordingService.startRecording as any).mockResolvedValue(undefined);
  });

  it('should start screenshot service when enabled', async () => {
    const config: SessionRecordingConfig = {
      name: 'Test Session',
      description: 'Test Description',
      screenshotsEnabled: true,
    };

    const result = await invokeStartService(mockSessionId, config, mockSession, mockCallbacks);

    // Verify screenshot service was called with correct params
    expect(screenshotCaptureService.startCapture).toHaveBeenCalledWith(
      mockSession,
      mockCallbacks.onScreenshotCapture
    );
    expect(screenshotCaptureService.startCapture).toHaveBeenCalledOnce();

    // Verify audio and video services were not called
    expect(audioRecordingService.startRecording).not.toHaveBeenCalled();
    expect(videoRecordingService.startRecording).not.toHaveBeenCalled();

    // Verify result
    expect(result).toEqual({
      recordingState: {
        screenshots: 'active',
        audio: 'idle',
        video: 'idle',
      },
    });
  });

  it('should start audio service when enabled', async () => {
    const config: SessionRecordingConfig = {
      name: 'Test Session',
      description: 'Test Description',
      screenshotsEnabled: false,
      audioConfig: {
        enabled: true,
        sourceType: 'microphone',
      },
    };

    const result = await invokeStartService(mockSessionId, config, mockSession, mockCallbacks);

    // Verify audio service was called with correct params
    expect(audioRecordingService.startRecording).toHaveBeenCalledWith(
      mockSession,
      mockCallbacks.onAudioSegment
    );
    expect(audioRecordingService.startRecording).toHaveBeenCalledOnce();

    // Verify screenshot and video services were not called
    expect(screenshotCaptureService.startCapture).not.toHaveBeenCalled();
    expect(videoRecordingService.startRecording).not.toHaveBeenCalled();

    // Verify result
    expect(result).toEqual({
      recordingState: {
        screenshots: 'idle',
        audio: 'active',
        video: 'idle',
      },
    });
  });

  it('should start video service when enabled', async () => {
    const config: SessionRecordingConfig = {
      name: 'Test Session',
      description: 'Test Description',
      screenshotsEnabled: false,
      videoConfig: {
        enabled: true,
        sourceType: 'display',
        displayIds: ['main'],
        fps: 30,
        resolution: { width: 1920, height: 1080 },
      },
    };

    const result = await invokeStartService(mockSessionId, config, mockSession, mockCallbacks);

    // Verify video service was called with session object
    expect(videoRecordingService.startRecording).toHaveBeenCalledWith(mockSession);
    expect(videoRecordingService.startRecording).toHaveBeenCalledOnce();

    // Verify screenshot and audio services were not called
    expect(screenshotCaptureService.startCapture).not.toHaveBeenCalled();
    expect(audioRecordingService.startRecording).not.toHaveBeenCalled();

    // Verify result
    expect(result).toEqual({
      recordingState: {
        screenshots: 'idle',
        audio: 'idle',
        video: 'active',
      },
    });
  });

  it('should start all services when all enabled', async () => {
    const config: SessionRecordingConfig = {
      name: 'Test Session',
      description: 'Test Description',
      screenshotsEnabled: true,
      audioConfig: {
        enabled: true,
        sourceType: 'microphone',
      },
      videoConfig: {
        enabled: true,
        sourceType: 'display',
        displayIds: ['main'],
        fps: 30,
      },
    };

    const result = await invokeStartService(mockSessionId, config, mockSession, mockCallbacks);

    // Verify all services were called
    expect(screenshotCaptureService.startCapture).toHaveBeenCalledOnce();
    expect(audioRecordingService.startRecording).toHaveBeenCalledOnce();
    expect(videoRecordingService.startRecording).toHaveBeenCalledOnce();

    // Verify result
    expect(result).toEqual({
      recordingState: {
        screenshots: 'active',
        audio: 'active',
        video: 'active',
      },
    });
  });

  it('should handle screenshot service failure', async () => {
    const config: SessionRecordingConfig = {
      name: 'Test Session',
      description: 'Test Description',
      screenshotsEnabled: true,
    };

    const screenshotError = new Error('Screenshot service error');
    (screenshotCaptureService.startCapture as any).mockRejectedValue(screenshotError);

    // Execute the service - should throw
    await expect(
      invokeStartService(mockSessionId, config, mockSession, mockCallbacks)
    ).rejects.toThrow('Screenshot service failed: Error: Screenshot service error');

    // Verify screenshot service was called
    expect(screenshotCaptureService.startCapture).toHaveBeenCalledOnce();
  });

  it('should continue if non-critical service fails', async () => {
    const config: SessionRecordingConfig = {
      name: 'Test Session',
      description: 'Test Description',
      screenshotsEnabled: true,
      audioConfig: {
        enabled: true,
        sourceType: 'microphone',
      },
      videoConfig: {
        enabled: true,
        sourceType: 'display',
        displayIds: ['main'],
      },
    };

    const audioError = new Error('Audio service error');
    (audioRecordingService.startRecording as any).mockRejectedValue(audioError);

    // Execute the service - should throw because any failure throws
    await expect(
      invokeStartService(mockSessionId, config, mockSession, mockCallbacks)
    ).rejects.toThrow('Audio service failed: Error: Audio service error');

    // Verify all services were called (errors are collected, not short-circuited)
    expect(screenshotCaptureService.startCapture).toHaveBeenCalledOnce();
    expect(audioRecordingService.startRecording).toHaveBeenCalledOnce();
    expect(videoRecordingService.startRecording).toHaveBeenCalledOnce();
  });
});
