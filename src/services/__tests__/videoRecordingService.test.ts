/**
 * Unit Tests for VideoRecordingService
 *
 * Tests the multi-source video recording API integration.
 * Task 2.10 - Phase 2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { videoRecordingService } from '../videoRecordingService';
import type { RecordingConfig, RecordingStats } from '../videoRecordingService';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api', () => ({
  path: {
    appDataDir: vi.fn().mockResolvedValue('/mock/app/data'),
    join: vi.fn((...parts) => parts.join('/')),
  },
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    AppData: 'AppData',
  },
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import { invoke } from '@tauri-apps/api/core';

describe('VideoRecordingService - Multi-Source Recording', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset service state
    (videoRecordingService as any).activeSessionId = null;
    (videoRecordingService as any).isRecording = false;
  });

  describe('startMultiSourceRecording', () => {
    it('should start recording with multiple displays', async () => {
      const config: RecordingConfig = {
        sessionId: 'test-session-123',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 60,
        compositor: 'grid',
        sources: [
          { type: 'display', id: '1', name: 'Display 1' },
          { type: 'display', id: '2', name: 'Display 2' },
        ],
      };

      (invoke as any).mockResolvedValueOnce(undefined);

      await videoRecordingService.startMultiSourceRecording(config);

      expect(invoke).toHaveBeenCalledWith('start_multi_source_recording', {
        sessionId: 'test-session-123',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 60,
        displayIds: [1, 2],
        windowIds: null,
        compositorType: 'grid',
      });
    });

    it('should start recording with mixed sources (displays and windows)', async () => {
      const config: RecordingConfig = {
        sessionId: 'test-session-456',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 30,
        compositor: 'sidebyside',
        sources: [
          { type: 'display', id: '1', name: 'Display 1' },
          { type: 'window', id: '12345', name: 'Chrome Window' },
        ],
      };

      (invoke as any).mockResolvedValueOnce(undefined);

      await videoRecordingService.startMultiSourceRecording(config);

      expect(invoke).toHaveBeenCalledWith('start_multi_source_recording', {
        sessionId: 'test-session-456',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 30,
        displayIds: [1],
        windowIds: [12345],
        compositorType: 'sidebyside',
      });
    });

    it('should throw error if no sources specified', async () => {
      const config: RecordingConfig = {
        sessionId: 'test-session-789',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 60,
        compositor: 'passthrough',
        sources: [],
      };

      await expect(videoRecordingService.startMultiSourceRecording(config)).rejects.toThrow(
        'At least one source must be specified'
      );

      expect(invoke).not.toHaveBeenCalled();
    });

    it('should handle Rust backend errors gracefully', async () => {
      const config: RecordingConfig = {
        sessionId: 'test-session-error',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 60,
        compositor: 'grid',
        sources: [
          { type: 'display', id: '1', name: 'Display 1' },
        ],
      };

      (invoke as any).mockRejectedValueOnce(new Error('Screen recording permission denied'));

      await expect(videoRecordingService.startMultiSourceRecording(config)).rejects.toThrow(
        'Screen recording permission denied'
      );
    });

    it('should set activeSessionId and isRecording on success', async () => {
      const config: RecordingConfig = {
        sessionId: 'test-session-state',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 60,
        compositor: 'passthrough',
        sources: [
          { type: 'display', id: '1', name: 'Display 1' },
        ],
      };

      (invoke as any).mockResolvedValueOnce(undefined);

      await videoRecordingService.startMultiSourceRecording(config);

      expect((videoRecordingService as any).activeSessionId).toBe('test-session-state');
      expect((videoRecordingService as any).isRecording).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return recording stats when session is active', async () => {
      // Set up active session
      (videoRecordingService as any).activeSessionId = 'test-session-stats';

      const mockStats: RecordingStats = {
        framesProcessed: 1234,
        framesDropped: 5,
        isRecording: true,
      };

      (invoke as any).mockResolvedValueOnce(mockStats);

      const stats = await videoRecordingService.getStats();

      expect(stats).toEqual({
        framesProcessed: 1234,
        framesDropped: 5,
        isRecording: true,
      });

      expect(invoke).toHaveBeenCalledWith('get_recording_stats', {
        sessionId: 'test-session-stats',
      });
    });

    it('should return null when no active session', async () => {
      // No active session
      (videoRecordingService as any).activeSessionId = null;

      const stats = await videoRecordingService.getStats();

      expect(stats).toBeNull();
      expect(invoke).not.toHaveBeenCalled();
    });

    it('should return null on error (non-critical)', async () => {
      (videoRecordingService as any).activeSessionId = 'test-session-error';

      (invoke as any).mockRejectedValueOnce(new Error('Stats unavailable'));

      const stats = await videoRecordingService.getStats();

      expect(stats).toBeNull();
    });

    it('should handle stats with zero frames', async () => {
      (videoRecordingService as any).activeSessionId = 'test-session-zero';

      const mockStats: RecordingStats = {
        framesProcessed: 0,
        framesDropped: 0,
        isRecording: true,
      };

      (invoke as any).mockResolvedValueOnce(mockStats);

      const stats = await videoRecordingService.getStats();

      expect(stats).toEqual({
        framesProcessed: 0,
        framesDropped: 0,
        isRecording: true,
      });
    });
  });

  describe('Compositor Types', () => {
    it('should support passthrough compositor', async () => {
      const config: RecordingConfig = {
        sessionId: 'test-passthrough',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 60,
        compositor: 'passthrough',
        sources: [{ type: 'display', id: '1', name: 'Display 1' }],
      };

      (invoke as any).mockResolvedValueOnce(undefined);

      await videoRecordingService.startMultiSourceRecording(config);

      expect(invoke).toHaveBeenCalledWith(
        'start_multi_source_recording',
        expect.objectContaining({ compositorType: 'passthrough' })
      );
    });

    it('should support grid compositor', async () => {
      const config: RecordingConfig = {
        sessionId: 'test-grid',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 60,
        compositor: 'grid',
        sources: [
          { type: 'display', id: '1', name: 'Display 1' },
          { type: 'display', id: '2', name: 'Display 2' },
        ],
      };

      (invoke as any).mockResolvedValueOnce(undefined);

      await videoRecordingService.startMultiSourceRecording(config);

      expect(invoke).toHaveBeenCalledWith(
        'start_multi_source_recording',
        expect.objectContaining({ compositorType: 'grid' })
      );
    });

    it('should support sidebyside compositor', async () => {
      const config: RecordingConfig = {
        sessionId: 'test-sidebyside',
        outputPath: '/mock/output/video.mp4',
        width: 1920,
        height: 1080,
        fps: 60,
        compositor: 'sidebyside',
        sources: [
          { type: 'display', id: '1', name: 'Display 1' },
          { type: 'display', id: '2', name: 'Display 2' },
        ],
      };

      (invoke as any).mockResolvedValueOnce(undefined);

      await videoRecordingService.startMultiSourceRecording(config);

      expect(invoke).toHaveBeenCalledWith(
        'start_multi_source_recording',
        expect.objectContaining({ compositorType: 'sidebyside' })
      );
    });
  });
});
